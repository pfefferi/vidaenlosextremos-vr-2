import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getAssetEntry, resolveAssetUrl } from '../engine/assetUrl';
import { BvhTerrainCollider } from '../engine/bvhCollider';
import {
  applyMaterialPolicy,
  computeModelNormalization,
  type ModelTransformSummary,
} from '../engine/modelNormalize';
import { useRovStore } from '../store/rovStore';
import type { DiveSite, MaterialPolicy } from '../types/domain';

export interface TerrainReadyInfo {
  collider: BvhTerrainCollider;
  floorY: number;
  baseMoveSpeedPerSec: number;
}

export interface TerrainModelProps {
  dive: DiveSite;
  onReady: (info: TerrainReadyInfo) => void;
}

export interface RovQaApi {
  setCameraPose?: (
    pos: [number, number, number],
    lookAt: [number, number, number]
  ) => void;
  getSceneStats?: () => ModelTransformSummary | null;
  setMaterialOverride?: (mode: MaterialPolicy | 'wireframe') => void;
}

declare global {
  interface Window {
    __ROV_QA__?: RovQaApi;
  }
}

const DEFAULT_EMPTY_FLOOR_Y = -5;
const DEFAULT_EMPTY_MOVE_SPEED = 12;

function disposeTexture(tex: unknown): void {
  if (!tex || typeof tex !== 'object') return;
  const candidate = tex as THREE.Texture & { isTexture?: boolean };
  if (!candidate.isTexture) return;
  const img = candidate.image as { close?: () => void } | undefined;
  if (img && typeof img.close === 'function') {
    try {
      img.close();
    } catch {
      // Ignore already-closed ImageBitmap
    }
  }
  candidate.dispose();
}

function disposeObject3D(root: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const renderable = obj as THREE.Mesh | THREE.Points | THREE.Line;
    if (renderable.geometry && !disposedGeometries.has(renderable.geometry)) {
      disposedGeometries.add(renderable.geometry);
      renderable.geometry.dispose();
    }

    const rawMat = (obj as THREE.Mesh).material;
    if (!rawMat) return;
    const materials = Array.isArray(rawMat) ? rawMat : [rawMat];
    for (const mat of materials) {
      if (!mat || disposedMaterials.has(mat)) continue;
      disposedMaterials.add(mat);
      for (const value of Object.values(mat)) {
        disposeTexture(value);
      }
      mat.dispose();
    }
  });
}

async function fetchArrayBufferWithProgress(
  url: string,
  expectedBytes: number | undefined,
  signal: AbortSignal,
  onProgress: (percent: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch terrain model (${response.status} ${response.statusText})`);
  }

  const headerLen = response.headers.get('content-length');
  const totalBytes =
    headerLen && Number.isFinite(Number(headerLen)) && Number(headerLen) > 0
      ? Number(headerLen)
      : expectedBytes && expectedBytes > 0
        ? expectedBytes
        : 0;

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress(95);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  let lastPercent = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loadedBytes += value.byteLength;
      if (totalBytes > 0) {
        const pct = Math.min(95, Math.round((loadedBytes / totalBytes) * 95));
        if (pct !== lastPercent) {
          lastPercent = pct;
          onProgress(pct);
        }
      }
    }
  }

  const merged = new Uint8Array(loadedBytes);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    merged.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }

  onProgress(96);
  return merged.buffer;
}

export function TerrainModel({ dive, onReady }: TerrainModelProps) {
  const [mountedGroup, setMountedGroup] = useState<THREE.Group | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const loadedSceneRef = useRef<THREE.Object3D | null>(null);
  const materialOverrideRef = useRef<MaterialPolicy | 'wireframe' | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__ROV_QA__ = {
      ...(window.__ROV_QA__ ?? {}),
      getSceneStats: () => useRovStore.getState().sceneStats,
      setMaterialOverride: (mode) => {
        materialOverrideRef.current = mode;
        if (loadedSceneRef.current) {
          applyMaterialPolicy(loadedSceneRef.current, mode);
        }
      },
    };
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    const abortController = new AbortController();
    const { setLoadingState, setSceneStats } = useRovStore.getState();

    let activeWrapper: THREE.Group | null = null;
    let activeCollider: BvhTerrainCollider | null = null;
    let disposed = false;

    const cleanupResources = () => {
      if (disposed) return;
      disposed = true;
      abortController.abort();
      if (activeCollider) {
        activeCollider.dispose();
        activeCollider = null;
      }
      if (activeWrapper) {
        disposeObject3D(activeWrapper);
        activeWrapper = null;
      }
      loadedSceneRef.current = null;
    };

    if (!dive.modelKey) {
      const emptyCollider = new BvhTerrainCollider();
      activeCollider = emptyCollider;
      loadedSceneRef.current = null;
      setMountedGroup(null);
      setSceneStats(null);
      setLoadingState({ phase: 'ready', progress: 100 });
      onReadyRef.current({
        collider: emptyCollider,
        floorY: DEFAULT_EMPTY_FLOOR_Y,
        baseMoveSpeedPerSec: DEFAULT_EMPTY_MOVE_SPEED,
      });

      return cleanupResources;
    }

    setMountedGroup(null);
    setSceneStats(null);
    setLoadingState({ phase: 'loading', progress: 0, error: null });

    const loadModel = async () => {
      try {
        const modelKey = dive.modelKey!;
        const url = resolveAssetUrl(modelKey);
        const expectedBytes = getAssetEntry(modelKey).bytes;

        const buffer = await fetchArrayBufferWithProgress(
          url,
          expectedBytes,
          abortController.signal,
          (progress) => {
            if (abortController.signal.aborted || generation !== generationRef.current) return;
            useRovStore.getState().setLoadingState({ phase: 'loading', progress });
          }
        );

        if (abortController.signal.aborted || generation !== generationRef.current) return;

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        await MeshoptDecoder.ready;

        if (abortController.signal.aborted || generation !== generationRef.current) return;

        const resourceBase = url.slice(0, url.lastIndexOf('/') + 1);
        const gltf = await loader.parseAsync(buffer, resourceBase);

        if (abortController.signal.aborted || generation !== generationRef.current) {
          disposeObject3D(gltf.scene);
          return;
        }

        // Compute normalization at unscaled origin before wrapping in world transform group
        gltf.scene.position.set(0, 0, 0);
        gltf.scene.rotation.set(0, 0, 0);
        gltf.scene.scale.set(1, 1, 1);
        gltf.scene.updateMatrixWorld(true);

        const summary = computeModelNormalization(gltf.scene);
        const policy = materialOverrideRef.current ?? dive.materialPolicy ?? 'authored';
        applyMaterialPolicy(gltf.scene, policy);

        const wrapper = new THREE.Group();
        wrapper.name = `terrain-${dive.slug}`;
        wrapper.position.set(summary.position.x, summary.position.y, summary.position.z);
        wrapper.scale.setScalar(summary.scale);
        wrapper.add(gltf.scene);
        wrapper.updateMatrixWorld(true);

        const collider = new BvhTerrainCollider(wrapper);

        if (abortController.signal.aborted || generation !== generationRef.current) {
          collider.dispose();
          disposeObject3D(wrapper);
          return;
        }

        activeWrapper = wrapper;
        activeCollider = collider;
        loadedSceneRef.current = gltf.scene;

        setMountedGroup(wrapper);
        useRovStore.getState().setSceneStats(summary);
        useRovStore.getState().setLoadingState({ phase: 'ready', progress: 100 });
        onReadyRef.current({
          collider,
          floorY: summary.floorY,
          baseMoveSpeedPerSec: summary.baseMoveSpeedPerSec,
        });
      } catch (err) {
        if (
          abortController.signal.aborted ||
          generation !== generationRef.current ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load 3D terrain model';
        useRovStore.getState().setLoadingState({ phase: 'error', error: message });
      }
    };

    void loadModel();

    return cleanupResources;
  }, [dive.slug, dive.modelKey, dive.materialPolicy]);

  return mountedGroup ? <primitive object={mountedGroup} /> : null;
}

export default TerrainModel;
