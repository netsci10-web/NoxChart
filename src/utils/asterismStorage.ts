import {
  AsterismGroup,
  AsterismLabelAnchor,
  AsterismLayer,
  AsterismLineStyle,
  AsterismObject,
  AsterismSavedView,
  AsterismSettings,
  AsterismStoreState,
  AsterismVertex,
} from '../types/astronomy';

export const ASTERISM_STORAGE_KEY = 'noxchart_asterisms_v1';

export const ASTERISM_COLOR_SWATCHES = [
  { hex: '#FFFFFF', label: '흰색' },
  { hex: '#EF4444', label: '빨강' },
  { hex: '#F97316', label: '주황' },
  { hex: '#22C55E', label: '녹색' },
  { hex: '#3B82F6', label: '파랑' },
  { hex: '#A855F7', label: '보라' },
];

export const DEFAULT_ASTERISM_SETTINGS: AsterismSettings = {
  snapEnabled: true,
  snapRadiusPx: 18,
  snapMaxMag: 10.0,
  allowFreeSpace: true,
  defaultLineStyle: 'dashed',
  defaultSmooth: false,
  defaultColor: '#3B82F6',
  defaultLineWidth: 1.4,
  defaultOpacity: 0.9,
  defaultTextOpacity: 0.95,
  defaultTextSize: 11,
  defaultFillAlpha: 0.12,
  defaultCircleFillEnabled: false,
  circleLinkEyepiece: false,
  circleLinkFinder: false,
  defaultExtensionFactor: 1,
  defaultVisibleFovRange: [0.05, 45],
  defaultLabelAnchor: 'top',
};

export const DEFAULT_ASTERISM_LAYERS: AsterismLayer[] = [
  { id: 'ast_layer_finder', name: '파인더 호핑용', visible: true, createdAt: 1 },
  { id: 'ast_layer_cluster', name: '산개성단 내부 체인', visible: true, createdAt: 2 },
  { id: 'ast_layer_personal', name: '대상별 개인 성군', visible: true, createdAt: 3 },
];

export interface BuiltInAsterismPreset {
  asterism: AsterismGroup;
  objects: AsterismObject[];
}

export function createBuiltInPresetAsterismBundles(): BuiltInAsterismPreset[] {
  const now = Date.now();
  return [
    {
      asterism: {
        id: 'preset_grp_umi_engagement_ring',
        layerId: 'ast_layer_personal',
        name: '약혼반지 (Engagement Ring)',
        visible: true,
        memo: '북극성(Polaris)을 다이아몬드로 삼는 작은 반지 성군',
        eyepieceTag: '30mm 82° · 저배율',
        visibleFovRange: [0.2, 15],
        createdAt: now - 3000,
      },
      objects: [
        {
          id: 'preset_umi_engagement_ring',
          layerId: 'ast_layer_personal',
          asterismId: 'preset_grp_umi_engagement_ring',
          type: 'polyline',
          smooth: true,
          lineStyle: 'dashed',
          color: '#FBBF24',
          lineWidth: 1.4,
          opacity: 0.9,
          visibleFovRange: [0.2, 15],
          label: '원호 1',
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
      ],
    },
    {
      asterism: {
        id: 'preset_grp_m45_stream',
        layerId: 'ast_layer_cluster',
        name: 'M45 아틀라스~알키오네 물줄기',
        visible: true,
        memo: '플레이아데스 주성에서 이어지는 대표 스타 체인',
        eyepieceTag: '24mm 68° · 파인더',
        visibleFovRange: [0.1, 8],
        createdAt: now - 2000,
      },
      objects: [
        {
          id: 'preset_m45_stream',
          layerId: 'ast_layer_cluster',
          asterismId: 'preset_grp_m45_stream',
          type: 'polyline',
          smooth: true,
          lineStyle: 'dashed',
          color: '#38BDF8',
          lineWidth: 1.5,
          opacity: 0.92,
          visibleFovRange: [0.1, 8],
          label: '원호 1',
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
      ],
    },
    {
      asterism: {
        id: 'preset_grp_double_cluster_chain',
        layerId: 'ast_layer_cluster',
        name: '이중성단 내부 별 사슬',
        visible: true,
        memo: 'NGC 869와 NGC 884 사이를 잇는 핵심 호핑 체인',
        eyepieceTag: '11mm 82° · 고배율',
        visibleFovRange: [0.05, 2.5],
        createdAt: now - 1000,
      },
      objects: [
        {
          id: 'preset_double_cluster_chain',
          layerId: 'ast_layer_cluster',
          asterismId: 'preset_grp_double_cluster_chain',
          type: 'polyline',
          smooth: false,
          lineStyle: 'dashdot',
          color: '#34D399',
          lineWidth: 1.3,
          opacity: 0.9,
          visibleFovRange: [0.05, 2.5],
          label: '선 1',
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
      ],
    },
  ];
}

export function createDefaultAsterismState(): AsterismStoreState {
  return {
    layers: DEFAULT_ASTERISM_LAYERS.map((l) => ({ ...l })),
    activeLayerId: DEFAULT_ASTERISM_LAYERS[0].id,
    asterisms: [],
    activeAsterismId: null,
    objects: [],
    settings: { ...DEFAULT_ASTERISM_SETTINGS },
  };
}

export function makeAsterismId(prefix = 'ast'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Generate an auto-incrementing default name for a new shape element
 * (e.g., "선 1", "원호 2", "다각형 3", "원 4", "화살표 5", "텍스트 6").
 */
export function getNextShapeName(
  type: AsterismObject['type'],
  smooth: boolean,
  existingObjects: AsterismObject[],
  asterismId?: string
): string {
  const prefix =
    type === 'polyline'
      ? smooth
        ? '원호'
        : '선'
      : type === 'polygon'
      ? '다각형'
      : type === 'circle'
      ? '원'
      : type === 'arrow'
      ? '화살표'
      : '텍스트';

  const scope = asterismId
    ? existingObjects.filter((o) => o.asterismId === asterismId)
    : existingObjects;

  let maxNum = 0;
  for (const obj of scope) {
    const m = obj.label.trim().match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  const nextNum = Math.max(maxNum + 1, scope.length + 1);
  return `${prefix} ${nextNum}`;
}

export function getNextAsterismGroupName(existingAsterisms: AsterismGroup[]): string {
  let maxNum = 0;
  for (const grp of existingAsterisms) {
    const m = grp.name.trim().match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `새 성군 ${Math.max(maxNum + 1, existingAsterisms.length + 1)}`;
}

function clamp(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const VALID_LINE_STYLES: AsterismLineStyle[] = ['dashed', 'dashdot', 'solid'];
const VALID_ANCHORS: AsterismLabelAnchor[] = ['top', 'bottom', 'left', 'right'];
const VALID_OBJ_TYPES: AsterismObject['type'][] = [
  'polyline',
  'polygon',
  'circle',
  'arrow',
  'label',
];

export function sanitizeAsterismSettings(raw: unknown): AsterismSettings {
  const fb = DEFAULT_ASTERISM_SETTINGS;
  if (!raw || typeof raw !== 'object') return { ...fb };
  const o = raw as Record<string, unknown>;
  const rangeRaw = Array.isArray(o.defaultVisibleFovRange) ? o.defaultVisibleFovRange : null;
  const minFov = rangeRaw
    ? clamp(rangeRaw[0], fb.defaultVisibleFovRange[0], 0.02, 180)
    : fb.defaultVisibleFovRange[0];
  const maxFov = rangeRaw
    ? clamp(rangeRaw[1], fb.defaultVisibleFovRange[1], minFov, 180)
    : fb.defaultVisibleFovRange[1];
  return {
    snapEnabled: typeof o.snapEnabled === 'boolean' ? o.snapEnabled : fb.snapEnabled,
    snapRadiusPx: clamp(o.snapRadiusPx, fb.snapRadiusPx, 6, 40),
    snapMaxMag: clamp(o.snapMaxMag, fb.snapMaxMag, 3.0, 15.0),
    allowFreeSpace: typeof o.allowFreeSpace === 'boolean' ? o.allowFreeSpace : fb.allowFreeSpace,
    defaultLineStyle: VALID_LINE_STYLES.includes(o.defaultLineStyle as AsterismLineStyle)
      ? (o.defaultLineStyle as AsterismLineStyle)
      : fb.defaultLineStyle,
    defaultSmooth: typeof o.defaultSmooth === 'boolean' ? o.defaultSmooth : fb.defaultSmooth,
    defaultColor:
      typeof o.defaultColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.defaultColor)
        ? o.defaultColor
        : fb.defaultColor,
    defaultLineWidth: clamp(o.defaultLineWidth, fb.defaultLineWidth, 0.5, 10.0),
    defaultOpacity: clamp(o.defaultOpacity, fb.defaultOpacity, 0.1, 1.0),
    defaultTextOpacity: clamp(o.defaultTextOpacity, fb.defaultTextOpacity, 0.1, 1.0),
    defaultTextSize: Math.round(clamp(o.defaultTextSize, fb.defaultTextSize, 8, 32)),
    defaultFillAlpha: clamp(o.defaultFillAlpha, fb.defaultFillAlpha, 0.0, 0.45),
    defaultCircleFillEnabled:
      typeof o.defaultCircleFillEnabled === 'boolean'
        ? o.defaultCircleFillEnabled
        : fb.defaultCircleFillEnabled,
    circleLinkEyepiece:
      typeof o.circleLinkEyepiece === 'boolean' ? o.circleLinkEyepiece : fb.circleLinkEyepiece,
    circleLinkFinder:
      typeof o.circleLinkFinder === 'boolean' ? o.circleLinkFinder : fb.circleLinkFinder,
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

function sanitizeSavedView(raw: unknown): AsterismSavedView | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  const raDeg = Number(v.raDeg);
  const decDeg = Number(v.decDeg);
  const fsz = Number(v.fsz);
  if (!Number.isFinite(raDeg) || !Number.isFinite(decDeg) || !Number.isFinite(fsz)) {
    return undefined;
  }
  return {
    raDeg: ((raDeg % 360) + 360) % 360,
    decDeg: Math.max(-90, Math.min(90, decDeg)),
    fsz: Math.max(0.05, Math.min(180, fsz)),
  };
}

export function sanitizeAsterismGroup(
  raw: unknown,
  fallbackLayerId: string,
  index = 0
): AsterismGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const rangeRaw = Array.isArray(g.visibleFovRange) ? g.visibleFovRange : null;
  const minFov = rangeRaw ? clamp(rangeRaw[0], 0.05, 0.02, 180) : 0.05;
  const maxFov = rangeRaw ? clamp(rangeRaw[1], 45, minFov, 180) : 45;
  return {
    id: typeof g.id === 'string' && g.id.trim() ? g.id.trim() : makeAsterismId('grp'),
    layerId:
      typeof g.layerId === 'string' && g.layerId.trim() ? g.layerId.trim() : fallbackLayerId,
    name:
      typeof g.name === 'string' && g.name.trim()
        ? g.name.trim().slice(0, 80)
        : `성군 ${index + 1}`,
    visible: typeof g.visible === 'boolean' ? g.visible : true,
    memo: typeof g.memo === 'string' && g.memo.trim() ? g.memo.slice(0, 600) : undefined,
    eyepieceTag:
      typeof g.eyepieceTag === 'string' && g.eyepieceTag.trim()
        ? g.eyepieceTag.slice(0, 120)
        : undefined,
    visibleFovRange: [minFov, Math.max(minFov, maxFov)],
    savedView: sanitizeSavedView(g.savedView),
    createdAt:
      typeof g.createdAt === 'number' && Number.isFinite(g.createdAt) ? g.createdAt : Date.now(),
  };
}

export function sanitizeAsterismObject(
  raw: unknown,
  fallbackLayerId: string,
  fallbackAsterismId = ''
): AsterismObject | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = VALID_OBJ_TYPES.includes(o.type as AsterismObject['type'])
    ? (o.type as AsterismObject['type'])
    : null;
  if (!type) return null;
  const rawVerts = Array.isArray(o.vertices) ? o.vertices : [];
  const vertices = rawVerts.map(sanitizeVertex).filter((x): x is AsterismVertex => x !== null);
  const minVerts = type === 'label' || type === 'circle' ? 1 : type === 'polygon' ? 3 : 2;
  if (vertices.length < minVerts) return null;

  const rangeRaw = Array.isArray(o.visibleFovRange) ? o.visibleFovRange : null;
  const minFov = rangeRaw ? clamp(rangeRaw[0], 0.05, 0.02, 180) : 0.05;
  const maxFov = rangeRaw ? clamp(rangeRaw[1], 45, minFov, 180) : 45;
  const radiusDeg =
    type === 'circle' ? clamp(o.radiusDeg, 0.5, 0.01, 90) : undefined;

  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : makeAsterismId('shp'),
    layerId:
      typeof o.layerId === 'string' && o.layerId.trim() ? o.layerId.trim() : fallbackLayerId,
    asterismId:
      typeof o.asterismId === 'string' && o.asterismId.trim()
        ? o.asterismId.trim()
        : fallbackAsterismId,
    type,
    vertices,
    radiusDeg,
    smooth: Boolean(o.smooth),
    lineStyle: VALID_LINE_STYLES.includes(o.lineStyle as AsterismLineStyle)
      ? (o.lineStyle as AsterismLineStyle)
      : 'dashed',
    color:
      typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#38BDF8',
    lineWidth: clamp(o.lineWidth, 1.4, 0.5, 10.0),
    opacity: clamp(o.opacity, 0.9, 0.1, 1.0),
    textOpacity:
      o.textOpacity !== undefined ? clamp(o.textOpacity, 0.95, 0.1, 1.0) : undefined,
    textSize:
      o.textSize !== undefined ? Math.round(clamp(o.textSize, 11, 8, 32)) : undefined,
    fillAlpha:
      o.fillAlpha !== undefined
        ? clamp(o.fillAlpha, type === 'polygon' ? 0.08 : 0, 0, 0.45)
        : type === 'polygon'
        ? 0.08
        : 0,
    extensionFactor: o.extensionFactor !== undefined ? clamp(o.extensionFactor, 1, 1, 6) : 1,
    visibleFovRange: [minFov, Math.max(minFov, maxFov)],
    label: typeof o.label === 'string' ? o.label.slice(0, 80) : '',
    memo: typeof o.memo === 'string' && o.memo.trim() ? o.memo.slice(0, 600) : undefined,
    eyepieceTag:
      typeof o.eyepieceTag === 'string' && o.eyepieceTag.trim()
        ? o.eyepieceTag.slice(0, 120)
        : undefined,
    labelAnchor: VALID_ANCHORS.includes(o.labelAnchor as AsterismLabelAnchor)
      ? (o.labelAnchor as AsterismLabelAnchor)
      : 'top',
    createdAt:
      typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : Date.now(),
  };
}

/**
 * Normalize & migrate legacy v1 flat objects (without asterisms[]) into v2 hierarchy
 * (Layer > AsterismGroup > AsterismObject[]).
 */
function normalizeHierarchy(
  layers: AsterismLayer[],
  rawAsterisms: AsterismGroup[],
  rawObjects: AsterismObject[],
  fallbackLayerId: string
): { asterisms: AsterismGroup[]; objects: AsterismObject[] } {
  const validLayerIds = new Set(layers.map((l) => l.id));
  const asterismMap = new Map<string, AsterismGroup>();

  for (const grp of rawAsterisms) {
    const layerId = validLayerIds.has(grp.layerId) ? grp.layerId : fallbackLayerId;
    asterismMap.set(grp.id, { ...grp, layerId });
  }

  const normalizedObjects: AsterismObject[] = [];
  for (let i = 0; i < rawObjects.length; i++) {
    const obj = rawObjects[i];
    const resolvedLayerId = validLayerIds.has(obj.layerId) ? obj.layerId : fallbackLayerId;
    let parentId = obj.asterismId;
    if (!parentId || !asterismMap.has(parentId)) {
      // Auto-migrate legacy v1 object into its own AsterismGroup
      parentId = `grp_${obj.id}`;
      if (!asterismMap.has(parentId)) {
        asterismMap.set(parentId, {
          id: parentId,
          layerId: resolvedLayerId,
          name: obj.label?.trim() || `성군 ${asterismMap.size + 1}`,
          visible: true,
          memo: obj.type !== 'label' ? obj.memo : undefined,
          eyepieceTag: obj.eyepieceTag,
          visibleFovRange: [obj.visibleFovRange[0], obj.visibleFovRange[1]],
          createdAt: obj.createdAt,
        });
      }
    }
    const parent = asterismMap.get(parentId)!;
    const shapeLabel =
      obj.label && obj.label.trim() && obj.label !== parent.name
        ? obj.label
        : getNextShapeName(obj.type, Boolean(obj.smooth), normalizedObjects, parentId);
    // For legacy label objects, move their title into memo if memo was empty so it renders on canvas
    const migratedMemo =
      obj.type === 'label' && !obj.memo && obj.label?.trim() ? obj.label.trim() : obj.memo;

    normalizedObjects.push({
      ...obj,
      layerId: parent.layerId,
      asterismId: parentId,
      label: shapeLabel,
      memo: migratedMemo,
    });
  }

  return {
    asterisms: Array.from(asterismMap.values()),
    objects: normalizedObjects,
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
            name: typeof l.name === 'string' && l.name.trim() ? l.name.trim() : `그룹 ${idx + 1}`,
            visible: typeof l.visible === 'boolean' ? l.visible : true,
            createdAt: typeof l.createdAt === 'number' ? l.createdAt : idx + 1,
          }))
        : DEFAULT_ASTERISM_LAYERS.map((l) => ({ ...l }));

    const activeLayerId =
      typeof parsed.activeLayerId === 'string' && layers.some((l) => l.id === parsed.activeLayerId)
        ? parsed.activeLayerId
        : layers[0].id;

    const rawAsterisms = Array.isArray(parsed.asterisms)
      ? parsed.asterisms
          .map((g, idx) => sanitizeAsterismGroup(g, activeLayerId, idx))
          .filter((x): x is AsterismGroup => x !== null)
      : [];

    const rawObjs = Array.isArray(parsed.objects) ? parsed.objects : [];
    const parsedObjs = rawObjs
      .map((obj) => sanitizeAsterismObject(obj, activeLayerId))
      .filter((x): x is AsterismObject => x !== null);

    const { asterisms, objects } = normalizeHierarchy(
      layers,
      rawAsterisms,
      parsedObjs,
      activeLayerId
    );

    const activeAsterismId =
      typeof parsed.activeAsterismId === 'string' &&
      asterisms.some((g) => g.id === parsed.activeAsterismId)
        ? parsed.activeAsterismId
        : null;

    return {
      layers,
      activeLayerId,
      asterisms,
      activeAsterismId,
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
  version: 2;
  scope: 'all' | 'single';
  exportedAt: string;
  layers: AsterismLayer[];
  asterisms: AsterismGroup[];
  objects: AsterismObject[];
}

export function exportAsterismsToJson(state: AsterismStoreState): string {
  const payload: AsterismExportPayload = {
    format: 'noxchart-asterisms',
    version: 2,
    scope: 'all',
    exportedAt: new Date().toISOString(),
    layers: state.layers,
    asterisms: state.asterisms,
    objects: state.objects,
  };
  return JSON.stringify(payload, null, 2);
}

export function exportSingleAsterismToJson(
  state: AsterismStoreState,
  asterismId: string
): string | null {
  const grp = state.asterisms.find((g) => g.id === asterismId);
  if (!grp) return null;
  const layer = state.layers.find((l) => l.id === grp.layerId);
  const childObjects = state.objects.filter((o) => o.asterismId === asterismId);
  const payload: AsterismExportPayload = {
    format: 'noxchart-asterisms',
    version: 2,
    scope: 'single',
    exportedAt: new Date().toISOString(),
    layers: layer ? [layer] : [],
    asterisms: [grp],
    objects: childObjects,
  };
  return JSON.stringify(payload, null, 2);
}

function triggerJsonDownload(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadAsterismsJson(state: AsterismStoreState): void {
  const json = exportAsterismsToJson(state);
  const today = new Date().toISOString().slice(0, 10);
  triggerJsonDownload(json, `noxchart-asterisms-all-${today}.json`);
}

export function downloadSingleAsterismJson(
  state: AsterismStoreState,
  asterismId: string
): boolean {
  const grp = state.asterisms.find((g) => g.id === asterismId);
  const json = exportSingleAsterismToJson(state, asterismId);
  if (!grp || !json) return false;
  const today = new Date().toISOString().slice(0, 10);
  const safeName = grp.name
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .slice(0, 40) || 'asterism';
  triggerJsonDownload(json, `noxchart-asterism-${safeName}-${today}.json`);
  return true;
}

export function parseAsterismsFromJson(
  text: string,
  fallbackLayerId: string
): {
  layers: AsterismLayer[];
  asterisms: AsterismGroup[];
  objects: AsterismObject[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return { layers: [], asterisms: [], objects: [], error: '올바른 JSON 형식이 아닙니다.' };
    }
    const obj = parsed as Record<string, unknown>;
    const rawLayers = Array.isArray(obj.layers) ? obj.layers : [];
    const layers: AsterismLayer[] = rawLayers
      .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
      .map((l, idx) => ({
        id: typeof l.id === 'string' && l.id ? l.id : makeAsterismId('layer'),
        name:
          typeof l.name === 'string' && l.name.trim() ? l.name.trim() : `가져온 그룹 ${idx + 1}`,
        visible: typeof l.visible === 'boolean' ? l.visible : true,
        createdAt: typeof l.createdAt === 'number' ? l.createdAt : Date.now() + idx,
      }));
    const defaultLayer = layers[0]?.id ?? fallbackLayerId;

    const rawAsterisms = Array.isArray(obj.asterisms)
      ? obj.asterisms
          .map((g, idx) => sanitizeAsterismGroup(g, defaultLayer, idx))
          .filter((x): x is AsterismGroup => x !== null)
      : [];

    const rawObjs = Array.isArray(obj.objects)
      ? obj.objects
      : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];
    const parsedObjects = rawObjs
      .map((item) => sanitizeAsterismObject(item, defaultLayer))
      .filter((x): x is AsterismObject => x !== null);

    const normalized = normalizeHierarchy(
      layers.length > 0
        ? layers
        : [{ id: defaultLayer, name: '기본 그룹', visible: true, createdAt: Date.now() }],
      rawAsterisms,
      parsedObjects,
      defaultLayer
    );

    if (normalized.asterisms.length === 0 && normalized.objects.length === 0) {
      return {
        layers: [],
        asterisms: [],
        objects: [],
        error: '가져올 성군 벡터 데이터가 없습니다.',
      };
    }
    return { layers, asterisms: normalized.asterisms, objects: normalized.objects };
  } catch {
    return {
      layers: [],
      asterisms: [],
      objects: [],
      error: 'JSON 파일 파싱 중 오류가 발생했습니다.',
    };
  }
}

// ---------------------------------------------------------------------------
// Compact URL / QR Serialization (?ast=<base64url>) — supports v1 & v2
// ---------------------------------------------------------------------------

interface CompactPayloadV2 {
  v: 2;
  l: [string, string, 0 | 1][]; // [id, name, visible]
  g: [
    string, // id
    string, // layerId
    string, // name
    0 | 1, // visible
    [number, number], // visibleFovRange
    string, // memo
    string, // eyepieceTag
    [number, number, number]?, // optional savedView [raDeg, decDeg, fsz]
  ][];
  o: [
    string, // id
    string, // layerId
    string, // asterismId
    'p' | 'g' | 'c' | 'a' | 't', // polyline | polygon | circle | arrow | label
    [number, number, string?][], // vertices
    string, // color hex without '#'
    number, // width
    number, // opacity
    'd' | 'c' | 's', // lineStyle
    0 | 1, // smooth
    number, // fillAlpha
    number, // extensionFactor
    number, // radiusDeg (for circle)
    number, // textOpacity (for label)
    string, // label (shape name)
    string, // memo (label canvas text)
    number?, // optional textSize (for label)
  ][];
}

const TYPE_TO_SHORT: Record<AsterismObject['type'], 'p' | 'g' | 'c' | 'a' | 't'> = {
  polyline: 'p',
  polygon: 'g',
  circle: 'c',
  arrow: 'a',
  label: 't',
};
const SHORT_TO_TYPE: Record<string, AsterismObject['type']> = {
  p: 'polyline',
  g: 'polygon',
  c: 'circle',
  a: 'arrow',
  t: 'label',
};
const STYLE_TO_SHORT: Record<AsterismLineStyle, 'd' | 'c' | 's'> = {
  dashed: 'd',
  dashdot: 'c',
  solid: 's',
};
const SHORT_TO_STYLE: Record<string, AsterismLineStyle> = {
  d: 'dashed',
  c: 'dashdot',
  s: 'solid',
};
const SHORT_TO_ANCHOR: Record<string, AsterismLabelAnchor> = {
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
  asterisms: AsterismGroup[],
  objects: AsterismObject[]
): string {
  const usedLayerIds = new Set([
    ...asterisms.map((g) => g.layerId),
    ...objects.map((o) => o.layerId),
  ]);
  const compactLayers = layers
    .filter((l) => usedLayerIds.has(l.id))
    .map((l): [string, string, 0 | 1] => [l.id, l.name, l.visible ? 1 : 0]);
  const payload: CompactPayloadV2 = {
    v: 2,
    l: compactLayers,
    g: asterisms.map((grp) => {
      const tuple: CompactPayloadV2['g'][number] = [
        grp.id,
        grp.layerId,
        grp.name,
        grp.visible ? 1 : 0,
        [
          Number(grp.visibleFovRange[0].toFixed(2)),
          Number(grp.visibleFovRange[1].toFixed(2)),
        ],
        grp.memo ?? '',
        grp.eyepieceTag ?? '',
      ];
      if (grp.savedView) {
        tuple.push([
          Number(grp.savedView.raDeg.toFixed(4)),
          Number(grp.savedView.decDeg.toFixed(4)),
          Number(grp.savedView.fsz.toFixed(2)),
        ]);
      }
      return tuple;
    }),
    o: objects.map((obj) => {
      const tuple: CompactPayloadV2['o'][number] = [
        obj.id,
        obj.layerId,
        obj.asterismId,
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
        Number((obj.fillAlpha ?? 0).toFixed(2)),
        Number((obj.extensionFactor ?? 1).toFixed(2)),
        Number((obj.radiusDeg ?? 0).toFixed(4)),
        Number((obj.textOpacity ?? obj.opacity).toFixed(2)),
        obj.label,
        obj.memo ?? '',
      ];
      if (obj.type === 'label' && obj.textSize !== undefined) {
        tuple.push(Math.round(obj.textSize));
      }
      return tuple;
    }),
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  return bytesToBase64Url(jsonBytes);
}

export function decodeAsterismsFromUrlParam(
  param: string,
  fallbackLayerId: string
): { layers: AsterismLayer[]; asterisms: AsterismGroup[]; objects: AsterismObject[] } | null {
  try {
    const bytes = base64UrlToBytes(param.trim());
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (!parsed || !Array.isArray(parsed.o)) return null;

    const rawLayers = Array.isArray(parsed.l) ? (parsed.l as unknown[][]) : [];
    const layers: AsterismLayer[] = rawLayers.map((tuple, idx) => ({
      id: typeof tuple[0] === 'string' && tuple[0] ? tuple[0] : makeAsterismId('sh_l'),
      name: typeof tuple[1] === 'string' && tuple[1] ? tuple[1] : `공유 그룹 ${idx + 1}`,
      visible: tuple[2] !== 0,
      createdAt: Date.now() + idx,
    }));
    const defaultLayer = layers[0]?.id ?? fallbackLayerId;

    if (parsed.v === 2) {
      const rawGroups = Array.isArray(parsed.g) ? (parsed.g as unknown[][]) : [];
      const asterisms: AsterismGroup[] = rawGroups.map((row, idx) => {
        const range = Array.isArray(row[4]) ? (row[4] as unknown[]) : [0.05, 45];
        const svRaw = Array.isArray(row[7]) ? (row[7] as unknown[]) : null;
        return {
          id: typeof row[0] === 'string' && row[0] ? row[0] : makeAsterismId('sh_g'),
          layerId: typeof row[1] === 'string' && row[1] ? row[1] : defaultLayer,
          name: typeof row[2] === 'string' && row[2] ? row[2] : `공유 성군 ${idx + 1}`,
          visible: row[3] !== 0,
          visibleFovRange: [
            clamp(range[0], 0.05, 0.02, 180),
            clamp(range[1], 45, 0.05, 180),
          ],
          memo: typeof row[5] === 'string' && row[5] ? row[5] : undefined,
          eyepieceTag: typeof row[6] === 'string' && row[6] ? row[6] : undefined,
          savedView:
            svRaw && svRaw.length >= 3
              ? sanitizeSavedView({ raDeg: svRaw[0], decDeg: svRaw[1], fsz: svRaw[2] })
              : undefined,
          createdAt: Date.now() + idx,
        };
      });

      const objects: AsterismObject[] = [];
      for (const row of parsed.o as unknown[][]) {
        if (!Array.isArray(row) || row.length < 15) continue;
        const type = SHORT_TO_TYPE[String(row[3])];
        if (!type) continue;
        const verts: AsterismVertex[] = Array.isArray(row[4])
          ? (row[4] as unknown[][])
              .filter((v) => Array.isArray(v) && v.length >= 2)
              .map((v) => ({
                raDeg: ((Number(v[0]) % 360) + 360) % 360,
                decDeg: Math.max(-90, Math.min(90, Number(v[1]))),
                catalogId: typeof v[2] === 'string' && v[2] ? v[2] : undefined,
              }))
          : [];
        const minV = type === 'label' || type === 'circle' ? 1 : type === 'polygon' ? 3 : 2;
        if (verts.length < minV) continue;
        objects.push({
          id: typeof row[0] === 'string' && row[0] ? row[0] : makeAsterismId('sh'),
          layerId: typeof row[1] === 'string' && row[1] ? row[1] : defaultLayer,
          asterismId: typeof row[2] === 'string' ? row[2] : '',
          type,
          vertices: verts,
          color: `#${String(row[5] || '38BDF8').replace(/^#/, '')}`,
          lineWidth: clamp(row[6], 1.4, 0.5, 10.0),
          opacity: clamp(row[7], 0.9, 0.1, 1.0),
          lineStyle: SHORT_TO_STYLE[String(row[8])] ?? 'dashed',
          smooth: row[9] === 1,
          fillAlpha: clamp(row[10], 0, 0, 0.45),
          extensionFactor: clamp(row[11], 1, 1, 6),
          radiusDeg: type === 'circle' ? clamp(row[12], 0.5, 0.01, 90) : undefined,
          textOpacity: type === 'label' ? clamp(row[13], 0.95, 0.1, 1.0) : undefined,
          textSize:
            type === 'label' && row.length >= 17
              ? Math.round(clamp(row[16], 11, 8, 32))
              : undefined,
          visibleFovRange: [0.05, 45],
          label: typeof row[14] === 'string' ? row[14] : '',
          memo: typeof row[15] === 'string' && row[15] ? row[15] : undefined,
          labelAnchor: 'top',
          createdAt: Date.now(),
        });
      }

      const norm = normalizeHierarchy(
        layers.length > 0
          ? layers
          : [{ id: defaultLayer, name: '기본 그룹', visible: true, createdAt: Date.now() }],
        asterisms,
        objects,
        defaultLayer
      );
      return norm.asterisms.length > 0 || norm.objects.length > 0
        ? { layers, asterisms: norm.asterisms, objects: norm.objects }
        : null;
    }

    // Legacy v1 payload compatibility
    if (parsed.v === 1) {
      const objects: AsterismObject[] = [];
      for (const row of parsed.o as unknown[][]) {
        if (!Array.isArray(row) || row.length < 13) continue;
        const type = SHORT_TO_TYPE[String(row[2])];
        if (!type) continue;
        const verts: AsterismVertex[] = Array.isArray(row[3])
          ? (row[3] as unknown[][])
              .filter((v) => Array.isArray(v) && v.length >= 2)
              .map((v) => ({
                raDeg: ((Number(v[0]) % 360) + 360) % 360,
                decDeg: Math.max(-90, Math.min(90, Number(v[1]))),
                catalogId: typeof v[2] === 'string' && v[2] ? v[2] : undefined,
              }))
          : [];
        const minV = type === 'label' ? 1 : type === 'polygon' ? 3 : 2;
        if (verts.length < minV) continue;
        const range = Array.isArray(row[11]) ? (row[11] as unknown[]) : [0.05, 45];
        objects.push({
          id: typeof row[0] === 'string' && row[0] ? row[0] : makeAsterismId('sh'),
          layerId: typeof row[1] === 'string' && row[1] ? row[1] : defaultLayer,
          asterismId: '',
          type,
          vertices: verts,
          color: `#${String(row[4] || '38BDF8').replace(/^#/, '')}`,
          lineWidth: clamp(row[5], 1.4, 0.5, 10.0),
          opacity: clamp(row[6], 0.9, 0.1, 1.0),
          lineStyle: SHORT_TO_STYLE[String(row[7])] ?? 'dashed',
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
          labelAnchor: SHORT_TO_ANCHOR[String(row[15])] ?? 'top',
          createdAt: Date.now(),
        });
      }
      const norm = normalizeHierarchy(
        layers.length > 0
          ? layers
          : [{ id: defaultLayer, name: '기본 그룹', visible: true, createdAt: Date.now() }],
        [],
        objects,
        defaultLayer
      );
      return norm.objects.length > 0
        ? { layers, asterisms: norm.asterisms, objects: norm.objects }
        : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function buildAsterismShareUrl(
  layers: AsterismLayer[],
  asterisms: AsterismGroup[],
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
  const encoded = encodeAsterismsToUrlParam(layers, asterisms, objects);
  url.searchParams.set('ast', encoded);
  return url.toString();
}
