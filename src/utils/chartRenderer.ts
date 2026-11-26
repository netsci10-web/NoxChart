import {
  CatalogSnapshot,
  GAIA_LIVE_MAX_FSZ,
  getVisibleUltraTileKeys,
} from '../data/catalogLoader';
import { getFieldStarsInBounds } from './fieldStars';
import { buildLocalStarObject, getVisibleLocalStarCellKeys } from './localStarCatalogs';
import {
  clampBortleClass,
  computeBortleDsoAttenuation,
  computeBortleDsoMagPenalty,
  computeBortleMagPenalty,
  getBortleInfo,
} from './bortle';
import {
  AsterismDraftState,
  AsterismSnapPreview,
  AsterismStoreState,
  AsterismTool,
  ChallengeCheckpoint,
  ChallengeTrack,
  ChartViewState,
  DeepSkyObject,
  DoubleStarSystem,
  HipsSettings,
  LayerSettings,
  MilkyWayLayer,
  NebulaContour,
  ObserverConfig,
  ObservingSessionEntry,
  OpticsSettings,
  RulerMeasurement,
  RulerPoint,
  ScreenTarget,
  SelectedItem,
  Star,
  StarHopGuide,
  ThemeMode,
} from '../types/astronomy';
import {
  angularDistanceDeg,
  bvToStarColor,
  computeAltitudeDegFast,
  computeAtmosphericExtinctionMag,
  createProjectionParams,
  DEG2RAD,
  equatorialToHorizontal,
  findStarHopGuides,
  formatAngularDistanceDMS,
  getDsoLimitingMagnitude,
  getHorizonSensorScreenAngleDeg,
  getLimitingMagnitude,
  getLSTDeg,
  getPixelsPerDeg,
  getStarRadiusPogson,
  getStereographicRadiusPx,
  horizontalToEquatorial,
  projectHorizontalRaw,
  projectStereographic,
  projectStereographicRaw,
  ProjectionParams,
  RAD2DEG,
} from './astronomy';
import {
  drawCircleRimLabel,
  formatLinkedReticleTitle,
  getOpticsDirectionVector,
  renderAsterismsPass,
} from './asterismRenderer';
import { LabelPlacer } from './labelPlacer';
import { getPlanetRenderer } from './planetRenderer';
import {
  getSolarSystemBodies,
  getSolarSystemDailyTrail,
  getSolarSystemOrbitTracks,
} from './solarSystem';

export interface AsterismRenderContext {
  store: AsterismStoreState;
  drawingActive: boolean;
  activeTool?: AsterismTool;
  selectedObjectId: string | null;
  draft: AsterismDraftState | null;
  hoverSnap: AsterismSnapPreview | null;
}

export interface RulerRenderContext {
  active: boolean;
  measurement: RulerMeasurement | null;
  hoverPoint: RulerPoint | null;
}

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
  doubleStarStroke: string;
  multipleStarStroke: string;
  doubleStarLabel: string;
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
      milkyWayFill: 'rgba(100, 116, 139, 0.11)',
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
      gridEqText: 'rgba(15, 23, 42, 0.85)',
      gridAltAz: 'rgba(37, 99, 235, 0.17)',
      gridAltAzText: 'rgba(29, 78, 216, 0.88)',
      horizonStroke: '#DC2626',
      horizonText: '#B91C1C',
      eclipticStroke: 'rgba(180, 83, 9, 0.48)',
      constellationLine: 'rgb(30, 58, 138)',
      constellationBoundary: 'rgb(71, 85, 105)',
      constellationName: 'rgb(15, 23, 42)',
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
      dsoLabel: '#020617',
      starLabel: '#0F172A',
      doubleStarStroke: '#B45309',
      multipleStarStroke: '#1D4ED8',
      doubleStarLabel: '#92400E',
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
      milkyWayFill: 'rgba(185, 28, 28, 0.085)',
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
      gridEqText: 'rgba(255, 107, 107, 0.85)',
      gridAltAz: 'rgba(239, 68, 68, 0.22)',
      gridAltAzText: 'rgba(255, 138, 138, 0.88)',
      horizonStroke: 'rgba(239, 68, 68, 0.72)',
      horizonText: '#F87171',
      eclipticStroke: 'rgba(185, 28, 28, 0.40)',
      constellationLine: 'rgb(220, 38, 38)',
      constellationBoundary: 'rgb(185, 28, 28)',
      constellationName: 'rgb(255, 107, 107)',
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
      dsoLabel: '#FF7070',
      starLabel: '#FF5A5A',
      doubleStarStroke: '#EF4444',
      multipleStarStroke: '#FCA5A5',
      doubleStarLabel: '#F87171',
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
    milkyWayFill: 'rgba(148, 179, 224, 0.085)',
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
    gridEqText: 'rgba(203, 213, 225, 0.86)',
    gridAltAz: 'rgba(6, 182, 212, 0.16)',
    gridAltAzText: 'rgba(103, 232, 249, 0.88)',
    horizonStroke: 'rgba(245, 158, 11, 0.65)',
    horizonText: '#F59E0B',
    eclipticStroke: 'rgba(245, 158, 11, 0.32)',
    constellationLine: 'rgb(100, 149, 237)',
    constellationBoundary: 'rgb(148, 163, 184)',
    constellationName: 'rgb(226, 232, 240)',
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
    dsoLabel: '#FFFFFF',
    starLabel: '#F8FAFC',
    doubleStarStroke: '#FCD34D',
    multipleStarStroke: '#38BDF8',
    doubleStarLabel: '#FDE68A',
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
  const jumpThreshold = Math.max(proj.width, proj.height) * 0.6;

  // View center unit vector in J2000 equatorial 3D Cartesian coordinates
  const ra0Rad = proj.ra0Deg * DEG2RAD;
  const dec0Rad = proj.dec0Deg * DEG2RAD;
  const cx = Math.cos(dec0Rad) * Math.cos(ra0Rad);
  const cy = Math.cos(dec0Rad) * Math.sin(ra0Rad);
  const cz = Math.sin(dec0Rad);
  const minDot = -0.12;

  for (const layer of layers) {
    for (const poly of layer.polys) {
      // Skip the 2 global 360° cap-separating rings in ol1 (handled cleanly by the Galactic Plane band)
      if (poly.length > 1000) continue;

      // Convert polygon vertices to 3D unit vectors and clip against front hemisphere (dot >= minDot)
      const clipped: [number, number, number][] = [];
      const n = poly.length;
      if (n < 3) continue;

      let prevRa = poly[n - 1][0] * DEG2RAD;
      let prevDec = poly[n - 1][1] * DEG2RAD;
      let prevX = Math.cos(prevDec) * Math.cos(prevRa);
      let prevY = Math.cos(prevDec) * Math.sin(prevRa);
      let prevZ = Math.sin(prevDec);
      let prevDot = prevX * cx + prevY * cy + prevZ * cz;

      for (let i = 0; i < n; i++) {
        const ra = poly[i][0] * DEG2RAD;
        const dec = poly[i][1] * DEG2RAD;
        const vx = Math.cos(dec) * Math.cos(ra);
        const vy = Math.cos(dec) * Math.sin(ra);
        const vz = Math.sin(dec);
        const curDot = vx * cx + vy * cy + vz * cz;

        const prevInside = prevDot >= minDot;
        const curInside = curDot >= minDot;

        if (prevInside !== curInside) {
          const denom = curDot - prevDot;
          const t = Math.abs(denom) > 1e-8 ? (minDot - prevDot) / denom : 0.5;
          const ix = prevX + (vx - prevX) * t;
          const iy = prevY + (vy - prevY) * t;
          const iz = prevZ + (vz - prevZ) * t;
          const len = Math.hypot(ix, iy, iz) || 1;
          clipped.push([ix / len, iy / len, iz / len]);
        }
        if (curInside) {
          clipped.push([vx, vy, vz]);
        }

        prevX = vx;
        prevY = vy;
        prevZ = vz;
        prevDot = curDot;
      }

      if (clipped.length < 3) continue;

      let validPts = 0;
      let lastX = 0;
      let lastY = 0;
      let broken = false;

      ctx.beginPath();
      for (let i = 0; i < clipped.length; i++) {
        const [vx, vy, vz] = clipped[i];
        const raDeg = ((Math.atan2(vy, vx) * RAD2DEG) + 360) % 360;
        const decDeg = Math.asin(Math.max(-1, Math.min(1, vz))) * RAD2DEG;
        const pt = projectStereographicRaw(raDeg, decDeg, proj, -0.35);
        if (!pt) {
          broken = true;
          break;
        }
        if (validPts === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          if (Math.hypot(pt.x - lastX, pt.y - lastY) > jumpThreshold) {
            broken = true;
            break;
          }
          ctx.lineTo(pt.x, pt.y);
        }
        lastX = pt.x;
        lastY = pt.y;
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
  lstDeg: number,
  opacityScale = 1
) {
  if (contours.length === 0 || opacityScale <= 0.02) return;
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
        ctx.globalAlpha = (dimmed ? 0.22 : 1.0) * opacityScale;
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
  dimmed: boolean,
  opacity = 1
): number {
  ctx.save();
  ctx.globalAlpha = (dimmed ? 0.18 : 0.92) * opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.25;

  const majPx = Math.max(5.0, (dso.majAx / 60) * pxPerDeg * 0.5);
  const minPx = Math.max(3.0, (dso.minAx / 60) * pxPerDeg * 0.5);

  if (dso.type === 'GX') {
    ctx.translate(x, y);
    const flipSign = (proj.flipH ? -1 : 1) * (proj.flipV ? -1 : 1);
    const rotDeg = (90 - dso.pa) * flipSign + proj.northAngleDeg + proj.rotationDeg;
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
    ctx.rotate(((90 - dso.pa) * flipSign + proj.northAngleDeg + proj.rotationDeg) * DEG2RAD);
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
  observerLat: number
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
}

// Reusable offscreen buffer for smooth continuous altitude-based atmospheric & Bortle gradients
let altGradientCanvas: HTMLCanvasElement | null = null;
let altGradientCtx: CanvasRenderingContext2D | null = null;
let altGradientImageData: ImageData | null = null;

// 4x4 Bayer matrix normalized for subtle sub-LSB dithering (eliminates 8-bit dark gradient banding)
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

function getAltGradientBuffer(gw: number, gh: number): {
  canvas: HTMLCanvasElement;
  gctx: CanvasRenderingContext2D;
  imageData: ImageData;
} | null {
  if (typeof document === 'undefined') return null;
  if (!altGradientCanvas) {
    altGradientCanvas = document.createElement('canvas');
    altGradientCtx = altGradientCanvas.getContext('2d');
  }
  if (!altGradientCtx) return null;
  if (altGradientCanvas.width !== gw || altGradientCanvas.height !== gh) {
    altGradientCanvas.width = gw;
    altGradientCanvas.height = gh;
    altGradientImageData = altGradientCtx.createImageData(gw, gh);
  }
  if (!altGradientImageData) {
    altGradientImageData = altGradientCtx.createImageData(gw, gh);
  }
  return {
    canvas: altGradientCanvas,
    gctx: altGradientCtx,
    imageData: altGradientImageData,
  };
}

/**
 * Computes the local Zenith unit vector in the stereographic projection basis (E, N, F)
 * so sin(altitude) can be evaluated continuously for every pixel without trig calls.
 */
function getZenithBasis(
  view: ChartViewState,
  proj: ProjectionParams,
  lstDeg: number,
  observerLat: number
): { zF: number; zE: number; zN: number; invScaleX: number; invScaleY: number } {
  const isHoriz = view.coordSystem === 'horizontal';
  const dirX = isHoriz ? (proj.flipH ? -1 : 1) : (proj.flipH ? 1 : -1);
  const dirY = proj.flipV ? 1 : -1;
  const invScaleX = 1 / (proj.scale * dirX);
  const invScaleY = 1 / (proj.scale * dirY);

  if (isHoriz) {
    const alt0 = proj.alt0Deg * DEG2RAD;
    return {
      zF: Math.sin(alt0),
      zE: 0,
      zN: Math.cos(alt0),
      invScaleX,
      invScaleY,
    };
  }

  const a0 = proj.ra0Deg * DEG2RAD;
  const d0 = proj.dec0Deg * DEG2RAD;
  const lst = lstDeg * DEG2RAD;
  const lat = observerLat * DEG2RAD;
  const dA = lst - a0;
  const sinD0 = Math.sin(d0);
  const cosD0 = Math.cos(d0);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const cosDA = Math.cos(dA);

  return {
    zF: sinD0 * sinLat + cosD0 * cosLat * cosDA,
    zE: cosLat * Math.sin(dA),
    zN: cosD0 * sinLat - sinD0 * cosLat * cosDA,
    invScaleX,
    invScaleY,
  };
}

/**
 * Draw continuous, smooth horizon atmospheric extinction haze above Alt = 0°
 * when Atmospheric Extinction mode is active, scaling smoothly with k.
 */
function drawAtmosphericExtinctionBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ChartViewState,
  theme: ThemeMode,
  proj: ProjectionParams,
  lstDeg: number,
  observerLat: number,
  extinctionCoeff: number
) {
  if (width < 2 || height < 2) return;
  const kNorm = Math.max(0.15, Math.min(1.0, (extinctionCoeff - 0.05) / 0.7));
  const maxAlpha =
    theme === 'white'
      ? 0.07 + 0.14 * kNorm
      : theme === 'red'
      ? 0.10 + 0.24 * kNorm
      : 0.09 + 0.28 * kNorm;
  if (maxAlpha < 0.008) return;

  const gw = Math.max(64, Math.min(180, Math.round(width / 7)));
  const gh = Math.max(48, Math.min(136, Math.round(height / 7)));
  const buf = getAltGradientBuffer(gw, gh);
  if (!buf) return;

  const { zF, zE, zN, invScaleX, invScaleY } = getZenithBasis(view, proj, lstDeg, observerLat);
  const hasRot = proj.rotationDeg !== 0;
  const cosRot = proj.cosRot;
  const sinRot = proj.sinRot;
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const stepX = width / gw;
  const stepY = height / gh;

  const data = buf.imageData.data;
  const isWhite = theme === 'white';
  const isRed = theme === 'red';
  let idx = 0;

  for (let iy = 0; iy < gh; iy++) {
    const dy = (iy + 0.5) * stepY - halfH;
    const bayerRow = (iy & 3) * 4;
    for (let ix = 0; ix < gw; ix++) {
      const dx = (ix + 0.5) * stepX - halfW;
      const u = hasRot ? dx * cosRot + dy * sinRot : dx;
      const v = hasRot ? -dx * sinRot + dy * cosRot : dy;
      const px = u * invScaleX;
      const py = v * invScaleY;
      const t2 = 0.25 * (px * px + py * py);
      const sinAlt = ((1 - t2) * zF + px * zE + py * zN) / (1 + t2);

      if (sinAlt <= -0.09) {
        data[idx++] = 0;
        data[idx++] = 0;
        data[idx++] = 0;
        data[idx++] = 0;
        continue;
      }

      const belowFade =
        sinAlt >= 0 ? 1.0 : Math.exp(-((sinAlt / 0.032) * (sinAlt / 0.032)));
      const sPos = sinAlt > 0 ? sinAlt : 0;
      const haze = Math.exp(-sPos / 0.115) * belowFade;
      const alpha = maxAlpha * haze;

      if (alpha < 0.002) {
        data[idx++] = 0;
        data[idx++] = 0;
        data[idx++] = 0;
        data[idx++] = 0;
        continue;
      }

      const dither = (BAYER_4X4[bayerRow + (ix & 3)] - 7.5) / 16;
      if (isWhite) {
        data[idx++] = 148;
        data[idx++] = 163;
        data[idx++] = 184;
      } else if (isRed) {
        data[idx++] = 42;
        data[idx++] = 4;
        data[idx++] = 4;
      } else {
        const lowTint = Math.exp(-sPos / 0.065);
        data[idx++] = Math.round(26 + (56 - 26) * lowTint);
        data[idx++] = Math.round(39 + (46 - 39) * lowTint);
        data[idx++] = Math.round(64 + (58 - 64) * lowTint);
      }
      data[idx++] = Math.max(0, Math.min(255, Math.round(alpha * 255 + dither)));
    }
  }

  buf.gctx.putImageData(buf.imageData, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(buf.canvas, 0, 0, width, height);
  ctx.restore();
}

/**
 * Renders a smooth, band-free urban skyglow wash & horizon light-pollution dome
 * for Bortle scale classes 2–9 using a continuous stereographic altitude gradient.
 */
function drawBortleLightDome(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ChartViewState,
  theme: ThemeMode,
  proj: ProjectionParams,
  lstDeg: number,
  observerLat: number,
  bortleClass: number
) {
  if (theme === 'white' || width < 2 || height < 2) return;
  const info = getBortleInfo(bortleClass);
  if (info.skyGlowAlpha <= 0.005 && info.horizonDomeAlpha <= 0.005) return;

  const gw = Math.max(72, Math.min(184, Math.round(width / 7)));
  const gh = Math.max(54, Math.min(140, Math.round(height / 7)));
  const buf = getAltGradientBuffer(gw, gh);
  if (!buf) return;

  const { zF, zE, zN, invScaleX, invScaleY } = getZenithBasis(view, proj, lstDeg, observerLat);
  const hasRot = proj.rotationDeg !== 0;
  const cosRot = proj.cosRot;
  const sinRot = proj.sinRot;
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const stepX = width / gw;
  const stepY = height / gh;

  const isRed = theme === 'red';
  const bNorm = Math.max(0, Math.min(1, (bortleClass - 2) / 7));

  // Continuous zenith skyglow floor + broad mid-sky dome + warm low-horizon dome
  const floorAlphaMax = info.skyGlowAlpha * (isRed ? 0.36 : 0.48);
  const midAlphaMax = info.horizonDomeAlpha * (isRed ? 0.22 : 0.30);
  const warmAlphaMax = info.horizonDomeAlpha * (isRed ? 0.28 : 0.42);

  // Smoothly interpolated RGB palettes (no discrete color jumps)
  const floorR = isRed ? 74 : 28 + 34 * bNorm;
  const floorG = isRed ? 10 : 40 + 28 * bNorm;
  const floorB = isRed ? 10 : 68 + 18 * bNorm;

  const midR = isRed ? 104 : 74 + 22 * bNorm;
  const midG = isRed ? 14 : 84 + 14 * bNorm;
  const midB = isRed ? 12 : 112 + 8 * bNorm;

  const warmR = isRed ? 132 : 152 + 22 * bNorm;
  const warmG = isRed ? 22 : 116 + 16 * bNorm;
  const warmB = isRed ? 14 : 84 + 4 * bNorm;

  const data = buf.imageData.data;
  let idx = 0;

  for (let iy = 0; iy < gh; iy++) {
    const dy = (iy + 0.5) * stepY - halfH;
    const bayerRow = (iy & 3) * 4;
    for (let ix = 0; ix < gw; ix++) {
      const dx = (ix + 0.5) * stepX - halfW;
      const u = hasRot ? dx * cosRot + dy * sinRot : dx;
      const v = hasRot ? -dx * sinRot + dy * cosRot : dy;
      const px = u * invScaleX;
      const py = v * invScaleY;
      const t2 = 0.25 * (px * px + py * py);
      const sinAlt = ((1 - t2) * zF + px * zE + py * zN) / (1 + t2);

      // Gentle Gaussian roll-off below Alt = 0° so there is no hard cut when ground mask is off
      const horizonMask =
        sinAlt >= 0 ? 1.0 : Math.exp(-((sinAlt / 0.055) * (sinAlt / 0.055)));
      const skyFloorMask =
        sinAlt >= 0 ? 1.0 : 0.22 + 0.78 * Math.exp(-((sinAlt / 0.14) * (sinAlt / 0.14)));

      const sPos = sinAlt > 0 ? sinAlt : 0;
      const midCurve = Math.exp(-sPos / 0.42);
      const warmCurve = Math.exp(-sPos / 0.135);

      const aFloor = floorAlphaMax * skyFloorMask;
      const aMid = midAlphaMax * midCurve * horizonMask;
      const aWarm = warmAlphaMax * warmCurve * horizonMask;

      const totalA = 1 - (1 - aFloor) * (1 - aMid) * (1 - aWarm);
      if (totalA < 0.002) {
        data[idx++] = 0;
        data[idx++] = 0;
        data[idx++] = 0;
        data[idx++] = 0;
        continue;
      }

      const wSum = aFloor + aMid + aWarm;
      const invW = 1 / wSum;
      const r = (aFloor * floorR + aMid * midR + aWarm * warmR) * invW;
      const g = (aFloor * floorG + aMid * midG + aWarm * warmG) * invW;
      const b = (aFloor * floorB + aMid * midB + aWarm * warmB) * invW;

      const dither = (BAYER_4X4[bayerRow + (ix & 3)] - 7.5) / 16;
      data[idx++] = Math.max(0, Math.min(255, Math.round(r + dither * 0.5)));
      data[idx++] = Math.max(0, Math.min(255, Math.round(g + dither * 0.5)));
      data[idx++] = Math.max(0, Math.min(255, Math.round(b + dither * 0.5)));
      data[idx++] = Math.max(0, Math.min(255, Math.round(Math.min(0.74, totalA) * 255 + dither)));
    }
  }

  buf.gctx.putImageData(buf.imageData, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(buf.canvas, 0, 0, width, height);
  ctx.restore();
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
  extMag: number;
}

function getOpticalFlipTag(flipH: boolean, flipV: boolean): string {
  if (flipH && flipV) return '상하·좌우반전';
  if (flipH) return '좌우반전';
  if (flipV) return '상하반전';
  return '';
}

function drawOpticalReticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ChartViewState,
  theme: ThemeMode,
  optics: OpticsSettings,
  proj: ProjectionParams,
  palette: ThemePalette,
  eyepieceFlipActive: boolean
) {
  const cx = width / 2;
  const cy = height / 2;

  if (optics.showCrosshair) {
    ctx.save();
    const crossColor =
      theme === 'white' ? '#0369A1' : theme === 'red' ? '#EF4444' : '#06B6D4';
    const gap = 8;
    const armOuter = Math.min(width, height) * 0.45;
    const armInner = 34;

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

  const reticleLineWidth = Math.max(0.5, Math.min(6.0, optics.reticleLineWidth ?? 1.4));
  const reticleOpacity = Math.max(0.1, Math.min(1.0, optics.reticleOpacity ?? 0.85));
  const showReticleLabel = optics.showReticleLabel !== false;
  const reticleLabelDirection = optics.reticleLabelDirection ?? 'ne';
  const reticleDirVec = getOpticsDirectionVector(reticleLabelDirection);

  if (optics.showFinder7x50) {
    const finderFov = Math.max(0.5, Math.min(30, optics.finderFovDeg ?? 7.0));
    const finderR = stereoRadiusPx(finderFov);
    if (finderR >= 4 && finderR < Math.max(width, height) * 1.6) {
      ctx.save();
      const customFinderColor =
        typeof optics.finderColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(optics.finderColor.trim())
          ? optics.finderColor.trim()
          : '';
      const finderColor =
        customFinderColor ||
        (theme === 'white' ? '#0284C7' : theme === 'red' ? '#EF4444' : '#22D3EE');
      ctx.strokeStyle = finderColor;
      ctx.globalAlpha = reticleOpacity;
      ctx.lineWidth = reticleLineWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, finderR, 0, Math.PI * 2);
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

      // Optional optical finder center crosshair spanning rim-to-center with a tiny target gap
      if (optics.finderCrosshair && finderR >= 10) {
        const gap = Math.max(3.5, Math.min(finderR * 0.14, 11));
        ctx.save();
        ctx.strokeStyle = finderColor;
        ctx.globalAlpha = Math.max(0.15, reticleOpacity * 0.78);
        ctx.lineWidth = Math.max(0.75, reticleLineWidth * 0.72);
        ctx.beginPath();
        ctx.moveTo(cx - finderR, cy);
        ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy);
        ctx.lineTo(cx + finderR, cy);
        ctx.moveTo(cx, cy - finderR);
        ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap);
        ctx.lineTo(cx, cy + finderR);
        ctx.stroke();
        ctx.restore();
      }

      if (showReticleLabel && finderR > 14 && finderR < Math.min(width, height) * 0.5) {
        drawCircleRimLabel(
          ctx,
          cx + reticleDirVec.ux * finderR,
          cy + reticleDirVec.uy * finderR,
          reticleLabelDirection,
          formatLinkedReticleTitle('finder', finderFov),
          finderColor,
          theme,
          reticleOpacity
        );
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

      // Subtle optical bezel casing when eyepiece-only flip is active so the seam reads cleanly
      if (eyepieceFlipActive) {
        ctx.strokeStyle =
          theme === 'white'
            ? 'rgba(255, 255, 255, 0.85)'
            : theme === 'red'
            ? 'rgba(20, 0, 0, 0.85)'
            : 'rgba(6, 10, 20, 0.85)';
        ctx.lineWidth = Math.max(3.2, reticleLineWidth + 2.2);
        ctx.beginPath();
        ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = epColor;
      ctx.globalAlpha = reticleOpacity;
      ctx.lineWidth = eyepieceFlipActive ? Math.max(reticleLineWidth, 1.85) : reticleLineWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.stroke();

      const normRot = ((optics.eyepieceRotationDeg % 360) + 360) % 360;
      const rotActive = normRot > 0.05 && normRot < 359.95;
      // Directional index tick on eyepiece bezel showing current rotation orientation
      if (rotActive && rPx >= 14) {
        const tickAngle = -Math.PI / 2 + normRot * DEG2RAD;
        const cosT = Math.cos(tickAngle);
        const sinT = Math.sin(tickAngle);
        ctx.lineWidth = Math.max(1.5, reticleLineWidth + 0.4);
        ctx.beginPath();
        ctx.moveTo(cx + cosT * (rPx - 4), cy + sinT * (rPx - 4));
        ctx.lineTo(cx + cosT * (rPx + 6), cy + sinT * (rPx + 6));
        ctx.stroke();
      }

      if (showReticleLabel) {
        const magText =
          optics.eyepieceInputMode === 'calc' && optics.eyepieceFocalLengthMm > 0
            ? ` · ${(optics.telescopeFocalLengthMm / optics.eyepieceFocalLengthMm).toFixed(0)}×`
            : '';
        const flipTag = eyepieceFlipActive ? getOpticalFlipTag(view.flipH, view.flipV) : '';
        const rotTag = rotActive ? `회전 ${Math.round(normRot)}°` : '';
        const extraTags = [flipTag, rotTag].filter(Boolean).join(' · ');
        const extraSuffix = extraTags ? ` · ${extraTags}` : '';
        const baseTitle = formatLinkedReticleTitle('eyepiece', optics.eyepieceFovDeg);
        const fullLabel =
          magText || extraSuffix
            ? `${baseTitle.slice(0, -1)}${magText}${extraSuffix})`
            : baseTitle;
        drawCircleRimLabel(
          ctx,
          cx + reticleDirVec.ux * rPx,
          cy + reticleDirVec.uy * rPx,
          reticleLabelDirection,
          fullLabel,
          epColor,
          theme,
          reticleOpacity
        );
      }
      ctx.restore();
    }
  }

  if (optics.showSensorBox) {
    const mosaicSupported = Boolean(optics.sensorMosaicSupported);
    const mosaicMax = Math.max(1.2, Math.min(4.0, optics.sensorMosaicMaxScale ?? 2.0));
    const scaleW = mosaicSupported
      ? Math.max(1.0, Math.min(mosaicMax, optics.sensorMosaicScaleW ?? 1.0))
      : 1.0;
    const scaleH = mosaicSupported
      ? Math.max(1.0, Math.min(mosaicMax, optics.sensorMosaicScaleH ?? 1.0))
      : 1.0;
    const isMosaicExpanded = mosaicSupported && (scaleW > 1.001 || scaleH > 1.001);
    const effW = optics.sensorWidthDeg * scaleW;
    const effH = optics.sensorHeightDeg * scaleH;

    const wPx = stereoRadiusPx(effW) * 2;
    const hPx = stereoRadiusPx(effH) * 2;
    const baseWPx = stereoRadiusPx(optics.sensorWidthDeg) * 2;
    const baseHPx = stereoRadiusPx(optics.sensorHeightDeg) * 2;

    if (wPx >= 6 && hPx >= 6) {
      const rawSensorRot = optics.sensorRotationLocked ? 0 : (optics.sensorRotationDeg ?? 0);
      const normSensorRot = ((rawSensorRot % 360) + 360) % 360;
      const sensorRotActive = normSensorRot > 0.05 && normSensorRot < 359.95;

      // Ground-based camera frame: reference 0° to the local horizon / Zenith direction
      // so it rotates naturally over time (field rotation) in Equatorial view and stays level in Horizontal view.
      const { screenDeg: screenSensorRotDeg } = getHorizonSensorScreenAngleDeg(
        proj,
        normSensorRot
      );
      const screenRotActive = screenSensorRotDeg > 0.05 && screenSensorRotDeg < 359.95;

      ctx.save();
      ctx.translate(cx, cy);
      if (screenRotActive) {
        ctx.rotate(screenSensorRotDeg * DEG2RAD);
      }

      // Inner single-frame reference rectangle when mosaic is expanded
      if (isMosaicExpanded && baseWPx >= 4 && baseHPx >= 4) {
        ctx.save();
        ctx.strokeStyle = palette.reticleSensor;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(-baseWPx / 2, -baseHPx / 2, baseWPx, baseHPx);
        ctx.restore();
      }

      // Outer active sensor / mosaic frame
      ctx.strokeStyle = palette.reticleSensor;
      ctx.lineWidth = isMosaicExpanded ? 1.6 : 1.3;
      ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);

      // Corner ticks for mosaic frame readability
      if (isMosaicExpanded && wPx >= 24 && hPx >= 24) {
        const tick = Math.min(10, wPx * 0.12, hPx * 0.12);
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        // TL
        ctx.moveTo(-wPx / 2, -hPx / 2 + tick);
        ctx.lineTo(-wPx / 2, -hPx / 2);
        ctx.lineTo(-wPx / 2 + tick, -hPx / 2);
        // TR
        ctx.moveTo(wPx / 2 - tick, -hPx / 2);
        ctx.lineTo(wPx / 2, -hPx / 2);
        ctx.lineTo(wPx / 2, -hPx / 2 + tick);
        // BL
        ctx.moveTo(-wPx / 2, hPx / 2 - tick);
        ctx.lineTo(-wPx / 2, hPx / 2);
        ctx.lineTo(-wPx / 2 + tick, hPx / 2);
        // BR
        ctx.moveTo(wPx / 2 - tick, hPx / 2);
        ctx.lineTo(wPx / 2, hPx / 2);
        ctx.lineTo(wPx / 2, hPx / 2 - tick);
        ctx.stroke();
      }

      if ((screenRotActive || sensorRotActive) && hPx >= 14) {
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -hPx / 2);
        ctx.lineTo(0, -hPx / 2 - 6);
        ctx.stroke();
      }
      ctx.fillStyle = palette.reticleSensor;
      ctx.font = '500 10px "IBM Plex Mono", "Pretendard", monospace';
      const rotTag =
        sensorRotActive || view.coordSystem === 'equatorial'
          ? ` · 지평 ${Math.round(normSensorRot)}°`
          : '';
      const frameLabel = isMosaicExpanded
        ? `모자이크 ${effW.toFixed(2)}° × ${effH.toFixed(2)}° (${scaleW.toFixed(1)}×${scaleH.toFixed(1)})${rotTag}`
        : `FOV ${optics.sensorWidthDeg.toFixed(2)}° × ${optics.sensorHeightDeg.toFixed(2)}°${rotTag}`;
      ctx.fillText(frameLabel, -wPx / 2, -hPx / 2 - 5);
      ctx.restore();
    }
  }
}

interface PassOptions {
  skipReticles?: boolean;
  isInnerClip?: boolean;
  eyepieceFlipActive?: boolean;
  rotationDeg?: number;
  sensorPhotoMode?: boolean;
}

function renderStarChartPass(
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
  sessionIds: Set<string>,
  solarTrails?: Record<string, number>,
  passOptions?: PassOptions,
  sessionPlan?: ObservingSessionEntry[],
  challenges?: ChallengeTrack[],
  asterismCtx?: AsterismRenderContext
): RenderResult {
  const palette = getThemePalette(theme);
  const obsTimeMs = observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);
  const proj = createProjectionParams(
    view,
    width,
    height,
    lstDeg,
    observer.lat,
    passOptions?.rotationDeg ?? 0
  );
  const isInnerClip = Boolean(passOptions?.isInnerClip);
  const isSensorPhoto = Boolean(passOptions?.sensorPhotoMode);

  const pxPerDeg = getPixelsPerDeg(view.fsz, width, height);
  const bortleActive = Boolean(observer.bortleEnabled) && !isSensorPhoto;
  const bortleClass = clampBortleClass(observer.bortleClass ?? 4);
  const bortleInfo = getBortleInfo(bortleClass);
  const bortleMagPenalty = bortleActive ? computeBortleMagPenalty(bortleClass, view.fsz) : 0;
  const magLimit = Math.max(2.2, getLimitingMagnitude(view.fsz, layers.magOffset) - bortleMagPenalty);
  const hipsVisible = hips.enabled && hips.opacity > 0.02;
  const altFilterActive = observer.minAltitudeDeg > -90;
  const extActive = Boolean(layers.showAtmosphericExtinction);
  const extK = Math.max(0.1, Math.min(0.8, layers.extinctionCoeff ?? 0.25));
  const sinObsLat = Math.sin(observer.lat * DEG2RAD);
  const cosObsLat = Math.cos(observer.lat * DEG2RAD);

  // 1. Background Fill (Transparent when HiPS survey is active behind canvas)
  const halfSkyRadius = (Math.min(width, height) / 2) / Math.tan((view.fsz / 4) * DEG2RAD);
  const applySkyCircleClip = !isInnerClip && view.fsz >= 145;
  if (hipsVisible) {
    ctx.clearRect(0, 0, width, height);
    if (applySkyCircleClip) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, halfSkyRadius, 0, Math.PI * 2);
      ctx.clip();
    }
  } else {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
    if (applySkyCircleClip) {
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

  // 1.5. Bortle Scale Light Pollution Skyglow & Horizon Light Dome
  if (bortleActive && bortleClass >= 2) {
    drawBortleLightDome(
      ctx,
      width,
      height,
      view,
      theme,
      proj,
      lstDeg,
      observer.lat,
      bortleClass
    );
  }

  // 2. Milky Way (Galactic Plane band + layered star-cloud contours)
  const mwBortleAlpha = bortleActive ? bortleInfo.milkyWayAlpha : 1.0;
  if (layers.showMilkyWay && mwBortleAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = mwBortleAlpha;
    ctx.strokeStyle = palette.milkyWayFill;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const bOffset of [-6, 0, 6]) {
      ctx.lineWidth = Math.max(16, Math.min(260, pxPerDeg * (bOffset === 0 ? 16 : 10)));
      const pts: { raDeg: number; decDeg: number }[] = [];
      for (let l = 0; l <= 360; l += 4) {
        pts.push(galacticToEquatorial(l, bOffset));
      }
      drawProjectedCurve(ctx, pts, proj, true);
    }

    // Subtle Galactic Equator (b = 0°) guide line
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.0;
    ctx.strokeStyle =
      theme === 'white'
        ? 'rgba(71, 85, 105, 0.36)'
        : theme === 'red'
        ? 'rgba(220, 38, 38, 0.35)'
        : 'rgba(148, 197, 255, 0.28)';
    const eqPts: { raDeg: number; decDeg: number }[] = [];
    for (let l = 0; l <= 360; l += 4) {
      eqPts.push(galacticToEquatorial(l, 0));
    }
    drawProjectedCurve(ctx, eqPts, proj, true);

    if (catalogs.milkyWay.length > 0 && view.fsz >= 12) {
      drawMilkyWayContours(ctx, catalogs.milkyWay, proj, palette.milkyWayFill);
    }
    ctx.restore();
  }

  // 2.5. Real Multi-Level Nebula Contours (FChart3 / CZSky — 513 polygons across 193 nebulae)
  if (layers.showNebulaContours && catalogs.nebulaContours.length > 0 && view.fsz <= 95) {
    const nebBortleScale = bortleActive ? computeBortleDsoAttenuation(bortleClass, 'DN') : 1;
    drawNebulaContours(ctx, catalogs.nebulaContours, proj, palette, observer, lstDeg, nebBortleScale);
  }

  const gridLineWidth = Math.max(0.2, Math.min(2.5, layers.gridLineWidth ?? 0.8));
  const gridLineOpacity = Math.max(0.05, Math.min(1.0, layers.gridLineOpacity ?? 0.35));
  const gridAlphaMul = gridLineOpacity / 0.35;
  const scaleRgbaAlpha = (color: string, mul: number, maxAlpha: number): string => {
    const m = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/);
    if (!m) return color;
    const nextA = Math.max(0.015, Math.min(maxAlpha, Number(m[4]) * mul));
    return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${nextA.toFixed(3)})`;
  };
  const effGridEqStroke = scaleRgbaAlpha(palette.gridEq, gridAlphaMul, 0.72);
  const effGridEqText = scaleRgbaAlpha(palette.gridEqText, gridAlphaMul, 0.96);
  const effGridAltAzStroke = scaleRgbaAlpha(palette.gridAltAz, gridAlphaMul, 0.75);
  const effGridAltAzText = scaleRgbaAlpha(palette.gridAltAzText, gridAlphaMul, 0.96);

  const gridAspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
  const formatGridDeg = (deg: number, signed: boolean): string => {
    const isNeg = deg < -1e-6;
    const totalArcMin = Math.round(Math.abs(deg) * 60);
    const wholeDeg = Math.floor(totalArcMin / 60);
    const arcMin = totalArcMin % 60;
    const sign = signed ? (isNeg ? '-' : '+') : '';
    if (arcMin === 0) return `${sign}${wholeDeg}°`;
    return `${sign}${wholeDeg}°${String(arcMin).padStart(2, '0')}′`;
  };

  // 3. Equatorial RA / Dec Grid (progressive steps down to 0.5°)
  if (layers.showGridEq) {
    const raStepDeg =
      view.fsz > 120
        ? 30
        : view.fsz > 45
        ? 15
        : view.fsz > 18
        ? 7.5
        : view.fsz > 7.5
        ? 2.5
        : view.fsz > 2.8
        ? 1
        : 0.5;
    const decStepDeg =
      view.fsz > 120
        ? 30
        : view.fsz > 45
        ? 15
        : view.fsz > 20
        ? 10
        : view.fsz > 9
        ? 5
        : view.fsz > 4.5
        ? 2
        : view.fsz > 2.2
        ? 1
        : 0.5;

    const eqViewRadius = Math.min(
      95,
      view.fsz * 0.62 * gridAspect + Math.max(raStepDeg, decStepDeg) * 2
    );
    const decLimit = decStepDeg <= 1 ? 88 : decStepDeg <= 5 ? 85 : 75;
    const decStartIdx = Math.ceil(Math.max(-decLimit, proj.dec0Deg - eqViewRadius) / decStepDeg);
    const decEndIdx = Math.floor(Math.min(decLimit, proj.dec0Deg + eqViewRadius) / decStepDeg);
    const useEqCull = eqViewRadius < 50 && Math.abs(proj.dec0Deg) + eqViewRadius < 82;

    ctx.save();
    ctx.strokeStyle = effGridEqStroke;
    ctx.lineWidth = gridLineWidth;
    ctx.fillStyle = effGridEqText;
    ctx.font = '10px "IBM Plex Mono", monospace';

    for (let idx = decStartIdx; idx <= decEndIdx; idx++) {
      const d = Math.round(idx * decStepDeg * 100) / 100;
      const isEquator = Math.abs(d) < 1e-6;
      const isHalfDeg = decStepDeg < 1 && !Number.isInteger(d);
      if (isEquator || isHalfDeg) {
        ctx.save();
        if (isEquator) {
          ctx.lineWidth = gridLineWidth * 1.45;
        } else {
          ctx.lineWidth = gridLineWidth * 0.8;
          ctx.globalAlpha = 0.72;
        }
      }

      const pts: { raDeg: number; decDeg: number }[] = [];
      if (useEqCull && Math.abs(d) < 82) {
        const raHalfSpan = Math.min(
          180,
          eqViewRadius / Math.max(0.14, Math.cos(d * DEG2RAD)) + raStepDeg * 1.5
        );
        if (raHalfSpan >= 175) {
          const rStep = Math.max(1, Math.min(5, view.fsz / 10));
          for (let r = 0; r <= 360; r += rStep) {
            pts.push({ raDeg: r, decDeg: d });
          }
          drawProjectedCurve(ctx, pts, proj, true);
        } else {
          const rStart = proj.ra0Deg - raHalfSpan;
          const rEnd = proj.ra0Deg + raHalfSpan;
          const rStep = Math.max(0.2, Math.min(4, (raHalfSpan * 2) / 36));
          for (let r = rStart; r <= rEnd + rStep * 0.5; r += rStep) {
            const clamped = Math.min(rEnd, r);
            pts.push({ raDeg: ((clamped % 360) + 360) % 360, decDeg: d });
          }
          drawProjectedCurve(ctx, pts, proj, false);
        }
      } else {
        for (let r = 0; r <= 360; r += 5) {
          pts.push({ raDeg: r, decDeg: d });
        }
        drawProjectedCurve(ctx, pts, proj, true);
      }

      if (isEquator || isHalfDeg) ctx.restore();

      const labelPt = projectStereographic(proj.ra0Deg, d, proj, 0);
      if (labelPt) {
        ctx.fillText(formatGridDeg(d, true), labelPt.x + 4, labelPt.y - 4);
      }
    }

    const eqMeridianRAs: number[] = [];
    if (useEqCull) {
      const maxAbsDec = Math.min(82, Math.abs(proj.dec0Deg) + eqViewRadius);
      const raHalfSpan = Math.min(
        180,
        eqViewRadius / Math.max(0.14, Math.cos(maxAbsDec * DEG2RAD)) + raStepDeg * 2
      );
      const kStart = Math.floor((proj.ra0Deg - raHalfSpan) / raStepDeg);
      const kEnd = Math.ceil((proj.ra0Deg + raHalfSpan) / raStepDeg);
      const seenRa = new Set<number>();
      for (let k = kStart; k <= kEnd; k++) {
        const raw = Math.round(k * raStepDeg * 100) / 100;
        const norm = Math.round((((raw % 360) + 360) % 360) * 100) / 100;
        const key = norm >= 360 ? 0 : norm;
        if (!seenRa.has(key)) {
          seenRa.add(key);
          eqMeridianRAs.push(key);
        }
      }
    } else {
      const count = Math.round(360 / raStepDeg);
      for (let k = 0; k < count; k++) {
        eqMeridianRAs.push(Math.round(k * raStepDeg * 100) / 100);
      }
    }

    const merDecMin = useEqCull ? Math.max(-88, proj.dec0Deg - eqViewRadius) : -85;
    const merDecMax = useEqCull ? Math.min(88, proj.dec0Deg + eqViewRadius) : 85;
    const merDecSample = useEqCull ? Math.max(0.2, Math.min(5, (merDecMax - merDecMin) / 36)) : 5;
    const labelDecLimit = decStepDeg <= 1 ? 86 : 75;
    const labelDec = Math.max(-labelDecLimit, Math.min(labelDecLimit, proj.dec0Deg));

    for (const r of eqMeridianRAs) {
      const isHalfDeg = raStepDeg < 1 && !Number.isInteger(r);
      if (isHalfDeg) {
        ctx.save();
        ctx.lineWidth = gridLineWidth * 0.8;
        ctx.globalAlpha = 0.72;
      }

      const pts: { raDeg: number; decDeg: number }[] = [];
      for (let d = merDecMin; d <= merDecMax + merDecSample * 0.5; d += merDecSample) {
        pts.push({ raDeg: r, decDeg: Math.min(merDecMax, d) });
      }
      drawProjectedCurve(ctx, pts, proj, false);

      if (isHalfDeg) ctx.restore();

      const labelPt = projectStereographic(r, labelDec, proj, 0);
      if (labelPt) {
        const totalMin = Math.round((r / 15) * 60);
        const hrs = Math.floor(totalMin / 60) % 24;
        const mins = totalMin % 60;
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

  // 5. Alt-Az Grid & Local Horizon Circle (progressive steps down to 0.5°)
  if (layers.showGridAltAz) {
    const azStep =
      view.fsz > 90
        ? 30
        : view.fsz > 35
        ? 15
        : view.fsz > 14
        ? 5
        : view.fsz > 6
        ? 2
        : view.fsz > 2.6
        ? 1
        : 0.5;
    const altStep =
      view.fsz > 90
        ? 15
        : view.fsz > 35
        ? 10
        : view.fsz > 14
        ? 5
        : view.fsz > 6
        ? 2
        : view.fsz > 2.6
        ? 1
        : 0.5;

    const hzViewRadius = Math.min(
      95,
      view.fsz * 0.62 * gridAspect + Math.max(azStep, altStep) * 2
    );
    const minAltBound = view.coordSystem === 'horizontal' ? (altStep <= 1 ? -85 : -60) : 0;
    const maxAltBound = altStep <= 1 ? 88 : 80;
    const altStartIdx = Math.ceil(
      Math.max(minAltBound, proj.alt0Deg - hzViewRadius) / altStep
    );
    const altEndIdx = Math.floor(
      Math.min(maxAltBound, proj.alt0Deg + hzViewRadius) / altStep
    );
    const useHzCull = hzViewRadius < 50 && Math.abs(proj.alt0Deg) + hzViewRadius < 82;

    ctx.save();
    ctx.strokeStyle = effGridAltAzStroke;
    ctx.lineWidth = gridLineWidth;
    ctx.fillStyle = effGridAltAzText;
    ctx.font = '10px "IBM Plex Mono", monospace';

    for (let idx = altStartIdx; idx <= altEndIdx; idx++) {
      const alt = Math.round(idx * altStep * 100) / 100;
      if (Math.abs(alt) < 1e-6) continue;
      if (view.coordSystem === 'equatorial' && alt < 0) continue;

      const isHalfDeg = altStep < 1 && !Number.isInteger(alt);
      if (isHalfDeg) {
        ctx.save();
        ctx.lineWidth = gridLineWidth * 0.8;
        ctx.globalAlpha = 0.72;
      }

      const pts: { raDeg: number; decDeg: number }[] = [];
      if (useHzCull && Math.abs(alt) < 82) {
        const azHalfSpan = Math.min(
          180,
          hzViewRadius / Math.max(0.14, Math.cos(alt * DEG2RAD)) + azStep * 1.5
        );
        if (azHalfSpan >= 175) {
          const aStep = Math.max(1, Math.min(4, view.fsz / 10));
          for (let az = 0; az <= 360; az += aStep) {
            pts.push(horizontalToEquatorial(alt, az, lstDeg, observer.lat));
          }
          drawProjectedCurve(ctx, pts, proj, true);
        } else {
          const aStart = proj.az0Deg - azHalfSpan;
          const aEnd = proj.az0Deg + azHalfSpan;
          const aStep = Math.max(0.2, Math.min(4, (azHalfSpan * 2) / 36));
          for (let az = aStart; az <= aEnd + aStep * 0.5; az += aStep) {
            const clamped = Math.min(aEnd, az);
            pts.push(
              horizontalToEquatorial(alt, ((clamped % 360) + 360) % 360, lstDeg, observer.lat)
            );
          }
          drawProjectedCurve(ctx, pts, proj, false);
        }
      } else {
        for (let az = 0; az <= 360; az += 4) {
          pts.push(horizontalToEquatorial(alt, az, lstDeg, observer.lat));
        }
        drawProjectedCurve(ctx, pts, proj, true);
      }

      if (isHalfDeg) ctx.restore();

      if (view.coordSystem === 'horizontal') {
        const lbl = projectHorizontalRaw(alt, proj.az0Deg, proj, -0.1);
        if (lbl && lbl.x > 16 && lbl.x < width - 48 && lbl.y > 16 && lbl.y < height - 16) {
          ctx.fillText(formatGridDeg(alt, true), lbl.x + 4, lbl.y - 3);
        }
      }
    }

    const hzAzimuths: number[] = [];
    if (useHzCull) {
      const maxAbsAlt = Math.min(82, Math.abs(proj.alt0Deg) + hzViewRadius);
      const azHalfSpan = Math.min(
        180,
        hzViewRadius / Math.max(0.14, Math.cos(maxAbsAlt * DEG2RAD)) + azStep * 2
      );
      const kStart = Math.floor((proj.az0Deg - azHalfSpan) / azStep);
      const kEnd = Math.ceil((proj.az0Deg + azHalfSpan) / azStep);
      const seenAz = new Set<number>();
      for (let k = kStart; k <= kEnd; k++) {
        const raw = Math.round(k * azStep * 100) / 100;
        const norm = Math.round((((raw % 360) + 360) % 360) * 100) / 100;
        const key = norm >= 360 ? 0 : norm;
        if (!seenAz.has(key)) {
          seenAz.add(key);
          hzAzimuths.push(key);
        }
      }
    } else {
      const count = Math.round(360 / azStep);
      for (let k = 0; k < count; k++) {
        hzAzimuths.push(Math.round(k * azStep * 100) / 100);
      }
    }

    const merAltMin = useHzCull
      ? Math.max(minAltBound, proj.alt0Deg - hzViewRadius)
      : view.coordSystem === 'horizontal'
      ? -60
      : 0;
    const merAltMax = useHzCull ? Math.min(88, proj.alt0Deg + hzViewRadius) : 86;
    const merAltSample = useHzCull ? Math.max(0.2, Math.min(4, (merAltMax - merAltMin) / 36)) : 4;
    const lblAlt = Math.max(
      altStep <= 1 ? -75 : 2,
      Math.min(altStep <= 1 ? 86 : 75, proj.alt0Deg)
    );

    for (const az of hzAzimuths) {
      const isHalfDeg = azStep < 1 && !Number.isInteger(az);
      if (isHalfDeg) {
        ctx.save();
        ctx.lineWidth = gridLineWidth * 0.8;
        ctx.globalAlpha = 0.72;
      }

      const pts: { raDeg: number; decDeg: number }[] = [];
      for (let alt = merAltMin; alt <= merAltMax + merAltSample * 0.5; alt += merAltSample) {
        pts.push(horizontalToEquatorial(Math.min(merAltMax, alt), az, lstDeg, observer.lat));
      }
      drawProjectedCurve(ctx, pts, proj, false);

      if (isHalfDeg) ctx.restore();

      if (view.coordSystem === 'horizontal') {
        const lbl = projectHorizontalRaw(lblAlt, az, proj, -0.1);
        if (lbl && lbl.x > 16 && lbl.x < width - 48 && lbl.y > 16 && lbl.y < height - 16) {
          ctx.fillText(formatGridDeg(az, false), lbl.x + 3, lbl.y + 11);
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
    ctx.globalAlpha = Math.max(0.05, Math.min(1, layers.constellationLineOpacity ?? 0.35));
    ctx.strokeStyle = palette.constellationBoundary;
    ctx.lineWidth = 0.85;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i < catalogs.constellationBoundaries.length; i++) {
      drawProjectedTupleCurve(ctx, catalogs.constellationBoundaries[i], proj);
    }
    ctx.restore();
  }

  // 6. All 88 IAU Constellation Stick Figures (Modern IAU vs Traditional Classical) & Names
  if (layers.showConstellationLines) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, layers.constellationLineOpacity ?? 0.35));
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
    ctx.globalAlpha = Math.max(0.05, Math.min(1, layers.constellationLineOpacity ?? 0.35));
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
      ctx.fillText(text, Math.round(pt.x), Math.round(pt.y));
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
    alpha?: number;
  };
  const labelCandidates: LabelCandidate[] = [];

  // 7. Deep Sky Objects (Messier + Caldwell + OpenNGC NGC/IC + Barnard/LDN Dark Nebulae)
  const dsoMagCutoff = getDsoLimitingMagnitude(view.fsz, layers.dsoMagOffset);
  const showKnownMessier = Boolean(layers.showMessierCatalog);
  const showKnownCaldwell = Boolean(layers.showCaldwellCatalog);
  const renderAnyDso = layers.showDso || showKnownMessier || showKnownCaldwell;
  const isMessierId = (id: string) => /^M([1-9]|[1-9]\d|10\d|110)$/i.test(id);
  let visibleDsoCount = 0;
  if (renderAnyDso) {
    interface PendingDso {
      dso: DeepSkyObject;
      pt: { x: number; y: number };
      belowMinAlt: boolean;
      isSelected: boolean;
      isOnScreen: boolean;
      isKnownForced: boolean;
      labelPrefix?: string;
      extMag: number;
    }

    const normDsoId = (s?: string) => (s ? s.replace(/\s+/g, '').toUpperCase() : '');
    const selectedDsoKeys = new Set<string>();
    if (selected?.kind === 'dso') {
      const k1 = normDsoId(selected.data.id);
      const k2 = normDsoId(selected.data.altId);
      if (k1) selectedDsoKeys.add(k1);
      if (k2) selectedDsoKeys.add(k2);
    }

    const caldwellByNormKey = new Map<string, (typeof catalogs.caldwell)[number]>();
    for (const c of catalogs.caldwell) {
      caldwellByNormKey.set(normDsoId(c.id), c);
      caldwellByNormKey.set(normDsoId(c.caldwellId), c);
    }

    const pendingDsos: PendingDso[] = [];
    const onScreenGeneral: PendingDso[] = [];
    const seenDsoKeys = new Set<string>();

    const checkSelectedDso = (dso: DeepSkyObject) =>
      selected?.kind === 'dso' &&
      (selectedDsoKeys.has(normDsoId(dso.id)) ||
        (dso.altId ? selectedDsoKeys.has(normDsoId(dso.altId)) : false) ||
        (Math.abs(dso.dec - selected.data.dec) < 0.03 &&
          angularDistanceDeg(dso.ra, dso.dec, selected.data.ra, selected.data.dec) < 0.03));

    const markSeenDso = (dso: DeepSkyObject, extraKey?: string) => {
      const k1 = normDsoId(dso.id);
      if (k1) seenDsoKeys.add(k1);
      if (dso.altId) seenDsoKeys.add(normDsoId(dso.altId));
      if (extraKey) seenDsoKeys.add(normDsoId(extraKey));
    };

    const isSeenDso = (dso: DeepSkyObject, extraKey?: string) => {
      const k1 = normDsoId(dso.id);
      if (k1 && seenDsoKeys.has(k1)) return true;
      if (dso.altId && seenDsoKeys.has(normDsoId(dso.altId))) return true;
      if (extraKey && seenDsoKeys.has(normDsoId(extraKey))) return true;
      return false;
    };

    const pushPendingDso = (
      dso: DeepSkyObject,
      isSelected: boolean,
      isKnownForced: boolean,
      labelPrefix?: string,
      extraSeenKey?: string
    ) => {
      const pt = projectStereographic(dso.ra, dso.dec, proj, 40);
      if (!pt) return;

      let belowMinAlt = false;
      let extMag = 0;
      if (altFilterActive || extActive) {
        const altDeg = computeAltitudeDegFast(
          dso.ra,
          dso.dec,
          lstDeg,
          sinObsLat,
          cosObsLat
        );
        if (altFilterActive) {
          belowMinAlt = altDeg < observer.minAltitudeDeg;
          if (belowMinAlt && !observer.highlightAboveMinAlt && !isSelected) {
            return;
          }
        }
        if (extActive) {
          extMag = computeAtmosphericExtinctionMag(altDeg, extK);
        }
      }
      const bortleDsoPen = bortleActive ? computeBortleDsoMagPenalty(bortleClass, dso.type) : 0;
      if (!isSelected && !isKnownForced && dso.mag + extMag + bortleDsoPen > dsoMagCutoff) {
        return;
      }

      markSeenDso(dso, extraSeenKey);
      const isOnScreen = pt.x >= 0 && pt.x <= width && pt.y >= 0 && pt.y <= height;
      const entry: PendingDso = {
        dso,
        pt,
        belowMinAlt,
        isSelected,
        isOnScreen,
        isKnownForced,
        labelPrefix,
        extMag,
      };
      pendingDsos.push(entry);
      if (isOnScreen && !belowMinAlt && !isKnownForced) {
        onScreenGeneral.push(entry);
      }
    };

    // 7a. Standard Deep Sky Objects when general DSO layer is enabled
    if (layers.showDso) {
      const dsoLists: DeepSkyObject[][] = [catalogs.dsosBright];
      if ((view.fsz <= 45 || dsoMagCutoff > 10.5) && catalogs.dsosDeep.length > 0) {
        dsoLists.push(catalogs.dsosDeep);
      }
      if (layers.dsoCategories.DARK && catalogs.darkNebulae.length > 0 && view.fsz <= 70) {
        dsoLists.push(catalogs.darkNebulae);
      }

      for (const list of dsoLists) {
        for (let i = 0; i < list.length; i++) {
          const dso = list[i];
          const isMessier = isMessierId(dso.id);
          const caldwellMatch =
            caldwellByNormKey.get(normDsoId(dso.id)) ??
            (dso.altId ? caldwellByNormKey.get(normDsoId(dso.altId)) : undefined);
          const isKnownForced =
            (showKnownMessier && isMessier) || (showKnownCaldwell && Boolean(caldwellMatch));
          const isSelected = checkSelectedDso(dso);

          if (!isKnownForced) {
            if (dso.mag > dsoMagCutoff && !isSelected) {
              if (list === catalogs.dsosDeep || list === catalogs.darkNebulae) break;
              continue;
            }
            if (!layers.dsoCategories[dso.type]) continue;
            if (!matchesCatalogFilter(dso, layers.catalogFilter)) continue;
          }
          if (isSeenDso(dso, caldwellMatch?.caldwellId)) continue;

          pushPendingDso(
            dso,
            isSelected,
            isKnownForced,
            showKnownCaldwell && caldwellMatch ? caldwellMatch.caldwellId : undefined,
            caldwellMatch?.caldwellId
          );
        }
      }
    }

    // 7b. Known DSO Override: Messier Catalog (M1–M110) — strictly M1–M110 only
    if (showKnownMessier) {
      const messierSource = catalogs.dsosBright;
      for (let i = 0; i < messierSource.length; i++) {
        const dso = messierSource[i];
        if (!isMessierId(dso.id)) continue;
        if (isSeenDso(dso)) continue;
        pushPendingDso(dso, checkSelectedDso(dso), true);
      }
    }

    // 7c. Known DSO Override: Caldwell Catalog (C1–C109) — visible even when showDso is OFF
    if (showKnownCaldwell) {
      for (let i = 0; i < catalogs.caldwell.length; i++) {
        const c = catalogs.caldwell[i];
        if (isSeenDso(c, c.caldwellId)) continue;
        pushPendingDso(c, checkSelectedDso(c), true, c.caldwellId, c.caldwellId);
      }
    }

    const symPct = Math.max(0, Math.min(100, layers.dsoSymbolDensityPct ?? 100));
    const allowedDsoSet = new Set<PendingDso>();
    if (symPct >= 100) {
      for (const entry of pendingDsos) allowedDsoSet.add(entry);
    } else {
      if (onScreenGeneral.length > 0) {
        onScreenGeneral.sort((a, b) => a.dso.mag - b.dso.mag);
        const symQuota = symPct <= 0 ? 0 : Math.ceil((onScreenGeneral.length * symPct) / 100);
        for (let i = 0; i < symQuota && i < onScreenGeneral.length; i++) {
          allowedDsoSet.add(onScreenGeneral[i]);
        }
      }
      // Known catalogs (Messier / Caldwell) and selected DSOs always display all symbols regardless of general DSO density
      for (const entry of pendingDsos) {
        if (entry.isKnownForced || entry.isSelected) allowedDsoSet.add(entry);
      }
    }

    const onScreenDsoItems: {
      mag: number;
      isSelected: boolean;
      isKnownForced: boolean;
      candidate: LabelCandidate;
    }[] = [];

    const dsoSymbolOpacity = Math.max(0.05, Math.min(1, layers.dsoSymbolOpacity ?? 1));
    const dsoLabelOpacity = Math.max(0.05, Math.min(1, layers.dsoLabelOpacity ?? 1));

    for (const entry of pendingDsos) {
      if (!allowedDsoSet.has(entry)) continue;
      const { dso, pt, belowMinAlt, isSelected, isOnScreen, isKnownForced, labelPrefix, extMag } =
        entry;
      const dsoExtScale =
        extActive && !isSelected && extMag > 0.05
          ? Math.max(0.14, Math.pow(10, -0.28 * extMag))
          : 1.0;
      const dsoBortleScale =
        bortleActive && !isSelected ? computeBortleDsoAttenuation(bortleClass, dso.type) : 1.0;
      const effDsoSymbolOpacity = Math.max(0.05, dsoSymbolOpacity * dsoExtScale * dsoBortleScale);
      // Keep DSO label opacity faithful to the user's slider setting instead of washing it out with Bortle dimming
      const effDsoLabelOpacity = Math.max(
        0.05,
        dsoLabelOpacity * (0.82 + 0.18 * dsoExtScale)
      );

      visibleDsoCount++;
      const hideDsoSymbol = Boolean(layers.hideDsoSymbols) || isSensorPhoto;
      const hideSelectedOverlay =
        !isSensorPhoto && !layers.hideDsoSymbols && isSelected && !optics.showSelectionMark;
      let symR = hideDsoSymbol ? 6 : 10;

      if (!hideSelectedOverlay && !hideDsoSymbol) {
        const symColor = palette.dsoColor[dso.type] ?? palette.dsoLabel;
        symR = drawDsoSymbol(
          ctx,
          dso,
          pt.x,
          pt.y,
          pxPerDeg,
          symColor,
          palette,
          proj,
          belowMinAlt,
          effDsoSymbolOpacity
        );
        if (dso.mag < 11.5 && dso.type !== 'DARK' && !belowMinAlt) {
          placer.registerObstacle(pt.x, pt.y, symR);
        }
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

      if (
        (layers.showDsoLabels || isKnownForced) &&
        !belowMinAlt &&
        isOnScreen &&
        (!hideSelectedOverlay || Boolean(layers.hideDsoSymbols))
      ) {
        const showCommon = view.fsz < 42 && dso.koName;
        const primaryCode = labelPrefix && labelPrefix !== dso.id ? labelPrefix : dso.id;
        const text = showCommon ? `${primaryCode} ${dso.koName}` : primaryCode;
        onScreenDsoItems.push({
          mag: dso.mag + extMag,
          isSelected,
          isKnownForced,
          candidate: {
            priority: isSelected
              ? -100
              : isKnownForced
              ? -10 + (dso.mag + extMag) * 0.25
              : dso.mag + extMag - (dso.id.startsWith('M') || labelPrefix ? 0.8 : 0),
            x: pt.x,
            y: pt.y,
            radius: Math.min(24, symR),
            text,
            color: dso.type === 'DARK' ? palette.darkNebulaStroke : palette.dsoLabel,
            font:
              isSelected || isKnownForced
                ? '600 10.5px "IBM Plex Mono", monospace'
                : '500 10.5px "IBM Plex Mono", monospace',
            alpha: isSensorPhoto ? 1 : effDsoLabelOpacity,
          },
        });
      }
    }

    if (onScreenDsoItems.length > 0) {
      const dsoPct = Math.max(0, Math.min(100, layers.dsoLabelDensityPct ?? 10));
      const generalItems = onScreenDsoItems.filter((it) => !it.isKnownForced);
      const knownItems = onScreenDsoItems.filter((it) => it.isKnownForced);

      if (layers.showDsoLabels && generalItems.length > 0) {
        generalItems.sort((a, b) => a.mag - b.mag);
        const dsoQuota = dsoPct <= 0 ? 0 : Math.ceil((generalItems.length * dsoPct) / 100);
        const maxDsoCandidates = Math.min(dsoQuota, 650);
        for (let i = 0; i < generalItems.length; i++) {
          const item = generalItems[i];
          if (i < maxDsoCandidates || item.isSelected) {
            labelCandidates.push(item.candidate);
          }
        }
      }

      // Known catalogs (Messier / Caldwell) always display all labels regardless of general DSO label toggle or density
      if (knownItems.length > 0) {
        knownItems.sort((a, b) => a.mag - b.mag);
        for (let i = 0; i < knownItems.length; i++) {
          labelCandidates.push(knownItems[i].candidate);
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

  const isInsideGaiaPatch = (raDeg: number, decDeg: number, starMag: number): boolean => {
    if (!gaiaActive || !gaiaPatch) return false;
    if (gaiaPatch.tiles && gaiaPatch.tiles.length > 0) {
      const normRa = ((raDeg % 360) + 360) % 360;
      for (let i = 0; i < gaiaPatch.tiles.length; i++) {
        const t = gaiaPatch.tiles[i];
        if (
          normRa >= t.raMin &&
          normRa < t.raMax &&
          decDeg >= t.decMin &&
          decDeg <= t.decMax
        ) {
          return starMag <= t.effectiveMaxMag + 0.05;
        }
      }
      return false;
    }
    const margin = Math.min(0.03, gaiaPatch.radius * 0.05);
    if (
      angularDistanceDeg(raDeg, decDeg, gaiaPatch.centerRa, gaiaPatch.centerDec) >
      gaiaPatch.radius - margin
    ) {
      return false;
    }
    return starMag <= (gaiaPatch.effectiveMaxMag ?? 20.5) + 0.05;
  };

  const evalStarAltitude = (
    raDeg: number,
    decDeg: number,
    isSelected: boolean,
    starMag?: number
  ): { skip: boolean; dimmed: boolean; extMag: number } => {
    if (!altFilterActive && !extActive) return { skip: false, dimmed: false, extMag: 0 };
    const altDeg = computeAltitudeDegFast(raDeg, decDeg, lstDeg, sinObsLat, cosObsLat);
    let dimmed = false;
    if (altFilterActive && altDeg < observer.minAltitudeDeg) {
      if (!observer.highlightAboveMinAlt && !isSelected) {
        return { skip: true, dimmed: false, extMag: 0 };
      }
      dimmed = true;
    }
    let extMag = 0;
    if (extActive) {
      extMag = computeAtmosphericExtinctionMag(altDeg, extK);
      if (starMag !== undefined && !isSelected && starMag + extMag > magLimit + 0.35) {
        return { skip: true, dimmed, extMag };
      }
    }
    return { skip: false, dimmed, extMag };
  };

  const hasLocalStarPacks = catalogs.localStarCount > 0 && catalogs.localStarTiles.size > 0;
  const localCoversMag = hasLocalStarPacks && catalogs.localStarMaxMag >= magLimit - 0.1;

  // 8a. Optional procedural ultra-faint fill ONLY when neither Gaia live nor local downloaded packs cover the region
  if (layers.showFieldStars && !gaiaActive && !localCoversMag && view.fsz <= 12 && magLimit > 10.2) {
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
      const altCheck = evalStarAltitude(star.ra, star.dec, false, star.mag);
      if (altCheck.skip) continue;
      drawableStars.push({
        star,
        x: pt.x,
        y: pt.y,
        radius: getStarRadiusPogson(star.mag + altCheck.extMag, magLimit, view.fsz),
        isBright: false,
        isSelected: false,
        dimmed: altCheck.dimmed,
        extMag: altCheck.extMag,
      });
    }
  }

  // 8b. Live ESA Gaia DR3 faint stars (8.3m - 20.0m) across finder tiles (<= 10°) & deep cones (<= 3.2°)
  if (gaiaActive) {
    const gList = catalogs.gaiaStars;
    let gaiaClickableCount = 0;
    for (let i = 0; i < gList.length; i++) {
      const star = gList[i];
      if (star.mag > magLimit) continue;
      const pt = projectStereographic(star.ra, star.dec, proj, 10);
      if (!pt) continue;
      const isSelected = selected?.kind === 'star' && selected.data.id === star.id;
      const altCheck = evalStarAltitude(star.ra, star.dec, isSelected, star.mag);
      if (altCheck.skip) continue;
      const r = getStarRadiusPogson(star.mag + altCheck.extMag, magLimit, view.fsz);
      drawableStars.push({
        star,
        x: pt.x,
        y: pt.y,
        radius: r,
        isBright: false,
        isSelected,
        dimmed: altCheck.dimmed,
        extMag: altCheck.extMag,
      });
      if (isSelected || gaiaClickableCount < 8000) {
        gaiaClickableCount++;
        targets.push({
          kind: 'star',
          id: star.id,
          x: pt.x,
          y: pt.y,
          radius: Math.max(6, r + 2.5),
          mag: star.mag,
          item: { kind: 'star', data: star },
        });
      }
    }
  }

  // 8b-local. Locally Downloaded Tiered Star Catalog Packs (문서/noxchart & IndexedDB)
  // Spatially tiled (10°×10° cells, sorted by mag) for instant offline rendering at 60fps
  if (magLimit > 8.0 && hasLocalStarPacks) {
    const localCellKeys = getVisibleLocalStarCellKeys(view.ra, view.dec, view.fsz);
    const maxLocalDrawable = view.fsz > 30 ? 18000 : 28000;
    let localDrawnCount = 0;
    let localClickableCount = 0;
    const allowLocalClick = view.fsz <= 18;

    for (let c = 0; c < localCellKeys.length && localDrawnCount < maxLocalDrawable; c++) {
      const cell = catalogs.localStarTiles.get(localCellKeys[c]);
      if (!cell || cell.coords.length < 4) continue;
      const flat = cell.coords;
      const ids = cell.ids;
      for (let i = 0; i < flat.length && localDrawnCount < maxLocalDrawable; i += 4) {
        const sMag = flat[i + 2];
        if (sMag > magLimit) break; // Sorted ascending by magnitude
        if (sMag <= 8.0) continue; // Covered by Hipparcos bright + deep
        const sRa = flat[i];
        const sDec = flat[i + 1];
        if (gaiaActive && sMag > 8.3 && isInsideGaiaPatch(sRa, sDec, sMag)) continue;
        const pt = projectStereographic(sRa, sDec, proj, 10);
        if (!pt) continue;

        const idIdx = (i >> 2) * 2;
        const starObj = buildLocalStarObject(
          sRa,
          sDec,
          sMag,
          flat[i + 3],
          ids[idIdx] ?? 0,
          ids[idIdx + 1] ?? 0
        );
        const starId = starObj.id;
        const isSelected = selected?.kind === 'star' && selected.data.id === starId;
        const altCheck = evalStarAltitude(sRa, sDec, isSelected, sMag);
        if (altCheck.skip) continue;

        const r = getStarRadiusPogson(sMag + altCheck.extMag, magLimit, view.fsz);
        drawableStars.push({
          star: starObj,
          x: pt.x,
          y: pt.y,
          radius: r,
          isBright: false,
          isSelected,
          dimmed: altCheck.dimmed,
          extMag: altCheck.extMag,
        });
        localDrawnCount++;

        if (isSelected || (allowLocalClick && localClickableCount < 6000 && sMag <= magLimit)) {
          localClickableCount++;
          targets.push({
            kind: 'star',
            id: starId,
            x: pt.x,
            y: pt.y,
            radius: Math.max(6, r + 2.5),
            mag: sMag,
            item: { kind: 'star', data: starObj },
          });
        }
      }
    }
  }

  // 8c. Spatially-Tiled Hipparcos Ultra Stars (mag 8.01 - 13.78)
  // Always fills areas outside an active Gaia patch/tiles AND when local star packs don't already cover them
  const skipUltraCoveredByLocal = hasLocalStarPacks && catalogs.localStarCount >= 70000;
  if (magLimit > 8.0 && catalogs.ultraStarTiles.size > 0 && !skipUltraCoveredByLocal) {
    const tileKeys = getVisibleUltraTileKeys(view.ra, view.dec, view.fsz);
    for (const key of tileKeys) {
      const tileStars = catalogs.ultraStarTiles.get(key);
      if (!tileStars) continue;
      for (let i = 0; i < tileStars.length; i++) {
        const star = tileStars[i];
        if (star.mag > magLimit) break;
        if (gaiaActive && star.mag > 8.3 && isInsideGaiaPatch(star.ra, star.dec, star.mag)) continue;
        const pt = projectStereographic(star.ra, star.dec, proj, 10);
        if (!pt) continue;
        const isSelected = selected?.kind === 'star' && selected.data.id === star.id;
        const altCheck = evalStarAltitude(star.ra, star.dec, isSelected, star.mag);
        if (altCheck.skip) continue;
        const r = getStarRadiusPogson(star.mag + altCheck.extMag, magLimit, view.fsz);
        drawableStars.push({
          star,
          x: pt.x,
          y: pt.y,
          radius: r,
          isBright: false,
          isSelected,
          dimmed: altCheck.dimmed,
          extMag: altCheck.extMag,
        });
        if (view.fsz <= 12 && star.mag <= Math.min(13.8, magLimit)) {
          targets.push({
            kind: 'star',
            id: star.id,
            x: pt.x,
            y: pt.y,
            radius: Math.max(6, r + 3),
            mag: star.mag,
            item: { kind: 'star', data: star },
          });
        }
      }
    }
  }

  // 8d. Deep Hipparcos Stars (mag 6.01 - 8.00)
  if (magLimit > 5.8 && catalogs.deepStars.length > 0) {
    const deepList = catalogs.deepStars;
    for (let i = 0; i < deepList.length; i++) {
      const star = deepList[i];
      if (star.mag > magLimit) break;
      if (gaiaActive && star.mag > 8.3 && isInsideGaiaPatch(star.ra, star.dec, star.mag)) continue;
      const pt = projectStereographic(star.ra, star.dec, proj, 12);
      if (!pt) continue;
      const isSelected = selected?.kind === 'star' && selected.data.id === star.id;
      const altCheck = evalStarAltitude(star.ra, star.dec, isSelected, star.mag);
      if (altCheck.skip) continue;
      const r = getStarRadiusPogson(star.mag + altCheck.extMag, magLimit, view.fsz);
      drawableStars.push({
        star,
        x: pt.x,
        y: pt.y,
        radius: r,
        isBright: false,
        isSelected,
        dimmed: altCheck.dimmed,
        extMag: altCheck.extMag,
      });
      if (view.fsz <= 25 && star.mag <= 8.0) {
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
    const altCheck = evalStarAltitude(star.ra, star.dec, isSelected, star.mag);
    if (altCheck.skip) continue;

    const r = getStarRadiusPogson(star.mag + altCheck.extMag, magLimit, view.fsz);
    drawableStars.push({
      star,
      x: pt.x,
      y: pt.y,
      radius: r,
      isBright: true,
      isSelected,
      dimmed: altCheck.dimmed,
      extMag: altCheck.extMag,
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

  // Ensure a newly searched/selected faint Hipparcos star is always visible & clickable
  // even while its ultra tile is still streaming or if current magLimit is brighter than the star
  if (selected?.kind === 'star' && !drawableStars.some((d) => d.isSelected)) {
    const selStar = selected.data;
    const pt = projectStereographic(selStar.ra, selStar.dec, proj, 20);
    if (pt) {
      const r = Math.max(
        1.8,
        getStarRadiusPogson(selStar.mag, Math.max(magLimit, selStar.mag + 0.5), view.fsz)
      );
      drawableStars.push({
        star: selStar,
        x: pt.x,
        y: pt.y,
        radius: r,
        isBright: selStar.mag <= 6.0,
        isSelected: true,
        dimmed: false,
        extMag: 0,
      });
      targets.push({
        kind: 'star',
        id: selStar.id,
        x: pt.x,
        y: pt.y,
        radius: Math.max(8, r + 4),
        mag: selStar.mag,
        item: { kind: 'star', data: selStar },
      });
    }
  }

  // Viewport-relative top-N% apparent-magnitude star labels & known proper star names
  if (layers.showStarLabels || layers.showProperStarNames) {
    const onScreenStars = drawableStars.filter(
      (item) => !item.dimmed && item.x >= 0 && item.x <= width && item.y >= 0 && item.y <= height
    );
    if (onScreenStars.length > 0) {
      onScreenStars.sort((a, b) => a.star.mag - b.star.mag);
      const starPct = Math.max(0, Math.min(100, layers.starLabelDensityPct ?? 10));
      const starLabelOpacity = Math.max(0.05, Math.min(1, layers.starLabelOpacity ?? 1));
      const starLabelLang = layers.starLabelLanguage ?? 'ko';
      const formatStarLabelByLang = (koName?: string, enName?: string): string | null => {
        const ko = koName?.trim() || '';
        const en = enName?.trim() || '';
        if (starLabelLang === 'en') {
          return en || ko || null;
        }
        if (starLabelLang === 'ko_en') {
          if (ko && en && ko.toLowerCase() !== en.toLowerCase()) {
            return `${ko}(${en})`;
          }
          return ko || en || null;
        }
        return ko || en || null;
      };
      const labeledStarIds = new Set<string>();

      // Known proper star names (works even when general showStarLabels is off, still respects top-N% brightness)
      if (layers.showProperStarNames) {
        const onScreenProperStars = onScreenStars.filter((item) =>
          Boolean(item.star.koName || item.star.name)
        );
        const properQuota =
          starPct <= 0 ? 0 : Math.ceil((onScreenProperStars.length * starPct) / 100);
        const maxProperCandidates = Math.min(properQuota, 450);
        for (let i = 0; i < onScreenProperStars.length; i++) {
          const item = onScreenProperStars[i];
          if (i >= maxProperCandidates && !item.isSelected) continue;
          const { star, x, y, radius, isSelected } = item;
          const properText = formatStarLabelByLang(star.koName, star.name);
          if (!properText) continue;

          labeledStarIds.add(star.id);
          labelCandidates.push({
            priority: isSelected ? -100 : star.mag + 0.8,
            x,
            y,
            radius,
            text: properText,
            color: palette.starLabel,
            font:
              star.mag < 1.5
                ? '600 11.5px "IBM Plex Sans", "Noto Sans KR", sans-serif'
                : '500 10.5px "IBM Plex Sans", "Noto Sans KR", sans-serif',
            alpha: isSensorPhoto ? 1 : starLabelOpacity,
          });
        }
      }

      if (layers.showStarLabels) {
        const starQuota = starPct <= 0 ? 0 : Math.ceil((onScreenStars.length * starPct) / 100);
        const maxStarCandidates = Math.min(starQuota, 650);
        for (let i = 0; i < onScreenStars.length; i++) {
          const item = onScreenStars[i];
          if (i >= maxStarCandidates && !item.isSelected) continue;
          const { star, x, y, radius, isSelected } = item;
          if (labeledStarIds.has(star.id)) continue;
          const namedLabel = formatStarLabelByLang(star.koName, star.name);
          let text: string | null = null;
          if (namedLabel && view.fsz < 95) text = namedLabel;
          else if (star.bayer) text = star.bayer;
          else if (namedLabel) text = namedLabel;
          else if (star.hip) text = `HIP ${star.hip}`;
          else if (star.gaiaId) text = `Gaia ${star.gaiaId.slice(-6)}`;
          else if (star.id && !star.id.startsWith('field_')) text = star.id;
          if (!text) continue;

          labeledStarIds.add(star.id);
          labelCandidates.push({
            priority: isSelected ? -100 : star.mag + 1.2,
            x,
            y,
            radius,
            text,
            color: palette.starLabel,
            font:
              star.mag < 1.5
                ? '600 11.5px "IBM Plex Sans", "Noto Sans KR", sans-serif'
                : '500 10.5px "IBM Plex Sans", "Noto Sans KR", sans-serif',
            alpha: isSensorPhoto ? 1 : starLabelOpacity,
          });
        }
      }
    }
  }

  // High-density readability optimization:
  // In rich Milky Way or 17-20m deep fields, enforce a screen-space cell budget (brightest-first)
  // so every bright/medium star is preserved while hyper-dense overlapping faint points stay crisp.
  let renderStars = drawableStars;
  if (drawableStars.length > 1100) {
    const cellSize = 22;
    const cols = Math.max(1, Math.ceil((width + 40) / cellSize));
    const cellCounts = new Uint16Array(cols * Math.max(1, Math.ceil((height + 40) / cellSize)));
    const maxPerCell = view.fsz <= 1.0 ? 5 : 4;
    const globalSoftCap = Math.max(2800, Math.min(6800, Math.round((width * height) / 210)));

    const sortedBrightFirst = drawableStars.slice().sort((a, b) => a.star.mag - b.star.mag);
    const filtered: DrawableStar[] = [];
    for (let i = 0; i < sortedBrightFirst.length; i++) {
      const item = sortedBrightFirst[i];
      const mustKeep =
        item.isSelected ||
        item.isBright ||
        item.star.mag <= 8.5 ||
        Boolean(item.star.name || item.star.koName || item.star.bayer);
      if (mustKeep) {
        filtered.push(item);
        continue;
      }
      if (filtered.length >= globalSoftCap) break;
      const cxIdx = Math.floor((item.x + 20) / cellSize);
      const cyIdx = Math.floor((item.y + 20) / cellSize);
      if (cxIdx >= 0 && cyIdx >= 0) {
        const flatIdx = cyIdx * cols + cxIdx;
        if (flatIdx < cellCounts.length) {
          if (cellCounts[flatIdx] >= maxPerCell) continue;
          cellCounts[flatIdx]++;
        }
      }
      filtered.push(item);
    }
    renderStars = filtered;
  }

  // Sort stars faintest -> brightest so bright stars + halo strokes cleanly separate binaries & clusters
  renderStars.sort((a, b) => b.star.mag - a.star.mag);
  const visibleStarCount = renderStars.length;
  const drawHalo = !hipsVisible || hips.opacity < 0.45;
  const deepAlphaActive = magLimit > 13.0;
  const faintMinAlpha = theme === 'white' ? 0.48 : 0.42;

  if (!(isSensorPhoto && hipsVisible)) {
    ctx.save();
    ctx.lineWidth = 1.15;
    ctx.strokeStyle = palette.starHaloStroke;

    for (let i = 0; i < renderStars.length; i++) {
      const { star, x, y, radius, isBright, dimmed, isSelected, extMag } = renderStars[i];
      const reddenBv =
        extActive && theme === 'dark' && layers.showStarColors && extMag > 0.25
          ? Math.min(1.25, extMag * 0.42)
          : 0;
      const color = bvToStarColor(star.bv + reddenBv, theme, layers.showStarColors);

      // Gentle faint-end luminance roll-off near magLimit keeps 17-20m fields refined and legible
      let starAlpha = dimmed ? 0.16 : 1.0;
      const effMag = star.mag + extMag;
      if (!dimmed && !isSelected && deepAlphaActive) {
        const dm = magLimit - effMag;
        if (dm < 1.8) {
          const t = Math.max(0, Math.min(1, dm / 1.8));
          starAlpha = faintMinAlpha + (1 - faintMinAlpha) * (t * t * (3 - 2 * t));
        }
      }
      if (extActive && !dimmed && !isSelected && extMag > 0.05) {
        const extAlpha = Math.max(0.12, Math.pow(10, -0.22 * extMag));
        starAlpha *= extAlpha;
      }
      ctx.globalAlpha = starAlpha;

      if (theme === 'dark' && isBright && effMag < 2.1 && !hipsVisible && !dimmed) {
        const glowR = radius * 2.6;
        const grad = ctx.createRadialGradient(x, y, radius * 0.35, x, y, glowR);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      if (drawHalo && radius >= 1.35 && !dimmed) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (layers.showStarOutlines) {
      const outlineOpacity = Math.max(0.05, Math.min(1, layers.starOutlineOpacity ?? 1));
      ctx.strokeStyle =
        theme === 'white'
          ? 'rgba(15, 23, 42, 0.92)'
          : theme === 'red'
          ? 'rgba(248, 113, 113, 0.92)'
          : 'rgba(186, 230, 253, 0.92)';
      for (let i = 0; i < renderStars.length; i++) {
        const { star, x, y, radius, dimmed, isSelected, extMag } = renderStars[i];
        let ringAlpha = (dimmed ? 0.16 : 0.85) * outlineOpacity;
        const effMag = star.mag + extMag;
        if (!dimmed && !isSelected && deepAlphaActive) {
          const dm = magLimit - effMag;
          if (dm < 1.8) {
            const t = Math.max(0, Math.min(1, dm / 1.8));
            ringAlpha =
              (faintMinAlpha + (1 - faintMinAlpha) * (t * t * (3 - 2 * t))) *
              0.85 *
              outlineOpacity;
          }
        }
        if (extActive && !dimmed && !isSelected && extMag > 0.05) {
          ringAlpha *= Math.max(0.12, Math.pow(10, -0.22 * extMag));
        }
        ctx.globalAlpha = ringAlpha;
        ctx.lineWidth = radius >= 2.6 ? 1.15 : 0.9;
        const ringR = Math.max(radius + 1.8, 3.0);
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 8f. WDS Double & Multiple Star Markers (─●─ for Double, ─(●)─ for Multiple) + Resolved Companions
  if (
    layers.showDoubleStars &&
    (layers.showDoublePairs || layers.showMultipleStars) &&
    catalogs.doubleStars.length > 0
  ) {
    interface PendingDouble {
      sys: DoubleStarSystem;
      pt: { x: number; y: number };
      dimmed: boolean;
      isSelected: boolean;
      isOnScreen: boolean;
    }

    const doubleMagCutoff = Math.min(8.8, magLimit + 0.55);
    const minSep = layers.doubleStarMinSepArcsec ?? 0;
    const pendingDoubles: PendingDouble[] = [];
    const onScreenNonDimmedDoubles: PendingDouble[] = [];

    for (let i = 0; i < catalogs.doubleStars.length; i++) {
      const sys = catalogs.doubleStars[i];
      const isSelected = selected?.kind === 'double' && selected.data.id === sys.id;
      if (sys.mag > doubleMagCutoff && !isSelected) {
        if (!selected || selected.kind !== 'double') break;
        continue;
      }
      if (!isSelected) {
        if (sys.isMultiple && !layers.showMultipleStars) continue;
        if (!sys.isMultiple && !layers.showDoublePairs) continue;
        if (sys.sep < minSep) continue;
      }
      const pt = projectStereographic(sys.ra, sys.dec, proj, 24);
      if (!pt) continue;
      const altCheck = evalStarAltitude(sys.ra, sys.dec, isSelected, sys.mag);
      if (altCheck.skip) continue;

      const isOnScreen = pt.x >= 0 && pt.x <= width && pt.y >= 0 && pt.y <= height;
      const entry: PendingDouble = {
        sys,
        pt,
        dimmed: altCheck.dimmed || (extActive && altCheck.extMag > 1.8),
        isSelected,
        isOnScreen,
      };
      pendingDoubles.push(entry);
      if (isOnScreen && !altCheck.dimmed) {
        onScreenNonDimmedDoubles.push(entry);
      }
    }

    const densityPct = Math.max(0, Math.min(100, layers.doubleStarDensityPct ?? 30));
    const allowedDoubles = new Set<PendingDouble>();
    if (densityPct >= 100) {
      for (const e of pendingDoubles) allowedDoubles.add(e);
    } else {
      onScreenNonDimmedDoubles.sort((a, b) => {
        const scoreA = a.sys.mag - (a.sys.isMultiple ? 0.25 : 0) - (a.sys.koName ? 0.2 : 0);
        const scoreB = b.sys.mag - (b.sys.isMultiple ? 0.25 : 0) - (b.sys.koName ? 0.2 : 0);
        return scoreA - scoreB;
      });
      const quota =
        densityPct <= 0 ? 0 : Math.ceil((onScreenNonDimmedDoubles.length * densityPct) / 100);
      const maxDraw = Math.min(quota, 420);
      for (let i = 0; i < onScreenNonDimmedDoubles.length; i++) {
        if (i < maxDraw || onScreenNonDimmedDoubles[i].isSelected) {
          allowedDoubles.add(onScreenNonDimmedDoubles[i]);
        }
      }
      for (const e of pendingDoubles) {
        if (e.isSelected) allowedDoubles.add(e);
      }
    }

    const doubleStarSymbolOpacity = Math.max(
      0.05,
      Math.min(1, layers.doubleStarSymbolOpacity ?? 1)
    );
    const doubleStarLabelOpacity = Math.max(
      0.05,
      Math.min(1, layers.doubleStarLabelOpacity ?? 1)
    );
    const renderedOnScreenDoubles: { entry: PendingDouble; markerR: number }[] = [];

    ctx.save();
    for (const entry of pendingDoubles) {
      if (!allowedDoubles.has(entry)) continue;
      const { sys, pt, dimmed, isSelected } = entry;
      const starR = getStarRadiusPogson(sys.mag, magLimit, view.fsz);
      const barHalf = Math.max(5.5, starR + 3.8);
      const ringR = Math.max(4.4, starR + 2.4);

      if (!isSensorPhoto) {
        const strokeCol = sys.isMultiple ? palette.multipleStarStroke : palette.doubleStarStroke;

        ctx.globalAlpha = (dimmed ? 0.2 : isSelected ? 1.0 : 0.88) * doubleStarSymbolOpacity;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = isSelected ? 1.55 : sys.isMultiple ? 1.2 : 1.1;

        // Classic horizontal bisecting bar (─●─) for Double & Multiple Stars
        ctx.beginPath();
        ctx.moveTo(pt.x - barHalf, pt.y);
        ctx.lineTo(pt.x + barHalf, pt.y);
        ctx.stroke();

        // Concentric companion ring (─(●)─) distinguishing Multiple Star systems (3+ components)
        if (sys.isMultiple) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Render resolved companion star(s) at real WDS PA & angular separation when zoomed in
        const pairList =
          sys.pairs && sys.pairs.length > 0
            ? sys.pairs
            : [{ comp: 'AB', sep: sys.sep, pa: sys.pa, mag1: sys.mag1, mag2: sys.mag2, disc: sys.disc }];
        const cosDecSafe = Math.max(0.05, Math.cos(sys.dec * DEG2RAD));

        for (let pIdx = 0; pIdx < pairList.length; pIdx++) {
          const pair = pairList[pIdx];
          // Only offset pairs anchored on primary 'A' (or single primary pair)
          if (pIdx > 0 && !pair.comp.startsWith('A')) continue;
          const sepPx = (pair.sep / 3600) * pxPerDeg;
          if (sepPx < 4.2 || sepPx > Math.max(width, height) * 0.9) continue;

          const sepDeg = pair.sep / 3600;
          const paRad = pair.pa * DEG2RAD;
          const compDec = Math.max(-89.999, Math.min(89.999, sys.dec + sepDeg * Math.cos(paRad)));
          const compRa = ((sys.ra + (sepDeg * Math.sin(paRad)) / cosDecSafe) % 360 + 360) % 360;
          const compPt = projectStereographic(compRa, compDec, proj, 24);
          if (!compPt) continue;

          const compR = Math.max(1.35, getStarRadiusPogson(pair.mag2, Math.max(magLimit, pair.mag2 + 1.2), view.fsz));
          if (isSelected || hoveredId === sys.id || sepPx >= 9) {
            ctx.save();
            ctx.strokeStyle = strokeCol;
            ctx.globalAlpha =
              (dimmed ? 0.15 : isSelected ? 0.65 : 0.35) * doubleStarSymbolOpacity;
            ctx.lineWidth = 0.85;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(compPt.x, compPt.y);
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.globalAlpha = (dimmed ? 0.2 : 0.96) * doubleStarSymbolOpacity;
          ctx.fillStyle = theme === 'white' ? '#1E293B' : theme === 'red' ? '#FCA5A5' : '#F8FAFC';
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.arc(compPt.x, compPt.y, compR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      const hitR = Math.max(8, barHalf + 2);
      targets.push({
        kind: 'double',
        id: sys.id,
        x: pt.x,
        y: pt.y,
        radius: hitR,
        mag: sys.mag,
        item: { kind: 'double', data: sys },
      });

      if (entry.isOnScreen && !dimmed) {
        renderedOnScreenDoubles.push({
          entry,
          markerR: isSensorPhoto ? 6 : Math.max(barHalf, ringR),
        });
      }
    }
    ctx.restore();

    // Double & Multiple star labels
    if (layers.showDoubleStarLabels && renderedOnScreenDoubles.length > 0) {
      renderedOnScreenDoubles.sort((a, b) => a.entry.sys.mag - b.entry.sys.mag);
      const lblPct = Math.max(0, Math.min(100, layers.doubleStarLabelDensityPct ?? 12));
      const lblQuota =
        lblPct <= 0 ? 0 : Math.ceil((renderedOnScreenDoubles.length * lblPct) / 100);
      const maxLbl = Math.min(lblQuota, 220);

      for (let i = 0; i < renderedOnScreenDoubles.length; i++) {
        const { entry, markerR } = renderedOnScreenDoubles[i];
        if (i >= maxLbl && !entry.isSelected) continue;
        const { sys, pt, isSelected } = entry;
        const baseName = sys.koName || sys.bayer || sys.name || sys.disc;
        const sepTxt = sys.sep >= 10 ? `${sys.sep.toFixed(0)}″` : `${sys.sep.toFixed(1)}″`;
        const tag = sys.isMultiple ? `(${sys.compCount}성)` : sepTxt;
        const text = `${baseName} ${tag}`;

        labelCandidates.push({
          priority: isSelected ? -105 : sys.mag + 1.45,
          x: pt.x,
          y: pt.y,
          radius: markerR + 2,
          text,
          color: sys.isMultiple ? palette.multipleStarStroke : palette.doubleStarLabel,
          font: '500 9.5px "IBM Plex Mono", "Noto Sans KR", monospace',
          alpha: isSensorPhoto ? 1 : doubleStarLabelOpacity,
        });
      }
    }
  }

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

    // 8b-0b. Explicit 10-Day Forward Ephemeris Trails with daily markers & date labels
    const activeTrailEntries = solarTrails ? Object.entries(solarTrails) : [];
    const trailLabelDraws: {
      trailColor: string;
      textColor: string;
      haloColor: string;
      bodyKoName: string;
      pts: {
        dayOffset: number;
        dateLabel: string;
        x: number;
        y: number;
        nx: number;
        ny: number;
      }[];
    }[] = [];

    if (activeTrailEntries.length > 0) {
      const trailMargin = Math.max(80, Math.min(width, height) * 0.48);
      ctx.save();
      for (const [bodyId, startMs] of activeTrailEntries) {
        const trail = getSolarSystemDailyTrail(bodyId, startMs, 10);
        if (!trail || trail.curvePoints.length < 2) continue;

        const trailColor =
          theme === 'red'
            ? '#F87171'
            : theme === 'white'
            ? bodyId === 'Sun'
              ? '#B45309'
              : '#1D4ED8'
            : bodyId === 'Moon' || bodyId === 'Mercury' || bodyId === 'Europa' || bodyId === 'Callisto' || bodyId === 'Rhea' || bodyId === 'Enceladus'
            ? '#38BDF8'
            : trail.color;

        const textColor =
          theme === 'red'
            ? '#FCA5A5'
            : theme === 'white'
            ? bodyId === 'Sun'
              ? '#92400E'
              : '#1E3A8A'
            : '#F8FAFC';

        const haloColor =
          theme === 'white'
            ? 'rgba(255, 255, 255, 0.92)'
            : theme === 'red'
            ? 'rgba(10, 0, 0, 0.88)'
            : 'rgba(6, 11, 22, 0.88)';

        // Subtle outer glow casing for legibility over Milky Way / HiPS imagery
        ctx.strokeStyle = haloColor;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 4.2;
        ctx.setLineDash([]);
        drawProjectedCurve(ctx, trail.curvePoints, proj, false);

        // Crisp foreground trajectory curve
        ctx.strokeStyle = trailColor;
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = 1.9;
        ctx.setLineDash([]);
        drawProjectedCurve(ctx, trail.curvePoints, proj, false);

        // Project daily points (day 0 through +10)
        const projectedDays: {
          dayOffset: number;
          dateLabel: string;
          x: number;
          y: number;
        }[] = [];
        for (const dp of trail.dailyPoints) {
          const pt = projectStereographic(dp.raDeg, dp.decDeg, proj, trailMargin);
          if (!pt) continue;
          projectedDays.push({
            dayOffset: dp.dayOffset,
            dateLabel: dp.dateLabel,
            x: pt.x,
            y: pt.y,
          });
        }

        // Draw directional arrowhead at final curve segment
        if (trail.curvePoints.length >= 2) {
          const pLast = projectStereographic(
            trail.curvePoints[trail.curvePoints.length - 1].raDeg,
            trail.curvePoints[trail.curvePoints.length - 1].decDeg,
            proj,
            trailMargin
          );
          const pPrev = projectStereographic(
            trail.curvePoints[trail.curvePoints.length - 2].raDeg,
            trail.curvePoints[trail.curvePoints.length - 2].decDeg,
            proj,
            trailMargin
          );
          if (pLast && pPrev) {
            const dx = pLast.x - pPrev.x;
            const dy = pLast.y - pPrev.y;
            const segLen = Math.hypot(dx, dy);
            if (segLen > 1.5 && segLen < 250) {
              const ang = Math.atan2(dy, dx);
              const headLen = 8.5;
              const spread = 0.48;
              ctx.globalAlpha = 0.95;
              ctx.fillStyle = trailColor;
              ctx.beginPath();
              ctx.moveTo(pLast.x, pLast.y);
              ctx.lineTo(
                pLast.x - headLen * Math.cos(ang - spread),
                pLast.y - headLen * Math.sin(ang - spread)
              );
              ctx.lineTo(
                pLast.x - headLen * Math.cos(ang + spread),
                pLast.y - headLen * Math.sin(ang + spread)
              );
              ctx.closePath();
              ctx.fill();
            }
          }
        }

        // Draw per-day markers and compute outward normals for crisp date label placement
        const labelPts: {
          dayOffset: number;
          dateLabel: string;
          x: number;
          y: number;
          nx: number;
          ny: number;
        }[] = [];

        for (let i = 0; i < projectedDays.length; i++) {
          const cur = projectedDays[i];
          const prev = projectedDays[Math.max(0, i - 1)];
          const next = projectedDays[Math.min(projectedDays.length - 1, i + 1)];
          let tx = next.x - prev.x;
          let ty = next.y - prev.y;
          const tLen = Math.hypot(tx, ty);
          if (tLen > 0.001) {
            tx /= tLen;
            ty /= tLen;
          } else {
            tx = 1;
            ty = 0;
          }
          // Prefer upper normal (-ty, tx) oriented toward top of screen (ny <= 0)
          let nx = -ty;
          let ny = tx;
          if (ny > 0) {
            nx = -nx;
            ny = -ny;
          }

          const isStart = cur.dayOffset === 0;
          const isEnd = cur.dayOffset === trail.days;
          const dotR = isStart ? 4.0 : isEnd ? 3.4 : 3.0;

          // Contrasting ring halo
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = haloColor;
          ctx.beginPath();
          ctx.arc(cur.x, cur.y, dotR + 1.6, 0, Math.PI * 2);
          ctx.fill();

          // Daily dot marker
          ctx.fillStyle = trailColor;
          ctx.beginPath();
          ctx.arc(cur.x, cur.y, dotR, 0, Math.PI * 2);
          ctx.fill();

          // Start day (today) outer emphasis ring
          if (isStart) {
            ctx.strokeStyle = trailColor;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.arc(cur.x, cur.y, dotR + 3.4, 0, Math.PI * 2);
            ctx.stroke();
          }

          labelPts.push({
            dayOffset: cur.dayOffset,
            dateLabel: cur.dateLabel,
            x: cur.x,
            y: cur.y,
            nx,
            ny,
          });
        }

        if (labelPts.length > 0) {
          trailLabelDraws.push({
            trailColor,
            textColor,
            haloColor,
            bodyKoName: trail.koName,
            pts: labelPts,
          });
        }
      }
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
      if (isMinorBody && !isSelected) {
        const isMpcExtra = body.id.startsWith('MPC_');
        if (isMpcExtra) {
          if (view.fsz > 55 && body.mag > Math.min(magLimit, 9.8)) continue;
          if (view.fsz > 15 && body.mag > magLimit + 0.8) continue;
        } else if (view.fsz > 65 && body.mag > magLimit + 2.0) {
          continue;
        }
      }

      const projMargin = Math.max(80, Math.min(width, height) * 0.52);
      const pt = projectStereographic(body.ra, body.dec, proj, projMargin);
      if (!pt) continue;

      let dimmed = false;
      let bodyExtAlpha = 1.0;
      if (altFilterActive || extActive) {
        const hz = equatorialToHorizontal(body.ra, body.dec, lstDeg, observer.lat);
        if (altFilterActive && hz.altDeg < observer.minAltitudeDeg) {
          if (!observer.highlightAboveMinAlt) continue;
          dimmed = true;
        }
        if (extActive && !isSelected) {
          const bExt = computeAtmosphericExtinctionMag(hz.altDeg, extK);
          if (bExt > 0.15) {
            const minA = body.id === 'Sun' || body.id === 'Moon' ? 0.52 : 0.24;
            bodyExtAlpha = Math.max(minA, Math.pow(10, -0.16 * bExt));
          }
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
        Phobos: 11.27,
        Deimos: 6.2,
        Io: 1821.6,
        Europa: 1560.8,
        Ganymede: 2634.1,
        Callisto: 2410.3,
        Titan: 2574.7,
        Rhea: 763.8,
        Enceladus: 252.1,
        Titania: 788.4,
        Oberon: 761.4,
        Triton: 1353.4,
        Charon: 606.0,
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

      ctx.globalAlpha = (dimmed ? 0.2 : 1.0) * bodyExtAlpha;

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

    // 8b-1. Daily date labels for active 10-day trajectories (rendered cleanly above markers)
    if (trailLabelDraws.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const placedBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];

      const boxesOverlap = (
        a: { x1: number; y1: number; x2: number; y2: number },
        b: { x1: number; y1: number; x2: number; y2: number }
      ) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

      for (const group of trailLabelDraws) {
        // Prioritize start day (0) and end day (last), then intermediate days in chronological order
        const indices: number[] = [];
        if (group.pts.length > 0) indices.push(0);
        if (group.pts.length > 1) indices.push(group.pts.length - 1);
        for (let i = 1; i < group.pts.length - 1; i++) indices.push(i);

        for (const idx of indices) {
          const p = group.pts[idx];
          if (p.x < -30 || p.x > width + 30 || p.y < -20 || p.y > height + 20) continue;

          const isStart = p.dayOffset === 0;
          const labelText = isStart ? `${group.bodyKoName} ${p.dateLabel}` : p.dateLabel;
          ctx.font = isStart
            ? '700 10.5px "IBM Plex Mono", "Pretendard", monospace'
            : '600 10px "IBM Plex Mono", "Pretendard", monospace';
          const textW = ctx.measureText(labelText).width;
          const textH = 12;

          // Candidate offset vectors: alternate preferred normal side by parity to keep dense tracks tidy
          const prefSign = idx % 2 === 0 ? 1 : -1;
          const candidates: [number, number][] = [
            [p.nx * prefSign * 14, p.ny * prefSign * 14],
            [-p.nx * prefSign * 14, -p.ny * prefSign * 14],
            [p.nx * prefSign * 24, p.ny * prefSign * 24],
            [-p.nx * prefSign * 24, -p.ny * prefSign * 24],
            [0, -16],
            [0, 16],
            [18, -14],
            [-18, 14],
          ];

          let chosen: { lx: number; ly: number; box: { x1: number; y1: number; x2: number; y2: number } } | null =
            null;
          for (const [ox, oy] of candidates) {
            const lx = p.x + ox;
            const ly = p.y + oy;
            const box = {
              x1: lx - textW / 2 - 2,
              y1: ly - textH / 2 - 1,
              x2: lx + textW / 2 + 2,
              y2: ly + textH / 2 + 1,
            };
            if (!placedBoxes.some((b) => boxesOverlap(b, box))) {
              chosen = { lx, ly, box };
              break;
            }
          }

          // Always render day 0 even if extremely zoomed out; skip colliding intermediate labels only if no slot fits
          if (!chosen) {
            if (!isStart) continue;
            const lx = p.x + p.nx * 14;
            const ly = p.y + p.ny * 14;
            chosen = {
              lx,
              ly,
              box: {
                x1: lx - textW / 2 - 2,
                y1: ly - textH / 2 - 1,
                x2: lx + textW / 2 + 2,
                y2: ly + textH / 2 + 1,
              },
            };
          }

          placedBoxes.push(chosen.box);

          // Crisp short leader tick from daily dot to label
          const dx = chosen.lx - p.x;
          const dy = chosen.ly - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 6) {
            const ux = dx / dist;
            const uy = dy / dist;
            ctx.strokeStyle = group.trailColor;
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(p.x + ux * 4.5, p.y + uy * 4.5);
            ctx.lineTo(chosen.lx - ux * 6.5, chosen.ly - uy * 6.5);
            ctx.stroke();
          }

          // Halo stroke + crisp foreground text
          ctx.globalAlpha = 0.96;
          ctx.strokeStyle = group.haloColor;
          ctx.lineWidth = 3.2;
          ctx.strokeText(labelText, chosen.lx, chosen.ly);
          ctx.fillStyle = isStart ? group.trailColor : group.textColor;
          ctx.fillText(labelText, chosen.lx, chosen.ly);
        }
      }
      ctx.restore();
    }
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
        : selected.kind === 'double'
        ? selected.data.koName || selected.data.name || selected.data.bayer || selected.data.disc
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
  if (!passOptions?.skipReticles) {
    drawOpticalReticles(
      ctx,
      width,
      height,
      view,
      theme,
      optics,
      proj,
      palette,
      Boolean(passOptions?.eyepieceFlipActive)
    );
  }

  // 11.5. Observing Session Plan Highlight Mode (오늘 밤 관측목록 성도 표시 - 깔끔한 원형 표시)
  if (layers.highlightSessionPlan && sessionPlan && sessionPlan.length > 0) {
    const allDsos: DeepSkyObject[] = [
      ...catalogs.dsosBright,
      ...catalogs.darkNebulae,
      ...catalogs.dsosDeep,
      ...catalogs.caldwell,
    ];
    const allStars: Star[] = [
      ...catalogs.brightStars,
      ...catalogs.deepStars,
      ...catalogs.gaiaStars,
    ];
    for (const tile of catalogs.ultraStarTiles.values()) {
      for (const st of tile) allStars.push(st);
    }
    const sessionSolarBodies = getSolarSystemBodies(obsTimeMs);
    const existingTargetIds = new Set(targets.map((t) => `${t.kind}:${t.id}`));

    const sessionOpacity = Math.max(0.1, Math.min(1.0, layers.sessionPlanOpacity ?? 1.0));
    const customSessionColor =
      layers.sessionPlanColor && /^#[0-9a-fA-F]{6}$/.test(layers.sessionPlanColor)
        ? layers.sessionPlanColor
        : null;
    const pendingColor =
      theme === 'red'
        ? '#FF3B3B'
        : customSessionColor ?? (theme === 'white' ? '#D97706' : '#F59E0B');
    const doneColor =
      theme === 'white' ? '#059669' : theme === 'red' ? '#B91C1C' : '#10B981';

    ctx.save();
    sessionPlan.forEach((entry) => {
      let item: SelectedItem | null = null;
      let ringRadius = 9.5;
      if (entry.kind === 'dso') {
        const found = allDsos.find((d) => d.id === entry.id);
        if (found) {
          item = { kind: 'dso', data: found };
          const symR = Math.max(5.0, Math.min(36, (found.majAx / 60) * pxPerDeg * 0.5));
          ringRadius = symR + 3.5;
        }
      } else if (entry.kind === 'planet') {
        const found = sessionSolarBodies.find((b) => b.id === entry.id);
        if (found) {
          item = { kind: 'planet', data: found };
          ringRadius = 10.5;
        }
      } else if (entry.kind === 'double') {
        const found = catalogs.doubleStars.find((d) => d.id === entry.id);
        if (found) {
          item = { kind: 'double', data: found };
          ringRadius = 9.5;
        }
      } else {
        const found = allStars.find((s) => s.id === entry.id);
        if (found) {
          item = { kind: 'star', data: found };
          ringRadius = 9.0;
        }
      }
      if (!item) return;

      const pt = projectStereographic(item.data.ra, item.data.dec, proj, 36);
      if (!pt) return;

      const key = `${item.kind}:${item.data.id}`;
      if (!existingTargetIds.has(key)) {
        existingTargetIds.add(key);
        targets.push({
          kind: item.kind,
          id: item.data.id,
          x: pt.x,
          y: pt.y,
          radius: Math.max(10, Math.min(28, ringRadius + 2)),
          mag: item.data.mag,
          item,
        });
      }

      const accent = entry.observed ? doneColor : pendingColor;
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = sessionOpacity;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  // 11.6. Challenge Tracks & Seasonal Observing Tours Overlay (Subway-Map Dashed -> Golden Solid)
  const activeChallenges = (challenges ?? []).filter(
    (t) => t.activeOnChart && t.checkpoints.length > 0
  );
  if (activeChallenges.length > 0) {
    const allChallengeDsos = [
      ...catalogs.dsosBright,
      ...catalogs.darkNebulae,
      ...catalogs.dsosDeep,
      ...catalogs.caldwell,
    ];
    const dsoLookup = new Map<string, DeepSkyObject>();
    for (const d of allChallengeDsos) {
      dsoLookup.set(d.id.replace(/\s+/g, '').toUpperCase(), d);
      if (d.altId) dsoLookup.set(d.altId.replace(/\s+/g, '').toUpperCase(), d);
    }
    const starLookup = new Map<string, Star>();
    for (const s of catalogs.brightStars) {
      starLookup.set(s.id.replace(/\s+/g, '').toUpperCase(), s);
      if (s.hip) starLookup.set(`HIP${s.hip}`, s);
      if (s.name) starLookup.set(s.name.replace(/\s+/g, '').toUpperCase(), s);
    }
    const dblLookup = new Map<string, DoubleStarSystem>();
    for (const dbl of catalogs.doubleStars) {
      dblLookup.set(dbl.id.replace(/\s+/g, '').toUpperCase(), dbl);
    }

    const interpolateArc = (
      ra1: number,
      dec1: number,
      ra2: number,
      dec2: number,
      steps = 12
    ): { raDeg: number; decDeg: number }[] => {
      const a1 = ra1 * DEG2RAD;
      const d1 = dec1 * DEG2RAD;
      const a2 = ra2 * DEG2RAD;
      const d2 = dec2 * DEG2RAD;
      const v0x = Math.cos(d1) * Math.cos(a1);
      const v0y = Math.cos(d1) * Math.sin(a1);
      const v0z = Math.sin(d1);
      const v1x = Math.cos(d2) * Math.cos(a2);
      const v1y = Math.cos(d2) * Math.sin(a2);
      const v1z = Math.sin(d2);
      const dot = Math.max(-1, Math.min(1, v0x * v1x + v0y * v1y + v0z * v1z));
      const omega = Math.acos(dot);
      const sinOmega = Math.sin(omega);
      const pts: { raDeg: number; decDeg: number }[] = [];
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        let x: number;
        let y: number;
        let z: number;
        if (sinOmega > 1e-4) {
          const w0 = Math.sin((1 - f) * omega) / sinOmega;
          const w1 = Math.sin(f * omega) / sinOmega;
          x = w0 * v0x + w1 * v1x;
          y = w0 * v0y + w1 * v1y;
          z = w0 * v0z + w1 * v1z;
        } else {
          x = v0x * (1 - f) + v1x * f;
          y = v0y * (1 - f) + v1y * f;
          z = v0z * (1 - f) + v1z * f;
        }
        const len = Math.hypot(x, y, z) || 1;
        pts.push({
          raDeg: ((Math.atan2(y / len, x / len) * RAD2DEG) + 360) % 360,
          decDeg: Math.asin(Math.max(-1, Math.min(1, z / len))) * RAD2DEG,
        });
      }
      return pts;
    };

    const resolveCheckpoint = (
      cp: ChallengeCheckpoint
    ): { ra: number; dec: number; item: SelectedItem } | null => {
      const key = cp.catalogId ? cp.catalogId.replace(/\s+/g, '').toUpperCase() : '';
      if (cp.kind === 'dso' && key && dsoLookup.has(key)) {
        const d = dsoLookup.get(key)!;
        return { ra: d.ra, dec: d.dec, item: { kind: 'dso', data: d } };
      }
      if (cp.kind === 'star' && key && starLookup.has(key)) {
        const s = starLookup.get(key)!;
        return { ra: s.ra, dec: s.dec, item: { kind: 'star', data: s } };
      }
      if (cp.kind === 'double' && key && dblLookup.has(key)) {
        const dbl = dblLookup.get(key)!;
        return { ra: dbl.ra, dec: dbl.dec, item: { kind: 'double', data: dbl } };
      }
      if (cp.ra !== undefined && cp.dec !== undefined) {
        if (cp.kind === 'star') {
          const synthStar: Star = {
            id: cp.catalogId || cp.id,
            ra: cp.ra,
            dec: cp.dec,
            mag: cp.mag ?? 2.0,
            bv: 0.4,
            koName: cp.name,
            name: cp.name,
            con: cp.constellation || '',
          };
          return { ra: cp.ra, dec: cp.dec, item: { kind: 'star', data: synthStar } };
        }
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
        return { ra: cp.ra, dec: cp.dec, item: { kind: 'dso', data: synthDso } };
      }
      return null;
    };

    const goldSolid =
      theme === 'white' ? '#D97706' : theme === 'red' ? '#FF4D4D' : '#FBBF24';
    const goldGlow =
      theme === 'white'
        ? 'rgba(217, 119, 6, 0.25)'
        : theme === 'red'
        ? 'rgba(255, 77, 77, 0.30)'
        : 'rgba(251, 191, 36, 0.32)';
    const pillBg =
      theme === 'white'
        ? 'rgba(255, 255, 255, 0.92)'
        : theme === 'red'
        ? 'rgba(18, 2, 2, 0.88)'
        : 'rgba(7, 12, 22, 0.88)';
    const jumpThreshold = Math.max(width, height) * 0.45;
    const challengeAlpha = Math.max(0.05, Math.min(1.0, layers.challengeOpacity ?? 1.0));
    const challengeLineW = Math.max(0.3, Math.min(3.0, layers.challengeLineWidth ?? 0.8));
    const customChallengeColor =
      layers.challengeColor && /^#[0-9a-fA-F]{6}$/.test(layers.challengeColor)
        ? layers.challengeColor
        : null;

    ctx.save();
    for (const track of activeChallenges) {
      const baseLineColor =
        theme === 'red'
          ? '#DC2626'
          : customChallengeColor ?? (theme === 'white' ? '#2563EB' : track.lineColor || '#38BDF8');

      // A. Dual-Layer Background Geometry (e.g., Winter Hexagon & Winter Triangle)
      if (track.guidePolygons && track.guidePolygons.length > 0) {
        ctx.save();
        for (const poly of track.guidePolygons) {
          if (poly.points.length < 2) continue;
          const polyStroke =
            theme === 'red'
              ? 'rgba(248, 113, 113, 0.35)'
              : customChallengeColor
              ? customChallengeColor
              : theme === 'white'
              ? 'rgba(37, 99, 235, 0.38)'
              : poly.color || 'rgba(147, 197, 253, 0.45)';
          ctx.strokeStyle = polyStroke;
          ctx.lineWidth = Math.max(0.35, challengeLineW * 0.85);
          ctx.globalAlpha = (theme === 'white' ? 0.85 : 0.48) * challengeAlpha;
          ctx.setLineDash([7, 5]);

          const segCount = poly.closed ? poly.points.length : poly.points.length - 1;
          for (let s = 0; s < segCount; s++) {
            const pA = poly.points[s];
            const pB = poly.points[(s + 1) % poly.points.length];
            const arcPts = interpolateArc(pA.ra, pA.dec, pB.ra, pB.dec, 14);
            drawProjectedCurve(ctx, arcPts, proj, false);
          }

          if (poly.label) {
            let sumX = 0;
            let sumY = 0;
            let visCount = 0;
            for (const p of poly.points) {
              const sp = projectStereographic(p.ra, p.dec, proj, 40);
              if (sp) {
                sumX += sp.x;
                sumY += sp.y;
                visCount++;
              }
            }
            if (visCount >= 2) {
              ctx.setLineDash([]);
              ctx.globalAlpha = 0.7 * challengeAlpha;
              ctx.fillStyle = polyStroke;
              ctx.font = '600 10.5px "IBM Plex Sans", "Noto Sans KR", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(poly.label, sumX / visCount, sumY / visCount);
            }
          }
        }
        ctx.restore();
      }

      // Resolve all checkpoints in sequence
      const resolvedCps = track.checkpoints.map((cp) => ({
        cp,
        res: resolveCheckpoint(cp),
      }));

      const totalCount = track.checkpoints.length;
      const doneCount = track.checkpoints.filter((c) => c.observed).length;
      const isMasterCompleted = totalCount > 0 && doneCount === totalCount;
      const nextTodoIdx = track.checkpoints.findIndex((c) => !c.observed);

      // B. Sequential Hopping Route Segments (Dashed Base -> Glowing Golden Solid when Observed)
      const drawLeg = (
        a: { ra: number; dec: number },
        b: { ra: number; dec: number },
        completed: boolean
      ) => {
        const dist = angularDistanceDeg(a.ra, a.dec, b.ra, b.dec);
        const steps = Math.max(4, Math.min(18, Math.ceil(dist / 3)));
        const arcPts = interpolateArc(a.ra, a.dec, b.ra, b.dec, steps);

        if (completed) {
          ctx.save();
          ctx.setLineDash([]);
          ctx.lineCap = 'round';
          ctx.globalAlpha = challengeAlpha;
          ctx.strokeStyle = goldGlow;
          ctx.lineWidth = Math.max(1.2, challengeLineW * 2.5);
          drawProjectedCurve(ctx, arcPts, proj, false);
          ctx.strokeStyle = goldSolid;
          ctx.lineWidth = Math.max(0.45, challengeLineW * 1.25);
          ctx.globalAlpha = 0.96 * challengeAlpha;
          drawProjectedCurve(ctx, arcPts, proj, false);
          ctx.restore();
        } else {
          ctx.save();
          ctx.strokeStyle = baseLineColor;
          ctx.lineWidth = challengeLineW;
          ctx.globalAlpha = 0.78 * challengeAlpha;
          ctx.setLineDash([6, 4]);
          drawProjectedCurve(ctx, arcPts, proj, false);
          ctx.restore();
        }

        // Midpoint directional arrow chevron when segment is long enough on screen
        const midIdx = Math.floor(arcPts.length / 2);
        const pMid = projectStereographicRaw(arcPts[midIdx].raDeg, arcPts[midIdx].decDeg, proj);
        const pPrev = projectStereographicRaw(
          arcPts[Math.max(0, midIdx - 1)].raDeg,
          arcPts[Math.max(0, midIdx - 1)].decDeg,
          proj
        );
        if (
          pMid &&
          pPrev &&
          pMid.x >= 10 &&
          pMid.x <= width - 10 &&
          pMid.y >= 10 &&
          pMid.y <= height - 10
        ) {
          const dx = pMid.x - pPrev.x;
          const dy = pMid.y - pPrev.y;
          const segLen = Math.hypot(dx, dy);
          if (segLen > 4 && segLen < jumpThreshold) {
            const ang = Math.atan2(dy, dx);
            const sz = Math.max(3.0, challengeLineW * (completed ? 3.8 : 3.2));
            ctx.save();
            ctx.translate(pMid.x, pMid.y);
            ctx.rotate(ang);
            ctx.strokeStyle = completed ? goldSolid : baseLineColor;
            ctx.globalAlpha = (completed ? 0.95 : 0.72) * challengeAlpha;
            ctx.lineWidth = Math.max(0.5, challengeLineW * (completed ? 1.15 : 0.9));
            ctx.beginPath();
            ctx.moveTo(-sz, -sz * 0.65);
            ctx.lineTo(0, 0);
            ctx.lineTo(-sz, sz * 0.65);
            ctx.stroke();
            ctx.restore();
          }
        }
      };

      for (let i = 0; i < resolvedCps.length - 1; i++) {
        const a = resolvedCps[i];
        const b = resolvedCps[i + 1];
        if (!a.res || !b.res) continue;
        drawLeg(a.res, b.res, a.cp.observed && b.cp.observed);
      }

      // Close Winter Hexagon loop in gold upon full completion
      if (
        track.id === 'winter-hexagon-orion-spur' &&
        isMasterCompleted &&
        resolvedCps.length >= 2 &&
        resolvedCps[0].res &&
        resolvedCps[resolvedCps.length - 1].res
      ) {
        drawLeg(
          resolvedCps[resolvedCps.length - 1].res!,
          resolvedCps[0].res!,
          true
        );
      }

      // C. Station Nodes, Clickable Hit Targets & Compact Labels
      const isCompactTrack = resolvedCps.length <= 24;
      const showAllLabels = isCompactTrack || view.fsz <= 55;

      for (let i = 0; i < resolvedCps.length; i++) {
        const { cp, res } = resolvedCps[i];
        if (!res) continue;
        const pt = projectStereographic(res.ra, res.dec, proj, 30);
        if (!pt) continue;

        const isNext = i === nextTodoIdx;
        const isSelectedCp =
          selected !== null &&
          ((cp.catalogId &&
            selected.data.id.replace(/\s+/g, '').toUpperCase() ===
              cp.catalogId.replace(/\s+/g, '').toUpperCase()) ||
            angularDistanceDeg(res.ra, res.dec, selected.data.ra, selected.data.dec) < 0.04);

        ctx.save();
        if (cp.observed) {
          ctx.globalAlpha = challengeAlpha;
          ctx.fillStyle = goldGlow;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 9.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = goldSolid;
          ctx.strokeStyle = theme === 'white' ? '#FFFFFF' : '#05070C';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (isNext) {
          ctx.strokeStyle = baseLineColor;
          ctx.lineWidth = 1.6;
          ctx.globalAlpha = 0.9 * challengeAlpha;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8.2, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = palette.skyCircleBg;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = palette.skyCircleBg;
          ctx.strokeStyle = baseLineColor;
          ctx.lineWidth = 1.6;
          ctx.globalAlpha = 0.92 * challengeAlpha;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();

        // Register clickable station target
        targets.push({
          kind: res.item.kind,
          id: res.item.data.id,
          x: pt.x,
          y: pt.y,
          radius: 11,
          mag: cp.mag ?? res.item.data.mag,
          item: res.item,
        });

        // Station label pill (clutter-controlled for 110-object marathons)
        const shouldLabel = showAllLabels || cp.observed || isNext || isSelectedCp;
        if (
          shouldLabel &&
          pt.x >= 10 &&
          pt.x <= width - 10 &&
          pt.y >= 10 &&
          pt.y <= height - 10
        ) {
          const shortTag = cp.catalogId
            ? `${cp.code} ${cp.catalogId}`
            : `${cp.code} ${cp.name.slice(0, 10)}`;
          const badgeText = cp.observed ? `✓ ${shortTag}` : shortTag;
          ctx.save();
          ctx.globalAlpha = challengeAlpha;
          ctx.font = '600 9.5px "IBM Plex Mono", "Pretendard", sans-serif';
          const tw = ctx.measureText(badgeText).width;
          const padX = 4.5;
          const pillH = 14.5;
          const pillW = tw + padX * 2;
          let bx = pt.x + 9;
          let by = pt.y - pillH / 2 - 7;
          if (bx + pillW > width - 6) bx = pt.x - 9 - pillW;
          if (by < 6) by = pt.y + 8;

          const accent = cp.observed ? goldSolid : baseLineColor;
          ctx.fillStyle = pillBg;
          ctx.strokeStyle = accent;
          ctx.lineWidth = cp.observed || isNext ? 1.2 : 0.9;
          ctx.beginPath();
          ctx.roundRect(bx, by, pillW, pillH, 3.5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = accent;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx + padX, by + pillH / 2 + 0.5);
          ctx.restore();
        }
      }

      // D. Print Mode Master Completion Certificate Ribbon (when 100% completed in White mode)
      if (isMasterCompleted && theme === 'white' && !isInnerClip) {
        const certText = `★ ${track.title} · 완주 인증 (${doneCount}/${totalCount}) ★`;
        ctx.save();
        ctx.globalAlpha = challengeAlpha;
        ctx.font = '700 12px "IBM Plex Sans", "Noto Sans KR", sans-serif';
        const cw = ctx.measureText(certText).width + 28;
        const ch = 26;
        const cxBox = width / 2 - cw / 2;
        const cyBox = 14;
        ctx.fillStyle = 'rgba(255, 251, 235, 0.96)';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(cxBox, cyBox, cw, ch, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#92400E';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(certText, width / 2, cyBox + ch / 2 + 0.5);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // 10.9. Custom Asterisms, Star Chains, Hopping Vectors & Scale-Dependent Labels
  if (asterismCtx) {
    renderAsterismsPass({
      ctx,
      width,
      height,
      currentFovDeg: view.fsz,
      theme,
      projector: {
        project: (raDeg: number, decDeg: number, margin = 220) =>
          projectStereographic(raDeg, decDeg, proj, margin),
      },
      store: asterismCtx.store,
      drawingActive: asterismCtx.drawingActive,
      activeTool: asterismCtx.activeTool,
      eyepieceFovDeg: optics.eyepieceFovDeg,
      finderFovDeg: optics.finderFovDeg ?? 7.0,
      reticleLineWidth: optics.reticleLineWidth ?? 1.4,
      reticleOpacity: optics.reticleOpacity ?? 0.85,
      showReticleLabel: optics.showReticleLabel !== false,
      reticleLabelDirection: optics.reticleLabelDirection ?? 'ne',
      selectedObjectId: asterismCtx.selectedObjectId,
      draft: asterismCtx.draft,
      hoverSnap: asterismCtx.hoverSnap,
      isInnerClip,
      isSensorPhoto,
    });
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

  if (hoveredId) {
    const hTarget = targets.find((t) => t.id === hoveredId);
    const isHoveredSelected =
      selected &&
      (hoveredId === selected.data.id ||
        (selected.kind === 'dso' &&
          hTarget?.kind === 'dso' &&
          hoveredId.replace(/\s+/g, '').toUpperCase() ===
            selected.data.id.replace(/\s+/g, '').toUpperCase()));
    if (hTarget && !isHoveredSelected) {
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

  // 11.8. Subtle Horizon Atmospheric Extinction Band (drawn BEFORE labels so horizon haze does not blur/dim text)
  if (extActive && !isSensorPhoto) {
    drawAtmosphericExtinctionBand(
      ctx,
      width,
      height,
      view,
      theme,
      proj,
      lstDeg,
      observer.lat,
      extK
    );
  }

  // 12. Collision-Free Label Pass (integer-snapped coordinates + crisp halo for high legibility)
  labelCandidates.sort((a, b) => a.priority - b.priority);
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const labelHaloWidth = hipsVisible ? 2.6 : 1.8;
  const labelHaloStroke =
    theme === 'white'
      ? 'rgba(255,255,255,0.88)'
      : theme === 'red'
      ? hipsVisible
        ? 'rgba(6,0,0,0.88)'
        : 'rgba(6,0,0,0.68)'
      : hipsVisible
      ? 'rgba(5,7,12,0.88)'
      : 'rgba(5,7,12,0.68)';
  ctx.lineWidth = labelHaloWidth;
  ctx.strokeStyle = labelHaloStroke;

  for (const cand of labelCandidates) {
    ctx.font = cand.font;
    const textW = ctx.measureText(cand.text).width;
    const textH = 13;
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
      const drawX = Math.round(pos.x);
      const drawY = Math.round(pos.y);
      ctx.globalAlpha = cand.alpha ?? 1;
      ctx.strokeText(cand.text, drawX, drawY);
      ctx.fillStyle = cand.color;
      ctx.fillText(cand.text, drawX, drawY);
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
      observer.lat
    );
  }

  // 12.6. Horizon Cardinal Direction Labels (rendered strictly once above terrain & sky labels)
  if (layers.showHorizon) {
    ctx.save();
    ctx.fillStyle = palette.horizonText;
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
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
    const labelAltDeg = Math.min(1.4, Math.max(0.15, view.fsz * 0.015));
    for (const c of cardinals) {
      const eq = horizontalToEquatorial(labelAltDeg, c.az, lstDeg, observer.lat);
      const pt = projectStereographic(eq.raDeg, eq.decDeg, proj, 10);
      if (pt) {
        ctx.fillText(c.label, pt.x, pt.y);
      }
    }
    ctx.restore();
  }

  if (applySkyCircleClip) {
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

function clipSegmentToRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (
    clip(-dx, x1 - minX) &&
    clip(dx, maxX - x1) &&
    clip(-dy, y1 - minY) &&
    clip(dy, maxY - y1)
  ) {
    return {
      x1: x1 + t0 * dx,
      y1: y1 + t0 * dy,
      x2: x1 + t1 * dx,
      y2: y1 + t1 * dy,
    };
  }
  return null;
}

function drawRulerOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: ThemeMode,
  proj: ProjectionParams,
  rulerCtx: RulerRenderContext,
  innerProj?: ProjectionParams,
  clipR?: number
): void {
  const { active, measurement, hoverPoint } = rulerCtx;
  if (!active && !measurement) return;

  const cx = width / 2;
  const cy = height / 2;
  const projectPoint = (pt: RulerPoint): { x: number; y: number } | null => {
    if (innerProj && clipR !== undefined) {
      const innerP = projectStereographic(pt.raDeg, pt.decDeg, innerProj, 4000);
      if (innerP && Math.hypot(innerP.x - cx, innerP.y - cy) <= clipR) {
        return innerP;
      }
    }
    return projectStereographic(pt.raDeg, pt.decDeg, proj, 4000);
  };

  const strokeColor =
    theme === 'white' ? '#D97706' : theme === 'red' ? '#FF5252' : '#FBBF24';
  const strokePreviewColor =
    theme === 'white'
      ? 'rgba(217, 119, 6, 0.85)'
      : theme === 'red'
      ? 'rgba(255, 82, 82, 0.85)'
      : 'rgba(251, 191, 36, 0.88)';
  const haloColor =
    theme === 'white'
      ? 'rgba(255, 255, 255, 0.82)'
      : theme === 'red'
      ? 'rgba(10, 0, 0, 0.85)'
      : 'rgba(6, 10, 18, 0.82)';
  const badgeBg =
    theme === 'white'
      ? 'rgba(255, 255, 255, 0.94)'
      : theme === 'red'
      ? 'rgba(20, 2, 2, 0.92)'
      : 'rgba(8, 13, 24, 0.92)';
  const badgeBorder =
    theme === 'white'
      ? 'rgba(217, 119, 6, 0.85)'
      : theme === 'red'
      ? 'rgba(255, 82, 82, 0.85)'
      : 'rgba(251, 191, 36, 0.85)';
  const badgeText =
    theme === 'white' ? '#92400E' : theme === 'red' ? '#FF8080' : '#FDE68A';

  const drawEndpoint = (
    x: number,
    y: number,
    snapped: boolean,
    isPreview: boolean
  ) => {
    ctx.save();
    ctx.globalAlpha = isPreview ? 0.82 : 1;
    // Outer snap ring when anchored to a celestial object
    if (snapped) {
      ctx.beginPath();
      ctx.arc(x, y, 8.5, 0, Math.PI * 2);
      ctx.strokeStyle = haloColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    // Crisp target marker circle
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.strokeStyle = haloColor;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Inner precision center dot
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();
    ctx.restore();
  };

  ctx.save();

  // Before the first click: show subtle snap indicator when hovering a celestial target
  if (!measurement) {
    if (active && hoverPoint?.snapped) {
      const hp = projectPoint(hoverPoint);
      if (hp) {
        drawEndpoint(hp.x, hp.y, true, true);
      }
    }
    ctx.restore();
    return;
  }

  const startScreen = projectPoint(measurement.start);
  const endPoint = measurement.end ?? (active ? hoverPoint : null);
  const isPreview = measurement.end === null;
  const endScreen = endPoint ? projectPoint(endPoint) : null;

  if (startScreen && endScreen && endPoint) {
    // 1. Straight connecting line (halo + crisp foreground stroke)
    ctx.save();
    ctx.lineCap = 'round';
    if (isPreview) {
      ctx.setLineDash([6, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.strokeStyle = haloColor;
    ctx.lineWidth = 3.8;
    ctx.stroke();

    ctx.strokeStyle = isPreview ? strokePreviewColor : strokeColor;
    ctx.lineWidth = 1.75;
    ctx.stroke();
    ctx.restore();

    // 2. Endpoint markers
    drawEndpoint(startScreen.x, startScreen.y, Boolean(measurement.start.snapped), false);
    drawEndpoint(endScreen.x, endScreen.y, Boolean(endPoint.snapped), isPreview);

    // 3. Midpoint angular distance label (0°0'0")
    const sepDeg = angularDistanceDeg(
      measurement.start.raDeg,
      measurement.start.decDeg,
      endPoint.raDeg,
      endPoint.decDeg
    );
    const labelStr = formatAngularDistanceDMS(sepDeg);

    const visibleSeg = clipSegmentToRect(
      startScreen.x,
      startScreen.y,
      endScreen.x,
      endScreen.y,
      28,
      28,
      Math.max(30, width - 28),
      Math.max(30, height - 28)
    );

    if (visibleSeg) {
      const segLenPx = Math.hypot(
        endScreen.x - startScreen.x,
        endScreen.y - startScreen.y
      );
      const midX = (visibleSeg.x1 + visibleSeg.x2) / 2;
      let midY = (visibleSeg.y1 + visibleSeg.y2) / 2;
      if (segLenPx < 34) {
        midY = Math.max(22, midY - 19);
      }

      ctx.save();
      ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textW = ctx.measureText(labelStr).width;
      const padX = 7;
      const boxW = textW + padX * 2;
      const boxH = 22;
      const bx = Math.max(8, Math.min(width - boxW - 8, midX - boxW / 2));
      const by = Math.max(8, Math.min(height - boxH - 8, midY - boxH / 2));
      const r = 4;

      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + boxW - r, by);
      ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
      ctx.lineTo(bx + boxW, by + boxH - r);
      ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
      ctx.lineTo(bx + r, by + boxH);
      ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();

      ctx.fillStyle = badgeBg;
      ctx.fill();
      ctx.strokeStyle = badgeBorder;
      ctx.lineWidth = isPreview ? 1.1 : 1.35;
      if (isPreview) ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = badgeText;
      ctx.fillText(labelStr, bx + boxW / 2, by + boxH / 2 + 0.5);
      ctx.restore();
    }
  } else if (startScreen) {
    drawEndpoint(startScreen.x, startScreen.y, Boolean(measurement.start.snapped), false);
  }

  ctx.restore();
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
  sessionIds: Set<string>,
  solarTrails?: Record<string, number>,
  sessionPlan?: ObservingSessionEntry[],
  challenges?: ChallengeTrack[],
  overrideRotationDeg?: number,
  sensorPhotoMode?: boolean,
  asterismCtx?: AsterismRenderContext,
  rulerCtx?: RulerRenderContext
): RenderResult {
  const rawFlipActive = view.flipH || view.flipV;
  const normEpRot = optics.showEyepiece
    ? ((optics.eyepieceRotationDeg % 360) + 360) % 360
    : 0;
  const epRotActive = normEpRot > 0.05 && normEpRot < 359.95;
  const epTransformActive = rawFlipActive || epRotActive;
  const epRadiusPx = optics.showEyepiece
    ? getStereographicRadiusPx(optics.eyepieceFovDeg, view.fsz, width, height)
    : 0;
  const diagHalf = Math.hypot(width / 2, height / 2);
  const eyepieceSplitActive =
    overrideRotationDeg === undefined &&
    !sensorPhotoMode &&
    optics.showEyepiece &&
    epTransformActive &&
    epRadiusPx >= 3 &&
    epRadiusPx < diagHalf + 2;
  const fullFlipActive = rawFlipActive && (!optics.showEyepiece || epRadiusPx >= diagHalf + 2);
  const fullRotDeg =
    overrideRotationDeg !== undefined
      ? ((overrideRotationDeg % 360) + 360) % 360
      : optics.showEyepiece && epRotActive && epRadiusPx >= diagHalf + 2
      ? normEpRot
      : 0;

  if (!eyepieceSplitActive) {
    const effectiveView = fullFlipActive ? view : { ...view, flipH: false, flipV: false };
    const passRes = renderStarChartPass(
      ctx,
      width,
      height,
      effectiveView,
      theme,
      layers,
      optics,
      observer,
      hips,
      catalogs,
      selected,
      hoveredId,
      sessionIds,
      solarTrails,
      {
        skipReticles: Boolean(sensorPhotoMode),
        isInnerClip: false,
        eyepieceFlipActive: optics.showEyepiece && (fullFlipActive || fullRotDeg > 0),
        rotationDeg: fullRotDeg,
        sensorPhotoMode: Boolean(sensorPhotoMode),
      },
      sessionPlan,
      challenges,
      asterismCtx
    );
    if (rulerCtx && !sensorPhotoMode) {
      const lstDeg = getLSTDeg(observer.timestampMs, observer.lon);
      const rulerProj = createProjectionParams(
        effectiveView,
        width,
        height,
        lstDeg,
        observer.lat,
        fullRotDeg
      );
      drawRulerOverlay(ctx, width, height, theme, rulerProj, rulerCtx);
    }
    return passRes;
  }

  // Dual-pass Eyepiece-Only Optical Flip & Rotation:
  // Pass 1 renders unflipped/unrotated full sky outside eyepiece;
  // Pass 2 clips to eyepiece circle and renders flipped+rotated sky with upright labels.
  const outerView: ChartViewState = { ...view, flipH: false, flipV: false };
  const outerRes = renderStarChartPass(
    ctx,
    width,
    height,
    outerView,
    theme,
    layers,
    optics,
    observer,
    hips,
    catalogs,
    selected,
    hoveredId,
    sessionIds,
    solarTrails,
    { skipReticles: true, isInnerClip: false, rotationDeg: 0 },
    sessionPlan,
    challenges,
    asterismCtx
  );

  const cx = width / 2;
  const cy = height / 2;
  const halfSkyRadius = (Math.min(width, height) / 2) / Math.tan((view.fsz / 4) * DEG2RAD);
  const clipR = view.fsz >= 145 ? Math.min(epRadiusPx, halfSkyRadius) : epRadiusPx;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, clipR, 0, Math.PI * 2);
  ctx.clip();
  const innerRes = renderStarChartPass(
    ctx,
    width,
    height,
    view,
    theme,
    layers,
    optics,
    observer,
    hips,
    catalogs,
    selected,
    hoveredId,
    sessionIds,
    solarTrails,
    { skipReticles: true, isInnerClip: true, rotationDeg: normEpRot },
    sessionPlan,
    challenges,
    asterismCtx
  );
  ctx.restore();

  // Draw optical reticles (Crosshair, Telrad, Finder, Eyepiece rim + flip/rotation badge, Sensor Box) cleanly on top
  const lstDeg = getLSTDeg(observer.timestampMs, observer.lon);
  const proj = createProjectionParams(outerView, width, height, lstDeg, observer.lat, 0);
  const palette = getThemePalette(theme);
  drawOpticalReticles(ctx, width, height, view, theme, optics, proj, palette, true);

  if (rulerCtx) {
    const innerProj = createProjectionParams(view, width, height, lstDeg, observer.lat, normEpRot);
    drawRulerOverlay(ctx, width, height, theme, proj, rulerCtx, innerProj, clipR);
  }

  const outerTargets = outerRes.targets.filter((t) => Math.hypot(t.x - cx, t.y - cy) > clipR);
  const innerTargets = innerRes.targets.filter((t) => Math.hypot(t.x - cx, t.y - cy) <= clipR);

  return {
    ...outerRes,
    targets: [...outerTargets, ...innerTargets],
  };
}

