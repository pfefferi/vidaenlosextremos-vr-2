export interface KeyLikeEvent {
  code: string;
  target: EventTarget | null;
  repeat?: boolean;
}

export type UiHoldControl =
  | 'move-up'
  | 'move-down'
  | 'move-left'
  | 'move-right'
  | 'ascend'
  | 'descend'
  | 'zoom-in'
  | 'zoom-out';

export interface SampledInputFrame {
  surge: number;
  sway: number;
  heave: number;
  yawDeltaDeg: number;
  pitchDeltaDeg: number;
  zoomDelta: number;
  turbo: boolean;
  scanPressed: boolean;
  menuPressed: boolean;
  speedStep: number;
}

const GAMEPAD_DEADZONE = 0.15;
const ARROW_YAW_DEG_PER_FRAME = 1.5;
const ARROW_PITCH_DEG_PER_FRAME = 1.2;
const KEY_OR_UI_ZOOM_STEP = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applyDeadzone(value: number, deadzone = GAMEPAD_DEADZONE): number {
  if (Math.abs(value) <= deadzone) return 0;
  const sign = Math.sign(value);
  return (sign * (Math.abs(value) - deadzone)) / (1 - deadzone);
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;

  const el = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => unknown;
  };

  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }

  if (el.isContentEditable === true) {
    return true;
  }

  const contentEditable = el.getAttribute?.('contenteditable');
  if (contentEditable === '' || contentEditable === 'true') {
    return true;
  }

  if (typeof el.closest === 'function') {
    if (
      el.closest('[contenteditable="true"]') ||
      el.closest('dialog[open]') ||
      el.closest('[role="dialog"]')
    ) {
      return true;
    }
  }

  return false;
}

export class RovInputBus {
  readonly keys = new Set<string>();
  readonly uiHolds = new Set<UiHoldControl>();
  readonly mouseLookDelta = { yawDeg: 0, pitchDeg: 0 };
  readonly touchMove = { surge: 0, sway: 0, heave: 0 };
  readonly touchLookDelta = { yawDeg: 0, pitchDeg: 0 };
  zoomDelta = 0;
  gamepadPrevButtons: boolean[] = [];

  private pendingScan = false;
  private pendingMenu = false;
  private pendingSpeedStep = 0;

  handleKeyDown(e: KeyLikeEvent): boolean {
    if (isEditableTarget(e.target)) {
      return false;
    }

    this.keys.add(e.code);

    if (!e.repeat) {
      if (e.code === 'KeyF' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        this.pendingScan = true;
      } else if (e.code === 'Escape' || e.code === 'KeyM') {
        this.pendingMenu = true;
      } else if (
        e.code === 'Digit2' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd' ||
        e.code === 'BracketRight'
      ) {
        this.pendingSpeedStep += 1;
      } else if (
        e.code === 'Digit1' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract' ||
        e.code === 'BracketLeft'
      ) {
        this.pendingSpeedStep -= 1;
      }
    }

    return true;
  }

  handleKeyUp(e: KeyLikeEvent): void {
    this.keys.delete(e.code);
  }

  setUiHold(control: UiHoldControl, active: boolean): void {
    if (active) {
      this.uiHolds.add(control);
    } else {
      this.uiHolds.delete(control);
    }
  }

  clearUiHolds(): void {
    this.uiHolds.clear();
  }

  addPointerDelta(dx: number, dy: number, sensitivity = 0.2): void {
    this.mouseLookDelta.yawDeg += -dx * sensitivity;
    this.mouseLookDelta.pitchDeg += -dy * sensitivity;
  }

  addTouchLookDelta(dx: number, dy: number, sensitivity = 0.25): void {
    this.touchLookDelta.yawDeg += -dx * sensitivity;
    this.touchLookDelta.pitchDeg += -dy * sensitivity;
  }

  setTouchMove(surge: number, sway: number, heave = 0): void {
    this.touchMove.surge = clamp(surge, -1, 1);
    this.touchMove.sway = clamp(sway, -1, 1);
    this.touchMove.heave = clamp(heave, -1, 1);
  }

  addZoomDelta(delta: number): void {
    this.zoomDelta += delta;
  }

  clearAll(): void {
    this.keys.clear();
    this.uiHolds.clear();
    this.mouseLookDelta.yawDeg = 0;
    this.mouseLookDelta.pitchDeg = 0;
    this.touchMove.surge = 0;
    this.touchMove.sway = 0;
    this.touchMove.heave = 0;
    this.touchLookDelta.yawDeg = 0;
    this.touchLookDelta.pitchDeg = 0;
    this.zoomDelta = 0;
    this.gamepadPrevButtons = [];
    this.pendingScan = false;
    this.pendingMenu = false;
    this.pendingSpeedStep = 0;
  }

  sampleFrame(gamepads?: readonly (Gamepad | null)[]): SampledInputFrame {
    let surge = this.touchMove.surge;
    let sway = this.touchMove.sway;
    let heave = this.touchMove.heave;
    let turbo = false;

    if (this.keys.has('KeyW') || this.uiHolds.has('move-up')) surge += 1;
    if (this.keys.has('KeyS') || this.uiHolds.has('move-down')) surge -= 1;
    if (this.keys.has('KeyD') || this.uiHolds.has('move-right')) sway += 1;
    if (this.keys.has('KeyA') || this.uiHolds.has('move-left')) sway -= 1;
    if (this.keys.has('Space') || this.uiHolds.has('ascend')) heave += 1;
    if (
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.keys.has('KeyC') ||
      this.keys.has('ControlLeft') ||
      this.keys.has('ControlRight') ||
      this.uiHolds.has('descend')
    ) {
      heave -= 1;
    }

    let yawDeltaDeg = this.mouseLookDelta.yawDeg + this.touchLookDelta.yawDeg;
    let pitchDeltaDeg = this.mouseLookDelta.pitchDeg + this.touchLookDelta.pitchDeg;

    if (this.keys.has('ArrowLeft')) yawDeltaDeg += ARROW_YAW_DEG_PER_FRAME;
    if (this.keys.has('ArrowRight')) yawDeltaDeg -= ARROW_YAW_DEG_PER_FRAME;
    if (this.keys.has('ArrowUp')) pitchDeltaDeg += ARROW_PITCH_DEG_PER_FRAME;
    if (this.keys.has('ArrowDown')) pitchDeltaDeg -= ARROW_PITCH_DEG_PER_FRAME;

    let zoomDelta = this.zoomDelta;
    if (this.keys.has('KeyE') || this.uiHolds.has('zoom-in')) zoomDelta -= KEY_OR_UI_ZOOM_STEP;
    if (this.keys.has('KeyQ') || this.uiHolds.has('zoom-out')) zoomDelta += KEY_OR_UI_ZOOM_STEP;

    let scanPressed = this.pendingScan;
    let menuPressed = this.pendingMenu;
    let speedStep = this.pendingSpeedStep;

    this.mouseLookDelta.yawDeg = 0;
    this.mouseLookDelta.pitchDeg = 0;
    this.touchLookDelta.yawDeg = 0;
    this.touchLookDelta.pitchDeg = 0;
    this.zoomDelta = 0;
    this.pendingScan = false;
    this.pendingMenu = false;
    this.pendingSpeedStep = 0;

    if (gamepads && gamepads.length > 0) {
      const gp = gamepads.find((pad) => pad && pad.connected !== false) ?? null;
      if (gp) {
        const axes = gp.axes ?? [];
        const buttons = gp.buttons ?? [];

        const ax0 = applyDeadzone(axes[0] ?? 0);
        const ax1 = applyDeadzone(axes[1] ?? 0);
        const ax2 = applyDeadzone(axes[2] ?? 0);
        const ax3 = applyDeadzone(axes[3] ?? 0);

        sway += ax0;
        surge += -ax1;
        yawDeltaDeg += -ax2 * 2.5;
        pitchDeltaDeg += -ax3 * 2.0;

        const isPressed = (idx: number): boolean => Boolean(buttons[idx]?.pressed);
        const risingEdge = (idx: number): boolean =>
          isPressed(idx) && !Boolean(this.gamepadPrevButtons[idx]);

        if (isPressed(4)) heave -= 1;
        if (isPressed(5)) heave += 1;
        if (isPressed(6)) zoomDelta += KEY_OR_UI_ZOOM_STEP;
        if (isPressed(7)) zoomDelta -= KEY_OR_UI_ZOOM_STEP;
        if (isPressed(2) || isPressed(10)) turbo = true;
        if (risingEdge(0)) scanPressed = true;
        if (risingEdge(12)) speedStep += 1;
        if (risingEdge(13)) speedStep -= 1;
        if (risingEdge(9)) menuPressed = true;

        this.gamepadPrevButtons = Array.from({ length: buttons.length }, (_, idx) =>
          isPressed(idx)
        );
      } else {
        this.gamepadPrevButtons = [];
      }
    }

    return {
      surge: clamp(surge, -1, 1),
      sway: clamp(sway, -1, 1),
      heave: clamp(heave, -1, 1),
      yawDeltaDeg,
      pitchDeltaDeg,
      zoomDelta,
      turbo,
      scanPressed,
      menuPressed,
      speedStep,
    };
  }
}

export function createRovInputBus(): RovInputBus {
  return new RovInputBus();
}

export const rovInputBus = createRovInputBus();
