import {
  ChallengeBadgeRule,
  ChallengeCheckpoint,
  ChallengeGuidePolygon,
  ChallengeTrack,
} from '../types/astronomy';

export const CHALLENGES_STORAGE_KEY = 'noxchart_challenges_v1';

interface ChallengeFilePayload {
  format: 'noxchart-challenges';
  version: 1;
  exportedAt: string;
  tracks: ChallengeTrack[];
}

export function exportChallengesToJson(tracks: ChallengeTrack[]): string {
  const payload: ChallengeFilePayload = {
    format: 'noxchart-challenges',
    version: 1,
    exportedAt: new Date().toISOString(),
    tracks,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadChallengesFile(
  tracks: ChallengeTrack[],
  filename?: string
): void {
  const today = new Date().toISOString().slice(0, 10);
  const finalName = filename || `noxchart-challenges-${today}.json`;
  const json = exportChallengesToJson(tracks);
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

function sanitizeCheckpoint(raw: unknown, index: number): ChallengeCheckpoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : '';
  const catalogId =
    typeof r.catalogId === 'string' && r.catalogId.trim()
      ? r.catalogId.trim()
      : undefined;
  if (!name && !catalogId) return null;

  const kindRaw = r.kind;
  const kind: ChallengeCheckpoint['kind'] =
    kindRaw === 'star' || kindRaw === 'double' || kindRaw === 'planet' ? kindRaw : 'dso';

  const ra = typeof r.ra === 'number' && Number.isFinite(r.ra) ? ((r.ra % 360) + 360) % 360 : undefined;
  const dec =
    typeof r.dec === 'number' && Number.isFinite(r.dec)
      ? Math.max(-90, Math.min(90, r.dec))
      : undefined;
  const mag = typeof r.mag === 'number' && Number.isFinite(r.mag) ? r.mag : undefined;

  return {
    id:
      typeof r.id === 'string' && r.id.trim()
        ? r.id.trim()
        : `cp_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    code:
      typeof r.code === 'string' && r.code.trim()
        ? r.code.trim()
        : `CP ${String(index + 1).padStart(2, '0')}`,
    name: name || catalogId || `체크포인트 ${index + 1}`,
    catalogId,
    kind,
    stage:
      typeof r.stage === 'string' && r.stage.trim() ? r.stage.trim() : '1구간 · 기본 코스',
    constellation:
      typeof r.constellation === 'string' && r.constellation.trim()
        ? r.constellation.trim()
        : undefined,
    objectType:
      typeof r.objectType === 'string' && r.objectType.trim()
        ? r.objectType.trim()
        : undefined,
    mag,
    ra,
    dec,
    guideNote:
      typeof r.guideNote === 'string' && r.guideNote.trim() ? r.guideNote.trim() : undefined,
    observed: Boolean(r.observed),
    observedAt:
      typeof r.observedAt === 'number' && Number.isFinite(r.observedAt)
        ? r.observedAt
        : undefined,
    logNote:
      typeof r.logNote === 'string' && r.logNote.trim() ? r.logNote.trim() : undefined,
  };
}

function sanitizeGuidePolygons(raw: unknown): ChallengeGuidePolygon[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ChallengeGuidePolygon[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (!Array.isArray(r.points)) continue;
    const pts = r.points
      .map((p) => {
        if (!p || typeof p !== 'object') return null;
        const pr = p as Record<string, unknown>;
        const ra = Number(pr.ra);
        const dec = Number(pr.dec);
        if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null;
        return {
          name: typeof pr.name === 'string' ? pr.name : '',
          ra: ((ra % 360) + 360) % 360,
          dec: Math.max(-90, Math.min(90, dec)),
        };
      })
      .filter(Boolean) as { name: string; ra: number; dec: number }[];
    if (pts.length < 2) continue;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : `poly_${i}`,
      label: typeof r.label === 'string' ? r.label : '',
      closed: Boolean(r.closed),
      points: pts,
      color: typeof r.color === 'string' ? r.color : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

function sanitizeBadges(raw: unknown): ChallengeBadgeRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ChallengeBadgeRule[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.title !== 'string' || !r.title.trim()) continue;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : `badge_${i}`,
      title: r.title.trim(),
      description: typeof r.description === 'string' ? r.description : '',
      requiredCheckpointIds: Array.isArray(r.requiredCheckpointIds)
        ? r.requiredCheckpointIds.filter((x): x is string => typeof x === 'string')
        : [],
      isMaster: Boolean(r.isMaster),
    });
  }
  return out.length > 0 ? out : undefined;
}

export function parseChallengesFromJson(text: string): {
  tracks: ChallengeTrack[];
  error?: string;
} {
  try {
    const raw = JSON.parse(text) as unknown;
    let rawTracks: unknown[] | null = null;
    if (Array.isArray(raw)) {
      rawTracks = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.tracks)) {
        rawTracks = obj.tracks;
      } else if (Array.isArray(obj.checkpoints) && typeof obj.title === 'string') {
        rawTracks = [obj];
      }
    }

    if (!rawTracks) {
      return { tracks: [], error: '유효한 챌린지 파일(.json) 형식이 아닙니다.' };
    }

    const parsed: ChallengeTrack[] = [];
    const now = Date.now();
    for (let i = 0; i < rawTracks.length; i++) {
      const item = rawTracks[i];
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const title = typeof r.title === 'string' ? r.title.trim() : '';
      if (!title || !Array.isArray(r.checkpoints)) continue;

      const checkpoints = r.checkpoints
        .map((cp, idx) => sanitizeCheckpoint(cp, idx))
        .filter((cp): cp is ChallengeCheckpoint => cp !== null);
      if (checkpoints.length === 0) continue;

      const seasonRaw = r.season;
      const season: ChallengeTrack['season'] =
        seasonRaw === 'spring' ||
        seasonRaw === 'summer' ||
        seasonRaw === 'autumn' ||
        seasonRaw === 'winter' ||
        seasonRaw === 'all'
          ? seasonRaw
          : 'all';

      parsed.push({
        id:
          typeof r.id === 'string' && r.id.trim()
            ? r.id.trim()
            : `track_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        subtitle:
          typeof r.subtitle === 'string' && r.subtitle.trim()
            ? r.subtitle.trim()
            : undefined,
        description:
          typeof r.description === 'string' ? r.description.trim() : '',
        season,
        lineColor:
          typeof r.lineColor === 'string' && r.lineColor.trim()
            ? r.lineColor.trim()
            : '#38BDF8',
        completedColor:
          typeof r.completedColor === 'string' && r.completedColor.trim()
            ? r.completedColor.trim()
            : '#FBBF24',
        activeOnChart: Boolean(r.activeOnChart),
        builtIn: Boolean(r.builtIn),
        guidePolygons: sanitizeGuidePolygons(r.guidePolygons),
        badges: sanitizeBadges(r.badges),
        checkpoints,
        createdAt:
          typeof r.createdAt === 'number' && Number.isFinite(r.createdAt)
            ? r.createdAt
            : now + i,
      });
    }

    if (parsed.length === 0) {
      return {
        tracks: [],
        error: '파일에서 불러올 수 있는 유효한 챌린지 트랙이 없습니다.',
      };
    }

    return { tracks: parsed };
  } catch {
    return {
      tracks: [],
      error: 'JSON 파일을 읽을 수 없습니다. 파일 형식을 확인해 주세요.',
    };
  }
}

export function mergeChallengeTracks(
  existing: ChallengeTrack[],
  incoming: ChallengeTrack[]
): { merged: ChallengeTrack[]; addedCount: number; updatedCount: number } {
  const next = [...existing];
  let addedCount = 0;
  let updatedCount = 0;

  for (const track of incoming) {
    const idx = next.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        ...track,
        activeOnChart: next[idx].activeOnChart || track.activeOnChart,
      };
      updatedCount++;
    } else {
      next.push(track);
      addedCount++;
    }
  }

  return { merged: next, addedCount, updatedCount };
}

export function evaluateTrackBadges(track: ChallengeTrack): {
  badge: ChallengeBadgeRule;
  unlocked: boolean;
  done: number;
  total: number;
}[] {
  const badges = track.badges ?? [];
  const cpById = new Map(track.checkpoints.map((c) => [c.id, c]));
  const totalAll = track.checkpoints.length;
  const doneAll = track.checkpoints.filter((c) => c.observed).length;

  return badges.map((badge) => {
    if (badge.isMaster || badge.requiredCheckpointIds.length === 0) {
      return {
        badge,
        unlocked: totalAll > 0 && doneAll === totalAll,
        done: doneAll,
        total: totalAll,
      };
    }
    const reqs = badge.requiredCheckpointIds
      .map((id) => cpById.get(id))
      .filter((c): c is ChallengeCheckpoint => Boolean(c));
    const done = reqs.filter((c) => c.observed).length;
    return {
      badge,
      unlocked: reqs.length > 0 && done === reqs.length,
      done,
      total: reqs.length,
    };
  });
}
