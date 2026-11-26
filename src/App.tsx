import { Suspense, lazy, useEffect } from 'react';
import { isEditableTarget } from './engine/inputBus';
import { useRovStore } from './store/rovStore';
import { ControlsGuide } from './ui/ControlsGuide';
import { MissionMenu } from './ui/MissionMenu';
import { RovHud2D } from './ui/RovHud2D';
import { SystemMenu } from './ui/SystemMenu';
import { TouchControls } from './ui/TouchControls';
import { WaypointDialog } from './ui/WaypointDialog';

const HabitatScene = lazy(() => import('./scene/HabitatScene'));
const VrUiLayer = lazy(() => import('./scene/vr-ui/VrUiLayer'));

export function App() {
  const view = useRovStore((s) => s.view);
  const activeDiveSlug = useRovStore((s) => s.activeDiveSlug);
  const dives = useRovStore((s) => s.dives);

  // Deep-link support via ?site=<slug> (normalizing underscores to hyphens)
  useEffect(() => {
    const rawSite = new URLSearchParams(window.location.search).get('site');
    if (!rawSite) return;
    const normalizedSlug = rawSite.trim().toLowerCase().replace(/_/g, '-');
    const targetDive = useRovStore.getState().dives[normalizedSlug];
    if (targetDive && targetDive.status === 'live') {
      useRovStore.getState().launchDive(normalizedSlug);
    }
  }, []);

  // App-level dive shortcuts (KeyH: HUD mode, KeyR: reset pose, KeyV: 3D preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isEditableTarget(e.target)) return;
      const state = useRovStore.getState();
      if (state.view !== 'dive') return;
      if (state.systemMenuOpen || state.controlsGuideOpen || state.openModalWaypointId !== null) {
        return;
      }

      if (e.code === 'KeyH') {
        state.cycleHudMode();
      } else if (e.code === 'KeyR') {
        state.triggerReset();
      } else if (e.code === 'KeyV') {
        state.setPreview3d(!state.preview3d);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeDive = activeDiveSlug ? dives[activeDiveSlug] : undefined;

  if (view === 'menu' || !activeDive) {
    return <MissionMenu />;
  }

  return (
    <div
      className="dive-stage"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <Suspense fallback={null}>
        <HabitatScene
          dive={activeDive}
          vrUiSlot={
            <Suspense fallback={null}>
              <VrUiLayer />
            </Suspense>
          }
        />
      </Suspense>
      <RovHud2D />
      <TouchControls />
      <WaypointDialog />
      <SystemMenu />
      <ControlsGuide />
    </div>
  );
}

export default App;
