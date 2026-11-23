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
      `"caldwell":${readJsonText('caldwell.json')},` +
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

type HipIndexTuple = [
  number, // hip
  number, // ra
  number, // dec
  number, // mag
  number, // bv
  string, // name
  string, // koName
  string, // bayer
  string  // con
];

let hipAllIndex: { byHip: Map<number, HipIndexTuple>; list: HipIndexTuple[] } | null = null;

function getHipIndex() {
  if (hipAllIndex) return hipAllIndex;
  const byHip = new Map<number, HipIndexTuple>();
  const readArr = (rel: string): unknown[][] => {
    const full = path.join(PUBLIC_DATA_DIR, rel);
    if (!fs.existsSync(full)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  for (const r of readArr('stars-bright.json')) {
    const hip = Number(r[0]);
    if (!Number.isFinite(hip)) continue;
    byHip.set(hip, [
      hip,
      Number(r[1]),
      Number(r[2]),
      Number(r[3]),
      Number(r[4]),
      String(r[5] ?? ''),
      String(r[6] ?? ''),
      String(r[7] ?? ''),
      String(r[8] ?? ''),
    ]);
  }
  const addCompact = (rows: unknown[][]) => {
    for (const r of rows) {
      const hip = Number(r[0]);
      if (!Number.isFinite(hip) || byHip.has(hip)) continue;
      byHip.set(hip, [
        hip,
        Number(r[1]),
        Number(r[2]),
        Number(r[3]),
        Number(r[4]),
        '',
        '',
        '',
        '',
      ]);
    }
  };
  addCompact(readArr('stars-deep.json'));
  const ultraDir = path.join(PUBLIC_DATA_DIR, 'stars-ultra');
  if (fs.existsSync(ultraDir)) {
    for (const file of fs.readdirSync(ultraDir)) {
      if (file.endsWith('.json')) {
        addCompact(readArr(path.join('stars-ultra', file)));
      }
    }
  }
  const list = Array.from(byHip.values()).sort((a, b) => a[3] - b[3]);
  hipAllIndex = { byHip, list };
  return hipAllIndex;
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
  requestedMag: number;
  effectiveMaxMag: number;
  truncated: boolean;
  fetchedAt: number;
}

const GAIA_CACHE = new Map<string, CacheEntry>();
const GAIA_TILE_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 480;
const CACHE_TTL_MS = 1000 * 60 * 120; // 2 hours

function quantizeConeParams(ra: number, dec: number, radius: number, magLimit: number) {
  const step =
    radius <= 0.06 ? 0.01 : radius <= 0.25 ? 0.05 : radius <= 1.2 ? 0.25 : 0.5;
  const qRa = ((Math.round(ra / step) * step) % 360 + 360) % 360;
  const qDec = Math.max(-90, Math.min(90, Math.round(dec / step) * step));
  const qRad =
    radius <= 0.06
      ? Math.ceil(radius * 50) / 50
      : radius <= 0.25
      ? Math.ceil(radius * 20) / 20
      : Math.ceil(radius * 4) / 4;
  const qMag = Math.ceil(magLimit * 2) / 2;
  return { qRa, qDec, qRad, qMag };
}

function getCacheKey(qRa: number, qDec: number, qRad: number, qMag: number): string {
  return `${qRa.toFixed(3)}_${qDec.toFixed(3)}_${qRad.toFixed(3)}_${qMag.toFixed(1)}`;
}

function setMapLruCache(
  cache: Map<string, CacheEntry>,
  key: string,
  entry: Omit<CacheEntry, 'fetchedAt'>
) {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { ...entry, fetchedAt: Date.now() });
}

function angularDistDegServer(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const toRad = Math.PI / 180;
  const a1 = ra1 * toRad;
  const d1 = dec1 * toRad;
  const a2 = ra2 * toRad;
  const d2 = dec2 * toRad;
  const c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2);
  return Math.acos(Math.max(-1, Math.min(1, c))) * (180 / Math.PI);
}

async function queryGaiaTap(adql: string, timeoutMs = 15000): Promise<GaiaStarTuple[] | null> {
  const tapUrl =
    'https://gea.esac.esa.int/tap-server/tap/sync?' +
    new URLSearchParams({
      REQUEST: 'doQuery',
      LANG: 'ADQL',
      FORMAT: 'json',
      QUERY: adql,
    }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(tapUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!upstream.ok) return null;

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
    return stars;
  } catch {
    clearTimeout(timeout);
    return null;
  }
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

  // Single pre-gzipped core catalog bundle (replaces multiple simultaneous boot fetches)
  app.get('/api/catalogs/core', (req, res) => {
    const asset = getCoreBundleAsset();
    if (!asset) {
      res.status(404).json({ error: 'Core catalogs unavailable' });
      return;
    }
    sendJsonAsset(req, res, asset);
  });

  // Complete 118,216-star Hipparcos Catalogue lookup by HIP number (exact + prefix)
  app.get('/api/catalogs/hip', (req, res) => {
    const rawQ = String(req.query.q || '').trim();
    const digits = rawQ.replace(/^hip\s*/i, '').replace(/\s+/g, '');
    if (!/^\d{1,6}$/.test(digits)) {
      res.json({ stars: [] });
      return;
    }
    const { byHip, list } = getHipIndex();
    const hits: HipIndexTuple[] = [];
    const exactNum = Number(digits);
    const exact = byHip.get(exactNum);
    if (exact) hits.push(exact);
    if (digits.length >= 2) {
      for (let i = 0; i < list.length && hits.length < 25; i++) {
        const row = list[i];
        if (row[0] === exactNum) continue;
        if (String(row[0]).startsWith(digits)) {
          hits.push(row);
        }
      }
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ stars: hits });
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

  // Live ESA Gaia DR3 TAP proxy:
  // - mode=tile: 4° spatial tiles for finder / mid-field FOV (3.2°–10.0°, up to 15.5m) with LRU caching
  // - cone mode: adaptive eyepiece & ultra-deep high-mag queries (<= 3.2°, down to 0.015° radius, up to 20.0m)
  app.get('/api/gaia', async (req, res) => {
    const mode = String(req.query.mode || 'cone');

    if (mode === 'tile') {
      const raMin = Number(req.query.raMin);
      const raMax = Number(req.query.raMax);
      const decMin = Number(req.query.decMin);
      const decMax = Number(req.query.decMax);
      const rawMag = Number(req.query.magLimit);

      if (
        !Number.isFinite(raMin) ||
        !Number.isFinite(raMax) ||
        !Number.isFinite(decMin) ||
        !Number.isFinite(decMax) ||
        raMax <= raMin ||
        decMax <= decMin ||
        raMax - raMin > 360.01 ||
        decMax - decMin > 12
      ) {
        res.status(400).json({ error: 'Invalid tile parameters' });
        return;
      }

      const clampedDecMin = Math.max(-90, Math.min(90, decMin));
      const clampedDecMax = Math.max(-90, Math.min(90, decMax));
      const magLimit = Math.max(8.8, Math.min(15.5, Number.isFinite(rawMag) ? rawMag : 13.0));
      const qMag = Math.ceil(magLimit * 2) / 2;

      const tileKey = `${raMin.toFixed(2)}_${raMax.toFixed(2)}_${clampedDecMin.toFixed(2)}_${clampedDecMax.toFixed(2)}`;
      const cached = GAIA_TILE_CACHE.get(tileKey);
      if (
        cached &&
        Date.now() - cached.fetchedAt < CACHE_TTL_MS &&
        cached.requestedMag >= qMag
      ) {
        const sliced =
          cached.requestedMag === qMag
            ? cached.stars
            : cached.stars.filter((s) => s[3] <= qMag);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json({
          mode: 'tile',
          stars: sliced,
          raMin,
          raMax,
          decMin: clampedDecMin,
          decMax: clampedDecMax,
          requestedMag: qMag,
          effectiveMaxMag: Math.min(qMag, cached.effectiveMaxMag),
          truncated: cached.truncated && cached.effectiveMaxMag < qMag,
          cached: true,
        });
        return;
      }

      const isPolarNorth = clampedDecMax >= 89.5 && raMax - raMin >= 359;
      const isPolarSouth = clampedDecMin <= -89.5 && raMax - raMin >= 359;
      const centerRa = isPolarNorth || isPolarSouth ? 0 : (raMin + raMax) / 2;
      const centerDec = isPolarNorth
        ? 90
        : isPolarSouth
        ? -90
        : (clampedDecMin + clampedDecMax) / 2;
      let circleRad = 3.5;
      if (isPolarNorth) {
        circleRad = Math.min(8, 90 - clampedDecMin + 0.15);
      } else if (isPolarSouth) {
        circleRad = Math.min(8, clampedDecMax + 90 + 0.15);
      } else {
        const d1 = angularDistDegServer(centerRa, centerDec, raMin, clampedDecMin);
        const d2 = angularDistDegServer(centerRa, centerDec, raMin, clampedDecMax);
        const d3 = angularDistDegServer(centerRa, centerDec, raMax, clampedDecMin);
        const d4 = angularDistDegServer(centerRa, centerDec, raMax, clampedDecMax);
        circleRad = Math.min(6.5, Math.max(d1, d2, d3, d4) * 1.03 + 0.05);
      }

      const maxRows = 3400;
      const boxClause =
        isPolarNorth || isPolarSouth
          ? `AND dec >= ${clampedDecMin.toFixed(4)} AND dec <= ${clampedDecMax.toFixed(4)}`
          : `AND ra >= ${raMin.toFixed(4)} AND ra < ${raMax.toFixed(4)} ` +
            `AND dec >= ${clampedDecMin.toFixed(4)} AND dec < ${clampedDecMax.toFixed(4)}`;

      const adql =
        `SELECT TOP ${maxRows} source_id, ra, dec, phot_g_mean_mag, bp_rp ` +
        `FROM gaiadr3.gaia_source ` +
        `WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${centerRa.toFixed(4)},${centerDec.toFixed(4)},${circleRad.toFixed(3)})) ` +
        `${boxClause} ` +
        `AND phot_g_mean_mag > 8.3 AND phot_g_mean_mag <= ${qMag.toFixed(2)} ` +
        `ORDER BY phot_g_mean_mag ASC`;

      const stars = await queryGaiaTap(adql, 15000);
      if (!stars) {
        res.json({
          mode: 'tile',
          stars: [],
          raMin,
          raMax,
          decMin: clampedDecMin,
          decMax: clampedDecMax,
          requestedMag: qMag,
          effectiveMaxMag: 8.3,
          degraded: true,
        });
        return;
      }

      const truncated = stars.length >= maxRows;
      const effectiveMaxMag =
        truncated && stars.length > 0 ? stars[stars.length - 1][3] : qMag;

      setMapLruCache(GAIA_TILE_CACHE, tileKey, {
        stars,
        centerRa,
        centerDec,
        radius: circleRad,
        requestedMag: qMag,
        effectiveMaxMag,
        truncated,
      });

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json({
        mode: 'tile',
        stars,
        raMin,
        raMax,
        decMin: clampedDecMin,
        decMax: clampedDecMax,
        requestedMag: qMag,
        effectiveMaxMag,
        truncated,
        cached: false,
      });
      return;
    }

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
    const radius = Math.max(0.015, Math.min(5.5, Number.isFinite(rawRadius) ? rawRadius : 1.5));
    const magLimit = Math.max(8.8, Math.min(20.0, Number.isFinite(rawMag) ? rawMag : 13.5));

    const { qRa, qDec, qRad, qMag } = quantizeConeParams(ra, dec, radius, magLimit);
    const cacheKey = getCacheKey(qRa, qDec, qRad, qMag);
    const cached = GAIA_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json({
        stars: cached.stars,
        centerRa: cached.centerRa,
        centerDec: cached.centerDec,
        radius: cached.radius,
        effectiveMaxMag: cached.effectiveMaxMag,
        truncated: cached.truncated,
        cached: true,
      });
      return;
    }

    // Adaptive row budget: narrow ultra-deep cones can safely return up to 7,000 stars down to 20.0m
    const maxRows = qRad <= 0.4 ? 7000 : qRad <= 1.5 ? 5500 : 4500;
    const adql =
      `SELECT TOP ${maxRows} source_id, ra, dec, phot_g_mean_mag, bp_rp ` +
      `FROM gaiadr3.gaia_source ` +
      `WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${qRa.toFixed(4)},${qDec.toFixed(4)},${qRad.toFixed(4)})) ` +
      `AND phot_g_mean_mag > 8.3 AND phot_g_mean_mag <= ${qMag.toFixed(2)} ` +
      `ORDER BY phot_g_mean_mag ASC`;

    const stars = await queryGaiaTap(adql, 15000);
    if (!stars) {
      res.json({
        stars: [],
        centerRa: qRa,
        centerDec: qDec,
        radius: qRad,
        effectiveMaxMag: 8.3,
        degraded: true,
      });
      return;
    }

    const truncated = stars.length >= maxRows;
    const effectiveMaxMag =
      truncated && stars.length > 0 ? stars[stars.length - 1][3] : qMag;

    setMapLruCache(GAIA_CACHE, cacheKey, {
      stars,
      centerRa: qRa,
      centerDec: qDec,
      radius: qRad,
      requestedMag: qMag,
      effectiveMaxMag,
      truncated,
    });

    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.json({
      stars,
      centerRa: qRa,
      centerDec: qDec,
      radius: qRad,
      effectiveMaxMag,
      truncated,
      cached: false,
    });
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
