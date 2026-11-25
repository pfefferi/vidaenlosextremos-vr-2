import { Gamepad2, Glasses, Keyboard, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRovStore } from '../store/rovStore';

type ControlsTab = 'keyboard' | 'gamepad' | 'vr';

interface BindingRow {
  labelKey: string;
  binding: string;
}

const KEYBOARD_NAV: BindingRow[] = [
  { labelKey: 'controls.move_strafe', binding: 'W A S D / Arrows' },
  { labelKey: 'controls.camera_look', binding: 'Drag / Pointer Lock' },
  { labelKey: 'controls.ascend_descend', binding: 'E / Space · Q / C / Ctrl' },
  { labelKey: 'controls.zoom_in_out', binding: 'Mouse Wheel' },
  { labelKey: 'controls.speed_inc_dec', binding: '+ / - or [ / ]' },
];

const KEYBOARD_SYS: BindingRow[] = [
  { labelKey: 'controls.scan_waypoint', binding: 'F' },
  { labelKey: 'controls.open_menu', binding: 'M / Esc' },
];

const GAMEPAD_NAV: BindingRow[] = [
  { labelKey: 'controls.move_strafe', binding: 'Left Stick' },
  { labelKey: 'controls.camera_look', binding: 'Right Stick' },
  { labelKey: 'controls.ascend_descend', binding: 'RT / LT' },
  { labelKey: 'controls.speed_inc_dec', binding: 'RB / LB' },
];

const GAMEPAD_SYS: BindingRow[] = [
  { labelKey: 'controls.scan_waypoint', binding: 'A / Cross' },
  { labelKey: 'controls.open_menu', binding: 'Start / Menu' },
];

const VR_NAV: BindingRow[] = [
  { labelKey: 'controls.move_strafe', binding: 'Left Thumbstick' },
  { labelKey: 'controls.camera_look', binding: 'Right Thumbstick (Snap/Smooth)' },
  { labelKey: 'controls.ascend_descend', binding: 'Right Thumbstick Y' },
  { labelKey: 'controls.speed_inc_dec', binding: 'X / Y Buttons' },
];

const VR_SYS: BindingRow[] = [
  { labelKey: 'controls.scan_waypoint', binding: 'Trigger / Pinch Ray' },
  { labelKey: 'controls.open_menu', binding: 'B / Menu Button' },
];

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
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controlsGuideOpen, setControlsGuideOpen]);

  if (!controlsGuideOpen) {
    return null;
  }

  const navRows =
    tab === 'keyboard' ? KEYBOARD_NAV : tab === 'gamepad' ? GAMEPAD_NAV : VR_NAV;
  const sysRows =
    tab === 'keyboard' ? KEYBOARD_SYS : tab === 'gamepad' ? GAMEPAD_SYS : VR_SYS;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="controls-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setControlsGuideOpen(false);
        }
      }}
      data-testid="controls-guide"
    >
      <div className="modal-panel modal-panel--wide">
        <header className="modal-panel__header">
          <h2 id="controls-guide-title" className="modal-panel__title">
            {t('controls.title')}
          </h2>
          <button
            type="button"
            className="wp-dialog__close"
            onClick={() => setControlsGuideOpen(false)}
            aria-label={t('controls.close')}
            data-testid="btn-close-controls-guide"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-panel__body">
          <div className="guide-tabs" role="tablist" aria-label={t('controls.switch_input')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'keyboard'}
              className={`guide-tab${tab === 'keyboard' ? ' is-active' : ''}`}
              onClick={() => setTab('keyboard')}
              data-testid="controls-tab-keyboard"
            >
              <Keyboard size={15} aria-hidden="true" />
              <span>{t('controls.keyboard')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'gamepad'}
              className={`guide-tab${tab === 'gamepad' ? ' is-active' : ''}`}
              onClick={() => setTab('gamepad')}
              data-testid="controls-tab-gamepad"
            >
              <Gamepad2 size={15} aria-hidden="true" />
              <span>{t('controls.gamepad')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'vr'}
              className={`guide-tab${tab === 'vr' ? ' is-active' : ''}`}
              onClick={() => setTab('vr')}
              data-testid="controls-tab-vr"
            >
              <Glasses size={15} aria-hidden="true" />
              <span>VR</span>
            </button>
          </div>

          <section>
            <h3 className="guide-section-title">{t('controls.piloting_nav')}</h3>
            <ul className="guide-list">
              {navRows.map((row) => (
                <li key={row.labelKey} className="guide-item">
                  <span>{t(row.labelKey)}</span>
                  <kbd className="guide-item__kbd">{row.binding}</kbd>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="guide-section-title">{t('controls.mission_systems')}</h3>
            <ul className="guide-list">
              {sysRows.map((row) => (
                <li key={row.labelKey} className="guide-item">
                  <span>{t(row.labelKey)}</span>
                  <kbd className="guide-item__kbd">{row.binding}</kbd>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ControlsGuide;
