import { useEffect, useState } from 'react';
import {
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
import { CALDWELL_CATALOG } from './caldwell';
import { CONSTELLATIONS as FALLBACK_CONSTELLATIONS } from './constellations';
import { DSO_CATALOG as FALLBACK_DSOS } from './dso';
import { BRIGHT_STARS as FALLBACK_STARS } from './stars';

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

export interface GaiaPatchMeta {
  centerRa: number;
  centerDec: number;
  radius: number;
}

export interface CatalogSnapshot {
  brightStars: Star[];
  deepStars: Star[];
  ultraStarTiles: Map<string, Star[]>;
  gaiaStars: Star[];
  gaiaPatch: GaiaPatchMeta | null;
  gaiaLoading: boolean;
  doubleStars: DoubleStarSystem[];
  dsosBright: DeepSkyObject[];
  dsosDeep: DeepSkyObject[];
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
  brightStars: FALLBACK_STARS,
  deepStars: [],
  ultraStarTiles: new Map<string, Star[]>(),
  gaiaStars: [],
  gaiaPatch: null,
  gaiaLoading: false,
  doubleStars: [],
  dsosBright: FALLBACK_DSOS,
  dsosDeep: [],
  darkNebulae: [],
  nebulaContours: [],
  constellations: FALLBACK_CONSTELLATIONS,
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
    id: `Gaia ${sid}`,
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

const dsoFallbackByToken = (() => {
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
  for (const d of FALLBACK_DSOS) {
    const meta: DsoNameFallback = {
      altId: d.altId ? formatCatalogCode(d.altId) : undefined,
      name: d.name,
      koName: d.koName,
    };
    register(d.id, meta);
    if (d.altId) {
      register(d.altId, {
        altId: formatCatalogCode(d.id),
        name: d.name,
        koName: d.koName,
      });
    }
  }
  for (const c of CALDWELL_CATALOG) {
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
  return map;
})();

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
    // Primary path: single pre-gzipped server bundle (~260 KB) instead of 7 simultaneous requests
    const bundle = await safeFetchJson<CoreCatalogBundle>('/api/catalogs/core', 2);
    if (bundle && bundle.starsBright && bundle.dsosBright && bundle.constellations) {
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
      return;
    }

    // Fallback for static-only hosts (e.g., GitHub Pages): load relative to BASE_URL
    const starsRaw = await safeFetchJson<BrightStarTuple[]>(`${DATA_BASE}/stars-bright.json`, 1);
    const dsosRaw = await safeFetchJson<DsoTuple[]>(`${DATA_BASE}/dsos-bright.json`, 1);
    const consRaw = await safeFetchJson<Constellation[]>(`${DATA_BASE}/constellations.json`, 1);
    const mwRaw = await safeFetchJson<MilkyWayLayer[]>(`${DATA_BASE}/milkyway.json`, 1);
    const nebRaw = await safeFetchJson<NebulaContour[]>(`${DATA_BASE}/nebula-contours.json`, 1);
    const darkRaw = await safeFetchJson<DsoTuple[]>(`${DATA_BASE}/dark-nebulae.json`, 1);
    const bndRaw = await safeFetchJson<[number, number][][]>(`${DATA_BASE}/constellation-boundaries.json`, 1);

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

export function getCatalogSnapshot(): CatalogSnapshot {
  return {
    ...cache,
  };
}

export const GAIA_LIVE_MAX_FSZ = 5.5;

/**
 * React hook providing reactive LoD access to:
 * - 118,216 Hipparcos stars (up to 13.78m) via 36 spatial tiles
 * - Live ESA Gaia DR3 stars (8.3m–15.8m) when zoomed into eyepiece/finder FOV (<= 5.5°)
 * - 8,260 Washington Double Star (WDS) visual double & multiple systems
 * - 12,344 OpenNGC/Messier/IC DSOs + 391 Barnard/LDN Dark Nebulae
 * - 513 FChart3 multi-level Nebula Contours + 782 IAU Constellation Boundaries
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
    ensureCoreCatalogs().then(() => {
      if (mounted) setTick((t) => t + 1);
    });
    return () => {
      mounted = false;
      catalogListeners.delete(onUpdate);
    };
  }, []);

  // Lazy-load deep stars (mag 6.0-8.5, ~36k stars) AFTER core bundle completes
  useEffect(() => {
    if (!cache.coreLoaded) return;
    const magLimit = getLimitingMagnitude(fsz, magOffset);
    if ((magLimit > 5.8 || fsz <= 50) && !cache.deepStarsLoaded) {
      let mounted = true;
      ensureDeepStars().then(() => {
        if (mounted) setTick((t) => t + 1);
      });
      return () => {
        mounted = false;
      };
    }
  }, [fsz, magOffset, tick]);

  // Lazy-load spatial Hipparcos sky tiles (mag 8.5-13.78, ~76.8k stars) in gentle debounced batches
  useEffect(() => {
    if (!cache.coreLoaded) return;
    const magLimit = getLimitingMagnitude(fsz, magOffset);
    if (magLimit <= 8.3 && fsz > 28) return;

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
    }, 140);
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

  // Live ESA Gaia DR3 faint star streaming ONLY at narrow eyepiece/finder FOV (<= 5.5°)
  // Uses debounce + stale-response ignore (never aborts in-flight HTTP requests mid-stream)
  useEffect(() => {
    const magLimit = getLimitingMagnitude(fsz, magOffset);
    if (!enableGaiaLive || fsz > GAIA_LIVE_MAX_FSZ || magLimit <= 9.0) {
      setGaiaLoading(false);
      return;
    }

    const raDeg = ((raHours * 15) % 360 + 360) % 360;
    // Cover entire rectangular screen diagonal (half-diagonal ~ 0.85 * fsz for 16:9) + pan buffer
    const radius = Math.max(0.55, Math.min(5.5, fsz * 0.98));
    const step = radius <= 1.2 ? 0.25 : 0.5;
    const qRa = ((Math.round(raDeg / step) * step) % 360 + 360) % 360;
    const qDec = Math.max(-90, Math.min(90, Math.round(decDeg / step) * step));
    const qRad = Math.ceil(radius * 4) / 4;
    const qMag = Math.ceil(Math.min(15.6, magLimit) * 2) / 2;
    const patchKey = `${qRa.toFixed(2)}_${qDec.toFixed(2)}_${qRad.toFixed(2)}_${qMag.toFixed(1)}`;

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
          radius: qRad.toFixed(2),
          magLimit: qMag.toFixed(2),
        });
        const json = await safeFetchJson<{
          stars?: GaiaStarTuple[];
          centerRa?: number;
          centerDec?: number;
          radius?: number;
          degraded?: boolean;
        }>(`/api/gaia?${params.toString()}`, 1);
        if (!json) return;
        const parsed = (json.stars ?? []).map(mapGaiaStar);
        const patch: GaiaPatchMeta = {
          centerRa: json.centerRa ?? qRa,
          centerDec: json.centerDec ?? qDec,
          radius: json.radius ?? qRad,
        };
        if (!json.degraded) {
          if (gaiaPatchCache.size > 40) {
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
    }, 360);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [raHours, decDeg, fsz, magOffset, enableGaiaLive]);

  return {
    brightStars: cache.brightStars,
    deepStars: cache.deepStars,
    ultraStarTiles: cache.ultraStarTiles,
    gaiaStars,
    gaiaPatch,
    gaiaLoading,
    doubleStars: cache.doubleStars,
    dsosBright: cache.dsosBright,
    dsosDeep: cache.dsosDeep,
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
