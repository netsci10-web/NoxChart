import { CALDWELL_CATALOG } from '../data/caldwell';
import { CatalogSnapshot } from '../data/catalogLoader';
import {
  DeepSkyObject,
  DoubleStarSystem,
  EquipmentCategory,
  EquipmentItem,
  EquipmentLockerState,
  ObservingSessionEntry,
  SelectedItem,
  SolarSystemBody,
  Star,
} from '../types/astronomy';
import { getSolarSystemBodies } from './solarSystem';

export interface ParsedSkylistObject {
  objectIdType: number | null; // 1 = Solar System, 2 = Star/Double, 4 = DSO
  catalogNumbers: string[];
  commonName?: string;
  comment?: string;
  observed: boolean;
  dateObserved?: string;
  defaultIndex?: number;
}

export interface SkylistResolveResult {
  entries: ObservingSessionEntry[];
  matchedCount: number;
  unmatchedNames: string[];
  totalCount: number;
}

const VALID_EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'telescope',
  'eyepiece',
  'barlow',
  'filter',
  'camera',
];

const GREEK_TO_SYMBOL: Record<string, string> = {
  alpha: 'α', alf: 'α',
  beta: 'β', bet: 'β',
  gamma: 'γ', gam: 'γ',
  delta: 'δ', del: 'δ',
  epsilon: 'ε', eps: 'ε',
  zeta: 'ζ', zet: 'ζ',
  eta: 'η',
  theta: 'θ', the: 'θ', tet: 'θ',
  iota: 'ι', iot: 'ι',
  kappa: 'κ', kap: 'κ',
  lambda: 'λ', lam: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  omicron: 'ο', omi: 'ο',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ', sig: 'σ',
  tau: 'τ',
  upsilon: 'υ', ups: 'υ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω', ome: 'ω',
};

function sanitizeSkylistValue(value: string): string {
  return value.replace(/\r?\n/g, '\\n').trim();
}

function unescapeSkylistValue(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

/**
 * Format NoxChart catalog IDs into SkySafari canonical space-separated strings:
 * e.g. "M42" -> "M 42", "NGC1976" -> "NGC 1976", "IC0434" -> "IC 434", "C14" -> "C 14"
 */
export function formatSkySafariCatalogNumber(rawId: string): string {
  const trimmed = rawId.trim();
  const messier = trimmed.match(/^M\s*0*(\d+)$/i);
  if (messier) return `M ${messier[1]}`;

  const ngc = trimmed.match(/^NGC\s*0*(\d+[A-Z]?)$/i);
  if (ngc) return `NGC ${ngc[1].toUpperCase()}`;

  const ic = trimmed.match(/^IC\s*0*(\d+[A-Z]?)$/i);
  if (ic) return `IC ${ic[1].toUpperCase()}`;

  const caldwell = trimmed.match(/^(?:C|Caldwell)\s*0*(\d+)$/i);
  if (caldwell) return `C ${caldwell[1]}`;

  const barnard = trimmed.match(/^B\s*0*(\d+[A-Z]?)$/i);
  if (barnard) return `B ${barnard[1].toUpperCase()}`;

  const hip = trimmed.match(/^HIP\s*0*(\d+)$/i);
  if (hip) return `HIP ${hip[1]}`;

  const wds = trimmed.match(/^WDS\s*(.+)$/i);
  if (wds) return `WDS ${wds[1].trim()}`;

  return trimmed;
}

/**
 * Normalize catalog tokens for robust matching across SkySafari and NoxChart:
 * - "M 042" / "Messier 42" / "M42" -> "m42"
 * - "NGC 0224" / "NGC224" -> "ngc224"
 * - "IC 0434" / "IC434" -> "ic434"
 * - "Caldwell 14" / "C 14" -> "c14"
 * - "Barnard 33" / "B 33" -> "b33"
 * - "HIP 032349" -> "hip32349"
 * - "Alpha Ori" / "Alf Ori" / "α Ori" -> "αori"
 */
function normalizeCatalogToken(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) return '';

  // Normalize full catalog prefixes
  s = s.replace(/^messier\s+/, 'm ');
  s = s.replace(/^caldwell\s+/, 'c ');
  s = s.replace(/^barnard\s+/, 'b ');
  s = s.replace(/^sh\s*2[\s-]+/, 'sh2-');
  s = s.replace(/^sharpless\s+/, 'sh2-');

  // Convert Latin Greek letter names at start (e.g. "alpha ori", "alf ori", "β cyg")
  const greekMatch = s.match(/^([a-z]+)\s+([a-z]{3})\b(.*)$/);
  if (greekMatch && GREEK_TO_SYMBOL[greekMatch[1]]) {
    s = `${GREEK_TO_SYMBOL[greekMatch[1]]}${greekMatch[2]}${greekMatch[3]}`;
  }

  // Strip leading zeros on numeric catalog codes like M 031, NGC 0224, IC 0434, HIP 032349
  s = s.replace(/^(m|ngc|ic|c|b|hip|hd|hr|sao|ugc|pgc|mel|cr|ldn|lbn)\s*0+(\d+)/i, '$1$2');

  return s.replace(/[\s_-]+/g, '');
}

function normalizeNameToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’`.,()-]/g, '')
    .replace(/\s+/g, ' ');
}

function formatDateObserved(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function resolveSessionEntryItem(
  entry: ObservingSessionEntry,
  allDsos: DeepSkyObject[],
  allStars: Star[],
  doubleStars: DoubleStarSystem[],
  solarBodies: SolarSystemBody[]
): SelectedItem | null {
  if (entry.kind === 'dso') {
    const found = allDsos.find((d) => d.id === entry.id);
    if (found) return { kind: 'dso', data: found };
  } else if (entry.kind === 'planet') {
    const found = solarBodies.find((b) => b.id === entry.id);
    if (found) return { kind: 'planet', data: found };
  } else if (entry.kind === 'double') {
    const found = doubleStars.find((d) => d.id === entry.id);
    if (found) return { kind: 'double', data: found };
  } else {
    const found = allStars.find((s) => s.id === entry.id);
    if (found) return { kind: 'star', data: found };
  }
  return null;
}

/**
 * Export NoxChart's observing list into a 100% SkySafari-compatible .skylist file.
 */
export function exportObservingListToSkylist(
  sessionPlan: ObservingSessionEntry[],
  catalogs: CatalogSnapshot,
  obsTimeMs: number
): string {
  const allDsos: DeepSkyObject[] = [
    ...catalogs.dsosBright,
    ...catalogs.darkNebulae,
    ...catalogs.dsosDeep,
    ...CALDWELL_CATALOG,
  ];
  const allStars: Star[] = [
    ...catalogs.brightStars,
    ...catalogs.deepStars,
    ...catalogs.gaiaStars,
  ];
  const solarBodies = getSolarSystemBodies(obsTimeMs);

  const lines: string[] = [
    'SkySafariObservingListVersion=3.0',
    'SortedBy=Default Order',
  ];

  sessionPlan.forEach((entry, idx) => {
    const resolved = resolveSessionEntryItem(
      entry,
      allDsos,
      allStars,
      catalogs.doubleStars,
      solarBodies
    );

    lines.push('SkyObject=BeginObject');

    if (resolved) {
      if (resolved.kind === 'planet') {
        const body = resolved.data;
        lines.push('\tObjectID=1,-1,-1');
        lines.push(`\tCatalogNumber=${sanitizeSkylistValue(body.name)}`);
        lines.push(`\tCommonName=${sanitizeSkylistValue(body.name)}`);
      } else if (resolved.kind === 'dso') {
        const dso = resolved.data;
        lines.push('\tObjectID=4,-1,-1');
        lines.push(`\tCatalogNumber=${formatSkySafariCatalogNumber(dso.id)}`);
        if (dso.altId) {
          lines.push(`\tCatalogNumber=${formatSkySafariCatalogNumber(dso.altId)}`);
        }
        if (dso.name) {
          lines.push(`\tCommonName=${sanitizeSkylistValue(dso.name)}`);
        } else if (dso.koName) {
          lines.push(`\tCommonName=${sanitizeSkylistValue(dso.koName)}`);
        }
      } else if (resolved.kind === 'double') {
        const dbl = resolved.data;
        lines.push('\tObjectID=2,-1,-1');
        lines.push(`\tCatalogNumber=WDS ${dbl.wdsId}`);
        if (dbl.disc) {
          lines.push(`\tCatalogNumber=${sanitizeSkylistValue(dbl.disc)}`);
        }
        if (dbl.bayer) {
          lines.push(`\tCatalogNumber=${sanitizeSkylistValue(dbl.bayer)}`);
        }
        if (dbl.name) {
          lines.push(`\tCommonName=${sanitizeSkylistValue(dbl.name)}`);
        }
      } else {
        const star = resolved.data;
        lines.push('\tObjectID=2,-1,-1');
        if (star.hip) {
          lines.push(`\tCatalogNumber=HIP ${star.hip}`);
        } else {
          lines.push(`\tCatalogNumber=${formatSkySafariCatalogNumber(star.id)}`);
        }
        if (star.bayer) {
          lines.push(`\tCatalogNumber=${sanitizeSkylistValue(star.bayer)}`);
        }
        if (star.name) {
          lines.push(`\tCommonName=${sanitizeSkylistValue(star.name)}`);
        }
      }
    } else {
      const typeNum = entry.kind === 'planet' ? 1 : entry.kind === 'dso' ? 4 : 2;
      lines.push(`\tObjectID=${typeNum},-1,-1`);
      lines.push(`\tCatalogNumber=${formatSkySafariCatalogNumber(entry.id)}`);
    }

    if (entry.notes && entry.notes.trim()) {
      lines.push(`\tComment=${sanitizeSkylistValue(entry.notes)}`);
    }
    if (entry.observed) {
      lines.push(`\tDateObserved=${formatDateObserved(entry.addedAt || Date.now())}`);
    }
    lines.push(`\tDefaultIndex=${idx}`);
    lines.push('EndObject=SkyObject');
  });

  return `${lines.join('\n')}\n`;
}

/**
 * Parse SkySafari .skylist SkyObject blocks from raw text.
 */
export function parseSkylistObjects(text: string): ParsedSkylistObject[] {
  const lines = text.split(/\r?\n/);
  const objects: ParsedSkylistObject[] = [];
  let current: ParsedSkylistObject | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (/^SkyObject\s*=\s*BeginObject$/i.test(line)) {
      current = {
        objectIdType: null,
        catalogNumbers: [],
        observed: false,
      };
      continue;
    }

    if (/^EndObject\s*=\s*SkyObject$/i.test(line)) {
      if (current) {
        objects.push(current);
        current = null;
      }
      continue;
    }

    if (!current) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (!val) continue;

    const keyLower = key.toLowerCase();
    if (keyLower === 'objectid') {
      const firstPart = parseInt(val.split(',')[0], 10);
      if (Number.isFinite(firstPart)) {
        current.objectIdType = firstPart;
      }
    } else if (keyLower === 'catalognumber') {
      current.catalogNumbers.push(val);
    } else if (keyLower === 'commonname') {
      current.commonName = val;
    } else if (keyLower === 'comment') {
      current.comment = current.comment
        ? `${current.comment}\n${unescapeSkylistValue(val)}`
        : unescapeSkylistValue(val);
    } else if (keyLower === 'dateobserved') {
      current.dateObserved = val;
      current.observed = true;
    } else if (keyLower === 'observed') {
      current.observed = val === '1' || val.toLowerCase() === 'true';
    } else if (keyLower === 'defaultindex') {
      const idx = parseInt(val, 10);
      if (Number.isFinite(idx)) current.defaultIndex = idx;
    }
  }

  return objects;
}

/**
 * Resolve parsed SkySafari .skylist objects against NoxChart's complete catalogs
 * (Solar System, Messier, Caldwell, OpenNGC/IC/Barnard DSOs, Hipparcos Stars, WDS Doubles).
 */
export function resolveSkylistObjects(
  parsed: ParsedSkylistObject[],
  catalogs: CatalogSnapshot,
  obsTimeMs: number
): SkylistResolveResult {
  const solarBodies = getSolarSystemBodies(obsTimeMs);
  const allDsos: DeepSkyObject[] = [
    ...catalogs.dsosBright,
    ...catalogs.darkNebulae,
    ...catalogs.dsosDeep,
    ...CALDWELL_CATALOG,
  ];
  const allStars: Star[] = [
    ...catalogs.brightStars,
    ...catalogs.deepStars,
    ...catalogs.gaiaStars,
  ];

  // Build fast normalized indices
  const solarMap = new Map<string, SolarSystemBody>();
  for (const b of solarBodies) {
    const keys = [
      normalizeCatalogToken(b.id),
      normalizeCatalogToken(b.name),
      normalizeNameToken(b.name),
      normalizeNameToken(b.koName),
    ];
    // Also map asteroid bare names ("4 Vesta" -> "vesta")
    const strippedNum = b.name.replace(/^\d+\s+/, '');
    if (strippedNum !== b.name) {
      keys.push(normalizeCatalogToken(strippedNum), normalizeNameToken(strippedNum));
    }
    for (const k of keys) {
      if (k && !solarMap.has(k)) solarMap.set(k, b);
    }
  }

  const dsoCatMap = new Map<string, DeepSkyObject>();
  const dsoNameMap = new Map<string, DeepSkyObject>();
  for (const d of allDsos) {
    const idKey = normalizeCatalogToken(d.id);
    if (idKey && !dsoCatMap.has(idKey)) dsoCatMap.set(idKey, d);
    if (d.altId) {
      const altKey = normalizeCatalogToken(d.altId);
      if (altKey && !dsoCatMap.has(altKey)) dsoCatMap.set(altKey, d);
    }
    if (d.name) {
      const nKey = normalizeNameToken(d.name);
      if (nKey && !dsoNameMap.has(nKey)) dsoNameMap.set(nKey, d);
    }
    if (d.koName) {
      const kKey = normalizeNameToken(d.koName);
      if (kKey && !dsoNameMap.has(kKey)) dsoNameMap.set(kKey, d);
    }
  }

  const starCatMap = new Map<string, Star>();
  const starNameMap = new Map<string, Star>();
  for (const s of allStars) {
    if (s.hip) {
      const hKey = `hip${s.hip}`;
      if (!starCatMap.has(hKey)) starCatMap.set(hKey, s);
    }
    const idKey = normalizeCatalogToken(s.id);
    if (idKey && !starCatMap.has(idKey)) starCatMap.set(idKey, s);
    if (s.bayer) {
      const bKey = normalizeCatalogToken(s.bayer);
      if (bKey && !starCatMap.has(bKey)) starCatMap.set(bKey, s);
    }
    if (s.name) {
      const nKey = normalizeNameToken(s.name);
      if (nKey && !starNameMap.has(nKey)) starNameMap.set(nKey, s);
    }
    if (s.koName) {
      const kKey = normalizeNameToken(s.koName);
      if (kKey && !starNameMap.has(kKey)) starNameMap.set(kKey, s);
    }
  }

  const doubleCatMap = new Map<string, DoubleStarSystem>();
  const doubleNameMap = new Map<string, DoubleStarSystem>();
  for (const dbl of catalogs.doubleStars) {
    const keys = [
      normalizeCatalogToken(dbl.id),
      normalizeCatalogToken(dbl.wdsId),
      normalizeCatalogToken(`WDS ${dbl.wdsId}`),
      normalizeCatalogToken(dbl.disc),
      // Also match discoverer without component letters (e.g. "STFA 43 AB" -> "stfa43")
      normalizeCatalogToken(dbl.disc.replace(/\s+[A-Z]{1,3}$/i, '')),
    ];
    if (dbl.bayer) keys.push(normalizeCatalogToken(dbl.bayer));
    for (const k of keys) {
      if (k && !doubleCatMap.has(k)) doubleCatMap.set(k, dbl);
    }
    if (dbl.name) {
      const nKey = normalizeNameToken(dbl.name);
      if (nKey && !doubleNameMap.has(nKey)) doubleNameMap.set(nKey, dbl);
    }
    if (dbl.koName) {
      const kKey = normalizeNameToken(dbl.koName);
      if (kKey && !doubleNameMap.has(kKey)) doubleNameMap.set(kKey, dbl);
    }
  }

  const matchSolar = (obj: ParsedSkylistObject): SolarSystemBody | undefined => {
    for (const raw of [...obj.catalogNumbers, obj.commonName ?? '']) {
      if (!raw) continue;
      const found =
        solarMap.get(normalizeCatalogToken(raw)) ?? solarMap.get(normalizeNameToken(raw));
      if (found) return found;
    }
    return undefined;
  };

  const matchDso = (obj: ParsedSkylistObject): DeepSkyObject | undefined => {
    for (const raw of obj.catalogNumbers) {
      const found = dsoCatMap.get(normalizeCatalogToken(raw));
      if (found) return found;
    }
    if (obj.commonName) {
      const byCat = dsoCatMap.get(normalizeCatalogToken(obj.commonName));
      if (byCat) return byCat;
      const byName = dsoNameMap.get(normalizeNameToken(obj.commonName));
      if (byName) return byName;
    }
    for (const raw of obj.catalogNumbers) {
      const byName = dsoNameMap.get(normalizeNameToken(raw));
      if (byName) return byName;
    }
    return undefined;
  };

  const matchDouble = (obj: ParsedSkylistObject): DoubleStarSystem | undefined => {
    const explicitWds = obj.catalogNumbers.some((c) => /^\s*(?:WDS|STF|STT|STFA|H\s|ADS|BU|ES|HJ|SHJ|S\s)/i.test(c));
    for (const raw of obj.catalogNumbers) {
      const found = doubleCatMap.get(normalizeCatalogToken(raw));
      if (found && (explicitWds || /^\s*WDS/i.test(raw) || obj.objectIdType === 2)) {
        return found;
      }
    }
    if (explicitWds && obj.commonName) {
      return doubleNameMap.get(normalizeNameToken(obj.commonName));
    }
    return undefined;
  };

  const matchStar = (obj: ParsedSkylistObject): Star | undefined => {
    for (const raw of obj.catalogNumbers) {
      const found = starCatMap.get(normalizeCatalogToken(raw));
      if (found) return found;
    }
    if (obj.commonName) {
      const byCat = starCatMap.get(normalizeCatalogToken(obj.commonName));
      if (byCat) return byCat;
      const byName = starNameMap.get(normalizeNameToken(obj.commonName));
      if (byName) return byName;
    }
    return undefined;
  };

  const entries: ObservingSessionEntry[] = [];
  const seen = new Set<string>();
  const unmatchedNames: string[] = [];
  const now = Date.now();

  parsed.forEach((obj, idx) => {
    let matched: { id: string; kind: ObservingSessionEntry['kind'] } | null = null;

    if (obj.objectIdType === 1) {
      const body = matchSolar(obj);
      if (body) matched = { id: body.id, kind: 'planet' };
    } else if (obj.objectIdType === 4) {
      const dso = matchDso(obj);
      if (dso) matched = { id: dso.id, kind: 'dso' };
    } else if (obj.objectIdType === 2) {
      const explicitWds = obj.catalogNumbers.some((c) => /^\s*(?:WDS|STF|STT|STFA|ADS|BU)/i.test(c));
      if (explicitWds) {
        const dbl = matchDouble(obj);
        if (dbl) matched = { id: dbl.id, kind: 'double' };
      }
      if (!matched) {
        const star = matchStar(obj);
        if (star) matched = { id: star.id, kind: 'star' };
      }
      if (!matched) {
        const dbl = matchDouble(obj);
        if (dbl) matched = { id: dbl.id, kind: 'double' };
      }
    }

    // Cross-type fallback if ObjectID was missing or differed
    if (!matched) {
      const dso = matchDso(obj);
      if (dso) {
        matched = { id: dso.id, kind: 'dso' };
      } else {
        const body = matchSolar(obj);
        if (body) {
          matched = { id: body.id, kind: 'planet' };
        } else {
          const star = matchStar(obj);
          if (star) {
            matched = { id: star.id, kind: 'star' };
          } else {
            const dbl = matchDouble(obj);
            if (dbl) matched = { id: dbl.id, kind: 'double' };
          }
        }
      }
    }

    if (matched) {
      if (!seen.has(matched.id)) {
        seen.add(matched.id);
        entries.push({
          id: matched.id,
          kind: matched.kind,
          addedAt: now + idx,
          observed: obj.observed,
          notes: obj.comment ?? '',
        });
      }
    } else {
      const label = obj.commonName || obj.catalogNumbers[0] || `항목 #${idx + 1}`;
      unmatchedNames.push(label);
    }
  });

  return {
    entries,
    matchedCount: entries.length,
    unmatchedNames,
    totalCount: parsed.length,
  };
}

/**
 * Serialize Equipment Locker into unified .skylist format (SkySafari Key=Value block syntax).
 */
export function exportEquipmentToSkylist(locker: EquipmentLockerState): string {
  const lines: string[] = [
    'SkySafariObservingListVersion=3.0',
    'SortedBy=Default Order',
    'NoxChartFormat=EquipmentLocker-1.0',
  ];

  locker.items.forEach((item, idx) => {
    const isActive = locker.activeIds[item.category] === item.id;
    lines.push('EquipmentItem=BeginEquipment');
    lines.push(`\tCategory=${item.category}`);
    lines.push(`\tName=${sanitizeSkylistValue(item.name)}`);
    if (item.apertureMm !== undefined && Number.isFinite(item.apertureMm)) {
      lines.push(`\tApertureMm=${item.apertureMm}`);
    }
    if (item.focalLengthMm !== undefined && Number.isFinite(item.focalLengthMm)) {
      lines.push(`\tFocalLengthMm=${item.focalLengthMm}`);
    }
    if (item.opticalType) {
      lines.push(`\tOpticalType=${sanitizeSkylistValue(item.opticalType)}`);
    }
    if (item.afovDeg !== undefined && Number.isFinite(item.afovDeg)) {
      lines.push(`\tAfovDeg=${item.afovDeg}`);
    }
    if (item.factor !== undefined && Number.isFinite(item.factor)) {
      lines.push(`\tFactor=${item.factor}`);
    }
    if (item.filterType) {
      lines.push(`\tFilterType=${sanitizeSkylistValue(item.filterType)}`);
    }
    if (item.sensorWidthMm !== undefined && Number.isFinite(item.sensorWidthMm)) {
      lines.push(`\tSensorWidthMm=${item.sensorWidthMm}`);
    }
    if (item.sensorHeightMm !== undefined && Number.isFinite(item.sensorHeightMm)) {
      lines.push(`\tSensorHeightMm=${item.sensorHeightMm}`);
    }
    if (item.pixelSizeUm !== undefined && Number.isFinite(item.pixelSizeUm)) {
      lines.push(`\tPixelSizeUm=${item.pixelSizeUm}`);
    }
    if (item.note) {
      lines.push(`\tNote=${sanitizeSkylistValue(item.note)}`);
    }
    if (isActive) {
      lines.push('\tActive=1');
    }
    lines.push(`\tDefaultIndex=${idx}`);
    lines.push('EndEquipment=EquipmentItem');
  });

  return `${lines.join('\n')}\n`;
}

function makeEquipmentId(category: EquipmentCategory, idx: number): string {
  return `eq_${category}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Parse Equipment Locker items from a .skylist file.
 * Supports both NoxChart EquipmentItem blocks and SkySafari Scope/Eyepiece/Barlow/Filter/Camera tags.
 */
export function parseEquipmentFromSkylist(text: string): EquipmentLockerState {
  const lines = text.split(/\r?\n/);
  const items: EquipmentItem[] = [];
  const activeIds: Partial<Record<EquipmentCategory, string>> = {};

  let current: Partial<EquipmentItem> & { active?: boolean } | null = null;
  let seq = 0;

  // Fallback collector for SkySafari observation log equipment fields (Scope=, Eyepiece=, Barlow=, Filter=, Camera=)
  const legacySeen = new Set<string>();
  const legacyItems: EquipmentItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (/^EquipmentItem\s*=\s*BeginEquipment$/i.test(line)) {
      current = {};
      continue;
    }

    if (/^EndEquipment\s*=\s*EquipmentItem$/i.test(line)) {
      if (
        current &&
        current.category &&
        VALID_EQUIPMENT_CATEGORIES.includes(current.category) &&
        current.name
      ) {
        const id = makeEquipmentId(current.category, seq++);
        const built: EquipmentItem = {
          id,
          category: current.category,
          name: current.name,
          note: current.note,
          apertureMm: current.apertureMm,
          focalLengthMm: current.focalLengthMm,
          opticalType: current.opticalType,
          afovDeg: current.afovDeg,
          factor: current.factor,
          filterType: current.filterType,
          sensorWidthMm: current.sensorWidthMm,
          sensorHeightMm: current.sensorHeightMm,
          pixelSizeUm: current.pixelSizeUm,
        };
        items.push(built);
        if (current.active) {
          activeIds[built.category] = id;
        }
      }
      current = null;
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim().toLowerCase();
    const val = line.slice(eqIdx + 1).trim();
    if (!val) continue;

    if (current) {
      const num = parseFloat(val);
      switch (key) {
        case 'category': {
          const cat = val.toLowerCase() as EquipmentCategory;
          if (VALID_EQUIPMENT_CATEGORIES.includes(cat)) {
            current.category = cat;
          }
          break;
        }
        case 'name':
          current.name = unescapeSkylistValue(val);
          break;
        case 'aperturemm':
          if (Number.isFinite(num) && num > 0) current.apertureMm = num;
          break;
        case 'focallengthmm':
          if (Number.isFinite(num) && num > 0) current.focalLengthMm = num;
          break;
        case 'opticaltype':
          current.opticalType = unescapeSkylistValue(val);
          break;
        case 'afovdeg':
          if (Number.isFinite(num) && num > 0) current.afovDeg = num;
          break;
        case 'factor':
          if (Number.isFinite(num) && num > 0) current.factor = num;
          break;
        case 'filtertype':
          current.filterType = unescapeSkylistValue(val);
          break;
        case 'sensorwidthmm':
          if (Number.isFinite(num) && num > 0) current.sensorWidthMm = num;
          break;
        case 'sensorheightmm':
          if (Number.isFinite(num) && num > 0) current.sensorHeightMm = num;
          break;
        case 'pixelsizeum':
          if (Number.isFinite(num) && num > 0) current.pixelSizeUm = num;
          break;
        case 'note':
          current.note = unescapeSkylistValue(val);
          break;
        case 'active':
          current.active = val === '1' || val.toLowerCase() === 'true';
          break;
      }
    } else {
      // Collect SkySafari observation equipment tags if present outside EquipmentItem blocks
      const legacyMap: Record<string, EquipmentCategory> = {
        scope: 'telescope',
        telescope: 'telescope',
        eyepiece: 'eyepiece',
        barlow: 'barlow',
        reducer: 'barlow',
        filter: 'filter',
        camera: 'camera',
      };
      const mappedCat = legacyMap[key];
      if (mappedCat) {
        const cleanName = unescapeSkylistValue(val);
        const dedupKey = `${mappedCat}:${cleanName.toLowerCase()}`;
        if (!legacySeen.has(dedupKey)) {
          legacySeen.add(dedupKey);
          const item: EquipmentItem = {
            id: makeEquipmentId(mappedCat, seq++),
            category: mappedCat,
            name: cleanName,
          };
          // Best-effort numeric spec extraction from SkySafari equipment strings
          if (mappedCat === 'telescope') {
            const flMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:fl|f\.l\.)/i);
            const apMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*mm/i);
            if (apMatch) item.apertureMm = parseFloat(apMatch[1]);
            if (flMatch) item.focalLengthMm = parseFloat(flMatch[1]);
          } else if (mappedCat === 'eyepiece') {
            const flMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*mm/i);
            const afovMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*(?:°|deg)/i);
            if (flMatch) item.focalLengthMm = parseFloat(flMatch[1]);
            if (afovMatch) item.afovDeg = parseFloat(afovMatch[1]);
          } else if (mappedCat === 'barlow') {
            const facMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*[x×]/i);
            if (facMatch) item.factor = parseFloat(facMatch[1]);
          }
          legacyItems.push(item);
        }
      }
    }
  }

  return {
    items: items.length > 0 ? items : legacyItems,
    activeIds,
  };
}

/**
 * Trigger a browser download of a UTF-8 .skylist file.
 */
export function downloadSkylistFile(content: string, filename: string): void {
  const safeName = filename.toLowerCase().endsWith('.skylist')
    ? filename
    : `${filename}.skylist`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
