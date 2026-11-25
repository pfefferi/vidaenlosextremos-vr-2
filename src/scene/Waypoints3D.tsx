import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useRovStore } from '../store/rovStore';
import type { DiveSite, Waypoint } from '../types/domain';

export interface Waypoints3DProps {
  dive: DiveSite;
}

const PROXIMITY_METERS = 2.0;
const PROXIMITY_SQ = PROXIMITY_METERS * PROXIMITY_METERS;
const UNVISITED_COLOR = '#00aaff';
const VISITED_COLOR = '#00ff88';
const EMPTY_WAYPOINTS: Waypoint[] = [];

interface WaypointMarkerProps {
  waypoint: Waypoint;
  visited: boolean;
  gamifiedMode: boolean;
  onSelect: (id: string) => void;
}

function WaypointMarker({
  waypoint,
  visited,
  gamifiedMode,
  onSelect,
}: WaypointMarkerProps) {
  const nearGroupRef = useRef<THREE.Group>(null);
  const farGroupRef = useRef<THREE.Group>(null);
  const octMeshRef = useRef<THREE.Mesh>(null);
  const sphereMeshRef = useRef<THREE.Mesh>(null);
  const sonarRingRef = useRef<THREE.Mesh>(null);

  const color = visited ? VISITED_COLOR : UNVISITED_COLOR;
  const phaseOffset = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < waypoint.id.length; i++) {
      hash = (hash * 31 + waypoint.id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 628) / 100;
  }, [waypoint.id]);

  const camWorldPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    const t = clock.getElapsedTime() + phaseOffset;

    camera.getWorldPosition(camWorldPos);
    const dx = camWorldPos.x - waypoint.position.x;
    const dy = camWorldPos.y - waypoint.position.y;
    const dz = camWorldPos.z - waypoint.position.z;
    const isNear = dx * dx + dy * dy + dz * dz <= PROXIMITY_SQ;

    const showNear = isNear || visited;
    if (nearGroupRef.current) {
      nearGroupRef.current.visible = showNear;
    }
    if (farGroupRef.current) {
      farGroupRef.current.visible = !showNear;
    }

    if (showNear && octMeshRef.current) {
      octMeshRef.current.rotation.y += dt * 1.4;
      octMeshRef.current.position.y = Math.sin(t * 2.0) * 0.06;
    }

    if (!showNear && sphereMeshRef.current) {
      const pulse = 1 + 0.16 * Math.sin(t * 3.0);
      sphereMeshRef.current.scale.setScalar(pulse);
    }

    if (!showNear && gamifiedMode && !visited && sonarRingRef.current) {
      const cycle = (t * 0.65) % 1;
      const ringScale = 0.4 + cycle * 1.8;
      sonarRingRef.current.scale.set(ringScale, ringScale, 1);
      const mat = sonarRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - cycle) * 0.65;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(waypoint.id);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'auto';
    }
  };

  return (
    <group
      position={[waypoint.position.x, waypoint.position.y, waypoint.position.z]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Generous invisible hit sphere for effortless mouse & WebXR laser clicking */}
      <mesh visible={false}>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Near (<= 2.0m) or visited: spinning octahedron */}
      <group ref={nearGroupRef} visible={visited}>
        <mesh ref={octMeshRef}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.85}
            roughness={0.25}
            metalness={0.15}
          />
        </mesh>
      </group>

      {/* Far (> 2.0m) and unvisited: pulsing sphere + optional gamified beam & sonar ring */}
      <group ref={farGroupRef} visible={!visited}>
        <mesh ref={sphereMeshRef}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.95}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>

        {gamifiedMode && !visited ? (
          <>
            <mesh position={[0, 2.5, 0]}>
              <cylinderGeometry args={[0.025, 0.05, 5.0, 10, 1, true]} />
              <meshBasicMaterial
                color={UNVISITED_COLOR}
                transparent
                opacity={0.32}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh ref={sonarRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
              <ringGeometry args={[0.22, 0.28, 32]} />
              <meshBasicMaterial
                color={UNVISITED_COLOR}
                transparent
                opacity={0.6}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </>
        ) : null}
      </group>
    </group>
  );
}

export function Waypoints3D({ dive }: Waypoints3DProps) {
  const waypoints = useRovStore(
    (s) => s.waypointsBySite[dive.slug] ?? EMPTY_WAYPOINTS
  );
  const visitedWaypointIds = useRovStore((s) => s.visitedWaypointIds);
  const gamifiedMode = useRovStore((s) => s.gamifiedMode);
  const openWaypointModal = useRovStore((s) => s.openWaypointModal);

  const camera = useThree((s) => s.camera);
  const camWorldPos = useMemo(() => new THREE.Vector3(), []);
  const lastActiveIdRef = useRef<string | null>(null);

  const visitedSet = useMemo(
    () => new Set(visitedWaypointIds),
    [visitedWaypointIds]
  );

  useEffect(() => {
    lastActiveIdRef.current = null;
    useRovStore.getState().setActiveWaypointId(null);

    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.cursor = 'auto';
      }
      useRovStore.getState().setActiveWaypointId(null);
    };
  }, [dive.slug]);

  useFrame(() => {
    if (waypoints.length === 0) {
      if (lastActiveIdRef.current !== null) {
        lastActiveIdRef.current = null;
        useRovStore.getState().setActiveWaypointId(null);
      }
      return;
    }

    camera.getWorldPosition(camWorldPos);
    let nearestId: string | null = null;
    let nearestDistSq = PROXIMITY_SQ;

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const dx = camWorldPos.x - wp.position.x;
      const dy = camWorldPos.y - wp.position.y;
      const dz = camWorldPos.z - wp.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= nearestDistSq) {
        nearestDistSq = distSq;
        nearestId = wp.id;
      }
    }

    if (nearestId !== lastActiveIdRef.current) {
      lastActiveIdRef.current = nearestId;
      useRovStore.getState().setActiveWaypointId(nearestId);
    }
  });

  return (
    <group name={`waypoints-${dive.slug}`}>
      {waypoints.map((wp) => (
        <WaypointMarker
          key={wp.id}
          waypoint={wp}
          visited={visitedSet.has(wp.id)}
          gamifiedMode={gamifiedMode}
          onSelect={openWaypointModal}
        />
      ))}
    </group>
  );
}

export default Waypoints3D;
