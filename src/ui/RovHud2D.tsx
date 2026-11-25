import {
  Box,
  Compass,
  Eye,
  EyeOff,
  Glasses,
  Menu,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { SPEED_LEVELS, formatSpeedLevel } from '../engine/rovPhysics';
import { useRovStore } from '../store/rovStore';
import { xrStore } from '../store/xrStore';

function formatHeading(deg: number): string {
  const normalized = Math.round(((deg % 360) + 360) % 360);
  return `${String(normalized).padStart(3, '0')}°`;
}

function formatLoadingPercent(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  const scaled = progress < 1 ? progress * 100 : progress;
  return Math.min(100, Math.max(0, Math.round(scaled)));
}

export function RovHud2D() {
  const { t } = useTranslation();

  const view = useRovStore((s) => s.view);
  const activeDiveSlug = useRovStore((s) => s.activeDiveSlug);
  const dives = useRovStore((s) => s.dives);
  const waypointsBySite = useRovStore((s) => s.waypointsBySite);
  const language = useRovStore((s) => s.language);
  const hudMode = useRovStore((s) => s.hudMode);
  const gamifiedMode = useRovStore((s) => s.gamifiedMode);
  const speedIndex = useRovStore((s) => s.speedIndex);
  const fov = useRovStore((s) => s.fov);
  const preview3d = useRovStore((s) => s.preview3d);
  const activeWaypointId = useRovStore((s) => s.activeWaypointId);
  const visitedWaypointIds = useRovStore((s) => s.visitedWaypointIds);
  const loadingState = useRovStore((s) => s.loadingState);
  const telemetryLive = useRovStore((s) => s.telemetryLive);

  const setLanguage = useRovStore((s) => s.setLanguage);
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

  const [vrSupported, setVrSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.xr?.isSessionSupported) {
      navigator.xr
        .isSessionSupported('immersive-vr')
        .then((supported) => {
          if (!cancelled) setVrSupported(supported);
        })
        .catch(() => {
          if (!cancelled) setVrSupported(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (isInXrSession || preview3d) {
    return (
      <>
        <div className="rov-hud__xr-exit">
          {isInXrSession ? (
            <button
              type="button"
              className="hud-btn hud-btn--vr"
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
              className="hud-btn hud-btn--accent"
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
      </>
    );
  }

  return (
    <>
      <div className="rov-hud" data-testid="rov-hud-2d" data-hud-mode={hudMode}>
        <div className="rov-hud__top">
          {hudMode !== 'hidden' ? (
            <aside
              className={`rov-hud__telemetry${
                hudMode === 'minimal' ? ' rov-hud__telemetry--minimal' : ''
              }`}
              aria-label={t('telemetry.site')}
              data-testid="hud-telemetry"
            >
              <dl className="rov-hud__telemetry-grid">
                <div className="rov-hud__telemetry-item rov-hud__telemetry-item--wide rov-hud__telemetry-item--highlight">
                  <dt>{t('telemetry.site')}</dt>
                  <dd>{activeDive ? t(activeDive.titleKey) : activeDiveSlug ?? '—'}</dd>
                </div>
                <div className="rov-hud__telemetry-item">
                  <dt>{t('telemetry.id')}</dt>
                  <dd>{activeDive?.id ?? '—'}</dd>
                </div>
                <div className="rov-hud__telemetry-item">
                  <dt>{t('telemetry.heading')}</dt>
                  <dd>{formatHeading(telemetryLive.headingDeg)}</dd>
                </div>
                <div className="rov-hud__telemetry-item">
                  <dt>{t('telemetry.depth')}</dt>
                  <dd>{telemetryLive.depthMeters.toFixed(1)} m</dd>
                </div>
                {activeDive ? (
                  <>
                    <div className="rov-hud__telemetry-item">
                      <dt>{t('telemetry.temp')}</dt>
                      <dd>{activeDive.telemetry.temp.toFixed(2)} °C</dd>
                    </div>
                    <div className="rov-hud__telemetry-item">
                      <dt>{t('telemetry.salinity')}</dt>
                      <dd>{activeDive.telemetry.salinity.toFixed(2)} PSU</dd>
                    </div>
                    <div className="rov-hud__telemetry-item">
                      <dt>{t('telemetry.o2')}</dt>
                      <dd>{activeDive.telemetry.o2} µmol/kg</dd>
                    </div>
                  </>
                ) : null}
              </dl>
            </aside>
          ) : (
            <div />
          )}

          <div className="rov-hud__actions">
            {hudMode !== 'hidden' ? (
              <>
                <div className="hud-pill hud-pill--mission" data-testid="mission-counter">
                  <Compass size={15} aria-hidden="true" />
                  <span>{t('ui.mission_analyzed')}:</span>
                  <strong>
                    {analyzedCount}/{siteWaypoints.length}
                  </strong>
                  {isMissionComplete ? (
                    <span className="hud-badge-complete" data-testid="mission-complete-badge">
                      {t('ui.mission_complete')}
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="hud-btn"
                  onClick={cycleHudMode}
                  aria-label={t('ui.toggle_hud')}
                  title={t('ui.toggle_hud')}
                  data-testid="btn-toggle-hud"
                >
                  <EyeOff size={15} aria-hidden="true" />
                  <span>{t('ui.toggle_hud')}</span>
                </button>

                <button
                  type="button"
                  className="hud-btn hud-btn--accent"
                  onClick={() => setPreview3d(true)}
                  data-testid="btn-preview-3d"
                >
                  <Box size={15} aria-hidden="true" />
                  <span>{t('vr.preview_3d')}</span>
                </button>

                {vrSupported ? (
                  <button
                    type="button"
                    className="hud-btn hud-btn--vr"
                    onClick={() => {
                      void xrStore.enterVR();
                    }}
                    data-testid="btn-enter-vr"
                  >
                    <Glasses size={15} aria-hidden="true" />
                    <span>{t('vr.enter')}</span>
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                className="hud-btn"
                onClick={cycleHudMode}
                aria-label={t('ui.toggle_hud')}
                title={t('ui.toggle_hud')}
                data-testid="btn-toggle-hud"
              >
                <Eye size={15} aria-hidden="true" />
                <span>{t('ui.toggle_hud')}</span>
              </button>
            )}

            <button
              type="button"
              className="hud-btn"
              onClick={() => setSystemMenuOpen(true)}
              data-testid="btn-system-menu"
            >
              <Menu size={15} aria-hidden="true" />
              <span>{t('ui.menu')}</span>
            </button>
          </div>
        </div>

        <div className="rov-hud__bottom-wrap">
          {activeWaypointId && hudMode !== 'hidden' ? (
            <button
              type="button"
              className="explore-btn"
              onClick={() => openWaypointModal(activeWaypointId)}
              data-testid="btn-explore-waypoint"
            >
              <Sparkles size={18} aria-hidden="true" />
              <span>{t('ui.explore')}</span>
            </button>
          ) : null}

          {hudMode === 'full' ? (
            <div className="rov-hud__bottom-bar" data-testid="hud-bottom-bar">
              <div className="hud-control-group">
                <span className="hud-control-group__label">{t('ui.speed')}</span>
                <button
                  type="button"
                  className="hud-icon-btn"
                  onClick={() => stepSpeedIndex(-1)}
                  disabled={speedIndex <= 0}
                  aria-label={`${t('ui.speed')} -`}
                  data-testid="btn-speed-down"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span className="hud-control-group__value" data-testid="hud-speed-value">
                  {formatSpeedLevel(speedValue)}×
                </span>
                <button
                  type="button"
                  className="hud-icon-btn"
                  onClick={() => stepSpeedIndex(1)}
                  disabled={speedIndex >= SPEED_LEVELS.length - 1}
                  aria-label={`${t('ui.speed')} +`}
                  data-testid="btn-speed-up"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              <div className="hud-control-group">
                <span className="hud-control-group__label">{t('ui.zoom')}</span>
                <span className="hud-control-group__value" data-testid="hud-fov-value">
                  {Math.round(fov)}°
                </span>
              </div>

              <button
                type="button"
                className="hud-btn"
                onClick={triggerReset}
                data-testid="btn-reset-pos"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>{t('ui.reset_position')}</span>
              </button>

              <button
                type="button"
                className="hud-btn"
                onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                aria-label={t('menu.language')}
                data-testid="hud-lang-toggle"
              >
                <span>{language.toUpperCase()}</span>
              </button>
            </div>
          ) : null}
        </div>
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
            <div className="rov-progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadingPct} role="progressbar">
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
                className="sys-btn sys-btn--primary"
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
                className="sys-btn"
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
