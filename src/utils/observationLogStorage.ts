import {
  EquipmentLockerState,
  ObservationLogEntry,
  ObservationLogStoreState,
  ObservationSeeingGrade,
  ObservedObjectStatus,
  OpticsSettings,
  SelectedItem,
} from '../types/astronomy';
import { formatCatalogCode, formatObjectDisplayName } from './catalogNames';

export const OBSERVATION_LOG_STORAGE_KEY = 'noxchart_observation_logs_v1';

export const EMPTY_OBSERVATION_LOG_STORE: ObservationLogStoreState = {
  observedMap: {},
  logs: [],
};

export const SEEING_OPTIONS: { value: ObservationSeeingGrade; label: string; short: string }[] = [
  { value: '', label: '미지정', short: '-' },
  { value: 'excellent', label: '최상 (I)', short: '최상' },
  { value: 'good', label: '좋음 (II)', short: '좋음' },
  { value: 'fair', label: '보통 (III)', short: '보통' },
  { value: 'poor', label: '나쁨 (IV~V)', short: '나쁨' },
];

export function getSeeingLabel(grade?: ObservationSeeingGrade): string {
  switch (grade) {
    case 'excellent':
      return '최상';
    case 'good':
      return '좋음';
    case 'fair':
      return '보통';
    case 'poor':
      return '나쁨';
    default:
      return '';
  }
}

export function getSelectedObjectMeta(selected: SelectedItem): {
  objectId: string;
  objectKind: 'star' | 'dso' | 'planet' | 'double';
  objectName: string;
  constellation?: string;
  raDeg: number;
  decDeg: number;
} {
  if (selected.kind === 'dso') {
    const code = formatCatalogCode(selected.data.id) || selected.data.id;
    const display = formatObjectDisplayName(selected.data.koName, selected.data.name, code);
    const objectName = display === code ? code : `${code} ${display}`;
    return {
      objectId: selected.data.id,
      objectKind: 'dso',
      objectName,
      constellation: selected.data.con,
      raDeg: selected.data.ra,
      decDeg: selected.data.dec,
    };
  }
  if (selected.kind === 'planet') {
    const objectName = formatObjectDisplayName(
      selected.data.koName,
      selected.data.name,
      selected.data.id
    );
    return {
      objectId: selected.data.id,
      objectKind: 'planet',
      objectName,
      raDeg: selected.data.ra,
      decDeg: selected.data.dec,
    };
  }
  if (selected.kind === 'double') {
    const fallback = selected.data.bayer || selected.data.disc || selected.data.id;
    const objectName = formatObjectDisplayName(selected.data.koName, selected.data.name, fallback);
    return {
      objectId: selected.data.id,
      objectKind: 'double',
      objectName,
      constellation: selected.data.con,
      raDeg: selected.data.ra,
      decDeg: selected.data.dec,
    };
  }
  const fallback = selected.data.bayer || selected.data.id;
  const objectName = formatObjectDisplayName(selected.data.koName, selected.data.name, fallback);
  return {
    objectId: selected.data.id,
    objectKind: 'star',
    objectName,
    constellation: selected.data.con,
    raDeg: selected.data.ra,
    decDeg: selected.data.dec,
  };
}

export function buildActiveEquipmentSummary(
  equipmentLocker: EquipmentLockerState,
  optics: OpticsSettings
): string {
  const activeScope = equipmentLocker.activeIds.telescope
    ? equipmentLocker.items.find(
        (i) => i.id === equipmentLocker.activeIds.telescope && i.category === 'telescope'
      )
    : undefined;
  const activeEyepiece = equipmentLocker.activeIds.eyepiece
    ? equipmentLocker.items.find(
        (i) => i.id === equipmentLocker.activeIds.eyepiece && i.category === 'eyepiece'
      )
    : undefined;
  const activeBarlow = equipmentLocker.activeIds.barlow
    ? equipmentLocker.items.find(
        (i) => i.id === equipmentLocker.activeIds.barlow && i.category === 'barlow'
      )
    : undefined;
  const activeFilter = equipmentLocker.activeIds.filter
    ? equipmentLocker.items.find(
        (i) => i.id === equipmentLocker.activeIds.filter && i.category === 'filter'
      )
    : undefined;
  const activeCamera = equipmentLocker.activeIds.camera
    ? equipmentLocker.items.find(
        (i) => i.id === equipmentLocker.activeIds.camera && i.category === 'camera'
      )
    : undefined;

  if (optics.showSensorBox && activeCamera) {
    if (activeCamera.isSmartTelescope) {
      return [activeCamera.name, activeFilter?.name].filter(Boolean).join(' + ');
    }
    return [activeScope?.name, activeBarlow?.name, activeCamera.name, activeFilter?.name]
      .filter(Boolean)
      .join(' + ');
  }

  const parts: string[] = [];
  if (activeScope) parts.push(activeScope.name);
  if (activeEyepiece) parts.push(activeEyepiece.name);
  if (activeBarlow) parts.push(activeBarlow.name);
  if (activeFilter) parts.push(activeFilter.name);
  if (parts.length === 0 && activeCamera) {
    parts.push(activeCamera.name);
  }
  if (parts.length > 0) return parts.join(' + ');

  if (optics.showSensorBox && optics.sensorEquipmentLabel && !optics.sensorEquipmentLabel.startsWith('FOV_')) {
    return optics.sensorEquipmentLabel;
  }
  if (optics.showEyepiece && optics.eyepieceLabel) {
    return `${optics.eyepieceLabel} (TFOV ${optics.eyepieceFovDeg.toFixed(2)}°)`;
  }
  return '';
}

export function formatObservationDateTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '-';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function toDateTimeLocalValue(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function fromDateTimeLocalValue(val: string, fallbackMs: number): number {
  if (!val) return fallbackMs;
  const parsed = new Date(val).getTime();
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function sanitizeSeeing(v: unknown): ObservationSeeingGrade {
  return v === 'excellent' || v === 'good' || v === 'fair' || v === 'poor' ? v : '';
}

function sanitizeKind(v: unknown): 'star' | 'dso' | 'planet' | 'double' {
  return v === 'star' || v === 'dso' || v === 'planet' || v === 'double' ? v : 'dso';
}

function sanitizeLogEntry(raw: unknown): ObservationLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : '';
  const objectId = typeof o.objectId === 'string' && o.objectId.trim() ? o.objectId.trim() : '';
  const objectName =
    typeof o.objectName === 'string' && o.objectName.trim() ? o.objectName.trim() : objectId;
  if (!id || !objectName) return null;

  const observedAt =
    typeof o.observedAt === 'number' && Number.isFinite(o.observedAt) ? o.observedAt : Date.now();
  const createdAt =
    typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : observedAt;
  const updatedAt =
    typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : createdAt;
  const raDeg = typeof o.raDeg === 'number' && Number.isFinite(o.raDeg) ? o.raDeg : 0;
  const decDeg = typeof o.decDeg === 'number' && Number.isFinite(o.decDeg) ? o.decDeg : 0;
  const rating =
    typeof o.rating === 'number' && Number.isFinite(o.rating)
      ? Math.max(0, Math.min(5, Math.round(o.rating)))
      : 0;

  return {
    id,
    objectId: objectId || `custom_${id}`,
    objectKind: sanitizeKind(o.objectKind),
    objectName,
    constellation:
      typeof o.constellation === 'string' && o.constellation.trim()
        ? o.constellation.trim()
        : undefined,
    raDeg,
    decDeg,
    observedAt,
    location: typeof o.location === 'string' ? o.location.trim().slice(0, 120) : '',
    equipment: typeof o.equipment === 'string' ? o.equipment.trim().slice(0, 180) : '',
    seeing: sanitizeSeeing(o.seeing),
    transparency: sanitizeSeeing(o.transparency),
    rating: rating > 0 ? rating : undefined,
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 2000) : '',
    createdAt,
    updatedAt,
  };
}

function sanitizeObservedStatus(raw: unknown): ObservedObjectStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const objectId = typeof o.objectId === 'string' && o.objectId.trim() ? o.objectId.trim() : '';
  if (!objectId) return null;
  return {
    objectId,
    objectKind: sanitizeKind(o.objectKind),
    objectName:
      typeof o.objectName === 'string' && o.objectName.trim() ? o.objectName.trim() : objectId,
    constellation:
      typeof o.constellation === 'string' && o.constellation.trim()
        ? o.constellation.trim()
        : undefined,
    raDeg: typeof o.raDeg === 'number' && Number.isFinite(o.raDeg) ? o.raDeg : 0,
    decDeg: typeof o.decDeg === 'number' && Number.isFinite(o.decDeg) ? o.decDeg : 0,
    observed: Boolean(o.observed),
    updatedAt:
      typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : Date.now(),
  };
}

export function loadObservationLogStore(): ObservationLogStoreState {
  try {
    const raw = localStorage.getItem(OBSERVATION_LOG_STORAGE_KEY);
    if (!raw) return { observedMap: {}, logs: [] };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return { observedMap: {}, logs: [] };

    const logs: ObservationLogEntry[] = Array.isArray(parsed.logs)
      ? parsed.logs.map(sanitizeLogEntry).filter((x): x is ObservationLogEntry => x !== null)
      : [];
    logs.sort((a, b) => b.observedAt - a.observedAt);

    const observedMap: Record<string, ObservedObjectStatus> = {};
    if (parsed.observedMap && typeof parsed.observedMap === 'object') {
      for (const [k, v] of Object.entries(parsed.observedMap as Record<string, unknown>)) {
        const clean = sanitizeObservedStatus(v);
        if (clean) observedMap[k] = clean;
      }
    }
    return { observedMap, logs };
  } catch {
    return { observedMap: {}, logs: [] };
  }
}

export function saveObservationLogStore(store: ObservationLogStoreState): void {
  try {
    localStorage.setItem(OBSERVATION_LOG_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors
  }
}

export function downloadObservationLogsJson(store: ObservationLogStoreState): void {
  const payload = {
    app: 'NoxChart',
    type: 'observation-logs',
    version: 1,
    exportedAt: new Date().toISOString(),
    observedMap: store.observedMap,
    logs: store.logs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `noxchart-observation-logs-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseObservationLogsFromJson(text: string): ObservationLogStoreState | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;

    const rawLogs = Array.isArray(parsed.logs)
      ? parsed.logs
      : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];
    const logs = rawLogs.map(sanitizeLogEntry).filter((x): x is ObservationLogEntry => x !== null);

    const observedMap: Record<string, ObservedObjectStatus> = {};
    if (parsed.observedMap && typeof parsed.observedMap === 'object') {
      for (const [k, v] of Object.entries(parsed.observedMap as Record<string, unknown>)) {
        const clean = sanitizeObservedStatus(v);
        if (clean) observedMap[k] = clean;
      }
    }
    if (logs.length === 0 && Object.keys(observedMap).length === 0) return null;
    return { observedMap, logs };
  } catch {
    return null;
  }
}

export function mergeObservationLogStores(
  base: ObservationLogStoreState,
  incoming: ObservationLogStoreState
): { merged: ObservationLogStoreState; addedLogs: number; updatedLogs: number } {
  const byId = new Map<string, ObservationLogEntry>(base.logs.map((l) => [l.id, l]));
  let addedLogs = 0;
  let updatedLogs = 0;

  for (const log of incoming.logs) {
    const existing = byId.get(log.id);
    if (!existing) {
      byId.set(log.id, log);
      addedLogs += 1;
    } else if (log.updatedAt > existing.updatedAt) {
      byId.set(log.id, log);
      updatedLogs += 1;
    }
  }

  const observedMap: Record<string, ObservedObjectStatus> = { ...base.observedMap };
  for (const [k, status] of Object.entries(incoming.observedMap)) {
    const prev = observedMap[k];
    if (!prev || status.updatedAt >= prev.updatedAt) {
      observedMap[k] = status;
    }
  }
  for (const log of incoming.logs) {
    if (!observedMap[log.objectId]) {
      observedMap[log.objectId] = {
        objectId: log.objectId,
        objectKind: log.objectKind,
        objectName: log.objectName,
        constellation: log.constellation,
        raDeg: log.raDeg,
        decDeg: log.decDeg,
        observed: true,
        updatedAt: log.updatedAt,
      };
    }
  }

  const mergedLogs = Array.from(byId.values()).sort((a, b) => b.observedAt - a.observedAt);
  return {
    merged: { observedMap, logs: mergedLogs },
    addedLogs,
    updatedLogs,
  };
}

function escapeCsvCell(val: string): string {
  const s = val.replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadObservationLogsCsv(logs: ObservationLogEntry[]): void {
  const headers = [
    '관측일시',
    '대상명',
    '카탈로그ID',
    '별자리',
    '장소',
    '사용장비',
    '시상',
    '투명도',
    '별점',
    '관측내용',
  ];
  const rows = logs.map((l) => [
    formatObservationDateTime(l.observedAt),
    l.objectName,
    l.objectId,
    l.constellation ?? '',
    l.location,
    l.equipment,
    getSeeingLabel(l.seeing),
    getSeeingLabel(l.transparency),
    l.rating ? `${l.rating}/5` : '',
    l.notes,
  ]);
  const csv =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map((c) => escapeCsvCell(String(c))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `noxchart-observation-logs-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
