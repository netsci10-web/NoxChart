import {
  ChartViewState,
  Constellation,
  ConstellationLineStyle,
  CoordSystem,
  DsoType,
  ObjectNameLanguage,
  Star,
  StarHopGuide,
  ThemeMode,
} from '../types/astronomy';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export interface ProjectionParams {
  ra0Deg: number;
  dec0Deg: number;
  fovDeg: number;
  width: number;
  height: number;
  flipH: boolean;
  flipV: boolean;
  rotationDeg: number; // Clockwise screen rotation in degrees (0..360)
  cosRot: number;
  sinRot: number;
  coordSystem: CoordSystem;
  lstDeg: number;
  latDeg: number;
  // Precomputed horizontal center (populated automatically via createProjectionParams)
  alt0Deg: number;
  az0Deg: number;
  scale: number;
  northAngleDeg: number; // Clockwise rotation of Celestial North from screen-up (0° in equatorial)
}

export interface ProjectedPoint {
  x: number;
  y: number;
  cosC: number;
  scale: number;
}

/**
 * Create precomputed ProjectionParams supporting both Equatorial (North-up)
 * and Horizontal (Alt-Az, Zenith-up) stereographic projections.
 */
export function getStereographicRadiusPx(
  diameterDeg: number,
  fovDeg: number,
  width: number,
  height: number
): number {
  const viewRadiusRad = (fovDeg / 2) * DEG2RAD;
  const scale = (Math.min(width, height) / 2) / (2 * Math.tan(viewRadiusRad / 2));
  return 2 * scale * Math.tan((diameterDeg * DEG2RAD) / 4);
}

export function createProjectionParams(
  view: ChartViewState,
  width: number,
  height: number,
  lstDeg: number,
  latDeg: number,
  rotationDeg = 0
): ProjectionParams {
  const ra0Deg = view.ra * 15;
  const dec0Deg = view.dec;
  const viewRadiusRad = (view.fsz / 2) * DEG2RAD;
  const scale = (Math.min(width, height) / 2) / (2 * Math.tan(viewRadiusRad / 2));
  const hz0 = equatorialToHorizontal(ra0Deg, dec0Deg, lstDeg, latDeg);
  const normRot = ((rotationDeg % 360) + 360) % 360;
  const rotRad = normRot * DEG2RAD;

  const base: ProjectionParams = {
    ra0Deg,
    dec0Deg,
    fovDeg: view.fsz,
    width,
    height,
    flipH: view.flipH,
    flipV: view.flipV,
    rotationDeg: normRot,
    cosRot: Math.cos(rotRad),
    sinRot: Math.sin(rotRad),
    coordSystem: view.coordSystem,
    lstDeg,
    latDeg,
    alt0Deg: hz0.altDeg,
    az0Deg: hz0.azDeg,
    scale,
    northAngleDeg: 0,
  };

  if (view.coordSystem === 'horizontal') {
    // Compute exact clockwise angle of Celestial North relative to Zenith-up
    const unflipped: ProjectionParams = {
      ...base,
      flipH: false,
      flipV: false,
      rotationDeg: 0,
      cosRot: 1,
      sinRot: 0,
    };
    const delta = dec0Deg > 89.5 ? -0.1 : 0.1;
    const pN = projectStereographicRaw(ra0Deg, dec0Deg + delta, unflipped);
    if (pN) {
      const sign = delta > 0 ? 1 : -1;
      const dx = (pN.x - width / 2) * sign;
      const dy = (pN.y - height / 2) * sign;
      // Screen up is (0, -1). Clockwise angle from (0, -1) to (dx, dy) is atan2(dx, -dy).
      base.northAngleDeg = Math.atan2(dx, -dy) * RAD2DEG;
    }
  }

  return base;
}

/**
 * Stereographic Projection: J2000 (RA, Dec) in degrees -> 2D screen pixel (x, y).
 * Supports both Equatorial (RA/Dec, North up) and Horizontal (Alt/Az, Zenith up).
 */
export function projectStereographic(
  raDeg: number,
  decDeg: number,
  p: ProjectionParams,
  margin = 80
): ProjectedPoint | null {
  const pt = projectStereographicRaw(raDeg, decDeg, p, -0.15);
  if (!pt) return null;
  if (
    pt.x < -margin ||
    pt.x > p.width + margin ||
    pt.y < -margin ||
    pt.y > p.height + margin
  ) {
    return null;
  }
  return pt;
}

/**
 * Project without screen clipping (used for great-circle arcs, grids, and contours).
 */
export function projectStereographicRaw(
  raDeg: number,
  decDeg: number,
  p: ProjectionParams,
  minCosC = -0.35
): ProjectedPoint | null {
  if (p.coordSystem === 'horizontal') {
    const hz = equatorialToHorizontal(raDeg, decDeg, p.lstDeg, p.latDeg);
    return projectHorizontalRaw(hz.altDeg, hz.azDeg, p, minCosC);
  }

  const a = raDeg * DEG2RAD;
  const d = decDeg * DEG2RAD;
  const a0 = p.ra0Deg * DEG2RAD;
  const d0 = p.dec0Deg * DEG2RAD;

  const sinD = Math.sin(d);
  const cosD = Math.cos(d);
  const sinD0 = Math.sin(d0);
  const cosD0 = Math.cos(d0);
  const dA = a - a0;
  const cosDA = Math.cos(dA);

  const cosC = sinD0 * sinD + cosD0 * cosD * cosDA;
  if (cosC < minCosC) return null;

  const k = 2 / (1 + cosC);
  const projX = k * cosD * Math.sin(dA);
  const projY = k * (cosD0 * sinD - sinD0 * cosD * cosDA);

  const dirX = p.flipH ? 1 : -1;
  const dirY = p.flipV ? 1 : -1;
  const u = projX * p.scale * dirX;
  const v = projY * p.scale * dirY;
  const rx = p.rotationDeg !== 0 ? u * p.cosRot - v * p.sinRot : u;
  const ry = p.rotationDeg !== 0 ? u * p.sinRot + v * p.cosRot : v;

  return {
    x: p.width / 2 + rx,
    y: p.height / 2 + ry,
    cosC,
    scale: p.scale,
  };
}

/**
 * Direct Horizontal (Alt, Az) stereographic projection when Alt/Az are already known.
 * Increasing azimuth runs clockwise looking outward (+X on screen by default).
 */
export function projectHorizontalRaw(
  altDeg: number,
  azDeg: number,
  p: ProjectionParams,
  minCosC = -0.35
): ProjectedPoint | null {
  const alt = altDeg * DEG2RAD;
  const az = azDeg * DEG2RAD;
  const alt0 = p.alt0Deg * DEG2RAD;
  const az0 = p.az0Deg * DEG2RAD;

  const sinAlt = Math.sin(alt);
  const cosAlt = Math.cos(alt);
  const sinAlt0 = Math.sin(alt0);
  const cosAlt0 = Math.cos(alt0);
  const dAz = az - az0;
  const cosDAz = Math.cos(dAz);

  const cosC = sinAlt0 * sinAlt + cosAlt0 * cosAlt * cosDAz;
  if (cosC < minCosC) return null;

  const k = 2 / (1 + cosC);
  const projX = k * cosAlt * Math.sin(dAz);
  const projY = k * (cosAlt0 * sinAlt - sinAlt0 * cosAlt * cosDAz);

  // Facing sky: increasing Azimuth is to the RIGHT (+X) by default; Zenith is UP (-Y)
  const dirX = p.flipH ? -1 : 1;
  const dirY = p.flipV ? 1 : -1;
  const u = projX * p.scale * dirX;
  const v = projY * p.scale * dirY;
  const rx = p.rotationDeg !== 0 ? u * p.cosRot - v * p.sinRot : u;
  const ry = p.rotationDeg !== 0 ? u * p.sinRot + v * p.cosRot : v;

  return {
    x: p.width / 2 + rx,
    y: p.height / 2 + ry,
    cosC,
    scale: p.scale,
  };
}

/**
 * Inverse Stereographic Projection: 2D screen pixel (x, y) -> J2000 (RA deg, Dec deg).
 * Works seamlessly in both Equatorial and Horizontal coordinate systems.
 */
export function unprojectStereographic(
  x: number,
  y: number,
  p: ProjectionParams
): { raDeg: number; decDeg: number } | null {
  const dx = x - p.width / 2;
  const dy = y - p.height / 2;
  const u = p.rotationDeg !== 0 ? dx * p.cosRot + dy * p.sinRot : dx;
  const v = p.rotationDeg !== 0 ? -dx * p.sinRot + dy * p.cosRot : dy;

  if (p.coordSystem === 'horizontal') {
    const dirX = p.flipH ? -1 : 1;
    const dirY = p.flipV ? 1 : -1;

    const px = u / (p.scale * dirX);
    const py = v / (p.scale * dirY);
    const rho = Math.hypot(px, py);

    if (rho === 0) {
      return { raDeg: ((p.ra0Deg % 360) + 360) % 360, decDeg: p.dec0Deg };
    }

    const c = 2 * Math.atan(rho / 2);
    if (c > Math.PI * 0.85) return null;

    const sinC = Math.sin(c);
    const cosC = Math.cos(c);
    const alt0 = p.alt0Deg * DEG2RAD;
    const az0 = p.az0Deg * DEG2RAD;
    const sinAlt0 = Math.sin(alt0);
    const cosAlt0 = Math.cos(alt0);

    const sinAlt = cosC * sinAlt0 + (py * sinC * cosAlt0) / rho;
    const altDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD2DEG;
    const azRad =
      az0 + Math.atan2(px * sinC, rho * cosAlt0 * cosC - py * sinAlt0 * sinC);
    const azDeg = ((azRad * RAD2DEG) % 360 + 360) % 360;

    return horizontalToEquatorial(altDeg, azDeg, p.lstDeg, p.latDeg);
  }

  const dirX = p.flipH ? 1 : -1;
  const dirY = p.flipV ? 1 : -1;

  const px = u / (p.scale * dirX);
  const py = v / (p.scale * dirY);

  const rho = Math.hypot(px, py);
  if (rho === 0) {
    return { raDeg: ((p.ra0Deg % 360) + 360) % 360, decDeg: p.dec0Deg };
  }

  const c = 2 * Math.atan(rho / 2);
  if (c > Math.PI * 0.85) return null;

  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const a0 = p.ra0Deg * DEG2RAD;
  const d0 = p.dec0Deg * DEG2RAD;
  const sinD0 = Math.sin(d0);
  const cosD0 = Math.cos(d0);

  const sinD = cosC * sinD0 + (py * sinC * cosD0) / rho;
  const d = Math.asin(Math.max(-1, Math.min(1, sinD)));

  const a =
    a0 + Math.atan2(px * sinC, rho * cosD0 * cosC - py * sinD0 * sinC);

  return {
    raDeg: ((a * RAD2DEG) % 360 + 360) % 360,
    decDeg: d * RAD2DEG,
  };
}

/**
 * Exact horizontal FOV (degrees) matching our stereographic scale for Aladin Lite v3 alignment.
 */
export function getHorizontalFovDeg(fovMinDimDeg: number, width: number, height: number): number {
  const minDim = Math.min(width, height);
  if (minDim <= 0) return fovMinDimDeg;
  const halfRad = (fovMinDimDeg / 2) * DEG2RAD;
  const tanQuarterH = (width / minDim) * Math.tan(halfRad / 2);
  return Math.min(179.5, 4 * Math.atan(tanQuarterH) * RAD2DEG);
}

export function getPixelsPerDeg(fovDeg: number, width: number, height: number): number {
  const viewRadiusRad = (fovDeg / 2) * DEG2RAD;
  const scale = (Math.min(width, height) / 2) / (2 * Math.tan(viewRadiusRad / 2));
  // Exact stereographic differential scale at center: d(2*scale*tan(c/2))/dc |_{c=0} = scale (px/rad)
  return scale * DEG2RAD;
}

/**
 * Pogson's Ratio logarithmic/exponential star radius formula coupled to FOV & limiting magnitude.
 * Keeps faint 12-15m stars crisp pinpoints while giving bright stars proportional visual weight
 * without clumping open clusters like M45 or Double Cluster.
 */
export function getStarRadiusPogson(
  mag: number,
  magLimit: number,
  fszDeg: number
): number {
  const dm = Math.max(0, magLimit - mag);
  // Smoothly compress faint pinpoint floor & growth exponent when displaying 14–20m deep fields
  const deepFactor = Math.max(0, Math.min(1, (magLimit - 14.0) / 6.0));
  const fovScale =
    fszDeg <= 0.5
      ? 1.12 - 0.12 * deepFactor
      : fszDeg <= 2.5
      ? 1.18 - 0.1 * deepFactor
      : fszDeg <= 10
      ? 1.08
      : fszDeg <= 40
      ? 0.98
      : fszDeg <= 100
      ? 0.9
      : 0.82;
  const baseFloor = 0.82 - 0.18 * deepFactor;
  const slope = 0.54 - 0.08 * deepFactor;
  const exp = 0.235 - 0.047 * deepFactor;
  const minFloor = 0.76 - 0.16 * deepFactor; // crisp 0.60-0.76px pinpoints even at 20m deep zoom
  const base = baseFloor + slope * (Math.pow(2.5118864, dm * exp) - 1);
  const maxR = fszDeg <= 12 ? 7.6 : fszDeg <= 60 ? 6.2 : 5.2;
  return Math.max(minFloor, Math.min(maxR, base * fovScale));
}

/**
 * Angular separation between two J2000 points in degrees.
 */
export function angularDistanceDeg(
  ra1Deg: number,
  dec1Deg: number,
  ra2Deg: number,
  dec2Deg: number
): number {
  const a1 = ra1Deg * DEG2RAD;
  const d1 = dec1Deg * DEG2RAD;
  const a2 = ra2Deg * DEG2RAD;
  const d2 = dec2Deg * DEG2RAD;
  const dA = a2 - a1;
  const sinD1 = Math.sin(d1);
  const cosD1 = Math.cos(d1);
  const sinD2 = Math.sin(d2);
  const cosD2 = Math.cos(d2);
  const sinDA = Math.sin(dA);
  const cosDA = Math.cos(dA);
  const y = Math.hypot(
    cosD2 * sinDA,
    cosD1 * sinD2 - sinD1 * cosD2 * cosDA
  );
  const x = sinD1 * sinD2 + cosD1 * cosD2 * cosDA;
  return Math.atan2(y, x) * RAD2DEG;
}

/**
 * Format angular separation (degrees >= 0) as "0°0'0"" (D°M'S").
 */
export function formatAngularDistanceDMS(deg: number): string {
  const safeDeg = Number.isFinite(deg) ? Math.max(0, deg) : 0;
  const totalArcsec = Math.round(safeDeg * 3600);
  const d = Math.floor(totalArcsec / 3600);
  const rem = totalArcsec % 3600;
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  return `${d}°${m}'${s}"`;
}

/**
 * Position angle from point 1 to point 2 in degrees (0 = North, 90 = East).
 */
export function positionAngleDeg(
  ra1Deg: number,
  dec1Deg: number,
  ra2Deg: number,
  dec2Deg: number
): number {
  const a1 = ra1Deg * DEG2RAD;
  const d1 = dec1Deg * DEG2RAD;
  const a2 = ra2Deg * DEG2RAD;
  const d2 = dec2Deg * DEG2RAD;
  const y = Math.sin(a2 - a1) * Math.cos(d2);
  const x =
    Math.cos(d1) * Math.sin(d2) -
    Math.sin(d1) * Math.cos(d2) * Math.cos(a2 - a1);
  return ((Math.atan2(y, x) * RAD2DEG) + 360) % 360;
}

/**
 * Format RA (degrees 0..360) -> "05h 35m 17.3s"
 */
export function formatRA(raDeg: number): string {
  const norm = ((raDeg % 360) + 360) % 360;
  const totalHours = norm / 15;
  const h = Math.floor(totalHours);
  const mFloat = (totalHours - h) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${s.toFixed(1).padStart(4, '0')}s`;
}

/**
 * Format Dec (degrees -90..90) -> "-05° 23' 28""
 */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? '-' : '+';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  const finalM = s === 60 ? m + 1 : m;
  const finalS = s === 60 ? 0 : s;
  return `${sign}${String(d).padStart(2, '0')}° ${String(finalM).padStart(2, '0')}' ${String(finalS).padStart(2, '0')}"`;
}

/**
 * Greenwich Mean Sidereal Time (GMST) in degrees for given epoch ms.
 */
export function getGMSTDeg(timestampMs: number): number {
  const jd = timestampMs / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const gmst = 280.46061837 + 360.98564736629 * d;
  return ((gmst % 360) + 360) % 360;
}

/**
 * Local Sidereal Time (LST) in degrees.
 */
export function getLSTDeg(timestampMs: number, lonDeg: number): number {
  return (((getGMSTDeg(timestampMs) + lonDeg) % 360) + 360) % 360;
}

/**
 * Equatorial (RA, Dec) -> Horizontal (Altitude, Azimuth) in degrees.
 * Azimuth: 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function equatorialToHorizontal(
  raDeg: number,
  decDeg: number,
  lstDeg: number,
  latDeg: number
): { altDeg: number; azDeg: number } {
  const haRad = (lstDeg - raDeg) * DEG2RAD;
  const decRad = decDeg * DEG2RAD;
  const latRad = latDeg * DEG2RAD;

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const y = -Math.sin(haRad) * Math.cos(decRad);
  const x =
    Math.sin(decRad) * Math.cos(latRad) -
    Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad);
  const azDeg = ((Math.atan2(y, x) * RAD2DEG) + 360) % 360;

  return {
    altDeg: altRad * RAD2DEG,
    azDeg,
  };
}

/**
 * Horizontal (Alt, Az) -> Equatorial (RA, Dec) in degrees.
 */
export function horizontalToEquatorial(
  altDeg: number,
  azDeg: number,
  lstDeg: number,
  latDeg: number
): { raDeg: number; decDeg: number } {
  const altRad = altDeg * DEG2RAD;
  const azRad = azDeg * DEG2RAD;
  const latRad = latDeg * DEG2RAD;

  const sinDec =
    Math.sin(altRad) * Math.sin(latRad) +
    Math.cos(altRad) * Math.cos(latRad) * Math.cos(azRad);
  const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  const y = -Math.sin(azRad) * Math.cos(altRad);
  const x =
    Math.sin(altRad) * Math.cos(latRad) -
    Math.cos(altRad) * Math.sin(latRad) * Math.cos(azRad);
  const haDeg = Math.atan2(y, x) * RAD2DEG;

  return {
    raDeg: (((lstDeg - haDeg) % 360) + 360) % 360,
    decDeg: decRad * RAD2DEG,
  };
}

/**
 * Compute the clockwise screen-space angle (0..360°) of a ground/horizon-referenced
 * photographic sensor frame (0° = local horizon level / Zenith up).
 * In Horizontal mode the frame stays level with the ground while the sky rotates;
 * in Equatorial mode the frame rotates smoothly over time with the parallactic angle.
 */
export function getHorizonSensorScreenAngleDeg(
  proj: ProjectionParams,
  sensorRotationDeg = 0
): { screenDeg: number; zenithScreenDeg: number } {
  const cx = proj.width / 2;
  const cy = proj.height / 2;
  const deltaAlt = proj.alt0Deg > 89.5 ? -0.1 : 0.1;
  const eqZenith = horizontalToEquatorial(
    proj.alt0Deg + deltaAlt,
    proj.az0Deg,
    proj.lstDeg,
    proj.latDeg
  );
  const pZenith = projectStereographicRaw(eqZenith.raDeg, eqZenith.decDeg, proj);
  let zenithScreenDeg = proj.flipV ? 180 : 0;
  if (pZenith) {
    const sign = deltaAlt > 0 ? 1 : -1;
    const dxZ = (pZenith.x - cx) * sign;
    const dyZ = (pZenith.y - cy) * sign;
    if (Math.hypot(dxZ, dyZ) > 1e-6) {
      zenithScreenDeg = Math.atan2(dxZ, -dyZ) * RAD2DEG;
    }
  }
  const normUserRot = ((sensorRotationDeg % 360) + 360) % 360;
  const handedness = proj.flipH !== proj.flipV ? -1 : 1;
  const screenDeg = (((zenithScreenDeg + handedness * normUserRot) % 360) + 360) % 360;
  return {
    screenDeg,
    zenithScreenDeg: ((zenithScreenDeg % 360) + 360) % 360,
  };
}

export interface AltitudePoint {
  offsetHours: number;
  label: string;
  altDeg: number;
}

export interface AltitudeCrossing {
  offsetHours: number;
  timestampMs: number;
  label: string;
}

export type SkyLightPhase = 'day' | 'twilight' | 'night';

export interface SkyPhaseSegment {
  phase: SkyLightPhase;
  startOffsetHours: number;
  endOffsetHours: number;
  startLabel: string;
  endLabel: string;
}

export interface AltitudeProfile24h {
  points: AltitudePoint[];
  rises: AltitudeCrossing[];
  sets: AltitudeCrossing[];
  primaryRise: AltitudeCrossing | null;
  primarySet: AltitudeCrossing | null;
  maxAlt: AltitudePoint;
  minAltDeg: number;
  isCircumpolar: boolean;
  isNeverRises: boolean;
  skySegments: SkyPhaseSegment[];
}

function formatLocalHHMM(timestampMs: number): string {
  const d = new Date(timestampMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Fast geocentric apparent equatorial coordinates (degrees) of the Sun for a given UTC timestamp.
 */
export function getSunEquatorialDeg(timestampMs: number): { raDeg: number; decDeg: number } {
  const jd = timestampMs / 86400000 + 2440587.5;
  const d = jd - 2451543.5;
  const ecl = (23.4393 - 3.563e-7 * d) * DEG2RAD;
  const w = (((282.9404 + 4.70935e-5 * d) % 360) + 360) % 360;
  const e = 0.016709 - 1.151e-9 * d;
  const M = (((356.047 + 0.9856002585 * d) % 360) + 360) % 360;
  const mRad = M * DEG2RAD;
  const E = mRad + e * Math.sin(mRad) * (1 + e * Math.cos(mRad));
  const xv = Math.cos(E) - e;
  const yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv) * RAD2DEG;
  const lon = ((((v + w) % 360) + 360) % 360) * DEG2RAD;
  const xe = Math.cos(lon);
  const ye = Math.sin(lon) * Math.cos(ecl);
  const ze = Math.sin(lon) * Math.sin(ecl);
  return {
    raDeg: (((Math.atan2(ye, xe) * RAD2DEG) % 360) + 360) % 360,
    decDeg: Math.atan2(ze, Math.hypot(xe, ye)) * RAD2DEG,
  };
}

function classifySolarPhase(sunAltDeg: number): SkyLightPhase {
  if (sunAltDeg >= -0.833) return 'day';
  if (sunAltDeg >= -18) return 'twilight';
  return 'night';
}

/**
 * Compute 24-hour altitude curve centered around the selected observation time (-12h to +12h).
 */
export function getAltitudeCurve(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  baseTimestampMs: number
): AltitudePoint[] {
  const pts: AltitudePoint[] = [];
  for (let h = -12; h <= 12; h += 1) {
    const t = baseTimestampMs + h * 3600 * 1000;
    const lst = getLSTDeg(t, lonDeg);
    const { altDeg } = equatorialToHorizontal(raDeg, decDeg, lst, latDeg);
    const d = new Date(t);
    const hh = String(d.getHours()).padStart(2, '0');
    pts.push({ offsetHours: h, label: `${hh}:00`, altDeg });
  }
  return pts;
}

/**
 * Compute high-resolution 24-hour altitude profile (-12h to +12h) including
 * exact rise/set crossings (0° horizon) and solar day/twilight/night bands.
 */
export function getAltitudeProfile24h(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  baseTimestampMs: number
): AltitudeProfile24h {
  const steps = 96; // 15-minute resolution across 24h
  const points: AltitudePoint[] = [];
  const altAtMs = (tMs: number): number => {
    const lst = getLSTDeg(tMs, lonDeg);
    return equatorialToHorizontal(raDeg, decDeg, lst, latDeg).altDeg;
  };
  const sunAltAtMs = (tMs: number): number => {
    const sun = getSunEquatorialDeg(tMs);
    const lst = getLSTDeg(tMs, lonDeg);
    return equatorialToHorizontal(sun.raDeg, sun.decDeg, lst, latDeg).altDeg;
  };

  let maxAlt: AltitudePoint = { offsetHours: 0, label: '--:--', altDeg: -90 };
  let minAltDeg = 90;

  for (let i = 0; i <= steps; i++) {
    const offsetHours = -12 + (24 * i) / steps;
    const tMs = baseTimestampMs + offsetHours * 3600 * 1000;
    const altDeg = altAtMs(tMs);
    const pt: AltitudePoint = {
      offsetHours,
      label: formatLocalHHMM(tMs),
      altDeg,
    };
    points.push(pt);
    if (altDeg > maxAlt.altDeg) maxAlt = pt;
    if (altDeg < minAltDeg) minAltDeg = altDeg;
  }

  // Refine rise & set crossings at 0° horizon via bisection
  const rises: AltitudeCrossing[] = [];
  const sets: AltitudeCrossing[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const isRise = p0.altDeg < 0 && p1.altDeg >= 0;
    const isSet = p0.altDeg >= 0 && p1.altDeg < 0;
    if (!isRise && !isSet) continue;

    let lo = baseTimestampMs + p0.offsetHours * 3600 * 1000;
    let hi = baseTimestampMs + p1.offsetHours * 3600 * 1000;
    for (let iter = 0; iter < 10; iter++) {
      const mid = (lo + hi) * 0.5;
      const midAlt = altAtMs(mid);
      if (isRise) {
        if (midAlt < 0) lo = mid;
        else hi = mid;
      } else {
        if (midAlt >= 0) lo = mid;
        else hi = mid;
      }
    }
    const crossMs = (lo + hi) * 0.5;
    const crossOffset = (crossMs - baseTimestampMs) / (3600 * 1000);
    const crossing: AltitudeCrossing = {
      offsetHours: crossOffset,
      timestampMs: crossMs,
      label: formatLocalHHMM(crossMs),
    };
    if (isRise) rises.push(crossing);
    else sets.push(crossing);
  }

  const pickClosestToNow = (arr: AltitudeCrossing[]): AltitudeCrossing | null => {
    if (arr.length === 0) return null;
    return arr.reduce((best, cur) =>
      Math.abs(cur.offsetHours) < Math.abs(best.offsetHours) ? cur : best
    );
  };

  // Compute solar day / twilight / night segments at 5-minute resolution (288 slices)
  const phaseSlices = 288;
  const rawSegments: SkyPhaseSegment[] = [];
  let curPhase: SkyLightPhase | null = null;
  let segStartOffset = -12;

  const refinePhaseBoundary = (
    t0: number,
    t1: number,
    phase0: SkyLightPhase
  ): number => {
    let lo = t0;
    let hi = t1;
    for (let iter = 0; iter < 8; iter++) {
      const mid = (lo + hi) * 0.5;
      if (classifySolarPhase(sunAltAtMs(mid)) === phase0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) * 0.5;
  };

  let prevMs = baseTimestampMs - 12 * 3600 * 1000;
  curPhase = classifySolarPhase(sunAltAtMs(prevMs));

  for (let i = 1; i <= phaseSlices; i++) {
    const offsetH = -12 + (24 * i) / phaseSlices;
    const tMs = baseTimestampMs + offsetH * 3600 * 1000;
    const nextPhase = classifySolarPhase(sunAltAtMs(tMs));
    if (nextPhase !== curPhase) {
      const boundMs = refinePhaseBoundary(prevMs, tMs, curPhase);
      const boundOffset = (boundMs - baseTimestampMs) / (3600 * 1000);
      rawSegments.push({
        phase: curPhase,
        startOffsetHours: segStartOffset,
        endOffsetHours: boundOffset,
        startLabel: formatLocalHHMM(baseTimestampMs + segStartOffset * 3600 * 1000),
        endLabel: formatLocalHHMM(boundMs),
      });
      segStartOffset = boundOffset;
      curPhase = nextPhase;
    }
    prevMs = tMs;
  }

  rawSegments.push({
    phase: curPhase,
    startOffsetHours: segStartOffset,
    endOffsetHours: 12,
    startLabel: formatLocalHHMM(baseTimestampMs + segStartOffset * 3600 * 1000),
    endLabel: formatLocalHHMM(baseTimestampMs + 12 * 3600 * 1000),
  });

  return {
    points,
    rises,
    sets,
    primaryRise: pickClosestToNow(rises),
    primarySet: pickClosestToNow(sets),
    maxAlt,
    minAltDeg,
    isCircumpolar: minAltDeg >= 0,
    isNeverRises: maxAlt.altDeg < 0,
    skySegments: rawSegments,
  };
}

/**
 * Convert B-V color index to realistic star color depending on theme mode.
 * Uses independent curated color palettes for Dark / White Print / Red Night.
 */
export function bvToStarColor(
  bv: number,
  theme: ThemeMode,
  useSpectralColors: boolean
): string {
  if (theme === 'white') {
    if (!useSpectralColors) return '#0F172A';
    // Subtle print-friendly ink tints while maintaining high white-paper contrast
    if (bv < 0.0) return '#1E3A8A';
    if (bv < 0.6) return '#0F172A';
    if (bv < 1.2) return '#451A03';
    return '#7C2D12';
  }
  if (theme === 'red') {
    // Pure red-spectrum brightness gradation for scotopic dark adaptation
    if (bv < 0.2) return '#FCA5A5';
    if (bv < 0.9) return '#EF4444';
    return '#DC2626';
  }
  if (!useSpectralColors) {
    return '#F8FAFC';
  }

  // O/B blue-white -> A white -> F/G pale yellow -> K orange -> M warm red
  if (bv < -0.1) return '#9BB8FF';
  if (bv < 0.15) return '#CAD8FF';
  if (bv < 0.45) return '#F4F7FF';
  if (bv < 0.75) return '#FFF4D8';
  if (bv < 1.15) return '#FFD6A1';
  if (bv < 1.55) return '#FFB37B';
  return '#FF8E6B';
}

/**
 * Compute dynamic Level-of-Detail (LoD) limiting magnitude from Field Size (fsz).
 * Baseline is 6.0m at 60° FOV (offset = 0), scaling smoothly down to 20.0m at 0.008° FOV.
 */
export function getLimitingMagnitude(fszDeg: number, magOffset: number): number {
  const base = 6.0 - 3.65 * Math.log10(Math.max(0.008, fszDeg) / 60);
  return Math.max(3.0, Math.min(20.0, base + magOffset));
}

/**
 * Compute dynamic DSO limiting magnitude independently from the star offset.
 * Baseline is 10.0m at 60° FOV (offset = 0), scaling deeper as FOV narrows.
 */
export function getDsoLimitingMagnitude(fszDeg: number, dsoMagOffset: number): number {
  const base = 10.0 - 3.65 * Math.log10(Math.max(0.05, fszDeg) / 60);
  return Math.max(4.0, Math.min(19.0, base + dsoMagOffset));
}

export function getDsoTypeLabel(type: DsoType): string {
  switch (type) {
    case 'GX':
      return '은하 (Galaxy)';
    case 'OC':
      return '산개성단 (Open Cluster)';
    case 'GC':
      return '구상성단 (Globular Cluster)';
    case 'DN':
      return '발광/반사 성운 (Nebula)';
    case 'DARK':
      return '암흑성운 (Dark Nebula)';
    case 'PN':
      return '행성상 성운 (Planetary Nebula)';
    case 'SNR':
      return '초신성 잔해 (SNR)';
    case 'AST':
      return '성협 / 별구름 (Asterism)';
  }
}

const COMPASS_16_EN = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

const COMPASS_16_KO = [
  '북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
  '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서',
] as const;

export function getCompassDirection(
  azDeg: number,
  lang: ObjectNameLanguage = 'en'
): string {
  const idx = Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16;
  const en = COMPASS_16_EN[idx];
  const ko = COMPASS_16_KO[idx];
  if (lang === 'ko') return ko;
  if (lang === 'ko_en') return `${ko}(${en})`;
  return en;
}

const CARDINAL_8_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const CARDINAL_8_KO = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'] as const;

export function formatCardinalLabel(
  azDeg: number,
  lang: ObjectNameLanguage = 'ko'
): string {
  const idx = Math.round((((azDeg % 360) + 360) % 360) / 45) % 8;
  const en = CARDINAL_8_EN[idx];
  const ko = CARDINAL_8_KO[idx];
  if (lang === 'en') return en;
  if (lang === 'ko_en') return `${ko} (${en})`;
  return ko;
}

const FALLBACK_DUBHE: Star = {
  id: 'Dubhe',
  hip: 54061,
  ra: 165.932,
  dec: 61.751,
  mag: 1.79,
  bv: 1.07,
  name: 'Dubhe',
  koName: '두베',
  bayer: 'α UMa',
  con: 'UMa',
};

const FALLBACK_NAVI: Star = {
  id: 'Navi',
  hip: 4427,
  ra: 14.1772,
  dec: 60.7167,
  mag: 2.15,
  bv: -0.05,
  name: 'Navi',
  koName: '나비',
  bayer: 'γ Cas',
  con: 'Cas',
};

export function getKoreanCompassDirection(azDeg: number): string {
  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return dirs[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8];
}

interface ConstellationAnchorEntry {
  star: Star;
  conAbbr: string;
  conKoName: string;
  conName: string;
  segments: [number, number, number, number][];
  isPrimaryStyle: boolean;
}

const constellationAnchorCache = new WeakMap<
  Constellation[],
  Map<string, { starsRef: Star[]; entries: ConstellationAnchorEntry[] }>
>();

function getConstellationAnchorStars(
  constellations: Constellation[],
  stars: Star[],
  lineStyle: ConstellationLineStyle = 'traditional'
): ConstellationAnchorEntry[] {
  if (!constellations.length || !stars.length) return [];

  let styleMap = constellationAnchorCache.get(constellations);
  if (!styleMap) {
    styleMap = new Map();
    constellationAnchorCache.set(constellations, styleMap);
  }
  const cacheKey = `${lineStyle}:${stars.length}`;
  const cached = styleMap.get(cacheKey);
  if (cached && cached.starsRef === stars) {
    return cached.entries;
  }

  // Fast spatial bucket lookup for bright stars (by 2° Dec band)
  const decBuckets = new Map<number, Star[]>();
  for (const s of stars) {
    const b = Math.floor((s.dec + 90) / 2);
    let arr = decBuckets.get(b);
    if (!arr) {
      arr = [];
      decBuckets.set(b, arr);
    }
    arr.push(s);
  }

  const findNearestStarForVertex = (raDeg: number, decDeg: number): Star | null => {
    const centerBucket = Math.floor((decDeg + 90) / 2);
    let best: Star | null = null;
    let bestScore = Infinity;
    for (let b = centerBucket - 1; b <= centerBucket + 1; b++) {
      const bucket = decBuckets.get(b);
      if (!bucket) continue;
      for (const s of bucket) {
        if (Math.abs(s.dec - decDeg) > 0.25) continue;
        const d = angularDistanceDeg(s.ra, s.dec, raDeg, decDeg);
        if (d <= 0.18) {
          // Prefer exact coordinate match; tie-break by brightness for close optical doubles
          const score = d * 20 + Math.max(0, s.mag) * 0.15;
          if (score < bestScore) {
            bestScore = score;
            best = s;
          }
        }
      }
    }
    return best;
  };

  // Map by unique star id so each constellation star accumulates all touching segments
  const byStarId = new Map<string, ConstellationAnchorEntry>();

  const registerSegments = (
    c: Constellation,
    segs: [number, number, number, number][],
    isPrimaryStyle: boolean
  ) => {
    // Collect unique endpoints per constellation to avoid redundant lookups
    const vertexSegs = new Map<
      string,
      { ra: number; dec: number; segments: [number, number, number, number][] }
    >();
    const addEnd = (ra: number, dec: number, seg: [number, number, number, number]) => {
      const key = `${Math.round(ra * 100)}_${Math.round(dec * 100)}`;
      let item = vertexSegs.get(key);
      if (!item) {
        item = { ra, dec, segments: [] };
        vertexSegs.set(key, item);
      }
      item.segments.push(seg);
    };

    for (const seg of segs) {
      addEnd(seg[0], seg[1], seg);
      addEnd(seg[2], seg[3], seg);
    }

    for (const v of vertexSegs.values()) {
      const matched = findNearestStarForVertex(v.ra, v.dec);
      if (!matched) continue;
      const existing = byStarId.get(matched.id);
      if (!existing) {
        byStarId.set(matched.id, {
          star: matched,
          conAbbr: c.abbr,
          conKoName: c.koName,
          conName: c.name,
          segments: [...v.segments],
          isPrimaryStyle,
        });
      } else {
        if (isPrimaryStyle && !existing.isPrimaryStyle) {
          existing.isPrimaryStyle = true;
          existing.conAbbr = c.abbr;
          existing.conKoName = c.koName;
          existing.conName = c.name;
          existing.segments = [...v.segments];
        } else if (isPrimaryStyle === existing.isPrimaryStyle && existing.conAbbr === c.abbr) {
          existing.segments.push(...v.segments);
        }
      }
    }
  };

  for (const c of constellations) {
    const primarySegs =
      lineStyle === 'modern'
        ? c.lines
        : c.traditionalLines && c.traditionalLines.length > 0
        ? c.traditionalLines
        : c.lines;
    registerSegments(c, primarySegs, true);

    if (lineStyle !== 'modern' && c.traditionalLines && c.traditionalLines.length > 0) {
      registerSegments(c, c.lines, false);
    }
  }

  const entries = Array.from(byStarId.values());
  styleMap.set(cacheKey, { starsRef: stars, entries });
  return entries;
}

/**
 * Find one or more star-hopping guide paths for a target, prioritizing the nearest
 * fairly bright constellation-forming star so observers can hop directly from a
 * recognizable constellation figure landmark.
 * For Polaris (북극성), provides the two iconic northern-sky pointer routes:
 *   1. Ursa Major Dubhe (큰곰자리 두베, α UMa) -> Polaris
 *   2. Cassiopeia Navi (카시오페아 나비, γ Cas) -> Polaris
 */
export function findStarHopGuides(
  targetRa: number,
  targetDec: number,
  targetLabel: string,
  stars: Star[],
  excludeId?: string,
  targetHip?: number,
  constellations?: Constellation[],
  lineStyle: ConstellationLineStyle = 'traditional'
): StarHopGuide[] {
  const lowerLabel = targetLabel.toLowerCase();
  const isPolaris =
    targetHip === 11767 ||
    excludeId === 'Polaris' ||
    excludeId === 'HIP 11767' ||
    lowerLabel.includes('polaris') ||
    targetLabel.includes('북극성') ||
    targetLabel.includes('폴라리스') ||
    angularDistanceDeg(targetRa, targetDec, 37.9545, 89.2641) < 0.35;

  const anchorEntries =
    constellations && constellations.length > 0
      ? getConstellationAnchorStars(constellations, stars, lineStyle)
      : [];

  if (isPolaris) {
    const dubhe =
      stars.find((s) => s.hip === 54061 || s.id === 'Dubhe' || s.name === 'Dubhe') ??
      FALLBACK_DUBHE;
    const navi =
      stars.find(
        (s) =>
          s.hip === 4427 ||
          s.id === 'Navi' ||
          s.id === 'Gamma Cas' ||
          s.name === 'Navi'
      ) ?? FALLBACK_NAVI;

    const dubheEntry = anchorEntries.find((e) => e.star.id === dubhe.id);
    const naviEntry = anchorEntries.find((e) => e.star.id === navi.id);

    const toLabel = '북극성';
    return [
      {
        fromStar: dubhe,
        fromConstellationKo: dubheEntry?.conKoName ?? '큰곰자리',
        fromConstellationName: dubheEntry?.conName ?? 'Ursa Major',
        fromConstellationAbbr: dubheEntry?.conAbbr ?? 'UMa',
        isConstellationStar: true,
        anchorSegments: dubheEntry?.segments,
        toRa: targetRa,
        toDec: targetDec,
        toLabel,
        distanceDeg: angularDistanceDeg(dubhe.ra, dubhe.dec, targetRa, targetDec),
        paDeg: positionAngleDeg(dubhe.ra, dubhe.dec, targetRa, targetDec),
        note: '큰곰자리 두베(α UMa)에서 메라크→두베 연장선 5배 방향',
      },
      {
        fromStar: navi,
        fromConstellationKo: naviEntry?.conKoName ?? '카시오페이아자리',
        fromConstellationName: naviEntry?.conName ?? 'Cassiopeia',
        fromConstellationAbbr: naviEntry?.conAbbr ?? 'Cas',
        isConstellationStar: true,
        anchorSegments: naviEntry?.segments,
        toRa: targetRa,
        toDec: targetDec,
        toLabel,
        distanceDeg: angularDistanceDeg(navi.ra, navi.dec, targetRa, targetDec),
        paDeg: positionAngleDeg(navi.ra, navi.dec, targetRa, targetDec),
        note: '카시오페아 나비(γ Cas · W자 중심)에서 북극성 연장선',
      },
    ];
  }

  const isSameStar = (s: Star, dist: number): boolean =>
    s.id === excludeId || (targetHip !== undefined && s.hip === targetHip) || dist < 0.08;

  const angleDiffDeg = (a: number, b: number): number => {
    const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
    return d;
  };

  // Index constellation anchor entries and constellation metadata by abbreviation
  const anchorByStarId = new Map<string, ConstellationAnchorEntry>();
  for (const entry of anchorEntries) {
    anchorByStarId.set(entry.star.id, entry);
  }
  const conByAbbr = new Map<string, Constellation>();
  if (constellations) {
    for (const c of constellations) {
      conByAbbr.set(c.abbr.toLowerCase(), c);
    }
  }

  interface HopCandidate {
    star: Star;
    dist: number;
    pa: number;
    score: number;
    anchor?: ConstellationAnchorEntry;
    conKo?: string;
    conName?: string;
    conAbbr?: string;
  }

  const candidates: HopCandidate[] = [];
  const seenIds = new Set<string>();

  const considerStar = (s: Star, anchor?: ConstellationAnchorEntry) => {
    if (seenIds.has(s.id)) return;
    if (s.mag > 5.2) return;
    const dist = angularDistanceDeg(s.ra, s.dec, targetRa, targetDec);
    if (isSameStar(s, dist) || dist > 35) return;
    seenIds.add(s.id);

    // Unified adjacency + brightness score (lower = better landmark):
    // Strongly favors bright naked-eye stars (<= 2.5m) close to the target,
    // gives constellation-forming stars & named stars a helpful recognition bonus,
    // without ever hiding a much brighter adjacent star.
    const brightPenalty =
      s.mag <= 2.5
        ? (s.mag + 1.5) * 0.55
        : s.mag <= 3.8
        ? (2.5 + 1.5) * 0.55 + (s.mag - 2.5) * 1.15
        : (2.5 + 1.5) * 0.55 + (3.8 - 2.5) * 1.15 + (s.mag - 3.8) * 2.25;
    const conBonus = anchor
      ? (anchor.isPrimaryStyle ? -0.75 : -0.3) + (anchor.segments.length >= 2 ? -0.25 : 0)
      : 0;
    const namedBonus = s.koName || s.name ? -0.35 : s.bayer ? -0.15 : 0;
    const score = dist + brightPenalty + conBonus + namedBonus;

    const fallbackCon = s.con ? conByAbbr.get(s.con.toLowerCase()) : undefined;
    candidates.push({
      star: s,
      dist,
      pa: positionAngleDeg(s.ra, s.dec, targetRa, targetDec),
      score,
      anchor,
      conKo: anchor?.conKoName ?? fallbackCon?.koName,
      conName: anchor?.conName ?? fallbackCon?.name,
      conAbbr: anchor?.conAbbr ?? fallbackCon?.abbr ?? s.con,
    });
  };

  for (const entry of anchorEntries) {
    considerStar(entry.star, entry);
  }
  for (const s of stars) {
    if (s.mag > 4.6) continue;
    considerStar(s, anchorByStarId.get(s.id));
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => a.score - b.score || a.star.mag - b.star.mag || a.dist - b.dist);

  const chosen: HopCandidate[] = [candidates[0]];
  const primary = candidates[0];
  const MAX_GUIDES = 3;

  const isWellSeparated = (cand: HopCandidate, minAngleDeg: number): boolean => {
    for (const c of chosen) {
      if (angleDiffDeg(cand.pa, c.pa) < minAngleDeg) return false;
      if (angularDistanceDeg(cand.star.ra, cand.star.dec, c.star.ra, c.star.dec) < 1.4) {
        return false;
      }
    }
    return true;
  };

  // If the primary anchor is somewhat dim (> 2.2m), guarantee we also pull in the brightest nearby
  // landmark star within 18° (if distinctly brighter and in a different direction) for easy visual acquisition.
  if (primary.star.mag > 2.2) {
    let brightestBeacon: HopCandidate | null = null;
    for (const cand of candidates) {
      if (cand === primary) continue;
      if (cand.star.mag > Math.min(3.0, primary.star.mag - 0.8)) continue;
      if (cand.dist > 18) continue;
      if (!isWellSeparated(cand, 26)) continue;
      if (
        !brightestBeacon ||
        cand.star.mag < brightestBeacon.star.mag - 0.25 ||
        (Math.abs(cand.star.mag - brightestBeacon.star.mag) <= 0.25 && cand.dist < brightestBeacon.dist)
      ) {
        brightestBeacon = cand;
      }
    }
    if (brightestBeacon) {
      chosen.push(brightestBeacon);
    }
  }

  // Fill remaining slots (up to 3 total) with the best-scoring bright adjacent stars from distinct directions
  const maxSecondaryDist = Math.min(28, Math.max(12, primary.dist * 2.2 + 4));
  const maxSecondaryMag = Math.min(4.3, Math.max(3.6, primary.star.mag + 1.1));
  const maxSecondaryScore = primary.score * 1.85 + 6.5;

  for (const cand of candidates) {
    if (chosen.length >= MAX_GUIDES) break;
    if (chosen.includes(cand)) continue;
    if (cand.dist > maxSecondaryDist) continue;
    if (cand.star.mag > maxSecondaryMag) continue;
    if (cand.score > maxSecondaryScore) continue;
    if (!isWellSeparated(cand, 32)) continue;
    chosen.push(cand);
  }

  // Sort final guides so the #1 primary stays first, followed by secondary guides ordered by score
  const ordered = [chosen[0], ...chosen.slice(1).sort((a, b) => a.score - b.score)];

  return ordered.map((item, idx) => {
    const s = item.star;
    const starLabel = s.koName || s.name || s.bayer || s.id;
    const conPrefix = item.conKo ? `${item.conKo} ` : '';
    const dirKo = getKoreanCompassDirection(item.pa);
    return {
      fromStar: s,
      fromConstellationKo: item.conKo,
      fromConstellationName: item.conName,
      fromConstellationAbbr: item.conAbbr,
      isConstellationStar: Boolean(item.anchor),
      isPrimary: idx === 0,
      anchorSegments: item.anchor?.segments,
      toRa: targetRa,
      toDec: targetDec,
      toLabel: targetLabel,
      distanceDeg: item.dist,
      paDeg: item.pa,
      note: `${conPrefix}${starLabel}(${s.mag.toFixed(1)}m)에서 ${dirKo}쪽(방위 ${item.pa.toFixed(0)}°)으로 ${item.dist.toFixed(1)}° 이동`,
    };
  });
}

/**
 * Find the primary constellation-star guide (or bright naked-eye fallback) within 35° for Star Hopping.
 */
export function findStarHopGuide(
  targetRa: number,
  targetDec: number,
  targetLabel: string,
  stars: Star[],
  excludeId?: string,
  targetHip?: number,
  constellations?: Constellation[],
  lineStyle: ConstellationLineStyle = 'traditional'
): StarHopGuide | null {
  return (
    findStarHopGuides(
      targetRa,
      targetDec,
      targetLabel,
      stars,
      excludeId,
      targetHip,
      constellations,
      lineStyle
    )[0] ?? null
  );
}

/**
 * Parse initial state from URL query parameters (?ra=...&dec=...&fsz=...&mode=...&coord=...&flipH=...&flipV=...)
 */
export function parseUrlState(): {
  view: ChartViewState;
  theme: ThemeMode;
  hasExplicitCoords: boolean;
} {
  const params = new URLSearchParams(window.location.search);

  const rawRa = parseFloat(params.get('ra') ?? '');
  const rawDec = parseFloat(params.get('dec') ?? '');
  const rawFsz = parseFloat(params.get('fsz') ?? '');
  const rawMode = params.get('mode');
  const rawCoord = params.get('coord');
  const flipH = params.get('flipH') === '1';
  const flipV = params.get('flipV') === '1';

  const hasExplicitCoords = Number.isFinite(rawRa) && Number.isFinite(rawDec);
  const ra = Number.isFinite(rawRa) ? ((rawRa % 24) + 24) % 24 : 5.58;
  const dec = Number.isFinite(rawDec) ? Math.max(-90, Math.min(90, rawDec)) : 4.5;
  const fsz = Number.isFinite(rawFsz) ? Math.max(0.008, Math.min(180, rawFsz)) : 95;

  const theme: ThemeMode =
    rawMode === 'white' || rawMode === 'red' || rawMode === 'dark'
      ? rawMode
      : 'dark';

  const coordSystem: CoordSystem = rawCoord === 'eq' ? 'equatorial' : 'horizontal';

  return {
    view: { ra, dec, fsz, flipH, flipV, coordSystem },
    theme,
    hasExplicitCoords,
  };
}

/**
 * Sync current chart view & theme state back into URL via History API replaceState.
 */
export function syncUrlState(view: ChartViewState, theme: ThemeMode): void {
  const params = new URLSearchParams(window.location.search);
  params.set('ra', view.ra.toFixed(6));
  params.set('dec', view.dec.toFixed(6));
  params.set('fsz', view.fsz < 1 ? view.fsz.toFixed(4) : view.fsz.toFixed(2));
  params.set('mode', theme);
  if (view.coordSystem === 'equatorial') params.set('coord', 'eq');
  else params.delete('coord');
  if (view.flipH) params.set('flipH', '1');
  else params.delete('flipH');
  if (view.flipV) params.set('flipV', '1');
  else params.delete('flipV');

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

/**
 * Compute optical airmass X(h) using Rozenberg's (1966) formula,
 * accurate smoothly from zenith (h=90°, X=1.0) all the way to the horizon (h=0°, X=40.0).
 */
export function computeAirmass(altDeg: number): number {
  const h = Math.max(0, Math.min(90, altDeg));
  const sinH = Math.sin(h * DEG2RAD);
  return 1 / (sinH + 0.025 * Math.exp(-11 * sinH));
}

/**
 * Compute visual atmospheric extinction loss Δm (magnitudes, relative to zenith)
 * at altitude `altDeg` for extinction coefficient `coeffK` (mag/airmass, typically 0.15–0.60).
 * Zenith objects (h = 90°) have Δm = 0; low-altitude objects progressively dim toward the horizon.
 */
export function computeAtmosphericExtinctionMag(
  altDeg: number,
  coeffK = 0.25
): number {
  const k = Math.max(0.05, Math.min(1.0, coeffK));
  if (altDeg >= 89.5) return 0;
  if (altDeg <= 0) return k * 39;
  const airmass = computeAirmass(altDeg);
  return Math.max(0, k * (airmass - 1));
}

/**
 * Fast scalar altitude calculation (degrees) given precomputed sin(lat) and cos(lat)
 * for tight per-star rendering loops.
 */
export function computeAltitudeDegFast(
  raDeg: number,
  decDeg: number,
  lstDeg: number,
  sinLat: number,
  cosLat: number
): number {
  const decRad = decDeg * DEG2RAD;
  const haRad = (lstDeg - raDeg) * DEG2RAD;
  const sinAlt =
    sinLat * Math.sin(decRad) + cosLat * Math.cos(decRad) * Math.cos(haRad);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD2DEG;
}

