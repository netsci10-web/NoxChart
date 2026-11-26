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

function parseGaiaVotableTuples(xml: string, hasSourceId: boolean): GaiaStarTuple[] | null {
  if (!xml || xml.includes('value="ERROR"')) return null;
  const stars: GaiaStarTuple[] = [];
  const trRegex = /<TR>([\s\S]*?)<\/TR>/g;
  const tdRegex = /<TD>([^<]*)<\/TD>/g;
  let trMatch: RegExpExecArray | null;
  let idx = 0;
  while ((trMatch = trRegex.exec(xml)) !== null) {
    const trBody = trMatch[1];
    const cols: string[] = [];
    tdRegex.lastIndex = 0;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trBody)) !== null) {
      cols.push(tdMatch[1].trim());
    }
    const offset = hasSourceId ? 1 : 0;
    if (cols.length < offset + 3) continue;
    const sid = hasSourceId ? cols[0] || String(idx) : String(idx);
    const sRa = Number(cols[offset]);
    const sDec = Number(cols[offset + 1]);
    const gMag = Number(cols[offset + 2]);
    const bpRpRaw = cols.length > offset + 3 && cols[offset + 3] !== '' ? Number(cols[offset + 3]) : NaN;
    const bpRp = Number.isFinite(bpRpRaw) ? bpRpRaw : 0.8;
    if (!Number.isFinite(sRa) || !Number.isFinite(sDec) || !Number.isFinite(gMag)) continue;

    const bvApprox = Math.max(-0.35, Math.min(2.2, (bpRp - 0.15) * 0.78));
    stars.push([
      sid.slice(-8),
      Number(sRa.toFixed(5)),
      Number(sDec.toFixed(5)),
      Number(gMag.toFixed(2)),
      Number(bvApprox.toFixed(2)),
    ]);
    idx++;
  }
  return stars;
}

async function queryGaiaAipTap(
  adql: string,
  hasSourceId: boolean,
  timeoutMs = 22000
): Promise<GaiaStarTuple[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch('https://gaia.aip.de/tap/sync', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        REQUEST: 'doQuery',
        LANG: 'ADQL',
        QUERY: adql,
      }),
    });
    clearTimeout(timeout);
    if (!upstream.ok) return null;
    const xml = await upstream.text();
    if (!xml.includes('<VOTABLE')) return null;
    return parseGaiaVotableTuples(xml, hasSourceId);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function queryGaiaEsaTap(adql: string, timeoutMs = 12000): Promise<GaiaStarTuple[] | null> {
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
    const ct = upstream.headers.get('content-type') || '';
    if (ct.includes('text/html')) return null;

    const text = await upstream.text();
    if (text.trimStart().startsWith('<')) return null;
    const payload = JSON.parse(text) as {
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

async function queryGaiaTap(adql: string, timeoutMs = 15000): Promise<GaiaStarTuple[] | null> {
  const esa = await queryGaiaEsaTap(adql, Math.min(timeoutMs, 8000));
  if (esa) return esa;
  return queryGaiaAipTap(adql, true, timeoutMs);
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

  // IAU Minor Planet Center (MPC) Bright Minor Planets (Soft00Bright.txt) live orbital elements proxy
  interface ParsedMpcAsteroid {
    packedId: string;
    number?: number;
    name: string;
    H0: number;
    slopeG: number;
    epochJd: number;
    epochIso: string;
    M0: number;
    w0: number;
    N0: number;
    i0: number;
    e0: number;
    Md: number;
    a0: number;
  }

  let mpcBrightCache: {
    sourceUrl: string;
    year: number;
    epochIso: string;
    fetchedAt: number;
    asteroids: ParsedMpcAsteroid[];
  } | null = null;

  const decodeMpcPackedChar = (ch: string): number | null => {
    if (!ch) return null;
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48; // '0'-'9'
    if (code >= 65 && code <= 90) return code - 55; // 'A'-'Z' -> 10..35
    if (code >= 97 && code <= 122) return code - 61; // 'a'-'z' -> 36..61
    return null;
  };

  const decodeMpcPackedEpoch = (packed: string): { jd: number; iso: string } | null => {
    const s = packed.trim();
    if (s.length !== 5) return null;
    const centuryMap: Record<string, number> = {
      I: 1800,
      J: 1900,
      K: 2000,
      L: 2100,
    };
    const century = centuryMap[s[0]];
    const yy = Number(s.slice(1, 3));
    const month = decodeMpcPackedChar(s[3]);
    const day = decodeMpcPackedChar(s[4]);
    if (
      century === undefined ||
      !Number.isInteger(yy) ||
      month === null ||
      day === null ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }
    const year = century + yy;
    const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
    if (!Number.isFinite(utcMs)) return null;
    const jd = utcMs / 86400000 + 2440587.5;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { jd, iso };
  };

  const decodeMpcPackedNumber = (packed: string): number | undefined => {
    const s = packed.trim();
    if (/^\d{1,5}$/.test(s)) return Number(s);
    if (s.length === 5 && /^[A-Za-z]\d{4}$/.test(s)) {
      const lead = decodeMpcPackedChar(s[0]);
      if (lead !== null && lead >= 10) {
        return lead * 10000 + Number(s.slice(1));
      }
    }
    return undefined;
  };

  const parseMpcSoft00Bright = (rawText: string): ParsedMpcAsteroid[] => {
    const lines = rawText.split(/\r?\n/);
    const out: ParsedMpcAsteroid[] = [];
    for (const line of lines) {
      if (line.length < 103) continue;
      const packedId = line.slice(0, 7).trim();
      if (!packedId || packedId.startsWith('#') || packedId.startsWith('-')) continue;

      const H0 = parseFloat(line.slice(8, 13).trim());
      const slopeGRaw = parseFloat(line.slice(14, 19).trim());
      const epoch = decodeMpcPackedEpoch(line.slice(20, 25));
      const M0 = parseFloat(line.slice(26, 35).trim());
      const w0 = parseFloat(line.slice(37, 46).trim());
      const N0 = parseFloat(line.slice(48, 57).trim());
      const i0 = parseFloat(line.slice(59, 68).trim());
      const e0 = parseFloat(line.slice(70, 79).trim());
      const MdRaw = parseFloat(line.slice(80, 91).trim());
      const a0 = parseFloat(line.slice(92, 103).trim());

      if (
        !epoch ||
        !Number.isFinite(H0) ||
        !Number.isFinite(M0) ||
        !Number.isFinite(w0) ||
        !Number.isFinite(N0) ||
        !Number.isFinite(i0) ||
        !Number.isFinite(e0) ||
        !Number.isFinite(a0) ||
        a0 <= 0.05 ||
        e0 < 0 ||
        e0 >= 0.999
      ) {
        continue;
      }

      // Mean daily motion n (deg/day): use column value or Kepler's 3rd law fallback
      const Md =
        Number.isFinite(MdRaw) && MdRaw > 0
          ? MdRaw
          : 0.9856076686 / Math.pow(a0, 1.5);
      const slopeG = Number.isFinite(slopeGRaw) ? slopeGRaw : 0.15;

      const readableRaw = line.length >= 167 ? line.slice(166, 194).trim() : '';
      let num = decodeMpcPackedNumber(packedId);
      let displayName = readableRaw;

      const numMatch = readableRaw.match(/^\((\d+)\)\s*(.*)$/);
      if (numMatch) {
        num = Number(numMatch[1]);
        const rest = numMatch[2].trim();
        displayName = rest ? `${num} ${rest}` : `(${num})`;
      } else if (!displayName) {
        displayName = num !== undefined ? `(${num})` : packedId;
      }

      out.push({
        packedId,
        number: num,
        name: displayName,
        H0,
        slopeG,
        epochJd: epoch.jd,
        epochIso: epoch.iso,
        M0,
        w0,
        N0,
        i0,
        e0,
        Md,
        a0,
      });
    }
    return out;
  };

  app.get('/api/mpc/bright-asteroids', async (req, res) => {
    const force = req.query.force === '1' || req.query.force === 'true';
    const MPC_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
    if (!force && mpcBrightCache && Date.now() - mpcBrightCache.fetchedAt < MPC_TTL_MS) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ...mpcBrightCache, count: mpcBrightCache.asteroids.length, cached: true });
      return;
    }

    const nowYear = new Date().getUTCFullYear();
    const candidateYears = [nowYear, nowYear - 1, nowYear + 1];

    let fetchedText = '';
    let resolvedUrl = '';
    let resolvedYear = nowYear;

    for (const yr of candidateYears) {
      const url = `https://minorplanetcenter.net/iau/Ephemerides/Bright/${yr}/Soft00Bright.txt`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const upstream = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'text/plain,*/*;q=0.8',
            'User-Agent': 'NoxChart-StarAtlas/1.0 (+https://noxchart.app)',
          },
        });
        clearTimeout(timer);
        if (upstream.ok) {
          const text = await upstream.text();
          if (text.length > 200 && !text.trimStart().startsWith('<')) {
            fetchedText = text;
            resolvedUrl = url;
            resolvedYear = yr;
            break;
          }
        }
      } catch {
        clearTimeout(timer);
      }
    }

    if (!fetchedText) {
      if (mpcBrightCache) {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
          ...mpcBrightCache,
          count: mpcBrightCache.asteroids.length,
          cached: true,
          stale: true,
        });
        return;
      }
      res.status(502).json({
        error: 'IAU MPC 서버에서 Soft00Bright.txt 목록을 불러오지 못했습니다.',
      });
      return;
    }

    const asteroids = parseMpcSoft00Bright(fetchedText);
    if (asteroids.length === 0) {
      res.status(502).json({
        error: 'MPC Soft00Bright.txt 궤도 요소를 해석하지 못했습니다.',
      });
      return;
    }

    const epochIso = asteroids[0].epochIso;
    mpcBrightCache = {
      sourceUrl: resolvedUrl,
      year: resolvedYear,
      epochIso,
      fetchedAt: Date.now(),
      asteroids,
    };

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ...mpcBrightCache,
      count: asteroids.length,
      cached: false,
    });
  });

  // Open API Geocoding proxy (OpenStreetMap Nominatim with Komoot Photon fallback)
  interface GeocodeResultItem {
    id: string;
    name: string;
    detail: string;
    lat: number;
    lon: number;
    boundingbox?: [number, number, number, number]; // [south, north, west, east]
  }
  const geocodeCache = new Map<string, { results: GeocodeResultItem[]; at: number }>();

  app.get('/api/geocode', async (req, res) => {
    const rawQ = String(req.query.q || '').trim().slice(0, 120);
    if (rawQ.length < 2) {
      res.json({ results: [] });
      return;
    }

    const cacheKey = rawQ.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 15 * 60 * 1000) {
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.json({ results: cached.results, cached: true });
      return;
    }

    const fetchWithTimeout = async (url: string, headers: Record<string, string>, ms = 6000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        return await fetch(url, { method: 'GET', headers, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    let results: GeocodeResultItem[] = [];

    // 1. Primary: OpenStreetMap Nominatim Open API
    try {
      const nomUrl =
        'https://nominatim.openstreetmap.org/search?' +
        new URLSearchParams({
          format: 'jsonv2',
          addressdetails: '1',
          limit: '8',
          'accept-language': 'ko',
          q: rawQ,
        }).toString();
      const upstream = await fetchWithTimeout(nomUrl, {
        Accept: 'application/json',
        'Accept-Language': 'ko,en;q=0.8',
        'User-Agent': 'NoxChart-StarAtlas/1.0 (+https://noxchart.app)',
      });
      if (upstream.ok) {
        const rows = (await upstream.json()) as Array<{
          place_id?: number | string;
          name?: string;
          display_name?: string;
          lat?: string;
          lon?: string;
          boundingbox?: [string, string, string, string];
        }>;
        if (Array.isArray(rows)) {
          results = rows
            .map((r, idx): GeocodeResultItem | null => {
              const lat = Number(r.lat);
              const lon = Number(r.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              const full = String(r.display_name || '').trim();
              const parts = full.split(',').map((s) => s.trim()).filter(Boolean);
              const name = (r.name && r.name.trim()) || parts[0] || rawQ;
              const detail = parts.length > 1 ? parts.slice(1).join(', ') : full;
              let bbox: [number, number, number, number] | undefined;
              if (Array.isArray(r.boundingbox) && r.boundingbox.length === 4) {
                const nums = r.boundingbox.map(Number);
                if (nums.every(Number.isFinite)) {
                  bbox = [nums[0], nums[1], nums[2], nums[3]];
                }
              }
              return {
                id: `nom_${r.place_id ?? idx}`,
                name,
                detail: detail === name ? '' : detail,
                lat,
                lon,
                boundingbox: bbox,
              };
            })
            .filter((x): x is GeocodeResultItem => x !== null);
        }
      }
    } catch {
      // Fall through to Photon open API
    }

    // 2. Fallback: Komoot Photon Open API (OSM-based, fast fuzzy matching)
    if (results.length === 0) {
      try {
        const photonUrl =
          'https://photon.komoot.io/api/?' +
          new URLSearchParams({
            q: rawQ,
            limit: '8',
          }).toString();
        const upstream = await fetchWithTimeout(photonUrl, {
          Accept: 'application/json',
          'User-Agent': 'NoxChart-StarAtlas/1.0 (+https://noxchart.app)',
        });
        if (upstream.ok) {
          const payload = (await upstream.json()) as {
            features?: Array<{
              geometry?: { coordinates?: [number, number] };
              properties?: {
                osm_id?: number;
                name?: string;
                street?: string;
                city?: string;
                county?: string;
                state?: string;
                country?: string;
                extent?: [number, number, number, number];
              };
            }>;
          };
          const feats = Array.isArray(payload?.features) ? payload.features : [];
          results = feats
            .map((f, idx): GeocodeResultItem | null => {
              const coords = f.geometry?.coordinates;
              if (!coords || coords.length < 2) return null;
              const lon = Number(coords[0]);
              const lat = Number(coords[1]);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              const p = f.properties || {};
              const name = p.name || p.street || p.city || p.state || rawQ;
              const detailParts = [p.city, p.county, p.state, p.country].filter(
                (v): v is string => Boolean(v && v !== name)
              );
              let bbox: [number, number, number, number] | undefined;
              if (Array.isArray(p.extent) && p.extent.length === 4) {
                const [west, north, east, south] = p.extent.map(Number);
                if ([west, north, east, south].every(Number.isFinite)) {
                  bbox = [south, north, west, east];
                }
              }
              return {
                id: `pho_${p.osm_id ?? idx}_${lat.toFixed(4)}`,
                name,
                detail: detailParts.join(', '),
                lat,
                lon,
                boundingbox: bbox,
              };
            })
            .filter((x): x is GeocodeResultItem => x !== null);
        }
      } catch {
        // Return empty results
      }
    }

    if (geocodeCache.size >= 200) {
      const oldest = geocodeCache.keys().next().value;
      if (oldest) geocodeCache.delete(oldest);
    }
    geocodeCache.set(cacheKey, { results, at: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ results });
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

  // Stellarium-style tiered local star catalog chunk downloader
  // Serves compact [raDeg, decDeg, mag, bv] tuples from local Hipparcos ultra or live Gaia DR3 TAP
  type CompactStarRow = [number, number, number, number];
  const STAR_PACK_CHUNK_CACHE = new Map<string, { stars: CompactStarRow[]; at: number }>();
  const STAR_PACK_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
  let cachedHipUltraRows: CompactStarRow[] | null = null;

  const getHipUltraCompactRows = (): CompactStarRow[] => {
    if (cachedHipUltraRows) return cachedHipUltraRows;
    const rows: CompactStarRow[] = [];
    const ultraDir = path.join(PUBLIC_DATA_DIR, 'stars-ultra');
    if (fs.existsSync(ultraDir)) {
      const files = fs.readdirSync(ultraDir).filter((f) => f.endsWith('.json')).sort();
      for (const file of files) {
        const full = path.join(ultraDir, file);
        if (!full.startsWith(ultraDir + path.sep)) continue;
        try {
          const parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
          if (!Array.isArray(parsed)) continue;
          for (let i = 0; i < parsed.length; i++) {
            const r = parsed[i];
            if (!Array.isArray(r) || r.length < 5) continue;
            const ra = Number(r[1]);
            const dec = Number(r[2]);
            const mag = Number(r[3]);
            const bv = Number(r[4]);
            if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
            rows.push([
              Number(ra.toFixed(5)),
              Number(dec.toFixed(5)),
              Number(mag.toFixed(2)),
              Number((Number.isFinite(bv) ? bv : 0.6).toFixed(2)),
            ]);
          }
        } catch {
          // Skip malformed tile file
        }
      }
    }
    cachedHipUltraRows = rows;
    return rows;
  };

  app.get('/api/star-packs/chunk', async (req, res) => {
    const source = req.query.source === 'hip-ultra' ? 'hip-ultra' : 'gaia';
    const tier = Math.max(1, Math.min(6, Math.round(Number(req.query.tier) || 1)));

    if (source === 'hip-ultra') {
      const rows = getHipUltraCompactRows();
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.json({ tier, source, stars: rows, count: rows.length, cached: true });
      return;
    }

    const raMin = Number(req.query.raMin);
    const raMax = Number(req.query.raMax);
    const decMin = Number(req.query.decMin);
    const decMax = Number(req.query.decMax);
    const magMin = Number(req.query.magMin);
    const magMax = Number(req.query.magMax);

    if (
      !Number.isFinite(raMin) ||
      !Number.isFinite(raMax) ||
      !Number.isFinite(decMin) ||
      !Number.isFinite(decMax) ||
      !Number.isFinite(magMin) ||
      !Number.isFinite(magMax) ||
      raMin < 0 ||
      raMax > 360.01 ||
      raMax <= raMin ||
      decMin < -90.01 ||
      decMax > 90.01 ||
      decMax <= decMin ||
      magMin < 6.0 ||
      magMax > 15.0 ||
      magMax <= magMin
    ) {
      res.status(400).json({ error: 'Invalid star pack chunk parameters' });
      return;
    }

    const cRaMin = Math.max(0, Math.min(360, raMin));
    const cRaMax = Math.max(0, Math.min(360, raMax));
    const cDecMin = Math.max(-90, Math.min(90, decMin));
    const cDecMax = Math.max(-90, Math.min(90, decMax));
    const cMagMin = Math.max(6.0, Math.min(15.0, magMin));
    const cMagMax = Math.max(6.0, Math.min(15.0, magMax));

    const chunkKey = `t${tier}_${cRaMin.toFixed(2)}_${cRaMax.toFixed(2)}_${cDecMin.toFixed(
      2
    )}_${cDecMax.toFixed(2)}_${cMagMin.toFixed(2)}_${cMagMax.toFixed(2)}`;
    const cached = STAR_PACK_CHUNK_CACHE.get(chunkKey);
    if (cached && Date.now() - cached.at < STAR_PACK_CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=21600');
      res.json({ tier, source, stars: cached.stars, count: cached.stars.length, cached: true });
      return;
    }

    const maxRows = tier <= 2 ? 20000 : tier <= 4 ? 22000 : 25000;
    const raOp = cRaMax >= 359.99 ? '<=' : '<';
    const decOp = cDecMax >= 89.99 ? '<=' : '<';
    const adqlAip =
      `SELECT TOP ${maxRows} ra, dec, phot_g_mean_mag, bp_rp ` +
      `FROM gaiadr3.gaia_source ` +
      `WHERE ra >= ${cRaMin.toFixed(4)} AND ra ${raOp} ${cRaMax.toFixed(4)} ` +
      `AND dec >= ${cDecMin.toFixed(4)} AND dec ${decOp} ${cDecMax.toFixed(4)} ` +
      `AND phot_g_mean_mag > ${cMagMin.toFixed(2)} AND phot_g_mean_mag <= ${cMagMax.toFixed(2)}`;

    // Prefer Gaia@AIP (reliable VOTable box queries), fallback to ESA Gaia TAP JSON
    let tuples = await queryGaiaAipTap(adqlAip, false, 24000);
    if (!tuples) {
      const adqlEsa =
        `SELECT TOP ${maxRows} source_id, ra, dec, phot_g_mean_mag, bp_rp ` +
        `FROM gaiadr3.gaia_source ` +
        `WHERE ra >= ${cRaMin.toFixed(4)} AND ra ${raOp} ${cRaMax.toFixed(4)} ` +
        `AND dec >= ${cDecMin.toFixed(4)} AND dec ${decOp} ${cDecMax.toFixed(4)} ` +
        `AND phot_g_mean_mag > ${cMagMin.toFixed(2)} AND phot_g_mean_mag <= ${cMagMax.toFixed(2)}`;
      tuples = await queryGaiaEsaTap(adqlEsa, 15000);
    }

    if (!tuples) {
      res.json({ tier, source, stars: [], count: 0, degraded: true });
      return;
    }

    const compact: CompactStarRow[] = tuples.map((t) => [t[1], t[2], t[3], t[4]]);
    if (STAR_PACK_CHUNK_CACHE.size >= 400) {
      const oldest = STAR_PACK_CHUNK_CACHE.keys().next().value;
      if (oldest) STAR_PACK_CHUNK_CACHE.delete(oldest);
    }
    STAR_PACK_CHUNK_CACHE.set(chunkKey, { stars: compact, at: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.json({ tier, source, stars: compact, count: compact.length, cached: false });
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
