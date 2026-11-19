import {
  CatalogSnapshot,
  GAIA_LIVE_MAX_FSZ,
  getVisibleUltraTileKeys,
} from '../data/catalogLoader';
import { getFieldStarsInBounds } from '../data/stars';
import {
  ChartViewState,
  DeepSkyObject,
  HipsSettings,
  LayerSettings,
  MilkyWayLayer,
  NebulaContour,
  ObserverConfig,
  OpticsSettings,
  ScreenTarget,
  SelectedItem,
  Star,
  StarHopGuide,
  ThemeMode,
} from '../types/astronomy';
import {
  angularDistanceDeg,
  bvToStarColor,
  createProjectionParams,
  DEG2RAD,
  equatorialToHorizontal,
  findStarHopGuides,
  getLimitingMagnitude,
  getLSTDeg,
  getPixelsPerDeg,
  getStarRadiusPogson,
  horizontalToEquatorial,
  projectHorizontalRaw,
  projectStereographic,
  projectStereographicRaw,
  ProjectionParams,
  RAD2DEG,
} from './astronomy';
import { LabelPlacer } from './labelPlacer';
import { getPlanetRenderer } from './planetRenderer';
import { getSolarSystemBodies, getSolarSystemOrbitTracks } from './solarSystem';

export interface ThemePalette {
  bg: string;
  skyCircleBg: string;
  starHaloStroke: string;
  belowHorizonFill: string;
  minAltStroke: string;
  minAltText: string;
  milkyWayFill: string;
  nebulaContourFill: [string, string, string];
  nebulaContourStroke: [string, string, string];
  darkNebulaFill: string;
  darkNebulaStroke: string;
  gridEq: string;
  gridEqText: string;
  gridAltAz: string;
  gridAltAzText: string;
  horizonStroke: string;
  horizonText: string;
  eclipticStroke: string;
  constellationLine: string;
  constellationBoundary: string;
  constellationName: string;
  dsoColor: Record<string, string>;
  dsoLabel: string;
  starLabel: string;
  reticleTelrad: string;
  reticleEyepiece: string;
  reticleSensor: string;
  starHop: string;
  selectionRing: string;
}

/**
 * Independent 3-Mode Color Palettes (Dark Obsidian / White Print Atlas / Red Night Scotopic).
 */
export function getThemePalette(theme: ThemeMode): ThemePalette {
  if (theme === 'white') {
    return {
      bg: '#F1F5F9',
      skyCircleBg: '#FFFFFF',
      starHaloStroke: '#FFFFFF',
      belowHorizonFill: 'rgba(15, 23, 42, 0.065)',
      minAltStroke: 'rgba(37, 99, 235, 0.72)',
      minAltText: '#1D4ED8',
      milkyWayFill: 'rgba(100, 116, 139, 0.085)',
      nebulaContourFill: [
        'rgba(5, 150, 105, 0.055)',
        'rgba(5, 150, 105, 0.11)',
        'rgba(4, 120, 87, 0.19)',
      ],
      nebulaContourStroke: [
        'rgba(4, 120, 87, 0.36)',
        'rgba(4, 120, 87, 0.56)',
        'rgba(6, 95, 70, 0.78)',
      ],
      darkNebulaFill: 'rgba(51, 65, 85, 0.11)',
      darkNebulaStroke: 'rgba(51, 65, 85, 0.62)',
      gridEq: 'rgba(15, 23, 42, 0.14)',
      gridEqText: 'rgba(15, 23, 42, 0.58)',
      gridAltAz: 'rgba(37, 99, 235, 0.17)',
      gridAltAzText: 'rgba(29, 78, 216, 0.65)',
      horizonStroke: '#DC2626',
      horizonText: '#B91C1C',
      eclipticStroke: 'rgba(180, 83, 9, 0.48)',
      constellationLine: 'rgba(30, 58, 138, 0.38)',
      constellationBoundary: 'rgba(71, 85, 105, 0.32)',
      constellationName: 'rgba(30, 41, 59, 0.46)',
      dsoColor: {
        GX: '#B91C1C',
        OC: '#B45309',
        GC: '#9A3412',
        DN: '#047857',
        DARK: '#475569',
        PN: '#0F766E',
        SNR: '#6D28D9',
        AST: '#475569',
      },
      dsoLabel: '#0F172A',
      starLabel: '#334155',
      reticleTelrad: '#DC2626',
      reticleEyepiece: '#2563EB',
      reticleSensor: '#059669',
      starHop: '#D97706',
      selectionRing: '#2563EB',
    };
  }

  if (theme === 'red') {
    return {
      bg: '#040000',
      skyCircleBg: '#080101',
      starHaloStroke: '#080101',
      belowHorizonFill: 'rgba(69, 10, 10, 0.34)',
      minAltStroke: 'rgba(248, 113, 113, 0.72)',
      minAltText: '#FCA5A5',
      milkyWayFill: 'rgba(153, 27, 27, 0.068)',
      nebulaContourFill: [
        'rgba(185, 28, 28, 0.075)',
        'rgba(220, 38, 38, 0.13)',
        'rgba(239, 68, 68, 0.20)',
      ],
      nebulaContourStroke: [
        'rgba(185, 28, 28, 0.40)',
        'rgba(220, 38, 38, 0.58)',
        'rgba(248, 113, 113, 0.72)',
      ],
      darkNebulaFill: 'rgba(20, 2, 2, 0.55)',
      darkNebulaStroke: 'rgba(185, 28, 28, 0.55)',
      gridEq: 'rgba(220, 38, 38, 0.16)',
      gridEqText: 'rgba(239, 68, 68, 0.58)',
      gridAltAz: 'rgba(239, 68, 68, 0.22)',
      gridAltAzText: 'rgba(248, 113, 113, 0.65)',
      horizonStroke: 'rgba(239, 68, 68, 0.72)',
      horizonText: '#F87171',
      eclipticStroke: 'rgba(185, 28, 28, 0.40)',
      constellationLine: 'rgba(220, 38, 38, 0.34)',
      constellationBoundary: 'rgba(153, 27, 27, 0.34)',
      constellationName: 'rgba(239, 68, 68, 0.40)',
      dsoColor: {
        GX: '#EF4444',
        OC: '#DC2626',
        GC: '#EF4444',
        DN: '#B91C1C',
        DARK: '#991B1B',
        PN: '#F87171',
        SNR: '#DC2626',
        AST: '#B91C1C',
      },
      dsoLabel: '#EF4444',
      starLabel: '#DC2626',
      reticleTelrad: '#DC2626',
      reticleEyepiece: '#EF4444',
      reticleSensor: '#DC2626',
      starHop: '#EF4444',
      selectionRing: '#FF3B3B',
    };
  }

  // Dark Mode (Deep Space Obsidian)
  return {
    bg: '#05070C',
    skyCircleBg: '#070A12',
    starHaloStroke: '#070A12',
    belowHorizonFill: 'rgba(2, 6, 18, 0.58)',
    minAltStroke: 'rgba(34, 211, 238, 0.72)',
    minAltText: '#22D3EE',
    milkyWayFill: 'rgba(148, 163, 184, 0.045)',
    nebulaContourFill: [
      'rgba(16, 185, 129, 0.065)',
      'rgba(20, 184, 166, 0.12)',
      'rgba(52, 211, 153, 0.20)',
    ],
    nebulaContourStroke: [
      'rgba(52, 211, 153, 0.32)',
      'rgba(52, 211, 153, 0.52)',
      'rgba(110, 231, 183, 0.72)',
    ],
    darkNebulaFill: 'rgba(3, 5, 10, 0.52)',
    darkNebulaStroke: 'rgba(148, 163, 184, 0.46)',
    gridEq: 'rgba(148, 163, 184, 0.14)',
    gridEqText: 'rgba(148, 163, 184, 0.56)',
    gridAltAz: 'rgba(6, 182, 212, 0.16)',
    gridAltAzText: 'rgba(34, 211, 238, 0.62)',
    horizonStroke: 'rgba(245, 158, 11, 0.65)',
    horizonText: '#F59E0B',
    eclipticStroke: 'rgba(245, 158, 11, 0.32)',
    constellationLine: 'rgba(100, 149, 237, 0.36)',
    constellationBoundary: 'rgba(148, 163, 184, 0.24)',
    constellationName: 'rgba(148, 163, 184, 0.38)',
    dsoColor: {
      GX: '#FB7185',
      OC: '#FBBF24',
      GC: '#F59E0B',
      DN: '#34D399',
      DARK: '#94A3B8',
      PN: '#22D3EE',
      SNR: '#A78BFA',
      AST: '#94A3B8',
    },
    dsoLabel: '#E2E8F0',
    starLabel: '#94A3B8',
    reticleTelrad: '#EF4444',
    reticleEyepiece: '#06B6D4',
    reticleSensor: '#10B981',
    starHop: '#F59E0B',
    selectionRing: '#06B6D4',
  };
}

function galacticToEquatorial(lDeg: number, bDeg: number): { raDeg: number; decDeg: number } {
  const l = lDeg * DEG2RAD;
  const b = bDeg * DEG2RAD;
  const decNGP = 27.12825 * DEG2RAD;
  const raNGP = 192.85948 * DEG2RAD;
  const lNCP = 122.93192 * DEG2RAD;

  const sinDec =
    Math.sin(b) * Math.sin(decNGP) +
    Math.cos(b) * Math.cos(decNGP) * Math.cos(lNCP - l);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  const y = Math.cos(b) * Math.sin(lNCP - l);
  const x =
    Math.sin(b) * Math.cos(decNGP) -
    Math.cos(b) * Math.sin(decNGP) * Math.cos(lNCP - l);
  const ra = raNGP + Math.atan2(y, x);

  return {
    raDeg: ((ra * RAD2DEG) % 360 + 360) % 360,
    decDeg: dec * RAD2DEG,
  };
}

function drawProjectedCurve(
  ctx: CanvasRenderingContext2D,
  points: { raDeg: number; decDeg: number }[],
  proj: ProjectionParams,
  closed = false
) {
  let started = false;
  let prevX = 0;
  let prevY = 0;
  const jumpThreshold = Math.max(proj.width, proj.height) * 0.45;

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = projectStereographicRaw(points[i].raDeg, points[i].decDeg, proj);
    if (!pt) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(pt.x, pt.y);
      started = true;
    } else if (Math.hypot(pt.x - prevX, pt.y - prevY) > jumpThreshold) {
      ctx.moveTo(pt.x, pt.y);
    } else {
      ctx.lineTo(pt.x, pt.y);
    }
    prevX = pt.x;
    prevY = pt.y;
  }
  if (closed && started) {
    const first = projectStereographicRaw(points[0].raDeg, points[0].decDeg, proj);
    if (first && Math.hypot(first.x - prevX, first.y - prevY) < jumpThreshold) {
      ctx.lineTo(first.x, first.y);
    }
  }
  ctx.stroke();
}

function drawProjectedTupleCurve(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  proj: ProjectionParams
) {
  let started = false;
  let prevX = 0;
  let prevY = 0;
  const jumpThreshold = Math.max(proj.width, proj.height) * 0.45;

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = projectStereographicRaw(points[i][0], points[i][1], proj);
    if (!pt) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(pt.x, pt.y);
      started = true;
    } else if (Math.hypot(pt.x - prevX, pt.y - prevY) > jumpThreshold) {
      ctx.moveTo(pt.x, pt.y);
    } else {
      ctx.lineTo(pt.x, pt.y);
    }
    prevX = pt.x;
    prevY = pt.y;
  }
  ctx.stroke();
}

function drawMilkyWayContours(
  ctx: CanvasRenderingContext2D,
  layers: MilkyWayLayer[],
  proj: ProjectionParams,
  fillStyle: string
) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  const jumpThreshold = Math.max(proj.width, proj.height) * 0.48;

  for (const layer of layers) {
    for (const poly of layer.polys) {
      let validPts = 0;
      let prevX = 0;
      let prevY = 0;
      let broken = false;

      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const pt = projectStereographicRaw(poly[i][0], poly[i][1], proj);
        if (!pt) {
          broken = true;
          break;
        }
        if (validPts === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          if (Math.hypot(pt.x - prevX, pt.y - prevY) > jumpThreshold) {
            broken = true;
            break;
          }
          ctx.lineTo(pt.x, pt.y);
        }
        prevX = pt.x;
        prevY = pt.y;
        validPts++;
      }
      if (!broken && validPts >= 3) {
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/**
 * Draw FChart3 / CZSky Multi-Level Brightness Nebula Contours (lv1 outer -> lv2 mid -> lv3 core)
 * respecting the observer's minimum altitude filter.
 */
function drawNebulaContours(
  ctx: CanvasRenderingContext2D,
  contours: NebulaContour[],
  proj: ProjectionParams,
  palette: ThemePalette,
  observer: ObserverConfig,
  lstDeg: number
) {
  if (contours.length === 0) return;
  const viewHalfRadius = proj.fovDeg * 0.85;
  const jumpThreshold = Math.max(proj.width, proj.height) * 0.45;
  const altFilterActive = observer.minAltitudeDeg > -90;

  ctx.save();
  for (const targetLv of [1, 2, 3] as const) {
    ctx.fillStyle = palette.nebulaContourFill[targetLv - 1];
    ctx.strokeStyle = palette.nebulaContourStroke[targetLv - 1];
    ctx.lineWidth = targetLv === 1 ? 0.85 : targetLv === 2 ? 1.0 : 1.15;
    if (targetLv === 1) ctx.setLineDash([4, 3]);
    else if (targetLv === 2) ctx.setLineDash([2, 2]);
    else ctx.setLineDash([]);

    for (let idx = 0; idx < contours.length; idx++) {
      const c = contours[idx];
      if (c.lv !== targetLv) continue;
      const dist = angularDistanceDeg(proj.ra0Deg, proj.dec0Deg, c.c[0], c.c[1]);
      if (dist > viewHalfRadius + c.c[2] + 2) continue;

      let dimmed = false;
      if (altFilterActive) {
        const { altDeg } = equatorialToHorizontal(c.c[0], c.c[1], lstDeg, observer.lat);
        if (altDeg < observer.minAltitudeDeg) {
          if (!observer.highlightAboveMinAlt) continue;
          dimmed = true;
        }
      }

      let validPts = 0;
      let prevX = 0;
      let prevY = 0;
      let broken = false;

      ctx.beginPath();
      for (let i = 0; i < c.p.length; i++) {
        const pt = projectStereographicRaw(c.p[i][0], c.p[i][1], proj);
        if (!pt) {
          broken = true;
          break;
        }
        if (validPts === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          if (Math.hypot(pt.x - prevX, pt.y - prevY) > jumpThreshold) {
            broken = true;
            break;
          }
          ctx.lineTo(pt.x, pt.y);
        }
        prevX = pt.x;
        prevY = pt.y;
        validPts++;
      }

      if (!broken && validPts >= 3) {
        ctx.closePath();
        ctx.globalAlpha = dimmed ? 0.22 : 1.0;
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawDsoSymbol(
  ctx: CanvasRenderingContext2D,
  dso: DeepSkyObject,
  x: number,
  y: number,
  pxPerDeg: number,
  color: string,
  palette: ThemePalette,
  proj: ProjectionParams,
  dimmed: boolean
): number {
  ctx.save();
  ctx.globalAlpha = dimmed ? 0.18 : 0.92;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.25;

  const majPx = Math.max(5.0, (dso.majAx / 60) * pxPerDeg * 0.5);
  const minPx = Math.max(3.0, (dso.minAx / 60) * pxPerDeg * 0.5);

  if (dso.type === 'GX') {
    ctx.translate(x, y);
    const flipSign = (proj.flipH ? -1 : 1) * (proj.flipV ? -1 : 1);
    const rotDeg = (90 - dso.pa) * flipSign + proj.northAngleDeg;
    ctx.rotate(rotDeg * DEG2RAD);
    ctx.beginPath();
    ctx.ellipse(0, 0, majPx, Math.min(majPx, Math.max(2.4, minPx)), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return majPx;
  }

  if (dso.type === 'DARK') {
    const rx = Math.max(5.5, Math.min(80, majPx));
    const ry = Math.max(4.0, Math.min(80, Math.min(rx, minPx)));
    ctx.translate(x, y);
    const flipSign = (proj.flipH ? -1 : 1) * (proj.flipV ? -1 : 1);
    ctx.rotate(((90 - dso.pa) * flipSign + proj.northAngleDeg) * DEG2RAD);
    ctx.fillStyle = palette.darkNebulaFill;
    ctx.strokeStyle = palette.darkNebulaStroke;
    ctx.lineWidth = 1.1;
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return rx;
  }

  if (dso.type === 'OC') {
    const r = Math.max(5.0, Math.min(48, majPx));
    ctx.setLineDash([3, 2.5]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return r;
  }

  if (dso.type === 'GC') {
    const r = Math.max(5.0, Math.min(36, majPx));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
    ctx.restore();
    return r;
  }

  if (dso.type === 'DN' || dso.type === 'SNR') {
    const r = Math.max(5.5, Math.min(54, majPx));
    if (dso.type === 'SNR') ctx.setLineDash([3, 2]);
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
    return r;
  }

  if (dso.type === 'PN') {
    const r = Math.max(4.5, Math.min(20, majPx));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const tick = Math.max(3.5, r * 0.65);
    ctx.moveTo(x - r - tick, y);
    ctx.lineTo(x - r, y);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + r + tick, y);
    ctx.moveTo(x, y - r - tick);
    ctx.lineTo(x, y - r);
    ctx.moveTo(x, y + r);
    ctx.lineTo(x, y + r + tick);
    ctx.stroke();
    ctx.restore();
    return r + 3;
  }

  const r = Math.max(5.5, Math.min(40, majPx));
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  return r;
}

function matchesCatalogFilter(
  dso: DeepSkyObject,
  filter: LayerSettings['catalogFilter']
): boolean {
  if (filter === 'all') return true;
  if (filter === 'messier') return dso.id.startsWith('M');
  if (filter === 'ngc') {
    return dso.id.startsWith('NGC') || Boolean(dso.altId?.startsWith('NGC'));
  }
  if (filter === 'ic') {
    return dso.id.startsWith('IC') || Boolean(dso.altId?.startsWith('IC'));
  }
  if (filter === 'barnard') {
    return dso.type === 'DARK';
  }
  return true;
}

function drawTerrainSilhouette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ChartViewState,
  theme: ThemeMode,
  proj: ProjectionParams,
  lstDeg: number,
  observerLat: number,
  showHorizonCardinals: boolean,
  horizonTextColor: string
) {
  const groundFillTop =
    theme === 'white'
      ? 'rgba(148, 163, 184, 0.22)'
      : theme === 'red'
      ? 'rgba(26, 3, 3, 0.58)'
      : 'rgba(11, 20, 34, 0.60)';
  const groundFillBot =
    theme === 'white'
      ? 'rgba(100, 116, 139, 0.30)'
      : theme === 'red'
      ? 'rgba(11, 1, 1, 0.68)'
      : 'rgba(5, 10, 19, 0.70)';
  const horizonEdgeStroke =
    theme === 'white'
      ? 'rgba(71, 85, 105, 0.45)'
      : theme === 'red'
      ? 'rgba(180, 48, 48, 0.45)'
      : 'rgba(56, 189, 248, 0.36)';

  const projectAltAz = (altDeg: number, azDeg: number) => {
    if (view.coordSystem === 'horizontal') {
      return projectHorizontalRaw(altDeg, azDeg, proj, -0.78);
    }
    const eq = horizontalToEquatorial(altDeg, azDeg, lstDeg, observerLat);
    return projectStereographicRaw(eq.raDeg, eq.decDeg, proj, -0.78);
  };

  const renderRidgeBand = (
    altFn: (az: number) => number,
    fillStyle: string | CanvasGradient,
    strokeStyle?: string
  ) => {
    const stepDeg = 1.5;
    const totalSteps = Math.round(360 / stepDeg);
    const maxJump = Math.max(width, height) * 0.65;
    const maxCoord = Math.max(width, height) * 6;

    const samples: ({ x: number; y: number; az: number; alt: number } | null)[] = [];
    let allValid = true;
    let anyNearViewport = false;

    for (let i = 0; i < totalSteps; i++) {
      const az = i * stepDeg;
      const alt = altFn(az);
      const p = projectAltAz(alt, az);
      if (
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > maxCoord ||
        Math.abs(p.y) > maxCoord
      ) {
        samples.push(null);
        allValid = false;
      } else {
        samples.push({ x: p.x, y: p.y, az, alt });
        if (p.x >= -260 && p.x <= width + 260 && p.y >= -260 && p.y <= height + 260) {
          anyNearViewport = true;
        }
      }
    }

    // Check if the entire viewport is strictly above or below the horizon
    if (!anyNearViewport) {
      const centerAlt = proj.alt0Deg;
      if (centerAlt < 0) {
        ctx.save();
        ctx.fillStyle = fillStyle;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      return;
    }

    // Closed loop case (e.g., 180° all-sky dome or high-altitude wide view)
    if (allValid && samples.length > 20) {
      let seamless = true;
      for (let i = 0; i < samples.length; i++) {
        const a = samples[i]!;
        const b = samples[(i + 1) % samples.length]!;
        if (Math.hypot(b.x - a.x, b.y - a.y) > maxJump) {
          seamless = false;
          break;
        }
      }

      if (seamless) {
        ctx.save();
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        if (proj.alt0Deg >= 0) {
          // Looking into sky: exterior of closed terrain ring is ground
          ctx.rect(-40, -40, width + 80, height + 80);
          ctx.moveTo(samples[0]!.x, samples[0]!.y);
          for (let i = 1; i < samples.length; i++) {
            ctx.lineTo(samples[i]!.x, samples[i]!.y);
          }
          ctx.closePath();
          ctx.fill('evenodd');
        } else {
          // Looking into ground/nadir: interior of ring is ground
          ctx.moveTo(samples[0]!.x, samples[0]!.y);
          for (let i = 1; i < samples.length; i++) {
            ctx.lineTo(samples[i]!.x, samples[i]!.y);
          }
          ctx.closePath();
          ctx.fill();
        }

        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(samples[0]!.x, samples[0]!.y);
          for (let i = 1; i < samples.length; i++) {
            ctx.lineTo(samples[i]!.x, samples[i]!.y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
    }

    // Open arc case: find contiguous visible segments around the horizon
    const segments: { x: number; y: number; az: number; alt: number }[][] = [];
    let current: { x: number; y: number; az: number; alt: number }[] = [];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (!s) {
        if (current.length >= 2) segments.push(current);
        current = [];
        continue;
      }
      if (current.length > 0) {
        const prev = current[current.length - 1];
        if (Math.hypot(s.x - prev.x, s.y - prev.y) > maxJump) {
          if (current.length >= 2) segments.push(current);
          current = [s];
          continue;
        }
      }
      current.push(s);
    }
    if (current.length >= 2) segments.push(current);

    // Stitch wrap-around segment (az 358.5 -> 0) if continuous
    if (segments.length >= 2) {
      const firstSeg = segments[0];
      const lastSeg = segments[segments.length - 1];
      const endPt = lastSeg[lastSeg.length - 1];
      const startPt = firstSeg[0];
      if (Math.hypot(startPt.x - endPt.x, startPt.y - endPt.y) <= maxJump) {
        segments[0] = [...lastSeg, ...firstSeg];
        segments.pop();
      }
    }

    const farDist = Math.max(width, height) * 3.5;

    const getDownVec = (pt: { x: number; y: number; az: number; alt: number }) => {
      const pBelow = projectAltAz(pt.alt - 2.0, pt.az);
      if (pBelow) {
        const dx = pBelow.x - pt.x;
        const dy = pBelow.y - pt.y;
        const len = Math.hypot(dx, dy);
        if (len > 1e-3) return { dx: dx / len, dy: dy / len };
      }
      return { dx: 0, dy: view.flipV ? -1 : 1 };
    };

    for (const seg of segments) {
      const near = seg.some(
        (p) => p.x >= -260 && p.x <= width + 260 && p.y >= -260 && p.y <= height + 260
      );
      if (!near) continue;

      const first = seg[0];
      const mid = seg[Math.floor(seg.length / 2)];
      const last = seg[seg.length - 1];

      const dFirst = getDownVec(first);
      const dMid = getDownVec(mid);
      const dLast = getDownVec(last);

      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < seg.length; i++) {
        ctx.lineTo(seg[i].x, seg[i].y);
      }
      ctx.lineTo(last.x + dLast.dx * farDist, last.y + dLast.dy * farDist);
      ctx.lineTo(mid.x + dMid.dx * farDist, mid.y + dMid.dy * farDist);
      ctx.lineTo(first.x + dFirst.dx * farDist, first.y + dFirst.dy * farDist);
      ctx.closePath();
      ctx.fill();

      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x, seg[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // Translucent below-horizon ground veil strictly under Alt = 0°
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, groundFillTop);
  grad.addColorStop(1, groundFillBot);
  renderRidgeBand(() => 0, grad, horizonEdgeStroke);

  // Re-draw cardinal direction labels cleanly above the terrain ridge when horizon is on
  if (showHorizonCardinals) {
    ctx.save();
    ctx.fillStyle = horizonTextColor;
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    const cardinals =
      view.coordSystem === 'horizontal'
        ? [
            { az: 0, label: 'N 북' },
            { az: 45, label: 'NE' },
            { az: 90, label: 'E 동' },
            { az: 135, label: 'SE' },
            { az: 180, label: 'S 남' },
            { az: 225, label: 'SW' },
            { az: 270, label: 'W 서' },
            { az: 315, label: 'NW' },
          ]
        : [
            { az: 0, label: 'N 북' },
            { az: 90, label: 'E 동' },
            { az: 180, label: 'S 남' },
            { az: 270, label: 'W 서' },
          ];
    for (const c of cardinals) {
      const eq = horizontalToEquatorial(1.2, c.az, lstDeg, observerLat);
      const pt = projectStereographic(eq.raDeg, eq.decDeg, proj, 10);
      if (pt) {
        ctx.fillText(c.label, pt.x - 10, pt.y);
      }
    }
    ctx.restore();
  }
}

export interface RenderResult {
  targets: ScreenTarget[];
  magLimit: number;
  dsoMagLimit: number;
  visibleStarCount: number;
  visibleDsoCount: number;
  activeStarHop: StarHopGuide | null;
  northAngleDeg: number;
}

interface DrawableStar {
  star: Star;
  x: number;
  y: number;
  radius: number;
  isBright: boolean;
  isSelected: boolean;
  dimmed: boolean;
}

export function renderStarChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ChartViewState,
  theme: ThemeMode,
  layers: LayerSettings,
  optics: OpticsSettings,
  observer: ObserverConfig,
  hips: HipsSettings,
  catalogs: CatalogSnapshot,
  selected: SelectedItem | null,
  hoveredId: string | null,
  sessionIds: Set<string>
): RenderResult {
  const palette = getThemePalette(theme);
  const obsTimeMs = observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);
  const proj = createProjectionParams(view, width, height, lstDeg, observer.lat);

  const pxPerDeg = getPixelsPerDeg(view.fsz, width, height);
  const magLimit = getLimitingMagnitude(view.fsz, layers.magOffset);
  const hipsVisible = hips.enabled && hips.opacity > 0.02;
  const altFilterActive = observer.minAltitudeDeg > -90;

  // 1. Background Fill (Transparent when Aladin Lite v3 HiPS survey is active behind canvas)
  const halfSkyRadius = (Math.min(width, height) / 2) / Math.tan((view.fsz / 4) * DEG2RAD);
  if (hipsVisible) {
    ctx.clearRect(0, 0, width, height);
    if (view.fsz >= 145) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, halfSkyRadius, 0, Math.PI * 2);
      ctx.clip();
    }
  } else {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
    if (view.fsz >= 145) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, halfSkyRadius, 0, Math.PI * 2);
      ctx.fillStyle = palette.skyCircleBg;
      ctx.fill();
      ctx.clip();
    } else {
      ctx.fillStyle = palette.skyCircleBg;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 2. Milky Way (Suppressed when photographic HiPS is dominant)
  if (layers.showMilkyWay && (!hipsVisible || hips.opacity < 0.48)) {
    if (catalogs.milkyWay.length > 0 && view.fsz >= 18) {
      drawMilkyWayContours(ctx, catalogs.milkyWay, proj, palette.milkyWayFill);
    } else if (!hipsVisible) {
      ctx.save();
      ctx.strokeStyle = palette.milkyWayFill;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const bOffset of [-5, 0, 5]) {
        ctx.lineWidth = Math.max(18, pxPerDeg * (bOffset === 0 ? 15 : 9));
        const pts: { raDeg: number; decDeg: number }[] = [];
        for (let l = 0; l <= 360; l += 6) {
          pts.push(galacticToEquatorial(l, bOffset));
        }
        drawProjectedCurve(ctx, pts, proj, true);
      }
      ctx.restore();
    }
  }

  // 2.5. Real Multi-Level Nebula Contours (FChart3 / CZSky — 513 polygons across 193 nebulae)
  if (layers.showNebulaContours && catalogs.nebulaContours.length > 0 && view.fsz <= 95) {
    drawNebulaContours(ctx, catalogs.nebulaContours, proj, palette, observer, lstDeg);
  }

  // 3. Equatorial RA / Dec Grid
  if (layers.showGridEq) {
    const raStepDeg =
      view.fsz > 120 ? 30 : view.fsz > 45 ? 15 : view.fsz > 15 ? 7.5 : view.fsz > 5 ? 2.5 : 1;
    const decStepDeg =
      view.fsz > 120 ? 30 : view.fsz > 45 ? 15 : view.fsz > 15 ? 10 : view.fsz > 5 ? 5 : 1;

    ctx.save();
    ctx.strokeStyle = palette.gridEq;
    ctx.lineWidth = 0.85;
    ctx.fillStyle = palette.gridEqText;
    ctx.font = '10px "IBM Plex Mono", monospace';

    for (let d = -75; d <= 75; d += decStepDeg) {
      if (d === 0) {
        ctx.save();
        ctx.lineWidth = 1.25;
      }
      const pts: { raDeg: number; decDeg: number }[] = [];
      for (let r = 0; r <= 360; r += 5) {
        pts.push({ raDeg: r, decDeg: d });
      }
      drawProjectedCurve(ctx, pts, proj, true);
      if (d === 0) ctx.restore();

      const labelPt = projectStereographic(proj.ra0Deg, d, proj, 0);
      if (labelPt) {
        ctx.fillText(`${d >= 0 ? '+' : ''}${d}°`, labelPt.x + 4, labelPt.y - 4);
      }
    }

    for (let r = 0; r < 360; r += raStepDeg) {
      const pts: { raDeg: number; decDeg: number }[] = [];
      for (let d = -85; d <= 85; d += 5) {
        pts.push({ raDeg: r, decDeg: d });
      }
      drawProjectedCurve(ctx, pts, proj, false);

      const labelDec = Math.max(-75, Math.min(75, proj.dec0Deg));
      const labelPt = projectStereographic(r, labelDec, proj, 0);
      if (labelPt) {
        const hrs = Math.floor(r / 15);
        const mins = Math.round((r / 15 - hrs) * 60);
        const raTxt = mins > 0 ? `${hrs}h${String(mins).padStart(2, '0')}m` : `${hrs}h`;
        ctx.fillText(raTxt, labelPt.x + 3, labelPt.y + 11);
      }
    }
    ctx.restore();
  }

  // 4. Ecliptic Curve
  if (layers.showEcliptic) {
    ctx.save();
    ctx.strokeStyle = palette.eclipticStroke;
    ctx.lineWidth = 1.1;
    ctx.setLineDash([5, 5]);
    const eps = 23.4393 * DEG2RAD;
    const pts: { raDeg: number; decDeg: number }[] = [];
    for (let lam = 0; lam <= 360; lam += 5) {
      const lRad = lam * DEG2RAD;
      const sinDec = Math.sin(eps) * Math.sin(lRad);
      const decDeg = Math.asin(sinDec) * RAD2DEG;
      const raDeg =
        ((Math.atan2(Math.cos(eps) * Math.sin(lRad), Math.cos(lRad)) * RAD2DEG) + 360) % 360;
      pts.push({ raDeg, decDeg });
    }
    drawProjectedCurve(ctx, pts, proj, true);
    ctx.restore();
  }

  // 5. Alt-Az Grid & Local Horizon Circle (with Ground Dimming in Horizontal Mode)
  if (layers.showGridAltAz) {
    const azStep = view.fsz > 90 ? 30 : view.fsz > 30 ? 15 : view.fsz > 10 ? 5 : 2;
    const altStep = view.fsz > 90 ? 15 : view.fsz > 30 ? 10 : view.fsz > 10 ? 5 : 2;

    ctx.save();
    ctx.strokeStyle = palette.gridAltAz;
    ctx.lineWidth = 0.85;
    ctx.fillStyle = palette.gridAltAzText;
    ctx.font = '10px "IBM Plex Mono", monospace';

    for (let alt = -60; alt <= 80; alt += altStep) {
      if (alt === 0) continue;
      if (view.coordSystem === 'equatorial' && alt < 0) continue;
      const pts: { raDeg: number; decDeg: number }[] = [];
      for (let az = 0; az <= 360; az += 4) {
        pts.push(horizontalToEquatorial(alt, az, lstDeg, observer.lat));
      }
      drawProjectedCurve(ctx, pts, proj, true);

      if (view.coordSystem === 'horizontal') {
        const lbl = projectHorizontalRaw(alt, proj.az0Deg, proj, -0.1);
        if (lbl && lbl.x > 16 && lbl.x < width - 34 && lbl.y > 16 && lbl.y < height - 16) {
          ctx.fillText(`${alt > 0 ? '+' : ''}${alt}°`, lbl.x + 4, lbl.y - 3);
        }
      }
    }

    for (let az = 0; az < 360; az += azStep) {
      const pts: { raDeg: number; decDeg: number }[] = [];
      const minAlt = view.coordSystem === 'horizontal' ? -60 : 0;
      for (let alt = minAlt; alt <= 86; alt += 4) {
        pts.push(horizontalToEquatorial(alt, az, lstDeg, observer.lat));
      }
      drawProjectedCurve(ctx, pts, proj, false);

      if (view.coordSystem === 'horizontal') {
        const lblAlt = Math.max(2, Math.min(75, proj.alt0Deg));
        const lbl = projectHorizontalRaw(lblAlt, az, proj, -0.1);
        if (lbl && lbl.x > 16 && lbl.x < width - 34 && lbl.y > 16 && lbl.y < height - 16) {
          ctx.fillText(`${az}°`, lbl.x + 3, lbl.y + 11);
        }
      }
    }
    ctx.restore();
  }

  if (layers.showHorizon) {
    ctx.save();
    ctx.strokeStyle = palette.horizonStroke;
    ctx.lineWidth = 1.65;
    const horizonPts: { raDeg: number; decDeg: number }[] = [];
    for (let az = 0; az <= 360; az += 3) {
      horizonPts.push(horizontalToEquatorial(0, az, lstDeg, observer.lat));
    }
    drawProjectedCurve(ctx, horizonPts, proj, true);

    ctx.fillStyle = palette.horizonText;
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    const cardinals =
      view.coordSystem === 'horizontal'
        ? [
            { az: 0, label: 'N 북' },
            { az: 45, label: 'NE' },
            { az: 90, label: 'E 동' },
            { az: 135, label: 'SE' },
            { az: 180, label: 'S 남' },
            { az: 225, label: 'SW' },
            { az: 270, label: 'W 서' },
            { az: 315, label: 'NW' },
          ]
        : [
            { az: 0, label: 'N 북' },
            { az: 90, label: 'E 동' },
            { az: 180, label: 'S 남' },
            { az: 270, label: 'W 서' },
          ];
    for (const c of cardinals) {
      const eq = horizontalToEquatorial(1.4, c.az, lstDeg, observer.lat);
      const pt = projectStereographic(eq.raDeg, eq.decDeg, proj, 10);
      if (pt) {
        ctx.fillText(c.label, pt.x - 10, pt.y);
      }
    }
    ctx.restore();
  }

  // 5.2. Visual Minimum Altitude Cutoff Ring when Altitude Filter is Active
  if (altFilterActive) {
    ctx.save();
    ctx.strokeStyle = palette.minAltStroke;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    const minAltPts: { raDeg: number; decDeg: number }[] = [];
    for (let az = 0; az <= 360; az += 3) {
      minAltPts.push(horizontalToEquatorial(observer.minAltitudeDeg, az, lstDeg, observer.lat));
    }
    drawProjectedCurve(ctx, minAltPts, proj, true);
    ctx.setLineDash([]);

    const lblEq = horizontalToEquatorial(observer.minAltitudeDeg, proj.az0Deg, lstDeg, observer.lat);
    const lblPt = projectStereographic(lblEq.raDeg, lblEq.decDeg, proj, 0);
    if (lblPt) {
      ctx.font = '600 10.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = palette.minAltText;
      ctx.fillText(`최소고도 ${observer.minAltitudeDeg}°`, lblPt.x + 6, lblPt.y - 6);
    }
    ctx.restore();
  }

  // 5.5. IAU Constellation Boundaries (782 polylines)
  if (layers.showConstellationBoundaries && catalogs.constellationBoundaries.length > 0) {
    ctx.save();
    ctx.strokeStyle = palette.constellationBoundary;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i < catalogs.constellationBoundaries.length; i++) {
      drawProjectedTupleCurve(ctx, catalogs.constellationBoundaries[i], proj);
    }
    ctx.restore();
  }

  // 6. All 88 IAU Constellation Stick Figures (Modern IAU vs Traditional Classical) & Names
  if (layers.showConstellationLines) {
    ctx.save();
    ctx.strokeStyle = palette.constellationLine;
    ctx.lineWidth = view.fsz > 80 ? 1.0 : 1.25;
    const useTraditional = layers.constellationLineStyle === 'traditional';

    for (const con of catalogs.constellations) {
      const activeLines =
        useTraditional && con.traditionalLines && con.traditionalLines.length > 0
          ? con.traditionalLines
          : con.lines;

      for (const [ra1, dec1, ra2, dec2] of activeLines) {
        const pts: { raDeg: number; decDeg: number }[] = [];
        let dRa = ra2 - ra1;
        if (dRa > 180) dRa -= 360;
        if (dRa < -180) dRa += 360;
        for (let t = 0; t <= 3; t++) {
          const f = t / 3;
          pts.push({
            raDeg: ((ra1 + dRa * f) % 360 + 360) % 360,
            decDeg: dec1 + (dec2 - dec1) * f,
          });
        }
        drawProjectedCurve(ctx, pts, proj, false);
      }
    }
    ctx.restore();
  }

  if (layers.showConstellationNames) {
    ctx.save();
    ctx.fillStyle = palette.constellationName;
    ctx.font =
      view.fsz > 90
        ? '600 10px "IBM Plex Sans", "Noto Sans KR", sans-serif'
        : '600 12px "IBM Plex Sans", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    for (const con of catalogs.constellations) {
      const pt = projectStereographic(con.ra, con.dec, proj, 0);
      if (!pt) continue;
      const text = view.fsz > 105 ? con.abbr.toUpperCase() : `${con.koName} (${con.abbr})`;
      ctx.fillText(text, pt.x, pt.y);
    }
    ctx.restore();
  }

  const placer = new LabelPlacer();
  const targets: ScreenTarget[] = [];
  type LabelCandidate = {
    priority: number;
    x: number;
    y: number;
    radius: number;
    text: string;
    color: string;
    font: string;
  };
  const labelCandidates: LabelCandidate[] = [];

  // 7. Deep Sky Objects (Messier + OpenNGC NGC/IC + Barnard/LDN Dark Nebulae)
  const dsoMagCutoff = Math.min(16.8, magLimit + 3.5);
  let visibleDsoCount = 0;
  if (layers.showDso) {
    const dsoLists: DeepSkyObject[][] = [catalogs.dsosBright];
    if (view.fsz <= 45 && catalogs.dsosDeep.length > 0) {
      dsoLists.push(catalogs.dsosDeep);
    }
    if (layers.dsoCategories.DARK && catalogs.darkNebulae.length > 0 && view.fsz <= 70) {
      dsoLists.push(catalogs.darkNebulae);
    }

    interface PendingDso {
      dso: DeepSkyObject;
      pt: { x: number; y: number };
      belowMinAlt: boolean;
      isSelected: boolean;
      isOnScreen: boolean;
    }

    const pendingDsos: PendingDso[] = [];
    const onScreenNonDimmed: PendingDso[] = [];

    for (const list of dsoLists) {
      for (let i = 0; i < list.length; i++) {
        const dso = list[i];
        const isSelected = selected?.kind === 'dso' && selected.data.id === dso.id;
        if (dso.mag > dsoMagCutoff && !isSelected) {
          if (list === catalogs.dsosDeep || list === catalogs.darkNebulae) break;
          continue;
        }
        if (!layers.dsoCategories[dso.type]) continue;
        if (!matchesCatalogFilter(dso, layers.catalogFilter)) continue;

        const pt = projectStereographic(dso.ra, dso.dec, proj, 40);
        if (!pt) continue;

        let belowMinAlt = false;
        if (altFilterActive) {
          const { altDeg } = equatorialToHorizontal(dso.ra, dso.dec, lstDeg, observer.lat);
          belowMinAlt = altDeg < observer.minAltitudeDeg;
          if (belowMinAlt && !observer.highlightAboveMinAlt && !isSelected) {
            continue;
          }
        }

        const isOnScreen = pt.x >= 0 && pt.x <= width && pt.y >= 0 && pt.y <= height;
        const entry: PendingDso = { dso, pt, belowMinAlt, isSelected, isOnScreen };
        pendingDsos.push(entry);
        if (isOnScreen && !belowMinAlt) {
          onScreenNonDimmed.push(entry);
        }
      }
    }

    const symPct = Math.max(0, Math.min(100, layers.dsoSymbolDensityPct ?? 100));
    const allowedDsoSet = new Set<PendingDso>();
    if (symPct >= 100) {
      for (const entry of pendingDsos) allowedDsoSet.add(entry);
    } else {
      onScreenNonDimmed.sort((a, b) => a.dso.mag - b.dso.mag);
      const symQuota = symPct <= 0 ? 0 : Math.ceil((onScreenNonDimmed.length * symPct) / 100);
      for (let i = 0; i < symQuota && i < onScreenNonDimmed.length; i++) {
        allowedDsoSet.add(onScreenNonDimmed[i]);
      }
      for (const entry of pendingDsos) {
        if (entry.isSelected) allowedDsoSet.add(entry);
      }
    }

    const onScreenDsoItems: {
      mag: number;
      isSelected: boolean;
      candidate: LabelCandidate;
    }[] = [];

    for (const entry of pendingDsos) {
      if (!allowedDsoSet.has(entry)) continue;
      const { dso, pt, belowMinAlt, isSelected, isOnScreen } = entry;

      visibleDsoCount++;
      const symColor = palette.dsoColor[dso.type] ?? palette.dsoLabel;
      const symR = drawDsoSymbol(ctx, dso, pt.x, pt.y, pxPerDeg, symColor, palette, proj, belowMinAlt);
      if (dso.mag < 11.5 && dso.type !== 'DARK' && !belowMinAlt) {
        placer.registerObstacle(pt.x, pt.y, symR);
      }

      if (sessionIds.has(dso.id)) {
        ctx.save();
        ctx.strokeStyle = palette.selectionRing;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, symR + 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      targets.push({
        kind: 'dso',
        id: dso.id,
        x: pt.x,
        y: pt.y,
        radius: Math.max(9, Math.min(28, symR + 3)),
        mag: dso.mag,
        item: { kind: 'dso', data: dso },
      });

      if (layers.showDsoLabels && !belowMinAlt && isOnScreen) {
        const showCommon = view.fsz < 42 && dso.koName;
        const text = showCommon ? `${dso.id} ${dso.koName}` : dso.id;
        onScreenDsoItems.push({
          mag: dso.mag,
          isSelected,
          candidate: {
            priority: isSelected
              ? -100
              : dso.mag - (dso.id.startsWith('M') ? 0.5 : 0),
            x: pt.x,
            y: pt.y,
            radius: Math.min(24, symR),
            text,
            color: dso.type === 'DARK' ? palette.darkNebulaStroke : palette.dsoLabel,
            font: isSelected
              ? '600 11px "IBM Plex Mono", monospace'
              : '500 10.5px "IBM Plex Mono", monospace',
          },
        });
      }
    }

    if (layers.showDsoLabels && onScreenDsoItems.length > 0) {
      onScreenDsoItems.sort((a, b) => a.mag - b.mag);
      const dsoPct = Math.max(0, Math.min(100, layers.dsoLabelDensityPct ?? 10));
      const dsoQuota = dsoPct <= 0 ? 0 : Math.ceil((onScreenDsoItems.length * dsoPct) / 100);
      const maxDsoCandidates = Math.min(dsoQuota, 650);
      for (let i = 0; i < onScreenDsoItems.length; i++) {
        if (i < maxDsoCandidates || onScreenDsoItems[i].isSelected) {
          labelCandidates.push(onScreenDsoItems[i].candidate);
        }
      }
    }
  }

  // 8. Stars (Pogson's Ratio Logarithmic Scale + Faintest-to-Brightest Halo Separation)
  // Seamless Gaia DR3 + Hipparcos Ultra blending (never leaves empty edges outside Gaia patch!)
  const drawableStars: DrawableStar[] = [];
  const gaiaPatch = catalogs.gaiaPatch;
  const gaiaActive =
    layers.enableGaiaLive &&
    view.fsz <= GAIA_LIVE_MAX_FSZ &&
    magLimit > 9.0 &&
    catalogs.gaiaStars.length > 0 &&
    gaiaPatch !== null;

  const isInsideGaiaPatch = (raDeg: number, decDeg: number): boolean => {
    if (!gaiaActive || !gaiaPatch) return false;
    return (
      angularDistanceDeg(raDeg, decDeg, gaiaPatch.centerRa, gaiaPatch.centerDec) <=
      gaiaPatch.radius - 0.03
    );
  };

  const evalStarAltitude = (
    raDeg: number,
    decDeg: number,
    isSelected: boolean
  ): { skip: boolean; dimmed: boolean } => {
    if (!altFilterActive) return { skip: false, dimmed: false };
    const { altDeg } = equatorialToHorizontal(raDeg, decDeg, lstDeg, observer.lat);
    if (altDeg >= observer.minAltitudeDeg) return { skip: false, dimmed: false };
    if (!observer.highlightAboveMinAlt && !isSelected) return { skip: true, dimmed: false };
    return { skip: false, dimmed: true };
  };

  // 8a. Optional procedural ultra-faint fill ONLY when Gaia live isn't covering the region
  if (layers.showFieldStars && !gaiaActive && view.fsz <= 12 && magLimit > 10.2) {
    const halfSpan = Math.min(25, view.fsz * 0.72);
    const decMin = Math.max(-85, view.dec - halfSpan);
    const decMax = Math.min(85, view.dec + halfSpan);
    const cosCenter = Math.max(0.2, Math.cos(view.dec * DEG2RAD));
    const raHalfSpan = Math.min(180, halfSpan / cosCenter);
    const raCenterDeg = view.ra * 15;
    const fieldStars = getFieldStarsInBounds(
      raCenterDeg - raHalfSpan,
      raCenterDeg + raHalfSpan,
      decMin,
      decMax,
      Math.min(13.2, magLimit)
    );

    for (let i = 0; i < fieldStars.length; i++) {
      const star = fieldStars[i];
      if (star.mag <= 10.2) continue;
      const pt = projectStereographic(star.ra, star.dec, proj, 10);
      if (!pt) continue;
      const altCheck = evalStarAltitude(star.ra, star.dec, false);
      if (altCheck.skip) continue;
      drawableStars.push({
        star,
        x: pt.x,
        y: pt.y,
        radius: getStarRadiusPogson(star.mag, magLimit, view.fsz),
        isBright: false,
        isSelected: false,
        dimmed: altCheck.dimmed,
      });
    }
  }

  // 8b. Live ESA Gaia DR3 faint stars (8.3m - 15.8m) when zoomed into eyepiece/finder FOV (<= 5.5°)
  if (gaiaActive) {
    const gList = catalogs.gaiaStars;
    for (let i = 0; i < gList.length; i++) {
      const star = gList[i];
      if (star.mag > magLimit) break;
      const pt = projectStereographic(star.ra, star.dec, proj, 10);
      if (!pt) continue;
      const isSelected = selected?.kind === 'star' && selected.data.id === star.id;
      const altCheck = evalStarAltitude(star.ra, star.dec, isSelected);
      if (altCheck.skip) continue;
      const r = getStarRadiusPogson(star.mag, magLimit, view.fsz);
      drawableStars.push({
        star,
        x: pt.x,
        y: pt.y,
        radius: r,
        isBright: false,
        isSelected,
        dimmed: altCheck.dimmed,
      });
      if (view.fsz <= 4.5 && star.mag <= 13.0) {
        targets.push({
          kind: 'star',
          id: star.id,
          x: pt.x,
          y: pt.y,
          radius: 6,
          mag: star.mag,
          item: { kind: 'star', data: star },
        });
      }
    }
  }

  // 8c. Spatially-Tiled Hipparcos Ultra Stars (mag 8.5 - 13.78)
  // Always fills areas outside an active Gaia patch so there is ZERO circular cutoff gap!
  if (magLimit > 8.3 && catalogs.ultraStarTiles.size > 0) {
    const tileKeys = getVisibleUltraTileKeys(view.ra, view.dec, view.fsz);
    for (const key of tileKeys) {
      const tileStars = catalogs.ultraStarTiles.get(key);
      if (!tileStars) continue;
      for (let i = 0; i < tileStars.length; i++) {
        const star = tileStars[i];
        if (star.mag > magLimit) break;
        if (gaiaActive && isInsideGaiaPatch(star.ra, star.dec)) continue;
        const pt = projectStereographic(star.ra, star.dec, proj, 10);
        if (!pt) continue;
        const isSelected = selected?.kind === 'star' && selected.data.id === star.id;
        const altCheck = evalStarAltitude(star.ra, star.dec, isSelected);
        if (altCheck.skip) continue;
        const r = getStarRadiusPogson(star.mag, magLimit, view.fsz);
        drawableStars.push({
          star,
          x: pt.x,
          y: pt.y,
          radius: r,
          isBright: false,
          isSelected,
          dimmed: altCheck.dimmed,
        });
        if (view.fsz <= 8 && star.mag <= 11.5) {
          targets.push({
            kind: 'star',
            id: star.id,
            x: pt.x,
            y: pt.y,
            radius: 6,
            mag: star.mag,
            item: { kind: 'star', data: star },
          });
        }
      }
    }
  }

  // 8d. Deep Hipparcos Stars (mag 6.0 - 8.5)
  if (magLimit > 5.8 && catalogs.deepStars.length > 0) {
    const deepList = catalogs.deepStars;
    for (let i = 0; i < deepList.length; i++) {
      const star = deepList[i];
      if (star.mag > magLimit) break;
      if (gaiaActive && star.mag > 8.3 && isInsideGaiaPatch(star.ra, star.dec)) continue;
      const pt = projectStereographic(star.ra, star.dec, proj, 12);
      if (!pt) continue;
      const isSelected = selected?.kind === 'star' && selected.data.id === star.id;
      const altCheck = evalStarAltitude(star.ra, star.dec, isSelected);
      if (altCheck.skip) continue;
      const r = getStarRadiusPogson(star.mag, magLimit, view.fsz);
      drawableStars.push({
        star,
        x: pt.x,
        y: pt.y,
        radius: r,
        isBright: false,
        isSelected,
        dimmed: altCheck.dimmed,
      });
      if (view.fsz <= 18 && star.mag <= 8.0) {
        targets.push({
          kind: 'star',
          id: star.id,
          x: pt.x,
          y: pt.y,
          radius: 7,
          mag: star.mag,
          item: { kind: 'star', data: star },
        });
      }
    }
  }

  // 8e. Bright Hipparcos Stars (<= 6.0m, 5,044 real stars with Bayer/Flamsteed/Korean names)
  const brightList = catalogs.brightStars;
  for (let i = 0; i < brightList.length; i++) {
    const star = brightList[i];
    const isSelected = selected?.kind === 'star' && selected.data.id === star.id;
    if (star.mag > magLimit && !isSelected) {
      if (!selected || selected.kind !== 'star') break;
      continue;
    }
    const pt = projectStereographic(star.ra, star.dec, proj, 20);
    if (!pt) continue;
    const altCheck = evalStarAltitude(star.ra, star.dec, isSelected);
    if (altCheck.skip) continue;

    const r = getStarRadiusPogson(star.mag, magLimit, view.fsz);
    drawableStars.push({
      star,
      x: pt.x,
      y: pt.y,
      radius: r,
      isBright: true,
      isSelected,
      dimmed: altCheck.dimmed,
    });

    if (star.mag < 3.4 && !altCheck.dimmed) {
      placer.registerObstacle(pt.x, pt.y, r + 1.2);
    }

    targets.push({
      kind: 'star',
      id: star.id,
      x: pt.x,
      y: pt.y,
      radius: Math.max(8, r + 4),
      mag: star.mag,
      item: { kind: 'star', data: star },
    });
  }

  // Viewport-relative top-N% apparent-magnitude star labels
  if (layers.showStarLabels) {
    const onScreenStars = drawableStars.filter(
      (item) => !item.dimmed && item.x >= 0 && item.x <= width && item.y >= 0 && item.y <= height
    );
    if (onScreenStars.length > 0) {
      onScreenStars.sort((a, b) => a.star.mag - b.star.mag);
      const starPct = Math.max(0, Math.min(100, layers.starLabelDensityPct ?? 10));
      const starQuota = starPct <= 0 ? 0 : Math.ceil((onScreenStars.length * starPct) / 100);
      const maxStarCandidates = Math.min(starQuota, 650);
      for (let i = 0; i < onScreenStars.length; i++) {
        const item = onScreenStars[i];
        if (i >= maxStarCandidates && !item.isSelected) continue;
        const { star, x, y, radius, isSelected } = item;
        let text: string | null = null;
        if (star.name && view.fsz < 95) text = star.name;
        else if (star.bayer) text = star.bayer;
        else if (star.name) text = star.name;
        else if (star.hip) text = `HIP ${star.hip}`;
        else if (star.gaiaId) text = `Gaia ${star.gaiaId.slice(-6)}`;
        else if (star.id && !star.id.startsWith('field_')) text = star.id;
        if (!text) continue;

        labelCandidates.push({
          priority: isSelected ? -100 : star.mag + 1.2,
          x,
          y,
          radius,
          text,
          color: palette.starLabel,
          font:
            star.mag < 1.5
              ? '600 11px "IBM Plex Sans", sans-serif'
              : '400 10px "IBM Plex Sans", sans-serif',
        });
      }
    }
  }

  // Sort stars faintest -> brightest so bright stars + halo strokes cleanly separate binaries & clusters
  drawableStars.sort((a, b) => b.star.mag - a.star.mag);
  const visibleStarCount = drawableStars.length;
  const drawHalo = !hipsVisible || hips.opacity < 0.45;

  ctx.save();
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = palette.starHaloStroke;

  for (let i = 0; i < drawableStars.length; i++) {
    const { star, x, y, radius, isBright, dimmed } = drawableStars[i];
    const color = bvToStarColor(star.bv, theme, layers.showStarColors);
    ctx.globalAlpha = dimmed ? 0.16 : 1.0;

    if (theme === 'dark' && isBright && star.mag < 2.1 && !hipsVisible && !dimmed) {
      const glowR = radius * 2.6;
      const grad = ctx.createRadialGradient(x, y, radius * 0.35, x, y, glowR);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (drawHalo && radius >= 1.2 && !dimmed) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 8b. Solar System Bodies (Sun, Moon, Mercury–Neptune) at real observation time
  if (layers.showSolarSystem) {
    // 8b-0. Optional apparent geocentric orbital paths for Sun, Moon, Planets, and Moons
    if (layers.showSolarSystemOrbits) {
      const orbitTracks = getSolarSystemOrbitTracks(obsTimeMs);
      ctx.save();
      for (const track of orbitTracks) {
        if (track.isPlanetaryMoon && view.fsz > 5.0) continue;
        const isSelOrbit = selected?.kind === 'planet' && selected.data.id === track.id;
        const orbitColor =
          theme === 'red'
            ? isSelOrbit
              ? 'rgba(239, 68, 68, 0.85)'
              : track.isPlanetaryMoon
              ? 'rgba(220, 38, 38, 0.35)'
              : 'rgba(220, 38, 38, 0.48)'
            : theme === 'white'
            ? isSelOrbit
              ? '#1D4ED8'
              : track.id === 'Sun'
              ? 'rgba(180, 83, 9, 0.55)'
              : track.id === 'Moon'
              ? 'rgba(71, 85, 105, 0.65)'
              : 'rgba(30, 64, 175, 0.45)'
            : track.color;

        ctx.strokeStyle = orbitColor;

        // Past path: softer dashed curve
        if (track.pastPoints.length > 1) {
          ctx.globalAlpha =
            theme === 'dark' ? (isSelOrbit ? 0.58 : 0.28) : isSelOrbit ? 0.75 : 0.48;
          ctx.lineWidth = isSelOrbit ? 1.45 : 0.95;
          ctx.setLineDash([4, 4]);
          drawProjectedCurve(ctx, track.pastPoints, proj, false);
        }

        // Future path (or closed planetary moon ellipse): crisp solid curve
        if (track.futurePoints.length > 1) {
          ctx.globalAlpha =
            theme === 'dark'
              ? isSelOrbit
                ? 0.88
                : track.isPlanetaryMoon
                ? 0.38
                : 0.52
              : isSelOrbit
              ? 0.95
              : track.isPlanetaryMoon
              ? 0.5
              : 0.72;
          ctx.lineWidth = isSelOrbit ? 1.7 : track.isPlanetaryMoon ? 0.85 : 1.15;
          ctx.setLineDash([]);
          drawProjectedCurve(ctx, track.futurePoints, proj, Boolean(track.isPlanetaryMoon));
        }
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    const solarBodies = getSolarSystemBodies(obsTimeMs);
    const sunBody = solarBodies.find((b) => b.id === 'Sun');
    const planetRenderer = getPlanetRenderer();
    ctx.save();
    for (const body of solarBodies) {
      const isSelected = selected?.kind === 'planet' && selected.data.id === body.id;
      const isPlanetaryMoon = body.group === 'moon' && body.id !== 'Moon';
      const isMinorBody = body.group === 'dwarf' || body.group === 'asteroid';

      // Visibility gating so wide-field views stay clean while zoomed/selected targets shine
      if (isPlanetaryMoon && !isSelected && view.fsz > 12) continue;
      if (isMinorBody && !isSelected && view.fsz > 65 && body.mag > magLimit + 2.0) continue;

      const projMargin = Math.max(80, Math.min(width, height) * 0.52);
      const pt = projectStereographic(body.ra, body.dec, proj, projMargin);
      if (!pt) continue;

      let dimmed = false;
      if (altFilterActive) {
        const hz = equatorialToHorizontal(body.ra, body.dec, lstDeg, observer.lat);
        if (hz.altDeg < observer.minAltitudeDeg) {
          if (!observer.highlightAboveMinAlt) continue;
          dimmed = true;
        }
      }

      // True physical angular radius in pixels from equatorial radius (km) / geocentric distance (AU)
      const BODY_RADIUS_KM: Record<string, number> = {
        Sun: 696340,
        Moon: 1737.4,
        Mercury: 2439.7,
        Venus: 6051.8,
        Mars: 3389.5,
        Jupiter: 71492,
        Saturn: 60268,
        Uranus: 25559,
        Neptune: 24764,
        Io: 1821.6,
        Europa: 1560.8,
        Ganymede: 2634.1,
        Callisto: 2410.3,
        Titan: 2574.7,
        Rhea: 763.8,
        Triton: 1353.4,
      };
      const kmRad = BODY_RADIUS_KM[body.id] ?? 0;
      const distKm = Math.max(1e5, body.distAu * 149597870.7);
      const trueRadiusDeg =
        kmRad > 0 ? Math.asin(Math.min(0.99, kmRad / distKm)) * RAD2DEG : 0;
      const trueRadiusPx =
        trueRadiusDeg > 0 ? 2 * proj.scale * Math.tan((trueRadiusDeg * DEG2RAD) / 2) : 0;

      const minIconR =
        body.id === 'Sun'
          ? 9.5
          : body.id === 'Moon'
          ? 8.5
          : body.id === 'Jupiter' || body.id === 'Venus'
          ? 5.8
          : body.id === 'Saturn' || body.id === 'Mars'
          ? 5.0
          : isPlanetaryMoon
          ? 2.6
          : isMinorBody
          ? 3.4
          : 4.0;

      const maxDiskR = Math.min(width, height) * 0.46;
      const baseR =
        layers.showPlanetSurface && !isMinorBody
          ? Math.min(maxDiskR, Math.max(minIconR, trueRadiusPx))
          : minIconR * (isMinorBody || isPlanetaryMoon ? 1.0 : 0.85);

      const fillColor =
        theme === 'red'
          ? '#EF4444'
          : theme === 'white'
          ? body.id === 'Sun'
            ? '#B45309'
            : body.group === 'dwarf'
            ? '#7C3AED'
            : body.group === 'asteroid'
            ? '#047857'
            : '#1D4ED8'
          : body.color;

      ctx.globalAlpha = dimmed ? 0.2 : 1.0;

      if (isMinorBody) {
        // Distinct diamond reticle + core for Dwarf Planets & Asteroids
        const dr = baseR + 1.4;
        ctx.save();
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = isSelected ? 1.6 : 1.15;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - dr);
        ctx.lineTo(pt.x + dr, pt.y);
        ctx.lineTo(pt.x, pt.y + dr);
        ctx.lineTo(pt.x - dr, pt.y);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (isPlanetaryMoon) {
        // Crisp planetary moon disk (scales accurately at planetary zoom)
        ctx.save();
        ctx.strokeStyle = palette.starHaloStroke;
        ctx.lineWidth = 1.0;
        const moonR = isSelected ? Math.max(3.4, baseR) : baseR;
        if (moonR >= 6 && theme !== 'red') {
          const mg = ctx.createRadialGradient(
            pt.x - moonR * 0.25,
            pt.y - moonR * 0.25,
            moonR * 0.1,
            pt.x,
            pt.y,
            moonR
          );
          mg.addColorStop(0, '#FFFFFF');
          mg.addColorStop(0.55, fillColor);
          mg.addColorStop(1, 'rgba(15, 23, 42, 0.8)');
          ctx.fillStyle = mg;
        } else {
          ctx.fillStyle = fillColor;
        }
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, moonR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (layers.showPlanetSurface) {
        // Atmospheric / photospheric glow
        if ((theme === 'dark' || theme === 'red') && !dimmed && (body.id === 'Sun' || body.id === 'Moon' || body.mag < 0)) {
          const glowR = baseR * (body.id === 'Sun' ? 2.15 : 1.55);
          const grad = ctx.createRadialGradient(pt.x, pt.y, baseR * 0.55, pt.x, pt.y, glowR);
          if (theme === 'red') {
            grad.addColorStop(0, body.id === 'Sun' ? 'rgba(220, 38, 38, 0.45)' : 'rgba(185, 28, 28, 0.18)');
          } else {
            grad.addColorStop(0, body.id === 'Sun' ? 'rgba(253, 210, 71, 0.52)' : 'rgba(226, 232, 240, 0.2)');
          }
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Compute exact local Celestial North & East screen unit vectors at body's position
        // (automatically honors Equatorial/Horizontal rotation and flipH/flipV mirrors)
        const epsDeg = Math.min(0.05, Math.max(0.0004, view.fsz * 0.004));
        const northDec = Math.min(89.95, body.dec + epsDeg);
        const ptN = projectStereographicRaw(body.ra, northDec, proj);
        const cosDecSafe = Math.max(0.05, Math.cos(body.dec * DEG2RAD));
        const ptE = projectStereographicRaw((body.ra + epsDeg / cosDecSafe) % 360, body.dec, proj);

        let skyNorthX = 0;
        let skyNorthY = -1;
        let skyEastX = -1;
        let skyEastY = 0;
        if (ptN) {
          const ndx = ptN.x - pt.x;
          const ndy = ptN.y - pt.y;
          const nlen = Math.hypot(ndx, ndy);
          if (nlen > 1e-6) {
            skyNorthX = ndx / nlen;
            skyNorthY = ndy / nlen;
          }
        }
        if (ptE) {
          const edx = ptE.x - pt.x;
          const edy = ptE.y - pt.y;
          const elen = Math.hypot(edx, edy);
          if (elen > 1e-6) {
            skyEastX = edx / elen;
            skyEastY = edy / elen;
          }
        }

        const rendered3D = planetRenderer.drawBodyToCanvas2D(
          ctx,
          body,
          sunBody,
          pt.x,
          pt.y,
          baseR,
          skyNorthX,
          skyNorthY,
          skyEastX,
          skyEastY,
          obsTimeMs,
          theme
        );

        if (!rendered3D) {
        // Fallback 2D vector planet surface while WebGL textures load
        // Saturn back-half ring (drawn behind planet disk)
        if (body.id === 'Saturn') {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(-0.36);
          ctx.strokeStyle = theme === 'red' ? 'rgba(239,68,68,0.75)' : theme === 'white' ? '#64748B' : '#E5D1A0';
          ctx.lineWidth = Math.max(1.6, baseR * 0.34);
          ctx.beginPath();
          ctx.ellipse(0, 0, baseR * 2.1, baseR * 0.62, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = theme === 'dark' ? 'rgba(10,14,24,0.65)' : 'rgba(0,0,0,0.28)';
          ctx.lineWidth = Math.max(0.6, baseR * 0.08);
          ctx.beginPath();
          ctx.ellipse(0, 0, baseR * 2.15, baseR * 0.63, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Clipped procedural planetary / lunar surface rendering
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, baseR, 0, Math.PI * 2);
        ctx.clip();

        if (body.id === 'Sun') {
          const sunGrad = ctx.createRadialGradient(
            pt.x - baseR * 0.15,
            pt.y - baseR * 0.15,
            baseR * 0.1,
            pt.x,
            pt.y,
            baseR
          );
          if (theme === 'red') {
            sunGrad.addColorStop(0, '#FCA5A5');
            sunGrad.addColorStop(0.7, '#EF4444');
            sunGrad.addColorStop(1, '#7F1D1D');
          } else {
            sunGrad.addColorStop(0, '#FFFBEB');
            sunGrad.addColorStop(0.55, '#FDE047');
            sunGrad.addColorStop(0.88, '#F59E0B');
            sunGrad.addColorStop(1, '#C2410C');
          }
          ctx.fillStyle = sunGrad;
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);
        } else if (body.id === 'Moon') {
          // Bright lunar highlands base with limb darkening
          const moonGrad = ctx.createRadialGradient(
            pt.x - baseR * 0.2,
            pt.y - baseR * 0.2,
            baseR * 0.1,
            pt.x,
            pt.y,
            baseR
          );
          if (theme === 'red') {
            moonGrad.addColorStop(0, '#FCA5A5');
            moonGrad.addColorStop(1, '#991B1B');
          } else {
            moonGrad.addColorStop(0, '#F1F5F9');
            moonGrad.addColorStop(0.72, '#CBD5E1');
            moonGrad.addColorStop(1, '#94A3B8');
          }
          ctx.fillStyle = moonGrad;
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);

          // Lunar maria (Imbrium, Serenitatis, Tranquillitatis, Procellarum, Crisium)
          ctx.fillStyle =
            theme === 'red'
              ? 'rgba(69, 10, 10, 0.55)'
              : theme === 'white'
              ? 'rgba(51, 65, 85, 0.34)'
              : 'rgba(71, 85, 105, 0.52)';
          const maria: [number, number, number, number][] = [
            [-0.25, -0.22, 0.34, 0.28], // Mare Imbrium
            [0.2, -0.18, 0.22, 0.2],    // Mare Serenitatis
            [0.32, 0.08, 0.24, 0.2],    // Mare Tranquillitatis
            [-0.42, 0.12, 0.28, 0.36],  // Oceanus Procellarum
            [0.58, -0.08, 0.13, 0.15],  // Mare Crisium
            [-0.08, 0.32, 0.22, 0.16],  // Mare Nubium
          ];
          for (const [mx, my, rx, ry] of maria) {
            ctx.beginPath();
            ctx.ellipse(pt.x + mx * baseR, pt.y + my * baseR, rx * baseR, ry * baseR, 0.25, 0, Math.PI * 2);
            ctx.fill();
          }

          // Bright Tycho crater & subtle ray spot when disk is medium/large
          if (baseR >= 10) {
            ctx.fillStyle = theme === 'red' ? 'rgba(254,202,202,0.55)' : 'rgba(255,255,255,0.55)';
            ctx.beginPath();
            ctx.arc(pt.x - baseR * 0.12, pt.y + baseR * 0.58, Math.max(1.2, baseR * 0.08), 0, Math.PI * 2);
            ctx.fill();
          }

          // Astronomical lunar phase terminator shadow
          if (body.phasePct < 96) {
            const shadowFill =
              theme === 'white' ? 'rgba(15, 23, 42, 0.55)' : 'rgba(5, 8, 16, 0.78)';
            ctx.fillStyle = shadowFill;
            const litFrac = Math.max(0.02, Math.min(0.98, body.phasePct / 100));
            const k = (litFrac - 0.5) * 2; // -1 (new) .. +1 (full)
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, baseR + 0.5, Math.PI * 0.5, Math.PI * 1.5);
            const termRx = Math.abs(k) * baseR;
            ctx.ellipse(pt.x, pt.y, termRx, baseR + 0.5, 0, Math.PI * 1.5, Math.PI * 0.5, k > 0);
            ctx.closePath();
            ctx.fill();
          }
        } else if (body.id === 'Jupiter') {
          ctx.fillStyle = theme === 'red' ? '#DC2626' : '#EDE0C4';
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);
          // Multi-zone atmospheric cloud belts (NPR, NTB, NEB, EZ, SEB, STB, SPR)
          const bands: [number, number, string][] = [
            [-1.0, 0.28, theme === 'red' ? '#7F1D1D' : '#8A735A'],
            [-0.64, 0.11, theme === 'red' ? '#991B1B' : '#B58D65'],
            [-0.46, 0.10, theme === 'red' ? '#B91C1C' : '#D4B68C'],
            [-0.34, 0.22, theme === 'red' ? '#7F1D1D' : '#A95D38'],
            [-0.12, 0.20, theme === 'red' ? '#EF4444' : '#F4EAD2'],
            [0.08, 0.25, theme === 'red' ? '#7F1D1D' : '#9E4F2F'],
            [0.39, 0.10, theme === 'red' ? '#991B1B' : '#BC956B'],
            [0.56, 0.14, theme === 'red' ? '#991B1B' : '#9B7C5E'],
            [0.72, 0.30, theme === 'red' ? '#7F1D1D' : '#7E6852'],
          ];
          for (const [by, bh, col] of bands) {
            ctx.fillStyle = col;
            ctx.fillRect(pt.x - baseR, pt.y + by * baseR, baseR * 2, bh * baseR);
          }
          // Great Red Spot with subtle pale hollow collar
          ctx.fillStyle = theme === 'red' ? '#FCA5A5' : '#F3E5CA';
          ctx.beginPath();
          ctx.ellipse(pt.x + baseR * 0.24, pt.y + baseR * 0.25, baseR * 0.24, baseR * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme === 'red' ? '#DC2626' : '#C2461C';
          ctx.beginPath();
          ctx.ellipse(pt.x + baseR * 0.24, pt.y + baseR * 0.25, baseR * 0.19, baseR * 0.105, 0, 0, Math.PI * 2);
          ctx.fill();
          // 3D spherical limb darkening
          const limbGrad = ctx.createRadialGradient(
            pt.x - baseR * 0.18,
            pt.y - baseR * 0.15,
            baseR * 0.35,
            pt.x,
            pt.y,
            baseR
          );
          limbGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
          limbGrad.addColorStop(0.68, 'rgba(0,0,0,0)');
          limbGrad.addColorStop(1, 'rgba(12,10,8,0.58)');
          ctx.fillStyle = limbGrad;
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);
        } else if (body.id === 'Mars') {
          const marsGrad = ctx.createRadialGradient(
            pt.x - baseR * 0.25,
            pt.y - baseR * 0.25,
            baseR * 0.1,
            pt.x,
            pt.y,
            baseR
          );
          marsGrad.addColorStop(0, theme === 'red' ? '#F87171' : '#F28B50');
          marsGrad.addColorStop(1, theme === 'red' ? '#7F1D1D' : '#9A3412');
          ctx.fillStyle = marsGrad;
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);
          // Dark basaltic albedo patch + north polar ice cap
          ctx.fillStyle = 'rgba(67, 20, 7, 0.45)';
          ctx.beginPath();
          ctx.ellipse(pt.x + baseR * 0.1, pt.y + baseR * 0.08, baseR * 0.45, baseR * 0.26, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme === 'red' ? 'rgba(254,202,202,0.75)' : 'rgba(248,250,252,0.85)';
          ctx.beginPath();
          ctx.ellipse(pt.x, pt.y - baseR * 0.82, baseR * 0.36, baseR * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (body.id === 'Saturn') {
          const satGrad = ctx.createLinearGradient(pt.x, pt.y - baseR, pt.x, pt.y + baseR);
          satGrad.addColorStop(0, theme === 'red' ? '#991B1B' : '#B9A06B');
          satGrad.addColorStop(0.35, theme === 'red' ? '#EF4444' : '#F3E3B5');
          satGrad.addColorStop(0.65, theme === 'red' ? '#DC2626' : '#D9BE82');
          satGrad.addColorStop(1, theme === 'red' ? '#7F1D1D' : '#9B8454');
          ctx.fillStyle = satGrad;
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);
          const satLimb = ctx.createRadialGradient(
            pt.x - baseR * 0.15,
            pt.y - baseR * 0.15,
            baseR * 0.35,
            pt.x,
            pt.y,
            baseR
          );
          satLimb.addColorStop(0, 'rgba(255,255,255,0.06)');
          satLimb.addColorStop(0.7, 'rgba(0,0,0,0)');
          satLimb.addColorStop(1, 'rgba(15,12,8,0.5)');
          ctx.fillStyle = satLimb;
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);
        } else {
          // Mercury, Venus, Uranus, Neptune shaded sphere
          const sphGrad = ctx.createRadialGradient(
            pt.x - baseR * 0.28,
            pt.y - baseR * 0.28,
            baseR * 0.1,
            pt.x,
            pt.y,
            baseR
          );
          sphGrad.addColorStop(0, theme === 'red' ? '#FCA5A5' : '#FFFFFF');
          sphGrad.addColorStop(0.42, fillColor);
          sphGrad.addColorStop(1, theme === 'red' ? '#450A0A' : 'rgba(15, 23, 42, 0.78)');
          ctx.fillStyle = sphGrad;
          ctx.fillRect(pt.x - baseR, pt.y - baseR, baseR * 2, baseR * 2);
        }

        ctx.restore();

        // Subtle sphere outline
        ctx.strokeStyle = palette.starHaloStroke;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, baseR, 0, Math.PI * 2);
        ctx.stroke();

        // Saturn front-half ring (crosses in front of globe)
        if (body.id === 'Saturn') {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(-0.36);
          ctx.strokeStyle = theme === 'red' ? 'rgba(248,113,113,0.9)' : theme === 'white' ? '#475569' : '#F5E4B8';
          ctx.lineWidth = Math.max(1.6, baseR * 0.34);
          ctx.beginPath();
          ctx.ellipse(0, 0, baseR * 2.1, baseR * 0.62, 0, 0, Math.PI);
          ctx.stroke();
          ctx.restore();
        }

        // Uranus delicate tilted ring when zoomed
        if (body.id === 'Uranus' && view.fsz <= 25) {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(1.1);
          ctx.strokeStyle = theme === 'red' ? 'rgba(248,113,113,0.45)' : 'rgba(165,243,252,0.55)';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.ellipse(0, 0, baseR * 1.85, baseR * 0.45, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        } // end fallback !rendered3D

      } else {
        // Classic schematic star-atlas planet symbol (surface rendering OFF)
        if (body.id === 'Saturn') {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(-0.38);
          ctx.strokeStyle = fillColor;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.ellipse(0, 0, baseR * 2.0, baseR * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = palette.starHaloStroke;
        ctx.lineWidth = 1.2;
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, baseR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      targets.push({
        kind: 'planet',
        id: body.id,
        x: pt.x,
        y: pt.y,
        radius: Math.max(isPlanetaryMoon ? 7 : 10, baseR + 4),
        mag: isMinorBody || isPlanetaryMoon ? body.mag : Math.min(body.mag, -3),
        item: { kind: 'planet', data: body },
      });

      const isOnScreenSolar = pt.x >= 0 && pt.x <= width && pt.y >= 0 && pt.y <= height;
      if (layers.showSolarSystemLabels && !dimmed && isOnScreenSolar) {
        const labelColor =
          theme === 'red'
            ? '#EF4444'
            : theme === 'white'
            ? '#0F172A'
            : body.group === 'dwarf'
            ? '#D8B4FE'
            : body.group === 'asteroid'
            ? '#6EE7B7'
            : isPlanetaryMoon
            ? '#E2E8F0'
            : '#FDE68A';
        labelCandidates.push({
          priority: isSelected ? -100 : body.mag - 5,
          text: isPlanetaryMoon ? body.koName : `${body.symbol} ${body.koName}`,
          x: pt.x,
          y: pt.y,
          radius: baseR + 3,
          color: labelColor,
          font:
            isMinorBody || isPlanetaryMoon
              ? '500 10px "Pretendard", "IBM Plex Sans", sans-serif'
              : '600 11px "Pretendard", "IBM Plex Sans", sans-serif',
        });
      }
    }
    ctx.restore();
  }

  // 9. Star-Hopping Guide Path(s) — supports multi-route pointers (e.g., Dubhe & Navi -> Polaris)
  let activeStarHop: StarHopGuide | null = null;
  if (optics.showStarHop && selected) {
    const targetRa = selected.data.ra;
    const targetDec = selected.data.dec;
    const targetLabel =
      selected.kind === 'dso'
        ? selected.data.id
        : selected.kind === 'planet'
        ? selected.data.koName
        : selected.data.koName || selected.data.name || selected.data.bayer || selected.data.id;

    const hopGuides = findStarHopGuides(
      targetRa,
      targetDec,
      targetLabel,
      catalogs.brightStars,
      selected.kind === 'star' ? selected.data.id : undefined,
      selected.kind === 'star' ? selected.data.hip : undefined
    );
    activeStarHop = hopGuides[0] ?? null;

    if (hopGuides.length > 0) {
      const toVec = (raDeg: number, decDeg: number): [number, number, number] => {
        const a = raDeg * DEG2RAD;
        const d = decDeg * DEG2RAD;
        return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
      };

      ctx.save();
      ctx.strokeStyle = palette.starHop;
      ctx.font = '600 10.5px "IBM Plex Mono", monospace';

      for (const guide of hopGuides) {
        const v1 = toVec(guide.fromStar.ra, guide.fromStar.dec);
        const v2 = toVec(guide.toRa, guide.toDec);
        const steps = guide.distanceDeg > 10 ? 24 : 8;

        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = v1[0] * (1 - t) + v2[0] * t;
          const y = v1[1] * (1 - t) + v2[1] * t;
          const z = v1[2] * (1 - t) + v2[2] * t;
          const len = Math.hypot(x, y, z) || 1;
          const ra = ((Math.atan2(y / len, x / len) * RAD2DEG) + 360) % 360;
          const dec = Math.asin(Math.max(-1, Math.min(1, z / len))) * RAD2DEG;
          const p = projectStereographicRaw(ra, dec, proj);
          if (p) pts.push({ x: p.x, y: p.y });
        }

        if (pts.length >= 2) {
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            if (Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) < Math.max(width, height)) {
              ctx.lineTo(pts[i].x, pts[i].y);
            } else {
              ctx.moveTo(pts[i].x, pts[i].y);
            }
          }
          ctx.stroke();

          // Guide star ring marker if on screen
          const pStart = pts[0];
          if (
            pStart.x >= -20 &&
            pStart.x <= width + 20 &&
            pStart.y >= -20 &&
            pStart.y <= height + 20
          ) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(pStart.x, pStart.y, 9, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Directional arrowhead approaching target
          const pEnd = pts[pts.length - 1];
          const pPrev = pts[pts.length - 2];
          const ang = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
          const arrowTipX = pEnd.x - Math.cos(ang) * 14;
          const arrowTipY = pEnd.y - Math.sin(ang) * 14;
          if (
            arrowTipX >= 0 &&
            arrowTipX <= width &&
            arrowTipY >= 0 &&
            arrowTipY <= height
          ) {
            ctx.setLineDash([]);
            ctx.fillStyle = palette.starHop;
            ctx.beginPath();
            ctx.moveTo(arrowTipX, arrowTipY);
            ctx.lineTo(
              arrowTipX - Math.cos(ang - 0.42) * 8,
              arrowTipY - Math.sin(ang - 0.42) * 8
            );
            ctx.lineTo(
              arrowTipX - Math.cos(ang + 0.42) * 8,
              arrowTipY - Math.sin(ang + 0.42) * 8
            );
            ctx.closePath();
            ctx.fill();
          }

          // Place label at midpoint of visible points along the geodesic
          const visiblePts = pts.filter(
            (pt) => pt.x >= 40 && pt.x <= width - 40 && pt.y >= 40 && pt.y <= height - 40
          );
          const anchor =
            visiblePts.length > 0
              ? visiblePts[Math.floor(visiblePts.length / 2)]
              : pts[Math.floor(pts.length / 2)];
          const fromName =
            guide.fromStar.koName || guide.fromStar.name || guide.fromStar.bayer || guide.fromStar.id;
          const hopTxt =
            hopGuides.length > 1
              ? `${fromName} ${guide.distanceDeg.toFixed(1)}° → ${guide.toLabel}`
              : `${guide.distanceDeg.toFixed(1)}° → ${guide.toLabel}`;
          const tw = ctx.measureText(hopTxt).width;
          ctx.fillStyle = theme === 'white' ? 'rgba(255,255,255,0.9)' : 'rgba(7,10,18,0.88)';
          ctx.fillRect(anchor.x - tw / 2 - 5, anchor.y - 8, tw + 10, 16);
          ctx.fillStyle = palette.starHop;
          ctx.fillText(hopTxt, anchor.x - tw / 2, anchor.y + 3);
        }
      }
      ctx.restore();
    }
  }

  // 10. Optical Reticles (multi-select overlapping rings)
  const cx = width / 2;
  const cy = height / 2;

  if (optics.showCrosshair) {
    ctx.save();
    const crossColor =
      theme === 'white' ? '#0369A1' : theme === 'red' ? '#EF4444' : '#06B6D4';
    const gap = 8;
    const armOuter = Math.min(width, height) * 0.45;
    const armInner = 34;

    // Subtle full-field crosshair lines
    ctx.strokeStyle = crossColor;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - armOuter, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + armOuter, cy);
    ctx.moveTo(cx, cy - armOuter);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + armOuter);
    ctx.stroke();

    // Crisp center precision ticks + center gap ring
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(cx, cy, gap, 0, Math.PI * 2);
    ctx.moveTo(cx - armInner, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + armInner, cy);
    ctx.moveTo(cx, cy - armInner);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + armInner);
    ctx.stroke();
    ctx.restore();
  }

  // Exact stereographic radius (px) from chart center for an angular diameter (deg)
  const stereoRadiusPx = (diameterDeg: number) =>
    2 * proj.scale * Math.tan((diameterDeg * DEG2RAD) / 4);

  if (optics.showTelrad) {
    ctx.save();
    ctx.strokeStyle = palette.reticleTelrad;
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 1.25;
    for (const deg of [0.5, 2.0, 4.0]) {
      const rPx = stereoRadiusPx(deg);
      if (rPx >= 3 && rPx < Math.max(width, height)) {
        ctx.beginPath();
        ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = palette.reticleTelrad;
    const outerR = stereoRadiusPx(4.0);
    if (outerR > 12 && outerR < Math.min(width, height) * 0.48) {
      ctx.fillText('Telrad 4°', cx + 4, cy - outerR - 4);
    }
    ctx.restore();
  }

  if (optics.showFinder7x50) {
    const finderR = stereoRadiusPx(7.0);
    if (finderR >= 4 && finderR < Math.max(width, height) * 1.6) {
      ctx.save();
      const finderColor =
        theme === 'white' ? '#0284C7' : theme === 'red' ? '#EF4444' : '#22D3EE';
      ctx.strokeStyle = finderColor;
      ctx.globalAlpha = 0.82;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.arc(cx, cy, finderR, 0, Math.PI * 2);
      // 4 subtle rim ticks
      const tk = 6;
      ctx.moveTo(cx - finderR - tk, cy);
      ctx.lineTo(cx - finderR + tk, cy);
      ctx.moveTo(cx + finderR - tk, cy);
      ctx.lineTo(cx + finderR + tk, cy);
      ctx.moveTo(cx, cy - finderR - tk);
      ctx.lineTo(cx, cy - finderR + tk);
      ctx.moveTo(cx, cy + finderR - tk);
      ctx.lineTo(cx, cy + finderR + tk);
      ctx.stroke();
      if (finderR > 14 && finderR < Math.min(width, height) * 0.5) {
        ctx.fillStyle = finderColor;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.fillText('7×50 파인더 (7.0°)', cx + 6, cy - finderR - 5);
      }
      ctx.restore();
    }
  }

  if (optics.showEyepiece) {
    const rPx = stereoRadiusPx(optics.eyepieceFovDeg);
    if (rPx >= 3 && rPx < Math.max(width, height) * 1.6) {
      ctx.save();
      const epColor =
        theme === 'white' ? '#D97706' : theme === 'red' ? '#DC2626' : '#F59E0B';
      ctx.strokeStyle = epColor;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = epColor;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      const magText =
        optics.eyepieceInputMode === 'calc' && optics.eyepieceFocalLengthMm > 0
          ? ` · ${(optics.telescopeFocalLengthMm / optics.eyepieceFocalLengthMm).toFixed(0)}×`
          : '';
      ctx.fillText(
        `아이피스 (${optics.eyepieceFovDeg.toFixed(2)}°${magText})`,
        cx + 4,
        cy + rPx + 12
      );
      ctx.restore();
    }
  }

  if (optics.showSensorBox) {
    const wPx = stereoRadiusPx(optics.sensorWidthDeg) * 2;
    const hPx = stereoRadiusPx(optics.sensorHeightDeg) * 2;
    if (wPx >= 6 && hPx >= 6) {
      ctx.save();
      ctx.strokeStyle = palette.reticleSensor;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(cx - wPx / 2, cy - hPx / 2, wPx, hPx);
      ctx.fillStyle = palette.reticleSensor;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.fillText(
        `FOV ${optics.sensorWidthDeg.toFixed(2)}° × ${optics.sensorHeightDeg.toFixed(2)}°`,
        cx - wPx / 2,
        cy - hPx / 2 - 5
      );
      ctx.restore();
    }
  }

  // 11. Selection & Hover Reticles
  if (selected && optics.showSelectionMark) {
    const selPt = projectStereographic(selected.data.ra, selected.data.dec, proj, 30);
    if (selPt) {
      ctx.save();
      ctx.strokeStyle = palette.selectionRing;
      ctx.lineWidth = 1.5;
      const r = 13;
      ctx.beginPath();
      ctx.arc(selPt.x, selPt.y, r, 0, Math.PI * 2);
      ctx.moveTo(selPt.x - r - 5, selPt.y);
      ctx.lineTo(selPt.x - r + 2, selPt.y);
      ctx.moveTo(selPt.x + r - 2, selPt.y);
      ctx.lineTo(selPt.x + r + 5, selPt.y);
      ctx.moveTo(selPt.x, selPt.y - r - 5);
      ctx.lineTo(selPt.x, selPt.y - r + 2);
      ctx.moveTo(selPt.x, selPt.y + r - 2);
      ctx.lineTo(selPt.x, selPt.y + r + 5);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (hoveredId && hoveredId !== selected?.data.id) {
    const hTarget = targets.find((t) => t.id === hoveredId);
    if (hTarget) {
      ctx.save();
      ctx.strokeStyle = palette.selectionRing;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(hTarget.x, hTarget.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 12. Collision-Free Label Pass
  labelCandidates.sort((a, b) => a.priority - b.priority);
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  if (hipsVisible) {
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = theme === 'white' ? 'rgba(255,255,255,0.85)' : 'rgba(5,7,12,0.85)';
  }

  for (const cand of labelCandidates) {
    ctx.font = cand.font;
    const textW = ctx.measureText(cand.text).width;
    const textH = 12;
    const pos = placer.placeLabel(
      cand.x,
      cand.y,
      cand.radius,
      textW,
      textH,
      width,
      height
    );
    if (pos) {
      if (hipsVisible) ctx.strokeText(cand.text, pos.x, pos.y);
      ctx.fillStyle = cand.color;
      ctx.fillText(cand.text, pos.x, pos.y);
    }
  }
  ctx.restore();

  // 12.5. Observatory Mountain Terrain Silhouette (occludes sky objects below the ridge)
  if (layers.showTerrain) {
    drawTerrainSilhouette(
      ctx,
      width,
      height,
      view,
      theme,
      proj,
      lstDeg,
      observer.lat,
      layers.showHorizon,
      palette.horizonText
    );
  }

  if (view.fsz >= 145) {
    ctx.restore();
    if (hipsVisible) {
      ctx.save();
      ctx.fillStyle = palette.bg;
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(width / 2, height / 2, halfSkyRadius, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = palette.gridEq;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, halfSkyRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  return {
    targets,
    magLimit,
    dsoMagLimit: dsoMagCutoff,
    visibleStarCount,
    visibleDsoCount,
    activeStarHop,
    northAngleDeg: proj.northAngleDeg,
  };
}
