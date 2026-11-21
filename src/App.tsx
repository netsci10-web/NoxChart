import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Globe2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Share2,
  Star,
  Sun,
} from 'lucide-react';
import { ControlSidebar } from './components/ControlSidebar';
import { ObjectInspector } from './components/ObjectInspector';
import { StarChartCanvas, StarChartCanvasHandle } from './components/StarChartCanvas';
import { TimeControlBar } from './components/TimeControlBar';
import {
  ensureCoreCatalogs,
  ensureDeepDsos,
  ensureDeepStars,
  ensureDoubleStars,
  getCatalogSnapshot,
  useCatalogData,
} from './data/catalogLoader';
import {
  ChartViewState,
  CoordSystem,
  EquipmentCategory,
  EquipmentItem,
  EquipmentLockerState,
  HipsSettings,
  LayerSettings,
  ObserverConfig,
  ObservingSessionEntry,
  OpticsSettings,
  SelectedItem,
  ThemeMode,
} from './types/astronomy';
import {
  equatorialToHorizontal,
  getDsoLimitingMagnitude,
  getLimitingMagnitude,
  getLSTDeg,
  horizontalToEquatorial,
  parseUrlState,
  RAD2DEG,
  syncUrlState,
} from './utils/astronomy';
import {
  downloadSkylistFile,
  exportObservingListToSkylist,
  parseSkylistObjects,
  resolveSkylistObjects,
} from './utils/skylist';
import { getSolarSystemBodies, getSolarSystemDailyTrail } from './utils/solarSystem';
import { getUiTheme } from './utils/themeClasses';

const SESSION_STORAGE_KEY = 'sidereal_atlas_session_v1';
const EQUIPMENT_STORAGE_KEY = 'noxchart_equipment_v1';

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
  coordSystem: 'equatorial',
};

const DEFAULT_THEME: ThemeMode = 'dark';

const DEFAULT_LAYERS: LayerSettings = {
  showGridEq: true,
  showGridAltAz: false,
  showHorizon: false,
  showTerrain: false,
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
  showStarLabels: true,
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
  eyepieceInputMode: 'calc',
  telescopeFocalLengthMm: 1000,
  eyepieceFocalLengthMm: 25,
  eyepieceAfovDeg: 68,
  showSensorBox: false,
  sensorWidthDeg: 2.15,
  sensorHeightDeg: 1.21,
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

export default function App() {
  const initialUrl = useMemo(() => parseUrlState(), []);
  const canvasHandleRef = useRef<StarChartCanvasHandle>(null);

  const [view, setView] = useState<ChartViewState>(initialUrl.view);
  const [theme, setTheme] = useState<ThemeMode>(initialUrl.theme);
  const [layers, setLayers] = useState<LayerSettings>(() => ({
    ...DEFAULT_LAYERS,
    showGridEq: initialUrl.view.coordSystem === 'equatorial',
    showGridAltAz: initialUrl.view.coordSystem === 'horizontal',
    showTerrain: initialUrl.view.coordSystem === 'horizontal',
  }));
  const [optics, setOptics] = useState<OpticsSettings>(DEFAULT_OPTICS);
  const [observer, setObserver] = useState<ObserverConfig>(DEFAULT_OBSERVER);
  const [hips, setHips] = useState<HipsSettings>(DEFAULT_HIPS);

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [centerLocked, setCenterLocked] = useState(false);
  const [solarTrails, setSolarTrails] = useState<Record<string, number>>({});
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'detail' | 'session'>('detail');
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
      if (centerLockedRef.current && activeSelected) {
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

  const [sessionPlan, setSessionPlan] = useState<ObservingSessionEntry[]>(() => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ObservingSessionEntry[];
    } catch {
      // Ignore storage parse failure
    }
    return [];
  });
  const sessionPlanRef = useRef<ObservingSessionEntry[]>(sessionPlan);
  sessionPlanRef.current = sessionPlan;

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

  // Ensure deep catalogs are loaded if saved observing list contains NGC/IC/HIP/WDS objects
  useEffect(() => {
    if (sessionPlan.length === 0) return;
    if (sessionPlan.some((e) => e.kind === 'dso')) {
      void ensureDeepDsos();
    }
    if (sessionPlan.some((e) => e.kind === 'star')) {
      void ensureDeepStars();
    }
    if (sessionPlan.some((e) => e.kind === 'double')) {
      void ensureDoubleStars();
    }
  }, [sessionPlan]);

  // Sync URL query params continuously using History API replaceState
  useEffect(() => {
    const timer = window.setTimeout(() => {
      syncUrlState(view, theme);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [view, theme]);

  // Persist observing session plan
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionPlan));
    } catch {
      // Ignore storage quota errors
    }
  }, [sessionPlan]);

  // Persist Equipment Locker locally
  useEffect(() => {
    try {
      localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equipmentLocker));
    } catch {
      // Ignore storage quota errors
    }
  }, [equipmentLocker]);

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

  const handleUnlockCenter = useCallback(() => {
    if (centerLockedRef.current) {
      centerLockedRef.current = false;
      setCenterLocked(false);
    }
  }, []);

  const handleToggleCenterLock = useCallback(() => {
    const curSel = selectedRef.current;
    if (!curSel) {
      centerLockedRef.current = false;
      setCenterLocked(false);
      return;
    }
    if (centerLockedRef.current) {
      centerLockedRef.current = false;
      setCenterLocked(false);
      return;
    }

    // Activate center-lock tracking and immediately center on the target
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

    handleChangeView((p) => ({
      ...p,
      ra: ((targetItem.data.ra / 15) % 24 + 24) % 24,
      dec: Math.max(-89.999, Math.min(89.999, targetItem.data.dec)),
      fsz: Math.min(p.fsz, targetFsz),
    }));
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

  const handleSelect = (item: SelectedItem | null) => {
    const prevId = selectedRef.current?.data.id;
    const nextId = item?.data.id;
    if (!item || nextId !== prevId) {
      centerLockedRef.current = false;
      setCenterLocked(false);
    }
    selectedRef.current = item;
    setSelected(item);
    if (item) {
      setOptics((prev) =>
        prev.showSelectionMark ? prev : { ...prev, showSelectionMark: true }
      );
      setInspectorTab('detail');
      setRightOpen(true);
    }
  };

  const handleToggleSessionItem = (item: SelectedItem) => {
    setSessionPlan((prev) => {
      const exists = prev.some((e) => e.id === item.data.id);
      if (exists) {
        return prev.filter((e) => e.id !== item.data.id);
      }
      return [
        ...prev,
        {
          id: item.data.id,
          kind: item.kind,
          addedAt: Date.now(),
          observed: false,
          notes: '',
        },
      ];
    });
  };

  const handleToggleObserved = (id: string) => {
    setSessionPlan((prev) =>
      prev.map((e) => (e.id === id ? { ...e, observed: !e.observed } : e))
    );
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    setSessionPlan((prev) => {
      const exists = prev.some((e) => e.id === id);
      if (!exists) return prev;
      return prev.map((e) => (e.id === id ? { ...e, notes } : e));
    });
  };

  const handleAddRecommendedTonight = (items: SelectedItem[]) => {
    setSessionPlan((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const additions: ObservingSessionEntry[] = items
        .filter((it) => !existingIds.has(it.data.id))
        .map((it) => ({
          id: it.data.id,
          kind: it.kind,
          addedAt: Date.now(),
          observed: false,
          notes: '',
        }));
      return [...prev, ...additions];
    });
  };

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
        if (camera?.sensorWidthMm && camera?.sensorHeightMm) {
          sensorW = Number(
            Math.max(
              0.05,
              Math.min(45, 2 * Math.atan(camera.sensorWidthMm / (2 * effFl)) * RAD2DEG)
            ).toFixed(2)
          );
          sensorH = Number(
            Math.max(
              0.05,
              Math.min(45, 2 * Math.atan(camera.sensorHeightMm / (2 * effFl)) * RAD2DEG)
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

        return {
          ...prev,
          eyepieceInputMode: 'calc',
          telescopeFocalLengthMm: Math.round(effFl),
          eyepieceFocalLengthMm: epFl,
          eyepieceAfovDeg: epAfov,
          eyepieceFovDeg: Number(tfov.toFixed(2)),
          eyepieceLabel: eyepiece ? labelParts.join(' · ') : prev.eyepieceLabel,
          showEyepiece: shouldShowEyepiece,
          sensorWidthDeg: sensorW,
          sensorHeightDeg: sensorH,
          showSensorBox: shouldShowSensor,
        };
      });
    },
    []
  );

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

  const handleImportEquipmentLocker = useCallback(
    (imported: EquipmentLockerState) => {
      setEquipmentLocker(imported);
      applyEquipmentToOptics(imported);
    },
    [applyEquipmentToOptics]
  );

  const handleImportSkylistSession = useCallback(async (fileText: string) => {
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

    const prev = sessionPlanRef.current;
    const existingMap = new Map(prev.map((e) => [e.id, e]));
    const next = [...prev];
    let addedCount = 0;
    for (const entry of resolved.entries) {
      const existing = existingMap.get(entry.id);
      if (!existing) {
        next.push(entry);
        existingMap.set(entry.id, entry);
        addedCount++;
      } else {
        const idx = next.findIndex((x) => x.id === entry.id);
        if (idx >= 0) {
          next[idx] = {
            ...existing,
            observed: existing.observed || entry.observed,
            notes: existing.notes || entry.notes,
          };
        }
      }
    }
    sessionPlanRef.current = next;
    setSessionPlan(next);

    return {
      matchedCount: resolved.matchedCount,
      addedCount,
      totalCount: resolved.totalCount,
      unmatchedNames: resolved.unmatchedNames,
    };
  }, []);

  const handleExportSkylistSession = useCallback(() => {
    const obsMs = observerRef.current.useLiveTime
      ? Date.now()
      : observerRef.current.timestampMs;
    const snap = getCatalogSnapshot();
    const content = exportObservingListToSkylist(sessionPlan, snap, obsMs);
    const today = new Date().toISOString().slice(0, 10);
    downloadSkylistFile(content, `noxchart-observing-list-${today}.skylist`);
  }, [sessionPlan]);

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

  const handleResetToDefaults = () => {
    lockedHzRef.current = null;
    handleChangeView({ ...DEFAULT_VIEW });
    setTheme(DEFAULT_THEME);
    setLayers({
      ...DEFAULT_LAYERS,
      dsoCategories: { ...DEFAULT_LAYERS.dsoCategories },
    });
    setOptics({ ...DEFAULT_OPTICS });
    const resetObs: ObserverConfig = {
      ...DEFAULT_OBSERVER,
      timestampMs: Date.now(),
    };
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
    setSearchActive(false);
    setResetCount((c) => c + 1);
  };

  const ui = getUiTheme(theme);
  const magLimit = getLimitingMagnitude(view.fsz, layers.magOffset);
  const dsoMagLimit = getDsoLimitingMagnitude(view.fsz, layers.dsoMagOffset);

  return (
    <div
      data-theme={theme}
      className={`w-screen h-screen flex flex-col overflow-hidden ${ui.shell}`}
    >
      {/* Top Precision Telemetry Ribbon */}
      <header
        className={`no-print h-12 shrink-0 border-b px-3 flex items-center justify-between gap-3 ${ui.header}`}
      >
        {/* Left: Sidebar Toggle + Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setLeftOpen((o) => !o)}
            title={leftOpen ? '제어 패널 숨기기' : '제어 패널 열기'}
            aria-label="제어 패널 토글"
            className={`p-1.5 border transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            {leftOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
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

        {/* Right: Session Plan, URL Share, PNG Export, Print */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setInspectorTab('session');
              setRightOpen((o) => (inspectorTab === 'session' ? !o : true));
            }}
            className={`px-2.5 py-1.5 border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              rightOpen && inspectorTab === 'session' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>관측 목록 ({sessionPlan.length})</span>
          </button>

          <button
            type="button"
            onClick={handleCopyShareUrl}
            title="현재 좌표·배율 URL 복사"
            className={`px-2.5 py-1.5 border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              copiedUrl ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedUrl ? '링크 복사됨' : '좌표 공유'}</span>
          </button>

          <button
            type="button"
            onClick={() => canvasHandleRef.current?.exportPng()}
            title="성도 PNG 이미지 저장"
            className={`hidden lg:flex px-2.5 py-1.5 border text-xs font-medium items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={handlePrintWhiteChart}
            title="종이 성도 인쇄 (인쇄용 화이트 모드)"
            className={`hidden xl:flex px-2.5 py-1.5 border text-xs font-medium items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>인쇄</span>
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
            leftDrawerOpen={leftOpen}
            rightDrawerOpen={rightOpen}
            onChangeView={handleChangeView}
            onSelect={handleSelect}
            onUnlockCenter={handleUnlockCenter}
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
            onImportEquipmentLocker={handleImportEquipmentLocker}
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
              onTabChange={setInspectorTab}
              onClose={() => setRightOpen(false)}
              onSelect={handleSelect}
              onToggleCenterLock={handleToggleCenterLock}
              onToggleSolarTrail={handleToggleSolarTrail}
              onClearSolarTrails={handleClearSolarTrails}
              onChangeView={handleChangeView}
              onChangeOptics={setOptics}
              onToggleSessionItem={handleToggleSessionItem}
              onToggleObserved={handleToggleObserved}
              onUpdateNotes={handleUpdateNotes}
              onAddRecommendedTonight={handleAddRecommendedTonight}
              onImportSkylist={handleImportSkylistSession}
              onExportSkylist={handleExportSkylistSession}
            />
          )}
        </div>
      </main>
    </div>
  );
}
