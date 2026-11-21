import { SavedObservingSite } from '../types/astronomy';

export const SAVED_SITES_STORAGE_KEY = 'noxchart_saved_sites_v1';
export const ACTIVE_SITE_STORAGE_KEY = 'noxchart_active_site_v1';

interface ObservingSitesFilePayload {
  format: 'noxchart-observing-sites';
  version: 1;
  exportedAt: string;
  sites: SavedObservingSite[];
}

export function clampLat(val: number): number {
  return Math.max(-90, Math.min(90, val));
}

export function clampLon(val: number): number {
  return Math.max(-180, Math.min(180, val));
}

export function formatCoordsShort(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

export function exportObservingSitesToJson(sites: SavedObservingSite[]): string {
  const payload: ObservingSitesFilePayload = {
    format: 'noxchart-observing-sites',
    version: 1,
    exportedAt: new Date().toISOString(),
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      lat: Number(clampLat(s.lat).toFixed(6)),
      lon: Number(clampLon(s.lon).toFixed(6)),
      note: s.note?.trim() || undefined,
      bortle:
        typeof s.bortle === 'number' && s.bortle >= 1 && s.bortle <= 9
          ? Math.round(s.bortle)
          : undefined,
      createdAt: s.createdAt || Date.now(),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadObservingSitesFile(
  sites: SavedObservingSite[],
  filename?: string
): void {
  const today = new Date().toISOString().slice(0, 10);
  const finalName = filename || `noxchart-observing-sites-${today}.json`;
  const json = exportObservingSitesToJson(sites);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedSitesResult {
  sites: SavedObservingSite[];
  error?: string;
}

export function parseObservingSitesFromJson(text: string): ParsedSitesResult {
  try {
    const raw = JSON.parse(text) as unknown;
    let rawList: unknown[] | null = null;

    if (Array.isArray(raw)) {
      rawList = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.sites)) {
        rawList = obj.sites;
      } else if (Array.isArray(obj.locations)) {
        rawList = obj.locations;
      } else if (
        typeof obj.lat === 'number' &&
        (typeof obj.lon === 'number' || typeof obj.lng === 'number')
      ) {
        rawList = [obj];
      }
    }

    if (!rawList) {
      return {
        sites: [],
        error: '유효한 관측지 파일(.json) 형식이 아닙니다.',
      };
    }

    const parsed: SavedObservingSite[] = [];
    const now = Date.now();
    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;

      const latRaw = typeof rec.lat === 'number' ? rec.lat : Number(rec.lat ?? rec.latitude);
      const lonRaw =
        typeof rec.lon === 'number'
          ? rec.lon
          : typeof rec.lng === 'number'
          ? rec.lng
          : Number(rec.lon ?? rec.lng ?? rec.longitude);

      if (!Number.isFinite(latRaw) || !Number.isFinite(lonRaw)) continue;

      const lat = Number(clampLat(latRaw).toFixed(6));
      const lon = Number(clampLon(lonRaw).toFixed(6));
      const nameRaw = typeof rec.name === 'string' ? rec.name.trim() : '';
      const name = nameRaw || `관측지 (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
      const note =
        typeof rec.note === 'string' && rec.note.trim() ? rec.note.trim() : undefined;
      const bortleNum = Number(rec.bortle);
      const bortle =
        Number.isFinite(bortleNum) && bortleNum >= 1 && bortleNum <= 9
          ? Math.round(bortleNum)
          : undefined;
      const id =
        typeof rec.id === 'string' && rec.id.trim()
          ? rec.id.trim()
          : `site_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const createdAt =
        typeof rec.createdAt === 'number' && Number.isFinite(rec.createdAt)
          ? rec.createdAt
          : now + i;

      parsed.push({ id, name, lat, lon, note, bortle, createdAt });
    }

    if (parsed.length === 0) {
      return {
        sites: [],
        error: '파일에서 불러올 수 있는 유효한 관측지 좌표가 없습니다.',
      };
    }

    return { sites: parsed };
  } catch {
    return {
      sites: [],
      error: 'JSON 파일을 읽을 수 없습니다. 파일 형식을 확인해 주세요.',
    };
  }
}

export function mergeObservingSites(
  existing: SavedObservingSite[],
  incoming: SavedObservingSite[]
): { merged: SavedObservingSite[]; addedCount: number; updatedCount: number } {
  const next = [...existing];
  let addedCount = 0;
  let updatedCount = 0;

  for (const item of incoming) {
    const idxById = next.findIndex((s) => s.id === item.id);
    const idxByCoordAndName =
      idxById >= 0
        ? idxById
        : next.findIndex(
            (s) =>
              s.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
              Math.abs(s.lat - item.lat) < 0.0005 &&
              Math.abs(s.lon - item.lon) < 0.0005
          );

    if (idxByCoordAndName >= 0) {
      next[idxByCoordAndName] = {
        ...next[idxByCoordAndName],
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        note: item.note ?? next[idxByCoordAndName].note,
        bortle: item.bortle ?? next[idxByCoordAndName].bortle,
      };
      updatedCount++;
    } else {
      next.push(item);
      addedCount++;
    }
  }

  return { merged: next, addedCount, updatedCount };
}
