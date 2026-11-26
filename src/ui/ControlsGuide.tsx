import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRovStore } from '../store/rovStore';

type ControlsTab = 'gamepad' | 'keyboard' | 'vr';

export function ControlsGuide() {
  const { t } = useTranslation();
  const controlsGuideOpen = useRovStore((s) => s.controlsGuideOpen);
  const setControlsGuideOpen = useRovStore((s) => s.setControlsGuideOpen);

  const [tab, setTab] = useState<ControlsTab>('keyboard');

  useEffect(() => {
    if (!controlsGuideOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setControlsGuideOpen(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setTab((prev) =>
          prev === 'gamepad' ? 'keyboard' : prev === 'keyboard' ? 'vr' : 'gamepad'
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controlsGuideOpen, setControlsGuideOpen]);

  if (!controlsGuideOpen) {
    return null;
  }

  return (
    <div
      id="controls-overlay"
      className="active"
      role="dialog"
      aria-modal="true"
      aria-labelledby="controls-guide-title"
      data-testid="controls-guide"
    >
      <button
        type="button"
        className="controls-close-btn"
        onClick={() => setControlsGuideOpen(false)}
        aria-label={t('controls.close')}
        data-testid="btn-close-controls-guide"
      >
        <X size={20} aria-hidden="true" />
      </button>

      <div className="controls-header">
        <div id="controls-guide-title" className="controls-title">
          {t('controls.title')}
        </div>
        <div className="controls-tabs" role="tablist" aria-label={t('controls.switch_input')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'gamepad'}
            className={`tab-btn${tab === 'gamepad' ? ' active' : ''}`}
            onClick={() => setTab('gamepad')}
            data-testid="controls-tab-gamepad"
          >
            {t('controls.gamepad')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'keyboard'}
            className={`tab-btn${tab === 'keyboard' ? ' active' : ''}`}
            onClick={() => setTab('keyboard')}
            data-testid="controls-tab-keyboard"
          >
            {t('controls.keyboard')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'vr'}
            className={`tab-btn${tab === 'vr' ? ' active' : ''}`}
            onClick={() => setTab('vr')}
            data-testid="controls-tab-vr"
          >
            VR
          </button>
        </div>
      </div>

      <div className="controls-content">
        {tab === 'gamepad' ? (
          <div className="controls-view active" id="view-gamepad">
            <div className="mapping-grid">
              <div className="mapping-section">
                <h3>{t('controls.piloting_nav')}</h3>
                <div className="mapping-item">
                  <span className="mapping-key">L STICK</span>
                  <span className="mapping-label">{t('controls.move_strafe')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">R STICK</span>
                  <span className="mapping-label">{t('controls.camera_look')}</span>
                </div>
                <div className="mapping-item">
                  <div className="mapping-key-pair">
                    <span className="mapping-key-half">L1</span>
                    <span className="mapping-key-half">R1</span>
                  </div>
                  <span className="mapping-label">{t('controls.ascend_descend')}</span>
                </div>
                <div className="mapping-item">
                  <div className="mapping-key-pair">
                    <span className="mapping-key-half">L2</span>
                    <span className="mapping-key-half">R2</span>
                  </div>
                  <span className="mapping-label">{t('controls.zoom_in_out')}</span>
                </div>
                <div className="mapping-item">
                  <div className="mapping-key-pair">
                    <span className="mapping-key-half">D ↑</span>
                    <span className="mapping-key-half">D ↓</span>
                  </div>
                  <span className="mapping-label">{t('controls.speed_inc_dec')}</span>
                </div>
              </div>

              <div className="mapping-section">
                <h3>{t('controls.mission_systems')}</h3>
                <div className="mapping-item">
                  <span className="mapping-key">✕ / A</span>
                  <span className="mapping-label">{t('controls.scan_waypoint')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">□ / X</span>
                  <span className="mapping-label">{t('ui.toggle_hud')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">SELECT</span>
                  <span className="mapping-label">{t('ui.reset_position')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">START</span>
                  <span className="mapping-label">{t('controls.open_menu')}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'keyboard' ? (
          <div className="controls-view active" id="view-keyboard">
            <div className="mapping-grid">
              <div className="mapping-section">
                <h3>{t('controls.piloting_nav')}</h3>
                <div className="mapping-item">
                  <span className="mapping-key">W A S D</span>
                  <span className="mapping-label">{t('controls.move_strafe')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">ARROWS</span>
                  <span className="mapping-label">{t('controls.camera_look')}</span>
                </div>
                <div className="mapping-item">
                  <div className="mapping-key-pair">
                    <span className="mapping-key-half">SPACE</span>
                    <span className="mapping-key-half">SHIFT</span>
                  </div>
                  <span className="mapping-label">{t('controls.ascend_descend')}</span>
                </div>
                <div className="mapping-item">
                  <div className="mapping-key-pair">
                    <span className="mapping-key-half">E</span>
                    <span className="mapping-key-half">Q</span>
                  </div>
                  <span className="mapping-label">{t('controls.zoom_in_out')}</span>
                </div>
                <div className="mapping-item">
                  <div className="mapping-key-pair">
                    <span className="mapping-key-half">1</span>
                    <span className="mapping-key-half">2</span>
                  </div>
                  <span className="mapping-label">{t('controls.speed_inc_dec')}</span>
                </div>
              </div>

              <div className="mapping-section">
                <h3>{t('controls.mission_systems')}</h3>
                <div className="mapping-item">
                  <span className="mapping-key">ENTER</span>
                  <span className="mapping-label">{t('controls.scan_waypoint')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">H</span>
                  <span className="mapping-label">{t('ui.toggle_hud')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">R</span>
                  <span className="mapping-label">{t('ui.reset_position')}</span>
                </div>
                <div className="mapping-item">
                  <div className="mapping-key-pair">
                    <span className="mapping-key-half">M</span>
                    <span className="mapping-key-half">ESC</span>
                  </div>
                  <span className="mapping-label">{t('controls.open_menu')}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'vr' ? (
          <div className="controls-view active" id="view-vr">
            <div className="mapping-grid">
              <div className="mapping-section">
                <h3>{t('controls.piloting_nav')}</h3>
                <div className="mapping-item">
                  <span className="mapping-key">L STICK</span>
                  <span className="mapping-label">{t('controls.move_strafe')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">R STICK X</span>
                  <span className="mapping-label">{t('controls.camera_look')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">R STICK Y</span>
                  <span className="mapping-label">{t('controls.ascend_descend')}</span>
                </div>
              </div>

              <div className="mapping-section">
                <h3>{t('controls.mission_systems')}</h3>
                <div className="mapping-item">
                  <span className="mapping-key">A / X</span>
                  <span className="mapping-label">{t('controls.scan_waypoint')}</span>
                </div>
                <div className="mapping-item">
                  <span className="mapping-key">B / Y</span>
                  <span className="mapping-label">{t('controls.open_menu')}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="controls-footer">
        <div className="footer-hints">
          <div className="footer-hint">
            <span className="hint-key">ESC</span>
            <span>{t('controls.close')}</span>
          </div>
          <div className="footer-hint">
            <span className="hint-key">TAB</span>
            <span>{t('controls.switch_input')}</span>
          </div>
        </div>
        <div id="version-display">V2.0</div>
      </div>
    </div>
  );
}

export default ControlsGuide;
