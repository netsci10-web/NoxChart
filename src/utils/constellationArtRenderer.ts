import { Constellation, ThemeMode } from '../types/astronomy';
import { DEG2RAD, ProjectionParams, projectStereographicRaw, RAD2DEG } from './astronomy';
import {
  CONSTELLATION_ART_ALIGNMENTS,
  DEFAULT_CONSTELLATION_ART_ALIGNMENT,
} from './constellationArtAlignments';

type Vec3 = [number, number, number];

interface PreparedConstellationArt {
  abbr: string;
  centerVec: Vec3;
  eastVec: Vec3;
  northVec: Vec3;
  halfEastRad: number;
  halfNorthRad: number;
  boundRadiusRad: number;
  segVecs: Array<[Vec3, Vec3]>;
}

const ART_IMAGE_BASE_PATH = '/assets/constellations';

const artImageCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();
const themedSpriteCache = new WeakMap<
  HTMLImageElement,
  Partial<Record<ThemeMode, HTMLCanvasElement>>
>();
const artLoadListeners = new Set<() => void>();
let notifyRafId = 0;

function scheduleArtLoadNotify(): void {
  if (notifyRafId || typeof window === 'undefined') return;
  notifyRafId = window.requestAnimationFrame(() => {
    notifyRafId = 0;
    for (const cb of artLoadListeners) {
      try {
        cb();
      } catch {
        // Ignore subscriber errors
      }
    }
  });
}

/**
 * Subscribe to constellation illustration load events so the canvas re-renders
 * smoothly as lazily loaded artwork sprites become available.
 */
export function subscribeConstellationArtLoad(callback: () => void): () => void {
  artLoadListeners.add(callback);
  return () => {
    artLoadListeners.delete(callback);
  };
}

function getConstellationArtImage(abbr: string): HTMLImageElement | null {
  const cached = artImageCache.get(abbr);
  if (cached && cached !== 'loading' && cached !== 'error') {
    return cached.complete && cached.naturalWidth > 0 ? cached : null;
  }
  if (cached === 'loading' || cached === 'error') {
    return null;
  }
  if (typeof Image === 'undefined') return null;

  artImageCache.set(abbr, 'loading');
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    artImageCache.set(abbr, img);
    scheduleArtLoadNotify();
  };
  img.onerror = () => {
    artImageCache.set(abbr, 'error');
  };
  img.src = `${ART_IMAGE_BASE_PATH}/${encodeURIComponent(abbr)}.webp?v=2`;
  return null;
}

/**
 * Returns a theme-adapted drawable source for a constellation sprite:
 * - dark: original luminous blue-white transparent sprite (drawn with 'screen')
 * - white: crisp antique slate-indigo ink on transparent background for paper/print charts
 * - red: pure dark-adaptation-safe crimson glow preserving alpha
 */
function getThemedConstellationSprite(
  img: HTMLImageElement,
  theme: ThemeMode
): HTMLImageElement | HTMLCanvasElement {
  if (theme === 'dark') return img;

  let perTheme = themedSpriteCache.get(img);
  if (!perTheme) {
    perTheme = {};
    themedSpriteCache.set(img, perTheme);
  }
  const existing = perTheme[theme];
  if (existing) return existing;

  if (typeof document === 'undefined') return img;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w <= 0 || h <= 0) return img;

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (!octx) return img;

  octx.drawImage(img, 0, 0, w, h);
  try {
    const imgData = octx.getImageData(0, 0, w, h);
    const data = imgData.data;
    if (theme === 'white') {
      // Antique indigo-slate engraved ink on white paper
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        // Darker ink on bright outlines/stars, softer slate on misty interior glow
        const inkStrength = Math.min(1, Math.pow(lum, 0.72) * 1.12);
        data[i] = Math.round(44 - inkStrength * 18);
        data[i + 1] = Math.round(62 - inkStrength * 22);
        data[i + 2] = Math.round(98 - inkStrength * 20);
        data[i + 3] = Math.min(255, Math.round(a * (0.55 + inkStrength * 0.45)));
      }
    } else {
      // Red night-vision mode: eliminate blue/green light to preserve dark adaptation
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        const redLum = Math.min(1, Math.pow(lum, 0.85) * 1.1);
        data[i] = Math.round(redLum * 238);
        data[i + 1] = Math.round(redLum * 24);
        data[i + 2] = Math.round(redLum * 18);
        data[i + 3] = a;
      }
    }
    octx.putImageData(imgData, 0, 0);
  } catch {
    // Fallback to original image if canvas pixel access is restricted
    return img;
  }

  perTheme[theme] = off;
  return off;
}

function toVec3(raDeg: number, decDeg: number): Vec3 {
  const a = raDeg * DEG2RAD;
  const d = decDeg * DEG2RAD;
  const cd = Math.cos(d);
  return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm3(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function vec3ToRaDec(v: Vec3): [number, number] {
  const ra = ((Math.atan2(v[1], v[0]) * RAD2DEG) + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, v[2]))) * RAD2DEG;
  return [ra, dec];
}

function makeTangentBasis(center: Vec3): { east: Vec3; north: Vec3 } {
  const pole: Vec3 = Math.abs(center[2]) < 0.96 ? [0, 0, 1] : [1, 0, 0];
  // East = increasing RA direction = pole × center
  const east = norm3(cross3(pole, center));
  // North = center × east
  const north = norm3(cross3(center, east));
  return { east, north };
}

const artCache = new WeakMap<Constellation[], PreparedConstellationArt[]>();

function getPreparedConstellationArts(
  constellations: Constellation[]
): PreparedConstellationArt[] {
  const existing = artCache.get(constellations);
  if (existing && existing.length > 0) {
    return existing;
  }

  const list: PreparedConstellationArt[] = [];

  for (const con of constellations) {
    const activeLines =
      con.traditionalLines && con.traditionalLines.length > 0 ? con.traditionalLines : con.lines;
    const verts: [number, number][] = [];
    const segVecs: Array<[Vec3, Vec3]> = [];
    for (const [r1, d1, r2, d2] of activeLines) {
      verts.push([r1, d1], [r2, d2]);
      segVecs.push([toVec3(r1, d1), toVec3(r2, d2)]);
    }
    if (verts.length === 0) {
      verts.push([con.ra, con.dec]);
    }

    let sx = 0;
    let sy = 0;
    let sz = 0;
    const vertVecs = verts.map(([ra, dec]) => {
      const v = toVec3(ra, dec);
      sx += v[0];
      sy += v[1];
      sz += v[2];
      return v;
    });
    const centerVec = norm3([sx, sy, sz]);
    const { east: eastVec, north: northVec } = makeTangentBasis(centerVec);

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const v of vertVecs) {
      const c = Math.max(0.2, dot3(v, centerVec));
      const u = dot3(v, eastVec) / c;
      const w = dot3(v, northVec) / c;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (w < minV) minV = w;
      if (w > maxV) maxV = w;
    }

    // Re-center tangent frame cleanly on the midpoint of the constellation figure bounds
    const midU = (minU + maxU) / 2;
    const midV = (minV + maxV) / 2;
    const shiftedCenter = norm3([
      centerVec[0] + eastVec[0] * midU + northVec[0] * midV,
      centerVec[1] + eastVec[1] * midU + northVec[1] * midV,
      centerVec[2] + eastVec[2] * midU + northVec[2] * midV,
    ]);
    const basis = makeTangentBasis(shiftedCenter);

    const halfEastRad = Math.max(
      3.8 * DEG2RAD,
      Math.min(32 * DEG2RAD, ((maxU - minU) / 2) * 1.15)
    );
    const halfNorthRad = Math.max(
      3.8 * DEG2RAD,
      Math.min(28 * DEG2RAD, ((maxV - minV) / 2) * 1.15)
    );
    const boundRadiusRad = Math.min(Math.PI * 0.45, Math.hypot(halfEastRad, halfNorthRad) * 1.4);

    list.push({
      abbr: con.abbr,
      centerVec: shiftedCenter,
      eastVec: basis.east,
      northVec: basis.north,
      halfEastRad,
      halfNorthRad,
      boundRadiusRad,
      segVecs,
    });
  }

  artCache.set(constellations, list);
  return list;
}

/**
 * Angular distance in radians from a unit vector p to the 3D chord segment [a, b]
 * projected back onto the unit sphere.
 */
function pointToSegmentAngleRad(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const abLenSq = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (abLenSq > 1e-10) {
    t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / abLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const cx = a[0] + abx * t;
  const cy = a[1] + aby * t;
  const cz = a[2] + abz * t;
  const cLen = Math.hypot(cx, cy, cz) || 1;
  const cosAng = Math.max(-1, Math.min(1, (p[0] * cx + p[1] * cy + p[2] * cz) / cLen));
  return Math.acos(cosAng);
}

/**
 * Identifies the single constellation corresponding to the center of the current viewport
 * using minimum spherical distance to its stick-figure segments (with a small centroid tie-breaker).
 */
function findCenterConstellationAbbr(
  prepared: PreparedConstellationArt[],
  proj: ProjectionParams
): string | null {
  const centerSkyVec = toVec3(proj.ra0Deg, proj.dec0Deg);
  let bestAbbr: string | null = null;
  let bestScore = Infinity;

  for (const art of prepared) {
    const centerCos = Math.max(-1, Math.min(1, dot3(centerSkyVec, art.centerVec)));
    const centerDist = Math.acos(centerCos);
    let minSegDist = centerDist;
    for (let i = 0; i < art.segVecs.length; i++) {
      const seg = art.segVecs[i];
      const d = pointToSegmentAngleRad(centerSkyVec, seg[0], seg[1]);
      if (d < minSegDist) minSegDist = d;
    }
    const score = minSegDist + centerDist * 0.12;
    if (score < bestScore) {
      bestScore = score;
      bestAbbr = art.abbr;
    }
  }

  return bestAbbr;
}

/**
 * Independent Rendering Layer:
 * Projects the 88 constellation artwork illustrations directly onto their corresponding
 * sky coordinates with aspect-preserving tangent-plane alignment, parallactic rotation,
 * flip handling, and theme-adapted blending (dark screen / white ink / red night vision).
 */
export function renderClassicalConstellationArtLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fsz: number,
  theme: ThemeMode,
  opacity: number,
  constellations: Constellation[],
  _constellationBoundaries: [number, number][][],
  proj: ProjectionParams,
  artScope: 'all' | 'center' = 'all'
): void {
  if (constellations.length === 0 || opacity <= 0.01) return;

  // Gently fade out constellation illustrations when deeply zoomed into narrow eyepiece/sensor framing
  const zoomFade = fsz < 5 ? 0 : fsz < 13 ? (fsz - 5) / 8 : 1;
  // Slightly lift mid-low opacity values so luminous transparent sprites stay clear at default setting
  const masterAlpha = Math.max(0, Math.min(1, Math.pow(opacity, 0.88))) * zoomFade;
  if (masterAlpha <= 0.008) return;

  const prepared = getPreparedConstellationArts(constellations);
  const centerOnlyAbbr =
    artScope === 'center' ? findCenterConstellationAbbr(prepared, proj) : null;
  const maxJumpPx = Math.max(width, height) * 1.35;

  const projectOffsetVec = (
    art: PreparedConstellationArt,
    eastRad: number,
    northRad: number
  ): { x: number; y: number } | null => {
    const px =
      art.centerVec[0] + art.eastVec[0] * eastRad + art.northVec[0] * northRad;
    const py =
      art.centerVec[1] + art.eastVec[1] * eastRad + art.northVec[1] * northRad;
    const pz =
      art.centerVec[2] + art.eastVec[2] * eastRad + art.northVec[2] * northRad;
    const len = Math.hypot(px, py, pz) || 1;
    const [raDeg, decDeg] = vec3ToRaDec([px / len, py / len, pz / len]);
    return projectStereographicRaw(raDeg, decDeg, proj);
  };

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = theme === 'white' ? 'multiply' : 'screen';
  ctx.globalAlpha = masterAlpha;

  for (const art of prepared) {
    if (centerOnlyAbbr && art.abbr !== centerOnlyAbbr) continue;

    // Fast sphere/screen frustum cull
    const [cRa, cDec] = vec3ToRaDec(art.centerVec);
    const centerPt = projectStereographicRaw(cRa, cDec, proj);
    if (!centerPt) continue;

    const align = CONSTELLATION_ART_ALIGNMENTS[art.abbr] ?? DEFAULT_CONSTELLATION_ART_ALIGNMENT;
    const approxRadPx =
      2 * proj.scale * Math.tan(Math.min(Math.PI * 0.48, art.boundRadiusRad * Math.max(1, align.scale)) / 2) +
      110;
    if (
      centerPt.x + approxRadPx < 0 ||
      centerPt.x - approxRadPx > width ||
      centerPt.y + approxRadPx < 0 ||
      centerPt.y - approxRadPx > height
    ) {
      continue;
    }

    // Lazily load only visible constellations
    const img = getConstellationArtImage(art.abbr);
    if (!img) continue;

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    if (imgW <= 0 || imgH <= 0) continue;

    // Sample local tangent Jacobian at constellation center:
    // West (-eastVec) = screen +X (right), South (-northVec) = screen +Y (down)
    const stepRad = Math.min(0.06, Math.max(0.015, Math.min(art.halfEastRad, art.halfNorthRad) * 0.3));
    const ptWest = projectOffsetVec(art, -stepRad, 0);
    const ptSouth = projectOffsetVec(art, 0, -stepRad);
    if (!ptWest || !ptSouth) continue;

    const vxX = (ptWest.x - centerPt.x) / stepRad;
    const vxY = (ptWest.y - centerPt.y) / stepRad;
    const vyX = (ptSouth.x - centerPt.x) / stepRad;
    const vyY = (ptSouth.y - centerPt.y) / stepRad;

    const pxPerRadX = Math.hypot(vxX, vxY);
    const pxPerRadY = Math.hypot(vyX, vyY);
    if (pxPerRadX <= 1 || pxPerRadY <= 1) continue;

    // Preserve the illustration's exact natural aspect ratio while matching the constellation's angular span
    const ar = imgW / imgH;
    const targetDiag = Math.hypot(art.halfEastRad, art.halfNorthRad) * 1.18;
    const imgDiag = Math.hypot(ar, 1);
    const drawHalfH = Math.max(3.2 * DEG2RAD, Math.min(28 * DEG2RAD, targetDiag / imgDiag));
    const drawHalfW = drawHalfH * ar;

    const estSpanPx = Math.max(
      pxPerRadX * drawHalfW * align.scale * 2,
      pxPerRadY * drawHalfH * align.scale * 2
    );
    if (estSpanPx < 14 || estSpanPx > maxJumpPx * 3.4) continue;

    // Normalize tangent directions to avoid stereographic shear near screen corners
    const avgScale = (pxPerRadX + pxPerRadY) * 0.5;
    const uxX = (vxX / pxPerRadX) * avgScale;
    const uxY = (vxY / pxPerRadX) * avgScale;
    const uyX = (vyX / pxPerRadY) * avgScale;
    const uyY = (vyY / pxPerRadY) * avgScale;

    // Apply per-constellation real-sky orientation alignment (flipX -> rotDeg -> scale -> tangent offset)
    const radPerPx = (drawHalfH * align.scale) / (imgH * 0.5);
    const sx = align.flipX ? -1 : 1;
    const rotRad = align.rotDeg * DEG2RAD;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    const a = (uxX * cosR * sx + uyX * sinR * sx) * radPerPx;
    const b = (uxY * cosR * sx + uyY * sinR * sx) * radPerPx;
    const c = (uxX * -sinR + uyX * cosR) * radPerPx;
    const d = (uxY * -sinR + uyY * cosR) * radPerPx;
    const defaultDrawH = drawHalfH * 2;
    const e = centerPt.x + (uxX * align.tx + uyX * align.ty) * defaultDrawH;
    const f = centerPt.y + (uxY * align.tx + uyY * align.ty) * defaultDrawH;

    const sprite = getThemedConstellationSprite(img, theme);

    ctx.save();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(sprite, -imgW / 2, -imgH / 2, imgW, imgH);
    ctx.restore();
  }

  ctx.restore();
}
