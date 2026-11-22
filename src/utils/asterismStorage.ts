import {
  AsterismLabelAnchor,
  AsterismLayer,
  AsterismLineStyle,
  AsterismObject,
  AsterismSettings,
  AsterismStoreState,
  AsterismVertex,
} from '../types/astronomy';

export const ASTERISM_STORAGE_KEY = 'noxchart_asterisms_v1';

export const ASTERISM_COLOR_SWATCHES = [
  { hex: '#38BDF8', label: '시안' },
  { hex: '#FBBF24', label: '앰버' },
  { hex: '#34D399', label: '에메랄드' },
  { hex: '#F472B6', label: '로즈' },
  { hex: '#A78BFA', label: '바이올렛' },
  { hex: '#FB923C', label: '오렌지' },
];

export const DEFAULT_ASTERISM_SETTINGS: AsterismSettings = {
  snapEnabled: true,
  snapRadiusPx: 18,
  snapMaxMag: 10.0,
  allowFreeSpace: true,
  defaultLineStyle: 'dashed',
  defaultSmooth: false,
  defaultColor: '#38BDF8',
  defaultLineWidth: 1.4,
  defaultOpacity: 0.9,
  defaultFillAlpha: 0.08,
  defaultExtensionFactor: 1,
  defaultVisibleFovRange: [0.05, 45],
  defaultLabelAnchor: 'top',
};

export const DEFAULT_ASTERISM_LAYERS: AsterismLayer[] = [
  { id: 'ast_layer_finder', name: '파인더 호핑용', visible: true, createdAt: 1 },
  { id: 'ast_layer_cluster', name: '산개성단 내부 체인', visible: true, createdAt: 2 },
  { id: 'ast_layer_personal', name: '대상별 개인 성군', visible: true, createdAt: 3 },
];

export function createBuiltInPresetAsterisms(): AsterismObject[] {
  const now = Date.now();
  return [
    {
      id: 'preset_umi_engagement_ring',
      layerId: 'ast_layer_personal',
      type: 'polyline',
      smooth: true,
      lineStyle: 'dashed',
      color: '#FBBF24',
      lineWidth: 1.4,
      opacity: 0.9,
      visibleFovRange: [0.2, 15],
      label: '약혼반지 (Engagement Ring)',
      memo: '북극성(Polaris)을 다이아몬드로 삼는 작은 반지 성군',
      eyepieceTag: '30mm 82° · 저배율',
      labelAnchor: 'top',
      createdAt: now - 3000,
      vertices: [
        { raDeg: 37.9545, decDeg: 89.2641, catalogId: 'HIP 11767', starName: 'Polaris', mag: 1.97 },
        { raDeg: 23.4613, decDeg: 89.0156, catalogId: 'HIP 7283', starName: 'HIP 7283', mag: 6.46 },
        { raDeg: 28.4486, decDeg: 88.5516, catalogId: 'HIP 8846', starName: 'HIP 8846', mag: 7.86 },
        { raDeg: 47.5, decDeg: 88.62, starName: '반지 호' },
        { raDeg: 52.8, decDeg: 88.96, starName: '반지 호' },
        { raDeg: 37.9545, decDeg: 89.2641, catalogId: 'HIP 11767', starName: 'Polaris', mag: 1.97 },
      ],
    },
    {
      id: 'preset_m45_stream',
      layerId: 'ast_layer_cluster',
      type: 'polyline',
      smooth: true,
      lineStyle: 'dashed',
      color: '#38BDF8',
      lineWidth: 1.5,
      opacity: 0.92,
      visibleFovRange: [0.1, 8],
      label: 'M45 아틀라스~알키오네 물줄기',
      memo: '플레이아데스 주성에서 이어지는 대표 스타 체인',
      eyepieceTag: '24mm 68° · 파인더',
      labelAnchor: 'bottom',
      createdAt: now - 2000,
      vertices: [
        { raDeg: 57.2967, decDeg: 24.1367, catalogId: 'HIP 17851', starName: 'Pleione', mag: 5.05 },
        { raDeg: 57.2906, decDeg: 24.0534, catalogId: 'HIP 17847', starName: 'Atlas', mag: 3.62 },
        { raDeg: 56.8712, decDeg: 24.1051, catalogId: 'HIP 17702', starName: 'Alcyone', mag: 2.85 },
        { raDeg: 56.5816, decDeg: 23.9484, catalogId: 'HIP 17608', starName: 'Merope', mag: 4.14 },
        { raDeg: 56.2189, decDeg: 24.1133, catalogId: 'HIP 17499', starName: 'Electra', mag: 3.72 },
        { raDeg: 56.4567, decDeg: 24.3677, catalogId: 'HIP 17573', starName: 'Maia', mag: 3.87 },
        { raDeg: 56.3021, decDeg: 24.4673, catalogId: 'HIP 17531', starName: 'Taygeta', mag: 4.3 },
      ],
    },
    {
      id: 'preset_double_cluster_chain',
      layerId: 'ast_layer_cluster',
      type: 'polyline',
      smooth: false,
      lineStyle: 'dashdot',
      color: '#34D399',
      lineWidth: 1.3,
      opacity: 0.9,
      visibleFovRange: [0.05, 2.5],
      label: '이중성단 내부 별 사슬',
      memo: 'NGC 869와 NGC 884 사이를 잇는 핵심 호핑 체인',
      eyepieceTag: '11mm 82° · 고배율',
      labelAnchor: 'top',
      createdAt: now - 1000,
      vertices: [
        { raDeg: 34.7686, decDeg: 57.1355, catalogId: 'HIP 10805', starName: 'HIP 10805', mag: 6.57 },
        { raDeg: 34.8081, decDeg: 57.1692, catalogId: 'HIP 10816', starName: 'HIP 10816', mag: 6.65 },
        { raDeg: 35.481, decDeg: 57.2429, catalogId: 'HIP 11020', starName: 'HIP 11020', mag: 6.4 },
        { raDeg: 35.7229, decDeg: 57.2452, catalogId: 'HIP 11098', starName: 'HIP 11098', mag: 7.48 },
        { raDeg: 35.7518, decDeg: 57.387, catalogId: 'HIP 11115', starName: 'HIP 11115', mag: 6.99 },
      ],
    },
  ];
}

export function createDefaultAsterismState(): AsterismStoreState {
  return {
    layers: DEFAULT_ASTERISM_LAYERS.map((l) => ({ ...l })),
    activeLayerId: DEFAULT_ASTERISM_LAYERS[0].id,
    objects: [],
    settings: { ...DEFAULT_ASTERISM_SETTINGS },
  };
}

export function makeAsterismId(prefix = 'ast'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const VALID_LINE_STYLES: AsterismLineStyle[] = ['dashed', 'dashdot', 'solid'];
const VALID_ANCHORS: AsterismLabelAnchor[] = ['top', 'bottom', 'left', 'right'];
const VALID_OBJ_TYPES: AsterismObject['type'][] = ['polyline', 'polygon', 'arrow', 'label'];

export function sanitizeAsterismSettings(raw: unknown): AsterismSettings {
  const fb = DEFAULT_ASTERISM_SETTINGS;
  if (!raw || typeof raw !== 'object') return { ...fb };
  const o = raw as Record<string, unknown>;
  const rangeRaw = Array.isArray(o.defaultVisibleFovRange) ? o.defaultVisibleFovRange : null;
  const minFov = rangeRaw ? clamp(rangeRaw[0], fb.defaultVisibleFovRange[0], 0.02, 180) : fb.defaultVisibleFovRange[0];
  const maxFov = rangeRaw ? clamp(rangeRaw[1], fb.defaultVisibleFovRange[1], minFov, 180) : fb.defaultVisibleFovRange[1];
  return {
    snapEnabled: typeof o.snapEnabled === 'boolean' ? o.snapEnabled : fb.snapEnabled,
    snapRadiusPx: clamp(o.snapRadiusPx, fb.snapRadiusPx, 6, 40),
    snapMaxMag: clamp(o.snapMaxMag, fb.snapMaxMag, 3.0, 15.0),
    allowFreeSpace: typeof o.allowFreeSpace === 'boolean' ? o.allowFreeSpace : fb.allowFreeSpace,
    defaultLineStyle: VALID_LINE_STYLES.includes(o.defaultLineStyle as AsterismLineStyle)
      ? (o.defaultLineStyle as AsterismLineStyle)
      : fb.defaultLineStyle,
    defaultSmooth: typeof o.defaultSmooth === 'boolean' ? o.defaultSmooth : fb.defaultSmooth,
    defaultColor: typeof o.defaultColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.defaultColor)
      ? o.defaultColor
      : fb.defaultColor,
    defaultLineWidth: clamp(o.defaultLineWidth, fb.defaultLineWidth, 0.5, 4.0),
    defaultOpacity: clamp(o.defaultOpacity, fb.defaultOpacity, 0.1, 1.0),
    defaultFillAlpha: clamp(o.defaultFillAlpha, fb.defaultFillAlpha, 0.0, 0.45),
    defaultExtensionFactor: clamp(o.defaultExtensionFactor, fb.defaultExtensionFactor, 1, 6),
    defaultVisibleFovRange: [minFov, Math.max(minFov, maxFov)],
    defaultLabelAnchor: VALID_ANCHORS.includes(o.defaultLabelAnchor as AsterismLabelAnchor)
      ? (o.defaultLabelAnchor as AsterismLabelAnchor)
      : fb.defaultLabelAnchor,
  };
}

function sanitizeVertex(raw: unknown): AsterismVertex | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const ra = Number(v.raDeg);
  const dec = Number(v.decDeg);
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null;
  return {
    raDeg: ((ra % 360) + 360) % 360,
    decDeg: Math.max(-90, Math.min(90, dec)),
    catalogId: typeof v.catalogId === 'string' && v.catalogId.trim() ? v.catalogId.trim() : undefined,
    starName: typeof v.starName === 'string' && v.starName.trim() ? v.starName.trim() : undefined,
    mag: typeof v.mag === 'number' && Number.isFinite(v.mag) ? v.mag : undefined,
  };
}

export function sanitizeAsterismObject(
  raw: unknown,
  fallbackLayerId: string
): AsterismObject | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = VALID_OBJ_TYPES.includes(o.type as AsterismObject['type'])
    ? (o.type as AsterismObject['type'])
    : null;
  if (!type) return null;
  const rawVerts = Array.isArray(o.vertices) ? o.vertices : [];
  const vertices = rawVerts.map(sanitizeVertex).filter((x): x is AsterismVertex => x !== null);
  const minVerts = type === 'label' ? 1 : type === 'polygon' ? 3 : 2;
  if (vertices.length < minVerts) return null;

  const rangeRaw = Array.isArray(o.visibleFovRange) ? o.visibleFovRange : null;
  const minFov = rangeRaw ? clamp(rangeRaw[0], 0.05, 0.02, 180) : 0.05;
  const maxFov = rangeRaw ? clamp(rangeRaw[1], 45, minFov, 180) : 45;

  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : makeAsterismId(),
    layerId: typeof o.layerId === 'string' && o.layerId.trim() ? o.layerId.trim() : fallbackLayerId,
    type,
    vertices,
    smooth: Boolean(o.smooth),
    lineStyle: VALID_LINE_STYLES.includes(o.lineStyle as AsterismLineStyle)
      ? (o.lineStyle as AsterismLineStyle)
      : 'dashed',
    color: typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#38BDF8',
    lineWidth: clamp(o.lineWidth, 1.4, 0.5, 4.0),
    opacity: clamp(o.opacity, 0.9, 0.1, 1.0),
    fillAlpha: o.fillAlpha !== undefined ? clamp(o.fillAlpha, 0.08, 0, 0.45) : 0.08,
    extensionFactor: o.extensionFactor !== undefined ? clamp(o.extensionFactor, 1, 1, 6) : 1,
    visibleFovRange: [minFov, Math.max(minFov, maxFov)],
    label: typeof o.label === 'string' ? o.label.slice(0, 80) : '',
    memo: typeof o.memo === 'string' && o.memo.trim() ? o.memo.slice(0, 240) : undefined,
    eyepieceTag:
      typeof o.eyepieceTag === 'string' && o.eyepieceTag.trim()
        ? o.eyepieceTag.slice(0, 60)
        : undefined,
    labelAnchor: VALID_ANCHORS.includes(o.labelAnchor as AsterismLabelAnchor)
      ? (o.labelAnchor as AsterismLabelAnchor)
      : 'top',
    createdAt: typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : Date.now(),
  };
}

export function loadAsterismStateFromLocal(): AsterismStoreState {
  try {
    const raw = localStorage.getItem(ASTERISM_STORAGE_KEY);
    if (!raw) return createDefaultAsterismState();
    const parsed = JSON.parse(raw) as Partial<AsterismStoreState>;
    const rawLayers = Array.isArray(parsed.layers) ? parsed.layers : [];
    const layers: AsterismLayer[] =
      rawLayers.length > 0
        ? rawLayers.map((l, idx) => ({
            id: typeof l.id === 'string' && l.id ? l.id : `ast_layer_${idx}`,
            name: typeof l.name === 'string' && l.name.trim() ? l.name.trim() : `레이어 ${idx + 1}`,
            visible: typeof l.visible === 'boolean' ? l.visible : true,
            createdAt: typeof l.createdAt === 'number' ? l.createdAt : idx + 1,
          }))
        : DEFAULT_ASTERISM_LAYERS.map((l) => ({ ...l }));

    const activeLayerId =
      typeof parsed.activeLayerId === 'string' && layers.some((l) => l.id === parsed.activeLayerId)
        ? parsed.activeLayerId
        : layers[0].id;
    const validLayerIds = new Set(layers.map((l) => l.id));
    const rawObjs = Array.isArray(parsed.objects) ? parsed.objects : [];
    const objects = rawObjs
      .map((obj) => sanitizeAsterismObject(obj, activeLayerId))
      .filter((x): x is AsterismObject => x !== null)
      .map((obj) => (validLayerIds.has(obj.layerId) ? obj : { ...obj, layerId: activeLayerId }));

    return {
      layers,
      activeLayerId,
      objects,
      settings: sanitizeAsterismSettings(parsed.settings),
    };
  } catch {
    return createDefaultAsterismState();
  }
}

export function saveAsterismStateToLocal(state: AsterismStoreState): void {
  try {
    localStorage.setItem(ASTERISM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

export interface AsterismExportPayload {
  format: 'noxchart-asterisms';
  version: 1;
  exportedAt: string;
  layers: AsterismLayer[];
  objects: AsterismObject[];
}

export function exportAsterismsToJson(state: AsterismStoreState): string {
  const payload: AsterismExportPayload = {
    format: 'noxchart-asterisms',
    version: 1,
    exportedAt: new Date().toISOString(),
    layers: state.layers,
    objects: state.objects,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadAsterismsJson(state: AsterismStoreState): void {
  const json = exportAsterismsToJson(state);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `noxchart-asterisms-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseAsterismsFromJson(
  text: string,
  fallbackLayerId: string
): { layers: AsterismLayer[]; objects: AsterismObject[]; error?: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return { layers: [], objects: [], error: '올바른 JSON 형식이 아닙니다.' };
    }
    const obj = parsed as Record<string, unknown>;
    const rawLayers = Array.isArray(obj.layers) ? obj.layers : [];
    const layers: AsterismLayer[] = rawLayers
      .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
      .map((l, idx) => ({
        id: typeof l.id === 'string' && l.id ? l.id : makeAsterismId('layer'),
        name: typeof l.name === 'string' && l.name.trim() ? l.name.trim() : `가져온 레이어 ${idx + 1}`,
        visible: typeof l.visible === 'boolean' ? l.visible : true,
        createdAt: typeof l.createdAt === 'number' ? l.createdAt : Date.now() + idx,
      }));
    const defaultLayer = layers[0]?.id ?? fallbackLayerId;
    const rawObjs = Array.isArray(obj.objects)
      ? obj.objects
      : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];
    const objects = rawObjs
      .map((item) => sanitizeAsterismObject(item, defaultLayer))
      .filter((x): x is AsterismObject => x !== null);
    if (objects.length === 0) {
      return { layers: [], objects: [], error: '가져올 성군 벡터 데이터가 없습니다.' };
    }
    return { layers, objects };
  } catch {
    return { layers: [], objects: [], error: 'JSON 파일 파싱 중 오류가 발생했습니다.' };
  }
}

// ---------------------------------------------------------------------------
// Compact URL / QR Serialization (?ast=<base64url>)
// ---------------------------------------------------------------------------

interface CompactPayload {
  v: 1;
  l: [string, string, 0 | 1][]; // [id, name, visible]
  o: [
    string, // id
    string, // layerId
    'p' | 'g' | 'a' | 't', // polyline | polygon | arrow | label
    [number, number, string?][], // [raDeg(4dp), decDeg(4dp), catalogId?]
    string, // color hex without '#'
    number, // width
    number, // opacity
    'd' | 'c' | 's', // dashed | dashdot | solid
    0 | 1, // smooth
    number, // fillAlpha
    number, // extensionFactor
    [number, number], // fovRange
    string, // label
    string, // memo
    string, // eyepieceTag
    't' | 'b' | 'l' | 'r', // anchor
  ][];
}

const TYPE_TO_SHORT: Record<AsterismObject['type'], 'p' | 'g' | 'a' | 't'> = {
  polyline: 'p',
  polygon: 'g',
  arrow: 'a',
  label: 't',
};
const SHORT_TO_TYPE: Record<'p' | 'g' | 'a' | 't', AsterismObject['type']> = {
  p: 'polyline',
  g: 'polygon',
  a: 'arrow',
  t: 'label',
};
const STYLE_TO_SHORT: Record<AsterismLineStyle, 'd' | 'c' | 's'> = {
  dashed: 'd',
  dashdot: 'c',
  solid: 's',
};
const SHORT_TO_STYLE: Record<'d' | 'c' | 's', AsterismLineStyle> = {
  d: 'dashed',
  c: 'dashdot',
  s: 'solid',
};
const ANCHOR_TO_SHORT: Record<AsterismLabelAnchor, 't' | 'b' | 'l' | 'r'> = {
  top: 't',
  bottom: 'b',
  left: 'l',
  right: 'r',
};
const SHORT_TO_ANCHOR: Record<'t' | 'b' | 'l' | 'r', AsterismLabelAnchor> = {
  t: 'top',
  b: 'bottom',
  l: 'left',
  r: 'right',
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function encodeAsterismsToUrlParam(
  layers: AsterismLayer[],
  objects: AsterismObject[]
): string {
  const usedLayerIds = new Set(objects.map((o) => o.layerId));
  const compactLayers = layers
    .filter((l) => usedLayerIds.has(l.id))
    .map((l): [string, string, 0 | 1] => [l.id, l.name, l.visible ? 1 : 0]);
  const payload: CompactPayload = {
    v: 1,
    l: compactLayers,
    o: objects.map((obj) => [
      obj.id,
      obj.layerId,
      TYPE_TO_SHORT[obj.type],
      obj.vertices.map((v) => {
        const ra = Number(v.raDeg.toFixed(4));
        const dec = Number(v.decDeg.toFixed(4));
        return v.catalogId ? [ra, dec, v.catalogId] : [ra, dec];
      }),
      obj.color.replace(/^#/, ''),
      Number(obj.lineWidth.toFixed(2)),
      Number(obj.opacity.toFixed(2)),
      STYLE_TO_SHORT[obj.lineStyle],
      obj.smooth ? 1 : 0,
      Number((obj.fillAlpha ?? 0.08).toFixed(2)),
      Number((obj.extensionFactor ?? 1).toFixed(2)),
      [
        Number(obj.visibleFovRange[0].toFixed(2)),
        Number(obj.visibleFovRange[1].toFixed(2)),
      ],
      obj.label,
      obj.memo ?? '',
      obj.eyepieceTag ?? '',
      ANCHOR_TO_SHORT[obj.labelAnchor],
    ]),
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  return bytesToBase64Url(jsonBytes);
}

export function decodeAsterismsFromUrlParam(
  param: string,
  fallbackLayerId: string
): { layers: AsterismLayer[]; objects: AsterismObject[] } | null {
  try {
    const bytes = base64UrlToBytes(param.trim());
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CompactPayload>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.o)) return null;
    const layers: AsterismLayer[] = Array.isArray(parsed.l)
      ? parsed.l.map((tuple, idx) => ({
          id: typeof tuple[0] === 'string' && tuple[0] ? tuple[0] : makeAsterismId('sh_l'),
          name: typeof tuple[1] === 'string' && tuple[1] ? tuple[1] : `공유 레이어 ${idx + 1}`,
          visible: tuple[2] !== 0,
          createdAt: Date.now() + idx,
        }))
      : [];
    const defaultLayer = layers[0]?.id ?? fallbackLayerId;
    const objects: AsterismObject[] = [];
    for (const row of parsed.o) {
      if (!Array.isArray(row) || row.length < 13) continue;
      const type = SHORT_TO_TYPE[row[2]];
      if (!type) continue;
      const verts: AsterismVertex[] = Array.isArray(row[3])
        ? row[3]
            .filter((v) => Array.isArray(v) && v.length >= 2)
            .map((v) => ({
              raDeg: ((Number(v[0]) % 360) + 360) % 360,
              decDeg: Math.max(-90, Math.min(90, Number(v[1]))),
              catalogId: typeof v[2] === 'string' && v[2] ? v[2] : undefined,
            }))
        : [];
      const minV = type === 'label' ? 1 : type === 'polygon' ? 3 : 2;
      if (verts.length < minV) continue;
      const range = Array.isArray(row[11]) ? row[11] : [0.05, 45];
      objects.push({
        id: typeof row[0] === 'string' && row[0] ? row[0] : makeAsterismId('sh'),
        layerId: typeof row[1] === 'string' && row[1] ? row[1] : defaultLayer,
        type,
        vertices: verts,
        color: `#${String(row[4] || '38BDF8').replace(/^#/, '')}`,
        lineWidth: clamp(row[5], 1.4, 0.5, 4.0),
        opacity: clamp(row[6], 0.9, 0.1, 1.0),
        lineStyle: SHORT_TO_STYLE[row[7]] ?? 'dashed',
        smooth: row[8] === 1,
        fillAlpha: clamp(row[9], 0.08, 0, 0.45),
        extensionFactor: clamp(row[10], 1, 1, 6),
        visibleFovRange: [
          clamp(range[0], 0.05, 0.02, 180),
          clamp(range[1], 45, 0.05, 180),
        ],
        label: typeof row[12] === 'string' ? row[12] : '',
        memo: typeof row[13] === 'string' && row[13] ? row[13] : undefined,
        eyepieceTag: typeof row[14] === 'string' && row[14] ? row[14] : undefined,
        labelAnchor: SHORT_TO_ANCHOR[row[15]] ?? 'top',
        createdAt: Date.now(),
      });
    }
    return objects.length > 0 ? { layers, objects } : null;
  } catch {
    return null;
  }
}

export function buildAsterismShareUrl(
  layers: AsterismLayer[],
  objects: AsterismObject[],
  centerView?: { ra: number; dec: number; fsz: number }
): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('ast');
  if (centerView) {
    url.searchParams.set('ra', centerView.ra.toFixed(4));
    url.searchParams.set('dec', centerView.dec.toFixed(4));
    url.searchParams.set('fov', centerView.fsz.toFixed(2));
  }
  const encoded = encodeAsterismsToUrlParam(layers, objects);
  url.searchParams.set('ast', encoded);
  return url.toString();
}
