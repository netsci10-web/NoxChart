import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Bookmark,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Download,
  Globe2,
  Grid3x3,
  Image as ImageIcon,
  Loader2,
  LogIn,
  Moon,
  Mountain,
  Printer,
  Ruler,
  Share2,
  Star,
  Sun,
  Trophy,
  Waypoints,
  X,
} from 'lucide-react';
import { AuthSyncControls } from './components/AuthSyncControls';
import {
  ConfirmDialogContext,
  ConfirmDialogModal,
  ConfirmDialogOptions,
  PendingConfirmRequest,
} from './components/ConfirmDialog';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import { CelestialInfoWindow } from './components/CelestialInfoWindow';
import { ControlSidebar } from './components/ControlSidebar';
import { ObjectInspector } from './components/ObjectInspector';
import { ObservingSiteMapModal } from './components/ObservingSiteMapModal';
import { StarChartCanvas, StarChartCanvasHandle } from './components/StarChartCanvas';
import { TimeControlBar } from './components/TimeControlBar';
import { TourGuideOverlay } from './components/TourGuideOverlay';
import {
  createDefaultChallengeTracks,
  hydrateChallengeTracksWithCatalog,
} from './data/challenges';
import {
  getSmartTelescopeMosaicMaxScale,
  isSmartTelescopeMosaicSupported,
  isSmartTelescopeRotatable,
  normalizeTelescopeOpticalType,
  SMART_TELESCOPE_PRESETS,
} from './data/equipmentCatalog';
import {
  ensureCoreCatalogs,
  ensureDeepDsos,
  ensureDeepStars,
  ensureDoubleStars,
  getCatalogSnapshot,
  useCatalogData,
} from './data/catalogLoader';
import {
  AsterismDraftState,
  AsterismGroup,
  AsterismLayer,
  AsterismObject,
  AsterismStoreState,
  AsterismTool,
  AsterismToolboxPopover,
  AsterismVertex,
  ChallengeCheckpoint,
  ChallengeTrack,
  ChartViewState,
  CoordSystem,
  DEFAULT_SENSOR_EXPORT_CAPTION,
  DeepSkyObject,
  EquipmentCategory,
  EquipmentItem,
  EquipmentLockerState,
  HipsSettings,
  LayerSettings,
  ObservationLogEntry,
  ObservationLogStoreState,
  ObserverConfig,
  ObservingListGroup,
  ObservingListsState,
  ObservingSessionEntry,
  OpticsLabelDirection,
  OpticsSettings,
  RulerMeasurement,
  RulerPoint,
  SavedObservingSite,
  SelectedItem,
  SensorExportCaptionConfig,
  Star as StarType,
  ThemeMode,
} from './types/astronomy';
import {
  angularDistanceDeg,
  DEG2RAD,
  equatorialToHorizontal,
  formatDec,
  formatRA,
  getDsoLimitingMagnitude,
  getLimitingMagnitude,
  getLSTDeg,
  horizontalToEquatorial,
  parseUrlState,
  RAD2DEG,
  syncUrlState,
} from './utils/astronomy';
import {
  BuiltInAsterismPreset,
  createBuiltInPresetAsterismBundles,
  decodeAsterismsFromUrlParam,
  DEFAULT_ASTERISM_LAYERS,
  getNextAsterismGroupName,
  getNextShapeName,
  loadAsterismStateFromLocal,
  makeAsterismId,
  saveAsterismStateToLocal,
} from './utils/asterismStorage';
import { destinationPointSpherical, getCircleRadiusDeg } from './utils/asterismRenderer';
import { CHALLENGES_STORAGE_KEY, mergeChallengeTracks } from './utils/challengeStorage';
import {
  formatObservationDateTime,
  loadObservationLogStore,
  mergeObservationLogStores,
  saveObservationLogStore,
} from './utils/observationLogStorage';
import {
  downloadSkylistFile,
  exportObservingListToSkylist,
  parseSkylistObjects,
  resolveSkylistObjects,
} from './utils/skylist';
import {
  buildChallengeTourStops,
  buildTonightTourStops,
  formatFovLabel,
  GuidedTourState,
  TOUR_DWELL_OPTIONS,
  TourStop,
} from './utils/tonightTour';
import {
  LayerSettingsBundle,
  loadSavedLayerSettings,
  sanitizeHipsSettings,
  sanitizeLayerSettings,
  saveLayerSettingsToLocal,
} from './utils/layerStorage';
import {
  CloudSubDocKey,
  CloudSyncPayload,
  CloudSyncStatus,
  computePayloadHashes,
  formatFriendlyAuthError,
  formatFriendlySyncError,
  LoadedCloudData,
  loadUserCloudData,
  saveUserCloudRoot,
  saveUserCloudSubdoc,
  stripEphemeralAsterisms,
  stripEphemeralChallenges,
  stripEphemeralOptics,
  stripUndefinedDeep,
  subscribeUserCloudData,
  SyncHashes,
} from './utils/cloudSync';
import {
  ACTIVE_SITE_STORAGE_KEY,
  mergeObservingSites,
  SAVED_SITES_STORAGE_KEY,
} from './utils/observingSites';
import { clampBortleClass, estimateSiteBortleClass } from './utils/bortle';
import {
  clampUiFontSizeStep,
  getUiFontOption,
  getUiFontSizeMetrics,
  isValidUiFontFamily,
  UiFontFamily,
} from './utils/uiTypography';
import { getSolarSystemBodies, getSolarSystemDailyTrail } from './utils/solarSystem';
import { getUiTheme } from './utils/themeClasses';

const SESSION_STORAGE_KEY = 'sidereal_atlas_session_v1';
const OBSERVING_LISTS_STORAGE_KEY = 'sidereal_atlas_observing_lists_v1';
const INFO_DOCK_SIDE_STORAGE_KEY = 'sidereal_atlas_info_dock_side_v1';
const DEFAULT_OBSERVING_LIST_ID = 'list_default';
const DEFAULT_OBSERVING_LIST_NAME = '기본 관측 목록';

function stripSkylistExtension(fileName?: string): string {
  if (!fileName) return '';
  return fileName
    .trim()
    .replace(/\.(skylist|txt)$/i, '')
    .trim();
}

function makeUniqueListName(baseName: string, existing: ObservingListGroup[]): string {
  const cleaned = baseName.trim() || DEFAULT_OBSERVING_LIST_NAME;
  const used = new Set(existing.map((l) => l.name.trim().toLowerCase()));
  if (!used.has(cleaned.toLowerCase())) return cleaned;
  let n = 2;
  while (used.has(`${cleaned} (${n})`.toLowerCase())) n++;
  return `${cleaned} (${n})`;
}

function makeObservingListId(): string {
  return `olist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
const EQUIPMENT_STORAGE_KEY = 'noxchart_equipment_v1';
const OPTICS_STORAGE_KEY = 'noxchart_optics_v1';
const APP_PREFS_STORAGE_KEY = 'noxchart_app_prefs_v1';

interface SavedAppPrefs {
  theme?: ThemeMode;
  redIntensity?: number;
  uiFontFamily?: UiFontFamily;
  uiFontSizeStep?: number;
  coordSystem?: CoordSystem;
  fsz?: number;
  flipH?: boolean;
  flipV?: boolean;
}

const DEFAULT_EQUIPMENT_LOCKER: EquipmentLockerState = {
  items: [
    {
      id: 'eq_default_scope_102',
      category: 'telescope',
      name: '102mm F7 ED 굴절',
      apertureMm: 102,
      focalLengthMm: 714,
      opticalType: '굴절',
    },
    {
      id: 'eq_default_ep_25',
      category: 'eyepiece',
      name: '25mm 광시야 아이피스',
      focalLengthMm: 25,
      afovDeg: 68,
    },
    {
      id: 'eq_default_ep_10',
      category: 'eyepiece',
      name: '10mm 초광시야 아이피스',
      focalLengthMm: 10,
      afovDeg: 82,
    },
    {
      id: 'eq_default_barlow_2x',
      category: 'barlow',
      name: '2× APO 바로우',
      factor: 2.0,
    },
    {
      id: 'eq_default_filter_uhc',
      category: 'filter',
      name: '2" UHC 성운 필터',
      filterType: 'UHC',
    },
    {
      id: 'eq_default_cam_533',
      category: 'camera',
      name: 'IMX533 냉각 카메라',
      sensorWidthMm: 11.31,
      sensorHeightMm: 11.31,
      pixelSizeUm: 3.76,
    },
  ],
  activeIds: {},
};

const DEFAULT_VIEW: ChartViewState = {
  ra: 5.58,
  dec: 4.5,
  fsz: 95,
  flipH: false,
  flipV: false,
  coordSystem: 'horizontal',
};

const DEFAULT_THEME: ThemeMode = 'dark';

const DEFAULT_LAYERS: LayerSettings = {
  showGridEq: false,
  showGridAltAz: true,
  gridLineWidth: 0.8,
  gridLineOpacity: 0.35,
  showHorizon: true,
  showTerrain: true,
  showEcliptic: false,
  showMilkyWay: false,
  showNebulaContours: false,
  showConstellationLines: true,
  constellationLineStyle: 'traditional',
  constellationLineOpacity: 0.35,
  showConstellationBoundaries: false,
  showConstellationNames: true,
  showSolarSystem: true,
  showPlanetSurface: true,
  showSolarSystemOrbits: false,
  showSolarSystemLabels: true,
  showStarColors: true,
  showDoubleStars: true,
  showDoublePairs: true,
  showMultipleStars: true,
  doubleStarDensityPct: 30,
  doubleStarMinSepArcsec: 1,
  showDoubleStarLabels: true,
  doubleStarLabelDensityPct: 12,
  doubleStarSymbolOpacity: 1.0,
  doubleStarLabelOpacity: 1.0,
  showDso: true,
  showMessierCatalog: false,
  showCaldwellCatalog: false,
  dsoSymbolDensityPct: 30,
  showDsoLabels: true,
  dsoLabelDensityPct: 7,
  dsoSymbolOpacity: 1.0,
  dsoLabelOpacity: 1.0,
  showStarLabels: true,
  starLabelLanguage: 'ko',
  showProperStarNames: false,
  starLabelDensityPct: 7,
  starLabelOpacity: 1.0,
  showFieldStars: true,
  enableGaiaLive: true,
  magOffset: 0,
  dsoMagOffset: 0,
  catalogFilter: 'all',
  dsoCategories: {
    GX: true,
    OC: true,
    GC: true,
    DN: true,
    DARK: true,
    PN: true,
    SNR: true,
    AST: true,
  },
  highlightSessionPlan: false,
  sessionPlanColor: '#F59E0B',
  sessionPlanOpacity: 1.0,
  challengeColor: '',
  challengeOpacity: 1.0,
  challengeLineWidth: 0.8,
  showAtmosphericExtinction: false,
  extinctionCoeff: 0.25,
};

const DEFAULT_HIPS: HipsSettings = {
  enabled: true,
  survey: 'dss2',
  opacity: 0.5,
};

const DEFAULT_OPTICS: OpticsSettings = {
  showCrosshair: false,
  showTelrad: false,
  showFinder7x50: false,
  finderFovDeg: 7.0,
  finderLabel: '7×50 파인더',
  finderColor: undefined,
  finderCrosshair: false,
  showEyepiece: false,
  eyepieceFovDeg: 1.7,
  eyepieceRotationDeg: 0,
  eyepieceLabel: '망원경 아이피스',
  eyepieceInputMode: 'equipment',
  telescopeFocalLengthMm: 1000,
  eyepieceFocalLengthMm: 25,
  eyepieceAfovDeg: 68,
  reticleLineWidth: 1.4,
  reticleOpacity: 0.85,
  showReticleLabel: true,
  reticleLabelDirection: 'ne',
  showSensorBox: false,
  sensorWidthDeg: 2.15,
  sensorHeightDeg: 1.21,
  sensorRotationDeg: 0,
  sensorEquipmentLabel: undefined,
  sensorRotationLocked: false,
  sensorMosaicSupported: false,
  sensorMosaicMaxScale: 2.0,
  sensorMosaicScaleW: 1.0,
  sensorMosaicScaleH: 1.0,
  sensorExportCaption: { ...DEFAULT_SENSOR_EXPORT_CAPTION },
  showStarHop: false,
  showSelectionMark: true,
};

const DEFAULT_OBSERVER: ObserverConfig = {
  name: '서울 (Seoul)',
  lat: 37.5665,
  lon: 126.978,
  timestampMs: Date.now(),
  useLiveTime: false,
  isPlaying: false,
  timeRateSecPerSec: 1,
  minAltitudeDeg: -90,
  highlightAboveMinAlt: false,
  bortleEnabled: false,
  bortleClass: estimateSiteBortleClass(37.5665, 126.978, '서울 (Seoul)').bortle,
};

function reorderItemsById<T extends { id: string }>(
  items: T[],
  fromId: string,
  toId: string
): T[] {
  if (fromId === toId) return items;
  const fromIdx = items.findIndex((item) => item.id === fromId);
  const toIdx = items.findIndex((item) => item.id === toId);
  if (fromIdx < 0 || toIdx < 0) return items;
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

function loadSavedAppPrefs(): SavedAppPrefs {
  try {
    const raw = localStorage.getItem(APP_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const res: SavedAppPrefs = {};
        if (parsed.theme === 'dark' || parsed.theme === 'white' || parsed.theme === 'red') {
          res.theme = parsed.theme;
        }
        if (typeof parsed.redIntensity === 'number' && Number.isFinite(parsed.redIntensity)) {
          res.redIntensity = Math.max(0, Math.min(100, Math.round(parsed.redIntensity)));
        }
        if (isValidUiFontFamily(parsed.uiFontFamily)) {
          res.uiFontFamily = parsed.uiFontFamily;
        }
        if (typeof parsed.uiFontSizeStep === 'number' && Number.isFinite(parsed.uiFontSizeStep)) {
          res.uiFontSizeStep = clampUiFontSizeStep(parsed.uiFontSizeStep);
        }
        if (parsed.coordSystem === 'horizontal' || parsed.coordSystem === 'equatorial') {
          res.coordSystem = parsed.coordSystem;
        }
        if (typeof parsed.fsz === 'number' && Number.isFinite(parsed.fsz)) {
          res.fsz = Math.max(0.008, Math.min(180, parsed.fsz));
        }
        if (typeof parsed.flipH === 'boolean') res.flipH = parsed.flipH;
        if (typeof parsed.flipV === 'boolean') res.flipV = parsed.flipV;
        return res;
      }
    }
  } catch {
    // Ignore storage parse failure
  }
  return {};
}

function sanitizeOpticsSettings(raw: unknown): OpticsSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_OPTICS,
      sensorExportCaption: { ...DEFAULT_SENSOR_EXPORT_CAPTION },
    };
  }
  const parsed = raw as Record<string, unknown>;
  const boolOr = (k: keyof OpticsSettings, fallback: boolean): boolean =>
    typeof parsed[k] === 'boolean' ? (parsed[k] as boolean) : fallback;
  const numOr = (k: keyof OpticsSettings, fallback: number, min: number, max: number): number =>
    typeof parsed[k] === 'number' && Number.isFinite(parsed[k] as number)
      ? Math.max(min, Math.min(max, parsed[k] as number))
      : fallback;
  const mode: OpticsSettings['eyepieceInputMode'] =
    parsed.eyepieceInputMode === 'direct' ||
    parsed.eyepieceInputMode === 'calc' ||
    parsed.eyepieceInputMode === 'equipment'
      ? parsed.eyepieceInputMode
      : DEFAULT_OPTICS.eyepieceInputMode;

  return {
    ...DEFAULT_OPTICS,
          showCrosshair: boolOr('showCrosshair', DEFAULT_OPTICS.showCrosshair),
          showTelrad: boolOr('showTelrad', DEFAULT_OPTICS.showTelrad),
          showFinder7x50: boolOr('showFinder7x50', DEFAULT_OPTICS.showFinder7x50),
          finderFovDeg: numOr('finderFovDeg', DEFAULT_OPTICS.finderFovDeg ?? 7.0, 0.5, 25),
          finderLabel:
            typeof parsed.finderLabel === 'string' && parsed.finderLabel.trim()
              ? parsed.finderLabel
              : DEFAULT_OPTICS.finderLabel,
          finderColor:
            typeof parsed.finderColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.finderColor.trim())
              ? parsed.finderColor.trim()
              : undefined,
          finderCrosshair: boolOr('finderCrosshair', Boolean(DEFAULT_OPTICS.finderCrosshair)),
          showEyepiece: boolOr('showEyepiece', DEFAULT_OPTICS.showEyepiece),
          eyepieceFovDeg: numOr('eyepieceFovDeg', DEFAULT_OPTICS.eyepieceFovDeg, 0.05, 20),
          eyepieceRotationDeg: numOr('eyepieceRotationDeg', DEFAULT_OPTICS.eyepieceRotationDeg, 0, 360),
          eyepieceLabel:
            typeof parsed.eyepieceLabel === 'string' && parsed.eyepieceLabel.trim()
              ? parsed.eyepieceLabel
              : DEFAULT_OPTICS.eyepieceLabel,
          eyepieceInputMode: mode,
          telescopeFocalLengthMm: numOr(
            'telescopeFocalLengthMm',
            DEFAULT_OPTICS.telescopeFocalLengthMm,
            50,
            10000
          ),
          eyepieceFocalLengthMm: numOr(
            'eyepieceFocalLengthMm',
            DEFAULT_OPTICS.eyepieceFocalLengthMm,
            1,
            100
          ),
          eyepieceAfovDeg: numOr('eyepieceAfovDeg', DEFAULT_OPTICS.eyepieceAfovDeg, 20, 120),
          reticleLineWidth: numOr(
            'reticleLineWidth',
            DEFAULT_OPTICS.reticleLineWidth ?? 1.4,
            0.5,
            6.0
          ),
          reticleOpacity: numOr(
            'reticleOpacity',
            DEFAULT_OPTICS.reticleOpacity ?? 0.85,
            0.1,
            1.0
          ),
          showReticleLabel: boolOr(
            'showReticleLabel',
            DEFAULT_OPTICS.showReticleLabel ?? true
          ),
          reticleLabelDirection: (
            ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as OpticsLabelDirection[]
          ).includes(parsed.reticleLabelDirection as OpticsLabelDirection)
            ? (parsed.reticleLabelDirection as OpticsLabelDirection)
            : DEFAULT_OPTICS.reticleLabelDirection ?? 'ne',
          showSensorBox: boolOr('showSensorBox', DEFAULT_OPTICS.showSensorBox),
          sensorWidthDeg: numOr('sensorWidthDeg', DEFAULT_OPTICS.sensorWidthDeg, 0.02, 40),
          sensorHeightDeg: numOr('sensorHeightDeg', DEFAULT_OPTICS.sensorHeightDeg, 0.02, 40),
          sensorRotationDeg: numOr('sensorRotationDeg', DEFAULT_OPTICS.sensorRotationDeg, 0, 360),
          sensorEquipmentLabel:
            typeof parsed.sensorEquipmentLabel === 'string' && parsed.sensorEquipmentLabel.trim()
              ? parsed.sensorEquipmentLabel.trim()
              : undefined,
          sensorRotationLocked: boolOr('sensorRotationLocked', false),
          sensorMosaicSupported: boolOr('sensorMosaicSupported', false),
          sensorMosaicMaxScale: numOr('sensorMosaicMaxScale', 2.0, 1.2, 4.0),
          sensorMosaicScaleW: numOr('sensorMosaicScaleW', 1.0, 1.0, 4.0),
          sensorMosaicScaleH: numOr('sensorMosaicScaleH', 1.0, 1.0, 4.0),
          sensorExportCaption: (() => {
            const rawCap = parsed.sensorExportCaption;
            if (!rawCap || typeof rawCap !== 'object') {
              return { ...DEFAULT_SENSOR_EXPORT_CAPTION };
            }
            const c = rawCap as Record<string, unknown>;
            const capBool = (k: keyof SensorExportCaptionConfig, fb: boolean): boolean =>
              typeof c[k] === 'boolean' ? (c[k] as boolean) : fb;
            return {
              showTargetName: capBool(
                'showTargetName',
                DEFAULT_SENSOR_EXPORT_CAPTION.showTargetName
              ),
              showCoordinates: capBool(
                'showCoordinates',
                DEFAULT_SENSOR_EXPORT_CAPTION.showCoordinates
              ),
              showDateTime: capBool('showDateTime', DEFAULT_SENSOR_EXPORT_CAPTION.showDateTime),
              showLocation: capBool('showLocation', DEFAULT_SENSOR_EXPORT_CAPTION.showLocation),
              showConstellation: capBool(
                'showConstellation',
                DEFAULT_SENSOR_EXPORT_CAPTION.showConstellation
              ),
              showEquipmentFov: capBool(
                'showEquipmentFov',
                DEFAULT_SENSOR_EXPORT_CAPTION.showEquipmentFov
              ),
              showRotation: capBool('showRotation', DEFAULT_SENSOR_EXPORT_CAPTION.showRotation),
              showNoxChartBrand: capBool(
                'showNoxChartBrand',
                DEFAULT_SENSOR_EXPORT_CAPTION.showNoxChartBrand
              ),
              customNote:
                typeof c.customNote === 'string' ? c.customNote.slice(0, 80) : '',
            };
          })(),
    showStarHop: boolOr('showStarHop', DEFAULT_OPTICS.showStarHop),
    showSelectionMark: boolOr('showSelectionMark', DEFAULT_OPTICS.showSelectionMark),
  };
}

function loadSavedOpticsSettings(): OpticsSettings {
  try {
    const raw = localStorage.getItem(OPTICS_STORAGE_KEY);
    if (raw) {
      return sanitizeOpticsSettings(JSON.parse(raw) as unknown);
    }
  } catch {
    // Ignore storage parse failure
  }
  return {
    ...DEFAULT_OPTICS,
    sensorExportCaption: { ...DEFAULT_SENSOR_EXPORT_CAPTION },
  };
}

function createInitialObserver(): ObserverConfig {
  try {
    const raw = localStorage.getItem(ACTIVE_SITE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        name?: string;
        lat?: number;
        lon?: number;
        minAltitudeDeg?: number;
        highlightAboveMinAlt?: boolean;
        bortleEnabled?: boolean;
        bortleClass?: number;
      };
      if (
        typeof parsed.lat === 'number' &&
        Number.isFinite(parsed.lat) &&
        typeof parsed.lon === 'number' &&
        Number.isFinite(parsed.lon)
      ) {
        const siteName =
          typeof parsed.name === 'string' && parsed.name.trim()
            ? parsed.name
            : DEFAULT_OBSERVER.name;
        const siteLat = Math.max(-90, Math.min(90, parsed.lat));
        const siteLon = Math.max(-180, Math.min(180, parsed.lon));
        const estimatedBortle = estimateSiteBortleClass(siteLat, siteLon, siteName).bortle;
        return {
          ...DEFAULT_OBSERVER,
          name: siteName,
          lat: siteLat,
          lon: siteLon,
          minAltitudeDeg:
            typeof parsed.minAltitudeDeg === 'number' && Number.isFinite(parsed.minAltitudeDeg)
              ? Math.max(-90, Math.min(85, parsed.minAltitudeDeg))
              : DEFAULT_OBSERVER.minAltitudeDeg,
          highlightAboveMinAlt:
            typeof parsed.highlightAboveMinAlt === 'boolean'
              ? parsed.highlightAboveMinAlt
              : DEFAULT_OBSERVER.highlightAboveMinAlt,
          bortleEnabled:
            typeof parsed.bortleEnabled === 'boolean'
              ? parsed.bortleEnabled
              : DEFAULT_OBSERVER.bortleEnabled,
          bortleClass:
            typeof parsed.bortleClass === 'number' && Number.isFinite(parsed.bortleClass)
              ? clampBortleClass(parsed.bortleClass)
              : estimatedBortle,
          timestampMs: Date.now(),
        };
      }
    }
  } catch {
    // Ignore storage parse failure
  }
  return { ...DEFAULT_OBSERVER, timestampMs: Date.now() };
}

function getDefaultHorizontalCenter(obs: ObserverConfig): { ra: number; dec: number } {
  const lstDeg = getLSTDeg(obs.timestampMs, obs.lon);
  const eq = horizontalToEquatorial(30, 180, lstDeg, obs.lat);
  return {
    ra: ((eq.raDeg / 15) % 24 + 24) % 24,
    dec: Math.max(-89.5, Math.min(89.5, eq.decDeg)),
  };
}

export default function App() {
  const initialUrl = useMemo(() => parseUrlState(), []);
  const initialAppPrefs = useMemo(() => loadSavedAppPrefs(), []);
  const initialObserver = useMemo(() => createInitialObserver(), []);
  const canvasHandleRef = useRef<StarChartCanvasHandle>(null);

  const initialCoordSystem = useMemo<CoordSystem>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('coord')
      ? initialUrl.view.coordSystem
      : initialAppPrefs.coordSystem ?? initialUrl.view.coordSystem;
  }, [initialUrl.view.coordSystem, initialAppPrefs.coordSystem]);

  const [view, setView] = useState<ChartViewState>(() => {
    const params = new URLSearchParams(window.location.search);
    const coordSystem = initialCoordSystem;
    const fsz = params.has('fsz')
      ? initialUrl.view.fsz
      : initialAppPrefs.fsz ?? initialUrl.view.fsz;
    const flipH = params.has('flipH')
      ? initialUrl.view.flipH
      : initialAppPrefs.flipH ?? initialUrl.view.flipH;
    const flipV = params.has('flipV')
      ? initialUrl.view.flipV
      : initialAppPrefs.flipV ?? initialUrl.view.flipV;

    if (coordSystem === 'horizontal' && !initialUrl.hasExplicitCoords) {
      const center = getDefaultHorizontalCenter(initialObserver);
      return {
        ...initialUrl.view,
        coordSystem,
        fsz,
        flipH,
        flipV,
        ra: center.ra,
        dec: center.dec,
      };
    }
    return {
      ...initialUrl.view,
      coordSystem,
      fsz,
      flipH,
      flipV,
    };
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('mode')) return initialUrl.theme;
    return initialAppPrefs.theme ?? initialUrl.theme;
  });
  const [redIntensity, setRedIntensity] = useState<number>(
    () => initialAppPrefs.redIntensity ?? 50
  );
  const [uiFontFamily, setUiFontFamily] = useState<UiFontFamily>(
    () => initialAppPrefs.uiFontFamily ?? 'default'
  );
  const [uiFontSizeStep, setUiFontSizeStep] = useState<number>(
    () => initialAppPrefs.uiFontSizeStep ?? 0
  );
  const [requestedSidebarTab, setRequestedSidebarTab] = useState<{
    tab: 'explore' | 'layers' | 'optics' | 'observer' | 'settings';
    seq: number;
  } | null>(null);

  // Sync UI font family, font size scaling, and automatic single-line condensation (자간·장평)
  useEffect(() => {
    const htmlEl = document.documentElement;
    const fontOpt = getUiFontOption(uiFontFamily);
    const metrics = getUiFontSizeMetrics(uiFontSizeStep);
    htmlEl.style.setProperty('--font-sans', fontOpt.cssFamily);
    htmlEl.style.setProperty(
      '--font-mono',
      uiFontFamily === 'default'
        ? '"IBM Plex Mono", "IBM Plex Sans", "Noto Sans KR", ui-monospace, SFMono-Regular, Menlo, monospace'
        : fontOpt.cssFamily
    );
    htmlEl.dataset.fontFamily = uiFontFamily;
    htmlEl.style.setProperty('--ui-font-scale', metrics.scale.toFixed(3));
    htmlEl.style.setProperty('--ui-letter-spacing', `${metrics.letterSpacingEm}em`);
    htmlEl.style.setProperty('--ui-word-spacing', `${metrics.wordSpacingEm}em`);
    htmlEl.style.setProperty('--ui-condense-x', metrics.condenseX.toFixed(3));
    htmlEl.dataset.fontStep = String(metrics.step);
    htmlEl.dataset.fontEnlarged = metrics.step > 0 ? 'true' : 'false';
  }, [uiFontFamily, uiFontSizeStep]);

  // Keep mobile/tablet browser chrome, iOS status bar & safe-area background synced with active theme
  useEffect(() => {
    const headerBg =
      theme === 'white' ? '#E2E8F0' : theme === 'red' ? '#0B0101' : '#0B0F19';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.backgroundColor = headerBg;
    document.documentElement.style.colorScheme = theme === 'white' ? 'light' : 'dark';
    document.body.style.backgroundColor = headerBg;

    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = headerBg;

    let appleStatusMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    );
    if (!appleStatusMeta) {
      appleStatusMeta = document.createElement('meta');
      appleStatusMeta.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(appleStatusMeta);
    }
    appleStatusMeta.content = theme === 'white' ? 'default' : 'black-translucent';
  }, [theme]);

  // Apply adjustable red night-vision intensity (brightness / saturation / contrast) when red theme is active
  const redOverlayAlpha = useMemo(() => {
    if (theme !== 'red') return 0;
    const t = Math.max(0, Math.min(1, redIntensity / 100));
    if (t <= 0.5) return 0;
    return Number((((t - 0.5) / 0.5) * 0.42).toFixed(3));
  }, [theme, redIntensity]);

  useEffect(() => {
    const rootEl = document.getElementById('root');
    if (!rootEl) return;
    if (theme !== 'red') {
      rootEl.style.filter = '';
      return;
    }
    const t = Math.max(0, Math.min(1, redIntensity / 100));
    let brightness = 1;
    let saturate = 1;
    let contrast = 1;
    if (t <= 0.5) {
      const u = t / 0.5;
      brightness = 1.85 - 0.85 * u;
      saturate = 0.62 + 0.38 * u;
      contrast = 0.92 + 0.08 * u;
    } else {
      const u = (t - 0.5) / 0.5;
      brightness = 1.0 - 0.46 * u;
      saturate = 1.0 + 0.35 * u;
      contrast = 1.0 + 0.08 * u;
    }
    rootEl.style.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(
      3
    )}) contrast(${contrast.toFixed(3)})`;
    return () => {
      rootEl.style.filter = '';
    };
  }, [theme, redIntensity]);
  const initialLayerBundle = useMemo<LayerSettingsBundle>(() => {
    const coordMatchedDefaultLayers: LayerSettings = {
      ...DEFAULT_LAYERS,
      dsoCategories: { ...DEFAULT_LAYERS.dsoCategories },
      showGridEq: initialCoordSystem === 'equatorial',
      showGridAltAz: initialCoordSystem === 'horizontal',
      showHorizon: initialCoordSystem === 'horizontal',
      showTerrain: initialCoordSystem === 'horizontal',
    };
    const saved = loadSavedLayerSettings(coordMatchedDefaultLayers, DEFAULT_HIPS);
    if (saved) return saved;
    return {
      layers: coordMatchedDefaultLayers,
      hips: { ...DEFAULT_HIPS },
    };
  }, [initialCoordSystem]);
  const [layers, setLayers] = useState<LayerSettings>(() => initialLayerBundle.layers);
  const [optics, setOptics] = useState<OpticsSettings>(() => loadSavedOpticsSettings());
  const [observer, setObserver] = useState<ObserverConfig>(initialObserver);
  const [hips, setHips] = useState<HipsSettings>(() => initialLayerBundle.hips);
  const [tempHiddenLayers, setTempHiddenLayers] = useState<{
    constellations: boolean;
    solar: boolean;
    stars: boolean;
    doubles: boolean;
    dso: boolean;
    grids: boolean;
    hips: boolean;
  }>({
    constellations: false,
    solar: false,
    stars: false,
    doubles: false,
    dso: false,
    grids: false,
    hips: false,
  });

  const toggleTempHiddenLayer = useCallback(
    (key: 'constellations' | 'solar' | 'stars' | 'doubles' | 'dso' | 'grids' | 'hips') => {
      setTempHiddenLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const effectiveLayers = useMemo<LayerSettings>(() => {
    const anyLayerHidden =
      tempHiddenLayers.constellations ||
      tempHiddenLayers.solar ||
      tempHiddenLayers.stars ||
      tempHiddenLayers.doubles ||
      tempHiddenLayers.dso ||
      tempHiddenLayers.grids;
    if (!anyLayerHidden) return layers;
    return {
      ...layers,
      // 별자리
      ...(tempHiddenLayers.constellations
        ? {
            showConstellationLines: false,
            showConstellationBoundaries: false,
            showConstellationNames: false,
          }
        : {}),
      // 태양계
      ...(tempHiddenLayers.solar
        ? {
            showSolarSystem: false,
            showPlanetSurface: false,
            showSolarSystemOrbits: false,
            showSolarSystemLabels: false,
          }
        : {}),
      // 항성 표시 옵션
      ...(tempHiddenLayers.stars
        ? {
            showStarColors: false,
            showStarLabels: false,
            showProperStarNames: false,
            enableGaiaLive: false,
            showFieldStars: false,
          }
        : {}),
      // 이중성
      ...(tempHiddenLayers.doubles
        ? {
            showDoubleStars: false,
            showDoublePairs: false,
            showMultipleStars: false,
            showDoubleStarLabels: false,
          }
        : {}),
      // 심우주
      ...(tempHiddenLayers.dso
        ? {
            showDso: false,
            showMessierCatalog: false,
            showCaldwellCatalog: false,
            showDsoLabels: false,
            showNebulaContours: false,
            showMilkyWay: false,
          }
        : {}),
      // 좌표 그리드 & 기준선
      ...(tempHiddenLayers.grids
        ? {
            showGridEq: false,
            showGridAltAz: false,
            showHorizon: false,
            showTerrain: false,
            showEcliptic: false,
          }
        : {}),
    };
  }, [tempHiddenLayers, layers]);

  const effectiveHips = useMemo<HipsSettings>(
    () => (tempHiddenLayers.hips ? { ...hips, enabled: false } : hips),
    [tempHiddenLayers.hips, hips]
  );

  const emptySolarTrails = useMemo<Record<string, number>>(() => ({}), []);
  const emptySessionIds = useMemo<Set<string>>(() => new Set<string>(), []);

  const [savedSites, setSavedSites] = useState<SavedObservingSite[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_SITES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedObservingSite[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage parse failure
    }
    return [];
  });
  const savedSitesRef = useRef<SavedObservingSite[]>(savedSites);
  savedSitesRef.current = savedSites;
  const [siteMapOpen, setSiteMapOpen] = useState(false);
  const [siteMapFocus, setSiteMapFocus] = useState<SavedObservingSite | null>(null);

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [detailWindowOpen, setDetailWindowOpen] = useState(false);
  const detailWindowOpenRef = useRef<boolean>(detailWindowOpen);
  detailWindowOpenRef.current = detailWindowOpen;
  const [infoWindowDockSide, setInfoWindowDockSide] = useState<'left' | 'right'>(() => {
    try {
      const saved = localStorage.getItem(INFO_DOCK_SIDE_STORAGE_KEY);
      if (saved === 'left' || saved === 'right') return saved;
    } catch {
      // Ignore storage read failure
    }
    return 'right';
  });
  useEffect(() => {
    try {
      localStorage.setItem(INFO_DOCK_SIDE_STORAGE_KEY, infoWindowDockSide);
    } catch {
      // Ignore storage write failure
    }
  }, [infoWindowDockSide]);
  const [centerLocked, setCenterLocked] = useState(false);
  const [solarTrails, setSolarTrails] = useState<Record<string, number>>({});
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [timeBarOpen, setTimeBarOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<
    'session' | 'challenge' | 'asterism' | 'log'
  >('session');

  // Auto-collapse left & right drawers when mouse leaves them (with drag & native-picker guards)
  const leftHideTimerRef = useRef<number | null>(null);
  const rightHideTimerRef = useRef<number | null>(null);
  const pointerInLeftRef = useRef(false);
  const pointerInRightRef = useRef(false);
  const pointerDownInLeftRef = useRef(false);
  const pointerDownInRightRef = useRef(false);
  const nativePickerInLeftRef = useRef(false);
  const nativePickerInRightRef = useRef(false);
  const draggingInRightRef = useRef(false);
  const siteMapOpenRef = useRef(siteMapOpen);
  siteMapOpenRef.current = siteMapOpen;

  const clearLeftHideTimer = useCallback(() => {
    if (leftHideTimerRef.current !== null) {
      window.clearTimeout(leftHideTimerRef.current);
      leftHideTimerRef.current = null;
    }
  }, []);

  const clearRightHideTimer = useCallback(() => {
    if (rightHideTimerRef.current !== null) {
      window.clearTimeout(rightHideTimerRef.current);
      rightHideTimerRef.current = null;
    }
  }, []);

  const scheduleLeftHide = useCallback(
    (delayMs = 260) => {
      clearLeftHideTimer();
      leftHideTimerRef.current = window.setTimeout(() => {
        leftHideTimerRef.current = null;
        if (
          pointerInLeftRef.current ||
          pointerDownInLeftRef.current ||
          nativePickerInLeftRef.current ||
          siteMapOpenRef.current ||
          confirmRequestRef.current
        ) {
          return;
        }
        setLeftOpen(false);
      }, delayMs);
    },
    [clearLeftHideTimer]
  );

  const scheduleRightHide = useCallback(
    (delayMs = 260) => {
      clearRightHideTimer();
      rightHideTimerRef.current = window.setTimeout(() => {
        rightHideTimerRef.current = null;
        if (
          pointerInRightRef.current ||
          pointerDownInRightRef.current ||
          nativePickerInRightRef.current ||
          draggingInRightRef.current ||
          confirmRequestRef.current
        ) {
          return;
        }
        setRightOpen(false);
      }, delayMs);
    },
    [clearRightHideTimer]
  );

  useEffect(() => {
    if (!leftOpen) {
      clearLeftHideTimer();
      pointerInLeftRef.current = false;
      pointerDownInLeftRef.current = false;
      nativePickerInLeftRef.current = false;
    }
  }, [leftOpen, clearLeftHideTimer]);

  useEffect(() => {
    if (!rightOpen) {
      clearRightHideTimer();
      pointerInRightRef.current = false;
      pointerDownInRightRef.current = false;
      nativePickerInRightRef.current = false;
      draggingInRightRef.current = false;
    }
  }, [rightOpen, clearRightHideTimer]);

  useEffect(() => {
    const onWinPointerUp = () => {
      if (pointerDownInLeftRef.current) {
        pointerDownInLeftRef.current = false;
        if (!pointerInLeftRef.current && !nativePickerInLeftRef.current) {
          scheduleLeftHide(220);
        }
      }
      if (pointerDownInRightRef.current) {
        pointerDownInRightRef.current = false;
        if (!pointerInRightRef.current && !nativePickerInRightRef.current && !draggingInRightRef.current) {
          scheduleRightHide(220);
        }
      }
    };
    const onWinDragEnd = () => {
      if (draggingInRightRef.current) {
        draggingInRightRef.current = false;
        if (!pointerInRightRef.current && !nativePickerInRightRef.current) {
          scheduleRightHide(220);
        }
      }
    };
    const onWinFocus = () => {
      if (nativePickerInLeftRef.current) {
        nativePickerInLeftRef.current = false;
        if (!pointerInLeftRef.current) {
          scheduleLeftHide(220);
        }
      }
      if (nativePickerInRightRef.current) {
        nativePickerInRightRef.current = false;
        if (!pointerInRightRef.current) {
          scheduleRightHide(220);
        }
      }
    };
    window.addEventListener('pointerup', onWinPointerUp);
    window.addEventListener('pointercancel', onWinPointerUp);
    window.addEventListener('dragend', onWinDragEnd);
    window.addEventListener('focus', onWinFocus);
    return () => {
      window.removeEventListener('pointerup', onWinPointerUp);
      window.removeEventListener('pointercancel', onWinPointerUp);
      window.removeEventListener('dragend', onWinDragEnd);
      window.removeEventListener('focus', onWinFocus);
      clearLeftHideTimer();
      clearRightHideTimer();
    };
  }, [scheduleLeftHide, scheduleRightHide, clearLeftHideTimer, clearRightHideTimer]);
  const [observationLogStore, setObservationLogStore] = useState<ObservationLogStoreState>(() =>
    loadObservationLogStore()
  );
  const observationLogStoreRef = useRef<ObservationLogStoreState>(observationLogStore);
  observationLogStoreRef.current = observationLogStore;

  const [confirmRequest, setConfirmRequest] = useState<PendingConfirmRequest | null>(null);
  const confirmRequestRef = useRef<PendingConfirmRequest | null>(null);
  confirmRequestRef.current = confirmRequest;
  const requestConfirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    if (confirmRequestRef.current) {
      confirmRequestRef.current.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      const nextReq: PendingConfirmRequest = { options, resolve };
      confirmRequestRef.current = nextReq;
      setConfirmRequest(nextReq);
    });
  }, []);
  const handleResolveConfirm = useCallback((confirmed: boolean) => {
    const cur = confirmRequestRef.current;
    confirmRequestRef.current = null;
    setConfirmRequest(null);
    cur?.resolve(confirmed);
  }, []);

  const [challengeDraft, setChallengeDraft] = useState<ChallengeTrack | null>(null);
  const challengeDraftRef = useRef<ChallengeTrack | null>(challengeDraft);
  challengeDraftRef.current = challengeDraft;
  const [challengeDraftIsNew, setChallengeDraftIsNew] = useState(false);
  const [challengePickAllowEmpty, setChallengePickAllowEmpty] = useState(true);
  const [challengeDraftNotice, setChallengeDraftNotice] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [sensorPngExporting, setSensorPngExporting] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  // Custom Asterism & Star Chain Drawing Mode State
  const [asterismStore, setAsterismStore] = useState<AsterismStoreState>(() => {
    const base = loadAsterismStateFromLocal();
    try {
      const astParam = new URLSearchParams(window.location.search).get('ast');
      if (astParam) {
        const decoded = decodeAsterismsFromUrlParam(astParam, base.activeLayerId);
        if (decoded && (decoded.asterisms.length > 0 || decoded.objects.length > 0)) {
          const existingLayerIds = new Set(base.layers.map((l) => l.id));
          const mergedLayers = [...base.layers];
          for (const l of decoded.layers) {
            if (!existingLayerIds.has(l.id)) {
              mergedLayers.push({ ...l, visible: true });
              existingLayerIds.add(l.id);
            }
          }
          const existingGrpIds = new Set(base.asterisms.map((g) => g.id));
          const mergedAsterisms = [...base.asterisms];
          for (const g of decoded.asterisms) {
            if (!existingGrpIds.has(g.id)) {
              mergedAsterisms.push(g);
              existingGrpIds.add(g.id);
            }
          }
          const existingObjIds = new Set(base.objects.map((o) => o.id));
          const mergedObjects = [...base.objects];
          for (const o of decoded.objects) {
            if (!existingObjIds.has(o.id)) {
              mergedObjects.push(o);
              existingObjIds.add(o.id);
            }
          }
          return {
            ...base,
            layers: mergedLayers,
            asterisms: mergedAsterisms,
            objects: mergedObjects,
          };
        }
      }
    } catch {
      // Ignore malformed ?ast parameter
    }
    return base;
  });
  const [asterismMode, setAsterismMode] = useState(false);
  const [asterismTool, setAsterismTool] = useState<AsterismTool>('select');
  const [asterismPopover, setAsterismPopover] = useState<AsterismToolboxPopover>('none');
  const [asterismSelectedId, setAsterismSelectedId] = useState<string | null>(null);
  const [asterismDraft, setAsterismDraft] = useState<AsterismDraftState | null>(null);
  type AsterismHistorySnap = {
    layers: AsterismLayer[];
    activeLayerId: string;
    asterisms: AsterismGroup[];
    activeAsterismId: string | null;
    objects: AsterismObject[];
  };
  const [asterismPast, setAsterismPast] = useState<AsterismHistorySnap[]>([]);
  const [asterismFuture, setAsterismFuture] = useState<AsterismHistorySnap[]>([]);
  const asterismStoreRef = useRef<AsterismStoreState>(asterismStore);
  asterismStoreRef.current = asterismStore;
  const asterismDragSnapRef = useRef<AsterismHistorySnap | null>(null);

  useEffect(() => {
    saveAsterismStateToLocal(asterismStore);
  }, [asterismStore]);

  const [cardinalMenuOpen, setCardinalMenuOpen] = useState(false);
  const [cardinalMenuPos, setCardinalMenuPos] = useState<{ left: number; top: number } | null>(
    null
  );
  const headerRef = useRef<HTMLElement>(null);
  const cardinalMenuRef = useRef<HTMLDivElement>(null);
  const cardinalDropdownRef = useRef<HTMLDivElement>(null);
  const [printPreview, setPrintPreview] = useState<{
    dataUrl: string;
    title: string;
  } | null>(null);

  const updateCardinalMenuPos = useCallback(() => {
    const btn = cardinalMenuRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 96;
    const centeredLeft = rect.left + rect.width / 2 - menuWidth / 2;
    const clampedLeft = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, centeredLeft));
    setCardinalMenuPos({ left: clampedLeft, top: rect.bottom + 6 });
  }, []);

  useEffect(() => {
    if (!cardinalMenuOpen) return;
    updateCardinalMenuPos();
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        cardinalMenuRef.current &&
        !cardinalMenuRef.current.contains(target) &&
        (!cardinalDropdownRef.current || !cardinalDropdownRef.current.contains(target))
      ) {
        setCardinalMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCardinalMenuOpen(false);
      }
    };
    const handleResize = () => updateCardinalMenuPos();
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleResize);
    };
  }, [cardinalMenuOpen, updateCardinalMenuPos]);

  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMenuPos, setThemeMenuPos] = useState<{ left: number; top: number } | null>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  const updateThemeMenuPos = useCallback(() => {
    const btn = themeMenuRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 112;
    const centeredLeft = rect.left + rect.width / 2 - menuWidth / 2;
    const clampedLeft = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, centeredLeft));
    setThemeMenuPos({ left: clampedLeft, top: rect.bottom + 6 });
  }, []);

  useEffect(() => {
    if (!themeMenuOpen) return;
    updateThemeMenuPos();
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(target) &&
        (!themeDropdownRef.current || !themeDropdownRef.current.contains(target))
      ) {
        setThemeMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setThemeMenuOpen(false);
      }
    };
    const handleResize = () => updateThemeMenuPos();
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleResize);
    };
  }, [themeMenuOpen, updateThemeMenuPos]);

  const [rulerMode, setRulerMode] = useState(false);
  const [rulerMeasurement, setRulerMeasurement] = useState<RulerMeasurement | null>(null);

  const handleToggleRulerMode = useCallback(() => {
    setRulerMode((prev) => {
      if (prev) {
        setRulerMeasurement(null);
        return false;
      }
      setAsterismMode(false);
      setAsterismDraft(null);
      setAsterismSelectedId(null);
      setAsterismPopover('none');
      return true;
    });
  }, []);

  const handleRulerPickPoint = useCallback((point: RulerPoint) => {
    setRulerMeasurement((prev) => {
      if (!prev || prev.end !== null) {
        return { start: point, end: null };
      }
      return { start: prev.start, end: point };
    });
  }, []);

  const handleClearRuler = useCallback(() => {
    setRulerMeasurement(null);
  }, []);

  const handleCloseRulerMode = useCallback(() => {
    setRulerMode(false);
    setRulerMeasurement(null);
  }, []);

  useEffect(() => {
    if (!rulerMode) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      setRulerMeasurement((prev) => {
        if (prev) return null;
        setRulerMode(false);
        return null;
      });
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [rulerMode]);

  useEffect(() => {
    if (!printPreview) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrintPreview(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [printPreview]);

  const viewRef = useRef<ChartViewState>(view);
  viewRef.current = view;
  const observerRef = useRef<ObserverConfig>(observer);
  observerRef.current = observer;
  const selectedRef = useRef<SelectedItem | null>(selected);
  selectedRef.current = selected;
  const centerLockedRef = useRef<boolean>(centerLocked);
  centerLockedRef.current = centerLocked;
  const solarTrailsRef = useRef<Record<string, number>>(solarTrails);
  solarTrailsRef.current = solarTrails;
  const autoReflectorFlipRestoreRef = useRef<{ flipH: boolean; flipV: boolean } | null>(null);
  const prevReflectorEyepieceRef = useRef<boolean | null>(null);
  const lockedHzRef = useRef<{
    altDeg: number;
    azDeg: number;
    ra: number;
    dec: number;
    lat: number;
  } | null>(null);

  const handleChangeView = useCallback(
    (updater: React.SetStateAction<ChartViewState>) => {
      const prev = viewRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next.flipH !== prev.flipH || next.flipV !== prev.flipV) {
        autoReflectorFlipRestoreRef.current = null;
      }
      viewRef.current = next;
      if (next.coordSystem !== 'horizontal') {
        lockedHzRef.current = null;
      }
      setView(next);
    },
    []
  );

  const handleChangeObserver = useCallback(
    (updater: (prev: ObserverConfig) => ObserverConfig) => {
      const prevObs = observerRef.current;
      let nextObs = updater(prevObs);
      const siteChanged =
        Math.abs(nextObs.lat - prevObs.lat) > 1e-5 ||
        Math.abs(nextObs.lon - prevObs.lon) > 1e-5 ||
        nextObs.name !== prevObs.name;
      if (siteChanged && nextObs.bortleClass === prevObs.bortleClass) {
        nextObs = {
          ...nextObs,
          bortleClass: estimateSiteBortleClass(nextObs.lat, nextObs.lon, nextObs.name).bortle,
        };
      }
      observerRef.current = nextObs;
      setObserver(nextObs);

      // Keep selected Solar System body's live ephemeris synchronized as time advances
      let activeSelected = selectedRef.current;
      if (
        activeSelected?.kind === 'planet' &&
        nextObs.timestampMs !== prevObs.timestampMs
      ) {
        const freshBody = getSolarSystemBodies(nextObs.timestampMs).find(
          (b) => b.id === activeSelected!.data.id
        );
        if (freshBody) {
          activeSelected = { kind: 'planet', data: freshBody };
          selectedRef.current = activeSelected;
          setSelected(activeSelected);
        }
      }

      // If Center-Lock Tracking is active, keep the tracked object locked to viewport center
      // across time acceleration in BOTH Horizontal (Alt/Az) and Equatorial (RA/Dec) modes
      if (centerLockedRef.current && activeSelected && !slewingToCenterRef.current) {
        lockedHzRef.current = null;
        const targetRa = ((activeSelected.data.ra / 15) % 24 + 24) % 24;
        const targetDec = Math.max(-89.999, Math.min(89.999, activeSelected.data.dec));
        const curView = viewRef.current;
        if (
          Math.abs(curView.ra - targetRa) > 1e-7 ||
          Math.abs(curView.dec - targetDec) > 1e-7
        ) {
          const nextView: ChartViewState = {
            ...curView,
            ra: targetRa,
            dec: targetDec,
          };
          viewRef.current = nextView;
          setView(nextView);
        }
        return;
      }

      const curView = viewRef.current;
      if (
        curView.coordSystem === 'horizontal' &&
        (nextObs.timestampMs !== prevObs.timestampMs ||
          nextObs.lon !== prevObs.lon ||
          nextObs.lat !== prevObs.lat)
      ) {
        const prevLst = getLSTDeg(prevObs.timestampMs, prevObs.lon);
        const nextLst = getLSTDeg(nextObs.timestampMs, nextObs.lon);

        let altDeg: number;
        let azDeg: number;
        if (
          lockedHzRef.current &&
          Math.abs(lockedHzRef.current.ra - curView.ra) < 1e-7 &&
          Math.abs(lockedHzRef.current.dec - curView.dec) < 1e-7 &&
          Math.abs(lockedHzRef.current.lat - prevObs.lat) < 1e-7
        ) {
          altDeg = lockedHzRef.current.altDeg;
          azDeg = lockedHzRef.current.azDeg;
        } else {
          const hz = equatorialToHorizontal(
            curView.ra * 15,
            curView.dec,
            prevLst,
            prevObs.lat
          );
          altDeg = Math.max(-89.99, Math.min(89.99, hz.altDeg));
          azDeg = hz.azDeg;
        }

        const nextEq = horizontalToEquatorial(altDeg, azDeg, nextLst, nextObs.lat);
        const nextRa = ((nextEq.raDeg / 15) % 24 + 24) % 24;
        const nextDec = Math.max(-89.999, Math.min(89.999, nextEq.decDeg));
        lockedHzRef.current = {
          altDeg,
          azDeg,
          ra: nextRa,
          dec: nextDec,
          lat: nextObs.lat,
        };

        const nextView: ChartViewState = {
          ...curView,
          ra: nextRa,
          dec: nextDec,
        };
        viewRef.current = nextView;
        setView(nextView);
      } else if (curView.coordSystem !== 'horizontal') {
        lockedHzRef.current = null;
      }
    },
    []
  );

  const catalogs = useCatalogData(
    view.ra,
    view.dec,
    view.fsz,
    layers.magOffset,
    searchActive,
    layers.enableGaiaLive,
    layers.showDoubleStars,
    layers.dsoMagOffset
  );

  const [observingListsState, setObservingListsState] = useState<ObservingListsState>(() => {
    try {
      const rawLists = localStorage.getItem(OBSERVING_LISTS_STORAGE_KEY);
      if (rawLists) {
        const parsed = JSON.parse(rawLists) as Partial<ObservingListsState>;
        if (parsed && Array.isArray(parsed.lists)) {
          const validLists = parsed.lists.map((l, idx) => ({
            id: typeof l.id === 'string' && l.id ? l.id : `olist_restored_${idx}`,
            name: typeof l.name === 'string' && l.name.trim() ? l.name.trim() : `관측 목록 ${idx + 1}`,
            createdAt: typeof l.createdAt === 'number' ? l.createdAt : Date.now() + idx,
            entries: Array.isArray(l.entries) ? l.entries : [],
          }));
          const hasTonight =
            typeof parsed.tonightListId === 'string' &&
            validLists.some((l) => l.id === parsed.tonightListId);
          return {
            lists: validLists,
            tonightListId: hasTonight ? parsed.tonightListId! : null,
            tonightEntries: Array.isArray(parsed.tonightEntries) ? parsed.tonightEntries : [],
            tonightOrder: Array.isArray(parsed.tonightOrder)
              ? parsed.tonightOrder.filter((id): id is string => typeof id === 'string')
              : undefined,
            tonightLinkedOverrides:
              parsed.tonightLinkedOverrides && typeof parsed.tonightLinkedOverrides === 'object'
                ? parsed.tonightLinkedOverrides
                : {},
          };
        }
      }
      // One-time migration from legacy flat observing list
      const legacyRaw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (legacyRaw) {
        const legacyEntries = JSON.parse(legacyRaw) as ObservingSessionEntry[];
        if (Array.isArray(legacyEntries)) {
          return {
            lists: [
              {
                id: DEFAULT_OBSERVING_LIST_ID,
                name: DEFAULT_OBSERVING_LIST_NAME,
                createdAt: Date.now(),
                entries: [],
              },
            ],
            tonightListId: null,
            tonightEntries: legacyEntries,
            tonightLinkedOverrides: {},
          };
        }
      }
    } catch {
      // Ignore storage parse failure
    }
    return {
      lists: [
        {
          id: DEFAULT_OBSERVING_LIST_ID,
          name: DEFAULT_OBSERVING_LIST_NAME,
          createdAt: Date.now(),
          entries: [],
        },
      ],
      tonightListId: null,
      tonightEntries: [],
      tonightLinkedOverrides: {},
    };
  });
  const observingListsRef = useRef<ObservingListsState>(observingListsState);
  observingListsRef.current = observingListsState;

  const activeTonightList = useMemo(() => {
    if (!observingListsState.tonightListId) return null;
    return (
      observingListsState.lists.find((l) => l.id === observingListsState.tonightListId) ?? null
    );
  }, [observingListsState.lists, observingListsState.tonightListId]);

  const sessionPlan = useMemo(() => {
    const manual = observingListsState.tonightEntries;
    const manualIds = new Set(manual.map((e) => e.id));
    let combined: ObservingSessionEntry[] = manual;

    if (activeTonightList) {
      const overrides = observingListsState.tonightLinkedOverrides ?? {};
      const linkedProjected: ObservingSessionEntry[] = [];
      for (const entry of activeTonightList.entries) {
        if (manualIds.has(entry.id)) continue;
        const ov = overrides[entry.id];
        if (ov?.excluded) continue;
        linkedProjected.push({
          ...entry,
          observed: ov?.observed !== undefined ? ov.observed : entry.observed,
          notes: ov?.notes !== undefined ? ov.notes : entry.notes,
        });
      }
      combined = [...manual, ...linkedProjected];
    }

    const order = observingListsState.tonightOrder;
    if (!order || order.length === 0) return combined;
    const rank = new Map<string, number>();
    order.forEach((id, i) => rank.set(id, i));
    return [...combined].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  }, [
    observingListsState.tonightEntries,
    observingListsState.tonightOrder,
    observingListsState.tonightLinkedOverrides,
    activeTonightList,
  ]);

  const [challenges, setChallenges] = useState<ChallengeTrack[]>(() => {
    try {
      const raw = localStorage.getItem(CHALLENGES_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as ChallengeTrack[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage parse failure
    }
    return createDefaultChallengeTracks();
  });
  const challengesRef = useRef<ChallengeTrack[]>(challenges);
  challengesRef.current = challenges;

  // Hydrate built-in challenge checkpoints once external /public/data/dsos-bright.json loads
  useEffect(() => {
    if (catalogs.dsosBright.length === 0) return;
    setChallenges((prev) => hydrateChallengeTracksWithCatalog(prev, catalogs.dsosBright));
  }, [catalogs.dsosBright]);

  const [equipmentLocker, setEquipmentLocker] = useState<EquipmentLockerState>(() => {
    try {
      const raw = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EquipmentLockerState;
        if (parsed && Array.isArray(parsed.items)) {
          return {
            items: parsed.items,
            activeIds: parsed.activeIds ?? {},
          };
        }
      }
    } catch {
      // Ignore storage parse failure
    }
    return DEFAULT_EQUIPMENT_LOCKER;
  });

  // Ensure deep catalogs are loaded if any saved observing list or tonight session contains NGC/IC/HIP/WDS objects
  useEffect(() => {
    const allEntries = [
      ...observingListsState.tonightEntries,
      ...observingListsState.lists.flatMap((l) => l.entries),
    ];
    if (allEntries.length === 0) return;
    if (allEntries.some((e) => e.kind === 'dso')) {
      void ensureDeepDsos();
    }
    if (allEntries.some((e) => e.kind === 'star')) {
      void ensureDeepStars();
    }
    if (allEntries.some((e) => e.kind === 'double')) {
      void ensureDoubleStars();
    }
  }, [observingListsState]);

  // Sync URL query params continuously using History API replaceState
  useEffect(() => {
    const timer = window.setTimeout(() => {
      syncUrlState(view, theme);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [view, theme]);

  // Persist categorized observing lists locally
  useEffect(() => {
    try {
      localStorage.setItem(OBSERVING_LISTS_STORAGE_KEY, JSON.stringify(observingListsState));
    } catch {
      // Ignore storage quota errors
    }
  }, [observingListsState]);

  // Persist Challenge Tracks & progress locally
  useEffect(() => {
    try {
      localStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(challenges));
    } catch {
      // Ignore storage quota errors
    }
  }, [challenges]);

  // Persist Equipment Locker locally
  useEffect(() => {
    try {
      localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equipmentLocker));
    } catch {
      // Ignore storage quota errors
    }
  }, [equipmentLocker]);

  // Persist Saved Observing Sites locally
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_SITES_STORAGE_KEY, JSON.stringify(savedSites));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedSites]);

  // Persist active observing site coordinates, Bortle class & altitude filter locally
  useEffect(() => {
    try {
      localStorage.setItem(
        ACTIVE_SITE_STORAGE_KEY,
        JSON.stringify({
          name: observer.name,
          lat: observer.lat,
          lon: observer.lon,
          minAltitudeDeg: observer.minAltitudeDeg,
          highlightAboveMinAlt: observer.highlightAboveMinAlt,
          bortleEnabled: observer.bortleEnabled,
          bortleClass: observer.bortleClass,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [
    observer.name,
    observer.lat,
    observer.lon,
    observer.minAltitudeDeg,
    observer.highlightAboveMinAlt,
    observer.bortleEnabled,
    observer.bortleClass,
  ]);

  // Persist layer & HiPS settings locally so they are restored on next load
  useEffect(() => {
    saveLayerSettingsToLocal(layers, hips);
  }, [layers, hips]);

  // Persist optics settings (eyepiece, sensor framing, finder, overlays) locally
  useEffect(() => {
    try {
      localStorage.setItem(OPTICS_STORAGE_KEY, JSON.stringify(optics));
    } catch {
      // Ignore storage quota errors
    }
  }, [optics]);

  // Persist theme & core chart view preferences locally
  useEffect(() => {
    try {
      const prefs: SavedAppPrefs = {
        theme,
        redIntensity,
        uiFontFamily,
        uiFontSizeStep,
        coordSystem: view.coordSystem,
        fsz: view.fsz,
        flipH: view.flipH,
        flipV: view.flipV,
      };
      localStorage.setItem(APP_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    theme,
    redIntensity,
    uiFontFamily,
    uiFontSizeStep,
    view.coordSystem,
    view.fsz,
    view.flipH,
    view.flipV,
  ]);

  // Firebase Authentication & Real-time Cloud Firestore Synchronization (onSnapshot on users/{uid} & users/{uid}/data)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [cloudReconnectKey, setCloudReconnectKey] = useState(0);

  const authUserRef = useRef<User | null>(null);
  authUserRef.current = authUser;
  const hydratingCloudRef = useRef(false);
  const cloudHydratedUidRef = useRef<string | null>(null);
  const lastSyncedHashesRef = useRef<SyncHashes | null>(null);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const updatedBadgeTimerRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);
  const pullInFlightRef = useRef(false);
  const realtimeListenerFailedRef = useRef(false);

  const currentCloudPayload = useMemo<CloudSyncPayload>(
    () => ({
      root: {
        profile: authUser
          ? {
              displayName: authUser.displayName,
              email: authUser.email,
              photoURL: authUser.photoURL,
            }
          : undefined,
        prefs: {
          theme,
          coordSystem: view.coordSystem,
          flipH: view.flipH,
          flipV: view.flipV,
          infoWindowDockSide,
        },
        layers,
        hips,
        optics,
        activeSite: {
          name: observer.name,
          lat: observer.lat,
          lon: observer.lon,
          minAltitudeDeg: observer.minAltitudeDeg,
          highlightAboveMinAlt: observer.highlightAboveMinAlt,
          bortleEnabled: observer.bortleEnabled,
          bortleClass: observer.bortleClass,
        },
        savedSites,
        equipmentLocker,
      },
      observingLists: observingListsState,
      observationLogs: observationLogStore,
      challenges,
      asterisms: asterismStore,
    }),
    [
      authUser,
      theme,
      view.coordSystem,
      view.flipH,
      view.flipV,
      infoWindowDockSide,
      layers,
      hips,
      optics,
      observer.name,
      observer.lat,
      observer.lon,
      observer.minAltitudeDeg,
      observer.highlightAboveMinAlt,
      observer.bortleEnabled,
      observer.bortleClass,
      savedSites,
      equipmentLocker,
      observingListsState,
      observationLogStore,
      challenges,
      asterismStore,
    ]
  );
  const currentCloudPayloadRef = useRef<CloudSyncPayload>(currentCloudPayload);
  currentCloudPayloadRef.current = currentCloudPayload;

  const scheduleUpdatedBadgeClear = useCallback(() => {
    if (updatedBadgeTimerRef.current !== null) {
      window.clearTimeout(updatedBadgeTimerRef.current);
    }
    updatedBadgeTimerRef.current = window.setTimeout(() => {
      updatedBadgeTimerRef.current = null;
      setSyncStatus((prev) => (prev === 'updated' ? 'saved' : prev));
    }, 3500);
  }, []);

  const applyLoadedCloudData = useCallback(
    (
      loaded: LoadedCloudData,
      user: User,
      mode: 'initial' | 'poll',
      removedSubdocs: CloudSubDocKey[] = []
    ): { changed: boolean } => {
      const basePayload = currentCloudPayloadRef.current;
      const currentHashes = computePayloadHashes(basePayload);
      const prevHashes = lastSyncedHashesRef.current;
      const removedSet = new Set<CloudSubDocKey>(removedSubdocs);

      const localDirtyRoot =
        mode === 'poll' && Boolean(prevHashes && prevHashes.root !== currentHashes.root);
      const localDirtyLists =
        mode === 'poll' &&
        Boolean(prevHashes && prevHashes.observingLists !== currentHashes.observingLists);
      const localDirtyLogs =
        mode === 'poll' &&
        Boolean(prevHashes && prevHashes.observationLogs !== currentHashes.observationLogs);
      const localDirtyChallenges =
        mode === 'poll' &&
        Boolean(prevHashes && prevHashes.challenges !== currentHashes.challenges);
      const localDirtyAsterisms =
        mode === 'poll' &&
        Boolean(prevHashes && prevHashes.asterisms !== currentHashes.asterisms);

      let changed = false;

      let nextTheme = basePayload.root.prefs?.theme ?? DEFAULT_THEME;
      let nextCoordSystem = basePayload.root.prefs?.coordSystem ?? DEFAULT_VIEW.coordSystem;
      let nextFlipH = basePayload.root.prefs?.flipH ?? false;
      let nextFlipV = basePayload.root.prefs?.flipV ?? false;
      let nextInfoDockSide: 'left' | 'right' = basePayload.root.prefs?.infoWindowDockSide ?? 'right';
      let nextLayers = basePayload.root.layers ?? DEFAULT_LAYERS;
      let nextHips = basePayload.root.hips ?? DEFAULT_HIPS;
      let nextOptics = basePayload.root.optics ?? DEFAULT_OPTICS;
      let nextActiveSite = basePayload.root.activeSite ?? {
        name: DEFAULT_OBSERVER.name,
        lat: DEFAULT_OBSERVER.lat,
        lon: DEFAULT_OBSERVER.lon,
        minAltitudeDeg: DEFAULT_OBSERVER.minAltitudeDeg,
        highlightAboveMinAlt: DEFAULT_OBSERVER.highlightAboveMinAlt,
        bortleEnabled: DEFAULT_OBSERVER.bortleEnabled,
        bortleClass: DEFAULT_OBSERVER.bortleClass,
      };
      let nextSavedSites = basePayload.root.savedSites ?? [];
      let nextEquipment = basePayload.root.equipmentLocker ?? DEFAULT_EQUIPMENT_LOCKER;
      let nextObservingLists = basePayload.observingLists;
      let nextObservationLogs = basePayload.observationLogs;
      let nextChallenges = basePayload.challenges;
      let nextAsterisms = basePayload.asterisms;

      const serialize = (val: unknown) => JSON.stringify(stripUndefinedDeep(val));

      hydratingCloudRef.current = true;
      try {
        const cloudRoot = !localDirtyRoot ? loaded.root : null;
        if (cloudRoot) {
          if (cloudRoot.prefs) {
            const p = cloudRoot.prefs;
            if (p.theme === 'dark' || p.theme === 'white' || p.theme === 'red') {
              nextTheme = p.theme;
            }
            if (p.coordSystem === 'horizontal' || p.coordSystem === 'equatorial') {
              nextCoordSystem = p.coordSystem;
            }
            if (typeof p.flipH === 'boolean') nextFlipH = p.flipH;
            if (typeof p.flipV === 'boolean') nextFlipV = p.flipV;
            if (p.infoWindowDockSide === 'left' || p.infoWindowDockSide === 'right') {
              nextInfoDockSide = p.infoWindowDockSide;
            }

            const basePrefs = basePayload.root.prefs;
            if (nextTheme !== (basePrefs?.theme ?? DEFAULT_THEME)) {
              setTheme(nextTheme);
              changed = true;
            }
            if (
              nextCoordSystem !== (basePrefs?.coordSystem ?? DEFAULT_VIEW.coordSystem) ||
              nextFlipH !== (basePrefs?.flipH ?? false) ||
              nextFlipV !== (basePrefs?.flipV ?? false)
            ) {
              setView((prev) => ({
                ...prev,
                coordSystem: nextCoordSystem,
                flipH: nextFlipH,
                flipV: nextFlipV,
              }));
              changed = true;
            }
            if (nextInfoDockSide !== (basePrefs?.infoWindowDockSide ?? 'right')) {
              setInfoWindowDockSide(nextInfoDockSide);
              changed = true;
            }
          }

          if (cloudRoot.layers) {
            const candidate = sanitizeLayerSettings(cloudRoot.layers, DEFAULT_LAYERS);
            if (serialize(candidate) !== serialize(nextLayers)) {
              nextLayers = candidate;
              setLayers(nextLayers);
              changed = true;
            }
          }

          if (cloudRoot.hips) {
            const candidate = sanitizeHipsSettings(cloudRoot.hips, DEFAULT_HIPS);
            if (serialize(candidate) !== serialize(nextHips)) {
              nextHips = candidate;
              setHips(nextHips);
              changed = true;
            }
          }

          if (cloudRoot.optics) {
            const candidate = sanitizeOpticsSettings(cloudRoot.optics);
            if (
              serialize(stripEphemeralOptics(candidate)) !==
              serialize(stripEphemeralOptics(nextOptics))
            ) {
              nextOptics = {
                ...candidate,
                showSelectionMark: nextOptics.showSelectionMark,
              };
              setOptics(nextOptics);
              changed = true;
            }
          }

          if (
            cloudRoot.activeSite &&
            typeof cloudRoot.activeSite.lat === 'number' &&
            Number.isFinite(cloudRoot.activeSite.lat) &&
            typeof cloudRoot.activeSite.lon === 'number' &&
            Number.isFinite(cloudRoot.activeSite.lon)
          ) {
            const siteName =
              typeof cloudRoot.activeSite.name === 'string' && cloudRoot.activeSite.name.trim()
                ? cloudRoot.activeSite.name
                : DEFAULT_OBSERVER.name;
            const siteLat = Math.max(-90, Math.min(90, cloudRoot.activeSite.lat));
            const siteLon = Math.max(-180, Math.min(180, cloudRoot.activeSite.lon));
            const estimatedBortle = estimateSiteBortleClass(siteLat, siteLon, siteName).bortle;
            const candidate = {
              name: siteName,
              lat: siteLat,
              lon: siteLon,
              minAltitudeDeg:
                typeof cloudRoot.activeSite.minAltitudeDeg === 'number' &&
                Number.isFinite(cloudRoot.activeSite.minAltitudeDeg)
                  ? Math.max(-90, Math.min(85, cloudRoot.activeSite.minAltitudeDeg))
                  : DEFAULT_OBSERVER.minAltitudeDeg,
              highlightAboveMinAlt:
                typeof cloudRoot.activeSite.highlightAboveMinAlt === 'boolean'
                  ? cloudRoot.activeSite.highlightAboveMinAlt
                  : DEFAULT_OBSERVER.highlightAboveMinAlt,
              bortleEnabled:
                typeof cloudRoot.activeSite.bortleEnabled === 'boolean'
                  ? cloudRoot.activeSite.bortleEnabled
                  : DEFAULT_OBSERVER.bortleEnabled,
              bortleClass:
                typeof cloudRoot.activeSite.bortleClass === 'number' &&
                Number.isFinite(cloudRoot.activeSite.bortleClass)
                  ? clampBortleClass(cloudRoot.activeSite.bortleClass)
                  : estimatedBortle,
            };
            if (serialize(candidate) !== serialize(nextActiveSite)) {
              nextActiveSite = candidate;
              setObserver((prev) => ({
                ...prev,
                ...nextActiveSite,
              }));
              changed = true;
            }
          }

          if (Array.isArray(cloudRoot.savedSites)) {
            if (serialize(cloudRoot.savedSites) !== serialize(nextSavedSites)) {
              nextSavedSites = cloudRoot.savedSites;
              setSavedSites(nextSavedSites);
              changed = true;
            }
          }

          if (cloudRoot.equipmentLocker && Array.isArray(cloudRoot.equipmentLocker.items)) {
            const candidate = {
              items: cloudRoot.equipmentLocker.items,
              activeIds: cloudRoot.equipmentLocker.activeIds ?? {},
            };
            if (serialize(candidate) !== serialize(nextEquipment)) {
              nextEquipment = candidate;
              setEquipmentLocker(nextEquipment);
              changed = true;
            }
          }
        }

        if (!localDirtyLists) {
          if (loaded.observingLists && Array.isArray(loaded.observingLists.lists)) {
            const validLists = loaded.observingLists.lists.map((l, idx) => ({
              id: typeof l.id === 'string' && l.id ? l.id : `olist_cloud_${idx}`,
              name:
                typeof l.name === 'string' && l.name.trim()
                  ? l.name.trim()
                  : `관측 목록 ${idx + 1}`,
              createdAt: typeof l.createdAt === 'number' ? l.createdAt : Date.now() + idx,
              entries: Array.isArray(l.entries) ? l.entries : [],
            }));
            const hasTonight =
              typeof loaded.observingLists.tonightListId === 'string' &&
              validLists.some((l) => l.id === loaded.observingLists?.tonightListId);
            const candidate: ObservingListsState = {
              lists:
                validLists.length > 0
                  ? validLists
                  : [
                      {
                        id: DEFAULT_OBSERVING_LIST_ID,
                        name: DEFAULT_OBSERVING_LIST_NAME,
                        createdAt: Date.now(),
                        entries: [],
                      },
                    ],
              tonightListId: hasTonight ? loaded.observingLists.tonightListId : null,
              tonightEntries: Array.isArray(loaded.observingLists.tonightEntries)
                ? loaded.observingLists.tonightEntries
                : [],
              tonightOrder: Array.isArray(loaded.observingLists.tonightOrder)
                ? loaded.observingLists.tonightOrder.filter(
                    (id): id is string => typeof id === 'string'
                  )
                : undefined,
              tonightLinkedOverrides:
                loaded.observingLists.tonightLinkedOverrides &&
                typeof loaded.observingLists.tonightLinkedOverrides === 'object'
                  ? loaded.observingLists.tonightLinkedOverrides
                  : {},
            };
            if (serialize(candidate) !== currentHashes.observingLists) {
              nextObservingLists = candidate;
              setObservingListsState(nextObservingLists);
              changed = true;
            }
          } else if (removedSet.has('observingLists')) {
            const emptyLists: ObservingListsState = {
              lists: [
                {
                  id: DEFAULT_OBSERVING_LIST_ID,
                  name: DEFAULT_OBSERVING_LIST_NAME,
                  createdAt: Date.now(),
                  entries: [],
                },
              ],
              tonightListId: null,
              tonightEntries: [],
              tonightOrder: undefined,
              tonightLinkedOverrides: {},
            };
            if (serialize(emptyLists) !== currentHashes.observingLists) {
              nextObservingLists = emptyLists;
              setObservingListsState(nextObservingLists);
              changed = true;
            }
          }
        }

        if (!localDirtyLogs) {
          if (
            loaded.observationLogs &&
            Array.isArray(loaded.observationLogs.logs) &&
            loaded.observationLogs.observedMap &&
            typeof loaded.observationLogs.observedMap === 'object'
          ) {
            const candidate: ObservationLogStoreState = {
              observedMap: loaded.observationLogs.observedMap,
              logs: loaded.observationLogs.logs,
            };
            if (serialize(candidate) !== currentHashes.observationLogs) {
              nextObservationLogs = candidate;
              setObservationLogStore(nextObservationLogs);
              changed = true;
            }
          } else if (removedSet.has('observationLogs')) {
            const emptyLogs: ObservationLogStoreState = { observedMap: {}, logs: [] };
            if (serialize(emptyLogs) !== currentHashes.observationLogs) {
              nextObservationLogs = emptyLogs;
              setObservationLogStore(nextObservationLogs);
              changed = true;
            }
          }
        }

        if (!localDirtyChallenges) {
          if (loaded.challenges && Array.isArray(loaded.challenges)) {
            const snap = getCatalogSnapshot();
            const hydrated =
              snap.dsosBright.length > 0
                ? hydrateChallengeTracksWithCatalog(loaded.challenges, snap.dsosBright)
                : loaded.challenges;
            if (serialize(stripEphemeralChallenges(hydrated)) !== currentHashes.challenges) {
              const localActiveById = new Map(
                basePayload.challenges.map((t) => [t.id, Boolean(t.activeOnChart)])
              );
              nextChallenges = hydrated.map((t) => ({
                ...t,
                activeOnChart: localActiveById.get(t.id) ?? false,
              }));
              setChallenges(nextChallenges);
              changed = true;
            }
          } else if (removedSet.has('challenges')) {
            if (serialize([]) !== currentHashes.challenges) {
              nextChallenges = [];
              setChallenges(nextChallenges);
              changed = true;
            }
          }
        }

        if (!localDirtyAsterisms) {
          if (
            loaded.asterisms &&
            Array.isArray(loaded.asterisms.layers) &&
            Array.isArray(loaded.asterisms.asterisms) &&
            Array.isArray(loaded.asterisms.objects)
          ) {
            if (serialize(stripEphemeralAsterisms(loaded.asterisms)) !== currentHashes.asterisms) {
              const remoteAst = loaded.asterisms;
              const keepActiveLayerId =
                mode === 'poll' &&
                remoteAst.layers.some((l) => l.id === basePayload.asterisms.activeLayerId)
                  ? basePayload.asterisms.activeLayerId
                  : remoteAst.activeLayerId;
              const keepActiveAsterismId =
                mode === 'poll' &&
                basePayload.asterisms.activeAsterismId &&
                remoteAst.asterisms.some((g) => g.id === basePayload.asterisms.activeAsterismId)
                  ? basePayload.asterisms.activeAsterismId
                  : remoteAst.activeAsterismId;
              nextAsterisms = {
                ...remoteAst,
                activeLayerId: keepActiveLayerId,
                activeAsterismId: keepActiveAsterismId,
              };
              setAsterismStore(nextAsterisms);
              changed = true;
            }
          } else if (removedSet.has('asterisms')) {
            const clearedAst: AsterismStoreState = {
              ...basePayload.asterisms,
              asterisms: [],
              activeAsterismId: null,
              objects: [],
            };
            if (serialize(stripEphemeralAsterisms(clearedAst)) !== currentHashes.asterisms) {
              nextAsterisms = clearedAst;
              setAsterismStore(nextAsterisms);
              changed = true;
            }
          }
        }

        const mergedPayload: CloudSyncPayload = {
          root: {
            profile: {
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
            },
            prefs: {
              theme: nextTheme,
              coordSystem: nextCoordSystem,
              flipH: nextFlipH,
              flipV: nextFlipV,
              infoWindowDockSide: nextInfoDockSide,
            },
            layers: nextLayers,
            hips: nextHips,
            optics: nextOptics,
            activeSite: nextActiveSite,
            savedSites: nextSavedSites,
            equipmentLocker: nextEquipment,
          },
          observingLists: nextObservingLists,
          observationLogs: nextObservationLogs,
          challenges: nextChallenges,
          asterisms: nextAsterisms,
        };
        const computedHashes = computePayloadHashes(mergedPayload);
        lastSyncedHashesRef.current = {
          root: localDirtyRoot && prevHashes ? prevHashes.root : computedHashes.root,
          observingLists:
            localDirtyLists && prevHashes
              ? prevHashes.observingLists
              : computedHashes.observingLists,
          observationLogs:
            localDirtyLogs && prevHashes
              ? prevHashes.observationLogs
              : computedHashes.observationLogs,
          challenges:
            localDirtyChallenges && prevHashes
              ? prevHashes.challenges
              : computedHashes.challenges,
          asterisms:
            localDirtyAsterisms && prevHashes ? prevHashes.asterisms : computedHashes.asterisms,
        };
        cloudHydratedUidRef.current = user.uid;
      } finally {
        hydratingCloudRef.current = false;
      }

      return { changed };
    },
    []
  );

  const flushCloudSync = useCallback(async (uid: string, forceAll = false) => {
    if (syncInFlightRef.current || hydratingCloudRef.current) return;
    const payload = currentCloudPayloadRef.current;
    const nextHashes = computePayloadHashes(payload);
    const prevHashes = lastSyncedHashesRef.current;

    const dirtyRoot = forceAll || !prevHashes || prevHashes.root !== nextHashes.root;
    const dirtyLists =
      forceAll || !prevHashes || prevHashes.observingLists !== nextHashes.observingLists;
    const dirtyLogs =
      forceAll || !prevHashes || prevHashes.observationLogs !== nextHashes.observationLogs;
    const dirtyChallenges =
      forceAll || !prevHashes || prevHashes.challenges !== nextHashes.challenges;
    const dirtyAsterisms =
      forceAll || !prevHashes || prevHashes.asterisms !== nextHashes.asterisms;

    if (!dirtyRoot && !dirtyLists && !dirtyLogs && !dirtyChallenges && !dirtyAsterisms) {
      setSyncStatus('saved');
      return;
    }

    syncInFlightRef.current = true;
    setSyncStatus('saving');
    setSyncError(null);

    try {
      const ops: Promise<void>[] = [];
      if (dirtyRoot) {
        ops.push(saveUserCloudRoot(uid, payload.root));
      }
      if (dirtyLists) {
        ops.push(saveUserCloudSubdoc(uid, 'observingLists', payload.observingLists));
      }
      if (dirtyLogs) {
        ops.push(saveUserCloudSubdoc(uid, 'observationLogs', payload.observationLogs));
      }
      if (dirtyChallenges) {
        ops.push(saveUserCloudSubdoc(uid, 'challenges', payload.challenges));
      }
      if (dirtyAsterisms) {
        ops.push(saveUserCloudSubdoc(uid, 'asterisms', payload.asterisms));
      }
      await Promise.all(ops);
      lastSyncedHashesRef.current = nextHashes;
      cloudHydratedUidRef.current = uid;
      const now = Date.now();
      setSyncStatus('saved');
      setLastSyncedAt(now);
    } catch (err) {
      setSyncStatus('error');
      setSyncError(formatFriendlySyncError(err));
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  const pullCloudUpdates = useCallback(
    async (user: User) => {
      if (pullInFlightRef.current || hydratingCloudRef.current || syncInFlightRef.current) return;
      pullInFlightRef.current = true;
      setSyncStatus('checking');
      setSyncError(null);

      try {
        const loaded = await loadUserCloudData(user.uid, { fromServer: true });
        if (authUserRef.current?.uid !== user.uid) return;

        const now = Date.now();
        if (loaded.hasAnyCloudData) {
          const isInitial = cloudHydratedUidRef.current !== user.uid;
          const { changed } = applyLoadedCloudData(loaded, user, isInitial ? 'initial' : 'poll');
          setSyncError(null);
          setLastSyncedAt(now);
          if (changed) {
            setSyncStatus('updated');
            scheduleUpdatedBadgeClear();
          } else {
            setSyncStatus('saved');
          }
        } else if (cloudHydratedUidRef.current !== user.uid) {
          await flushCloudSync(user.uid, true);
        } else {
          setLastSyncedAt(now);
          setSyncStatus('saved');
        }
      } catch (err) {
        if (authUserRef.current?.uid !== user.uid) return;
        setSyncStatus('error');
        setSyncError(formatFriendlySyncError(err));
      } finally {
        pullInFlightRef.current = false;
      }
    },
    [applyLoadedCloudData, flushCloudSync, scheduleUpdatedBadgeClear]
  );

  // 1. Subscribe to Firebase Auth state (login/logout persistence)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (cloudSyncTimerRef.current !== null) {
        window.clearTimeout(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = null;
      }
      if (updatedBadgeTimerRef.current !== null) {
        window.clearTimeout(updatedBadgeTimerRef.current);
        updatedBadgeTimerRef.current = null;
      }

      setAuthUser(user);
      setAuthReady(true);
      setAuthError(null);

      if (!user) {
        hydratingCloudRef.current = false;
        cloudHydratedUidRef.current = null;
        lastSyncedHashesRef.current = null;
        setSyncStatus('idle');
        setSyncError(null);
        setLastSyncedAt(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (cloudSyncTimerRef.current !== null) {
        window.clearTimeout(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = null;
      }
      if (updatedBadgeTimerRef.current !== null) {
        window.clearTimeout(updatedBadgeTimerRef.current);
        updatedBadgeTimerRef.current = null;
      }
    };
  }, []);

  // 2. Attach real-time Firestore onSnapshot listeners to users/{uid} & users/{uid}/data while signed in
  useEffect(() => {
    if (!authUser) return;

    const user = authUser;
    let active = true;
    realtimeListenerFailedRef.current = false;
    hydratingCloudRef.current = true;
    setSyncStatus('loading');
    setSyncError(null);

    const unsubscribeFirestore = subscribeUserCloudData(user.uid, {
      onInitialSnapshot: (loaded) => {
        if (!active || authUserRef.current?.uid !== user.uid) return;
        const now = Date.now();

        if (loaded.hasAnyCloudData) {
          applyLoadedCloudData(loaded, user, 'initial');
          setSyncError(null);
          setSyncStatus('saved');
          setLastSyncedAt(now);
          return;
        }

        // First-time sign-in with empty cloud: seed Firestore with existing local settings & data
        void (async () => {
          try {
            const basePayload = currentCloudPayloadRef.current;
            const seedPayload: CloudSyncPayload = {
              ...basePayload,
              root: {
                ...basePayload.root,
                profile: {
                  displayName: user.displayName,
                  email: user.email,
                  photoURL: user.photoURL,
                },
              },
            };
            await Promise.all([
              saveUserCloudRoot(user.uid, seedPayload.root),
              saveUserCloudSubdoc(user.uid, 'observingLists', seedPayload.observingLists),
              saveUserCloudSubdoc(user.uid, 'observationLogs', seedPayload.observationLogs),
              saveUserCloudSubdoc(user.uid, 'challenges', seedPayload.challenges),
              saveUserCloudSubdoc(user.uid, 'asterisms', seedPayload.asterisms),
            ]);
            if (!active || authUserRef.current?.uid !== user.uid) return;
            lastSyncedHashesRef.current = computePayloadHashes(seedPayload);
            cloudHydratedUidRef.current = user.uid;
            hydratingCloudRef.current = false;
            setSyncError(null);
            setSyncStatus('saved');
            setLastSyncedAt(Date.now());
          } catch (err) {
            if (!active || authUserRef.current?.uid !== user.uid) return;
            hydratingCloudRef.current = false;
            setSyncStatus('error');
            setSyncError(formatFriendlySyncError(err));
          }
        })();
      },
      onRemoteUpdate: (loaded, removedSubdocs) => {
        if (!active || authUserRef.current?.uid !== user.uid) return;
        if (hydratingCloudRef.current) return;

        const { changed } = applyLoadedCloudData(loaded, user, 'poll', removedSubdocs);
        setSyncError(null);
        if (changed) {
          setLastSyncedAt(Date.now());
          setSyncStatus('updated');
          scheduleUpdatedBadgeClear();
        } else {
          setSyncStatus((prev) => (prev === 'error' ? 'saved' : prev));
        }
      },
      onError: (err) => {
        if (!active || authUserRef.current?.uid !== user.uid) return;
        realtimeListenerFailedRef.current = true;
        hydratingCloudRef.current = false;
        setSyncStatus('error');
        setSyncError(formatFriendlySyncError(err));
      },
    });

    return () => {
      active = false;
      unsubscribeFirestore();
    };
  }, [authUser, cloudReconnectKey, applyLoadedCloudData, scheduleUpdatedBadgeClear]);

  // Debounced auto-save (1.5s) to Firestore whenever settings or user data change while logged in
  useEffect(() => {
    if (!authUser) return;
    if (hydratingCloudRef.current || cloudHydratedUidRef.current !== authUser.uid) return;

    const nextHashes = computePayloadHashes(currentCloudPayload);
    const prevHashes = lastSyncedHashesRef.current;
    const isDirty =
      !prevHashes ||
      prevHashes.root !== nextHashes.root ||
      prevHashes.observingLists !== nextHashes.observingLists ||
      prevHashes.observationLogs !== nextHashes.observationLogs ||
      prevHashes.challenges !== nextHashes.challenges ||
      prevHashes.asterisms !== nextHashes.asterisms;

    if (!isDirty) return;

    setSyncStatus('pending');
    if (cloudSyncTimerRef.current !== null) {
      window.clearTimeout(cloudSyncTimerRef.current);
    }
    const uid = authUser.uid;
    cloudSyncTimerRef.current = window.setTimeout(() => {
      cloudSyncTimerRef.current = null;
      void flushCloudSync(uid, false);
    }, 1500);

    return () => {
      if (cloudSyncTimerRef.current !== null) {
        window.clearTimeout(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = null;
      }
    };
  }, [authUser, currentCloudPayload, flushCloudSync]);

  const handleGoogleLogin = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const friendly = formatFriendlyAuthError(err);
      if (friendly) setAuthError(friendly);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleGoogleLogout = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (cloudSyncTimerRef.current !== null) {
        window.clearTimeout(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = null;
      }
      if (updatedBadgeTimerRef.current !== null) {
        window.clearTimeout(updatedBadgeTimerRef.current);
        updatedBadgeTimerRef.current = null;
      }
      await signOutUser();
    } catch (err) {
      setAuthError(formatFriendlyAuthError(err) || '로그아웃 중 오류가 발생했습니다.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleManualCloudSync = useCallback(() => {
    if (!authUser) return;
    if (cloudSyncTimerRef.current !== null) {
      window.clearTimeout(cloudSyncTimerRef.current);
      cloudSyncTimerRef.current = null;
    }
    const user = authUser;
    if (cloudHydratedUidRef.current !== user.uid || realtimeListenerFailedRef.current) {
      setCloudReconnectKey((k) => k + 1);
      return;
    }
    void (async () => {
      const nextHashes = computePayloadHashes(currentCloudPayloadRef.current);
      const prevHashes = lastSyncedHashesRef.current;
      const hasLocalDirty =
        !prevHashes ||
        prevHashes.root !== nextHashes.root ||
        prevHashes.observingLists !== nextHashes.observingLists ||
        prevHashes.observationLogs !== nextHashes.observationLogs ||
        prevHashes.challenges !== nextHashes.challenges ||
        prevHashes.asterisms !== nextHashes.asterisms;

      if (hasLocalDirty) {
        await flushCloudSync(user.uid, false);
      } else {
        await pullCloudUpdates(user);
      }
    })();
  }, [authUser, flushCloudSync, pullCloudUpdates]);

  const handleDismissAuthSyncError = useCallback(() => {
    setAuthError(null);
    setSyncError(null);
    if (syncStatus === 'error') {
      setSyncStatus(authUser ? 'saved' : 'idle');
    }
  }, [authUser, syncStatus]);

  // Automatically apply reflector inversion (상하 + 좌우 반전) when eyepiece FOV ring is shown with a reflector telescope
  const isActiveScopeReflector = useMemo(() => {
    const scopeId = equipmentLocker.activeIds.telescope;
    if (!scopeId) return false;
    const scope = equipmentLocker.items.find(
      (it) => it.id === scopeId && it.category === 'telescope'
    );
    return scope ? normalizeTelescopeOpticalType(scope.opticalType) === '반사' : false;
  }, [equipmentLocker]);

  useEffect(() => {
    const shouldApplyReflectorFlip = optics.showEyepiece && isActiveScopeReflector;
    const prevActive = prevReflectorEyepieceRef.current;
    prevReflectorEyepieceRef.current = shouldApplyReflectorFlip;

    // Do not override restored localStorage/URL flip state on initial mount
    if (prevActive === null) return;
    if (shouldApplyReflectorFlip === prevActive) return;

    if (shouldApplyReflectorFlip) {
      const cur = viewRef.current;
      if (!cur.flipH || !cur.flipV) {
        autoReflectorFlipRestoreRef.current = { flipH: cur.flipH, flipV: cur.flipV };
        const nextView: ChartViewState = { ...cur, flipH: true, flipV: true };
        viewRef.current = nextView;
        setView(nextView);
      }
    } else if (autoReflectorFlipRestoreRef.current) {
      const restore = autoReflectorFlipRestoreRef.current;
      autoReflectorFlipRestoreRef.current = null;
      const cur = viewRef.current;
      if (cur.flipH !== restore.flipH || cur.flipV !== restore.flipV) {
        const nextView: ChartViewState = {
          ...cur,
          flipH: restore.flipH,
          flipV: restore.flipV,
        };
        viewRef.current = nextView;
        setView(nextView);
      }
    }
  }, [optics.showEyepiece, isActiveScopeReflector]);

  // Time remains completely frozen whenever playback is paused (observer.isPlaying === false).
  // Real-time 1x & time-lapse updates are handled exclusively by the playback ticker below.

  // Smooth time-lapse / real-time 1x simulation ticker when Play is active
  const isRealtimeRate = Math.abs(observer.timeRateSecPerSec) === 1;
  useEffect(() => {
    if (!observer.isPlaying) return;
    let lastTick = performance.now();
    const intervalMs = isRealtimeRate ? 250 : 50;
    const maxDtSec = isRealtimeRate ? 1.0 : 0.25;
    const id = window.setInterval(() => {
      const now = performance.now();
      const dtSec = Math.min(maxDtSec, (now - lastTick) / 1000);
      lastTick = now;
      handleChangeObserver((p) => {
        if (!p.isPlaying) return p;
        if (p.useLiveTime && p.timeRateSecPerSec === 1) {
          return {
            ...p,
            timestampMs: Date.now(),
          };
        }
        return {
          ...p,
          useLiveTime: false,
          timestampMs: p.timestampMs + dtSec * p.timeRateSecPerSec * 1000,
        };
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [observer.isPlaying, isRealtimeRate, handleChangeObserver]);

  const sessionIds = useMemo(
    () => new Set(sessionPlan.map((s) => s.id)),
    [sessionPlan]
  );

  const handleSelectCoordSystem = (nextSystem: CoordSystem) => {
    lockedHzRef.current = null;
    handleChangeView((prev) => ({ ...prev, coordSystem: nextSystem }));
    if (nextSystem === 'horizontal') {
      handleChangeObserver((prev) =>
        prev.minAltitudeDeg !== -90 ? { ...prev, minAltitudeDeg: -90 } : prev
      );
    }
    setLayers((prev) =>
      nextSystem === 'horizontal'
        ? {
            ...prev,
            showGridAltAz: true,
            showHorizon: true,
            showGridEq: false,
            showTerrain: true,
          }
        : {
            ...prev,
            showGridEq: true,
            showGridAltAz: false,
            showTerrain: false,
          }
    );
  };

  const slewingToCenterRef = useRef(false);

  const handleUnlockCenter = useCallback(() => {
    slewingToCenterRef.current = false;
    if (centerLockedRef.current) {
      centerLockedRef.current = false;
      setCenterLocked(false);
    }
  }, []);

  const handleJumpCardinal = useCallback(
    (azDeg: number) => {
      handleUnlockCenter();
      const lstDeg = getLSTDeg(observer.timestampMs, observer.lon);
      const eq = horizontalToEquatorial(30, azDeg, lstDeg, observer.lat);
      const nextRa = ((eq.raDeg / 15) % 24 + 24) % 24;
      const nextDec = Math.max(-89.999, Math.min(89.999, eq.decDeg));
      lockedHzRef.current = {
        altDeg: 30,
        azDeg,
        ra: nextRa,
        dec: nextDec,
        lat: observer.lat,
      };
      handleChangeView((prev) => ({
        ...prev,
        ra: nextRa,
        dec: nextDec,
        fsz: 60,
      }));
    },
    [handleUnlockCenter, observer.timestampMs, observer.lon, observer.lat, handleChangeView]
  );

  const handleToggleCenterLock = useCallback(() => {
    const curSel = selectedRef.current;
    if (!curSel) {
      slewingToCenterRef.current = false;
      centerLockedRef.current = false;
      setCenterLocked(false);
      return;
    }
    if (centerLockedRef.current) {
      slewingToCenterRef.current = false;
      centerLockedRef.current = false;
      setCenterLocked(false);
      return;
    }

    // Activate center-lock tracking, deactivate selection mark, and smoothly slew to the target
    let targetItem = curSel;
    if (curSel.kind === 'planet') {
      const obsMs = observerRef.current.useLiveTime
        ? Date.now()
        : observerRef.current.timestampMs;
      const freshBody = getSolarSystemBodies(obsMs).find((b) => b.id === curSel.data.id);
      if (freshBody) {
        targetItem = { kind: 'planet', data: freshBody };
        selectedRef.current = targetItem;
        setSelected(targetItem);
      }
    }

    setOptics((prev) =>
      prev.showSelectionMark ? { ...prev, showSelectionMark: false } : prev
    );

    centerLockedRef.current = true;
    setCenterLocked(true);
    lockedHzRef.current = null;

    const targetFsz =
      targetItem.kind === 'dso'
        ? Math.max(2.5, Math.min(20, (targetItem.data.majAx / 60) * 6))
        : targetItem.kind === 'planet'
        ? targetItem.data.id === 'Moon' || targetItem.data.id === 'Sun'
          ? 1.8
          : targetItem.data.group === 'planet'
          ? 0.06
          : 1.5
        : targetItem.kind === 'double'
        ? Math.max(0.05, Math.min(2.5, (targetItem.data.sep / 3600) * 80))
        : 14;

    const desiredFsz = Math.min(viewRef.current.fsz, targetFsz);
    if (canvasHandleRef.current) {
      slewingToCenterRef.current = true;
      canvasHandleRef.current.smoothCenterOn(targetItem.data.ra, targetItem.data.dec, {
        targetFsz: desiredFsz,
        durationMs: 650,
        onComplete: () => {
          slewingToCenterRef.current = false;
        },
      });
    } else {
      handleChangeView((p) => ({
        ...p,
        ra: ((targetItem.data.ra / 15) % 24 + 24) % 24,
        dec: Math.max(-89.999, Math.min(89.999, targetItem.data.dec)),
        fsz: desiredFsz,
      }));
    }
  }, [handleChangeView]);

  const handleToggleSolarTrail = useCallback(
    (bodyId: string) => {
      const cur = solarTrailsRef.current;
      if (cur[bodyId] !== undefined) {
        const next = { ...cur };
        delete next[bodyId];
        solarTrailsRef.current = next;
        setSolarTrails(next);
        return;
      }

      const startMs = Date.now();
      const next = { ...cur, [bodyId]: startMs };
      solarTrailsRef.current = next;
      setSolarTrails(next);
      setLayers((l) => (l.showSolarSystem ? l : { ...l, showSolarSystem: true }));

      const trail = getSolarSystemDailyTrail(bodyId, startMs, 10);
      if (trail) {
        centerLockedRef.current = false;
        setCenterLocked(false);
        lockedHzRef.current = null;
        const targetFsz = Math.max(0.05, Math.min(155, Math.max(trail.spanDeg * 1.75, 0.08)));
        handleChangeView((p) => ({
          ...p,
          ra: ((trail.centerRaDeg / 15) % 24 + 24) % 24,
          dec: Math.max(-89.5, Math.min(89.5, trail.centerDecDeg)),
          fsz: targetFsz,
        }));
      }
    },
    [handleChangeView]
  );

  const handleClearSolarTrails = useCallback(() => {
    solarTrailsRef.current = {};
    setSolarTrails({});
  }, []);

  const handleSelect = (
    item: SelectedItem | null,
    options?: { hideSelectionMark?: boolean; toggleDetailIfSame?: boolean }
  ) => {
    const prev = selectedRef.current;
    const isSameTarget = Boolean(
      item && prev && prev.kind === item.kind && prev.data.id === item.data.id
    );
    if (isSameTarget && options?.toggleDetailIfSame && detailWindowOpenRef.current) {
      detailWindowOpenRef.current = false;
      setDetailWindowOpen(false);
      return;
    }

    const prevId = prev?.data.id;
    const nextId = item?.data.id;
    if (!item || nextId !== prevId) {
      slewingToCenterRef.current = false;
      centerLockedRef.current = false;
      setCenterLocked(false);
    }
    selectedRef.current = item;
    setSelected(item);
    detailWindowOpenRef.current = Boolean(item);
    setDetailWindowOpen(Boolean(item));
    if (item && options?.hideSelectionMark) {
      setOptics((prevOptics) =>
        prevOptics.showSelectionMark
          ? { ...prevOptics, showSelectionMark: false }
          : prevOptics
      );
    }
  };

  const handleSetTonightList = useCallback((listId: string | null) => {
    setObservingListsState((prev) => {
      if (listId === null || prev.tonightListId === listId) {
        return {
          ...prev,
          tonightListId: null,
          tonightLinkedOverrides: {},
        };
      }
      if (!prev.lists.some((l) => l.id === listId)) return prev;
      return {
        ...prev,
        tonightListId: listId,
        tonightLinkedOverrides: {},
      };
    });
  }, []);

  const handleCreateObservingList = useCallback((rawName: string): string => {
    const newId = makeObservingListId();
    setObservingListsState((prev) => {
      const trimmed = rawName.trim();
      const fallbackName = `관측 목록 ${prev.lists.length + 1}`;
      const uniqueName = makeUniqueListName(trimmed || fallbackName, prev.lists);
      const nextList: ObservingListGroup = {
        id: newId,
        name: uniqueName,
        createdAt: Date.now(),
        entries: [],
      };
      return {
        ...prev,
        lists: [...prev.lists, nextList],
      };
    });
    return newId;
  }, []);

  const handleRenameObservingList = useCallback((listId: string, rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    setObservingListsState((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => (l.id === listId ? { ...l, name: trimmed } : l)),
    }));
  }, []);

  const handleReorderObservingLists = useCallback((fromId: string, toId: string) => {
    setObservingListsState((prev) => ({
      ...prev,
      lists: reorderItemsById(prev.lists, fromId, toId),
    }));
  }, []);

  const handleReorderObservingListEntries = useCallback(
    (listId: string, fromId: string, toId: string) => {
      setObservingListsState((prev) => ({
        ...prev,
        lists: prev.lists.map((l) =>
          l.id === listId ? { ...l, entries: reorderItemsById(l.entries, fromId, toId) } : l
        ),
      }));
    },
    []
  );

  const handleReorderTonightEntries = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setObservingListsState((prev) => {
      const manual = prev.tonightEntries;
      const manualIds = new Set(manual.map((e) => e.id));
      const linkedList = prev.tonightListId
        ? prev.lists.find((l) => l.id === prev.tonightListId) ?? null
        : null;
      const overrides = prev.tonightLinkedOverrides ?? {};
      const allIds: string[] = [...manual.map((e) => e.id)];
      if (linkedList) {
        for (const e of linkedList.entries) {
          if (manualIds.has(e.id) || overrides[e.id]?.excluded) continue;
          allIds.push(e.id);
        }
      }
      const existingOrder = prev.tonightOrder ?? [];
      const rank = new Map<string, number>();
      existingOrder.forEach((id, i) => rank.set(id, i));
      const currentOrder = [...allIds].sort((a, b) => {
        const ra = rank.has(a) ? rank.get(a)! : Number.MAX_SAFE_INTEGER;
        const rb = rank.has(b) ? rank.get(b)! : Number.MAX_SAFE_INTEGER;
        return ra - rb;
      });
      const fromIdx = currentOrder.indexOf(fromId);
      const toIdx = currentOrder.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const nextOrder = [...currentOrder];
      const [moved] = nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, moved);
      return {
        ...prev,
        tonightOrder: nextOrder,
      };
    });
  }, []);

  const observingListsStateRef = useRef<ObservingListsState>(observingListsState);
  observingListsStateRef.current = observingListsState;

  const handleDeleteObservingList = useCallback(
    async (listId: string): Promise<boolean> => {
      const target = observingListsStateRef.current.lists.find((l) => l.id === listId);
      if (!target) return false;
      const ok = await requestConfirm({
        title: '관측목록 삭제 확인',
        message: `‘${target.name}’ 관측목록(${target.entries.length}개 대상)을 삭제하시겠습니까?`,
        detail:
          observingListsStateRef.current.tonightListId === listId
            ? '현재 오늘 밤 관측목록으로 연동된 목록입니다. 삭제 시 연동도 함께 해제됩니다.'
            : '삭제한 관측목록은 되돌릴 수 없습니다.',
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      setObservingListsState((prev) => {
        const remaining = prev.lists.filter((l) => l.id !== listId);
        const wasTonight = prev.tonightListId === listId;
        return {
          ...prev,
          lists: remaining,
          tonightListId: wasTonight ? null : prev.tonightListId,
          tonightLinkedOverrides: wasTonight ? {} : prev.tonightLinkedOverrides,
        };
      });
      return true;
    },
    [requestConfirm]
  );

  const handleToggleSessionItem = useCallback(
    (item: SelectedItem, targetListId?: string) => {
      setObservingListsState((prev) => {
        // Tonight's own session: NEVER mutates managed lists in 목록관리
        if (!targetListId || targetListId === '__tonight__') {
          const itemId = item.data.id;
          const inManual = prev.tonightEntries.some((e) => e.id === itemId);
          const linkedList = prev.tonightListId
            ? prev.lists.find((l) => l.id === prev.tonightListId) ?? null
            : null;
          const inLinked = Boolean(linkedList?.entries.some((e) => e.id === itemId));
          const overrides = prev.tonightLinkedOverrides ?? {};
          const isExcluded = Boolean(overrides[itemId]?.excluded);

          if (inManual) {
            const nextManual = prev.tonightEntries.filter((e) => e.id !== itemId);
            const nextOverrides = inLinked
              ? { ...overrides, [itemId]: { ...overrides[itemId], excluded: true } }
              : overrides;
            return {
              ...prev,
              tonightEntries: nextManual,
              tonightLinkedOverrides: nextOverrides,
            };
          }

          if (inLinked && !isExcluded) {
            return {
              ...prev,
              tonightLinkedOverrides: {
                ...overrides,
                [itemId]: { ...overrides[itemId], excluded: true },
              },
            };
          }

          const nextOverrides = { ...overrides };
          if (nextOverrides[itemId]?.excluded) {
            delete nextOverrides[itemId];
          }
          return {
            ...prev,
            tonightEntries: [
              ...prev.tonightEntries,
              {
                id: itemId,
                kind: item.kind,
                addedAt: Date.now(),
                observed: false,
                notes: '',
              },
            ],
            tonightLinkedOverrides: nextOverrides,
          };
        }

        // Explicit managed list edit (목록관리 or selected target list in 천체 정보)
        return {
          ...prev,
          lists: prev.lists.map((l) => {
            if (l.id !== targetListId) return l;
            const exists = l.entries.some((e) => e.id === item.data.id);
            const nextEntries = exists
              ? l.entries.filter((e) => e.id !== item.data.id)
              : [
                  ...l.entries,
                  {
                    id: item.data.id,
                    kind: item.kind,
                    addedAt: Date.now(),
                    observed: false,
                    notes: '',
                  },
                ];
            return { ...l, entries: nextEntries };
          }),
        };
      });
    },
    []
  );

  const handleToggleObserved = useCallback((id: string, targetListId?: string) => {
    setObservingListsState((prev) => {
      if (!targetListId || targetListId === '__tonight__') {
        const inManual = prev.tonightEntries.some((e) => e.id === id);
        if (inManual) {
          return {
            ...prev,
            tonightEntries: prev.tonightEntries.map((e) =>
              e.id === id ? { ...e, observed: !e.observed } : e
            ),
          };
        }
        const linkedList = prev.tonightListId
          ? prev.lists.find((l) => l.id === prev.tonightListId) ?? null
          : null;
        const linkedEntry = linkedList?.entries.find((e) => e.id === id);
        if (!linkedEntry) return prev;
        const overrides = prev.tonightLinkedOverrides ?? {};
        const currentObserved =
          overrides[id]?.observed !== undefined ? overrides[id].observed : linkedEntry.observed;
        return {
          ...prev,
          tonightLinkedOverrides: {
            ...overrides,
            [id]: { ...overrides[id], observed: !currentObserved },
          },
        };
      }

      return {
        ...prev,
        lists: prev.lists.map((l) =>
          l.id === targetListId
            ? {
                ...l,
                entries: l.entries.map((e) =>
                  e.id === id ? { ...e, observed: !e.observed } : e
                ),
              }
            : l
        ),
      };
    });
  }, []);

  useEffect(() => {
    saveObservationLogStore(observationLogStore);
  }, [observationLogStore]);

  const syncObservedToSessionLists = useCallback((objectId: string, observed: boolean) => {
    setObservingListsState((prev) => {
      let changed = false;
      const nextTonightEntries = prev.tonightEntries.map((e) => {
        if (e.id === objectId && e.observed !== observed) {
          changed = true;
          return { ...e, observed };
        }
        return e;
      });
      const nextLists = prev.lists.map((l) => {
        let listChanged = false;
        const entries = l.entries.map((e) => {
          if (e.id === objectId && e.observed !== observed) {
            listChanged = true;
            changed = true;
            return { ...e, observed };
          }
          return e;
        });
        return listChanged ? { ...l, entries } : l;
      });
      const overrides = prev.tonightLinkedOverrides ?? {};
      let nextOverrides = overrides;
      const linkedList = prev.tonightListId
        ? prev.lists.find((l) => l.id === prev.tonightListId) ?? null
        : null;
      if (linkedList?.entries.some((e) => e.id === objectId)) {
        if (overrides[objectId]?.observed !== observed) {
          changed = true;
          nextOverrides = {
            ...overrides,
            [objectId]: { ...overrides[objectId], observed },
          };
        }
      }
      if (!changed) return prev;
      return {
        ...prev,
        tonightEntries: nextTonightEntries,
        lists: nextLists,
        tonightLinkedOverrides: nextOverrides,
      };
    });
  }, []);

  const handleToggleObjectObserved = useCallback(
    (
      meta: {
        objectId: string;
        objectKind: 'star' | 'dso' | 'planet' | 'double';
        objectName: string;
        constellation?: string;
        raDeg: number;
        decDeg: number;
      },
      forceObserved?: boolean
    ) => {
      const now = Date.now();
      let nextObserved = true;
      setObservationLogStore((prev) => {
        const current = prev.observedMap[meta.objectId]?.observed;
        const hasLogs = prev.logs.some((l) => l.objectId === meta.objectId);
        const resolvedCurrent = current !== undefined ? current : hasLogs;
        nextObserved = forceObserved !== undefined ? forceObserved : !resolvedCurrent;
        return {
          ...prev,
          observedMap: {
            ...prev.observedMap,
            [meta.objectId]: {
              objectId: meta.objectId,
              objectKind: meta.objectKind,
              objectName: meta.objectName,
              constellation: meta.constellation,
              raDeg: meta.raDeg,
              decDeg: meta.decDeg,
              observed: nextObserved,
              updatedAt: now,
            },
          },
        };
      });
      syncObservedToSessionLists(meta.objectId, nextObserved);
    },
    [syncObservedToSessionLists]
  );

  const handleSaveObservationLog = useCallback(
    (entry: ObservationLogEntry) => {
      setObservationLogStore((prev) => {
        const exists = prev.logs.some((l) => l.id === entry.id);
        const nextLogs = (
          exists ? prev.logs.map((l) => (l.id === entry.id ? entry : l)) : [entry, ...prev.logs]
        ).sort((a, b) => b.observedAt - a.observedAt);
        return {
          observedMap: {
            ...prev.observedMap,
            [entry.objectId]: {
              objectId: entry.objectId,
              objectKind: entry.objectKind,
              objectName: entry.objectName,
              constellation: entry.constellation,
              raDeg: entry.raDeg,
              decDeg: entry.decDeg,
              observed: true,
              updatedAt: entry.updatedAt,
            },
          },
          logs: nextLogs,
        };
      });
      syncObservedToSessionLists(entry.objectId, true);
    },
    [syncObservedToSessionLists]
  );

  const handleDeleteObservationLog = useCallback(
    async (logId: string): Promise<boolean> => {
      const target = observationLogStoreRef.current.logs.find((l) => l.id === logId);
      if (!target) return false;
      const ok = await requestConfirm({
        title: '관측기록 삭제 확인',
        message: `‘${target.objectName}’ (${formatObservationDateTime(target.observedAt)}) 관측기록을 삭제하시겠습니까?`,
        detail: '삭제한 관측기록은 복구할 수 없습니다.',
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      setObservationLogStore((prev) => ({
        ...prev,
        logs: prev.logs.filter((l) => l.id !== logId),
      }));
      return true;
    },
    [requestConfirm]
  );

  const handleImportObservationLogs = useCallback((incoming: ObservationLogStoreState) => {
    const res = mergeObservationLogStores(observationLogStoreRef.current, incoming);
    observationLogStoreRef.current = res.merged;
    setObservationLogStore(res.merged);
    return { addedLogs: res.addedLogs, updatedLogs: res.updatedLogs };
  }, []);

  const handleFocusObservationTarget = useCallback(
    (target: {
      objectId: string;
      objectKind: 'star' | 'dso' | 'planet' | 'double';
      raDeg: number;
      decDeg: number;
    }) => {
      const snap = getCatalogSnapshot();
      let found: SelectedItem | null = null;
      if (target.objectKind === 'dso') {
        const d =
          snap.dsosBright.find((x) => x.id === target.objectId) ??
          snap.darkNebulae.find((x) => x.id === target.objectId) ??
          snap.dsosDeep.find((x) => x.id === target.objectId) ??
          snap.caldwell.find((x) => x.id === target.objectId);
        if (d) found = { kind: 'dso', data: d };
      } else if (target.objectKind === 'planet') {
        const bodies = getSolarSystemBodies(observer.useLiveTime ? Date.now() : observer.timestampMs);
        const p = bodies.find((x) => x.id === target.objectId);
        if (p) found = { kind: 'planet', data: p };
      } else if (target.objectKind === 'double') {
        const dbl = snap.doubleStars.find((x) => x.id === target.objectId);
        if (dbl) found = { kind: 'double', data: dbl };
      } else {
        let st =
          snap.brightStars.find((x) => x.id === target.objectId) ??
          snap.deepStars.find((x) => x.id === target.objectId) ??
          snap.gaiaStars.find((x) => x.id === target.objectId);
        if (!st) {
          for (const tile of snap.ultraStarTiles.values()) {
            const hit = tile.find((x) => x.id === target.objectId);
            if (hit) {
              st = hit;
              break;
            }
          }
        }
        if (st) found = { kind: 'star', data: st };
      }

      detailWindowOpenRef.current = false;
      setDetailWindowOpen(false);
      if (found) {
        selectedRef.current = found;
        setSelected(found);
      }

      const raDeg = found ? found.data.ra : target.raDeg;
      const decDeg = found ? found.data.dec : target.decDeg;
      const targetFsz =
        target.objectKind === 'planet'
          ? 0.08
          : target.objectKind === 'double'
          ? 1.5
          : target.objectKind === 'dso'
          ? 10
          : 16;

      if (canvasHandleRef.current) {
        canvasHandleRef.current.smoothCenterOn(raDeg, decDeg, {
          targetFsz,
          durationMs: 750,
          arcZoomOut: true,
        });
      } else {
        setView((p) => ({
          ...p,
          ra: ((raDeg / 15) % 24 + 24) % 24,
          dec: decDeg,
          fsz: targetFsz,
        }));
      }
    },
    [observer.timestampMs, observer.useLiveTime]
  );

  const handleUpdateNotes = useCallback(
    (id: string, notes: string, targetListId?: string) => {
      setObservingListsState((prev) => {
        if (!targetListId || targetListId === '__tonight__') {
          const inManual = prev.tonightEntries.some((e) => e.id === id);
          if (inManual) {
            return {
              ...prev,
              tonightEntries: prev.tonightEntries.map((e) =>
                e.id === id ? { ...e, notes } : e
              ),
            };
          }
          const linkedList = prev.tonightListId
            ? prev.lists.find((l) => l.id === prev.tonightListId) ?? null
            : null;
          const linkedEntry = linkedList?.entries.find((e) => e.id === id);
          if (!linkedEntry) return prev;
          const overrides = prev.tonightLinkedOverrides ?? {};
          return {
            ...prev,
            tonightLinkedOverrides: {
              ...overrides,
              [id]: { ...overrides[id], notes },
            },
          };
        }

        return {
          ...prev,
          lists: prev.lists.map((l) => {
            if (l.id !== targetListId) return l;
            if (!l.entries.some((e) => e.id === id)) return l;
            return {
              ...l,
              entries: l.entries.map((e) => (e.id === id ? { ...e, notes } : e)),
            };
          }),
        };
      });
    },
    []
  );

  const handleAddRecommendedTonight = useCallback((items: SelectedItem[]) => {
    setObservingListsState((prev) => {
      const linkedList = prev.tonightListId
        ? prev.lists.find((l) => l.id === prev.tonightListId) ?? null
        : null;
      const overrides = prev.tonightLinkedOverrides ?? {};
      const visibleIds = new Set<string>(prev.tonightEntries.map((e) => e.id));
      if (linkedList) {
        for (const e of linkedList.entries) {
          if (!overrides[e.id]?.excluded) visibleIds.add(e.id);
        }
      }
      const additions: ObservingSessionEntry[] = items
        .filter((it) => !visibleIds.has(it.data.id))
        .map((it) => ({
          id: it.data.id,
          kind: it.kind,
          addedAt: Date.now(),
          observed: false,
          notes: '',
        }));
      if (additions.length === 0) return prev;
      return {
        ...prev,
        tonightEntries: [...prev.tonightEntries, ...additions],
      };
    });
  }, []);

  const applyEquipmentToOptics = useCallback(
    (nextLocker: EquipmentLockerState, triggeredCat?: EquipmentCategory) => {
      const byId = new Map(nextLocker.items.map((it) => [it.id, it]));
      const scope = nextLocker.activeIds.telescope
        ? byId.get(nextLocker.activeIds.telescope)
        : undefined;
      const eyepiece = nextLocker.activeIds.eyepiece
        ? byId.get(nextLocker.activeIds.eyepiece)
        : undefined;
      const finders = nextLocker.items.filter((it) => it.category === 'finder');
      const activeFinder =
        (nextLocker.activeIds.finder ? byId.get(nextLocker.activeIds.finder) : undefined) ??
        finders[0];
      const barlow = nextLocker.activeIds.barlow
        ? byId.get(nextLocker.activeIds.barlow)
        : undefined;
      const camera = nextLocker.activeIds.camera
        ? byId.get(nextLocker.activeIds.camera)
        : undefined;

      const factor = barlow?.factor && barlow.factor > 0 ? barlow.factor : 1;

      setOptics((prev) => {
        const baseFl =
          scope?.focalLengthMm && scope.focalLengthMm > 0
            ? scope.focalLengthMm
            : prev.telescopeFocalLengthMm;
        const effFl = Math.max(30, baseFl * factor);
        const epFl =
          eyepiece?.focalLengthMm && eyepiece.focalLengthMm > 0
            ? eyepiece.focalLengthMm
            : prev.eyepieceFocalLengthMm;
        const epAfov =
          eyepiece?.afovDeg && eyepiece.afovDeg > 0 ? eyepiece.afovDeg : prev.eyepieceAfovDeg;
        const mag = effFl / Math.max(1, epFl);
        const tfov = Math.max(0.05, Math.min(20, epAfov / mag));

        let sensorW = prev.sensorWidthDeg;
        let sensorH = prev.sensorHeightDeg;
        const sensorEffFl =
          camera?.isSmartTelescope && camera.focalLengthMm && camera.focalLengthMm > 0
            ? camera.focalLengthMm
            : effFl;
        if (camera?.sensorWidthMm && camera?.sensorHeightMm) {
          sensorW = Number(
            Math.max(
              0.05,
              Math.min(45, 2 * Math.atan(camera.sensorWidthMm / (2 * sensorEffFl)) * RAD2DEG)
            ).toFixed(2)
          );
          sensorH = Number(
            Math.max(
              0.05,
              Math.min(45, 2 * Math.atan(camera.sensorHeightMm / (2 * sensorEffFl)) * RAD2DEG)
            ).toFixed(2)
          );
        }

        const shouldShowEyepiece =
          triggeredCat === 'eyepiece'
            ? Boolean(eyepiece)
            : (triggeredCat === 'telescope' || triggeredCat === 'barlow') && Boolean(eyepiece)
            ? true
            : prev.showEyepiece;

        const shouldShowFinder =
          triggeredCat === 'finder'
            ? Boolean(nextLocker.activeIds.finder)
            : prev.showFinder7x50;

        const shouldShowSensor =
          triggeredCat === 'camera'
            ? Boolean(camera)
            : (triggeredCat === 'telescope' || triggeredCat === 'barlow') && Boolean(camera)
            ? true
            : prev.showSensorBox;

        const labelParts = [
          eyepiece?.name || prev.eyepieceLabel,
          barlow?.factor && barlow.factor !== 1 ? `${barlow.factor}×` : '',
        ].filter(Boolean);

        const nextFinderFovDeg =
          activeFinder?.fovDeg && activeFinder.fovDeg > 0 ? activeFinder.fovDeg : 7.0;
        const nextFinderLabel = activeFinder?.name?.trim() || '7×50 파인더';
        const nextFinderColor = activeFinder?.finderColor;
        const nextFinderCrosshair = Boolean(activeFinder?.finderCrosshair);

        const canRotateSensor = camera ? isSmartTelescopeRotatable(camera) : true;
        const canMosaicSensor = camera ? isSmartTelescopeMosaicSupported(camera) : false;
        const mosaicMaxScale = camera ? getSmartTelescopeMosaicMaxScale(camera) : 2.0;
        const nextMosaicScaleW = canMosaicSensor
          ? Math.max(1.0, Math.min(mosaicMaxScale, prev.sensorMosaicScaleW ?? 1.0))
          : 1.0;
        const nextMosaicScaleH = canMosaicSensor
          ? Math.max(1.0, Math.min(mosaicMaxScale, prev.sensorMosaicScaleH ?? 1.0))
          : 1.0;
        const sensorEquipLabel = camera
          ? camera.isSmartTelescope
            ? camera.name
            : [scope?.name, barlow?.name, camera.name].filter(Boolean).join(' + ')
          : scope
          ? [scope.name, barlow?.name].filter(Boolean).join(' + ')
          : prev.sensorEquipmentLabel;

        return {
          ...prev,
          eyepieceInputMode: prev.eyepieceInputMode === 'equipment' ? 'equipment' : 'calc',
          telescopeFocalLengthMm: Math.round(effFl),
          eyepieceFocalLengthMm: epFl,
          eyepieceAfovDeg: epAfov,
          eyepieceFovDeg: Number(tfov.toFixed(2)),
          eyepieceLabel: eyepiece ? labelParts.join(' · ') : prev.eyepieceLabel,
          showEyepiece: shouldShowEyepiece,
          finderFovDeg: nextFinderFovDeg,
          finderLabel: nextFinderLabel,
          finderColor: nextFinderColor,
          finderCrosshair: nextFinderCrosshair,
          showFinder7x50: shouldShowFinder,
          sensorWidthDeg: sensorW,
          sensorHeightDeg: sensorH,
          sensorEquipmentLabel: sensorEquipLabel,
          sensorRotationLocked: !canRotateSensor,
          sensorRotationDeg: canRotateSensor ? prev.sensorRotationDeg : 0,
          sensorMosaicSupported: canMosaicSensor,
          sensorMosaicMaxScale: mosaicMaxScale,
          sensorMosaicScaleW: nextMosaicScaleW,
          sensorMosaicScaleH: nextMosaicScaleH,
          showSensorBox: shouldShowSensor,
        };
      });
    },
    []
  );

  // Active photographic equipment name used in sensor FOV PNG filenames
  const activeSensorEquipmentName = useMemo(() => {
    if (optics.sensorEquipmentLabel && optics.sensorEquipmentLabel.trim()) {
      return optics.sensorEquipmentLabel.trim();
    }
    const cam = equipmentLocker.activeIds.camera
      ? equipmentLocker.items.find(
          (it) => it.id === equipmentLocker.activeIds.camera && it.category === 'camera'
        )
      : undefined;
    if (cam) {
      if (cam.isSmartTelescope) return cam.name;
      const scope = equipmentLocker.activeIds.telescope
        ? equipmentLocker.items.find(
            (it) => it.id === equipmentLocker.activeIds.telescope && it.category === 'telescope'
          )
        : undefined;
      const barlow = equipmentLocker.activeIds.barlow
        ? equipmentLocker.items.find(
            (it) => it.id === equipmentLocker.activeIds.barlow && it.category === 'barlow'
          )
        : undefined;
      return [scope?.name, barlow?.name, cam.name].filter(Boolean).join(' + ');
    }
    const matchedSmart = SMART_TELESCOPE_PRESETS.find((sp) => {
      if (!sp.focalLengthMm || !sp.sensorWidthMm || !sp.sensorHeightMm) return false;
      const w = 2 * Math.atan(sp.sensorWidthMm / (2 * sp.focalLengthMm)) * RAD2DEG;
      const h = 2 * Math.atan(sp.sensorHeightMm / (2 * sp.focalLengthMm)) * RAD2DEG;
      return (
        Math.abs(optics.sensorWidthDeg - w) < 0.03 &&
        Math.abs(optics.sensorHeightDeg - h) < 0.03
      );
    });
    if (matchedSmart) return matchedSmart.name;
    return `FOV_${optics.sensorWidthDeg.toFixed(2)}x${optics.sensorHeightDeg.toFixed(2)}`;
  }, [
    optics.sensorEquipmentLabel,
    optics.sensorWidthDeg,
    optics.sensorHeightDeg,
    equipmentLocker,
  ]);

  // Keep sensor rotation locked at 0° when a non-rotatable smart telescope is active (including restored localStorage state)
  useEffect(() => {
    const cam = equipmentLocker.activeIds.camera
      ? equipmentLocker.items.find(
          (it) => it.id === equipmentLocker.activeIds.camera && it.category === 'camera'
        )
      : undefined;
    if (
      cam?.isSmartTelescope &&
      !isSmartTelescopeRotatable(cam) &&
      (!optics.sensorEquipmentLabel || optics.sensorEquipmentLabel === cam.name)
    ) {
      if (!optics.sensorRotationLocked || optics.sensorRotationDeg !== 0) {
        setOptics((prev) => ({
          ...prev,
          sensorRotationLocked: true,
          sensorRotationDeg: 0,
        }));
      }
    }
  }, [
    equipmentLocker,
    optics.sensorEquipmentLabel,
    optics.sensorRotationLocked,
    optics.sensorRotationDeg,
  ]);

  // Keep finder FOV ring synced with active/default finder in equipmentLocker (fallback: 7×50 7.0°)
  useEffect(() => {
    const finders = equipmentLocker.items.filter((it) => it.category === 'finder');
    const resolved =
      (equipmentLocker.activeIds.finder
        ? finders.find((f) => f.id === equipmentLocker.activeIds.finder)
        : undefined) ?? finders[0];
    const nextFov = resolved?.fovDeg && resolved.fovDeg > 0 ? resolved.fovDeg : 7.0;
    const nextLabel = resolved?.name?.trim() || '7×50 파인더';
    const nextColor = resolved?.finderColor;
    const nextCrosshair = Boolean(resolved?.finderCrosshair);
    if (
      optics.finderFovDeg !== nextFov ||
      optics.finderLabel !== nextLabel ||
      optics.finderColor !== nextColor ||
      Boolean(optics.finderCrosshair) !== nextCrosshair
    ) {
      setOptics((prev) => ({
        ...prev,
        finderFovDeg: nextFov,
        finderLabel: nextLabel,
        finderColor: nextColor,
        finderCrosshair: nextCrosshair,
      }));
    }
  }, [
    equipmentLocker,
    optics.finderFovDeg,
    optics.finderLabel,
    optics.finderColor,
    optics.finderCrosshair,
  ]);

  const handleAddOrUpdateEquipment = useCallback(
    (item: EquipmentItem) => {
      setEquipmentLocker((prev) => {
        const exists = prev.items.some((it) => it.id === item.id);
        const items = exists
          ? prev.items.map((it) => (it.id === item.id ? item : it))
          : [...prev.items, item];
        const activeIds =
          !exists && item.category === 'finder' && !prev.activeIds.finder
            ? { ...prev.activeIds, finder: item.id }
            : prev.activeIds;
        const next: EquipmentLockerState = {
          items,
          activeIds,
        };
        if (prev.activeIds[item.category] === item.id) {
          applyEquipmentToOptics(next, item.category);
        }
        return next;
      });
    },
    [applyEquipmentToOptics]
  );

  const equipmentLockerRef = useRef<EquipmentLockerState>(equipmentLocker);
  equipmentLockerRef.current = equipmentLocker;

  const handleDeleteEquipment = useCallback(
    async (id: string): Promise<boolean> => {
      const target = equipmentLockerRef.current.items.find((it) => it.id === id);
      if (!target) return false;
      const ok = await requestConfirm({
        title: '장비 삭제 확인',
        message: `‘${target.name}’ 장비를 보유 장비 목록에서 삭제하시겠습니까?`,
        detail:
          equipmentLockerRef.current.activeIds[target.category] === id
            ? '현재 활성화된 장비입니다. 삭제 시 광학계 선택이 해제됩니다.'
            : undefined,
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      setEquipmentLocker((prev) => {
        const curTarget = prev.items.find((it) => it.id === id);
        const items = prev.items.filter((it) => it.id !== id);
        const activeIds = { ...prev.activeIds };
        if (curTarget && activeIds[curTarget.category] === id) {
          delete activeIds[curTarget.category];
        }
        const next: EquipmentLockerState = { items, activeIds };
        if (curTarget && prev.activeIds[curTarget.category] === id) {
          applyEquipmentToOptics(next, curTarget.category);
        }
        return next;
      });
      return true;
    },
    [applyEquipmentToOptics, requestConfirm]
  );

  const handleToggleActiveEquipment = useCallback(
    (category: EquipmentCategory, id: string) => {
      setEquipmentLocker((prev) => {
        const activeIds = { ...prev.activeIds };
        if (activeIds[category] === id) {
          delete activeIds[category];
        } else {
          activeIds[category] = id;
        }
        const next: EquipmentLockerState = { ...prev, activeIds };
        applyEquipmentToOptics(next, category);
        return next;
      });
    },
    [applyEquipmentToOptics]
  );

  const handleSelectActiveEquipment = useCallback(
    (category: EquipmentCategory, id: string | null) => {
      setEquipmentLocker((prev) => {
        const activeIds = { ...prev.activeIds };
        if (!id) {
          delete activeIds[category];
        } else {
          activeIds[category] = id;
        }
        const next: EquipmentLockerState = { ...prev, activeIds };
        applyEquipmentToOptics(next, category);
        return next;
      });
    },
    [applyEquipmentToOptics]
  );

  const handleImportEquipmentLocker = useCallback(
    (imported: EquipmentLockerState) => {
      setEquipmentLocker(imported);
      applyEquipmentToOptics(imported);
    },
    [applyEquipmentToOptics]
  );

  const handleImportSkylistSession = useCallback(
    async (
      fileText: string,
      options?: { fileName?: string; targetListId?: string; makeTonight?: boolean }
    ) => {
      await Promise.all([
        ensureCoreCatalogs(),
        ensureDeepDsos(),
        ensureDeepStars(),
        ensureDoubleStars(),
      ]);
      const parsed = parseSkylistObjects(fileText);
      const snap = getCatalogSnapshot();
      const obsMs = observerRef.current.useLiveTime
        ? Date.now()
        : observerRef.current.timestampMs;
      const resolved = resolveSkylistObjects(parsed, snap, obsMs);

      const prevState = observingListsRef.current;

      if (resolved.totalCount === 0) {
        return {
          matchedCount: 0,
          addedCount: 0,
          totalCount: 0,
          unmatchedNames: [],
          listName: '',
          createdNewList: false,
        };
      }

      // Case 1: Importing into an existing pre-created / selected list category
      if (options?.targetListId) {
        const targetList = prevState.lists.find((l) => l.id === options.targetListId);
        if (targetList) {
          const existingMap = new Map(targetList.entries.map((e) => [e.id, e]));
          const nextEntries = [...targetList.entries];
          let addedCount = 0;
          for (const entry of resolved.entries) {
            const existing = existingMap.get(entry.id);
            if (!existing) {
              nextEntries.push(entry);
              existingMap.set(entry.id, entry);
              addedCount++;
            } else {
              const idx = nextEntries.findIndex((x) => x.id === entry.id);
              if (idx >= 0) {
                nextEntries[idx] = {
                  ...existing,
                  observed: existing.observed || entry.observed,
                  notes: existing.notes || entry.notes,
                };
              }
            }
          }
          const nextState: ObservingListsState = {
            ...prevState,
            lists: prevState.lists.map((l) =>
              l.id === targetList.id ? { ...l, entries: nextEntries } : l
            ),
            tonightListId: options.makeTonight ? targetList.id : prevState.tonightListId,
            tonightLinkedOverrides: options.makeTonight ? {} : prevState.tonightLinkedOverrides,
          };
          observingListsRef.current = nextState;
          setObservingListsState(nextState);
          return {
            matchedCount: resolved.matchedCount,
            addedCount,
            totalCount: resolved.totalCount,
            unmatchedNames: resolved.unmatchedNames,
            listName: targetList.name,
            createdNewList: false,
          };
        }
      }

      // Case 2: Importing as a brand-new list named after the imported file
      const baseName = stripSkylistExtension(options?.fileName) || '가져온 관측 목록';
      const newListName = makeUniqueListName(baseName, prevState.lists);
      const newListId = makeObservingListId();
      const newList: ObservingListGroup = {
        id: newListId,
        name: newListName,
        createdAt: Date.now(),
        entries: resolved.entries,
      };
      const shouldActivateTonight = Boolean(options?.makeTonight);

      const nextState: ObservingListsState = {
        ...prevState,
        lists: [...prevState.lists, newList],
        tonightListId: shouldActivateTonight ? newListId : prevState.tonightListId,
        tonightLinkedOverrides: shouldActivateTonight ? {} : prevState.tonightLinkedOverrides,
      };
      observingListsRef.current = nextState;
      setObservingListsState(nextState);

      return {
        matchedCount: resolved.matchedCount,
        addedCount: resolved.entries.length,
        totalCount: resolved.totalCount,
        unmatchedNames: resolved.unmatchedNames,
        listName: newListName,
        createdNewList: true,
      };
    },
    []
  );

  const handleExportSkylistSession = useCallback((listId?: string) => {
    const obsMs = observerRef.current.useLiveTime
      ? Date.now()
      : observerRef.current.timestampMs;
    const snap = getCatalogSnapshot();
    const state = observingListsRef.current;

    let entriesToExport: ObservingSessionEntry[] = [];
    let exportLabel = '오늘밤_관측목록';

    if (listId && listId !== '__tonight__') {
      const targetList = state.lists.find((l) => l.id === listId);
      if (!targetList || targetList.entries.length === 0) return;
      entriesToExport = targetList.entries;
      exportLabel = targetList.name;
    } else {
      const manual = state.tonightEntries;
      const manualIds = new Set(manual.map((e) => e.id));
      const linkedList = state.tonightListId
        ? state.lists.find((l) => l.id === state.tonightListId) ?? null
        : null;
      const overrides = state.tonightLinkedOverrides ?? {};
      const linkedProjected = linkedList
        ? linkedList.entries
            .filter((e) => !manualIds.has(e.id) && !overrides[e.id]?.excluded)
            .map((e) => ({
              ...e,
              observed: overrides[e.id]?.observed ?? e.observed,
              notes: overrides[e.id]?.notes ?? e.notes,
            }))
        : [];
      entriesToExport = [...manual, ...linkedProjected];
      if (entriesToExport.length === 0) return;
      exportLabel = linkedList ? `오늘밤_${linkedList.name}` : '오늘밤_관측목록';
    }

    const content = exportObservingListToSkylist(entriesToExport, snap, obsMs);
    const safeListName = exportLabel
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    const today = new Date().toISOString().slice(0, 10);
    const filename = safeListName
      ? `${safeListName}.skylist`
      : `noxchart-observing-list-${today}.skylist`;
    downloadSkylistFile(content, filename);
  }, []);

  const handleApplySite = useCallback(
    (site: { name: string; lat: number; lon: number }) => {
      handleChangeObserver((prev) => ({
        ...prev,
        name: site.name,
        lat: Math.max(-90, Math.min(90, site.lat)),
        lon: Math.max(-180, Math.min(180, site.lon)),
      }));
    },
    [handleChangeObserver]
  );

  const handleSaveSite = useCallback((site: SavedObservingSite) => {
    setSavedSites((prev) => {
      const idx = prev.findIndex((s) => s.id === site.id);
      const next =
        idx >= 0 ? prev.map((s) => (s.id === site.id ? site : s)) : [site, ...prev];
      savedSitesRef.current = next;
      return next;
    });
  }, []);

  const handleDeleteSite = useCallback(
    async (id: string): Promise<boolean> => {
      const target = savedSitesRef.current.find((s) => s.id === id);
      if (!target) return false;
      const ok = await requestConfirm({
        title: '관측지 삭제 확인',
        message: `‘${target.name}’ 관측지를 삭제하시겠습니까?`,
        detail: '저장된 관측지 목록에서 영구적으로 제거됩니다.',
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      setSavedSites((prev) => {
        const next = prev.filter((s) => s.id !== id);
        savedSitesRef.current = next;
        return next;
      });
      return true;
    },
    [requestConfirm]
  );

  const handleImportSites = useCallback((incoming: SavedObservingSite[]) => {
    const result = mergeObservingSites(savedSitesRef.current, incoming);
    savedSitesRef.current = result.merged;
    setSavedSites(result.merged);
    return { addedCount: result.addedCount, updatedCount: result.updatedCount };
  }, []);

  const handleOpenSiteMap = useCallback((focus?: SavedObservingSite | null) => {
    setSiteMapFocus(focus ?? null);
    setSiteMapOpen(true);
  }, []);

  const handleToggleChallengeOnChart = useCallback((trackId: string) => {
    setChallenges((prev) => {
      const target = prev.find((t) => t.id === trackId);
      const nextActive = target ? !target.activeOnChart : false;
      return prev.map((t) => ({
        ...t,
        activeOnChart: nextActive && t.id === trackId,
      }));
    });
  }, []);

  const handleToggleAllChallengesOnChart = useCallback(
    (enabled: boolean, preferredTrackId?: string | null) => {
      setChallenges((prev) => {
        if (!enabled) {
          return prev.map((t) => (t.activeOnChart ? { ...t, activeOnChart: false } : t));
        }
        if (prev.some((t) => t.activeOnChart)) return prev;
        const target =
          (preferredTrackId ? prev.find((t) => t.id === preferredTrackId) : undefined) ??
          prev.find((t) => t.checkpoints.length > 0) ??
          prev[0];
        if (!target) return prev;
        return prev.map((t) => ({
          ...t,
          activeOnChart: t.id === target.id,
        }));
      });
    },
    []
  );

  const handleReorderChallengeTracks = useCallback((fromId: string, toId: string) => {
    setChallenges((prev) => reorderItemsById(prev, fromId, toId));
  }, []);

  const handleReorderChallengeCheckpoints = useCallback(
    (trackId: string, fromId: string, toId: string) => {
      setChallenges((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? { ...t, checkpoints: reorderItemsById(t.checkpoints, fromId, toId) }
            : t
        )
      );
    },
    []
  );

  const handleReorderObservationLogs = useCallback((orderedIds: string[]) => {
    setObservationLogStore((prev) => {
      const byId = new Map(prev.logs.map((l) => [l.id, l]));
      const nextLogs: ObservationLogEntry[] = [];
      for (const id of orderedIds) {
        const hit = byId.get(id);
        if (hit) {
          nextLogs.push(hit);
          byId.delete(id);
        }
      }
      for (const rest of byId.values()) {
        nextLogs.push(rest);
      }
      return {
        ...prev,
        logs: nextLogs,
      };
    });
  }, []);

  const handleToggleChallengeCheckpoint = useCallback((trackId: string, checkpointId: string) => {
    setChallenges((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          checkpoints: t.checkpoints.map((cp) =>
            cp.id === checkpointId
              ? {
                  ...cp,
                  observed: !cp.observed,
                  observedAt: !cp.observed ? Date.now() : undefined,
                }
              : cp
          ),
        };
      })
    );
  }, []);

  const handleUpdateChallengeCheckpointNote = useCallback(
    (trackId: string, checkpointId: string, note: string) => {
      setChallenges((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          return {
            ...t,
            checkpoints: t.checkpoints.map((cp) =>
              cp.id === checkpointId ? { ...cp, logNote: note } : cp
            ),
          };
        })
      );
    },
    []
  );

  const handleUpdateChallengeCheckpointFov = useCallback(
    (trackId: string, checkpointId: string, fovDeg: number | undefined) => {
      setChallenges((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          return {
            ...t,
            checkpoints: t.checkpoints.map((cp) =>
              cp.id === checkpointId ? { ...cp, fovDeg } : cp
            ),
          };
        })
      );
    },
    []
  );

  const handleSaveChallengeTrack = useCallback((track: ChallengeTrack) => {
    setChallenges((prev) => {
      const idx = prev.findIndex((t) => t.id === track.id);
      const base = idx >= 0 ? prev.map((t) => (t.id === track.id ? track : t)) : [track, ...prev];
      const next = track.activeOnChart
        ? base.map((t) => ({ ...t, activeOnChart: t.id === track.id }))
        : base;
      challengesRef.current = next;
      return next;
    });
  }, []);

  const handleDeleteChallengeTrack = useCallback((trackId: string) => {
    setChallenges((prev) => {
      const next = prev.filter((t) => t.id !== trackId);
      challengesRef.current = next;
      return next;
    });
    setChallengeDraft((prev) => (prev?.id === trackId ? null : prev));
  }, []);

  const handleStartCreateChallengeDraft = useCallback(() => {
    const now = Date.now();
    const fresh: ChallengeTrack = {
      id: `custom_track_${now}`,
      title: '',
      subtitle: '',
      description: '',
      season: 'all',
      lineColor: '#38BDF8',
      completedColor: '#FBBF24',
      activeOnChart: true,
      builtIn: false,
      badges: [
        {
          id: `master_${now}`,
          title: '코스 완주 마스터',
          description: '모든 체크포인트 관측 완료',
          requiredCheckpointIds: [],
          isMaster: true,
        },
      ],
      checkpoints: [],
      createdAt: now,
    };
    setChallengeDraft(fresh);
    setChallengeDraftIsNew(true);
    setChallengeDraftNotice(null);
  }, []);

  const handleStartEditChallengeDraft = useCallback((track: ChallengeTrack) => {
    setChallengeDraft({
      ...track,
      checkpoints: track.checkpoints.map((c) => ({ ...c })),
    });
    setChallengeDraftIsNew(false);
    setChallengeDraftNotice(null);
  }, []);

  const handleCancelChallengeDraft = useCallback(() => {
    setChallengeDraft(null);
    setChallengeDraftIsNew(false);
    setChallengeDraftNotice(null);
  }, []);

  const handleChallengeChartPick = useCallback(
    ({
      item,
      raDeg,
      decDeg,
    }: {
      item: SelectedItem | null;
      raDeg: number;
      decDeg: number;
    }) => {
      const prev = challengeDraftRef.current;
      if (!prev) return;

      if (!item && !challengePickAllowEmpty) {
        setChallengeDraftNotice(
          '천체만 선택 모드입니다. 천체를 클릭하거나 "천체 + 빈 위치"로 전환하세요.'
        );
        return;
      }

      const normRa = ((raDeg % 360) + 360) % 360;
      const normDec = Math.max(-90, Math.min(90, decDeg));
      const idx = prev.checkpoints.length + 1;
      const code = `CP ${String(idx).padStart(2, '0')}`;
      const lastStage =
        prev.checkpoints[prev.checkpoints.length - 1]?.stage || '1구간 · 기본 코스';

      if (item) {
        let catalogId: string;
        let name: string;
        let constellation: string | undefined;
        let objectType: string | undefined;
        let mag: number | undefined;
        const kind = item.kind;

        if (item.kind === 'dso') {
          catalogId = item.data.id;
          name = item.data.koName
            ? `${item.data.id} ${item.data.koName}`
            : item.data.name
            ? `${item.data.id} (${item.data.name})`
            : item.data.id;
          constellation = item.data.con;
          objectType = item.data.type;
          mag = item.data.mag;
        } else if (item.kind === 'star') {
          catalogId = item.data.hip ? `HIP ${item.data.hip}` : item.data.id;
          name = item.data.koName
            ? `${item.data.koName} (${item.data.name || item.data.bayer || item.data.id})`
            : item.data.name || item.data.bayer || item.data.id;
          constellation = item.data.con;
          objectType = '항성';
          mag = item.data.mag;
        } else if (item.kind === 'double') {
          catalogId = item.data.id;
          name = item.data.koName || item.data.name || item.data.bayer || item.data.disc;
          constellation = item.data.con;
          objectType = item.data.isMultiple ? '다중성' : '이중성';
          mag = item.data.mag;
        } else {
          catalogId = item.data.id;
          name = `${item.data.koName} (${item.data.name})`;
          objectType = item.data.category;
          mag = item.data.mag;
        }

        const normCatKey = catalogId.replace(/\s+/g, '').toUpperCase();
        const alreadyExists = prev.checkpoints.some(
          (cp) =>
            cp.catalogId && cp.catalogId.replace(/\s+/g, '').toUpperCase() === normCatKey
        );
        if (alreadyExists) {
          setChallengeDraftNotice(`'${name}' 대상은 이미 체크포인트에 포함되어 있습니다.`);
          return;
        }

        const newCp: ChallengeCheckpoint = {
          id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          code,
          name,
          catalogId,
          kind,
          stage: lastStage,
          constellation,
          objectType,
          mag,
          ra: item.data.ra,
          dec: item.data.dec,
          observed: false,
        };
        const nextDraft: ChallengeTrack = {
          ...prev,
          checkpoints: [...prev.checkpoints, newCp],
        };
        challengeDraftRef.current = nextDraft;
        setChallengeDraft(nextDraft);
        setChallengeDraftNotice(`'${name}' (${code}) 체크포인트를 추가했습니다.`);
        return;
      }

      const newCp: ChallengeCheckpoint = {
        id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code,
        name: `관측 지점 ${idx}`,
        kind: 'dso',
        stage: lastStage,
        objectType: '지정 위치',
        ra: normRa,
        dec: normDec,
        guideNote: `RA ${formatRA(normRa)} · Dec ${formatDec(normDec)}`,
        observed: false,
      };
      const nextDraft: ChallengeTrack = {
        ...prev,
        checkpoints: [...prev.checkpoints, newCp],
      };
      challengeDraftRef.current = nextDraft;
      setChallengeDraft(nextDraft);
      setChallengeDraftNotice(`성도 지정 위치 (${code})를 체크포인트로 추가했습니다.`);
    },
    [challengePickAllowEmpty]
  );

  const handleAddCenterChallengeCheckpoint = useCallback(() => {
    const prev = challengeDraftRef.current;
    if (!prev) return;
    const curView = viewRef.current;
    const raDeg = ((curView.ra * 15) % 360 + 360) % 360;
    const decDeg = Math.max(-90, Math.min(90, curView.dec));
    const fovDeg = Number(Math.max(0.05, Math.min(180, curView.fsz)).toFixed(2));
    const idx = prev.checkpoints.length + 1;
    const code = `CP ${String(idx).padStart(2, '0')}`;
    const lastStage =
      prev.checkpoints[prev.checkpoints.length - 1]?.stage || '1구간 · 기본 코스';
    const newCp: ChallengeCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code,
      name: `화면 중심 지점 ${idx}`,
      kind: 'dso',
      stage: lastStage,
      objectType: '지정 위치',
      ra: raDeg,
      dec: decDeg,
      fovDeg,
      guideNote: `RA ${formatRA(raDeg)} · Dec ${formatDec(decDeg)} · 화각 ${formatFovLabel(fovDeg)}`,
      observed: false,
    };
    const nextDraft: ChallengeTrack = {
      ...prev,
      checkpoints: [...prev.checkpoints, newCp],
    };
    challengeDraftRef.current = nextDraft;
    setChallengeDraft(nextDraft);
    setChallengeDraftNotice(
      `현재 성도 중심위치 및 화각(${formatFovLabel(fovDeg)})을 체크포인트(${code})로 추가했습니다.`
    );
  }, []);

  const handleUndoChallengeCheckpoint = useCallback(() => {
    const prev = challengeDraftRef.current;
    if (!prev || prev.checkpoints.length === 0) return;
    const last = prev.checkpoints[prev.checkpoints.length - 1];
    const nextDraft: ChallengeTrack = {
      ...prev,
      checkpoints: prev.checkpoints.slice(0, -1),
    };
    challengeDraftRef.current = nextDraft;
    setChallengeDraft(nextDraft);
    setChallengeDraftNotice(`'${last.name}' 체크포인트 추가를 취소했습니다.`);
  }, []);

  const handleResetBuiltInChallenge = useCallback((trackId: string) => {
    const fresh = createDefaultChallengeTracks().find((t) => t.id === trackId);
    if (!fresh) return;
    setChallenges((prev) =>
      prev.map((t) => (t.id === trackId ? { ...fresh, activeOnChart: t.activeOnChart } : t))
    );
  }, []);

  const handleImportChallenges = useCallback((incoming: ChallengeTrack[]) => {
    const res = mergeChallengeTracks(challengesRef.current, incoming);
    challengesRef.current = res.merged;
    setChallenges(res.merged);
    return { addedCount: res.addedCount, updatedCount: res.updatedCount };
  }, []);

  const handleFrameChallengeTrack = useCallback(
    (track: ChallengeTrack, immediate = false) => {
      setChallenges((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, activeOnChart: true } : t))
      );

      const coords: { ra: number; dec: number }[] = [];
      for (const cp of track.checkpoints) {
        if (cp.ra !== undefined && cp.dec !== undefined) {
          coords.push({ ra: cp.ra, dec: cp.dec });
        } else if (cp.catalogId) {
          const key = cp.catalogId.replace(/\s+/g, '').toUpperCase();
          const dsoHit =
            catalogs.dsosBright.find(
              (d) =>
                d.id.replace(/\s+/g, '').toUpperCase() === key ||
                (d.altId && d.altId.replace(/\s+/g, '').toUpperCase() === key)
            ) ??
            catalogs.caldwell.find(
              (d) =>
                d.id.replace(/\s+/g, '').toUpperCase() === key ||
                (d.altId && d.altId.replace(/\s+/g, '').toUpperCase() === key)
            ) ??
            catalogs.dsosDeep.find(
              (d) =>
                d.id.replace(/\s+/g, '').toUpperCase() === key ||
                (d.altId && d.altId.replace(/\s+/g, '').toUpperCase() === key)
            ) ??
            catalogs.darkNebulae.find((d) => d.id.replace(/\s+/g, '').toUpperCase() === key);
          if (dsoHit) {
            coords.push({ ra: dsoHit.ra, dec: dsoHit.dec });
          } else {
            const starHit = catalogs.brightStars.find(
              (s) =>
                s.id.replace(/\s+/g, '').toUpperCase() === key ||
                (s.hip && `HIP${s.hip}` === key) ||
                (s.name && s.name.replace(/\s+/g, '').toUpperCase() === key)
            );
            if (starHit) {
              coords.push({ ra: starHit.ra, dec: starHit.dec });
            } else {
              const dblHit = catalogs.doubleStars.find(
                (d) => d.id.replace(/\s+/g, '').toUpperCase() === key
              );
              if (dblHit) coords.push({ ra: dblHit.ra, dec: dblHit.dec });
            }
          }
        }
      }
      if (track.guidePolygons) {
        for (const poly of track.guidePolygons) {
          for (const p of poly.points) {
            coords.push({ ra: p.ra, dec: p.dec });
          }
        }
      }
      if (coords.length === 0) return;

      const unitVecs = coords.map((c) => {
        const a = c.ra * DEG2RAD;
        const d = c.dec * DEG2RAD;
        const cosD = Math.cos(d);
        return { x: cosD * Math.cos(a), y: cosD * Math.sin(a), z: Math.sin(d) };
      });

      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const v of unitVecs) {
        sx += v.x;
        sy += v.y;
        sz += v.z;
      }
      const len = Math.hypot(sx, sy, sz);

      centerLockedRef.current = false;
      setCenterLocked(false);
      lockedHzRef.current = null;

      if (len < 1e-4) {
        // Full-sky marathon (like Messier 110): frame at wide FOV centered on first active checkpoint
        const firstTarget =
          track.checkpoints.find((c) => !c.observed && c.ra !== undefined && c.dec !== undefined) ??
          track.checkpoints.find((c) => c.ra !== undefined && c.dec !== undefined);
        if (firstTarget && firstTarget.ra !== undefined && firstTarget.dec !== undefined) {
          const targetRaDeg = ((firstTarget.ra % 360) + 360) % 360;
          const targetDecDeg = Math.max(-85, Math.min(85, firstTarget.dec));
          if (!immediate && canvasHandleRef.current) {
            canvasHandleRef.current.smoothCenterOn(targetRaDeg, targetDecDeg, { targetFsz: 150 });
          } else {
            handleChangeView((p) => ({
              ...p,
              ra: ((targetRaDeg / 15) % 24 + 24) % 24,
              dec: targetDecDeg,
              fsz: 150,
            }));
          }
        }
        return;
      }

      // Refine spherical center toward the minimum enclosing circle center so the entire course fits tightly
      let cx = sx / len;
      let cy = sy / len;
      let cz = sz / len;
      if (unitVecs.length >= 2) {
        for (let iter = 0; iter < 12; iter++) {
          let minDot = 2;
          let farIdx = 0;
          for (let i = 0; i < unitVecs.length; i++) {
            const dot = cx * unitVecs[i].x + cy * unitVecs[i].y + cz * unitVecs[i].z;
            if (dot < minDot) {
              minDot = dot;
              farIdx = i;
            }
          }
          // Stop nudging if course spans more than a hemisphere
          if (minDot <= 0) break;
          const step = 0.45 / (iter + 1);
          cx += step * unitVecs[farIdx].x;
          cy += step * unitVecs[farIdx].y;
          cz += step * unitVecs[farIdx].z;
          const n = Math.hypot(cx, cy, cz) || 1;
          cx /= n;
          cy /= n;
          cz /= n;
        }
      }

      const centerRaDeg = (((Math.atan2(cy, cx) * RAD2DEG) % 360) + 360) % 360;
      const centerDecDeg = Math.max(
        -85,
        Math.min(85, Math.asin(Math.max(-1, Math.min(1, cz))) * RAD2DEG)
      );

      let maxDist = 0;
      for (const c of coords) {
        const d = angularDistanceDeg(centerRaDeg, centerDecDeg, c.ra, c.dec);
        if (d > maxDist) maxDist = d;
      }

      // Fit entire course with comfortable ~25% padding, zooming in tightly for compact courses
      const targetFsz =
        coords.length === 1
          ? 6
          : maxDist > 68
          ? Math.min(175, Math.max(145, maxDist * 2.15))
          : Math.max(1.2, Math.min(170, maxDist * 2.5));

      if (!immediate && canvasHandleRef.current) {
        canvasHandleRef.current.smoothCenterOn(centerRaDeg, centerDecDeg, { targetFsz });
      } else {
        handleChangeView((p) => ({
          ...p,
          ra: ((centerRaDeg / 15) % 24 + 24) % 24,
          dec: centerDecDeg,
          fsz: targetFsz,
        }));
      }
    },
    [catalogs, handleChangeView]
  );

  const handlePrintChallengeCertificate = useCallback(
    (track: ChallengeTrack) => {
      handleFrameChallengeTrack(track, true);
      window.setTimeout(() => {
        const dataUrl = canvasHandleRef.current?.renderPrintableChart({
          title: `${track.title} 관측 투어 성도`,
        });
        if (dataUrl) {
          setPrintPreview({ dataUrl, title: `${track.title} 관측 투어 성도` });
        }
      }, 120);
    },
    [handleFrameChallengeTrack]
  );

  const handleSelectChallengeCheckpoint = useCallback(
    (track: ChallengeTrack, cp: ChallengeCheckpoint) => {
      setChallenges((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, activeOnChart: true } : t))
      );

      const snap = getCatalogSnapshot();
      const key = cp.catalogId ? cp.catalogId.replace(/\s+/g, '').toUpperCase() : '';
      let item: SelectedItem | null = null;

      if (cp.kind === 'dso' && key) {
        const allDsos = [
          ...snap.dsosBright,
          ...snap.darkNebulae,
          ...snap.dsosDeep,
          ...snap.caldwell,
        ];
        const found = allDsos.find(
          (d) =>
            d.id.replace(/\s+/g, '').toUpperCase() === key ||
            (d.altId && d.altId.replace(/\s+/g, '').toUpperCase() === key)
        );
        if (found) item = { kind: 'dso', data: found };
      } else if (cp.kind === 'star' && key) {
        const matchStar = (s: StarType) =>
          s.id.replace(/\s+/g, '').toUpperCase() === key ||
          (s.hip && `HIP${s.hip}` === key) ||
          (s.name && s.name.replace(/\s+/g, '').toUpperCase() === key);
        let found =
          snap.brightStars.find(matchStar) ?? snap.deepStars.find(matchStar);
        if (!found) {
          for (const tile of snap.ultraStarTiles.values()) {
            const hit = tile.find(matchStar);
            if (hit) {
              found = hit;
              break;
            }
          }
        }
        if (found) item = { kind: 'star', data: found };
      } else if (cp.kind === 'double' && key) {
        const found = snap.doubleStars.find(
          (d) => d.id.replace(/\s+/g, '').toUpperCase() === key
        );
        if (found) item = { kind: 'double', data: found };
      }

      if (!item && cp.ra !== undefined && cp.dec !== undefined) {
        if (cp.kind === 'star') {
          const synthStar: StarType = {
            id: cp.catalogId || cp.id,
            ra: cp.ra,
            dec: cp.dec,
            mag: cp.mag ?? 2.0,
            bv: 0.4,
            koName: cp.name,
            name: cp.name,
            con: cp.constellation || '',
          };
          item = { kind: 'star', data: synthStar };
        } else {
          const synthDso: DeepSkyObject = {
            id: cp.catalogId || cp.code,
            type: 'DN',
            ra: cp.ra,
            dec: cp.dec,
            mag: cp.mag ?? 7.0,
            majAx: 20,
            minAx: 15,
            pa: 0,
            koName: cp.name,
            name: cp.name,
            con: cp.constellation || '',
          };
          item = { kind: 'dso', data: synthDso };
        }
      }

      if (item) {
        detailWindowOpenRef.current = false;
        setDetailWindowOpen(false);
        selectedRef.current = item;
        setSelected(item);
        centerLockedRef.current = false;
        setCenterLocked(false);
        lockedHzRef.current = null;
        const targetFov =
          cp.fovDeg !== undefined && Number.isFinite(cp.fovDeg) && cp.fovDeg > 0
            ? Math.max(0.05, Math.min(180, cp.fovDeg))
            : null;
        handleChangeView((p) => ({
          ...p,
          ra: ((item!.data.ra / 15) % 24 + 24) % 24,
          dec: Math.max(-89.5, Math.min(89.5, item!.data.dec)),
          fsz: targetFov ?? Math.min(p.fsz, item!.kind === 'dso' ? 18 : 24),
        }));
      }
    },
    [handleChangeView]
  );

  // =================== Guided Auto-Tour ("오늘의 투어" & Challenge Auto-Tour) ===================
  const [tourState, setTourState] = useState<GuidedTourState>({
    active: false,
    title: '오늘의 투어',
    trackId: null,
    stops: [],
    currentIndex: 0,
    playing: false,
    pausedByUser: false,
    completed: false,
    dwellSec: 8,
    phase: 'dwelling',
  });
  const [tourDwellProgress, setTourDwellProgress] = useState(0);
  const tourStateRef = useRef<GuidedTourState>(tourState);
  tourStateRef.current = tourState;
  const tourRunTokenRef = useRef(0);

  const tonightTourTimeBucket = Math.floor(observer.timestampMs / 300000);
  const tonightTourStops = useMemo(
    () => buildTonightTourStops(observer, catalogs, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      observer.lat,
      observer.lon,
      tonightTourTimeBucket,
      catalogs.coreLoaded,
      catalogs.doubleStarsLoaded,
    ]
  );

  const navigateTourToStop = useCallback(
    (
      stops: TourStop[],
      index: number,
      autoPlay: boolean,
      meta?: { title: string; trackId: string | null }
    ) => {
      if (stops.length === 0) return;
      const safeIdx = Math.max(0, Math.min(stops.length - 1, index));
      const stop = stops[safeIdx];
      const token = ++tourRunTokenRef.current;

      setTourDwellProgress(0);
      detailWindowOpenRef.current = false;
      setDetailWindowOpen(false);
      selectedRef.current = stop.selectedItem;
      setSelected(stop.selectedItem);
      centerLockedRef.current = false;
      setCenterLocked(false);
      lockedHzRef.current = null;

      // Ensure the target's catalog layer is visible during the guided tour
      setLayers((prev) => {
        if (stop.kind === 'planet' && !prev.showSolarSystem) {
          return { ...prev, showSolarSystem: true };
        }
        if (stop.kind === 'double' && !prev.showDoubleStars) {
          return { ...prev, showDoubleStars: true };
        }
        if (stop.kind === 'dso') {
          const isMessier = /^M\d+$/i.test(stop.selectedItem.data.id);
          const isCaldwell =
            /^C\d+$/i.test(stop.selectedItem.data.id) ||
            (stop.selectedItem.kind === 'dso' &&
              Boolean(stop.selectedItem.data.altId && /^C\d+$/i.test(stop.selectedItem.data.altId)));
          if (isMessier && !prev.showMessierCatalog && !prev.showDso) {
            return { ...prev, showMessierCatalog: true };
          }
          if (isCaldwell && !prev.showCaldwellCatalog && !prev.showDso) {
            return { ...prev, showCaldwellCatalog: true };
          }
          if (!isMessier && !isCaldwell && !prev.showDso) {
            return { ...prev, showDso: true };
          }
        }
        return prev;
      });

      setTourState((prev) => ({
        ...prev,
        active: true,
        title: meta ? meta.title : prev.title,
        trackId: meta !== undefined ? meta.trackId : prev.trackId,
        stops,
        currentIndex: safeIdx,
        playing: autoPlay,
        pausedByUser: false,
        completed: false,
        phase: 'slewing',
      }));

      canvasHandleRef.current?.smoothCenterOn(stop.ra, stop.dec, {
        targetFsz: stop.recommendedFovDeg,
        arcZoomOut: true,
        onComplete: () => {
          if (tourRunTokenRef.current !== token) return;
          setTourState((prev) => (prev.active ? { ...prev, phase: 'dwelling' } : prev));
        },
      });
    },
    []
  );

  const handleStartTonightTour = useCallback(
    (startIndex = 0) => {
      const playable = challengesRef.current.filter((t) => t.checkpoints.length > 0);
      if (playable.length === 0) return;
      const currentTrackId = tourStateRef.current.active ? tourStateRef.current.trackId : null;
      const candidates =
        playable.length > 1 && currentTrackId
          ? playable.filter((t) => t.id !== currentTrackId)
          : playable;
      const picked = candidates[Math.floor(Math.random() * candidates.length)] ?? playable[0];
      setChallenges((prev) =>
        prev.map((t) => ({ ...t, activeOnChart: t.id === picked.id }))
      );
      const stops = buildChallengeTourStops(picked, observer, getCatalogSnapshot());
      if (stops.length === 0) return;
      navigateTourToStop(stops, startIndex, true, {
        title: `오늘의 투어 · ${picked.title}`,
        trackId: picked.id,
      });
    },
    [observer, navigateTourToStop]
  );

  const handleStartChallengeTour = useCallback(
    (track: ChallengeTrack, startIndex = 0) => {
      setChallenges((prev) =>
        prev.map((t) => ({ ...t, activeOnChart: t.id === track.id }))
      );
      const stops = buildChallengeTourStops(track, observer, getCatalogSnapshot());
      if (stops.length === 0) return;
      navigateTourToStop(stops, startIndex, true, {
        title: track.title,
        trackId: track.id,
      });
    },
    [observer, navigateTourToStop]
  );

  const handleStopTour = useCallback(() => {
    tourRunTokenRef.current++;
    canvasHandleRef.current?.cancelSmoothCenter();
    setTourDwellProgress(0);
    setTourState((prev) => ({
      ...prev,
      active: false,
      playing: false,
      pausedByUser: false,
      completed: false,
      phase: 'dwelling',
    }));
  }, []);

  const handleToggleTourPlay = useCallback(() => {
    const cur = tourStateRef.current;
    if (!cur.active || cur.stops.length === 0) return;
    if (cur.completed) {
      navigateTourToStop(cur.stops, 0, true);
      return;
    }
    if (cur.playing) {
      tourRunTokenRef.current++;
      canvasHandleRef.current?.cancelSmoothCenter();
      setTourState((prev) => ({
        ...prev,
        playing: false,
        pausedByUser: false,
        phase: 'dwelling',
      }));
    } else {
      // If paused after manual panning/zooming, smoothly re-frame current stop before resuming dwell
      if (cur.pausedByUser) {
        navigateTourToStop(cur.stops, cur.currentIndex, true);
      } else {
        setTourState((prev) => ({
          ...prev,
          playing: true,
          pausedByUser: false,
          phase: 'dwelling',
        }));
      }
    }
  }, [navigateTourToStop]);

  const handleJumpTourStop = useCallback(
    (index: number) => {
      const cur = tourStateRef.current;
      if (!cur.active || cur.stops.length === 0) return;
      navigateTourToStop(cur.stops, index, cur.playing || cur.completed);
    },
    [navigateTourToStop]
  );

  const handlePrevTourStop = useCallback(() => {
    const cur = tourStateRef.current;
    if (!cur.active || cur.currentIndex <= 0) return;
    navigateTourToStop(cur.stops, cur.currentIndex - 1, cur.playing);
  }, [navigateTourToStop]);

  const handleNextTourStop = useCallback(() => {
    const cur = tourStateRef.current;
    if (!cur.active || cur.currentIndex >= cur.stops.length - 1) return;
    navigateTourToStop(cur.stops, cur.currentIndex + 1, cur.playing);
  }, [navigateTourToStop]);

  const handleChangeTourDwellSec = useCallback((sec: number) => {
    setTourState((prev) => ({ ...prev, dwellSec: sec }));
  }, []);

  const handleCycleTourDwellSec = useCallback(() => {
    setTourState((prev) => {
      const idx = TOUR_DWELL_OPTIONS.indexOf(
        prev.dwellSec as (typeof TOUR_DWELL_OPTIONS)[number]
      );
      const nextSec = TOUR_DWELL_OPTIONS[(idx + 1) % TOUR_DWELL_OPTIONS.length];
      return { ...prev, dwellSec: nextSec };
    });
  }, []);

  const handleUserCameraInteract = useCallback(() => {
    const cur = tourStateRef.current;
    if (!cur.active || !cur.playing) return;
    tourRunTokenRef.current++;
    setTourState((prev) =>
      prev.active && prev.playing
        ? { ...prev, playing: false, pausedByUser: true, phase: 'dwelling' }
        : prev
    );
  }, []);

  // Auto-advance dwell countdown timer while tour is playing & dwelling on a stop
  useEffect(() => {
    if (
      !tourState.active ||
      !tourState.playing ||
      tourState.completed ||
      tourState.phase !== 'dwelling'
    ) {
      return;
    }

    const dwellMs = Math.max(2000, tourState.dwellSec * 1000);
    const startMs = performance.now();
    let rafId = 0;
    let lastPaintMs = 0;

    const tick = (now: number) => {
      const elapsed = now - startMs;
      const ratio = Math.min(1, elapsed / dwellMs);
      if (now - lastPaintMs >= 60 || ratio >= 1) {
        setTourDwellProgress(ratio);
        lastPaintMs = now;
      }

      if (ratio >= 1) {
        const cur = tourStateRef.current;
        if (!cur.active || !cur.playing) return;
        if (cur.currentIndex + 1 < cur.stops.length) {
          navigateTourToStop(cur.stops, cur.currentIndex + 1, true);
        } else {
          setTourState((prev) => ({
            ...prev,
            playing: false,
            completed: true,
            phase: 'dwelling',
          }));
        }
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    tourState.active,
    tourState.playing,
    tourState.completed,
    tourState.phase,
    tourState.currentIndex,
    tourState.dwellSec,
    navigateTourToStop,
  ]);

  // Keyboard shortcuts while Guided Auto-Tour is active
  useEffect(() => {
    if (!tourState.active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleStopTour();
      } else if (e.key === ' ' && tag !== 'BUTTON') {
        e.preventDefault();
        handleToggleTourPlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextTourStop();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevTourStop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    tourState.active,
    handleStopTour,
    handleToggleTourPlay,
    handleNextTourStop,
    handlePrevTourStop,
  ]);

  const currentTourStop = tourState.active ? tourState.stops[tourState.currentIndex] : undefined;
  const isCurrentTourCheckpointObserved = useMemo(() => {
    if (!tourState.trackId || !currentTourStop?.checkpointId) return false;
    const tr = challenges.find((t) => t.id === tourState.trackId);
    const cp = tr?.checkpoints.find((c) => c.id === currentTourStop.checkpointId);
    return Boolean(cp?.observed);
  }, [challenges, tourState.trackId, currentTourStop]);

  const handleCopyShareUrl = async () => {
    syncUrlState(view, theme);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handlePrintWhiteChart = () => {
    const dataUrl = canvasHandleRef.current?.renderPrintableChart();
    if (dataUrl) {
      setPrintPreview({ dataUrl, title: 'NoxChart 인쇄용 성도' });
    } else {
      window.print();
    }
  };

  const handleDownloadPrintablePng = () => {
    if (!printPreview) return;
    const link = document.createElement('a');
    link.download = `noxchart-print-${view.coordSystem}-ra${view.ra.toFixed(2)}-dec${view.dec.toFixed(1)}.png`;
    link.href = printPreview.dataUrl;
    link.click();
  };

  const handleImportLayerSettings = useCallback((bundle: LayerSettingsBundle) => {
    setLayers(bundle.layers);
    setHips(bundle.hips);
  }, []);

  const handleResetLayerSettings = useCallback(() => {
    const isHorizontal = viewRef.current.coordSystem === 'horizontal';
    setLayers({
      ...DEFAULT_LAYERS,
      dsoCategories: { ...DEFAULT_LAYERS.dsoCategories },
      showGridEq: !isHorizontal,
      showGridAltAz: isHorizontal,
      showHorizon: isHorizontal,
      showTerrain: isHorizontal,
    });
    setHips({ ...DEFAULT_HIPS });
  }, []);

  const handleResetToDefaults = () => {
    lockedHzRef.current = null;
    const resetObs: ObserverConfig = {
      ...DEFAULT_OBSERVER,
      timestampMs: Date.now(),
    };
    const defaultHzCenter = getDefaultHorizontalCenter(resetObs);
    handleChangeView({
      ...DEFAULT_VIEW,
      ra: defaultHzCenter.ra,
      dec: defaultHzCenter.dec,
    });
    setTheme(DEFAULT_THEME);
    setLayers({
      ...DEFAULT_LAYERS,
      dsoCategories: { ...DEFAULT_LAYERS.dsoCategories },
    });
    setOptics({ ...DEFAULT_OPTICS });
    observerRef.current = resetObs;
    setObserver(resetObs);
    setHips({ ...DEFAULT_HIPS });
    centerLockedRef.current = false;
    setCenterLocked(false);
    solarTrailsRef.current = {};
    setSolarTrails({});
    selectedRef.current = null;
    setSelected(null);
    setDetailWindowOpen(false);
    setRightOpen(false);
    setLeftOpen(false);
    setInspectorTab('session');
    setChallengeDraft(null);
    setChallengeDraftIsNew(false);
    setChallengeDraftNotice(null);
    setSearchActive(false);
    setResetCount((c) => c + 1);
  };

  // Clicking "NoxChart" resets ONLY the camera/FOV back to initial view, keeping all settings intact
  const handleResetViewOnly = useCallback(() => {
    lockedHzRef.current = null;
    centerLockedRef.current = false;
    setCenterLocked(false);
    canvasHandleRef.current?.cancelSmoothCenter();
    const defaultHzCenter = getDefaultHorizontalCenter(observerRef.current);
    handleChangeView((prev) => ({
      ...prev,
      ra: defaultHzCenter.ra,
      dec: defaultHzCenter.dec,
      fsz: DEFAULT_VIEW.fsz,
      flipH: false,
      flipV: false,
    }));
  }, [handleChangeView]);

  const isChallengePicking = Boolean(challengeDraft);

  const chartChallenges = useMemo(() => {
    if (tourState.active) return [];
    if (!challengeDraft) return challenges;
    const draftOverlay: ChallengeTrack = { ...challengeDraft, activeOnChart: true };
    const exists = challenges.some((t) => t.id === challengeDraft.id);
    return exists
      ? challenges.map((t) => (t.id === challengeDraft.id ? draftOverlay : t))
      : [draftOverlay, ...challenges];
  }, [challenges, challengeDraft, tourState.active]);

  // During active tour: display ONLY constellation lines, solar system, star labels,
  // DSO labels (no symbols), and hybrid real-sky background; hide all other clutter.
  const tourAwareLayers = useMemo<LayerSettings>(() => {
    if (!tourState.active) return effectiveLayers;
    return {
      ...effectiveLayers,
      showConstellationLines: true,
      showConstellationBoundaries: false,
      showConstellationNames: false,
      showSolarSystem: true,
      showPlanetSurface: true,
      showSolarSystemLabels: true,
      showSolarSystemOrbits: false,
      showStarLabels: true,
      showProperStarNames: true,
      showDso: true,
      showMessierCatalog: true,
      showCaldwellCatalog: true,
      showDsoLabels: true,
      hideDsoSymbols: true,
      showDoubleStars: false,
      showDoublePairs: false,
      showMultipleStars: false,
      showDoubleStarLabels: false,
      showNebulaContours: false,
      showMilkyWay: false,
      showGridEq: false,
      showGridAltAz: false,
      showHorizon: false,
      showTerrain: false,
      showEcliptic: false,
      showFieldStars: false,
      highlightSessionPlan: false,
    };
  }, [tourState.active, effectiveLayers]);

  const tourAwareHips = useMemo<HipsSettings>(() => {
    if (!tourState.active) return effectiveHips;
    return {
      ...effectiveHips,
      enabled: true,
      opacity: Math.max(effectiveHips.opacity, 0.78),
    };
  }, [tourState.active, effectiveHips]);

  const tourAwareOptics = useMemo<OpticsSettings>(() => {
    if (!tourState.active) return optics;
    return {
      ...optics,
      showCrosshair: false,
      showTelrad: false,
      showFinder7x50: false,
      showEyepiece: false,
      showSensorBox: false,
      showStarHop: false,
      showSelectionMark: false,
    };
  }, [tourState.active, optics]);

  const tourAwareAsterismStore = useMemo<AsterismStoreState>(() => {
    if (!tourState.active) return asterismStore;
    return {
      ...asterismStore,
      objects: [],
    };
  }, [tourState.active, asterismStore]);

  // ---------------------------------------------------------------------------
  // Custom Asterism & Star Chain Drawing Handlers (Group > Asterism > Shape)
  // ---------------------------------------------------------------------------
  const commitAsterismMutation = useCallback(
    (mutator: (prev: AsterismStoreState) => AsterismStoreState) => {
      const prev = asterismStoreRef.current;
      const next = mutator(prev);
      if (next === prev) return;
      setAsterismPast((hist) => [
        ...hist.slice(-49),
        {
          layers: prev.layers,
          activeLayerId: prev.activeLayerId,
          asterisms: prev.asterisms,
          activeAsterismId: prev.activeAsterismId,
          objects: prev.objects,
        },
      ]);
      setAsterismFuture([]);
      asterismStoreRef.current = next;
      setAsterismStore(next);
    },
    []
  );

  const handleUndoAsterism = useCallback(() => {
    setAsterismPast((past) => {
      if (past.length === 0) return past;
      const prevSnap = past[past.length - 1];
      const cur = asterismStoreRef.current;
      setAsterismFuture((fut) => [
        {
          layers: cur.layers,
          activeLayerId: cur.activeLayerId,
          asterisms: cur.asterisms,
          activeAsterismId: cur.activeAsterismId,
          objects: cur.objects,
        },
        ...fut.slice(0, 49),
      ]);
      const restored: AsterismStoreState = {
        ...cur,
        layers: prevSnap.layers,
        activeLayerId: prevSnap.activeLayerId,
        asterisms: prevSnap.asterisms,
        activeAsterismId: prevSnap.activeAsterismId,
        objects: prevSnap.objects,
      };
      asterismStoreRef.current = restored;
      setAsterismStore(restored);
      setAsterismDraft(null);
      return past.slice(0, -1);
    });
  }, []);

  const handleRedoAsterism = useCallback(() => {
    setAsterismFuture((fut) => {
      if (fut.length === 0) return fut;
      const nextSnap = fut[0];
      const cur = asterismStoreRef.current;
      setAsterismPast((past) => [
        ...past.slice(-49),
        {
          layers: cur.layers,
          activeLayerId: cur.activeLayerId,
          asterisms: cur.asterisms,
          activeAsterismId: cur.activeAsterismId,
          objects: cur.objects,
        },
      ]);
      const restored: AsterismStoreState = {
        ...cur,
        layers: nextSnap.layers,
        activeLayerId: nextSnap.activeLayerId,
        asterisms: nextSnap.asterisms,
        activeAsterismId: nextSnap.activeAsterismId,
        objects: nextSnap.objects,
      };
      asterismStoreRef.current = restored;
      setAsterismStore(restored);
      setAsterismDraft(null);
      return fut.slice(1);
    });
  }, []);

  const ensureWorkingAsterism = (
    prev: AsterismStoreState
  ): { state: AsterismStoreState; asterism: AsterismGroup } => {
    if (prev.activeAsterismId) {
      const found = prev.asterisms.find((g) => g.id === prev.activeAsterismId);
      if (found) {
        return { state: prev, asterism: found };
      }
    }
    const newGrp: AsterismGroup = {
      id: makeAsterismId('grp'),
      layerId: prev.activeLayerId,
      name: getNextAsterismGroupName(prev.asterisms),
      visible: true,
      visibleFovRange: [
        prev.settings.defaultVisibleFovRange[0],
        prev.settings.defaultVisibleFovRange[1],
      ],
      createdAt: Date.now(),
    };
    return {
      state: {
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === prev.activeLayerId ? { ...l, visible: true } : l
        ),
        asterisms: [...prev.asterisms, newGrp],
        activeAsterismId: newGrp.id,
      },
      asterism: newGrp,
    };
  };

  const handleChangeAsterismTool = useCallback((tool: AsterismTool) => {
    setAsterismDraft(null);
    setAsterismTool((prev) => (tool !== 'select' && prev === tool ? 'select' : tool));
  }, []);

  const handleCloseAsterismMode = useCallback(() => {
    setAsterismDraft(null);
    setAsterismSelectedId(null);
    setAsterismTool('select');
    setAsterismPopover('none');
    setAsterismMode(false);
  }, []);

  const handleSelectAsterism = useCallback((id: string | null) => {
    setAsterismSelectedId(id);
    if (id) {
      const obj = asterismStoreRef.current.objects.find((o) => o.id === id);
      if (obj && obj.asterismId && asterismStoreRef.current.activeAsterismId !== obj.asterismId) {
        setAsterismStore((prev) => {
          const next = { ...prev, activeAsterismId: obj.asterismId };
          asterismStoreRef.current = next;
          return next;
        });
      }
    }
  }, []);

  const handleSetActiveAsterism = useCallback((asterismId: string | null) => {
    setAsterismStore((prev) => {
      if (asterismId !== null && !prev.asterisms.some((g) => g.id === asterismId)) return prev;
      const grp = asterismId ? prev.asterisms.find((g) => g.id === asterismId) : null;
      const next: AsterismStoreState = {
        ...prev,
        activeAsterismId: asterismId,
        activeLayerId: grp ? grp.layerId : prev.activeLayerId,
      };
      asterismStoreRef.current = next;
      return next;
    });
  }, []);

  const handleOpenAsterismLayers = useCallback(
    (asterismId: string) => {
      handleSetActiveAsterism(asterismId);
      setAsterismSelectedId(null);
      setAsterismDraft(null);
      setAsterismTool('select');
      setAsterismMode(true);
      setAsterismPopover('layers');
    },
    [handleSetActiveAsterism]
  );

  const handleOpenAsterismShapeProps = useCallback(
    (asterismId: string, objectId: string) => {
      handleSetActiveAsterism(asterismId);
      setAsterismSelectedId(objectId);
      setAsterismDraft(null);
      setAsterismTool('select');
      setAsterismMode(true);
      setAsterismPopover('props');
    },
    [handleSetActiveAsterism]
  );

  const handleCreateAsterismGroup = useCallback(
    (name?: string, layerId?: string): string => {
      const cur = asterismStoreRef.current;
      const resolvedLayerId =
        layerId && cur.layers.some((l) => l.id === layerId) ? layerId : cur.activeLayerId;
      const newGrp: AsterismGroup = {
        id: makeAsterismId('grp'),
        layerId: resolvedLayerId,
        name: name?.trim() || getNextAsterismGroupName(cur.asterisms),
        visible: true,
        visibleFovRange: [
          cur.settings.defaultVisibleFovRange[0],
          cur.settings.defaultVisibleFovRange[1],
        ],
        createdAt: Date.now(),
      };
      commitAsterismMutation((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === resolvedLayerId ? { ...l, visible: true } : l
        ),
        activeLayerId: resolvedLayerId,
        asterisms: [...prev.asterisms, newGrp],
        activeAsterismId: newGrp.id,
      }));
      setAsterismSelectedId(null);
      setAsterismDraft(null);
      return newGrp.id;
    },
    [commitAsterismMutation]
  );

  const handleStartNewAsterismFromStar = useCallback(
    (vertex: AsterismVertex) => {
      handleCreateAsterismGroup();
      setAsterismTool('polyline');
      setAsterismDraft({ type: 'polyline', vertices: [vertex] });
    },
    [handleCreateAsterismGroup]
  );

  const handleUpdateAsterismGroup = useCallback(
    (asterismId: string, patch: Partial<AsterismGroup>) => {
      commitAsterismMutation((prev) => {
        const nextAsterisms = prev.asterisms.map((g) =>
          g.id === asterismId ? { ...g, ...patch } : g
        );
        const nextObjects =
          patch.layerId !== undefined
            ? prev.objects.map((o) =>
                o.asterismId === asterismId ? { ...o, layerId: patch.layerId! } : o
              )
            : prev.objects;
        return {
          ...prev,
          asterisms: nextAsterisms,
          objects: nextObjects,
        };
      });
    },
    [commitAsterismMutation]
  );

  const handleDeleteAsterismGroup = useCallback(
    async (asterismId: string): Promise<boolean> => {
      const cur = asterismStoreRef.current;
      const target = cur.asterisms.find((g) => g.id === asterismId);
      if (!target) return false;
      const childCount = cur.objects.filter((o) => o.asterismId === asterismId).length;
      const ok = await requestConfirm({
        title: '성군 삭제 확인',
        message: `‘${target.name}’ 성군을 삭제하시겠습니까?`,
        detail:
          childCount > 0
            ? `이 성군에 포함된 도형 요소 ${childCount}개도 함께 삭제됩니다.`
            : undefined,
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      const wasActiveAsterism = asterismStoreRef.current.activeAsterismId === asterismId;
      commitAsterismMutation((prev) => {
        const remainingAsterisms = prev.asterisms.filter((g) => g.id !== asterismId);
        const remainingObjects = prev.objects.filter((o) => o.asterismId !== asterismId);
        return {
          ...prev,
          asterisms: remainingAsterisms,
          activeAsterismId: prev.activeAsterismId === asterismId ? null : prev.activeAsterismId,
          objects: remainingObjects,
        };
      });
      if (wasActiveAsterism) {
        handleCloseAsterismMode();
      } else {
        setAsterismSelectedId((sel) => {
          if (!sel) return null;
          const stillExists = asterismStoreRef.current.objects.some((o) => o.id === sel);
          return stillExists ? sel : null;
        });
      }
      return true;
    },
    [commitAsterismMutation, handleCloseAsterismMode, requestConfirm]
  );

  const handleToggleAsterismGroupVisible = useCallback((asterismId: string) => {
    setAsterismStore((prev) => {
      const target = prev.asterisms.find((g) => g.id === asterismId);
      if (!target) return prev;
      const nextAsterisms = prev.asterisms.map((g) =>
        g.id === asterismId ? { ...g, visible: !g.visible } : g
      );
      const anySiblingVisible = nextAsterisms.some(
        (g) => g.layerId === target.layerId && g.visible
      );
      const nextLayers = prev.layers.map((l) =>
        l.id === target.layerId ? { ...l, visible: anySiblingVisible } : l
      );
      const next: AsterismStoreState = {
        ...prev,
        layers: nextLayers,
        asterisms: nextAsterisms,
      };
      asterismStoreRef.current = next;
      return next;
    });
  }, []);

  const handleApplyDefaultsToAsterismGroup = useCallback(
    (asterismId: string) => {
      commitAsterismMutation((prev) => {
        const s = prev.settings;
        const hasAny = prev.objects.some((o) => o.asterismId === asterismId);
        if (!hasAny) return prev;
        return {
          ...prev,
          objects: prev.objects.map((o) =>
            o.asterismId === asterismId
              ? {
                  ...o,
                  lineWidth: s.defaultLineWidth,
                  opacity: s.defaultOpacity,
                  textSize: s.defaultTextSize,
                  textOpacity: s.defaultTextOpacity,
                }
              : o
          ),
        };
      });
    },
    [commitAsterismMutation]
  );

  const handleSaveAsterismGroupView = useCallback(
    (asterismId: string) => {
      const v = viewRef.current;
      const savedView = {
        raDeg: (((v.ra * 15) % 360) + 360) % 360,
        decDeg: Math.max(-90, Math.min(90, v.dec)),
        fsz: Math.max(0.05, Math.min(180, v.fsz)),
      };
      handleUpdateAsterismGroup(asterismId, { savedView });
    },
    [handleUpdateAsterismGroup]
  );

  const handleCreateAsterismCircle = useCallback(
    (
      center: AsterismVertex,
      radiusDeg: number,
      linkedOptions?: {
        lineWidth?: number;
        opacity?: number;
        linkedTitle?: string;
        linkedTitleDirection?: OpticsLabelDirection;
      },
      explicitEdge?: AsterismVertex
    ) => {
      const safeR = Math.max(0.01, Math.min(89, radiusDeg));
      const edgePt =
        explicitEdge ??
        (() => {
          const p = destinationPointSpherical(center.raDeg, center.decDeg, 90, safeR);
          return { raDeg: p.raDeg, decDeg: p.decDeg };
        })();
      let createdId = '';
      commitAsterismMutation((prev) => {
        const { state: base, asterism } = ensureWorkingAsterism(prev);
        const s = base.settings;
        const newObj: AsterismObject = {
          id: makeAsterismId('cir'),
          layerId: asterism.layerId,
          asterismId: asterism.id,
          type: 'circle',
          vertices: [center, edgePt],
          radiusDeg: safeR,
          color: s.defaultColor,
          lineWidth: linkedOptions?.lineWidth ?? s.defaultLineWidth,
          opacity: linkedOptions?.opacity ?? s.defaultOpacity,
          lineStyle: s.defaultLineStyle,
          smooth: false,
          fillAlpha: s.defaultCircleFillEnabled ? s.defaultFillAlpha : 0,
          visibleFovRange: [asterism.visibleFovRange[0], asterism.visibleFovRange[1]],
          label: getNextShapeName('circle', false, base.objects, asterism.id),
          linkedTitle: linkedOptions?.linkedTitle,
          linkedTitleDirection: linkedOptions?.linkedTitleDirection,
          labelAnchor: s.defaultLabelAnchor,
          createdAt: Date.now(),
        };
        createdId = newObj.id;
        return {
          ...base,
          layers: base.layers.map((l) =>
            l.id === asterism.layerId ? { ...l, visible: true } : l
          ),
          asterisms: base.asterisms.map((g) =>
            g.id === asterism.id ? { ...g, visible: true } : g
          ),
          objects: [...base.objects, newObj],
        };
      });
      setAsterismDraft(null);
      if (createdId) setAsterismSelectedId(createdId);
    },
    [commitAsterismMutation]
  );

  const finalizeAsterismVertices = useCallback(
    (tool: 'polyline' | 'polygon' | 'circle' | 'arrow', rawVertices: AsterismVertex[]) => {
      if (tool === 'circle') {
        if (rawVertices.length < 2) {
          setAsterismDraft(null);
          return;
        }
        const rDeg = angularDistanceDeg(
          rawVertices[0].raDeg,
          rawVertices[0].decDeg,
          rawVertices[1].raDeg,
          rawVertices[1].decDeg
        );
        handleCreateAsterismCircle(rawVertices[0], Math.max(0.02, rDeg), undefined, rawVertices[1]);
        return;
      }

      const cleaned: AsterismVertex[] = [];
      for (const v of rawVertices) {
        const last = cleaned[cleaned.length - 1];
        if (!last || angularDistanceDeg(last.raDeg, last.decDeg, v.raDeg, v.decDeg) > 0.0004) {
          cleaned.push(v);
        }
      }
      const minPts = tool === 'polygon' ? 3 : 2;
      if (cleaned.length < minPts) {
        setAsterismDraft(null);
        return;
      }
      let createdId = '';
      commitAsterismMutation((prev) => {
        const { state: base, asterism } = ensureWorkingAsterism(prev);
        const s = base.settings;
        const smooth = tool === 'polyline' ? s.defaultSmooth : false;
        const newObj: AsterismObject = {
          id: makeAsterismId('ast'),
          layerId: asterism.layerId,
          asterismId: asterism.id,
          type: tool,
          vertices: cleaned,
          color: s.defaultColor,
          lineWidth: s.defaultLineWidth,
          opacity: s.defaultOpacity,
          lineStyle: s.defaultLineStyle,
          smooth,
          fillAlpha: tool === 'polygon' ? s.defaultFillAlpha : undefined,
          extensionFactor: tool === 'arrow' ? s.defaultExtensionFactor : undefined,
          visibleFovRange: [asterism.visibleFovRange[0], asterism.visibleFovRange[1]],
          label: getNextShapeName(tool, smooth, base.objects, asterism.id),
          labelAnchor: s.defaultLabelAnchor,
          createdAt: Date.now(),
        };
        createdId = newObj.id;
        return {
          ...base,
          layers: base.layers.map((l) =>
            l.id === asterism.layerId ? { ...l, visible: true } : l
          ),
          asterisms: base.asterisms.map((g) =>
            g.id === asterism.id ? { ...g, visible: true } : g
          ),
          objects: [...base.objects, newObj],
        };
      });
      setAsterismDraft(null);
      if (createdId) setAsterismSelectedId(createdId);
    },
    [commitAsterismMutation, handleCreateAsterismCircle]
  );

  const handleAddAsterismDraftPoint = useCallback(
    (vertex: AsterismVertex) => {
      if (
        asterismTool !== 'polyline' &&
        asterismTool !== 'polygon' &&
        asterismTool !== 'circle' &&
        asterismTool !== 'arrow'
      ) {
        return;
      }
      if (!asterismDraft || asterismDraft.type !== asterismTool) {
        setAsterismDraft({ type: asterismTool, vertices: [vertex] });
        return;
      }
      const last = asterismDraft.vertices[asterismDraft.vertices.length - 1];
      if (last && angularDistanceDeg(last.raDeg, last.decDeg, vertex.raDeg, vertex.decDeg) < 0.0002) {
        return;
      }
      const nextVerts = [...asterismDraft.vertices, vertex];
      if (asterismTool === 'arrow' && nextVerts.length >= 2) {
        finalizeAsterismVertices('arrow', nextVerts);
        return;
      }
      if (asterismTool === 'circle' && nextVerts.length >= 2) {
        finalizeAsterismVertices('circle', nextVerts);
        return;
      }
      setAsterismDraft({ type: asterismTool, vertices: nextVerts });
    },
    [asterismTool, asterismDraft, finalizeAsterismVertices]
  );

  const handleFinishAsterismDraft = useCallback(() => {
    if (!asterismDraft) return;
    finalizeAsterismVertices(asterismDraft.type, asterismDraft.vertices);
  }, [asterismDraft, finalizeAsterismVertices]);

  const handleUndoAsterismDraftPoint = useCallback(() => {
    setAsterismDraft((prev) => {
      if (!prev) return null;
      if (prev.vertices.length <= 1) return null;
      return { ...prev, vertices: prev.vertices.slice(0, -1) };
    });
  }, []);

  const handleCancelAsterismDraft = useCallback(() => {
    setAsterismDraft(null);
  }, []);

  const handleCreateAsterismLabel = useCallback(
    (vertex: AsterismVertex) => {
      let createdId = '';
      commitAsterismMutation((prev) => {
        const { state: base, asterism } = ensureWorkingAsterism(prev);
        const s = base.settings;
        const newObj: AsterismObject = {
          id: makeAsterismId('lbl'),
          layerId: asterism.layerId,
          asterismId: asterism.id,
          type: 'label',
          vertices: [vertex],
          color: s.defaultColor,
          lineWidth: s.defaultLineWidth,
          opacity: s.defaultOpacity,
          textOpacity: s.defaultTextOpacity,
          textSize: s.defaultTextSize,
          lineStyle: 'solid',
          smooth: false,
          visibleFovRange: [asterism.visibleFovRange[0], asterism.visibleFovRange[1]],
          label: getNextShapeName('label', false, base.objects, asterism.id),
          memo: vertex.starName ? `${vertex.starName}` : '관측 텍스트',
          labelAnchor: s.defaultLabelAnchor,
          createdAt: Date.now(),
        };
        createdId = newObj.id;
        return {
          ...base,
          layers: base.layers.map((l) =>
            l.id === asterism.layerId ? { ...l, visible: true } : l
          ),
          asterisms: base.asterisms.map((g) =>
            g.id === asterism.id ? { ...g, visible: true } : g
          ),
          objects: [...base.objects, newObj],
        };
      });
      if (createdId) setAsterismSelectedId(createdId);
      setAsterismTool('select');
    },
    [commitAsterismMutation]
  );

  const handleMoveAsterismVertex = useCallback(
    (objectId: string, vertexIndex: number, vertex: AsterismVertex) => {
      const cur = asterismStoreRef.current;
      if (!asterismDragSnapRef.current) {
        asterismDragSnapRef.current = {
          layers: cur.layers,
          activeLayerId: cur.activeLayerId,
          asterisms: cur.asterisms,
          activeAsterismId: cur.activeAsterismId,
          objects: cur.objects,
        };
      }
      const next: AsterismStoreState = {
        ...cur,
        objects: cur.objects.map((o) => {
          if (o.id !== objectId) return o;
          if (o.type === 'circle') {
            if (vertexIndex === 0) {
              const rDeg = getCircleRadiusDeg(o);
              const edge = destinationPointSpherical(vertex.raDeg, vertex.decDeg, 90, rDeg);
              return {
                ...o,
                vertices: [vertex, { raDeg: edge.raDeg, decDeg: edge.decDeg }],
                radiusDeg: rDeg,
              };
            }
            if (vertexIndex === 1 && o.vertices[0]) {
              const newR = Math.max(
                0.01,
                angularDistanceDeg(
                  o.vertices[0].raDeg,
                  o.vertices[0].decDeg,
                  vertex.raDeg,
                  vertex.decDeg
                )
              );
              return {
                ...o,
                vertices: [o.vertices[0], vertex],
                radiusDeg: newR,
              };
            }
            return o;
          }
          if (vertexIndex < 0 || vertexIndex >= o.vertices.length) return o;
          const verts = o.vertices.slice();
          verts[vertexIndex] = vertex;
          return { ...o, vertices: verts };
        }),
      };
      asterismStoreRef.current = next;
      setAsterismStore(next);
    },
    []
  );

  const handleCommitAsterismDrag = useCallback(() => {
    const snap = asterismDragSnapRef.current;
    asterismDragSnapRef.current = null;
    if (!snap) return;
    setAsterismPast((hist) => [...hist.slice(-49), snap]);
    setAsterismFuture([]);
  }, []);

  const handleInsertAsterismVertex = useCallback(
    (objectId: string, segmentIndex: number, vertex: AsterismVertex) => {
      commitAsterismMutation((prev) => ({
        ...prev,
        objects: prev.objects.map((o) => {
          if (o.id !== objectId || o.type === 'circle') return o;
          const verts = o.vertices.slice();
          verts.splice(segmentIndex + 1, 0, vertex);
          return { ...o, vertices: verts };
        }),
      }));
    },
    [commitAsterismMutation]
  );

  const handleDeleteAsterismVertex = useCallback(
    async (objectId: string, vertexIndex: number): Promise<boolean> => {
      const target = asterismStoreRef.current.objects.find((o) => o.id === objectId);
      if (!target || target.type === 'label' || target.type === 'circle') return false;
      const minV = target.type === 'polygon' ? 3 : 2;
      if (target.vertices.length <= minV) return false;
      const ok = await requestConfirm({
        title: '꼭짓점 삭제 확인',
        message: `‘${target.label || '도형 요소'}’의 ${vertexIndex + 1}번 꼭짓점을 삭제하시겠습니까?`,
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      commitAsterismMutation((prev) => {
        const curTarget = prev.objects.find((o) => o.id === objectId);
        if (!curTarget || curTarget.type === 'label' || curTarget.type === 'circle') return prev;
        const curMinV = curTarget.type === 'polygon' ? 3 : 2;
        if (curTarget.vertices.length <= curMinV) return prev;
        return {
          ...prev,
          objects: prev.objects.map((o) =>
            o.id === objectId
              ? { ...o, vertices: o.vertices.filter((_, idx) => idx !== vertexIndex) }
              : o
          ),
        };
      });
      return true;
    },
    [commitAsterismMutation, requestConfirm]
  );

  const handleUpdateAsterismObject = useCallback(
    (id: string, patch: Partial<AsterismObject>) => {
      commitAsterismMutation((prev) => ({
        ...prev,
        objects: prev.objects.map((o) => {
          if (o.id !== id) return o;
          const nextObj = { ...o, ...patch };
          if (
            nextObj.type === 'circle' &&
            patch.radiusDeg !== undefined &&
            nextObj.vertices[0]
          ) {
            const edge = destinationPointSpherical(
              nextObj.vertices[0].raDeg,
              nextObj.vertices[0].decDeg,
              90,
              patch.radiusDeg
            );
            nextObj.vertices = [nextObj.vertices[0], { raDeg: edge.raDeg, decDeg: edge.decDeg }];
          }
          return nextObj;
        }),
      }));
    },
    [commitAsterismMutation]
  );

  const handleDeleteAsterismObject = useCallback(
    async (id: string): Promise<boolean> => {
      const target = asterismStoreRef.current.objects.find((o) => o.id === id);
      if (!target) return false;
      const ok = await requestConfirm({
        title: '도형 삭제 확인',
        message: `‘${target.label || '도형 요소'}’를 삭제하시겠습니까?`,
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      commitAsterismMutation((prev) => ({
        ...prev,
        objects: prev.objects.filter((o) => o.id !== id),
      }));
      setAsterismSelectedId((cur) => (cur === id ? null : cur));
      return true;
    },
    [commitAsterismMutation, requestConfirm]
  );

  const handleUpdateAsterismSettings = useCallback(
    (patch: Partial<AsterismStoreState['settings']>) => {
      setAsterismStore((prev) => {
        const next: AsterismStoreState = {
          ...prev,
          settings: { ...prev.settings, ...patch },
        };
        asterismStoreRef.current = next;
        return next;
      });
    },
    []
  );

  const handleSetAsterismActiveLayer = useCallback((layerId: string) => {
    setAsterismStore((prev) => {
      if (!prev.layers.some((l) => l.id === layerId)) return prev;
      const next = { ...prev, activeLayerId: layerId };
      asterismStoreRef.current = next;
      return next;
    });
  }, []);

  const handleToggleAsterismLayerVisible = useCallback((layerId: string) => {
    setAsterismStore((prev) => {
      const targetLayer = prev.layers.find((l) => l.id === layerId);
      if (!targetLayer) return prev;
      const layerAsterisms = prev.asterisms.filter((g) => g.layerId === layerId);
      const allGroupVisible =
        layerAsterisms.length > 0
          ? targetLayer.visible && layerAsterisms.every((g) => g.visible)
          : targetLayer.visible;
      const nextVisible = !allGroupVisible;
      const next: AsterismStoreState = {
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === layerId ? { ...l, visible: nextVisible } : l
        ),
        asterisms: prev.asterisms.map((g) =>
          g.layerId === layerId ? { ...g, visible: nextVisible } : g
        ),
      };
      asterismStoreRef.current = next;
      return next;
    });
  }, []);

  const handleSetAllAsterismLayersVisible = useCallback((visible: boolean) => {
    setAsterismStore((prev) => {
      const next: AsterismStoreState = {
        ...prev,
        layers: prev.layers.map((l) => ({ ...l, visible })),
        asterisms: prev.asterisms.map((g) => ({ ...g, visible })),
      };
      asterismStoreRef.current = next;
      return next;
    });
  }, []);

  const handleCreateAsterismLayer = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newLayer: AsterismLayer = {
        id: makeAsterismId('layer'),
        name: trimmed,
        visible: true,
        createdAt: Date.now(),
      };
      commitAsterismMutation((prev) => ({
        ...prev,
        layers: [...prev.layers, newLayer],
        activeLayerId: newLayer.id,
      }));
    },
    [commitAsterismMutation]
  );

  const handleRenameAsterismLayer = useCallback(
    (layerId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      commitAsterismMutation((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => (l.id === layerId ? { ...l, name: trimmed } : l)),
      }));
    },
    [commitAsterismMutation]
  );

  const handleDeleteAsterismLayer = useCallback(
    async (layerId: string): Promise<boolean> => {
      const cur = asterismStoreRef.current;
      if (cur.layers.length <= 1) return false;
      const target = cur.layers.find((l) => l.id === layerId);
      if (!target) return false;
      const grpCount = cur.asterisms.filter((g) => g.layerId === layerId).length;
      const ok = await requestConfirm({
        title: '성군 그룹 삭제 확인',
        message: `‘${target.name}’ 그룹을 삭제하시겠습니까?`,
        detail:
          grpCount > 0
            ? `이 그룹의 성군 ${grpCount}개는 기본 그룹으로 이동됩니다.`
            : undefined,
        confirmLabel: '삭제',
      });
      if (!ok) return false;
      commitAsterismMutation((prev) => {
        if (prev.layers.length <= 1) return prev;
        const remaining = prev.layers.filter((l) => l.id !== layerId);
        const fallbackId = remaining[0].id;
        return {
          ...prev,
          layers: remaining,
          activeLayerId: prev.activeLayerId === layerId ? fallbackId : prev.activeLayerId,
          asterisms: prev.asterisms.map((g) =>
            g.layerId === layerId ? { ...g, layerId: fallbackId } : g
          ),
          objects: prev.objects.map((o) =>
            o.layerId === layerId ? { ...o, layerId: fallbackId } : o
          ),
        };
      });
      return true;
    },
    [commitAsterismMutation, requestConfirm]
  );

  const handleFocusAsterismGroup = useCallback((grp: AsterismGroup) => {
    const cur = asterismStoreRef.current;
    // Ensure group & parent layer are visible and mark active
    setAsterismStore((prev) => {
      const next: AsterismStoreState = {
        ...prev,
        activeAsterismId: grp.id,
        activeLayerId: grp.layerId,
        layers: prev.layers.map((l) => (l.id === grp.layerId ? { ...l, visible: true } : l)),
        asterisms: prev.asterisms.map((g) => (g.id === grp.id ? { ...g, visible: true } : g)),
      };
      asterismStoreRef.current = next;
      return next;
    });
    setAsterismSelectedId(null);

    // If user saved a specific chart center & FOV via "위치·시야 적용", honor it directly!
    if (grp.savedView) {
      canvasHandleRef.current?.smoothCenterOn(grp.savedView.raDeg, grp.savedView.decDeg, {
        targetFsz: grp.savedView.fsz,
      });
      return;
    }

    const childObjs = cur.objects.filter((o) => o.asterismId === grp.id);
    const allVerts: AsterismVertex[] = [];
    let extraRadius = 0;
    for (const o of childObjs) {
      if (o.type === 'circle' && o.vertices[0]) {
        allVerts.push(o.vertices[0]);
        extraRadius = Math.max(extraRadius, getCircleRadiusDeg(o));
      } else {
        for (const v of o.vertices) allVerts.push(v);
      }
    }
    if (allVerts.length === 0) return;

    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const v of allVerts) {
      const a = v.raDeg * DEG2RAD;
      const d = v.decDeg * DEG2RAD;
      sx += Math.cos(d) * Math.cos(a);
      sy += Math.cos(d) * Math.sin(a);
      sz += Math.sin(d);
    }
    const len = Math.hypot(sx, sy, sz) || 1;
    const centerRaDeg = (((Math.atan2(sy / len, sx / len) * RAD2DEG) % 360) + 360) % 360;
    const centerDecDeg = Math.asin(Math.max(-1, Math.min(1, sz / len))) * RAD2DEG;

    let maxDist = extraRadius;
    for (const v of allVerts) {
      const d = angularDistanceDeg(centerRaDeg, centerDecDeg, v.raDeg, v.decDeg);
      if (d > maxDist) maxDist = d;
    }
    const [minFov, maxFov] = grp.visibleFovRange;
    const spanFov = Math.max(0.8, maxDist * 3.2);
    const targetFsz = Math.max(
      minFov * 1.15,
      Math.min(maxFov * 0.85, Math.min(90, spanFov))
    );

    canvasHandleRef.current?.smoothCenterOn(centerRaDeg, centerDecDeg, {
      targetFsz,
    });
  }, []);

  const handleLoadAsterismPresets = useCallback((): number => {
    const presets = createBuiltInPresetAsterismBundles();
    const cur = asterismStoreRef.current;
    const existingGrpIds = new Set(cur.asterisms.map((g) => g.id));
    const toAdd = presets.filter((p) => !existingGrpIds.has(p.asterism.id));
    if (toAdd.length === 0) return 0;

    commitAsterismMutation((prev) => {
      const layerIds = new Set(prev.layers.map((l) => l.id));
      const nextLayers = prev.layers.map((l) =>
        toAdd.some((p) => p.asterism.layerId === l.id) ? { ...l, visible: true } : l
      );
      for (const def of DEFAULT_ASTERISM_LAYERS) {
        if (toAdd.some((p) => p.asterism.layerId === def.id) && !layerIds.has(def.id)) {
          nextLayers.push({ ...def, visible: true });
          layerIds.add(def.id);
        }
      }
      const existingObjIds = new Set(prev.objects.map((o) => o.id));
      const newObjs = toAdd
        .flatMap((p) => p.objects)
        .filter((o) => !existingObjIds.has(o.id));
      return {
        ...prev,
        layers: nextLayers,
        asterisms: [...prev.asterisms, ...toAdd.map((p) => p.asterism)],
        objects: [...prev.objects, ...newObjs],
      };
    });
    return toAdd.length;
  }, [commitAsterismMutation]);

  const handleImportAsterismBundle = useCallback(
    (
      incomingLayers: AsterismLayer[],
      incomingAsterisms: AsterismGroup[],
      incomingObjects: AsterismObject[]
    ): { addedCount: number } => {
      const cur = asterismStoreRef.current;
      const existingGrpIds = new Set(cur.asterisms.map((g) => g.id));
      const existingObjIds = new Set(cur.objects.map((o) => o.id));
      const freshGroups = incomingAsterisms.filter((g) => !existingGrpIds.has(g.id));
      const freshObjects = incomingObjects.filter((o) => !existingObjIds.has(o.id));
      if (freshGroups.length === 0 && freshObjects.length === 0) return { addedCount: 0 };

      commitAsterismMutation((prev) => {
        const layerMap = new Map(prev.layers.map((l) => [l.id, l]));
        for (const l of incomingLayers) {
          if (!layerMap.has(l.id)) {
            layerMap.set(l.id, { ...l, visible: true });
          } else {
            layerMap.set(l.id, { ...layerMap.get(l.id)!, visible: true });
          }
        }
        const validIds = new Set(layerMap.keys());
        const normalizedGroups = freshGroups.map((g) =>
          validIds.has(g.layerId) ? g : { ...g, layerId: prev.activeLayerId }
        );
        const normalizedObjs = freshObjects.map((o) =>
          validIds.has(o.layerId) ? o : { ...o, layerId: prev.activeLayerId }
        );
        return {
          ...prev,
          layers: Array.from(layerMap.values()),
          asterisms: [...prev.asterisms, ...normalizedGroups],
          activeAsterismId: normalizedGroups[0]?.id ?? prev.activeAsterismId,
          objects: [...prev.objects, ...normalizedObjs],
        };
      });
      return { addedCount: freshGroups.length + freshObjects.length };
    },
    [commitAsterismMutation]
  );

  const handleToggleAsterismPreset = useCallback(
    (preset: BuiltInAsterismPreset): boolean => {
      const cur = asterismStoreRef.current;
      const exists = cur.asterisms.some((g) => g.id === preset.asterism.id);
      if (exists) {
        commitAsterismMutation((prev) => ({
          ...prev,
          asterisms: prev.asterisms.filter((g) => g.id !== preset.asterism.id),
          activeAsterismId:
            prev.activeAsterismId === preset.asterism.id ? null : prev.activeAsterismId,
          objects: prev.objects.filter((o) => o.asterismId !== preset.asterism.id),
        }));
        return false;
      }
      commitAsterismMutation((prev) => {
        const hasLayer = prev.layers.some((l) => l.id === preset.asterism.layerId);
        let nextLayers = prev.layers.map((l) =>
          l.id === preset.asterism.layerId ? { ...l, visible: true } : l
        );
        if (!hasLayer) {
          const defLayer = DEFAULT_ASTERISM_LAYERS.find((d) => d.id === preset.asterism.layerId);
          if (defLayer) {
            nextLayers = [...nextLayers, { ...defLayer, visible: true }];
          }
        }
        const resolvedLayerId = nextLayers.some((l) => l.id === preset.asterism.layerId)
          ? preset.asterism.layerId
          : prev.activeLayerId;
        const grp: AsterismGroup = { ...preset.asterism, layerId: resolvedLayerId, visible: true };
        const existingObjIds = new Set(prev.objects.map((o) => o.id));
        const objs = preset.objects
          .filter((o) => !existingObjIds.has(o.id))
          .map((o) => ({ ...o, layerId: resolvedLayerId }));
        return {
          ...prev,
          layers: nextLayers,
          asterisms: [...prev.asterisms, grp],
          activeAsterismId: grp.id,
          objects: [...prev.objects, ...objs],
        };
      });
      return true;
    },
    [commitAsterismMutation]
  );

  const handleFocusAsterismPreset = useCallback(
    (preset: BuiltInAsterismPreset) => {
      const cur = asterismStoreRef.current;
      const existing = cur.asterisms.find((g) => g.id === preset.asterism.id);
      if (!existing) {
        handleToggleAsterismPreset(preset);
        window.setTimeout(() => {
          const latest = asterismStoreRef.current.asterisms.find(
            (g) => g.id === preset.asterism.id
          );
          if (latest) handleFocusAsterismGroup(latest);
        }, 20);
      } else {
        handleFocusAsterismGroup(existing);
      }
    },
    [handleToggleAsterismPreset, handleFocusAsterismGroup]
  );

  const handleReorderAsterismLayers = useCallback(
    (fromId: string, toId: string) => {
      commitAsterismMutation((prev) => ({
        ...prev,
        layers: reorderItemsById(prev.layers, fromId, toId),
      }));
    },
    [commitAsterismMutation]
  );

  const handleReorderAsterismGroups = useCallback(
    (layerId: string, fromId: string, toId: string) => {
      if (fromId === toId) return;
      commitAsterismMutation((prev) => {
        const inLayer = prev.asterisms.filter((g) => g.layerId === layerId);
        const reordered = reorderItemsById(inLayer, fromId, toId);
        let cursor = 0;
        const nextAsterisms = prev.asterisms.map((g) =>
          g.layerId === layerId ? reordered[cursor++] : g
        );
        return {
          ...prev,
          asterisms: nextAsterisms,
        };
      });
    },
    [commitAsterismMutation]
  );

  const handleReorderAsterismObjects = useCallback(
    (asterismId: string, fromId: string, toId: string) => {
      if (fromId === toId) return;
      commitAsterismMutation((prev) => {
        const inGrp = prev.objects.filter((o) => o.asterismId === asterismId);
        const reordered = reorderItemsById(inGrp, fromId, toId);
        let cursor = 0;
        const nextObjects = prev.objects.map((o) =>
          o.asterismId === asterismId ? reordered[cursor++] : o
        );
        return {
          ...prev,
          objects: nextObjects,
        };
      });
    },
    [commitAsterismMutation]
  );

  const handleToggleAsterismMode = useCallback(() => {
    setAsterismMode((prev) => {
      setAsterismDraft(null);
      setAsterismTool('select');
      if (prev) {
        setAsterismSelectedId(null);
        setAsterismPopover('none');
      }
      return !prev;
    });
  }, []);

  // Keyboard shortcuts while Asterism Drawing Mode is active
  useEffect(() => {
    if (!asterismMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoAsterism();
        } else {
          handleUndoAsterism();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoAsterism();
        return;
      }
      if (e.key === 'Enter' && asterismDraft) {
        e.preventDefault();
        handleFinishAsterismDraft();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (asterismDraft) {
          handleCancelAsterismDraft();
        } else if (asterismSelectedId) {
          setAsterismSelectedId(null);
        } else if (asterismTool !== 'select') {
          setAsterismTool('select');
        }
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (asterismDraft) {
          e.preventDefault();
          handleUndoAsterismDraftPoint();
        } else if (asterismSelectedId) {
          e.preventDefault();
          handleDeleteAsterismObject(asterismSelectedId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    asterismMode,
    asterismTool,
    asterismDraft,
    asterismSelectedId,
    handleUndoAsterism,
    handleRedoAsterism,
    handleFinishAsterismDraft,
    handleCancelAsterismDraft,
    handleUndoAsterismDraftPoint,
    handleDeleteAsterismObject,
  ]);

  const ui = getUiTheme(theme);
  const magLimit = getLimitingMagnitude(view.fsz, layers.magOffset);
  const dsoMagLimit = getDsoLimitingMagnitude(view.fsz, layers.dsoMagOffset);

  return (
    <ConfirmDialogContext.Provider value={requestConfirm}>
    <div
      data-theme={theme}
      className={`w-screen h-[100dvh] flex flex-col overflow-hidden ${ui.shell}`}
    >
      {/* Top Precision Telemetry Ribbon (extends seamlessly behind mobile/tablet status bar safe-area) */}
      <div
        className={`no-print relative z-40 shrink-0 border-b ${ui.header}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <header
          ref={headerRef}
          onScroll={() => {
            if (cardinalMenuOpen) setCardinalMenuOpen(false);
            if (themeMenuOpen) setThemeMenuOpen(false);
          }}
          onWheel={(e) => {
            const el = headerRef.current;
            if (!el || el.scrollWidth <= el.clientWidth) return;
            const target = e.target as HTMLElement | null;
            if (target?.tagName === 'INPUT') return;
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              el.scrollLeft += e.deltaY;
            }
          }}
          className="h-12 overflow-x-auto overflow-y-hidden header-scroll touch-pan-x"
        >
          <div className="h-full min-w-max w-full px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2.5">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetViewOnly}
            title="초기 화각으로 되돌리기 (설정은 유지)"
            className="text-sm font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            NoxChart
          </button>
        </div>

        {/* Center: Coordinate System Switcher, Terrain Toggle, Cardinal Quick-Jump, Limiting Magnitude */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Equatorial vs Horizontal Coordinate System Icon-Only Switcher */}
          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg border ${
              theme === 'white'
                ? 'bg-slate-100 border-slate-300'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C]'
                : 'bg-[#0B1220] border-[#25334D]'
            }`}
            role="group"
            aria-label="좌표계 전환"
          >
            <button
              type="button"
              onClick={() => handleSelectCoordSystem('equatorial')}
              title="적도좌표계 (RA/Dec · 천구의 북극 위)"
              aria-label="적도좌표계"
              className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                view.coordSystem === 'equatorial'
                  ? theme === 'white'
                    ? 'bg-blue-700 text-white'
                    : theme === 'red'
                    ? 'bg-[#7F1D1D] text-[#FF5252]'
                    : 'bg-[#0094B8] text-white'
                  : theme === 'white'
                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                  : theme === 'red'
                  ? 'text-[#B83232] hover:text-[#FF4D4D] hover:bg-[#220404]'
                  : 'text-slate-400 hover:text-white hover:bg-[#182438]'
              }`}
            >
              <Globe2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSelectCoordSystem('horizontal')}
              title="지평좌표계 (Alt/Az · 관측지 지평선 수평 · 지형 활성화)"
              aria-label="지평좌표계"
              className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                view.coordSystem === 'horizontal'
                  ? theme === 'white'
                    ? 'bg-blue-700 text-white'
                    : theme === 'red'
                    ? 'bg-[#7F1D1D] text-[#FF5252]'
                    : 'bg-[#0094B8] text-white'
                  : theme === 'white'
                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                  : theme === 'red'
                  ? 'text-[#B83232] hover:text-[#FF4D4D] hover:bg-[#220404]'
                  : 'text-slate-400 hover:text-white hover:bg-[#182438]'
              }`}
            >
              <Mountain className="w-4 h-4" />
            </button>
          </div>

          {/* Terrain Visibility Checkbox next to Horizontal Coordinate System */}
          <label
            title="지평선 아래 지형 실루엣 표시"
            className={`h-8 px-2 rounded-lg border flex items-center gap-1.5 text-[11px] font-medium cursor-pointer select-none whitespace-nowrap shrink-0 transition-colors ${
              layers.showTerrain
                ? theme === 'white'
                  ? 'bg-blue-50 border-blue-400 text-blue-800'
                  : theme === 'red'
                  ? 'bg-[#2A0505] border-[#B91C1C] text-[#FF6B6B]'
                  : 'bg-cyan-500/15 border-cyan-400/55 text-cyan-200'
                : theme === 'white'
                ? 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-white'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C] text-[#B83232] hover:bg-[#220404]'
                : 'bg-[#0B1220] border-[#25334D] text-slate-400 hover:text-slate-200 hover:bg-[#182438]'
            }`}
          >
            <input
              type="checkbox"
              checked={layers.showTerrain}
              onChange={(e) => {
                const checked = e.target.checked;
                setLayers((prev) => ({
                  ...prev,
                  showTerrain: checked,
                  showHorizon: checked ? true : prev.showHorizon,
                }));
              }}
              className={`w-3.5 h-3.5 cursor-pointer ${
                theme === 'white'
                  ? 'accent-blue-600'
                  : theme === 'red'
                  ? 'accent-red-500'
                  : 'accent-cyan-400'
              }`}
            />
            <span>지형</span>
          </label>

          {/* Cardinal Direction Quick-Jump Dropdown (Compass icon -> 동/서/남/북 downward) */}
          <div ref={cardinalMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setCardinalMenuOpen((o) => !o)}
              title="방위 바로가기 (동·서·남·북)"
              aria-label="방위 바로가기 메뉴"
              aria-expanded={cardinalMenuOpen}
              aria-haspopup="menu"
              className={`h-8 px-2 rounded-lg border flex items-center justify-center gap-1 transition-colors shrink-0 ${
                cardinalMenuOpen
                  ? theme === 'white'
                    ? 'bg-blue-700 border-blue-700 text-white'
                    : theme === 'red'
                    ? 'bg-[#7F1D1D] border-[#EF4444] text-[#FF5252]'
                    : 'bg-[#0094B8] border-[#22D3EE] text-white'
                  : theme === 'white'
                  ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-blue-700 hover:bg-white'
                  : theme === 'red'
                  ? 'bg-[#100101] border-[#420C0C] text-[#DC2626] hover:text-[#FF5252] hover:bg-[#220404]'
                  : 'bg-[#0B1220] border-[#25334D] text-slate-300 hover:text-[#22D3EE] hover:bg-[#182438]'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" />
              <ChevronDown
                className={`w-3 h-3 shrink-0 transition-transform ${
                  cardinalMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {cardinalMenuOpen &&
              cardinalMenuPos &&
              createPortal(
                <div
                  ref={cardinalDropdownRef}
                  role="menu"
                  aria-label="동서남북 방위 선택"
                  style={{ left: cardinalMenuPos.left, top: cardinalMenuPos.top }}
                  className={`fixed z-[120] w-24 p-1 rounded-lg border shadow-xl flex flex-col gap-0.5 ${
                    theme === 'white'
                      ? 'bg-white border-slate-300 text-slate-700'
                      : theme === 'red'
                      ? 'bg-[#100101] border-[#420C0C] text-[#DC2626]'
                      : 'bg-[#0B1220] border-[#25334D] text-slate-200'
                  }`}
                >
                  {(
                    [
                      { label: '동', full: '동쪽', az: 90 },
                      { label: '서', full: '서쪽', az: 270 },
                      { label: '남', full: '남쪽', az: 180 },
                      { label: '북', full: '북쪽', az: 0 },
                    ] as const
                  ).map((dir) => (
                    <button
                      key={dir.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        handleJumpCardinal(dir.az);
                        setCardinalMenuOpen(false);
                      }}
                      title={`${dir.full} 하늘 바로가기 (방위각 ${dir.az}° · 고도 30° · 화각 60°)`}
                      className={`w-full h-7 px-2 rounded-md flex items-center justify-between text-xs font-semibold transition-colors ${
                        theme === 'white'
                          ? 'text-slate-700 hover:text-blue-700 hover:bg-slate-100'
                          : theme === 'red'
                          ? 'text-[#DC2626] hover:text-[#FF5252] hover:bg-[#220404]'
                          : 'text-slate-200 hover:text-[#22D3EE] hover:bg-[#182438]'
                      }`}
                    >
                      <span>{dir.label}</span>
                      <span className="font-mono text-[10px] opacity-65 tabular-nums">
                        {dir.az}°
                      </span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>

          {/* Limiting Magnitude Display + Slider (2-row compact layout: badges on top, slider below) */}
          <div
            className={`flex flex-col justify-center gap-0.5 rounded-lg border px-2 py-0.5 shrink-0 ${
              theme === 'white'
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C] text-[#DC2626]'
                : 'bg-[#0B1220] border-[#25334D] text-slate-300'
            }`}
            title="현재 시야각 기준 항성 및 DSO 한계등급 조절"
          >
            <div className="flex items-center justify-center gap-1 leading-none">
              <span
                className={`rounded border px-1 py-[1px] flex items-center gap-0.5 font-mono text-[10px] font-bold tabular-nums whitespace-nowrap ${
                  theme === 'white'
                    ? 'bg-sky-50 border-sky-200 text-sky-700'
                    : theme === 'red'
                    ? 'bg-[#200303] border-[#5A1212] text-[#FF3B3B]'
                    : 'bg-[#162235] border-[#2C3E5C] text-[#22D3EE]'
                }`}
              >
                <Star className="w-2.5 h-2.5 fill-current shrink-0" />
                <span>{magLimit.toFixed(1)}</span>
              </span>
              <span
                className={`rounded border px-1 py-[1px] flex items-center font-mono text-[10px] font-bold tabular-nums whitespace-nowrap ${
                  theme === 'white'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : theme === 'red'
                    ? 'bg-[#200303] border-[#5A1212] text-[#EF4444]'
                    : 'bg-[#162235] border-[#2C3E5C] text-[#10B981]'
                }`}
              >
                DSO{' '}
                {layers.showDso
                  ? dsoMagLimit.toFixed(1)
                  : layers.showMessierCatalog && layers.showCaldwellCatalog
                  ? 'M+C'
                  : layers.showMessierCatalog
                  ? 'M'
                  : layers.showCaldwellCatalog
                  ? 'C'
                  : 'OFF'}
              </span>
            </div>
            <div className="flex items-center gap-1 leading-none">
              <input
                type="range"
                min={-3.0}
                max={3.0}
                step={0.2}
                value={layers.magOffset}
                onChange={(e) => {
                  const nextMag = Number(e.target.value);
                  setLayers((p) => {
                    const delta = nextMag - p.magOffset;
                    const nextDso = Math.max(
                      -4.0,
                      Math.min(4.0, Number((p.dsoMagOffset + delta).toFixed(1)))
                    );
                    return { ...p, magOffset: nextMag, dsoMagOffset: nextDso };
                  });
                }}
                aria-label="한계 등급 보정"
                title="한계 등급 보정 (-3.0m ~ +3.0m)"
                className={`w-[68px] h-1.5 cursor-pointer ${
                  theme === 'red' ? 'accent-red-600' : 'accent-cyan-500'
                }`}
              />
              <button
                type="button"
                onClick={() =>
                  setLayers((p) => ({ ...p, magOffset: 0, dsoMagOffset: 0 }))
                }
                title="클릭하여 한계 등급 보정 초기화 (0.0m)"
                className={`font-mono text-[9.5px] tabular-nums whitespace-nowrap w-7 text-right hover:opacity-100 transition-opacity ${
                  layers.magOffset !== 0 || layers.dsoMagOffset !== 0
                    ? theme === 'white'
                      ? 'text-sky-700 font-semibold'
                      : theme === 'red'
                      ? 'text-[#FF3B3B] font-semibold'
                      : 'text-cyan-400 font-semibold'
                    : 'opacity-70'
                }`}
              >
                {layers.magOffset >= 0
                  ? `+${layers.magOffset.toFixed(1)}`
                  : layers.magOffset.toFixed(1)}
                m
              </button>
            </div>
          </div>

          {/* Temporary Hide Sky Layers — 7 Individual Category Icons */}
          <div
            className={`flex items-center gap-0.5 p-0.5 rounded-lg border shrink-0 ${
              theme === 'white'
                ? 'bg-slate-100 border-slate-300'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C]'
                : 'bg-[#0B1220] border-[#25334D]'
            }`}
            role="group"
            aria-label="레이어 일시 숨김 (별자리, 태양계, 항성, 이중성, 심우주, 좌표그리드, 하이브리드 실사배경)"
          >
            {(
              [
                {
                  key: 'constellations' as const,
                  label: '별자리',
                  configuredOn:
                    layers.showConstellationLines ||
                    layers.showConstellationBoundaries ||
                    layers.showConstellationNames,
                  icon: <Waypoints className="w-3.5 h-3.5 shrink-0" />,
                },
                {
                  key: 'solar' as const,
                  label: '태양계',
                  configuredOn: layers.showSolarSystem || Object.keys(solarTrails).length > 0,
                  icon: (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="8" cy="8" r="3.4" />
                      <ellipse
                        cx="8"
                        cy="8"
                        rx="6.6"
                        ry="2.3"
                        transform="rotate(-24 8 8)"
                      />
                    </svg>
                  ),
                },
                {
                  key: 'stars' as const,
                  label: '항성',
                  configuredOn:
                    layers.showStarColors ||
                    layers.showStarLabels ||
                    layers.showProperStarNames ||
                    layers.enableGaiaLive ||
                    layers.showFieldStars,
                  icon: (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M8 1.6L9.7 6.3L14.4 8L9.7 9.7L8 14.4L6.3 9.7L1.6 8L6.3 6.3Z" />
                    </svg>
                  ),
                },
                {
                  key: 'doubles' as const,
                  label: '이중성',
                  configuredOn: layers.showDoubleStars,
                  icon: (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="5.6" cy="9.4" r="3.1" fill="currentColor" fillOpacity="0.22" />
                      <circle cx="11.2" cy="5.2" r="2" fill="currentColor" fillOpacity="0.22" />
                      <line x1="2.2" y1="9.4" x2="9" y2="9.4" strokeOpacity="0.7" />
                    </svg>
                  ),
                },
                {
                  key: 'dso' as const,
                  label: '심우주',
                  configuredOn:
                    layers.showDso ||
                    layers.showMessierCatalog ||
                    layers.showCaldwellCatalog ||
                    layers.showNebulaContours ||
                    layers.showMilkyWay,
                  icon: (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <ellipse
                        cx="8"
                        cy="8"
                        rx="5.8"
                        ry="2.9"
                        transform="rotate(-32 8 8)"
                      />
                      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
                    </svg>
                  ),
                },
                {
                  key: 'grids' as const,
                  label: '좌표그리드',
                  configuredOn:
                    layers.showGridEq ||
                    layers.showGridAltAz ||
                    layers.showHorizon ||
                    layers.showTerrain ||
                    layers.showEcliptic,
                  icon: <Grid3x3 className="w-3.5 h-3.5 shrink-0" />,
                },
                {
                  key: 'hips' as const,
                  label: '하이브리드 실사배경',
                  configuredOn: hips.enabled,
                  icon: <ImageIcon className="w-3.5 h-3.5 shrink-0" />,
                },
              ]
            ).map((item) => {
              const isHidden = tempHiddenLayers[item.key];
              const btnTone = isHidden
                ? theme === 'white'
                  ? 'bg-amber-100 border-amber-500 text-amber-800 shadow-xs'
                  : theme === 'red'
                  ? 'bg-[#450A0A] border-[#EF4444] text-[#FCA5A5]'
                  : 'bg-amber-500/20 border-amber-400/75 text-amber-300'
                : item.configuredOn
                ? theme === 'white'
                  ? 'border-transparent text-sky-700 hover:bg-slate-200/85'
                  : theme === 'red'
                  ? 'border-transparent text-[#FF4D4D] hover:bg-[#220404]'
                  : 'border-transparent text-cyan-300 hover:bg-[#182438]'
                : theme === 'white'
                ? 'border-transparent text-slate-400 opacity-55 hover:opacity-90 hover:bg-slate-200/60'
                : theme === 'red'
                ? 'border-transparent text-[#7F1D1D] opacity-60 hover:opacity-95 hover:bg-[#1B0303]'
                : 'border-transparent text-slate-500 opacity-55 hover:opacity-90 hover:bg-[#141E30]';

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleTempHiddenLayer(item.key)}
                  aria-pressed={isHidden}
                  aria-label={`${item.label} 일시 숨김`}
                  title={
                    isHidden
                      ? `${item.label} 일시 숨김 중 (클릭하여 기존 설정 복원)`
                      : item.configuredOn
                      ? `${item.label} 일시 숨김 (클릭 시 기존 설정 유지한 채 숨김)`
                      : `${item.label} (현재 설정 꺼짐 · 클릭 시 일시 숨김 전환)`
                  }
                  className={`relative w-6 h-6 rounded-[5px] border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${btnTone}`}
                >
                  <span className={isHidden ? 'opacity-55' : ''}>{item.icon}</span>
                  {isHidden && (
                    <svg
                      viewBox="0 0 16 16"
                      className="pointer-events-none absolute inset-0 w-full h-full"
                      aria-hidden="true"
                    >
                      <line
                        x1="3"
                        y1="13"
                        x2="13"
                        y2="3"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Theme Dropdown, Standalone Ruler (척도), Grouped Tool Box (관측목록/챌린지/작도), URL Share, PNG Export, Sensor FOV PNG, Print */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Single-Icon Screen Theme Dropdown (same pattern as Cardinal Direction selector) */}
          <div ref={themeMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((o) => !o)}
              title="화면 테마 선택 (다크 · 화이트 · 적색)"
              aria-label="화면 테마 메뉴"
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
              className={`h-8 px-2 rounded-lg border flex items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer ${
                themeMenuOpen
                  ? theme === 'white'
                    ? 'bg-blue-700 border-blue-700 text-white'
                    : theme === 'red'
                    ? 'bg-[#7F1D1D] border-[#EF4444] text-[#FF5252]'
                    : 'bg-[#0094B8] border-[#22D3EE] text-white'
                  : theme === 'white'
                  ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-blue-700 hover:bg-white'
                  : theme === 'red'
                  ? 'bg-[#100101] border-[#420C0C] text-[#DC2626] hover:text-[#FF5252] hover:bg-[#220404]'
                  : 'bg-[#0B1220] border-[#25334D] text-slate-300 hover:text-[#22D3EE] hover:bg-[#182438]'
              }`}
            >
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              ) : theme === 'white' ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              ) : (
                <span
                  className="w-3 h-3 rounded-full bg-[#EF4444] ring-1 ring-[#FF6B6B]/80 inline-block shrink-0"
                  aria-hidden="true"
                />
              )}
              <ChevronDown
                className={`w-3 h-3 shrink-0 transition-transform ${
                  themeMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {themeMenuOpen &&
              themeMenuPos &&
              createPortal(
                <div
                  ref={themeDropdownRef}
                  role="menu"
                  aria-label="화면 테마 선택"
                  style={{ left: themeMenuPos.left, top: themeMenuPos.top }}
                  className={`fixed z-[120] w-28 p-1 rounded-lg border shadow-xl flex flex-col gap-0.5 ${
                    theme === 'white'
                      ? 'bg-white border-slate-300 text-slate-700'
                      : theme === 'red'
                      ? 'bg-[#100101] border-[#420C0C] text-[#DC2626]'
                      : 'bg-[#0B1220] border-[#25334D] text-slate-200'
                  }`}
                >
                  {(
                    [
                      { id: 'dark', label: '다크', desc: '다크 모드' },
                      { id: 'white', label: '화이트', desc: '인쇄용 화이트 모드' },
                      { id: 'red', label: '적색', desc: '적색 야간 모드' },
                    ] as const
                  ).map((opt) => {
                    const active = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setTheme(opt.id);
                          setThemeMenuOpen(false);
                        }}
                        title={opt.desc}
                        className={`w-full h-7 px-2 rounded-md flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer ${
                          active
                            ? theme === 'white'
                              ? 'bg-blue-600 text-white'
                              : theme === 'red'
                              ? 'bg-[#7F1D1D] text-[#FF5252]'
                              : 'bg-[#0094B8] text-white'
                            : theme === 'white'
                            ? 'text-slate-700 hover:text-blue-700 hover:bg-slate-100'
                            : theme === 'red'
                            ? 'text-[#DC2626] hover:text-[#FF5252] hover:bg-[#220404]'
                            : 'text-slate-200 hover:text-[#22D3EE] hover:bg-[#182438]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {opt.id === 'dark' ? (
                            <Moon className="w-3.5 h-3.5 shrink-0" />
                          ) : opt.id === 'white' ? (
                            <Sun className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <span
                              className={`w-3 h-3 rounded-full inline-block shrink-0 ${
                                active
                                  ? 'bg-[#FF6B6B] ring-1 ring-white/70'
                                  : 'bg-red-600'
                              }`}
                              aria-hidden="true"
                            />
                          )}
                          <span>{opt.label}</span>
                        </span>
                        {active && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )}
          </div>

          <button
            type="button"
            onClick={handleToggleRulerMode}
            title={
              rulerMode
                ? '척도 종료 (두 점 사이 각거리 측정 중)'
                : '척도 (두 점 사이 각거리 측정)'
            }
            aria-label="척도"
            aria-pressed={rulerMode}
            className={`w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              rulerMode ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <Ruler className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Grouped Rectangular Box: 관측목록 · 챌린지 · 작도 */}
          <div
            className={`flex items-center gap-0.5 p-0.5 rounded-lg border shrink-0 ${
              theme === 'white'
                ? 'bg-slate-100 border-slate-300'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C]'
                : 'bg-[#0B1220] border-[#25334D]'
            }`}
            role="group"
            aria-label="관측목록, 챌린지, 작도, 관측기록"
          >
            {(() => {
              const hasActiveChallenge = challenges.some((t) => t.activeOnChart);
              const activeBoxBtn =
                theme === 'white'
                  ? 'bg-blue-700 text-white'
                  : theme === 'red'
                  ? 'bg-[#7F1D1D] text-[#FF5252]'
                  : 'bg-[#0094B8] text-white';
              const idleBoxBtn =
                theme === 'white'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  : theme === 'red'
                  ? 'text-[#B83232] hover:text-[#FF4D4D] hover:bg-[#220404]'
                  : 'text-slate-400 hover:text-white hover:bg-[#182438]';
              return (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('session');
                      setRightOpen((o) => (inspectorTab === 'session' ? !o : true));
                    }}
                    title={`관측목록 (${sessionPlan.length})`}
                    aria-label={`관측목록 (${sessionPlan.length})`}
                    className={`relative w-7 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                      rightOpen && inspectorTab === 'session' ? activeBoxBtn : idleBoxBtn
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {sessionPlan.length > 0 && (
                      <span
                        className={`absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] px-0.5 rounded-full text-[8px] font-mono font-bold leading-[13px] text-center ${
                          theme === 'white'
                            ? 'bg-blue-600 text-white'
                            : theme === 'red'
                            ? 'bg-[#DC2626] text-black'
                            : 'bg-cyan-500 text-slate-950'
                        }`}
                      >
                        {sessionPlan.length > 99 ? '99' : sessionPlan.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('challenge');
                      setRightOpen((o) => (inspectorTab === 'challenge' ? !o : true));
                    }}
                    title="관측 챌린지 · 오늘의 투어"
                    aria-label="관측 챌린지"
                    className={`relative w-7 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                      rightOpen && inspectorTab === 'challenge' ? activeBoxBtn : idleBoxBtn
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {(tourState.active || hasActiveChallenge) && (
                      <span
                        className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                          tourState.active ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('asterism');
                      setRightOpen((o) => (inspectorTab === 'asterism' ? !o : true));
                    }}
                    title={
                      asterismMode
                        ? '성군 작도 진행 중 (작도 탭 열기/닫기)'
                        : '성군 작도 탭 열기/닫기'
                    }
                    aria-label="성군 작도"
                    aria-pressed={asterismMode || (rightOpen && inspectorTab === 'asterism')}
                    className={`relative w-7 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                      asterismMode || (rightOpen && inspectorTab === 'asterism')
                        ? activeBoxBtn
                        : idleBoxBtn
                    }`}
                  >
                    <Waypoints className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {asterismMode && (
                      <span
                        className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full animate-pulse ${
                          theme === 'red' ? 'bg-[#FF9999]' : 'bg-amber-300'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('log');
                      setRightOpen((o) => (inspectorTab === 'log' ? !o : true));
                    }}
                    title={`관측기록 (${observationLogStore.logs.length})`}
                    aria-label={`관측기록 (${observationLogStore.logs.length})`}
                    className={`relative w-7 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                      rightOpen && inspectorTab === 'log' ? activeBoxBtn : idleBoxBtn
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {observationLogStore.logs.length > 0 && (
                      <span
                        className={`absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] px-0.5 rounded-full text-[8px] font-mono font-bold leading-[13px] text-center ${
                          theme === 'white'
                            ? 'bg-emerald-600 text-white'
                            : theme === 'red'
                            ? 'bg-[#DC2626] text-black'
                            : 'bg-emerald-400 text-slate-950'
                        }`}
                      >
                        {observationLogStore.logs.length > 99
                          ? '99'
                          : observationLogStore.logs.length}
                      </span>
                    )}
                  </button>
                </>
              );
            })()}
          </div>

          <button
            type="button"
            onClick={handleCopyShareUrl}
            title={copiedUrl ? '링크 복사됨' : '현재 좌표·배율 URL 복사'}
            aria-label={copiedUrl ? '링크 복사됨' : '좌표 공유'}
            className={`w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 ${
              copiedUrl ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            {copiedUrl ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => canvasHandleRef.current?.exportPng()}
            title="성도 PNG 이미지 저장"
            aria-label="성도 PNG 이미지 저장"
            className={`w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            disabled={sensorPngExporting}
            onClick={async () => {
              if (optics.showSensorBox) {
                if (sensorPngExporting) return;
                setSensorPngExporting(true);
                try {
                  await canvasHandleRef.current?.exportSensorFovPng(activeSensorEquipmentName);
                } finally {
                  setSensorPngExporting(false);
                }
              } else {
                setOptics((p) => ({ ...p, showSensorBox: true }));
              }
            }}
            title={
              sensorPngExporting
                ? '고해상도 성야 이미지 로딩 완료를 기다린 후 PNG로 저장하는 중...'
                : optics.showSensorBox
                ? (() => {
                    const mActive = Boolean(optics.sensorMosaicSupported);
                    const sw = mActive ? Math.max(1, optics.sensorMosaicScaleW ?? 1) : 1;
                    const sh = mActive ? Math.max(1, optics.sensorMosaicScaleH ?? 1) : 1;
                    const effW = optics.sensorWidthDeg * sw;
                    const effH = optics.sensorHeightDeg * sh;
                    const mTag =
                      mActive && (sw > 1.001 || sh > 1.001)
                        ? ` 모자이크 ${sw.toFixed(1)}×${sh.toFixed(1)}`
                        : '';
                    return `사진 화각 영역만 PNG 저장 (${activeSensorEquipmentName}${mTag} · ${effW.toFixed(2)}° × ${effH.toFixed(2)}°)`;
                  })()
                : '촬영 센서 프레임 켜기 (켠 후 다시 클릭하면 사진 화각 PNG 저장)'
            }
            aria-label="사진 화각 PNG 저장"
            className={`w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 ${
              sensorPngExporting
                ? `${ui.buttonActive} cursor-wait`
                : optics.showSensorBox
                ? ui.buttonActive
                : `${ui.buttonIdle} opacity-65 hover:opacity-100`
            }`}
            style={{ borderRadius: '4px' }}
          >
            {sensorPngExporting ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handlePrintWhiteChart}
            title="종이 성도 인쇄 (인쇄용 화이트 모드)"
            aria-label="종이 성도 인쇄"
            className={`w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Far-Right Account Login & Settings Group */}
          <div
            className={`flex items-center gap-1 pl-1.5 ml-0.5 border-l shrink-0 ${ui.divider}`}
          >
            {authUser ? (
              <button
                type="button"
                onClick={() => {
                  setRequestedSidebarTab((prev) => ({
                    tab: 'settings',
                    seq: (prev?.seq ?? 0) + 1,
                  }));
                  setLeftOpen(true);
                }}
                title={`${authUser.displayName || authUser.email || 'Google 계정'} · 계정 및 클라우드 동기화 설정`}
                aria-label="로그인 계정 및 동기화 설정"
                className={`relative h-7 px-1.5 border flex items-center gap-1 transition-colors shrink-0 cursor-pointer ${ui.buttonIdle}`}
                style={{ borderRadius: '4px' }}
              >
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full text-[9.5px] font-bold flex items-center justify-center shrink-0 ${
                      theme === 'white'
                        ? 'bg-blue-600 text-white'
                        : theme === 'red'
                        ? 'bg-[#DC2626] text-black'
                        : 'bg-cyan-500 text-slate-950'
                    }`}
                  >
                    {(authUser.displayName || authUser.email || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden lg:inline text-[10.5px] font-medium max-w-[68px] truncate tracking-[-0.04em]">
                  {authUser.displayName || authUser.email?.split('@')[0] || '계정'}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    syncStatus === 'error'
                      ? 'bg-rose-500'
                      : syncStatus === 'saving' ||
                        syncStatus === 'loading' ||
                        syncStatus === 'checking' ||
                        syncStatus === 'pending'
                      ? 'bg-amber-400 animate-pulse'
                      : theme === 'red'
                      ? 'bg-[#EF4444]'
                      : 'bg-emerald-400'
                  }`}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <button
                type="button"
                disabled={!authReady || authBusy}
                onClick={() => void handleGoogleLogin()}
                title="Google 로그인 (클라우드 자동 동기화)"
                aria-label="Google 로그인"
                className={`h-7 px-2 border flex items-center gap-1 text-[10.5px] font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${ui.buttonLoad}`}
                style={{ borderRadius: '4px' }}
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline tracking-[-0.04em]">로그인</span>
              </button>
            )}
          </div>
        </div>
          </div>
        </header>
      </div>

      {/* Global floating error toast for Firebase Auth / Firestore Sync */}
      <AuthSyncControls
        toastOnly
        theme={theme}
        user={authUser}
        authReady={authReady}
        authBusy={authBusy}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        syncError={syncError}
        authError={authError}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
        onManualSync={handleManualCloudSync}
        onDismissError={handleDismissAuthSyncError}
      />

      {/* Main Observatory Workspace: Left Overlay Drawer + Flex Star Chart + Right Pushed Drawer */}
      <main className="relative flex-1 min-h-0 overflow-hidden flex">
        {/* Star Chart + Bottom Time Dock (pushes left when right drawer opens) */}
        <div className="flex-1 min-w-0 h-full flex flex-col min-h-0 overflow-hidden">
          <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
            <StarChartCanvas
              ref={canvasHandleRef}
              view={view}
              theme={theme}
              layers={tourAwareLayers}
              optics={tourAwareOptics}
              observer={observer}
              hips={tourAwareHips}
              catalogs={catalogs}
              selected={selected}
              centerLocked={centerLocked}
              solarTrails={
                tourState.active || tempHiddenLayers.solar ? emptySolarTrails : solarTrails
              }
              sessionIds={tourState.active ? emptySessionIds : sessionIds}
              sessionPlan={sessionPlan}
              challenges={chartChallenges}
              leftDrawerOpen={leftOpen}
              rightDrawerOpen={rightOpen}
              challengePickMode={isChallengePicking}
              challengePickAllowEmpty={challengePickAllowEmpty}
              challengeDraftCount={challengeDraft?.checkpoints.length ?? 0}
              onChangeView={handleChangeView}
              onSelect={handleSelect}
              onUnlockCenter={handleUnlockCenter}
              onUserCameraInteract={handleUserCameraInteract}
              onChallengeChartPick={handleChallengeChartPick}
              onUndoChallengeCheckpoint={handleUndoChallengeCheckpoint}
              rulerMode={rulerMode}
              rulerMeasurement={rulerMeasurement}
              onRulerPickPoint={handleRulerPickPoint}
              onClearRuler={handleClearRuler}
              onCloseRulerMode={handleCloseRulerMode}
              onToggleSessionItem={handleToggleSessionItem}
              onJumpCardinal={handleJumpCardinal}
              asterismMode={asterismMode}
              asterismStore={tourAwareAsterismStore}
              asterismTool={asterismTool}
              asterismPopover={asterismPopover}
              asterismSelectedId={asterismSelectedId}
              asterismDraft={asterismDraft}
              asterismCanUndo={asterismPast.length > 0}
              asterismCanRedo={asterismFuture.length > 0}
              onChangeAsterismTool={handleChangeAsterismTool}
              onChangeAsterismPopover={setAsterismPopover}
              onOpenAsterismShapeProps={handleOpenAsterismShapeProps}
              onSelectAsterism={handleSelectAsterism}
              onAddAsterismDraftPoint={handleAddAsterismDraftPoint}
              onFinishAsterismDraft={handleFinishAsterismDraft}
              onUndoAsterismDraftPoint={handleUndoAsterismDraftPoint}
              onCancelAsterismDraft={handleCancelAsterismDraft}
              onCreateAsterismLabel={handleCreateAsterismLabel}
              onCreateAsterismCircle={handleCreateAsterismCircle}
              onStartNewAsterismFromStar={handleStartNewAsterismFromStar}
              onMoveAsterismVertex={handleMoveAsterismVertex}
              onInsertAsterismVertex={handleInsertAsterismVertex}
              onDeleteAsterismVertex={handleDeleteAsterismVertex}
              onCommitAsterismDrag={handleCommitAsterismDrag}
              onUndoAsterism={handleUndoAsterism}
              onRedoAsterism={handleRedoAsterism}
              onCloseAsterismMode={handleCloseAsterismMode}
              onUpdateAsterismObject={handleUpdateAsterismObject}
              onDeleteAsterismObject={handleDeleteAsterismObject}
              onUpdateAsterismSettings={handleUpdateAsterismSettings}
              onSetAsterismActiveLayer={handleSetAsterismActiveLayer}
              onToggleAsterismLayerVisible={handleToggleAsterismLayerVisible}
              onCreateAsterismLayer={handleCreateAsterismLayer}
              onRenameAsterismLayer={handleRenameAsterismLayer}
              onDeleteAsterismLayer={handleDeleteAsterismLayer}
              onSetActiveAsterism={handleSetActiveAsterism}
              onCreateAsterismGroup={handleCreateAsterismGroup}
              onUpdateAsterismGroup={handleUpdateAsterismGroup}
              onDeleteAsterismGroup={handleDeleteAsterismGroup}
              onToggleAsterismGroupVisible={handleToggleAsterismGroupVisible}
              onApplyDefaultsToAsterismGroup={handleApplyDefaultsToAsterismGroup}
              onSaveAsterismGroupView={handleSaveAsterismGroupView}
              onFocusAsterismGroup={handleFocusAsterismGroup}
              onLoadAsterismPresets={handleLoadAsterismPresets}
              onImportAsterismBundle={handleImportAsterismBundle}
              onChangeOptics={setOptics}
            />
            <TourGuideOverlay
              tour={tourState}
              dwellProgress={tourDwellProgress}
              theme={theme}
              isCurrentCheckpointObserved={isCurrentTourCheckpointObserved}
              onPrev={handlePrevTourStop}
              onNext={handleNextTourStop}
              onTogglePlay={handleToggleTourPlay}
              onJump={handleJumpTourStop}
              onStop={handleStopTour}
              onCycleDwellSec={handleCycleTourDwellSec}
              onToggleObserved={
                tourState.trackId && currentTourStop?.checkpointId
                  ? () =>
                      handleToggleChallengeCheckpoint(
                        tourState.trackId!,
                        currentTourStop.checkpointId!
                      )
                  : undefined
              }
            />
            {selected && detailWindowOpen && !tourState.active && (
              <CelestialInfoWindow
                selected={selected}
                centerLocked={centerLocked}
                solarTrails={solarTrails}
                theme={theme}
                observer={observer}
                optics={optics}
                equipmentLocker={equipmentLocker}
                savedSites={savedSites}
                catalogs={catalogs}
                sessionPlan={sessionPlan}
                observingLists={observingListsState.lists}
                tonightListId={observingListsState.tonightListId}
                observationLogStore={observationLogStore}
                asterismMode={asterismMode}
                leftDrawerOpen={leftOpen}
                rightDrawerOpen={rightOpen}
                dockSide={infoWindowDockSide}
                onChangeDockSide={setInfoWindowDockSide}
                onClose={() => setDetailWindowOpen(false)}
                onToggleCenterLock={handleToggleCenterLock}
                onToggleSolarTrail={handleToggleSolarTrail}
                onClearSolarTrails={handleClearSolarTrails}
                onChangeView={handleChangeView}
                onChangeOptics={setOptics}
                onToggleSessionItem={handleToggleSessionItem}
                onSaveObservationLog={handleSaveObservationLog}
                onDeleteObservationLog={handleDeleteObservationLog}
                onToggleObjectObserved={handleToggleObjectObserved}
                onOpenObservationLogsTab={() => {
                  setInspectorTab('log');
                  setRightOpen(true);
                }}
              />
            )}

            {/* Bottom Edge Pull-Handle Tab (shown only when TimeControlBar is hidden; when open, toggle sits inline before '-' inside TimeControlBar) */}
            {!timeBarOpen && (
              <button
                type="button"
                onClick={() => setTimeBarOpen(true)}
                title="시간 조절바 펼치기"
                aria-label="시간 조절바 펼치기"
                aria-expanded={false}
                className={`no-print absolute z-30 bottom-0 left-1/2 -translate-x-1/2 h-5 w-16 border border-b-0 flex items-center justify-center transition-[background-color,box-shadow] duration-200 ease-out cursor-pointer ${
                  theme === 'white'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-400 shadow-md'
                    : theme === 'red'
                    ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.45)]'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]'
                }`}
                style={{
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                }}
              >
                <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
          <div
            className={`no-print shrink-0 grid transition-[grid-template-rows] duration-200 ease-out ${
              timeBarOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div
                className={`transition-transform duration-200 ease-out ${
                  timeBarOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
                }`}
              >
                <TimeControlBar
                  theme={theme}
                  observer={observer}
                  onChangeObserver={handleChangeObserver}
                  onCollapse={() => setTimeBarOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Left Overlay Control Drawer (270px, auto-hides on mouse leave) */}
        <div
          onMouseEnter={() => {
            pointerInLeftRef.current = true;
            clearLeftHideTimer();
          }}
          onMouseLeave={() => {
            pointerInLeftRef.current = false;
            if (leftOpen) scheduleLeftHide(260);
          }}
          onPointerDownCapture={(e) => {
            pointerDownInLeftRef.current = true;
            const target = e.target as HTMLElement | null;
            if (
              target &&
              (target.tagName === 'SELECT' ||
                (target.tagName === 'INPUT' &&
                  ['color', 'file', 'datetime-local', 'date', 'time'].includes(
                    (target as HTMLInputElement).type
                  )) ||
                Boolean(target.closest('label')?.querySelector('input[type="color"],input[type="file"]')))
            ) {
              nativePickerInLeftRef.current = true;
            }
          }}
          onChangeCapture={(e) => {
            const target = e.target as HTMLElement | null;
            if (
              target &&
              (target.tagName === 'SELECT' ||
                (target.tagName === 'INPUT' &&
                  ['color', 'file', 'datetime-local', 'date', 'time'].includes(
                    (target as HTMLInputElement).type
                  )))
            ) {
              nativePickerInLeftRef.current = false;
            }
          }}
          className={`no-print absolute inset-y-0 left-0 z-30 w-[270px] transition-transform duration-200 ease-out shadow-2xl ${
            leftOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
        >
          <ControlSidebar
            key={resetCount}
            view={view}
            theme={theme}
            layers={layers}
            optics={optics}
            observer={observer}
            hips={hips}
            catalogs={catalogs}
            selected={selected}
            equipmentLocker={equipmentLocker}
            savedSites={savedSites}
            sessionPlanCount={sessionPlan.length}
            onChangeView={handleChangeView}
            onChangeLayers={setLayers}
            onChangeOptics={setOptics}
            onChangeObserver={handleChangeObserver}
            onChangeHips={setHips}
            onSelect={(item) => handleSelect(item)}
            onSearchActiveChange={setSearchActive}
            onAddOrUpdateEquipment={handleAddOrUpdateEquipment}
            onDeleteEquipment={handleDeleteEquipment}
            onToggleActiveEquipment={handleToggleActiveEquipment}
            onSelectActiveEquipment={handleSelectActiveEquipment}
            onImportEquipmentLocker={handleImportEquipmentLocker}
            onOpenSiteMap={handleOpenSiteMap}
            onSaveSite={handleSaveSite}
            onDeleteSite={handleDeleteSite}
            onImportSites={handleImportSites}
            onImportLayerSettings={handleImportLayerSettings}
            onResetLayerSettings={handleResetLayerSettings}
            onChangeTheme={setTheme}
            redIntensity={redIntensity}
            onChangeRedIntensity={setRedIntensity}
            uiFontFamily={uiFontFamily}
            onChangeUiFontFamily={setUiFontFamily}
            uiFontSizeStep={uiFontSizeStep}
            onChangeUiFontSizeStep={setUiFontSizeStep}
            authUser={authUser}
            authReady={authReady}
            authBusy={authBusy}
            syncStatus={syncStatus}
            lastSyncedAt={lastSyncedAt}
            syncError={syncError}
            authError={authError}
            onLogin={handleGoogleLogin}
            onLogout={handleGoogleLogout}
            onManualSync={handleManualCloudSync}
            onDismissAuthError={handleDismissAuthSyncError}
            requestedTab={requestedSidebarTab}
          />
        </div>

        {/* Left Screen-Edge Auto-Open Trigger Strip */}
        {!leftOpen && (
          <div
            aria-hidden="true"
            onMouseEnter={() => {
              pointerInLeftRef.current = true;
              clearLeftHideTimer();
              setLeftOpen(true);
            }}
            className="no-print absolute inset-y-0 left-0 z-30 w-2.5"
          />
        )}

        {/* Left Edge Pull-Handle Tab */}
        <button
          type="button"
          onClick={() => {
            clearLeftHideTimer();
            setLeftOpen((o) => !o);
          }}
          onMouseEnter={() => {
            pointerInLeftRef.current = true;
            clearLeftHideTimer();
            if (!leftOpen) setLeftOpen(true);
          }}
          onMouseLeave={() => {
            pointerInLeftRef.current = false;
            if (leftOpen) scheduleLeftHide(260);
          }}
          title={leftOpen ? '왼쪽 메뉴 접기' : '왼쪽 메뉴 펼치기'}
          aria-label={leftOpen ? '왼쪽 메뉴 접기' : '왼쪽 메뉴 펼치기'}
          className={`no-print absolute z-30 top-[30%] -translate-y-1/2 h-16 w-5 border border-l-0 flex items-center justify-center transition-[left,background-color,box-shadow] duration-200 ease-out ${
            theme === 'white'
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-400 shadow-md'
              : theme === 'red'
              ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.45)]'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]'
          }`}
          style={{
            left: leftOpen ? '270px' : '0px',
            borderTopRightRadius: '6px',
            borderBottomRightRadius: '6px',
          }}
        >
          {leftOpen ? (
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
        </button>

        {/* Right Overlay Menu Drawer (292px, auto-hides on mouse leave) */}
        <div
          onMouseEnter={() => {
            pointerInRightRef.current = true;
            clearRightHideTimer();
          }}
          onMouseLeave={() => {
            pointerInRightRef.current = false;
            if (rightOpen) scheduleRightHide(260);
          }}
          onDragStartCapture={() => {
            draggingInRightRef.current = true;
            clearRightHideTimer();
          }}
          onDragEndCapture={() => {
            draggingInRightRef.current = false;
            if (!pointerInRightRef.current && rightOpen) {
              scheduleRightHide(260);
            }
          }}
          onPointerDownCapture={(e) => {
            pointerDownInRightRef.current = true;
            const target = e.target as HTMLElement | null;
            if (
              target &&
              (target.tagName === 'SELECT' ||
                (target.tagName === 'INPUT' &&
                  ['color', 'file', 'datetime-local', 'date', 'time'].includes(
                    (target as HTMLInputElement).type
                  )) ||
                Boolean(target.closest('label')?.querySelector('input[type="color"],input[type="file"]')))
            ) {
              nativePickerInRightRef.current = true;
            }
          }}
          onChangeCapture={(e) => {
            const target = e.target as HTMLElement | null;
            if (
              target &&
              (target.tagName === 'SELECT' ||
                (target.tagName === 'INPUT' &&
                  ['color', 'file', 'datetime-local', 'date', 'time'].includes(
                    (target as HTMLInputElement).type
                  )))
            ) {
              nativePickerInRightRef.current = false;
            }
          }}
          className={`no-print absolute inset-y-0 right-0 z-30 w-[292px] transition-transform duration-200 ease-out shadow-2xl ${
            rightOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
        >
          <ObjectInspector
            selected={selected}
            activeTab={inspectorTab}
            theme={theme}
            observer={observer}
            optics={optics}
            equipmentLocker={equipmentLocker}
            savedSites={savedSites}
            catalogs={catalogs}
            sessionPlan={sessionPlan}
            tonightManualEntries={observingListsState.tonightEntries}
            observingLists={observingListsState.lists}
            tonightListId={observingListsState.tonightListId}
            challenges={challenges}
            onTabChange={setInspectorTab}
            onClose={() => setRightOpen(false)}
            onSelect={handleSelect}
            onChangeView={handleChangeView}
            onSetTonightList={handleSetTonightList}
            onCreateObservingList={handleCreateObservingList}
            onRenameObservingList={handleRenameObservingList}
            onDeleteObservingList={handleDeleteObservingList}
            onToggleSessionItem={handleToggleSessionItem}
            onToggleObserved={handleToggleObserved}
            onUpdateNotes={handleUpdateNotes}
            onAddRecommendedTonight={handleAddRecommendedTonight}
            onReorderTonightEntries={handleReorderTonightEntries}
            onReorderObservingLists={handleReorderObservingLists}
            onReorderObservingListEntries={handleReorderObservingListEntries}
            onImportSkylist={handleImportSkylistSession}
            onExportSkylist={handleExportSkylistSession}
            highlightSessionPlan={layers.highlightSessionPlan}
            onToggleHighlightSessionPlan={(enabled) =>
              setLayers((p) => ({ ...p, highlightSessionPlan: enabled }))
            }
            sessionPlanColor={layers.sessionPlanColor}
            onChangeSessionPlanColor={(color) =>
              setLayers((p) => ({ ...p, sessionPlanColor: color }))
            }
            sessionPlanOpacity={layers.sessionPlanOpacity}
            onChangeSessionPlanOpacity={(opacity) =>
              setLayers((p) => ({ ...p, sessionPlanOpacity: opacity }))
            }
            challengeColor={layers.challengeColor}
            onChangeChallengeColor={(color) =>
              setLayers((p) => ({ ...p, challengeColor: color }))
            }
            onToggleAllChallengesOnChart={handleToggleAllChallengesOnChart}
            challengeOpacity={layers.challengeOpacity}
            onChangeChallengeOpacity={(opacity) =>
              setLayers((p) => ({ ...p, challengeOpacity: opacity }))
            }
            challengeLineWidth={layers.challengeLineWidth}
            onChangeChallengeLineWidth={(lineWidth) =>
              setLayers((p) => ({ ...p, challengeLineWidth: lineWidth }))
            }
            challengeDraft={challengeDraft}
            challengeDraftIsNew={challengeDraftIsNew}
            challengePickAllowEmpty={challengePickAllowEmpty}
            challengeDraftNotice={challengeDraftNotice}
            onStartCreateChallengeDraft={handleStartCreateChallengeDraft}
            onStartEditChallengeDraft={handleStartEditChallengeDraft}
            onChangeChallengeDraft={setChallengeDraft}
            onCancelChallengeDraft={handleCancelChallengeDraft}
            onChangeChallengePickAllowEmpty={setChallengePickAllowEmpty}
            onClearChallengeDraftNotice={() => setChallengeDraftNotice(null)}
            currentFovDeg={view.fsz}
            onAddCenterChallengeCheckpoint={handleAddCenterChallengeCheckpoint}
            onToggleChallengeOnChart={handleToggleChallengeOnChart}
            onToggleChallengeCheckpoint={handleToggleChallengeCheckpoint}
            onUpdateChallengeCheckpointNote={handleUpdateChallengeCheckpointNote}
            onUpdateChallengeCheckpointFov={handleUpdateChallengeCheckpointFov}
            onSelectChallengeCheckpoint={handleSelectChallengeCheckpoint}
            onFrameChallengeTrack={handleFrameChallengeTrack}
            onPrintChallengeCertificate={handlePrintChallengeCertificate}
            onSaveChallengeTrack={handleSaveChallengeTrack}
            onDeleteChallengeTrack={handleDeleteChallengeTrack}
            onResetBuiltInChallenge={handleResetBuiltInChallenge}
            onImportChallenges={handleImportChallenges}
            onReorderChallengeTracks={handleReorderChallengeTracks}
            onReorderChallengeCheckpoints={handleReorderChallengeCheckpoints}
            tourState={tourState}
            tonightTourStops={tonightTourStops}
            onStartTonightTour={handleStartTonightTour}
            onStartChallengeTour={handleStartChallengeTour}
            onToggleTourPlay={handleToggleTourPlay}
            onStopTour={handleStopTour}
            onJumpTourStop={handleJumpTourStop}
            onChangeTourDwellSec={handleChangeTourDwellSec}
            asterismStore={asterismStore}
            asterismMode={asterismMode}
            asterismSelectedId={asterismSelectedId}
            onToggleAsterismMode={handleToggleAsterismMode}
            onSelectAsterism={handleSelectAsterism}
            onDeleteAsterismObject={handleDeleteAsterismObject}
            onSetAsterismActiveLayer={handleSetAsterismActiveLayer}
            onToggleAsterismLayerVisible={handleToggleAsterismLayerVisible}
            onSetAllAsterismLayersVisible={handleSetAllAsterismLayersVisible}
            onCreateAsterismLayer={handleCreateAsterismLayer}
            onRenameAsterismLayer={handleRenameAsterismLayer}
            onDeleteAsterismLayer={handleDeleteAsterismLayer}
            onSetActiveAsterism={handleSetActiveAsterism}
            onOpenAsterismLayers={handleOpenAsterismLayers}
            onOpenAsterismShapeProps={handleOpenAsterismShapeProps}
            onCreateAsterismGroup={handleCreateAsterismGroup}
            onUpdateAsterismGroup={handleUpdateAsterismGroup}
            onDeleteAsterismGroup={handleDeleteAsterismGroup}
            onToggleAsterismGroupVisible={handleToggleAsterismGroupVisible}
            onFocusAsterismGroup={handleFocusAsterismGroup}
            onReorderAsterismLayers={handleReorderAsterismLayers}
            onReorderAsterismGroups={handleReorderAsterismGroups}
            onReorderAsterismObjects={handleReorderAsterismObjects}
            onLoadAsterismPresets={handleLoadAsterismPresets}
            onToggleAsterismPreset={handleToggleAsterismPreset}
            onFocusAsterismPreset={handleFocusAsterismPreset}
            onImportAsterismBundle={handleImportAsterismBundle}
            observationLogStore={observationLogStore}
            onSaveObservationLog={handleSaveObservationLog}
            onDeleteObservationLog={handleDeleteObservationLog}
            onToggleObjectObserved={handleToggleObjectObserved}
            onFocusObservationTarget={handleFocusObservationTarget}
            onImportObservationLogs={handleImportObservationLogs}
            onReorderObservationLogs={handleReorderObservationLogs}
          />
        </div>

        {/* Right Screen-Edge Auto-Open Trigger Strip */}
        {!rightOpen && (
          <div
            aria-hidden="true"
            onMouseEnter={() => {
              pointerInRightRef.current = true;
              clearRightHideTimer();
              setRightOpen(true);
            }}
            className="no-print absolute inset-y-0 right-0 z-30 w-2.5"
          />
        )}

        {/* Right Edge Pull-Handle Tab */}
        <button
          type="button"
          onClick={() => {
            clearRightHideTimer();
            setRightOpen((o) => !o);
          }}
          onMouseEnter={() => {
            pointerInRightRef.current = true;
            clearRightHideTimer();
            if (!rightOpen) setRightOpen(true);
          }}
          onMouseLeave={() => {
            pointerInRightRef.current = false;
            if (rightOpen) scheduleRightHide(260);
          }}
          title={rightOpen ? '오른쪽 메뉴 접기' : '오른쪽 메뉴 펼치기'}
          aria-label={rightOpen ? '오른쪽 메뉴 접기' : '오른쪽 메뉴 펼치기'}
          className={`no-print absolute z-30 top-[30%] -translate-y-1/2 h-16 w-5 border border-r-0 flex items-center justify-center transition-[right,background-color,box-shadow] duration-200 ease-out ${
            theme === 'white'
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-400 shadow-md'
              : theme === 'red'
              ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.45)]'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]'
          }`}
          style={{
            right: rightOpen ? '292px' : '0px',
            borderTopLeftRadius: '6px',
            borderBottomLeftRadius: '6px',
          }}
        >
          {rightOpen ? (
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
        </button>
      </main>

      <ObservingSiteMapModal
        open={siteMapOpen}
        theme={theme}
        observer={observer}
        savedSites={savedSites}
        initialFocusSite={siteMapFocus}
        onClose={() => setSiteMapOpen(false)}
        onApplySite={handleApplySite}
        onSaveSite={handleSaveSite}
        onDeleteSite={handleDeleteSite}
        onImportSites={handleImportSites}
      />

      {/* Dedicated Print-Only Sheet (rendered exclusively by @media print) */}
      {printPreview && (
        <div className="print-only" aria-hidden="true">
          <img src={printPreview.dataUrl} alt={printPreview.title} />
        </div>
      )}

      {/* Printable White Star Chart Preview Modal */}
      {printPreview && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="종이 성도 인쇄 미리보기"
          onClick={() => setPrintPreview(null)}
        >
          <div
            className={`w-full max-w-5xl max-h-[92vh] border flex flex-col overflow-hidden shadow-2xl ${ui.panel}`}
            style={{ borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${ui.divider}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Printer className={`w-4 h-4 shrink-0 ${ui.accentText}`} />
                <span className={`text-xs sm:text-sm font-semibold truncate ${ui.textPrimary}`}>
                  {printPreview.title}
                </span>
                <span className={`hidden sm:inline text-[11px] ${ui.textMuted}`}>
                  · A4 가로 인쇄 최적화 (화이트 모드)
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadPrintablePng}
                  className={`h-7 px-2.5 border text-xs font-medium flex items-center gap-1.5 transition-colors ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>인쇄용 PNG 저장</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`h-7 px-3 border text-xs font-semibold flex items-center gap-1.5 transition-colors ${ui.buttonActive}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>인쇄하기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPreview(null)}
                  aria-label="인쇄 미리보기 닫기"
                  className={`w-7 h-7 border flex items-center justify-center transition-colors ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 bg-slate-900/60 flex items-center justify-center">
              <img
                src={printPreview.dataUrl}
                alt={printPreview.title}
                className="max-w-full max-h-[76vh] w-auto h-auto object-contain bg-white shadow-xl border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}
      <ConfirmDialogModal
        request={confirmRequest}
        theme={theme}
        onResolve={handleResolveConfirm}
      />
    </div>
      {theme === 'red' && redOverlayAlpha > 0 && (
        <div
          aria-hidden="true"
          className="no-print pointer-events-none fixed inset-0 z-[9999]"
          style={{
            backgroundColor: `rgba(150, 0, 0, ${redOverlayAlpha})`,
            mixBlendMode: 'multiply',
          }}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
}
