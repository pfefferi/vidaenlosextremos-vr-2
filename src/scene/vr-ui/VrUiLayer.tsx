import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Vector3, type Group } from 'three';
import { useRovStore } from '../../store/rovStore';
import { VrCockpitHud } from './VrCockpitHud';
import { VrWaypointModal } from './VrWaypointModal';

const ANCHOR_DISTANCE_M = 1.45;
const MAX_FRAME_DT = 0.05;

const _camPos = new Vector3();
const _camDir = new Vector3();
const _horizDir = new Vector3();
const _targetPos = new Vector3();

function normalizeSignedAngle(angleRad: number): number {
  let a = angleRad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Spatial UI root mounted inside the R3F <Canvas><XR> tree.
 * Renders the 3D cockpit HUD and waypoint modal when in WebXR or Desktop 3D Preview.
 */
export function VrUiLayer() {
  const inXr = useXR((s) => s.session != null);
  const preview3d = useRovStore((s) => s.preview3d);
  const openModalWaypointId = useRovStore((s) => s.openModalWaypointId);

  const isActive = inXr || preview3d;
  const anchorRef = useRef<Group | null>(null);
  const initializedRef = useRef(false);
  const yawRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      initializedRef.current = false;
    }
  }, [isActive]);

  useFrame(({ camera }, rawDelta) => {
    if (!isActive) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    camera.getWorldPosition(_camPos);
    camera.getWorldDirection(_camDir);

    _horizDir.set(_camDir.x, 0, _camDir.z);
    if (_horizDir.lengthSq() > 1e-5) {
      _horizDir.normalize();
    } else {
      _horizDir.set(0, 0, -1);
    }

    _targetPos.copy(_camPos).addScaledVector(_horizDir, ANCHOR_DISTANCE_M);
    const targetYaw = Math.atan2(-_horizDir.x, -_horizDir.z);

    if (!initializedRef.current) {
      anchor.position.copy(_targetPos);
      anchor.rotation.set(0, targetYaw, 0);
      yawRef.current = targetYaw;
      initializedRef.current = true;
      return;
    }

    const dt = Math.min(Math.max(rawDelta, 0), MAX_FRAME_DT);
    const posAlpha = 1 - Math.exp(-10 * dt);
    anchor.position.lerp(_targetPos, posAlpha);

    const yawRate = openModalWaypointId ? 1.8 : 4.0;
    const yawAlpha = 1 - Math.exp(-yawRate * dt);
    const yawDelta = normalizeSignedAngle(targetYaw - yawRef.current);
    yawRef.current = normalizeSignedAngle(yawRef.current + yawDelta * yawAlpha);
    anchor.rotation.set(0, yawRef.current, 0);
  });

  if (!isActive) {
    return null;
  }

  return (
    <group ref={anchorRef}>
      <group position={[0, -0.36, 0]} rotation={[-0.35, 0, 0]}>
        <VrCockpitHud inXr={inXr} />
      </group>
      {openModalWaypointId ? (
        <group position={[0, 0.18, 0.08]}>
          <VrWaypointModal />
        </group>
      ) : null}
    </group>
  );
}

export default VrUiLayer;
