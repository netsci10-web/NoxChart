import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Globe2,
  Moon,
  Printer,
  Share2,
  Star,
  Sun,
  Trophy,
} from 'lucide-react';
import { ControlSidebar } from './components/ControlSidebar';
import { ObjectInspector } from './components/ObjectInspector';
import { ObservingSiteMapModal } from './components/ObservingSiteMapModal';
import { StarChartCanvas, StarChartCanvasHandle } from './components/StarChartCanvas';
import { TimeControlBar } from './components/TimeControlBar';
import { CALDWELL_CATALOG } from './data/caldwell';
import { createDefaultChallengeTracks } from './data/challenges';
import {
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
  ChallengeCheckpoint,
  ChallengeTrack,
  ChartViewState,
  CoordSystem,
  DeepSkyObject,
  EquipmentCategory,
  EquipmentItem,
  EquipmentLockerState,
  HipsSettings,
  LayerSettings,
  ObserverConfig,
  ObservingListGroup,
  ObservingListsState,
  ObservingSessionEntry,
  OpticsSettings,
  SavedObservingSite,
  SelectedItem,
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
import { CHALLENGES_STORAGE_KEY, mergeChallengeTracks } from './utils/challengeStorage';
import {
  downloadSkylistFile,
  exportObservingListToSkylist,
  parseSkylistObjects,
  resolveSkylistObjects,
} from './utils/skylist';
import {
  LayerSettingsBundle,
  loadSavedLayerSettings,
  saveLayerSettingsToLocal,
} from './utils/layerStorage';
import {
  ACTIVE_SITE_STORAGE_KEY,
  mergeObservingSites,
  SAVED_SITES_STORAGE_KEY,
} from './utils/observingSites';
import { getSolarSystemBodies, getSolarSystemDailyTrail } from './utils/solarSystem';
import { getUiTheme } from './utils/themeClasses';

const SESSION_STORAGE_KEY = 'sidereal_atlas_session_v1';
const OBSERVING_LISTS_STORAGE_KEY = 'sidereal_atlas_observing_lists_v1';
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
  showDso: true,
  showMessierCatalog: false,
  showCaldwellCatalog: false,
  dsoSymbolDensityPct: 30,
  showDsoLabels: true,
  dsoLabelDensityPct: 7,
  dsoOpacity: 1.0,
  showStarLabels: true,
  showProperStarNames: false,
  starLabelDensityPct: 7,
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
  challengeOpacity: 1.0,
  challengeLineWidth: 0.8,
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
  showEyepiece: false,
  eyepieceFovDeg: 1.7,
  eyepieceRotationDeg: 0,
  eyepieceLabel: '망원경 아이피스',
  eyepieceInputMode: 'equipment',
  telescopeFocalLengthMm: 1000,
  eyepieceFocalLengthMm: 25,
  eyepieceAfovDeg: 68,
  showSensorBox: false,
  sensorWidthDeg: 2.15,
  sensorHeightDeg: 1.21,
  sensorRotationDeg: 0,
  sensorEquipmentLabel: undefined,
  sensorRotationLocked: false,
  showStarHop: false,
  showSelectionMark: true,
};

const DEFAULT_OBSERVER: ObserverConfig = {
  name: '서울 (Seoul)',
  lat: 37.5665,
  lon: 126.978,
  timestampMs: Date.now(),
  useLiveTime: true,
  isPlaying: false,
  timeRateSecPerSec: 1,
  minAltitudeDeg: -90,
  highlightAboveMinAlt: false,
};

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

function loadSavedOpticsSettings(): OpticsSettings {
  try {
    const raw = localStorage.getItem(OPTICS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
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
          showSensorBox: boolOr('showSensorBox', DEFAULT_OPTICS.showSensorBox),
          sensorWidthDeg: numOr('sensorWidthDeg', DEFAULT_OPTICS.sensorWidthDeg, 0.02, 40),
          sensorHeightDeg: numOr('sensorHeightDeg', DEFAULT_OPTICS.sensorHeightDeg, 0.02, 40),
          sensorRotationDeg: numOr('sensorRotationDeg', DEFAULT_OPTICS.sensorRotationDeg, 0, 360),
          sensorEquipmentLabel:
            typeof parsed.sensorEquipmentLabel === 'string' && parsed.sensorEquipmentLabel.trim()
              ? parsed.sensorEquipmentLabel.trim()
              : undefined,
          sensorRotationLocked: boolOr('sensorRotationLocked', false),
          showStarHop: boolOr('showStarHop', DEFAULT_OPTICS.showStarHop),
          showSelectionMark: boolOr('showSelectionMark', DEFAULT_OPTICS.showSelectionMark),
        };
      }
    }
  } catch {
    // Ignore storage parse failure
  }
  return { ...DEFAULT_OPTICS };
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
      };
      if (
        typeof parsed.lat === 'number' &&
        Number.isFinite(parsed.lat) &&
        typeof parsed.lon === 'number' &&
        Number.isFinite(parsed.lon)
      ) {
        return {
          ...DEFAULT_OBSERVER,
          name:
            typeof parsed.name === 'string' && parsed.name.trim()
              ? parsed.name
              : DEFAULT_OBSERVER.name,
          lat: Math.max(-90, Math.min(90, parsed.lat)),
          lon: Math.max(-180, Math.min(180, parsed.lon)),
          minAltitudeDeg:
            typeof parsed.minAltitudeDeg === 'number' && Number.isFinite(parsed.minAltitudeDeg)
              ? Math.max(-90, Math.min(85, parsed.minAltitudeDeg))
              : DEFAULT_OBSERVER.minAltitudeDeg,
          highlightAboveMinAlt:
            typeof parsed.highlightAboveMinAlt === 'boolean'
              ? parsed.highlightAboveMinAlt
              : DEFAULT_OBSERVER.highlightAboveMinAlt,
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
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [centerLocked, setCenterLocked] = useState(false);
  const [solarTrails, setSolarTrails] = useState<Record<string, number>>({});
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'detail' | 'session' | 'challenge'>('detail');
  const [challengeDraft, setChallengeDraft] = useState<ChallengeTrack | null>(null);
  const challengeDraftRef = useRef<ChallengeTrack | null>(challengeDraft);
  challengeDraftRef.current = challengeDraft;
  const [challengeDraftIsNew, setChallengeDraftIsNew] = useState(false);
  const [challengePickAllowEmpty, setChallengePickAllowEmpty] = useState(true);
  const [challengeDraftNotice, setChallengeDraftNotice] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [resetCount, setResetCount] = useState(0);

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
      const nextObs = updater(prevObs);
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
    if (!activeTonightList) return manual;

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
    return [...manual, ...linkedProjected];
  }, [
    observingListsState.tonightEntries,
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

  // Persist active observing site coordinates & altitude filter locally
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
        coordSystem: view.coordSystem,
        fsz: view.fsz,
        flipH: view.flipH,
        flipV: view.flipV,
      };
      localStorage.setItem(APP_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [theme, view.coordSystem, view.fsz, view.flipH, view.flipV]);

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

  // Listen for Google Maps Platform Demo Key quota-exceeded events
  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Refresh live clock every 10s when live time is enabled (and not in time-lapse playback)
  useEffect(() => {
    if (!observer.useLiveTime || observer.isPlaying) return;
    const id = window.setInterval(() => {
      handleChangeObserver((p) =>
        p.useLiveTime && !p.isPlaying ? { ...p, timestampMs: Date.now() } : p
      );
    }, 10000);
    return () => window.clearInterval(id);
  }, [observer.useLiveTime, observer.isPlaying, handleChangeObserver]);

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
    options?: { hideSelectionMark?: boolean }
  ) => {
    const prevId = selectedRef.current?.data.id;
    const nextId = item?.data.id;
    if (!item || nextId !== prevId) {
      slewingToCenterRef.current = false;
      centerLockedRef.current = false;
      setCenterLocked(false);
    }
    selectedRef.current = item;
    setSelected(item);
    if (item) {
      const wantMark = !options?.hideSelectionMark;
      setOptics((prev) =>
        prev.showSelectionMark === wantMark
          ? prev
          : { ...prev, showSelectionMark: wantMark }
      );
      setInspectorTab('detail');
      setRightOpen(true);
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

  const handleDeleteObservingList = useCallback((listId: string) => {
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
  }, []);

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

        const canRotateSensor = camera ? isSmartTelescopeRotatable(camera) : true;
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
          sensorWidthDeg: sensorW,
          sensorHeightDeg: sensorH,
          sensorEquipmentLabel: sensorEquipLabel,
          sensorRotationLocked: !canRotateSensor,
          sensorRotationDeg: canRotateSensor ? prev.sensorRotationDeg : 0,
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

  const handleAddOrUpdateEquipment = useCallback(
    (item: EquipmentItem) => {
      setEquipmentLocker((prev) => {
        const exists = prev.items.some((it) => it.id === item.id);
        const items = exists
          ? prev.items.map((it) => (it.id === item.id ? item : it))
          : [...prev.items, item];
        const next: EquipmentLockerState = {
          items,
          activeIds: prev.activeIds,
        };
        if (prev.activeIds[item.category] === item.id) {
          applyEquipmentToOptics(next, item.category);
        }
        return next;
      });
    },
    [applyEquipmentToOptics]
  );

  const handleDeleteEquipment = useCallback(
    (id: string) => {
      setEquipmentLocker((prev) => {
        const target = prev.items.find((it) => it.id === id);
        const items = prev.items.filter((it) => it.id !== id);
        const activeIds = { ...prev.activeIds };
        if (target && activeIds[target.category] === id) {
          delete activeIds[target.category];
        }
        const next: EquipmentLockerState = { items, activeIds };
        if (target && prev.activeIds[target.category] === id) {
          applyEquipmentToOptics(next, target.category);
        }
        return next;
      });
    },
    [applyEquipmentToOptics]
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

  const handleDeleteSite = useCallback((id: string) => {
    setSavedSites((prev) => {
      const next = prev.filter((s) => s.id !== id);
      savedSitesRef.current = next;
      return next;
    });
  }, []);

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
    setChallenges((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, activeOnChart: !t.activeOnChart } : t))
    );
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

  const handleSaveChallengeTrack = useCallback((track: ChallengeTrack) => {
    setChallenges((prev) => {
      const idx = prev.findIndex((t) => t.id === track.id);
      const next = idx >= 0 ? prev.map((t) => (t.id === track.id ? track : t)) : [track, ...prev];
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
      guideNote: `RA ${formatRA(raDeg)} · Dec ${formatDec(decDeg)}`,
      observed: false,
    };
    const nextDraft: ChallengeTrack = {
      ...prev,
      checkpoints: [...prev.checkpoints, newCp],
    };
    challengeDraftRef.current = nextDraft;
    setChallengeDraft(nextDraft);
    setChallengeDraftNotice(`현재 성도 중심 (${code})을 체크포인트로 추가했습니다.`);
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
    (track: ChallengeTrack) => {
      setChallenges((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, activeOnChart: true } : t))
      );

      const coords: { ra: number; dec: number }[] = [];
      for (const cp of track.checkpoints) {
        if (cp.ra !== undefined && cp.dec !== undefined) {
          coords.push({ ra: cp.ra, dec: cp.dec });
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

      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const c of coords) {
        const a = c.ra * DEG2RAD;
        const d = c.dec * DEG2RAD;
        sx += Math.cos(d) * Math.cos(a);
        sy += Math.cos(d) * Math.sin(a);
        sz += Math.sin(d);
      }
      const len = Math.hypot(sx, sy, sz);
      if (len < 1e-4) {
        // Full-sky marathon (like Messier 110): jump to first unobserved or first checkpoint at wide FOV
        const firstTarget =
          track.checkpoints.find((c) => !c.observed && c.ra !== undefined && c.dec !== undefined) ??
          track.checkpoints.find((c) => c.ra !== undefined && c.dec !== undefined);
        if (firstTarget && firstTarget.ra !== undefined && firstTarget.dec !== undefined) {
          handleChangeView((p) => ({
            ...p,
            ra: ((firstTarget.ra! / 15) % 24 + 24) % 24,
            dec: Math.max(-85, Math.min(85, firstTarget.dec!)),
            fsz: 135,
          }));
        }
        return;
      }

      const centerRaDeg = ((Math.atan2(sy / len, sx / len) * RAD2DEG) + 360) % 360;
      const centerDecDeg = Math.asin(Math.max(-1, Math.min(1, sz / len))) * RAD2DEG;
      let maxDist = 8;
      for (const c of coords) {
        const d = angularDistanceDeg(centerRaDeg, centerDecDeg, c.ra, c.dec);
        if (d > maxDist) maxDist = d;
      }

      centerLockedRef.current = false;
      setCenterLocked(false);
      lockedHzRef.current = null;
      handleChangeView((p) => ({
        ...p,
        ra: ((centerRaDeg / 15) % 24 + 24) % 24,
        dec: Math.max(-85, Math.min(85, centerDecDeg)),
        fsz: Math.max(18, Math.min(150, maxDist * 2.35)),
      }));
    },
    [handleChangeView]
  );

  const handlePrintChallengeCertificate = useCallback(
    (track: ChallengeTrack) => {
      handleFrameChallengeTrack(track);
      if (theme !== 'white') {
        setTheme('white');
        window.setTimeout(() => window.print(), 280);
      } else {
        window.setTimeout(() => window.print(), 120);
      }
    },
    [handleFrameChallengeTrack, theme]
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
          ...CALDWELL_CATALOG,
        ];
        const found = allDsos.find(
          (d) =>
            d.id.replace(/\s+/g, '').toUpperCase() === key ||
            (d.altId && d.altId.replace(/\s+/g, '').toUpperCase() === key)
        );
        if (found) item = { kind: 'dso', data: found };
      } else if (cp.kind === 'star' && key) {
        const found = snap.brightStars.find(
          (s) =>
            s.id.replace(/\s+/g, '').toUpperCase() === key ||
            (s.hip && `HIP${s.hip}` === key) ||
            (s.name && s.name.replace(/\s+/g, '').toUpperCase() === key)
        );
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
        selectedRef.current = item;
        setSelected(item);
        setOptics((prev) =>
          prev.showSelectionMark ? prev : { ...prev, showSelectionMark: true }
        );
        centerLockedRef.current = false;
        setCenterLocked(false);
        lockedHzRef.current = null;
        handleChangeView((p) => ({
          ...p,
          ra: ((item!.data.ra / 15) % 24 + 24) % 24,
          dec: Math.max(-89.5, Math.min(89.5, item!.data.dec)),
          fsz: Math.min(p.fsz, item!.kind === 'dso' ? 18 : 24),
        }));
      }
    },
    [handleChangeView]
  );

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
    if (theme !== 'white') {
      setTheme('white');
      window.setTimeout(() => window.print(), 180);
    } else {
      window.print();
    }
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
    setRightOpen(false);
    setLeftOpen(false);
    setInspectorTab('detail');
    setChallengeDraft(null);
    setChallengeDraftIsNew(false);
    setChallengeDraftNotice(null);
    setSearchActive(false);
    setResetCount((c) => c + 1);
  };

  const isChallengePicking = Boolean(
    challengeDraft && rightOpen && inspectorTab === 'challenge'
  );

  const chartChallenges = useMemo(() => {
    if (!challengeDraft) return challenges;
    const draftOverlay: ChallengeTrack = { ...challengeDraft, activeOnChart: true };
    const exists = challenges.some((t) => t.id === challengeDraft.id);
    return exists
      ? challenges.map((t) => (t.id === challengeDraft.id ? draftOverlay : t))
      : [draftOverlay, ...challenges];
  }, [challenges, challengeDraft]);

  const ui = getUiTheme(theme);
  const magLimit = getLimitingMagnitude(view.fsz, layers.magOffset);
  const dsoMagLimit = getDsoLimitingMagnitude(view.fsz, layers.dsoMagOffset);

  return (
    <div
      data-theme={theme}
      className={`w-screen h-screen flex flex-col overflow-hidden ${ui.shell}`}
    >
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {/* Top Precision Telemetry Ribbon */}
      <header
        className={`no-print h-12 shrink-0 border-b px-3 flex items-center justify-between gap-3 ${ui.header}`}
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            title="초기값으로 되돌리기"
            className="text-sm font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            NoxChart
          </button>
        </div>

        {/* Center: Icon-only 3-Mode Theme Switcher + Icon-only Coordinate System Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg border ${
              theme === 'white'
                ? 'bg-slate-100 border-slate-300'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C]'
                : 'bg-[#0B1220] border-[#25334D]'
            }`}
            role="group"
            aria-label="테마 모드"
          >
            <button
              type="button"
              onClick={() => setTheme('dark')}
              title="다크 모드"
              aria-label="다크 모드"
              className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                theme === 'dark'
                  ? 'bg-[#0094B8] text-white'
                  : theme === 'white'
                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                  : 'text-[#B85050] hover:text-[#FF5555] hover:bg-[#220404]'
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('white')}
              title="인쇄용 화이트 모드"
              aria-label="인쇄용 화이트 모드"
              className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                theme === 'white'
                  ? 'bg-slate-900 text-white'
                  : theme === 'red'
                  ? 'text-[#B85050] hover:text-[#FF5555] hover:bg-[#220404]'
                  : 'text-slate-400 hover:text-white hover:bg-[#182438]'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('red')}
              title="적색 야간 모드"
              aria-label="적색 야간 모드"
              className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                theme === 'red'
                  ? 'bg-[#7F1D1D] text-[#FF4D4D]'
                  : theme === 'white'
                  ? 'text-slate-500 hover:bg-slate-200'
                  : 'text-slate-400 hover:bg-[#182438]'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full inline-block ${
                  theme === 'red'
                    ? 'bg-[#EF4444] ring-2 ring-[#FF4D4D]/75'
                    : 'bg-red-600'
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

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
              title="지평좌표계 (Alt/Az · 관측지 지평선 수평)"
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
              <Compass className="w-4 h-4" />
            </button>
          </div>

          {/* Cardinal Direction Quick-Jump Buttons (동/서/남/북 · 고도 30° · 화각 60°) */}
          <div
            className={`flex items-center gap-0.5 p-0.5 rounded-lg border shrink-0 ${
              theme === 'white'
                ? 'bg-slate-100 border-slate-300'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C]'
                : 'bg-[#0B1220] border-[#25334D]'
            }`}
            role="group"
            aria-label="방위 바로가기"
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
                onClick={() => handleJumpCardinal(dir.az)}
                title={`${dir.full} 하늘 바로가기 (방위각 ${dir.az}° · 고도 30° · 화각 60°)`}
                aria-label={`${dir.full} 하늘 바로가기 (고도 30도, 화각 60도)`}
                className={`w-6 sm:w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-semibold transition-colors shrink-0 ${
                  theme === 'white'
                    ? 'text-slate-600 hover:text-blue-700 hover:bg-white'
                    : theme === 'red'
                    ? 'text-[#DC2626] hover:text-[#FF5252] hover:bg-[#220404]'
                    : 'text-slate-300 hover:text-[#22D3EE] hover:bg-[#182438]'
                }`}
              >
                {dir.label}
              </button>
            ))}
          </div>

          {/* Limiting Magnitude Display + Slider beside Horizontal Coordinate Switcher */}
          <div
            className={`hidden md:flex items-center gap-1.5 rounded-lg border px-2 py-0.5 shrink-0 ${
              theme === 'white'
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : theme === 'red'
                ? 'bg-[#100101] border-[#420C0C] text-[#DC2626]'
                : 'bg-[#0B1220] border-[#25334D] text-slate-300'
            }`}
            title="현재 시야각 기준 항성 및 DSO 한계등급 조절"
          >
            <span className="text-[11px] font-medium whitespace-nowrap">한계등급</span>
            <span
              className={`rounded-md border px-1.5 py-0.5 flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums whitespace-nowrap ${
                theme === 'white'
                  ? 'bg-sky-50 border-sky-200 text-sky-700'
                  : theme === 'red'
                  ? 'bg-[#200303] border-[#5A1212] text-[#FF3B3B]'
                  : 'bg-[#162235] border-[#2C3E5C] text-[#22D3EE]'
              }`}
            >
              <Star className="w-3 h-3 fill-current shrink-0" />
              <span>{magLimit.toFixed(1)}</span>
            </span>
            <span
              className={`rounded-md border px-1.5 py-0.5 flex items-center font-mono text-[11px] font-bold tabular-nums whitespace-nowrap ${
                theme === 'white'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : theme === 'red'
                  ? 'bg-[#200303] border-[#5A1212] text-[#EF4444]'
                  : 'bg-[#162235] border-[#2C3E5C] text-[#10B981]'
              }`}
            >
              DSO {layers.showDso ? dsoMagLimit.toFixed(1) : 'OFF'}
            </span>
            <div className="flex items-center gap-1.5 pl-1">
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
                className={`w-16 lg:w-20 h-1.5 cursor-pointer ${
                  theme === 'red' ? 'accent-red-600' : 'accent-cyan-500'
                }`}
              />
              <button
                type="button"
                onClick={() =>
                  setLayers((p) => ({ ...p, magOffset: 0, dsoMagOffset: 0 }))
                }
                title="클릭하여 한계 등급 보정 초기화 (0.0m)"
                className={`font-mono text-[10.5px] tabular-nums whitespace-nowrap w-10 text-right hover:opacity-100 transition-opacity ${
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
        </div>

        {/* Right: Icon-Only Session Plan, Challenge, URL Share, PNG Export, Sensor FOV PNG, Print */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setInspectorTab('session');
              setRightOpen((o) => (inspectorTab === 'session' ? !o : true));
            }}
            title={`관측 목록 (${sessionPlan.length})`}
            aria-label={`관측 목록 (${sessionPlan.length})`}
            className={`w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 ${
              rightOpen && inspectorTab === 'session' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setInspectorTab('challenge');
              setRightOpen((o) => (inspectorTab === 'challenge' ? !o : true));
            }}
            title="계절별 관측 투어 및 챌린지 트랙"
            aria-label="챌린지"
            className={`relative w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 ${
              rightOpen && inspectorTab === 'challenge' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {challenges.some((t) => t.activeOnChart) && (
              <span
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400"
                aria-hidden="true"
              />
            )}
          </button>

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

          {optics.showSensorBox && (
            <button
              type="button"
              onClick={() =>
                canvasHandleRef.current?.exportSensorFovPng(activeSensorEquipmentName)
              }
              title={`사진 화각 영역만 PNG 저장 (${activeSensorEquipmentName} · ${optics.sensorWidthDeg.toFixed(2)}° × ${optics.sensorHeightDeg.toFixed(2)}°)`}
              aria-label="사진 화각 PNG 저장"
              className={`w-7 h-7 sm:w-8 sm:h-7 border flex items-center justify-center transition-colors shrink-0 ${ui.buttonActive}`}
              style={{ borderRadius: '4px' }}
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

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
        </div>
      </header>

      {/* Main Full-Bleed Observatory Workspace with Overlay Side Drawers */}
      <main className="relative flex-1 min-h-0 overflow-hidden">
        {/* Full-Width Star Chart + Bottom Time Dock (never pushed/resized by side menus) */}
        <div className="w-full h-full flex flex-col min-w-0 min-h-0 overflow-hidden">
          <StarChartCanvas
            ref={canvasHandleRef}
            view={view}
            theme={theme}
            layers={layers}
            optics={optics}
            observer={observer}
            hips={hips}
            catalogs={catalogs}
            selected={selected}
            centerLocked={centerLocked}
            solarTrails={solarTrails}
            sessionIds={sessionIds}
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
            onChallengeChartPick={handleChallengeChartPick}
            onUndoChallengeCheckpoint={handleUndoChallengeCheckpoint}
          />
          <TimeControlBar
            theme={theme}
            observer={observer}
            onChangeObserver={handleChangeObserver}
          />
        </div>

        {/* Left Overlay Control Drawer (270px) */}
        <div
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
          />
        </div>

        {/* Left Edge Pull-Handle Tab */}
        <button
          type="button"
          onClick={() => setLeftOpen((o) => !o)}
          title={leftOpen ? '왼쪽 메뉴 접기' : '왼쪽 메뉴 펼치기'}
          aria-label={leftOpen ? '왼쪽 메뉴 접기' : '왼쪽 메뉴 펼치기'}
          className={`no-print absolute z-30 top-1/2 -translate-y-1/2 h-14 w-5 border border-l-0 flex items-center justify-center transition-[left,background-color] duration-200 ease-out shadow-md ${ui.panel} hover:opacity-90`}
          style={{
            left: leftOpen ? '270px' : '0px',
            borderTopRightRadius: '6px',
            borderBottomRightRadius: '6px',
          }}
        >
          {leftOpen ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Right Overlay Object Inspector / Session Drawer (270px, matches left drawer) */}
        <div
          className={`no-print absolute inset-y-0 right-0 z-30 w-[270px] transition-transform duration-200 ease-out shadow-2xl ${
            rightOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
        >
          {rightOpen && (
            <ObjectInspector
              selected={selected}
              centerLocked={centerLocked}
              solarTrails={solarTrails}
              activeTab={inspectorTab}
              theme={theme}
              observer={observer}
              optics={optics}
              catalogs={catalogs}
              sessionPlan={sessionPlan}
              tonightManualEntries={observingListsState.tonightEntries}
              observingLists={observingListsState.lists}
              tonightListId={observingListsState.tonightListId}
              challenges={challenges}
              onTabChange={setInspectorTab}
              onClose={() => setRightOpen(false)}
              onSelect={handleSelect}
              onToggleCenterLock={handleToggleCenterLock}
              onToggleSolarTrail={handleToggleSolarTrail}
              onClearSolarTrails={handleClearSolarTrails}
              onChangeView={handleChangeView}
              onChangeOptics={setOptics}
              onSetTonightList={handleSetTonightList}
              onCreateObservingList={handleCreateObservingList}
              onRenameObservingList={handleRenameObservingList}
              onDeleteObservingList={handleDeleteObservingList}
              onToggleSessionItem={handleToggleSessionItem}
              onToggleObserved={handleToggleObserved}
              onUpdateNotes={handleUpdateNotes}
              onAddRecommendedTonight={handleAddRecommendedTonight}
              onImportSkylist={handleImportSkylistSession}
              onExportSkylist={handleExportSkylistSession}
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
              onAddCenterChallengeCheckpoint={handleAddCenterChallengeCheckpoint}
              onToggleChallengeOnChart={handleToggleChallengeOnChart}
              onToggleChallengeCheckpoint={handleToggleChallengeCheckpoint}
              onUpdateChallengeCheckpointNote={handleUpdateChallengeCheckpointNote}
              onSelectChallengeCheckpoint={handleSelectChallengeCheckpoint}
              onFrameChallengeTrack={handleFrameChallengeTrack}
              onPrintChallengeCertificate={handlePrintChallengeCertificate}
              onSaveChallengeTrack={handleSaveChallengeTrack}
              onDeleteChallengeTrack={handleDeleteChallengeTrack}
              onResetBuiltInChallenge={handleResetBuiltInChallenge}
              onImportChallenges={handleImportChallenges}
            />
          )}
        </div>

        {/* Right Edge Pull-Handle Tab */}
        <button
          type="button"
          onClick={() => setRightOpen((o) => !o)}
          title={rightOpen ? '오른쪽 메뉴 접기' : '오른쪽 메뉴 펼치기'}
          aria-label={rightOpen ? '오른쪽 메뉴 접기' : '오른쪽 메뉴 펼치기'}
          className={`no-print absolute z-30 top-1/2 -translate-y-1/2 h-14 w-5 border border-r-0 flex items-center justify-center transition-[right,background-color] duration-200 ease-out shadow-md ${ui.panel} hover:opacity-90`}
          style={{
            right: rightOpen ? '270px' : '0px',
            borderTopLeftRadius: '6px',
            borderBottomLeftRadius: '6px',
          }}
        >
          {rightOpen ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
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
    </div>
  );
}
