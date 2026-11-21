import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Crosshair,
  FlipHorizontal2,
  FlipVertical2,
  Globe,
  Minus,
  Plus,
} from 'lucide-react';
import { CatalogSnapshot, GAIA_LIVE_MAX_FSZ } from '../data/catalogLoader';
import {
  ChallengeTrack,
  ChartViewState,
  HipsSettings,
  LayerSettings,
  ObserverConfig,
  ObservingSessionEntry,
  OpticsSettings,
  ScreenTarget,
  SelectedItem,
  ThemeMode,
} from '../types/astronomy';
import {
  createProjectionParams,
  DEG2RAD,
  equatorialToHorizontal,
  formatDec,
  formatRA,
  getCompassDirection,
  getDsoTypeLabel,
  getLSTDeg,
  getStereographicRadiusPx,
  RAD2DEG,
  unprojectStereographic,
} from '../utils/astronomy';
import { renderStarChart, RenderResult } from '../utils/chartRenderer';
import { getPlanetRenderer } from '../utils/planetRenderer';
import { getUiTheme } from '../utils/themeClasses';
import { HipsBackground } from './HipsBackground';

export interface StarChartCanvasHandle {
  exportPng: () => void;
}

interface StarChartCanvasProps {
  view: ChartViewState;
  theme: ThemeMode;
  layers: LayerSettings;
  optics: OpticsSettings;
  observer: ObserverConfig;
  hips: HipsSettings;
  catalogs: CatalogSnapshot;
  selected: SelectedItem | null;
  centerLocked?: boolean;
  solarTrails?: Record<string, number>;
  sessionIds: Set<string>;
  sessionPlan: ObservingSessionEntry[];
  challenges: ChallengeTrack[];
  leftDrawerOpen?: boolean;
  rightDrawerOpen?: boolean;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
  onSelect: (item: SelectedItem | null) => void;
  onUnlockCenter?: () => void;
}

const MIN_FSZ_DEG = 0.008;

export const StarChartCanvas = forwardRef<StarChartCanvasHandle, StarChartCanvasProps>(
  function StarChartCanvas(
    {
      view,
      theme,
      layers,
      optics,
      observer,
      hips,
      catalogs,
      selected,
      centerLocked = false,
      solarTrails,
      sessionIds,
      sessionPlan,
      challenges,
      leftDrawerOpen = false,
      rightDrawerOpen = false,
      onChangeView,
      onSelect,
      onUnlockCenter,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const targetsRef = useRef<ScreenTarget[]>([]);
    const centerAnimRef = useRef<number | null>(null);
    const lastClickedTargetRef = useRef<{
      item: SelectedItem;
      timeMs: number;
      clientX: number;
      clientY: number;
    } | null>(null);
    const dragRef = useRef<{
      active: boolean;
      startX: number;
      startY: number;
      moved: boolean;
      startView: ChartViewState;
      startRotationDeg: number;
    } | null>(null);

    const cancelCenterAnim = useCallback(() => {
      if (centerAnimRef.current !== null) {
        cancelAnimationFrame(centerAnimRef.current);
        centerAnimRef.current = null;
      }
    }, []);

    useEffect(() => () => cancelCenterAnim(), [cancelCenterAnim]);

    const [size, setSize] = useState({ width: 900, height: 680 });
    const [hoveredTarget, setHoveredTarget] = useState<ScreenTarget | null>(null);
    const [pointerEq, setPointerEq] = useState<{ raDeg: number; decDeg: number } | null>(null);
    const [pointerScreen, setPointerScreen] = useState<{ x: number; y: number } | null>(null);
    const [renderStats, setRenderStats] = useState<{
      magLimit: number;
      dsoMagLimit: number;
      stars: number;
      dsos: number;
      northAngleDeg: number;
    }>({ magLimit: 6.2, dsoMagLimit: 9.7, stars: 0, dsos: 0, northAngleDeg: 0 });
    const [planetTexRev, setPlanetTexRev] = useState(0);

    useEffect(() => {
      return getPlanetRenderer().onTextureReady(() => {
        setPlanetTexRev((n) => n + 1);
      });
    }, []);

    const ui = getUiTheme(theme);

    useImperativeHandle(ref, () => ({
      exportPng: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `noxchart-${view.coordSystem}-ra${view.ra.toFixed(2)}-dec${view.dec.toFixed(1)}-fsz${view.fsz < 1 ? view.fsz.toFixed(3) : view.fsz.toFixed(0)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      },
    }));

    // Track container dimensions with ResizeObserver
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(320, Math.floor(entry.contentRect.width));
          const h = Math.max(320, Math.floor(entry.contentRect.height));
          setSize({ width: w, height: h });
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // Render loop whenever view/state/size changes
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size.width * dpr);
      canvas.height = Math.floor(size.height * dpr);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let rafId = 0;
      rafId = requestAnimationFrame(() => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const result: RenderResult = renderStarChart(
          ctx,
          size.width,
          size.height,
          view,
          theme,
          layers,
          optics,
          observer,
          hips,
          catalogs,
          selected,
          hoveredTarget?.id ?? null,
          sessionIds,
          solarTrails,
          sessionPlan,
          challenges
        );
        targetsRef.current = result.targets;
        setRenderStats({
          magLimit: result.magLimit,
          dsoMagLimit: result.dsoMagLimit,
          stars: result.visibleStarCount,
          dsos: result.visibleDsoCount,
          northAngleDeg: result.northAngleDeg,
        });
      });

      return () => cancelAnimationFrame(rafId);
    }, [
      size,
      view,
      theme,
      layers,
      optics,
      observer,
      hips,
      catalogs,
      selected,
      hoveredTarget?.id,
      sessionIds,
      sessionPlan,
      challenges,
      solarTrails,
      planetTexRev,
    ]);

    const findHitTarget = useCallback(
      (x: number, y: number, extraPadding = 4): ScreenTarget | null => {
        let best: ScreenTarget | null = null;
        let bestScore = Infinity;
        for (const t of targetsRef.current) {
          const d = Math.hypot(t.x - x, t.y - y);
          if (d <= t.radius + extraPadding) {
            const kindBonus = t.kind === 'dso' ? -2 : t.kind === 'double' ? -1.5 : 0;
            const score = d + kindBonus + t.mag * 0.25;
            if (score < bestScore) {
              bestScore = score;
              best = t;
            }
          }
        }
        return best;
      },
      []
    );

    const smoothCenterOn = useCallback(
      (targetRaDeg: number, targetDecDeg: number) => {
        cancelCenterAnim();
        const startRaRad = view.ra * 15 * DEG2RAD;
        const startDecRad = view.dec * DEG2RAD;
        const endRaRad = targetRaDeg * DEG2RAD;
        const endDecRad = targetDecDeg * DEG2RAD;

        const v0: [number, number, number] = [
          Math.cos(startDecRad) * Math.cos(startRaRad),
          Math.cos(startDecRad) * Math.sin(startRaRad),
          Math.sin(startDecRad),
        ];
        const v1: [number, number, number] = [
          Math.cos(endDecRad) * Math.cos(endRaRad),
          Math.cos(endDecRad) * Math.sin(endRaRad),
          Math.sin(endDecRad),
        ];

        const dot = Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]));
        const omega = Math.acos(dot);
        if (omega < 1e-7) {
          onChangeView((prev) => ({
            ...prev,
            ra: ((targetRaDeg / 15) % 24 + 24) % 24,
            dec: Math.max(-89.9, Math.min(89.9, targetDecDeg)),
          }));
          return;
        }

        const durationMs = 320;
        const t0 = performance.now();
        const sinOmega = Math.sin(omega);

        const step = (now: number) => {
          const raw = Math.min(1, (now - t0) / durationMs);
          // Smooth cubic ease-out
          const eased = 1 - Math.pow(1 - raw, 3);

          let x: number;
          let y: number;
          let z: number;
          if (sinOmega > 1e-4) {
            const w0 = Math.sin((1 - eased) * omega) / sinOmega;
            const w1 = Math.sin(eased * omega) / sinOmega;
            x = w0 * v0[0] + w1 * v1[0];
            y = w0 * v0[1] + w1 * v1[1];
            z = w0 * v0[2] + w1 * v1[2];
          } else {
            x = v0[0] * (1 - eased) + v1[0] * eased;
            y = v0[1] * (1 - eased) + v1[1] * eased;
            z = v0[2] * (1 - eased) + v1[2] * eased;
          }
          const len = Math.hypot(x, y, z) || 1;
          const raDeg = ((Math.atan2(y / len, x / len) * RAD2DEG) + 360) % 360;
          const decDeg = Math.asin(Math.max(-1, Math.min(1, z / len))) * RAD2DEG;

          onChangeView((prev) => ({
            ...prev,
            ra: ((raDeg / 15) % 24 + 24) % 24,
            dec: Math.max(-89.9, Math.min(89.9, decDeg)),
          }));

          if (raw < 1) {
            centerAnimRef.current = requestAnimationFrame(step);
          } else {
            centerAnimRef.current = null;
          }
        };

        centerAnimRef.current = requestAnimationFrame(step);
      },
      [view.ra, view.dec, onChangeView, cancelCenterAnim]
    );

    const obsTimeMs = observer.timestampMs;
    const lstDeg = getLSTDeg(obsTimeMs, observer.lon);

    const getEffectiveTransformAtPoint = (
      x: number,
      y: number,
      baseView: ChartViewState
    ): { view: ChartViewState; rotationDeg: number } => {
      if (!optics.showEyepiece) {
        return { view: baseView, rotationDeg: 0 };
      }
      const normRot = ((optics.eyepieceRotationDeg % 360) + 360) % 360;
      const rotActive = normRot > 0.05 && normRot < 359.95;
      if (!baseView.flipH && !baseView.flipV && !rotActive) {
        return { view: baseView, rotationDeg: 0 };
      }
      const rPx = getStereographicRadiusPx(
        optics.eyepieceFovDeg,
        baseView.fsz,
        size.width,
        size.height
      );
      const dist = Math.hypot(x - size.width / 2, y - size.height / 2);
      if (rPx >= 3 && dist <= rPx) {
        return { view: baseView, rotationDeg: normRot };
      }
      return { view: { ...baseView, flipH: false, flipV: false }, rotationDeg: 0 };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      cancelCenterAnim();
      e.currentTarget.setPointerCapture(e.pointerId);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const eff = getEffectiveTransformAtPoint(x, y, view);
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        startView: { ...eff.view },
        startRotationDeg: eff.rotationDeg,
      };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPointerScreen({ x, y });

      const eff = getEffectiveTransformAtPoint(x, y, view);
      const proj = createProjectionParams(
        eff.view,
        size.width,
        size.height,
        lstDeg,
        observer.lat,
        eff.rotationDeg
      );
      setPointerEq(unprojectStereographic(x, y, proj));

      const drag = dragRef.current;
      if (drag && drag.active) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.hypot(dx, dy) > 4) {
          if (!drag.moved) {
            drag.moved = true;
            onUnlockCenter?.();
          }
        }
        if (drag.moved) {
          const startProj = createProjectionParams(
            drag.startView,
            size.width,
            size.height,
            lstDeg,
            observer.lat,
            drag.startRotationDeg
          );
          const nextCenter = unprojectStereographic(
            size.width / 2 - dx,
            size.height / 2 - dy,
            startProj
          );
          if (nextCenter) {
            onChangeView((prev) => ({
              ...prev,
              ra: ((nextCenter.raDeg / 15) % 24 + 24) % 24,
              dec: Math.max(-89.5, Math.min(89.5, nextCenter.decDeg)),
            }));
          }
          setHoveredTarget(null);
          return;
        }
      }

      const hit = findHitTarget(x, y);
      setHoveredTarget(hit);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if not captured
      }

      if (drag && !drag.moved) {
        const rect = e.currentTarget.getBoundingClientRect();
        const hit = findHitTarget(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) {
          lastClickedTargetRef.current = {
            item: hit.item,
            timeMs: Date.now(),
            clientX: e.clientX,
            clientY: e.clientY,
          };
        }
        onSelect(hit ? hit.item : null);
      }
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const hit = findHitTarget(e.clientX - rect.left, e.clientY - rect.top, 8);
      let targetItem: SelectedItem | null = hit ? hit.item : null;

      if (!targetItem && lastClickedTargetRef.current) {
        const last = lastClickedTargetRef.current;
        if (
          Date.now() - last.timeMs < 550 &&
          Math.hypot(e.clientX - last.clientX, e.clientY - last.clientY) < 14
        ) {
          targetItem = last.item;
        }
      }

      if (!targetItem) return;
      lastClickedTargetRef.current = null;
      onSelect(targetItem);
      smoothCenterOn(targetItem.data.ra, targetItem.data.dec);
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
      cancelCenterAnim();
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.14 : 0.875;
      onChangeView((prev) => ({
        ...prev,
        fsz: Math.max(MIN_FSZ_DEG, Math.min(180, prev.fsz * factor)),
      }));
    };

    const centerAltAz = equatorialToHorizontal(view.ra * 15, view.dec, lstDeg, observer.lat);
    const pointerAltAz = pointerEq
      ? equatorialToHorizontal(pointerEq.raDeg, pointerEq.decDeg, lstDeg, observer.lat)
      : null;

    const gaiaActive =
      layers.enableGaiaLive && view.fsz <= GAIA_LIVE_MAX_FSZ && renderStats.magLimit > 9.0;

    const formattedFov =
      view.fsz >= 10
        ? `${view.fsz.toFixed(1)}°`
        : view.fsz >= 1
        ? `${view.fsz.toFixed(2)}°`
        : view.fsz >= 0.1
        ? `${(view.fsz * 60).toFixed(1)}′`
        : `${(view.fsz * 60).toFixed(2)}′`;

    return (
      <div
        id="chart-stage"
        ref={containerRef}
        className="relative flex-1 h-full overflow-hidden select-none"
      >
        {/* Native WebGL HEALPix HiPS Photographic Sky Background */}
        <HipsBackground
          hips={hips}
          view={view}
          optics={optics}
          observer={observer}
          theme={theme}
          width={size.width}
          height={size.height}
        />

        {/* Vector Star Chart Canvas Layer */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onPointerLeave={() => {
            setHoveredTarget(null);
            setPointerEq(null);
            setPointerScreen(null);
          }}
          onWheel={handleWheel}
          className="relative z-10 block w-full h-full cursor-crosshair touch-none"
        />

        {/* Top-Left Live Coordinate & Object Count Telemetry HUD (single line) */}
        <div
          className={`no-print pointer-events-none absolute z-20 top-3 max-w-[calc(100%-296px)] border px-3 py-1.5 text-xs font-mono tabular-nums backdrop-blur-sm transition-[left] duration-200 ease-out ${ui.hudOverlay}`}
          style={{ borderRadius: '6px', left: leftDrawerOpen ? '282px' : '16px' }}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={ui.accentText}>
              {view.coordSystem === 'horizontal' ? '지평 (Alt/Az)' : '적도 (RA/Dec)'}
            </span>
            <span aria-hidden="true" className={ui.textMuted}>·</span>
            <span className={ui.textPrimary}>
              {view.coordSystem === 'horizontal'
                ? `고도 ${centerAltAz.altDeg.toFixed(1)}° · 방위각 ${centerAltAz.azDeg.toFixed(1)}° (${getCompassDirection(centerAltAz.azDeg)})`
                : `RA ${formatRA(view.ra * 15)} · Dec ${formatDec(view.dec)}`}
            </span>
            <span aria-hidden="true" className={ui.textMuted}>·</span>
            <span className={ui.textMuted}>천체 {renderStats.stars + renderStats.dsos}개</span>
            {observer.minAltitudeDeg > -90 && (
              <>
                <span aria-hidden="true" className={ui.textMuted}>·</span>
                <span className={ui.accentText}>
                  고도 ≥{observer.minAltitudeDeg}° ({observer.highlightAboveMinAlt ? '흐림' : '숨김'})
                </span>
              </>
            )}
            {centerLocked && selected && (
              <>
                <span aria-hidden="true" className={ui.textMuted}>·</span>
                <span className={ui.accentText}>
                  중심 추적:{' '}
                  {selected.kind === 'dso'
                    ? selected.data.koName || selected.data.id
                    : selected.kind === 'planet'
                    ? selected.data.koName
                    : selected.kind === 'double'
                    ? selected.data.koName || selected.data.name || selected.data.disc
                    : selected.data.koName || selected.data.name || selected.data.bayer || selected.data.id}
                </span>
              </>
            )}
            {gaiaActive && (
              <>
                <span aria-hidden="true" className={ui.textMuted}>·</span>
                <span className={ui.accentText}>
                  {catalogs.gaiaLoading
                    ? 'Gaia 로딩'
                    : catalogs.gaiaStars.length > 0
                    ? `Gaia DR3 (${catalogs.gaiaStars.length})`
                    : 'Hipparcos'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Bottom-Left Crosshair Pointer Telemetry */}
        {pointerEq && pointerAltAz && (
          <div
            className={`no-print pointer-events-none absolute z-20 bottom-3 border px-3 py-1.5 text-[11px] font-mono tabular-nums backdrop-blur-sm transition-[left] duration-200 ease-out ${ui.hudOverlay}`}
            style={{ borderRadius: '6px', left: leftDrawerOpen ? '282px' : '16px' }}
          >
            <div className="flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 shrink-0" />
              <span>
                RA {formatRA(pointerEq.raDeg)} · Dec {formatDec(pointerEq.decDeg)}
              </span>
              <span aria-hidden="true">|</span>
              <span>
                고도 {pointerAltAz.altDeg.toFixed(1)}° · 방위각 {pointerAltAz.azDeg.toFixed(1)}° (
                {getCompassDirection(pointerAltAz.azDeg)})
              </span>
            </div>
          </div>
        )}

        {/* Top-Right Quick Viewport Controls (Zoom, 180° All-Sky, Flip H/V) */}
        <div
          className={`no-print absolute z-20 top-3 flex items-center gap-1 border p-1 backdrop-blur-sm transition-[right] duration-200 ease-out ${ui.hudOverlay}`}
          style={{ borderRadius: '6px', right: rightDrawerOpen ? '282px' : '12px' }}
        >
          <button
            type="button"
            onClick={() =>
              onChangeView((p) => ({ ...p, fsz: Math.max(MIN_FSZ_DEG, p.fsz * 0.72) }))
            }
            title="확대 (Zoom In)"
            aria-label="확대"
            className={`p-2 border transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Plus className="w-4 h-4" />
          </button>
          <div
            title={`현재 시야각 (FOV): ${formattedFov}`}
            className={`px-2 py-1.5 min-w-[54px] text-center font-mono text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 select-none ${ui.accentText}`}
          >
            {formattedFov}
          </div>
          <button
            type="button"
            onClick={() =>
              onChangeView((p) => ({ ...p, fsz: Math.min(180, p.fsz * 1.38) }))
            }
            title="축소 (Zoom Out)"
            aria-label="축소"
            className={`p-2 border transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onChangeView((p) => ({ ...p, fsz: 180 }))}
            title="180° 전천 평사 도법 뷰"
            className={`px-2 py-2 border text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              Math.abs(view.fsz - 180) < 1 ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>180°</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeView((p) => ({ ...p, flipH: !p.flipH }))}
            title={
              optics.showEyepiece
                ? '좌우 반전 — 망원경 아이피스 원 내부만 적용 중'
                : '좌우 반전 (천정미러/굴절망원경 · 전체 성도)'
            }
            className={`px-2 py-2 border text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              view.flipH ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">좌우반전</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeView((p) => ({ ...p, flipV: !p.flipV }))}
            title={
              optics.showEyepiece
                ? '상하 반전 — 망원경 아이피스 원 내부만 적용 중'
                : '상하 반전 (반사망원경 도립상 · 전체 성도)'
            }
            className={`px-2 py-2 border text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              view.flipV ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            <FlipVertical2 className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">상하반전</span>
          </button>
        </div>

        {/* Hover Tooltip */}
        {hoveredTarget && pointerScreen && !dragRef.current?.moved && (
          <div
            className={`no-print pointer-events-none absolute z-30 border px-2.5 py-1.5 text-xs shadow-sm ${ui.hudOverlay}`}
            style={{
              left: Math.min(size.width - 220, pointerScreen.x + 14),
              top: Math.max(10, pointerScreen.y - 44),
              borderRadius: '6px',
            }}
          >
            {hoveredTarget.item.kind === 'dso' ? (
              <div>
                <div className="font-semibold font-mono">
                  {hoveredTarget.item.data.id}
                  {hoveredTarget.item.data.koName
                    ? ` · ${hoveredTarget.item.data.koName}`
                    : hoveredTarget.item.data.name
                    ? ` · ${hoveredTarget.item.data.name}`
                    : ''}
                </div>
                <div className={`text-[11px] font-mono tabular-nums ${ui.textMuted}`}>
                  {getDsoTypeLabel(hoveredTarget.item.data.type)} · {hoveredTarget.item.data.mag.toFixed(1)}m ·{' '}
                  {hoveredTarget.item.data.majAx.toFixed(1)}′
                </div>
              </div>
            ) : hoveredTarget.item.kind === 'planet' ? (
              <div>
                <div className="font-semibold">
                  {hoveredTarget.item.data.symbol} {hoveredTarget.item.data.koName} ({hoveredTarget.item.data.name})
                </div>
                <div className={`text-[11px] font-mono tabular-nums ${ui.textMuted}`}>
                  {hoveredTarget.item.data.category} · {hoveredTarget.item.data.mag.toFixed(1)}m ·{' '}
                  {hoveredTarget.item.data.id === 'Moon'
                    ? `위상 ${hoveredTarget.item.data.phasePct}%`
                    : `${hoveredTarget.item.data.distAu.toFixed(2)} AU`}
                </div>
              </div>
            ) : hoveredTarget.item.kind === 'double' ? (
              <div>
                <div className="font-semibold">
                  {hoveredTarget.item.data.koName ||
                    hoveredTarget.item.data.name ||
                    hoveredTarget.item.data.bayer ||
                    hoveredTarget.item.data.disc}
                  {' · '}
                  <span className={ui.accentText}>
                    {hoveredTarget.item.data.isMultiple
                      ? `다중성 (${hoveredTarget.item.data.compCount}성)`
                      : '이중성'}
                  </span>
                </div>
                <div className={`text-[11px] font-mono tabular-nums ${ui.textMuted}`}>
                  {hoveredTarget.item.data.disc} · {hoveredTarget.item.data.mag1.toFixed(1)}/
                  {hoveredTarget.item.data.mag2.toFixed(1)}m · {hoveredTarget.item.data.sep.toFixed(1)}″ · PA{' '}
                  {hoveredTarget.item.data.pa}°
                </div>
              </div>
            ) : (
              <div>
                <div className="font-semibold">
                  {hoveredTarget.item.data.koName ||
                    hoveredTarget.item.data.name ||
                    hoveredTarget.item.data.bayer ||
                    hoveredTarget.item.data.id}
                </div>
                <div className={`text-[11px] font-mono tabular-nums ${ui.textMuted}`}>
                  {hoveredTarget.item.data.bayer ||
                    (hoveredTarget.item.data.gaiaId ? 'Gaia DR3' : hoveredTarget.item.data.con || 'HIP')}{' '}
                  · {hoveredTarget.item.data.mag.toFixed(2)}m · B-V{' '}
                  {hoveredTarget.item.data.bv.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
