import React, { useMemo } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Circle,
  Compass,
  Crosshair,
  Navigation,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
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
  activeTab: 'detail' | 'session';
  theme: ThemeMode;
  observer: ObserverConfig;
  optics: OpticsSettings;
  catalogs: CatalogSnapshot;
  sessionPlan: ObservingSessionEntry[];
  onTabChange: (tab: 'detail' | 'session') => void;
  onClose: () => void;
  onSelect: (item: SelectedItem | null) => void;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
  onChangeOptics: (updater: (prev: OpticsSettings) => OpticsSettings) => void;
  onToggleSessionItem: (item: SelectedItem) => void;
  onToggleObserved: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onAddRecommendedTonight: (items: SelectedItem[]) => void;
}

export function ObjectInspector({
  selected,
  activeTab,
  theme,
  observer,
  optics,
  catalogs,
  sessionPlan,
  onTabChange,
  onClose,
  onSelect,
  onChangeView,
  onChangeOptics,
  onToggleSessionItem,
  onToggleObserved,
  onUpdateNotes,
  onAddRecommendedTonight,
}: ObjectInspectorProps) {
  const ui = getUiTheme(theme);
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
    const allDsos = [...catalogs.dsosBright, ...catalogs.darkNebulae, ...catalogs.dsosDeep];
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

  // Compact SVG polyline for 24h altitude curve (tuned for 224px panel width)
  const svgW = 186;
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
      className={`no-print w-56 shrink-0 h-full border-l flex flex-col overflow-hidden ${ui.panel}`}
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
                    : `${selected.data.bayer ?? selected.data.id}${selected.data.hip ? ` · HIP ${selected.data.hip}` : ''} · ${selected.data.con}`}
                </div>
                <h2
                  className={`text-[15px] font-semibold leading-tight tracking-[-0.04em] break-keep ${ui.textPrimary}`}
                >
                  {selected.kind === 'dso'
                    ? selected.data.koName || selected.data.name || selected.data.id
                    : selected.kind === 'planet'
                    ? selected.data.koName
                    : selected.data.koName || selected.data.name || selected.data.bayer || selected.data.id}
                </h2>
                <div className={`text-[10.5px] tracking-[-0.04em] truncate ${ui.textSecondary}`}>
                  {selected.kind === 'dso'
                    ? getDsoTypeLabel(selected.data.type)
                    : selected.kind === 'planet'
                    ? selected.data.category
                    : '항성 (Fixed Star)'}
                </div>
              </div>

              {/* Action Row: 시야중심 | 선택마크 | 목록추가 */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onChangeView((p) => ({
                      ...p,
                      ra: ((selected.data.ra / 15) % 24 + 24) % 24,
                      dec: selected.data.dec,
                      fsz:
                        selected.kind === 'dso'
                          ? Math.max(2.5, Math.min(20, (selected.data.majAx / 60) * 6))
                          : selected.kind === 'planet'
                          ? selected.data.id === 'Moon' || selected.data.id === 'Sun'
                            ? 1.8
                            : selected.data.group === 'planet'
                            ? 0.06
                            : 1.5
                          : 14,
                    }))
                  }
                  className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
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
                            fsz: item.kind === 'dso' ? 12 : item.kind === 'planet' ? 0.08 : 16,
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
