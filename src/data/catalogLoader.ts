import { useEffect, useState } from 'react';
import {
  CaldwellEntry,
  Constellation,
  DeepSkyObject,
  DoubleStarPair,
  DoubleStarSystem,
  DsoType,
  MilkyWayLayer,
  NebulaContour,
  Star,
} from '../types/astronomy';
import { DEG2RAD, getDsoLimitingMagnitude, getLimitingMagnitude } from '../utils/astronomy';
import { formatCatalogCode, normalizeCatalogToken } from '../utils/catalogNames';
import {
  getLocalStarCatalogState,
  getLocalStarSpatialIndex,
  initLocalStarCatalogs,
  LocalStarCellData,
  LocalStarSpatialIndex,
  subscribeLocalStarCatalogs,
} from '../utils/localStarCatalogs';

type BrightStarTuple = [
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

type DeepStarTuple = [
  number, // hip
  number, // ra
  number, // dec
  number, // mag
  number  // bv
];

type GaiaStarTuple = [
  string, // sourceIdShort
  number, // ra
  number, // dec
  number, // gMag
  number  // bvApprox
];

type DsoTuple = [
  string,  // id
  string,  // altId
  DsoType, // type
  number,  // ra
  number,  // dec
  number,  // mag
  number,  // majAx
  number,  // minAx
  number,  // pa
  string,  // name
  string,  // koName
  string   // con
];

type DoubleStarPairTuple = [
  string, // comp
  number, // sep
  number, // pa
  number, // mag1
  number, // mag2
  string  // disc
];

type DoubleStarTuple = [
  string, // wdsId
  string, // disc + comp
  number, // ra
  number, // dec
  number, // mag1
  number, // mag2
  number, // sep
  number, // pa
  number, // compCount
  string, // spec
  number, // lastYear
  string, // name
  string, // koName
  string, // bayer
  string, // con
  DoubleStarPairTuple[]?
];

export interface GaiaTileCoverage {
  raMin: number;
  raMax: number;
  decMin: number;
  decMax: number;
  effectiveMaxMag: number;
}

export interface GaiaPatchMeta {
  centerRa: number;
  centerDec: number;
  radius: number;
  effectiveMaxMag?: number;
  tiles?: GaiaTileCoverage[];
}

export interface CatalogSnapshot {
  brightStars: Star[];
  deepStars: Star[];
  ultraStarTiles: Map<string, Star[]>;
  localStarTiles: LocalStarSpatialIndex;
  localStarCount: number;
  localStarMaxMag: number;
  localStarRevision: number;
  gaiaStars: Star[];
  gaiaPatch: GaiaPatchMeta | null;
  gaiaLoading: boolean;
  doubleStars: DoubleStarSystem[];
  dsosBright: DeepSkyObject[];
  dsosDeep: DeepSkyObject[];
  caldwell: CaldwellEntry[];
  darkNebulae: DeepSkyObject[];
  nebulaContours: NebulaContour[];
  constellations: Constellation[];
  constellationBoundaries: [number, number][][];
  milkyWay: MilkyWayLayer[];
  coreLoaded: boolean;
  deepStarsLoaded: boolean;
  deepDsosLoaded: boolean;
  doubleStarsLoaded: boolean;
}

const cache: CatalogSnapshot = {
  brightStars: [],
  deepStars: [],
  ultraStarTiles: new Map<string, Star[]>(),
  localStarTiles: new Map<string, LocalStarCellData>(),
  localStarCount: 0,
  localStarMaxMag: 8.0,
  localStarRevision: 0,
  gaiaStars: [],
  gaiaPatch: null,
  gaiaLoading: false,
  doubleStars: [],
  dsosBright: [],
  dsosDeep: [],
  caldwell: [],
  darkNebulae: [],
  nebulaContours: [],
  constellations: [],
  constellationBoundaries: [],
  milkyWay: [],
  coreLoaded: false,
  deepStarsLoaded: false,
  deepDsosLoaded: false,
  doubleStarsLoaded: false,
};

let corePromise: Promise<void> | null = null;
let deepStarsPromise: Promise<void> | null = null;
let deepDsosPromise: Promise<void> | null = null;
let doubleStarsPromise: Promise<void> | null = null;
const ultraTilePromises = new Map<string, Promise<void>>();
const gaiaPatchCache = new Map<string, { stars: Star[]; patch: GaiaPatchMeta }>();
interface GaiaTileCacheEntry {
  stars: Star[];
  raMin: number;
  raMax: number;
  decMin: number;
  decMax: number;
  requestedMag: number;
  effectiveMaxMag: number;
}
const gaiaTileCache = new Map<string, GaiaTileCacheEntry>();
const hipSearchCache = new Map<string, Star[]>();
const gaiaSearchCache = new Map<string, Star[]>();
const catalogListeners = new Set<() => void>();

function notifyCatalogListeners(): void {
  for (const fn of catalogListeners) {
    fn();
  }
}

function mapBrightStar(t: BrightStarTuple): Star {
  const [hip, ra, dec, mag, bv, name, koName, bayer, con] = t;
  return {
    id: name || `HIP ${hip}`,
    hip,
    ra,
    dec,
    mag,
    bv,
    name: name || undefined,
    koName: koName || undefined,
    bayer: bayer || undefined,
    con,
  };
}

function mapDeepStar(t: DeepStarTuple): Star {
  const [hip, ra, dec, mag, bv] = t;
  return {
    id: `HIP ${hip}`,
    hip,
    ra,
    dec,
    mag,
    bv,
    con: '',
  };
}

function mapGaiaStar(t: GaiaStarTuple): Star {
  const [sid, ra, dec, mag, bv] = t;
  return {
    id: `Gaia DR3 ${sid}`,
    gaiaId: sid,
    ra,
    dec,
    mag,
    bv,
    con: '',
  };
}

interface DsoNameFallback {
  altId?: string;
  name?: string;
  koName?: string;
}

let dsoFallbackByToken = new Map<string, DsoNameFallback>();

function rebuildDsoFallbackMap(caldwell: CaldwellEntry[]): void {
  const map = new Map<string, DsoNameFallback>();
  const register = (keyRaw: string | undefined, meta: DsoNameFallback) => {
    const token = normalizeCatalogToken(keyRaw);
    if (!token) return;
    const prev = map.get(token);
    map.set(token, {
      altId: prev?.altId || meta.altId,
      name: prev?.name || meta.name,
      koName: prev?.koName || meta.koName,
    });
  };
  for (const c of caldwell) {
    register(c.id, {
      altId: c.caldwellId,
      name: c.name,
      koName: c.koName,
    });
    register(c.caldwellId, {
      altId: formatCatalogCode(c.id),
      name: c.name,
      koName: c.koName,
    });
  }
  dsoFallbackByToken = map;
}

function mapDso(t: DsoTuple): DeepSkyObject {
  const [rawId, rawAltId, type, ra, dec, mag, majAx, minAx, pa, rawName, rawKoName, con] = t;
  const id = rawId;
  const formattedAlt = rawAltId ? formatCatalogCode(rawAltId) : undefined;
  const fb =
    dsoFallbackByToken.get(normalizeCatalogToken(id)) ||
    (formattedAlt ? dsoFallbackByToken.get(normalizeCatalogToken(formattedAlt)) : undefined);

  const resolvedAlt = formattedAlt || fb?.altId;
  const altId =
    resolvedAlt && normalizeCatalogToken(resolvedAlt) !== normalizeCatalogToken(id)
      ? resolvedAlt
      : undefined;

  return {
    id,
    altId,
    type,
    ra,
    dec,
    mag,
    majAx,
    minAx,
    pa,
    name: rawName || fb?.name || undefined,
    koName: rawKoName || fb?.koName || undefined,
    con,
  };
}

function mapDoubleStar(t: DoubleStarTuple): DoubleStarSystem {
  const [
    wdsId,
    disc,
    ra,
    dec,
    mag1,
    mag2,
    sep,
    pa,
    compCount,
    spec,
    lastYear,
    name,
    koName,
    bayer,
    con,
    rawPairs,
  ] = t;
  const pairs: DoubleStarPair[] | undefined = rawPairs?.map(([comp, pSep, pPa, pM1, pM2, pDisc]) => ({
    comp,
    sep: pSep,
    pa: pPa,
    mag1: pM1,
    mag2: pM2,
    disc: pDisc,
  }));
  return {
    id: `WDS ${wdsId}`,
    wdsId,
    disc,
    ra,
    dec,
    mag: Math.min(mag1, mag2),
    mag1,
    mag2,
    sep,
    pa,
    compCount,
    isMultiple: compCount >= 3,
    spec: spec || undefined,
    lastYear,
    name: name || undefined,
    koName: koName || undefined,
    bayer: bayer || undefined,
    con,
    pairs,
  };
}

export function getVisibleUltraTileKeys(
  raHours: number,
  decDeg: number,
  fszDeg: number
): string[] {
  const halfSpan = Math.min(60, fszDeg * 0.75);
  const decMin = Math.max(-90, decDeg - halfSpan);
  const decMax = Math.min(90, decDeg + halfSpan);

  const decBands: number[] = [];
  if (decMin < -30) decBands.push(0);
  if (decMax >= -30 && decMin <= 30) decBands.push(1);
  if (decMax > 30) decBands.push(2);

  const cosDec = Math.max(0.18, Math.cos(decDeg * DEG2RAD));
  const raHalfDeg = Math.min(180, halfSpan / cosDec);
  const raCenterDeg = ((raHours * 15) % 360 + 360) % 360;

  const raBins = new Set<number>();
  if (raHalfDeg >= 165) {
    for (let b = 0; b < 12; b++) raBins.add(b);
  } else {
    const startBin = Math.floor((raCenterDeg - raHalfDeg) / 30);
    const endBin = Math.floor((raCenterDeg + raHalfDeg) / 30);
    for (let b = startBin; b <= endBin; b++) {
      raBins.add(((b % 12) + 12) % 12);
    }
  }

  const keys: string[] = [];
  for (const d of decBands) {
    for (const r of raBins) {
      keys.push(`${d}_${r}`);
    }
  }
  return keys;
}

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

async function safeFetchJson<T>(url: string, retries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) {
          return null;
        }
        return (await res.json()) as T;
      }
      if (res.status >= 400 && res.status < 500) {
        return null;
      }
    } catch {
      // Retry transient network hiccups quietly
    }
    if (attempt < retries) {
      await new Promise((r) => window.setTimeout(r, 250 * (attempt + 1)));
    }
  }
  return null;
}

interface CoreCatalogBundle {
  starsBright?: BrightStarTuple[];
  dsosBright?: DsoTuple[];
  caldwell?: CaldwellEntry[];
  constellations?: Constellation[];
  milkyWay?: MilkyWayLayer[];
  nebulaContours?: NebulaContour[];
  darkNebulae?: DsoTuple[];
  constellationBoundaries?: [number, number][][];
}

export async function ensureCoreCatalogs(): Promise<void> {
  if (cache.coreLoaded) return;
  if (corePromise) return corePromise;

  corePromise = (async () => {
    // Primary path: single pre-gzipped server bundle loaded from external /public/data/*.json files
    const bundle = await safeFetchJson<CoreCatalogBundle>('/api/catalogs/core', 2);
    if (bundle && bundle.starsBright && bundle.dsosBright && bundle.constellations) {
      if (bundle.caldwell && bundle.caldwell.length > 0) {
        cache.caldwell = bundle.caldwell;
        rebuildDsoFallbackMap(cache.caldwell);
      }
      cache.brightStars = bundle.starsBright.map(mapBrightStar).sort((a, b) => a.mag - b.mag);
      cache.dsosBright = bundle.dsosBright.map(mapDso).sort((a, b) => a.mag - b.mag);
      cache.constellations = bundle.constellations;
      if (bundle.milkyWay) cache.milkyWay = bundle.milkyWay;
      if (bundle.nebulaContours) cache.nebulaContours = bundle.nebulaContours;
      if (bundle.darkNebulae) {
        cache.darkNebulae = bundle.darkNebulae.map(mapDso).sort((a, b) => a.mag - b.mag);
      }
      if (bundle.constellationBoundaries) {
        cache.constellationBoundaries = bundle.constellationBoundaries;
      }
      cache.coreLoaded = true;
      notifyCatalogListeners();
      return;
    }

    // Fallback for static-only hosts: load external JSON files directly from /data/*.json
    const [starsRaw, dsosRaw, caldwellRaw, consRaw, mwRaw, nebRaw, darkRaw, bndRaw] =
      await Promise.all([
        safeFetchJson<BrightStarTuple[]>(`${DATA_BASE}/stars-bright.json`, 1),
        safeFetchJson<DsoTuple[]>(`${DATA_BASE}/dsos-bright.json`, 1),
        safeFetchJson<CaldwellEntry[]>(`${DATA_BASE}/caldwell.json`, 1),
        safeFetchJson<Constellation[]>(`${DATA_BASE}/constellations.json`, 1),
        safeFetchJson<MilkyWayLayer[]>(`${DATA_BASE}/milkyway.json`, 1),
        safeFetchJson<NebulaContour[]>(`${DATA_BASE}/nebula-contours.json`, 1),
        safeFetchJson<DsoTuple[]>(`${DATA_BASE}/dark-nebulae.json`, 1),
        safeFetchJson<[number, number][][]>(`${DATA_BASE}/constellation-boundaries.json`, 1),
      ]);

    if (caldwellRaw && caldwellRaw.length > 0) {
      cache.caldwell = caldwellRaw;
      rebuildDsoFallbackMap(cache.caldwell);
    }
    if (starsRaw) {
      cache.brightStars = starsRaw.map(mapBrightStar).sort((a, b) => a.mag - b.mag);
    }
    if (dsosRaw) {
      cache.dsosBright = dsosRaw.map(mapDso).sort((a, b) => a.mag - b.mag);
    }
    if (consRaw) {
      cache.constellations = consRaw;
    }
    if (mwRaw) {
      cache.milkyWay = mwRaw;
    }
    if (nebRaw) {
      cache.nebulaContours = nebRaw;
    }
    if (darkRaw) {
      cache.darkNebulae = darkRaw.map(mapDso).sort((a, b) => a.mag - b.mag);
    }
    if (bndRaw) {
      cache.constellationBoundaries = bndRaw;
    }

    if (starsRaw && dsosRaw && consRaw) {
      cache.coreLoaded = true;
      notifyCatalogListeners();
    } else {
      corePromise = null;
    }
  })();

  return corePromise;
}

export async function ensureDeepStars(): Promise<void> {
  if (cache.deepStarsLoaded) return;
  if (deepStarsPromise) return deepStarsPromise;

  deepStarsPromise = (async () => {
    const raw = await safeFetchJson<DeepStarTuple[]>(`${DATA_BASE}/stars-deep.json`, 2);
    if (raw) {
      cache.deepStars = raw.map(mapDeepStar).sort((a, b) => a.mag - b.mag);
      cache.deepStarsLoaded = true;
      notifyCatalogListeners();
    } else {
      deepStarsPromise = null;
    }
  })();

  return deepStarsPromise;
}

async function ensureUltraStarTile(key: string): Promise<boolean> {
  if (cache.ultraStarTiles.has(key)) return false;
  let p = ultraTilePromises.get(key);
  if (!p) {
    p = (async () => {
      const raw = await safeFetchJson<DeepStarTuple[]>(`${DATA_BASE}/stars-ultra/tile_${key}.json`, 1);
      if (raw) {
        cache.ultraStarTiles.set(key, raw.map(mapDeepStar));
      } else {
        ultraTilePromises.delete(key);
      }
    })();
    ultraTilePromises.set(key, p);
  }
  await p;
  return cache.ultraStarTiles.has(key);
}

export async function ensureDeepDsos(): Promise<void> {
  if (cache.deepDsosLoaded) return;
  if (deepDsosPromise) return deepDsosPromise;

  deepDsosPromise = (async () => {
    const raw = await safeFetchJson<DsoTuple[]>(`${DATA_BASE}/dsos-deep.json`, 2);
    if (raw) {
      cache.dsosDeep = raw.map(mapDso).sort((a, b) => a.mag - b.mag);
      cache.deepDsosLoaded = true;
      notifyCatalogListeners();
    } else {
      deepDsosPromise = null;
    }
  })();

  return deepDsosPromise;
}

export async function ensureDoubleStars(): Promise<void> {
  if (cache.doubleStarsLoaded) return;
  if (doubleStarsPromise) return doubleStarsPromise;

  doubleStarsPromise = (async () => {
    const raw = await safeFetchJson<DoubleStarTuple[]>(`${DATA_BASE}/double-stars.json`, 2);
    if (raw) {
      cache.doubleStars = raw.map(mapDoubleStar);
      cache.doubleStarsLoaded = true;
      notifyCatalogListeners();
    } else {
      doubleStarsPromise = null;
    }
  })();

  return doubleStarsPromise;
}

/**
 * Search across all 118,216 Hipparcos stars (bright + deep + 36 ultra tiles) by HIP number.
 * Uses server-side /api/catalogs/hip index over external JSON files, with client fallback.
 */
export async function searchHipparcosCatalog(rawQuery: string): Promise<Star[]> {
  const digits = rawQuery.trim().replace(/^hip\s*/i, '').replace(/\s+/g, '');
  if (!/^\d{1,6}$/.test(digits)) return [];

  const cached = hipSearchCache.get(digits);
  if (cached) return cached;

  const json = await safeFetchJson<{ stars?: BrightStarTuple[] }>(
    `/api/catalogs/hip?q=${encodeURIComponent(digits)}`,
    0
  );
  if (json && Array.isArray(json.stars)) {
    const mapped = json.stars.map(mapBrightStar);
    if (hipSearchCache.size > 80) {
      const oldest = hipSearchCache.keys().next().value;
      if (oldest) hipSearchCache.delete(oldest);
    }
    hipSearchCache.set(digits, mapped);
    return mapped;
  }

  // Fallback for static-only hosts without server API
  const hits: Star[] = [];
  const seen = new Set<number>();
  const scan = (list: Star[]) => {
    for (let i = 0; i < list.length && hits.length < 25; i++) {
      const s = list[i];
      if (!s.hip || seen.has(s.hip)) continue;
      if (String(s.hip) === digits || (digits.length >= 2 && String(s.hip).startsWith(digits))) {
        seen.add(s.hip);
        hits.push(s);
      }
    }
  };
  scan(cache.brightStars);
  scan(cache.deepStars);
  for (const tile of cache.ultraStarTiles.values()) {
    if (hits.length >= 25) break;
    scan(tile);
  }
  return hits;
}

/**
 * Instant client-side search across currently visible & session-cached live Gaia DR3 stars.
 * Matches full Gaia DR3 source_id, 4..12 digit suffixes (e.g., "Gaia 81346048"), or "gaia"/"가이아".
 */
export function searchLoadedGaiaStars(
  rawQuery: string,
  activeGaiaStars: Star[],
  maxResults = 35
): Star[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  const qCompact = q.replace(/\s+/g, '');

  const isBrowseKeyword = q === 'gaia' || q === 'gaiadr3' || q === '가이아';
  const explicitGaia = qCompact.startsWith('gaia')
    ? qCompact.replace(/^gaia(?:dr3)?/i, '')
    : null;
  const digits =
    explicitGaia !== null && /^\d{2,20}$/.test(explicitGaia)
      ? explicitGaia
      : /^\d{5,20}$/.test(qCompact)
      ? qCompact
      : null;

  if (!isBrowseKeyword && !digits) return [];

  const exactHits: Star[] = [];
  const partialHits: Star[] = [];
  const seen = new Set<string>();

  const scanList = (list: Star[]) => {
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const sid = s.gaiaId || s.id.replace(/^gaia(?:\s*dr3)?\s*/i, '');
      if (!sid || seen.has(s.id)) continue;

      if (isBrowseKeyword) {
        seen.add(s.id);
        partialHits.push(s);
        if (partialHits.length >= maxResults * 2) return;
        continue;
      }

      if (digits) {
        if (sid === digits || sid.endsWith(digits)) {
          seen.add(s.id);
          exactHits.push(s);
        } else if (
          sid.startsWith(digits) ||
          (digits.length >= 5 && sid.includes(digits))
        ) {
          seen.add(s.id);
          partialHits.push(s);
        }
        if (exactHits.length >= maxResults) return;
      }
    }
  };

  scanList(activeGaiaStars);
  if (exactHits.length < maxResults) {
    for (const tile of gaiaTileCache.values()) {
      scanList(tile.stars);
      if (exactHits.length >= maxResults) break;
    }
  }
  if (exactHits.length < maxResults) {
    for (const patch of gaiaPatchCache.values()) {
      scanList(patch.stars);
      if (exactHits.length >= maxResults) break;
    }
  }

  exactHits.sort((a, b) => a.mag - b.mag);
  partialHits.sort((a, b) => a.mag - b.mag);
  return [...exactHits, ...partialHits].slice(0, maxResults);
}

/**
 * Search server-cached Gaia DR3 stars & live Gaia DR3 TAP (1.8B stars by full source_id).
 * Automatically falls back to direct browser CORS query (GAVO Heidelberg) on static hosts (GitHub Pages).
 */
export async function searchGaiaCatalog(rawQuery: string): Promise<Star[]> {
  const compact = rawQuery.trim().replace(/\s+/g, '').toLowerCase();
  const digits = compact.replace(/^gaia(?:dr3)?/i, '');
  if (!/^\d{4,20}$/.test(digits)) return [];

  const cached = gaiaSearchCache.get(digits);
  if (cached) return cached;

  const storeResult = (mapped: Star[]) => {
    if (mapped.length > 0) {
      if (gaiaSearchCache.size > 80) {
        const oldest = gaiaSearchCache.keys().next().value;
        if (oldest) gaiaSearchCache.delete(oldest);
      }
      gaiaSearchCache.set(digits, mapped);
    }
    return mapped;
  };

  const json = await safeFetchJson<{ stars?: GaiaStarTuple[] }>(
    `/api/gaia/search?q=${encodeURIComponent(digits)}`,
    0
  );
  if (json && Array.isArray(json.stars) && json.stars.length > 0) {
    return storeResult(json.stars.map(mapGaiaStar));
  }

  // Static host (GitHub Pages) or server fallback: direct CORS primary-key lookup on GAVO gaia.dr3lite
  if (digits.length >= 13 && digits.length <= 20) {
    try {
      const adql =
        `SELECT TOP 5 source_id, ra, dec, phot_g_mean_mag, phot_bp_mean_mag, phot_rp_mean_mag ` +
        `FROM gaia.dr3lite WHERE source_id = ${digits}`;
      const res = await fetch(
        'https://dc.g-vo.org/tap/sync?' +
          new URLSearchParams({
            REQUEST: 'doQuery',
            LANG: 'ADQL',
            FORMAT: 'csv',
            QUERY: adql,
          }).toString()
      );
      if (res.ok) {
        const csv = await res.text();
        if (!csv.trimStart().startsWith('<')) {
          const lines = csv.split(/\r?\n/);
          const direct: Star[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',');
            if (cols.length < 4) continue;
            const sid = cols[0].trim();
            const ra = Number(cols[1]);
            const dec = Number(cols[2]);
            const mag = Number(cols[3]);
            if (!sid || !Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
            const bp = cols[4]?.trim() ? Number(cols[4]) : NaN;
            const rp = cols[5]?.trim() ? Number(cols[5]) : NaN;
            const bpRp = Number.isFinite(bp) && Number.isFinite(rp) ? bp - rp : 0.8;
            const bv = Math.max(-0.35, Math.min(2.2, (bpRp - 0.15) * 0.78));
            direct.push(
              mapGaiaStar([
                sid,
                Number(ra.toFixed(5)),
                Number(dec.toFixed(5)),
                Number(mag.toFixed(2)),
                Number(bv.toFixed(2)),
              ])
            );
          }
          if (direct.length > 0) return storeResult(direct);
        }
      }
    } catch {
      // Ignore direct lookup network error
    }
  }
  return [];
}

export function getCatalogSnapshot(): CatalogSnapshot {
  const localState = getLocalStarCatalogState();
  return {
    ...cache,
    localStarTiles: getLocalStarSpatialIndex(),
    localStarCount: localState.totalStars,
    localStarMaxMag: localState.maxMag,
    localStarRevision: localState.revision,
  };
}

export const GAIA_LIVE_MAX_FSZ = 10.0;
const GAIA_TILE_MIN_FSZ = 3.2;

const GAIA_RA_STEPS = [4, 5, 6, 8, 10, 12, 15, 20, 30, 45, 90, 360] as const;

interface FinderTileSpec {
  key: string;
  raMin: number;
  raMax: number;
  decMin: number;
  decMax: number;
  distSq: number;
}

function getVisibleGaiaFinderTiles(
  raHours: number,
  decDeg: number,
  fsz: number
): FinderTileSpec[] {
  const raCenter = ((raHours * 15) % 360 + 360) % 360;
  const halfDec = Math.min(8.5, fsz * 0.68);
  const minDec = Math.max(-90, decDeg - halfDec);
  const maxDec = Math.min(90, decDeg + halfDec);

  const decStep = 4;
  const startBand = Math.max(0, Math.floor((minDec + 90) / decStep));
  const endBand = Math.min(44, Math.floor((Math.min(89.999, maxDec) + 90) / decStep));

  const specs: FinderTileSpec[] = [];
  for (let band = startBand; band <= endBand; band++) {
    const dMin = -90 + band * decStep;
    const dMax = Math.min(90, dMin + decStep);
    const dMid = (dMin + dMax) / 2;

    if (dMax >= 89.5 || dMin <= -89.5) {
      const distDec = dMid - decDeg;
      specs.push({
        key: `0.00_360.00_${dMin.toFixed(2)}_${dMax.toFixed(2)}`,
        raMin: 0,
        raMax: 360,
        decMin: dMin,
        decMax: dMax,
        distSq: distDec * distDec,
      });
      continue;
    }

    const cosBand = Math.max(0.08, Math.cos(Math.max(Math.abs(dMin), Math.abs(dMax)) * DEG2RAD));
    const idealRaStep = decStep / cosBand;
    const raStep = GAIA_RA_STEPS.find((s) => s >= idealRaStep) ?? 360;
    const raHalf = Math.min(180, halfDec / Math.max(0.12, Math.cos(dMid * DEG2RAD)));

    const numCols = Math.round(360 / raStep);
    const seenCols = new Set<number>();
    const startRa = raCenter - raHalf;
    const endRa = raCenter + raHalf;
    const firstCol = Math.floor(startRa / raStep);
    const lastCol = Math.floor(endRa / raStep);

    for (let c = firstCol; c <= lastCol; c++) {
      const normCol = ((c % numCols) + numCols) % numCols;
      if (seenCols.has(normCol)) continue;
      seenCols.add(normCol);
      const rMin = normCol * raStep;
      const rMax = rMin + raStep;
      const rMid = rMin + raStep / 2;
      let dRa = Math.abs(rMid - raCenter);
      if (dRa > 180) dRa = 360 - dRa;
      const dRaSky = dRa * Math.cos(dMid * DEG2RAD);
      const dDec = dMid - decDeg;
      specs.push({
        key: `${rMin.toFixed(2)}_${rMax.toFixed(2)}_${dMin.toFixed(2)}_${dMax.toFixed(2)}`,
        raMin: rMin,
        raMax: rMax,
        decMin: dMin,
        decMax: dMax,
        distSq: dRaSky * dRaSky + dDec * dDec,
      });
    }
  }

  specs.sort((a, b) => a.distSq - b.distSq);
  return specs.slice(0, 16);
}

/**
 * React hook providing reactive LoD access to external catalog files in /public/data/:
 * - 118,216 Hipparcos stars (up to 13.78m) via stars-bright + stars-deep + 36 spatial ultra tiles
 * - Live ESA Gaia DR3 stars (8.3m–20.0m) with 4° finder tiles (3.2°–10.0°) & deep cones (<= 3.2°)
 * - 8,260 Washington Double Star (WDS) visual double & multiple systems
 * - 12,344 OpenNGC/Messier/IC DSOs + 109 Caldwell + 391 Barnard/LDN Dark Nebulae
 * - 513 FChart3 multi-level Nebula Contours + 88 IAU Constellations + 782 Boundaries
 */
export function useCatalogData(
  raHours: number,
  decDeg: number,
  fsz: number,
  magOffset: number,
  searchActive: boolean,
  enableGaiaLive: boolean,
  loadDoubleStars = true,
  dsoMagOffset = 0
): CatalogSnapshot {
  const [tick, setTick] = useState(0);
  const [gaiaStars, setGaiaStars] = useState<Star[]>([]);
  const [gaiaPatch, setGaiaPatch] = useState<GaiaPatchMeta | null>(null);
  const [gaiaLoading, setGaiaLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const onUpdate = () => {
      if (mounted) setTick((t) => t + 1);
    };
    catalogListeners.add(onUpdate);
    const unsubLocal = subscribeLocalStarCatalogs(onUpdate);
    ensureCoreCatalogs().then(() => {
      if (mounted) setTick((t) => t + 1);
    });
    initLocalStarCatalogs().then(() => {
      if (mounted) setTick((t) => t + 1);
    });
    return () => {
      mounted = false;
      catalogListeners.delete(onUpdate);
      unsubLocal();
    };
  }, []);

  // Lazy-load deep Hipparcos stars (mag 6.01–8.00, 36,367 stars) after core bundle completes
  useEffect(() => {
    if (!cache.coreLoaded) return;
    const magLimit = getLimitingMagnitude(fsz, magOffset);
    if ((magLimit > 5.8 || fsz <= 50 || searchActive) && !cache.deepStarsLoaded) {
      let mounted = true;
      ensureDeepStars().then(() => {
        if (mounted) setTick((t) => t + 1);
      });
      return () => {
        mounted = false;
      };
    }
  }, [fsz, magOffset, searchActive, tick]);

  // Lazy-load spatial Hipparcos ultra tiles (mag 8.01–13.78, 76,805 stars) with zero gap after 8.0m
  useEffect(() => {
    if (!cache.coreLoaded) return;
    const magLimit = getLimitingMagnitude(fsz, magOffset);
    if (magLimit <= 8.0 && fsz > 28) return;

    const neededKeys = getVisibleUltraTileKeys(raHours, decDeg, fsz).filter(
      (k) => !cache.ultraStarTiles.has(k)
    );
    if (neededKeys.length === 0) return;

    let mounted = true;
    const timer = window.setTimeout(async () => {
      const BATCH_SIZE = 2;
      for (let i = 0; i < neededKeys.length; i += BATCH_SIZE) {
        if (!mounted) break;
        const batch = neededKeys.slice(i, i + BATCH_SIZE);
        const changed = await Promise.all(batch.map(ensureUltraStarTile));
        if (mounted && changed.some(Boolean)) {
          setTick((t) => t + 1);
        }
      }
    }, 120);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [raHours, decDeg, fsz, magOffset, tick]);

  // Lazy-load deep NGC/IC catalog (~10.8k DSOs) after core bundle completes
  useEffect(() => {
    if (!cache.coreLoaded) return;
    const dsoMagLimit = getDsoLimitingMagnitude(fsz, dsoMagOffset);
    if ((fsz <= 45 || searchActive || dsoMagLimit > 10.5) && !cache.deepDsosLoaded) {
      let mounted = true;
      ensureDeepDsos().then(() => {
        if (mounted) setTick((t) => t + 1);
      });
      return () => {
        mounted = false;
      };
    }
  }, [fsz, searchActive, dsoMagOffset, tick]);

  // Lazy-load WDS visual double & multiple star catalog (~8.2k systems) after core bundle completes
  useEffect(() => {
    if (!cache.coreLoaded) return;
    if ((loadDoubleStars || searchActive) && !cache.doubleStarsLoaded) {
      let mounted = true;
      ensureDoubleStars().then(() => {
        if (mounted) setTick((t) => t + 1);
      });
      return () => {
        mounted = false;
      };
    }
  }, [loadDoubleStars, searchActive, tick]);

  // Live ESA Gaia DR3 faint star streaming:
  // - Finder / mid-field (3.2° < fsz <= 10.0°): 4° spatial tile caching (up to 15.5m)
  // - Eyepiece & ultra-deep high-mag (fsz <= 3.2°, down to 0.008°): adaptive deep cone (up to 20.0m)
  useEffect(() => {
    const magLimit = getLimitingMagnitude(fsz, magOffset);
    if (!enableGaiaLive || fsz > GAIA_LIVE_MAX_FSZ || magLimit <= 9.0) {
      setGaiaLoading(false);
      return;
    }

    const raDeg = ((raHours * 15) % 360 + 360) % 360;

    // Tier 1: Finder / Mid-field spatial tile caching (3.2° < fsz <= 10.0°)
    if (fsz > GAIA_TILE_MIN_FSZ) {
      const qMag = Math.ceil(Math.min(15.5, magLimit) * 2) / 2;
      const visibleTiles = getVisibleGaiaFinderTiles(raHours, decDeg, fsz);

      const emitMergedTiles = () => {
        const mergedStars: Star[] = [];
        const coveredTiles: GaiaTileCoverage[] = [];
        for (const spec of visibleTiles) {
          const entry = gaiaTileCache.get(spec.key);
          if (!entry) continue;
          coveredTiles.push({
            raMin: entry.raMin,
            raMax: entry.raMax,
            decMin: entry.decMin,
            decMax: entry.decMax,
            effectiveMaxMag: Math.min(qMag, entry.effectiveMaxMag),
          });
          for (let i = 0; i < entry.stars.length; i++) {
            const st = entry.stars[i];
            if (st.mag > qMag) break;
            mergedStars.push(st);
          }
        }
        if (coveredTiles.length > 0) {
          mergedStars.sort((a, b) => a.mag - b.mag);
          setGaiaStars(mergedStars);
          setGaiaPatch({
            centerRa: raDeg,
            centerDec: decDeg,
            radius: Math.max(fsz * 0.9, 4.0),
            effectiveMaxMag: qMag,
            tiles: coveredTiles,
          });
        }
      };

      const missingTiles = visibleTiles.filter((spec) => {
        const entry = gaiaTileCache.get(spec.key);
        return !entry || entry.requestedMag < qMag;
      });

      // Immediately render any already-cached tiles for flicker-free panning
      emitMergedTiles();

      if (missingTiles.length === 0) {
        setGaiaLoading(false);
        return;
      }

      let cancelled = false;
      const timer = window.setTimeout(async () => {
        if (cancelled) return;
        setGaiaLoading(true);
        try {
          const BATCH_SIZE = 3;
          for (let i = 0; i < missingTiles.length; i += BATCH_SIZE) {
            if (cancelled) break;
            const batch = missingTiles.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
              batch.map(async (spec) => {
                const params = new URLSearchParams({
                  mode: 'tile',
                  raMin: spec.raMin.toFixed(2),
                  raMax: spec.raMax.toFixed(2),
                  decMin: spec.decMin.toFixed(2),
                  decMax: spec.decMax.toFixed(2),
                  magLimit: qMag.toFixed(2),
                });
                const json = await safeFetchJson<{
                  stars?: GaiaStarTuple[];
                  requestedMag?: number;
                  effectiveMaxMag?: number;
                  degraded?: boolean;
                }>(`/api/gaia?${params.toString()}`, 1);
                if (!json || json.degraded) return false;
                const parsed = (json.stars ?? []).map(mapGaiaStar);
                if (gaiaTileCache.size >= 160) {
                  const oldest = gaiaTileCache.keys().next().value;
                  if (oldest) gaiaTileCache.delete(oldest);
                }
                gaiaTileCache.set(spec.key, {
                  stars: parsed,
                  raMin: spec.raMin,
                  raMax: spec.raMax,
                  decMin: spec.decMin,
                  decMax: spec.decMax,
                  requestedMag: json.requestedMag ?? qMag,
                  effectiveMaxMag: json.effectiveMaxMag ?? qMag,
                });
                return true;
              })
            );
            if (!cancelled && results.some(Boolean)) {
              emitMergedTiles();
            }
          }
        } catch {
          // Silent fallback to Hipparcos tiles
        } finally {
          if (!cancelled) setGaiaLoading(false);
        }
      }, 280);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    // Tier 2 & 3: Eyepiece & ultra-deep high-magnification cone queries (fsz <= 3.2°, up to 20.0m)
    const radius =
      fsz <= 0.45
        ? Math.max(0.015, Math.min(0.55, fsz * 1.08))
        : Math.max(0.35, Math.min(3.5, fsz * 0.96));
    const step =
      radius <= 0.06 ? 0.01 : radius <= 0.25 ? 0.05 : radius <= 1.2 ? 0.25 : 0.5;
    const qRa = ((Math.round(raDeg / step) * step) % 360 + 360) % 360;
    const qDec = Math.max(-90, Math.min(90, Math.round(decDeg / step) * step));
    const qRad =
      radius <= 0.06
        ? Math.ceil(radius * 50) / 50
        : radius <= 0.25
        ? Math.ceil(radius * 20) / 20
        : Math.ceil(radius * 4) / 4;
    const qMag = Math.ceil(Math.min(20.0, magLimit) * 2) / 2;
    const patchKey = `${qRa.toFixed(3)}_${qDec.toFixed(3)}_${qRad.toFixed(3)}_${qMag.toFixed(1)}`;

    const existing = gaiaPatchCache.get(patchKey);
    if (existing) {
      setGaiaStars(existing.stars);
      setGaiaPatch(existing.patch);
      setGaiaLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setGaiaLoading(true);
      try {
        const params = new URLSearchParams({
          ra: qRa.toFixed(4),
          dec: qDec.toFixed(4),
          radius: qRad.toFixed(4),
          magLimit: qMag.toFixed(2),
        });
        const json = await safeFetchJson<{
          stars?: GaiaStarTuple[];
          centerRa?: number;
          centerDec?: number;
          radius?: number;
          effectiveMaxMag?: number;
          degraded?: boolean;
        }>(`/api/gaia?${params.toString()}`, 1);
        if (!json) return;
        const parsed = (json.stars ?? []).map(mapGaiaStar);
        const patch: GaiaPatchMeta = {
          centerRa: json.centerRa ?? qRa,
          centerDec: json.centerDec ?? qDec,
          radius: json.radius ?? qRad,
          effectiveMaxMag: json.effectiveMaxMag ?? qMag,
        };
        if (!json.degraded) {
          if (gaiaPatchCache.size > 90) {
            const oldest = gaiaPatchCache.keys().next().value;
            if (oldest) gaiaPatchCache.delete(oldest);
          }
          gaiaPatchCache.set(patchKey, { stars: parsed, patch });
        }
        if (!cancelled) {
          setGaiaStars(parsed);
          setGaiaPatch(patch);
        }
      } catch {
        // Silent fallback to Hipparcos tiles
      } finally {
        if (!cancelled) setGaiaLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [raHours, decDeg, fsz, magOffset, enableGaiaLive]);

  const localState = getLocalStarCatalogState();
  return {
    brightStars: cache.brightStars,
    deepStars: cache.deepStars,
    ultraStarTiles: cache.ultraStarTiles,
    localStarTiles: getLocalStarSpatialIndex(),
    localStarCount: localState.totalStars,
    localStarMaxMag: localState.maxMag,
    localStarRevision: localState.revision,
    gaiaStars,
    gaiaPatch,
    gaiaLoading,
    doubleStars: cache.doubleStars,
    dsosBright: cache.dsosBright,
    dsosDeep: cache.dsosDeep,
    caldwell: cache.caldwell,
    darkNebulae: cache.darkNebulae,
    nebulaContours: cache.nebulaContours,
    constellations: cache.constellations,
    constellationBoundaries: cache.constellationBoundaries,
    milkyWay: cache.milkyWay,
    coreLoaded: cache.coreLoaded,
    deepStarsLoaded: cache.deepStarsLoaded,
    deepDsosLoaded: cache.deepDsosLoaded,
    doubleStarsLoaded: cache.doubleStarsLoaded,
  };
}
