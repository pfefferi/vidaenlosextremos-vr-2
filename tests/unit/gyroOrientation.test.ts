import { describe, expect, it } from 'vitest';
import { GyroLookTracker } from '@/engine/gyroOrientation';

describe('GyroLookTracker', () => {
  it('anchors on the first valid sample without jumping', () => {
    const tracker = new GyroLookTracker();
    const first = tracker.update(45, 90, 0, 0);
    expect(first).toEqual({ yawDeltaDeg: 0, pitchDeltaDeg: 0 });
  });

  it('crosses the 0/360 alpha seam smoothly without a -330 degree jump', () => {
    const tracker = new GyroLookTracker();
    tracker.update(350, 90, 0, 0);
    const next = tracker.update(20, 90, 0, 0);
    expect(next.yawDeltaDeg).toBeCloseTo(30, 4);
    expect(next.pitchDeltaDeg).toBeCloseTo(0, 4);

    const back = tracker.update(350, 90, 0, 0);
    expect(back.yawDeltaDeg).toBeCloseTo(-30, 4);
  });

  it('tracks pitch tilt smoothly in portrait and landscape orientations', () => {
    const portrait = new GyroLookTracker();
    portrait.update(0, 90, 0, 0);
    const portraitUp = portrait.update(0, 120, 0, 0);
    expect(portraitUp.pitchDeltaDeg).toBeCloseTo(30, 4);
    expect(portraitUp.yawDeltaDeg).toBeCloseTo(0, 4);

    const landscape = new GyroLookTracker();
    landscape.update(0, 0, -90, 90);
    const landscapeUp = landscape.update(0, 0, -120, 90);
    expect(landscapeUp.pitchDeltaDeg).toBeCloseTo(30, 4);
    expect(landscapeUp.yawDeltaDeg).toBeCloseTo(0, 4);
  });

  it('clears the prior anchor on reset()', () => {
    const tracker = new GyroLookTracker();
    tracker.update(10, 90, 0, 0);
    tracker.reset();

    const reanchored = tracker.update(180, 110, 0, 0);
    expect(reanchored).toEqual({ yawDeltaDeg: 0, pitchDeltaDeg: 0 });
  });
});
