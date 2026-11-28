import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Check,
  ChevronDown,
  Cloud,
  CloudAlert,
  CloudCheck,
  CloudFog,
  Compass,
  Crosshair,
  Download,
  Eye,
  FolderOpen,
  HardDrive,
  Image,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  LogOut,
  Map as MapIcon,
  MapPin,
  Minus,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import {
  CatalogSnapshot,
  GAIA_LIVE_MAX_FSZ,
  getVisibleUltraTileKeys,
  retryGaiaLiveFetch,
  searchGaiaCatalog,
  searchHipparcosCatalog,
  searchLoadedGaiaStars,
} from '../data/catalogLoader';
import {
  getSmartTelescopeMosaicMaxScale,
  isSmartTelescopeMosaicSupported,
  isSmartTelescopeRotatable,
  normalizeTelescopeOpticalType,
  SMART_TELESCOPE_PRESETS,
} from '../data/equipmentCatalog';
import {
  ChartViewState,
  Constellation,
  ConstellationNameStyle,
  ConstellationProjectionMode,
  DEFAULT_SENSOR_EXPORT_CAPTION,
  DeepSkyObject,
  DoubleStarSystem,
  DsoNameStyle,
  EquipmentCategory,
  EquipmentItem,
  EquipmentLockerState,
  HipsSettings,
  HipsSurveyId,
  LayerSettings,
  ObserverConfig,
  OpticsSettings,
  SavedObservingSite,
  SelectedItem,
  SensorExportCaptionConfig,
  SolarSystemBody,
  Star,
  StarNameStyle,
  ThemeMode,
  UiThemePresetId,
} from '../types/astronomy';
import {
  angularDistanceDeg,
  computeAtmosphericExtinctionMag,
  createProjectionParams,
  equatorialToHorizontal,
  formatCardinalLabel,
  getDsoLimitingMagnitude,
  getLimitingMagnitude,
  getLSTDeg,
  projectStereographic,
  RAD2DEG,
} from '../utils/astronomy';
import {
  BORTLE_SCALE,
  clampBortleClass,
  estimateSiteBortleClass,
  getBortleInfo,
} from '../utils/bortle';
import {
  clampUiFontSizeStep,
  getUiFontSizeMetrics,
  UI_FONT_OPTIONS,
  UI_FONT_SIZE_MAX_STEP,
  UI_FONT_SIZE_MIN_STEP,
  UiFontFamily,
} from '../utils/uiTypography';
import {
  cancelStarPackDownload,
  connectNoxchartFolder,
  disconnectNoxchartFolder,
  downloadStarCatalogTier,
  exportStarPackToFile,
  findLocalStarById,
  formatByteSize,
  getLocalStarCatalogState,
  getLocalStarsInFrame,
  getNextAvailableTier,
  importStarPackFiles,
  LocalStarCatalogState,
  pickAndImportStarPackFiles,
  removeStarCatalogTier,
  searchLocalStarCatalogs,
  setStarPackMirrorMode,
  STAR_CATALOG_TIERS,
  STAR_PACK_MIRROR_OPTIONS,
  StarPackMirrorMode,
  subscribeLocalStarCatalogs,
} from '../utils/localStarCatalogs';
import {
  formatCatalogCode,
  formatConstellationDisplayName,
  formatDsoChartLabel,
  formatObjectDisplayName,
  formatStarLabelByStyle,
  getBayerBaseSearchAliases,
  getBayerExpandedNames,
  getDsoSearchAliases,
  getExtraAliasesForKnownId,
  getSecondaryDesignations,
  normalizeCatalogToken,
  normalizeSuperscriptDigits,
} from '../utils/catalogNames';
import {
  downloadLayerSettingsFile,
  LayerSettingsBundle,
  parseLayerSettingsFromJson,
} from '../utils/layerStorage';
import {
  clampLat,
  clampLon,
  downloadObservingSitesFile,
  formatCoordsShort,
  parseObservingSitesFromJson,
} from '../utils/observingSites';
import { CloudSyncStatus } from '../utils/cloudSync';
import {
  clearMpcBrightAsteroids,
  clearMpcComets,
  getBuiltinCometCount,
  getMpcAsteroidSyncMeta,
  getMpcCometSyncMeta,
  getSolarSystemBodies,
  importMpcCometFileText,
  isCometNearSunWarning,
  isCometVisibleByFilter,
  MpcAsteroidSyncMeta,
  MpcCometSyncMeta,
  subscribeMpcAsteroids,
  subscribeMpcComets,
  syncMpcBrightAsteroids,
  syncMpcComets,
} from '../utils/solarSystem';
import { getUiTheme, UI_THEME_PRESETS } from '../utils/themeClasses';
import { EquipmentLockerPanel } from './EquipmentLockerPanel';

type SidebarTab = 'explore' | 'layers' | 'optics' | 'observer' | 'settings';
type ExploreCategory =
  | 'all'
  | 'star'
  | 'messier'
  | 'caldwell'
  | 'ngcic'
  | 'solar'
  | 'constellation';
type ExploreSortMode = 'default' | 'category' | 'constellation' | 'name' | 'mag' | 'alt';
type ExploreSortDir = 'asc' | 'desc';
type StarSubFilter = 'all' | 'named' | 'bayer' | 'viewport';

const GLOBAL_CATEGORY_INFO = (item: GlobalSearchItem): { rank: number; label: string } => {
  if (item.kind === 'planet') return { rank: 0, label: '태양계' };
  if (item.kind === 'constellation') return { rank: 1, label: '별자리' };
  if (item.kind === 'star') return { rank: 2, label: '항성' };
  if (item.kind === 'double') return { rank: 3, label: '이중성/다중성' };
  if (item.badge === '메시에') return { rank: 4, label: '메시에' };
  if (item.badge === '콜드웰') return { rank: 5, label: '콜드웰' };
  if (item.badge === 'NGC') return { rank: 6, label: 'NGC' };
  if (item.badge === 'IC') return { rank: 7, label: 'IC' };
  return { rank: 8, label: item.badge || '딥스카이' };
};

const STAR_CATEGORY_INFO = (star: Star, sourceBadge?: string): { rank: number; label: string } => {
  if (star.koName || star.name) return { rank: 0, label: '고유명 항성' };
  if (star.bayer) return { rank: 1, label: '바이어/플램스티드' };
  if (star.hip && !sourceBadge?.includes('Gaia')) return { rank: 2, label: 'HIP 항성' };
  if (star.gaiaId || sourceBadge?.includes('Gaia')) return { rank: 3, label: 'Gaia DR3' };
  return { rank: 4, label: sourceBadge || '항성' };
};

const SOLAR_GROUP_RANK: Record<string, number> = {
  star: 0,
  planet: 1,
  dwarf: 2,
  asteroid: 3,
  comet: 4,
  moon: 5,
};

type GlobalSearchItem =
  | { kind: 'planet'; key: string; score: number; mag: number; body: SolarSystemBody }
  | { kind: 'constellation'; key: string; score: number; mag: number; con: Constellation }
  | {
      kind: 'star';
      key: string;
      score: number;
      mag: number;
      star: Star;
      sourceBadge?: string;
      detail?: string;
    }
  | { kind: 'double'; key: string; score: number; mag: number; sys: DoubleStarSystem }
  | {
      kind: 'dso';
      key: string;
      score: number;
      mag: number;
      dso: DeepSkyObject;
      badge: string;
      primaryId: string;
      secondaryId?: string;
    };

function scoreSearchMatch(
  primaryFields: (string | undefined)[],
  secondaryFields: (string | undefined)[],
  q: string,
  qCompact: string
): number {
  if (!q || !qCompact) return 0;
  const qClean = normalizeSuperscriptDigits(q);
  const qCompactClean = normalizeSuperscriptDigits(qCompact);
  const qNorm = normalizeCatalogToken(qClean);
  let best = 0;
  for (const raw of primaryFields) {
    if (!raw) continue;
    const s = normalizeSuperscriptDigits(raw).toLowerCase();
    const sc = s.replace(/\s+/g, '');
    const sn = normalizeCatalogToken(raw);
    if (s === qClean || sc === qCompactClean || (qNorm && sn === qNorm)) return 120;
    if (s.startsWith(qClean) || sc.startsWith(qCompactClean) || (qNorm && sn.startsWith(qNorm))) {
      if (best < 90) best = 90;
    } else if (s.includes(qClean) || sc.includes(qCompactClean) || (qNorm && sn.includes(qNorm))) {
      if (best < 60) best = 60;
    }
  }
  if (best >= 90) return best;
  for (const raw of secondaryFields) {
    if (!raw) continue;
    const s = normalizeSuperscriptDigits(raw).toLowerCase();
    const sc = s.replace(/\s+/g, '');
    const sn = normalizeCatalogToken(raw);
    if (s === qClean || sc === qCompactClean || (qNorm && sn === qNorm)) {
      if (best < 100) best = 100;
    } else if (s.startsWith(qClean) || sc.startsWith(qCompactClean) || (qNorm && sn.startsWith(qNorm))) {
      if (best < 72) best = 72;
    } else if (s.includes(qClean) || sc.includes(qCompactClean) || (qNorm && sn.includes(qNorm))) {
      if (best < 42) best = 42;
    }
  }
  return best;
}

interface ControlSidebarProps {
  view: ChartViewState;
  theme: ThemeMode;
  layers: LayerSettings;
  optics: OpticsSettings;
  observer: ObserverConfig;
  hips: HipsSettings;
  catalogs: CatalogSnapshot;
  selected: SelectedItem | null;
  equipmentLocker: EquipmentLockerState;
  savedSites: SavedObservingSite[];
  sessionPlanCount: number;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
  onChangeLayers: (updater: (prev: LayerSettings) => LayerSettings) => void;
  onChangeOptics: (updater: (prev: OpticsSettings) => OpticsSettings) => void;
  onChangeObserver: (updater: (prev: ObserverConfig) => ObserverConfig) => void;
  onChangeHips: (updater: (prev: HipsSettings) => HipsSettings) => void;
  onSelect: (item: SelectedItem) => void;
  onSearchActiveChange: (active: boolean) => void;
  onAddOrUpdateEquipment: (item: EquipmentItem) => void;
  onDeleteEquipment: (id: string) => void | Promise<boolean>;
  onToggleActiveEquipment: (category: EquipmentCategory, id: string) => void;
  onSelectActiveEquipment: (category: EquipmentCategory, id: string | null) => void;
  onImportEquipmentLocker: (imported: EquipmentLockerState) => void;
  onOpenSiteMap: (focus?: SavedObservingSite | null) => void;
  onSaveSite: (site: SavedObservingSite) => void;
  onDeleteSite: (id: string) => void | Promise<boolean>;
  onImportSites: (
    sites: SavedObservingSite[]
  ) => { addedCount: number; updatedCount: number };
  onImportLayerSettings: (bundle: LayerSettingsBundle) => void;
  onResetLayerSettings: () => void;
  onChangeTheme: (theme: ThemeMode) => void;
  uiThemePreset: UiThemePresetId;
  onChangeUiThemePreset: (preset: UiThemePresetId) => void;
  redIntensity: number;
  onChangeRedIntensity: (val: number) => void;
  uiFontFamily: UiFontFamily;
  onChangeUiFontFamily: (family: UiFontFamily) => void;
  uiFontSizeStep: number;
  onChangeUiFontSizeStep: (step: number) => void;
  sidebarsPinned: boolean;
  onChangeSidebarsPinned: (pinned: boolean) => void;
  authUser: User | null;
  authReady: boolean;
  authBusy: boolean;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: number | null;
  syncError: string | null;
  authError: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onManualSync: () => void;
  onDismissAuthError: () => void;
  requestedTab?: { tab: SidebarTab; seq: number } | null;
}

function formatCompactRaDec(raDeg: number, decDeg: number): string {
  const normRa = ((raDeg % 360) + 360) % 360;
  const totalMin = Math.round((normRa / 15) * 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const decSign = decDeg < 0 ? '-' : '+';
  const decAbs = Math.round(Math.abs(decDeg));
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}m ${decSign}${String(decAbs).padStart(2, '0')}°`;
}

const SITE_PRESETS = [
  { name: '서울 (Seoul)', lat: 37.5665, lon: 126.978 },
  { name: '한우산 (팔각정)', lat: 35.3947, lon: 128.1928 },
  { name: '황매산 (미리내 공원)', lat: 35.4835, lon: 127.9718 },
  { name: '보현산 천문대', lat: 36.1647, lon: 128.9767 },
  { name: '소백산 천문대', lat: 36.9342, lon: 128.4575 },
  { name: '화천 조경철천문대', lat: 38.1211, lon: 127.4342 },
  { name: '제주 별빛누리공원', lat: 33.4439, lon: 126.5486 },
  { name: '하와이 마우나케아', lat: 19.8207, lon: -155.4681 },
  { name: '칠레 아타카마', lat: -24.6272, lon: -70.4042 },
];

const EXTINCTION_PRESETS = [
  { label: '고산', k: 0.15, desc: '고산·건조 맑은 하늘 (k=0.15)' },
  { label: '표준', k: 0.25, desc: '표준 맑은 밤하늘 (k=0.25)' },
  { label: '습윤', k: 0.4, desc: '평지·습도 높음 (k=0.40)' },
  { label: '연무', k: 0.6, desc: '연무·박무·도심 (k=0.60)' },
];

const AFOV_PRESETS = [50, 68, 82, 100];

const HIPS_SURVEY_OPTIONS: { id: HipsSurveyId; label: string }[] = [
  { id: 'dss2', label: 'DSS2 광학' },
  { id: '2mass', label: '2MASS 적외선' },
  { id: 'allwise', label: 'AllWISE' },
];

const SIDEBAR_OPEN_SECTIONS_STORAGE_KEY = 'noxchart_sidebar_open_sections_v1';

function loadSavedOpenSections(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_OPEN_SECTIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const res: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === 'boolean') res[k] = v;
        }
        return res;
      }
    }
  } catch {
    // Ignore storage parse failure
  }
  return {};
}

export function ControlSidebar({
  view,
  theme,
  layers,
  optics,
  observer,
  hips,
  catalogs,
  selected,
  equipmentLocker,
  savedSites,
  sessionPlanCount,
  onChangeView,
  onChangeLayers,
  onChangeOptics,
  onChangeObserver,
  onChangeHips,
  onSelect,
  onSearchActiveChange,
  onAddOrUpdateEquipment,
  onDeleteEquipment,
  onToggleActiveEquipment,
  onSelectActiveEquipment,
  onImportEquipmentLocker,
  onOpenSiteMap,
  onSaveSite,
  onDeleteSite,
  onImportSites,
  onImportLayerSettings,
  onResetLayerSettings,
  uiThemePreset,
  onChangeUiThemePreset,
  redIntensity,
  onChangeRedIntensity,
  uiFontFamily,
  onChangeUiFontFamily,
  uiFontSizeStep,
  onChangeUiFontSizeStep,
  sidebarsPinned,
  onChangeSidebarsPinned,
  authUser,
  authReady,
  authBusy,
  syncStatus,
  lastSyncedAt,
  syncError,
  authError,
  onLogin,
  onLogout,
  onManualSync,
  onDismissAuthError,
  requestedTab,
}: ControlSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('explore');
  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab.tab);
    }
  }, [requestedTab]);
  const [exploreCategory, setExploreCategory] = useState<ExploreCategory>('all');
  const [themePresetDropdownOpen, setThemePresetDropdownOpen] = useState(false);
  const [starFilter, setStarFilter] = useState<StarSubFilter>('all');
  const [exploreSort, setExploreSort] = useState<ExploreSortMode>('default');
  const [exploreSortDir, setExploreSortDir] = useState<ExploreSortDir>('asc');
  const [ngcIcFilter, setNgcIcFilter] = useState<'all' | 'ngc' | 'ic'>('all');
  const [solarGroupFilter, setSolarGroupFilter] = useState<
    'all' | 'planet' | 'dwarf' | 'asteroid' | 'comet' | 'moon'
  >('all');

  const handleSelectExploreSort = (mode: ExploreSortMode) => {
    if (exploreSort === mode) {
      if (mode !== 'default') {
        setExploreSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      }
      return;
    }
    setExploreSort(mode);
    setExploreSortDir(mode === 'alt' ? 'desc' : 'asc');
  };
  const [sensorFrameMode, setSensorFrameMode] = useState<'combo' | 'smart'>(() => {
    const activeCamId = equipmentLocker.activeIds.camera;
    const activeCam = activeCamId
      ? equipmentLocker.items.find((i) => i.id === activeCamId && i.category === 'camera')
      : null;
    return activeCam?.isSmartTelescope ? 'smart' : 'combo';
  });
  const [presetMosaicOverrides, setPresetMosaicOverrides] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('noxchart_smart_mosaic_presets_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, boolean>;
        }
      }
    } catch {
      // Ignore storage read failure
    }
    return {};
  });
  const [mosaicScaleLinked, setMosaicScaleLinked] = useState(true);
  const [query, setQuery] = useState('');
  const cleanQuery = query.replace(/[\u200B-\u200D\uFEFF\u3164]/g, '').trim();
  const [remoteHipHits, setRemoteHipHits] = useState<Star[]>([]);
  const [remoteGaiaHits, setRemoteGaiaHits] = useState<Star[]>([]);
  const [gaiaSearching, setGaiaSearching] = useState(false);
  const [viewportResultLimit, setViewportResultLimit] = useState(150);
  const [activeConAbbr, setActiveConAbbr] = useState<string | null>(null);
  const [quickSaveOpen, setQuickSaveOpen] = useState(false);
  const [quickSiteName, setQuickSiteName] = useState('');
  const [quickSiteNote, setQuickSiteNote] = useState('');
  const [siteStatusMsg, setSiteStatusMsg] = useState<string | null>(null);
  const [layerStatusMsg, setLayerStatusMsg] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(loadSavedOpenSections);
  const exploreListRef = useRef<HTMLDivElement>(null);
  const siteFileInputRef = useRef<HTMLInputElement>(null);
  const layerFileInputRef = useRef<HTMLInputElement>(null);
  const ui = getUiTheme(theme);
  const nameLang = layers.starLabelLanguage ?? 'ko';

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_OPEN_SECTIONS_STORAGE_KEY, JSON.stringify(openSections));
    } catch {
      // Ignore storage write failure
    }
  }, [openSections]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'noxchart_smart_mosaic_presets_v1',
        JSON.stringify(presetMosaicOverrides)
      );
    } catch {
      // Ignore storage write failure
    }
  }, [presetMosaicOverrides]);

  // Live full-sky Hipparcos (118,216 stars) fallback lookup ONLY when not already found in built-in / downloaded local catalogs
  useEffect(() => {
    const trimmed = query.trim();
    const compact = trimmed.replace(/\s+/g, '').toLowerCase();
    const hipMatch = /^(?:hip)?(\d{2,6})$/.exec(compact);
    const isHipQuery =
      (exploreCategory === 'all' || exploreCategory === 'star') && Boolean(hipMatch);
    if (!isHipQuery || !hipMatch) {
      setRemoteHipHits([]);
      return;
    }

    const hipNum = Number(hipMatch[1]);
    const hasExactBuiltInOrLocal =
      catalogs.brightStars.some((s) => s.hip === hipNum) ||
      catalogs.deepStars.some((s) => s.hip === hipNum) ||
      Boolean(findLocalStarById(`HIP ${hipNum}`));
    if (hasExactBuiltInOrLocal) {
      setRemoteHipHits([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchHipparcosCatalog(trimmed).then((hits) => {
        if (!cancelled) setRemoteHipHits(hits);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [exploreCategory, query, catalogs.brightStars, catalogs.deepStars, catalogs.localStarRevision]);

  // Live server-cache + Gaia DR3 TAP fallback lookup ONLY when not found in downloaded local star catalogs
  useEffect(() => {
    const trimmed = query.trim();
    const compact = trimmed.replace(/\s+/g, '').toLowerCase();
    const isGaiaQuery =
      (exploreCategory === 'all' || exploreCategory === 'star') &&
      (/^gaia(?:dr3)?\d{4,20}$/i.test(compact) || /^\d{7,20}$/.test(compact));
    if (!isGaiaQuery) {
      setRemoteGaiaHits([]);
      setGaiaSearching(false);
      return;
    }

    // Check downloaded local star catalogs first (0ms) — skip online Gaia DR3 lookup if found locally
    if (catalogs.localStarCount > 0) {
      const exactLocal = findLocalStarById(trimmed);
      if (exactLocal) {
        setRemoteGaiaHits([]);
        setGaiaSearching(false);
        return;
      }
      const localMatches = searchLocalStarCatalogs(
        trimmed,
        { raHours: view.ra, decDeg: view.dec },
        5
      );
      if (localMatches.some((h) => h.score >= 112)) {
        setRemoteGaiaHits([]);
        setGaiaSearching(false);
        return;
      }
    }

    let cancelled = false;
    setGaiaSearching(true);
    const timer = window.setTimeout(() => {
      void searchGaiaCatalog(trimmed)
        .then((hits) => {
          if (!cancelled) {
            setRemoteGaiaHits(hits);
            setGaiaSearching(false);
          }
        })
        .catch(() => {
          if (!cancelled) setGaiaSearching(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [exploreCategory, query, catalogs.localStarCount, catalogs.localStarRevision]);

  useEffect(() => {
    setViewportResultLimit(150);
    if (exploreListRef.current) {
      exploreListRef.current.scrollTop = 0;
    }
  }, [query, exploreCategory, starFilter, exploreSort, exploreSortDir]);

  const isSectionOpen = (id: string) => Boolean(openSections[id]);
  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const openSection = (id: string) =>
    setOpenSections((prev) => (prev[id] ? prev : { ...prev, [id]: true }));

  const showSiteNotice = (msg: string) => {
    setSiteStatusMsg(msg);
    window.setTimeout(() => {
      setSiteStatusMsg((cur) => (cur === msg ? null : cur));
    }, 3600);
  };

  const showLayerNotice = (msg: string) => {
    setLayerStatusMsg(msg);
    window.setTimeout(() => {
      setLayerStatusMsg((cur) => (cur === msg ? null : cur));
    }, 3600);
  };

  const obsTimeMs = observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);

  const conLookupByAbbr = useMemo(() => {
    const map = new Map<string, { koName: string; name: string; abbr: string }>();
    for (const c of catalogs.constellations) {
      map.set(c.abbr.toLowerCase(), { koName: c.koName, name: c.name, abbr: c.abbr });
    }
    return map;
  }, [catalogs.constellations]);

  const getConstellationSortInfo = (
    abbr?: string
  ): { hasCon: boolean; sortKey: string; label: string } => {
    const trimmed = abbr?.trim();
    if (!trimmed) return { hasCon: false, sortKey: '', label: '별자리 미지정' };
    const found = conLookupByAbbr.get(trimmed.toLowerCase());
    if (found) {
      const display = formatObjectDisplayName(found.koName, found.name, found.abbr, nameLang);
      return {
        hasCon: true,
        sortKey: display,
        label: `${display} (${found.abbr})`,
      };
    }
    return { hasCon: true, sortKey: trimmed, label: trimmed };
  };

  const compareConstellations = (
    abbrA: string | undefined,
    abbrB: string | undefined,
    dir: number
  ): number => {
    const a = getConstellationSortInfo(abbrA);
    const b = getConstellationSortInfo(abbrB);
    if (a.hasCon !== b.hasCon) return a.hasCon ? -1 : 1;
    if (!a.hasCon) return 0;
    return a.sortKey.localeCompare(b.sortKey, 'ko') * dir;
  };

  const getGlobalItemConAbbr = (item: GlobalSearchItem): string | undefined => {
    if (item.kind === 'constellation') return item.con.abbr;
    if (item.kind === 'star') return item.star.con;
    if (item.kind === 'double') return item.sys.con;
    if (item.kind === 'dso') return item.dso.con;
    return undefined;
  };

  const messierList = useMemo(() => {
    const map = new Map<number, DeepSkyObject>();
    for (const d of catalogs.dsosBright) {
      const m = /^M(\d+)$/.exec(d.id);
      if (m) {
        const num = Number(m[1]);
        const prev = map.get(num);
        const mergedAlt = d.altId || prev?.altId;
        map.set(num, {
          ...d,
          name: d.name || prev?.name,
          koName: d.koName || prev?.koName,
          altId: mergedAlt ? formatCatalogCode(mergedAlt) : undefined,
        });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, item]) => item);
  }, [catalogs.dsosBright]);

  const filteredMessier = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/\s+/g, '');
    const scored: { item: (typeof messierList)[number]; score: number; num: number }[] = [];
    for (const d of messierList) {
      const mNum = Number(d.id.slice(1)) || 999;
      if (!q) {
        scored.push({ item: d, score: 100, num: mNum });
        continue;
      }
      const aliases = getDsoSearchAliases(d);
      const score = scoreSearchMatch(
        [
          ...aliases,
          `messier ${mNum}`,
          `메시에 ${mNum}`,
          d.koName,
          d.name,
        ],
        [d.con, d.type],
        q,
        qCompact
      );
      if (score > 0) scored.push({ item: d, score, num: mNum });
    }
    const dir = exploreSortDir === 'asc' ? 1 : -1;
    scored.sort((a, b) => {
      if (exploreSort === 'category') {
        const cmp = (a.item.type || '').localeCompare(b.item.type || '', 'ko');
        if (cmp !== 0) return cmp * dir;
        return a.num - b.num;
      }
      if (exploreSort === 'constellation') {
        const cmp = compareConstellations(a.item.con, b.item.con, dir);
        if (cmp !== 0) return cmp;
        return a.num - b.num;
      }
      if (exploreSort === 'name') {
        const na = formatObjectDisplayName(a.item.koName, a.item.name, a.item.id, nameLang);
        const nb = formatObjectDisplayName(b.item.koName, b.item.name, b.item.id, nameLang);
        const cmp = na.localeCompare(nb, 'ko', { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp * dir;
        return a.num - b.num;
      }
      if (exploreSort === 'mag') {
        const cmp = (a.item.mag ?? 99) - (b.item.mag ?? 99);
        if (cmp !== 0) return cmp * dir;
        return a.num - b.num;
      }
      if (exploreSort === 'alt') {
        const altA = equatorialToHorizontal(a.item.ra, a.item.dec, lstDeg, observer.lat).altDeg;
        const altB = equatorialToHorizontal(b.item.ra, b.item.dec, lstDeg, observer.lat).altDeg;
        const cmp = altA - altB;
        if (cmp !== 0) return cmp * dir;
        return a.num - b.num;
      }
      return b.score - a.score || a.num - b.num;
    });
    return scored.map((s) => s.item);
  }, [messierList, query, exploreSort, exploreSortDir, conLookupByAbbr, lstDeg, observer.lat, nameLang]);

  const filteredCaldwell = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/\s+/g, '');
    const scored: { item: (typeof catalogs.caldwell)[number]; score: number }[] = [];
    for (const c of catalogs.caldwell) {
      if (!q) {
        scored.push({ item: c, score: 100 });
        continue;
      }
      const aliases = getDsoSearchAliases(c, c.caldwellId);
      const score = scoreSearchMatch(
        [
          ...aliases,
          `caldwell ${c.caldwellNumber}`,
          `콜드웰 ${c.caldwellNumber}`,
          c.koName,
          c.name,
        ],
        [c.con, c.type],
        q,
        qCompact
      );
      if (score > 0) scored.push({ item: c, score });
    }
    const dir = exploreSortDir === 'asc' ? 1 : -1;
    scored.sort((a, b) => {
      if (exploreSort === 'category') {
        const cmp = (a.item.type || '').localeCompare(b.item.type || '', 'ko');
        if (cmp !== 0) return cmp * dir;
        return a.item.caldwellNumber - b.item.caldwellNumber;
      }
      if (exploreSort === 'constellation') {
        const cmp = compareConstellations(a.item.con, b.item.con, dir);
        if (cmp !== 0) return cmp;
        return a.item.caldwellNumber - b.item.caldwellNumber;
      }
      if (exploreSort === 'name') {
        const na = formatObjectDisplayName(a.item.koName, a.item.name, a.item.caldwellId, nameLang);
        const nb = formatObjectDisplayName(b.item.koName, b.item.name, b.item.caldwellId, nameLang);
        const cmp = na.localeCompare(nb, 'ko', { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp * dir;
        return a.item.caldwellNumber - b.item.caldwellNumber;
      }
      if (exploreSort === 'mag') {
        const cmp = (a.item.mag ?? 99) - (b.item.mag ?? 99);
        if (cmp !== 0) return cmp * dir;
        return a.item.caldwellNumber - b.item.caldwellNumber;
      }
      if (exploreSort === 'alt') {
        const altA = equatorialToHorizontal(a.item.ra, a.item.dec, lstDeg, observer.lat).altDeg;
        const altB = equatorialToHorizontal(b.item.ra, b.item.dec, lstDeg, observer.lat).altDeg;
        const cmp = altA - altB;
        if (cmp !== 0) return cmp * dir;
        return a.item.caldwellNumber - b.item.caldwellNumber;
      }
      return b.score - a.score || a.item.caldwellNumber - b.item.caldwellNumber;
    });
    return scored.map((s) => s.item);
  }, [catalogs.caldwell, query, exploreSort, exploreSortDir, conLookupByAbbr, lstDeg, observer.lat, nameLang]);

  const ngcIcList = useMemo(() => {
    if (exploreCategory !== 'ngcic') return [];
    const byKey = new Map<
      string,
      {
        key: string;
        catalog: 'ngc' | 'ic';
        displayId: string;
        crossId?: string;
        dso: DeepSkyObject;
      }
    >();

    const extractNgcIc = (raw?: string): { key: string; catalog: 'ngc' | 'ic'; displayId: string } | null => {
      if (!raw) return null;
      const m = /^(NGC|IC)\s*[-_]?\s*0*(\d+[A-Z]?)$/i.exec(raw.trim());
      if (!m) return null;
      const prefix = m[1].toUpperCase();
      const num = m[2].toUpperCase();
      return {
        key: `${prefix}${num}`,
        catalog: prefix === 'NGC' ? 'ngc' : 'ic',
        displayId: `${prefix} ${num}`,
      };
    };

    const mergeCrossId = (existing?: string, incoming?: string): string | undefined => {
      if (!incoming) return existing;
      if (!existing) return incoming;
      const parts = existing.split(' · ').map((p) => p.trim());
      const incomingNorm = normalizeCatalogToken(incoming);
      if (parts.some((p) => normalizeCatalogToken(p) === incomingNorm)) return existing;
      return `${existing} · ${incoming}`;
    };

    const upsertByInfo = (
      info: { key: string; catalog: 'ngc' | 'ic'; displayId: string },
      dso: DeepSkyObject,
      crossId?: string
    ) => {
      const prev = byKey.get(info.key);
      if (!prev) {
        byKey.set(info.key, {
          key: info.key,
          catalog: info.catalog,
          displayId: info.displayId,
          crossId,
          dso,
        });
      } else {
        byKey.set(info.key, {
          ...prev,
          crossId: mergeCrossId(prev.crossId, crossId),
          dso: {
            ...prev.dso,
            name: prev.dso.name || dso.name,
            koName: prev.dso.koName || dso.koName,
            altId: prev.dso.altId || dso.altId,
          },
        });
      }
    };

    const addEntry = (dso: DeepSkyObject, preferredCrossId?: string) => {
      const fromId = extractNgcIc(dso.id);
      const fromAlt = !fromId ? extractNgcIc(dso.altId) : null;
      const info = fromId || fromAlt;
      if (info) {
        const crossId =
          preferredCrossId ??
          (fromId ? dso.altId : dso.id !== info.displayId ? dso.id : undefined);
        upsertByInfo(info, dso, crossId ? formatCatalogCode(crossId) : undefined);
      }
      if (preferredCrossId) {
        for (const extra of getExtraAliasesForKnownId(preferredCrossId, dso.id)) {
          const extraInfo = extractNgcIc(extra);
          if (extraInfo) {
            upsertByInfo(extraInfo, dso, formatCatalogCode(preferredCrossId));
          }
        }
      }
    };

    for (const d of messierList) addEntry(d, d.id);
    for (const c of catalogs.caldwell) addEntry(c, c.caldwellId);
    for (const d of catalogs.dsosBright) addEntry(d);
    for (const d of catalogs.dsosDeep) addEntry(d);

    return Array.from(byKey.values()).sort((a, b) => a.dso.mag - b.dso.mag);
  }, [exploreCategory, messierList, catalogs.caldwell, catalogs.dsosBright, catalogs.dsosDeep]);

  const filteredNgcIc = useMemo(() => {
    if (exploreCategory !== 'ngcic') return { items: [], totalMatches: 0 };
    const pool =
      ngcIcFilter === 'all'
        ? ngcIcList
        : ngcIcList.filter((item) => item.catalog === ngcIcFilter);

    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/\s+/g, '');
    const scored: { item: (typeof pool)[number]; score: number }[] = [];
    for (const item of pool) {
      if (!q) {
        scored.push({ item, score: 100 });
        continue;
      }
      const numOnly = item.key.replace(/^(NGC|IC)/, '');
      const crossParts = item.crossId ? item.crossId.split(' · ') : [];
      const score = scoreSearchMatch(
        [item.displayId, item.key, numOnly, ...crossParts, item.dso.koName, item.dso.name],
        [item.dso.con, item.dso.type],
        q,
        qCompact
      );
      if (score > 0) {
        scored.push({ item, score });
      }
    }
    const dir = exploreSortDir === 'asc' ? 1 : -1;
    scored.sort((a, b) => {
      if (exploreSort === 'category') {
        const cmpCat = a.item.catalog.localeCompare(b.item.catalog, 'en');
        if (cmpCat !== 0) return cmpCat * dir;
        const cmpType = (a.item.dso.type || '').localeCompare(b.item.dso.type || '', 'ko');
        if (cmpType !== 0) return cmpType * dir;
        return a.item.dso.mag - b.item.dso.mag;
      }
      if (exploreSort === 'constellation') {
        const cmp = compareConstellations(a.item.dso.con, b.item.dso.con, dir);
        if (cmp !== 0) return cmp;
        return a.item.dso.mag - b.item.dso.mag;
      }
      if (exploreSort === 'name') {
        const na = formatObjectDisplayName(a.item.dso.koName, a.item.dso.name, a.item.displayId, nameLang);
        const nb = formatObjectDisplayName(b.item.dso.koName, b.item.dso.name, b.item.displayId, nameLang);
        const cmp = na.localeCompare(nb, 'ko', { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp * dir;
        return a.item.displayId.localeCompare(b.item.displayId, 'en', { numeric: true });
      }
      if (exploreSort === 'mag') {
        const cmp = (a.item.dso.mag ?? 99) - (b.item.dso.mag ?? 99);
        if (cmp !== 0) return cmp * dir;
        return a.item.displayId.localeCompare(b.item.displayId, 'en', { numeric: true });
      }
      if (exploreSort === 'alt') {
        const altA = equatorialToHorizontal(a.item.dso.ra, a.item.dso.dec, lstDeg, observer.lat).altDeg;
        const altB = equatorialToHorizontal(b.item.dso.ra, b.item.dso.dec, lstDeg, observer.lat).altDeg;
        const cmp = altA - altB;
        if (cmp !== 0) return cmp * dir;
        return a.item.dso.mag - b.item.dso.mag;
      }
      return b.score - a.score || a.item.dso.mag - b.item.dso.mag;
    });
    return {
      items: scored.slice(0, 100).map((s) => s.item),
      totalMatches: scored.length,
    };
  }, [exploreCategory, ngcIcList, ngcIcFilter, query, exploreSort, exploreSortDir, conLookupByAbbr, lstDeg, observer.lat, nameLang]);

  const [mpcRev, setMpcRev] = useState(0);
  const [mpcMeta, setMpcMeta] = useState<MpcAsteroidSyncMeta | null>(() => getMpcAsteroidSyncMeta());
  const [mpcSyncing, setMpcSyncing] = useState(false);
  const [mpcStatusMsg, setMpcStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const [cometMeta, setCometMeta] = useState<MpcCometSyncMeta | null>(() => getMpcCometSyncMeta());
  const [cometSyncing, setCometSyncing] = useState(false);
  const [cometStatusMsg, setCometStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const cometFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubAst = subscribeMpcAsteroids(() => {
      setMpcMeta(getMpcAsteroidSyncMeta());
      setMpcRev((r) => r + 1);
    });
    const unsubCom = subscribeMpcComets(() => {
      setCometMeta(getMpcCometSyncMeta());
      setMpcRev((r) => r + 1);
    });
    return () => {
      unsubAst();
      unsubCom();
    };
  }, []);

  const handleSyncMpcAsteroids = async () => {
    if (mpcSyncing) return;
    setMpcSyncing(true);
    setMpcStatusMsg(null);
    try {
      const meta = await syncMpcBrightAsteroids(true);
      setMpcMeta(meta);
      setMpcStatusMsg({
        text: `갱신 완료: 기존 ${meta.updatedExistingCount}개 갱신 · 신규 ${meta.addedCount}개 추가`,
      });
    } catch (err) {
      setMpcStatusMsg({
        text: err instanceof Error ? err.message : 'MPC 소행성 목록 갱신에 실패했습니다.',
        isError: true,
      });
    } finally {
      setMpcSyncing(false);
    }
  };

  const handleResetMpcAsteroids = () => {
    clearMpcBrightAsteroids();
    setMpcMeta(null);
    setMpcStatusMsg({ text: '기본 내장 소행성 목록으로 복원했습니다.' });
  };

  const handleSyncMpcComets = async () => {
    if (cometSyncing) return;
    setCometSyncing(true);
    setCometStatusMsg(null);
    try {
      const meta = await syncMpcComets(true);
      setCometMeta(meta);
      setCometStatusMsg({
        text: `최신 혜성 ${meta.totalCount}개의 궤도 요소를 불러왔습니다.`,
      });
    } catch (err) {
      setCometStatusMsg({
        text: err instanceof Error ? err.message : 'MPC 혜성 목록 갱신에 실패했습니다.',
        isError: true,
      });
    } finally {
      setCometSyncing(false);
    }
  };

  const handleImportCometFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setCometStatusMsg({
        text: '파일 크기가 12MB를 초과합니다. Soft00Cmt.txt 또는 CometEls.txt 파일을 사용해 주세요.',
        isError: true,
      });
      return;
    }
    setCometStatusMsg(null);
    try {
      const text = await file.text();
      const meta = importMpcCometFileText(text, file.name);
      setCometMeta(meta);
      setCometStatusMsg({
        text: `${file.name}에서 혜성 ${meta.totalCount}개를 불러왔습니다.`,
      });
    } catch (err) {
      setCometStatusMsg({
        text: err instanceof Error ? err.message : '혜성 궤도 파일을 불러오지 못했습니다.',
        isError: true,
      });
    }
  };

  const handleResetMpcComets = () => {
    clearMpcComets();
    setCometMeta(null);
    setCometStatusMsg({ text: `기본 내장 주요 혜성(${getBuiltinCometCount()}개)으로 복원했습니다.` });
  };

  // Stellarium-style tiered local star catalog manager (문서/noxchart + IndexedDB)
  const [localStarState, setLocalStarState] = useState<LocalStarCatalogState>(() =>
    getLocalStarCatalogState()
  );
  const [starPackNotice, setStarPackNotice] = useState<{ text: string; isError?: boolean } | null>(
    null
  );
  const starPackFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeLocalStarCatalogs(() => {
      setLocalStarState(getLocalStarCatalogState());
    });
  }, []);

  const nextStarTier = useMemo(() => {
    void localStarState.revision;
    return getNextAvailableTier();
  }, [localStarState.revision]);

  const handleConnectNoxchartFolder = async () => {
    setStarPackNotice(null);
    const res = await connectNoxchartFolder();
    setStarPackNotice({ text: res.message, isError: !res.ok });
  };

  const handleDisconnectNoxchartFolder = async () => {
    await disconnectNoxchartFolder();
    setStarPackNotice({
      text: '로컬 폴더 연결을 해제했습니다. 내려받은 목록은 브라우저 영구 저장소에 유지됩니다.',
    });
  };

  const handleDownloadStarTier = async (tierNum: number) => {
    setStarPackNotice(null);
    const res = await downloadStarCatalogTier(tierNum);
    setStarPackNotice({
      text: res.message,
      isError: !res.ok && !res.cancelled,
    });
  };

  const applyImportedStarPackNotice = (res: {
    importedTiers: number[];
    totalStars: number;
    failedCount: number;
  }) => {
    if (res.importedTiers.length > 0) {
      setStarPackNotice({
        text: `별 목록 ${res.importedTiers.length}개 (${res.totalStars.toLocaleString()}개 항성) 불러오기 완료`,
      });
    } else {
      setStarPackNotice({
        text: '올바른 NoxChart 별 목록(.noxstars) 파일이 아닙니다.',
        isError: true,
      });
    }
  };

  const handleOpenStarPackPicker = async () => {
    setStarPackNotice(null);
    const picked = await pickAndImportStarPackFiles();
    if (picked.status === 'imported') {
      applyImportedStarPackNotice(picked);
      return;
    }
    if (picked.status === 'fallback') {
      starPackFileInputRef.current?.click();
    }
  };

  const handleImportStarPackFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setStarPackNotice(null);
    const res = await importStarPackFiles(files);
    e.target.value = '';
    applyImportedStarPackNotice(res);
  };

  const handleExportStarPack = async (tierNum: number) => {
    const ok = await exportStarPackToFile(tierNum);
    if (ok) {
      setStarPackNotice({
        text: `${tierNum}단계 별 목록(.noxstars) 파일을 내려받았습니다. 문서/noxchart 폴더에 보관해 두세요.`,
      });
    }
  };

  const handleRemoveStarPack = async (tierNum: number) => {
    await removeStarCatalogTier(tierNum);
    setStarPackNotice({ text: `${tierNum}단계 별 목록을 삭제했습니다.` });
  };

  const solarBodies = useMemo(() => {
    void mpcRev;
    return getSolarSystemBodies(obsTimeMs);
  }, [obsTimeMs, mpcRev]);

  const cometFilterCounts = useMemo(() => {
    let total = 0;
    let visible = 0;
    const needAlt = layers.cometHideBelowHorizon ?? false;
    for (const b of solarBodies) {
      if (b.group !== 'comet') continue;
      total++;
      const altDeg = needAlt
        ? equatorialToHorizontal(b.ra, b.dec, lstDeg, observer.lat).altDeg
        : undefined;
      if (isCometVisibleByFilter(b, layers, altDeg)) {
        visible++;
      }
    }
    return { total, visible };
  }, [
    solarBodies,
    layers.cometObservableOnly,
    layers.cometMaxMag,
    layers.cometHideBelowHorizon,
    layers.cometHideNearSun,
    lstDeg,
    observer.lat,
  ]);

  const filteredSolar = useMemo(() => {
    const q = query.trim().toLowerCase();
    const needCometAlt = layers.cometHideBelowHorizon ?? false;
    const matched = solarBodies.filter((b) => {
      if (solarGroupFilter === 'planet' && b.group !== 'planet' && b.group !== 'star') {
        return false;
      }
      if (
        solarGroupFilter !== 'all' &&
        solarGroupFilter !== 'planet' &&
        b.group !== solarGroupFilter
      ) {
        return false;
      }
      if (b.group === 'comet') {
        const altDeg = needCometAlt
          ? equatorialToHorizontal(b.ra, b.dec, lstDeg, observer.lat).altDeg
          : undefined;
        if (!isCometVisibleByFilter(b, layers, altDeg)) {
          return false;
        }
      }
      if (!q) return true;
      return `${b.id} ${b.name} ${b.koName} ${b.category}`.toLowerCase().includes(q);
    });
    const dir = exploreSortDir === 'asc' ? 1 : -1;
    if (exploreSort === 'default') {
      if (solarGroupFilter === 'asteroid' || solarGroupFilter === 'comet') {
        return [...matched].sort((a, b) => a.mag - b.mag);
      }
      return matched;
    }
    return [...matched].sort((a, b) => {
      if (exploreSort === 'category') {
        const ra = SOLAR_GROUP_RANK[a.group] ?? 9;
        const rb = SOLAR_GROUP_RANK[b.group] ?? 9;
        if (ra !== rb) return (ra - rb) * dir;
        return a.mag - b.mag;
      }
      if (exploreSort === 'constellation') {
        return (a.ra - b.ra) * dir;
      }
      if (exploreSort === 'name') {
        const na = formatObjectDisplayName(a.koName, a.name, a.id, nameLang);
        const nb = formatObjectDisplayName(b.koName, b.name, b.id, nameLang);
        return na.localeCompare(nb, 'ko', { numeric: true }) * dir;
      }
      if (exploreSort === 'mag') {
        return (a.mag - b.mag) * dir;
      }
      const altA = equatorialToHorizontal(a.ra, a.dec, lstDeg, observer.lat).altDeg;
      const altB = equatorialToHorizontal(b.ra, b.dec, lstDeg, observer.lat).altDeg;
      return (altA - altB) * dir;
    });
  }, [
    solarBodies,
    query,
    solarGroupFilter,
    exploreSort,
    exploreSortDir,
    lstDeg,
    observer.lat,
    layers.cometObservableOnly,
    layers.cometMaxMag,
    layers.cometHideBelowHorizon,
    layers.cometHideNearSun,
    nameLang,
  ]);

  const sortedConstellations = useMemo(
    () =>
      [...catalogs.constellations].sort((a, b) =>
        formatObjectDisplayName(a.koName, a.name, a.abbr, nameLang).localeCompare(
          formatObjectDisplayName(b.koName, b.name, b.abbr, nameLang),
          'ko'
        )
      ),
    [catalogs.constellations, nameLang]
  );

  const filteredConstellations = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? sortedConstellations
      : sortedConstellations.filter((c) =>
          `${c.abbr} ${c.name} ${c.koName}`.toLowerCase().includes(q)
        );
    const dir = exploreSortDir === 'asc' ? 1 : -1;
    if (exploreSort === 'default') return matched;
    return [...matched].sort((a, b) => {
      if (exploreSort === 'name' || exploreSort === 'constellation') {
        return (
          formatObjectDisplayName(a.koName, a.name, a.abbr, nameLang).localeCompare(
            formatObjectDisplayName(b.koName, b.name, b.abbr, nameLang),
            'ko'
          ) * dir
        );
      }
      if (exploreSort === 'category') {
        return (a.ra - b.ra) * dir;
      }
      if (exploreSort === 'alt') {
        const altA = equatorialToHorizontal(a.ra, a.dec, lstDeg, observer.lat).altDeg;
        const altB = equatorialToHorizontal(b.ra, b.dec, lstDeg, observer.lat).altDeg;
        return (altA - altB) * dir;
      }
      return a.abbr.localeCompare(b.abbr, 'en') * dir;
    });
  }, [sortedConstellations, query, exploreSort, exploreSortDir, lstDeg, observer.lat, nameLang]);

  const allSearchResults = useMemo(() => {
    if (exploreCategory !== 'all') {
      return {
        items: [] as GlobalSearchItem[],
        totalMatches: 0,
        isViewportMode: false,
        viewportMagLimit: 0,
      };
    }
    const q = cleanQuery.toLowerCase();
    const qCompact = q.replace(/\s+/g, '');

    if (!q || !qCompact) {
      return {
        items: [] as GlobalSearchItem[],
        totalMatches: 0,
        isViewportMode: false,
        viewportMagLimit: 0,
      };
    }

    // Special Mode: '현재창' (or '현재화면' / '현재시야', optionally + magnitude filter e.g. '현재창 10등급', '현재창 9~11m')
    const viewportMatch = /^(?:현재\s*(?:창|화면|시야))(?:\s+(.*))?$/.exec(q);
    if (viewportMatch) {
      const extraFilter = (viewportMatch[1] || '').trim();
      const currentMagLimit = getLimitingMagnitude(view.fsz, layers.magOffset);
      let magMin = -30;
      let magMax = currentMagLimit;
      if (extraFilter) {
        const rangeM = /^(\d{1,2}(?:\.\d+)?)\s*[~-]\s*(\d{1,2}(?:\.\d+)?)\s*(?:m|mag|등급)?$/i.exec(
          extraFilter
        );
        const singleM = /^(\d{1,2}(?:\.\d+)?)\s*(?:m|mag|등급)?$/i.exec(extraFilter);
        if (rangeM) {
          magMin = Math.min(Number(rangeM[1]), Number(rangeM[2]));
          magMax = Math.max(Number(rangeM[1]), Number(rangeM[2]));
        } else if (singleM) {
          const target = Number(singleM[1]);
          const hasDec = singleM[1].includes('.');
          magMin = hasDec ? target - 0.15 : target;
          magMax = hasDec ? target + 0.15 : target + 0.99;
        }
      }

      const chartW = typeof window !== 'undefined' ? Math.max(320, window.innerWidth) : 1280;
      const chartH = typeof window !== 'undefined' ? Math.max(320, window.innerHeight) : 800;
      const proj = createProjectionParams(
        view,
        chartW,
        chartH,
        lstDeg,
        observer.lat
      );
      const isInFrame = (raDeg: number, decDeg: number): boolean => {
        const pt = projectStereographic(raDeg, decDeg, proj, 0);
        return Boolean(pt && pt.x >= 0 && pt.x <= chartW && pt.y >= 0 && pt.y <= chartH);
      };
      const viewRaDeg = ((view.ra * 15) % 360 + 360) % 360;
      const formatCenterDist = (raDeg: number, decDeg: number): string => {
        const dist = angularDistanceDeg(raDeg, decDeg, viewRaDeg, view.dec);
        const arcmin = dist * 60;
        if (arcmin < 1) return `중심 ${(arcmin * 60).toFixed(0)}"`;
        if (arcmin < 60) return `중심 ${arcmin.toFixed(1)}'`;
        return `중심 ${dist.toFixed(2)}°`;
      };

      const seenHip = new Set<number>();
      const seenGaia = new Set<string>();
      const seenIds = new Set<string>();
      const seenPos = new Set<string>();
      const vpStars: { star: Star; badge?: string }[] = [];
      let extraUncollectedLocal = 0;

      const tryAddStar = (star: Star, badge?: string) => {
        if (star.mag < magMin || star.mag > magMax) return;
        if (star.hip && seenHip.has(star.hip)) return;
        if (star.gaiaId && seenGaia.has(star.gaiaId)) return;
        if (seenIds.has(star.id)) return;
        const posKey = `${Math.round(star.ra * 300)}_${Math.round((star.dec + 90) * 300)}`;
        if (seenPos.has(posKey)) return;
        if (star.hip) seenHip.add(star.hip);
        if (star.gaiaId) seenGaia.add(star.gaiaId);
        seenIds.add(star.id);
        seenPos.add(posKey);
        vpStars.push({ star, badge });
      };

      // 1. Bright Hipparcos stars
      for (let i = 0; i < catalogs.brightStars.length; i++) {
        const s = catalogs.brightStars[i];
        if (s.mag > magMax) break;
        if (s.mag < magMin) continue;
        if (isInFrame(s.ra, s.dec)) tryAddStar(s);
      }
      // 2. Deep Hipparcos stars (up to 8.0m)
      if (magMax > 6.0 && catalogs.deepStars.length > 0) {
        for (let i = 0; i < catalogs.deepStars.length; i++) {
          const s = catalogs.deepStars[i];
          if (s.mag > magMax) break;
          if (s.mag < magMin) continue;
          if (isInFrame(s.ra, s.dec)) tryAddStar(s);
        }
      }
      // 3. Locally downloaded star catalogs (primary built-in extension, fast spatial index)
      if (magMax > 8.0 && (catalogs.localStarCount > 0 || localStarState.totalStars > 0)) {
        const localFrame = getLocalStarsInFrame(
          { raHours: view.ra, decDeg: view.dec, fszDeg: view.fsz },
          Math.max(8.0, magMin),
          magMax,
          isInFrame,
          3000
        );
        for (let i = 0; i < localFrame.stars.length; i++) {
          const s = localFrame.stars[i];
          tryAddStar(s, s.hip ? '로컬 HIP' : '로컬 Gaia');
        }
        if (localFrame.totalCount > localFrame.stars.length) {
          extraUncollectedLocal = localFrame.totalCount - localFrame.stars.length;
        }
      }
      // 4. Live Gaia DR3 stars supplementing beyond local catalogs
      if (magMax > 8.0 && catalogs.gaiaStars.length > 0) {
        for (let i = 0; i < catalogs.gaiaStars.length; i++) {
          const s = catalogs.gaiaStars[i];
          if (s.mag < magMin || s.mag > magMax) continue;
          if (isInFrame(s.ra, s.dec)) tryAddStar(s, 'Gaia DR3');
        }
      }
      // 5. Hipparcos Ultra tiles (when loaded)
      if (magMax > 8.0 && catalogs.ultraStarTiles.size > 0) {
        const tileKeys = getVisibleUltraTileKeys(view.ra, view.dec, Math.min(180, view.fsz * 1.45));
        for (let t = 0; t < tileKeys.length; t++) {
          const list = catalogs.ultraStarTiles.get(tileKeys[t]);
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.mag > magMax) break;
            if (s.mag < magMin) continue;
            if (isInFrame(s.ra, s.dec)) tryAddStar(s, 'HIP');
          }
        }
      }

      const dir = exploreSortDir === 'asc' ? 1 : -1;
      const sortNameOfStar = (s: Star) =>
        formatObjectDisplayName(s.koName, s.name, s.bayer || s.id, nameLang);
      vpStars.sort((a, b) => {
        if (exploreSort === 'category') {
          const ca = STAR_CATEGORY_INFO(a.star, a.badge).rank;
          const cb = STAR_CATEGORY_INFO(b.star, b.badge).rank;
          if (ca !== cb) return (ca - cb) * dir;
          return a.star.mag - b.star.mag;
        }
        if (exploreSort === 'constellation') {
          const cmp = compareConstellations(a.star.con, b.star.con, dir);
          if (cmp !== 0) return cmp;
          return a.star.mag - b.star.mag;
        }
        if (exploreSort === 'name') {
          const cmp = sortNameOfStar(a.star).localeCompare(sortNameOfStar(b.star), 'ko', {
            numeric: true,
            sensitivity: 'base',
          });
          if (cmp !== 0) return cmp * dir;
          return a.star.mag - b.star.mag;
        }
        if (exploreSort === 'alt') {
          const altA = equatorialToHorizontal(a.star.ra, a.star.dec, lstDeg, observer.lat).altDeg;
          const altB = equatorialToHorizontal(b.star.ra, b.star.dec, lstDeg, observer.lat).altDeg;
          if (altA !== altB) return (altA - altB) * dir;
          return a.star.mag - b.star.mag;
        }
        if (exploreSort === 'mag') {
          return (a.star.mag - b.star.mag) * dir;
        }
        return a.star.mag - b.star.mag;
      });
      const totalMatches = vpStars.length + extraUncollectedLocal;
      const items: GlobalSearchItem[] = vpStars
        .slice(0, viewportResultLimit)
        .map(({ star, badge }) => ({
          kind: 'star' as const,
          key: `star:${star.id}`,
          score: 100,
          mag: star.mag,
          star,
          sourceBadge: badge,
          detail: formatCenterDist(star.ra, star.dec),
        }));
      return {
        items,
        totalMatches,
        isViewportMode: true,
        viewportMagLimit: magMax,
      };
    }

    const results: GlobalSearchItem[] = [];

    // 1. Solar System bodies
    for (const body of solarBodies) {
      const score = scoreSearchMatch(
        [body.koName, body.name, body.id],
        [body.category],
        q,
        qCompact
      );
      if (score > 0) {
        results.push({
          kind: 'planet',
          key: `planet:${body.id}`,
          score: score + 6,
          mag: body.mag,
          body,
        });
      }
    }

    // 2. Constellations
    for (const con of sortedConstellations) {
      const score = scoreSearchMatch([con.koName, con.name, con.abbr], [], q, qCompact);
      if (score > 0) {
        results.push({
          kind: 'constellation',
          key: `con:${con.abbr}`,
          score: score + 4,
          mag: 0,
          con,
        });
      }
    }

    // 3. Stars (Bright + HIP lookup in Deep Stars + Downloaded Local Star Packs)
    const seenStarHip = new Set<number>();
    const seenStarIds = new Set<string>();
    const wantsHip = qCompact.startsWith('hip') || /^\d{2,}$/.test(qCompact);
    for (const star of catalogs.brightStars) {
      if (star.hip) seenStarHip.add(star.hip);
      seenStarIds.add(star.id);
      const hipLabel = star.hip ? `HIP ${star.hip}` : undefined;
      const score = scoreSearchMatch(
        [star.koName, star.name, star.bayer, ...getBayerExpandedNames(star.bayer), hipLabel, star.id],
        [star.con, ...getBayerBaseSearchAliases(star.bayer)],
        q,
        qCompact
      );
      if (score > 0) {
        results.push({
          kind: 'star',
          key: `star:${star.id}`,
          score,
          mag: star.mag,
          star,
        });
      }
    }
    if (wantsHip && catalogs.deepStars.length > 0) {
      let deepStarHits = 0;
      for (const star of catalogs.deepStars) {
        if (star.hip && seenStarHip.has(star.hip)) continue;
        if (seenStarIds.has(star.id)) continue;
        const hipLabel = star.hip ? `HIP ${star.hip}` : star.id;
        const score = scoreSearchMatch([hipLabel, star.id], [], q, qCompact);
        if (score > 0) {
          if (star.hip) seenStarHip.add(star.hip);
          seenStarIds.add(star.id);
          results.push({
            kind: 'star',
            key: `star:${star.id}`,
            score,
            mag: star.mag,
            star,
          });
          deepStarHits++;
          if (deepStarHits >= 30) break;
        }
      }
    }
    // 3b. Fast Local Downloaded Star Catalogs (HIP / Gaia DR3 / Coordinates / Magnitude / Keywords)
    const seenGaiaIds = new Set<string>();
    const registerStarSeen = (st: Star) => {
      if (st.hip) seenStarHip.add(st.hip);
      seenStarIds.add(st.id);
      if (st.gaiaId) seenGaiaIds.add(st.gaiaId);
    };
    if (catalogs.localStarCount > 0 || localStarState.totalStars > 0) {
      const localHits = searchLocalStarCatalogs(
        query,
        { raHours: view.ra, decDeg: view.dec },
        35
      );
      for (const hit of localHits) {
        if (hit.star.hip && seenStarHip.has(hit.star.hip)) continue;
        if (seenStarIds.has(hit.star.id)) continue;
        if (hit.star.gaiaId && seenGaiaIds.has(hit.star.gaiaId)) continue;
        registerStarSeen(hit.star);
        results.push({
          kind: 'star',
          key: `star:${hit.star.id}`,
          score: hit.score,
          mag: hit.star.mag,
          star: hit.star,
          sourceBadge: hit.badge,
          detail: hit.detail,
        });
      }
    }

    // 3c. Currently Loaded & Session-Cached Live Gaia DR3 Stars (instant 0ms)
    const loadedGaiaHits = searchLoadedGaiaStars(query, catalogs.gaiaStars, 35);
    const gaiaDigitsClean = qCompact.replace(/^gaia(?:dr3)?/i, '');
    for (const star of loadedGaiaHits) {
      if (seenStarIds.has(star.id)) continue;
      if (star.gaiaId && seenGaiaIds.has(star.gaiaId)) continue;
      registerStarSeen(star);
      const exactMatch =
        Boolean(star.gaiaId) &&
        Boolean(gaiaDigitsClean) &&
        (star.gaiaId === gaiaDigitsClean || star.gaiaId!.endsWith(gaiaDigitsClean));
      results.push({
        kind: 'star',
        key: `star:${star.id}`,
        score: exactMatch ? 124 : 98,
        mag: star.mag,
        star,
        sourceBadge: 'Gaia DR3',
      });
    }

    // 3d. Remote Server Cache & Gaia DR3 TAP Search Results
    if (remoteGaiaHits.length > 0) {
      for (const star of remoteGaiaHits) {
        if (seenStarIds.has(star.id)) continue;
        if (star.gaiaId && seenGaiaIds.has(star.gaiaId)) continue;
        registerStarSeen(star);
        const exactMatch =
          Boolean(star.gaiaId) &&
          Boolean(gaiaDigitsClean) &&
          (star.gaiaId === gaiaDigitsClean || star.gaiaId!.endsWith(gaiaDigitsClean));
        results.push({
          kind: 'star',
          key: `star:${star.id}`,
          score: exactMatch ? 123 : 95,
          mag: star.mag,
          star,
          sourceBadge: 'Gaia DR3',
        });
      }
    }

    // 3e. Currently Selected Star fallback (ensures inspected Gaia/HIP star is always searchable)
    if (selected?.kind === 'star') {
      const st = selected.data;
      if (
        !seenStarIds.has(st.id) &&
        !(st.hip && seenStarHip.has(st.hip)) &&
        !(st.gaiaId && seenGaiaIds.has(st.gaiaId))
      ) {
        const score = scoreSearchMatch(
          [
            st.id,
            st.gaiaId ? `Gaia ${st.gaiaId}` : undefined,
            st.gaiaId ? `Gaia DR3 ${st.gaiaId}` : undefined,
            st.gaiaId,
            st.hip ? `HIP ${st.hip}` : undefined,
            st.koName,
            st.name,
            st.bayer,
            ...getBayerExpandedNames(st.bayer),
          ],
          [st.con, ...getBayerBaseSearchAliases(st.bayer)],
          q,
          qCompact
        );
        if (score > 0) {
          registerStarSeen(st);
          results.push({
            kind: 'star',
            key: `star:${st.id}`,
            score: Math.max(100, score),
            mag: st.mag,
            star: st,
            sourceBadge: st.gaiaId ? 'Gaia DR3' : undefined,
          });
        }
      }
    }

    if (wantsHip && remoteHipHits.length > 0) {
      for (const star of remoteHipHits) {
        if (star.hip && seenStarHip.has(star.hip)) continue;
        if (seenStarIds.has(star.id)) continue;
        registerStarSeen(star);
        const hipLabel = star.hip ? `HIP ${star.hip}` : star.id;
        const score = Math.max(
          85,
          scoreSearchMatch(
            [star.koName, star.name, star.bayer, ...getBayerExpandedNames(star.bayer), hipLabel, star.id],
            [star.con, ...getBayerBaseSearchAliases(star.bayer)],
            q,
            qCompact
          )
        );
        results.push({
          kind: 'star',
          key: `star:${star.id}`,
          score,
          mag: star.mag,
          star,
        });
      }
    }

    // 4. DSOs (Messier -> Caldwell -> Bright DSO -> Dark Nebulae -> Deep NGC/IC)
    const seenDsoIds = new Set<string>();
    const normDsoKey = (id?: string) => normalizeCatalogToken(id);

    for (const dso of messierList) {
      const k1 = normDsoKey(dso.id);
      const k2 = normDsoKey(dso.altId);
      if (k1) seenDsoIds.add(k1);
      if (k2) seenDsoIds.add(k2);
      const mNum = dso.id.replace(/^M/i, '');
      const aliases = getDsoSearchAliases(dso);
      const score = scoreSearchMatch(
        [...aliases, `messier ${mNum}`, `메시에 ${mNum}`, dso.koName, dso.name],
        [dso.con],
        q,
        qCompact
      );
      if (score > 0) {
        const secList = getSecondaryDesignations(dso.id, dso.altId);
        results.push({
          kind: 'dso',
          key: `dso:${dso.id}`,
          score: score + 3,
          mag: dso.mag,
          dso,
          badge: '메시에',
          primaryId: dso.id,
          secondaryId: secList.length > 0 ? secList.join(' · ') : undefined,
        });
      }
    }

    for (const entry of catalogs.caldwell) {
      const k1 = normDsoKey(entry.caldwellId);
      const k2 = normDsoKey(entry.id);
      if (k1) seenDsoIds.add(k1);
      if (k2) seenDsoIds.add(k2);
      const aliases = getDsoSearchAliases(entry, entry.caldwellId);
      const score = scoreSearchMatch(
        [
          ...aliases,
          entry.koName,
          entry.name,
          `caldwell ${entry.caldwellNumber}`,
          `콜드웰 ${entry.caldwellNumber}`,
        ],
        [entry.con],
        q,
        qCompact
      );
      if (score > 0) {
        const secList = getSecondaryDesignations(entry.caldwellId, entry.id);
        results.push({
          kind: 'dso',
          key: `dso:${entry.caldwellId}`,
          score: score + 2,
          mag: entry.mag,
          dso: entry,
          badge: '콜드웰',
          primaryId: entry.caldwellId,
          secondaryId: secList.length > 0 ? secList.join(' · ') : formatCatalogCode(entry.id),
        });
      }
    }

    const extraPools: { list: DeepSkyObject[]; badge: string }[] = [
      { list: catalogs.dsosBright, badge: 'DSO' },
      { list: catalogs.darkNebulae, badge: '암흑' },
      { list: catalogs.dsosDeep, badge: 'DSO' },
    ];
    for (const pool of extraPools) {
      for (const dso of pool.list) {
        const k1 = normDsoKey(dso.id);
        const k2 = normDsoKey(dso.altId);
        if ((k1 && seenDsoIds.has(k1)) || (k2 && seenDsoIds.has(k2))) continue;
        const score = scoreSearchMatch(
          [dso.id, dso.altId, dso.koName, dso.name],
          [dso.con],
          q,
          qCompact
        );
        if (score > 0) {
          if (k1) seenDsoIds.add(k1);
          if (k2) seenDsoIds.add(k2);
          results.push({
            kind: 'dso',
            key: `dso:${dso.id}`,
            score,
            mag: dso.mag,
            dso,
            badge: dso.type === 'DARK' ? '암흑' : pool.badge,
            primaryId: formatCatalogCode(dso.id),
            secondaryId: dso.altId ? formatCatalogCode(dso.altId) : undefined,
          });
        }
      }
    }

    // 5. WDS Double & Multiple Stars
    const wantsDouble =
      q.includes('이중') ||
      q.includes('다중') ||
      q.includes('double') ||
      q.includes('multiple') ||
      qCompact.startsWith('wds') ||
      qCompact.startsWith('stf') ||
      qCompact.startsWith('stt');
    let doubleHits = 0;
    for (const sys of catalogs.doubleStars) {
      let score = scoreSearchMatch(
        [sys.disc, sys.id, sys.wdsId, sys.koName, sys.name, sys.bayer, ...getBayerExpandedNames(sys.bayer)],
        [sys.con, ...getBayerBaseSearchAliases(sys.bayer), sys.isMultiple ? '다중성 multiple' : '이중성 double'],
        q,
        qCompact
      );
      if (score === 0 && wantsDouble) {
        if ((q.includes('다중') || q.includes('multiple')) && sys.isMultiple) score = 55;
        else if ((q.includes('이중') || q.includes('double')) && !sys.isMultiple) score = 55;
      }
      if (score > 0) {
        results.push({
          kind: 'double',
          key: `double:${sys.id}`,
          score: score + (sys.isMultiple ? 1 : 0),
          mag: sys.mag,
          sys,
        });
        doubleHits++;
        if (doubleHits >= 40) break;
      }
    }

    const dir = exploreSortDir === 'asc' ? 1 : -1;
    const getGlobalItemName = (item: GlobalSearchItem): string => {
      if (item.kind === 'planet') {
        return formatObjectDisplayName(item.body.koName, item.body.name, item.body.id, nameLang);
      }
      if (item.kind === 'constellation') {
        return formatObjectDisplayName(item.con.koName, item.con.name, item.con.abbr, nameLang);
      }
      if (item.kind === 'star') {
        return formatObjectDisplayName(
          item.star.koName,
          item.star.name,
          item.star.bayer || item.star.id,
          nameLang
        );
      }
      if (item.kind === 'double') {
        return formatObjectDisplayName(
          item.sys.koName,
          item.sys.name,
          item.sys.bayer || item.sys.disc,
          nameLang
        );
      }
      return formatObjectDisplayName(
        item.dso.koName,
        item.dso.name,
        item.primaryId || item.dso.id,
        nameLang
      );
    };
    const getGlobalItemAlt = (item: GlobalSearchItem): number => {
      const ra =
        item.kind === 'planet'
          ? item.body.ra
          : item.kind === 'constellation'
          ? item.con.ra
          : item.kind === 'star'
          ? item.star.ra
          : item.kind === 'double'
          ? item.sys.ra
          : item.dso.ra;
      const dec =
        item.kind === 'planet'
          ? item.body.dec
          : item.kind === 'constellation'
          ? item.con.dec
          : item.kind === 'star'
          ? item.star.dec
          : item.kind === 'double'
          ? item.sys.dec
          : item.dso.dec;
      return equatorialToHorizontal(ra, dec, lstDeg, observer.lat).altDeg;
    };

    results.sort((a, b) => {
      if (exploreSort === 'category') {
        const ra = GLOBAL_CATEGORY_INFO(a).rank;
        const rb = GLOBAL_CATEGORY_INFO(b).rank;
        if (ra !== rb) return (ra - rb) * dir;
        if (a.mag !== b.mag) return a.mag - b.mag;
        return getGlobalItemName(a).localeCompare(getGlobalItemName(b), 'ko', {
          numeric: true,
          sensitivity: 'base',
        });
      }
      if (exploreSort === 'constellation') {
        const cmp = compareConstellations(getGlobalItemConAbbr(a), getGlobalItemConAbbr(b), dir);
        if (cmp !== 0) return cmp;
        if (a.mag !== b.mag) return a.mag - b.mag;
        return getGlobalItemName(a).localeCompare(getGlobalItemName(b), 'ko', {
          numeric: true,
          sensitivity: 'base',
        });
      }
      if (exploreSort === 'name') {
        const cmp = getGlobalItemName(a).localeCompare(getGlobalItemName(b), 'ko', {
          numeric: true,
          sensitivity: 'base',
        });
        if (cmp !== 0) return cmp * dir;
        return a.mag - b.mag;
      }
      if (exploreSort === 'mag') {
        const cmp = a.mag - b.mag;
        if (cmp !== 0) return cmp * dir;
        return b.score - a.score;
      }
      if (exploreSort === 'alt') {
        const cmp = getGlobalItemAlt(a) - getGlobalItemAlt(b);
        if (cmp !== 0) return cmp * dir;
        return a.mag - b.mag;
      }
      return b.score - a.score || a.mag - b.mag;
    });
    return {
      items: results.slice(0, 80),
      totalMatches: results.length,
      isViewportMode: false,
      viewportMagLimit: 0,
    };
  }, [
    exploreCategory,
    exploreSort,
    exploreSortDir,
    conLookupByAbbr,
    query,
    solarBodies,
    sortedConstellations,
    messierList,
    catalogs.brightStars,
    catalogs.deepStars,
    catalogs.ultraStarTiles,
    catalogs.caldwell,
    catalogs.doubleStars,
    catalogs.dsosBright,
    catalogs.darkNebulae,
    catalogs.dsosDeep,
    catalogs.gaiaStars,
    catalogs.localStarCount,
    catalogs.localStarRevision,
    localStarState.totalStars,
    localStarState.revision,
    view,
    lstDeg,
    observer.lat,
    layers.magOffset,
    viewportResultLimit,
    selected,
    remoteHipHits,
    remoteGaiaHits,
    nameLang,
  ]);

  const filteredStars = useMemo(() => {
    type StarBrowseEntry = {
      key: string;
      star: Star;
      score: number;
      sourceBadge?: string;
      detail?: string;
    };
    if (exploreCategory !== 'star') {
      return {
        items: [] as StarBrowseEntry[],
        totalMatches: 0,
        isViewportMode: false,
        viewportMagLimit: 0,
      };
    }

    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/\s+/g, '');
    const viewportMatch = /^(?:현재\s*(?:창|화면|시야))(?:\s+(.*))?$/.exec(q);
    const useViewport = starFilter === 'viewport' || Boolean(viewportMatch);

    const dir = exploreSortDir === 'asc' ? 1 : -1;
    const starDisplayName = (s: Star) =>
      formatObjectDisplayName(s.koName, s.name, s.bayer || s.id, nameLang);
    const sortStarEntries = (list: StarBrowseEntry[], useScoreDefault: boolean) => {
      list.sort((a, b) => {
        if (exploreSort === 'category') {
          const ra = STAR_CATEGORY_INFO(a.star, a.sourceBadge).rank;
          const rb = STAR_CATEGORY_INFO(b.star, b.sourceBadge).rank;
          if (ra !== rb) return (ra - rb) * dir;
          return a.star.mag - b.star.mag;
        }
        if (exploreSort === 'constellation') {
          const cmp = compareConstellations(a.star.con, b.star.con, dir);
          if (cmp !== 0) return cmp;
          return a.star.mag - b.star.mag;
        }
        if (exploreSort === 'name') {
          const cmp = starDisplayName(a.star).localeCompare(starDisplayName(b.star), 'ko', {
            numeric: true,
            sensitivity: 'base',
          });
          if (cmp !== 0) return cmp * dir;
          return a.star.mag - b.star.mag;
        }
        if (exploreSort === 'mag') {
          const cmp = a.star.mag - b.star.mag;
          if (cmp !== 0) return cmp * dir;
          return starDisplayName(a.star).localeCompare(starDisplayName(b.star), 'ko');
        }
        if (exploreSort === 'alt') {
          const altA = equatorialToHorizontal(a.star.ra, a.star.dec, lstDeg, observer.lat).altDeg;
          const altB = equatorialToHorizontal(b.star.ra, b.star.dec, lstDeg, observer.lat).altDeg;
          if (altA !== altB) return (altA - altB) * dir;
          return a.star.mag - b.star.mag;
        }
        if (useScoreDefault && a.score !== b.score) {
          return b.score - a.score;
        }
        return a.star.mag - b.star.mag;
      });
    };

    if (useViewport) {
      const extraFilter = viewportMatch ? (viewportMatch[1] || '').trim() : q;
      const currentMagLimit = getLimitingMagnitude(view.fsz, layers.magOffset);
      let magMin = -30;
      let magMax = currentMagLimit;
      let textSubFilter = '';
      if (extraFilter) {
        const rangeM = /^(\d{1,2}(?:\.\d+)?)\s*[~-]\s*(\d{1,2}(?:\.\d+)?)\s*(?:m|mag|등급)?$/i.exec(
          extraFilter
        );
        const singleM = /^(\d{1,2}(?:\.\d+)?)\s*(?:m|mag|등급)?$/i.exec(extraFilter);
        if (rangeM) {
          magMin = Math.min(Number(rangeM[1]), Number(rangeM[2]));
          magMax = Math.max(Number(rangeM[1]), Number(rangeM[2]));
        } else if (singleM) {
          const target = Number(singleM[1]);
          const hasDec = singleM[1].includes('.');
          magMin = hasDec ? target - 0.15 : target;
          magMax = hasDec ? target + 0.15 : target + 0.99;
        } else {
          textSubFilter = extraFilter;
        }
      }

      const chartW = typeof window !== 'undefined' ? Math.max(320, window.innerWidth) : 1280;
      const chartH = typeof window !== 'undefined' ? Math.max(320, window.innerHeight) : 800;
      const proj = createProjectionParams(view, chartW, chartH, lstDeg, observer.lat);
      const isInFrame = (raDeg: number, decDeg: number): boolean => {
        const pt = projectStereographic(raDeg, decDeg, proj, 0);
        return Boolean(pt && pt.x >= 0 && pt.x <= chartW && pt.y >= 0 && pt.y <= chartH);
      };
      const viewRaDeg = ((view.ra * 15) % 360 + 360) % 360;
      const formatCenterDist = (raDeg: number, decDeg: number): string => {
        const dist = angularDistanceDeg(raDeg, decDeg, viewRaDeg, view.dec);
        const arcmin = dist * 60;
        if (arcmin < 1) return `중심 ${(arcmin * 60).toFixed(0)}"`;
        if (arcmin < 60) return `중심 ${arcmin.toFixed(1)}'`;
        return `중심 ${dist.toFixed(2)}°`;
      };

      const seenHip = new Set<number>();
      const seenGaia = new Set<string>();
      const seenIds = new Set<string>();
      const seenPos = new Set<string>();
      const vpEntries: StarBrowseEntry[] = [];
      let extraUncollectedLocal = 0;
      const subCompact = textSubFilter.replace(/\s+/g, '');

      const tryAddStar = (star: Star, badge?: string) => {
        if (star.mag < magMin || star.mag > magMax) return;
        if (star.hip && seenHip.has(star.hip)) return;
        if (star.gaiaId && seenGaia.has(star.gaiaId)) return;
        if (seenIds.has(star.id)) return;
        const posKey = `${Math.round(star.ra * 300)}_${Math.round((star.dec + 90) * 300)}`;
        if (seenPos.has(posKey)) return;
        let sc = 100;
        if (textSubFilter) {
          sc = scoreSearchMatch(
            [
              star.koName,
              star.name,
              star.bayer,
              ...getBayerExpandedNames(star.bayer),
              star.hip ? `HIP ${star.hip}` : undefined,
              star.gaiaId ? `Gaia DR3 ${star.gaiaId}` : undefined,
              star.id,
            ],
            [star.con, ...getBayerBaseSearchAliases(star.bayer)],
            textSubFilter,
            subCompact
          );
          if (sc <= 0) return;
        }
        if (star.hip) seenHip.add(star.hip);
        if (star.gaiaId) seenGaia.add(star.gaiaId);
        seenIds.add(star.id);
        seenPos.add(posKey);
        vpEntries.push({
          key: `star:${star.id}`,
          star,
          score: sc,
          sourceBadge: badge,
          detail: formatCenterDist(star.ra, star.dec),
        });
      };

      for (let i = 0; i < catalogs.brightStars.length; i++) {
        const s = catalogs.brightStars[i];
        if (s.mag > magMax) break;
        if (s.mag < magMin) continue;
        if (isInFrame(s.ra, s.dec)) tryAddStar(s);
      }
      if (magMax > 6.0 && catalogs.deepStars.length > 0) {
        for (let i = 0; i < catalogs.deepStars.length; i++) {
          const s = catalogs.deepStars[i];
          if (s.mag > magMax) break;
          if (s.mag < magMin) continue;
          if (isInFrame(s.ra, s.dec)) tryAddStar(s);
        }
      }
      if (magMax > 8.0 && (catalogs.localStarCount > 0 || localStarState.totalStars > 0)) {
        const localFrame = getLocalStarsInFrame(
          { raHours: view.ra, decDeg: view.dec, fszDeg: view.fsz },
          Math.max(8.0, magMin),
          magMax,
          isInFrame,
          3000
        );
        for (let i = 0; i < localFrame.stars.length; i++) {
          const s = localFrame.stars[i];
          tryAddStar(s, s.hip ? '로컬 HIP' : '로컬 Gaia');
        }
        if (!textSubFilter && localFrame.totalCount > localFrame.stars.length) {
          extraUncollectedLocal = localFrame.totalCount - localFrame.stars.length;
        }
      }
      if (magMax > 8.0 && catalogs.gaiaStars.length > 0) {
        for (let i = 0; i < catalogs.gaiaStars.length; i++) {
          const s = catalogs.gaiaStars[i];
          if (s.mag < magMin || s.mag > magMax) continue;
          if (isInFrame(s.ra, s.dec)) tryAddStar(s, 'Gaia DR3');
        }
      }
      if (magMax > 8.0 && catalogs.ultraStarTiles.size > 0) {
        const tileKeys = getVisibleUltraTileKeys(view.ra, view.dec, Math.min(180, view.fsz * 1.45));
        for (let t = 0; t < tileKeys.length; t++) {
          const list = catalogs.ultraStarTiles.get(tileKeys[t]);
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.mag > magMax) break;
            if (s.mag < magMin) continue;
            if (isInFrame(s.ra, s.dec)) tryAddStar(s, 'HIP');
          }
        }
      }

      sortStarEntries(vpEntries, Boolean(textSubFilter));
      return {
        items: vpEntries.slice(0, viewportResultLimit),
        totalMatches: vpEntries.length + extraUncollectedLocal,
        isViewportMode: true,
        viewportMagLimit: magMax,
      };
    }

    const entries: StarBrowseEntry[] = [];
    const seenHip = new Set<number>();
    const seenIds = new Set<string>();
    const seenGaia = new Set<string>();
    const registerSeen = (st: Star) => {
      if (st.hip) seenHip.add(st.hip);
      seenIds.add(st.id);
      if (st.gaiaId) seenGaia.add(st.gaiaId);
    };
    const matchesSubFilter = (star: Star): boolean => {
      if (starFilter === 'named') return Boolean(star.koName || star.name);
      if (starFilter === 'bayer') return Boolean(star.bayer);
      return true;
    };

    for (const star of catalogs.brightStars) {
      if (!matchesSubFilter(star)) continue;
      if (!q) {
        registerSeen(star);
        entries.push({ key: `star:${star.id}`, star, score: 100 });
        continue;
      }
      const hipLabel = star.hip ? `HIP ${star.hip}` : undefined;
      const score = scoreSearchMatch(
        [star.koName, star.name, star.bayer, ...getBayerExpandedNames(star.bayer), hipLabel, star.id],
        [star.con, ...getBayerBaseSearchAliases(star.bayer)],
        q,
        qCompact
      );
      if (score > 0) {
        registerSeen(star);
        entries.push({ key: `star:${star.id}`, star, score });
      }
    }

    if (q && starFilter === 'all') {
      const wantsHip = qCompact.startsWith('hip') || /^\d{2,}$/.test(qCompact);
      if (wantsHip && catalogs.deepStars.length > 0) {
        let deepHits = 0;
        for (const star of catalogs.deepStars) {
          if (star.hip && seenHip.has(star.hip)) continue;
          if (seenIds.has(star.id)) continue;
          const hipLabel = star.hip ? `HIP ${star.hip}` : star.id;
          const score = scoreSearchMatch([hipLabel, star.id], [], q, qCompact);
          if (score > 0) {
            registerSeen(star);
            entries.push({ key: `star:${star.id}`, star, score });
            deepHits++;
            if (deepHits >= 40) break;
          }
        }
      }

      if (catalogs.localStarCount > 0 || localStarState.totalStars > 0) {
        const localHits = searchLocalStarCatalogs(
          query,
          { raHours: view.ra, decDeg: view.dec },
          45
        );
        for (const hit of localHits) {
          if (hit.star.hip && seenHip.has(hit.star.hip)) continue;
          if (seenIds.has(hit.star.id)) continue;
          if (hit.star.gaiaId && seenGaia.has(hit.star.gaiaId)) continue;
          registerSeen(hit.star);
          entries.push({
            key: `star:${hit.star.id}`,
            star: hit.star,
            score: hit.score,
            sourceBadge: hit.badge,
            detail: hit.detail,
          });
        }
      }

      const loadedGaiaHits = searchLoadedGaiaStars(query, catalogs.gaiaStars, 40);
      const gaiaDigitsClean = qCompact.replace(/^gaia(?:dr3)?/i, '');
      for (const star of loadedGaiaHits) {
        if (seenIds.has(star.id)) continue;
        if (star.gaiaId && seenGaia.has(star.gaiaId)) continue;
        registerSeen(star);
        const exactMatch =
          Boolean(star.gaiaId) &&
          Boolean(gaiaDigitsClean) &&
          (star.gaiaId === gaiaDigitsClean || star.gaiaId!.endsWith(gaiaDigitsClean));
        entries.push({
          key: `star:${star.id}`,
          star,
          score: exactMatch ? 124 : 98,
          sourceBadge: 'Gaia DR3',
        });
      }

      if (remoteGaiaHits.length > 0) {
        for (const star of remoteGaiaHits) {
          if (seenIds.has(star.id)) continue;
          if (star.gaiaId && seenGaia.has(star.gaiaId)) continue;
          registerSeen(star);
          const exactMatch =
            Boolean(star.gaiaId) &&
            Boolean(gaiaDigitsClean) &&
            (star.gaiaId === gaiaDigitsClean || star.gaiaId!.endsWith(gaiaDigitsClean));
          entries.push({
            key: `star:${star.id}`,
            star,
            score: exactMatch ? 123 : 95,
            sourceBadge: 'Gaia DR3',
          });
        }
      }

      if (selected?.kind === 'star') {
        const st = selected.data;
        if (
          !seenIds.has(st.id) &&
          !(st.hip && seenHip.has(st.hip)) &&
          !(st.gaiaId && seenGaia.has(st.gaiaId))
        ) {
          const score = scoreSearchMatch(
            [
              st.id,
              st.gaiaId ? `Gaia ${st.gaiaId}` : undefined,
              st.gaiaId ? `Gaia DR3 ${st.gaiaId}` : undefined,
              st.gaiaId,
              st.hip ? `HIP ${st.hip}` : undefined,
              st.koName,
              st.name,
              st.bayer,
              ...getBayerExpandedNames(st.bayer),
            ],
            [st.con, ...getBayerBaseSearchAliases(st.bayer)],
            q,
            qCompact
          );
          if (score > 0) {
            registerSeen(st);
            entries.push({
              key: `star:${st.id}`,
              star: st,
              score: Math.max(100, score),
              sourceBadge: st.gaiaId ? 'Gaia DR3' : undefined,
            });
          }
        }
      }

      if (wantsHip && remoteHipHits.length > 0) {
        for (const star of remoteHipHits) {
          if (star.hip && seenHip.has(star.hip)) continue;
          if (seenIds.has(star.id)) continue;
          registerSeen(star);
          const hipLabel = star.hip ? `HIP ${star.hip}` : star.id;
          const score = Math.max(
            85,
            scoreSearchMatch(
              [star.koName, star.name, star.bayer, ...getBayerExpandedNames(star.bayer), hipLabel, star.id],
              [star.con, ...getBayerBaseSearchAliases(star.bayer)],
              q,
              qCompact
            )
          );
          entries.push({ key: `star:${star.id}`, star, score });
        }
      }
    }

    sortStarEntries(entries, Boolean(q));
    return {
      items: entries.slice(0, viewportResultLimit),
      totalMatches: entries.length,
      isViewportMode: false,
      viewportMagLimit: 0,
    };
  }, [
    exploreCategory,
    starFilter,
    exploreSort,
    exploreSortDir,
    conLookupByAbbr,
    query,
    catalogs.brightStars,
    catalogs.deepStars,
    catalogs.ultraStarTiles,
    catalogs.gaiaStars,
    catalogs.localStarCount,
    catalogs.localStarRevision,
    localStarState.totalStars,
    localStarState.revision,
    view,
    lstDeg,
    observer.lat,
    layers.magOffset,
    viewportResultLimit,
    selected,
    remoteHipHits,
    remoteGaiaHits,
    nameLang,
  ]);

  const jumpToDso = (dso: DeepSkyObject) => {
    setActiveConAbbr(null);
    onChangeView((p) => ({
      ...p,
      ra: ((dso.ra / 15) % 24 + 24) % 24,
      dec: dso.dec,
      fsz: Math.max(2.5, Math.min(20, (dso.majAx / 60) * 6)),
    }));
    onSelect({ kind: 'dso', data: dso });
  };

  const jumpToPlanet = (body: SolarSystemBody) => {
    setActiveConAbbr(null);
    const targetFsz =
      body.id === 'Sun' || body.id === 'Moon'
        ? 24
        : body.group === 'moon'
        ? body.parentId === 'Pluto'
          ? 0.015
          : body.parentId === 'Mars' ||
            body.parentId === 'Uranus' ||
            body.parentId === 'Neptune'
          ? 0.06
          : body.parentId === 'Saturn'
          ? 0.35
          : 0.9
        : body.group === 'comet'
        ? 8
        : body.group === 'dwarf' || body.group === 'asteroid'
        ? 10
        : 18;
    onChangeLayers((p) => {
      const subKey =
        body.group === 'star'
          ? 'showSolarSun'
          : body.group === 'planet'
          ? 'showSolarPlanets'
          : body.group === 'moon'
          ? 'showSolarMoons'
          : body.group === 'dwarf'
          ? 'showSolarDwarfs'
          : body.group === 'asteroid'
          ? 'showSolarAsteroids'
          : body.group === 'comet'
          ? 'showSolarComets'
          : null;
      if (!subKey) return p;
      if (p.showSolarSystem && (p[subKey] ?? true)) return p;
      return { ...p, showSolarSystem: true, [subKey]: true };
    });
    onChangeView((p) => ({
      ...p,
      ra: ((body.ra / 15) % 24 + 24) % 24,
      dec: body.dec,
      fsz: targetFsz,
    }));
    onSelect({ kind: 'planet', data: body });
  };

  const jumpToStar = (star: Star) => {
    setActiveConAbbr(null);
    // Faint downloaded & Gaia stars (mag > 8) automatically zoom in deep enough to be immediately visible
    const targetFsz =
      star.mag <= 8.0
        ? 12
        : Math.max(
            0.04,
            Math.min(12, 60 * Math.pow(10, -(star.mag + 0.7 - layers.magOffset - 6.0) / 3.65))
          );
    onChangeView((p) => {
      const curRaDeg = ((p.ra * 15) % 360 + 360) % 360;
      const inCurrentFrame = angularDistanceDeg(curRaDeg, p.dec, star.ra, star.dec) <= p.fsz * 0.95;
      return {
        ...p,
        ra: ((star.ra / 15) % 24 + 24) % 24,
        dec: star.dec,
        fsz: inCurrentFrame ? Math.min(p.fsz, targetFsz) : targetFsz,
      };
    });
    onSelect({ kind: 'star', data: star });
  };

  const jumpToDouble = (sys: DoubleStarSystem) => {
    setActiveConAbbr(null);
    onChangeLayers((p) =>
      p.showDoubleStars ? p : { ...p, showDoubleStars: true }
    );
    onChangeView((p) => ({
      ...p,
      ra: ((sys.ra / 15) % 24 + 24) % 24,
      dec: sys.dec,
      fsz: Math.max(0.18, Math.min(8, (sys.sep / 3600) * 140)),
    }));
    onSelect({ kind: 'double', data: sys });
  };

  const jumpToConstellation = (con: Constellation) => {
    setActiveConAbbr(con.abbr);
    onChangeView((p) => ({
      ...p,
      ra: ((con.ra / 15) % 24 + 24) % 24,
      dec: con.dec,
      fsz: 45,
    }));
  };

  // Theme-adapted styles matching the segmented category bar + card list design
  const segTrackCls =
    theme === 'white'
      ? 'bg-slate-100 border-slate-200'
      : theme === 'red'
      ? 'bg-[#120000] border-[#3B0808]'
      : 'bg-[#152033] border-[#24324B]';

  const segActiveCls =
    theme === 'white'
      ? 'bg-white text-blue-700 shadow-xs'
      : theme === 'red'
      ? 'bg-[#260000] text-[#FF3B3B]'
      : 'bg-[#080E1B] text-[#22D3EE]';

  const segIdleCls =
    theme === 'white'
      ? 'text-slate-500 hover:text-slate-800'
      : theme === 'red'
      ? 'text-[#A03030] hover:text-[#FF6B6B]'
      : 'text-slate-400 hover:text-slate-200';

  const cardIdleCls =
    theme === 'white'
      ? 'bg-white border-slate-200 hover:border-slate-400'
      : theme === 'red'
      ? 'bg-[#0C0000] border-[#2C0808] hover:border-[#5C1212]'
      : 'bg-[#0B1220] border-[#1E2B42] hover:border-[#33496E]';

  const cardActiveCls =
    theme === 'white'
      ? 'bg-blue-50/70 border-blue-600'
      : theme === 'red'
      ? 'bg-[#260000] border-[#EF4444]'
      : 'bg-[#0E1E32] border-[#06B6D4]';

  const badgeCls =
    theme === 'white'
      ? 'bg-slate-100 text-slate-600 border-slate-200'
      : theme === 'red'
      ? 'bg-[#220000] text-[#FF6B6B] border-[#4A0D0D]'
      : 'bg-[#132138] text-slate-300 border-[#253A5E]';

  const belowHorizonTextCls =
    theme === 'white'
      ? 'text-slate-400'
      : theme === 'red'
      ? 'text-[#732626]'
      : 'text-slate-500';

  const belowHorizonSubCls =
    theme === 'white'
      ? 'text-slate-300'
      : theme === 'red'
      ? 'text-[#551B1B]'
      : 'text-slate-600';

  const belowHorizonBadgeCls =
    theme === 'white'
      ? 'bg-slate-50 text-slate-400 border-slate-200'
      : theme === 'red'
      ? 'bg-[#140000] text-[#732626] border-[#320909]'
      : 'bg-[#0E1624] text-slate-500 border-[#1C283D]';

  const sectionHeaderCls = (open: boolean) =>
    open
      ? theme === 'white'
        ? 'bg-sky-100/95 border-sky-300 border-l-2 border-l-blue-600 hover:bg-sky-200/85 hover:border-blue-400'
        : theme === 'red'
        ? 'bg-[#300606] border-[#7F1D1D] border-l-2 border-l-[#FF5252] hover:bg-[#440909] hover:border-[#B91C1C]'
        : 'bg-[#12263A] border-cyan-500/50 border-l-2 border-l-cyan-400 hover:bg-[#19344E] hover:border-cyan-400/75'
      : theme === 'white'
      ? 'bg-transparent border-transparent hover:bg-slate-200/80 hover:border-slate-300'
      : theme === 'red'
      ? 'bg-transparent border-transparent hover:bg-[#220404] hover:border-[#5C1212]'
      : 'bg-transparent border-transparent hover:bg-[#192338] hover:border-slate-700/80';

  const sectionChevronCls = (open: boolean) =>
    open
      ? theme === 'white'
        ? 'text-blue-600'
        : theme === 'red'
        ? 'text-[#FF5252]'
        : 'text-cyan-400'
      : ui.textMuted;

  const sectionBodyCls =
    theme === 'white'
      ? 'bg-sky-50/55 border border-sky-200/75 rounded-md p-2'
      : theme === 'red'
      ? 'bg-[#130202]/90 border border-[#450A0A] rounded-md p-2'
      : 'bg-[#0F1728]/85 border border-cyan-500/20 rounded-md p-2';

  const searchPlaceholder =
    exploreCategory === 'all'
      ? localStarState.totalStars > 0
        ? '천체명, 현재창, HIP/Gaia, 좌표, 등급...'
        : '천체명, 현재창, M/C/NGC, 별, 행성...'
      : exploreCategory === 'star'
      ? '항성명, 바이어(δ Cep/델타 세페이), 현재창, HIP/Gaia...'
      : exploreCategory === 'messier'
      ? 'M1~M110 번호, 이름, NGC, 별자리...'
      : exploreCategory === 'caldwell'
      ? 'C1~C109 번호, 이름, NGC, 별자리...'
      : exploreCategory === 'ngcic'
      ? 'NGC/IC 번호, 이름, M/C, 별자리...'
      : exploreCategory === 'solar'
      ? '행성, 왜행성, 소행성, 위성 검색...'
      : '88개 별자리 이름, 영문, 약어...';

  return (
    <aside
      className={`no-print w-[270px] shrink-0 h-full border-r flex flex-col overflow-hidden ${ui.panel}`}
    >
      {/* Tab Navigation */}
      <div className={`grid grid-cols-5 border-b p-1 gap-1 ${ui.divider}`}>
        <button
          type="button"
          onClick={() => setTab('explore')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10px] tracking-[-0.05em] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'explore' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Search className="w-3.5 h-3.5 mb-0.5" />
          <span>탐색</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('layers')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10px] tracking-[-0.05em] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'layers' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Layers className="w-3.5 h-3.5 mb-0.5" />
          <span>표시</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('optics')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10px] tracking-[-0.05em] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'optics' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Target className="w-3.5 h-3.5 mb-0.5" />
          <span>광학계</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('observer')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10px] tracking-[-0.05em] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'observer' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <MapPin className="w-3.5 h-3.5 mb-0.5" />
          <span>관측지</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 text-[10px] tracking-[-0.05em] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'settings' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Settings className="w-3.5 h-3.5 mb-0.5" />
          <span>설정</span>
          {(authUser || authError || syncStatus === 'error') && (
            <span
              className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                authError || syncStatus === 'error'
                  ? 'bg-amber-400'
                  : theme === 'red'
                  ? 'bg-[#EF4444]'
                  : 'bg-emerald-400'
              }`}
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {/* Live Gaia DR3 Async Loading / Error Progress Strip (visible across all sidebar tabs) */}
      {layers.enableGaiaLive &&
        (catalogs.gaiaLoading || catalogs.gaiaProgress.status === 'error') && (() => {
          const gp = catalogs.gaiaProgress;
          const isTileProgress = gp.mode === 'tile' && gp.totalTiles > 0;
          const pct = isTileProgress
            ? Math.max(8, Math.min(100, Math.round((gp.loadedTiles / gp.totalTiles) * 100)))
            : 0;
          const isError = !catalogs.gaiaLoading && gp.status === 'error';
          const stripCls = isError
            ? theme === 'white'
              ? 'bg-amber-50/95 border-amber-200 text-amber-800'
              : theme === 'red'
              ? 'bg-[#250404] border-[#6B1111] text-[#FCA5A5]'
              : 'bg-amber-950/45 border-amber-500/35 text-amber-200'
            : theme === 'white'
            ? 'bg-sky-50/90 border-sky-200 text-sky-900'
            : theme === 'red'
            ? 'bg-[#1C0303] border-[#5A1212] text-[#FCA5A5]'
            : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200';
          const trackCls =
            theme === 'white'
              ? 'bg-sky-200/80'
              : theme === 'red'
              ? 'bg-[#3A0707]'
              : 'bg-slate-800/90';
          const barCls =
            theme === 'white'
              ? 'bg-sky-600'
              : theme === 'red'
              ? 'bg-[#EF4444]'
              : 'bg-cyan-400';

          return (
            <div
              role="status"
              aria-live="polite"
              className={`px-2.5 py-1.5 border-b shrink-0 space-y-1 text-[10px] tracking-[-0.04em] ${stripCls}`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5 min-w-0 font-medium truncate">
                  {isError ? (
                    <CloudAlert className="w-3 h-3 shrink-0" />
                  ) : (
                    <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                  )}
                  <span className="truncate">
                    {isError
                      ? 'Gaia DR3 응답 지연'
                      : isTileProgress
                      ? `Gaia DR3 타일 로딩 (${gp.loadedTiles}/${gp.totalTiles})`
                      : 'Gaia DR3 심층 별 로딩 중...'}
                  </span>
                </span>
                {isError ? (
                  <button
                    type="button"
                    onClick={() => retryGaiaLiveFetch()}
                    className={`px-1.5 py-0.5 border text-[9.5px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${ui.buttonIdle}`}
                    style={{ borderRadius: '4px' }}
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>재시도</span>
                  </button>
                ) : (
                  <span className="font-mono text-[9.5px] tabular-nums shrink-0 opacity-85">
                    {gp.loadedStars > 0
                      ? `${gp.loadedStars.toLocaleString()}개`
                      : `≤${gp.targetMag.toFixed(1)}m`}
                  </span>
                )}
              </div>
              {!isError && (
                <div className={`w-full h-1 rounded-full overflow-hidden ${trackCls}`}>
                  {isTileProgress ? (
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 ease-out ${barCls}`}
                      style={{ width: `${pct}%` }}
                    />
                  ) : (
                    <div className={`h-full rounded-full gaia-progress-indeterminate ${barCls}`} />
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {/* Explore Tab: 7-Category Segmented Bar + Search + Sort + Full-Height Card List */}
      {tab === 'explore' ? (
        <div className="flex-1 flex flex-col min-h-0 p-2 gap-2 text-[11px] tracking-[-0.04em]">
          {/* 7-Category Segmented Bar ('별' right before '메시에') */}
          <div className={`flex items-center gap-0.5 p-0.5 border rounded-lg shrink-0 ${segTrackCls}`}>
            {(
              [
                { id: 'all', label: '전체' },
                { id: 'star', label: '별' },
                { id: 'messier', label: '메시에' },
                { id: 'caldwell', label: '콜드웰' },
                { id: 'ngcic', label: 'NGC/IC' },
                { id: 'solar', label: '태양계' },
                { id: 'constellation', label: '별자리' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setExploreCategory(cat.id);
                  setQuery('');
                  onSearchActiveChange(cat.id === 'ngcic');
                }}
                className={`flex-auto py-1.5 px-1 text-[9.5px] tracking-[-0.07em] font-semibold rounded-md transition-colors whitespace-nowrap text-center cursor-pointer ${
                  exploreCategory === cat.id ? segActiveCls : segIdleCls
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative shrink-0">
            <Search className={`w-3.5 h-3.5 absolute left-2 top-2 pointer-events-none ${ui.textMuted}`} />
            <input
              type="text"
              name="celestial-search-query"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                onSearchActiveChange(
                  exploreCategory === 'ngcic' ||
                    val.replace(/[\u200B-\u200D\uFEFF\u3164]/g, '').trim().length > 0
                );
              }}
              placeholder={searchPlaceholder}
              className={`w-full pl-7 ${query.length > 0 ? 'pr-6' : 'pr-2'} py-1.5 border text-[11px] tracking-[-0.04em] rounded-md ${ui.input}`}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  onSearchActiveChange(exploreCategory === 'ngcic');
                }}
                title="검색어 지우기"
                aria-label="검색어 지우기"
                className={`absolute right-1.5 top-1.5 p-0.5 rounded transition-colors cursor-pointer ${ui.textMuted} hover:${ui.textPrimary}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Star (항성) Sub-Category Filter Chips */}
          {exploreCategory === 'star' && (
            <div className="grid grid-cols-4 gap-1 shrink-0">
              {(
                [
                  { id: 'all', label: '전체' },
                  { id: 'named', label: '고유명' },
                  { id: 'bayer', label: '바이어' },
                  { id: 'viewport', label: '현재창' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStarFilter(chip.id)}
                  className={`py-1 px-1 border text-[10px] tracking-[-0.05em] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    starFilter === chip.id ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* NGC/IC Sub-Category Filter Chips */}
          {exploreCategory === 'ngcic' && (
            <div className="grid grid-cols-3 gap-1 shrink-0">
              {(
                [
                  { id: 'all', label: '전체' },
                  { id: 'ngc', label: 'NGC' },
                  { id: 'ic', label: 'IC' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setNgcIcFilter(chip.id)}
                  className={`py-1 px-1 border text-[10px] tracking-[-0.04em] font-medium whitespace-nowrap transition-colors ${
                    ngcIcFilter === chip.id ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Solar System Sub-Category Filter Chips */}
          {exploreCategory === 'solar' && (
            <div className="grid grid-cols-3 gap-1 shrink-0">
              {(
                [
                  { id: 'all', label: '전체' },
                  { id: 'planet', label: '행성' },
                  { id: 'dwarf', label: '왜행성' },
                  { id: 'asteroid', label: '소행성' },
                  { id: 'comet', label: '혜성' },
                  { id: 'moon', label: '위성' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSolarGroupFilter(chip.id)}
                  className={`py-1 px-0.5 border text-[9.5px] tracking-[-0.06em] font-medium whitespace-nowrap transition-colors ${
                    solarGroupFilter === chip.id ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Search & List Sort Bar */}
          {(exploreCategory !== 'all' || cleanQuery.length > 0) && (
            <div className="flex items-center gap-0.5 shrink-0">
              {(
                [
                  { id: 'default', label: '기본' },
                  { id: 'category', label: '분류별' },
                  { id: 'constellation', label: '별자리순' },
                  { id: 'name', label: '이름순' },
                  { id: 'mag', label: '밝기순' },
                  { id: 'alt', label: '고도순' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectExploreSort(opt.id)}
                  className={`flex-auto py-1 px-0.5 border text-[9px] tracking-[-0.07em] font-medium whitespace-nowrap text-center transition-colors cursor-pointer ${
                    exploreSort === opt.id ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                  title={`${opt.label} 정렬${exploreSort === opt.id && opt.id !== 'default' ? ' (다시 클릭하여 순서 반전)' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
              {exploreSort !== 'default' && (
                <button
                  type="button"
                  onClick={() =>
                    setExploreSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                  }
                  title={exploreSortDir === 'asc' ? '오름차순 (클릭하여 내림차순)' : '내림차순 (클릭하여 오름차순)'}
                  className={`px-1 py-1 border shrink-0 flex items-center justify-center transition-colors cursor-pointer ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  {exploreSortDir === 'asc' ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* Scrollable Card List */}
          <div
            ref={exploreListRef}
            className="flex-1 min-h-0 overflow-y-auto astro-scroll space-y-1.5 pr-0.5"
          >
            {exploreCategory === 'all' && !cleanQuery && localStarState.totalStars > 0 && (
              <div className={`p-2 border rounded-lg space-y-1.5 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-semibold text-[10.5px] ${ui.textPrimary}`}>
                    로컬 별 목록 빠른 검색
                  </span>
                  <span className={`font-mono text-[9.5px] tabular-nums ${ui.accentText}`}>
                    {localStarState.totalStars.toLocaleString()}개
                  </span>
                </div>
                <div className={`text-[9.5px] leading-relaxed ${ui.textMuted}`}>
                  현재창, HIP · Gaia ID, 좌표(예: 05h 35m -05° 23&apos;), 등급(예: 10등급, 9~11m)으로 즉시 검색할 수 있습니다.
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('현재창');
                      onSearchActiveChange(true);
                    }}
                    className={`px-1.5 py-0.5 border rounded text-[9.5px] font-medium transition-colors cursor-pointer ${ui.buttonActive}`}
                  >
                    현재창
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('로컬');
                      onSearchActiveChange(true);
                    }}
                    className={`px-1.5 py-0.5 border rounded text-[9.5px] font-medium transition-colors cursor-pointer ${ui.buttonIdle}`}
                  >
                    시야 주변 로컬별
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('10등급');
                      onSearchActiveChange(true);
                    }}
                    className={`px-1.5 py-0.5 border rounded text-[9.5px] font-medium transition-colors cursor-pointer ${ui.buttonIdle}`}
                  >
                    10등급대
                  </button>
                  {localStarState.installedTiers.map((pack) => (
                    <button
                      key={pack.tier}
                      type="button"
                      onClick={() => {
                        setQuery(`${pack.tier}단계`);
                        onSearchActiveChange(true);
                      }}
                      className={`px-1.5 py-0.5 border rounded text-[9.5px] font-medium transition-colors cursor-pointer ${ui.buttonIdle}`}
                    >
                      {pack.tier}단계
                    </button>
                  ))}
                </div>
              </div>
            )}
            {exploreCategory === 'all' && !cleanQuery && localStarState.totalStars === 0 && (
              <div key="all-empty-quick" className={`p-2 border rounded-lg space-y-1.5 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-semibold text-[10.5px] ${ui.textPrimary}`}>
                    빠른 탐색
                  </span>
                </div>
                <div className={`text-[9.5px] leading-relaxed ${ui.textMuted}`}>
                  &apos;현재창&apos;을 입력하면 현재 성도 구도 안에 보이는 모든 항성을 등급순으로 검색합니다.
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('현재창');
                      onSearchActiveChange(true);
                    }}
                    className={`px-1.5 py-0.5 border rounded text-[9.5px] font-medium transition-colors cursor-pointer ${ui.buttonActive}`}
                  >
                    현재창
                  </button>
                </div>
              </div>
            )}
            {exploreCategory === 'all' && cleanQuery.length > 0 && (
              <div key="all-search-results" className="space-y-1.5">
                <div className={`flex items-center justify-between px-0.5 text-[9.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                  <span>
                    {allSearchResults.isViewportMode
                      ? `현재창 구도 내 항성 ${allSearchResults.totalMatches.toLocaleString()}개 (≤${allSearchResults.viewportMagLimit.toFixed(1)}m)`
                      : `통합 검색 결과 ${allSearchResults.totalMatches.toLocaleString()}건`}
                  </span>
                  {allSearchResults.totalMatches > allSearchResults.items.length && (
                    <span className="font-mono">
                      상위 {allSearchResults.items.length}
                    </span>
                  )}
                </div>

                {allSearchResults.items.length === 0 ? (
                  <div className={`py-8 text-center ${ui.textMuted}`}>
                    {gaiaSearching ? 'Gaia DR3 목록을 조회하는 중...' : '일치하는 천체가 없습니다.'}
                  </div>
                ) : (
                  allSearchResults.items.map((item, idx) => {
                    const getGroupLabel = (target: GlobalSearchItem): string | null => {
                      if (exploreSort === 'category') {
                        return allSearchResults.isViewportMode
                          ? target.kind === 'star'
                            ? STAR_CATEGORY_INFO(target.star, target.sourceBadge).label
                            : GLOBAL_CATEGORY_INFO(target).label
                          : GLOBAL_CATEGORY_INFO(target).label;
                      }
                      if (exploreSort === 'constellation') {
                        return getConstellationSortInfo(getGlobalItemConAbbr(target)).label;
                      }
                      return null;
                    };
                    const groupLabel = getGroupLabel(item);
                    const prevItem = idx > 0 ? allSearchResults.items[idx - 1] : null;
                    const prevGroupLabel = prevItem ? getGroupLabel(prevItem) : null;
                    const catHeader =
                      groupLabel && groupLabel !== prevGroupLabel ? (
                        <div
                          className={`pt-1.5 pb-0.5 px-1 text-[9.5px] font-semibold tracking-[-0.04em] ${ui.accentText}`}
                        >
                          {groupLabel}
                        </div>
                      ) : null;
                    const wrapWithCat = (node: React.ReactNode) => (
                      <React.Fragment key={item.key}>
                        {catHeader}
                        {node}
                      </React.Fragment>
                    );
                    if (item.kind === 'planet') {
                      const { body } = item;
                      const isActive = selected?.kind === 'planet' && selected.data.id === body.id;
                      const hz = equatorialToHorizontal(body.ra, body.dec, lstDeg, observer.lat);
                      const below = hz.altDeg < 0;
                      return wrapWithCat(
                        <button
                          type="button"
                          onClick={() => jumpToPlanet(body)}
                          className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                            isActive ? cardActiveCls : cardIdleCls
                          } ${below ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={`px-1 py-[1px] border rounded text-[9px] leading-tight font-medium shrink-0 ${
                                  below ? belowHorizonBadgeCls : badgeCls
                                }`}
                              >
                                태양계
                              </span>
                              <span
                                className={`font-mono font-bold shrink-0 ${
                                  below ? belowHorizonTextCls : ui.accentText
                                }`}
                              >
                                {body.symbol}
                              </span>
                              <span
                                className={`font-semibold truncate tracking-[-0.04em] ${
                                  below ? belowHorizonTextCls : ui.textPrimary
                                }`}
                              >
                                {formatObjectDisplayName(body.koName, body.name, body.id, nameLang)}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                                below ? belowHorizonSubCls : ui.textMuted
                              }`}
                            >
                              {body.mag.toFixed(1)}m
                            </span>
                          </div>
                          <div
                            className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            {body.category} · 고도 {hz.altDeg.toFixed(1)}° · {formatCompactRaDec(body.ra, body.dec)}
                          </div>
                        </button>
                      );
                    }

                    if (item.kind === 'constellation') {
                      const { con } = item;
                      const isActive = activeConAbbr === con.abbr;
                      const hz = equatorialToHorizontal(con.ra, con.dec, lstDeg, observer.lat);
                      const below = hz.altDeg < 0;
                      const conTitle = formatObjectDisplayName(con.koName, con.name, con.abbr, nameLang);
                      return wrapWithCat(
                        <button
                          type="button"
                          onClick={() => jumpToConstellation(con)}
                          className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                            isActive ? cardActiveCls : cardIdleCls
                          } ${below ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={`px-1 py-[1px] border rounded text-[9px] leading-tight font-medium shrink-0 ${
                                  below ? belowHorizonBadgeCls : badgeCls
                                }`}
                              >
                                별자리
                              </span>
                              <span
                                className={`font-mono font-bold shrink-0 ${
                                  below ? belowHorizonTextCls : ui.accentText
                                }`}
                              >
                                {con.abbr}
                              </span>
                              <span
                                title={conTitle}
                                className={`font-semibold truncate tracking-[-0.04em] ${
                                  below ? belowHorizonTextCls : ui.textPrimary
                                }`}
                              >
                                {conTitle}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            IAU 별자리 · {formatCompactRaDec(con.ra, con.dec)}
                          </div>
                        </button>
                      );
                    }

                    if (item.kind === 'star') {
                      const { star } = item;
                      const isActive = selected?.kind === 'star' && selected.data.id === star.id;
                      const hz = equatorialToHorizontal(star.ra, star.dec, lstDeg, observer.lat);
                      const below = hz.altDeg < 0;
                      const primaryTitle = formatObjectDisplayName(
                        star.koName,
                        star.name,
                        star.bayer || star.id,
                        nameLang
                      );
                      const subInfo = [
                        item.detail,
                        star.bayer,
                        star.hip && !primaryTitle.includes(`HIP ${star.hip}`) ? `HIP ${star.hip}` : undefined,
                        star.con || undefined,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return wrapWithCat(
                        <button
                          type="button"
                          onClick={() => jumpToStar(star)}
                          className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                            isActive ? cardActiveCls : cardIdleCls
                          } ${below ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={`px-1 py-[1px] border rounded text-[9px] leading-tight font-medium shrink-0 ${
                                  below ? belowHorizonBadgeCls : badgeCls
                                }`}
                              >
                                {item.sourceBadge || '항성'}
                              </span>
                              <span
                                title={primaryTitle}
                                className={`font-semibold truncate tracking-[-0.04em] ${
                                  below ? belowHorizonTextCls : ui.textPrimary
                                }`}
                              >
                                {primaryTitle}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                                below ? belowHorizonSubCls : ui.textMuted
                              }`}
                            >
                              {star.mag.toFixed(2)}m
                            </span>
                          </div>
                          <div
                            className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            {subInfo ? `${subInfo} · ` : ''}
                            {formatCompactRaDec(star.ra, star.dec)}
                          </div>
                        </button>
                      );
                    }

                    if (item.kind === 'double') {
                      const { sys } = item;
                      const isActive = selected?.kind === 'double' && selected.data.id === sys.id;
                      const hz = equatorialToHorizontal(sys.ra, sys.dec, lstDeg, observer.lat);
                      const below = hz.altDeg < 0;
                      const title = formatObjectDisplayName(
                        sys.koName,
                        sys.name,
                        sys.bayer || sys.disc,
                        nameLang
                      );
                      return wrapWithCat(
                        <button
                          type="button"
                          onClick={() => jumpToDouble(sys)}
                          className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                            isActive ? cardActiveCls : cardIdleCls
                          } ${below ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={`px-1 py-[1px] border rounded text-[9px] leading-tight font-medium shrink-0 ${
                                  below ? belowHorizonBadgeCls : badgeCls
                                }`}
                              >
                                {sys.isMultiple ? `다중 ${sys.compCount}성` : '이중성'}
                              </span>
                              <span
                                title={title}
                                className={`font-semibold truncate tracking-[-0.04em] ${
                                  below ? belowHorizonTextCls : ui.textPrimary
                                }`}
                              >
                                {title}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                                below ? belowHorizonSubCls : ui.textMuted
                              }`}
                            >
                              {sys.mag1.toFixed(1)}/{sys.mag2.toFixed(1)}m
                            </span>
                          </div>
                          <div
                            className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            {sys.disc} · 이격 {sys.sep.toFixed(1)}″ · PA {sys.pa}°
                          </div>
                        </button>
                      );
                    }

                    const { dso, badge, primaryId, secondaryId } = item;
                    const isActive =
                      selected?.kind === 'dso' &&
                      (selected.data.id === dso.id || selected.data.altId === primaryId);
                    const hz = equatorialToHorizontal(dso.ra, dso.dec, lstDeg, observer.lat);
                    const below = hz.altDeg < 0;
                    const dsoTitle = formatObjectDisplayName(
                      dso.koName,
                      dso.name,
                      secondaryId || dso.id,
                      nameLang
                    );
                    return wrapWithCat(
                      <button
                        type="button"
                        onClick={() => jumpToDso(dso)}
                        className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                          isActive ? cardActiveCls : cardIdleCls
                        } ${below ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className={`px-1 py-[1px] border rounded text-[9px] leading-tight font-medium shrink-0 ${
                                below ? belowHorizonBadgeCls : badgeCls
                              }`}
                            >
                              {badge}
                            </span>
                            <span
                              className={`font-mono font-bold shrink-0 ${
                                below ? belowHorizonTextCls : ui.accentText
                              }`}
                            >
                              {primaryId}
                            </span>
                            <span
                              title={dsoTitle}
                              className={`font-semibold truncate tracking-[-0.04em] ${
                                below ? belowHorizonTextCls : ui.textPrimary
                              }`}
                            >
                              {dsoTitle}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            {dso.mag < 90 ? `${dso.mag.toFixed(1)}m` : dso.type}
                          </span>
                        </div>
                        <div
                          className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                            below ? belowHorizonSubCls : ui.textMuted
                          }`}
                        >
                          {secondaryId ? `${secondaryId} · ` : ''}
                          {dso.con ? `${dso.con} · ` : ''}
                          {formatCompactRaDec(dso.ra, dso.dec)}
                        </div>
                      </button>
                    );
                  })
                )}
                {allSearchResults.isViewportMode &&
                  allSearchResults.items.length < allSearchResults.totalMatches &&
                  allSearchResults.items.length < 3000 && (
                    <button
                      type="button"
                      onClick={() => setViewportResultLimit((prev) => Math.min(3000, prev + 200))}
                      className={`w-full py-1.5 px-2 border rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${ui.buttonIdle}`}
                    >
                      더 보기 ({allSearchResults.items.length.toLocaleString()} /{' '}
                      {allSearchResults.totalMatches.toLocaleString()})
                    </button>
                  )}
              </div>
            )}

            {exploreCategory === 'star' && (
              <>
                <div className={`flex items-center justify-between px-0.5 text-[9.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                  <span>
                    {filteredStars.isViewportMode
                      ? `현재창 구도 내 항성 ${filteredStars.totalMatches.toLocaleString()}개 (≤${filteredStars.viewportMagLimit.toFixed(1)}m)`
                      : `항성 ${filteredStars.totalMatches.toLocaleString()}개`}
                  </span>
                  {filteredStars.totalMatches > filteredStars.items.length && (
                    <span className="font-mono">
                      상위 {filteredStars.items.length}
                    </span>
                  )}
                </div>

                {filteredStars.items.length === 0 ? (
                  <div className={`py-8 text-center ${ui.textMuted}`}>
                    {gaiaSearching ? 'Gaia DR3 목록을 조회하는 중...' : '일치하는 항성이 없습니다.'}
                  </div>
                ) : (
                  filteredStars.items.map((entry, idx) => {
                    const { star } = entry;
                    const isActive = selected?.kind === 'star' && selected.data.id === star.id;
                    const hz = equatorialToHorizontal(star.ra, star.dec, lstDeg, observer.lat);
                    const below = hz.altDeg < 0;
                    const primaryTitle = formatObjectDisplayName(
                      star.koName,
                      star.name,
                      star.bayer || star.id,
                      nameLang
                    );
                    const subInfo = [
                      entry.detail,
                      star.bayer && !primaryTitle.includes(star.bayer) ? star.bayer : undefined,
                      star.hip && !primaryTitle.includes(`HIP ${star.hip}`) ? `HIP ${star.hip}` : undefined,
                      star.con || undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    const groupLabel =
                      exploreSort === 'category'
                        ? STAR_CATEGORY_INFO(star, entry.sourceBadge).label
                        : exploreSort === 'constellation'
                        ? getConstellationSortInfo(star.con).label
                        : null;
                    const prevGroupLabel =
                      idx > 0
                        ? exploreSort === 'category'
                          ? STAR_CATEGORY_INFO(
                              filteredStars.items[idx - 1].star,
                              filteredStars.items[idx - 1].sourceBadge
                            ).label
                          : exploreSort === 'constellation'
                          ? getConstellationSortInfo(filteredStars.items[idx - 1].star.con).label
                          : null
                        : null;
                    const showCatHeader = Boolean(groupLabel && groupLabel !== prevGroupLabel);
                    return (
                      <React.Fragment key={entry.key}>
                        {showCatHeader && (
                          <div
                            className={`pt-1.5 pb-0.5 px-1 text-[9.5px] font-semibold tracking-[-0.04em] ${ui.accentText}`}
                          >
                            {groupLabel}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => jumpToStar(star)}
                          className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                            isActive ? cardActiveCls : cardIdleCls
                          } ${below ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={`px-1 py-[1px] border rounded text-[9px] leading-tight font-medium shrink-0 ${
                                  below ? belowHorizonBadgeCls : badgeCls
                                }`}
                              >
                                {entry.sourceBadge || '항성'}
                              </span>
                              <span
                                title={primaryTitle}
                                className={`font-semibold truncate tracking-[-0.04em] ${
                                  below ? belowHorizonTextCls : ui.textPrimary
                                }`}
                              >
                                {primaryTitle}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                                below ? belowHorizonSubCls : ui.textMuted
                              }`}
                            >
                              {star.mag.toFixed(2)}m
                            </span>
                          </div>
                          <div
                            className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            {subInfo ? `${subInfo} · ` : ''}
                            {formatCompactRaDec(star.ra, star.dec)}
                          </div>
                        </button>
                      </React.Fragment>
                    );
                  })
                )}

                {filteredStars.items.length < filteredStars.totalMatches &&
                  filteredStars.items.length < 3000 && (
                    <button
                      type="button"
                      onClick={() => setViewportResultLimit((prev) => Math.min(3000, prev + 200))}
                      className={`w-full py-1.5 px-2 border rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${ui.buttonIdle}`}
                    >
                      더 보기 ({filteredStars.items.length.toLocaleString()} /{' '}
                      {filteredStars.totalMatches.toLocaleString()})
                    </button>
                  )}
              </>
            )}

            {exploreCategory === 'messier' &&
              (filteredMessier.length === 0 ? (
                <div className={`py-8 text-center ${ui.textMuted}`}>
                  일치하는 메시에 천체가 없습니다.
                </div>
              ) : (
                filteredMessier.map((dso) => {
                  const isActive = selected?.kind === 'dso' && selected.data.id === dso.id;
                  const hz = equatorialToHorizontal(dso.ra, dso.dec, lstDeg, observer.lat);
                  const below = hz.altDeg < 0;
                  const secDesignations = getSecondaryDesignations(dso.id, dso.altId);
                  const dsoTitle = formatObjectDisplayName(dso.koName, dso.name, dso.id, nameLang);
                  return (
                    <button
                      key={dso.id}
                      type="button"
                      onClick={() => jumpToDso(dso)}
                      className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                        isActive ? cardActiveCls : cardIdleCls
                      } ${below ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className={`font-mono font-bold shrink-0 ${
                              below ? belowHorizonTextCls : ui.accentText
                            }`}
                          >
                            {dso.id}
                          </span>
                          <span
                            title={dsoTitle}
                            className={`font-semibold truncate tracking-[-0.04em] ${
                              below ? belowHorizonTextCls : ui.textPrimary
                            }`}
                          >
                            {dsoTitle}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                            below ? belowHorizonSubCls : ui.textMuted
                          }`}
                        >
                          {dso.mag.toFixed(1)}m
                        </span>
                      </div>
                      <div
                        className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                          below ? belowHorizonSubCls : ui.textMuted
                        }`}
                      >
                        {secDesignations.length > 0 ? `${secDesignations.join(' · ')} · ` : ''}
                        {dso.con} · {formatCompactRaDec(dso.ra, dso.dec)}
                      </div>
                    </button>
                  );
                })
              ))}

            {exploreCategory === 'caldwell' &&
              (filteredCaldwell.length === 0 ? (
                <div className={`py-8 text-center ${ui.textMuted}`}>
                  일치하는 콜드웰 천체가 없습니다.
                </div>
              ) : (
                filteredCaldwell.map((entry) => {
                  const isActive =
                    selected?.kind === 'dso' &&
                    (selected.data.id === entry.id || selected.data.altId === entry.caldwellId);
                  const hz = equatorialToHorizontal(entry.ra, entry.dec, lstDeg, observer.lat);
                  const below = hz.altDeg < 0;
                  const secDesignations = getSecondaryDesignations(entry.caldwellId, entry.id);
                  const entryTitle = formatObjectDisplayName(
                    entry.koName,
                    entry.name,
                    formatCatalogCode(entry.id),
                    nameLang
                  );
                  return (
                    <button
                      key={entry.caldwellId}
                      type="button"
                      onClick={() => jumpToDso(entry)}
                      className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                        isActive ? cardActiveCls : cardIdleCls
                      } ${below ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className={`font-mono font-bold shrink-0 ${
                              below ? belowHorizonTextCls : ui.accentText
                            }`}
                          >
                            {entry.caldwellId}
                          </span>
                          <span
                            title={entryTitle}
                            className={`font-semibold truncate tracking-[-0.04em] ${
                              below ? belowHorizonTextCls : ui.textPrimary
                            }`}
                          >
                            {entryTitle}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                            below ? belowHorizonSubCls : ui.textMuted
                          }`}
                        >
                          {entry.mag.toFixed(1)}m
                        </span>
                      </div>
                      <div
                        className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                          below ? belowHorizonSubCls : ui.textMuted
                        }`}
                      >
                        {secDesignations.length > 0
                          ? secDesignations.join(' · ')
                          : formatCatalogCode(entry.id)}{' '}
                        · {entry.con} · {formatCompactRaDec(entry.ra, entry.dec)}
                      </div>
                    </button>
                  );
                })
              ))}

            {exploreCategory === 'ngcic' && (
              <>
                <div className={`flex items-center justify-between px-0.5 text-[9.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                  <span>
                    {query.trim()
                      ? `NGC/IC 검색 ${filteredNgcIc.totalMatches.toLocaleString()}건`
                      : `NGC/IC ${filteredNgcIc.totalMatches.toLocaleString()}개 · 밝기순`}
                  </span>
                  <span className="font-mono">
                    {!catalogs.deepDsosLoaded
                      ? '심층 로딩...'
                      : filteredNgcIc.totalMatches > 100
                      ? '상위 100'
                      : ''}
                  </span>
                </div>

                {filteredNgcIc.items.length === 0 ? (
                  <div className={`py-8 text-center ${ui.textMuted}`}>
                    일치하는 NGC/IC 천체가 없습니다.
                  </div>
                ) : (
                  filteredNgcIc.items.map((item) => {
                    const { dso, displayId, crossId } = item;
                    const isActive =
                      selected?.kind === 'dso' &&
                      (selected.data.id === dso.id ||
                        selected.data.id.replace(/\s+/g, '').toUpperCase() === item.key);
                    const hz = equatorialToHorizontal(dso.ra, dso.dec, lstDeg, observer.lat);
                    const below = hz.altDeg < 0;
                    const ngcTitle = formatObjectDisplayName(
                      dso.koName,
                      dso.name,
                      crossId || dso.type,
                      nameLang
                    );
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => jumpToDso(dso)}
                        className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                          isActive ? cardActiveCls : cardIdleCls
                        } ${below ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className={`font-mono font-bold shrink-0 ${
                                below ? belowHorizonTextCls : ui.accentText
                              }`}
                            >
                              {displayId}
                            </span>
                            <span
                              title={ngcTitle}
                              className={`font-semibold truncate tracking-[-0.04em] ${
                                below ? belowHorizonTextCls : ui.textPrimary
                              }`}
                            >
                              {ngcTitle}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums shrink-0 ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            {dso.mag < 90 ? `${dso.mag.toFixed(1)}m` : dso.type}
                          </span>
                        </div>
                        <div
                          className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                            below ? belowHorizonSubCls : ui.textMuted
                          }`}
                        >
                          {crossId ? `${crossId} · ` : ''}
                          {dso.type} · {dso.con ? `${dso.con} · ` : ''}
                          {formatCompactRaDec(dso.ra, dso.dec)}
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {exploreCategory === 'solar' && (
              <>
                {solarGroupFilter === 'comet' && (
                  <div
                    className={`mb-1.5 px-2 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 text-[10px] ${
                      theme === 'white'
                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                        : theme === 'red'
                        ? 'bg-[#1a0505] border-red-950/70 text-red-400/90'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="font-mono tabular-nums truncate">
                      표시 {cometFilterCounts.visible}/{cometFilterCounts.total} · ≤
                      {(layers.cometMaxMag ?? 15.0).toFixed(1)}m
                      {layers.cometHideBelowHorizon ? ' · 지평선 위' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('layers');
                        setOpenSections((prev) => ({ ...prev, layers_solar: true }));
                      }}
                      className={`shrink-0 px-1.5 py-0.5 rounded border text-[9.5px] font-medium transition-colors cursor-pointer ${
                        theme === 'white'
                          ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          : theme === 'red'
                          ? 'bg-[#250707] border-red-900/70 text-red-300 hover:bg-[#350a0a]'
                          : 'bg-slate-800/80 border-slate-700 text-cyan-300 hover:bg-slate-700/80'
                      }`}
                    >
                      필터 설정
                    </button>
                  </div>
                )}

                {filteredSolar.length === 0 ? (
                  <div className={`py-8 text-center space-y-2 ${ui.textMuted}`}>
                    <div>
                      {solarGroupFilter === 'comet'
                        ? '현재 필터 조건에 해당하는 혜성이 없습니다.'
                        : '일치하는 태양계 천체가 없습니다.'}
                    </div>
                    {solarGroupFilter === 'comet' && cometFilterCounts.total > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onChangeLayers((p) => ({
                            ...p,
                            cometObservableOnly: false,
                            cometMaxMag: 18.0,
                            cometHideBelowHorizon: false,
                            cometHideNearSun: false,
                          }))
                        }
                        className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10.5px] font-medium transition-colors cursor-pointer ${
                          theme === 'white'
                            ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            : theme === 'red'
                            ? 'bg-[#250707] border-red-900/70 text-red-300 hover:bg-[#350a0a]'
                            : 'bg-slate-800/90 border-slate-700 text-cyan-300 hover:bg-slate-700'
                        }`}
                      >
                        혜성 필터 모두 해제 (전체 보기)
                      </button>
                    )}
                  </div>
                ) : (
                  filteredSolar.map((body) => {
                    const isActive = selected?.kind === 'planet' && selected.data.id === body.id;
                    const isNestedMoon =
                      solarGroupFilter === 'all' && body.group === 'moon' && body.id !== 'Moon';
                    const hz = equatorialToHorizontal(body.ra, body.dec, lstDeg, observer.lat);
                    const below = hz.altDeg < 0;
                    const nearSunWarn = isCometNearSunWarning(body);
                    return (
                      <div key={body.id} className={isNestedMoon ? 'pl-3' : undefined}>
                        <button
                          type="button"
                          onClick={() => jumpToPlanet(body)}
                          className={`w-full text-left px-2 border rounded-lg transition-colors ${
                            isNestedMoon ? 'py-1.5' : 'py-2'
                          } ${isActive ? cardActiveCls : cardIdleCls} ${
                            below ? 'opacity-70' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              {isNestedMoon && (
                                <span
                                  aria-hidden="true"
                                  className={`font-mono text-[10px] shrink-0 ${
                                    below ? belowHorizonSubCls : ui.textMuted
                                  }`}
                                >
                                  └
                                </span>
                              )}
                              <span
                                className={`font-mono font-bold shrink-0 ${
                                  below ? belowHorizonTextCls : ui.accentText
                                }`}
                              >
                                {body.symbol}
                              </span>
                              <span
                                title={formatObjectDisplayName(body.koName, body.name, body.id, nameLang)}
                                className={`font-semibold truncate tracking-[-0.04em] ${
                                  below ? belowHorizonTextCls : ui.textPrimary
                                }`}
                              >
                                {formatObjectDisplayName(body.koName, body.name, body.id, nameLang)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {nearSunWarn && (
                                <span
                                  title={`태양 이각 ${body.elongationDeg.toFixed(1)}° (태양 근접 주의)`}
                                  className={`px-1 py-0.5 rounded text-[9px] font-medium leading-none ${
                                    theme === 'white'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : theme === 'red'
                                      ? 'bg-red-950/90 text-red-300 border border-red-800/80'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  }`}
                                >
                                  태양근접
                                </span>
                              )}
                              <span
                                className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums ${
                                  below ? belowHorizonSubCls : ui.textMuted
                                }`}
                              >
                                {body.mag.toFixed(1)}m
                              </span>
                            </div>
                          </div>
                          <div
                            className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                              below ? belowHorizonSubCls : ui.textMuted
                            }`}
                          >
                            {body.category} · 고도 {hz.altDeg.toFixed(1)}° ·{' '}
                            {formatCompactRaDec(body.ra, body.dec)}
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {exploreCategory === 'constellation' &&
              (filteredConstellations.length === 0 ? (
                <div className={`py-8 text-center ${ui.textMuted}`}>
                  일치하는 별자리가 없습니다.
                </div>
              ) : (
                filteredConstellations.map((con) => {
                  const isActive = activeConAbbr === con.abbr;
                  const hz = equatorialToHorizontal(con.ra, con.dec, lstDeg, observer.lat);
                  const below = hz.altDeg < 0;
                  return (
                    <button
                      key={con.abbr}
                      type="button"
                      onClick={() => {
                        setActiveConAbbr(con.abbr);
                        onChangeView((p) => ({
                          ...p,
                          ra: ((con.ra / 15) % 24 + 24) % 24,
                          dec: con.dec,
                          fsz: 45,
                        }));
                      }}
                      className={`w-full text-left px-2 py-2 border rounded-lg transition-colors ${
                        isActive ? cardActiveCls : cardIdleCls
                      } ${below ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className={`font-mono font-bold shrink-0 ${
                              below ? belowHorizonTextCls : ui.accentText
                            }`}
                          >
                            {con.abbr}
                          </span>
                          <span
                            title={formatObjectDisplayName(con.koName, con.name, con.abbr, nameLang)}
                            className={`font-semibold truncate tracking-[-0.04em] ${
                              below ? belowHorizonTextCls : ui.textPrimary
                            }`}
                          >
                            {formatObjectDisplayName(con.koName, con.name, con.abbr, nameLang)}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`mt-0.5 font-mono text-[10px] tracking-[-0.05em] tabular-nums truncate ${
                          below ? belowHorizonSubCls : ui.textMuted
                        }`}
                      >
                        IAU 별자리 · {formatCompactRaDec(con.ra, con.dec)}
                      </div>
                    </button>
                  );
                })
              ))}
          </div>
        </div>
      ) : (
      /* Scrollable Body for Layers / Optics / Observer Tabs */
      <div className="flex-1 overflow-y-auto astro-scroll px-2.5 py-3 space-y-4 text-[11px] tracking-[-0.04em]">

        {tab === 'layers' && (
          <>
            {/* 0. 관측 목록 강조 모드 (Observing List Highlight Mode) */}
            <div
              className={`p-1.5 border space-y-1.5 transition-colors ${
                layers.highlightSessionPlan
                  ? theme === 'white'
                    ? 'bg-amber-50 border-amber-300'
                    : theme === 'red'
                    ? 'bg-[#1D0404] border-[#7F1D1D]'
                    : 'bg-[#1A1408] border-[#784A12]'
                  : isSectionOpen('layers_highlight')
                  ? theme === 'white'
                    ? 'bg-sky-50/55 border-sky-200/80'
                    : theme === 'red'
                    ? 'bg-[#130202]/90 border-[#450A0A]'
                    : 'bg-[#0F1728]/85 border-cyan-500/25'
                  : ui.border
              }`}
              style={{ borderRadius: '6px' }}
            >
              <div
                className={`flex items-center justify-between gap-1.5 px-1.5 py-1 rounded-md border transition-colors ${
                  layers.highlightSessionPlan
                    ? isSectionOpen('layers_highlight')
                      ? theme === 'white'
                        ? 'bg-amber-200/75 border-amber-400 border-l-2 border-l-amber-600 hover:bg-amber-200'
                        : theme === 'red'
                        ? 'bg-[#360707] border-[#991B1B] border-l-2 border-l-[#FF5252] hover:bg-[#490A0A]'
                        : 'bg-amber-500/20 border-amber-500/50 border-l-2 border-l-amber-400 hover:bg-amber-500/30'
                      : theme === 'white'
                      ? 'bg-transparent border-transparent hover:bg-amber-100/90 hover:border-amber-300'
                      : theme === 'red'
                      ? 'bg-transparent border-transparent hover:bg-[#290505] hover:border-[#6B1414]'
                      : 'bg-transparent border-transparent hover:bg-amber-500/15 hover:border-amber-500/35'
                    : sectionHeaderCls(isSectionOpen('layers_highlight'))
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('layers_highlight')}
                  aria-expanded={isSectionOpen('layers_highlight')}
                  className="flex-1 flex items-center gap-1 min-w-0 text-left cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                      layers.highlightSessionPlan && isSectionOpen('layers_highlight')
                        ? theme === 'red'
                          ? 'text-[#FF5252]'
                          : theme === 'white'
                          ? 'text-amber-700'
                          : 'text-amber-400'
                        : sectionChevronCls(isSectionOpen('layers_highlight'))
                    } ${isSectionOpen('layers_highlight') ? '' : '-rotate-90'}`}
                  />
                  <Target
                    className={`w-3.5 h-3.5 shrink-0 ${
                      layers.highlightSessionPlan
                        ? theme === 'red'
                          ? 'text-[#FF3B3B]'
                          : 'text-amber-400'
                        : ui.textMuted
                    }`}
                  />
                  <span className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                    관측 목록 강조 모드
                  </span>
                </button>
                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                  <span
                    className={`font-mono text-[9.5px] tabular-nums whitespace-nowrap ${
                      layers.highlightSessionPlan
                        ? theme === 'red'
                          ? 'text-[#FF4D4D]'
                          : theme === 'white'
                          ? 'text-amber-700'
                          : 'text-amber-400'
                        : ui.textMuted
                    }`}
                  >
                    {sessionPlanCount}개
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.highlightSessionPlan}
                    onChange={(e) =>
                      onChangeLayers((p) => ({
                        ...p,
                        highlightSessionPlan: e.target.checked,
                      }))
                    }
                    className={`w-3.5 h-3.5 shrink-0 ${
                      theme === 'red' ? 'accent-red-600' : 'accent-amber-500'
                    }`}
                  />
                </label>
              </div>
              {(isSectionOpen('layers_highlight') || layers.highlightSessionPlan) && (
                <div className={`px-1 pt-1 pb-0.5 space-y-2 border-t ${ui.divider}`}>
                  {/* 진하기 슬라이더 */}
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        강조 표시 진하기
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {Math.round((layers.sessionPlanOpacity ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={layers.sessionPlanOpacity ?? 1}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          sessionPlanOpacity: Number(e.target.value),
                        }))
                      }
                      aria-label="관측 목록 강조 모드 진하기"
                      className={`w-full h-1.5 cursor-pointer ${
                        theme === 'red' ? 'accent-red-600' : 'accent-amber-500'
                      }`}
                    />
                  </div>

                  {/* 표시색 */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-[10px] whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                      표시색
                    </span>
                    <div className="flex items-center gap-1">
                      {['#F59E0B', '#38BDF8', '#34D399', '#A78BFA', '#FB7185', '#F97316'].map(
                        (hex) => {
                          const active =
                            (layers.sessionPlanColor || '#F59E0B').toUpperCase() === hex;
                          return (
                            <button
                              key={hex}
                              type="button"
                              onClick={() =>
                                onChangeLayers((p) => ({ ...p, sessionPlanColor: hex }))
                              }
                              title={`표시색 ${hex}`}
                              aria-label={`관측 목록 표시색 ${hex}`}
                              className={`w-3.5 h-3.5 rounded-full border transition-transform cursor-pointer ${
                                active
                                  ? 'scale-115 ring-1 ring-offset-1 ring-white/80 border-white'
                                  : 'border-white/25 hover:scale-110'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          );
                        }
                      )}
                      <input
                        type="color"
                        value={layers.sessionPlanColor || '#F59E0B'}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            sessionPlanColor: e.target.value.toUpperCase(),
                          }))
                        }
                        title="사용자 지정 표시색"
                        aria-label="관측 목록 사용자 지정 표시색"
                        className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer rounded"
                      />
                    </div>
                  </div>

                  {isSectionOpen('layers_highlight') && (
                    <p className={`text-[9.5px] tracking-[-0.04em] leading-snug break-keep ${ui.textMuted}`}>
                      {sessionPlanCount > 0
                        ? '오늘 밤 관측목록에 담긴 천체(별·행성·이중성·DSO)를 성도 위에 깔끔한 원으로 표시합니다.'
                        : '활성화 후 관측 목록에 대상을 추가하거나 .skylist를 불러오면 성도 위에 원으로 표시됩니다.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 1. 별자리 (Constellations) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_constellations')}
                aria-expanded={isSectionOpen('layers_constellations')}
                className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('layers_constellations')
                )}`}
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_constellations')
                    )} ${isSectionOpen('layers_constellations') ? '' : '-rotate-90'}`}
                  />
                  <span>별자리 (Constellations)</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.05em] tabular-nums whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                  88개 · {layers.constellationLineStyle === 'modern' ? 'IAU 843선' : '전통 695선'}
                </span>
              </button>

              {isSectionOpen('layers_constellations') && (
              <div className={`space-y-1.5 ${sectionBodyCls}`}>

              <div className="grid grid-cols-2 gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    onChangeLayers((p) => ({
                      ...p,
                      showConstellationLines: true,
                      constellationLineStyle: 'modern',
                    }))
                  }
                  className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium whitespace-nowrap shrink-0 ${
                    layers.showConstellationLines && layers.constellationLineStyle === 'modern'
                      ? ui.buttonActive
                      : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  현대 별자리선 (IAU)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChangeLayers((p) => ({
                      ...p,
                      showConstellationLines: true,
                      constellationLineStyle: 'traditional',
                    }))
                  }
                  className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium whitespace-nowrap shrink-0 ${
                    layers.showConstellationLines && layers.constellationLineStyle === 'traditional'
                      ? ui.buttonActive
                      : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  전통 별자리선 (고전)
                </button>
              </div>

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  별자리 선 (Stick Figures)
                </span>
                <input
                  type="checkbox"
                  checked={layers.showConstellationLines}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showConstellationLines: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  별자리 경계선 (IAU Boundaries)
                </span>
                <input
                  type="checkbox"
                  checked={layers.showConstellationBoundaries}
                  onChange={(e) =>
                    onChangeLayers((p) => ({
                      ...p,
                      showConstellationBoundaries: e.target.checked,
                    }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              <div className="flex items-center justify-between gap-1.5 py-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer min-w-0">
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    별자리 이름 라벨
                  </span>
                </label>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTab('settings')}
                    title="설정 탭의 성도 표기 설정에서 표기법(전통·약어·이름) 변경"
                    className={`px-1.5 py-0.5 border rounded text-[9.5px] tracking-[-0.04em] cursor-pointer ${ui.buttonIdle}`}
                  >
                    표기 설정
                  </button>
                  <input
                    type="checkbox"
                    checked={layers.showConstellationNames}
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, showConstellationNames: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              {(() => {
                const anyConstellationActive =
                  layers.showConstellationLines ||
                  layers.showConstellationBoundaries ||
                  layers.showConstellationNames;
                return (
                  <div
                    className={`pl-2 pt-0.5 pb-0.5 space-y-0.5 transition-opacity ${
                      anyConstellationActive ? '' : 'opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        별자리선 · 경계선 · 이름 진하기
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {Math.round(layers.constellationLineOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      disabled={!anyConstellationActive}
                      value={layers.constellationLineOpacity}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          constellationLineOpacity: Number(e.target.value),
                        }))
                      }
                      aria-label="별자리선, 경계선 및 이름 진하기"
                      className={`w-full h-1.5 accent-cyan-500 ${
                        anyConstellationActive ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    />
                  </div>
                );
              })()}

              {/* Independent Rendering Layer: Classical Constellation Art (IAU Boundary Clipped) */}
              {(() => {
                const artVisible =
                  layers.showConstellationArt ?? layers.constellationProjectionMode === 'classical';
                const artScope = layers.constellationArtScope ?? 'all';
                const artOpacity = layers.constellationArtOpacity ?? 0.45;
                return (
                  <div className={`pt-1.5 mt-1 border-t space-y-1 ${ui.divider}`}>
                    <div className="flex items-center justify-between gap-1.5 py-0.5">
                      <label className="flex items-center gap-1.5 cursor-pointer min-w-0">
                        <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                          별자리 그림 도안 투영
                        </span>
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setTab('settings')}
                          title="설정 탭의 성도 표기 설정 > 별자리 투영 모드 열기"
                          className={`px-1.5 py-0.5 border rounded text-[9.5px] tracking-[-0.04em] cursor-pointer ${ui.buttonIdle}`}
                        >
                          투영 모드
                        </button>
                        <input
                          type="checkbox"
                          checked={artVisible}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            onChangeLayers((p) => ({
                              ...p,
                              showConstellationArt: checked,
                              ...(checked ? { constellationProjectionMode: 'classical' as ConstellationProjectionMode } : {}),
                            }));
                          }}
                          className="w-3.5 h-3.5 shrink-0 [accent-color:var(--ui-accent)] cursor-pointer"
                        />
                      </div>
                    </div>

                    <div
                      className={`pl-2 pb-0.5 space-y-1 transition-opacity ${
                        artVisible ? '' : 'opacity-45 cursor-not-allowed'
                      }`}
                    >
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            { id: 'all' as const, label: '전체', title: '화면에 보이는 모든 별자리 도안 표시' },
                            { id: 'center' as const, label: '중심', title: '화면 중심에 해당하는 별자리 도안만 표시' },
                          ] as const
                        ).map((opt) => {
                          const active = artScope === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={!artVisible}
                              title={opt.title}
                              onClick={() =>
                                onChangeLayers((p) => ({
                                  ...p,
                                  constellationArtScope: opt.id,
                                }))
                              }
                              aria-pressed={active}
                              className={`py-0.5 px-1.5 border rounded text-[9.5px] font-medium whitespace-nowrap transition-colors ${
                                artVisible ? 'cursor-pointer' : 'cursor-not-allowed'
                              } ${active ? ui.buttonActive : ui.buttonIdle}`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                          별자리 그림 투영 진하기
                        </span>
                        <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                          {Math.round(artOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.05}
                        disabled={!artVisible}
                        value={artOpacity}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            constellationArtOpacity: Number(e.target.value),
                          }))
                        }
                        aria-label="별자리 그림 투영 진하기"
                        className={`w-full h-1.5 [accent-color:var(--ui-accent)] ${
                          artVisible ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>
                );
              })()}
              </div>
              )}
            </div>

            {/* 1.5. 태양계 (Solar System) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_solar')}
                aria-expanded={isSectionOpen('layers_solar')}
                className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('layers_solar')
                )}`}
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_solar')
                    )} ${isSectionOpen('layers_solar') ? '' : '-rotate-90'}`}
                  />
                  <span>태양계 (Solar System)</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.04em] tabular-nums whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                  {solarBodies.length} 천체
                </span>
              </button>

              {isSectionOpen('layers_solar') && (() => {
                const solarSubs: {
                  key:
                    | 'showSolarSun'
                    | 'showSolarPlanets'
                    | 'showSolarMoons'
                    | 'showSolarDwarfs'
                    | 'showSolarAsteroids'
                    | 'showSolarComets';
                  label: string;
                }[] = [
                  { key: 'showSolarSun', label: '태양' },
                  { key: 'showSolarPlanets', label: '행성' },
                  { key: 'showSolarMoons', label: '달·위성' },
                  { key: 'showSolarDwarfs', label: '왜소행성' },
                  { key: 'showSolarAsteroids', label: '소행성' },
                  { key: 'showSolarComets', label: '혜성' },
                ];
                const enabledCount = layers.showSolarSystem
                  ? solarSubs.filter((s) => layers[s.key] ?? true).length
                  : 0;
                const allSolarSelected = enabledCount === solarSubs.length;
                const partialSolarSelected = enabledCount > 0 && enabledCount < solarSubs.length;

                return (
              <div className={`space-y-1.5 ${sectionBodyCls}`}>

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`flex items-center gap-1.5 whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  <span>태양계 천체</span>
                  {partialSolarSelected && (
                    <span className={`font-mono text-[9px] tabular-nums ${ui.accentText}`}>
                      ({enabledCount}/{solarSubs.length})
                    </span>
                  )}
                </span>
                <input
                  ref={(el) => {
                    if (el) el.indeterminate = partialSolarSelected;
                  }}
                  type="checkbox"
                  checked={allSolarSelected}
                  onChange={() => {
                    const nextAll = !allSolarSelected;
                    onChangeLayers((p) => ({
                      ...p,
                      showSolarSystem: nextAll,
                      showSolarSun: nextAll,
                      showSolarPlanets: nextAll,
                      showSolarMoons: nextAll,
                      showSolarDwarfs: nextAll,
                      showSolarAsteroids: nextAll,
                      showSolarComets: nextAll,
                    }));
                  }}
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              <div className={`ml-1.5 pl-2.5 border-l ${ui.divider} grid grid-cols-2 gap-x-2.5 gap-y-1 py-0.5`}>
                {solarSubs.map((sub) => {
                  const subChecked = layers.showSolarSystem && (layers[sub.key] ?? true);
                  return (
                    <label
                      key={sub.key}
                      className="flex items-center justify-between gap-1 cursor-pointer text-[10.5px]"
                    >
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        {sub.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={subChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onChangeLayers((p) => {
                            const baseOn = p.showSolarSystem;
                            const nextState = {
                              showSolarSun: baseOn ? (p.showSolarSun ?? true) : false,
                              showSolarPlanets: baseOn ? (p.showSolarPlanets ?? true) : false,
                              showSolarMoons: baseOn ? (p.showSolarMoons ?? true) : false,
                              showSolarDwarfs: baseOn ? (p.showSolarDwarfs ?? true) : false,
                              showSolarAsteroids: baseOn ? (p.showSolarAsteroids ?? true) : false,
                              showSolarComets: baseOn ? (p.showSolarComets ?? true) : false,
                              [sub.key]: checked,
                            };
                            const anyOn = Object.values(nextState).some(Boolean);
                            return {
                              ...p,
                              ...nextState,
                              showSolarSystem: anyOn,
                            };
                          });
                        }}
                        className="w-3 h-3 shrink-0 accent-cyan-500"
                      />
                    </label>
                  );
                })}
              </div>

              <label
                className={`flex items-center justify-between gap-1.5 py-0.5 ${
                  layers.showSolarSystem ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'
                }`}
              >
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  행성 위성의 표면
                </span>
                <input
                  type="checkbox"
                  checked={layers.showPlanetSurface}
                  disabled={!layers.showSolarSystem}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showPlanetSurface: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              <label
                className={`flex items-center justify-between gap-1.5 py-0.5 ${
                  layers.showSolarSystem ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'
                }`}
              >
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  태양·달·행성 궤도
                </span>
                <input
                  type="checkbox"
                  checked={layers.showSolarSystemOrbits}
                  disabled={!layers.showSolarSystem}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showSolarSystemOrbits: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              <label
                className={`flex items-center justify-between gap-1.5 py-0.5 ${
                  layers.showSolarSystem ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'
                }`}
              >
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  태양계 라벨
                </span>
                <input
                  type="checkbox"
                  checked={layers.showSolarSystemLabels}
                  disabled={!layers.showSolarSystem}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showSolarSystemLabels: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              {(() => {
                const cometsActive = layers.showSolarSystem && (layers.showSolarComets ?? true);
                const cometMaxMag = layers.cometMaxMag ?? 15.0;
                const cometPresets = [
                  { mag: 10.0, label: '쌍안경' },
                  { mag: 13.5, label: '12″안시' },
                  { mag: 15.0, label: '전자관측' },
                  { mag: 18.0, label: '전체' },
                ];
                return (
                  <div
                    className={`ml-1.5 pl-2.5 pr-1.5 py-1.5 border-l space-y-1.5 rounded-r-md ${ui.divider} ${
                      cometsActive ? '' : 'opacity-45'
                    } ${
                      theme === 'white'
                        ? 'bg-slate-50/80'
                        : theme === 'red'
                        ? 'bg-[#160404]/70'
                        : 'bg-slate-900/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10.5px] font-semibold tracking-[-0.05em] ${ui.textSecondary}`}>
                        혜성 관측 필터
                      </span>
                      <span className={`font-mono text-[9.5px] tabular-nums ${ui.accentText}`}>
                        {cometFilterCounts.visible}/{cometFilterCounts.total}
                      </span>
                    </div>

                    <label
                      className={`flex items-start justify-between gap-1.5 ${
                        cometsActive ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] leading-tight tracking-[-0.05em] ${ui.textSecondary}`}>
                          관측 가능한 혜성만 표시
                        </div>
                        <div className={`text-[9.5px] leading-tight mt-0.5 tracking-[-0.04em] ${ui.textMuted}`}>
                          D/ 소멸 · 근일점 1년 경과 어두운 혜성 제외
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={layers.cometObservableOnly ?? true}
                        disabled={!cometsActive}
                        onChange={(e) =>
                          onChangeLayers((p) => ({ ...p, cometObservableOnly: e.target.checked }))
                        }
                        className="w-3 h-3 mt-0.5 shrink-0 accent-cyan-500"
                      />
                    </label>

                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between gap-1 text-[10.5px]">
                        <span className={`tracking-[-0.05em] ${ui.textSecondary}`}>
                          혜성 한계 등급
                        </span>
                        <span className={`font-mono text-[10px] tabular-nums ${ui.accentText}`}>
                          ≤ {cometMaxMag.toFixed(1)}m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={6.0}
                        max={18.0}
                        step={0.5}
                        value={cometMaxMag}
                        disabled={!cometsActive}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            cometMaxMag: parseFloat(e.target.value),
                          }))
                        }
                        className={`w-full h-1.5 accent-cyan-500 ${
                          cometsActive ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      />
                      <div className="grid grid-cols-4 gap-1">
                        {cometPresets.map((preset) => {
                          const isSelectedPreset = Math.abs(cometMaxMag - preset.mag) < 0.05;
                          return (
                            <button
                              key={preset.mag}
                              type="button"
                              disabled={!cometsActive}
                              onClick={() =>
                                onChangeLayers((p) => ({ ...p, cometMaxMag: preset.mag }))
                              }
                              title={`${preset.label} (${preset.mag.toFixed(1)}등급 이하)`}
                              className={`px-1 py-0.5 rounded border text-[9px] leading-tight tracking-[-0.04em] transition-colors ${
                                cometsActive ? 'cursor-pointer' : 'cursor-not-allowed'
                              } ${
                                isSelectedPreset
                                  ? theme === 'white'
                                    ? 'bg-sky-600 text-white border-sky-600'
                                    : theme === 'red'
                                    ? 'bg-red-900/90 text-red-100 border-red-700'
                                    : 'bg-cyan-500/25 text-cyan-200 border-cyan-500/60'
                                  : theme === 'white'
                                  ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                  : theme === 'red'
                                  ? 'bg-[#200606] text-red-400/90 border-red-950/70 hover:bg-[#2d0808]'
                                  : 'bg-slate-800/70 text-slate-400 border-slate-700/80 hover:text-slate-200'
                              }`}
                            >
                              <div>{preset.label}</div>
                              <div className="font-mono text-[8.5px] opacity-85">
                                {preset.mag.toFixed(1)}m
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label
                      className={`flex items-center justify-between gap-1.5 pt-0.5 ${
                        cometsActive ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    >
                      <span className={`text-[10.5px] whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                        지평선 아래 혜성 숨기기
                      </span>
                      <input
                        type="checkbox"
                        checked={layers.cometHideBelowHorizon ?? false}
                        disabled={!cometsActive}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            cometHideBelowHorizon: e.target.checked,
                          }))
                        }
                        className="w-3 h-3 shrink-0 accent-cyan-500"
                      />
                    </label>

                    <label
                      className={`flex items-center justify-between gap-1.5 ${
                        cometsActive ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    >
                      <span className={`text-[10.5px] whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                        태양 근처 숨기기 (이각 &lt; 15°)
                      </span>
                      <input
                        type="checkbox"
                        checked={layers.cometHideNearSun ?? true}
                        disabled={!cometsActive}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            cometHideNearSun: e.target.checked,
                          }))
                        }
                        className="w-3 h-3 shrink-0 accent-cyan-500"
                      />
                    </label>
                  </div>
                );
              })()}
              </div>
                );
              })()}
            </div>

            {/* 2. 항성 (Stars) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_stars')}
                aria-expanded={isSectionOpen('layers_stars')}
                className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('layers_stars')
                )}`}
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_stars')
                    )} ${isSectionOpen('layers_stars') ? '' : '-rotate-90'}`}
                  />
                  <span>항성 (Stars)</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.04em] tabular-nums whitespace-nowrap shrink-0 flex items-center gap-1 ${ui.textMuted}`}>
                  {layers.enableGaiaLive && catalogs.gaiaLoading ? (
                    <span className={`inline-flex items-center gap-1 ${ui.accentText}`}>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Gaia</span>
                    </span>
                  ) : catalogs.gaiaProgress.status === 'local' ? (
                    <span className={ui.accentText}>
                      로컬 ≤{catalogs.localContinuousMaxMag.toFixed(1)}m
                    </span>
                  ) : layers.enableGaiaLive && catalogs.gaiaStars.length > 0 && view.fsz <= GAIA_LIVE_MAX_FSZ ? (
                    <span className={ui.accentText}>
                      {catalogs.localStarCount > 0 ? '로컬+Gaia' : 'Gaia'} {catalogs.gaiaStars.length.toLocaleString()}
                    </span>
                  ) : catalogs.localStarCount > 0 ? (
                    <span className={ui.accentText}>
                      로컬 ≤{catalogs.localContinuousMaxMag.toFixed(1)}m
                    </span>
                  ) : (
                    <span>
                      LoD {layers.magOffset >= 0 ? `+${layers.magOffset.toFixed(1)}` : layers.magOffset.toFixed(1)}m
                    </span>
                  )}
                </span>
              </button>

              {isSectionOpen('layers_stars') && (
              <div className={`space-y-1.5 ${sectionBodyCls}`}>

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  항성표시
                </span>
                <input
                  type="checkbox"
                  checked={layers.showStarOutlines}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showStarOutlines: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              {layers.showStarOutlines && (
                <div className="pl-2 pb-0.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                      항성표시 진하기
                    </span>
                    <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                      {Math.round((layers.starOutlineOpacity ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={layers.starOutlineOpacity ?? 1}
                    onChange={(e) =>
                      onChangeLayers((p) => ({
                        ...p,
                        starOutlineOpacity: Number(e.target.value),
                      }))
                    }
                    aria-label="항성표시 진하기"
                    className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  항성 B-V 분광 색상
                </span>
                <input
                  type="checkbox"
                  checked={layers.showStarColors}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showStarColors: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              <div className="flex items-center justify-between gap-1.5 py-0.5">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  항성 이름 표시
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTab('settings')}
                    title="설정 탭의 성도 표기 설정에서 항성 표기법 변경"
                    className={`px-1.5 py-0.5 border rounded text-[9.5px] tracking-[-0.04em] cursor-pointer ${ui.buttonIdle}`}
                  >
                    표기 설정
                  </button>
                  <input
                    type="checkbox"
                    checked={layers.showStarLabels}
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, showStarLabels: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  알려진 항성 이름 표시
                </span>
                <input
                  type="checkbox"
                  checked={layers.showProperStarNames}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showProperStarNames: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              {(layers.showStarLabels || layers.showProperStarNames) && (
                <div className="pl-2 pb-0.5 space-y-1.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        항성표시밀도
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {layers.starLabelDensityPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={layers.starLabelDensityPct}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          starLabelDensityPct: Number(e.target.value),
                        }))
                      }
                      aria-label="항성표시밀도"
                      className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        항성 이름 표시 진하기
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {Math.round((layers.starLabelOpacity ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={layers.starLabelOpacity ?? 1}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          starLabelOpacity: Number(e.target.value),
                        }))
                      }
                      aria-label="항성 이름 표시 진하기"
                      className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.06em] ${ui.textSecondary}`}>
                  Gaia DR3 실시간 심층 별 (≤10°)
                </span>
                <input
                  type="checkbox"
                  checked={layers.enableGaiaLive}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, enableGaiaLive: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              {layers.enableGaiaLive && (() => {
                const gp = catalogs.gaiaProgress;
                const isTileProgress = gp.mode === 'tile' && gp.totalTiles > 0;
                const isLocalCovered = gp.status === 'local';
                const isSupplemental = Boolean(gp.minMag && gp.minMag > 8.35);
                const pct = isTileProgress
                  ? Math.max(
                      catalogs.gaiaLoading ? 8 : 0,
                      Math.min(100, Math.round((gp.loadedTiles / gp.totalTiles) * 100))
                    )
                  : gp.status === 'loaded' || isLocalCovered
                  ? 100
                  : 0;
                const cardCls =
                  theme === 'white'
                    ? 'bg-white/80 border-slate-200/90'
                    : theme === 'red'
                    ? 'bg-[#180303] border-[#4A0D0D]'
                    : 'bg-[#0B1220]/90 border-slate-700/70';
                const trackCls =
                  theme === 'white'
                    ? 'bg-slate-200'
                    : theme === 'red'
                    ? 'bg-[#360707]'
                    : 'bg-slate-800';
                const barCls =
                  gp.status === 'error'
                    ? 'bg-amber-500'
                    : gp.status === 'loaded' || isLocalCovered
                    ? theme === 'red'
                      ? 'bg-[#EF4444]'
                      : theme === 'white'
                      ? 'bg-emerald-600'
                      : 'bg-emerald-400'
                    : theme === 'white'
                    ? 'bg-sky-600'
                    : theme === 'red'
                    ? 'bg-[#EF4444]'
                    : 'bg-cyan-400';

                return (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`rounded-md border px-2 py-1.5 space-y-1 text-[10px] tracking-[-0.04em] ${cardCls}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 min-w-0 font-medium">
                        {catalogs.gaiaLoading ? (
                          <Loader2 className={`w-3 h-3 shrink-0 animate-spin ${ui.accentText}`} />
                        ) : gp.status === 'loaded' || isLocalCovered ? (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              theme === 'red'
                                ? 'bg-[#EF4444]'
                                : theme === 'white'
                                ? 'bg-emerald-500'
                                : 'bg-emerald-400'
                            }`}
                          />
                        ) : gp.status === 'error' ? (
                          <CloudAlert className="w-3 h-3 shrink-0 text-amber-400" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              theme === 'white'
                                ? 'bg-slate-400'
                                : theme === 'red'
                                ? 'bg-[#7F1D1D]'
                                : 'bg-slate-500'
                            }`}
                          />
                        )}
                        <span className={`truncate ${ui.textPrimary}`}>
                          {catalogs.gaiaLoading
                            ? isTileProgress
                              ? `Gaia DR3 ${isSupplemental ? '보완 ' : ''}로딩 (${gp.loadedTiles}/${gp.totalTiles})`
                              : `Gaia DR3 ${isSupplemental ? '심층 보완' : '심층 별'} 로딩 중...`
                            : isLocalCovered
                            ? `로컬 별목록 적용 중 (≤${catalogs.localContinuousMaxMag.toFixed(2)}m)`
                            : gp.status === 'loaded'
                            ? `Gaia DR3 ${isSupplemental ? '보완 완료' : '적용 완료'} (${catalogs.gaiaStars.length.toLocaleString()}개)`
                            : gp.status === 'error'
                            ? 'Gaia DR3 응답 지연'
                            : 'Gaia DR3 대기 중'}
                        </span>
                      </span>

                      {(gp.status === 'error' || gp.status === 'loaded') && !catalogs.gaiaLoading ? (
                        <button
                          type="button"
                          onClick={() => retryGaiaLiveFetch()}
                          title="현재 시야의 Gaia DR3 데이터 다시 불러오기"
                          className={`px-1.5 py-0.5 border text-[9px] font-medium flex items-center gap-0.5 shrink-0 cursor-pointer transition-colors ${ui.buttonIdle}`}
                          style={{ borderRadius: '4px' }}
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>{gp.status === 'error' ? '재시도' : '새로고침'}</span>
                        </button>
                      ) : (
                        <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.textMuted}`}>
                          {catalogs.gaiaLoading
                            ? isSupplemental && gp.minMag
                              ? `${gp.minMag.toFixed(1)}~${gp.targetMag.toFixed(1)}m`
                              : `≤${gp.targetMag.toFixed(1)}m`
                            : isLocalCovered
                            ? `${catalogs.localStarCount.toLocaleString()}개`
                            : `시야 ${view.fsz.toFixed(1)}°`}
                        </span>
                      )}
                    </div>

                    {(catalogs.gaiaLoading || gp.status === 'loaded') && (
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${trackCls}`}>
                        {catalogs.gaiaLoading && !isTileProgress ? (
                          <div className={`h-full rounded-full gaia-progress-indeterminate ${barCls}`} />
                        ) : (
                          <div
                            className={`h-full rounded-full transition-[width] duration-200 ease-out ${barCls}`}
                            style={{ width: `${pct}%` }}
                          />
                        )}
                      </div>
                    )}

                    <div className={`text-[9.5px] leading-snug ${ui.textMuted}`}>
                      {catalogs.gaiaLoading
                        ? gp.loadedStars > 0
                          ? `현재 ${gp.loadedStars.toLocaleString()}개 수신됨 · 완료된 영역부터 성도에 표시됩니다.`
                          : isSupplemental && gp.minMag
                          ? `로컬 별목록(${gp.minMag.toFixed(2)}m)을 초과한 ~${gp.targetMag.toFixed(1)}m 별만 Gaia DR3에서 조회 중입니다.`
                          : `최대 ${gp.targetMag.toFixed(1)}등급 심층 별을 비동기 조회하고 있습니다.`
                        : isLocalCovered
                        ? gp.reason || `다운로드된 별목록을 내장별처럼 즉시 표시하며, 범위 초과 시 Gaia DR3로 자동 보완합니다.`
                        : gp.status === 'loaded'
                        ? gp.errorMessage
                          ? `${gp.errorMessage} · 성도에서 별을 클릭해 세부 정보를 확인하세요.`
                          : isSupplemental && gp.minMag
                          ? `로컬(≤${gp.minMag.toFixed(2)}m) + Gaia 보완(~${gp.targetMag.toFixed(1)}m) 반영됨`
                          : `≤${gp.targetMag.toFixed(1)}m 반영됨 · 성도의 별을 클릭하면 Gaia DR3 세부 정보가 열립니다.`
                        : gp.status === 'error'
                        ? gp.errorMessage || '서버 응답이 지연되어 로컬·Hipparcos 성표를 유지 중입니다.'
                        : gp.reason || `시야각 ${GAIA_LIVE_MAX_FSZ}° 이하로 확대 시 자동 로딩됩니다.`}
                    </div>
                  </div>
                );
              })()}

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  오프라인 배경 성야 보강
                </span>
                <input
                  type="checkbox"
                  checked={layers.showFieldStars}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showFieldStars: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              {!layers.enableGaiaLive && (
                <p className={`pt-0.5 text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                  시야각 10° 이하에서 파인더 타일 캐싱 및 고배율 Gaia DR3 심층 별(최대 20.0m)이 자동 로딩됩니다.
                </p>
              )}
              </div>
              )}
            </div>

            {/* 2.5. 이중성 · 다중성 (WDS Double & Multiple Stars) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_doubles')}
                aria-expanded={isSectionOpen('layers_doubles')}
                className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('layers_doubles')
                )}`}
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_doubles')
                    )} ${isSectionOpen('layers_doubles') ? '' : '-rotate-90'}`}
                  />
                  <span>이중성 · 다중성 (WDS)</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.05em] tabular-nums whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                  {catalogs.doubleStarsLoaded
                    ? `${catalogs.doubleStars.length.toLocaleString()}계`
                    : '로딩 중...'}
                </span>
              </button>

              {isSectionOpen('layers_doubles') && (
              <div className={`space-y-1.5 ${sectionBodyCls}`}>

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  이중성 · 다중성 표기
                </span>
                <input
                  type="checkbox"
                  checked={layers.showDoubleStars}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showDoubleStars: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              {layers.showDoubleStars && (
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeLayers((p) => ({ ...p, showDoublePairs: !p.showDoublePairs }))
                      }
                      className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${
                        layers.showDoublePairs ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      <svg viewBox="0 0 18 10" className="w-4 h-2.5 shrink-0" aria-hidden="true">
                        <line
                          x1="1"
                          y1="5"
                          x2="17"
                          y2="5"
                          stroke={theme === 'red' ? '#EF4444' : theme === 'white' ? '#B45309' : '#FCD34D'}
                          strokeWidth="1.5"
                        />
                        <circle cx="9" cy="5" r="2.2" fill="currentColor" />
                      </svg>
                      <span>이중성 (2성)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeLayers((p) => ({ ...p, showMultipleStars: !p.showMultipleStars }))
                      }
                      className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${
                        layers.showMultipleStars ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      <svg viewBox="0 0 18 10" className="w-4 h-2.5 shrink-0" aria-hidden="true">
                        <line
                          x1="1"
                          y1="5"
                          x2="17"
                          y2="5"
                          stroke={theme === 'red' ? '#FCA5A5' : theme === 'white' ? '#1D4ED8' : '#38BDF8'}
                          strokeWidth="1.4"
                        />
                        <circle
                          cx="9"
                          cy="5"
                          r="3.8"
                          fill="none"
                          stroke={theme === 'red' ? '#FCA5A5' : theme === 'white' ? '#1D4ED8' : '#38BDF8'}
                          strokeWidth="1.2"
                        />
                        <circle cx="9" cy="5" r="1.8" fill="currentColor" />
                      </svg>
                      <span>다중성 (3성+)</span>
                    </button>
                  </div>

                  <div className="pl-2 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        표시 밀도 (화면 밝기 상위)
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {layers.doubleStarDensityPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={layers.doubleStarDensityPct}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          doubleStarDensityPct: Number(e.target.value),
                        }))
                      }
                      aria-label="이중성 다중성 표시 밀도"
                      className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="pl-2 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        이중성 심볼 진하기
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {Math.round((layers.doubleStarSymbolOpacity ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={layers.doubleStarSymbolOpacity ?? 1}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          doubleStarSymbolOpacity: Number(e.target.value),
                        }))
                      }
                      aria-label="이중성 다중성 심볼 진하기"
                      className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] pl-2">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        최소 이격각 (ρ)
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {layers.doubleStarMinSepArcsec === 0
                          ? '전체 (≥0.4″)'
                          : `≥ ${layers.doubleStarMinSepArcsec}″`}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-0.5">
                      {(
                        [
                          [0, '전체'],
                          [1, '1″+'],
                          [5, '5″+'],
                          [10, '10″+'],
                          [20, '20″+'],
                          [30, '30″+'],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            onChangeLayers((p) => ({ ...p, doubleStarMinSepArcsec: val }))
                          }
                          className={`py-1 px-0.5 border text-[9px] font-mono tracking-[-0.06em] font-medium whitespace-nowrap shrink-0 ${
                            layers.doubleStarMinSepArcsec === val ? ui.buttonActive : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                    <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                      이중성 · 다중성 이름 라벨
                    </span>
                    <input
                      type="checkbox"
                      checked={layers.showDoubleStarLabels}
                      onChange={(e) =>
                        onChangeLayers((p) => ({ ...p, showDoubleStarLabels: e.target.checked }))
                      }
                      className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                    />
                  </label>

                  {layers.showDoubleStarLabels && (
                    <div className="pl-2 pb-0.5 space-y-1.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                            이름 라벨 밀도 (화면 밝기 상위)
                          </span>
                          <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                            {layers.doubleStarLabelDensityPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={layers.doubleStarLabelDensityPct}
                          onChange={(e) =>
                            onChangeLayers((p) => ({
                              ...p,
                              doubleStarLabelDensityPct: Number(e.target.value),
                            }))
                          }
                          aria-label="이중성 다중성 이름 라벨 밀도"
                          className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                            이중성 이름 라벨 진하기
                          </span>
                          <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                            {Math.round((layers.doubleStarLabelOpacity ?? 1) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={1}
                          step={0.05}
                          value={layers.doubleStarLabelOpacity ?? 1}
                          onChange={(e) =>
                            onChangeLayers((p) => ({
                              ...p,
                              doubleStarLabelOpacity: Number(e.target.value),
                            }))
                          }
                          aria-label="이중성 다중성 이름 라벨 진하기"
                          className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className={`pt-0.5 text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                고배율 확대 시 WDS 실측 이격각(ρ)·방위각(PA) 위치에 동반성이 분리 표기됩니다.
              </p>
              </div>
              )}
            </div>

            {/* 3. 심우주 천체 & 은하수 (Deep Sky & Milky Way) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_dso')}
                aria-expanded={isSectionOpen('layers_dso')}
                className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('layers_dso')
                )}`}
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_dso')
                    )} ${isSectionOpen('layers_dso') ? '' : '-rotate-90'}`}
                  />
                  <span>심우주 천체 & 은하수</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.05em] tabular-nums whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                  {(
                    catalogs.dsosBright.length +
                    catalogs.dsosDeep.length +
                    catalogs.darkNebulae.length
                  ).toLocaleString()}{' '}
                  DSO
                </span>
              </button>

              {isSectionOpen('layers_dso') && (
              <div className={`space-y-1 ${sectionBodyCls}`}>
                <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    심우주 천체 (DSO 심볼)
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.showDso}
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, showDso: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                  />
                </label>

                {layers.showDso && (
                  <div className="pl-2 pb-0.5 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        심볼 시각화 (화면 밝기 상위)
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {layers.dsoSymbolDensityPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={layers.dsoSymbolDensityPct}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          dsoSymbolDensityPct: Number(e.target.value),
                        }))
                      }
                      aria-label="심우주 천체 심볼 시각화 비율"
                      className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                    />
                  </div>
                )}

                {(() => {
                  const anyDsoActive =
                    layers.showDso ||
                    layers.showMessierCatalog ||
                    layers.showCaldwellCatalog;
                  return (
                    <div
                      className={`pl-2 pt-0.5 pb-1 space-y-0.5 transition-opacity ${
                        anyDsoActive ? '' : 'opacity-45 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                          DSO 심볼 진하기
                        </span>
                        <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                          {Math.round(layers.dsoSymbolOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.05}
                        disabled={!anyDsoActive}
                        value={layers.dsoSymbolOpacity}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            dsoSymbolOpacity: Number(e.target.value),
                          }))
                        }
                        aria-label="심우주 천체 심볼 진하기"
                        className={`w-full h-1.5 accent-cyan-500 ${
                          anyDsoActive ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      />
                    </div>
                  );
                })()}

                <label
                  className={`flex items-center justify-between gap-1.5 py-0.5 ${
                    layers.showDso ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'
                  }`}
                >
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    DSO 이름 라벨
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.showDsoLabels}
                    disabled={!layers.showDso}
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, showDsoLabels: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                  />
                </label>

                {layers.showDso && layers.showDsoLabels && (
                  <div className="pl-2 pb-0.5 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        화면 밝기 상위 표시
                      </span>
                      <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                        {layers.dsoLabelDensityPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={layers.dsoLabelDensityPct}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          dsoLabelDensityPct: Number(e.target.value),
                        }))
                      }
                      aria-label="심우주 천체 이름 라벨 화면 밝기 상위 표시 비율"
                      className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                    />
                  </div>
                )}

                {(() => {
                  const anyDsoLabelActive =
                    (layers.showDso && layers.showDsoLabels) ||
                    layers.showMessierCatalog ||
                    layers.showCaldwellCatalog;
                  return (
                    <div
                      className={`pl-2 pt-0.5 pb-1 space-y-0.5 transition-opacity ${
                        anyDsoLabelActive ? '' : 'opacity-45 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                          DSO 이름 라벨 진하기
                        </span>
                        <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                          {Math.round(layers.dsoLabelOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.05}
                        disabled={!anyDsoLabelActive}
                        value={layers.dsoLabelOpacity}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            dsoLabelOpacity: Number(e.target.value),
                          }))
                        }
                        aria-label="심우주 천체 이름 라벨 진하기"
                        className={`w-full h-1.5 accent-cyan-500 ${
                          anyDsoLabelActive ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      />
                    </div>
                  );
                })()}

                {/* 알려진 심우주 천체 (심우주 천체 비활성화 시에도 독립 표시) */}
                <div
                  className={`my-1.5 px-2 py-1.5 border space-y-1 ${ui.border}`}
                  style={{ borderRadius: '5px' }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
                    >
                      알려진 심우주 천체
                    </span>
                    <span
                      className={`text-[9px] tracking-[-0.05em] whitespace-nowrap ${ui.textMuted}`}
                    >
                      DSO 무관 · 전체 표시
                    </span>
                  </div>

                  <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                    <span className={`text-[10.5px] whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                      메시에 천체 (M1–M110)
                    </span>
                    <input
                      type="checkbox"
                      checked={layers.showMessierCatalog}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          showMessierCatalog: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                    <span className={`text-[10.5px] whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                      콜드웰 천체 (C1–C109)
                    </span>
                    <input
                      type="checkbox"
                      checked={layers.showCaldwellCatalog}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          showCaldwellCatalog: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                    />
                  </label>
                </div>

                <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    성운 다단계 등고선 (Contours)
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.showNebulaContours}
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, showNebulaContours: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                  />
                </label>

                <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    은하수 대역 (Galactic Plane)
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.showMilkyWay}
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, showMilkyWay: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                  />
                </label>
              </div>
              )}
            </div>

            {/* 3.5. 한계등급 기준 (Star & DSO Limiting Magnitude Baseline) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <div
                className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                  isSectionOpen('layers_mag')
                )}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('layers_mag')}
                  aria-expanded={isSectionOpen('layers_mag')}
                  className={`flex-1 flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_mag')
                    )} ${isSectionOpen('layers_mag') ? '' : '-rotate-90'}`}
                  />
                  <span>한계등급 기준 (60°: 6.0 / 10.0)</span>
                </button>
                {(layers.magOffset !== 0 || layers.dsoMagOffset !== 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeLayers((p) => ({ ...p, magOffset: 0, dsoMagOffset: 0 }))
                    }
                    className={`text-[9.5px] tracking-[-0.05em] whitespace-nowrap opacity-80 hover:opacity-100 shrink-0 ${ui.accentText}`}
                  >
                    초기화
                  </button>
                )}
              </div>

              {isSectionOpen('layers_mag') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>

              {/* 항성 한계등급 기준 슬라이드바 */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    항성 한계등급
                  </span>
                  <span className={`font-mono tabular-nums whitespace-nowrap ${ui.textPrimary}`}>
                    {getLimitingMagnitude(view.fsz, layers.magOffset).toFixed(1)}m{' '}
                    <span className={ui.textMuted}>
                      ({layers.magOffset >= 0 ? `+${layers.magOffset.toFixed(1)}` : layers.magOffset.toFixed(1)})
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={-3.0}
                  max={4.0}
                  step={0.2}
                  value={layers.magOffset}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, magOffset: Number(e.target.value) }))
                  }
                  aria-label="항성 한계등급 기준"
                  className={`w-full h-1.5 cursor-pointer ${
                    theme === 'red' ? 'accent-red-600' : 'accent-cyan-500'
                  }`}
                />
              </div>

              {/* DSO 한계등급 기준 슬라이드바 */}
              <div
                className={`space-y-0.5 transition-opacity ${
                  layers.showDso ? '' : 'opacity-45 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    DSO 한계등급
                  </span>
                  <span className={`font-mono tabular-nums whitespace-nowrap ${ui.textPrimary}`}>
                    {layers.showDso ? (
                      <>
                        {getDsoLimitingMagnitude(view.fsz, layers.dsoMagOffset).toFixed(1)}m{' '}
                        <span className={ui.textMuted}>
                          ({layers.dsoMagOffset >= 0 ? `+${layers.dsoMagOffset.toFixed(1)}` : layers.dsoMagOffset.toFixed(1)})
                        </span>
                      </>
                    ) : (
                      <span className={ui.textMuted}>OFF</span>
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={-4.0}
                  max={4.0}
                  step={0.2}
                  disabled={!layers.showDso}
                  value={layers.dsoMagOffset}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, dsoMagOffset: Number(e.target.value) }))
                  }
                  aria-label="DSO 한계등급 기준"
                  className={`w-full h-1.5 ${
                    theme === 'red' ? 'accent-red-600' : 'accent-emerald-500'
                  } ${layers.showDso ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                />
              </div>
              </div>
              )}
            </div>

            {/* 4. 좌표 그리드 & 기준선 (Grids & Reference Lines) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_grids')}
                aria-expanded={isSectionOpen('layers_grids')}
                className={`w-full flex items-center gap-1 px-2 py-1.5 rounded-md border text-left font-semibold whitespace-nowrap tracking-[-0.05em] transition-colors cursor-pointer ${ui.textPrimary} ${sectionHeaderCls(
                  isSectionOpen('layers_grids')
                )}`}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                    isSectionOpen('layers_grids')
                  )} ${isSectionOpen('layers_grids') ? '' : '-rotate-90'}`}
                />
                <span>좌표 그리드 & 기준선</span>
              </button>
              {isSectionOpen('layers_grids') && (
              <div className={`space-y-1.5 ${sectionBodyCls}`}>
              {(
                [
                  ['showGridEq', '적도 좌표 그리드 (RA/Dec)'],
                  ['showGridAltAz', '지평 좌표 그리드 (Alt/Az)'],
                  ['showGridLabels', '그리드 숫자 표시 (적경·적위·방위·고도)'],
                ] as [keyof LayerSettings, string][]
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer"
                >
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    {label}
                  </span>
                  <input
                    type="checkbox"
                    checked={
                      key === 'showGridLabels'
                        ? layers.showGridLabels !== false
                        : Boolean(layers[key])
                    }
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, [key]: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                  />
                </label>
              ))}
              {(() => {
                const anyGridActive = layers.showGridEq || layers.showGridAltAz;
                const gridLabelsActive = anyGridActive && layers.showGridLabels !== false;
                const labelYPct = Math.round(layers.gridLabelYPercent ?? 80);
                const labelXPct = Math.round(layers.gridLabelXPercent ?? 20);
                const isCustomPos = labelYPct !== 80 || labelXPct !== 20;
                return (
                  <div
                    className={`pl-2 pt-0.5 pb-1 space-y-2 transition-opacity ${
                      anyGridActive ? '' : 'opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`rounded-md border p-2 space-y-1.5 transition-opacity ${ui.panelMuted} ${ui.border} ${
                        gridLabelsActive ? '' : 'opacity-45'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-semibold whitespace-nowrap tracking-[-0.04em] ${ui.textPrimary}`}
                        >
                          그리드 좌표 숫자 위치 설정
                        </span>
                        <button
                          type="button"
                          disabled={!gridLabelsActive || !isCustomPos}
                          onClick={() =>
                            onChangeLayers((p) => ({
                              ...p,
                              gridLabelYPercent: 80,
                              gridLabelXPercent: 20,
                            }))
                          }
                          title="기준 위치로 되돌리기 (가로 위 80% · 세로 좌 20%)"
                          className={`px-1.5 py-0.5 rounded border text-[9px] font-mono tabular-nums transition-colors ${
                            gridLabelsActive && isCustomPos
                              ? `${ui.buttonIdle} cursor-pointer`
                              : `${ui.border} ${ui.textMuted} opacity-50 cursor-default`
                          }`}
                        >
                          기본 80·20
                        </button>
                      </div>

                      {/* Mini viewport guide showing horizontal (top %) & vertical (left %) number lines */}
                      <div
                        aria-hidden="true"
                        className="relative w-full h-11 rounded border overflow-hidden select-none"
                        style={{
                          backgroundColor: 'var(--ui-bg-main)',
                          borderColor: 'var(--ui-border)',
                        }}
                      >
                        <div
                          className="absolute inset-x-0 border-t border-dashed"
                          style={{
                            top: `${labelYPct}%`,
                            borderColor: 'var(--ui-accent)',
                            opacity: 0.85,
                          }}
                        />
                        <div
                          className="absolute inset-y-0 border-l border-dashed"
                          style={{
                            left: `${labelXPct}%`,
                            borderColor: 'var(--ui-accent)',
                            opacity: 0.85,
                          }}
                        />
                        <div
                          className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${labelXPct}%`,
                            top: `${labelYPct}%`,
                            backgroundColor: 'var(--ui-accent)',
                          }}
                        />
                        <span
                          className="absolute top-0.5 left-1 text-[8px] font-mono opacity-65"
                          style={{ color: 'var(--ui-text-muted)' }}
                        >
                          좌상단 0%
                        </span>
                        <span
                          className="absolute bottom-0.5 right-1 text-[8px] font-mono tabular-nums"
                          style={{ color: 'var(--ui-accent-text)' }}
                        >
                          가로 {labelYPct}% · 세로 {labelXPct}%
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                            가로 줄 위치 (적경·방위 / 위에서)
                          </span>
                          <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                            {labelYPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={95}
                          step={1}
                          disabled={!gridLabelsActive}
                          value={labelYPct}
                          onChange={(e) =>
                            onChangeLayers((p) => ({
                              ...p,
                              gridLabelYPercent: Number(e.target.value),
                            }))
                          }
                          aria-label="그리드 가로 숫자 줄 위치 (위에서 %)"
                          className={`w-full h-1.5 [accent-color:var(--ui-accent)] ${
                            gridLabelsActive ? 'cursor-pointer' : 'cursor-not-allowed'
                          }`}
                        />
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                            세로 줄 위치 (적위·고도 / 왼쪽에서)
                          </span>
                          <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                            {labelXPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={95}
                          step={1}
                          disabled={!gridLabelsActive}
                          value={labelXPct}
                          onChange={(e) =>
                            onChangeLayers((p) => ({
                              ...p,
                              gridLabelXPercent: Number(e.target.value),
                            }))
                          }
                          aria-label="그리드 세로 숫자 줄 위치 (왼쪽에서 %)"
                          className={`w-full h-1.5 [accent-color:var(--ui-accent)] ${
                            gridLabelsActive ? 'cursor-pointer' : 'cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                          그리드 선 굵기
                        </span>
                        <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                          {layers.gridLineWidth.toFixed(1)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={2.5}
                        step={0.1}
                        disabled={!anyGridActive}
                        value={layers.gridLineWidth}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            gridLineWidth: Number(e.target.value),
                          }))
                        }
                        aria-label="좌표 그리드 선 굵기"
                        className={`w-full h-1.5 [accent-color:var(--ui-accent)] ${
                          anyGridActive ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                          그리드 선 진하기
                        </span>
                        <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                          {Math.round((layers.gridLineOpacity ?? 0.35) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.05}
                        disabled={!anyGridActive}
                        value={layers.gridLineOpacity ?? 0.35}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            gridLineOpacity: Number(e.target.value),
                          }))
                        }
                        aria-label="좌표 그리드 선 진하기"
                        className={`w-full h-1.5 [accent-color:var(--ui-accent)] ${
                          anyGridActive ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>
                );
              })()}
              {(
                [
                  ['showHorizon', '관측지 지평선 및 방위'],
                  ['showEcliptic', '황도선 (Ecliptic)'],
                  ['showCelestialPoles', '천구의 북극·남극 십자 (NCP/SCP)'],
                ] as [keyof LayerSettings, string][]
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer"
                >
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    {label}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(layers[key])}
                    onChange={(e) =>
                      onChangeLayers((p) => ({ ...p, [key]: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                  />
                </label>
              ))}
              </div>
              )}
            </div>

            {/* 5. 실사 배경 서베이 (Aladin Lite v3 HiPS) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <div
                className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                  isSectionOpen('layers_hips')
                )}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('layers_hips')}
                  aria-expanded={isSectionOpen('layers_hips')}
                  className={`flex-1 flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_hips')
                    )} ${isSectionOpen('layers_hips') ? '' : '-rotate-90'}`}
                  />
                  <Image className="w-3.5 h-3.5 shrink-0" />
                  <span>하이브리드 실사 배경 (HiPS)</span>
                </button>
                <input
                  type="checkbox"
                  checked={hips.enabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChangeHips((p) => ({ ...p, enabled: checked }));
                    if (checked) openSection('layers_hips');
                  }}
                  aria-label="하이브리드 실사 배경 활성화"
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500 cursor-pointer"
                />
              </div>

              {isSectionOpen('layers_hips') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>

              {hips.enabled && (
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-3 gap-1">
                    {HIPS_SURVEY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeHips((p) => ({ ...p, survey: opt.id }))}
                        className={`py-1.5 px-0.5 border text-[9.5px] tracking-[-0.06em] font-medium whitespace-nowrap shrink-0 ${
                          hips.survey === opt.id ? ui.buttonActive : ui.buttonIdle
                        }`}
                        style={{ borderRadius: '4px' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        실사 배경 불투명도
                      </span>
                      <span className="font-mono tabular-nums whitespace-nowrap">
                        {Math.round(hips.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={hips.opacity}
                      onChange={(e) =>
                        onChangeHips((p) => ({ ...p, opacity: Number(e.target.value) }))
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </div>
              )}
              <p className={`text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                ESA 천구 실사 서베이(DSS2/2MASS/AllWISE)를 벡터 성도 아래 실시간 투영·정합합니다.
              </p>
              </div>
              )}
            </div>

            {/* 5.5. 대기 소광 효과 (Atmospheric Extinction) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <div
                className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                  isSectionOpen('layers_extinction')
                )}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('layers_extinction')}
                  aria-expanded={isSectionOpen('layers_extinction')}
                  className={`flex-1 flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_extinction')
                    )} ${isSectionOpen('layers_extinction') ? '' : '-rotate-90'}`}
                  />
                  <CloudFog className="w-3.5 h-3.5 shrink-0" />
                  <span>대기 소광 효과</span>
                </button>
                <input
                  type="checkbox"
                  checked={Boolean(layers.showAtmosphericExtinction)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChangeLayers((p) => ({ ...p, showAtmosphericExtinction: checked }));
                    if (checked) openSection('layers_extinction');
                  }}
                  aria-label="대기 소광 효과 활성화"
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500 cursor-pointer"
                />
              </div>

              {isSectionOpen('layers_extinction') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>
                <div className="space-y-1.5 pt-0.5">
                  <div className="grid grid-cols-4 gap-1">
                    {EXTINCTION_PRESETS.map((preset) => {
                      const active = Math.abs((layers.extinctionCoeff ?? 0.25) - preset.k) < 0.01;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          title={preset.desc}
                          onClick={() =>
                            onChangeLayers((p) => ({
                              ...p,
                              showAtmosphericExtinction: true,
                              extinctionCoeff: preset.k,
                            }))
                          }
                          className={`py-1 px-0.5 border text-[9.5px] tracking-[-0.05em] font-medium whitespace-nowrap cursor-pointer ${
                            active && layers.showAtmosphericExtinction
                              ? ui.buttonActive
                              : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-[10px]">
                      <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                        소광 계수 (k)
                      </span>
                      <span className="font-mono tabular-nums whitespace-nowrap font-semibold">
                        {(layers.extinctionCoeff ?? 0.25).toFixed(2)} mag/airmass
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={0.8}
                      step={0.05}
                      value={layers.extinctionCoeff ?? 0.25}
                      onChange={(e) =>
                        onChangeLayers((p) => ({
                          ...p,
                          showAtmosphericExtinction: true,
                          extinctionCoeff: Number(e.target.value),
                        }))
                      }
                      aria-label="대기 소광 계수"
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div
                    className={`px-2 py-1 rounded border text-[9.5px] font-mono tabular-nums flex items-center justify-between gap-1 ${ui.panelMuted}`}
                  >
                    <span className={ui.textMuted}>감광</span>
                    <span className={ui.textPrimary}>
                      30° +{computeAtmosphericExtinctionMag(30, layers.extinctionCoeff ?? 0.25).toFixed(2)}m · 10° +{computeAtmosphericExtinctionMag(10, layers.extinctionCoeff ?? 0.25).toFixed(2)}m · 5° +{computeAtmosphericExtinctionMag(5, layers.extinctionCoeff ?? 0.25).toFixed(2)}m
                    </span>
                  </div>
                </div>
                <p className={`text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                  지평선 근처의 두꺼운 대기를 지나는 천체의 밝기 감소(감광)와 적색화 현상을 고도에 따라 실시간 반영합니다.
                </p>
              </div>
              )}
            </div>

            {/* 6. 표시 설정 관리 (파일 저장 / 불러오기 / 자동 로컬 저장) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <div
                className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                  isSectionOpen('layers_manage')
                )}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('layers_manage')}
                  aria-expanded={isSectionOpen('layers_manage')}
                  className={`flex-1 flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('layers_manage')
                    )} ${isSectionOpen('layers_manage') ? '' : '-rotate-90'}`}
                  />
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>표시 설정 관리</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetLayerSettings();
                    showLayerNotice('표시 설정을 기본값으로 복원했습니다.');
                  }}
                  title="표시 설정 기본값 복원"
                  className={`px-1.5 py-0.5 border text-[10px] tracking-[-0.04em] flex items-center gap-0.5 transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <RotateCcw className="w-2.5 h-2.5 shrink-0" />
                  <span>기본값</span>
                </button>
              </div>

              {isSectionOpen('layers_manage') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    downloadLayerSettingsFile(layers, hips);
                    showLayerNotice('전체 표시 설정을 .json 파일로 저장했습니다.');
                  }}
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${ui.buttonSave}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>파일 저장</span>
                </button>
                <button
                  type="button"
                  onClick={() => layerFileInputRef.current?.click()}
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${ui.buttonLoad}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Upload className="w-3 h-3 shrink-0" />
                  <span>파일 불러오기</span>
                </button>
              </div>

              {layerStatusMsg && (
                <div className={`px-2 py-1 border rounded text-[10px] leading-snug ${cardIdleCls} ${ui.accentText}`}>
                  {layerStatusMsg}
                </div>
              )}

              <p className={`text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                변경한 모든 레이어·HiPS 세팅은 로컬에 자동 저장되어 다음 접속 시 복원됩니다.
              </p>
              </div>
              )}
            </div>
          </>
        )}

        {tab === 'optics' && (
          <>
            {/* Multi-select FOV Rings (시야 링 - 중복 표시 가능) */}
            <div className="space-y-1.5">
              {(() => {
                const activeRingCount =
                  Number(optics.showCrosshair) +
                  Number(optics.showTelrad) +
                  Number(optics.showFinder7x50) +
                  Number(optics.showEyepiece) +
                  Number(optics.showSensorBox);
                return (
                  <div
                    className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                      isSectionOpen('optics_rings')
                    )}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection('optics_rings')}
                      aria-expanded={isSectionOpen('optics_rings')}
                      className={`flex-1 flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] cursor-pointer ${ui.textPrimary}`}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                          isSectionOpen('optics_rings')
                        )} ${isSectionOpen('optics_rings') ? '' : '-rotate-90'}`}
                      />
                      <span>시야 링 (중복 표시 가능)</span>
                    </button>
                    {activeRingCount > 0 ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-mono text-[9.5px] tabular-nums ${ui.accentText}`}>
                          {activeRingCount}개
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeOptics((p) => ({
                              ...p,
                              showCrosshair: false,
                              showTelrad: false,
                              showFinder7x50: false,
                              showEyepiece: false,
                              showSensorBox: false,
                            }))
                          }
                          title="활성화된 시야 링을 모두 끄기"
                          className={`px-1.5 py-0.5 border rounded text-[9.5px] leading-none font-medium tracking-[-0.04em] whitespace-nowrap cursor-pointer transition-colors ${ui.buttonIdle}`}
                        >
                          전체 끄기
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[9.5px] whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                        꺼짐
                      </span>
                    )}
                  </div>
                );
              })()}

              {isSectionOpen('optics_rings') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>

              <div className="space-y-1">
                {/* 1. 중앙 십자선 */}
                <label
                  className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${
                    optics.showCrosshair
                      ? theme === 'white'
                        ? 'bg-sky-50 border-sky-200'
                        : theme === 'red'
                        ? 'bg-[#1D0505] border-[#5A1212]'
                        : 'bg-[#0C2130] border-[#1A4B64]'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Crosshair
                      className={`w-3.5 h-3.5 shrink-0 ${
                        theme === 'red' ? 'text-[#EF4444]' : 'text-cyan-400'
                      }`}
                    />
                    <span className={`truncate tracking-[-0.05em] ${ui.textPrimary}`}>
                      중앙 십자선
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={optics.showCrosshair}
                    onChange={(e) =>
                      onChangeOptics((p) => ({ ...p, showCrosshair: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                  />
                </label>

                {/* 2. Telrad */}
                <label
                  className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${
                    optics.showTelrad
                      ? theme === 'white'
                        ? 'bg-rose-50 border-rose-200'
                        : theme === 'red'
                        ? 'bg-[#1D0505] border-[#5A1212]'
                        : 'bg-[#261117] border-[#612331]'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full border-2 shrink-0 inline-block ${
                        theme === 'red' ? 'border-[#DC2626]' : 'border-rose-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className={`truncate tracking-[-0.05em] ${ui.textSecondary}`}>
                      Telrad (0.5°·2°·4°)
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={optics.showTelrad}
                    onChange={(e) =>
                      onChangeOptics((p) => ({ ...p, showTelrad: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-rose-500"
                  />
                </label>

                {/* 3. 내 파인더 (미등록 시 7×50 파인더 7.0° 기본 표시 · 여러 개면 기본 1개 선택) */}
                {(() => {
                  const myFinders = equipmentLocker.items.filter((it) => it.category === 'finder');
                  const activeFinder =
                    myFinders.length > 0
                      ? myFinders.find((f) => f.id === equipmentLocker.activeIds.finder) ??
                        myFinders[0]
                      : null;
                  const finderFov =
                    activeFinder?.fovDeg && activeFinder.fovDeg > 0 ? activeFinder.fovDeg : 7.0;
                  const finderTitle = activeFinder ? activeFinder.name : '7×50 파인더';
                  const finderCustomColor =
                    activeFinder?.finderColor && /^#[0-9a-fA-F]{6}$/.test(activeFinder.finderColor)
                      ? activeFinder.finderColor
                      : undefined;
                  const finderCrosshair = Boolean(activeFinder?.finderCrosshair);

                  return (
                    <div
                      className={`rounded-md transition-colors border ${
                        optics.showFinder7x50
                          ? theme === 'white'
                            ? 'bg-sky-50 border-sky-200'
                            : theme === 'red'
                            ? 'bg-[#1D0505] border-[#5A1212]'
                            : 'bg-[#0C2130] border-[#1A4B64]'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <label className="flex items-center justify-between gap-1.5 px-2 py-1.5 cursor-pointer">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-3 h-3 rounded-full border-2 shrink-0 inline-flex items-center justify-center relative ${
                              finderCustomColor
                                ? ''
                                : theme === 'red'
                                ? 'border-[#EF4444]'
                                : 'border-cyan-400'
                            }`}
                            style={finderCustomColor ? { borderColor: finderCustomColor } : undefined}
                            aria-hidden="true"
                          >
                            {finderCrosshair && (
                              <>
                                <span
                                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px]"
                                  style={{
                                    backgroundColor:
                                      finderCustomColor ??
                                      (theme === 'red' ? '#EF4444' : '#22D3EE'),
                                  }}
                                />
                                <span
                                  className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px]"
                                  style={{
                                    backgroundColor:
                                      finderCustomColor ??
                                      (theme === 'red' ? '#EF4444' : '#22D3EE'),
                                  }}
                                />
                              </>
                            )}
                          </span>
                          <span className={`truncate tracking-[-0.05em] ${ui.textSecondary}`}>
                            {finderTitle} ({finderFov.toFixed(1)}°)
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={optics.showFinder7x50}
                          onChange={(e) =>
                            onChangeOptics((p) => ({
                              ...p,
                              showFinder7x50: e.target.checked,
                              finderFovDeg: finderFov,
                              finderLabel: finderTitle,
                              finderColor: finderCustomColor,
                              finderCrosshair,
                            }))
                          }
                          className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                        />
                      </label>
                      {myFinders.length > 1 && activeFinder && (
                        <div className="px-2 pb-1.5">
                          <select
                            aria-label="기본 파인더 선택"
                            value={activeFinder.id}
                            onChange={(e) => onSelectActiveEquipment('finder', e.target.value)}
                            className={`w-full px-1.5 py-1 border text-[10px] tracking-[-0.04em] ${ui.input}`}
                            style={{ borderRadius: '4px' }}
                          >
                            {myFinders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} ({(f.fovDeg ?? 7.0).toFixed(1)}°)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 4. 망원경 아이피스 */}
                <label
                  className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${
                    optics.showEyepiece
                      ? theme === 'white'
                        ? 'bg-amber-50 border-amber-300'
                        : theme === 'red'
                        ? 'bg-[#1D0505] border-[#5A1212]'
                        : 'bg-[#261B0A] border-[#784912]'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full border-2 shrink-0 inline-block ${
                        theme === 'red' ? 'border-[#B91C1C]' : 'border-amber-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className={`truncate tracking-[-0.05em] ${ui.textSecondary}`}>
                      망원경 아이피스 ({optics.eyepieceFovDeg.toFixed(2)}°)
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={optics.showEyepiece}
                    onChange={(e) =>
                      onChangeOptics((p) => ({ ...p, showEyepiece: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 shrink-0 accent-amber-500"
                  />
                </label>

                {/* 5. 촬영 센서 화각 프레임 */}
                <label
                  className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${
                    optics.showSensorBox
                      ? theme === 'white'
                        ? 'bg-emerald-50 border-emerald-300'
                        : theme === 'red'
                        ? 'bg-[#1D0505] border-[#5A1212]'
                        : 'bg-[#092320] border-[#155E54]'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-3 h-2.5 rounded-[2px] border-2 shrink-0 inline-block ${
                        theme === 'red' ? 'border-[#EF4444]' : 'border-emerald-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className={`truncate tracking-[-0.05em] ${ui.textSecondary}`}>
                      {(() => {
                        const mOn = Boolean(optics.sensorMosaicSupported);
                        const sw = mOn ? Math.max(1, optics.sensorMosaicScaleW ?? 1) : 1;
                        const sh = mOn ? Math.max(1, optics.sensorMosaicScaleH ?? 1) : 1;
                        const ew = optics.sensorWidthDeg * sw;
                        const eh = optics.sensorHeightDeg * sh;
                        return `촬영 센서 화각 프레임 (${ew.toFixed(2)}°×${eh.toFixed(2)}°)`;
                      })()}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={optics.showSensorBox}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onChangeOptics((p) => ({ ...p, showSensorBox: checked }));
                    }}
                    className="w-3.5 h-3.5 shrink-0 accent-emerald-500"
                  />
                </label>
              </div>

              {/* FOV Ring Label Toggle */}
              <label className="flex items-center justify-between gap-1.5 pt-1 px-1 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                  시야링 옆 종류·시야각 표시
                </span>
                <input
                  type="checkbox"
                  checked={optics.showReticleLabel !== false}
                  onChange={(e) =>
                    onChangeOptics((p) => ({ ...p, showReticleLabel: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

              {/* Star Hopping Path Toggle */}
              <label className="flex items-center justify-between gap-1.5 pt-0.5 px-1 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                  선택된 천체대상 호핑(경로) 가이드
                </span>
                <input
                  type="checkbox"
                  checked={optics.showStarHop}
                  onChange={(e) =>
                    onChangeOptics((p) => ({ ...p, showStarHop: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>
              </div>
              )}
            </div>

            {/* Mirror / Reflector Flip */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('optics_flip')}
                aria-expanded={isSectionOpen('optics_flip')}
                className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('optics_flip')
                )}`}
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('optics_flip')
                    )} ${isSectionOpen('optics_flip') ? '' : '-rotate-90'}`}
                  />
                  <span>광학계 상 반전 (Flip)</span>
                </span>
                <span
                  className={`font-mono text-[9.5px] tracking-[-0.05em] whitespace-nowrap shrink-0 ${
                    optics.showEyepiece ? ui.accentText : ui.textMuted
                  }`}
                >
                  {(() => {
                    const activeScope = equipmentLocker.activeIds.telescope
                      ? equipmentLocker.items.find(
                          (it) =>
                            it.id === equipmentLocker.activeIds.telescope &&
                            it.category === 'telescope'
                        )
                      : null;
                    const isReflector =
                      activeScope !== null &&
                      activeScope !== undefined &&
                      normalizeTelescopeOpticalType(activeScope.opticalType) === '반사';
                    if (optics.showEyepiece && isReflector && view.flipH && view.flipV) {
                      return '반사 도립 자동';
                    }
                    return optics.showEyepiece ? '아이피스 내부만' : '전체 성도';
                  })()}
                </span>
              </button>
              {isSectionOpen('optics_flip') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeView((p) => ({ ...p, flipH: !p.flipH }))}
                  className={`py-1.5 px-1 border text-[10.5px] tracking-[-0.06em] font-medium whitespace-nowrap shrink-0 ${
                    view.flipH ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  좌우 반전 (미러)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeView((p) => ({ ...p, flipV: !p.flipV }))}
                  className={`py-1.5 px-1 border text-[10.5px] tracking-[-0.06em] font-medium whitespace-nowrap shrink-0 ${
                    view.flipV ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  상하 반전 (반사)
                </button>
              </div>

              <p className={`text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                {optics.showEyepiece
                  ? '망원경 아이피스가 켜져 있어 원 내부의 성도·HiPS 사진만 반전됩니다. 반사 경통 선택 시 상하+좌우 반전(도립상)이 자동 적용됩니다.'
                  : '아이피스를 켜면 원 내부만 반전되고, 반사 경통이 선택된 경우 상하+좌우 반전(도립상)이 자동으로 반영됩니다.'}
              </p>
              </div>
              )}
            </div>

            {/* My Equipment Locker (내 장비함 · .skylist 통합) */}
            <div className={`pt-2 border-t ${ui.divider}`}>
              <EquipmentLockerPanel
                theme={theme}
                locker={equipmentLocker}
                isOpen={isSectionOpen('optics_equipment')}
                onToggleOpen={() => toggleSection('optics_equipment')}
                onAddOrUpdateItem={onAddOrUpdateEquipment}
                onDeleteItem={onDeleteEquipment}
                onToggleActiveItem={onToggleActiveEquipment}
                onImportLocker={onImportEquipmentLocker}
              />
            </div>

            {/* Eyepiece TFOV Settings (내 장비 조합 / 시야각 직접 입력 / 수치 계산) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('optics_eyepiece')}
                aria-expanded={isSectionOpen('optics_eyepiece')}
                className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('optics_eyepiece')
                )}`}
              >
                <span className="flex items-center gap-1 min-w-0">
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('optics_eyepiece')
                    )} ${isSectionOpen('optics_eyepiece') ? '' : '-rotate-90'}`}
                  />
                  <SlidersHorizontal
                    className={`w-3.5 h-3.5 shrink-0 ${
                      theme === 'red' ? 'text-[#FF5555]' : 'text-amber-400'
                    }`}
                  />
                  <span
                    className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${
                      theme === 'white'
                        ? 'text-amber-700'
                        : theme === 'red'
                        ? 'text-[#FF6666]'
                        : 'text-amber-400'
                    }`}
                  >
                    아이피스 시야각 설정
                  </span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.textMuted}`}>
                  {optics.eyepieceFovDeg.toFixed(2)}°
                </span>
              </button>

              {isSectionOpen('optics_eyepiece') && (
              <div className={`space-y-2.5 ${sectionBodyCls}`}>

              {/* 3-Mode Segmented Switcher */}
              <div
                className={`grid grid-cols-3 gap-0.5 p-0.5 rounded-md border ${
                  theme === 'white'
                    ? 'bg-slate-100 border-slate-300'
                    : theme === 'red'
                    ? 'bg-[#120101] border-[#420C0C]'
                    : 'bg-[#0B1220] border-[#25334D]'
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    onChangeOptics((p) => ({ ...p, eyepieceInputMode: 'equipment' }))
                  }
                  className={`py-1 px-0.5 rounded text-[9.5px] font-semibold tracking-[-0.06em] whitespace-nowrap transition-colors ${
                    optics.eyepieceInputMode === 'equipment'
                      ? theme === 'red'
                        ? 'bg-[#7F1D1D] text-[#FF5252]'
                        : 'bg-amber-500 text-slate-950'
                      : `${ui.textMuted} hover:opacity-100`
                  }`}
                >
                  내 장비 조합
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChangeOptics((p) => ({ ...p, eyepieceInputMode: 'direct' }))
                  }
                  className={`py-1 px-0.5 rounded text-[9.5px] font-semibold tracking-[-0.06em] whitespace-nowrap transition-colors ${
                    optics.eyepieceInputMode === 'direct'
                      ? theme === 'red'
                        ? 'bg-[#7F1D1D] text-[#FF5252]'
                        : 'bg-amber-500 text-slate-950'
                      : `${ui.textMuted} hover:opacity-100`
                  }`}
                >
                  직접 입력
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChangeOptics((p) => {
                      const mag =
                        p.eyepieceFocalLengthMm > 0
                          ? p.telescopeFocalLengthMm / p.eyepieceFocalLengthMm
                          : 40;
                      const tfov = Math.max(0.05, Math.min(20, p.eyepieceAfovDeg / mag));
                      return {
                        ...p,
                        eyepieceInputMode: 'calc',
                        eyepieceFovDeg: Number(tfov.toFixed(2)),
                      };
                    })
                  }
                  className={`py-1 px-0.5 rounded text-[9.5px] font-semibold tracking-[-0.06em] whitespace-nowrap transition-colors ${
                    optics.eyepieceInputMode === 'calc'
                      ? theme === 'red'
                        ? 'bg-[#7F1D1D] text-[#FF5252]'
                        : 'bg-amber-500 text-slate-950'
                      : `${ui.textMuted} hover:opacity-100`
                  }`}
                >
                  수치 계산
                </button>
              </div>

              {optics.eyepieceInputMode === 'equipment' ? (
                (() => {
                  const scopes = equipmentLocker.items.filter(
                    (it) => it.category === 'telescope'
                  );
                  const eyepieces = equipmentLocker.items.filter(
                    (it) => it.category === 'eyepiece'
                  );
                  const barlows = equipmentLocker.items.filter(
                    (it) => it.category === 'barlow'
                  );
                  const activeScope = scopes.find(
                    (s) => s.id === equipmentLocker.activeIds.telescope
                  );
                  const activeEp = eyepieces.find(
                    (ep) => ep.id === equipmentLocker.activeIds.eyepiece
                  );
                  const activeBarlow = barlows.find(
                    (b) => b.id === equipmentLocker.activeIds.barlow
                  );
                  const factor =
                    activeBarlow?.factor && activeBarlow.factor > 0
                      ? activeBarlow.factor
                      : 1;
                  const effFl = activeScope?.focalLengthMm
                    ? activeScope.focalLengthMm * factor
                    : null;
                  const mag =
                    effFl && activeEp?.focalLengthMm && activeEp.focalLengthMm > 0
                      ? effFl / activeEp.focalLengthMm
                      : null;
                  const tfov = mag && activeEp?.afovDeg ? activeEp.afovDeg / mag : null;
                  const exitPupil =
                    mag && activeScope?.apertureMm ? activeScope.apertureMm / mag : null;

                  return (
                    <div className="space-y-2">
                      <div>
                        <label
                          className={`block mb-0.5 text-[10px] tracking-[-0.05em] ${ui.textMuted}`}
                        >
                          경통 선택
                        </label>
                        <select
                          value={equipmentLocker.activeIds.telescope ?? ''}
                          onChange={(e) =>
                            onSelectActiveEquipment('telescope', e.target.value || null)
                          }
                          className={`w-full px-2 py-1.5 border text-[10.5px] ${ui.input}`}
                          style={{ borderRadius: '5px' }}
                        >
                          <option value="">경통 선택 안함</option>
                          {scopes.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.name}
                              {sc.focalLengthMm ? ` (${sc.focalLengthMm}mm)` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          className={`block mb-0.5 text-[10px] tracking-[-0.05em] ${ui.textMuted}`}
                        >
                          아이피스 선택
                        </label>
                        <select
                          value={equipmentLocker.activeIds.eyepiece ?? ''}
                          onChange={(e) =>
                            onSelectActiveEquipment('eyepiece', e.target.value || null)
                          }
                          className={`w-full px-2 py-1.5 border text-[10.5px] ${ui.input}`}
                          style={{ borderRadius: '5px' }}
                        >
                          <option value="">아이피스 선택 안함</option>
                          {eyepieces.map((ep) => (
                            <option key={ep.id} value={ep.id}>
                              {ep.name}
                              {ep.focalLengthMm && ep.afovDeg
                                ? ` (${ep.focalLengthMm}mm · ${ep.afovDeg}°)`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          className={`block mb-0.5 text-[10px] tracking-[-0.05em] ${ui.textMuted}`}
                        >
                          바로우 / 리듀서
                        </label>
                        <select
                          value={equipmentLocker.activeIds.barlow ?? ''}
                          onChange={(e) =>
                            onSelectActiveEquipment('barlow', e.target.value || null)
                          }
                          className={`w-full px-2 py-1.5 border text-[10.5px] ${ui.input}`}
                          style={{ borderRadius: '5px' }}
                        >
                          <option value="">사용 안함 (1×)</option>
                          {barlows.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                              {b.factor ? ` (${b.factor}×)` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {effFl && mag && tfov ? (
                        <div
                          className={`rounded-md border px-2.5 py-2 space-y-1 text-[10.5px] ${
                            theme === 'white'
                              ? 'bg-amber-50 border-amber-300'
                              : theme === 'red'
                              ? 'bg-[#1D0404] border-[#5A1212]'
                              : 'bg-[#1D160B] border-[#6B4514]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={ui.textMuted}>유효 초점거리 :</span>
                            <span className={`font-mono font-semibold tabular-nums ${ui.textPrimary}`}>
                              {Math.round(effFl)}mm{factor !== 1 ? ` (${factor}×)` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={ui.textMuted}>배율 / 사출동공 :</span>
                            <span
                              className={`font-mono font-bold tabular-nums ${
                                theme === 'white'
                                  ? 'text-amber-700'
                                  : theme === 'red'
                                  ? 'text-[#FF3B3B]'
                                  : 'text-amber-400'
                              }`}
                            >
                              {mag.toFixed(1)}×
                              {exitPupil ? ` · ${exitPupil.toFixed(1)}mm` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={ui.textMuted}>실시야각 (TFOV) :</span>
                            <span
                              className={`font-mono font-bold tabular-nums ${
                                theme === 'white'
                                  ? 'text-amber-700'
                                  : theme === 'red'
                                  ? 'text-[#FF3B3B]'
                                  : 'text-amber-400'
                              }`}
                            >
                              {tfov.toFixed(2)}°
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-2 py-2 border rounded text-[10px] leading-snug ${cardIdleCls} ${ui.textMuted}`}
                        >
                          {scopes.length === 0 || eyepieces.length === 0
                            ? '위 내 장비함에서 경통과 아이피스를 먼저 등록해 주세요.'
                            : '경통과 아이피스를 선택하면 시야각이 자동으로 계산·표시됩니다.'}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : optics.eyepieceInputMode === 'direct' ? (
                <div className="space-y-2">
                  <div>
                    <label className={`block mb-1 text-[10.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                      아이피스 실시야각 직접 입력 (TFOV, °)
                    </label>
                    <input
                      type="number"
                      min={0.05}
                      max={20}
                      step={0.05}
                      value={optics.eyepieceFovDeg}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isFinite(v)) return;
                        onChangeOptics((p) => ({
                          ...p,
                          showEyepiece: true,
                          eyepieceFovDeg: Math.max(0.05, Math.min(20, v)),
                          eyepieceLabel: '망원경 아이피스',
                        }));
                      }}
                      className={`w-full px-2 py-1.5 border text-xs font-mono tabular-nums ${ui.input}`}
                      style={{ borderRadius: '5px' }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={8.0}
                    step={0.05}
                    value={Math.min(8.0, optics.eyepieceFovDeg)}
                    onChange={(e) =>
                      onChangeOptics((p) => ({
                        ...p,
                        showEyepiece: true,
                        eyepieceFovDeg: Number(e.target.value),
                        eyepieceLabel: '망원경 아이피스',
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className={`block mb-1 text-[10.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                      망원경 초점거리 (mm)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={10000}
                      step={10}
                      value={optics.telescopeFocalLengthMm}
                      onChange={(e) => {
                        const fl = parseFloat(e.target.value);
                        if (!Number.isFinite(fl) || fl <= 0) return;
                        onChangeOptics((p) => {
                          const mag = fl / Math.max(1, p.eyepieceFocalLengthMm);
                          const tfov = Math.max(0.05, Math.min(20, p.eyepieceAfovDeg / mag));
                          return {
                            ...p,
                            showEyepiece: true,
                            telescopeFocalLengthMm: fl,
                            eyepieceFovDeg: Number(tfov.toFixed(2)),
                          };
                        });
                      }}
                      className={`w-full px-2 py-1.5 border text-xs font-mono tabular-nums ${ui.input}`}
                      style={{ borderRadius: '5px' }}
                    />
                  </div>

                  <div>
                    <label className={`block mb-1 text-[10.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                      아이피스 초점거리 (mm)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={0.1}
                      value={optics.eyepieceFocalLengthMm}
                      onChange={(e) => {
                        const epFl = parseFloat(e.target.value);
                        if (!Number.isFinite(epFl) || epFl <= 0) return;
                        onChangeOptics((p) => {
                          const mag = p.telescopeFocalLengthMm / epFl;
                          const tfov = Math.max(0.05, Math.min(20, p.eyepieceAfovDeg / mag));
                          return {
                            ...p,
                            showEyepiece: true,
                            eyepieceFocalLengthMm: epFl,
                            eyepieceFovDeg: Number(tfov.toFixed(2)),
                          };
                        });
                      }}
                      className={`w-full px-2 py-1.5 border text-xs font-mono tabular-nums ${ui.input}`}
                      style={{ borderRadius: '5px' }}
                    />
                  </div>

                  <div>
                    <label className={`block mb-1 text-[10.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                      아이피스 겉보기 시야각 (AFOV, °)
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={120}
                      step={1}
                      value={optics.eyepieceAfovDeg}
                      onChange={(e) => {
                        const afov = parseFloat(e.target.value);
                        if (!Number.isFinite(afov) || afov <= 0) return;
                        onChangeOptics((p) => {
                          const mag =
                            p.telescopeFocalLengthMm / Math.max(1, p.eyepieceFocalLengthMm);
                          const tfov = Math.max(0.05, Math.min(20, afov / mag));
                          return {
                            ...p,
                            showEyepiece: true,
                            eyepieceAfovDeg: afov,
                            eyepieceFovDeg: Number(tfov.toFixed(2)),
                          };
                        });
                      }}
                      className={`w-full px-2 py-1.5 border text-xs font-mono tabular-nums ${ui.input}`}
                      style={{ borderRadius: '5px' }}
                    />
                    <div className="grid grid-cols-4 gap-1 mt-1.5">
                      {AFOV_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            onChangeOptics((p) => {
                              const mag =
                                p.telescopeFocalLengthMm /
                                Math.max(1, p.eyepieceFocalLengthMm);
                              const tfov = Math.max(0.05, Math.min(20, preset / mag));
                              return {
                                ...p,
                                showEyepiece: true,
                                eyepieceAfovDeg: preset,
                                eyepieceFovDeg: Number(tfov.toFixed(2)),
                              };
                            })
                          }
                          className={`py-1 border text-[10.5px] font-mono tabular-nums font-semibold rounded transition-colors ${
                            Math.abs(optics.eyepieceAfovDeg - preset) < 0.5
                              ? theme === 'red'
                                ? 'bg-[#7F1D1D] border-[#DC2626] text-[#FF5252]'
                                : 'bg-amber-500 border-amber-400 text-slate-950'
                              : ui.buttonIdle
                          }`}
                        >
                          {preset}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Magnification & TFOV Result Box */}
                  {(() => {
                    const mag =
                      optics.eyepieceFocalLengthMm > 0
                        ? optics.telescopeFocalLengthMm / optics.eyepieceFocalLengthMm
                        : 0;
                    const tfov = mag > 0 ? optics.eyepieceAfovDeg / mag : 0;
                    return (
                      <div
                        className={`rounded-md border px-2.5 py-2 space-y-1 text-[11px] ${
                          theme === 'white'
                            ? 'bg-amber-50 border-amber-300'
                            : theme === 'red'
                            ? 'bg-[#1D0404] border-[#5A1212]'
                            : 'bg-[#1D160B] border-[#6B4514]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={ui.textMuted}>배율 :</span>
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              theme === 'white'
                                ? 'text-amber-700'
                                : theme === 'red'
                                ? 'text-[#FF3B3B]'
                                : 'text-amber-400'
                            }`}
                          >
                            {mag.toFixed(1)}×
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={ui.textMuted}>실시야각 (TFOV) :</span>
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              theme === 'white'
                                ? 'text-amber-700'
                                : theme === 'red'
                                ? 'text-[#FF3B3B]'
                                : 'text-amber-400'
                            }`}
                          >
                            {tfov.toFixed(2)}°
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              </div>
              )}
            </div>

            {/* Astrophotography Sensor Frame (내 장비 조합 + 스마트망원경 바로 적용 + 모자이크 화각 + 회전) */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('optics_sensor')}
                aria-expanded={isSectionOpen('optics_sensor')}
                className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${sectionHeaderCls(
                  isSectionOpen('optics_sensor')
                )}`}
              >
                <span
                  className={`flex items-center gap-1 min-w-0 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('optics_sensor')
                    )} ${isSectionOpen('optics_sensor') ? '' : '-rotate-90'}`}
                  />
                  <span>촬영 센서 화각 프레임</span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.textMuted}`}>
                  {(() => {
                    const mOn = Boolean(optics.sensorMosaicSupported);
                    const sw = mOn ? Math.max(1, optics.sensorMosaicScaleW ?? 1) : 1;
                    const sh = mOn ? Math.max(1, optics.sensorMosaicScaleH ?? 1) : 1;
                    return `${(optics.sensorWidthDeg * sw).toFixed(2)}°×${(
                      optics.sensorHeightDeg * sh
                    ).toFixed(2)}°`;
                  })()}
                </span>
              </button>

              {isSectionOpen('optics_sensor') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>

              {/* 2-Mode Switcher: 장비 조합 vs 스마트망원경 바로 적용 */}
              <div
                className={`grid grid-cols-2 gap-0.5 p-0.5 rounded-md border ${
                  theme === 'white'
                    ? 'bg-slate-100 border-slate-300'
                    : theme === 'red'
                    ? 'bg-[#120101] border-[#420C0C]'
                    : 'bg-[#0B1220] border-[#25334D]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSensorFrameMode('combo')}
                  className={`py-1 px-1 rounded text-[10px] font-semibold tracking-[-0.06em] whitespace-nowrap transition-colors ${
                    sensorFrameMode === 'combo' ? ui.buttonActive : `${ui.textMuted} hover:opacity-100`
                  }`}
                >
                  장비 조합
                </button>
                <button
                  type="button"
                  onClick={() => setSensorFrameMode('smart')}
                  className={`py-1 px-1 rounded text-[10px] font-semibold tracking-[-0.06em] whitespace-nowrap transition-colors ${
                    sensorFrameMode === 'smart' ? ui.buttonActive : `${ui.textMuted} hover:opacity-100`
                  }`}
                >
                  스마트망원경
                </button>
              </div>

              {sensorFrameMode === 'combo' ? (
                (() => {
                  const scopes = equipmentLocker.items.filter(
                    (it) => it.category === 'telescope'
                  );
                  const barlows = equipmentLocker.items.filter(
                    (it) => it.category === 'barlow'
                  );
                  const cameras = equipmentLocker.items.filter(
                    (it) => it.category === 'camera'
                  );
                  const activeScope = scopes.find(
                    (s) => s.id === equipmentLocker.activeIds.telescope
                  );
                  const activeBarlow = barlows.find(
                    (b) => b.id === equipmentLocker.activeIds.barlow
                  );
                  const activeCam = cameras.find(
                    (c) => c.id === equipmentLocker.activeIds.camera
                  );
                  const isSmartCam = Boolean(
                    activeCam?.isSmartTelescope && activeCam.focalLengthMm
                  );
                  const factor =
                    activeBarlow?.factor && activeBarlow.factor > 0
                      ? activeBarlow.factor
                      : 1;
                  const effFl = isSmartCam
                    ? activeCam!.focalLengthMm!
                    : activeScope?.focalLengthMm
                    ? activeScope.focalLengthMm * factor
                    : null;
                  const fovW =
                    effFl && activeCam?.sensorWidthMm
                      ? 2 * Math.atan(activeCam.sensorWidthMm / (2 * effFl)) * RAD2DEG
                      : null;
                  const fovH =
                    effFl && activeCam?.sensorHeightMm
                      ? 2 * Math.atan(activeCam.sensorHeightMm / (2 * effFl)) * RAD2DEG
                      : null;
                  const pixelScale =
                    effFl && activeCam?.pixelSizeUm
                      ? (activeCam.pixelSizeUm / effFl) * 206.265
                      : null;

                  return (
                    <div className="space-y-2">
                      <div>
                        <label
                          className={`block mb-0.5 text-[10px] tracking-[-0.05em] ${ui.textMuted}`}
                        >
                          카메라 / 스마트망원경 선택
                        </label>
                        <select
                          value={equipmentLocker.activeIds.camera ?? ''}
                          onChange={(e) =>
                            onSelectActiveEquipment('camera', e.target.value || null)
                          }
                          className={`w-full px-2 py-1.5 border text-[10.5px] ${ui.input}`}
                          style={{ borderRadius: '5px' }}
                        >
                          <option value="">카메라 선택 안함</option>
                          {cameras.map((cam) => (
                            <option key={cam.id} value={cam.id}>
                              {cam.isSmartTelescope ? `[스마트] ${cam.name}` : cam.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!isSmartCam && (
                        <>
                          <div>
                            <label
                              className={`block mb-0.5 text-[10px] tracking-[-0.05em] ${ui.textMuted}`}
                            >
                              경통 선택
                            </label>
                            <select
                              value={equipmentLocker.activeIds.telescope ?? ''}
                              onChange={(e) =>
                                onSelectActiveEquipment('telescope', e.target.value || null)
                              }
                              className={`w-full px-2 py-1.5 border text-[10.5px] ${ui.input}`}
                              style={{ borderRadius: '5px' }}
                            >
                              <option value="">경통 선택 안함</option>
                              {scopes.map((sc) => (
                                <option key={sc.id} value={sc.id}>
                                  {sc.name}
                                  {sc.focalLengthMm ? ` (${sc.focalLengthMm}mm)` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              className={`block mb-0.5 text-[10px] tracking-[-0.05em] ${ui.textMuted}`}
                            >
                              리듀서 / 바로우
                            </label>
                            <select
                              value={equipmentLocker.activeIds.barlow ?? ''}
                              onChange={(e) =>
                                onSelectActiveEquipment('barlow', e.target.value || null)
                              }
                              className={`w-full px-2 py-1.5 border text-[10.5px] ${ui.input}`}
                              style={{ borderRadius: '5px' }}
                            >
                              <option value="">사용 안함 (1×)</option>
                              {barlows.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                  {b.factor ? ` (${b.factor}×)` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      {effFl && fovW && fovH ? (
                        <div
                          className={`rounded-md border px-2.5 py-2 space-y-1 text-[10.5px] ${cardIdleCls}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={ui.textMuted}>
                              {isSmartCam ? '내장 초점거리 :' : '유효 초점거리 :'}
                            </span>
                            <span className={`font-mono font-semibold tabular-nums ${ui.textPrimary}`}>
                              {Math.round(effFl)}mm
                              {!isSmartCam && factor !== 1 ? ` (${factor}×)` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={ui.textMuted}>센서 화각 :</span>
                            <span className={`font-mono font-bold tabular-nums ${ui.accentText}`}>
                              {fovW.toFixed(2)}° × {fovH.toFixed(2)}°
                            </span>
                          </div>
                          {pixelScale && (
                            <div className="flex items-center justify-between">
                              <span className={ui.textMuted}>픽셀 스케일 :</span>
                              <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                                {pixelScale.toFixed(2)}″/px
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`px-2 py-2 border rounded text-[10px] leading-snug ${cardIdleCls} ${ui.textMuted}`}
                        >
                          {cameras.length === 0
                            ? '위 내 장비함의 카메라 탭에서 카메라 또는 스마트망원경을 등록해 주세요.'
                            : '카메라와 경통을 선택하면 화각 프레임이 자동 계산되어 성도에 표시됩니다.'}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const mySmartScopes = equipmentLocker.items.filter(
                    (it) =>
                      it.category === 'camera' &&
                      it.isSmartTelescope &&
                      it.focalLengthMm &&
                      it.sensorWidthMm &&
                      it.sensorHeightMm
                  );
                  return (
                    <div className="space-y-1.5">
                      {mySmartScopes.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[9.5px] font-semibold ${ui.textMuted}`}>
                              내 장비함 등록 스마트망원경
                            </span>
                            <span className={`text-[9px] tracking-[-0.04em] ${ui.textMuted}`}>
                              모자이크 지원
                            </span>
                          </div>
                          {mySmartScopes.map((sc) => {
                            const w = Number(
                              (
                                2 *
                                Math.atan(sc.sensorWidthMm! / (2 * sc.focalLengthMm!)) *
                                RAD2DEG
                              ).toFixed(2)
                            );
                            const h = Number(
                              (
                                2 *
                                Math.atan(sc.sensorHeightMm! / (2 * sc.focalLengthMm!)) *
                                RAD2DEG
                              ).toFixed(2)
                            );
                            const isApplied =
                              optics.showSensorBox &&
                              Math.abs(optics.sensorWidthDeg - w) < 0.02 &&
                              Math.abs(optics.sensorHeightDeg - h) < 0.02 &&
                              (!optics.sensorEquipmentLabel ||
                                optics.sensorEquipmentLabel === sc.name);
                            const canRot = isSmartTelescopeRotatable(sc);
                            const canMosaic = isSmartTelescopeMosaicSupported(sc);
                            const maxMosaic = getSmartTelescopeMosaicMaxScale(sc);
                            return (
                              <div
                                key={sc.id}
                                className={`w-full px-1.5 py-1 border flex items-center gap-1 text-[10px] tracking-[-0.05em] ${
                                  isApplied ? ui.buttonActive : ui.buttonIdle
                                }`}
                                style={{ borderRadius: '4px' }}
                              >
                                <button
                                  type="button"
                                  onClick={() => onSelectActiveEquipment('camera', sc.id)}
                                  className="flex-1 min-w-0 text-left flex items-center justify-between gap-1 cursor-pointer"
                                >
                                  <span className="truncate font-medium">
                                    {sc.name}
                                    {canRot ? ' · 회전' : ''}
                                  </span>
                                  <span className="font-mono tabular-nums whitespace-nowrap shrink-0 text-[9.5px]">
                                    {w.toFixed(2)}°×{h.toFixed(2)}°
                                  </span>
                                </button>
                                <label
                                  title={`${sc.name} 모자이크 촬영 지원 체크`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-0.5 pl-1 border-l border-current/20 shrink-0 cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={canMosaic}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      onAddOrUpdateEquipment({
                                        ...sc,
                                        supportsMosaic: checked,
                                        mosaicMaxScale: sc.mosaicMaxScale ?? maxMosaic,
                                      });
                                      if (isApplied) {
                                        onChangeOptics((p) => ({
                                          ...p,
                                          sensorMosaicSupported: checked,
                                          sensorMosaicMaxScale: maxMosaic,
                                          sensorMosaicScaleW: checked
                                            ? Math.min(maxMosaic, Math.max(1.0, p.sensorMosaicScaleW ?? 1.0))
                                            : 1.0,
                                          sensorMosaicScaleH: checked
                                            ? Math.min(maxMosaic, Math.max(1.0, p.sensorMosaicScaleH ?? 1.0))
                                            : 1.0,
                                        }));
                                      }
                                    }}
                                    className="w-3 h-3 shrink-0 accent-emerald-500 cursor-pointer"
                                  />
                                  <span className="text-[8.5px] opacity-85 whitespace-nowrap">
                                    모자이크
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9.5px] font-semibold ${ui.textMuted}`}>
                            주요 스마트망원경 바로 적용
                          </span>
                          <span className={`text-[9px] tracking-[-0.04em] ${ui.textMuted}`}>
                            모자이크 지원
                          </span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto astro-scroll pr-0.5">
                          {SMART_TELESCOPE_PRESETS.map((sp) => {
                            const w = Number(
                              (
                                2 *
                                Math.atan(
                                  (sp.sensorWidthMm ?? 5.6) / (2 * (sp.focalLengthMm ?? 150))
                                ) *
                                RAD2DEG
                              ).toFixed(2)
                            );
                            const h = Number(
                              (
                                2 *
                                Math.atan(
                                  (sp.sensorHeightMm ?? 3.1) / (2 * (sp.focalLengthMm ?? 150))
                                ) *
                                RAD2DEG
                              ).toFixed(2)
                            );
                            const canRot = isSmartTelescopeRotatable(sp);
                            const canMosaic =
                              typeof presetMosaicOverrides[sp.id] === 'boolean'
                                ? presetMosaicOverrides[sp.id]
                                : isSmartTelescopeMosaicSupported(sp);
                            const maxMosaic = getSmartTelescopeMosaicMaxScale(sp);
                            const isApplied =
                              optics.showSensorBox &&
                              Math.abs(optics.sensorWidthDeg - w) < 0.02 &&
                              Math.abs(optics.sensorHeightDeg - h) < 0.02 &&
                              (!optics.sensorEquipmentLabel ||
                                optics.sensorEquipmentLabel === sp.name);
                            return (
                              <div
                                key={sp.id}
                                className={`w-full px-1.5 py-1 border flex items-center gap-1 text-[10px] tracking-[-0.05em] ${
                                  isApplied ? ui.buttonActive : ui.buttonIdle
                                }`}
                                style={{ borderRadius: '4px' }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    onChangeOptics((p) => ({
                                      ...p,
                                      showSensorBox: true,
                                      sensorWidthDeg: w,
                                      sensorHeightDeg: h,
                                      sensorEquipmentLabel: sp.name,
                                      sensorRotationLocked: !canRot,
                                      sensorRotationDeg: canRot ? p.sensorRotationDeg : 0,
                                      sensorMosaicSupported: canMosaic,
                                      sensorMosaicMaxScale: maxMosaic,
                                      sensorMosaicScaleW: canMosaic
                                        ? Math.min(maxMosaic, Math.max(1.0, p.sensorMosaicScaleW ?? 1.0))
                                        : 1.0,
                                      sensorMosaicScaleH: canMosaic
                                        ? Math.min(maxMosaic, Math.max(1.0, p.sensorMosaicScaleH ?? 1.0))
                                        : 1.0,
                                    }))
                                  }
                                  className="flex-1 min-w-0 text-left flex items-center justify-between gap-1 cursor-pointer"
                                >
                                  <span className="truncate">
                                    {sp.name} · {sp.focalLengthMm}mm
                                    {canRot ? ' · 회전' : ''}
                                  </span>
                                  <span className="font-mono tabular-nums whitespace-nowrap shrink-0 text-[9.5px]">
                                    {w.toFixed(2)}°×{h.toFixed(2)}°
                                  </span>
                                </button>
                                <label
                                  title={`${sp.name} 모자이크 촬영 지원 체크`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-0.5 pl-1 border-l border-current/20 shrink-0 cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={canMosaic}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setPresetMosaicOverrides((prev) => ({
                                        ...prev,
                                        [sp.id]: checked,
                                      }));
                                      if (isApplied) {
                                        onChangeOptics((p) => ({
                                          ...p,
                                          sensorMosaicSupported: checked,
                                          sensorMosaicMaxScale: maxMosaic,
                                          sensorMosaicScaleW: checked
                                            ? Math.min(maxMosaic, Math.max(1.0, p.sensorMosaicScaleW ?? 1.0))
                                            : 1.0,
                                          sensorMosaicScaleH: checked
                                            ? Math.min(maxMosaic, Math.max(1.0, p.sensorMosaicScaleH ?? 1.0))
                                            : 1.0,
                                        }));
                                      }
                                    }}
                                    className="w-3 h-3 shrink-0 accent-emerald-500 cursor-pointer"
                                  />
                                  <span className="text-[8.5px] opacity-85 whitespace-nowrap">
                                    모자이크
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* 모자이크 촬영 화각 (촬영 센서 화각 회전 위 · 모자이크 지원 스마트 망원경 선택 시 활성화) */}
              {(() => {
                const mosaicEnabled = Boolean(optics.sensorMosaicSupported);
                const maxScale = Math.max(1.2, Math.min(4.0, optics.sensorMosaicMaxScale ?? 2.0));
                const scaleW = mosaicEnabled
                  ? Math.max(1.0, Math.min(maxScale, optics.sensorMosaicScaleW ?? 1.0))
                  : 1.0;
                const scaleH = mosaicEnabled
                  ? Math.max(1.0, Math.min(maxScale, optics.sensorMosaicScaleH ?? 1.0))
                  : 1.0;
                const isExpanded = mosaicEnabled && (scaleW > 1.001 || scaleH > 1.001);
                const effW = optics.sensorWidthDeg * scaleW;
                const effH = optics.sensorHeightDeg * scaleH;

                const updateMosaicScale = (nextW: number, nextH: number) => {
                  const clampedW = Number(Math.max(1.0, Math.min(maxScale, nextW)).toFixed(1));
                  const clampedH = Number(Math.max(1.0, Math.min(maxScale, nextH)).toFixed(1));
                  onChangeOptics((p) => ({
                    ...p,
                    showSensorBox: true,
                    sensorMosaicScaleW: clampedW,
                    sensorMosaicScaleH: clampedH,
                  }));
                };

                const quickMultipliers = Array.from(
                  new Set([1.0, 1.5, Math.min(2.0, maxScale), maxScale])
                ).sort((a, b) => a - b);

                return (
                  <div className={`pt-2.5 mt-1 border-t ${ui.divider} space-y-2`}>
                    <div className="flex items-center justify-between gap-1 text-[10.5px]">
                      <span
                        className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${
                          mosaicEnabled ? ui.textPrimary : ui.textMuted
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                        <span>모자이크 촬영 화각</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {mosaicEnabled ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setMosaicScaleLinked((v) => !v)}
                              title={
                                mosaicScaleLinked
                                  ? '가로·세로 배율 동시 조절 중 (클릭 시 개별 조절)'
                                  : '가로·세로 개별 조절 중 (클릭 시 동시 조절)'
                              }
                              className={`inline-flex items-center gap-0.5 px-1 py-0.5 border text-[9px] tracking-[-0.04em] transition-colors ${
                                mosaicScaleLinked ? ui.buttonActive : ui.buttonIdle
                              }`}
                              style={{ borderRadius: '4px' }}
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              <span>연동</span>
                            </button>
                            {isExpanded && (
                              <button
                                type="button"
                                onClick={() => updateMosaicScale(1.0, 1.0)}
                                className={`text-[9.5px] tracking-[-0.05em] opacity-80 hover:opacity-100 ${ui.accentText}`}
                              >
                                1.0×
                              </button>
                            )}
                          </>
                        ) : (
                          <span className={`text-[9.5px] tracking-[-0.04em] ${ui.textMuted}`}>
                            비활성
                          </span>
                        )}
                      </div>
                    </div>

                    {mosaicEnabled ? (
                      <div className="space-y-2">
                        <div
                          className={`rounded-md border px-2 py-1.5 space-y-0.5 text-[10px] ${cardIdleCls}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={ui.textMuted}>모자이크 화각 :</span>
                            <span className={`font-mono font-bold tabular-nums ${ui.accentText}`}>
                              {effW.toFixed(2)}° × {effH.toFixed(2)}°
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[9.5px]">
                            <span className={ui.textMuted}>
                              단일 {optics.sensorWidthDeg.toFixed(2)}°×{optics.sensorHeightDeg.toFixed(2)}°
                            </span>
                            <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                              {scaleW.toFixed(1)}× / {scaleH.toFixed(1)}× (최대 {maxScale.toFixed(1)}×)
                            </span>
                          </div>
                        </div>

                        {/* Horizontal Scale Slider */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={ui.textSecondary}>가로 화각 배율 (W)</span>
                            <span className={`font-mono font-semibold tabular-nums ${ui.textPrimary}`}>
                              {scaleW.toFixed(1)}배 ({effW.toFixed(2)}°)
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1.0}
                            max={maxScale}
                            step={0.1}
                            value={scaleW}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              updateMosaicScale(next, mosaicScaleLinked ? next : scaleH);
                            }}
                            aria-label="모자이크 가로 화각 배율"
                            className={`w-full h-1.5 cursor-pointer ${
                              theme === 'red' ? 'accent-red-600' : 'accent-emerald-500'
                            }`}
                          />
                        </div>

                        {/* Vertical Scale Slider */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={ui.textSecondary}>세로 화각 배율 (H)</span>
                            <span className={`font-mono font-semibold tabular-nums ${ui.textPrimary}`}>
                              {scaleH.toFixed(1)}배 ({effH.toFixed(2)}°)
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1.0}
                            max={maxScale}
                            step={0.1}
                            value={scaleH}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              updateMosaicScale(mosaicScaleLinked ? next : scaleW, next);
                            }}
                            aria-label="모자이크 세로 화각 배율"
                            className={`w-full h-1.5 cursor-pointer ${
                              theme === 'red' ? 'accent-red-600' : 'accent-emerald-500'
                            }`}
                          />
                        </div>

                        {/* Quick Scale Presets */}
                        <div className="grid grid-cols-4 gap-1">
                          {quickMultipliers.map((mult) => {
                            const active =
                              Math.abs(scaleW - mult) < 0.05 && Math.abs(scaleH - mult) < 0.05;
                            return (
                              <button
                                key={mult}
                                type="button"
                                onClick={() => updateMosaicScale(mult, mult)}
                                className={`py-1 border text-[10px] font-mono tabular-nums transition-colors ${
                                  active ? ui.buttonActive : ui.buttonIdle
                                }`}
                                style={{ borderRadius: '4px' }}
                              >
                                {mult.toFixed(1)}×
                              </button>
                            );
                          })}
                        </div>

                        {/* Max Supported Mosaic Multiplier */}
                        <div className="flex items-center justify-between gap-1 text-[9.5px]">
                          <span className={ui.textMuted}>기기 최대 지원 배율</span>
                          <div className="flex items-center gap-1">
                            {[2.0, 2.5, 3.0].map((cap) => (
                              <button
                                key={cap}
                                type="button"
                                onClick={() =>
                                  onChangeOptics((p) => ({
                                    ...p,
                                    sensorMosaicMaxScale: cap,
                                    sensorMosaicScaleW: Math.min(cap, Math.max(1.0, p.sensorMosaicScaleW ?? 1.0)),
                                    sensorMosaicScaleH: Math.min(cap, Math.max(1.0, p.sensorMosaicScaleH ?? 1.0)),
                                  }))
                                }
                                className={`px-1.5 py-0.5 border font-mono text-[9px] tabular-nums transition-colors ${
                                  Math.abs(maxScale - cap) < 0.05 ? ui.buttonActive : ui.buttonIdle
                                }`}
                                style={{ borderRadius: '4px' }}
                              >
                                {cap.toFixed(1)}×
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={`text-[9.5px] leading-snug tracking-[-0.03em] break-keep ${ui.textMuted}`}
                      >
                        스마트망원경 목록에서 ‘모자이크’가 체크된 망원경을 선택하면 가로·세로 1.0배부터
                        지원 화각까지 넓게 표시할 수 있습니다.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* 촬영 센서 화각 프레임 회전 (스마트망원경 중 Draco 등 회전 가능 기종 제외 시 회전 잠금) */}
              {(() => {
                const activeCam = equipmentLocker.activeIds.camera
                  ? equipmentLocker.items.find(
                      (it) => it.id === equipmentLocker.activeIds.camera && it.category === 'camera'
                    )
                  : undefined;
                const lockedByActiveCam =
                  Boolean(activeCam?.isSmartTelescope) &&
                  !isSmartTelescopeRotatable(activeCam) &&
                  (!optics.sensorEquipmentLabel ||
                    optics.sensorEquipmentLabel === activeCam?.name);
                const sensorCanRotate = !optics.sensorRotationLocked && !lockedByActiveCam;
                const effectiveRot = sensorCanRotate ? optics.sensorRotationDeg ?? 0 : 0;
                const canInteract = optics.showSensorBox && sensorCanRotate;

                return (
                  <div className={`pt-2.5 mt-1 border-t ${ui.divider} space-y-1.5`}>
                    <div className="flex items-center justify-between gap-1 text-[10.5px]">
                      <span
                        className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
                      >
                        촬영 센서 화각 회전 (지평)
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!sensorCanRotate ? (
                          <span
                            className={`text-[9.5px] font-medium tracking-[-0.05em] whitespace-nowrap ${ui.textMuted}`}
                          >
                            고정 (0°)
                          </span>
                        ) : optics.showSensorBox ? (
                          <>
                            {effectiveRot !== 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onChangeOptics((p) => ({ ...p, sensorRotationDeg: 0 }))
                                }
                                className={`text-[9.5px] tracking-[-0.05em] opacity-80 hover:opacity-100 ${ui.accentText}`}
                              >
                                0° 초기화
                              </button>
                            )}
                            <span
                              className={`font-mono tabular-nums font-semibold ${ui.textPrimary}`}
                            >
                              {Math.round(effectiveRot)}°
                            </span>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onChangeOptics((p) => ({ ...p, showSensorBox: true }))
                            }
                            className={`text-[9.5px] tracking-[-0.05em] underline underline-offset-2 ${ui.accentText}`}
                          >
                            화각 켜기
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={1}
                      disabled={!canInteract}
                      value={effectiveRot}
                      onChange={(e) =>
                        onChangeOptics((p) => ({
                          ...p,
                          sensorRotationDeg: Number(e.target.value),
                        }))
                      }
                      aria-label="촬영 센서 화각 프레임 회전 각도"
                      className={`w-full h-1.5 ${
                        theme === 'red' ? 'accent-red-600' : 'accent-cyan-500'
                      } ${canInteract ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'}`}
                    />

                    <div className="grid grid-cols-4 gap-1">
                      {[0, 90, 180, 270].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          disabled={!canInteract}
                          onClick={() =>
                            onChangeOptics((p) => ({ ...p, sensorRotationDeg: deg }))
                          }
                          className={`py-1 border text-[10px] font-mono tabular-nums transition-colors ${
                            canInteract && Math.round(effectiveRot) % 360 === deg
                              ? ui.buttonActive
                              : ui.buttonIdle
                          } ${!canInteract ? 'opacity-45 cursor-not-allowed' : ''}`}
                          style={{ borderRadius: '4px' }}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>

                    {!sensorCanRotate ? (
                      <p
                        className={`text-[9.5px] leading-snug tracking-[-0.03em] break-keep ${ui.textMuted}`}
                      >
                        지상 지평선 기준으로 시간에 따라 시야가 회전하며, 현재 스마트 망원경은
                        로테이터를 지원하지 않아 지평 0°로 고정됩니다. (DWARFLAB Draco 등 회전 지원 모델은 회전 가능)
                      </p>
                    ) : (
                      <p
                        className={`text-[9.5px] leading-snug tracking-[-0.03em] break-keep ${ui.textMuted}`}
                      >
                        지상(지평좌표계) 기준으로 시간에 따라 프레임 각도가 회전합니다.
                      </p>
                    )}
                  </div>
                );
              })()}
              </div>
              )}
            </div>

            {/* Sensor FOV PNG Footer Caption Settings (제일 아래쪽 배치) */}
            {(() => {
              const captionCfg: SensorExportCaptionConfig = {
                ...DEFAULT_SENSOR_EXPORT_CAPTION,
                ...(optics.sensorExportCaption ?? {}),
              };
              const updateCaption = (patch: Partial<SensorExportCaptionConfig>) => {
                onChangeOptics((prev) => ({
                  ...prev,
                  sensorExportCaption: {
                    ...DEFAULT_SENSOR_EXPORT_CAPTION,
                    ...(prev.sensorExportCaption ?? {}),
                    ...patch,
                  },
                }));
              };
              const toggleItems: {
                key: Exclude<keyof SensorExportCaptionConfig, 'customNote'>;
                label: string;
              }[] = [
                { key: 'showTargetName', label: '중심 천체명' },
                { key: 'showCoordinates', label: '적경·적위 좌표' },
                { key: 'showDateTime', label: '관측 일시' },
                { key: 'showLocation', label: '관측지 이름' },
                { key: 'showConstellation', label: '별자리명' },
                { key: 'showEquipmentFov', label: '장비·센서 화각' },
                { key: 'showRotation', label: '좌표계·회전각' },
                { key: 'showNoxChartBrand', label: 'NoxChart 표기' },
              ];
              const enabledCount = toggleItems.filter((item) => captionCfg[item.key]).length;
              const isModified =
                toggleItems.some(
                  (item) => captionCfg[item.key] !== DEFAULT_SENSOR_EXPORT_CAPTION[item.key]
                ) || captionCfg.customNote.length > 0;

              // Build compact live preview matching exportSensorFovPng layout
              const previewEquip =
                optics.sensorEquipmentLabel && !optics.sensorEquipmentLabel.startsWith('FOV_')
                  ? optics.sensorEquipmentLabel
                  : '촬영 센서';
              const mOn = Boolean(optics.sensorMosaicSupported);
              const mSw = mOn ? Math.max(1, optics.sensorMosaicScaleW ?? 1) : 1;
              const mSh = mOn ? Math.max(1, optics.sensorMosaicScaleH ?? 1) : 1;
              const previewMosaicTag =
                mOn && (mSw > 1.001 || mSh > 1.001)
                  ? ` · 모자이크 ${mSw.toFixed(1)}×${mSh.toFixed(1)}`
                  : '';
              const previewFov = `${(optics.sensorWidthDeg * mSw).toFixed(2)}° × ${(
                optics.sensorHeightDeg * mSh
              ).toFixed(2)}°`;
              const previewRow1Left = captionCfg.showTargetName
                ? captionCfg.showCoordinates
                  ? 'M42 오리온 대성운 (RA 05h 35m, Dec -05° 23′)'
                  : 'M42 오리온 대성운'
                : captionCfg.showCoordinates
                ? 'RA 05h 35m · Dec -05° 23′'
                : '';
              const previewDate = new Date(observer.timestampMs);
              const previewDateStr = `${previewDate.getFullYear()}-${String(
                previewDate.getMonth() + 1
              ).padStart(2, '0')}-${String(previewDate.getDate()).padStart(2, '0')} ${String(
                previewDate.getHours()
              ).padStart(2, '0')}:${String(previewDate.getMinutes()).padStart(2, '0')}`;
              const previewRow1Right = [
                captionCfg.showLocation && observer.name.trim() ? observer.name.trim() : '',
                captionCfg.showDateTime ? previewDateStr : '',
              ]
                .filter(Boolean)
                .join(' · ');
              const previewRow2Left = [
                captionCfg.showConstellation ? '오리온자리 (Ori)' : '',
                captionCfg.showEquipmentFov
                  ? `${previewEquip}${previewMosaicTag} (${previewFov})`
                  : '',
                captionCfg.customNote.trim(),
              ]
                .filter(Boolean)
                .join(' / ');
              const normRot = optics.sensorRotationLocked
                ? 0
                : ((optics.sensorRotationDeg % 360) + 360) % 360;
              const previewRot = captionCfg.showRotation
                ? normRot > 0.05 && normRot < 359.95
                  ? `J2000 · 지평 회전 ${Math.round(normRot)}°`
                  : 'J2000 적도좌표'
                : '';
              const hasPreviewRow1 = Boolean(previewRow1Left || previewRow1Right);
              const hasPreviewRow2 = Boolean(
                previewRow2Left || previewRot || captionCfg.showNoxChartBrand
              );

              return (
                <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
                  <div
                    className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                      isSectionOpen('optics_sensor_caption')
                    )}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection('optics_sensor_caption')}
                      aria-expanded={isSectionOpen('optics_sensor_caption')}
                      className={`flex-1 flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] cursor-pointer ${ui.textPrimary}`}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                          isSectionOpen('optics_sensor_caption')
                        )} ${isSectionOpen('optics_sensor_caption') ? '' : '-rotate-90'}`}
                      />
                      <Image className="w-3.5 h-3.5 shrink-0" />
                      <span>촬영센서 PNG 하단 설명</span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isModified && (
                        <button
                          type="button"
                          onClick={() =>
                            updateCaption({ ...DEFAULT_SENSOR_EXPORT_CAPTION })
                          }
                          title="하단 설명 항목을 기본값으로 되돌립니다"
                          className={`inline-flex items-center gap-0.5 text-[9.5px] tracking-[-0.04em] underline underline-offset-2 ${ui.accentText} hover:opacity-80`}
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>기본값</span>
                        </button>
                      )}
                      <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                        {enabledCount}/{toggleItems.length}
                      </span>
                    </div>
                  </div>

                  {isSectionOpen('optics_sensor_caption') && (
                    <div className={`space-y-2 ${sectionBodyCls}`}>
                      <p
                        className={`text-[9.5px] leading-snug tracking-[-0.03em] break-keep ${ui.textMuted}`}
                      >
                        촬영센서 화각 PNG 저장 시 사진 하단 여백에 포함할 설명 항목을 선택합니다.
                      </p>

                      {/* 2-Column Checkbox Grid */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        {toggleItems.map((item) => (
                          <label
                            key={item.key}
                            className={`flex items-center justify-between gap-1.5 px-2 py-1 border rounded text-[10.5px] cursor-pointer select-none transition-colors ${
                              captionCfg[item.key] ? ui.panelMuted : ui.panel
                            } ${ui.border}`}
                          >
                            <span
                              className={`truncate tracking-[-0.04em] ${
                                captionCfg[item.key] ? ui.textPrimary : ui.textMuted
                              }`}
                            >
                              {item.label}
                            </span>
                            <input
                              type="checkbox"
                              checked={captionCfg[item.key]}
                              onChange={(e) =>
                                updateCaption({ [item.key]: e.target.checked })
                              }
                              className={`w-3.5 h-3.5 shrink-0 cursor-pointer ${
                                theme === 'red' ? 'accent-red-600' : 'accent-cyan-500'
                              }`}
                            />
                          </label>
                        ))}
                      </div>

                      {/* Custom Note / Photographer Input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <label
                            htmlFor="sensor-caption-custom-note"
                            className={`text-[10px] font-medium tracking-[-0.04em] ${ui.textSecondary}`}
                          >
                            추가 메모 · 촬영자 표기
                          </label>
                          {captionCfg.customNote.length > 0 && (
                            <button
                              type="button"
                              onClick={() => updateCaption({ customNote: '' })}
                              className={`text-[9.5px] tracking-[-0.04em] underline underline-offset-2 ${ui.textMuted} hover:opacity-80`}
                            >
                              지우기
                            </button>
                          )}
                        </div>
                        <input
                          id="sensor-caption-custom-note"
                          type="text"
                          maxLength={80}
                          value={captionCfg.customNote}
                          onChange={(e) => updateCaption({ customNote: e.target.value })}
                          placeholder="예: 촬영자 홍길동 · 듀얼밴드 필터"
                          className={`w-full px-2 py-1.5 text-[10.5px] border rounded focus:outline-none ${ui.input}`}
                        />
                      </div>

                      {/* Live Mini Preview of PNG Footer Bar */}
                      <div className="space-y-1">
                        <div className={`text-[9.5px] font-medium tracking-[-0.04em] ${ui.textMuted}`}>
                          하단 설명 미리보기
                        </div>
                        {hasPreviewRow1 || hasPreviewRow2 ? (
                          <div className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900 space-y-0.5 shadow-inner">
                            {hasPreviewRow1 && (
                              <div className="flex items-baseline justify-between gap-2 text-[9px] leading-tight">
                                <span className="font-bold text-slate-900 truncate">
                                  {previewRow1Left}
                                </span>
                                {previewRow1Right && (
                                  <span className="font-mono text-[8.5px] text-slate-600 shrink-0 truncate max-w-[48%]">
                                    {previewRow1Right}
                                  </span>
                                )}
                              </div>
                            )}
                            {hasPreviewRow2 && (
                              <div className="flex items-baseline justify-between gap-2 text-[8.5px] leading-tight">
                                <span className="text-slate-600 truncate">
                                  {previewRow2Left}
                                </span>
                                {(previewRot || captionCfg.showNoxChartBrand) && (
                                  <span className="shrink-0 whitespace-nowrap text-[8px] text-slate-500">
                                    {previewRot}
                                    {previewRot && captionCfg.showNoxChartBrand ? ' · ' : ''}
                                    {captionCfg.showNoxChartBrand && (
                                      <>
                                        <span>Created with </span>
                                        <span className="font-bold text-slate-900">NoxChart</span>
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className={`rounded border border-dashed px-2 py-1.5 text-center text-[9.5px] ${ui.border} ${ui.textMuted}`}
                          >
                            하단 설명 없음 (천체 사진만 저장)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {tab === 'observer' && (
          <>
            {/* Current Site Summary + Interactive Map Picker */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggleSection('observer_current')}
                aria-expanded={isSectionOpen('observer_current')}
                className={`w-full font-semibold flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border whitespace-nowrap tracking-[-0.05em] text-left transition-colors cursor-pointer ${ui.textPrimary} ${sectionHeaderCls(
                  isSectionOpen('observer_current')
                )}`}
              >
                <span className="flex items-center gap-1">
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('observer_current')
                    )} ${isSectionOpen('observer_current') ? '' : '-rotate-90'}`}
                  />
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>현재 관측지</span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                  {formatCoordsShort(observer.lat, observer.lon)}
                </span>
              </button>

              {isSectionOpen('observer_current') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>

              <div className={`p-2 border rounded-md space-y-2 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`text-[11.5px] font-semibold truncate ${ui.textPrimary}`}>
                    {observer.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenSiteMap(null)}
                  className={`w-full py-1.5 px-2 border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    theme === 'white'
                      ? 'bg-blue-700 hover:bg-blue-800 text-white border-blue-800'
                      : theme === 'red'
                      ? 'bg-[#7F1D1D] hover:bg-[#991B1B] text-[#FFE0E0] border-[#B91C1C]'
                      : 'bg-[#0094B8] hover:bg-[#00A8D0] text-white border-[#06B6D4]'
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  <MapIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>지도에서 관측지 선택</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className={`block mb-1 whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                    위도 Lat (°)
                  </label>
                  <input
                    type="number"
                    min={-90}
                    max={90}
                    step={0.001}
                    value={Number(observer.lat.toFixed(4))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (Number.isFinite(val)) {
                        onChangeObserver((p) => ({
                          ...p,
                          name: '사용자 지정',
                          lat: clampLat(val),
                        }));
                      }
                    }}
                    className={`w-full px-2 py-1.5 border font-mono tabular-nums text-[11px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label className={`block mb-1 whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                    경도 Lon (°)
                  </label>
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step={0.001}
                    value={Number(observer.lon.toFixed(4))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (Number.isFinite(val)) {
                        onChangeObserver((p) => ({
                          ...p,
                          name: '사용자 지정',
                          lon: clampLon(val),
                        }));
                      }
                    }}
                    className={`w-full px-2 py-1.5 border font-mono tabular-nums text-[11px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                </div>
              </div>
              </div>
              )}
            </div>

            {/* Saved Observing Sites + Local File Export/Import */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <div
                className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                  isSectionOpen('observer_saved')
                )}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('observer_saved')}
                  aria-expanded={isSectionOpen('observer_saved')}
                  className={`flex-1 font-semibold flex items-center gap-1 min-w-0 text-left whitespace-nowrap tracking-[-0.05em] cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('observer_saved')
                    )} ${isSectionOpen('observer_saved') ? '' : '-rotate-90'}`}
                  />
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>내 저장 관측지 ({savedSites.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openSection('observer_saved');
                    setQuickSiteName(observer.name === '사용자 지정' ? '' : observer.name);
                    setQuickSiteNote('');
                    setQuickSaveOpen((v) => !v);
                  }}
                  className={`px-1.5 py-0.5 border text-[10px] font-medium flex items-center gap-0.5 transition-colors shrink-0 ${
                    quickSaveOpen ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  <BookmarkPlus className="w-3 h-3 shrink-0" />
                  <span>현재 저장</span>
                </button>
              </div>

              {isSectionOpen('observer_saved') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>

              {quickSaveOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cleanName =
                      quickSiteName.trim() ||
                      `관측지 (${observer.lat.toFixed(3)}, ${observer.lon.toFixed(3)})`;
                    const newSite: SavedObservingSite = {
                      id: `site_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                      name: cleanName,
                      lat: Number(clampLat(observer.lat).toFixed(6)),
                      lon: Number(clampLon(observer.lon).toFixed(6)),
                      note: quickSiteNote.trim() || undefined,
                      createdAt: Date.now(),
                    };
                    onSaveSite(newSite);
                    onChangeObserver((p) => ({ ...p, name: cleanName }));
                    setQuickSaveOpen(false);
                    showSiteNotice(`"${cleanName}" 관측지가 저장되었습니다.`);
                  }}
                  className={`p-2 border rounded-md space-y-1.5 ${cardIdleCls}`}
                >
                  <input
                    type="text"
                    value={quickSiteName}
                    onChange={(e) => setQuickSiteName(e.target.value)}
                    placeholder="관측지 이름 (예: 양평 벗고개)"
                    className={`w-full px-2 py-1 border rounded text-[11px] ${ui.input}`}
                  />
                  <input
                    type="text"
                    value={quickSiteNote}
                    onChange={(e) => setQuickSiteNote(e.target.value)}
                    placeholder="메모 (선택)"
                    className={`w-full px-2 py-1 border rounded text-[10.5px] ${ui.input}`}
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="submit"
                      className={`py-1 px-2 border text-[10.5px] font-semibold ${ui.buttonActive}`}
                      style={{ borderRadius: '4px' }}
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickSaveOpen(false)}
                      className={`py-1 px-2 border text-[10.5px] ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      취소
                    </button>
                  </div>
                </form>
              )}

              {/* Local File Save / Load Buttons */}
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (savedSites.length === 0) {
                      showSiteNotice('저장된 관측지가 없습니다.');
                      return;
                    }
                    downloadObservingSitesFile(savedSites);
                    showSiteNotice(`${savedSites.length}개 관측지를 .json 파일로 저장했습니다.`);
                  }}
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${ui.buttonSave}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>파일 저장</span>
                </button>
                <button
                  type="button"
                  onClick={() => siteFileInputRef.current?.click()}
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${ui.buttonLoad}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Upload className="w-3 h-3 shrink-0" />
                  <span>파일 불러오기</span>
                </button>
                <input
                  ref={siteFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const parsed = parseObservingSitesFromJson(text);
                      if (parsed.error) {
                        showSiteNotice(parsed.error);
                        return;
                      }
                      const { addedCount, updatedCount } = onImportSites(parsed.sites);
                      showSiteNotice(
                        `불러오기 완료: 신규 ${addedCount}개${
                          updatedCount > 0 ? ` · 갱신 ${updatedCount}개` : ''
                        }`
                      );
                    } catch {
                      showSiteNotice('파일을 읽는 중 오류가 발생했습니다.');
                    }
                  }}
                  className="hidden"
                />
              </div>

              {siteStatusMsg && (
                <div className={`px-2 py-1 border rounded text-[10px] leading-snug ${cardIdleCls} ${ui.accentText}`}>
                  {siteStatusMsg}
                </div>
              )}

              {savedSites.length === 0 ? (
                <div className={`px-2 py-2.5 border rounded text-[10px] text-center leading-relaxed ${cardIdleCls} ${ui.textMuted}`}>
                  저장된 관측지가 없습니다. 지도에서 선택하거나 현재 위치를 저장해 보세요.
                </div>
              ) : (
                <div className="space-y-1 max-h-44 overflow-y-auto astro-scroll pr-0.5">
                  {savedSites.map((site) => {
                    const isActive =
                      observer.name === site.name &&
                      Math.abs(observer.lat - site.lat) < 0.0005 &&
                      Math.abs(observer.lon - site.lon) < 0.0005;
                    return (
                      <div
                        key={site.id}
                        className={`border flex items-center justify-between gap-1 px-1.5 py-1 transition-colors ${
                          isActive ? ui.buttonActive : ui.buttonIdle
                        }`}
                        style={{ borderRadius: '4px' }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onChangeObserver((p) => ({
                              ...p,
                              name: site.name,
                              lat: site.lat,
                              lon: site.lon,
                            }))
                          }
                          title={site.name}
                          className="flex-1 text-left min-w-0 py-0.5"
                        >
                          <div className="text-[10.5px] font-medium truncate">
                            {site.name}
                          </div>
                          <div className="font-mono text-[9.5px] tabular-nums opacity-75 truncate">
                            {site.lat.toFixed(3)}°, {site.lon.toFixed(3)}°
                            {site.bortle ? ` · B${site.bortle}` : ''}
                          </div>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenSiteMap(site)}
                            title="지도에서 보기 / 편집"
                            aria-label={`${site.name} 지도에서 보기`}
                            className="p-1 opacity-75 hover:opacity-100"
                          >
                            <MapIcon className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSite(site.id)}
                            title="삭제"
                            aria-label={`${site.name} 삭제`}
                            className="p-1 opacity-70 hover:opacity-100 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
              )}
            </div>

            {/* Built-in Observatory Presets */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <div className="flex items-center justify-between gap-1">
                <label
                  htmlFor="preset-site-select"
                  className={`font-semibold text-[10.5px] tracking-[-0.05em] ${ui.textPrimary}`}
                >
                  기본 추천 관측지
                </label>
                <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                  {SITE_PRESETS.length}곳
                </span>
              </div>
              <select
                id="preset-site-select"
                value={
                  SITE_PRESETS.some((s) => s.name === observer.name) ? observer.name : ''
                }
                onChange={(e) => {
                  const chosen = SITE_PRESETS.find((s) => s.name === e.target.value);
                  if (!chosen) return;
                  onChangeObserver((p) => ({
                    ...p,
                    name: chosen.name,
                    lat: chosen.lat,
                    lon: chosen.lon,
                  }));
                }}
                aria-label="기본 추천 관측지 선택"
                className={`w-full px-2 py-1.5 border text-[10.5px] cursor-pointer ${ui.input}`}
                style={{ borderRadius: '5px' }}
              >
                <option value="">추천 관측지 선택...</option>
                {SITE_PRESETS.map((site) => (
                  <option key={site.name} value={site.name}>
                    {site.name} ({site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°)
                  </option>
                ))}
              </select>
            </div>

            {/* Observing Site Bortle Scale Light Pollution Effect */}
            {(() => {
              const siteEstBortle = estimateSiteBortleClass(
                observer.lat,
                observer.lon,
                observer.name
              ).bortle;
              const currentBortle = clampBortleClass(observer.bortleClass ?? siteEstBortle);
              const info = getBortleInfo(currentBortle);
              const estInfo = getBortleInfo(siteEstBortle);
              const isManualOverride = currentBortle !== siteEstBortle;
              return (
                <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
                  <div
                    className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border transition-colors ${sectionHeaderCls(
                      isSectionOpen('observer_bortle')
                    )}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection('observer_bortle')}
                      aria-expanded={isSectionOpen('observer_bortle')}
                      className={`flex-1 min-w-0 flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] text-left cursor-pointer ${ui.textPrimary}`}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                          isSectionOpen('observer_bortle')
                        )} ${isSectionOpen('observer_bortle') ? '' : '-rotate-90'}`}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/35"
                        style={{ backgroundColor: info.swatch }}
                        aria-hidden="true"
                      />
                      <span>관측지 보틀 등급 효과</span>
                    </button>
                    <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                      B{currentBortle}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(observer.bortleEnabled)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onChangeObserver((p) => ({ ...p, bortleEnabled: checked }));
                        if (checked) openSection('observer_bortle');
                      }}
                      aria-label="관측지 보틀 등급 효과 활성화"
                      className="w-3.5 h-3.5 shrink-0 accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  {isSectionOpen('observer_bortle') && (
                    <div className={`space-y-2 ${sectionBodyCls}`}>
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className={`truncate tracking-[-0.04em] ${ui.textMuted}`}>
                          관측지 기준:{' '}
                          <strong className={ui.textSecondary}>
                            Bortle {siteEstBortle} ({estInfo.shortLabel})
                          </strong>
                        </span>
                        {isManualOverride && (
                          <button
                            type="button"
                            onClick={() =>
                              onChangeObserver((p) => ({
                                ...p,
                                bortleClass: siteEstBortle,
                              }))
                            }
                            className={`px-1.5 py-0.5 border text-[9.5px] whitespace-nowrap shrink-0 cursor-pointer ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            관측지 기준
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`whitespace-nowrap tracking-[-0.04em] ${ui.textSecondary}`}>
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1 align-middle border border-white/30"
                              style={{ backgroundColor: info.swatch }}
                            />
                            Bortle {currentBortle} · {info.label}
                          </span>
                          <span className={`font-mono tabular-nums ${ui.textMuted}`}>
                            NELM {info.nelm.toFixed(1)}m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={9}
                          step={1}
                          value={currentBortle}
                          onChange={(e) =>
                            onChangeObserver((p) => ({
                              ...p,
                              bortleClass: clampBortleClass(Number(e.target.value)),
                            }))
                          }
                          aria-label="관측지 보틀 등급 조절 (1~9)"
                          className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                        />
                        <div className="grid grid-cols-9 gap-0.5">
                          {BORTLE_SCALE.map((b) => {
                            const active = currentBortle === b.bortle;
                            return (
                              <button
                                key={b.bortle}
                                type="button"
                                title={`Bortle ${b.bortle}: ${b.label} (SQM ${b.sqm})`}
                                onClick={() =>
                                  onChangeObserver((p) => ({
                                    ...p,
                                    bortleClass: b.bortle,
                                  }))
                                }
                                className={`py-1 px-0 border text-[9.5px] font-mono tabular-nums text-center cursor-pointer ${
                                  active ? ui.buttonActive : ui.buttonIdle
                                }`}
                                style={{ borderRadius: '3px' }}
                              >
                                {b.bortle}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        className={`px-2 py-1.5 border text-[9.5px] space-y-0.5 ${ui.border} ${ui.textMuted}`}
                        style={{ borderRadius: '4px' }}
                      >
                        <div className="flex items-center justify-between font-mono tabular-nums">
                          <span>SQM {info.sqm}</span>
                          <span>은하수 {Math.round(info.milkyWayAlpha * 100)}%</span>
                        </div>
                        <div className="tracking-[-0.04em]">{info.milkyWayDesc}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Minimum Altitude Filter */}
            <div className={`pt-2 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('observer_alt')}
                aria-expanded={isSectionOpen('observer_alt')}
                className={`w-full font-semibold flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border whitespace-nowrap tracking-[-0.05em] text-left transition-colors cursor-pointer ${ui.textPrimary} ${sectionHeaderCls(
                  isSectionOpen('observer_alt')
                )}`}
              >
                <span className="flex items-center gap-1">
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${sectionChevronCls(
                      isSectionOpen('observer_alt')
                    )} ${isSectionOpen('observer_alt') ? '' : '-rotate-90'}`}
                  />
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>고도 기반 관측 필터</span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                  {observer.minAltitudeDeg > -90 ? `≥${observer.minAltitudeDeg}°` : '전체'}
                </span>
              </button>
              {isSectionOpen('observer_alt') && (
              <div className={`space-y-2 ${sectionBodyCls}`}>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onChangeObserver((p) => ({ ...p, minAltitudeDeg: -90 }));
                    onChangeLayers((p) => ({
                      ...p,
                      showTerrain: false,
                    }));
                  }}
                  className={`w-full py-1 px-1.5 border text-[10px] tracking-[-0.05em] font-medium whitespace-nowrap cursor-pointer ${
                    observer.minAltitudeDeg === -90 ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  <span>전체 (필터 해제)</span>
                </button>
                <div className="grid grid-cols-6 gap-0.5">
                  {[
                    { val: 0, lbl: '≥0°' },
                    { val: 10, lbl: '≥10°' },
                    { val: 15, lbl: '≥15°' },
                    { val: 20, lbl: '≥20°' },
                    { val: 25, lbl: '≥25°' },
                    { val: 30, lbl: '≥30°' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        onChangeObserver((p) => ({ ...p, minAltitudeDeg: opt.val }));
                        onChangeLayers((p) => ({
                          ...p,
                          showTerrain: false,
                        }));
                      }}
                      className={`py-1.5 px-0.5 border text-[9.5px] tracking-[-0.06em] font-mono tabular-nums whitespace-nowrap shrink-0 cursor-pointer ${
                        observer.minAltitudeDeg === opt.val ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      {opt.lbl}
                    </button>
                  ))}
                </div>
              </div>
              <label
                className={`flex items-center justify-between gap-1.5 py-0.5 ${
                  observer.minAltitudeDeg === -90
                    ? 'cursor-pointer'
                    : 'opacity-45 cursor-not-allowed'
                }`}
              >
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  지형 표시
                </span>
                <input
                  type="checkbox"
                  checked={observer.minAltitudeDeg === -90 && layers.showTerrain}
                  disabled={observer.minAltitudeDeg !== -90}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showTerrain: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>
              {observer.minAltitudeDeg > -90 && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeObserver((p) => ({ ...p, highlightAboveMinAlt: false }))
                      }
                      className={`py-1.5 px-1 border text-[10.5px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${
                        !observer.highlightAboveMinAlt ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      기준 미달 숨김
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeObserver((p) => ({ ...p, highlightAboveMinAlt: true }))
                      }
                      className={`py-1.5 px-1 border text-[10.5px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${
                        observer.highlightAboveMinAlt ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      희미하게 표시
                    </button>
                  </div>
                  <p className={`text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                    항성·DSO·성운 등고선에 고도 {observer.minAltitudeDeg}° 필터가 적용되며 성도에 최소고도 기준선이 표시됩니다.
                  </p>
                </div>
              )}
              </div>
              )}
            </div>
          </>
        )}

        {tab === 'settings' && (() => {
          const activeAuthNotice = authError || (syncStatus === 'error' ? syncError : null);
          const displayName =
            authUser?.displayName || authUser?.email?.split('@')[0] || '사용자';
          const initialChar = displayName.trim().charAt(0).toUpperCase() || 'U';
          const lastSyncLabel = lastSyncedAt
            ? (() => {
                const d = new Date(lastSyncedAt);
                return `${String(d.getHours()).padStart(2, '0')}:${String(
                  d.getMinutes()
                ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
              })()
            : '';
          const syncText =
            syncStatus === 'loading'
              ? '불러오는 중...'
              : syncStatus === 'checking'
              ? '동기화 확인 중...'
              : syncStatus === 'saving' || syncStatus === 'pending'
              ? '클라우드 저장 중...'
              : syncStatus === 'updated'
              ? `최신 데이터 반영됨${lastSyncLabel ? ` (${lastSyncLabel})` : ''}`
              : syncStatus === 'saved'
              ? `클라우드 저장됨${lastSyncLabel ? ` (${lastSyncLabel})` : ''}`
              : syncStatus === 'error'
              ? '동기화 오류'
              : '실시간 동기화 준비됨';

          return (
            <div className="space-y-3">
              {/* Account & Cloud Sync Section */}
              <div className={`border rounded-md p-2.5 space-y-2.5 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}>
                    <Cloud className="w-3.5 h-3.5 shrink-0" />
                    <span>계정 · 클라우드 동기화</span>
                  </span>
                </div>

                {!authReady ? (
                  <div className={`flex items-center gap-2 py-2 text-[10.5px] ${ui.textMuted}`}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>로그인 상태 확인 중...</span>
                  </div>
                ) : !authUser ? (
                  <div className="space-y-2">
                    <p className={`text-[10px] leading-relaxed break-keep ${ui.textMuted}`}>
                      Google 계정으로 로그인하면 관측지, 장비, 관측목록, 챌린지, 그리기, 관측기록 및 설정이 여러 기기에 실시간 동기화됩니다.
                    </p>
                    <button
                      type="button"
                      onClick={onLogin}
                      disabled={authBusy}
                      className={`w-full py-2 px-3 rounded-md border flex items-center justify-center gap-2 text-[11.5px] font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                        theme === 'white'
                          ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50 shadow-xs'
                          : theme === 'red'
                          ? 'bg-[#260404] border-[#7F1D1D] text-[#FF6B6B] hover:bg-[#380707]'
                          : 'bg-[#122038] border-cyan-500/50 text-slate-100 hover:bg-[#1A2D4F]'
                      }`}
                    >
                      {authBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <svg viewBox="0 0 18 18" className="w-4 h-4 shrink-0" aria-hidden="true">
                          {theme === 'red' ? (
                            <path
                              fill="#FF5A5A"
                              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615zM9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18zM3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332zM9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                            />
                          ) : (
                            <>
                              <path
                                fill="#4285F4"
                                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                              />
                              <path
                                fill="#34A853"
                                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                              />
                              <path
                                fill="#EA4335"
                                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                              />
                            </>
                          )}
                        </svg>
                      )}
                      <span>Google 로그인</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {authUser.photoURL ? (
                        <img
                          src={authUser.photoURL}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className={`w-8 h-8 rounded-full object-cover shrink-0 border ${
                            theme === 'red'
                              ? 'border-[#7F1D1D] opacity-80 sepia hue-rotate-[-50deg]'
                              : theme === 'white'
                              ? 'border-slate-300'
                              : 'border-cyan-400/50'
                          }`}
                        />
                      ) : (
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            theme === 'white'
                              ? 'bg-blue-600 text-white'
                              : theme === 'red'
                              ? 'bg-[#7F1D1D] text-[#FCA5A5]'
                              : 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                          }`}
                        >
                          {initialChar}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11.5px] font-semibold truncate ${ui.textPrimary}`}>
                          {displayName}
                        </div>
                        {authUser.email && (
                          <div className={`text-[10px] truncate ${ui.textMuted}`}>
                            {authUser.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`px-2 py-1.5 rounded border flex items-center gap-1.5 text-[10px] ${
                        syncStatus === 'error'
                          ? theme === 'white'
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : theme === 'red'
                            ? 'bg-[#2A0505] border-[#7F1D1D] text-[#FF6B6B]'
                            : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : theme === 'white'
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-700'
                          : theme === 'red'
                          ? 'bg-[#1A0303] border-[#5A1212] text-[#EF4444]'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {syncStatus === 'loading' ||
                      syncStatus === 'checking' ||
                      syncStatus === 'saving' ||
                      syncStatus === 'pending' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : syncStatus === 'error' ? (
                        <CloudAlert className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <CloudCheck className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate font-medium">{syncText}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={onManualSync}
                        disabled={authBusy}
                        className={`py-1.5 px-2 border rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 ${ui.buttonIdle}`}
                      >
                        <Cloud className="w-3.5 h-3.5 shrink-0" />
                        <span>지금 동기화</span>
                      </button>
                      <button
                        type="button"
                        onClick={onLogout}
                        disabled={authBusy}
                        className={`py-1.5 px-2 border rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 ${ui.buttonIdle}`}
                      >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                        <span>로그아웃</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeAuthNotice && (
                  <div
                    className={`p-2 rounded border text-[10px] leading-snug flex items-start gap-1.5 ${
                      theme === 'white'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : theme === 'red'
                        ? 'bg-[#2A0505] border-[#991B1B] text-[#FCA5A5]'
                        : 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                    }`}
                  >
                    <CloudAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="flex-1 break-keep">{activeAuthNotice}</span>
                    <button
                      type="button"
                      onClick={onDismissAuthError}
                      aria-label="오류 닫기"
                      className="shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Screen Theme Preset Selector (9 Curated Presets + Red Night-Vision Intensity) */}
              <div className={`border rounded-md p-2.5 space-y-2 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1">
                  <div className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}>
                    <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                    <span>화면 테마</span>
                  </div>
                  <span className={`text-[9px] ${ui.textMuted}`}>
                    UI · 성도 일괄 적용
                  </span>
                </div>

                {/* 9 Curated UI Theme Presets (Dropdown Selector) */}
                {(() => {
                  const activePreset =
                    UI_THEME_PRESETS.find((p) => p.id === uiThemePreset) ?? UI_THEME_PRESETS[0];
                  const isRedNightActive = uiThemePreset === 'red-night' || theme === 'red';
                  return (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setThemePresetDropdownOpen((o) => !o)}
                          aria-expanded={themePresetDropdownOpen}
                          aria-haspopup="listbox"
                          className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 border rounded-md text-left transition-colors cursor-pointer ${ui.input}`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="inline-flex items-center shrink-0 rounded overflow-hidden border"
                              style={{ borderColor: activePreset.border }}
                              aria-hidden="true"
                            >
                              <span
                                className="w-2 h-3.5 block"
                                style={{ backgroundColor: activePreset.bgMain }}
                              />
                              <span
                                className="w-2 h-3.5 block"
                                style={{ backgroundColor: activePreset.bgSurface }}
                              />
                              <span
                                className="w-2 h-3.5 block"
                                style={{ backgroundColor: activePreset.accent }}
                              />
                            </span>
                            <span className={`text-[10.5px] font-semibold truncate ${ui.textPrimary}`}>
                              {activePreset.order}. {activePreset.name}
                            </span>
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                              themePresetDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {themePresetDropdownOpen && (
                          <div
                            role="listbox"
                            aria-label="테마 프리셋 선택"
                            className={`mt-1 border rounded-md p-1 space-y-1 max-h-[290px] overflow-y-auto astro-scroll shadow-md ${ui.panel}`}
                          >
                            {UI_THEME_PRESETS.map((preset) => {
                              const isActive = uiThemePreset === preset.id;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  role="option"
                                  aria-selected={isActive}
                                  onClick={() => {
                                    onChangeUiThemePreset(preset.id);
                                    setThemePresetDropdownOpen(false);
                                  }}
                                  className={`w-full text-left p-1.5 border rounded transition-colors cursor-pointer space-y-0.5 ${
                                    isActive
                                      ? ui.buttonActive
                                      : `${ui.panelMuted} ${ui.border} hover:opacity-95`
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className="inline-flex items-center shrink-0 rounded overflow-hidden border"
                                        style={{ borderColor: preset.border }}
                                        aria-hidden="true"
                                      >
                                        <span
                                          className="w-2 h-3 block"
                                          style={{ backgroundColor: preset.bgMain }}
                                        />
                                        <span
                                          className="w-2 h-3 block"
                                          style={{ backgroundColor: preset.bgSurface }}
                                        />
                                        <span
                                          className="w-2 h-3 block"
                                          style={{ backgroundColor: preset.accent }}
                                        />
                                      </span>
                                      <span
                                        className={`text-[10px] font-semibold truncate ${
                                          isActive ? '' : ui.textPrimary
                                        }`}
                                      >
                                        {preset.order}. {preset.name}
                                      </span>
                                    </span>
                                    <span
                                      className={`text-[8.5px] shrink-0 px-1 py-0.5 rounded border ${
                                        isActive
                                          ? 'border-current/40 bg-black/10'
                                          : `${ui.border} ${ui.textMuted}`
                                      }`}
                                    >
                                      {preset.subtitle}
                                    </span>
                                  </div>
                                  <div
                                    className={`flex items-center justify-between gap-1 text-[8.5px] font-mono ${
                                      isActive ? 'opacity-90' : ui.textMuted
                                    }`}
                                  >
                                    <span>
                                      {preset.bgMain} / {preset.bgSurface}
                                    </span>
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span
                                        className="w-2 h-2 rounded-full inline-block border border-white/30"
                                        style={{ backgroundColor: preset.accent }}
                                      />
                                      <span>{preset.accentName}</span>
                                    </span>
                                  </div>
                                  <p
                                    className={`text-[9px] leading-snug break-keep ${
                                      isActive ? 'opacity-95' : ui.textSecondary
                                    }`}
                                  >
                                    {preset.description}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {!themePresetDropdownOpen && (
                        <div
                          className={`p-1.5 border rounded space-y-0.5 ${ui.panelMuted} ${ui.border}`}
                        >
                          <div className={`flex items-center justify-between gap-1 text-[9px] font-mono ${ui.textMuted}`}>
                            <span>
                              {activePreset.bgMain} / {activePreset.bgSurface}
                            </span>
                            <span className="inline-flex items-center gap-1 shrink-0">
                              <span
                                className="w-2 h-2 rounded-full inline-block border border-white/30"
                                style={{ backgroundColor: activePreset.accent }}
                              />
                              <span>{activePreset.accentName}</span>
                            </span>
                          </div>
                          <p className={`text-[9.5px] leading-snug break-keep ${ui.textSecondary}`}>
                            {activePreset.description}
                          </p>
                        </div>
                      )}

                      {isRedNightActive && (
                        <div className={`pt-2 border-t space-y-1.5 ${ui.divider}`}>
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className={`font-medium ${ui.textSecondary}`}>적색 정도</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono tabular-nums font-semibold ${ui.textPrimary}`}>
                                {redIntensity}%
                              </span>
                              {redIntensity !== 50 && (
                                <button
                                  type="button"
                                  onClick={() => onChangeRedIntensity(50)}
                                  title="적색 정도 기본값(50%) 복원"
                                  className={`px-1 py-0.5 border rounded text-[9px] cursor-pointer ${ui.buttonIdle}`}
                                >
                                  기본
                                </button>
                              )}
                            </div>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={redIntensity}
                            onChange={(e) => onChangeRedIntensity(Number(e.target.value))}
                            aria-label="적색 정도 조절"
                            className="w-full h-1.5 cursor-pointer accent-red-600"
                          />
                          <div className={`flex items-center justify-between text-[9px] ${ui.textMuted}`}>
                            <span>연하게 (밝음)</span>
                            <span>표준</span>
                            <span>진하게 (암적응)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Dedicated Independent Section: 성도 표기 설정 (Constellations · Stars · DSOs · Cardinals) */}
              {(() => {
                const conStyle: ConstellationNameStyle = layers.constellationNameStyle ?? 'name_abbr';
                const conProjMode: ConstellationProjectionMode =
                  layers.constellationProjectionMode ??
                  (layers.showConstellationArt ? 'classical' : 'modern');
                const conArtLayerEnabled =
                  layers.showConstellationArt ?? conProjMode === 'classical';
                const conArtScope = layers.constellationArtScope ?? 'all';
                const conArtOpacity = layers.constellationArtOpacity ?? 0.45;
                const starStyle: StarNameStyle = layers.starNameStyle ?? 'traditional';
                const dsoStyle: DsoNameStyle = layers.dsoNameStyle ?? 'code_name';

                const batchPresets: Array<{
                  id: 'traditional' | 'abbr' | 'catalog' | 'name';
                  label: string;
                  title: string;
                  con: ConstellationNameStyle;
                  star: StarNameStyle;
                  dso: DsoNameStyle;
                }> = [
                  {
                    id: 'traditional',
                    label: '전통',
                    title: '별자리 전통 라틴명 · 항성 고유명 · 성운/은하 고유명 중심',
                    con: 'traditional',
                    star: 'traditional',
                    dso: 'name',
                  },
                  {
                    id: 'abbr',
                    label: '약어',
                    title: '별자리 IAU 3자 약어 · 항성 바이어 기호 · 심우주 분류 약어 중심',
                    con: 'abbr',
                    star: 'bayer',
                    dso: 'abbr',
                  },
                  {
                    id: 'catalog',
                    label: '번호',
                    title: '별자리 약어 · 항성 HIP/Gaia 번호 · 심우주 M/NGC/IC 번호 중심',
                    con: 'abbr',
                    star: 'catalog',
                    dso: 'code',
                  },
                  {
                    id: 'name',
                    label: '이름',
                    title: '별자리 이름+약어 · 항성 이름+바이어 · 심우주 번호+이름 병기',
                    con: 'name_abbr',
                    star: 'full',
                    dso: 'code_name',
                  },
                ];

                const previewCon = formatConstellationDisplayName(
                  { koName: '오리온자리', name: 'Orion', abbr: 'Ori' },
                  nameLang,
                  conStyle === 'name_abbr',
                  conStyle
                );
                const previewStar =
                  formatStarLabelByStyle(
                    {
                      id: 'Betelgeuse',
                      hip: 27989,
                      koName: '베텔게우스',
                      name: 'Betelgeuse',
                      bayer: 'α Ori',
                    },
                    nameLang,
                    starStyle,
                    30
                  ) ?? '베텔게우스';
                const previewDso = formatDsoChartLabel(
                  'M42',
                  '오리온 대성운',
                  'Orion Nebula',
                  nameLang,
                  true,
                  dsoStyle,
                  'DN'
                );
                const previewDir = `${formatCardinalLabel(0, nameLang)}/${formatCardinalLabel(90, nameLang)}`;

                return (
                  <div className={`border rounded-md p-2.5 space-y-2.5 ${cardIdleCls}`}>
                    <div className="flex items-center justify-between gap-1">
                      <div
                        className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}
                      >
                        <Type className="w-3.5 h-3.5 shrink-0" />
                        <span>성도 표기 설정</span>
                      </div>
                      <span className={`text-[9.5px] tracking-[-0.04em] ${ui.textMuted}`}>
                        별자리 · 항성 · 성운
                      </span>
                    </div>

                    {/* Quick Visibility Toggles (별자리 이름 / 항성 이름 / 성운·DSO 이름) */}
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { key: 'showConstellationNames', label: '별자리 이름' },
                          { key: 'showStarLabels', label: '항성 이름' },
                          { key: 'showDsoLabels', label: '성운·DSO' },
                        ] as const
                      ).map((item) => {
                        const checked = Boolean(layers[item.key]);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              onChangeLayers((p) => ({ ...p, [item.key]: !p[item.key] }))
                            }
                            aria-pressed={checked}
                            className={`py-1 px-1 border rounded text-[9.5px] font-medium whitespace-nowrap tracking-[-0.04em] transition-colors cursor-pointer ${
                              checked ? ui.buttonActive : ui.buttonIdle
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Batch Presets (전통 / 약어 / 번호 / 이름) */}
                    <div className={`pt-2 border-t space-y-1 ${ui.divider}`}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-medium ${ui.textSecondary}`}>일괄 표기법</span>
                        <span className={`text-[9px] ${ui.textMuted}`}>전체 천체 한번에 적용</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {batchPresets.map((preset) => {
                          const isMatch =
                            conStyle === preset.con &&
                            starStyle === preset.star &&
                            dsoStyle === preset.dso;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              title={preset.title}
                              onClick={() =>
                                onChangeLayers((p) => ({
                                  ...p,
                                  constellationNameStyle: preset.con,
                                  starNameStyle: preset.star,
                                  dsoNameStyle: preset.dso,
                                }))
                              }
                              aria-pressed={isMatch}
                              className={`py-1.5 px-1 border rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                isMatch ? ui.buttonActive : ui.buttonIdle
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Global Language Notation (한글 / 영어 / 한글(영어)) */}
                    <div className={`pt-2 border-t space-y-1 ${ui.divider}`}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-medium ${ui.textSecondary}`}>표기 언어</span>
                        <span className={`text-[9px] ${ui.textMuted}`}>천체 · 동서남북 방위</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            { id: 'ko', label: '한글' },
                            { id: 'en', label: '영어' },
                            { id: 'ko_en', label: '한글(영어)' },
                          ] as const
                        ).map((opt) => {
                          const active = nameLang === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                onChangeLayers((p) => ({ ...p, starLabelLanguage: opt.id }))
                              }
                              aria-pressed={active}
                              className={`py-1 px-1 border rounded text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                active ? ui.buttonActive : ui.buttonIdle
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Per-Category Detailed Notation Controls */}
                    <div className={`pt-2 border-t space-y-2 ${ui.divider}`}>
                      {/* 1. 별자리 섹션 (이름 표기 + 투영 모드 현대/고전 도안 + 독립 렌더링 레이어) */}
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className={`text-[10px] font-medium ${ui.textSecondary}`}>
                            별자리 이름 표기
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {(
                              [
                                { id: 'traditional', label: '전통' },
                                { id: 'abbr', label: '약어' },
                                { id: 'name', label: '이름' },
                                { id: 'name_abbr', label: '이름+약어' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  onChangeLayers((p) => ({
                                    ...p,
                                    constellationNameStyle: opt.id,
                                  }))
                                }
                                aria-pressed={conStyle === opt.id}
                                className={`py-1 px-0.5 border rounded text-[9.5px] font-medium whitespace-nowrap tracking-[-0.05em] transition-colors cursor-pointer ${
                                  conStyle === opt.id ? ui.buttonActive : ui.buttonIdle
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 투영 모드 (현대 / 고전 도안) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className={`font-medium ${ui.textSecondary}`}>
                              별자리 투영 모드
                            </span>
                            <span className={`text-[9px] tracking-[-0.03em] ${ui.textMuted}`}>
                              IAU 경계선 내부 투영
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {(
                              [
                                {
                                  id: 'modern' as ConstellationProjectionMode,
                                  label: '현대',
                                  title: '현대 기하학 성도 (별자리선 및 경계선 중심)',
                                },
                                {
                                  id: 'classical' as ConstellationProjectionMode,
                                  label: '고전 도안',
                                  title: 'IAU 별자리 경계선 내부에 고전 성도 도안을 연하게 투영',
                                },
                              ] as const
                            ).map((opt) => {
                              const active = conProjMode === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  title={opt.title}
                                  onClick={() =>
                                    onChangeLayers((p) => ({
                                      ...p,
                                      constellationProjectionMode: opt.id,
                                      showConstellationArt: opt.id === 'classical',
                                    }))
                                  }
                                  aria-pressed={active}
                                  className={`py-1 px-1.5 border rounded text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                    active ? ui.buttonActive : ui.buttonIdle
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 독립 렌더링 레이어: 고전 도안 레이어 ON/OFF + 투영 진하기 */}
                        <div className={`rounded border px-2 py-1.5 space-y-1.5 ${ui.panelMuted} ${ui.border}`}>
                          <div className="flex items-center justify-between gap-1.5">
                            <label className="flex items-center gap-1.5 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={conArtLayerEnabled}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  onChangeLayers((p) => ({
                                    ...p,
                                    showConstellationArt: checked,
                                    ...(checked
                                      ? {
                                          constellationProjectionMode:
                                            'classical' as ConstellationProjectionMode,
                                        }
                                      : {}),
                                  }));
                                }}
                                className="w-3.5 h-3.5 shrink-0 accent-cyan-500 cursor-pointer"
                              />
                              <span
                                className={`text-[10px] font-medium whitespace-nowrap tracking-[-0.04em] ${ui.textSecondary}`}
                              >
                                고전 도안 렌더링 레이어
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeLayers((p) => ({
                                  ...p,
                                  showConstellationBoundaries: !p.showConstellationBoundaries,
                                }))
                              }
                              aria-pressed={layers.showConstellationBoundaries}
                              title="별자리 IAU 경계선 함께 표시/숨김"
                              className={`px-1.5 py-0.5 border rounded text-[9px] font-medium whitespace-nowrap tracking-[-0.04em] transition-colors cursor-pointer ${
                                layers.showConstellationBoundaries
                                  ? ui.buttonActive
                                  : ui.buttonIdle
                              }`}
                            >
                              경계선 {layers.showConstellationBoundaries ? 'ON' : 'OFF'}
                            </button>
                          </div>

                          {/* 표시 범위: 전체 / 중심 */}
                          <div
                            className={`space-y-1 transition-opacity ${
                              conArtLayerEnabled ? '' : 'opacity-45 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[9.5px]">
                              <span className={ui.textMuted}>표시 범위</span>
                              <span className={`text-[9px] tracking-[-0.03em] ${ui.textMuted}`}>
                                {conArtScope === 'center' ? '화면 중심 별자리만' : '모든 별자리 표시'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {(
                                [
                                  {
                                    id: 'all' as const,
                                    label: '전체',
                                    title: '화면에 보이는 모든 별자리 도안을 표시합니다',
                                  },
                                  {
                                    id: 'center' as const,
                                    label: '중심',
                                    title: '현재 화면 중심에 해당하는 별자리 도안만 표시합니다',
                                  },
                                ] as const
                              ).map((opt) => {
                                const active = conArtScope === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={!conArtLayerEnabled}
                                    title={opt.title}
                                    onClick={() =>
                                      onChangeLayers((p) => ({
                                        ...p,
                                        constellationArtScope: opt.id,
                                      }))
                                    }
                                    aria-pressed={active}
                                    className={`py-1 px-1.5 border rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                                      conArtLayerEnabled ? 'cursor-pointer' : 'cursor-not-allowed'
                                    } ${active ? ui.buttonActive : ui.buttonIdle}`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div
                            className={`space-y-0.5 transition-opacity ${
                              conArtLayerEnabled ? '' : 'opacity-45 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[9.5px]">
                              <span className={ui.textMuted}>도안 투영 진하기</span>
                              <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                                {Math.round(conArtOpacity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.05}
                              max={1}
                              step={0.05}
                              disabled={!conArtLayerEnabled}
                              value={conArtOpacity}
                              onChange={(e) =>
                                onChangeLayers((p) => ({
                                  ...p,
                                  constellationArtOpacity: Number(e.target.value),
                                }))
                              }
                              aria-label="고전 도안 투영 진하기"
                              className={`w-full h-1.5 [accent-color:var(--ui-accent)] ${
                                conArtLayerEnabled ? 'cursor-pointer' : 'cursor-not-allowed'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. 항성 이름 표기 */}
                      <div className="space-y-1">
                        <div className={`text-[10px] font-medium ${ui.textSecondary}`}>
                          항성 이름 표기
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {(
                            [
                              { id: 'traditional', label: '전통' },
                              { id: 'bayer', label: '약어' },
                              { id: 'catalog', label: '번호' },
                              { id: 'full', label: '이름+약어' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                onChangeLayers((p) => ({
                                  ...p,
                                  starNameStyle: opt.id,
                                }))
                              }
                              aria-pressed={starStyle === opt.id}
                              className={`py-1 px-0.5 border rounded text-[9.5px] font-medium whitespace-nowrap tracking-[-0.05em] transition-colors cursor-pointer ${
                                starStyle === opt.id ? ui.buttonActive : ui.buttonIdle
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. 성운·심우주(DSO) 표기 */}
                      <div className="space-y-1">
                        <div className={`text-[10px] font-medium ${ui.textSecondary}`}>
                          성운·심우주 표기
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {(
                            [
                              { id: 'name', label: '전통·이름' },
                              { id: 'abbr', label: '약어' },
                              { id: 'code', label: '번호' },
                              { id: 'code_name', label: '번호+이름' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                onChangeLayers((p) => ({
                                  ...p,
                                  dsoNameStyle: opt.id,
                                }))
                              }
                              aria-pressed={dsoStyle === opt.id}
                              className={`py-1 px-0.5 border rounded text-[9.5px] font-medium whitespace-nowrap tracking-[-0.05em] transition-colors cursor-pointer ${
                                dsoStyle === opt.id ? ui.buttonActive : ui.buttonIdle
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Preview */}
                    <div
                      className={`px-2 py-1.5 rounded border text-[9.5px] space-y-0.5 tracking-[-0.03em] ${ui.panelMuted} ${ui.border} ${ui.textSecondary}`}
                    >
                      <div className={`text-[9px] font-medium ${ui.textMuted}`}>성도 표기 미리보기</div>
                      <div className="truncate font-mono text-[9.5px]">
                        {previewCon} · {previewStar} · {previewDso} · {previewDir}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Font Family & Font Size +/- with Auto Single-Line Condensation */}
              {(() => {
                const fontMetrics = getUiFontSizeMetrics(uiFontSizeStep);
                const canDec = fontMetrics.step > UI_FONT_SIZE_MIN_STEP;
                const canInc = fontMetrics.step < UI_FONT_SIZE_MAX_STEP;
                return (
                  <div className={`border rounded-md p-2.5 space-y-2.5 ${cardIdleCls}`}>
                    <div className="flex items-center justify-between gap-1">
                      <div
                        className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}
                      >
                        <Type className="w-3.5 h-3.5 shrink-0" />
                        <span>글꼴 및 크기</span>
                      </div>
                      {(uiFontFamily !== 'default' || fontMetrics.step !== 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            onChangeUiFontFamily('default');
                            onChangeUiFontSizeStep(0);
                          }}
                          title="글꼴 및 크기를 기본값으로 복원"
                          className={`px-1.5 py-0.5 border rounded text-[9.5px] cursor-pointer ${ui.buttonIdle}`}
                        >
                          기본 복원
                        </button>
                      )}
                    </div>

                    {/* Font Family Selector */}
                    <div className="space-y-1">
                      <div className={`text-[10px] font-medium ${ui.textSecondary}`}>글꼴</div>
                      <select
                        value={uiFontFamily}
                        onChange={(e) => onChangeUiFontFamily(e.target.value as UiFontFamily)}
                        aria-label="화면 글꼴 선택"
                        className={`w-full px-2 py-1.5 border rounded text-[11px] focus:outline-none cursor-pointer ${ui.input}`}
                      >
                        {UI_FONT_OPTIONS.map((opt) => (
                          <option
                            key={opt.id}
                            value={opt.id}
                            style={{ fontFamily: opt.cssFamily }}
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Font Size - / Actual Size / + / 100% */}
                    <div className={`pt-2 border-t space-y-1.5 ${ui.divider}`}>
                      <div className={`text-[10px] font-medium ${ui.textSecondary}`}>글꼴 크기</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!canDec}
                          onClick={() =>
                            onChangeUiFontSizeStep(clampUiFontSizeStep(fontMetrics.step - 1))
                          }
                          title="글꼴 크기 작게 (-)"
                          aria-label="글꼴 크기 줄이기"
                          className={`w-8 py-1.5 border rounded text-[11px] font-semibold flex items-center justify-center shrink-0 transition-colors ${
                            canDec
                              ? `${ui.buttonIdle} cursor-pointer`
                              : `${ui.buttonIdle} opacity-40 cursor-not-allowed`
                          }`}
                        >
                          <Minus className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <div
                          className={`flex-1 min-w-0 py-1.5 px-1.5 border rounded text-center font-mono tabular-nums text-[11px] font-semibold ${ui.panelMuted} ${ui.border} ${ui.textPrimary}`}
                          title="현재 글꼴 크기"
                        >
                          {fontMetrics.pct}%
                        </div>
                        <button
                          type="button"
                          disabled={!canInc}
                          onClick={() =>
                            onChangeUiFontSizeStep(clampUiFontSizeStep(fontMetrics.step + 1))
                          }
                          title="글꼴 크기 크게 (+)"
                          aria-label="글꼴 크기 키우기"
                          className={`w-8 py-1.5 border rounded text-[11px] font-semibold flex items-center justify-center shrink-0 transition-colors ${
                            canInc
                              ? `${ui.buttonIdle} cursor-pointer`
                              : `${ui.buttonIdle} opacity-40 cursor-not-allowed`
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeUiFontSizeStep(0)}
                          title="글꼴 크기 기본(100%)으로 초기화"
                          aria-label="글꼴 크기 100%로 초기화"
                          className={`px-2 py-1.5 border rounded text-[10.5px] font-mono tabular-nums font-medium shrink-0 transition-colors cursor-pointer ${ui.buttonActive}`}
                        >
                          <span>100%</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Left & Right Sidebar Pin Lock Toggle */}
              <div className={`border rounded-md p-2.5 space-y-2 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}
                  >
                    <Pin className="w-3.5 h-3.5 shrink-0" />
                    <span>좌우 사이드바 고정</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sidebarsPinned}
                    aria-label="좌우 사이드바 고정 토글"
                    onClick={() => onChangeSidebarsPinned(!sidebarsPinned)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                      sidebarsPinned
                        ? theme === 'white'
                          ? 'bg-blue-600 border-blue-700'
                          : theme === 'red'
                          ? 'bg-red-700 border-red-500'
                          : 'bg-cyan-500 border-cyan-400'
                        : theme === 'white'
                        ? 'bg-slate-300 border-slate-400'
                        : theme === 'red'
                        ? 'bg-red-950/70 border-red-900'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        sidebarsPinned ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                <p className={`text-[10px] leading-relaxed break-keep ${ui.textMuted}`}>
                  {sidebarsPinned
                    ? '고정 활성화됨: 좌우 사이드바 손잡이를 직접 클릭해야 열리거나 닫힙니다.'
                    : '비활성화됨: 화면 양끝에 마우스를 올리면 자동으로 열리고 벗어나면 닫힙니다.'}
                </p>
              </div>

              {/* Stellarium-Style Tiered Local Star Catalog Downloader (문서/noxchart) */}
              <div className={`border rounded-md p-2.5 space-y-2.5 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1.5">
                  <div className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}>
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>별 목록 업데이트</span>
                  </div>
                  <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.accentText}`}>
                    {localStarState.installedTiers.length}/{STAR_CATALOG_TIERS.length}단계
                  </span>
                </div>

                <p className={`text-[10px] leading-relaxed break-keep ${ui.textMuted}`}>
                  단계별로 별 목록을 로컬에 내려받아 더 어두운 별까지 빠르게 표시합니다. 기본 내장(8.0등급) 외 확장 팩을 영구 보관할 수 있습니다.
                </p>

                {/* Local Storage / 문서/noxchart Folder Binding */}
                <div className={`p-2 rounded border space-y-1.5 ${ui.panelMuted} ${ui.border}`}>
                  <div className="flex items-center justify-between gap-1.5 text-[10px]">
                    <span className={`flex items-center gap-1 font-medium ${ui.textSecondary}`}>
                      <HardDrive className="w-3 h-3 shrink-0" />
                      <span>로컬 저장 위치</span>
                    </span>
                    <span
                      className={`font-mono text-[9.5px] truncate ${
                        localStarState.folderStatus === 'connected'
                          ? ui.accentText
                          : ui.textMuted
                      }`}
                    >
                      {localStarState.folderStatus === 'connected'
                        ? localStarState.folderDisplayName || '문서/noxchart'
                        : localStarState.folderStatus === 'needs-permission'
                        ? '재연결 필요'
                        : '브라우저 영구저장'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {localStarState.folderStatus === 'connected' ? (
                      <>
                        <button
                          type="button"
                          onClick={handleConnectNoxchartFolder}
                          className={`flex-1 py-1 px-1.5 border rounded text-[9.5px] font-medium flex items-center justify-center gap-1 cursor-pointer ${ui.buttonIdle}`}
                        >
                          <FolderOpen className="w-3 h-3 shrink-0" />
                          <span>폴더 변경</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectNoxchartFolder}
                          className={`py-1 px-1.5 border rounded text-[9.5px] cursor-pointer ${ui.buttonIdle}`}
                        >
                          해제
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectNoxchartFolder}
                        className={`flex-1 py-1 px-1.5 border rounded text-[9.5px] font-medium flex items-center justify-center gap-1 cursor-pointer ${ui.buttonIdle}`}
                      >
                        <FolderOpen className="w-3 h-3 shrink-0" />
                        <span>
                          {localStarState.folderStatus === 'needs-permission'
                            ? '문서/noxchart 다시 연결'
                            : '문서/noxchart 폴더 연결'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenStarPackPicker}
                      title="별 데이터가 저장된 위치(문서/noxchart 등)에서 .noxstars 파일 불러오기"
                      className={`py-1 px-1.5 border rounded text-[9.5px] font-medium flex items-center justify-center gap-1 shrink-0 cursor-pointer ${ui.buttonLoad}`}
                    >
                      <Upload className="w-3 h-3 shrink-0" />
                      <span>불러오기</span>
                    </button>
                    <input
                      ref={starPackFileInputRef}
                      type="file"
                      accept=".noxstars"
                      multiple
                      onChange={handleImportStarPackFiles}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Download Mirror / Route Selector (Server 5-Mirrors + Direct Browser CORS for GitHub Pages) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9.5px]">
                    <span className={ui.textMuted}>다운로드 경로 (실패 시 자동 전환)</span>
                  </div>
                  <select
                    value={localStarState.mirrorMode}
                    disabled={Boolean(localStarState.downloading)}
                    onChange={(e) => setStarPackMirrorMode(e.target.value as StarPackMirrorMode)}
                    className={`w-full px-2 py-1 border rounded text-[10px] ${ui.input} disabled:opacity-50`}
                  >
                    {STAR_PACK_MIRROR_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stellarium-Style Sequential Download Button & Metadata */}
                {localStarState.downloading ? (
                  <div className={`p-2 rounded border space-y-2 ${ui.panelMuted} ${ui.border}`}>
                    <div className="flex items-center justify-between gap-1.5 text-[10.5px]">
                      <span className={`font-semibold flex items-center gap-1.5 ${ui.textPrimary}`}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>
                          {STAR_CATALOG_TIERS.length}개 중 {localStarState.downloading.tier}번째 목록 받는 중
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={cancelStarPackDownload}
                        className={`px-1.5 py-0.5 border rounded text-[9.5px] cursor-pointer ${ui.buttonIdle}`}
                      >
                        취소
                      </button>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'white' ? 'bg-slate-300' : 'bg-slate-800'}`}>
                      <div
                        className={`h-full transition-all duration-200 ${
                          theme === 'white'
                            ? 'bg-blue-600'
                            : theme === 'red'
                            ? 'bg-red-600'
                            : 'bg-cyan-400'
                        }`}
                        style={{
                          width: `${Math.max(
                            3,
                            Math.round(
                              (localStarState.downloading.completedChunks /
                                Math.max(1, localStarState.downloading.totalChunks)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                    <div className={`text-[9.5px] font-mono tabular-nums ${ui.textMuted}`}>
                      {localStarState.downloading.statusText}
                    </div>
                  </div>
                ) : nextStarTier ? (
                  <div className={`p-2 rounded border space-y-2 ${ui.panelMuted} ${ui.border}`}>
                    <button
                      type="button"
                      onClick={() => handleDownloadStarTier(nextStarTier.tier)}
                      className={`w-full py-2 px-2.5 border rounded text-left flex items-center gap-2 transition-colors cursor-pointer ${ui.buttonActive}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          theme === 'white'
                            ? 'bg-blue-600 text-white'
                            : theme === 'red'
                            ? 'bg-red-700 text-red-100'
                            : 'bg-emerald-500/90 text-slate-950'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold leading-tight">
                          {STAR_CATALOG_TIERS.length}개 중 {nextStarTier.tier}번째 목록 받기
                        </div>
                        <div className="text-[9.5px] opacity-85 leading-tight mt-0.5 break-keep">
                          더 많은 별을 볼 수 있게 파일 내려받기
                        </div>
                      </div>
                    </button>
                    <div className={`grid grid-cols-1 gap-0.5 text-[10px] px-0.5 ${ui.textSecondary}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className={ui.textMuted}>다운로드 용량</span>
                        <span className="font-mono tabular-nums font-medium">{nextStarTier.estSizeLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className={ui.textMuted}>별 개수</span>
                        <span className="font-mono tabular-nums font-medium">{nextStarTier.estStarsLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className={ui.textMuted}>등급 범위</span>
                        <span className="font-mono tabular-nums font-medium">
                          {nextStarTier.magMin.toFixed(2)} - {nextStarTier.magMax.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`p-2 rounded border text-[10px] flex items-center gap-1.5 ${ui.panelMuted} ${ui.border} ${ui.accentText}`}
                  >
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      전체 {STAR_CATALOG_TIERS.length}단계 별 목록이 설치되었습니다 (최대 {localStarState.maxMag.toFixed(2)}등급).
                    </span>
                  </div>
                )}

                {/* Installed Local Star Packs List */}
                {localStarState.installedTiers.length > 0 && (
                  <div className="space-y-1">
                    <div className={`flex items-center justify-between text-[9.5px] ${ui.textMuted}`}>
                      <span>
                        설치된 로컬 목록 ({localStarState.totalStars.toLocaleString()}개)
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatByteSize(localStarState.totalBytes)}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto astro-scroll pr-0.5">
                      {localStarState.installedTiers.map((pack) => (
                        <div
                          key={pack.tier}
                          className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded border text-[9.5px] ${ui.panelMuted} ${ui.border}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`font-semibold flex items-center gap-1 ${ui.textPrimary}`}>
                              <span>{pack.tier}단계</span>
                              <span className={`font-mono font-normal ${ui.textMuted}`}>
                                {pack.magMin.toFixed(2)}~{pack.magMax.toFixed(2)}m
                              </span>
                            </div>
                            <div className={`font-mono tabular-nums text-[9px] ${ui.textMuted}`}>
                              {pack.starCount.toLocaleString()}개 · {formatByteSize(pack.byteLength)}
                              {pack.savedToFolder ? ' · 폴더 저장' : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleExportStarPack(pack.tier)}
                              title="로컬 파일(.noxstars)로 저장"
                              className={`p-1 border rounded cursor-pointer ${ui.buttonIdle}`}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStarPack(pack.tier)}
                              title={`${pack.tier}단계 목록 삭제`}
                              className={`p-1 border rounded cursor-pointer ${ui.buttonIdle}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {starPackNotice && (
                  <div
                    className={`text-[10px] leading-snug break-keep ${
                      starPackNotice.isError
                        ? theme === 'white'
                          ? 'text-red-600'
                          : 'text-red-400'
                        : ui.accentText
                    }`}
                  >
                    {starPackNotice.text}
                  </div>
                )}
              </div>

              {/* IAU MPC Bright Minor Planets (Soft00Bright.txt) Orbital Elements Update */}
              <div className={`border rounded-md p-2.5 space-y-2 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1.5">
                  <div className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}>
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${mpcSyncing ? 'animate-spin' : ''}`} />
                    <span>MPC 밝은 소행성 궤도 갱신</span>
                  </div>
                  {mpcMeta && (
                    <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.accentText}`}>
                      {mpcMeta.totalCount}개
                    </span>
                  )}
                </div>
                <p className={`text-[10px] leading-relaxed break-keep ${ui.textMuted}`}>
                  국제천문연맹 소행성센터(MPC)의 최신 Soft00Bright.txt를 내려받아 기존 소행성 궤도 요소를 갱신하고 밝은 소행성을 일괄 추가합니다.
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={mpcSyncing}
                    onClick={handleSyncMpcAsteroids}
                    className={`flex-1 py-1.5 px-2 border rounded text-[10.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${ui.buttonActive}`}
                  >
                    {mpcSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <RefreshCw className="w-3 h-3 shrink-0" />
                    )}
                    <span>{mpcSyncing ? 'MPC 목록 내려받는 중...' : '최신 소행성 갱신'}</span>
                  </button>
                  {mpcMeta && (
                    <button
                      type="button"
                      disabled={mpcSyncing}
                      onClick={handleResetMpcAsteroids}
                      title="내장 기본 소행성 궤도로 복원"
                      className={`py-1.5 px-2 border rounded text-[10px] font-medium flex items-center justify-center gap-1 shrink-0 cursor-pointer disabled:opacity-60 ${ui.buttonIdle}`}
                    >
                      <RotateCcw className="w-3 h-3 shrink-0" />
                      <span>복원</span>
                    </button>
                  )}
                </div>
                {mpcMeta && (
                  <div className={`px-2 py-1.5 rounded border text-[9.5px] space-y-0.5 ${ui.panelMuted} ${ui.border}`}>
                    <div className={`flex items-center justify-between gap-1 ${ui.textSecondary}`}>
                      <span>기존 갱신 {mpcMeta.updatedExistingCount}개 · 신규 추가 {mpcMeta.addedCount}개</span>
                      {mpcMeta.epochIso && (
                        <span className="font-mono tabular-nums">역기점 {mpcMeta.epochIso}</span>
                      )}
                    </div>
                    <div className={`font-mono tabular-nums text-[9px] ${ui.textMuted}`}>
                      최근 갱신: {new Date(mpcMeta.updatedAt).toLocaleString('ko-KR', { hour12: false })}
                    </div>
                  </div>
                )}
                {mpcStatusMsg && (
                  <div
                    className={`text-[10px] leading-snug ${
                      mpcStatusMsg.isError
                        ? theme === 'white'
                          ? 'text-red-600'
                          : 'text-red-400'
                        : ui.accentText
                    }`}
                  >
                    {mpcStatusMsg.text}
                  </div>
                )}
              </div>

              {/* IAU MPC Observable Comets (Soft00Cmt.txt / CometEls.txt / cometels.json) Update */}
              <div className={`border rounded-md p-2.5 space-y-2 ${cardIdleCls}`}>
                <div className="flex items-center justify-between gap-1.5">
                  <div className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}>
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${cometSyncing ? 'animate-spin' : ''}`} />
                    <span>MPC 최신 혜성 궤도 갱신</span>
                  </div>
                  <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.accentText}`}>
                    {cometMeta ? `${cometMeta.totalCount}개` : `기본 ${getBuiltinCometCount()}개`}
                  </span>
                </div>
                <p className={`text-[10px] leading-relaxed break-keep ${ui.textMuted}`}>
                  국제천문연맹 소행성센터(MPC)의 최신 혜성 궤도 요소(Soft00Cmt.txt)를 내려받거나 로컬 파일(CometEls.txt · cometels.json)을 불러와 성도에 혜성과 꼬리를 표시합니다.
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={cometSyncing}
                    onClick={handleSyncMpcComets}
                    className={`flex-1 py-1.5 px-2 border rounded text-[10.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${ui.buttonActive}`}
                  >
                    {cometSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <RefreshCw className="w-3 h-3 shrink-0" />
                    )}
                    <span>{cometSyncing ? 'MPC 혜성 내려받는 중...' : '최신 혜성 갱신'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={cometSyncing}
                    onClick={() => cometFileInputRef.current?.click()}
                    title="Soft00Cmt.txt / CometEls.txt / cometels.json 파일 직접 불러오기"
                    className={`py-1.5 px-2 border rounded text-[10px] font-medium flex items-center justify-center gap-1 shrink-0 cursor-pointer disabled:opacity-60 ${ui.buttonLoad}`}
                  >
                    <Upload className="w-3 h-3 shrink-0" />
                    <span>파일</span>
                  </button>
                  {cometMeta && (
                    <button
                      type="button"
                      disabled={cometSyncing}
                      onClick={handleResetMpcComets}
                      title="내장 기본 혜성 목록으로 복원"
                      className={`py-1.5 px-2 border rounded text-[10px] font-medium flex items-center justify-center gap-1 shrink-0 cursor-pointer disabled:opacity-60 ${ui.buttonIdle}`}
                    >
                      <RotateCcw className="w-3 h-3 shrink-0" />
                      <span>복원</span>
                    </button>
                  )}
                </div>
                {cometMeta && (
                  <div className={`px-2 py-1.5 rounded border text-[9.5px] space-y-0.5 ${ui.panelMuted} ${ui.border}`}>
                    <div className={`flex items-center justify-between gap-1 ${ui.textSecondary}`}>
                      <span className="truncate">{cometMeta.sourceLabel}</span>
                      <span className="font-mono tabular-nums shrink-0">{cometMeta.totalCount}개</span>
                    </div>
                    <div className={`font-mono tabular-nums text-[9px] ${ui.textMuted}`}>
                      최근 갱신: {new Date(cometMeta.updatedAt).toLocaleString('ko-KR', { hour12: false })}
                    </div>
                  </div>
                )}
                {cometStatusMsg && (
                  <div
                    className={`text-[10px] leading-snug ${
                      cometStatusMsg.isError
                        ? theme === 'white'
                          ? 'text-red-600'
                          : 'text-red-400'
                        : ui.accentText
                    }`}
                  >
                    {cometStatusMsg.text}
                  </div>
                )}
              </div>

              {/* Layer Settings File Backup & Reset */}
              <div className={`border rounded-md p-2.5 space-y-2 ${cardIdleCls}`}>
                <div className={`font-semibold text-[11px] flex items-center gap-1.5 ${ui.textPrimary}`}>
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>표시 설정 파일 관리</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      downloadLayerSettingsFile(layers, hips);
                      showLayerNotice('표시 설정을 .json 파일로 저장했습니다.');
                    }}
                    className={`py-1.5 px-2 border rounded text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${ui.buttonSave}`}
                  >
                    <Download className="w-3 h-3 shrink-0" />
                    <span>설정 저장</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => layerFileInputRef.current?.click()}
                    className={`py-1.5 px-2 border rounded text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${ui.buttonLoad}`}
                  >
                    <Upload className="w-3 h-3 shrink-0" />
                    <span>불러오기</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onResetLayerSettings();
                    showLayerNotice('표시 설정을 기본값으로 복원했습니다.');
                  }}
                  className={`w-full py-1.5 px-2 border rounded text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer ${ui.buttonIdle}`}
                >
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  <span>표시 설정 기본값 복원</span>
                </button>
                {layerStatusMsg && (
                  <div className={`text-[10px] ${ui.accentText}`}>{layerStatusMsg}</div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
      )}
      <input
        ref={cometFileInputRef}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        onChange={handleImportCometFile}
        className="hidden"
      />
      <input
        ref={layerFileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = parseLayerSettingsFromJson(text, layers, hips);
            if (parsed.error || !parsed.bundle) {
              showLayerNotice(parsed.error || '레이어 세팅을 불러오지 못했습니다.');
              return;
            }
            onImportLayerSettings(parsed.bundle);
            showLayerNotice('레이어 세팅 파일을 불러와 적용했습니다.');
          } catch {
            showLayerNotice('파일을 읽는 중 오류가 발생했습니다.');
          }
        }}
        className="hidden"
      />
    </aside>
  );
}
