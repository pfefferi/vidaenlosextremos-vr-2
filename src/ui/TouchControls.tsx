import { ArrowDown, ArrowUp, ZoomIn, ZoomOut } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { rovInputBus } from '../engine/inputBus';
import { useRovStore } from '../store/rovStore';
import { xrStore } from '../store/xrStore';

const PAD_MAX_RADIUS = 44;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return coarse || touchPoints;
}

export function TouchControls() {
  const { t } = useTranslation();

  const view = useRovStore((s) => s.view);
  const systemMenuOpen = useRovStore((s) => s.systemMenuOpen);
  const controlsGuideOpen = useRovStore((s) => s.controlsGuideOpen);
  const openModalWaypointId = useRovStore((s) => s.openModalWaypointId);
  const preview3d = useRovStore((s) => s.preview3d);

  const isInXrSession = useSyncExternalStore(
    (onStoreChange) => xrStore.subscribe(onStoreChange),
    () => xrStore.getState().session != null,
    () => false
  );

  const [isTouchDevice, setIsTouchDevice] = useState(detectTouchDevice);
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0 });
  const [lookKnob, setLookKnob] = useState({ x: 0, y: 0 });

  const movePointerRef = useRef<{ id: number; originX: number; originY: number } | null>(null);
  const lookPointerRef = useRef<{
    id: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const moveVectorRef = useRef({ surge: 0, sway: 0, heave: 0 });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(pointer: coarse)');
    const onChange = () => setIsTouchDevice(detectTouchDevice());
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  const isActive =
    isTouchDevice &&
    view === 'dive' &&
    !systemMenuOpen &&
    !controlsGuideOpen &&
    !openModalWaypointId &&
    !preview3d &&
    !isInXrSession;

  useEffect(() => {
    if (!isActive) {
      movePointerRef.current = null;
      lookPointerRef.current = null;
      moveVectorRef.current = { surge: 0, sway: 0, heave: 0 };
      rovInputBus.setTouchMove(0, 0, 0);
      setMoveKnob({ x: 0, y: 0 });
      setLookKnob({ x: 0, y: 0 });
    }
    return () => {
      moveVectorRef.current = { surge: 0, sway: 0, heave: 0 };
      rovInputBus.setTouchMove(0, 0, 0);
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  const pushTouchMove = () => {
    const { surge, sway, heave } = moveVectorRef.current;
    rovInputBus.setTouchMove(surge, sway, heave);
  };

  const handleMoveDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (movePointerRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    movePointerRef.current = {
      id: e.pointerId,
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
    };
    updateMoveStick(e.clientX, e.clientY);
  };

  const updateMoveStick = (clientX: number, clientY: number) => {
    const active = movePointerRef.current;
    if (!active) return;
    const rawDx = clientX - active.originX;
    const rawDy = clientY - active.originY;
    const dist = Math.hypot(rawDx, rawDy);
    const scale = dist > PAD_MAX_RADIUS ? PAD_MAX_RADIUS / dist : 1;
    const clampedX = rawDx * scale;
    const clampedY = rawDy * scale;

    setMoveKnob({ x: clampedX, y: clampedY });
    moveVectorRef.current.sway = clamp(clampedX / PAD_MAX_RADIUS, -1, 1);
    moveVectorRef.current.surge = clamp(-clampedY / PAD_MAX_RADIUS, -1, 1);
    pushTouchMove();
  };

  const handleMoveMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (movePointerRef.current?.id !== e.pointerId) return;
    e.preventDefault();
    updateMoveStick(e.clientX, e.clientY);
  };

  const handleMoveUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (movePointerRef.current?.id !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    movePointerRef.current = null;
    moveVectorRef.current.surge = 0;
    moveVectorRef.current.sway = 0;
    setMoveKnob({ x: 0, y: 0 });
    pushTouchMove();
  };

  const handleLookDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    lookPointerRef.current = {
      id: e.pointerId,
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  };

  const handleLookMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const active = lookPointerRef.current;
    if (!active || active.id !== e.pointerId) return;
    e.preventDefault();

    const dx = e.clientX - active.lastX;
    const dy = e.clientY - active.lastY;
    active.lastX = e.clientX;
    active.lastY = e.clientY;
    rovInputBus.addTouchLookDelta(dx, dy);

    const rawDx = e.clientX - active.originX;
    const rawDy = e.clientY - active.originY;
    const dist = Math.hypot(rawDx, rawDy);
    const scale = dist > PAD_MAX_RADIUS ? PAD_MAX_RADIUS / dist : 1;
    setLookKnob({ x: rawDx * scale, y: rawDy * scale });
  };

  const handleLookUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerRef.current?.id !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    lookPointerRef.current = null;
    setLookKnob({ x: 0, y: 0 });
  };

  const setHeave = (value: number) => {
    moveVectorRef.current.heave = value;
    pushTouchMove();
  };

  return (
    <div className="touch-controls" data-testid="touch-controls">
      <div
        className="touch-pad"
        role="application"
        aria-label={t('controls.move_strafe')}
        onPointerDown={handleMoveDown}
        onPointerMove={handleMoveMove}
        onPointerUp={handleMoveUp}
        onPointerCancel={handleMoveUp}
        onLostPointerCapture={handleMoveUp}
        data-testid="touch-pad-move"
      >
        <div
          className="touch-pad__knob"
          style={{ transform: `translate3d(${moveKnob.x}px, ${moveKnob.y}px, 0)` }}
        />
        <span className="touch-pad__label">{t('controls.move_strafe')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
        <div className="touch-side-stack">
          <button
            type="button"
            className="touch-action-btn"
            aria-label={`${t('ui.zoom')} +`}
            onClick={() => rovInputBus.addZoomDelta(-4)}
            data-testid="touch-zoom-in"
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="touch-action-btn"
            aria-label={`${t('ui.zoom')} -`}
            onClick={() => rovInputBus.addZoomDelta(4)}
            data-testid="touch-zoom-out"
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="touch-action-btn"
            aria-label={`${t('ui.vertical')} +`}
            onPointerDown={(e) => {
              e.preventDefault();
              setHeave(1);
            }}
            onPointerUp={() => setHeave(0)}
            onPointerCancel={() => setHeave(0)}
            onPointerLeave={() => setHeave(0)}
            data-testid="touch-ascend"
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="touch-action-btn"
            aria-label={`${t('ui.vertical')} -`}
            onPointerDown={(e) => {
              e.preventDefault();
              setHeave(-1);
            }}
            onPointerUp={() => setHeave(0)}
            onPointerCancel={() => setHeave(0)}
            onPointerLeave={() => setHeave(0)}
            data-testid="touch-descend"
          >
            <ArrowDown size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          className="touch-pad"
          role="application"
          aria-label={t('controls.camera_look')}
          onPointerDown={handleLookDown}
          onPointerMove={handleLookMove}
          onPointerUp={handleLookUp}
          onPointerCancel={handleLookUp}
          onLostPointerCapture={handleLookUp}
          data-testid="touch-pad-look"
        >
          <div
            className="touch-pad__knob"
            style={{ transform: `translate3d(${lookKnob.x}px, ${lookKnob.y}px, 0)` }}
          />
          <span className="touch-pad__label">{t('controls.camera_look')}</span>
        </div>
      </div>
    </div>
  );
}

export default TouchControls;
