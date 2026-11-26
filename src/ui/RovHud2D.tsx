import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  Glasses,
  Menu,
  Minus,
  Plus,
  RotateCcw,
  ScanEye,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveAssetUrl } from '../engine/assetUrl';
import { rovInputBus, type UiHoldControl } from '../engine/inputBus';
import { SPEED_LEVELS, formatSpeedLevel } from '../engine/rovPhysics';
import { useRovStore } from '../store/rovStore';
import { xrStore } from '../store/xrStore';

function formatHeading(deg: number): string {
  const normalized = Math.round(((deg % 360) + 360) % 360);
  return String(normalized).padStart(3, '0');
}

function formatLoadingPercent(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  const scaled = progress < 1 ? progress * 100 : progress;
  return Math.min(100, Math.max(0, Math.round(scaled)));
}

function bindHoldControl(control: UiHoldControl) {
  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    rovInputBus.setUiHold(control, false);
  };

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      rovInputBus.setUiHold(control, true);
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: () => {
      rovInputBus.setUiHold(control, false);
    },
    onContextMenu: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
    },
  };
}

export function RovHud2D() {
  const { t } = useTranslation();

  const view = useRovStore((s) => s.view);
  const activeDiveSlug = useRovStore((s) => s.activeDiveSlug);
  const dives = useRovStore((s) => s.dives);
  const waypointsBySite = useRovStore((s) => s.waypointsBySite);
  const hudMode = useRovStore((s) => s.hudMode);
  const gamifiedMode = useRovStore((s) => s.gamifiedMode);
  const speedIndex = useRovStore((s) => s.speedIndex);
  const preview3d = useRovStore((s) => s.preview3d);
  const activeWaypointId = useRovStore((s) => s.activeWaypointId);
  const visitedWaypointIds = useRovStore((s) => s.visitedWaypointIds);
  const loadingState = useRovStore((s) => s.loadingState);
  const telemetryLive = useRovStore((s) => s.telemetryLive);

  const cycleHudMode = useRovStore((s) => s.cycleHudMode);
  const stepSpeedIndex = useRovStore((s) => s.stepSpeedIndex);
  const setPreview3d = useRovStore((s) => s.setPreview3d);
  const setSystemMenuOpen = useRovStore((s) => s.setSystemMenuOpen);
  const openWaypointModal = useRovStore((s) => s.openWaypointModal);
  const triggerReset = useRovStore((s) => s.triggerReset);
  const launchDive = useRovStore((s) => s.launchDive);
  const returnToMenu = useRovStore((s) => s.returnToMenu);

  const isInXrSession = useSyncExternalStore(
    (onStoreChange) => xrStore.subscribe(onStoreChange),
    () => xrStore.getState().session != null,
    () => false
  );

  const [xrSupported, setXrSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.xr?.isSessionSupported) {
      navigator.xr
        .isSessionSupported('immersive-vr')
        .then((supported) => {
          if (!cancelled) setXrSupported(supported);
        })
        .catch(() => {
          if (!cancelled) setXrSupported(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      rovInputBus.clearUiHolds();
    };
  }, [hudMode, preview3d, view]);

  if (view !== 'dive') {
    return null;
  }

  const activeDive = activeDiveSlug ? dives[activeDiveSlug] : undefined;
  const siteWaypoints = activeDiveSlug ? (waypointsBySite[activeDiveSlug] ?? []) : [];
  const siteWaypointIds = new Set(siteWaypoints.map((wp) => wp.id));
  const analyzedCount = visitedWaypointIds.filter((id) => siteWaypointIds.has(id)).length;
  const isMissionComplete =
    gamifiedMode && siteWaypoints.length > 0 && analyzedCount >= siteWaypoints.length;

  const speedValue = SPEED_LEVELS[speedIndex] ?? SPEED_LEVELS[7];
  const loadingPct = formatLoadingPercent(loadingState.progress);
  const logoUrl = resolveAssetUrl('brand.logo');

  if (isInXrSession || preview3d) {
    return (
      <div className="rov-hud__xr-exit">
        {isInXrSession ? (
          <button
            type="button"
            className="hud-exit-btn"
            onClick={() => {
              void xrStore.getState().session?.end();
            }}
            data-testid="btn-exit-vr"
          >
            <Glasses size={16} aria-hidden="true" />
            <span>{t('vr.exit')}</span>
          </button>
        ) : (
          <button
            type="button"
            className="hud-exit-btn"
            onClick={() => setPreview3d(false)}
            data-testid="btn-exit-preview-3d"
          >
            <Box size={16} aria-hidden="true" />
            <span>
              {t('vr.exit')} {t('vr.preview_3d')}
            </span>
          </button>
        )}
      </div>
    );
  }

  const isHudVisible = hudMode !== 'hidden';
  const showControls = hudMode === 'full';

  return (
    <>
      <div id="ui-layer" data-testid="rov-hud-2d" data-hud-mode={hudMode}>
        {isHudVisible ? (
          <>
            <div id="telemetry-block" className="telemetry-grid" data-testid="hud-telemetry">
              <div className="telemetry-row">
                <span className="telemetry-label">SITE</span>
                <span className="telemetry-value">
                  {activeDive ? t(activeDive.titleKey) : activeDiveSlug ?? 'LOADING...'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">ID</span>
                <span className="telemetry-value">{activeDive?.id ?? '...'}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">HEADING</span>
                <span className="telemetry-value">{formatHeading(telemetryLive.headingDeg)} °</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">DEPTH</span>
                <span className="telemetry-value">{Math.round(telemetryLive.depthMeters)} M</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">TEMP.</span>
                <span className="telemetry-value">
                  {activeDive ? activeDive.telemetry.temp.toFixed(2) : '0.00'} °C
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">SALINITY</span>
                <span className="telemetry-value">
                  {activeDive ? activeDive.telemetry.salinity.toFixed(2) : '00.00'} PSU
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">O2 CON</span>
                <span className="telemetry-value">
                  {activeDive ? activeDive.telemetry.o2 : '000'} µM
                </span>
              </div>
            </div>

            <div id="date-block">
              {activeDive ? `${activeDive.date} UTC` : '--/--/--'}
            </div>
            <div id="coords-block">
              {`X: ${telemetryLive.x.toFixed(2)}  Y: ${telemetryLive.y.toFixed(2)}  Z: ${telemetryLive.z.toFixed(2)}`}
            </div>

            <img
              id="hud-watermark"
              src={logoUrl}
              alt=""
              aria-hidden="true"
              width={48}
              height={48}
            />
          </>
        ) : null}

        <div className="top-left-ctrls">
          <button
            type="button"
            id="hud-toggle"
            className="icon-btn"
            title={t('ui.toggle_hud')}
            aria-label={t('ui.toggle_hud')}
            onClick={cycleHudMode}
            data-testid="btn-toggle-hud"
          >
            {isHudVisible ? <Eye size={22} aria-hidden="true" /> : <EyeOff size={22} aria-hidden="true" />}
          </button>
        </div>

        {isHudVisible ? (
          <div className="top-right-ctrls">
            {gamifiedMode && siteWaypoints.length > 0 ? (
              <div id="mission-counter" data-testid="mission-counter">
                <span>{t('ui.mission_analyzed')}: </span>
                <span>{analyzedCount}</span> / <span>{siteWaypoints.length}</span>
                {isMissionComplete ? (
                  <span className="mission-complete-inline" data-testid="mission-complete-badge">
                    {' '}
                    · {t('ui.mission_complete')}
                  </span>
                ) : null}
              </div>
            ) : null}

            {xrSupported ? (
              <button
                type="button"
                className="icon-btn"
                title={t('vr.enter')}
                aria-label={t('vr.enter')}
                onClick={() => {
                  void xrStore.enterVR();
                }}
                data-testid="btn-enter-vr"
              >
                <Glasses size={22} aria-hidden="true" />
              </button>
            ) : null}

            <button
              type="button"
              id="menu-toggle"
              className="icon-btn"
              title={t('ui.menu')}
              aria-label={t('ui.menu')}
              onClick={() => setSystemMenuOpen(true)}
              data-testid="btn-system-menu"
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {showControls ? (
          <div id="controls-container" data-testid="hud-bottom-bar">
            <div className="control-grid d-pad">
              <button
                type="button"
                className="btn up"
                id="move-up"
                aria-label={t('controls.move_strafe')}
                {...bindHoldControl('move-up')}
              >
                <ArrowUp size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn left"
                id="move-left"
                aria-label={t('controls.move_strafe')}
                {...bindHoldControl('move-left')}
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn down"
                id="move-down"
                aria-label={t('controls.move_strafe')}
                {...bindHoldControl('move-down')}
              >
                <ArrowDown size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn right"
                id="move-right"
                aria-label={t('controls.move_strafe')}
                {...bindHoldControl('move-right')}
              >
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            </div>

            <div className="control-grid right-side-grid">
              {activeWaypointId ? (
                <>
                  <div className="grid-header-explore" id="explore-label">
                    <div className="explore-pill">{t('ui.explore')}</div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    id="btn-scan"
                    aria-label={t('ui.explore')}
                    onClick={() => openWaypointModal(activeWaypointId)}
                    data-testid="btn-explore-waypoint"
                  >
                    <ScanEye size={22} aria-hidden="true" />
                  </button>
                </>
              ) : null}

              <div className="flex-col">
                <span className="label">&nbsp;</span>
                <button
                  type="button"
                  className="btn"
                  id="reset-pos"
                  title={t('ui.reset_position')}
                  aria-label={t('ui.reset_position')}
                  onClick={triggerReset}
                  data-testid="btn-reset-pos"
                >
                  <RotateCcw size={22} aria-hidden="true" />
                </button>
              </div>

              <div className="flex-col">
                <span className="label">
                  {t('ui.speed')}{' '}
                  <span id="speed-val" data-testid="hud-speed-value">
                    {formatSpeedLevel(speedValue)}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn"
                  id="speed-plus"
                  aria-label={`${t('ui.speed')} +`}
                  disabled={speedIndex >= SPEED_LEVELS.length - 1}
                  onClick={() => stepSpeedIndex(1)}
                  data-testid="btn-speed-up"
                >
                  <Plus size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn"
                  id="speed-minus"
                  aria-label={`${t('ui.speed')} -`}
                  disabled={speedIndex <= 0}
                  onClick={() => stepSpeedIndex(-1)}
                  data-testid="btn-speed-down"
                >
                  <Minus size={22} aria-hidden="true" />
                </button>
              </div>

              <div className="flex-col">
                <span className="label">{t('ui.zoom')}</span>
                <button
                  type="button"
                  className="btn"
                  id="zoom-in"
                  aria-label={`${t('ui.zoom')} +`}
                  {...bindHoldControl('zoom-in')}
                >
                  <ZoomIn size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn"
                  id="zoom-out"
                  aria-label={`${t('ui.zoom')} -`}
                  {...bindHoldControl('zoom-out')}
                >
                  <ZoomOut size={22} aria-hidden="true" />
                </button>
              </div>

              <div className="flex-col">
                <span className="label">{t('ui.vertical')}</span>
                <button
                  type="button"
                  className="btn"
                  id="ascend"
                  aria-label={`${t('ui.vertical')} +`}
                  {...bindHoldControl('ascend')}
                >
                  <ChevronsUp size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn"
                  id="descend"
                  aria-label={`${t('ui.vertical')} -`}
                  {...bindHoldControl('descend')}
                >
                  <ChevronsDown size={22} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {loadingState.phase === 'loading' ? (
        <div
          className="rov-overlay"
          role="status"
          aria-live="polite"
          data-testid="dive-loading-overlay"
        >
          <div className="rov-overlay__card">
            <h2 className="rov-overlay__title">{t('ui.loading_model')}</h2>
            <p className="rov-overlay__subtitle">
              {activeDive ? t(activeDive.titleKey) : t('ui.loading_progress')}
            </p>
            <div
              className="rov-progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadingPct}
              role="progressbar"
            >
              <div className="rov-progress__bar" style={{ width: `${loadingPct}%` }} />
            </div>
            <div className="rov-progress__pct">{loadingPct}%</div>
          </div>
        </div>
      ) : null}

      {loadingState.phase === 'error' ? (
        <div className="rov-overlay" role="alert" data-testid="dive-error-overlay">
          <div className="rov-overlay__card">
            <h2 className="rov-overlay__title">{t('ui.error_load_title')}</h2>
            <p className="rov-overlay__subtitle">
              {loadingState.error || t('ui.error_load_model')}
            </p>
            <div className="rov-overlay__actions">
              <button
                type="button"
                className="hud-exit-btn"
                onClick={() => {
                  if (activeDiveSlug) {
                    launchDive(activeDiveSlug);
                  } else {
                    triggerReset();
                  }
                }}
                data-testid="btn-error-retry"
              >
                <RotateCcw size={15} aria-hidden="true" />
                <span>{t('ui.error_retry')}</span>
              </button>
              <button
                type="button"
                className="hud-exit-btn"
                onClick={returnToMenu}
                data-testid="btn-error-home"
              >
                <span>{t('ui.return_to_home')}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default RovHud2D;
