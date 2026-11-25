#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RAW_MODELS_DIR = '/home/pfefferi/workspace-next/data/vidaenlosextremos-vr-2/raw-sources/models';
const STAGING_MODELS_DIR = '/home/pfefferi/workspace-next/data/vidaenlosextremos-vr-2/r2-staging/v2/models';
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB = 15,728,640 bytes

const useKtx2 = process.argv.includes('--ktx2');

const MODELS = [
  { id: 'whale-fall', input: path.join(RAW_MODELS_DIR, 'whale-fall', 'scene.gltf') },
  { id: 'clam-bed', input: path.join(RAW_MODELS_DIR, 'clam-bed', 'scene.gltf') },
];

function runGltfTransform(args) {
  return execFileSync('gltf-transform', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function getRawSourceBytes(gltfPath) {
  const dir = path.dirname(gltfPath);
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && !entry.name.endsWith('.txt')) {
      total += fs.statSync(full).size;
    } else if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
        if (sub.isFile()) {
          total += fs.statSync(path.join(full, sub.name)).size;
        }
      }
    }
  }
  return total;
}

function readGltfGeometryStats(filePath) {
  let gltf;
  if (filePath.endsWith('.glb')) {
    const buf = fs.readFileSync(filePath);
    const jsonLen = buf.readUInt32LE(12);
    gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  } else {
    gltf = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  let triangles = 0;
  let vertices = 0;
  for (const mesh of gltf.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const posAccessor = gltf.accessors?.[prim.attributes?.POSITION];
      if (posAccessor) vertices += posAccessor.count;
      const mode = prim.mode ?? 4;
      if (mode === 4) {
        const count =
          prim.indices !== undefined
            ? gltf.accessors?.[prim.indices]?.count ?? 0
            : posAccessor?.count ?? 0;
        triangles += Math.round(count / 3);
      }
    }
  }

  const materials = gltf.materials || [];
  const doubleSidedCount = materials.filter((m) => m.doubleSided === true).length;
  const extensionsRequired = gltf.extensionsRequired || [];
  const extensionsUsed = gltf.extensionsUsed || [];
  return { triangles, vertices, doubleSidedCount, extensionsRequired, extensionsUsed };
}

function cleanPreviousOutputs(modelId) {
  if (!fs.existsSync(STAGING_MODELS_DIR)) return;
  for (const name of fs.readdirSync(STAGING_MODELS_DIR)) {
    if (name.startsWith(`${modelId}.`) && name.endsWith('.glb')) {
      fs.unlinkSync(path.join(STAGING_MODELS_DIR, name));
    }
  }
}

function buildPipeline(inputPath, tmpDir, modelId, { simplify = false } = {}) {
  const s1 = path.join(tmpDir, `${modelId}.1-metalrough.glb`);
  const s2 = path.join(tmpDir, `${modelId}.2-dedup.glb`);
  const s3 = path.join(tmpDir, `${modelId}.3-prune.glb`);
  const s4 = path.join(tmpDir, `${modelId}.4-resize.glb`);
  const s5 = path.join(tmpDir, `${modelId}.5-tex.glb`);
  const s6 = path.join(tmpDir, `${modelId}.6-weld.glb`);
  const s7 = path.join(tmpDir, `${modelId}.7-simplify.glb`);
  const sOut = path.join(tmpDir, `${modelId}.final.glb`);

  console.log(`[${modelId}] 1/6 metalrough...`);
  runGltfTransform(['metalrough', inputPath, s1]);

  console.log(`[${modelId}] 2/6 dedup...`);
  runGltfTransform(['dedup', s1, s2]);

  console.log(`[${modelId}] 3/6 prune...`);
  runGltfTransform(['prune', s2, s3]);

  console.log(`[${modelId}] 4/6 resize (<=2048x2048)...`);
  runGltfTransform(['resize', s3, s4, '--width', '2048', '--height', '2048']);

  if (useKtx2) {
    console.log(`[${modelId}] 5/6 ktx2 (ETC1S/UASTC scaffold)...`);
    // Scaffolded for future Meta Quest pass when ktx CLI (KTX-Software) is installed.
    try {
      runGltfTransform(['etc1s', s4, s5, '--quality', '128']);
    } catch (err) {
      throw new Error(
        `--ktx2 requested, but KTX-Software 'ktx' CLI is not installed or failed: ${err.message}`
      );
    }
  } else {
    console.log(`[${modelId}] 5/6 webp (quality=85)...`);
    runGltfTransform(['webp', s4, s5, '--quality', '85']);
  }

  let preMeshopt = s5;
  if (simplify) {
    console.log(`[${modelId}] 5b/6 weld + simplify (ratio=0.65, error=0.001)...`);
    runGltfTransform(['weld', s5, s6]);
    runGltfTransform(['simplify', s6, s7, '--ratio', '0.65', '--error', '0.001']);
    preMeshopt = s7;
  }

  console.log(`[${modelId}] 6/6 meshopt...`);
  runGltfTransform(['meshopt', preMeshopt, sOut]);

  return sOut;
}

fs.mkdirSync(STAGING_MODELS_DIR, { recursive: true });
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-models-'));
const results = {};

try {
  for (const model of MODELS) {
    if (!fs.existsSync(model.input)) {
      throw new Error(`Missing raw model input: ${model.input}`);
    }

    const rawBytes = getRawSourceBytes(model.input);
    const rawStats = readGltfGeometryStats(model.input);

    let finalTmp = buildPipeline(model.input, tmpDir, model.id, { simplify: false });
    let outBytes = fs.statSync(finalTmp).size;
    let simplified = false;

    if (outBytes > MAX_BYTES) {
      console.log(
        `[${model.id}] Output ${outBytes} bytes exceeds ${MAX_BYTES} bytes (${(outBytes / 1024 / 1024).toFixed(2)} MB); re-running with simplify --ratio 0.65 --error 0.001...`
      );
      finalTmp = buildPipeline(model.input, tmpDir, model.id, { simplify: true });
      outBytes = fs.statSync(finalTmp).size;
      simplified = true;
    }

    if (outBytes > MAX_BYTES) {
      throw new Error(
        `[${model.id}] Output ${outBytes} bytes still exceeds 15 MB limit (${MAX_BYTES} bytes)`
      );
    }

    // Run gltf-transform inspect for verification log
    runGltfTransform(['inspect', finalTmp]);
    const glbStats = readGltfGeometryStats(finalTmp);

    if (
      glbStats.extensionsUsed.includes('KHR_materials_pbrSpecularGlossiness') ||
      glbStats.extensionsRequired.includes('KHR_materials_pbrSpecularGlossiness')
    ) {
      throw new Error(`[${model.id}] KHR_materials_pbrSpecularGlossiness still present!`);
    }

    const sha256 = sha256File(finalTmp);
    const shortSha = sha256.slice(0, 8);
    const filename = `${model.id}.${shortSha}.glb`;
    const destPath = path.join(STAGING_MODELS_DIR, filename);

    cleanPreviousOutputs(model.id);
    fs.copyFileSync(finalTmp, destPath);

    results[model.id] = {
      path: `v2/models/${filename}`,
      bytes: outBytes,
      sha256,
      contentType: 'model/gltf-binary',
      triangles: glbStats.triangles,
      vertices: glbStats.vertices,
      doubleSidedCount: glbStats.doubleSidedCount,
      extensionsRequired: glbStats.extensionsRequired,
      extensionsUsed: glbStats.extensionsUsed,
      simplified,
      before: {
        bytes: rawBytes,
        triangles: rawStats.triangles,
        vertices: rawStats.vertices,
        doubleSidedCount: rawStats.doubleSidedCount,
        extensionsRequired: rawStats.extensionsRequired,
      },
    };

    console.log(
      `[${model.id}] DONE -> ${destPath} (${(outBytes / 1024 / 1024).toFixed(2)} MB, ${glbStats.triangles} tris, ${glbStats.vertices} verts, simplified=${simplified})`
    );
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('--- MODEL_RESULTS_JSON ---');
console.log(JSON.stringify(results, null, 2));
