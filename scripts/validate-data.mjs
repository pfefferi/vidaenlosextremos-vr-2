#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STAGING_DIR =
  process.env.R2_STAGING_DIR ||
  '/home/pfefferi/workspace-next/data/vidaenlosextremos-vr-2/r2-staging';

const MAX_GLB_BYTES = 15 * 1024 * 1024; // 15 MB = 15,728,640 bytes
const MAX_CARD_600_BYTES = 60 * 1024; // 60 KB = 61,440 bytes
const MAX_FAVICON_BYTES = 15 * 1024; // 15 KB = 15,360 bytes

const errors = [];
const checks = [];

function fail(msg) {
  errors.push(msg);
}

function pass(msg) {
  checks.push(msg);
}

function readJson(relPath) {
  const fullPath = path.join(ROOT, relPath);
  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    pass(`JSON syntax OK: ${relPath}`);
    return parsed;
  } catch (err) {
    fail(`JSON parse failed for ${relPath}: ${err.message}`);
    return null;
  }
}

function flattenKeys(obj, prefix = '') {
  const out = new Map();
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [subK, subV] of flattenKeys(v, next)) {
        out.set(subK, subV);
      }
    } else {
      out.set(next, v);
    }
  }
  return out;
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readGlbExtensions(glbPath) {
  const buf = fs.readFileSync(glbPath);
  if (buf.subarray(0, 4).toString('ascii') !== 'glTF') {
    throw new Error(`Invalid GLB magic header: ${glbPath}`);
  }
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  return {
    extensionsUsed: gltf.extensionsUsed || [],
    extensionsRequired: gltf.extensionsRequired || [],
  };
}

// 1. Parse all JSON files
const dives = readJson('data/dives.json');
const waypoints = readJson('data/waypoints.json');
const manifest = readJson('data/asset-manifest.json');
const esLocale = readJson('locales/es.json');
const enLocale = readJson('locales/en.json');

// 2. Verify 100% ES/EN key parity
let esKeys = new Map();
let enKeys = new Map();
if (esLocale && enLocale) {
  esKeys = flattenKeys(esLocale);
  enKeys = flattenKeys(enLocale);

  const missingInEn = [...esKeys.keys()].filter((k) => !enKeys.has(k));
  const missingInEs = [...enKeys.keys()].filter((k) => !esKeys.has(k));

  if (missingInEn.length > 0) {
    fail(`Keys in es.json missing from en.json: ${missingInEn.join(', ')}`);
  }
  if (missingInEs.length > 0) {
    fail(`Keys in en.json missing from es.json: ${missingInEs.join(', ')}`);
  }
  if (missingInEn.length === 0 && missingInEs.length === 0) {
    pass(`100% ES/EN locale key parity (${esKeys.size} keys)`);
  }
}

function assertLocaleKey(key, context) {
  if (!key || !esKeys.has(key) || !enKeys.has(key)) {
    fail(`Missing locale key "${key}" referenced in ${context}`);
  }
}

// 3. Verify favicon.png
const faviconPath = path.join(ROOT, 'public', 'favicon.png');
if (!fs.existsSync(faviconPath)) {
  fail('Missing public/favicon.png');
} else {
  const favBytes = fs.statSync(faviconPath).size;
  if (favBytes >= MAX_FAVICON_BYTES) {
    fail(`public/favicon.png (${favBytes} B) >= ${MAX_FAVICON_BYTES} B`);
  } else {
    pass(`public/favicon.png OK (${favBytes} B < 15 KB)`);
  }
}

// 4. Verify asset-manifest.json against r2-staging/
if (manifest) {
  const entries = Object.entries(manifest);
  if (entries.length === 0) fail('asset-manifest.json is empty');

  let card600Count = 0;
  let modelCount = 0;

  for (const [key, entry] of entries) {
    const filePath = path.join(STAGING_DIR, entry.path);
    if (!fs.existsSync(filePath)) {
      fail(`Manifest "${key}" missing file in r2-staging: ${filePath}`);
      continue;
    }

    const actualBytes = fs.statSync(filePath).size;
    if (actualBytes !== entry.bytes) {
      fail(`Manifest "${key}" bytes mismatch: manifest=${entry.bytes}, disk=${actualBytes}`);
    }

    const actualSha = sha256File(filePath);
    if (actualSha !== entry.sha256) {
      fail(`Manifest "${key}" sha256 mismatch: manifest=${entry.sha256}, disk=${actualSha}`);
    }

    if (key.startsWith('cards.') && key.endsWith('.600')) {
      card600Count += 1;
      if (actualBytes >= MAX_CARD_600_BYTES) {
        fail(`600px card "${key}" (${actualBytes} B) >= 60 KB (${MAX_CARD_600_BYTES} B)`);
      }
    }

    if (key.startsWith('models.')) {
      modelCount += 1;
      if (actualBytes > MAX_GLB_BYTES) {
        fail(`Model "${key}" (${actualBytes} B) > 15 MB (${MAX_GLB_BYTES} B)`);
      }
      const { extensionsUsed, extensionsRequired } = readGlbExtensions(filePath);
      if (
        extensionsUsed.includes('KHR_materials_pbrSpecularGlossiness') ||
        extensionsRequired.includes('KHR_materials_pbrSpecularGlossiness')
      ) {
        fail(`Model "${key}" still contains KHR_materials_pbrSpecularGlossiness`);
      }
    }
  }

  pass(`Verified ${entries.length} manifest entries on disk (sha256 + bytes match)`);
  pass(`Verified ${card600Count} 600x360 cards < 60 KB`);
  pass(`Verified ${modelCount} GLB models <= 15 MB with zero KHR_materials_pbrSpecularGlossiness`);
}

// 5. Verify dives.json and waypoints.json cross-references
if (dives && manifest) {
  for (const [slug, dive] of Object.entries(dives)) {
    assertLocaleKey(dive.titleKey, `dives.${slug}.titleKey`);

    if (dive.status === 'live') {
      if (!dive.modelKey || !manifest[dive.modelKey]) {
        fail(`Live dive "${slug}" missing valid modelKey in manifest: ${dive.modelKey}`);
      }
    } else if (dive.status === 'coming_soon') {
      if ('modelKey' in dive || 'model_path' in dive) {
        fail(`coming_soon dive "${slug}" must NOT contain modelKey or model_path`);
      }
    } else {
      fail(`Dive "${slug}" has unexpected status: ${dive.status}`);
    }

    for (const [cardSlot, cardKey] of Object.entries(dive.cards || {})) {
      if (!manifest[cardKey]) {
        fail(`Dive "${slug}" card "${cardSlot}" references missing manifest key: ${cardKey}`);
      }
    }

    if (!waypoints || !Array.isArray(waypoints[slug])) {
      fail(`waypoints.json missing array for dive "${slug}"`);
    }
  }
  pass(`Verified ${Object.keys(dives).length} dives in dives.json`);
}

if (waypoints && manifest) {
  let wpCount = 0;
  for (const [diveSlug, list] of Object.entries(waypoints)) {
    if (!dives || !dives[diveSlug]) {
      fail(`waypoints.json contains unknown dive "${diveSlug}"`);
      continue;
    }
    for (const wp of list) {
      wpCount += 1;
      assertLocaleKey(wp.titleKey, `waypoints.${diveSlug}.${wp.id}.titleKey`);
      assertLocaleKey(wp.content?.descriptionKey, `waypoints.${diveSlug}.${wp.id}.descriptionKey`);
      if (wp.content?.videoCaptionKey) {
        assertLocaleKey(wp.content.videoCaptionKey, `waypoints.${diveSlug}.${wp.id}.videoCaptionKey`);
      }
      if (wp.content?.vrVideoKey !== undefined && wp.content.vrVideoKey !== null) {
        if (!manifest[wp.content.vrVideoKey]) {
          fail(`Waypoint "${wp.id}" references missing vrVideoKey: ${wp.content.vrVideoKey}`);
        }
      }
      for (const item of wp.content?.gallery || []) {
        if (!manifest[item.thumbKey]) {
          fail(`Waypoint "${wp.id}" missing gallery thumbKey: ${item.thumbKey}`);
        }
        if (!manifest[item.fullKey]) {
          fail(`Waypoint "${wp.id}" missing gallery fullKey: ${item.fullKey}`);
        }
        assertLocaleKey(item.captionKey, `waypoints.${diveSlug}.${wp.id}.gallery.captionKey`);
      }
    }
  }
  pass(`Verified ${wpCount} waypoints across ${Object.keys(waypoints).length} dives`);
}

console.log('=== VALIDATION CHECKS ===');
for (const c of checks) console.log(`  PASS: ${c}`);

if (errors.length > 0) {
  console.error('\n=== VALIDATION ERRORS ===');
  for (const e of errors) console.error(`  FAIL: ${e}`);
  process.exit(1);
}

console.log('\nALL VALIDATIONS PASSED.');
