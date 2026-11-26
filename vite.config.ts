import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const R2_LOCAL_PREFIX = '/r2-local/';
const R2_STAGING_ROOT = path.resolve(
  '/home/pfefferi/workspace-next/data/vidaenlosextremos-vr-2/r2-staging'
);

const MIME_TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Accept-Ranges', 'bytes');
}

function parseByteRange(
  rangeHeader: string,
  totalSize: number
): { start: number; end: number } | 'unsatisfiable' {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return 'unsatisfiable';

  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return 'unsatisfiable';

  let start: number;
  let end: number;

  if (!startStr) {
    const suffixLength = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return 'unsatisfiable';
    }
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    end = endStr ? Number.parseInt(endStr, 10) : totalSize - 1;
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= totalSize ||
    start > end
  ) {
    return 'unsatisfiable';
  }

  return { start, end: Math.min(end, totalSize - 1) };
}

function createR2LocalMiddleware(): Connect.NextHandleFunction {
  return (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const rawUrl = req.url ?? '';
    const urlPath = rawUrl.split('?')[0];
    if (!urlPath.startsWith(R2_LOCAL_PREFIX)) {
      next();
      return;
    }

    setCorsHeaders(res);

    const method = (req.method ?? 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    let relPath: string;
    try {
      relPath = decodeURIComponent(urlPath.slice(R2_LOCAL_PREFIX.length));
    } catch {
      res.statusCode = 400;
      res.end('Bad Request');
      return;
    }

    const resolvedPath = path.resolve(R2_STAGING_ROOT, relPath);
    if (
      resolvedPath !== R2_STAGING_ROOT &&
      !resolvedPath.startsWith(R2_STAGING_ROOT + path.sep)
    ) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolvedPath);
    } catch {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (!stat.isFile()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');

    const totalSize = stat.size;
    const rangeHeader = req.headers.range;

    if (typeof rangeHeader === 'string' && rangeHeader.trim().length > 0) {
      const parsed = parseByteRange(rangeHeader, totalSize);
      if (parsed === 'unsatisfiable') {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        res.end();
        return;
      }

      const { start, end } = parsed;
      const chunkLength = end - start + 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', chunkLength);

      if (method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(resolvedPath, { start, end }).pipe(res);
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Length', totalSize);

    if (method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(resolvedPath).pipe(res);
  };
}

function r2LocalStagingPlugin(): Plugin {
  const middleware = createR2LocalMiddleware();
  const shouldServeLocal = () => !process.env.VITE_ASSET_BASE_URL?.trim();

  return {
    name: 'r2-local-staging',
    configureServer(server) {
      if (shouldServeLocal()) {
        server.middlewares.use(middleware);
      }
    },
    configurePreviewServer(server) {
      if (shouldServeLocal()) {
        server.middlewares.use(middleware);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), r2LocalStagingPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        keepNames: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
