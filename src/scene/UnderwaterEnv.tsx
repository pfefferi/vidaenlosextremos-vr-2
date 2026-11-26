import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DiveSite } from '../types/domain';

export interface UnderwaterEnvProps {
  dive: DiveSite;
  floorY: number;
}

const MARINE_SNOW_COUNT = 180;
const SNOW_BOX_HALF_XZ = 14;
const SNOW_BOX_HALF_Y = 8;

interface SnowMote {
  ox: number;
  oy: number;
  oz: number;
  speedY: number;
  driftPhase: number;
  driftAmp: number;
  scale: number;
}

function wrapCoord(val: number, center: number, halfSpan: number): number {
  const span = halfSpan * 2;
  const rel = val - center;
  const wrapped = ((((rel + halfSpan) % span) + span) % span) - halfSpan;
  return center + wrapped;
}

export function UnderwaterEnv({ dive, floorY }: UnderwaterEnvProps) {
  const snowRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const camWorldPos = useMemo(() => new THREE.Vector3(), []);

  const motes = useMemo<SnowMote[]>(() => {
    const items: SnowMote[] = [];
    // Deterministic PRNG so scene visuals remain reproducible
    let seed = 1337;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < MARINE_SNOW_COUNT; i++) {
      items.push({
        ox: (nextRand() * 2 - 1) * SNOW_BOX_HALF_XZ,
        oy: (nextRand() * 2 - 1) * SNOW_BOX_HALF_Y,
        oz: (nextRand() * 2 - 1) * SNOW_BOX_HALF_XZ,
        speedY: 0.04 + nextRand() * 0.09,
        driftPhase: nextRand() * Math.PI * 2,
        driftAmp: 0.08 + nextRand() * 0.18,
        scale: 0.65 + nextRand() * 0.85,
      });
    }
    return items;
  }, []);

  const snowGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.018, 0), []);
  const snowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#d4ecfa',
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      snowGeometry.dispose();
      snowMaterial.dispose();
    };
  }, [snowGeometry, snowMaterial]);

  useFrame(({ clock }) => {
    const mesh = snowRef.current;
    if (!mesh) return;

    const t = clock.getElapsedTime();
    camera.getWorldPosition(camWorldPos);

    for (let i = 0; i < MARINE_SNOW_COUNT; i++) {
      const m = motes[i];
      const rawX = m.ox + Math.sin(t * 0.35 + m.driftPhase) * m.driftAmp;
      const rawY = m.oy - t * m.speedY;
      const rawZ = m.oz + Math.cos(t * 0.3 + m.driftPhase) * m.driftAmp;

      const x = wrapCoord(rawX, camWorldPos.x, SNOW_BOX_HALF_XZ);
      const y = Math.max(
        floorY + 0.05,
        wrapCoord(rawY, camWorldPos.y, SNOW_BOX_HALF_Y)
      );
      const z = wrapCoord(rawZ, camWorldPos.z, SNOW_BOX_HALF_XZ);

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(m.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <color attach="background" args={[dive.theme.bgColor]} />
      <fogExp2 attach="fog" args={[dive.theme.fogColor, 0.032]} />

      {/* Constant, uniform diffuse illumination (zero spotlights or directional hot-spots) */}
      <ambientLight intensity={3.14} color="#ffffff" />

      {/* Extended seafloor disc */}
      <mesh position={[0, floorY - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[120, 64]} />
        <meshStandardMaterial
          color={dive.theme.floorColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>

      {/* Subtle instanced marine snow motes */}
      <instancedMesh
        ref={snowRef}
        args={[snowGeometry, snowMaterial, MARINE_SNOW_COUNT]}
        frustumCulled={false}
      />
    </>
  );
}

export default UnderwaterEnv;
