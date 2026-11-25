#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const RAW_DIR = '/home/pfefferi/workspace-next/data/vidaenlosextremos-vr-2/raw-sources';
const STAGING_DIR = '/home/pfefferi/workspace-next/data/vidaenlosextremos-vr-2/r2-staging';
const WORKTREE_PUBLIC = path.resolve(import.meta.dirname, '..', 'public');

const MAX_CARD_600_BYTES = 60 * 1024; // 60 KB = 61,440 bytes
const MAX_FAVICON_BYTES = 15 * 1024; // 15 KB = 15,360 bytes

const CARD_SOURCES = [
  { key: 'cards.whale-fall.env', file: 'whale_fall.jpg', outBase: 'whale-fall-env' },
  { key: 'cards.whale-fall.close', file: 'whale_fall_close.jpg', outBase: 'whale-fall-close' },
  { key: 'cards.clam-bed.env', file: 'clam_bed.jpg', outBase: 'clam-bed-env' },
  { key: 'cards.clam-bed.close', file: 'clam_bed_close.jpg', outBase: 'clam-bed-close' },
  { key: 'cards.giant-corals.env', file: 'giant_corals.jpg', outBase: 'giant-corals-env' },
  { key: 'cards.giant-corals.close', file: 'giant_corals_close.jpg', outBase: 'giant-corals-close' },
];

const PHOTO_FILES = [
  'fkt251206_crew.jpg',
  'isopods_macro.jpg',
  'labo_vertebra.jpg',
  'labo_vertebra2.jpg',
  'labo_vertebra3.jpg',
  'rov_subastian_arms.jpg',
  'whalefall_crinoid_vertebra.jpg',
  'whalefall_sponge_arthropods.jpg',
];

function sha256Buffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function cleanPrefixedFiles(dir, prefix, ext) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(prefix) && name.endsWith(ext)) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
}

async function writeHashedWebp(dir, baseName, buffer) {
  fs.mkdirSync(dir, { recursive: true });
  const sha256 = sha256Buffer(buffer);
  const shortSha = sha256.slice(0, 8);
  const filename = `${baseName}.${shortSha}.webp`;
  cleanPrefixedFiles(dir, `${baseName}.`, '.webp');
  fs.writeFileSync(path.join(dir, filename), buffer);
  return { filename, sha256, bytes: buffer.length };
}

async function encodeCardUnderLimit(srcPath, width, height, maxBytes) {
  for (const quality of [82, 78, 74, 70, 65, 60]) {
    const { data, info } = await sharp(srcPath)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    if (!maxBytes || data.length < maxBytes) {
      return { data, info, quality };
    }
  }
  throw new Error(`Could not compress ${path.basename(srcPath)} (${width}x${height}) under ${maxBytes} bytes`);
}

async function main() {
  const manifestEntries = {};
  const report = { cards: [], photos: [], brand: {} };

  // 1. Cards (600x360 and 1200x720 WebP)
  const cardsDir = path.join(STAGING_DIR, 'v2', 'cards');
  for (const card of CARD_SOURCES) {
    const srcPath = path.join(RAW_DIR, 'images', card.file);
    const rawBytes = fs.statSync(srcPath).size;

    const r600 = await encodeCardUnderLimit(srcPath, 600, 360, MAX_CARD_600_BYTES);
    const w600 = await writeHashedWebp(cardsDir, `${card.outBase}-600`, r600.data);
    manifestEntries[`${card.key}.600`] = {
      path: `v2/cards/${w600.filename}`,
      bytes: w600.bytes,
      sha256: w600.sha256,
      contentType: 'image/webp',
      width: r600.info.width,
      height: r600.info.height,
    };

    const r1200 = await encodeCardUnderLimit(srcPath, 1200, 720, null);
    const w1200 = await writeHashedWebp(cardsDir, `${card.outBase}-1200`, r1200.data);
    manifestEntries[`${card.key}.1200`] = {
      path: `v2/cards/${w1200.filename}`,
      bytes: w1200.bytes,
      sha256: w1200.sha256,
      contentType: 'image/webp',
      width: r1200.info.width,
      height: r1200.info.height,
    };

    report.cards.push({
      source: card.file,
      rawBytes,
      w600Bytes: w600.bytes,
      w1200Bytes: w1200.bytes,
      key600: `${card.key}.600`,
      key1200: `${card.key}.1200`,
    });
  }

  // 2. Gallery photos (400px thumb + 1600px max-edge full)
  const photosDir = path.join(STAGING_DIR, 'v2', 'photos');
  for (const file of PHOTO_FILES) {
    const base = path.basename(file, path.extname(file));
    const srcPath = path.join(RAW_DIR, 'photos', file);
    const rawBytes = fs.statSync(srcPath).size;

    const thumbRes = await sharp(srcPath)
      .rotate()
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    const wThumb = await writeHashedWebp(photosDir, `${base}-thumb`, thumbRes.data);

    const fullRes = await sharp(srcPath)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    const wFull = await writeHashedWebp(photosDir, `${base}-full`, fullRes.data);

    manifestEntries[`photos.${base}.thumb`] = {
      path: `v2/photos/${wThumb.filename}`,
      bytes: wThumb.bytes,
      sha256: wThumb.sha256,
      contentType: 'image/webp',
      width: thumbRes.info.width,
      height: thumbRes.info.height,
    };
    manifestEntries[`photos.${base}.full`] = {
      path: `v2/photos/${wFull.filename}`,
      bytes: wFull.bytes,
      sha256: wFull.sha256,
      contentType: 'image/webp',
      width: fullRes.info.width,
      height: fullRes.info.height,
    };

    report.photos.push({
      source: file,
      rawBytes,
      thumbBytes: wThumb.bytes,
      fullBytes: wFull.bytes,
    });
  }

  // 3. Brand logo (256px WebP in r2-staging/v2/brand/) + 64x64 PNG favicon
  const logoSrc = path.join(RAW_DIR, 'logo', 'logo-vidaenextremos.png');
  const logoRawBytes = fs.statSync(logoSrc).size;
  const brandDir = path.join(STAGING_DIR, 'v2', 'brand');

  const logoRes = await sharp(logoSrc)
    .resize({ width: 256, withoutEnlargement: true })
    .webp({ quality: 90, effort: 6 })
    .toBuffer({ resolveWithObject: true });
  const wLogo = await writeHashedWebp(brandDir, 'logo-vidaenextremos', logoRes.data);

  manifestEntries['brand.logo'] = {
    path: `v2/brand/${wLogo.filename}`,
    bytes: wLogo.bytes,
    sha256: wLogo.sha256,
    contentType: 'image/webp',
    width: logoRes.info.width,
    height: logoRes.info.height,
  };

  fs.mkdirSync(WORKTREE_PUBLIC, { recursive: true });
  const faviconPath = path.join(WORKTREE_PUBLIC, 'favicon.png');
  const faviconRes = await sharp(logoSrc)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer({ resolveWithObject: true });
  if (faviconRes.data.length >= MAX_FAVICON_BYTES) {
    throw new Error(`favicon.png (${faviconRes.data.length} B) exceeds ${MAX_FAVICON_BYTES} B limit`);
  }
  fs.writeFileSync(faviconPath, faviconRes.data);

  report.brand = {
    logoRawBytes,
    logoWebpBytes: wLogo.bytes,
    logoWidth: logoRes.info.width,
    logoHeight: logoRes.info.height,
    faviconBytes: faviconRes.data.length,
  };

  console.log('--- MEDIA_RESULTS_JSON ---');
  console.log(JSON.stringify({ manifestEntries, report }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
