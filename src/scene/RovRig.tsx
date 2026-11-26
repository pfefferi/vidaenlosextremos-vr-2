import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin, useXR, useXRInputSourceState } from '@react-three/xr';
import * as THREE from 'three';
import { BvhTerrainCollider } from '../engine/bvhCollider';
import { rovInputBus } from '../engine/inputBus';
import { stepRovKinematics, type RovKinematicsState } from '../engine/rovPhysics';
import { useRovStore } from '../store/rovStore';
import type { DiveSite } from '../types/domain';

export interface RovRigProps {
  dive: DiveSite;
  collider: BvhTerrainCollider | null;
  floorY: number;
  baseMoveSpeedPerSec: number;
  children?: ReactNode;
}

interface QaCameraOverride {
  pos: [number, number, number];
  lookAt: [number, number, number];
}

const XR_DEADZONE = 0.15;
const XR_SNAP_ENGAGE = 0.65;
const XR_SNAP_RELEASE = 0.35;
const XR_SNAP_DEGREES = 30;
const XR_SMOOTH_TURN_DEG_PER_SEC = 120;
const ROV_COLLISION_RADIUS = 0.35;
const TELEMETRY_INTERVAL_SEC = 0.1;

function applyStickDeadzone(value: number, deadzone = XR_DEADZONE): number {
  if (Math.abs(value) <= deadzone) return 0;
  return (Math.sign(value) * (Math.abs(value) - deadzone)) / (1 - deadzone);
}

function createSpawnKinematics(dive: DiveSite): RovKinematicsState {
  return {
    position: { ...dive.spawn.position },
    velocity: { x: 0, y: 0, z: 0 },
    yawRad: THREE.MathUtils.degToRad(dive.spawn.rotationDeg.y),
    pitchRad: THREE.MathUtils.degToRad(dive.spawn.rotationDeg.x),
  };
}

function computeHeadingDeg(yawRad: number): number {
  return Number(((((-yawRad * 180) / Math.PI) % 360 + 360) % 360).toFixed(1));
}

export function RovRig({
  dive,
  collider,
  floorY,
  baseMoveSpeedPerSec,
  children,
}: RovRigProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const xrSession = useXR((s) => s.session);
  const leftController = useXRInputSourceState('controller', 'left');
  const rightController = useXRInputSourceState('controller', 'right');

  const fov = useRovStore((s) => s.fov);
  const resetTrigger = useRovStore((s) => s.resetTrigger);

  const xrOriginRef = useRef<THREE.Group>(null);
  const headlampRef = useRef<THREE.SpotLight>(null);
  const headlampTarget = useMemo(() => new THREE.Object3D(), []);

  const kinematicsRef = useRef<RovKinematicsState>(createSpawnKinematics(dive));
  const qaOverrideRef = useRef<QaCameraOverride | null>(null);
  const diveRef = useRef(dive);
  diveRef.current = dive;
  const xrSessionRef = useRef(xrSession);
  xrSessionRef.current = xrSession;
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const telemetryAccumRef = useRef(0);
  const snapTurnLockedRef = useRef(false);
  const xrPrevButtonsRef = useRef({ scan: false, menu: false });

  // Pre-allocated scratch math objects (zero allocations inside useFrame)
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpCamWorldPos = useMemo(() => new THREE.Vector3(), []);
  const tmpCamWorldDir = useMemo(() => new THREE.Vector3(), []);

  // Keep PerspectiveCamera near/far/fov synchronized (outside XR)
  useEffect(() => {
    if (xrSession) return;
    const persp = camera as THREE.PerspectiveCamera;
    if (!persp.isPerspectiveCamera) return;

    let dirty = false;
    if (persp.near !== 0.05) {
      persp.near = 0.05;
      dirty = true;
    }
    if (persp.far !== 250) {
      persp.far = 250;
      dirty = true;
    }
    if (persp.fov !== fov) {
      persp.fov = fov;
      dirty = true;
    }
    if (dirty) {
      persp.updateProjectionMatrix();
    }
  }, [camera, fov, xrSession]);

  // Reset kinematics and clear QA camera override only when dive.slug or resetTrigger changes
  useEffect(() => {
    const currentDive = diveRef.current;
    const initial = createSpawnKinematics(currentDive);
    kinematicsRef.current = initial;
    qaOverrideRef.current = null;
    snapTurnLockedRef.current = false;
    telemetryAccumRef.current = 0;

    if (xrOriginRef.current) {
      xrOriginRef.current.position.set(
        initial.position.x,
        initial.position.y,
        initial.position.z
      );
      xrOriginRef.current.rotation.set(0, initial.yawRad, 0);
    }

    if (!xrSessionRef.current) {
      camera.position.set(initial.position.x, initial.position.y, initial.position.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(initial.pitchRad, initial.yawRad, 0);
      camera.updateMatrixWorld();
    }

    useRovStore.getState().setTelemetryLive({
      headingDeg: computeHeadingDeg(initial.yawRad),
      depthMeters: currentDive.telemetry.depth,
      x: Number(initial.position.x.toFixed(2)),
      y: Number(initial.position.y.toFixed(2)),
      z: Number(initial.position.z.toFixed(2)),
    });
  }, [dive.slug, resetTrigger, camera]);

  // Expose Playwright QA camera hook on window.__ROV_QA__ without clobbering sibling keys
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__ROV_QA__ = {
      ...(window.__ROV_QA__ ?? {}),
      setCameraPose: (pos, lookAt) => {
        const currentDive = diveRef.current;
        qaOverrideRef.current = { pos: [...pos], lookAt: [...lookAt] };
        camera.rotation.order = 'YXZ';
        camera.position.set(pos[0], pos[1], pos[2]);
        camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
        camera.updateMatrixWorld();

        useRovStore.getState().setTelemetryLive({
          headingDeg: computeHeadingDeg(camera.rotation.y),
          depthMeters: Number(
            (currentDive.telemetry.depth + (currentDive.spawn.position.y - pos[1])).toFixed(2)
          ),
          x: Number(pos[0].toFixed(2)),
          y: Number(pos[1].toFixed(2)),
          z: Number(pos[2].toFixed(2)),
        });
      },
    };
  }, [camera, dive.slug]);

  // Register desktop/keyboard/wheel/blur input listeners
  useEffect(() => {
    const domElement = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) return;
      const s = useRovStore.getState();
      if (s.systemMenuOpen || s.openModalWaypointId !== null || s.controlsGuideOpen) return;
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const s = useRovStore.getState();
      if (s.systemMenuOpen || s.openModalWaypointId !== null || s.controlsGuideOpen) {
        isDraggingRef.current = false;
        return;
      }
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      rovInputBus.addPointerDelta(dx, dy);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      const s = useRovStore.getState();
      if (s.systemMenuOpen || s.openModalWaypointId !== null || s.controlsGuideOpen) return;
      e.preventDefault();
      rovInputBus.addZoomDelta(e.deltaY);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const s = useRovStore.getState();
      if (s.controlsGuideOpen || s.openModalWaypointId !== null) {
        return;
      }
      if (s.systemMenuOpen && e.code === 'Escape') {
        return;
      }
      const handled = rovInputBus.handleKeyDown(e);
      if (
        handled &&
        (e.code === 'Space' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight')
      ) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      rovInputBus.handleKeyUp(e);
    };

    const handleClearInputs = () => {
      isDraggingRef.current = false;
      rovInputBus.clearAll();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        handleClearInputs();
      }
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleClearInputs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleClearInputs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      handleClearInputs();
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    const store = useRovStore.getState();

    // Always sample & drain input bus each frame to prevent stale deltas
    const gamepads =
      typeof navigator !== 'undefined' ? navigator.getGamepads?.() : undefined;
    const busFrame = rovInputBus.sampleFrame(gamepads);

    // Sample XR controller inputs when in an active WebXR session
    let xrSurge = 0;
    let xrSway = 0;
    let xrHeave = 0;
    let xrYawDeltaDeg = 0;
    let xrTurbo = false;
    let xrScanPressed = false;
    let xrMenuPressed = false;

    if (xrSession) {
      const leftPad = leftController?.gamepad;
      const rightPad = rightController?.gamepad;

      const leftStick = leftPad?.['xr-standard-thumbstick'];
      if (leftStick) {
        xrSway = applyStickDeadzone(leftStick.xAxis ?? 0);
        xrSurge = -applyStickDeadzone(leftStick.yAxis ?? 0);
      }

      const rightStick = rightPad?.['xr-standard-thumbstick'];
      if (rightStick) {
        xrHeave = -applyStickDeadzone(rightStick.yAxis ?? 0);
        const rx = rightStick.xAxis ?? 0;

        if (store.comfortSnapTurn) {
          if (snapTurnLockedRef.current) {
            if (Math.abs(rx) < XR_SNAP_RELEASE) {
              snapTurnLockedRef.current = false;
            }
          } else if (Math.abs(rx) >= XR_SNAP_ENGAGE) {
            xrYawDeltaDeg = rx > 0 ? -XR_SNAP_DEGREES : XR_SNAP_DEGREES;
            snapTurnLockedRef.current = true;
          }
        } else {
          const dzRx = applyStickDeadzone(rx);
          xrYawDeltaDeg = -dzRx * XR_SMOOTH_TURN_DEG_PER_SEC * dt;
        }
      }

      const leftSqueeze = leftPad?.['xr-standard-squeeze']?.state === 'pressed';
      const rightSqueeze = rightPad?.['xr-standard-squeeze']?.state === 'pressed';
      xrTurbo = Boolean(leftSqueeze || rightSqueeze);

      const scanButtonDown = Boolean(
        rightPad?.['a-button']?.state === 'pressed' ||
          leftPad?.['x-button']?.state === 'pressed'
      );
      const menuButtonDown = Boolean(
        rightPad?.['b-button']?.state === 'pressed' ||
          leftPad?.['y-button']?.state === 'pressed'
      );

      xrScanPressed = scanButtonDown && !xrPrevButtonsRef.current.scan;
      xrMenuPressed = menuButtonDown && !xrPrevButtonsRef.current.menu;
      xrPrevButtonsRef.current.scan = scanButtonDown;
      xrPrevButtonsRef.current.menu = menuButtonDown;
    } else {
      xrPrevButtonsRef.current.scan = false;
      xrPrevButtonsRef.current.menu = false;
      snapTurnLockedRef.current = false;
    }

    // Discrete menu toggle (blocked when a waypoint modal or controls guide is open)
    if (
      (busFrame.menuPressed || xrMenuPressed) &&
      store.openModalWaypointId === null &&
      !store.controlsGuideOpen
    ) {
      store.setSystemMenuOpen(!store.systemMenuOpen);
    }

    const uiBlocked =
      store.systemMenuOpen || store.openModalWaypointId !== null || store.controlsGuideOpen;

    // Respect QA manual camera override while active
    if (qaOverrideRef.current) {
      const { pos, lookAt } = qaOverrideRef.current;
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
      camera.updateMatrixWorld();
    } else {
      if (!uiBlocked) {
        if ((busFrame.scanPressed || xrScanPressed) && store.activeWaypointId) {
          store.openWaypointModal(store.activeWaypointId);
        }
        if (busFrame.speedStep !== 0) {
          store.stepSpeedIndex(busFrame.speedStep);
        }
        if (!xrSession && busFrame.zoomDelta !== 0) {
          const zoomStep = THREE.MathUtils.clamp(busFrame.zoomDelta * 0.04, -10, 10);
          store.setFov(store.fov + zoomStep);
        }
      }

      const motionInput = uiBlocked
        ? { surge: 0, sway: 0, heave: 0, yawDeltaDeg: 0, pitchDeltaDeg: 0, turbo: false }
        : {
            surge: THREE.MathUtils.clamp(busFrame.surge + xrSurge, -1, 1),
            sway: THREE.MathUtils.clamp(busFrame.sway + xrSway, -1, 1),
            heave: THREE.MathUtils.clamp(busFrame.heave + xrHeave, -1, 1),
            yawDeltaDeg: busFrame.yawDeltaDeg + xrYawDeltaDeg,
            pitchDeltaDeg: xrSession ? 0 : busFrame.pitchDeltaDeg,
            turbo: busFrame.turbo || xrTurbo,
          };

      const nextState = stepRovKinematics(
        kinematicsRef.current,
        motionInput,
        {
          baseMoveSpeedPerSec,
          speedIndex: store.speedIndex,
          fov: store.fov,
        },
        dt
      );

      tmpPos.set(nextState.position.x, nextState.position.y, nextState.position.z);
      if (collider) {
        collider.resolveSphereCollision(tmpPos, ROV_COLLISION_RADIUS, floorY);
      } else {
        const minY = floorY + ROV_COLLISION_RADIUS * 0.5;
        if (tmpPos.y < minY) tmpPos.y = minY;
      }

      nextState.position.x = tmpPos.x;
      nextState.position.y = tmpPos.y;
      nextState.position.z = tmpPos.z;
      kinematicsRef.current = nextState;

      if (xrSession) {
        if (xrOriginRef.current) {
          xrOriginRef.current.position.set(tmpPos.x, tmpPos.y, tmpPos.z);
          xrOriginRef.current.rotation.set(0, nextState.yawRad, 0);
        }
      } else {
        camera.position.copy(tmpPos);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(nextState.pitchRad, nextState.yawRad, 0);
        if (xrOriginRef.current) {
          xrOriginRef.current.position.set(tmpPos.x, tmpPos.y, tmpPos.z);
          xrOriginRef.current.rotation.set(0, nextState.yawRad, 0);
        }
      }

      telemetryAccumRef.current += dt;
      if (telemetryAccumRef.current >= TELEMETRY_INTERVAL_SEC) {
        telemetryAccumRef.current = 0;
        const depthMeters = Number(
          (dive.telemetry.depth + (dive.spawn.position.y - tmpPos.y)).toFixed(2)
        );
        store.setTelemetryLive({
          headingDeg: computeHeadingDeg(nextState.yawRad),
          depthMeters,
          x: Number(tmpPos.x.toFixed(2)),
          y: Number(tmpPos.y.toFixed(2)),
          z: Number(tmpPos.z.toFixed(2)),
        });
      }
    }

    // Aim ROV headlamp from live camera world pose
    if (headlampRef.current) {
      camera.getWorldPosition(tmpCamWorldPos);
      camera.getWorldDirection(tmpCamWorldDir);
      headlampRef.current.position.copy(tmpCamWorldPos);
      headlampTarget.position.copy(tmpCamWorldPos).addScaledVector(tmpCamWorldDir, 8);
      headlampTarget.updateMatrixWorld();
    }
  });

  return (
    <>
      <XROrigin ref={xrOriginRef}>{children}</XROrigin>
      <primitive object={headlampTarget} />
      <spotLight
        ref={headlampRef}
        target={headlampTarget}
        color="#e2f4ff"
        intensity={18}
        distance={30}
        angle={0.58}
        penumbra={0.65}
        decay={1.4}
      />
    </>
  );
}

export default RovRig;
