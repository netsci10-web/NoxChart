import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const PUBLIC_DATA_DIR = path.resolve(__dirname, 'public', 'data');

interface GzippedAsset {
  raw: Buffer;
  gzip: Buffer;
}

const DATA_ASSET_CACHE = new Map<string, GzippedAsset>();
let coreBundleAsset: GzippedAsset | null = null;

function getGzippedDataFile(relPath: string): GzippedAsset | null {
  const safeRel = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(PUBLIC_DATA_DIR, safeRel);
  if (!fullPath.startsWith(PUBLIC_DATA_DIR)) return null;

  const cached = DATA_ASSET_CACHE.get(safeRel);
  if (cached) return cached;

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;
  const raw = fs.readFileSync(fullPath);
  const gzip = zlib.gzipSync(raw, { level: 6 });
  const asset = { raw, gzip };
  DATA_ASSET_CACHE.set(safeRel, asset);
  return asset;
}

function getCoreBundleAsset(): GzippedAsset | null {
  if (coreBundleAsset) return coreBundleAsset;
  try {
    const readJsonText = (name: string) => {
      const p = path.join(PUBLIC_DATA_DIR, name);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '[]';
    };
    const combinedJson =
      '{' +
      `"starsBright":${readJsonText('stars-bright.json')},` +
      `"dsosBright":${readJsonText('dsos-bright.json')},` +
      `"constellations":${readJsonText('constellations.json')},` +
      `"milkyWay":${readJsonText('milkyway.json')},` +
      `"nebulaContours":${readJsonText('nebula-contours.json')},` +
      `"darkNebulae":${readJsonText('dark-nebulae.json')},` +
      `"constellationBoundaries":${readJsonText('constellation-boundaries.json')}` +
      '}';
    const raw = Buffer.from(combinedJson, 'utf-8');
    const gzip = zlib.gzipSync(raw, { level: 6 });
    coreBundleAsset = { raw, gzip };
    return coreBundleAsset;
  } catch {
    return null;
  }
}

function sendJsonAsset(req: express.Request, res: express.Response, asset: GzippedAsset) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.end(asset.gzip);
  } else {
    res.end(asset.raw);
  }
}

// Compact Gaia star tuple: [sourceIdShort, raDeg, decDeg, gMag, bvApprox]
type GaiaStarTuple = [string, number, number, number, number];

interface CacheEntry {
  stars: GaiaStarTuple[];
  centerRa: number;
  centerDec: number;
  radius: number;
  fetchedAt: number;
}

const GAIA_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 160;
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

function getCacheKey(ra: number, dec: number, radius: number, magLimit: number): string {
  const step = radius <= 1.2 ? 0.25 : 0.5;
  const qRa = Math.round(ra / step) * step;
  const qDec = Math.round(dec / step) * step;
  const qRad = Math.ceil(radius * 4) / 4;
  const qMag = Math.ceil(magLimit * 2) / 2;
  return `${qRa.toFixed(2)}_${qDec.toFixed(2)}_${qRad.toFixed(2)}_${qMag.toFixed(1)}`;
}

function setCache(key: string, entry: Omit<CacheEntry, 'fetchedAt'>) {
  if (GAIA_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = GAIA_CACHE.keys().next().value;
    if (oldestKey) GAIA_CACHE.delete(oldestKey);
  }
  GAIA_CACHE.set(key, { ...entry, fetchedAt: Date.now() });
}

async function createServer() {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/maps-config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      apiKey:
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        '',
    });
  });

  // Single pre-gzipped core catalog bundle (replaces 7 simultaneous boot fetches)
  app.get('/api/catalogs/core', (req, res) => {
    const asset = getCoreBundleAsset();
    if (!asset) {
      res.status(404).json({ error: 'Core catalogs unavailable' });
      return;
    }
    sendJsonAsset(req, res, asset);
  });

  // Direct Express gzipped static serving for /data/*.json (bypasses Vite dev middleware)
  app.get('/data/*', (req, res, next) => {
    const relPath = req.path.replace(/^\/data\//, '');
    if (!relPath.endsWith('.json')) {
      next();
      return;
    }
    const asset = getGzippedDataFile(relPath);
    if (!asset) {
      next();
      return;
    }
    sendJsonAsset(req, res, asset);
  });

  // Live ESA Gaia DR3 TAP proxy for deep faint stars (mag 8.3 - 15.8) when zoomed into eyepiece/finder FOV (<= 6°)
  app.get('/api/gaia', async (req, res) => {
    const rawRa = Number(req.query.ra);
    const rawDec = Number(req.query.dec);
    const rawRadius = Number(req.query.radius);
    const rawMag = Number(req.query.magLimit);

    if (!Number.isFinite(rawRa) || !Number.isFinite(rawDec)) {
      res.status(400).json({ error: 'Invalid ra/dec parameters' });
      return;
    }

    const ra = ((rawRa % 360) + 360) % 360;
    const dec = Math.max(-90, Math.min(90, rawDec));
    const radius = Math.max(0.35, Math.min(5.5, Number.isFinite(rawRadius) ? rawRadius : 1.5));
    const magLimit = Math.max(8.8, Math.min(15.8, Number.isFinite(rawMag) ? rawMag : 13.5));

    const step = radius <= 1.2 ? 0.25 : 0.5;
    const qRa = ((Math.round(ra / step) * step) % 360 + 360) % 360;
    const qDec = Math.max(-90, Math.min(90, Math.round(dec / step) * step));
    const qRad = Math.ceil(radius * 4) / 4;
    const qMag = Math.ceil(magLimit * 2) / 2;

    const cacheKey = getCacheKey(ra, dec, radius, magLimit);
    const cached = GAIA_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json({
        stars: cached.stars,
        centerRa: cached.centerRa,
        centerDec: cached.centerDec,
        radius: cached.radius,
        cached: true,
      });
      return;
    }

    // Query faint stars beyond Hipparcos bright completeness (phot_g_mean_mag > 8.3)
    const maxRows = 3800;
    const adql =
      `SELECT TOP ${maxRows} source_id, ra, dec, phot_g_mean_mag, bp_rp ` +
      `FROM gaiadr3.gaia_source ` +
      `WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${qRa.toFixed(4)},${qDec.toFixed(4)},${qRad.toFixed(3)})) ` +
      `AND phot_g_mean_mag > 8.3 AND phot_g_mean_mag <= ${qMag.toFixed(2)} ` +
      `ORDER BY phot_g_mean_mag ASC`;

    const tapUrl =
      'https://gea.esac.esa.int/tap-server/tap/sync?' +
      new URLSearchParams({
        REQUEST: 'doQuery',
        LANG: 'ADQL',
        FORMAT: 'json',
        QUERY: adql,
      }).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const upstream = await fetch(tapUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeout);

      if (!upstream.ok) {
        res.json({
          stars: [],
          centerRa: qRa,
          centerDec: qDec,
          radius: qRad,
          degraded: true,
        });
        return;
      }

      const payload = (await upstream.json()) as {
        data?: [string | number, number, number, number, number | null][];
      };
      const rows = Array.isArray(payload.data) ? payload.data : [];

      const stars: GaiaStarTuple[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sid = String(row[0] ?? i);
        const sRa = Number(row[1]);
        const sDec = Number(row[2]);
        const gMag = Number(row[3]);
        const bpRp = row[4] !== null && Number.isFinite(Number(row[4])) ? Number(row[4]) : 0.8;
        if (!Number.isFinite(sRa) || !Number.isFinite(sDec) || !Number.isFinite(gMag)) continue;

        const bvApprox = Math.max(-0.35, Math.min(2.2, (bpRp - 0.15) * 0.78));
        stars.push([
          sid.slice(-8),
          Number(sRa.toFixed(5)),
          Number(sDec.toFixed(5)),
          Number(gMag.toFixed(2)),
          Number(bvApprox.toFixed(2)),
        ]);
      }

      setCache(cacheKey, { stars, centerRa: qRa, centerDec: qDec, radius: qRad });
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json({ stars, centerRa: qRa, centerDec: qDec, radius: qRad, cached: false });
    } catch {
      clearTimeout(timeout);
      res.json({
        stars: [],
        centerRa: qRa,
        centerDec: qDec,
        radius: qRad,
        degraded: true,
      });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sidereal Atlas server running at http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
