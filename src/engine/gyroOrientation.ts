import * as THREE from 'three';

export interface GyroLookDelta {
  yawDeltaDeg: number;
  pitchDeltaDeg: number;
}

const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const _q1 = new THREE.Quaternion();
const _fwd = new THREE.Vector3();

function shortestAngleDiffDeg(currentDeg: number, previousDeg: number): number {
  return ((((currentDeg - previousDeg + 180) % 360) + 360) % 360) - 180;
}

/**
 * Computes the Three.js world-space device orientation quaternion from
 * DeviceOrientationEvent angles (alpha, beta, gamma in degrees) and screen
 * orientation angle, matching Three.js DeviceOrientationControls convention.
 */
export function computeDeviceQuaternion(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenOrientDeg = 0,
  out = new THREE.Quaternion()
): THREE.Quaternion {
  const alphaRad = THREE.MathUtils.degToRad(alphaDeg);
  const betaRad = THREE.MathUtils.degToRad(betaDeg);
  const gammaRad = THREE.MathUtils.degToRad(gammaDeg);
  const orientRad = THREE.MathUtils.degToRad(screenOrientDeg);

  _euler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
  out.setFromEuler(_euler);
  out.multiply(_q0);
  out.multiply(_q1.setFromAxisAngle(_zee, -orientRad));
  return out;
}

/**
 * Tracks relative yaw and pitch deltas from consecutive DeviceOrientation samples.
 * Anchors on the first valid sample so enabling the gyroscope never snaps the camera.
 */
export class GyroLookTracker {
  private anchored = false;
  private lastYawDeg = 0;
  private lastPitchDeg = 0;
  private readonly quat = new THREE.Quaternion();

  reset(): void {
    this.anchored = false;
    this.lastYawDeg = 0;
    this.lastPitchDeg = 0;
  }

  update(
    alphaDeg: number,
    betaDeg: number,
    gammaDeg: number,
    screenOrientDeg = 0
  ): GyroLookDelta {
    if (
      !Number.isFinite(alphaDeg) ||
      !Number.isFinite(betaDeg) ||
      !Number.isFinite(gammaDeg) ||
      !Number.isFinite(screenOrientDeg)
    ) {
      return { yawDeltaDeg: 0, pitchDeltaDeg: 0 };
    }

    computeDeviceQuaternion(alphaDeg, betaDeg, gammaDeg, screenOrientDeg, this.quat);
    _fwd.set(0, 0, -1).applyQuaternion(this.quat);

    const horizMag = Math.hypot(_fwd.x, _fwd.z);
    const hasReliableYaw = horizMag >= 1e-4;
    const rawYawDeg = hasReliableYaw
      ? THREE.MathUtils.radToDeg(Math.atan2(-_fwd.x, -_fwd.z))
      : this.lastYawDeg;
    const rawPitchDeg = THREE.MathUtils.radToDeg(
      Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1))
    );

    if (!this.anchored) {
      this.anchored = true;
      this.lastYawDeg = rawYawDeg;
      this.lastPitchDeg = rawPitchDeg;
      return { yawDeltaDeg: 0, pitchDeltaDeg: 0 };
    }

    const yawDeltaDeg = hasReliableYaw
      ? shortestAngleDiffDeg(rawYawDeg, this.lastYawDeg)
      : 0;
    const pitchDeltaDeg = rawPitchDeg - this.lastPitchDeg;

    if (hasReliableYaw) {
      this.lastYawDeg = rawYawDeg;
    }
    this.lastPitchDeg = rawPitchDeg;

    return { yawDeltaDeg, pitchDeltaDeg };
  }
}
