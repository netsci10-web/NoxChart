import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Crosshair,
  FlipHorizontal2,
  FlipVertical2,
  Globe,
  MapPin,
  Minus,
  Plus,
  Undo2,
} from 'lucide-react';
import { CALDWELL_CATALOG } from '../data/caldwell';
import { CatalogSnapshot, GAIA_LIVE_MAX_FSZ } from '../data/catalogLoader';
import { DSO_CATALOG } from '../data/dso';
import {
  ChallengeTrack,
  ChartViewState,
  DeepSkyObject,
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
  angularDistanceDeg,
  createProjectionParams,
  DEG2RAD,
  equatorialToHorizontal,
  formatDec,
  formatRA,
  getCompassDirection,
  getDsoTypeLabel,
  getHorizonSensorScreenAngleDeg,
  getLSTDeg,
  getStereographicRadiusPx,
  RAD2DEG,
  unprojectStereographic,
} from '../utils/astronomy';
import { renderStarChart, RenderResult } from '../utils/chartRenderer';
import { getPlanetRenderer } from '../utils/planetRenderer';
import { getSolarSystemBodies } from '../utils/solarSystem';
import { getUiTheme } from '../utils/themeClasses';
import { HipsBackground, HipsBackgroundHandle } from './HipsBackground';

export interface StarChartCanvasHandle {
  exportPng: () => void;
  exportSensorFovPng: (equipmentName?: string) => void;
  smoothCenterOn: (
    targetRaDeg: number,
    targetDecDeg: number,
    options?: {
      targetFsz?: number;
      durationMs?: number;
      onComplete?: () => void;
    }
  ) => void;
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
  challengePickMode?: boolean;
  challengePickAllowEmpty?: boolean;
  challengeDraftCount?: number;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
  onSelect: (item: SelectedItem | null, options?: { hideSelectionMark?: boolean }) => void;
  onUnlockCenter?: () => void;
  onChallengeChartPick?: (pick: {
    item: SelectedItem | null;
    raDeg: number;
    decDeg: number;
  }) => void;
  onUndoChallengeCheckpoint?: () => void;
}

const MIN_FSZ_DEG = 0.008;

function formatExportDateTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDsoFooterName(dso: DeepSkyObject, caldwellId?: string): string {
  const primaryCode =
    caldwellId && !/^M\d+$/i.test(dso.id) ? `${caldwellId} (${dso.id})` : dso.id;
  const common = dso.koName || dso.name;
  return common ? `${primaryCode} ${common}` : primaryCode;
}

function formatSelectedFooterObject(
  selected: SelectedItem
): { label: string; conAbbr?: string } {
  if (selected.kind === 'dso') {
    const dso = selected.data;
    const calMatch = CALDWELL_CATALOG.find(
      (c) =>
        c.id.replace(/\s+/g, '').toUpperCase() === dso.id.replace(/\s+/g, '').toUpperCase() ||
        (dso.altId &&
          c.id.replace(/\s+/g, '').toUpperCase() === dso.altId.replace(/\s+/g, '').toUpperCase())
    );
    return {
      label: formatDsoFooterName(dso, calMatch?.caldwellId),
      conAbbr: dso.con,
    };
  }
  if (selected.kind === 'planet') {
    const b = selected.data;
    return {
      label: b.name && b.name !== b.koName ? `${b.koName} (${b.name})` : b.koName,
    };
  }
  if (selected.kind === 'double') {
    const ds = selected.data;
    const common = ds.koName || ds.name || ds.bayer;
    return {
      label: common ? `${common} (${ds.disc})` : ds.disc,
      conAbbr: ds.con,
    };
  }
  const st = selected.data;
  const common = st.koName || st.name || st.bayer || st.id;
  return {
    label:
      st.koName && st.bayer && st.koName !== st.bayer ? `${st.koName} (${st.bayer})` : common,
    conAbbr: st.con,
  };
}

function findCenterNamedObject(
  centerRaDeg: number,
  centerDecDeg: number,
  sensorMinDeg: number,
  observer: ObserverConfig,
  catalogs: CatalogSnapshot,
  selected: SelectedItem | null
): { label: string; conAbbr?: string } | null {
  const baseThresholdDeg = Math.min(0.45, Math.max(0.05, sensorMinDeg * 0.14));

  // 1. Prefer the currently selected object if it is centered in the sensor frame
  if (selected) {
    const dist = angularDistanceDeg(
      centerRaDeg,
      centerDecDeg,
      selected.data.ra,
      selected.data.dec
    );
    const dsoRadiusDeg =
      selected.kind === 'dso'
        ? Math.min(2.0, ((selected.data.majAx || 0) / 60) * 0.55)
        : 0;
    if (dist <= Math.max(baseThresholdDeg, dsoRadiusDeg)) {
      return formatSelectedFooterObject(selected);
    }
  }

  // 2. Solar System objects (Sun, Moon, Planets, Dwarf Planets, Asteroids, Planetary Moons)
  const solarBodies = getSolarSystemBodies(observer.timestampMs);
  let bestSolar: { label: string; dist: number } | null = null;
  for (const body of solarBodies) {
    const dist = angularDistanceDeg(centerRaDeg, centerDecDeg, body.ra, body.dec);
    const bodyRadiusDeg =
      body.id === 'Sun' || body.id === 'Moon' ? 0.35 : baseThresholdDeg;
    if (dist <= Math.max(baseThresholdDeg, bodyRadiusDeg)) {
      if (!bestSolar || dist < bestSolar.dist) {
        bestSolar = {
          label:
            body.name && body.name !== body.koName
              ? `${body.koName} (${body.name})`
              : body.koName,
          dist,
        };
      }
    }
  }
  if (bestSolar) {
    return { label: bestSolar.label };
  }

  // 3. Deep Sky Objects (Messier, Caldwell, NGC, IC, Dark Nebulae)
  const caldwellByKey = new Map<string, string>();
  for (const c of CALDWELL_CATALOG) {
    caldwellByKey.set(c.id.replace(/\s+/g, '').toUpperCase(), c.caldwellId);
  }

  const bestDsoState: { best: { label: string; conAbbr?: string; score: number } | null } = {
    best: null,
  };
  const evalDso = (dso: DeepSkyObject, explicitCaldwellId?: string) => {
    const dist = angularDistanceDeg(centerRaDeg, centerDecDeg, dso.ra, dso.dec);
    const radiusDeg = Math.min(2.0, ((dso.majAx || 0) / 60) * 0.55);
    const tol = Math.max(baseThresholdDeg, radiusDeg);
    if (dist > tol) return;

    const isMessier = /^M\d+$/i.test(dso.id);
    const calId =
      explicitCaldwellId ??
      caldwellByKey.get(dso.id.replace(/\s+/g, '').toUpperCase()) ??
      (dso.altId ? caldwellByKey.get(dso.altId.replace(/\s+/g, '').toUpperCase()) : undefined);
    const tierPenalty = isMessier ? 0 : calId ? 0.04 : dso.type !== 'DARK' ? 0.09 : 0.14;
    const normDist = dist / Math.max(0.02, tol);
    const magPenalty = Math.max(0, Math.min(18, dso.mag || 12)) * 0.015;
    const score = normDist + tierPenalty + magPenalty;
    if (!bestDsoState.best || score < bestDsoState.best.score) {
      bestDsoState.best = {
        label: formatDsoFooterName(dso, calId),
        conAbbr: dso.con,
        score,
      };
    }
  };

  for (const dso of DSO_CATALOG) evalDso(dso);
  for (const c of CALDWELL_CATALOG) evalDso(c, c.caldwellId);
  for (const dso of catalogs.dsosBright) evalDso(dso);
  for (const dso of catalogs.dsosDeep) evalDso(dso);
  for (const dso of catalogs.darkNebulae) evalDso(dso);
  if (bestDsoState.best) {
    return { label: bestDsoState.best.label, conAbbr: bestDsoState.best.conAbbr };
  }

  // 4. WDS Double & Multiple Stars
  const tightStarTol = Math.min(0.25, Math.max(0.035, sensorMinDeg * 0.1));
  let bestDouble: { label: string; conAbbr?: string; score: number } | null = null;
  for (const ds of catalogs.doubleStars) {
    const dist = angularDistanceDeg(centerRaDeg, centerDecDeg, ds.ra, ds.dec);
    if (dist > tightStarTol) continue;
    const score = dist * 4 + (ds.mag || 8) * 0.05;
    if (!bestDouble || score < bestDouble.score) {
      const common = ds.koName || ds.name || ds.bayer;
      bestDouble = {
        label: common ? `${common} (${ds.disc})` : ds.disc,
        conAbbr: ds.con,
        score,
      };
    }
  }
  if (bestDouble) {
    return { label: bestDouble.label, conAbbr: bestDouble.conAbbr };
  }

  // 5. Named / Bayer Bright Stars
  let bestStar: { label: string; conAbbr?: string; score: number } | null = null;
  for (const st of catalogs.brightStars) {
    if (!st.koName && !st.name && !st.bayer) continue;
    const dist = angularDistanceDeg(centerRaDeg, centerDecDeg, st.ra, st.dec);
    if (dist > tightStarTol) continue;
    const score = dist * 4 + (st.mag || 6) * 0.05;
    if (!bestStar || score < bestStar.score) {
      const primary = st.koName || st.name || st.bayer || st.id;
      bestStar = {
        label:
          st.koName && st.bayer && st.koName !== st.bayer
            ? `${st.koName} (${st.bayer})`
            : primary,
        conAbbr: st.con,
        score,
      };
    }
  }
  if (bestStar) {
    return { label: bestStar.label, conAbbr: bestStar.conAbbr };
  }

  return null;
}

function findConstellationLabel(
  centerRaDeg: number,
  centerDecDeg: number,
  preferredAbbr: string | undefined,
  catalogs: CatalogSnapshot
): string {
  const byAbbr = new Map(
    catalogs.constellations.map((c) => [c.abbr.toUpperCase(), c] as const)
  );

  if (preferredAbbr) {
    const matched = byAbbr.get(preferredAbbr.toUpperCase());
    if (matched) return `${matched.koName} (${matched.abbr})`;
  }

  // Determine exact IAU constellation from nearest cataloged bright star or DSO carrying `.con`
  let nearestCon: string | null = null;
  let nearestDist = 15;
  for (const st of catalogs.brightStars) {
    if (!st.con) continue;
    const d = angularDistanceDeg(centerRaDeg, centerDecDeg, st.ra, st.dec);
    if (d < nearestDist) {
      nearestDist = d;
      nearestCon = st.con;
    }
  }
  for (const dso of catalogs.dsosBright) {
    if (!dso.con) continue;
    const d = angularDistanceDeg(centerRaDeg, centerDecDeg, dso.ra, dso.dec);
    if (d < nearestDist) {
      nearestDist = d;
      nearestCon = dso.con;
    }
  }
  if (nearestCon) {
    const matched = byAbbr.get(nearestCon.toUpperCase());
    if (matched) return `${matched.koName} (${matched.abbr})`;
  }

  // Fallback to nearest constellation center
  let fallback = catalogs.constellations[0];
  let fallbackDist = Infinity;
  for (const c of catalogs.constellations) {
    const d = angularDistanceDeg(centerRaDeg, centerDecDeg, c.ra, c.dec);
    if (d < fallbackDist) {
      fallbackDist = d;
      fallback = c;
    }
  }
  return fallback ? `${fallback.koName} (${fallback.abbr})` : '';
}

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
      challengePickMode = false,
      challengePickAllowEmpty = true,
      challengeDraftCount = 0,
      onChangeView,
      onSelect,
      onUnlockCenter,
      onChallengeChartPick,
      onUndoChallengeCheckpoint,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hipsRef = useRef<HipsBackgroundHandle>(null);
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
    const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const pinchRef = useRef<{
      active: boolean;
      initialDist: number;
      initialMidX: number;
      initialMidY: number;
      initialView: ChartViewState;
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

    const smoothCenterOn = useCallback(
      (
        targetRaDeg: number,
        targetDecDeg: number,
        options?: {
          targetFsz?: number;
          durationMs?: number;
          onComplete?: () => void;
        }
      ) => {
        cancelCenterAnim();
        const startRaRad = view.ra * 15 * DEG2RAD;
        const startDecRad = view.dec * DEG2RAD;
        const endRaRad = targetRaDeg * DEG2RAD;
        const endDecRad = targetDecDeg * DEG2RAD;
        const startFsz = view.fsz;
        const endFsz =
          options?.targetFsz !== undefined
            ? Math.max(MIN_FSZ_DEG, Math.min(180, options.targetFsz))
            : startFsz;
        const hasFszChange = Math.abs(endFsz - startFsz) > 1e-4;

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
        if (omega < 1e-7 && !hasFszChange) {
          onChangeView((prev) => ({
            ...prev,
            ra: ((targetRaDeg / 15) % 24 + 24) % 24,
            dec: Math.max(-89.999, Math.min(89.999, targetDecDeg)),
            fsz: endFsz,
          }));
          options?.onComplete?.();
          return;
        }

        const angularDeg = omega * RAD2DEG;
        const autoDuration = Math.round(
          Math.min(780, Math.max(420, 380 + angularDeg * 4.5 + (hasFszChange ? 160 : 0)))
        );
        const durationMs = options?.durationMs ?? autoDuration;
        const t0 = performance.now();
        const sinOmega = Math.sin(omega);
        const logStartFsz = Math.log(Math.max(MIN_FSZ_DEG, startFsz));
        const logEndFsz = Math.log(Math.max(MIN_FSZ_DEG, endFsz));

        const step = (now: number) => {
          const raw = Math.min(1, (now - t0) / durationMs);
          // Smooth cubic ease-in-out when zooming + slewing, cubic ease-out for short pans
          const eased = hasFszChange
            ? raw < 0.5
              ? 4 * raw * raw * raw
              : 1 - Math.pow(-2 * raw + 2, 3) / 2
            : 1 - Math.pow(1 - raw, 3);

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
          const nextFsz = hasFszChange
            ? Math.exp(logStartFsz * (1 - eased) + logEndFsz * eased)
            : startFsz;

          onChangeView((prev) => ({
            ...prev,
            ra: ((raDeg / 15) % 24 + 24) % 24,
            dec: Math.max(-89.999, Math.min(89.999, decDeg)),
            ...(hasFszChange ? { fsz: nextFsz } : {}),
          }));

          if (raw < 1) {
            centerAnimRef.current = requestAnimationFrame(step);
          } else {
            centerAnimRef.current = null;
            options?.onComplete?.();
          }
        };

        centerAnimRef.current = requestAnimationFrame(step);
      },
      [view.ra, view.dec, view.fsz, onChangeView, cancelCenterAnim]
    );

    useImperativeHandle(ref, () => ({
      smoothCenterOn,
      exportPng: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `noxchart-${view.coordSystem}-ra${view.ra.toFixed(2)}-dec${view.dec.toFixed(1)}-fsz${view.fsz < 1 ? view.fsz.toFixed(3) : view.fsz.toFixed(0)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      },
      exportSensorFovPng: (equipmentName?: string) => {
        if (
          !optics.showSensorBox ||
          optics.sensorWidthDeg <= 0 ||
          optics.sensorHeightDeg <= 0
        ) {
          return;
        }
        const sensorW = Math.max(0.05, optics.sensorWidthDeg);
        const sensorH = Math.max(0.05, optics.sensorHeightDeg);
        const tanW = Math.tan((sensorW * DEG2RAD) / 4);
        const tanH = Math.tan((sensorH * DEG2RAD) / 4);
        const LONG_SIDE = 1800;
        let outW: number;
        let photoH: number;
        if (tanW >= tanH) {
          outW = LONG_SIDE;
          photoH = Math.max(64, Math.round(LONG_SIDE * (tanH / tanW)));
        } else {
          photoH = LONG_SIDE;
          outW = Math.max(64, Math.round(LONG_SIDE * (tanW / tanH)));
        }

        const barH = Math.round(Math.max(82, Math.min(116, outW * 0.066)));
        const totalH = photoH + barH;

        const rawSensorRot = optics.sensorRotationLocked
          ? 0
          : optics.sensorRotationDeg ?? 0;
        const normSensorRot = ((rawSensorRot % 360) + 360) % 360;
        const sensorRotActive = normSensorRot > 0.05 && normSensorRot < 359.95;

        const sensorView: ChartViewState = {
          ...view,
          fsz: Math.min(sensorW, sensorH),
          flipH: optics.showEyepiece ? false : view.flipH,
          flipV: optics.showEyepiece ? false : view.flipV,
        };

        // Sensor FOV frame is referenced to observer horizon/ground and rotates with time
        const exportLstDeg = getLSTDeg(observer.timestampMs, observer.lon);
        const baseExportProj = createProjectionParams(
          sensorView,
          outW,
          photoH,
          exportLstDeg,
          observer.lat,
          0
        );
        const { screenDeg: screenBoxDeg } = getHorizonSensorScreenAngleDeg(
          baseExportProj,
          normSensorRot
        );
        // Rotating the sensor frame clockwise by +screenBoxDeg aligns sky rotated by -screenBoxDeg upright
        const exportRotDeg =
          screenBoxDeg > 0.05 && screenBoxDeg < 359.95 ? (360 - screenBoxDeg) % 360 : 0;

        const cleanOptics: OpticsSettings = {
          ...optics,
          showCrosshair: false,
          showTelrad: false,
          showFinder7x50: false,
          showEyepiece: false,
          showSensorBox: false,
          showSelectionMark: false,
          showStarHop: false,
        };

        // Label-only photographic sky layer configuration: suppress grids, constellation lines, DSO symbols, contours, orbits, terrain, and highlights
        const photoLayers: LayerSettings = {
          ...layers,
          showGridEq: false,
          showGridAltAz: false,
          showHorizon: false,
          showTerrain: false,
          showEcliptic: false,
          showMilkyWay: false,
          showNebulaContours: false,
          showConstellationLines: false,
          showConstellationBoundaries: false,
          showConstellationNames: false,
          showSolarSystemOrbits: false,
          highlightSessionPlan: false,
          showDso: true,
          showDsoLabels: true,
          showMessierCatalog: true,
          showCaldwellCatalog: true,
          showSolarSystemLabels: true,
        };

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = totalH;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) return;

        const emptySessionIds = new Set<string>();
        const hipsVisible = hips.enabled && hips.opacity > 0.02;

        // Render sky photograph into exact (0, 0, outW, photoH) region
        outCtx.save();
        outCtx.beginPath();
        outCtx.rect(0, 0, outW, photoH);
        outCtx.clip();

        if (hipsVisible) {
          outCtx.fillStyle =
            theme === 'white' ? '#FFFFFF' : theme === 'red' ? '#060000' : '#070A12';
          outCtx.fillRect(0, 0, outW, photoH);
          hipsRef.current?.renderSnapshotToCanvas(
            outCtx,
            outW,
            photoH,
            sensorView,
            exportRotDeg
          );
        }

        const vecCanvas = document.createElement('canvas');
        vecCanvas.width = outW;
        vecCanvas.height = photoH;
        const vecCtx = vecCanvas.getContext('2d');
        if (vecCtx) {
          renderStarChart(
            vecCtx,
            outW,
            photoH,
            sensorView,
            theme,
            photoLayers,
            cleanOptics,
            observer,
            hips,
            catalogs,
            null,
            null,
            emptySessionIds,
            undefined,
            undefined,
            undefined,
            exportRotDeg,
            true
          );
          outCtx.drawImage(vecCanvas, 0, 0);
        }
        outCtx.restore();

        // Draw crisp white metadata footer bar below the photographic frame
        const centerRaDeg = ((view.ra * 15) % 360 + 360) % 360;
        const centerDecDeg = view.dec;
        const coordCompact = `RA ${formatRA(centerRaDeg)}, Dec ${formatDec(centerDecDeg)}`;
        const centerObj = findCenterNamedObject(
          centerRaDeg,
          centerDecDeg,
          Math.min(sensorW, sensorH),
          observer,
          catalogs,
          selected
        );
        const primaryTargetText = centerObj
          ? `${centerObj.label} (${coordCompact})`
          : `RA ${formatRA(centerRaDeg)} · Dec ${formatDec(centerDecDeg)}`;

        const dateTimeText = formatExportDateTime(observer.timestampMs);
        const constellationLabel = findConstellationLabel(
          centerRaDeg,
          centerDecDeg,
          centerObj?.conAbbr,
          catalogs
        );
        const rawEquipName = (equipmentName ?? '').trim();
        const equipDisplayName =
          rawEquipName && !rawEquipName.startsWith('FOV_') ? rawEquipName : '촬영 센서';
        const fovSizeText = `${sensorW.toFixed(2)}° × ${sensorH.toFixed(2)}°`;
        const secondaryMetaText = constellationLabel
          ? `${constellationLabel}  /  ${equipDisplayName} (${fovSizeText})`
          : `${equipDisplayName} (${fovSizeText})`;

        outCtx.save();
        outCtx.fillStyle = '#FFFFFF';
        outCtx.fillRect(0, photoH, outW, barH);

        // Subtle top separator hairline
        outCtx.strokeStyle = '#CBD5E1';
        outCtx.lineWidth = 1.5;
        outCtx.beginPath();
        outCtx.moveTo(0, photoH + 0.75);
        outCtx.lineTo(outW, photoH + 0.75);
        outCtx.stroke();

        const padX = Math.round(Math.max(22, outW * 0.022));
        const row1Y = photoH + Math.round(barH * 0.36);
        const row2Y = photoH + Math.round(barH * 0.72);
        const baseFontPx = Math.round(Math.max(14, Math.min(22, barH * 0.21)));
        const subFontPx = Math.round(Math.max(12, Math.min(18, barH * 0.17)));
        const dateFontPx = Math.round(Math.max(13, Math.min(19, barH * 0.185)));
        const fontFamily =
          '"Pretendard", "Noto Sans KR", "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
        const monoFontFamily = '"IBM Plex Mono", "Pretendard", monospace';

        // Row 1 Right: Date & Time
        outCtx.textBaseline = 'middle';
        outCtx.textAlign = 'right';
        outCtx.font = `600 ${dateFontPx}px ${monoFontFamily}`;
        outCtx.fillStyle = '#334155';
        const dateWidth = outCtx.measureText(dateTimeText).width;
        outCtx.fillText(dateTimeText, outW - padX, row1Y);

        // Row 1 Left: Center Named Object (if present) + Equatorial Position (auto-fit if long)
        const maxPrimaryW = Math.max(200, outW - padX * 2 - dateWidth - 28);
        let primaryPx = baseFontPx;
        outCtx.textAlign = 'left';
        outCtx.font = `700 ${primaryPx}px ${fontFamily}`;
        while (primaryPx > 11 && outCtx.measureText(primaryTargetText).width > maxPrimaryW) {
          primaryPx -= 1;
          outCtx.font = `700 ${primaryPx}px ${fontFamily}`;
        }
        outCtx.fillStyle = '#0F172A';
        outCtx.fillText(primaryTargetText, padX, row1Y, maxPrimaryW);

        // Row 2 Left: Constellation Name / Equipment Type (Full FOV Size)
        const maxSubW = Math.max(200, outW - padX * 2);
        let subPx = subFontPx;
        outCtx.font = `500 ${subPx}px ${fontFamily}`;
        while (subPx > 10 && outCtx.measureText(secondaryMetaText).width > maxSubW) {
          subPx -= 1;
          outCtx.font = `500 ${subPx}px ${fontFamily}`;
        }
        outCtx.fillStyle = '#475569';
        outCtx.fillText(secondaryMetaText, padX, row2Y, maxSubW);

        // Row 2 Right: Subtle equatorial / rotation note if ample horizontal space
        const subTextW = outCtx.measureText(secondaryMetaText).width;
        const rightNote = sensorRotActive
          ? `J2000 · 지평 회전 ${Math.round(normSensorRot)}°`
          : 'J2000 적도좌표';
        outCtx.font = `500 ${Math.max(11, subFontPx - 2)}px ${monoFontFamily}`;
        const rightNoteW = outCtx.measureText(rightNote).width;
        if (subTextW + rightNoteW + 32 < maxSubW) {
          outCtx.textAlign = 'right';
          outCtx.fillStyle = '#64748B';
          outCtx.fillText(rightNote, outW - padX, row2Y);
        }

        outCtx.restore();

        const safeEquip = (equipmentName ?? '')
          .trim()
          .replace(/[\\/:*?"<>|]+/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 64);
        const equipSegment = safeEquip ? `-${safeEquip}` : '';
        const rotSegment = sensorRotActive ? `-rot${Math.round(normSensorRot)}` : '';
        const filename = `noxchart-사진화각${equipSegment}-${sensorW.toFixed(2)}x${sensorH.toFixed(2)}deg${rotSegment}-ra${view.ra.toFixed(2)}-dec${view.dec.toFixed(1)}.png`;

        const link = document.createElement('a');
        link.download = filename;
        link.href = outCanvas.toDataURL('image/png');
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

    const getActivePinchGeometry = () => {
      const pts = Array.from(activePointersRef.current.values());
      if (pts.length < 2) return null;
      const [a, b] = pts;
      return {
        dist: Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      cancelCenterAnim();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture is unsupported
      }
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Multi-touch pinch-to-zoom (mobile / tablet)
      if (activePointersRef.current.size >= 2) {
        dragRef.current = null;
        const geom = getActivePinchGeometry();
        if (geom) {
          pinchRef.current = {
            active: true,
            initialDist: geom.dist,
            initialMidX: geom.midX,
            initialMidY: geom.midY,
            initialView: { ...view },
          };
          onUnlockCenter?.();
          setHoveredTarget(null);
        }
        return;
      }

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
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Active 2-finger pinch zoom + gentle midpoint pan
      const pinch = pinchRef.current;
      if (pinch && pinch.active && activePointersRef.current.size >= 2) {
        const geom = getActivePinchGeometry();
        if (geom) {
          const ratio = pinch.initialDist / geom.dist;
          const initTan = Math.tan((pinch.initialView.fsz * DEG2RAD) / 4);
          const nextFsz = Math.max(
            MIN_FSZ_DEG,
            Math.min(180, 4 * Math.atan(initTan * ratio) * RAD2DEG)
          );
          const dxMid = geom.midX - pinch.initialMidX;
          const dyMid = geom.midY - pinch.initialMidY;
          let nextRa = pinch.initialView.ra;
          let nextDec = pinch.initialView.dec;
          if (Math.hypot(dxMid, dyMid) > 1.5) {
            const panProj = createProjectionParams(
              { ...pinch.initialView, fsz: nextFsz, flipH: false, flipV: false },
              size.width,
              size.height,
              lstDeg,
              observer.lat,
              0
            );
            const nextCenter = unprojectStereographic(
              size.width / 2 - dxMid,
              size.height / 2 - dyMid,
              panProj
            );
            if (nextCenter) {
              nextRa = ((nextCenter.raDeg / 15) % 24 + 24) % 24;
              nextDec = Math.max(-89.5, Math.min(89.5, nextCenter.decDeg));
            }
          }
          onChangeView((prev) => ({
            ...prev,
            fsz: nextFsz,
            ra: nextRa,
            dec: nextDec,
          }));
          setHoveredTarget(null);
        }
        return;
      }

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

    const finishPointer = (
      e: React.PointerEvent<HTMLCanvasElement>,
      isCancel: boolean
    ) => {
      activePointersRef.current.delete(e.pointerId);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if not captured
      }

      if (pinchRef.current?.active) {
        if (activePointersRef.current.size < 2) {
          pinchRef.current = null;
          // If one finger remains on screen after pinch, continue panning smoothly without stray click
          if (activePointersRef.current.size === 1) {
            const remaining = Array.from(activePointersRef.current.values())[0];
            const rect = e.currentTarget.getBoundingClientRect();
            const eff = getEffectiveTransformAtPoint(
              remaining.x - rect.left,
              remaining.y - rect.top,
              view
            );
            dragRef.current = {
              active: true,
              startX: remaining.x,
              startY: remaining.y,
              moved: true,
              startView: { ...eff.view },
              startRotationDeg: eff.rotationDeg,
            };
          } else {
            dragRef.current = null;
          }
        }
        return;
      }

      const drag = dragRef.current;
      dragRef.current = null;
      if (isCancel) return;

      if (drag && !drag.moved) {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const hit = findHitTarget(clickX, clickY);

        if (challengePickMode && onChallengeChartPick) {
          if (hit) {
            onChallengeChartPick({
              item: hit.item,
              raDeg: hit.item.data.ra,
              decDeg: hit.item.data.dec,
            });
          } else {
            const eff = getEffectiveTransformAtPoint(clickX, clickY, view);
            const proj = createProjectionParams(
              eff.view,
              size.width,
              size.height,
              lstDeg,
              observer.lat,
              eff.rotationDeg
            );
            const unproj = unprojectStereographic(clickX, clickY, proj);
            if (unproj) {
              onChallengeChartPick({
                item: null,
                raDeg: unproj.raDeg,
                decDeg: unproj.decDeg,
              });
            }
          }
          return;
        }

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

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      finishPointer(e, false);
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
      finishPointer(e, true);
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (challengePickMode) return;
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
      onSelect(targetItem, { hideSelectionMark: true });
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

    const hudLeftPx = leftDrawerOpen && size.width >= 640 ? 282 : size.width >= 1024 ? 16 : 12;
    const hudRightPx = rightDrawerOpen && size.width >= 640 ? 282 : 12;
    const topControlsWidthPx = 276;
    const topRowAvailablePx = size.width - hudLeftPx - hudRightPx - topControlsWidthPx;
    const stackHudBelowControls = size.width < 768 || topRowAvailablePx < 420;
    const hudMaxWidthPx = stackHudBelowControls
      ? Math.max(200, size.width - hudLeftPx - hudRightPx)
      : Math.max(240, topRowAvailablePx - 12);

    return (
      <div
        id="chart-stage"
        ref={containerRef}
        className="relative flex-1 h-full overflow-hidden select-none"
      >
        {/* Native WebGL HEALPix HiPS Photographic Sky Background */}
        <HipsBackground
          ref={hipsRef}
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
          onPointerCancel={handlePointerCancel}
          onDoubleClick={handleDoubleClick}
          onPointerLeave={() => {
            setHoveredTarget(null);
            setPointerEq(null);
            setPointerScreen(null);
          }}
          onWheel={handleWheel}
          className="relative z-10 block w-full h-full cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />

        {/* Top-Left Live Coordinate & Object Count Telemetry HUD (strictly single line, matched h-9 height with right FOV controls) */}
        <div
          className={`no-print pointer-events-none absolute z-20 h-9 flex items-center border px-2.5 sm:px-3 text-[10.5px] sm:text-[11px] lg:text-xs font-mono tabular-nums backdrop-blur-sm transition-[left,top] duration-200 ease-out overflow-hidden ${ui.hudOverlay}`}
          style={{
            borderRadius: '6px',
            left: `${hudLeftPx}px`,
            top: stackHudBelowControls ? '54px' : '12px',
            maxWidth: `${hudMaxWidthPx}px`,
          }}
        >
          <div className="flex flex-nowrap items-center gap-x-1.5 sm:gap-x-2 whitespace-nowrap overflow-hidden">
            <span className={`shrink-0 ${ui.accentText}`}>
              {view.coordSystem === 'horizontal' ? (
                <>
                  지평<span className="hidden sm:inline"> (Alt/Az)</span>
                </>
              ) : (
                <>
                  적도<span className="hidden sm:inline"> (RA/Dec)</span>
                </>
              )}
            </span>
            <span aria-hidden="true" className={`shrink-0 ${ui.textMuted}`}>·</span>
            <span className={`shrink-0 ${ui.textPrimary}`}>
              {view.coordSystem === 'horizontal'
                ? `고도 ${centerAltAz.altDeg.toFixed(1)}° · 방위각 ${centerAltAz.azDeg.toFixed(1)}° (${getCompassDirection(centerAltAz.azDeg)})`
                : `RA ${formatRA(view.ra * 15)} · Dec ${formatDec(view.dec)}`}
            </span>
            <span aria-hidden="true" className={`shrink-0 ${ui.textMuted}`}>·</span>
            <span className={`shrink-0 ${ui.textMuted}`}>천체 {renderStats.stars + renderStats.dsos}개</span>
            {observer.minAltitudeDeg > -90 && (
              <>
                <span aria-hidden="true" className={`shrink-0 ${ui.textMuted}`}>·</span>
                <span className={`shrink-0 ${ui.accentText}`}>
                  고도 ≥{observer.minAltitudeDeg}° ({observer.highlightAboveMinAlt ? '흐림' : '숨김'})
                </span>
              </>
            )}
            {centerLocked && selected && (
              <>
                <span aria-hidden="true" className={`shrink-0 ${ui.textMuted}`}>·</span>
                <span className={`truncate ${ui.accentText}`}>
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
                <span aria-hidden="true" className={`shrink-0 ${ui.textMuted}`}>·</span>
                <span className={`shrink-0 ${ui.accentText}`}>
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
            className={`no-print pointer-events-none absolute z-20 bottom-3 border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-mono tabular-nums backdrop-blur-sm transition-[left] duration-200 ease-out overflow-hidden ${ui.hudOverlay}`}
            style={{
              borderRadius: '6px',
              left: `${hudLeftPx}px`,
              maxWidth: `${Math.max(200, size.width - hudLeftPx - 12)}px`,
            }}
          >
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 whitespace-nowrap overflow-hidden">
              <Crosshair className="w-3.5 h-3.5 shrink-0" />
              <span className="shrink-0">
                RA {formatRA(pointerEq.raDeg)} · Dec {formatDec(pointerEq.decDeg)}
              </span>
              <span aria-hidden="true" className="shrink-0">|</span>
              <span className="shrink-0">
                고도 {pointerAltAz.altDeg.toFixed(1)}° · 방위각 {pointerAltAz.azDeg.toFixed(1)}° (
                {getCompassDirection(pointerAltAz.azDeg)})
              </span>
            </div>
          </div>
        )}

        {/* Bottom-Right Challenge Route Picking Banner */}
        {challengePickMode && (
          <div
            className={`no-print absolute z-20 bottom-3 border px-2.5 py-1.5 text-[11px] backdrop-blur-sm transition-[right] duration-200 ease-out flex items-center gap-2 shadow-lg ${ui.hudOverlay}`}
            style={{ borderRadius: '6px', right: rightDrawerOpen ? '282px' : '12px' }}
          >
            <MapPin className={`w-3.5 h-3.5 shrink-0 ${ui.accentText}`} />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={`font-semibold ${ui.accentText}`}>
                체크포인트 지정 중 ({challengeDraftCount})
              </span>
              <span className={`hidden sm:inline text-[10.5px] ${ui.textMuted}`}>
                · {challengePickAllowEmpty ? '천체 또는 빈 위치 클릭' : '천체 클릭으로 추가'}
              </span>
            </div>
            {challengeDraftCount > 0 && onUndoChallengeCheckpoint && (
              <button
                type="button"
                onClick={onUndoChallengeCheckpoint}
                title="방금 추가한 체크포인트 취소"
                className={`px-1.5 py-0.5 border text-[10px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                style={{ borderRadius: '4px' }}
              >
                <Undo2 className="w-3 h-3" />
                <span>실행 취소</span>
              </button>
            )}
          </div>
        )}

        {/* Top-Right Quick Viewport Controls (Zoom, 180° All-Sky, Flip H/V — exact h-9 height matching left HUD) */}
        <div
          className={`no-print absolute z-20 top-3 h-9 flex items-center gap-1 border px-1 backdrop-blur-sm transition-[right] duration-200 ease-out ${ui.hudOverlay}`}
          style={{ borderRadius: '6px', right: rightDrawerOpen ? '282px' : '12px' }}
        >
          <button
            type="button"
            onClick={() =>
              onChangeView((p) => ({ ...p, fsz: Math.max(MIN_FSZ_DEG, p.fsz * 0.72) }))
            }
            title="확대 (Zoom In)"
            aria-label="확대"
            className={`w-7 h-7 flex items-center justify-center border transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div
            title={`현재 시야각 (FOV): ${formattedFov}`}
            className={`h-7 px-1.5 min-w-[50px] flex items-center justify-center font-mono text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 select-none ${ui.accentText}`}
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
            className={`w-7 h-7 flex items-center justify-center border transition-colors whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeView((p) => ({ ...p, fsz: 180 }))}
            title="180° 전천 평사 도법 뷰"
            className={`h-7 px-2 border text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
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
            className={`h-7 px-2 border text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
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
            className={`h-7 px-2 border text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
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
            {challengePickMode && (
              <div className={`mt-1 pt-1 border-t text-[10.5px] font-semibold flex items-center gap-1 ${ui.divider} ${ui.accentText}`}>
                <Plus className="w-3 h-3 shrink-0" />
                <span>클릭하여 체크포인트 추가</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
