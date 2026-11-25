import { create } from 'zustand';
import divesData from '../../data/dives.json';
import waypointsData from '../../data/waypoints.json';
import { DEFAULT_SPEED_INDEX, SPEED_LEVELS } from '../engine/rovPhysics';
import type { ModelTransformSummary } from '../engine/modelNormalize';
import type {
  ActiveView,
  DivesCatalog,
  HudMode,
  Language,
  LiveTelemetry,
  LoadingPhase,
  WaypointsBySite,
} from '../types/domain';

export interface LoadingState {
  phase: LoadingPhase;
  progress: number;
  error: string | null;
}

export interface RovState {
  view: ActiveView;
  activeDiveSlug: string | null;
  dives: DivesCatalog;
  waypointsBySite: WaypointsBySite;
  language: Language;
  hudMode: HudMode;
  gamifiedMode: boolean;
  speedIndex: number;
  fov: number;
  preview3d: boolean;
  comfortSnapTurn: boolean;
  systemMenuOpen: boolean;
  controlsGuideOpen: boolean;
  activeWaypointId: string | null;
  openModalWaypointId: string | null;
  visitedWaypointIds: string[];
  loadingState: LoadingState;
  sceneStats: ModelTransformSummary | null;
  telemetryLive: LiveTelemetry;
  resetTrigger: number;
  gyroEnabled: boolean;

  launchDive: (slug: string) => void;
  returnToMenu: () => void;
  setLanguage: (lang: Language) => void;
  setHudMode: (mode: HudMode) => void;
  cycleHudMode: () => void;
  setGamifiedMode: (enabled: boolean) => void;
  setSpeedIndex: (index: number) => void;
  stepSpeedIndex: (delta: number) => void;
  setFov: (fov: number) => void;
  setPreview3d: (enabled: boolean) => void;
  setComfortSnapTurn: (enabled: boolean) => void;
  setSystemMenuOpen: (open: boolean) => void;
  setControlsGuideOpen: (open: boolean) => void;
  setActiveWaypointId: (id: string | null) => void;
  openWaypointModal: (id: string) => void;
  closeWaypointModal: () => void;
  markWaypointVisited: (id: string) => void;
  setLoadingState: (next: Partial<LoadingState> & { phase: LoadingPhase }) => void;
  setSceneStats: (stats: ModelTransformSummary | null) => void;
  setTelemetryLive: (telemetry: LiveTelemetry) => void;
  triggerReset: () => void;
  setGyroEnabled: (enabled: boolean) => void;
}

export function getInitialLanguage(): Language {
  if (typeof localStorage === 'undefined') return 'es';
  try {
    return localStorage.getItem('rov_lang') === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function persistLanguage(lang: Language): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('rov_lang', lang);
  } catch {
    // Ignore storage quota/security errors
  }
}

const HUD_CYCLE: readonly HudMode[] = ['full', 'minimal', 'hidden'];

export const useRovStore = create<RovState>((set, get) => ({
  view: 'menu',
  activeDiveSlug: null,
  dives: divesData as DivesCatalog,
  waypointsBySite: waypointsData as WaypointsBySite,
  language: getInitialLanguage(),
  hudMode: 'full',
  gamifiedMode: false,
  speedIndex: DEFAULT_SPEED_INDEX,
  fov: 80,
  preview3d: false,
  comfortSnapTurn: true,
  systemMenuOpen: false,
  controlsGuideOpen: false,
  activeWaypointId: null,
  openModalWaypointId: null,
  visitedWaypointIds: [],
  loadingState: { phase: 'idle', progress: 0, error: null },
  sceneStats: null,
  telemetryLive: { headingDeg: 0, depthMeters: 0, x: 0, y: 0, z: 0 },
  resetTrigger: 0,
  gyroEnabled: false,

  launchDive: (slug) => {
    const dive = get().dives[slug];
    if (!dive || dive.status !== 'live') return;
    set({
      view: 'dive',
      activeDiveSlug: slug,
      systemMenuOpen: false,
      controlsGuideOpen: false,
      activeWaypointId: null,
      openModalWaypointId: null,
      loadingState: { phase: 'loading', progress: 0, error: null },
      sceneStats: null,
      telemetryLive: {
        headingDeg: dive.spawn.rotationDeg.y,
        depthMeters: dive.telemetry.depth,
        x: dive.spawn.position.x,
        y: dive.spawn.position.y,
        z: dive.spawn.position.z,
      },
    });
  },

  returnToMenu: () =>
    set({
      view: 'menu',
      systemMenuOpen: false,
      controlsGuideOpen: false,
      activeWaypointId: null,
      openModalWaypointId: null,
      loadingState: { phase: 'idle', progress: 0, error: null },
    }),

  setLanguage: (lang) => {
    persistLanguage(lang);
    if (get().language !== lang) {
      set({ language: lang });
    }
  },

  setHudMode: (hudMode) => set({ hudMode }),

  cycleHudMode: () => {
    const current = get().hudMode;
    const next = HUD_CYCLE[(HUD_CYCLE.indexOf(current) + 1) % HUD_CYCLE.length];
    set({ hudMode: next });
  },

  setGamifiedMode: (gamifiedMode) => set({ gamifiedMode }),

  setSpeedIndex: (index) => {
    const clamped = Math.min(Math.max(Math.round(index), 0), SPEED_LEVELS.length - 1);
    set({ speedIndex: clamped });
  },

  stepSpeedIndex: (delta) => {
    const next = get().speedIndex + delta;
    const clamped = Math.min(Math.max(Math.round(next), 0), SPEED_LEVELS.length - 1);
    set({ speedIndex: clamped });
  },

  setFov: (fov) => {
    const clamped = Math.min(Math.max(fov, 35), 110);
    set({ fov: clamped });
  },

  setPreview3d: (preview3d) => set({ preview3d }),

  setComfortSnapTurn: (comfortSnapTurn) => set({ comfortSnapTurn }),

  setSystemMenuOpen: (systemMenuOpen) => set({ systemMenuOpen }),

  setControlsGuideOpen: (controlsGuideOpen) => set({ controlsGuideOpen }),

  setActiveWaypointId: (activeWaypointId) => set({ activeWaypointId }),

  openWaypointModal: (id) => {
    const visited = get().visitedWaypointIds;
    set({
      openModalWaypointId: id,
      visitedWaypointIds: visited.includes(id) ? visited : [...visited, id],
    });
  },

  closeWaypointModal: () => set({ openModalWaypointId: null }),

  markWaypointVisited: (id) => {
    const visited = get().visitedWaypointIds;
    if (!visited.includes(id)) {
      set({ visitedWaypointIds: [...visited, id] });
    }
  },

  setLoadingState: (next) =>
    set((state) => ({
      loadingState: {
        phase: next.phase,
        progress: next.progress ?? state.loadingState.progress,
        error: next.error !== undefined ? next.error : null,
      },
    })),

  setSceneStats: (sceneStats) => set({ sceneStats }),

  setTelemetryLive: (telemetryLive) => set({ telemetryLive }),

  triggerReset: () => set((state) => ({ resetTrigger: state.resetTrigger + 1 })),

  setGyroEnabled: (gyroEnabled) => set({ gyroEnabled }),
}));
