import assetManifestJson from '../../data/asset-manifest.json';
import type { AssetManifest, AssetManifestEntry } from '../types/domain';

const manifest = assetManifestJson as AssetManifest;

export function getAssetEntry(manifestKey: string): AssetManifestEntry {
  const entry = manifest[manifestKey];
  if (!entry) {
    throw new Error(`Unknown asset manifest key: "${manifestKey}"`);
  }
  return entry;
}

export function resolveAssetUrl(manifestKey: string, overrideBaseUrl?: string): string {
  const entry = getAssetEntry(manifestKey);
  const envBase =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ASSET_BASE_URL : undefined;
  const rawBase = overrideBaseUrl ?? envBase ?? '/r2-local';
  const trimmed = rawBase.trim();
  const base = trimmed.length > 0 ? trimmed.replace(/\/+$/, '') : '/r2-local';
  const relPath = entry.path.replace(/^\/+/, '');
  return `${base}/${relPath}`;
}
