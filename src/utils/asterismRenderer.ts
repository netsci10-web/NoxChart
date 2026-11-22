import {
  AsterismDraftState,
  AsterismLineStyle,
  AsterismObject,
  AsterismSnapPreview,
  AsterismStoreState,
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
    // Slightly deepen bright pastel swatches for crisp readability on white print canvas
    const map: Record<string, string> = {
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
  const s = Math.max(0.8, width);
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

    // Guard against stereographic wrap jumps
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

function drawUprightAsterismLabel(
  ctx: CanvasRenderingContext2D,
  anchorPt: { x: number; y: number },
  obj: AsterismObject,
  color: string,
  theme: ThemeMode,
  alpha: number,
  width: number,
  height: number
): void {
  const mainTitle = obj.label.trim();
  const subParts: string[] = [];
  if (obj.eyepieceTag?.trim()) subParts.push(obj.eyepieceTag.trim());
  if (obj.memo?.trim()) subParts.push(obj.memo.trim());
  if (!mainTitle && subParts.length === 0) return;

  if (
    anchorPt.x < -80 ||
    anchorPt.x > width + 80 ||
    anchorPt.y < -60 ||
    anchorPt.y > height + 60
  ) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
  ctx.textBaseline = 'middle';

  const pad = 10;
  let tx = anchorPt.x;
  let ty = anchorPt.y;
  let align: CanvasTextAlign = 'center';

  if (obj.labelAnchor === 'top') {
    ty -= pad + (subParts.length > 0 ? 11 : 4);
    align = 'center';
  } else if (obj.labelAnchor === 'bottom') {
    ty += pad + 4;
    align = 'center';
  } else if (obj.labelAnchor === 'left') {
    tx -= pad;
    align = 'right';
  } else {
    tx += pad;
    align = 'left';
  }

  ctx.textAlign = align;
  const outlineStroke =
    theme === 'white'
      ? 'rgba(255,255,255,0.92)'
      : theme === 'red'
      ? 'rgba(8,0,0,0.92)'
      : 'rgba(6,9,16,0.9)';

  if (mainTitle) {
    ctx.font = '600 11px "IBM Plex Sans", "Noto Sans KR", sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = outlineStroke;
    ctx.strokeText(mainTitle, tx, ty);
    ctx.fillStyle = color;
    ctx.fillText(mainTitle, tx, ty);
  }

  if (subParts.length > 0) {
    const subText = subParts.join(' · ');
    const subY = mainTitle ? ty + 13 : ty;
    ctx.font = '500 9.5px "IBM Plex Mono", "Noto Sans KR", monospace';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = outlineStroke;
    ctx.strokeText(subText, tx, subY);
    ctx.fillStyle =
      theme === 'white'
        ? 'rgba(51,65,85,0.92)'
        : theme === 'red'
        ? 'rgba(220,38,38,0.85)'
        : 'rgba(203,213,225,0.88)';
    ctx.fillText(subText, tx, subY);
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
  selectedObjectId: string | null;
  draft: AsterismDraftState | null;
  hoverSnap: AsterismSnapPreview | null;
  isInnerClip?: boolean;
  isSensorPhoto?: boolean;
}

/**
 * Render all visible user-drawn Asterisms, Star Chains, Hopping Polygons, Direction Vectors,
 * Labels, plus interactive draft preview, magnetic snap ring, live PA/separation readout,
 * and vertex/midpoint edit handles.
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
    selectedObjectId,
    draft,
    hoverSnap,
    isInnerClip,
    isSensorPhoto,
  } = opts;

  if (isSensorPhoto) return;

  const visibleLayerIds = new Set(store.layers.filter((l) => l.visible).map((l) => l.id));

  for (const obj of store.objects) {
    const isSelected = drawingActive && obj.id === selectedObjectId;
    if (!visibleLayerIds.has(obj.layerId) && !isSelected) continue;

    let lodAlpha = computeLodFadeAlpha(currentFovDeg, obj.visibleFovRange);
    if (lodAlpha <= 0.01) {
      if (isSelected) {
        lodAlpha = 0.4; // Keep faintly visible while explicitly selected for editing
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
    if (validPts.length === 0) continue;

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

      // Small subtle anchor nodes on star-chain vertices
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
        drawArrowhead(ctx, lastFrom, lastTo, 9 + obj.lineWidth * 1.4, color);
      }

      // Optional spherical extension vector (e.g., 2.5x beyond the last segment)
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
          drawArrowhead(ctx, extPts[extPts.length - 2], tip, 8 + obj.lineWidth, color);

          // Target ring + extension multiplier badge (upright)
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
      // Subtle anchor marker for standalone label/tag
      const p = validPts[0];
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();

    // Upright label placement (always right-side-up regardless of Flip H/V or rotation)
    let labelAnchorPt = validPts[0];
    if (obj.type === 'polygon' && validPts.length >= 3) {
      const cx = validPts.reduce((s, p) => s + p.x, 0) / validPts.length;
      const cy = validPts.reduce((s, p) => s + p.y, 0) / validPts.length;
      labelAnchorPt = { x: cx, y: cy };
    } else if (obj.type === 'polyline' || obj.type === 'arrow') {
      labelAnchorPt = validPts[Math.floor(validPts.length / 2)];
    }
    drawUprightAsterismLabel(ctx, labelAnchorPt, obj, color, theme, effAlpha, width, height);

    // Interactive vertex & midpoint handles when selected in Drawing Mode (outer pass only)
    if (isSelected && !isInnerClip) {
      ctx.save();
      // Segment midpoint (+) handles for inserting intermediate vertices
      if (obj.type !== 'label' && obj.vertices.length >= 2) {
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

      // Draggable vertex handles
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
      ctx.restore();
    }
  }

  // Active in-progress draft preview + live angular distance & PA HUD (outer pass)
  if (drawingActive && !isInnerClip) {
    const activeColor = resolveAsterismColor(store.settings.defaultColor, theme);

    if (draft && draft.vertices.length > 0) {
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

      ctx.save();
      ctx.strokeStyle = activeColor;
      ctx.fillStyle = activeColor;
      ctx.lineWidth = store.settings.defaultLineWidth;
      ctx.globalAlpha = 0.92;
      applyLineDash(ctx, store.settings.defaultLineStyle, store.settings.defaultLineWidth);

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

      // Draw placed vertices
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

      // Live angular separation & PA badge on active rubber-band segment
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

  // 1. Prioritize vertex & midpoint handles of the currently selected object
  if (selectedObjectId) {
    const sel = store.objects.find((o) => o.id === selectedObjectId);
    if (sel) {
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

  // 2. Hit-test any visible asterism body / label marker
  let best: AsterismHitResult | null = null;
  for (let idx = store.objects.length - 1; idx >= 0; idx--) {
    const obj = store.objects[idx];
    if (!visibleLayers.has(obj.layerId) && obj.id !== selectedObjectId) continue;
    const lod = computeLodFadeAlpha(currentFovDeg, obj.visibleFovRange);
    if (lod <= 0.01 && obj.id !== selectedObjectId) continue;

    const pts = obj.vertices.map((v) => projector.project(v.raDeg, v.decDeg, 160));
    if (obj.type === 'label') {
      const p = pts[0];
      if (p) {
        const d = Math.hypot(px - p.x, py - p.y);
        if (d <= 22 && (!best || d < best.distPx)) {
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
