import {
  Compass,
  Gauge,
  HelpCircle,
  Home,
  Languages,
  Play,
  RotateCcw,
  Settings,
  Smartphone,
  Target,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SPEED_LEVELS, formatSpeedLevel } from '../engine/rovPhysics';
import { useRovStore } from '../store/rovStore';

export function SystemMenu() {
  const { t } = useTranslation();

  const view = useRovStore((s) => s.view);
  const systemMenuOpen = useRovStore((s) => s.systemMenuOpen);
  const controlsGuideOpen = useRovStore((s) => s.controlsGuideOpen);
  const gamifiedMode = useRovStore((s) => s.gamifiedMode);
  const speedIndex = useRovStore((s) => s.speedIndex);
  const comfortSnapTurn = useRovStore((s) => s.comfortSnapTurn);
  const language = useRovStore((s) => s.language);
  const gyroEnabled = useRovStore((s) => s.gyroEnabled);

  const setSystemMenuOpen = useRovStore((s) => s.setSystemMenuOpen);
  const setControlsGuideOpen = useRovStore((s) => s.setControlsGuideOpen);
  const setGamifiedMode = useRovStore((s) => s.setGamifiedMode);
  const setSpeedIndex = useRovStore((s) => s.setSpeedIndex);
  const setComfortSnapTurn = useRovStore((s) => s.setComfortSnapTurn);
  const setLanguage = useRovStore((s) => s.setLanguage);
  const setGyroEnabled = useRovStore((s) => s.setGyroEnabled);
  const triggerReset = useRovStore((s) => s.triggerReset);
  const returnToMenu = useRovStore((s) => s.returnToMenu);

  const hasGyro = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  useEffect(() => {
    if (view !== 'dive' || !systemMenuOpen || controlsGuideOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSystemMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, systemMenuOpen, controlsGuideOpen, setSystemMenuOpen]);

  if (view !== 'dive' || !systemMenuOpen) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-menu-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSystemMenuOpen(false);
        }
      }}
      data-testid="system-menu"
    >
      <div className="modal-panel">
        <header className="modal-panel__header">
          <h2 id="system-menu-title" className="modal-panel__title">
            <Settings size={18} aria-hidden="true" />
            <span>{t('ui.system_navigation')}</span>
          </h2>
          <button
            type="button"
            className="wp-dialog__close"
            onClick={() => setSystemMenuOpen(false)}
            aria-label={t('controls.close')}
            data-testid="btn-close-system-menu"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-panel__body">
          <div className="sys-actions-grid">
            <button
              type="button"
              className="sys-btn sys-btn--primary"
              onClick={() => setSystemMenuOpen(false)}
              data-testid="btn-resume-dive"
            >
              <Play size={16} aria-hidden="true" />
              <span>{t('controls.close')}</span>
            </button>
            <button
              type="button"
              className="sys-btn"
              onClick={() => {
                triggerReset();
                setSystemMenuOpen(false);
              }}
              data-testid="btn-menu-reset"
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>{t('ui.reset_position')}</span>
            </button>
          </div>

          <div className="sys-row">
            <span className="sys-row__label">
              <Target size={16} aria-hidden="true" />
              <span>{t('menu.gaming_mode')}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={gamifiedMode}
              className="sys-switch"
              onClick={() => setGamifiedMode(!gamifiedMode)}
              data-testid="switch-gamified-mode"
            >
              {gamifiedMode ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="sys-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span className="sys-row__label">
              <Gauge size={16} aria-hidden="true" />
              <span>{t('ui.speed')}</span>
            </span>
            <div className="sys-speed-ladder" role="group" aria-label={t('ui.speed')}>
              {SPEED_LEVELS.map((level, index) => (
                <button
                  key={level}
                  type="button"
                  className={`sys-speed-chip${index === speedIndex ? ' is-active' : ''}`}
                  aria-pressed={index === speedIndex}
                  onClick={() => setSpeedIndex(index)}
                  data-testid={`speed-chip-${index}`}
                >
                  {formatSpeedLevel(level)}×
                </button>
              ))}
            </div>
          </div>

          <div className="sys-row">
            <span className="sys-row__label">
              <Compass size={16} aria-hidden="true" />
              <span>{t('vr.comfort_turn')}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={comfortSnapTurn}
              className="sys-switch"
              onClick={() => setComfortSnapTurn(!comfortSnapTurn)}
              data-testid="switch-comfort-turn"
            >
              {comfortSnapTurn ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="sys-row">
            <span className="sys-row__label">
              <Languages size={16} aria-hidden="true" />
              <span>{t('menu.language')}</span>
            </span>
            <div className="lang-toggle" role="group" aria-label={t('menu.language')}>
              <button
                type="button"
                className={`lang-toggle__btn${language === 'es' ? ' is-active' : ''}`}
                aria-pressed={language === 'es'}
                onClick={() => setLanguage('es')}
                data-testid="sys-lang-es"
              >
                ES
              </button>
              <button
                type="button"
                className={`lang-toggle__btn${language === 'en' ? ' is-active' : ''}`}
                aria-pressed={language === 'en'}
                onClick={() => setLanguage('en')}
                data-testid="sys-lang-en"
              >
                EN
              </button>
            </div>
          </div>

          {hasGyro ? (
            <div className="sys-row">
              <span className="sys-row__label">
                <Smartphone size={16} aria-hidden="true" />
                <span>{t('ui.toggle_gyro')}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={gyroEnabled}
                className="sys-switch"
                onClick={() => setGyroEnabled(!gyroEnabled)}
                data-testid="switch-gyro"
              >
                {gyroEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          ) : null}

          <div className="sys-actions-grid">
            <button
              type="button"
              className="sys-btn"
              onClick={() => {
                setSystemMenuOpen(false);
                setControlsGuideOpen(true);
              }}
              data-testid="btn-open-controls-guide"
            >
              <HelpCircle size={16} aria-hidden="true" />
              <span>{t('ui.mission_controls')}</span>
            </button>

            <button
              type="button"
              className="sys-btn sys-btn--danger"
              onClick={returnToMenu}
              data-testid="btn-return-home"
            >
              <Home size={16} aria-hidden="true" />
              <span>{t('ui.return_to_home')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemMenu;
