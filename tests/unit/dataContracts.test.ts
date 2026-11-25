import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import divesJson from '../../data/dives.json';
import waypointsJson from '../../data/waypoints.json';
import manifestJson from '../../data/asset-manifest.json';
import esJson from '../../locales/es.json';
import enJson from '../../locales/en.json';
import { getAssetEntry, resolveAssetUrl } from '@/engine/assetUrl';
import { applyMaterialPolicy, computeModelNormalization } from '@/engine/modelNormalize';
import i18n from '@/i18n';
import { useRovStore } from '@/store/rovStore';
import type { AssetManifest, DivesCatalog, WaypointsBySite } from '@/types/domain';

describe('Data contracts, asset URLs, normalization, and store/i18n', () => {
  it('validates dive, waypoint, manifest, and locale contracts', () => {
    const dives = divesJson as DivesCatalog;
    const waypoints = waypointsJson as WaypointsBySite;
    const manifest = manifestJson as AssetManifest;

    expect(dives['whale-fall'].status).toBe('live');
    expect(dives['clam-bed'].status).toBe('live');
    expect(dives['giant-corals'].status).toBe('coming_soon');
    expect(waypoints['whale-fall'].length).toBeGreaterThan(0);
    expect(manifest['models.whale-fall'].contentType).toBe('model/gltf-binary');
    expect(Object.keys(esJson)).toEqual(Object.keys(enJson));
  });

  it('resolves manifest asset URLs with fallback and trailing slash trimming', () => {
    const entry = getAssetEntry('models.whale-fall');
    expect(entry.path).toMatch(/^v2\/models\/whale-fall\..+\.glb$/);

    expect(resolveAssetUrl('models.whale-fall')).toBe(`/r2-local/${entry.path}`);
    expect(resolveAssetUrl('models.whale-fall', '')).toBe(`/r2-local/${entry.path}`);
    expect(resolveAssetUrl('models.whale-fall', 'https://cdn.example.org/')).toBe(
      `https://cdn.example.org/${entry.path}`
    );
    expect(() => resolveAssetUrl('missing.key')).toThrow(/Unknown asset manifest key/);
  });

  it('normalizes model bounds to 20m max dimension and preserves authored materials', () => {
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(10, 4, 2);
    const frontMat = new THREE.MeshStandardMaterial({ side: THREE.FrontSide });
    const doubleMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    const mesh1 = new THREE.Mesh(geom, frontMat);
    const mesh2 = new THREE.Mesh(geom, doubleMat);
    mesh2.position.set(0, 0, 0);
    group.add(mesh1, mesh2);

    const summary = computeModelNormalization(group);
    expect(summary.rawMaxDim).toBeCloseTo(10, 5);
    expect(summary.scale).toBeCloseTo(2, 5);
    expect(summary.doubleSidedCount).toBe(1);
    expect(summary.triangleCount).toBe(24);

    applyMaterialPolicy(group, 'double-sided');
    expect(frontMat.side).toBe(THREE.DoubleSide);
    expect(doubleMat.side).toBe(THREE.DoubleSide);

    applyMaterialPolicy(group, 'wireframe');
    expect(frontMat.wireframe).toBe(true);

    applyMaterialPolicy(group, 'authored');
    expect(frontMat.side).toBe(THREE.FrontSide);
    expect(frontMat.wireframe).toBe(false);
    expect(frontMat.transparent).toBe(false);
    expect(doubleMat.side).toBe(THREE.DoubleSide);

    geom.dispose();
    frontMat.dispose();
    doubleMat.dispose();
  });

  it('manages rovStore state transitions and i18n language sync', () => {
    const store = useRovStore.getState();
    store.launchDive('whale-fall');
    expect(useRovStore.getState().view).toBe('dive');
    expect(useRovStore.getState().activeDiveSlug).toBe('whale-fall');

    store.openWaypointModal('wp-vertebra-sample');
    expect(useRovStore.getState().visitedWaypointIds).toContain('wp-vertebra-sample');

    store.cycleHudMode();
    expect(useRovStore.getState().hudMode).toBe('minimal');

    store.setLanguage('en');
    expect(useRovStore.getState().language).toBe('en');
    expect(i18n.language).toBe('en');

    store.setLanguage('es');
    expect(useRovStore.getState().language).toBe('es');
    expect(i18n.language).toBe('es');

    store.returnToMenu();
    expect(useRovStore.getState().view).toBe('menu');
  });
});
