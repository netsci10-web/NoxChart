import {
  ChartViewState,
  CoordSystem,
  DsoType,
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
  const baseFloor = 0.56 - 0.22 * deepFactor;
  const slope = 0.54 - 0.08 * deepFactor;
  const exp = 0.235 - 0.047 * deepFactor;
  const minFloor = 0.52 - 0.2 * deepFactor; // down to 0.32px crisp pinpoints at 20m
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
  const cosTheta =
    Math.sin(d1) * Math.sin(d2) +
    Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2);
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))) * RAD2DEG;
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

export function getCompassDirection(azDeg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16];
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

/**
 * Find one or more naked-eye star-hopping guide paths for a target.
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
  targetHip?: number
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

    const toLabel = '북극성';
    return [
      {
        fromStar: dubhe,
        toRa: targetRa,
        toDec: targetDec,
        toLabel,
        distanceDeg: angularDistanceDeg(dubhe.ra, dubhe.dec, targetRa, targetDec),
        paDeg: positionAngleDeg(dubhe.ra, dubhe.dec, targetRa, targetDec),
        note: '큰곰자리 두베(α UMa)에서 메라크→두베 연장선 5배 방향',
      },
      {
        fromStar: navi,
        toRa: targetRa,
        toDec: targetDec,
        toLabel,
        distanceDeg: angularDistanceDeg(navi.ra, navi.dec, targetRa, targetDec),
        paDeg: positionAngleDeg(navi.ra, navi.dec, targetRa, targetDec),
        note: '카시오페아 나비(γ Cas · W자 중심)에서 북극성 연장선',
      },
    ];
  }

  let bestStar: Star | null = null;
  let bestScore = Infinity;

  for (const s of stars) {
    if (s.id === excludeId || (targetHip && s.hip === targetHip) || s.mag > 3.8) continue;
    const dist = angularDistanceDeg(s.ra, s.dec, targetRa, targetDec);
    if (dist < 0.15 || dist > 35) continue;
    const score = dist + Math.max(0, s.mag) * 2.2;
    if (score < bestScore) {
      bestScore = score;
      bestStar = s;
    }
  }

  if (!bestStar) return [];
  return [
    {
      fromStar: bestStar,
      toRa: targetRa,
      toDec: targetDec,
      toLabel: targetLabel,
      distanceDeg: angularDistanceDeg(bestStar.ra, bestStar.dec, targetRa, targetDec),
      paDeg: positionAngleDeg(bestStar.ra, bestStar.dec, targetRa, targetDec),
    },
  ];
}

/**
 * Find the primary naked-eye guide star (mag <= 3.8) within 35° for Star Hopping.
 */
export function findStarHopGuide(
  targetRa: number,
  targetDec: number,
  targetLabel: string,
  stars: Star[],
  excludeId?: string,
  targetHip?: number
): StarHopGuide | null {
  return (
    findStarHopGuides(targetRa, targetDec, targetLabel, stars, excludeId, targetHip)[0] ??
    null
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
