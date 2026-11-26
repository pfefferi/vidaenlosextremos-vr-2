import { describe, expect, it } from 'vitest';
import { createRovInputBus, isEditableTarget } from '@/engine/inputBus';

describe('RovInputBus', () => {
  it('identifies editable targets and open dialogs', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget({ tagName: 'CANVAS' } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget({ tagName: 'input' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(
      isEditableTarget({
        tagName: 'DIV',
        isContentEditable: true,
      } as unknown as EventTarget)
    ).toBe(true);
    expect(
      isEditableTarget({
        tagName: 'BUTTON',
        closest: (sel: string) => (sel === '[role="dialog"]' ? {} : null),
      } as unknown as EventTarget)
    ).toBe(true);
  });

  it('ignores keyboard events from editable targets and clears stuck keys on clearAll', () => {
    const bus = createRovInputBus();

    const accepted = bus.handleKeyDown({
      code: 'KeyW',
      target: { tagName: 'CANVAS' } as unknown as EventTarget,
    });
    expect(accepted).toBe(true);

    const ignored = bus.handleKeyDown({
      code: 'KeyS',
      target: { tagName: 'INPUT' } as unknown as EventTarget,
    });
    expect(ignored).toBe(false);

    let frame = bus.sampleFrame();
    expect(frame.surge).toBe(1);

    bus.clearAll();
    frame = bus.sampleFrame();
    expect(frame.surge).toBe(0);
  });

  it('supports simultaneous diagonal pointer look deltas without axis locking', () => {
    const bus = createRovInputBus();
    bus.addPointerDelta(10, -5, 0.2);
    bus.addPointerDelta(5, 10, 0.2);

    const frame = bus.sampleFrame();
    expect(frame.yawDeltaDeg).toBeCloseTo(-3.0, 6);
    expect(frame.pitchDeltaDeg).toBeCloseTo(-1.0, 6);

    const nextFrame = bus.sampleFrame();
    expect(nextFrame.yawDeltaDeg).toBe(0);
    expect(nextFrame.pitchDeltaDeg).toBe(0);
  });

  it('supports v1 keyboard bindings (Arrows look, Space/Shift heave, E/Q zoom, 1/2 speed, Enter scan) and UI holds', () => {
    const bus = createRovInputBus();
    const target = { tagName: 'CANVAS' } as unknown as EventTarget;

    bus.handleKeyDown({ code: 'ArrowLeft', target });
    bus.handleKeyDown({ code: 'Space', target });
    bus.handleKeyDown({ code: 'KeyE', target });
    bus.handleKeyDown({ code: 'Digit2', target, repeat: false });
    bus.handleKeyDown({ code: 'Enter', target, repeat: false });

    const frame1 = bus.sampleFrame();
    expect(frame1.yawDeltaDeg).toBeGreaterThan(0);
    expect(frame1.heave).toBe(1);
    expect(frame1.zoomDelta).toBeLessThan(0);
    expect(frame1.speedStep).toBe(1);
    expect(frame1.scanPressed).toBe(true);

    bus.clearAll();
    bus.handleKeyDown({ code: 'ShiftLeft', target });
    bus.handleKeyDown({ code: 'KeyQ', target });
    bus.handleKeyDown({ code: 'Digit1', target, repeat: false });

    const frame2 = bus.sampleFrame();
    expect(frame2.heave).toBe(-1);
    expect(frame2.zoomDelta).toBeGreaterThan(0);
    expect(frame2.speedStep).toBe(-1);

    bus.clearAll();
    bus.setUiHold('move-up', true);
    bus.setUiHold('ascend', true);
    bus.setUiHold('zoom-in', true);

    const holdFrame = bus.sampleFrame();
    expect(holdFrame.surge).toBe(1);
    expect(holdFrame.heave).toBe(1);
    expect(holdFrame.zoomDelta).toBeLessThan(0);

    bus.clearUiHolds();
    const releasedFrame = bus.sampleFrame();
    expect(releasedFrame.surge).toBe(0);
    expect(releasedFrame.heave).toBe(0);
    expect(releasedFrame.zoomDelta).toBe(0);
  });

  it('safely samples gamepads with fewer than 16 buttons and applies deadzone + rising edge', () => {
    const bus = createRovInputBus();
    const shortGamepad = {
      connected: true,
      axes: [0.05, -0.5, 0.1, 0],
      buttons: [{ pressed: true, touched: true, value: 1 }, { pressed: false, touched: false, value: 0 }],
    } as unknown as Gamepad;

    const frame1 = bus.sampleFrame([null, shortGamepad]);
    expect(frame1.sway).toBe(0); // inside 0.15 deadzone
    expect(frame1.surge).toBeGreaterThan(0.35);
    expect(frame1.yawDeltaDeg).toBe(0); // inside 0.15 deadzone
    expect(frame1.scanPressed).toBe(true); // rising edge on button 0
    expect(frame1.menuPressed).toBe(false); // missing button 9 does not throw

    // Held on frame 2 -> scanPressed must be false
    const frame2 = bus.sampleFrame([shortGamepad]);
    expect(frame2.scanPressed).toBe(false);
  });
});
