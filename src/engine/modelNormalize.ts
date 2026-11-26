import * as THREE from 'three';
import type { MaterialInspectMode, MaterialPolicy, Vec3Data } from '../types/domain';

export const TARGET_SIZE_METERS = 20;

export interface ModelTransformSummary {
  scale: number;
  position: Vec3Data;
  floorY: number;
  rawMaxDim: number;
  baseMoveSpeedPerSec: number;
  triangleCount: number;
  vertexCount: number;
  doubleSidedCount: number;
}

interface OriginalMaterialState {
  side: THREE.Side;
  wireframe: boolean;
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

export function computeModelNormalization(root: THREE.Object3D): ModelTransformSummary {
  root.updateMatrixWorld(true);
  _box.setFromObject(root);

  if (_box.isEmpty()) {
    return {
      scale: 1,
      position: { x: 0, y: -2, z: -10 },
      floorY: -2,
      rawMaxDim: 1,
      baseMoveSpeedPerSec: 60 * (0.02 + Math.log10(2) * 0.03),
      triangleCount: 0,
      vertexCount: 0,
      doubleSidedCount: 0,
    };
  }

  _box.getSize(_size);
  _box.getCenter(_center);

  const rawMaxDim = Math.max(_size.x, _size.y, _size.z) || 1;
  const scale = TARGET_SIZE_METERS / rawMaxDim;
  const position: Vec3Data = {
    x: -_center.x * scale,
    y: -_center.y * scale - 2,
    z: -_center.z * scale - 10,
  };
  const floorY = position.y - (_size.y * scale) / 2;
  const baseMoveSpeedPerSec = 60 * (0.02 + Math.log10(rawMaxDim + 1) * 0.03);

  let triangleCount = 0;
  let vertexCount = 0;
  let doubleSidedCount = 0;
  const seenMaterials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const geom = mesh.geometry;
    const posAttr = geom.getAttribute('position');
    if (posAttr) {
      vertexCount += posAttr.count;
    }

    const index = geom.getIndex();
    if (index) {
      triangleCount += Math.floor(index.count / 3);
    } else if (posAttr) {
      triangleCount += Math.floor(posAttr.count / 3);
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      if (!mat || seenMaterials.has(mat)) continue;
      seenMaterials.add(mat);
      if (mat.side === THREE.DoubleSide) {
        doubleSidedCount += 1;
      }
    }
  });

  return {
    scale,
    position,
    floorY,
    rawMaxDim,
    baseMoveSpeedPerSec,
    triangleCount,
    vertexCount,
    doubleSidedCount,
  };
}

function getOrStashOriginal(mat: THREE.Material): OriginalMaterialState {
  const userData = mat.userData as { __rovOrig?: OriginalMaterialState };
  if (!userData.__rovOrig) {
    userData.__rovOrig = {
      side: mat.side,
      wireframe: 'wireframe' in mat ? Boolean((mat as { wireframe?: boolean }).wireframe) : false,
    };
  }
  return userData.__rovOrig;
}

export function applyMaterialPolicy(
  root: THREE.Object3D,
  policy: MaterialPolicy | MaterialInspectMode
): void {
  const seen = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);

      const orig = getOrStashOriginal(mat);
      const prevSide = mat.side;

      switch (policy) {
        case 'authored':
        case 'normals':
          mat.side = orig.side;
          if ('wireframe' in mat) {
            (mat as { wireframe: boolean }).wireframe = false;
          }
          break;
        case 'front-only':
          mat.side = THREE.FrontSide;
          if ('wireframe' in mat) {
            (mat as { wireframe: boolean }).wireframe = false;
          }
          break;
        case 'double-sided':
          mat.side = THREE.DoubleSide;
          if ('wireframe' in mat) {
            (mat as { wireframe: boolean }).wireframe = false;
          }
          break;
        case 'wireframe':
          mat.side = orig.side;
          if ('wireframe' in mat) {
            (mat as { wireframe: boolean }).wireframe = true;
          }
          break;
      }

      if (mat.side !== prevSide) {
        mat.needsUpdate = true;
      }
    }
  });
}
