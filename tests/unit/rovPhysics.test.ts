import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { computeModelNormalization } from '@/engine/modelNormalize';
import {
  DEFAULT_SPEED_INDEX,
  MAX_PITCH_RAD,
  SPEED_LEVELS,
  formatSpeedLevel,
  stepRovKinematics,
  type RovKinematicsState,
} from '@/engine/rovPhysics';

describe('rovPhysics', () => {
  it('exposes expected speed levels and formats exact decimals', () => {
    expect(SPEED_LEVELS).toHaveLength(14);
    expect(SPEED_LEVELS[DEFAULT_SPEED_INDEX]).toBe(0.5);
    expect(formatSpeedLevel(0.05)).toBe('0.05');
    expect(formatSpeedLevel(0.15)).toBe('0.15');
    expect(formatSpeedLevel(0.5)).toBe('0.5');
    expect(formatSpeedLevel(0.75)).toBe('0.75');
    expect(formatSpeedLevel(1.0)).toBe('1.0');
    expect(formatSpeedLevel(1.2)).toBe('1.2');
  });

  it('clamps rawDt to [0, 0.05] seconds', () => {
    const initial: RovKinematicsState = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yawRad: 0,
      pitchRad: 0,
    };
    const input = { surge: 1, sway: 0, heave: 0 };
    const config = { baseMoveSpeedPerSec: 10, speedIndex: DEFAULT_SPEED_INDEX, fov: 80 };

    const clamped = stepRovKinematics(initial, input, config, 0.05);
    const oversized = stepRovKinematics(initial, input, config, 0.5);
    const negative = stepRovKinematics(initial, input, config, -0.2);

    expect(oversized.position).toEqual(clamped.position);
    expect(oversized.velocity).toEqual(clamped.velocity);
    expect(negative.position).toEqual(initial.position);
    expect(negative.velocity).toEqual(initial.velocity);
  });

  it('is frame-rate independent between 60 Hz and 144 Hz over 1.0 s', () => {
    const config = { baseMoveSpeedPerSec: 8, speedIndex: DEFAULT_SPEED_INDEX, fov: 80 };
    const input = { surge: 1, sway: 0.4, heave: 0.2 };

    let state60: RovKinematicsState = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yawRad: 0.3,
      pitchRad: 0,
    };
    for (let i = 0; i < 60; i++) {
      state60 = stepRovKinematics(state60, input, config, 1 / 60);
    }

    let state144: RovKinematicsState = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yawRad: 0.3,
      pitchRad: 0,
    };
    for (let i = 0; i < 144; i++) {
      state144 = stepRovKinematics(state144, input, config, 1 / 144);
    }

    const dist60 = Math.hypot(state60.position.x, state60.position.y, state60.position.z);
    const dist144 = Math.hypot(state144.position.x, state144.position.y, state144.position.z);
    const relDiff = Math.abs(dist60 - dist144) / dist60;

    expect(dist60).toBeGreaterThan(1);
    expect(relDiff).toBeLessThan(0.01);
  });

  it('clamps pitch to [-85, +85] degrees and applies yaw basis + turbo/fov scaling', () => {
    const initial: RovKinematicsState = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yawRad: 0,
      pitchRad: 0,
    };

    const upPitch = stepRovKinematics(
      initial,
      { surge: 0, sway: 0, heave: 0, pitchDeltaDeg: 150 },
      { baseMoveSpeedPerSec: 10, speedIndex: DEFAULT_SPEED_INDEX, fov: 80 },
      1 / 60
    );
    expect(upPitch.pitchRad).toBeCloseTo(MAX_PITCH_RAD, 6);

    const downPitch = stepRovKinematics(
      initial,
      { surge: 0, sway: 0, heave: 0, pitchDeltaDeg: -150 },
      { baseMoveSpeedPerSec: 10, speedIndex: DEFAULT_SPEED_INDEX, fov: 80 },
      1 / 60
    );
    expect(downPitch.pitchRad).toBeCloseTo(-MAX_PITCH_RAD, 6);

    const normal = stepRovKinematics(
      initial,
      { surge: 1, sway: 0, heave: 0, turbo: false },
      { baseMoveSpeedPerSec: 10, speedIndex: DEFAULT_SPEED_INDEX, fov: 80 },
      1 / 60
    );
    const turbo = stepRovKinematics(
      initial,
      { surge: 1, sway: 0, heave: 0, turbo: true },
      { baseMoveSpeedPerSec: 10, speedIndex: DEFAULT_SPEED_INDEX, fov: 80 },
      1 / 60
    );
    const zoomed = stepRovKinematics(
      initial,
      { surge: 1, sway: 0, heave: 0, turbo: false },
      { baseMoveSpeedPerSec: 10, speedIndex: DEFAULT_SPEED_INDEX, fov: 40 },
      1 / 60
    );

    expect(normal.position.z).toBeLessThan(0);
    expect(turbo.position.z / normal.position.z).toBeCloseTo(1.5, 5);
    expect(zoomed.position.z / normal.position.z).toBeCloseTo(0.5, 5);
  });

  it('computes calm underwater baseMoveSpeedPerSec between 1 and 6 m/s for a 20-unit mesh', () => {
    const geom = new THREE.BoxGeometry(20, 8, 12);
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geom, mat);

    const summary = computeModelNormalization(mesh);

    expect(summary.rawMaxDim).toBeCloseTo(20, 5);
    expect(summary.baseMoveSpeedPerSec).toBeGreaterThanOrEqual(1);
    expect(summary.baseMoveSpeedPerSec).toBeLessThanOrEqual(6);

    geom.dispose();
    mat.dispose();
  });
});
