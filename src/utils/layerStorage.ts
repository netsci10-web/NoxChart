import {
  ConstellationLineStyle,
  DsoType,
  HipsSettings,
  HipsSurveyId,
  LayerSettings,
} from '../types/astronomy';

export const LAYER_SETTINGS_STORAGE_KEY = 'noxchart_layer_settings_v1';

export interface LayerSettingsBundle {
  layers: LayerSettings;
  hips: HipsSettings;
}

interface LayerSettingsFilePayload {
  format: 'noxchart-layer-settings';
  version: 1;
  exportedAt: string;
  layers: LayerSettings;
  hips: HipsSettings;
}

const ALL_DSO_CATEGORIES_ENABLED: Record<DsoType, boolean> = {
  GX: true,
  OC: true,
  GC: true,
  DN: true,
  DARK: true,
  PN: true,
  SNR: true,
  AST: true,
};

const VALID_CONSTELLATION_STYLES: ConstellationLineStyle[] = ['modern', 'traditional'];
const VALID_HIPS_SURVEYS: HipsSurveyId[] = ['dss2', '2mass', 'allwise'];

function clampNum(val: unknown, fallback: number, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

function readBool(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

export function sanitizeLayerSettings(
  raw: unknown,
  fallback: LayerSettings
): LayerSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...fallback,
      catalogFilter: 'all',
      dsoCategories: { ...ALL_DSO_CATEGORIES_ENABLED },
    };
  }
  const obj = raw as Record<string, unknown>;
  const styleRaw = obj.constellationLineStyle;
  const constellationLineStyle: ConstellationLineStyle =
    typeof styleRaw === 'string' &&
    VALID_CONSTELLATION_STYLES.includes(styleRaw as ConstellationLineStyle)
      ? (styleRaw as ConstellationLineStyle)
      : fallback.constellationLineStyle;

  return {
    showGridEq: readBool(obj.showGridEq, fallback.showGridEq),
    showGridAltAz: readBool(obj.showGridAltAz, fallback.showGridAltAz),
    gridLineWidth: clampNum(obj.gridLineWidth, fallback.gridLineWidth, 0.2, 2.5),
    showHorizon: readBool(obj.showHorizon, fallback.showHorizon),
    showTerrain: readBool(obj.showTerrain, fallback.showTerrain),
    showEcliptic: readBool(obj.showEcliptic, fallback.showEcliptic),
    showMilkyWay: readBool(obj.showMilkyWay, fallback.showMilkyWay),
    showNebulaContours: readBool(obj.showNebulaContours, fallback.showNebulaContours),
    showConstellationLines: readBool(
      obj.showConstellationLines,
      fallback.showConstellationLines
    ),
    constellationLineStyle,
    constellationLineOpacity: clampNum(
      obj.constellationLineOpacity,
      fallback.constellationLineOpacity,
      0.05,
      1.0
    ),
    showConstellationBoundaries: readBool(
      obj.showConstellationBoundaries,
      fallback.showConstellationBoundaries
    ),
    showConstellationNames: readBool(
      obj.showConstellationNames,
      fallback.showConstellationNames
    ),
    showSolarSystem: readBool(obj.showSolarSystem, fallback.showSolarSystem),
    showPlanetSurface: readBool(obj.showPlanetSurface, fallback.showPlanetSurface),
    showSolarSystemOrbits: readBool(
      obj.showSolarSystemOrbits,
      fallback.showSolarSystemOrbits
    ),
    showSolarSystemLabels: readBool(
      obj.showSolarSystemLabels,
      fallback.showSolarSystemLabels
    ),
    showStarColors: readBool(obj.showStarColors, fallback.showStarColors),
    showDoubleStars: readBool(obj.showDoubleStars, fallback.showDoubleStars),
    showDoublePairs: readBool(obj.showDoublePairs, fallback.showDoublePairs),
    showMultipleStars: readBool(obj.showMultipleStars, fallback.showMultipleStars),
    doubleStarDensityPct: clampNum(
      obj.doubleStarDensityPct,
      fallback.doubleStarDensityPct,
      0,
      100
    ),
    doubleStarMinSepArcsec: clampNum(
      obj.doubleStarMinSepArcsec,
      fallback.doubleStarMinSepArcsec,
      0,
      60
    ),
    showDoubleStarLabels: readBool(
      obj.showDoubleStarLabels,
      fallback.showDoubleStarLabels
    ),
    doubleStarLabelDensityPct: clampNum(
      obj.doubleStarLabelDensityPct,
      fallback.doubleStarLabelDensityPct,
      0,
      100
    ),
    doubleStarOpacity: clampNum(
      obj.doubleStarOpacity,
      fallback.doubleStarOpacity,
      0.05,
      1.0
    ),
    showDso: readBool(obj.showDso, fallback.showDso),
    showMessierCatalog: readBool(obj.showMessierCatalog, fallback.showMessierCatalog),
    showCaldwellCatalog: readBool(obj.showCaldwellCatalog, fallback.showCaldwellCatalog),
    dsoSymbolDensityPct: clampNum(
      obj.dsoSymbolDensityPct,
      fallback.dsoSymbolDensityPct,
      0,
      100
    ),
    showDsoLabels: readBool(obj.showDsoLabels, fallback.showDsoLabels),
    dsoLabelDensityPct: clampNum(
      obj.dsoLabelDensityPct,
      fallback.dsoLabelDensityPct,
      0,
      100
    ),
    dsoOpacity: clampNum(obj.dsoOpacity, fallback.dsoOpacity, 0.05, 1.0),
    showStarLabels: readBool(obj.showStarLabels, fallback.showStarLabels),
    showProperStarNames: readBool(
      obj.showProperStarNames,
      fallback.showProperStarNames
    ),
    starLabelDensityPct: clampNum(
      obj.starLabelDensityPct,
      fallback.starLabelDensityPct,
      0,
      100
    ),
    showFieldStars: readBool(obj.showFieldStars, fallback.showFieldStars),
    enableGaiaLive: readBool(obj.enableGaiaLive, fallback.enableGaiaLive),
    magOffset: clampNum(obj.magOffset, fallback.magOffset, -3.0, 4.0),
    dsoMagOffset: clampNum(obj.dsoMagOffset, fallback.dsoMagOffset, -4.0, 4.0),
    // DSO catalog/type filter UI is removed: always normalize to show all DSOs
    catalogFilter: 'all',
    dsoCategories: { ...ALL_DSO_CATEGORIES_ENABLED },
    highlightSessionPlan: readBool(
      obj.highlightSessionPlan,
      fallback.highlightSessionPlan
    ),
    challengeOpacity: clampNum(
      obj.challengeOpacity,
      fallback.challengeOpacity,
      0.05,
      1.0
    ),
    challengeLineWidth: clampNum(
      obj.challengeLineWidth,
      fallback.challengeLineWidth,
      0.3,
      3.0
    ),
  };
}

export function sanitizeHipsSettings(
  raw: unknown,
  fallback: HipsSettings
): HipsSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback };
  }
  const obj = raw as Record<string, unknown>;
  const surveyRaw = obj.survey;
  const survey: HipsSurveyId =
    typeof surveyRaw === 'string' &&
    VALID_HIPS_SURVEYS.includes(surveyRaw as HipsSurveyId)
      ? (surveyRaw as HipsSurveyId)
      : fallback.survey;

  return {
    enabled: readBool(obj.enabled, fallback.enabled),
    survey,
    opacity: clampNum(obj.opacity, fallback.opacity, 0.1, 1.0),
  };
}

export function loadSavedLayerSettings(
  defaultLayers: LayerSettings,
  defaultHips: HipsSettings
): LayerSettingsBundle | null {
  try {
    const raw = localStorage.getItem(LAYER_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const rawLayers = obj.layers && typeof obj.layers === 'object' ? obj.layers : obj;
    const rawHips = obj.hips && typeof obj.hips === 'object' ? obj.hips : undefined;
    return {
      layers: sanitizeLayerSettings(rawLayers, defaultLayers),
      hips: sanitizeHipsSettings(rawHips, defaultHips),
    };
  } catch {
    return null;
  }
}

export function saveLayerSettingsToLocal(
  layers: LayerSettings,
  hips: HipsSettings
): void {
  try {
    const payload: LayerSettingsBundle = {
      layers: {
        ...layers,
        catalogFilter: 'all',
        dsoCategories: { ...ALL_DSO_CATEGORIES_ENABLED },
      },
      hips: { ...hips },
    };
    localStorage.setItem(LAYER_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function exportLayerSettingsToJson(
  layers: LayerSettings,
  hips: HipsSettings
): string {
  const payload: LayerSettingsFilePayload = {
    format: 'noxchart-layer-settings',
    version: 1,
    exportedAt: new Date().toISOString(),
    layers: {
      ...layers,
      catalogFilter: 'all',
      dsoCategories: { ...ALL_DSO_CATEGORIES_ENABLED },
    },
    hips: { ...hips },
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadLayerSettingsFile(
  layers: LayerSettings,
  hips: HipsSettings,
  filename?: string
): void {
  const today = new Date().toISOString().slice(0, 10);
  const finalName = filename || `noxchart-layer-settings-${today}.json`;
  const json = exportLayerSettingsToJson(layers, hips);
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

const RECOGNIZED_LAYER_KEYS: (keyof LayerSettings)[] = [
  'showGridEq',
  'showGridAltAz',
  'gridLineWidth',
  'showHorizon',
  'showTerrain',
  'showEcliptic',
  'showMilkyWay',
  'showConstellationLines',
  'showConstellationNames',
  'showSolarSystem',
  'showDoubleStars',
  'doubleStarOpacity',
  'showDso',
  'dsoOpacity',
  'showStarLabels',
  'showFieldStars',
  'magOffset',
  'dsoMagOffset',
];

function looksLikeLayerObject(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const rec = obj as Record<string, unknown>;
  return RECOGNIZED_LAYER_KEYS.some((key) => key in rec);
}

function looksLikeHipsObject(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const rec = obj as Record<string, unknown>;
  return 'enabled' in rec || 'survey' in rec || 'opacity' in rec;
}

export interface ParsedLayerSettingsResult {
  bundle?: LayerSettingsBundle;
  error?: string;
}

export function parseLayerSettingsFromJson(
  text: string,
  fallbackLayers: LayerSettings,
  fallbackHips: HipsSettings
): ParsedLayerSettingsResult {
  try {
    const raw = JSON.parse(text) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: '유효한 레이어 세팅 파일(.json) 형식이 아닙니다.' };
    }

    const obj = raw as Record<string, unknown>;
    const hasLayersBlock = looksLikeLayerObject(obj.layers);
    const hasHipsBlock = looksLikeHipsObject(obj.hips);
    const isDirectLayers = !hasLayersBlock && looksLikeLayerObject(obj);

    if (!hasLayersBlock && !hasHipsBlock && !isDirectLayers) {
      return {
        error: '파일에서 적용할 수 있는 레이어 설정 항목을 찾지 못했습니다.',
      };
    }

    const layers = sanitizeLayerSettings(
      hasLayersBlock ? obj.layers : isDirectLayers ? obj : undefined,
      fallbackLayers
    );
    const hips = sanitizeHipsSettings(
      hasHipsBlock ? obj.hips : undefined,
      fallbackHips
    );

    return { bundle: { layers, hips } };
  } catch {
    return {
      error: 'JSON 파일을 읽을 수 없습니다. 파일 형식을 확인해 주세요.',
    };
  }
}
