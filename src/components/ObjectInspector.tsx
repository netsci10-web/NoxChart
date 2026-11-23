import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  Compass,
  Crosshair,
  Download,
  FolderPlus,
  ListChecks,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Route,
  Sparkles,
  Square,
  Star,
  Target,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { CALDWELL_CATALOG } from '../data/caldwell';
import { CatalogSnapshot } from '../data/catalogLoader';
import {
  AsterismGroup,
  AsterismLayer,
  AsterismObject,
  AsterismStoreState,
  ChallengeCheckpoint,
  ChallengeTrack,
  ChartViewState,
  EquipmentLockerState,
  ObservationLogEntry,
  ObservationLogStoreState,
  ObservationSeeingGrade,
  ObserverConfig,
  ObservingListGroup,
  ObservingSessionEntry,
  OpticsSettings,
  SavedObservingSite,
  SelectedItem,
  ThemeMode,
} from '../types/astronomy';
import {
  DEG2RAD,
  equatorialToHorizontal,
  findStarHopGuides,
  formatDec,
  formatRA,
  RAD2DEG,
  getAltitudeCurve,
  getCompassDirection,
  getDsoTypeLabel,
  getLSTDeg,
} from '../utils/astronomy';
import {
  formatCatalogCode,
  formatObjectDisplayName,
  getSecondaryDesignations,
} from '../utils/catalogNames';
import { computePlanetOrientation } from '../utils/planetRenderer';
import { getSolarSystemBodies } from '../utils/solarSystem';
import {
  buildActiveEquipmentSummary,
  formatObservationDateTime,
  fromDateTimeLocalValue,
  getSeeingLabel,
  getSelectedObjectMeta,
  SEEING_OPTIONS,
  toDateTimeLocalValue,
} from '../utils/observationLogStorage';
import { BuiltInAsterismPreset } from '../utils/asterismStorage';
import { GuidedTourState, TourStop } from '../utils/tonightTour';
import { getUiTheme } from '../utils/themeClasses';
import { AsterismPanel } from './AsterismPanel';
import { ChallengePanel } from './ChallengePanel';
import { useConfirmDialog } from './ConfirmDialog';
import { ObservationLogPanel } from './ObservationLogPanel';

interface ObjectInspectorProps {
  selected: SelectedItem | null;
  centerLocked: boolean;
  solarTrails: Record<string, number>;
  activeTab: 'detail' | 'session' | 'challenge' | 'asterism' | 'log';
  theme: ThemeMode;
  observer: ObserverConfig;
  optics: OpticsSettings;
  equipmentLocker: EquipmentLockerState;
  savedSites: SavedObservingSite[];
  catalogs: CatalogSnapshot;
  sessionPlan: ObservingSessionEntry[];
  tonightManualEntries: ObservingSessionEntry[];
  observingLists: ObservingListGroup[];
  tonightListId: string | null;
  challenges: ChallengeTrack[];
  onTabChange: (tab: 'detail' | 'session' | 'challenge' | 'asterism' | 'log') => void;
  onClose: () => void;
  onSelect: (item: SelectedItem | null) => void;
  onToggleCenterLock: () => void;
  onToggleSolarTrail: (bodyId: string) => void;
  onClearSolarTrails: () => void;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
  onChangeOptics: (updater: (prev: OpticsSettings) => OpticsSettings) => void;
  onSetTonightList: (listId: string | null) => void;
  onCreateObservingList: (name: string) => string;
  onRenameObservingList: (listId: string, newName: string) => void;
  onDeleteObservingList: (listId: string) => void | Promise<boolean>;
  onToggleSessionItem: (item: SelectedItem, targetListId?: string) => void;
  onToggleObserved: (id: string, targetListId?: string) => void;
  onUpdateNotes: (id: string, notes: string, targetListId?: string) => void;
  onAddRecommendedTonight: (items: SelectedItem[]) => void;
  onImportSkylist: (
    text: string,
    options?: { fileName?: string; targetListId?: string; makeTonight?: boolean }
  ) => Promise<{
    matchedCount: number;
    addedCount: number;
    totalCount: number;
    unmatchedNames: string[];
    listName: string;
    createdNewList: boolean;
  }>;
  onExportSkylist: (listId?: string) => void;
  challengeOpacity: number;
  onChangeChallengeOpacity: (opacity: number) => void;
  challengeLineWidth: number;
  onChangeChallengeLineWidth: (lineWidth: number) => void;
  challengeDraft: ChallengeTrack | null;
  challengeDraftIsNew: boolean;
  challengePickAllowEmpty: boolean;
  challengeDraftNotice: string | null;
  onStartCreateChallengeDraft: () => void;
  onStartEditChallengeDraft: (track: ChallengeTrack) => void;
  onChangeChallengeDraft: React.Dispatch<React.SetStateAction<ChallengeTrack | null>>;
  onCancelChallengeDraft: () => void;
  onChangeChallengePickAllowEmpty: (allow: boolean) => void;
  onClearChallengeDraftNotice: () => void;
  onAddCenterChallengeCheckpoint: () => void;
  onToggleChallengeOnChart: (trackId: string) => void;
  onToggleChallengeCheckpoint: (trackId: string, checkpointId: string) => void;
  onUpdateChallengeCheckpointNote: (trackId: string, checkpointId: string, note: string) => void;
  onSelectChallengeCheckpoint: (track: ChallengeTrack, checkpoint: ChallengeCheckpoint) => void;
  onFrameChallengeTrack: (track: ChallengeTrack) => void;
  onPrintChallengeCertificate: (track: ChallengeTrack) => void;
  onSaveChallengeTrack: (track: ChallengeTrack) => void;
  onDeleteChallengeTrack: (trackId: string) => void;
  onResetBuiltInChallenge: (trackId: string) => void;
  onImportChallenges: (tracks: ChallengeTrack[]) => { addedCount: number; updatedCount: number };
  // Guided Auto-Tour ("오늘의 투어" & Challenge Track Auto-Tour)
  tourState: GuidedTourState;
  tonightTourStops: TourStop[];
  onStartTonightTour: (startIndex?: number, selectedStopIds?: string[]) => void;
  onStartChallengeTour: (track: ChallengeTrack, startIndex?: number) => void;
  onToggleTourPlay: () => void;
  onStopTour: () => void;
  onJumpTourStop: (index: number) => void;
  onChangeTourDwellSec: (sec: number) => void;
  // Custom Asterism Layers, Groups & Presets
  asterismStore: AsterismStoreState;
  asterismMode: boolean;
  asterismSelectedId: string | null;
  onToggleAsterismMode: () => void;
  onSelectAsterism: (id: string | null) => void;
  onDeleteAsterismObject: (id: string) => void;
  onSetAsterismActiveLayer: (layerId: string) => void;
  onToggleAsterismLayerVisible: (layerId: string) => void;
  onSetAllAsterismLayersVisible: (visible: boolean) => void;
  onCreateAsterismLayer: (name: string) => void;
  onRenameAsterismLayer: (layerId: string, name: string) => void;
  onDeleteAsterismLayer: (layerId: string) => void;
  onSetActiveAsterism: (asterismId: string | null) => void;
  onOpenAsterismLayers: (asterismId: string) => void;
  onOpenAsterismShapeProps: (asterismId: string, objectId: string) => void;
  onCreateAsterismGroup: (name?: string, layerId?: string) => string;
  onUpdateAsterismGroup: (asterismId: string, patch: Partial<AsterismGroup>) => void;
  onDeleteAsterismGroup: (asterismId: string) => void;
  onToggleAsterismGroupVisible: (asterismId: string) => void;
  onFocusAsterismGroup: (grp: AsterismGroup) => void;
  onLoadAsterismPresets: () => number;
  onToggleAsterismPreset: (preset: BuiltInAsterismPreset) => boolean;
  onFocusAsterismPreset: (preset: BuiltInAsterismPreset) => void;
  onImportAsterismBundle: (
    layers: AsterismLayer[],
    asterisms: AsterismGroup[],
    objects: AsterismObject[]
  ) => { addedCount: number };
  // Observation Logbook & Observed Status
  observationLogStore: ObservationLogStoreState;
  onSaveObservationLog: (entry: ObservationLogEntry) => void;
  onDeleteObservationLog: (logId: string) => void;
  onToggleObjectObserved: (
    meta: {
      objectId: string;
      objectKind: 'star' | 'dso' | 'planet' | 'double';
      objectName: string;
      constellation?: string;
      raDeg: number;
      decDeg: number;
    },
    forceObserved?: boolean
  ) => void;
  onFocusObservationTarget: (target: {
    objectId: string;
    objectKind: 'star' | 'dso' | 'planet' | 'double';
    raDeg: number;
    decDeg: number;
  }) => void;
  onImportObservationLogs: (incoming: ObservationLogStoreState) => {
    addedLogs: number;
    updatedLogs: number;
  };
}

export function ObjectInspector({
  selected,
  centerLocked,
  solarTrails,
  activeTab,
  theme,
  observer,
  optics,
  equipmentLocker,
  savedSites,
  catalogs,
  sessionPlan,
  tonightManualEntries,
  observingLists,
  tonightListId,
  challenges,
  onTabChange,
  onClose,
  onSelect,
  onToggleCenterLock,
  onToggleSolarTrail,
  onClearSolarTrails,
  onChangeView,
  onChangeOptics,
  onSetTonightList,
  onCreateObservingList,
  onRenameObservingList,
  onDeleteObservingList,
  onToggleSessionItem,
  onToggleObserved,
  onUpdateNotes,
  onAddRecommendedTonight,
  onImportSkylist,
  onExportSkylist,
  challengeOpacity,
  onChangeChallengeOpacity,
  challengeLineWidth,
  onChangeChallengeLineWidth,
  challengeDraft,
  challengeDraftIsNew,
  challengePickAllowEmpty,
  challengeDraftNotice,
  onStartCreateChallengeDraft,
  onStartEditChallengeDraft,
  onChangeChallengeDraft,
  onCancelChallengeDraft,
  onChangeChallengePickAllowEmpty,
  onClearChallengeDraftNotice,
  onAddCenterChallengeCheckpoint,
  onToggleChallengeOnChart,
  onToggleChallengeCheckpoint,
  onUpdateChallengeCheckpointNote,
  onSelectChallengeCheckpoint,
  onFrameChallengeTrack,
  onPrintChallengeCertificate,
  onSaveChallengeTrack,
  onDeleteChallengeTrack,
  onResetBuiltInChallenge,
  onImportChallenges,
  tourState,
  tonightTourStops,
  onStartTonightTour,
  onStartChallengeTour,
  onToggleTourPlay,
  onStopTour,
  onJumpTourStop,
  onChangeTourDwellSec,
  asterismStore,
  asterismMode,
  asterismSelectedId,
  onToggleAsterismMode,
  onSelectAsterism,
  onDeleteAsterismObject,
  onSetAsterismActiveLayer,
  onToggleAsterismLayerVisible,
  onSetAllAsterismLayersVisible,
  onCreateAsterismLayer,
  onRenameAsterismLayer,
  onDeleteAsterismLayer,
  onSetActiveAsterism,
  onOpenAsterismLayers,
  onOpenAsterismShapeProps,
  onCreateAsterismGroup,
  onUpdateAsterismGroup,
  onDeleteAsterismGroup,
  onToggleAsterismGroupVisible,
  onFocusAsterismGroup,
  onLoadAsterismPresets,
  onToggleAsterismPreset,
  onFocusAsterismPreset,
  onImportAsterismBundle,
  observationLogStore,
  onSaveObservationLog,
  onDeleteObservationLog,
  onToggleObjectObserved,
  onFocusObservationTarget,
  onImportObservationLogs,
}: ObjectInspectorProps) {
  const ui = getUiTheme(theme);
  const confirmDialog = useConfirmDialog();
  const skylistInputRef = useRef<HTMLInputElement>(null);
  const pendingImportTargetRef = useRef<{ targetListId?: string; makeTonight?: boolean }>({});
  const [skylistBusy, setSkylistBusy] = useState(false);
  const [skylistNotice, setSkylistNotice] = useState<string | null>(null);
  const [sessionSubTab, setSessionSubTab] = useState<'tonight' | 'manage'>('tonight');
  const [newListName, setNewListName] = useState('');
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [expandedListIds, setExpandedListIds] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('noxchart_observing_lists_collapse_v1');
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
  });
  const [detailTargetListId, setDetailTargetListId] = useState<string>('__tonight__');
  const [recommend25Active, setRecommend25Active] = useState(false);
  const [detailLogDraft, setDetailLogDraft] = useState<{
    id: string | null;
    observedAtLocal: string;
    location: string;
    equipment: string;
    seeing: ObservationSeeingGrade;
    rating: number;
    notes: string;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('noxchart_observing_lists_collapse_v1', JSON.stringify(expandedListIds));
    } catch {
      // Ignore storage write failure
    }
  }, [expandedListIds]);

  useEffect(() => {
    setDetailLogDraft(null);
  }, [selected?.data.id]);

  useEffect(() => {
    if (
      detailTargetListId !== '__tonight__' &&
      !observingLists.some((l) => l.id === detailTargetListId)
    ) {
      setDetailTargetListId('__tonight__');
    }
  }, [detailTargetListId, observingLists]);

  const effectiveDetailListId =
    detailTargetListId === '__tonight__' ||
    observingLists.some((l) => l.id === detailTargetListId)
      ? detailTargetListId
      : '__tonight__';
  const activeTonightList = tonightListId
    ? observingLists.find((l) => l.id === tonightListId) ?? null
    : null;
  const detailTargetList =
    effectiveDetailListId === '__tonight__'
      ? null
      : observingLists.find((l) => l.id === effectiveDetailListId) ?? null;
  const manualEntryIdSet = useMemo(
    () => new Set(tonightManualEntries.map((e) => e.id)),
    [tonightManualEntries]
  );

  const obsTimeMs = observer.useLiveTime ? Date.now() : observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);

  const selectedData = selected?.data;
  const selectedAltAz = useMemo(() => {
    if (!selectedData) return null;
    return equatorialToHorizontal(selectedData.ra, selectedData.dec, lstDeg, observer.lat);
  }, [selectedData, lstDeg, observer.lat]);

  const selectedPlanetPhys = useMemo(() => {
    if (selected?.kind !== 'planet') return null;
    const bodies = getSolarSystemBodies(obsTimeMs);
    const sun = bodies.find((b) => b.id === 'Sun');
    return computePlanetOrientation(selected.data, sun, obsTimeMs)?.phys ?? null;
  }, [selected, obsTimeMs]);

  const altCurve = useMemo(() => {
    if (!selectedData) return [];
    return getAltitudeCurve(
      selectedData.ra,
      selectedData.dec,
      observer.lat,
      observer.lon,
      obsTimeMs
    );
  }, [selectedData, observer.lat, observer.lon, obsTimeMs]);

  const hopGuides = useMemo(() => {
    if (!selected) return [];
    const label =
      selected.kind === 'dso'
        ? selected.data.id
        : selected.kind === 'planet'
        ? selected.data.koName
        : selected.kind === 'double'
        ? selected.data.koName || selected.data.name || selected.data.bayer || selected.data.disc
        : selected.data.koName || selected.data.name || selected.data.bayer || selected.data.id;
    return findStarHopGuides(
      selected.data.ra,
      selected.data.dec,
      label,
      catalogs.brightStars,
      selected.kind === 'star' ? selected.data.id : undefined,
      selected.kind === 'star' ? selected.data.hip : undefined
    );
  }, [selected, catalogs.brightStars]);

  const focusHopRoute = (
    fromRa: number,
    fromDec: number,
    toRa: number,
    toDec: number,
    distDeg: number
  ) => {
    const a1 = fromRa * DEG2RAD;
    const d1 = fromDec * DEG2RAD;
    const a2 = toRa * DEG2RAD;
    const d2 = toDec * DEG2RAD;
    const mx = Math.cos(d1) * Math.cos(a1) + Math.cos(d2) * Math.cos(a2);
    const my = Math.cos(d1) * Math.sin(a1) + Math.cos(d2) * Math.sin(a2);
    const mz = Math.sin(d1) + Math.sin(d2);
    const len = Math.hypot(mx, my, mz) || 1;
    const midRaDeg = (((Math.atan2(my / len, mx / len) * RAD2DEG) + 360) % 360);
    const midDecDeg = Math.asin(Math.max(-1, Math.min(1, mz / len))) * RAD2DEG;
    onChangeOptics((p) => ({ ...p, showStarHop: true }));
    onChangeView((p) => ({
      ...p,
      ra: ((midRaDeg / 15) % 24 + 24) % 24,
      dec: midDecDeg,
      fsz: Math.max(12, Math.min(95, distDeg * 1.65)),
    }));
  };

  const sessionEntry = selected
    ? effectiveDetailListId === '__tonight__'
      ? sessionPlan.find((e) => e.id === selected.data.id)
      : detailTargetList?.entries.find((e) => e.id === selected.data.id)
    : undefined;

  const resolveEntriesList = useMemo(() => {
    const allDsos = [
      ...catalogs.dsosBright,
      ...catalogs.darkNebulae,
      ...catalogs.dsosDeep,
      ...CALDWELL_CATALOG,
    ];
    const allStars = [...catalogs.brightStars, ...catalogs.deepStars, ...catalogs.gaiaStars];
    const solarBodies = getSolarSystemBodies(obsTimeMs);
    const dsoById = new Map(allDsos.map((d) => [d.id, d] as const));
    const starById = new Map(allStars.map((s) => [s.id, s] as const));
    const doubleById = new Map(catalogs.doubleStars.map((d) => [d.id, d] as const));
    const solarById = new Map(solarBodies.map((b) => [b.id, b] as const));

    return (entries: ObservingSessionEntry[]) =>
      entries
        .map((entry) => {
          let item: SelectedItem | undefined;
          if (entry.kind === 'dso') {
            const found = dsoById.get(entry.id);
            if (found) item = { kind: 'dso', data: found };
          } else if (entry.kind === 'planet') {
            const found = solarById.get(entry.id);
            if (found) item = { kind: 'planet', data: found };
          } else if (entry.kind === 'double') {
            const found = doubleById.get(entry.id);
            if (found) item = { kind: 'double', data: found };
          } else {
            const found = starById.get(entry.id);
            if (found) item = { kind: 'star', data: found };
          }
          if (!item) return null;
          const hz = equatorialToHorizontal(item.data.ra, item.data.dec, lstDeg, observer.lat);
          return { entry, item, hz };
        })
        .filter(Boolean) as {
        entry: ObservingSessionEntry;
        item: SelectedItem;
        hz: { altDeg: number; azDeg: number };
      }[];
  }, [catalogs, lstDeg, observer.lat, obsTimeMs]);

  const resolvedSessionItems = useMemo(
    () => resolveEntriesList(sessionPlan),
    [resolveEntriesList, sessionPlan]
  );

  const groupedTonightItems = useMemo(() => {
    const above25 = resolvedSessionItems
      .filter((x) => x.hz.altDeg >= 25)
      .sort((a, b) => b.hz.altDeg - a.hz.altDeg);
    const lowAlt = resolvedSessionItems
      .filter((x) => x.hz.altDeg >= 0 && x.hz.altDeg < 25)
      .sort((a, b) => b.hz.altDeg - a.hz.altDeg);
    const belowHorizon = resolvedSessionItems
      .filter((x) => x.hz.altDeg < 0)
      .sort((a, b) => b.hz.altDeg - a.hz.altDeg);
    return {
      above25,
      lowAlt,
      belowHorizon,
      risenCount: above25.length + lowAlt.length,
    };
  }, [resolvedSessionItems]);

  const triggerSkylistFilePicker = (options: {
    targetListId?: string;
    makeTonight?: boolean;
  }) => {
    pendingImportTargetRef.current = options;
    skylistInputRef.current?.click();
  };

  const handleSkylistFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const opts = pendingImportTargetRef.current;
    setSkylistBusy(true);
    setSkylistNotice('카탈로그 로딩 및 .skylist 분석 중...');
    try {
      const text = await file.text();
      const res = await onImportSkylist(text, {
        fileName: file.name,
        targetListId: opts.targetListId,
        makeTonight: opts.makeTonight,
      });
      if (res.totalCount === 0) {
        setSkylistNotice('SkySafari 관측 대상(SkyObject)이 없는 파일입니다.');
      } else {
        const extra =
          res.unmatchedNames.length > 0
            ? ` · 미일치 ${res.unmatchedNames.length}개 (${res.unmatchedNames
                .slice(0, 2)
                .join(', ')}${res.unmatchedNames.length > 2 ? '…' : ''})`
            : '';
        setSkylistNotice(
          res.createdNewList
            ? `‘${res.listName}’ 목록 생성 (${res.matchedCount}/${res.totalCount}개 일치${extra})`
            : `‘${res.listName}’에 가져오기 완료 (${res.matchedCount}/${res.totalCount}개 · 신규 ${res.addedCount}개${extra})`
        );
      }
    } catch {
      setSkylistNotice('.skylist 파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setSkylistBusy(false);
    }
  };

  const jumpToSessionObject = (item: SelectedItem) => {
    onSelect(item);
    onTabChange('detail');
    onChangeView((p) => ({
      ...p,
      ra: ((item.data.ra / 15) % 24 + 24) % 24,
      dec: item.data.dec,
      fsz:
        item.kind === 'dso'
          ? 12
          : item.kind === 'planet'
          ? 0.08
          : item.kind === 'double'
          ? Math.max(0.08, Math.min(2.5, (item.data.sep / 3600) * 80))
          : 16,
    }));
  };

  const addBrightRecommendedTonight = () => {
    const candidates = catalogs.dsosBright
      .filter((d) => (d.id.startsWith('M') || d.mag <= 7.5) && d.mag <= 8.5)
      .map((d) => ({
        dso: d,
        alt: equatorialToHorizontal(d.ra, d.dec, lstDeg, observer.lat).altDeg,
      }))
      .filter((x) => x.alt >= 25)
      .sort((a, b) => b.alt - a.alt || a.dso.mag - b.dso.mag)
      .slice(0, 6)
      .map((x): SelectedItem => ({ kind: 'dso', data: x.dso }));
    onAddRecommendedTonight(candidates);
  };

  const handleToggleRecommend25 = () => {
    const nextActive = !recommend25Active;
    setRecommend25Active(nextActive);
    if (nextActive && sessionPlan.length === 0) {
      addBrightRecommendedTonight();
    }
  };

  // Compact SVG polyline for 24h altitude curve (tuned for 270px panel width)
  const svgW = 230;
  const svgH = 74;
  const altToY = (alt: number) => svgH / 2 - (alt / 90) * (svgH / 2 - 5);
  const horizonY = altToY(0);
  const optimalY = altToY(30);
  const curvePoints = altCurve
    .map((pt, idx) => {
      const x = (idx / Math.max(1, altCurve.length - 1)) * svgW;
      const y = altToY(pt.altDeg);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const nowPoint = altCurve.find((p) => p.offsetHours === 0);
  const nowIdx = altCurve.findIndex((p) => p.offsetHours === 0);
  const nowX = nowIdx >= 0 ? (nowIdx / Math.max(1, altCurve.length - 1)) * svgW : svgW / 2;
  const nowY = nowPoint ? altToY(nowPoint.altDeg) : horizonY;
  const maxAlt = altCurve.reduce((m, p) => (p.altDeg > m.altDeg ? p : m), {
    offsetHours: 0,
    label: '--:--',
    altDeg: -90,
  });

  const strokeColor =
    theme === 'red' ? '#EF4444' : theme === 'white' ? '#2563EB' : '#06B6D4';

  return (
    <aside
      className={`no-print w-[292px] shrink-0 h-full border-l flex flex-col overflow-hidden ${ui.panel}`}
    >
      {/* Header Tabs */}
      <div className={`flex items-center justify-between gap-1 border-b px-1.5 py-1.5 ${ui.divider}`}>
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onTabChange('detail')}
            className={`px-1.5 py-1 text-[9.5px] tracking-[-0.06em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'detail' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            천체정보
          </button>
          <button
            type="button"
            onClick={() => onTabChange('session')}
            className={`px-1.5 py-1 text-[9.5px] tracking-[-0.06em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'session' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            관측목록{sessionPlan.length > 0 ? `(${sessionPlan.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('challenge')}
            className={`px-1.5 py-1 text-[9.5px] tracking-[-0.06em] font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-0.5 ${
              activeTab === 'challenge' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <span>챌린지</span>
            {(tourState.active || challenges.some((t) => t.activeOnChart)) && (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  tourState.active ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'
                }`}
                aria-hidden="true"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('asterism')}
            title="성군 작도 그룹 · 성군 · 도형 및 대표 성군 프리셋 관리"
            className={`px-1.5 py-1 text-[9.5px] tracking-[-0.06em] font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-0.5 ${
              activeTab === 'asterism' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <span>성군작도</span>
            {asterismStore.asterisms.length > 0 && (
              <span className="font-mono text-[8.5px] tabular-nums opacity-80">
                {asterismStore.asterisms.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('log')}
            title="관측기록 관리 (일시·장비·장소·관측내용)"
            className={`px-1.5 py-1 text-[9.5px] tracking-[-0.06em] font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-0.5 ${
              activeTab === 'log' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <span>관측기록</span>
            {observationLogStore.logs.length > 0 && (
              <span className="font-mono text-[8.5px] tabular-nums opacity-80">
                {observationLogStore.logs.length}
              </span>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="패널 닫기"
          aria-label="패널 닫기"
          className={`p-1 border transition-colors shrink-0 ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto astro-scroll p-2.5 text-[11px] space-y-3">
        {activeTab === 'detail' ? (
          selected ? (
            <>
              {/* Title & Classification */}
              <div className="space-y-0.5">
                <div className={`text-[10px] font-mono tracking-[-0.04em] truncate ${ui.textMuted}`}>
                  {selected.kind === 'dso'
                    ? (() => {
                        const primaryCode = formatCatalogCode(selected.data.id) || selected.data.id;
                        const secs = getSecondaryDesignations(primaryCode, selected.data.altId);
                        return [primaryCode, ...secs, selected.data.con].filter(Boolean).join(' · ');
                      })()
                    : selected.kind === 'planet'
                    ? `${selected.data.symbol} 태양계 · ${selected.data.category}`
                    : selected.kind === 'double'
                    ? `${selected.data.disc} · ${selected.data.id}${selected.data.con ? ` · ${selected.data.con}` : ''}`
                    : `${selected.data.bayer ?? selected.data.id}${selected.data.hip ? ` · HIP ${selected.data.hip}` : ''}${selected.data.con ? ` · ${selected.data.con}` : ''}`}
                </div>
                <h2
                  className={`text-[15px] font-semibold leading-tight tracking-[-0.04em] break-keep ${ui.textPrimary}`}
                >
                  {selected.kind === 'dso'
                    ? formatObjectDisplayName(
                        selected.data.koName,
                        selected.data.name,
                        formatCatalogCode(selected.data.id) || selected.data.id
                      )
                    : selected.kind === 'planet'
                    ? formatObjectDisplayName(
                        selected.data.koName,
                        selected.data.name,
                        selected.data.id
                      )
                    : selected.kind === 'double'
                    ? formatObjectDisplayName(
                        selected.data.koName,
                        selected.data.name,
                        selected.data.bayer || selected.data.disc
                      )
                    : formatObjectDisplayName(
                        selected.data.koName,
                        selected.data.name,
                        selected.data.bayer || selected.data.id
                      )}
                </h2>
                <div className={`text-[10.5px] tracking-[-0.04em] truncate ${ui.textSecondary}`}>
                  {selected.kind === 'dso'
                    ? getDsoTypeLabel(selected.data.type)
                    : selected.kind === 'planet'
                    ? selected.data.category
                    : selected.kind === 'double'
                    ? selected.data.isMultiple
                      ? `다중성 (Multiple Star · ${selected.data.compCount}구성성)`
                      : '이중성 (Double Star · 2구성성)'
                    : '항성 (Fixed Star)'}
                </div>
              </div>

              {/* Action Row: 시야중심 | 선택마크 | 목록추가 */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={onToggleCenterLock}
                  title={
                    centerLocked
                      ? '시야 중심 추적 중 (클릭 또는 하늘 배경 클릭 시 해제)'
                      : '시야 중심 고정 (시간 가속 시 자동 추적)'
                  }
                  className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 ${
                    centerLocked ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  <Crosshair className="w-3 h-3 shrink-0" />
                  <span>시야 중심</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChangeOptics((p) => ({ ...p, showSelectionMark: !p.showSelectionMark }))
                  }
                  title={optics.showSelectionMark ? '선택 마크 숨기기' : '선택 마크 표시'}
                  className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 ${
                    optics.showSelectionMark ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  <Target className="w-3 h-3 shrink-0" />
                  <span>선택 마크</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSessionItem(selected, effectiveDetailListId)}
                  title={
                    sessionEntry
                      ? `‘${
                          effectiveDetailListId === '__tonight__'
                            ? '오늘 밤 관측목록'
                            : detailTargetList?.name ?? '관측 목록'
                        }’에서 제거`
                      : `‘${
                          effectiveDetailListId === '__tonight__'
                            ? '오늘 밤 관측목록'
                            : detailTargetList?.name ?? '관측 목록'
                        }’에 추가`
                  }
                  className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 ${
                    sessionEntry ? ui.buttonActive : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  {sessionEntry ? (
                    <>
                      <BookmarkCheck className="w-3 h-3 shrink-0" />
                      <span>저장됨</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3 h-3 shrink-0" />
                      <span>목록 추가</span>
                    </>
                  )}
                </button>
              </div>

              {/* Target Observing List Category Selector (Tonight vs Managed Lists) */}
              {observingLists.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] tracking-[-0.05em] whitespace-nowrap shrink-0 ${ui.textMuted}`}
                  >
                    대상 목록
                  </span>
                  <select
                    value={effectiveDetailListId}
                    onChange={(e) => setDetailTargetListId(e.target.value)}
                    aria-label="대상을 담을 관측 목록 선택"
                    className={`flex-1 min-w-0 px-1.5 py-1 border text-[10px] truncate ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  >
                    <option value="__tonight__">
                      ★ 오늘 밤 관측목록 ({sessionPlan.length})
                      {sessionPlan.some((e) => e.id === selected.data.id) ? ' ✓' : ''}
                    </option>
                    {observingLists.map((list) => {
                      const hasItem = list.entries.some((e) => e.id === selected.data.id);
                      const isTonight = list.id === tonightListId;
                      return (
                        <option key={list.id} value={list.id}>
                          {isTonight ? '[오늘관측] ' : ''}
                          {list.name} ({list.entries.length})
                          {hasItem ? ' ✓' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Solar System 10-Day Forward Trajectory Button */}
              {selected.kind === 'planet' && (() => {
                const trailStartMs = solarTrails[selected.data.id];
                const isTrailActive = trailStartMs !== undefined;
                const activeTrailCount = Object.keys(solarTrails).length;
                const rangeText = (() => {
                  const baseMs = isTrailActive ? trailStartMs : Date.now();
                  const d0 = new Date(baseMs);
                  const d10 = new Date(baseMs + 10 * 86400000);
                  return `${d0.getMonth() + 1}/${d0.getDate()}~${d10.getMonth() + 1}/${d10.getDate()}`;
                })();
                return (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleSolarTrail(selected.data.id)}
                      title={
                        isTrailActive
                          ? `오늘 기준 10일간 궤적(${rangeText}) 숨기기`
                          : `오늘 날짜 기준으로 앞으로 10일간(${rangeText})의 궤적과 매일 날짜 라벨 표시`
                      }
                      className={`flex-1 py-1.5 px-2 border text-[10.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                        isTrailActive ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '5px' }}
                    >
                      <Route className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isTrailActive ? `궤적 표시 중 (${rangeText})` : `궤적 그리기 (10일 · ${rangeText})`}
                      </span>
                    </button>
                    {activeTrailCount > 0 && (
                      <button
                        type="button"
                        onClick={onClearSolarTrails}
                        title="표시된 모든 궤적 지우기"
                        className={`py-1.5 px-2 border text-[10px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 transition-colors ${ui.buttonIdle}`}
                        style={{ borderRadius: '5px' }}
                      >
                        지우기
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Precision Telemetry Grid */}
              <div
                className={`border divide-y text-[10.5px] ${ui.border} ${ui.divider}`}
                style={{ borderRadius: '6px' }}
              >
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                    적경 RA
                  </span>
                  <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                    {formatRA(selected.data.ra)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                    적위 Dec
                  </span>
                  <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                    {formatDec(selected.data.dec)}
                  </span>
                </div>
                {selectedAltAz && (
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                      고도 / 방위
                    </span>
                    <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                      {selectedAltAz.altDeg.toFixed(1)}° / {selectedAltAz.azDeg.toFixed(0)}°(
                      {getCompassDirection(selectedAltAz.azDeg)})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                    겉보기 등급
                  </span>
                  <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right">
                    {selected.data.mag.toFixed(2)}m
                  </span>
                </div>
                {selected.kind === 'dso' ? (
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                      시직경 / PA
                    </span>
                    <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                      {selected.data.majAx.toFixed(1)}′×{selected.data.minAx.toFixed(1)}′ · {selected.data.pa}°
                    </span>
                  </div>
                ) : selected.kind === 'planet' ? (
                  <>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                        지구 거리
                      </span>
                      <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                        {selected.data.id === 'Moon'
                          ? `${Math.round(selected.data.distAu * 149597870.7).toLocaleString()} km`
                          : `${selected.data.distAu.toFixed(3)} AU`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                        위상 / 이각
                      </span>
                      <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                        {selected.data.phasePct}% · {selected.data.elongationDeg.toFixed(1)}°
                      </span>
                    </div>
                    {selectedPlanetPhys && (
                      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                        <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                          {selectedPlanetPhys.hasRings ? '고리 / 자전축' : '자전축 PA / B'}
                        </span>
                        <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                          {selectedPlanetPhys.hasRings
                            ? `${selectedPlanetPhys.ringTiltDeg >= 0 ? '+' : ''}${selectedPlanetPhys.ringTiltDeg.toFixed(1)}° · PA ${selectedPlanetPhys.northPolePaDeg.toFixed(0)}°`
                            : `PA ${selectedPlanetPhys.northPolePaDeg.toFixed(0)}° · ${selectedPlanetPhys.subEarthLatDeg >= 0 ? '+' : ''}${selectedPlanetPhys.subEarthLatDeg.toFixed(1)}°`}
                        </span>
                      </div>
                    )}
                  </>
                ) : selected.kind === 'double' ? (
                  <>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                        주성 / 동반성
                      </span>
                      <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                        {selected.data.mag1.toFixed(2)}m / {selected.data.mag2.toFixed(2)}m (Δ
                        {Math.abs(selected.data.mag2 - selected.data.mag1).toFixed(1)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                        이격각(ρ) / PA(θ)
                      </span>
                      <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                        {selected.data.sep.toFixed(1)}″ · {selected.data.pa}° ({selected.data.lastYear})
                      </span>
                    </div>
                    {selected.data.spec && (
                      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                        <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                          분광형
                        </span>
                        <span className="font-mono text-[10px] tracking-[-0.04em] text-right truncate">
                          {selected.data.spec}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                      색지수 B-V
                    </span>
                    <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right">
                      {selected.data.bv.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Multiple Star Component Pairs Breakdown */}
              {selected.kind === 'double' && selected.data.pairs && selected.data.pairs.length > 1 && (
                <div className={`border p-2 space-y-1.5 ${ui.border}`} style={{ borderRadius: '6px' }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                      구성성 페어 목록 (WDS)
                    </span>
                    <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                      {selected.data.pairs.length}쌍
                    </span>
                  </div>
                  <div className={`divide-y ${ui.divider} font-mono text-[10px] tabular-nums`}>
                    {selected.data.pairs.map((pair, idx) => (
                      <div
                        key={`${pair.comp}-${idx}`}
                        className="py-1 flex items-center justify-between gap-1"
                      >
                        <span className={`font-semibold shrink-0 ${ui.accentText}`}>
                          {pair.comp}
                        </span>
                        <span className={`truncate ${ui.textSecondary}`}>
                          {pair.mag1.toFixed(1)}/{pair.mag2.toFixed(1)}m
                        </span>
                        <span className={`shrink-0 ${ui.textMuted}`}>
                          {pair.sep.toFixed(1)}″ · {pair.pa}°
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 24-Hour Altitude Curve */}
              <div className={`border p-2 space-y-1.5 ${ui.border}`} style={{ borderRadius: '6px' }}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                    24시간 고도
                  </span>
                  <span className={`font-mono text-[9.5px] tracking-[-0.04em] tabular-nums whitespace-nowrap ${ui.textMuted}`}>
                    최고 {maxAlt.altDeg.toFixed(0)}° ({maxAlt.label})
                  </span>
                </div>
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[74px] overflow-visible">
                  {/* Optimal 30° dashed line */}
                  <line
                    x1={0}
                    y1={optimalY}
                    x2={svgW}
                    y2={optimalY}
                    stroke="currentColor"
                    strokeOpacity={0.18}
                    strokeDasharray="3 3"
                  />
                  {/* Horizon 0° line */}
                  <line
                    x1={0}
                    y1={horizonY}
                    x2={svgW}
                    y2={horizonY}
                    stroke="currentColor"
                    strokeOpacity={0.4}
                  />
                  {/* Altitude Curve */}
                  <polyline
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={1.6}
                    points={curvePoints}
                  />
                  {/* Current observation time dot */}
                  <circle cx={nowX} cy={nowY} r={3} fill={strokeColor} />
                </svg>
                <div
                  className={`flex justify-between text-[9.5px] font-mono tracking-[-0.05em] tabular-nums ${ui.textMuted}`}
                >
                  <span>-12h</span>
                  <span>0° 지평 · +30°</span>
                  <span>+12h</span>
                </div>
              </div>

              {/* Star-Hopping Guide(s) */}
              {hopGuides.length > 0 && (
                <div className={`border p-2 space-y-2 ${ui.border}`} style={{ borderRadius: '6px' }}>
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-semibold flex items-center gap-1 whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
                    >
                      <Navigation className="w-3 h-3 shrink-0" />
                      <span>
                        별 호핑{hopGuides.length > 1 ? ` (${hopGuides.length})` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeOptics((p) => ({ ...p, showStarHop: !p.showStarHop }))
                      }
                      className={`px-1.5 py-0.5 border text-[10px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${
                        optics.showStarHop ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      {optics.showStarHop ? '표시 중' : '경로 표시'}
                    </button>
                  </div>

                  <div className={`divide-y ${ui.divider}`}>
                    {hopGuides.map((guide, idx) => (
                      <div
                        key={guide.fromStar.id}
                        className={idx > 0 ? 'pt-2 mt-2 space-y-1' : 'space-y-1'}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div
                            className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums truncate ${ui.textSecondary}`}
                          >
                            {hopGuides.length > 1 ? `${idx + 1}. ` : ''}
                            <span className="font-semibold">
                              {guide.fromStar.koName || guide.fromStar.name || guide.fromStar.bayer}
                            </span>{' '}
                            ({guide.fromStar.mag.toFixed(1)}m)
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              focusHopRoute(
                                guide.fromStar.ra,
                                guide.fromStar.dec,
                                guide.toRa,
                                guide.toDec,
                                guide.distanceDeg
                              )
                            }
                            className={`px-1.5 py-0.5 border text-[9.5px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            보기
                          </button>
                        </div>
                        <div className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums ${ui.textMuted}`}>
                          이격 {guide.distanceDeg.toFixed(2)}° · PA {guide.paDeg.toFixed(0)}°
                        </div>
                        {guide.note && (
                          <div className={`text-[10px] tracking-[-0.03em] leading-snug break-keep ${ui.textMuted}`}>
                            {guide.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {hopGuides.length > 1 && selected && (
                    <button
                      type="button"
                      onClick={() => {
                        onChangeOptics((p) => ({ ...p, showStarHop: true }));
                        onChangeView((p) => ({
                          ...p,
                          ra: ((selected.data.ra / 15) % 24 + 24) % 24,
                          dec: selected.data.dec,
                          fsz: 74,
                        }));
                      }}
                      className={`w-full py-1 px-1.5 border text-[10px] tracking-[-0.05em] font-medium transition-colors ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      두 경로 한눈에 보기
                    </button>
                  )}
                </div>
              )}

              {/* Observed Status & Observation Logs for Selected Object */}
              {(() => {
                const targetMeta = getSelectedObjectMeta(selected);
                const objectLogs = observationLogStore.logs.filter(
                  (l) => l.objectId === targetMeta.objectId
                );
                const explicitStatus = observationLogStore.observedMap[targetMeta.objectId];
                const isObserved = explicitStatus
                  ? explicitStatus.observed
                  : objectLogs.length > 0 || Boolean(sessionEntry?.observed);
                const activeEquipSummary = buildActiveEquipmentSummary(equipmentLocker, optics);

                const openNewDetailLog = () => {
                  setDetailLogDraft({
                    id: null,
                    observedAtLocal: toDateTimeLocalValue(obsTimeMs),
                    location: observer.name.trim(),
                    equipment: activeEquipSummary,
                    seeing: '',
                    rating: 0,
                    notes: '',
                  });
                };

                const openEditDetailLog = (log: ObservationLogEntry) => {
                  setDetailLogDraft({
                    id: log.id,
                    observedAtLocal: toDateTimeLocalValue(log.observedAt),
                    location: log.location,
                    equipment: log.equipment,
                    seeing: log.seeing ?? '',
                    rating: log.rating ?? 0,
                    notes: log.notes,
                  });
                };

                const handleSaveDetailLog = (e: React.FormEvent) => {
                  e.preventDefault();
                  if (!detailLogDraft) return;
                  const now = Date.now();
                  const existing = detailLogDraft.id
                    ? observationLogStore.logs.find((l) => l.id === detailLogDraft.id)
                    : undefined;
                  const entry: ObservationLogEntry = {
                    id: existing?.id ?? `obslog_${now}_${Math.random().toString(36).slice(2, 7)}`,
                    objectId: targetMeta.objectId,
                    objectKind: targetMeta.objectKind,
                    objectName: targetMeta.objectName,
                    constellation: targetMeta.constellation,
                    raDeg: targetMeta.raDeg,
                    decDeg: targetMeta.decDeg,
                    observedAt: fromDateTimeLocalValue(detailLogDraft.observedAtLocal, obsTimeMs),
                    location: detailLogDraft.location.trim(),
                    equipment: detailLogDraft.equipment.trim(),
                    seeing: detailLogDraft.seeing,
                    transparency: existing?.transparency ?? '',
                    rating: detailLogDraft.rating > 0 ? detailLogDraft.rating : undefined,
                    notes: detailLogDraft.notes.trim(),
                    createdAt: existing?.createdAt ?? now,
                    updatedAt: now,
                  };
                  onSaveObservationLog(entry);
                  setDetailLogDraft(null);
                };

                return (
                  <div className={`border p-2 space-y-2 ${ui.border}`} style={{ borderRadius: '6px' }}>
                    {/* Header: Observed Toggle + Add Log Button */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`font-semibold flex items-center gap-1 whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
                      >
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span>관측 여부 · 기록</span>
                        {objectLogs.length > 0 && (
                          <span className={`font-mono text-[9.5px] ${ui.textMuted}`}>
                            ({objectLogs.length})
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => (detailLogDraft ? setDetailLogDraft(null) : openNewDetailLog())}
                        className={`px-1.5 py-0.5 border text-[9.5px] font-medium flex items-center gap-0.5 whitespace-nowrap shrink-0 transition-colors ${
                          detailLogDraft ? ui.buttonIdle : ui.buttonActive
                        }`}
                        style={{ borderRadius: '4px' }}
                      >
                        {detailLogDraft ? (
                          <>
                            <X className="w-2.5 h-2.5" />
                            <span>닫기</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-2.5 h-2.5" />
                            <span>기록 작성</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Observed Status Toggle Bar */}
                    <button
                      type="button"
                      onClick={() => onToggleObjectObserved(targetMeta, !isObserved)}
                      className={`w-full py-1.5 px-2 border text-[10.5px] font-semibold flex items-center justify-between gap-1.5 transition-colors ${
                        isObserved
                          ? theme === 'white'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                            : theme === 'red'
                            ? 'bg-[#2A0505] border-[#DC2626] text-[#FF6B6B]'
                            : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                          : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '5px' }}
                    >
                      <span className="flex items-center gap-1.5">
                        {isObserved ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        )}
                        <span>{isObserved ? '관측 완료' : '미관측 (클릭하여 완료 표시)'}</span>
                      </span>
                      {isObserved && explicitStatus?.updatedAt && (
                        <span className="font-mono text-[9px] opacity-75">
                          {formatObservationDateTime(explicitStatus.updatedAt).slice(0, 10)}
                        </span>
                      )}
                    </button>

                    {/* Inline Quick Add / Edit Observation Log Form */}
                    {detailLogDraft && (
                      <form
                        onSubmit={handleSaveDetailLog}
                        className={`border p-2 space-y-1.5 ${ui.panelMuted} ${ui.border}`}
                        style={{ borderRadius: '5px' }}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <label className={`text-[9.5px] ${ui.textMuted}`}>관측 일시</label>
                            <button
                              type="button"
                              onClick={() =>
                                setDetailLogDraft({
                                  ...detailLogDraft,
                                  observedAtLocal: toDateTimeLocalValue(Date.now()),
                                })
                              }
                              className={`text-[9px] underline underline-offset-2 ${ui.accentText}`}
                            >
                              현재 시각
                            </button>
                          </div>
                          <input
                            type="datetime-local"
                            value={detailLogDraft.observedAtLocal}
                            onChange={(e) =>
                              setDetailLogDraft({
                                ...detailLogDraft,
                                observedAtLocal: e.target.value,
                              })
                            }
                            className={`w-full px-1.5 py-1 border text-[10px] font-mono ${ui.input}`}
                            style={{ borderRadius: '4px' }}
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <label className={`text-[9.5px] ${ui.textMuted}`}>관측 장소</label>
                            {savedSites.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    setDetailLogDraft({
                                      ...detailLogDraft,
                                      location: e.target.value,
                                    });
                                  }
                                }}
                                aria-label="저장된 관측지 선택"
                                className={`max-w-[120px] px-1 py-0.5 border text-[9px] ${ui.input}`}
                                style={{ borderRadius: '4px' }}
                              >
                                <option value="">관측지 선택…</option>
                                {savedSites.map((site) => (
                                  <option key={site.id} value={site.name}>
                                    {site.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <input
                            type="text"
                            value={detailLogDraft.location}
                            onChange={(e) =>
                              setDetailLogDraft({ ...detailLogDraft, location: e.target.value })
                            }
                            placeholder="예: 강원 화천 조경철천문대"
                            className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                            style={{ borderRadius: '4px' }}
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <label className={`text-[9.5px] ${ui.textMuted}`}>사용 장비</label>
                            {activeEquipSummary && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDetailLogDraft({
                                    ...detailLogDraft,
                                    equipment: activeEquipSummary,
                                  })
                                }
                                className={`text-[9px] underline underline-offset-2 ${ui.accentText}`}
                              >
                                활성 장비
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={detailLogDraft.equipment}
                            onChange={(e) =>
                              setDetailLogDraft({ ...detailLogDraft, equipment: e.target.value })
                            }
                            placeholder="예: 150mm 뉴턴 + 25mm 아이피스"
                            className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                            style={{ borderRadius: '4px' }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-1.5">
                          <select
                            value={detailLogDraft.seeing}
                            onChange={(e) =>
                              setDetailLogDraft({
                                ...detailLogDraft,
                                seeing: e.target.value as ObservationSeeingGrade,
                              })
                            }
                            aria-label="시상 등급"
                            className={`flex-1 px-1.5 py-1 border text-[9.5px] ${ui.input}`}
                            style={{ borderRadius: '4px' }}
                          >
                            {SEEING_OPTIONS.map((opt) => (
                              <option key={opt.value || 'none'} value={opt.value}>
                                시상: {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() =>
                                  setDetailLogDraft({
                                    ...detailLogDraft,
                                    rating: detailLogDraft.rating === n ? 0 : n,
                                  })
                                }
                                className="p-0.5"
                                title={`별점 ${n}점`}
                              >
                                <Star
                                  className={`w-3 h-3 ${
                                    n <= detailLogDraft.rating
                                      ? theme === 'red'
                                        ? 'fill-red-500 text-red-500'
                                        : 'fill-amber-400 text-amber-400'
                                      : ui.textMuted
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          value={detailLogDraft.notes}
                          onChange={(e) =>
                            setDetailLogDraft({ ...detailLogDraft, notes: e.target.value })
                          }
                          placeholder="관측 소감, 보인 형태, 배율·필터 느낌 등..."
                          className={`w-full p-1.5 border text-[10px] leading-snug resize-y ${ui.input}`}
                          style={{ borderRadius: '4px' }}
                        />

                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailLogDraft(null)}
                            className={`px-2 py-1 border text-[9.5px] ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            취소
                          </button>
                          <button
                            type="submit"
                            className={`px-2 py-1 border text-[9.5px] font-semibold ${ui.buttonActive}`}
                            style={{ borderRadius: '4px' }}
                          >
                            {detailLogDraft.id ? '수정 저장' : '기록 저장'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Saved Logs for this Object */}
                    {objectLogs.length > 0 ? (
                      <div className={`divide-y ${ui.divider}`}>
                        {objectLogs.map((log) => {
                          const seeingTxt = getSeeingLabel(log.seeing);
                          return (
                            <div key={log.id} className="py-1.5 first:pt-0.5 last:pb-0 space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 font-mono text-[9.5px] tabular-nums ${ui.textSecondary}`}
                                >
                                  <Calendar className={`w-2.5 h-2.5 shrink-0 ${ui.textMuted}`} />
                                  <span>{formatObservationDateTime(log.observedAt)}</span>
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {seeingTxt && (
                                    <span className={`text-[9px] font-mono ${ui.accentText}`}>
                                      {seeingTxt}
                                    </span>
                                  )}
                                  {log.rating && log.rating > 0 ? (
                                    <span
                                      className={`text-[9px] ${
                                        theme === 'red' ? 'text-red-400' : 'text-amber-400'
                                      }`}
                                    >
                                      {'★'.repeat(log.rating)}
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => openEditDetailLog(log)}
                                    title="기록 수정"
                                    className={`p-0.5 ${ui.textMuted} hover:opacity-100`}
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteObservationLog(log.id)}
                                    title="기록 삭제"
                                    className={`p-0.5 ${ui.textMuted} hover:text-rose-400`}
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                              {(log.location || log.equipment) && (
                                <div className={`space-y-0.5 text-[9.5px] ${ui.textMuted}`}>
                                  {log.location && (
                                    <div className="flex items-center gap-1 min-w-0">
                                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate">{log.location}</span>
                                    </div>
                                  )}
                                  {log.equipment && (
                                    <div className="flex items-center gap-1 min-w-0">
                                      <Wrench className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate">{log.equipment}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {log.notes && (
                                <p
                                  className={`text-[10px] leading-snug whitespace-pre-wrap break-keep ${ui.textPrimary}`}
                                >
                                  {log.notes}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      !detailLogDraft && (
                        <p className={`text-[10px] leading-snug break-keep ${ui.textMuted}`}>
                          아직 기록이 없습니다. ‘기록 작성’을 눌러 일시·장소·장비·관측 내용을 남겨보세요.
                        </p>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => onTabChange('log')}
                      className={`w-full py-1 px-1.5 border text-[9.5px] tracking-[-0.04em] font-medium transition-colors ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      전체 관측기록 탭에서 관리 ({observationLogStore.logs.length}건) →
                    </button>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className={`py-10 px-1 text-center space-y-2 ${ui.textMuted}`}>
              <Compass className="w-6 h-6 mx-auto opacity-50" />
              <div className={`font-medium tracking-[-0.05em] ${ui.textSecondary}`}>
                선택된 천체가 없습니다
              </div>
              <p className="text-[10.5px] tracking-[-0.04em] leading-relaxed break-keep">
                성도 위의 별·행성·DSO를 클릭하면 좌표, 고도 곡선, 호핑 경로를 확인할 수 있습니다.
              </p>
            </div>
          )
        ) : activeTab === 'challenge' ? (
          <ChallengePanel
            tracks={challenges}
            theme={theme}
            observer={observer}
            catalogs={catalogs}
            challengeOpacity={challengeOpacity}
            onChangeChallengeOpacity={onChangeChallengeOpacity}
            challengeLineWidth={challengeLineWidth}
            onChangeChallengeLineWidth={onChangeChallengeLineWidth}
            draft={challengeDraft}
            isCreatingDraft={challengeDraftIsNew}
            pickAllowEmpty={challengePickAllowEmpty}
            draftNotice={challengeDraftNotice}
            onStartCreateDraft={onStartCreateChallengeDraft}
            onStartEditDraft={onStartEditChallengeDraft}
            onChangeDraft={onChangeChallengeDraft}
            onCancelDraft={onCancelChallengeDraft}
            onChangePickAllowEmpty={onChangeChallengePickAllowEmpty}
            onClearDraftNotice={onClearChallengeDraftNotice}
            onAddCenterCheckpoint={onAddCenterChallengeCheckpoint}
            onToggleTrackOnChart={onToggleChallengeOnChart}
            onToggleCheckpoint={onToggleChallengeCheckpoint}
            onUpdateCheckpointNote={onUpdateChallengeCheckpointNote}
            onSelectCheckpoint={onSelectChallengeCheckpoint}
            onFrameTrack={onFrameChallengeTrack}
            onPrintCertificate={onPrintChallengeCertificate}
            onSaveTrack={onSaveChallengeTrack}
            onDeleteTrack={onDeleteChallengeTrack}
            onResetBuiltInTrack={onResetBuiltInChallenge}
            onImportTracks={onImportChallenges}
            tourState={tourState}
            tonightTourStops={tonightTourStops}
            onStartTonightTour={onStartTonightTour}
            onStartChallengeTour={onStartChallengeTour}
            onToggleTourPlay={onToggleTourPlay}
            onStopTour={onStopTour}
            onJumpTourStop={onJumpTourStop}
            onChangeTourDwellSec={onChangeTourDwellSec}
          />
        ) : activeTab === 'asterism' ? (
          <AsterismPanel
            theme={theme}
            store={asterismStore}
            asterismMode={asterismMode}
            selectedObjectId={asterismSelectedId}
            onToggleAsterismMode={onToggleAsterismMode}
            onSelectObject={onSelectAsterism}
            onDeleteObject={onDeleteAsterismObject}
            onSetActiveLayer={onSetAsterismActiveLayer}
            onToggleLayerVisible={onToggleAsterismLayerVisible}
            onSetAllLayersVisible={onSetAllAsterismLayersVisible}
            onCreateLayer={onCreateAsterismLayer}
            onRenameLayer={onRenameAsterismLayer}
            onDeleteLayer={onDeleteAsterismLayer}
            onSetActiveAsterism={onSetActiveAsterism}
            onOpenAsterismLayers={onOpenAsterismLayers}
            onOpenShapeProperties={onOpenAsterismShapeProps}
            onCreateAsterismGroup={onCreateAsterismGroup}
            onUpdateAsterismGroup={onUpdateAsterismGroup}
            onDeleteAsterismGroup={onDeleteAsterismGroup}
            onToggleAsterismGroupVisible={onToggleAsterismGroupVisible}
            onFocusAsterismGroup={onFocusAsterismGroup}
            onImportBundle={onImportAsterismBundle}
          />
        ) : activeTab === 'log' ? (
          <ObservationLogPanel
            theme={theme}
            selected={selected}
            observer={observer}
            optics={optics}
            equipmentLocker={equipmentLocker}
            savedSites={savedSites}
            store={observationLogStore}
            onSaveLog={onSaveObservationLog}
            onDeleteLog={onDeleteObservationLog}
            onToggleObservedStatus={onToggleObjectObserved}
            onFocusTarget={onFocusObservationTarget}
            onImportStore={onImportObservationLogs}
          />
        ) : (
          /* Observing Session Plan Tab: 오늘 밤 관측목록 / 목록관리 */
          <div className="space-y-2.5">
            {/* Shared hidden .skylist file input */}
            <input
              ref={skylistInputRef}
              type="file"
              accept=".skylist,.txt"
              className="hidden"
              onChange={handleSkylistFileChange}
            />

            {/* Sub-Tabs: 오늘 밤 관측목록 | 목록관리 */}
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setSessionSubTab('tonight')}
                className={`py-1.5 px-1.5 border text-[10.5px] tracking-[-0.05em] font-semibold flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                  sessionSubTab === 'tonight' ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
              >
                <Star className="w-3 h-3 shrink-0" />
                <span>오늘 밤 관측목록</span>
              </button>
              <button
                type="button"
                onClick={() => setSessionSubTab('manage')}
                className={`py-1.5 px-1.5 border text-[10.5px] tracking-[-0.05em] font-semibold flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                  sessionSubTab === 'manage' ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
              >
                <ListChecks className="w-3 h-3 shrink-0" />
                <span>목록관리 ({observingLists.length})</span>
              </button>
            </div>

            {skylistNotice && (
              <div
                className={`px-2 py-1.5 border text-[10px] tracking-[-0.04em] leading-snug break-keep flex items-start justify-between gap-1 ${ui.border} ${ui.accentText}`}
                style={{ borderRadius: '4px' }}
              >
                <span>{skylistNotice}</span>
                <button
                  type="button"
                  onClick={() => setSkylistNotice(null)}
                  className="shrink-0 opacity-70 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {sessionSubTab === 'tonight' ? (
              /* Sub-tab 1: 오늘 밤 관측목록 (Always displays the single checked tonight list) */
              <div className="space-y-2">
                {/* Active Tonight List Banner */}
                <div
                  className={`border px-2 py-1.5 space-y-1 ${ui.border}`}
                  style={{ borderRadius: '6px' }}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <CheckSquare
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeTonightList ? ui.accentText : ui.textMuted
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold truncate tracking-[-0.04em] ${ui.textPrimary}`}
                        title={
                          activeTonightList
                            ? `연동 목록: ${activeTonightList.name}`
                            : '직접 추가한 대상만 표시 중'
                        }
                      >
                        {activeTonightList ? activeTonightList.name : '직접 추가 목록'}
                      </span>
                    </div>
                    {activeTonightList ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSetTonightList(null)}
                          title="연동된 오늘 관측 목록을 해제하고 직접 추가한 대상만 남깁니다"
                          className={`px-1.5 py-0.5 border text-[9.5px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                          style={{ borderRadius: '4px' }}
                        >
                          연동 해제
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSessionSubTab('manage')}
                        className={`px-1.5 py-0.5 border text-[9.5px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                        style={{ borderRadius: '4px' }}
                      >
                        목록 연동
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono tabular-nums">
                    <span className={ui.textMuted}>
                      전체 {sessionPlan.length}
                      {activeTonightList && (
                        <>
                          {' '}
                          (직접 {tonightManualEntries.length} · 목록{' '}
                          {Math.max(0, sessionPlan.length - tonightManualEntries.length)})
                        </>
                      )}{' '}
                      · 출현 {groupedTonightItems.risenCount}
                    </span>
                    <span className={ui.accentText}>
                      완료 {sessionPlan.filter((e) => e.observed).length}/{sessionPlan.length}
                    </span>
                  </div>
                </div>

                {/* Quick Actions: 25°+ 추천 | 파일 불러오기 | 내보내기 */}
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    aria-pressed={recommend25Active}
                    onClick={handleToggleRecommend25}
                    title={
                      recommend25Active
                        ? '고도 25° 이상 추천 구분 보기 해제'
                        : '고도 25° 이상 추천 대상 / 저고도 / 지평 아래로 목록 구분 표시 (빈 목록이면 밝은 천체 자동 추가)'
                    }
                    className={`py-1 px-1 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-0.5 whitespace-nowrap transition-colors ${
                      recommend25Active ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>25°+ 추천</span>
                  </button>
                  <button
                    type="button"
                    disabled={skylistBusy}
                    onClick={() => triggerSkylistFilePicker({ makeTonight: true })}
                    title="SkySafari .skylist 파일을 파일명 그대로 목록관리에 등록하고 오늘 관측으로 연동"
                    className={`py-1 px-1 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-0.5 whitespace-nowrap ${ui.buttonIdle} ${
                      skylistBusy ? 'opacity-50 cursor-wait' : ''
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    <Upload className="w-3 h-3 shrink-0" />
                    <span>불러오기</span>
                  </button>
                  <button
                    type="button"
                    disabled={sessionPlan.length === 0}
                    onClick={() => {
                      onExportSkylist('__tonight__');
                      setSkylistNotice(
                        `‘오늘 밤 관측목록’ .skylist 저장 완료 (${sessionPlan.length}개)`
                      );
                    }}
                    title="오늘 밤 관측목록을 SkySafari 호환 .skylist 파일로 내보내기"
                    className={`py-1 px-1 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-0.5 whitespace-nowrap ${
                      sessionPlan.length === 0
                        ? `${ui.buttonIdle} opacity-45 cursor-not-allowed`
                        : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    <Download className="w-3 h-3 shrink-0" />
                    <span>내보내기</span>
                  </button>
                </div>

                {resolvedSessionItems.length === 0 ? (
                  <div
                    className={`border p-4 text-center space-y-1.5 ${ui.border} ${ui.textMuted}`}
                    style={{ borderRadius: '6px' }}
                  >
                    <div className="tracking-[-0.04em]">오늘 밤 목록에 저장된 대상이 없습니다.</div>
                    <p className="text-[10px] tracking-[-0.04em] leading-snug break-keep">
                      성도에서 천체를 클릭해 직접 추가하거나, 목록관리에서 원하는 목록의 ‘오늘 관측’을 체크해 연동하세요.
                    </p>
                  </div>
                ) : (() => {
                  const renderTonightRow = (
                    {
                      entry,
                      item,
                      hz,
                    }: {
                      entry: ObservingSessionEntry;
                      item: SelectedItem;
                      hz: { altDeg: number; azDeg: number };
                    },
                    highlightRecommended = false
                  ) => {
                    const isBelowHorizon = hz.altDeg < 0;
                    const isManual = manualEntryIdSet.has(entry.id);
                    const title =
                      item.kind === 'dso'
                        ? (() => {
                            const displayName = formatObjectDisplayName(
                              item.data.koName,
                              item.data.name
                            );
                            return `${formatCatalogCode(item.data.id) || item.data.id}${
                              displayName ? ` · ${displayName}` : ''
                            }`;
                          })()
                        : item.kind === 'double'
                        ? `${formatObjectDisplayName(
                            item.data.koName,
                            item.data.name,
                            item.data.bayer || item.data.disc
                          )} (${item.data.sep.toFixed(1)}″)`
                        : formatObjectDisplayName(
                            item.data.koName,
                            item.data.name,
                            item.data.id
                          );

                    const rowBgClass = isBelowHorizon
                      ? theme === 'white'
                        ? 'bg-slate-100/85'
                        : theme === 'red'
                        ? 'bg-[#090101]'
                        : 'bg-slate-900/55'
                      : '';
                    const titleColorClass = isBelowHorizon
                      ? theme === 'white'
                        ? 'text-slate-400'
                        : theme === 'red'
                        ? 'text-[#7F1D1D]'
                        : 'text-slate-500'
                      : ui.textPrimary;
                    const metaColorClass = isBelowHorizon
                      ? theme === 'white'
                        ? 'text-slate-400'
                        : theme === 'red'
                        ? 'text-[#5C1111]'
                        : 'text-slate-600'
                      : ui.textMuted;

                    return (
                      <div
                        key={entry.id}
                        className={`p-2 flex items-start gap-1.5 transition-colors ${rowBgClass}`}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleObserved(entry.id, '__tonight__')}
                          title={entry.observed ? '관측 완료 취소' : '관측 완료 표시'}
                          className={`mt-0.5 shrink-0 ${isBelowHorizon ? 'opacity-45' : ''}`}
                        >
                          {entry.observed ? (
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                isBelowHorizon ? metaColorClass : ui.accentText
                              }`}
                            />
                          ) : (
                            <Circle className={`w-3.5 h-3.5 ${metaColorClass}`} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => jumpToSessionObject(item)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className={`text-[11px] tracking-[-0.04em] font-medium truncate ${
                                entry.observed ? 'line-through opacity-60 ' : ''
                              }${titleColorClass}`}
                            >
                              {title}
                            </span>
                            {activeTonightList && isManual && (
                              <span
                                className={`text-[8.5px] font-mono px-1 py-0 border shrink-0 leading-tight ${
                                  isBelowHorizon
                                    ? `${ui.border} ${metaColorClass}`
                                    : `${ui.border} ${ui.accentText}`
                                }`}
                                style={{ borderRadius: '3px' }}
                                title="오늘 밤 관측목록에 직접 추가한 대상 (목록관리 미반영)"
                              >
                                직접
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[9.5px] font-mono tracking-[-0.04em] tabular-nums truncate ${metaColorClass}`}
                          >
                            {item.data.mag.toFixed(1)}m ·{' '}
                            <span
                              className={
                                highlightRecommended && !isBelowHorizon
                                  ? `${ui.accentText} font-semibold`
                                  : ''
                              }
                            >
                              고도 {hz.altDeg.toFixed(1)}°({getCompassDirection(hz.azDeg)})
                            </span>
                            {isBelowHorizon && ' · 지평 아래'}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: isManual ? '관측목록 항목 제거' : '오늘 밤 목록에서 숨기기',
                              message: isManual
                                ? `‘${title}’을(를) 오늘 밤 관측목록에서 제거하시겠습니까?`
                                : `‘${title}’을(를) 오늘 밤 관측목록에서 제거하시겠습니까?`,
                              detail: isManual
                                ? undefined
                                : '목록관리의 원본 목록에는 그대로 유지됩니다.',
                              confirmLabel: '제거',
                            });
                            if (ok) onToggleSessionItem(item, '__tonight__');
                          }}
                          title={
                            isManual
                              ? '오늘 밤 관측목록에서 제거'
                              : '오늘 밤 관측목록에서만 숨기기 (목록관리 원본 유지)'
                          }
                          className={`p-0.5 ${metaColorClass} hover:opacity-80 shrink-0 ${
                            isBelowHorizon ? 'opacity-50' : ''
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  };

                  if (!recommend25Active) {
                    return (
                      <div
                        className={`border divide-y overflow-hidden ${ui.border} ${ui.divider}`}
                        style={{ borderRadius: '6px' }}
                      >
                        {resolvedSessionItems.map((row) => renderTonightRow(row, false))}
                      </div>
                    );
                  }

                  const recCardBorder =
                    theme === 'white'
                      ? 'border-blue-500/55'
                      : theme === 'red'
                      ? 'border-[#B91C1C]'
                      : 'border-cyan-500/55';
                  const recHeaderCls =
                    theme === 'white'
                      ? 'bg-blue-50/90 text-blue-700 border-b border-blue-200'
                      : theme === 'red'
                      ? 'bg-[#240505] text-[#FF5C5C] border-b border-[#5C1111]'
                      : 'bg-cyan-950/45 text-cyan-300 border-b border-cyan-500/35';
                  const lowHeaderCls =
                    theme === 'white'
                      ? 'bg-slate-50 text-slate-600 border-b border-slate-200'
                      : theme === 'red'
                      ? 'bg-[#150202] text-[#DC2626] border-b border-[#3F0A0A]'
                      : 'bg-slate-800/40 text-slate-300 border-b border-slate-800/80';
                  const belowCardBorder =
                    theme === 'white'
                      ? 'border-slate-200'
                      : theme === 'red'
                      ? 'border-[#3F0A0A]'
                      : 'border-slate-800/70';
                  const belowHeaderCls =
                    theme === 'white'
                      ? 'bg-slate-100 text-slate-500 border-b border-slate-200'
                      : theme === 'red'
                      ? 'bg-[#0E0101] text-[#7F1D1D] border-b border-[#3F0A0A]'
                      : 'bg-slate-900/85 text-slate-500 border-b border-slate-800/70';

                  return (
                    <div className="space-y-2">
                      {/* Section 1: 25°+ Recommended Targets */}
                      <div
                        className={`border overflow-hidden ${recCardBorder}`}
                        style={{ borderRadius: '6px' }}
                      >
                        <div
                          className={`px-2 py-1.5 flex items-center justify-between gap-1 text-[10px] font-semibold tracking-[-0.04em] ${recHeaderCls}`}
                        >
                          <span className="flex items-center gap-1 min-w-0 truncate">
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>고도 25° 이상 추천</span>
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {groupedTonightItems.above25.length}개
                          </span>
                        </div>
                        {groupedTonightItems.above25.length === 0 ? (
                          <div className={`p-2.5 text-center space-y-1.5 ${ui.textMuted}`}>
                            <div className="text-[10px] tracking-[-0.04em]">
                              현재 고도 25° 이상인 대상이 없습니다.
                            </div>
                            <button
                              type="button"
                              onClick={addBrightRecommendedTonight}
                              className={`px-2 py-1 border text-[9.5px] font-medium tracking-[-0.04em] inline-flex items-center gap-1 ${ui.buttonIdle}`}
                              style={{ borderRadius: '4px' }}
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>밝은 25°+ 추천 천체 추가</span>
                            </button>
                          </div>
                        ) : (
                          <div className={`divide-y ${ui.divider}`}>
                            {groupedTonightItems.above25.map((row) => renderTonightRow(row, true))}
                          </div>
                        )}
                      </div>

                      {/* Section 2: Low-altitude risen targets (0° ~ 25°) */}
                      {groupedTonightItems.lowAlt.length > 0 && (
                        <div
                          className={`border overflow-hidden ${ui.border}`}
                          style={{ borderRadius: '6px' }}
                        >
                          <div
                            className={`px-2 py-1.5 flex items-center justify-between gap-1 text-[10px] font-semibold tracking-[-0.04em] ${lowHeaderCls}`}
                          >
                            <span>지평 위 · 25° 미만</span>
                            <span className="font-mono tabular-nums shrink-0">
                              {groupedTonightItems.lowAlt.length}개
                            </span>
                          </div>
                          <div className={`divide-y ${ui.divider}`}>
                            {groupedTonightItems.lowAlt.map((row) => renderTonightRow(row, false))}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Below-horizon targets (< 0°) */}
                      {groupedTonightItems.belowHorizon.length > 0 && (
                        <div
                          className={`border overflow-hidden ${belowCardBorder}`}
                          style={{ borderRadius: '6px' }}
                        >
                          <div
                            className={`px-2 py-1.5 flex items-center justify-between gap-1 text-[10px] font-semibold tracking-[-0.04em] ${belowHeaderCls}`}
                          >
                            <span>현재 뜨지 않은 대상 (지평 아래)</span>
                            <span className="font-mono tabular-nums shrink-0">
                              {groupedTonightItems.belowHorizon.length}개
                            </span>
                          </div>
                          <div className={`divide-y ${ui.divider}`}>
                            {groupedTonightItems.belowHorizon.map((row) =>
                              renderTonightRow(row, false)
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Sub-tab 2: 목록관리 (Create, Rename, Delete, Import per list or as new file list, Single-check 오늘 관측 대상) */
              <div className="space-y-2.5">
                {/* Create New List Form */}
                <div
                  className={`border p-2 space-y-1.5 ${ui.border}`}
                  style={{ borderRadius: '6px' }}
                >
                  <div className={`text-[10px] font-semibold tracking-[-0.04em] ${ui.textPrimary}`}>
                    새 대상 목록 만들기
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newListName.trim()) {
                          const createdName = newListName.trim();
                          onCreateObservingList(createdName);
                          setNewListName('');
                          setSkylistNotice(`‘${createdName}’ 목록이 생성되었습니다. 아래에서 대상 파일을 가져오거나 천체를 추가하세요.`);
                        }
                      }}
                      placeholder="예: 메시에 대상, 봄철 은하..."
                      className={`flex-1 min-w-0 px-2 py-1 border text-[10.5px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const createdName =
                          newListName.trim() || `관측 목록 ${observingLists.length + 1}`;
                        onCreateObservingList(createdName);
                        setNewListName('');
                        setSkylistNotice(`‘${createdName}’ 목록이 생성되었습니다.`);
                      }}
                      title="새 목록 생성"
                      className={`px-2 py-1 border text-[10px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${ui.buttonActive}`}
                      style={{ borderRadius: '4px' }}
                    >
                      <FolderPlus className="w-3 h-3 shrink-0" />
                      <span>생성</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={skylistBusy}
                    onClick={() => triggerSkylistFilePicker({ makeTonight: false })}
                    title="SkySafari .skylist 파일을 불러와 파일명으로 새 목록 자동 생성"
                    className={`w-full py-1 px-2 border text-[10px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1.5 whitespace-nowrap ${ui.buttonIdle} ${
                      skylistBusy ? 'opacity-50 cursor-wait' : ''
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    <Upload className="w-3 h-3 shrink-0" />
                    <span>.skylist 파일명으로 새 목록 불러오기</span>
                  </button>
                </div>

                {/* Help note about single tonight check */}
                <div className={`text-[9.5px] leading-snug tracking-[-0.04em] px-0.5 ${ui.textMuted}`}>
                  ‘오늘 관측’은 <span className={ui.accentText}>한 개의 목록만</span> 활성화할 수 있으며, 체크 시 해당 목록이 <strong className={ui.textSecondary}>오늘 밤 관측목록</strong>에 반영됩니다. 해제하면 반영된 항목만 사라지고 직접 추가한 대상은 유지됩니다.
                </div>

                {/* Categorized Observing Lists */}
                {observingLists.length === 0 ? (
                  <div
                    className={`border p-4 text-center space-y-1 ${ui.border} ${ui.textMuted}`}
                    style={{ borderRadius: '6px' }}
                  >
                    <div className="text-[10.5px] tracking-[-0.04em]">등록된 관리 목록이 없습니다.</div>
                    <p className="text-[9.5px] tracking-[-0.04em] leading-snug break-keep">
                      위에서 새 목록을 생성하거나 .skylist 파일을 불러오세요.
                    </p>
                  </div>
                ) : (
                <div className="space-y-2">
                  {observingLists.map((list) => {
                    const isTonight = list.id === tonightListId;
                    const isRenaming = renamingListId === list.id;
                    const isExpanded = Boolean(expandedListIds[list.id]);
                    const previewItems = isExpanded ? resolveEntriesList(list.entries) : [];

                    return (
                      <div
                        key={list.id}
                        className={`border transition-colors ${
                          isTonight
                            ? theme === 'white'
                              ? 'border-blue-500/70 bg-blue-50/40'
                              : theme === 'red'
                              ? 'border-red-500/70 bg-red-950/30'
                              : 'border-cyan-500/60 bg-cyan-950/20'
                            : ui.border
                        }`}
                        style={{ borderRadius: '6px' }}
                      >
                        <div className="p-2 space-y-1.5">
                          {/* Row 1: Single Tonight Toggle Check + List Name / Inline Rename */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => onSetTonightList(list.id)}
                              title={
                                isTonight
                                  ? '클릭하여 오늘 관측 연동 해제 (직접 추가 대상만 유지)'
                                  : '이 목록을 오늘 밤 관측목록에 반영 (단 1개만 활성화)'
                              }
                              aria-label={`${list.name} 오늘 관측 연동 ${isTonight ? '해제' : '활성화'}`}
                              aria-checked={isTonight}
                              role="checkbox"
                              className={`flex items-center gap-1 px-1.5 py-0.5 border text-[9.5px] font-semibold tracking-[-0.05em] whitespace-nowrap shrink-0 transition-colors ${
                                isTonight ? ui.buttonActive : ui.buttonIdle
                              }`}
                              style={{ borderRadius: '4px' }}
                            >
                              {isTonight ? (
                                <CheckSquare className="w-3 h-3 shrink-0" />
                              ) : (
                                <Square className="w-3 h-3 shrink-0" />
                              )}
                              <span>오늘 관측</span>
                            </button>

                            {isRenaming ? (
                              <div className="flex-1 flex items-center gap-1 min-w-0">
                                <input
                                  type="text"
                                  value={renameDraft}
                                  autoFocus
                                  onChange={(e) => setRenameDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && renameDraft.trim()) {
                                      onRenameObservingList(list.id, renameDraft.trim());
                                      setRenamingListId(null);
                                    } else if (e.key === 'Escape') {
                                      setRenamingListId(null);
                                    }
                                  }}
                                  className={`flex-1 min-w-0 px-1.5 py-0.5 border text-[10.5px] ${ui.input}`}
                                  style={{ borderRadius: '4px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (renameDraft.trim()) {
                                      onRenameObservingList(list.id, renameDraft.trim());
                                    }
                                    setRenamingListId(null);
                                  }}
                                  title="이름 저장"
                                  className={`p-1 border shrink-0 ${ui.buttonActive}`}
                                  style={{ borderRadius: '4px' }}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRenamingListId(null)}
                                  title="취소"
                                  className={`p-1 border shrink-0 ${ui.buttonIdle}`}
                                  style={{ borderRadius: '4px' }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedListIds((p) => ({
                                    ...p,
                                    [list.id]: !p[list.id],
                                  }))
                                }
                                className="flex-1 flex items-center justify-between gap-1 min-w-0 text-left"
                                title="클릭하여 포함된 천체 목록 펼치기/접기"
                              >
                                <span
                                  className={`text-[11px] font-semibold truncate tracking-[-0.04em] ${ui.textPrimary}`}
                                >
                                  {list.name}
                                </span>
                                <span className="flex items-center gap-0.5 shrink-0">
                                  <span
                                    className={`text-[9.5px] font-mono tabular-nums ${ui.textMuted}`}
                                  >
                                    {list.entries.length}개
                                  </span>
                                  {isExpanded ? (
                                    <ChevronDown className={`w-3 h-3 ${ui.textMuted}`} />
                                  ) : (
                                    <ChevronRight className={`w-3 h-3 ${ui.textMuted}`} />
                                  )}
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Row 2: Action buttons (파일 가져오기 | 이름 수정 | 내보내기 | 삭제) */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={skylistBusy}
                              onClick={() =>
                                triggerSkylistFilePicker({
                                  targetListId: list.id,
                                  makeTonight: false,
                                })
                              }
                              title={`‘${list.name}’ 목록으로 .skylist 대상 파일 가져오기`}
                              className={`flex-1 py-1 px-1.5 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1 whitespace-nowrap ${ui.buttonIdle} ${
                                skylistBusy ? 'opacity-50 cursor-wait' : ''
                              }`}
                              style={{ borderRadius: '4px' }}
                            >
                              <Upload className="w-3 h-3 shrink-0" />
                              <span>파일 가져오기</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingListId(list.id);
                                setRenameDraft(list.name);
                              }}
                              title="목록명 수정"
                              aria-label={`${list.name} 이름 수정`}
                              className={`p-1 border shrink-0 ${ui.buttonIdle}`}
                              style={{ borderRadius: '4px' }}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={list.entries.length === 0}
                              onClick={() => {
                                onExportSkylist(list.id);
                                setSkylistNotice(
                                  `‘${list.name}’ .skylist 저장 완료 (${list.entries.length}개)`
                                );
                              }}
                              title="이 목록을 .skylist 파일로 내보내기"
                              aria-label={`${list.name} 내보내기`}
                              className={`p-1 border shrink-0 ${
                                list.entries.length === 0
                                  ? `${ui.buttonIdle} opacity-40 cursor-not-allowed`
                                  : ui.buttonIdle
                              }`}
                              style={{ borderRadius: '4px' }}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await onDeleteObservingList(list.id);
                                if (ok !== false && renamingListId === list.id) {
                                  setRenamingListId(null);
                                }
                              }}
                              title="이 목록 삭제"
                              aria-label={`${list.name} 삭제`}
                              className={`p-1 border shrink-0 ${ui.buttonIdle} hover:text-red-400`}
                              style={{ borderRadius: '4px' }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Target List Preview inside Category */}
                        {isExpanded && (
                          <div className={`border-t ${ui.divider}`}>
                            {previewItems.length === 0 ? (
                              <div className={`px-2.5 py-2 text-[10px] text-center ${ui.textMuted}`}>
                                비어 있는 목록입니다. 상단 ‘파일 가져오기’ 또는 성도에서 천체를 추가하세요.
                              </div>
                            ) : (
                              <div className={`divide-y max-h-[200px] overflow-y-auto astro-scroll ${ui.divider}`}>
                                {previewItems.map(({ entry, item, hz }) => {
                                  const isBelowHorizon = hz.altDeg < 0;
                                  const title =
                                    item.kind === 'dso'
                                      ? (() => {
                                          const displayName = formatObjectDisplayName(
                                            item.data.koName,
                                            item.data.name
                                          );
                                          return `${formatCatalogCode(item.data.id) || item.data.id}${
                                            displayName ? ` · ${displayName}` : ''
                                          }`;
                                        })()
                                      : item.kind === 'double'
                                      ? formatObjectDisplayName(
                                          item.data.koName,
                                          item.data.name,
                                          item.data.bayer || item.data.disc
                                        )
                                      : formatObjectDisplayName(
                                          item.data.koName,
                                          item.data.name,
                                          item.data.id
                                        );
                                  const rowBgClass = isBelowHorizon
                                    ? theme === 'white'
                                      ? 'bg-slate-100/85'
                                      : theme === 'red'
                                      ? 'bg-[#090101]'
                                      : 'bg-slate-900/55'
                                    : '';
                                  const titleColorClass = isBelowHorizon
                                    ? theme === 'white'
                                      ? 'text-slate-400'
                                      : theme === 'red'
                                      ? 'text-[#7F1D1D]'
                                      : 'text-slate-500'
                                    : ui.textPrimary;
                                  const metaColorClass = isBelowHorizon
                                    ? theme === 'white'
                                      ? 'text-slate-400'
                                      : theme === 'red'
                                      ? 'text-[#5C1111]'
                                      : 'text-slate-600'
                                    : ui.textMuted;
                                  return (
                                    <div
                                      key={entry.id}
                                      className={`px-2 py-1.5 flex items-center gap-1.5 ${rowBgClass}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => onToggleObserved(entry.id, list.id)}
                                        title={entry.observed ? '관측 완료 취소' : '관측 완료 표시'}
                                        className={`shrink-0 ${isBelowHorizon ? 'opacity-45' : ''}`}
                                      >
                                        {entry.observed ? (
                                          <CheckCircle2
                                            className={`w-3 h-3 ${
                                              isBelowHorizon ? metaColorClass : ui.accentText
                                            }`}
                                          />
                                        ) : (
                                          <Circle className={`w-3 h-3 ${metaColorClass}`} />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => jumpToSessionObject(item)}
                                        className="flex-1 text-left min-w-0"
                                      >
                                        <div
                                          className={`text-[10.5px] truncate tracking-[-0.04em] ${
                                            entry.observed ? 'line-through opacity-60 ' : ''
                                          }${titleColorClass}`}
                                        >
                                          {title}
                                        </div>
                                        <div
                                          className={`text-[9px] font-mono tabular-nums truncate ${metaColorClass}`}
                                        >
                                          {item.data.mag.toFixed(1)}m · 고도 {hz.altDeg.toFixed(0)}°
                                          {isBelowHorizon ? ' · 지평 아래' : ''}
                                        </div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const ok = await confirmDialog({
                                            title: '관측목록 항목 제거',
                                            message: `‘${title}’을(를) ‘${list.name}’ 목록에서 제거하시겠습니까?`,
                                            confirmLabel: '제거',
                                          });
                                          if (ok) onToggleSessionItem(item, list.id);
                                        }}
                                        title="목록에서 제거"
                                        className={`p-0.5 ${metaColorClass} hover:opacity-80 shrink-0 ${
                                          isBelowHorizon ? 'opacity-50' : ''
                                        }`}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
