export type MaterialPolicy = 'authored' | 'front-only' | 'double-sided';

export type MaterialInspectMode =
  | 'authored'
  | 'front-only'
  | 'double-sided'
  | 'wireframe'
  | 'normals';

export type HudMode = 'full' | 'minimal' | 'hidden';

export type ActiveView = 'menu' | 'dive';

export type LoadingPhase = 'idle' | 'loading' | 'ready' | 'error';

export type Language = 'es' | 'en';

export interface Vec3Data {
  x: number;
  y: number;
  z: number;
}

export interface DiveTelemetry {
  depth: number;
  temp: number;
  salinity: number;
  o2: number;
}

export interface DiveSpawn {
  position: Vec3Data;
  rotationDeg: Vec3Data;
}

export interface DiveTheme {
  floorColor: string;
  fogColor: string;
  bgColor: string;
}

export interface DiveCards {
  env600: string;
  env1200: string;
  close600: string;
  close1200: string;
}

export interface DiveSite {
  id: string;
  slug: string;
  titleKey: string;
  title: string;
  status: 'live' | 'coming_soon';
  materialPolicy?: MaterialPolicy;
  modelKey?: string;
  date: string;
  telemetry: DiveTelemetry;
  spawn: DiveSpawn;
  theme: DiveTheme;
  cards: DiveCards;
}

export type DivesCatalog = Record<string, DiveSite>;

export interface WaypointGalleryItem {
  thumbKey: string;
  fullKey: string;
  captionKey: string;
}

export interface WaypointContent {
  descriptionKey: string;
  youtubeId?: string;
  vrVideoKey?: string | null;
  videoCaptionKey?: string;
  gallery?: WaypointGalleryItem[];
}

export interface Waypoint {
  id: string;
  position: Vec3Data;
  titleKey: string;
  content: WaypointContent;
}

export type WaypointsBySite = Record<string, Waypoint[]>;

export interface AssetManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
  contentType: string;
  triangles?: number;
  vertices?: number;
  doubleSidedCount?: number;
  extensionsRequired?: string[];
  width?: number;
  height?: number;
}

export type AssetManifest = Record<string, AssetManifestEntry>;

export interface LiveTelemetry {
  headingDeg: number;
  depthMeters: number;
  x: number;
  y: number;
  z: number;
}
