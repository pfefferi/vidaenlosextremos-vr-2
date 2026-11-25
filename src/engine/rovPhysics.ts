import type { Vec3Data } from '../types/domain';

export const SPEED_LEVELS = [
  0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0, 1.2, 1.5,
] as const;

export const DEFAULT_SPEED_INDEX = 7;

export const MAX_ROV_DT = 0.05;
export const MAX_PITCH_RAD = (85 * Math.PI) / 180;
export const DEFAULT_ROV_DAMPING = 14;

export interface RovKinematicsState {
  position: Vec3Data;
  velocity: Vec3Data;
  yawRad: number;
  pitchRad: number;
}

export interface RovMotionInput {
  surge: number;
  sway: number;
  heave: number;
  yawDeltaDeg?: number;
  pitchDeltaDeg?: number;
  turbo?: boolean;
}

export interface RovPhysicsConfig {
  baseMoveSpeedPerSec: number;
  speedIndex: number;
  fov: number;
  damping?: number;
}

export function formatSpeedLevel(level: number): string {
  return Number.isInteger(level) ? level.toFixed(1) : String(level);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function stepRovKinematics(
  state: RovKinematicsState,
  input: RovMotionInput,
  config: RovPhysicsConfig,
  rawDt: number
): RovKinematicsState {
  const dt = Math.min(Math.max(rawDt, 0), MAX_ROV_DT);

  const yawRad = state.yawRad + degToRad(input.yawDeltaDeg ?? 0);
  const pitchRad = clamp(
    state.pitchRad + degToRad(input.pitchDeltaDeg ?? 0),
    -MAX_PITCH_RAD,
    MAX_PITCH_RAD
  );

  const clampedSpeedIndex = clamp(
    Math.round(config.speedIndex),
    0,
    SPEED_LEVELS.length - 1
  );
  const speedLevel = SPEED_LEVELS[clampedSpeedIndex] ?? SPEED_LEVELS[DEFAULT_SPEED_INDEX];
  const fovScale = (config.fov > 0 ? config.fov : 80) / 80;
  const turboScale = input.turbo ? 1.5 : 1.0;
  const linearSpeed = config.baseMoveSpeedPerSec * fovScale * speedLevel * turboScale;

  const rawSurge = clamp(input.surge, -1, 1);
  const rawSway = clamp(input.sway, -1, 1);
  const horizMag = Math.hypot(rawSurge, rawSway);
  const normSurge = horizMag > 1 ? rawSurge / horizMag : rawSurge;
  const normSway = horizMag > 1 ? rawSway / horizMag : rawSway;
  const normHeave = clamp(input.heave, -1, 1) * 0.8;

  const sinYaw = Math.sin(yawRad);
  const cosYaw = Math.cos(yawRad);

  // Three.js Y-up right-handed basis: yaw=0 looks down -Z, +X is right.
  const forwardX = -sinYaw;
  const forwardZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  const targetVx = (forwardX * normSurge + rightX * normSway) * linearSpeed;
  const targetVy = normHeave * linearSpeed;
  const targetVz = (forwardZ * normSurge + rightZ * normSway) * linearSpeed;

  if (dt === 0) {
    return {
      position: { ...state.position },
      velocity: { ...state.velocity },
      yawRad,
      pitchRad,
    };
  }

  const damping = config.damping ?? DEFAULT_ROV_DAMPING;
  let nextVx: number;
  let nextVy: number;
  let nextVz: number;
  let dx: number;
  let dy: number;
  let dz: number;

  if (damping > 0) {
    const decay = Math.exp(-damping * dt);
    const invDamping = (1 - decay) / damping;
    nextVx = targetVx + (state.velocity.x - targetVx) * decay;
    nextVy = targetVy + (state.velocity.y - targetVy) * decay;
    nextVz = targetVz + (state.velocity.z - targetVz) * decay;

    dx = targetVx * dt + (state.velocity.x - targetVx) * invDamping;
    dy = targetVy * dt + (state.velocity.y - targetVy) * invDamping;
    dz = targetVz * dt + (state.velocity.z - targetVz) * invDamping;
  } else {
    nextVx = targetVx;
    nextVy = targetVy;
    nextVz = targetVz;
    dx = targetVx * dt;
    dy = targetVy * dt;
    dz = targetVz * dt;
  }

  return {
    position: {
      x: state.position.x + dx,
      y: state.position.y + dy,
      z: state.position.z + dz,
    },
    velocity: {
      x: nextVx,
      y: nextVy,
      z: nextVz,
    },
    yawRad,
    pitchRad,
  };
}
