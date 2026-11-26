import { Box, Compass, Glasses, HelpCircle, LogOut, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRovStore } from '../store/rovStore';
import { xrStore } from '../store/xrStore';

export function SystemMenu() {
  const { t } = useTranslation();

  const view = useRovStore((s) => s.view);
  const systemMenuOpen = useRovStore((s) => s.systemMenuOpen);
  const controlsGuideOpen = useRovStore((s) => s.controlsGuideOpen);
  const gamifiedMode = useRovStore((s) => s.gamifiedMode);
  const comfortSnapTurn = useRovStore((s) => s.comfortSnapTurn);
  const language = useRovStore((s) => s.language);
  const gyroEnabled = useRovStore((s) => s.gyroEnabled);

  const setSystemMenuOpen = useRovStore((s) => s.setSystemMenuOpen);
  const setControlsGuideOpen = useRovStore((s) => s.setControlsGuideOpen);
  const setGamifiedMode = useRovStore((s) => s.setGamifiedMode);
  const setComfortSnapTurn = useRovStore((s) => s.setComfortSnapTurn);
  const setLanguage = useRovStore((s) => s.setLanguage);
  const setGyroEnabled = useRovStore((s) => s.setGyroEnabled);
  const setPreview3d = useRovStore((s) => s.setPreview3d);
  const returnToMenu = useRovStore((s) => s.returnToMenu);

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
    <aside
      id="system-menu"
      className="active"
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.system_navigation')}
      data-testid="system-menu"
    >
      <button
        type="button"
        className="menu-close-btn"
        onClick={() => setSystemMenuOpen(false)}
        aria-label={t('controls.close')}
        data-testid="btn-close-system-menu"
      >
        <X size={18} aria-hidden="true" />
      </button>

      <div className="menu-item-row">
        <span className="menu-label-text">{t('menu.gaming_mode')}</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={gamifiedMode}
            onChange={(e) => setGamifiedMode(e.target.checked)}
            data-testid="switch-gamified-mode"
          />
          <span className="slider" />
        </label>
      </div>

      <div className="menu-title">{t('menu.language')}</div>
      <div className="lang-selector sidebar-selector" role="group" aria-label={t('menu.language')}>
        <button
          type="button"
          className={`lang-btn${language === 'es' ? ' active' : ''}`}
          aria-pressed={language === 'es'}
          onClick={() => setLanguage('es')}
          data-testid="sys-lang-es"
        >
          ES
        </button>
        <button
          type="button"
          className={`lang-btn${language === 'en' ? ' active' : ''}`}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
          data-testid="sys-lang-en"
        >
          EN
        </button>
      </div>

      <div className="menu-title">{t('ui.system_navigation')}</div>
      <div className="menu-items">
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setSystemMenuOpen(false);
            setControlsGuideOpen(true);
          }}
          data-testid="btn-open-controls-guide"
        >
          <HelpCircle size={20} aria-hidden="true" />
          <span>{t('ui.mission_controls')}</span>
        </button>

        <button
          type="button"
          className={`menu-item ${gyroEnabled ? 'gyro-on' : 'gyro-off'}`}
          aria-pressed={gyroEnabled}
          onClick={() => {
            setGyroEnabled(!gyroEnabled);
          }}
          data-testid="switch-gyro"
        >
          <Smartphone size={20} aria-hidden="true" />
          <span>{t('ui.toggle_gyro')}</span>
          <span className="gyro-state">{gyroEnabled ? 'ON' : 'OFF'}</span>
        </button>

        {xrSupported ? (
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setSystemMenuOpen(false);
              void xrStore.enterVR();
            }}
            data-testid="sys-enter-vr"
          >
            <Glasses size={20} aria-hidden="true" />
            <span>{t('vr.enter')}</span>
          </button>
        ) : null}

        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setSystemMenuOpen(false);
            setPreview3d(true);
          }}
          data-testid="btn-preview-3d"
        >
          <Box size={20} aria-hidden="true" />
          <span>{t('vr.preview_3d')}</span>
        </button>

        <div className="menu-item-row menu-item-row--sub">
          <span className="menu-label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={14} aria-hidden="true" />
            <span>{t('vr.comfort_turn')}</span>
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={comfortSnapTurn}
              onChange={(e) => setComfortSnapTurn(e.target.checked)}
              data-testid="switch-comfort-turn"
            />
            <span className="slider" />
          </label>
        </div>

        <button
          type="button"
          className="menu-item danger"
          onClick={returnToMenu}
          data-testid="btn-return-home"
        >
          <LogOut size={20} aria-hidden="true" />
          <span>{t('ui.return_to_home')}</span>
        </button>
      </div>
    </aside>
  );
}

export default SystemMenu;
