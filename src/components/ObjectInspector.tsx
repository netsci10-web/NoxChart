import React, { useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Circle,
  Compass,
  Crosshair,
  Download,
  Navigation,
  Route,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CALDWELL_CATALOG } from '../data/caldwell';
import { CatalogSnapshot } from '../data/catalogLoader';
import {
  ChartViewState,
  ObserverConfig,
  ObservingSessionEntry,
  OpticsSettings,
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
import { computePlanetOrientation } from '../utils/planetRenderer';
import { getSolarSystemBodies } from '../utils/solarSystem';
import { getUiTheme } from '../utils/themeClasses';

interface ObjectInspectorProps {
  selected: SelectedItem | null;
  centerLocked: boolean;
  solarTrails: Record<string, number>;
  activeTab: 'detail' | 'session';
  theme: ThemeMode;
  observer: ObserverConfig;
  optics: OpticsSettings;
  catalogs: CatalogSnapshot;
  sessionPlan: ObservingSessionEntry[];
  onTabChange: (tab: 'detail' | 'session') => void;
  onClose: () => void;
  onSelect: (item: SelectedItem | null) => void;
  onToggleCenterLock: () => void;
  onToggleSolarTrail: (bodyId: string) => void;
  onClearSolarTrails: () => void;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
  onChangeOptics: (updater: (prev: OpticsSettings) => OpticsSettings) => void;
  onToggleSessionItem: (item: SelectedItem) => void;
  onToggleObserved: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onAddRecommendedTonight: (items: SelectedItem[]) => void;
  onImportSkylist: (text: string) => Promise<{
    matchedCount: number;
    addedCount: number;
    totalCount: number;
    unmatchedNames: string[];
  }>;
  onExportSkylist: () => void;
}

export function ObjectInspector({
  selected,
  centerLocked,
  solarTrails,
  activeTab,
  theme,
  observer,
  optics,
  catalogs,
  sessionPlan,
  onTabChange,
  onClose,
  onSelect,
  onToggleCenterLock,
  onToggleSolarTrail,
  onClearSolarTrails,
  onChangeView,
  onChangeOptics,
  onToggleSessionItem,
  onToggleObserved,
  onUpdateNotes,
  onAddRecommendedTonight,
  onImportSkylist,
  onExportSkylist,
}: ObjectInspectorProps) {
  const ui = getUiTheme(theme);
  const skylistInputRef = useRef<HTMLInputElement>(null);
  const [skylistBusy, setSkylistBusy] = useState(false);
  const [skylistNotice, setSkylistNotice] = useState<string | null>(null);
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
    ? sessionPlan.find((e) => e.id === selected.data.id)
    : undefined;

  const resolvedSessionItems = useMemo(() => {
    const allDsos = [
      ...catalogs.dsosBright,
      ...catalogs.darkNebulae,
      ...catalogs.dsosDeep,
      ...CALDWELL_CATALOG,
    ];
    const allStars = [...catalogs.brightStars, ...catalogs.deepStars, ...catalogs.gaiaStars];
    const solarBodies = getSolarSystemBodies(obsTimeMs);
    return sessionPlan
      .map((entry) => {
        let item: SelectedItem | undefined;
        if (entry.kind === 'dso') {
          const found = allDsos.find((d) => d.id === entry.id);
          if (found) item = { kind: 'dso', data: found };
        } else if (entry.kind === 'planet') {
          const found = solarBodies.find((b) => b.id === entry.id);
          if (found) item = { kind: 'planet', data: found };
        } else if (entry.kind === 'double') {
          const found = catalogs.doubleStars.find((d) => d.id === entry.id);
          if (found) item = { kind: 'double', data: found };
        } else {
          const found = allStars.find((s) => s.id === entry.id);
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
  }, [sessionPlan, catalogs, lstDeg, observer.lat, obsTimeMs]);

  const handleRecommendTonight = () => {
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
      className={`no-print w-[270px] shrink-0 h-full border-l flex flex-col overflow-hidden ${ui.panel}`}
    >
      {/* Header Tabs */}
      <div className={`flex items-center justify-between gap-1 border-b px-2 py-1.5 ${ui.divider}`}>
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => onTabChange('detail')}
            className={`px-2 py-1 text-[11px] tracking-[-0.05em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'detail' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            천체 정보
          </button>
          <button
            type="button"
            onClick={() => onTabChange('session')}
            className={`px-2 py-1 text-[11px] tracking-[-0.05em] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'session' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            관측 목록 ({sessionPlan.length})
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
                    ? `${selected.data.id}${selected.data.altId ? ` · ${selected.data.altId}` : ''} · ${selected.data.con}`
                    : selected.kind === 'planet'
                    ? `${selected.data.symbol} ${selected.data.name} · 태양계`
                    : selected.kind === 'double'
                    ? `${selected.data.disc} · ${selected.data.id}${selected.data.con ? ` · ${selected.data.con}` : ''}`
                    : `${selected.data.bayer ?? selected.data.id}${selected.data.hip ? ` · HIP ${selected.data.hip}` : ''} · ${selected.data.con}`}
                </div>
                <h2
                  className={`text-[15px] font-semibold leading-tight tracking-[-0.04em] break-keep ${ui.textPrimary}`}
                >
                  {selected.kind === 'dso'
                    ? selected.data.koName || selected.data.name || selected.data.id
                    : selected.kind === 'planet'
                    ? selected.data.koName
                    : selected.kind === 'double'
                    ? selected.data.koName || selected.data.name || selected.data.bayer || selected.data.disc
                    : selected.data.koName || selected.data.name || selected.data.bayer || selected.data.id}
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
                  onClick={() => onToggleSessionItem(selected)}
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

              {/* Observation Log / Notes */}
              <div className="space-y-1">
                <label className={`block font-semibold tracking-[-0.05em] ${ui.textPrimary}`}>
                  관측 메모 (자동 저장)
                </label>
                <textarea
                  rows={3}
                  value={sessionEntry?.notes ?? ''}
                  onChange={(e) => {
                    if (!sessionEntry) {
                      onToggleSessionItem(selected);
                    }
                    onUpdateNotes(selected.data.id, e.target.value);
                  }}
                  placeholder="시상, 아이피스, 필터, 관측 소감 기록..."
                  className={`w-full p-2 border text-[10.5px] tracking-[-0.03em] leading-snug resize-none ${ui.input}`}
                  style={{ borderRadius: '5px' }}
                />
              </div>
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
        ) : (
          /* Observing Session Plan Tab */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                오늘 밤 목록
              </span>
              <button
                type="button"
                onClick={handleRecommendTonight}
                className={`px-1.5 py-1 border text-[10px] tracking-[-0.05em] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                style={{ borderRadius: '4px' }}
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>25°+ 추천</span>
              </button>
            </div>

            {/* Unified SkySafari .skylist Import / Export Controls */}
            <div className="grid grid-cols-2 gap-1">
              <input
                ref={skylistInputRef}
                type="file"
                accept=".skylist,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setSkylistBusy(true);
                  setSkylistNotice('카탈로그 로딩 및 .skylist 분석 중...');
                  try {
                    const text = await file.text();
                    const res = await onImportSkylist(text);
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
                        `${res.matchedCount}/${res.totalCount}개 일치 (신규 ${res.addedCount}개 추가${extra})`
                      );
                    }
                  } catch {
                    setSkylistNotice('.skylist 파일을 읽는 중 오류가 발생했습니다.');
                  } finally {
                    setSkylistBusy(false);
                  }
                }}
              />
              <button
                type="button"
                disabled={skylistBusy}
                onClick={() => skylistInputRef.current?.click()}
                title="SkySafari .skylist 관측 목록 불러오기"
                className={`py-1 px-1.5 border text-[10px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1 whitespace-nowrap ${ui.buttonIdle} ${
                  skylistBusy ? 'opacity-50 cursor-wait' : ''
                }`}
                style={{ borderRadius: '4px' }}
              >
                <Upload className="w-3 h-3 shrink-0" />
                <span>.skylist 불러오기</span>
              </button>
              <button
                type="button"
                disabled={sessionPlan.length === 0}
                onClick={() => {
                  onExportSkylist();
                  setSkylistNotice(
                    `SkySafari 호환 .skylist 저장 완료 (${sessionPlan.length}개 대상)`
                  );
                }}
                title="현재 관측 목록을 SkySafari 호환 .skylist 파일로 내보내기"
                className={`py-1 px-1.5 border text-[10px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1 whitespace-nowrap ${
                  sessionPlan.length === 0
                    ? `${ui.buttonIdle} opacity-45 cursor-not-allowed`
                    : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
              >
                <Download className="w-3 h-3 shrink-0" />
                <span>.skylist 내보내기</span>
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

            {resolvedSessionItems.length === 0 ? (
              <div
                className={`border p-4 text-center space-y-1.5 ${ui.border} ${ui.textMuted}`}
                style={{ borderRadius: '6px' }}
              >
                <div className="tracking-[-0.04em]">저장된 대상이 없습니다.</div>
                <p className="text-[10px] tracking-[-0.04em] leading-snug break-keep">
                  천체를 클릭해 추가하거나 추천 버튼으로 고도 높은 대상을 담아보세요.
                </p>
              </div>
            ) : (
              <div
                className={`border divide-y ${ui.border} ${ui.divider}`}
                style={{ borderRadius: '6px' }}
              >
                {resolvedSessionItems.map(({ entry, item, hz }) => {
                  const title =
                    item.kind === 'dso'
                      ? `${item.data.id}${item.data.koName ? ` · ${item.data.koName}` : ''}`
                      : item.kind === 'double'
                      ? `${item.data.koName || item.data.name || item.data.bayer || item.data.disc} (${item.data.sep.toFixed(1)}″)`
                      : `${item.data.koName || item.data.name || item.data.id}`;
                  return (
                    <div key={entry.id} className="p-2 flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleObserved(entry.id)}
                        title={entry.observed ? '관측 완료 취소' : '관측 완료 표시'}
                        className="mt-0.5 shrink-0"
                      >
                        {entry.observed ? (
                          <CheckCircle2 className={`w-3.5 h-3.5 ${ui.accentText}`} />
                        ) : (
                          <Circle className={`w-3.5 h-3.5 ${ui.textMuted}`} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
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
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div
                          className={`text-[11px] tracking-[-0.04em] font-medium truncate ${
                            entry.observed ? 'line-through opacity-60' : ui.textPrimary
                          }`}
                        >
                          {title}
                        </div>
                        <div
                          className={`text-[9.5px] font-mono tracking-[-0.04em] tabular-nums truncate ${ui.textMuted}`}
                        >
                          {item.data.mag.toFixed(1)}m · 고도 {hz.altDeg.toFixed(1)}°(
                          {getCompassDirection(hz.azDeg)})
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSessionItem(item)}
                        title="목록에서 제거"
                        className={`p-0.5 ${ui.textMuted} hover:opacity-80 shrink-0`}
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
    </aside>
  );
}
