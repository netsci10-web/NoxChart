import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  ChevronDown,
  Compass,
  Crosshair,
  Download,
  Eye,
  Image,
  Layers,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { CALDWELL_CATALOG } from '../data/caldwell';
import { CatalogSnapshot } from '../data/catalogLoader';
import { DSO_CATALOG } from '../data/dso';
import {
  isSmartTelescopeRotatable,
  normalizeTelescopeOpticalType,
  SMART_TELESCOPE_PRESETS,
} from '../data/equipmentCatalog';
import {
  ChartViewState,
  Constellation,
  DEFAULT_SENSOR_EXPORT_CAPTION,
  DeepSkyObject,
  DoubleStarSystem,
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
  ThemeMode,
} from '../types/astronomy';
import {
  equatorialToHorizontal,
  getDsoLimitingMagnitude,
  getLimitingMagnitude,
  getLSTDeg,
  RAD2DEG,
} from '../utils/astronomy';
import {
  formatCatalogCode,
  formatObjectDisplayName,
  getDsoSearchAliases,
  getExtraAliasesForKnownId,
  getSecondaryDesignations,
  normalizeCatalogToken,
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
import { getSolarSystemBodies } from '../utils/solarSystem';
import { getUiTheme } from '../utils/themeClasses';
import { EquipmentLockerPanel } from './EquipmentLockerPanel';

type SidebarTab = 'explore' | 'layers' | 'optics' | 'observer';
type ExploreCategory = 'all' | 'messier' | 'caldwell' | 'ngcic' | 'solar' | 'constellation';

type GlobalSearchItem =
  | { kind: 'planet'; key: string; score: number; mag: number; body: SolarSystemBody }
  | { kind: 'constellation'; key: string; score: number; mag: number; con: Constellation }
  | { kind: 'star'; key: string; score: number; mag: number; star: Star }
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
  const qNorm = normalizeCatalogToken(q);
  let best = 0;
  for (const raw of primaryFields) {
    if (!raw) continue;
    const s = raw.toLowerCase();
    const sc = s.replace(/\s+/g, '');
    const sn = normalizeCatalogToken(raw);
    if (s === q || sc === qCompact || (qNorm && sn === qNorm)) return 120;
    if (s.startsWith(q) || sc.startsWith(qCompact) || (qNorm && sn.startsWith(qNorm))) {
      if (best < 90) best = 90;
    } else if (s.includes(q) || sc.includes(qCompact) || (qNorm && sn.includes(qNorm))) {
      if (best < 60) best = 60;
    }
  }
  if (best >= 90) return best;
  for (const raw of secondaryFields) {
    if (!raw) continue;
    const s = raw.toLowerCase();
    const sc = s.replace(/\s+/g, '');
    const sn = normalizeCatalogToken(raw);
    if (s === q || sc === qCompact || (qNorm && sn === qNorm)) {
      if (best < 100) best = 100;
    } else if (s.startsWith(q) || sc.startsWith(qCompact) || (qNorm && sn.startsWith(qNorm))) {
      if (best < 72) best = 72;
    } else if (s.includes(q) || sc.includes(qCompact) || (qNorm && sn.includes(qNorm))) {
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
  { name: '보현산 천문대', lat: 36.1647, lon: 128.9767 },
  { name: '소백산 천문대', lat: 36.9342, lon: 128.4575 },
  { name: '화천 조경철천문대', lat: 38.1211, lon: 127.4342 },
  { name: '제주 별빛누리공원', lat: 33.4439, lon: 126.5486 },
  { name: '하와이 마우나케아', lat: 19.8207, lon: -155.4681 },
  { name: '칠레 아타카마', lat: -24.6272, lon: -70.4042 },
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
}: ControlSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('explore');
  const [exploreCategory, setExploreCategory] = useState<ExploreCategory>('all');
  const [ngcIcFilter, setNgcIcFilter] = useState<'all' | 'ngc' | 'ic'>('all');
  const [solarGroupFilter, setSolarGroupFilter] = useState<
    'all' | 'planet' | 'dwarf' | 'asteroid' | 'moon'
  >('all');
  const [sensorFrameMode, setSensorFrameMode] = useState<'combo' | 'smart'>(() => {
    const activeCamId = equipmentLocker.activeIds.camera;
    const activeCam = activeCamId
      ? equipmentLocker.items.find((i) => i.id === activeCamId && i.category === 'camera')
      : null;
    return activeCam?.isSmartTelescope ? 'smart' : 'combo';
  });
  const [query, setQuery] = useState('');
  const [activeConAbbr, setActiveConAbbr] = useState<string | null>(null);
  const [quickSaveOpen, setQuickSaveOpen] = useState(false);
  const [quickSiteName, setQuickSiteName] = useState('');
  const [quickSiteNote, setQuickSiteNote] = useState('');
  const [siteStatusMsg, setSiteStatusMsg] = useState<string | null>(null);
  const [layerStatusMsg, setLayerStatusMsg] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(loadSavedOpenSections);
  const siteFileInputRef = useRef<HTMLInputElement>(null);
  const layerFileInputRef = useRef<HTMLInputElement>(null);
  const ui = getUiTheme(theme);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_OPEN_SECTIONS_STORAGE_KEY, JSON.stringify(openSections));
    } catch {
      // Ignore storage write failure
    }
  }, [openSections]);

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

  const messierList = useMemo(() => {
    const map = new Map<number, (typeof DSO_CATALOG)[number]>();
    for (const d of DSO_CATALOG) {
      const m = /^M(\d+)$/.exec(d.id);
      if (m) {
        map.set(Number(m[1]), {
          ...d,
          altId: d.altId ? formatCatalogCode(d.altId) : undefined,
        });
      }
    }
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
    if (!q) return messierList;
    const scored: { item: (typeof messierList)[number]; score: number; num: number }[] = [];
    for (const d of messierList) {
      const mNum = Number(d.id.slice(1)) || 999;
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
    scored.sort((a, b) => b.score - a.score || a.num - b.num);
    return scored.map((s) => s.item);
  }, [messierList, query]);

  const filteredCaldwell = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/\s+/g, '');
    if (!q) return CALDWELL_CATALOG;
    const scored: { item: (typeof CALDWELL_CATALOG)[number]; score: number }[] = [];
    for (const c of CALDWELL_CATALOG) {
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
    scored.sort((a, b) => b.score - a.score || a.item.caldwellNumber - b.item.caldwellNumber);
    return scored.map((s) => s.item);
  }, [query]);

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
    for (const c of CALDWELL_CATALOG) addEntry(c, c.caldwellId);
    for (const d of catalogs.dsosBright) addEntry(d);
    for (const d of catalogs.dsosDeep) addEntry(d);

    return Array.from(byKey.values()).sort((a, b) => a.dso.mag - b.dso.mag);
  }, [exploreCategory, messierList, catalogs.dsosBright, catalogs.dsosDeep]);

  const filteredNgcIc = useMemo(() => {
    if (exploreCategory !== 'ngcic') return { items: [], totalMatches: 0 };
    const pool =
      ngcIcFilter === 'all'
        ? ngcIcList
        : ngcIcList.filter((item) => item.catalog === ngcIcFilter);

    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/\s+/g, '');
    if (!q) {
      return { items: pool.slice(0, 100), totalMatches: pool.length };
    }

    const scored: { item: (typeof pool)[number]; score: number }[] = [];
    for (const item of pool) {
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
    scored.sort((a, b) => b.score - a.score || a.item.dso.mag - b.item.dso.mag);
    return {
      items: scored.slice(0, 100).map((s) => s.item),
      totalMatches: scored.length,
    };
  }, [exploreCategory, ngcIcList, ngcIcFilter, query]);

  const solarBodies = useMemo(() => getSolarSystemBodies(obsTimeMs), [obsTimeMs]);

  const filteredSolar = useMemo(() => {
    const q = query.trim().toLowerCase();
    return solarBodies.filter((b) => {
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
      if (!q) return true;
      return `${b.id} ${b.name} ${b.koName} ${b.category}`.toLowerCase().includes(q);
    });
  }, [solarBodies, query, solarGroupFilter]);

  const sortedConstellations = useMemo(
    () => [...catalogs.constellations].sort((a, b) => a.koName.localeCompare(b.koName, 'ko')),
    [catalogs.constellations]
  );

  const filteredConstellations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedConstellations;
    return sortedConstellations.filter((c) =>
      `${c.abbr} ${c.name} ${c.koName}`.toLowerCase().includes(q)
    );
  }, [sortedConstellations, query]);

  const allSearchResults = useMemo(() => {
    if (exploreCategory !== 'all') {
      return { items: [] as GlobalSearchItem[], totalMatches: 0 };
    }
    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/\s+/g, '');

    if (!q) {
      const featured: GlobalSearchItem[] = [];
      const featuredSolarIds = ['Sun', 'Moon', 'Jupiter', 'Saturn', 'Mars', 'Venus'];
      for (const id of featuredSolarIds) {
        const body = solarBodies.find((b) => b.id === id);
        if (body) {
          featured.push({ kind: 'planet', key: `planet:${body.id}`, score: 100, mag: body.mag, body });
        }
      }
      const featuredMessierIds = ['M31', 'M42', 'M45', 'M13', 'M51', 'M57', 'M8', 'M27'];
      for (const id of featuredMessierIds) {
        const dso = messierList.find((m) => m.id === id);
        if (dso) {
          featured.push({
            kind: 'dso',
            key: `dso:${dso.id}`,
            score: 90,
            mag: dso.mag,
            dso,
            badge: '메시에',
            primaryId: dso.id,
            secondaryId: dso.altId,
          });
        }
      }
      const topStars = [...catalogs.brightStars]
        .filter((s) => Boolean(s.koName || s.name))
        .sort((a, b) => a.mag - b.mag)
        .slice(0, 6);
      for (const star of topStars) {
        featured.push({
          kind: 'star',
          key: `star:${star.id}`,
          score: 80,
          mag: star.mag,
          star,
        });
      }
      return { items: featured, totalMatches: featured.length };
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

    // 3. Stars (Bright + HIP lookup in Deep Stars)
    const seenStarHip = new Set<number>();
    const wantsHip = qCompact.startsWith('hip') || /^\d{2,}$/.test(qCompact);
    for (const star of catalogs.brightStars) {
      if (star.hip) seenStarHip.add(star.hip);
      const hipLabel = star.hip ? `HIP ${star.hip}` : undefined;
      const score = scoreSearchMatch(
        [star.koName, star.name, star.bayer, hipLabel, star.id],
        [star.con],
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
        const hipLabel = star.hip ? `HIP ${star.hip}` : star.id;
        const score = scoreSearchMatch([hipLabel, star.id], [], q, qCompact);
        if (score > 0) {
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

    for (const entry of CALDWELL_CATALOG) {
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
        [sys.disc, sys.id, sys.wdsId, sys.koName, sys.name, sys.bayer],
        [sys.con, sys.isMultiple ? '다중성 multiple' : '이중성 double'],
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

    results.sort((a, b) => b.score - a.score || a.mag - b.mag);
    return {
      items: results.slice(0, 80),
      totalMatches: results.length,
    };
  }, [
    exploreCategory,
    query,
    solarBodies,
    sortedConstellations,
    messierList,
    catalogs.brightStars,
    catalogs.deepStars,
    catalogs.doubleStars,
    catalogs.dsosBright,
    catalogs.darkNebulae,
    catalogs.dsosDeep,
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
        : body.group === 'dwarf' || body.group === 'asteroid'
        ? 10
        : 18;
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
    onChangeView((p) => ({
      ...p,
      ra: ((star.ra / 15) % 24 + 24) % 24,
      dec: star.dec,
      fsz: 12,
    }));
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

  const searchPlaceholder =
    exploreCategory === 'all'
      ? '천체명, M/C/NGC/IC, 별, 행성...'
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
      <div className={`grid grid-cols-4 border-b p-1 gap-1 ${ui.divider}`}>
        <button
          type="button"
          onClick={() => setTab('explore')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10.5px] tracking-[-0.04em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
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
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10.5px] tracking-[-0.04em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
            tab === 'layers' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Layers className="w-3.5 h-3.5 mb-0.5" />
          <span>레이어</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('optics')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10.5px] tracking-[-0.04em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
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
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-[10.5px] tracking-[-0.04em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
            tab === 'observer' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <MapPin className="w-3.5 h-3.5 mb-0.5" />
          <span>관측지</span>
        </button>
      </div>

      {/* Explore Tab: 6-Category Segmented Bar + Search + Full-Height Card List */}
      {tab === 'explore' ? (
        <div className="flex-1 flex flex-col min-h-0 p-2 gap-2 text-[11px] tracking-[-0.04em]">
          {/* 6-Category Segmented Bar */}
          <div className={`grid grid-cols-6 gap-0.5 p-0.5 border rounded-lg shrink-0 ${segTrackCls}`}>
            {(
              [
                { id: 'all', label: '전체' },
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
                className={`py-1.5 px-0 text-[10px] tracking-[-0.07em] font-semibold rounded-md transition-colors whitespace-nowrap ${
                  exploreCategory === cat.id ? segActiveCls : segIdleCls
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative shrink-0">
            <Search className={`w-3.5 h-3.5 absolute left-2 top-2 ${ui.textMuted}`} />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                onSearchActiveChange(exploreCategory === 'ngcic' || val.trim().length > 0);
              }}
              placeholder={searchPlaceholder}
              className={`w-full pl-7 pr-2 py-1.5 border text-[11px] tracking-[-0.04em] rounded-md ${ui.input}`}
            />
          </div>

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
            <div className="grid grid-cols-5 gap-0.5 shrink-0">
              {(
                [
                  { id: 'all', label: '전체' },
                  { id: 'planet', label: '행성' },
                  { id: 'dwarf', label: '왜행성' },
                  { id: 'asteroid', label: '소행성' },
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

          {/* Scrollable Card List */}
          <div className="flex-1 min-h-0 overflow-y-auto astro-scroll space-y-1.5 pr-0.5">
            {exploreCategory === 'all' && (
              <>
                <div className={`flex items-center justify-between px-0.5 text-[9.5px] tracking-[-0.05em] ${ui.textMuted}`}>
                  <span>
                    {query.trim()
                      ? `통합 검색 결과 ${allSearchResults.totalMatches.toLocaleString()}건`
                      : '추천 주요 천체 · 전체 카탈로그 통합 검색'}
                  </span>
                  {query.trim() && allSearchResults.totalMatches > 80 && (
                    <span className="font-mono">상위 80</span>
                  )}
                </div>

                {allSearchResults.items.length === 0 ? (
                  <div className={`py-8 text-center ${ui.textMuted}`}>
                    일치하는 천체가 없습니다.
                  </div>
                ) : (
                  allSearchResults.items.map((item) => {
                    if (item.kind === 'planet') {
                      const { body } = item;
                      const isActive = selected?.kind === 'planet' && selected.data.id === body.id;
                      const hz = equatorialToHorizontal(body.ra, body.dec, lstDeg, observer.lat);
                      const below = hz.altDeg < 0;
                      return (
                        <button
                          key={item.key}
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
                                {body.koName}
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
                            {body.name} · 고도 {hz.altDeg.toFixed(1)}° · {formatCompactRaDec(body.ra, body.dec)}
                          </div>
                        </button>
                      );
                    }

                    if (item.kind === 'constellation') {
                      const { con } = item;
                      const isActive = activeConAbbr === con.abbr;
                      const hz = equatorialToHorizontal(con.ra, con.dec, lstDeg, observer.lat);
                      const below = hz.altDeg < 0;
                      return (
                        <button
                          key={item.key}
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
                                className={`font-semibold truncate tracking-[-0.04em] ${
                                  below ? belowHorizonTextCls : ui.textPrimary
                                }`}
                              >
                                {con.koName}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-[10px] tracking-[-0.04em] shrink-0 ${
                                below ? belowHorizonSubCls : ui.textMuted
                              }`}
                            >
                              {con.name}
                            </span>
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
                        star.bayer || star.id
                      );
                      const subInfo = [
                        star.bayer,
                        star.hip ? `HIP ${star.hip}` : undefined,
                        star.con || undefined,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <button
                          key={item.key}
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
                                항성
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
                        sys.bayer || sys.disc
                      );
                      return (
                        <button
                          key={item.key}
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
                      secondaryId || dso.id
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
                  const dsoTitle = formatObjectDisplayName(dso.koName, dso.name, dso.id);
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
                    formatCatalogCode(entry.id)
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
                      crossId || dso.type
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

            {exploreCategory === 'solar' &&
              (filteredSolar.length === 0 ? (
                <div className={`py-8 text-center ${ui.textMuted}`}>
                  일치하는 태양계 천체가 없습니다.
                </div>
              ) : (
                filteredSolar.map((body) => {
                  const isActive = selected?.kind === 'planet' && selected.data.id === body.id;
                  const isNestedMoon =
                    solarGroupFilter === 'all' && body.group === 'moon' && body.id !== 'Moon';
                  const hz = equatorialToHorizontal(body.ra, body.dec, lstDeg, observer.lat);
                  const below = hz.altDeg < 0;
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
                              className={`font-semibold truncate tracking-[-0.04em] ${
                                below ? belowHorizonTextCls : ui.textPrimary
                              }`}
                            >
                              {body.koName}
                            </span>
                            <span
                              className={`text-[10px] truncate tracking-[-0.04em] ${
                                below ? belowHorizonSubCls : ui.textMuted
                              }`}
                            >
                              {body.name}
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
                          {body.category} · 고도 {hz.altDeg.toFixed(1)}° ·{' '}
                          {formatCompactRaDec(body.ra, body.dec)}
                        </div>
                      </button>
                    </div>
                  );
                })
              ))}

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
                            className={`font-semibold truncate tracking-[-0.04em] ${
                              below ? belowHorizonTextCls : ui.textPrimary
                            }`}
                          >
                            {con.koName}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[10px] tracking-[-0.04em] shrink-0 ${
                            below ? belowHorizonSubCls : ui.textMuted
                          }`}
                        >
                          {con.name}
                        </span>
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
              className={`p-2 border space-y-1 transition-colors ${
                layers.highlightSessionPlan
                  ? theme === 'white'
                    ? 'bg-amber-50 border-amber-300'
                    : theme === 'red'
                    ? 'bg-[#1D0404] border-[#7F1D1D]'
                    : 'bg-[#1A1408] border-[#784A12]'
                  : ui.border
              }`}
              style={{ borderRadius: '6px' }}
            >
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleSection('layers_highlight')}
                  aria-expanded={isSectionOpen('layers_highlight')}
                  className="flex items-center gap-1 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_highlight') ? '' : '-rotate-90'
                    }`}
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
              {isSectionOpen('layers_highlight') && (
                <p className={`text-[9.5px] tracking-[-0.04em] leading-snug break-keep ${ui.textMuted}`}>
                  {sessionPlanCount > 0
                    ? '관측 목록에 담긴 천체(별·행성·이중성·DSO)를 성도 위에 번호·이중 링·배지 라벨로 눈에 띄게 강조합니다.'
                    : '활성화 후 관측 목록에 대상을 추가하거나 .skylist를 불러오면 성도 위에 번호·링으로 강조 표시됩니다.'}
                </p>
              )}
            </div>

            {/* 1. 별자리 (Constellations) */}
            <div className={`pt-3 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_constellations')}
                aria-expanded={isSectionOpen('layers_constellations')}
                className="w-full flex items-center justify-between gap-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_constellations') ? '' : '-rotate-90'
                    }`}
                  />
                  <span>별자리 (Constellations)</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.05em] tabular-nums whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                  88개 · {layers.constellationLineStyle === 'modern' ? 'IAU 843선' : '전통 695선'}
                </span>
              </button>

              {isSectionOpen('layers_constellations') && (
              <div className="space-y-1.5">

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

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  별자리 이름 라벨
                </span>
                <input
                  type="checkbox"
                  checked={layers.showConstellationNames}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showConstellationNames: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

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
              </div>
              )}
            </div>

            {/* 1.5. 태양계 (Solar System) */}
            <div className={`pt-3 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_solar')}
                aria-expanded={isSectionOpen('layers_solar')}
                className="w-full flex items-center justify-between gap-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_solar') ? '' : '-rotate-90'
                    }`}
                  />
                  <span>태양계 (Solar System)</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.04em] tabular-nums whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                  {solarBodies.length} 천체
                </span>
              </button>

              {isSectionOpen('layers_solar') && (
              <div className="space-y-1.5">

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  태양계 천체
                </span>
                <input
                  type="checkbox"
                  checked={layers.showSolarSystem}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showSolarSystem: e.target.checked }))
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
              </div>
              )}
            </div>

            {/* 2. 항성 (Stars) */}
            <div className={`pt-3 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_stars')}
                aria-expanded={isSectionOpen('layers_stars')}
                className="w-full flex items-center justify-between gap-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_stars') ? '' : '-rotate-90'
                    }`}
                  />
                  <span>항성 (Stars)</span>
                </span>
                <span className={`font-mono text-[9.5px] tracking-[-0.04em] tabular-nums whitespace-nowrap shrink-0 ${ui.textMuted}`}>
                  LoD {layers.magOffset >= 0 ? `+${layers.magOffset.toFixed(1)}` : layers.magOffset.toFixed(1)}m
                </span>
              </button>

              {isSectionOpen('layers_stars') && (
              <div className="space-y-1.5">

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

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                  항성 이름 라벨
                </span>
                <input
                  type="checkbox"
                  checked={layers.showStarLabels}
                  onChange={(e) =>
                    onChangeLayers((p) => ({ ...p, showStarLabels: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                />
              </label>

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
                <div className="pl-2 pb-0.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                      화면 밝기 상위 표시
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
                    className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.06em] ${ui.textSecondary}`}>
                  Gaia DR3 실시간 심층 별 (≤5.5°)
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

              <p className={`pt-0.5 text-[10px] tracking-[-0.04em] leading-snug ${ui.textMuted}`}>
                시야각 5.5° 이하 확대 시 Gaia DR3 심층 별(최대 15.8m)이 화면 전체에 균일하게 로딩됩니다.
              </p>
              </div>
              )}
            </div>

            {/* 2.5. 이중성 · 다중성 (WDS Double & Multiple Stars) */}
            <div className={`pt-3 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_doubles')}
                aria-expanded={isSectionOpen('layers_doubles')}
                className="w-full flex items-center justify-between gap-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_doubles') ? '' : '-rotate-90'
                    }`}
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
              <div className="space-y-1.5">

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
                      이중성 · 다중성 라벨
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
                    <div className="pl-2 pb-0.5 space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                          라벨 밀도 (화면 밝기 상위)
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
                        aria-label="이중성 다중성 라벨 밀도"
                        className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                      />
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
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_dso')}
                aria-expanded={isSectionOpen('layers_dso')}
                className="w-full flex items-center justify-between gap-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_dso') ? '' : '-rotate-90'
                    }`}
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
              <div className="space-y-1">
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

                <label
                  className={`flex items-center justify-between gap-1.5 py-0.5 ${
                    layers.showDso ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'
                  }`}
                >
                  <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                    DSO 카탈로그 라벨
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
                      aria-label="심우주 천체 라벨 화면 밝기 상위 표시 비율"
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
                          심볼 · 라벨 진하기
                        </span>
                        <span className={`font-mono tabular-nums ${ui.textSecondary}`}>
                          {Math.round(layers.dsoOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.05}
                        disabled={!anyDsoActive}
                        value={layers.dsoOpacity}
                        onChange={(e) =>
                          onChangeLayers((p) => ({
                            ...p,
                            dsoOpacity: Number(e.target.value),
                          }))
                        }
                        aria-label="심우주 천체 심볼 및 라벨 진하기"
                        className={`w-full h-1.5 accent-cyan-500 ${
                          anyDsoActive ? 'cursor-pointer' : 'cursor-not-allowed'
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
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => toggleSection('layers_mag')}
                  aria-expanded={isSectionOpen('layers_mag')}
                  className={`flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_mag') ? '' : '-rotate-90'
                    }`}
                  />
                  <span>한계등급 기준 (60°: 6.0 / 10.0)</span>
                </button>
                {(layers.magOffset !== 0 || layers.dsoMagOffset !== 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeLayers((p) => ({ ...p, magOffset: 0, dsoMagOffset: 0 }))
                    }
                    className={`text-[9.5px] tracking-[-0.05em] whitespace-nowrap opacity-80 hover:opacity-100 ${ui.accentText}`}
                  >
                    초기화
                  </button>
                )}
              </div>

              {isSectionOpen('layers_mag') && (
              <div className="space-y-2">

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
                  max={3.0}
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
            <div className={`pt-3 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('layers_grids')}
                aria-expanded={isSectionOpen('layers_grids')}
                className={`w-full flex items-center gap-1 text-left font-semibold whitespace-nowrap tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                    isSectionOpen('layers_grids') ? '' : '-rotate-90'
                  }`}
                />
                <span>좌표 그리드 & 기준선</span>
              </button>
              {isSectionOpen('layers_grids') && (
              <div className="space-y-1.5">
              {(
                [
                  ['showGridEq', '적도 좌표 그리드 (RA/Dec)'],
                  ['showGridAltAz', '지평 좌표 그리드 (Alt/Az)'],
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
              {(() => {
                const anyGridActive = layers.showGridEq || layers.showGridAltAz;
                return (
                  <div
                    className={`pl-2 pt-0.5 pb-1 space-y-0.5 transition-opacity ${
                      anyGridActive ? '' : 'opacity-45 cursor-not-allowed'
                    }`}
                  >
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
                      className={`w-full h-1.5 accent-cyan-500 ${
                        anyGridActive ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    />
                  </div>
                );
              })()}
              {(
                [
                  ['showHorizon', '관측지 지평선 및 방위'],
                  ['showEcliptic', '황도선 (Ecliptic)'],
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
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleSection('layers_hips')}
                  aria-expanded={isSectionOpen('layers_hips')}
                  className={`flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_hips') ? '' : '-rotate-90'
                    }`}
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
              <div className="space-y-2">

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

            {/* 6. 레이어 세팅 관리 (파일 저장 / 불러오기 / 자동 로컬 저장) */}
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleSection('layers_manage')}
                  aria-expanded={isSectionOpen('layers_manage')}
                  className={`flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('layers_manage') ? '' : '-rotate-90'
                    }`}
                  />
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>레이어 세팅 관리</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetLayerSettings();
                    showLayerNotice('레이어 세팅을 기본값으로 복원했습니다.');
                  }}
                  title="레이어 세팅 기본값 복원"
                  className={`px-1.5 py-0.5 border text-[10px] tracking-[-0.04em] flex items-center gap-0.5 transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <RotateCcw className="w-2.5 h-2.5 shrink-0" />
                  <span>기본값</span>
                </button>
              </div>

              {isSectionOpen('layers_manage') && (
              <div className="space-y-2">

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    downloadLayerSettingsFile(layers, hips);
                    showLayerNotice('전체 레이어 세팅을 .json 파일로 저장했습니다.');
                  }}
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>파일 저장</span>
                </button>
                <button
                  type="button"
                  onClick={() => layerFileInputRef.current?.click()}
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Upload className="w-3 h-3 shrink-0" />
                  <span>파일 불러오기</span>
                </button>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => toggleSection('optics_rings')}
                  aria-expanded={isSectionOpen('optics_rings')}
                  className={`flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('optics_rings') ? '' : '-rotate-90'
                    }`}
                  />
                  <span>시야 링 (중복 표시 가능)</span>
                </button>
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
                  className={`text-[10px] tracking-[-0.05em] whitespace-nowrap transition-opacity hover:opacity-100 opacity-75 ${ui.textMuted}`}
                >
                  모두 해제
                </button>
              </div>

              {isSectionOpen('optics_rings') && (
              <div className="space-y-2">

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
                            className={`w-3 h-3 rounded-full border-2 shrink-0 inline-block ${
                              theme === 'red' ? 'border-[#EF4444]' : 'border-cyan-400'
                            }`}
                            aria-hidden="true"
                          />
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
                      촬영 센서 화각 프레임 ({optics.sensorWidthDeg.toFixed(2)}°×
                      {optics.sensorHeightDeg.toFixed(2)}°)
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

              {/* Star Hopping Path Toggle */}
              <label className="flex items-center justify-between gap-1.5 pt-1 px-1 cursor-pointer">
                <span className={`whitespace-nowrap tracking-[-0.05em] ${ui.textMuted}`}>
                  선택 천체 별 호핑 가이드 경로
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
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <button
                type="button"
                onClick={() => toggleSection('optics_flip')}
                aria-expanded={isSectionOpen('optics_flip')}
                className="w-full flex items-center justify-between gap-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={`flex items-center gap-1 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('optics_flip') ? '' : '-rotate-90'
                    }`}
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
              <div className="space-y-2">
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
            <div className={`pt-3 border-t ${ui.divider}`}>
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

            {/* Astrophotography Sensor Frame (내 장비 조합 + 스마트망원경 바로 적용) */}
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <button
                type="button"
                onClick={() => toggleSection('optics_sensor')}
                aria-expanded={isSectionOpen('optics_sensor')}
                className="w-full flex items-center justify-between gap-1.5 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span
                  className={`flex items-center gap-1 min-w-0 font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('optics_sensor') ? '' : '-rotate-90'
                    }`}
                  />
                  <span>촬영 센서 화각 프레임</span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.textMuted}`}>
                  {optics.sensorWidthDeg.toFixed(2)}°×{optics.sensorHeightDeg.toFixed(2)}°
                </span>
              </button>

              {isSectionOpen('optics_sensor') && (
              <div className="space-y-2">

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
                          <div className={`text-[9.5px] font-semibold ${ui.textMuted}`}>
                            내 장비함 등록 스마트망원경
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
                              Math.abs(optics.sensorHeightDeg - h) < 0.02;
                            const canRot = isSmartTelescopeRotatable(sc);
                            return (
                              <button
                                key={sc.id}
                                type="button"
                                onClick={() => onSelectActiveEquipment('camera', sc.id)}
                                className={`w-full text-left px-2 py-1.5 border flex items-center justify-between gap-1 text-[10px] tracking-[-0.05em] ${
                                  isApplied ? ui.buttonActive : ui.buttonIdle
                                }`}
                                style={{ borderRadius: '4px' }}
                              >
                                <span className="truncate font-medium">
                                  {sc.name}
                                  {canRot ? ' · 회전' : ''}
                                </span>
                                <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                                  {w.toFixed(2)}°×{h.toFixed(2)}°
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className={`text-[9.5px] font-semibold ${ui.textMuted}`}>
                          주요 스마트망원경 바로 적용
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
                            const isApplied =
                              optics.showSensorBox &&
                              Math.abs(optics.sensorWidthDeg - w) < 0.02 &&
                              Math.abs(optics.sensorHeightDeg - h) < 0.02 &&
                              (!optics.sensorEquipmentLabel ||
                                optics.sensorEquipmentLabel === sp.name);
                            return (
                              <button
                                key={sp.id}
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
                                  }))
                                }
                                className={`w-full text-left px-2 py-1.5 border flex items-center justify-between gap-1 text-[10px] tracking-[-0.05em] ${
                                  isApplied ? ui.buttonActive : ui.buttonIdle
                                }`}
                                style={{ borderRadius: '4px' }}
                              >
                                <span className="truncate">
                                  {sp.name} · {sp.focalLengthMm}mm
                                  {canRot ? ' · 회전' : ''}
                                </span>
                                <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                                  {w.toFixed(2)}°×{h.toFixed(2)}°
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

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

            {/* Sensor FOV PNG Footer Caption Settings */}
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
              const previewFov = `${optics.sensorWidthDeg.toFixed(2)}° × ${optics.sensorHeightDeg.toFixed(2)}°`;
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
                captionCfg.showEquipmentFov ? `${previewEquip} (${previewFov})` : '',
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
                <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleSection('optics_sensor_caption')}
                      aria-expanded={isSectionOpen('optics_sensor_caption')}
                      className={`flex items-center gap-1 min-w-0 text-left font-semibold whitespace-nowrap tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                          isSectionOpen('optics_sensor_caption') ? '' : '-rotate-90'
                        }`}
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
                    <div className="space-y-2">
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

            {/* Eyepiece TFOV Settings (내 장비 조합 / 시야각 직접 입력 / 수치 계산) */}
            <div className={`pt-3 border-t ${ui.divider} space-y-2.5`}>
              <button
                type="button"
                onClick={() => toggleSection('optics_eyepiece')}
                aria-expanded={isSectionOpen('optics_eyepiece')}
                className="w-full flex items-center justify-between gap-1.5 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className="flex items-center gap-1 min-w-0">
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('optics_eyepiece') ? '' : '-rotate-90'
                    }`}
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
              <div className="space-y-2.5">

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
          </>
        )}

        {tab === 'observer' && (
          <>
            {/* Current Site Summary + Interactive Map Picker */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleSection('observer_current')}
                aria-expanded={isSectionOpen('observer_current')}
                className={`w-full font-semibold flex items-center justify-between gap-1 whitespace-nowrap tracking-[-0.05em] text-left hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
              >
                <span className="flex items-center gap-1">
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('observer_current') ? '' : '-rotate-90'
                    }`}
                  />
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>현재 관측지</span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                  {formatCoordsShort(observer.lat, observer.lon)}
                </span>
              </button>

              {isSectionOpen('observer_current') && (
              <div className="space-y-2">

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
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => toggleSection('observer_saved')}
                  aria-expanded={isSectionOpen('observer_saved')}
                  className={`font-semibold flex items-center gap-1 min-w-0 text-left whitespace-nowrap tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('observer_saved') ? '' : '-rotate-90'
                    }`}
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
                  className={`px-1.5 py-0.5 border text-[10px] font-medium flex items-center gap-0.5 transition-colors ${
                    quickSaveOpen ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  <BookmarkPlus className="w-3 h-3 shrink-0" />
                  <span>현재 저장</span>
                </button>
              </div>

              {isSectionOpen('observer_saved') && (
              <div className="space-y-2">

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
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>파일 저장</span>
                </button>
                <button
                  type="button"
                  onClick={() => siteFileInputRef.current?.click()}
                  className={`py-1.5 px-1.5 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors ${ui.buttonIdle}`}
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
            <div className={`pt-3 border-t ${ui.divider} space-y-1.5`}>
              <button
                type="button"
                onClick={() => toggleSection('observer_presets')}
                aria-expanded={isSectionOpen('observer_presets')}
                className={`w-full flex items-center justify-between gap-1 text-left font-semibold text-[10.5px] tracking-[-0.05em] hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
              >
                <span className="flex items-center gap-1">
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('observer_presets') ? '' : '-rotate-90'
                    }`}
                  />
                  <span>기본 추천 관측지</span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                  {SITE_PRESETS.length}곳
                </span>
              </button>
              {isSectionOpen('observer_presets') && (
              <div className="grid grid-cols-1 gap-1">
                {SITE_PRESETS.map((site) => (
                  <button
                    key={site.name}
                    type="button"
                    onClick={() =>
                      onChangeObserver((p) => ({
                        ...p,
                        name: site.name,
                        lat: site.lat,
                        lon: site.lon,
                      }))
                    }
                    className={`w-full text-left px-2 py-1.5 border flex items-center justify-between gap-1 text-[10px] tracking-[-0.05em] ${
                      observer.name === site.name ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    <span className="whitespace-nowrap truncate">{site.name}</span>
                    <span className="font-mono text-[9.5px] tracking-[-0.05em] tabular-nums opacity-80 whitespace-nowrap shrink-0">
                      {site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°
                    </span>
                  </button>
                ))}
              </div>
              )}
            </div>

            {/* Minimum Altitude Filter */}
            <div className={`pt-3 border-t ${ui.divider} space-y-2`}>
              <button
                type="button"
                onClick={() => toggleSection('observer_alt')}
                aria-expanded={isSectionOpen('observer_alt')}
                className={`w-full font-semibold flex items-center justify-between gap-1 whitespace-nowrap tracking-[-0.05em] text-left hover:opacity-80 transition-opacity cursor-pointer ${ui.textPrimary}`}
              >
                <span className="flex items-center gap-1">
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
                      isSectionOpen('observer_alt') ? '' : '-rotate-90'
                    }`}
                  />
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>고도 기반 관측 필터</span>
                </span>
                <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                  {observer.minAltitudeDeg > -90 ? `≥${observer.minAltitudeDeg}°` : '전체'}
                </span>
              </button>
              {isSectionOpen('observer_alt') && (
              <div className="space-y-2">
              <div className="grid grid-cols-5 gap-0.5">
                {[
                  { val: -90, lbl: '전체' },
                  { val: 0, lbl: '≥0°' },
                  { val: 15, lbl: '≥15°' },
                  { val: 30, lbl: '≥30°' },
                  { val: 45, lbl: '≥45°' },
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
                    className={`py-1.5 px-0.5 border text-[10px] tracking-[-0.06em] font-mono tabular-nums whitespace-nowrap shrink-0 ${
                      observer.minAltitudeDeg === opt.val ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    {opt.lbl}
                  </button>
                ))}
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
      </div>
      )}
    </aside>
  );
}
