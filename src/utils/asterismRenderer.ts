import {
  AsterismDraftState,
  AsterismGroup,
  AsterismLineStyle,
  AsterismObject,
  AsterismSnapPreview,
  AsterismStoreState,
  AsterismTool,
  AsterismVertex,
  ThemeMode,
} from '../types/astronomy';
import { angularDistanceDeg, DEG2RAD, positionAngleDeg, RAD2DEG } from './astronomy';

export interface AsterismProjector {
  project: (raDeg: number, decDeg: number, margin?: number) => { x: number; y: number } | null;
}

export interface AsterismHitResult {
  objectId: string;
  kind: 'vertex' | 'midpoint' | 'body';
  vertexIndex?: number;
  segmentIndex?: number;
  x: number;
  y: number;
  distPx: number;
}

/**
 * Format angular separation cleanly into degrees, arcminutes, or arcseconds.
 */
export function formatAngularSeparation(deg: number): string {
  if (!Number.isFinite(deg) || deg < 0) return '0″';
  if (deg >= 1.0) return `${deg.toFixed(2)}°`;
  const arcmin = deg * 60;
  if (arcmin >= 1.0) return `${arcmin.toFixed(1)}′`;
  return `${(arcmin * 60).toFixed(0)}″`;
}

/**
 * Compute great-circle destination coordinate starting at (ra1, dec1) heading along initial
 * bearing PA (degrees East of North) for angular distance distDeg.
 */
export function destinationPointSpherical(
  ra1Deg: number,
  dec1Deg: number,
  paDeg: number,
  distDeg: number
): { raDeg: number; decDeg: number } {
  const d1 = dec1Deg * DEG2RAD;
  const a1 = ra1Deg * DEG2RAD;
  const th = paDeg * DEG2RAD;
  const delta = distDeg * DEG2RAD;

  const sinD2 = Math.sin(d1) * Math.cos(delta) + Math.cos(d1) * Math.sin(delta) * Math.cos(th);
  const d2 = Math.asin(Math.max(-1, Math.min(1, sinD2)));
  const y = Math.sin(th) * Math.sin(delta) * Math.cos(d1);
  const x = Math.cos(delta) - Math.sin(d1) * Math.sin(d2);
  const a2 = a1 + Math.atan2(y, x);
  return {
    raDeg: ((a2 * RAD2DEG) % 360 + 360) % 360,
    decDeg: Math.max(-90, Math.min(90, d2 * RAD2DEG)),
  };
}

/**
 * Spherical midpoint between two J2000 equatorial coordinates.
 */
export function sphericalMidpoint(
  ra1Deg: number,
  dec1Deg: number,
  ra2Deg: number,
  dec2Deg: number
): { raDeg: number; decDeg: number } {
  const a1 = ra1Deg * DEG2RAD;
  const d1 = dec1Deg * DEG2RAD;
  const a2 = ra2Deg * DEG2RAD;
  const d2 = dec2Deg * DEG2RAD;
  const x = Math.cos(d1) * Math.cos(a1) + Math.cos(d2) * Math.cos(a2);
  const y = Math.cos(d1) * Math.sin(a1) + Math.cos(d2) * Math.sin(a2);
  const z = Math.sin(d1) + Math.sin(d2);
  const len = Math.hypot(x, y, z) || 1;
  return {
    raDeg: (((Math.atan2(y / len, x / len) * RAD2DEG) % 360) + 360) % 360,
    decDeg: Math.asin(Math.max(-1, Math.min(1, z / len))) * RAD2DEG,
  };
}

/**
 * Sample projected screen points around a spherical circle centered at (raDeg, decDeg)
 * with angular radiusDeg.
 */
function projectSphericalCircle(
  centerRaDeg: number,
  centerDecDeg: number,
  radiusDeg: number,
  projector: AsterismProjector,
  segments = 64
): { x: number; y: number }[] {
  const clampedR = Math.max(0.005, Math.min(89, radiusDeg));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const pa = (i / segments) * 360;
    const pCel = destinationPointSpherical(centerRaDeg, centerDecDeg, pa, clampedR);
    const pScr = projector.project(pCel.raDeg, pCel.decDeg, 360);
    if (!pScr) return [];
    pts.push(pScr);
  }
  return pts;
}

/**
 * Compute effective circle radius in degrees from an AsterismObject of type 'circle'.
 */
export function getCircleRadiusDeg(obj: AsterismObject): number {
  if (typeof obj.radiusDeg === 'number' && Number.isFinite(obj.radiusDeg) && obj.radiusDeg > 0) {
    return obj.radiusDeg;
  }
  if (obj.vertices.length >= 2) {
    return Math.max(
      0.01,
      angularDistanceDeg(
        obj.vertices[0].raDeg,
        obj.vertices[0].decDeg,
        obj.vertices[1].raDeg,
        obj.vertices[1].decDeg
      )
    );
  }
  return 0.5;
}

/**
 * Compute smooth FOV-based LOD visibility factor (0..1) with gentle boundary fade-in/out.
 */
export function computeLodFadeAlpha(
  currentFovDeg: number,
  range: [number, number]
): number {
  const minF = Math.max(0.01, Math.min(range[0], range[1]));
  const maxF = Math.max(minF, range[1]);

  if (currentFovDeg < minF * 0.78 || currentFovDeg > maxF * 1.25) {
    return 0;
  }
  if (currentFovDeg < minF) {
    return Math.max(0, Math.min(1, (currentFovDeg - minF * 0.78) / (minF * 0.22)));
  }
  if (currentFovDeg > maxF) {
    return Math.max(0, Math.min(1, (maxF * 1.25 - currentFovDeg) / (maxF * 0.25)));
  }
  return 1;
}

/**
 * Adapt custom user color automatically to night-vision red tones in Red theme,
 * or darken ultra-bright tints slightly on pure white charts for crisp contrast.
 */
export function resolveAsterismColor(hex: string, theme: ThemeMode): string {
  if (theme === 'red') {
    return '#EF4444';
  }
  if (theme === 'white') {
    const map: Record<string, string> = {
      '#FFFFFF': '#0F172A',
      '#EF4444': '#DC2626',
      '#F97316': '#EA580C',
      '#22C55E': '#15803D',
      '#3B82F6': '#2563EB',
      '#A855F7': '#7C3AED',
      '#38BDF8': '#0284C7',
      '#FBBF24': '#B45309',
      '#34D399': '#047857',
      '#F472B6': '#BE185D',
      '#A78BFA': '#6D28D9',
      '#FB923C': '#C2410C',
    };
    return map[hex.toUpperCase()] ?? hex;
  }
  return hex;
}

function applyLineDash(ctx: CanvasRenderingContext2D, style: AsterismLineStyle, width: number): void {
  const s = Math.max(0.8, Math.min(4.0, width));
  if (style === 'dashed') {
    ctx.setLineDash([5.5 * s, 3.8 * s]);
  } else if (style === 'dashdot') {
    ctx.setLineDash([7 * s, 3 * s, 1.8 * s, 3 * s]);
  } else {
    ctx.setLineDash([]);
  }
}

/**
 * Draw a smooth Catmull-Rom spline through projected 2D screen points.
 */
function strokeCatmullRom(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    return;
  }
  const tension = 0.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 900) {
      ctx.moveTo(p2.x, p2.y);
      continue;
    }

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.stroke();
}

/**
 * Sample great-circle interpolated screen path between sequential celestial vertices.
 */
function projectGreatCircleSegment(
  v1: AsterismVertex,
  v2: AsterismVertex,
  projector: AsterismProjector
): { x: number; y: number }[] {
  const dist = angularDistanceDeg(v1.raDeg, v1.decDeg, v2.raDeg, v2.decDeg);
  const steps = Math.max(2, Math.min(24, Math.ceil(dist / 2.5)));
  const a1 = v1.raDeg * DEG2RAD;
  const d1 = v1.decDeg * DEG2RAD;
  const a2 = v2.raDeg * DEG2RAD;
  const d2 = v2.decDeg * DEG2RAD;
  const x1 = Math.cos(d1) * Math.cos(a1);
  const y1 = Math.cos(d1) * Math.sin(a1);
  const z1 = Math.sin(d1);
  const x2 = Math.cos(d2) * Math.cos(a2);
  const y2 = Math.cos(d2) * Math.sin(a2);
  const z2 = Math.sin(d2);

  const pts: { x: number; y: number }[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x1 * (1 - t) + x2 * t;
    const y = y1 * (1 - t) + y2 * t;
    const z = z1 * (1 - t) + z2 * t;
    const len = Math.hypot(x, y, z) || 1;
    const ra = (((Math.atan2(y / len, x / len) * RAD2DEG) % 360) + 360) % 360;
    const dec = Math.asin(Math.max(-1, Math.min(1, z / len))) * RAD2DEG;
    const p = projector.project(ra, dec, 220);
    if (p) pts.push(p);
  }
  return pts;
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
  color: string
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 6.5),
    to.y - size * Math.sin(angle - Math.PI / 6.5)
  );
  ctx.lineTo(
    to.x - size * 0.72 * Math.cos(angle),
    to.y - size * 0.72 * Math.sin(angle)
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 6.5),
    to.y - size * Math.sin(angle + Math.PI / 6.5)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Render upright multiline text ONLY for explicit 'label' (텍스트) elements,
 * respecting dedicated textOpacity. Property names of shapes/asterisms are NOT drawn on canvas.
 */
function drawStandaloneTextElement(
  ctx: CanvasRenderingContext2D,
  anchorPt: { x: number; y: number },
  obj: AsterismObject,
  color: string,
  theme: ThemeMode,
  lodAlpha: number,
  width: number,
  height: number
): void {
  const rawText = (obj.memo ?? '').trim();
  if (!rawText) return;
  const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return;

  if (
    anchorPt.x < -120 ||
    anchorPt.x > width + 120 ||
    anchorPt.y < -80 ||
    anchorPt.y > height + 80
  ) {
    return;
  }

  const textAlpha = Math.max(
    0.05,
    Math.min(1, (obj.textOpacity ?? obj.opacity ?? 0.95) * lodAlpha)
  );

  ctx.save();
  ctx.globalAlpha = textAlpha;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const fontSize = Math.max(8, Math.min(32, Math.round(obj.textSize ?? 11)));
  const lineHeight = Math.round(fontSize * 1.3);
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = anchorPt.y - Math.max(12, Math.round(fontSize * 1.1)) - totalHeight;

  const outlineStroke =
    theme === 'white'
      ? 'rgba(255,255,255,0.92)'
      : theme === 'red'
      ? 'rgba(8,0,0,0.92)'
      : 'rgba(6,9,16,0.92)';

  ctx.font = `600 ${fontSize}px "IBM Plex Sans", "Noto Sans KR", sans-serif`;
  ctx.lineWidth = Math.max(2.4, Number((fontSize * 0.25).toFixed(1)));
  ctx.strokeStyle = outlineStroke;
  ctx.fillStyle = color;

  for (let i = 0; i < lines.length; i++) {
    const ly = startY + i * lineHeight;
    ctx.strokeText(lines[i], anchorPt.x, ly);
    ctx.fillText(lines[i], anchorPt.x, ly);
  }

  ctx.restore();
}

export interface RenderAsterismsOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  currentFovDeg: number;
  theme: ThemeMode;
  projector: AsterismProjector;
  store: AsterismStoreState;
  drawingActive: boolean;
  activeTool?: AsterismTool;
  eyepieceFovDeg?: number;
  finderFovDeg?: number;
  selectedObjectId: string | null;
  draft: AsterismDraftState | null;
  hoverSnap: AsterismSnapPreview | null;
  isInnerClip?: boolean;
  isSensorPhoto?: boolean;
}

/**
 * Render all visible user-drawn Asterisms, Star Chains, Circles, Polygons, Direction Vectors,
 * and Standalone Multiline Text elements, plus interactive draft preview, linked optical circle preview,
 * magnetic snap ring, live PA/separation readout, and vertex/midpoint edit handles.
 */
export function renderAsterismsPass(opts: RenderAsterismsOptions): void {
  const {
    ctx,
    width,
    height,
    currentFovDeg,
    theme,
    projector,
    store,
    drawingActive,
    activeTool = 'select',
    eyepieceFovDeg = 1.2,
    finderFovDeg = 7.0,
    selectedObjectId,
    draft,
    hoverSnap,
    isInnerClip,
    isSensorPhoto,
  } = opts;

  if (isSensorPhoto) return;

  const visibleLayerIds = new Set(store.layers.filter((l) => l.visible).map((l) => l.id));
  const asterismMap = new Map<string, AsterismGroup>(store.asterisms.map((g) => [g.id, g]));

  for (const obj of store.objects) {
    const isSelected = drawingActive && obj.id === selectedObjectId;
    const parentGrp = asterismMap.get(obj.asterismId);
    const effectiveLayerId = parentGrp ? parentGrp.layerId : obj.layerId;
    const layerVisible = visibleLayerIds.has(effectiveLayerId);
    const groupVisible = parentGrp ? parentGrp.visible : true;

    if ((!layerVisible || !groupVisible) && !isSelected) continue;

    const fovRange = parentGrp ? parentGrp.visibleFovRange : obj.visibleFovRange;
    let lodAlpha = computeLodFadeAlpha(currentFovDeg, fovRange);
    if (lodAlpha <= 0.01) {
      if (isSelected) {
        lodAlpha = 0.4;
      } else {
        continue;
      }
    }

    const color = resolveAsterismColor(obj.color, theme);
    const effAlpha = Math.max(0.05, Math.min(1, obj.opacity * lodAlpha));

    const projectedVerts: ({ x: number; y: number } | null)[] = obj.vertices.map((v) =>
      projector.project(v.raDeg, v.decDeg, 260)
    );
    const validPts = projectedVerts.filter((p): p is { x: number; y: number } => p !== null);
    if (validPts.length === 0 && obj.type !== 'circle') continue;

    ctx.save();
    ctx.globalAlpha = effAlpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = isSelected ? obj.lineWidth + 0.7 : obj.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (obj.type === 'polyline' && obj.vertices.length >= 2) {
      applyLineDash(ctx, obj.lineStyle, obj.lineWidth);
      if (obj.smooth && validPts.length >= 3 && validPts.length === obj.vertices.length) {
        strokeCatmullRom(ctx, validPts);
      } else {
        for (let i = 0; i < obj.vertices.length - 1; i++) {
          const segPts = projectGreatCircleSegment(obj.vertices[i], obj.vertices[i + 1], projector);
          if (segPts.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(segPts[0].x, segPts[0].y);
          for (let k = 1; k < segPts.length; k++) {
            if (Math.hypot(segPts[k].x - segPts[k - 1].x, segPts[k].y - segPts[k - 1].y) > 900) {
              ctx.moveTo(segPts[k].x, segPts[k].y);
            } else {
              ctx.lineTo(segPts[k].x, segPts[k].y);
            }
          }
          ctx.stroke();
        }
      }

      ctx.setLineDash([]);
      for (const pt of validPts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isSelected ? 3.2 : 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (obj.type === 'polygon' && obj.vertices.length >= 3) {
      const polyScreenPts: { x: number; y: number }[] = [];
      for (let i = 0; i < obj.vertices.length; i++) {
        const a = obj.vertices[i];
        const b = obj.vertices[(i + 1) % obj.vertices.length];
        const seg = projectGreatCircleSegment(a, b, projector);
        if (seg.length > 0) {
          for (let k = 0; k < seg.length - 1; k++) polyScreenPts.push(seg[k]);
        }
      }
      if (polyScreenPts.length >= 3) {
        let hasJump = false;
        for (let i = 1; i < polyScreenPts.length; i++) {
          if (
            Math.hypot(
              polyScreenPts[i].x - polyScreenPts[i - 1].x,
              polyScreenPts[i].y - polyScreenPts[i - 1].y
            ) > 900
          ) {
            hasJump = true;
            break;
          }
        }
        if (!hasJump) {
          ctx.beginPath();
          ctx.moveTo(polyScreenPts[0].x, polyScreenPts[0].y);
          for (let i = 1; i < polyScreenPts.length; i++) {
            ctx.lineTo(polyScreenPts[i].x, polyScreenPts[i].y);
          }
          ctx.closePath();

          const fillAlpha = Math.max(0, Math.min(0.45, obj.fillAlpha ?? 0.08));
          if (fillAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = fillAlpha * lodAlpha;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
          }

          applyLineDash(ctx, obj.lineStyle, obj.lineWidth);
          ctx.stroke();
        }
      }
    } else if (obj.type === 'circle' && obj.vertices.length >= 1) {
      const center = obj.vertices[0];
      const radiusDeg = getCircleRadiusDeg(obj);
      const circlePts = projectSphericalCircle(center.raDeg, center.decDeg, radiusDeg, projector, 64);
      if (circlePts.length >= 16) {
        let hasJump = false;
        for (let i = 1; i < circlePts.length; i++) {
          if (
            Math.hypot(circlePts[i].x - circlePts[i - 1].x, circlePts[i].y - circlePts[i - 1].y) > 900
          ) {
            hasJump = true;
            break;
          }
        }
        if (!hasJump) {
          ctx.beginPath();
          ctx.moveTo(circlePts[0].x, circlePts[0].y);
          for (let i = 1; i < circlePts.length; i++) {
            ctx.lineTo(circlePts[i].x, circlePts[i].y);
          }
          ctx.closePath();

          const fillAlpha = Math.max(0, Math.min(0.45, obj.fillAlpha ?? 0));
          if (fillAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = fillAlpha * lodAlpha;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
          }

          applyLineDash(ctx, obj.lineStyle, obj.lineWidth);
          ctx.stroke();
        }
      }
      // Subtle center crosshair when selected
      if (isSelected && projectedVerts[0]) {
        const cp = projectedVerts[0];
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cp.x - 5, cp.y);
        ctx.lineTo(cp.x + 5, cp.y);
        ctx.moveTo(cp.x, cp.y - 5);
        ctx.lineTo(cp.x, cp.y + 5);
        ctx.stroke();
      }
    } else if (obj.type === 'arrow' && obj.vertices.length >= 2) {
      applyLineDash(ctx, obj.lineStyle, obj.lineWidth);
      let lastFrom: { x: number; y: number } | null = null;
      let lastTo: { x: number; y: number } | null = null;

      for (let i = 0; i < obj.vertices.length - 1; i++) {
        const segPts = projectGreatCircleSegment(obj.vertices[i], obj.vertices[i + 1], projector);
        if (segPts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(segPts[0].x, segPts[0].y);
        for (let k = 1; k < segPts.length; k++) {
          ctx.lineTo(segPts[k].x, segPts[k].y);
        }
        ctx.stroke();
        lastFrom = segPts[segPts.length - 2];
        lastTo = segPts[segPts.length - 1];
      }

      if (lastFrom && lastTo) {
        drawArrowhead(ctx, lastFrom, lastTo, 9 + Math.min(6, obj.lineWidth) * 1.4, color);
      }

      const ext = obj.extensionFactor ?? 1;
      if (ext > 1.05 && obj.vertices.length >= 2) {
        const vA = obj.vertices[obj.vertices.length - 2];
        const vB = obj.vertices[obj.vertices.length - 1];
        const baseSep = angularDistanceDeg(vA.raDeg, vA.decDeg, vB.raDeg, vB.decDeg);
        const pa = positionAngleDeg(vA.raDeg, vA.decDeg, vB.raDeg, vB.decDeg);
        const target = destinationPointSpherical(vA.raDeg, vA.decDeg, pa, baseSep * ext);
        const extPts = projectGreatCircleSegment(vB, target, projector);
        if (extPts.length >= 2) {
          ctx.save();
          ctx.globalAlpha = effAlpha * 0.72;
          ctx.setLineDash([3, 4]);
          ctx.lineWidth = Math.max(1, obj.lineWidth * 0.85);
          ctx.beginPath();
          ctx.moveTo(extPts[0].x, extPts[0].y);
          for (let k = 1; k < extPts.length; k++) ctx.lineTo(extPts[k].x, extPts[k].y);
          ctx.stroke();
          const tip = extPts[extPts.length - 1];
          drawArrowhead(ctx, extPts[extPts.length - 2], tip, 8 + Math.min(5, obj.lineWidth), color);

          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = '600 9.5px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = color;
          ctx.fillText(
            `${ext.toFixed(1)}× (${formatAngularSeparation(baseSep * ext)})`,
            tip.x + 9,
            tip.y
          );
          ctx.restore();
        }
      }
    } else if (obj.type === 'label' && validPts.length >= 1) {
      // Subtle anchor marker for standalone text element (visible mainly in drawing mode or faintly)
      const p = validPts[0];
      const textAlpha = Math.max(
        0.05,
        Math.min(1, (obj.textOpacity ?? obj.opacity ?? 0.95) * lodAlpha)
      );
      ctx.globalAlpha = isSelected ? Math.max(0.6, textAlpha) : textAlpha * 0.65;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.restore();

    // ONLY render text on canvas for explicit 'label' (텍스트) elements (property names never render on chart!)
    if (obj.type === 'label' && validPts.length >= 1) {
      drawStandaloneTextElement(ctx, validPts[0], obj, color, theme, lodAlpha, width, height);
    }

    // Interactive vertex & midpoint handles when selected in Drawing Mode (outer pass only)
    if (isSelected && !isInnerClip) {
      ctx.save();
      if (obj.type !== 'label' && obj.type !== 'circle' && obj.vertices.length >= 2) {
        const segCount = obj.type === 'polygon' ? obj.vertices.length : obj.vertices.length - 1;
        for (let i = 0; i < segCount; i++) {
          const a = obj.vertices[i];
          const b = obj.vertices[(i + 1) % obj.vertices.length];
          const mid = sphericalMidpoint(a.raDeg, a.decDeg, b.raDeg, b.decDeg);
          const mp = projector.project(mid.raDeg, mid.decDeg, 40);
          if (!mp) continue;
          ctx.fillStyle = theme === 'white' ? '#FFFFFF' : '#0B1120';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(mp.x, mp.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(mp.x - 2.2, mp.y);
          ctx.lineTo(mp.x + 2.2, mp.y);
          ctx.moveTo(mp.x, mp.y - 2.2);
          ctx.lineTo(mp.x, mp.y + 2.2);
          ctx.stroke();
        }
      }

      // For circle: draw center handle (index 0) and radius edge handle (index 1)
      if (obj.type === 'circle' && obj.vertices.length >= 1) {
        const centerPt = projectedVerts[0];
        if (centerPt) {
          ctx.fillStyle = theme === 'white' ? '#FFFFFF' : '#070B14';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerPt.x, centerPt.y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        const edgeVertex =
          obj.vertices[1] ??
          destinationPointSpherical(
            obj.vertices[0].raDeg,
            obj.vertices[0].decDeg,
            90,
            getCircleRadiusDeg(obj)
          );
        const edgePt = projector.project(edgeVertex.raDeg, edgeVertex.decDeg, 80);
        if (edgePt) {
          ctx.fillStyle = color;
          ctx.strokeStyle = theme === 'white' ? '#FFFFFF' : '#070B14';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(edgePt.x, edgePt.y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < projectedVerts.length; i++) {
          const pt = projectedVerts[i];
          if (!pt) continue;
          ctx.fillStyle = theme === 'white' ? '#FFFFFF' : '#070B14';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Active in-progress draft preview + linked optical circle preview + magnetic snap HUD (outer pass)
  if (drawingActive && !isInnerClip) {
    const activeColor = resolveAsterismColor(store.settings.defaultColor, theme);

    // Live Eyepiece / Finder linked Circle Preview centered on hoverSnap
    if (
      activeTool === 'circle' &&
      !draft &&
      hoverSnap &&
      (store.settings.circleLinkEyepiece || store.settings.circleLinkFinder)
    ) {
      const linkedRadiusDeg = store.settings.circleLinkEyepiece
        ? Math.max(0.02, eyepieceFovDeg / 2)
        : Math.max(0.1, finderFovDeg / 2);
      const linkedLabel = store.settings.circleLinkEyepiece
        ? `아이피스 시야 Ø${(linkedRadiusDeg * 2).toFixed(2)}°`
        : `파인더 시야 Ø${(linkedRadiusDeg * 2).toFixed(2)}°`;
      const circlePts = projectSphericalCircle(
        hoverSnap.raDeg,
        hoverSnap.decDeg,
        linkedRadiusDeg,
        projector,
        64
      );
      if (circlePts.length >= 16) {
        ctx.save();
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        ctx.lineWidth = store.settings.defaultLineWidth;
        ctx.globalAlpha = 0.85;
        applyLineDash(ctx, store.settings.defaultLineStyle, store.settings.defaultLineWidth);
        ctx.beginPath();
        ctx.moveTo(circlePts[0].x, circlePts[0].y);
        for (let i = 1; i < circlePts.length; i++) ctx.lineTo(circlePts[i].x, circlePts[i].y);
        ctx.closePath();
        if (store.settings.defaultCircleFillEnabled && store.settings.defaultFillAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = store.settings.defaultFillAlpha;
          ctx.fill();
          ctx.restore();
        }
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.font = '600 10px "IBM Plex Mono", "Noto Sans KR", monospace';
        const tw = ctx.measureText(linkedLabel).width;
        const bx = hoverSnap.x - tw / 2 - 5;
        const by = hoverSnap.y - 26;
        ctx.fillStyle =
          theme === 'white'
            ? 'rgba(255,255,255,0.92)'
            : theme === 'red'
            ? 'rgba(18,2,2,0.92)'
            : 'rgba(10,15,28,0.92)';
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by - 8, tw + 10, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = activeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(linkedLabel, hoverSnap.x, by + 0.5);
        ctx.restore();
      }
    }

    if (draft && draft.vertices.length > 0) {
      ctx.save();
      ctx.strokeStyle = activeColor;
      ctx.fillStyle = activeColor;
      ctx.lineWidth = store.settings.defaultLineWidth;
      ctx.globalAlpha = 0.92;
      applyLineDash(ctx, store.settings.defaultLineStyle, store.settings.defaultLineWidth);

      if (draft.type === 'circle' && hoverSnap) {
        const center = draft.vertices[0];
        const rDeg = Math.max(
          0.01,
          angularDistanceDeg(center.raDeg, center.decDeg, hoverSnap.raDeg, hoverSnap.decDeg)
        );
        const circlePts = projectSphericalCircle(center.raDeg, center.decDeg, rDeg, projector, 64);
        if (circlePts.length >= 16) {
          ctx.beginPath();
          ctx.moveTo(circlePts[0].x, circlePts[0].y);
          for (let i = 1; i < circlePts.length; i++) ctx.lineTo(circlePts[i].x, circlePts[i].y);
          ctx.closePath();
          if (store.settings.defaultCircleFillEnabled && store.settings.defaultFillAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = store.settings.defaultFillAlpha;
            ctx.fill();
            ctx.restore();
          }
          ctx.stroke();
        }
        const cp = projector.project(center.raDeg, center.decDeg, 80);
        if (cp) {
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cp.x, cp.y);
          ctx.lineTo(hoverSnap.x, hoverSnap.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = theme === 'white' ? '#FFFFFF' : '#0B1120';
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const mx = (cp.x + hoverSnap.x) / 2;
          const my = (cp.y + hoverSnap.y) / 2 - 14;
          const txt = `R ${formatAngularSeparation(rDeg)} · Ø ${formatAngularSeparation(rDeg * 2)}`;
          ctx.font = '600 10px "IBM Plex Mono", monospace';
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle =
            theme === 'white'
              ? 'rgba(255,255,255,0.92)'
              : theme === 'red'
              ? 'rgba(18,2,2,0.92)'
              : 'rgba(10,15,28,0.92)';
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(mx - tw / 2 - 5, my - 8, tw + 10, 16, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = activeColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, mx, my + 0.5);
        }
      } else {
        const allDraftVerts: AsterismVertex[] = hoverSnap
          ? [
              ...draft.vertices,
              {
                raDeg: hoverSnap.raDeg,
                decDeg: hoverSnap.decDeg,
                catalogId: hoverSnap.catalogId,
                starName: hoverSnap.starName,
                mag: hoverSnap.mag,
              },
            ]
          : draft.vertices;

        const projectedDraft = allDraftVerts
          .map((v) => projector.project(v.raDeg, v.decDeg, 260))
          .filter((p): p is { x: number; y: number } => p !== null);

        if (draft.type === 'polyline' && store.settings.defaultSmooth && projectedDraft.length >= 3) {
          strokeCatmullRom(ctx, projectedDraft);
        } else if (projectedDraft.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(projectedDraft[0].x, projectedDraft[0].y);
          for (let i = 1; i < projectedDraft.length; i++) {
            ctx.lineTo(projectedDraft[i].x, projectedDraft[i].y);
          }
          if (draft.type === 'polygon' && projectedDraft.length >= 3) {
            ctx.closePath();
            ctx.save();
            ctx.globalAlpha = store.settings.defaultFillAlpha;
            ctx.fill();
            ctx.restore();
          }
          ctx.stroke();

          if (draft.type === 'arrow') {
            drawArrowhead(
              ctx,
              projectedDraft[projectedDraft.length - 2],
              projectedDraft[projectedDraft.length - 1],
              10,
              activeColor
            );
          }
        }

        ctx.setLineDash([]);
        for (const v of draft.vertices) {
          const p = projector.project(v.raDeg, v.decDeg, 60);
          if (!p) continue;
          ctx.fillStyle = theme === 'white' ? '#FFFFFF' : '#0B1120';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        if (hoverSnap && draft.vertices.length >= 1) {
          const prevV = draft.vertices[draft.vertices.length - 1];
          const prevP = projector.project(prevV.raDeg, prevV.decDeg, 200);
          const sepDeg = angularDistanceDeg(
            prevV.raDeg,
            prevV.decDeg,
            hoverSnap.raDeg,
            hoverSnap.decDeg
          );
          const pa = positionAngleDeg(prevV.raDeg, prevV.decDeg, hoverSnap.raDeg, hoverSnap.decDeg);
          if (prevP && sepDeg > 0.0002) {
            const mx = (prevP.x + hoverSnap.x) / 2;
            const my = (prevP.y + hoverSnap.y) / 2 - 14;
            const txt = `${formatAngularSeparation(sepDeg)} · PA ${pa.toFixed(1)}°`;
            ctx.font = '600 10px "IBM Plex Mono", monospace';
            const tw = ctx.measureText(txt).width;
            ctx.fillStyle =
              theme === 'white'
                ? 'rgba(255,255,255,0.92)'
                : theme === 'red'
                ? 'rgba(18,2,2,0.92)'
                : 'rgba(10,15,28,0.92)';
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(mx - tw / 2 - 5, my - 8, tw + 10, 16, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = activeColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, mx, my + 0.5);
          }
        }
      }
      ctx.restore();
    }

    // Magnetic Snap Indicator Reticle on cursor
    if (hoverSnap) {
      ctx.save();
      ctx.strokeStyle = hoverSnap.snapped ? activeColor : 'rgba(148,163,184,0.7)';
      ctx.lineWidth = hoverSnap.snapped ? 1.5 : 1;
      if (!hoverSnap.snapped) ctx.setLineDash([2.5, 2.5]);
      ctx.beginPath();
      ctx.arc(hoverSnap.x, hoverSnap.y, hoverSnap.snapped ? 9 : 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hoverSnap.snapped) {
        ctx.beginPath();
        ctx.moveTo(hoverSnap.x - 13, hoverSnap.y);
        ctx.lineTo(hoverSnap.x - 6, hoverSnap.y);
        ctx.moveTo(hoverSnap.x + 6, hoverSnap.y);
        ctx.lineTo(hoverSnap.x + 13, hoverSnap.y);
        ctx.moveTo(hoverSnap.x, hoverSnap.y - 13);
        ctx.lineTo(hoverSnap.x, hoverSnap.y - 6);
        ctx.moveTo(hoverSnap.x, hoverSnap.y + 6);
        ctx.lineTo(hoverSnap.x, hoverSnap.y + 13);
        ctx.stroke();

        const snapLbl = hoverSnap.starName
          ? `${hoverSnap.starName}${hoverSnap.mag !== undefined ? ` (${hoverSnap.mag.toFixed(1)}m)` : ''}`
          : hoverSnap.catalogId ?? 'SNAP';
        ctx.font = '600 9.5px "IBM Plex Mono", "Noto Sans KR", monospace';
        const tw = ctx.measureText(snapLbl).width;
        const bx = Math.min(width - tw - 14, hoverSnap.x + 14);
        const by = Math.max(14, hoverSnap.y - 18);
        ctx.fillStyle =
          theme === 'white'
            ? 'rgba(255,255,255,0.92)'
            : theme === 'red'
            ? 'rgba(18,2,2,0.92)'
            : 'rgba(10,15,28,0.92)';
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by - 7.5, tw + 8, 15, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = activeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(snapLbl, bx + 4, by + 0.5);
      }
      ctx.restore();
    }
  }
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Hit-test vertices, midpoints (for selected object), and bodies of visible asterisms.
 */
export function hitTestAsterisms(
  px: number,
  py: number,
  store: AsterismStoreState,
  selectedObjectId: string | null,
  currentFovDeg: number,
  projector: AsterismProjector
): AsterismHitResult | null {
  const visibleLayers = new Set(store.layers.filter((l) => l.visible).map((l) => l.id));
  const asterismMap = new Map<string, AsterismGroup>(store.asterisms.map((g) => [g.id, g]));

  // 1. Prioritize vertex & midpoint handles of the currently selected object
  if (selectedObjectId) {
    const sel = store.objects.find((o) => o.id === selectedObjectId);
    if (sel) {
      if (sel.type === 'circle' && sel.vertices.length >= 1) {
        const cPt = projector.project(sel.vertices[0].raDeg, sel.vertices[0].decDeg, 80);
        if (cPt) {
          const d = Math.hypot(px - cPt.x, py - cPt.y);
          if (d <= 12) {
            return { objectId: sel.id, kind: 'vertex', vertexIndex: 0, x: cPt.x, y: cPt.y, distPx: d };
          }
        }
        const edgeV =
          sel.vertices[1] ??
          destinationPointSpherical(
            sel.vertices[0].raDeg,
            sel.vertices[0].decDeg,
            90,
            getCircleRadiusDeg(sel)
          );
        const ePt = projector.project(edgeV.raDeg, edgeV.decDeg, 80);
        if (ePt) {
          const d = Math.hypot(px - ePt.x, py - ePt.y);
          if (d <= 12) {
            return { objectId: sel.id, kind: 'vertex', vertexIndex: 1, x: ePt.x, y: ePt.y, distPx: d };
          }
        }
      } else {
        for (let i = 0; i < sel.vertices.length; i++) {
          const pt = projector.project(sel.vertices[i].raDeg, sel.vertices[i].decDeg, 80);
          if (!pt) continue;
          const d = Math.hypot(px - pt.x, py - pt.y);
          if (d <= 12) {
            return {
              objectId: sel.id,
              kind: 'vertex',
              vertexIndex: i,
              x: pt.x,
              y: pt.y,
              distPx: d,
            };
          }
        }
        if (sel.type !== 'label' && sel.vertices.length >= 2) {
          const segCount = sel.type === 'polygon' ? sel.vertices.length : sel.vertices.length - 1;
          for (let i = 0; i < segCount; i++) {
            const a = sel.vertices[i];
            const b = sel.vertices[(i + 1) % sel.vertices.length];
            const mid = sphericalMidpoint(a.raDeg, a.decDeg, b.raDeg, b.decDeg);
            const mp = projector.project(mid.raDeg, mid.decDeg, 60);
            if (!mp) continue;
            const d = Math.hypot(px - mp.x, py - mp.y);
            if (d <= 10) {
              return {
                objectId: sel.id,
                kind: 'midpoint',
                segmentIndex: i,
                x: mp.x,
                y: mp.y,
                distPx: d,
              };
            }
          }
        }
      }
    }
  }

  // 2. Hit-test any visible asterism body / circle / label marker
  let best: AsterismHitResult | null = null;
  for (let idx = store.objects.length - 1; idx >= 0; idx--) {
    const obj = store.objects[idx];
    const parentGrp = asterismMap.get(obj.asterismId);
    const effLayerId = parentGrp ? parentGrp.layerId : obj.layerId;
    const isVisible = visibleLayers.has(effLayerId) && (parentGrp ? parentGrp.visible : true);
    if (!isVisible && obj.id !== selectedObjectId) continue;
    const fovRange = parentGrp ? parentGrp.visibleFovRange : obj.visibleFovRange;
    const lod = computeLodFadeAlpha(currentFovDeg, fovRange);
    if (lod <= 0.01 && obj.id !== selectedObjectId) continue;

    if (obj.type === 'circle' && obj.vertices.length >= 1) {
      const center = obj.vertices[0];
      const radiusDeg = getCircleRadiusDeg(obj);
      const circlePts = projectSphericalCircle(center.raDeg, center.decDeg, radiusDeg, projector, 48);
      for (let i = 0; i < circlePts.length; i++) {
        const p1 = circlePts[i];
        const p2 = circlePts[(i + 1) % circlePts.length];
        const d = pointToSegmentDistance(px, py, p1.x, p1.y, p2.x, p2.y);
        if (d <= 10 && (!best || d < best.distPx)) {
          best = {
            objectId: obj.id,
            kind: 'body',
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
            distPx: d,
          };
        }
      }
      continue;
    }

    const pts = obj.vertices.map((v) => projector.project(v.raDeg, v.decDeg, 160));
    if (obj.type === 'label') {
      const p = pts[0];
      if (p) {
        const d = Math.hypot(px - p.x, py - p.y);
        if (d <= 26 && (!best || d < best.distPx)) {
          best = { objectId: obj.id, kind: 'body', x: p.x, y: p.y, distPx: d };
        }
      }
      continue;
    }

    const segCount = obj.type === 'polygon' ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      if (!p1 || !p2) continue;
      const d = pointToSegmentDistance(px, py, p1.x, p1.y, p2.x, p2.y);
      if (d <= 10 && (!best || d < best.distPx)) {
        best = {
          objectId: obj.id,
          kind: 'body',
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
          distPx: d,
        };
      }
    }
  }

  return best;
}
