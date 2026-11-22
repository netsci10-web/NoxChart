import { DeepSkyObject } from '../types/astronomy';

/**
 * Additional NGC/IC and standard catalog aliases for Messier (M1-M110) and
 * Caldwell (C1-C109) objects that have multiple NGC/IC components or non-NGC primary IDs.
 */
export const EXTRA_KNOWN_ALIASES: Record<string, string[]> = {
  M8: ['NGC 6530'],
  M16: ['IC 4703'],
  M17: ['IC 4706', 'IC 4707'],
  M24: ['NGC 6603'],
  M40: ['Winnecke 4', 'WNC 4'],
  M45: ['Mel 22', 'Melotte 22', 'Cr 42', 'NGC 1432', 'NGC 1435'],
  M51: ['NGC 5195'],
  M76: ['NGC 651'],
  M102: ['NGC 5866'],
  C9: ['Sh2-155'],
  C14: ['NGC 884'],
  C33: ['NGC 6995', 'IC 1340'],
  C41: ['Mel 25', 'Cr 50'],
  C49: ['NGC 2238', 'NGC 2239', 'NGC 2246'],
  C50: ['NGC 2239'],
  C60: ['NGC 4039'],
  C61: ['NGC 4038'],
};

/**
 * Formats catalog codes consistently for display:
 * - "NGC1952" / "NGC 0224" -> "NGC 1952" / "NGC 224"
 * - "IC4715"  / "IC 0342"  -> "IC 4715"  / "IC 342"
 * - "M 031"   / "M31"      -> "M31"
 * - "C 014"   / "C14"      -> "C14"
 */
export function formatCatalogCode(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const ngcIc = /^(NGC|IC)\s*[-_]?\s*0*(\d+[A-Z]?)$/i.exec(trimmed);
  if (ngcIc) {
    return `${ngcIc[1].toUpperCase()} ${ngcIc[2].toUpperCase()}`;
  }

  const mc = /^(M|C)\s*[-_]?\s*0*(\d+)$/i.exec(trimmed);
  if (mc) {
    return `${mc[1].toUpperCase()}${mc[2]}`;
  }

  return trimmed;
}

/**
 * Normalizes a catalog code or search token for forgiving matching:
 * strips spaces/hyphens/underscores and strips leading zeros on catalog numbers.
 * e.g. "NGC 0224" -> "ngc224", "M 031" -> "m31", "IC-342" -> "ic342", "C 05" -> "c5"
 */
export function normalizeCatalogToken(raw?: string): string {
  if (!raw) return '';
  const compact = raw.trim().toLowerCase().replace(/[\s\-_]+/g, '');
  if (!compact) return '';

  const cat = /^(ngc|ic|m|c|b|sh2|mel|melotte|cr|hip|hd|hr|wds|wnc)0*(\d+[a-z]?)$/.exec(compact);
  if (cat) {
    return `${cat[1]}${cat[2]}`;
  }
  return compact;
}

/**
 * Returns canonical extra catalog aliases (formatted) for a given Messier or Caldwell ID.
 */
export function getExtraAliasesForKnownId(id?: string, altId?: string): string[] {
  const keys = [formatCatalogCode(id), formatCatalogCode(altId)].filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const extras = EXTRA_KNOWN_ALIASES[k];
    if (!extras) continue;
    for (const alias of extras) {
      const formatted = formatCatalogCode(alias);
      const norm = normalizeCatalogToken(formatted);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        out.push(formatted);
      }
    }
  }
  return out;
}

/**
 * Returns formatted secondary catalog designations for a DSO (altId + extra known NGC/IC aliases),
 * deduplicated against the primary ID.
 */
export function getSecondaryDesignations(
  primaryId: string,
  altId?: string,
  extraKnownKey?: string
): string[] {
  const seen = new Set<string>();
  const primNorm = normalizeCatalogToken(primaryId);
  if (primNorm) seen.add(primNorm);

  const out: string[] = [];
  const pushUnique = (raw?: string) => {
    const formatted = formatCatalogCode(raw);
    const norm = normalizeCatalogToken(formatted);
    if (!formatted || !norm || seen.has(norm)) return;
    seen.add(norm);
    out.push(formatted);
  };

  pushUnique(altId);
  for (const alias of getExtraAliasesForKnownId(primaryId, extraKnownKey || altId)) {
    pushUnique(alias);
  }
  return out;
}

/**
 * Formats a celestial object's display name as "한국어명 (English Name)" whenever
 * both exist and are distinct; falls back cleanly to whichever name or ID is available.
 */
export function formatObjectDisplayName(
  koName?: string,
  name?: string,
  fallback?: string
): string {
  const ko = koName?.trim() || '';
  const en = name?.trim() || '';

  if (ko && en) {
    const koLower = ko.toLowerCase();
    const enLower = en.toLowerCase();
    if (koLower === enLower || koLower.includes(enLower)) {
      return ko;
    }
    return `${ko} (${en})`;
  }
  if (ko) return ko;
  if (en) return en;
  return fallback?.trim() || '';
}

/**
 * Extracts all searchable catalog tokens for a DSO (including NGC/IC cross-designations).
 */
export function getDsoSearchAliases(dso: DeepSkyObject, extraPrimary?: string): string[] {
  const result: string[] = [];
  const push = (v?: string) => {
    if (!v) return;
    const f = formatCatalogCode(v);
    if (f) result.push(f);
  };
  push(extraPrimary);
  push(dso.id);
  push(dso.altId);
  for (const alias of getExtraAliasesForKnownId(extraPrimary || dso.id, dso.altId || dso.id)) {
    push(alias);
  }
  return result;
}
