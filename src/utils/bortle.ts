import { DsoType } from '../types/astronomy';

export interface BortleClassInfo {
  bortle: number; // 1..9
  label: string;
  shortLabel: string;
  sqm: string; // Typical SQM-L (mag/arcsec^2)
  nelm: number; // Typical naked-eye limiting magnitude
  swatch: string; // Representative light pollution map color
  milkyWayDesc: string;
  milkyWayAlpha: number; // 0..1 visibility multiplier for Milky Way
  skyGlowAlpha: number; // 0..1 overall sky background lift in dark theme
  horizonDomeAlpha: number; // 0..1 extra horizon light dome intensity
}

export const BORTLE_SCALE: readonly BortleClassInfo[] = [
  {
    bortle: 1,
    label: '완벽한 암흑 하늘',
    shortLabel: '완벽 암흑',
    sqm: '21.99–22.00',
    nelm: 7.8,
    swatch: '#1E293B',
    milkyWayDesc: '황도광·은하수 선명',
    milkyWayAlpha: 1.0,
    skyGlowAlpha: 0.0,
    horizonDomeAlpha: 0.0,
  },
  {
    bortle: 2,
    label: '진정한 암흑 관측지',
    shortLabel: '진정 암흑',
    sqm: '21.89–21.99',
    nelm: 7.3,
    swatch: '#334155',
    milkyWayDesc: '은하수 구조 뚜렷함',
    milkyWayAlpha: 0.94,
    skyGlowAlpha: 0.025,
    horizonDomeAlpha: 0.03,
  },
  {
    bortle: 3,
    label: '시골 하늘',
    shortLabel: '시골',
    sqm: '21.69–21.89',
    nelm: 6.8,
    swatch: '#2563EB',
    milkyWayDesc: '은하수 복합 구조 보임',
    milkyWayAlpha: 0.84,
    skyGlowAlpha: 0.06,
    horizonDomeAlpha: 0.08,
  },
  {
    bortle: 4,
    label: '시골·교외 경계',
    shortLabel: '시골·교외',
    sqm: '20.49–21.69',
    nelm: 6.3,
    swatch: '#16A34A',
    milkyWayDesc: '지평선 광해·은하수 보임',
    milkyWayAlpha: 0.66,
    skyGlowAlpha: 0.115,
    horizonDomeAlpha: 0.16,
  },
  {
    bortle: 5,
    label: '교외 하늘',
    shortLabel: '교외',
    sqm: '19.50–20.49',
    nelm: 5.8,
    swatch: '#CA8A04',
    milkyWayDesc: '천정 부근 희미한 은하수',
    milkyWayAlpha: 0.4,
    skyGlowAlpha: 0.19,
    horizonDomeAlpha: 0.25,
  },
  {
    bortle: 6,
    label: '밝은 교외 하늘',
    shortLabel: '밝은 교외',
    sqm: '18.94–19.50',
    nelm: 5.3,
    swatch: '#EA580C',
    milkyWayDesc: '은하수 거의 안 보임',
    milkyWayAlpha: 0.17,
    skyGlowAlpha: 0.28,
    horizonDomeAlpha: 0.35,
  },
  {
    bortle: 7,
    label: '교외·도심 경계',
    shortLabel: '교외·도심',
    sqm: '18.38–18.94',
    nelm: 4.8,
    swatch: '#DC2626',
    milkyWayDesc: '은하수 식별 어려움',
    milkyWayAlpha: 0.05,
    skyGlowAlpha: 0.38,
    horizonDomeAlpha: 0.46,
  },
  {
    bortle: 8,
    label: '도심 하늘',
    shortLabel: '도심',
    sqm: '17.80–18.38',
    nelm: 4.3,
    swatch: '#E11D48',
    milkyWayDesc: '은하수 불가·밝은 별자리',
    milkyWayAlpha: 0.0,
    skyGlowAlpha: 0.49,
    horizonDomeAlpha: 0.56,
  },
  {
    bortle: 9,
    label: '대도시 중심부',
    shortLabel: '대도시',
    sqm: '< 17.80',
    nelm: 3.8,
    swatch: '#F8FAFC',
    milkyWayDesc: '은하수 불가·1~3등성 위주',
    milkyWayAlpha: 0.0,
    skyGlowAlpha: 0.62,
    horizonDomeAlpha: 0.66,
  },
] as const;

export function clampBortleClass(val: number): number {
  if (!Number.isFinite(val)) return 4;
  return Math.max(1, Math.min(9, Math.round(val)));
}

export function getBortleInfo(bortleClass: number): BortleClassInfo {
  const idx = clampBortleClass(bortleClass) - 1;
  return BORTLE_SCALE[idx];
}

interface KnownSiteBortle {
  keywords: string[];
  lat: number;
  lon: number;
  radiusKm: number;
  bortle: number;
}

const KNOWN_SITES: readonly KnownSiteBortle[] = [
  { keywords: ['마우나케아', 'mauna kea'], lat: 19.8207, lon: -155.4681, radiusKm: 25, bortle: 1 },
  { keywords: ['아타카마', 'atacama', 'paranal'], lat: -24.6272, lon: -70.4042, radiusKm: 80, bortle: 1 },
  { keywords: ['반딧불이', '영양'], lat: 36.817, lon: 129.218, radiusKm: 16, bortle: 3 },
  { keywords: ['보현산'], lat: 36.1647, lon: 128.9767, radiusKm: 12, bortle: 4 },
  { keywords: ['소백산'], lat: 36.9342, lon: 128.4575, radiusKm: 14, bortle: 4 },
  { keywords: ['조경철', '광덕산'], lat: 38.1211, lon: 127.4342, radiusKm: 10, bortle: 4 },
  { keywords: ['안반데기', '육백마지기', '함백산', '태백산'], lat: 37.624, lon: 128.738, radiusKm: 16, bortle: 4 },
  { keywords: ['황매산'], lat: 35.4835, lon: 127.9718, radiusKm: 10, bortle: 4 },
  { keywords: ['한우산', '팔각정'], lat: 35.3947, lon: 128.1928, radiusKm: 10, bortle: 5 },
  { keywords: ['미리내'], lat: 37.547, lon: 127.621, radiusKm: 8, bortle: 6 },
  { keywords: ['별빛누리공원'], lat: 33.4439, lon: 126.5486, radiusKm: 8, bortle: 7 },
  { keywords: ['1100고지', '한라산'], lat: 33.358, lon: 126.463, radiusKm: 10, bortle: 5 },
  { keywords: ['서울', 'seoul'], lat: 37.5665, lon: 126.978, radiusKm: 14, bortle: 9 },
];

interface UrbanLightHub {
  lat: number;
  lon: number;
  coreBoost: number; // Added Bortle points at city center
  radiusKm: number; // Characteristic exponential decay distance (km)
}

const URBAN_HUBS: readonly UrbanLightHub[] = [
  // South Korea major metropolitan & urban/industrial light domes
  { lat: 37.5665, lon: 126.978, coreBoost: 6.4, radiusKm: 44 }, // Seoul
  { lat: 37.4563, lon: 126.7052, coreBoost: 5.6, radiusKm: 28 }, // Incheon
  { lat: 37.5034, lon: 126.766, coreBoost: 5.0, radiusKm: 18 }, // Bucheon / Gwangmyeong
  { lat: 37.2636, lon: 127.0286, coreBoost: 5.4, radiusKm: 26 }, // Suwon / Yongin
  { lat: 37.4201, lon: 127.1262, coreBoost: 5.2, radiusKm: 22 }, // Seongnam / Bundang
  { lat: 37.3219, lon: 126.8309, coreBoost: 5.0, radiusKm: 20 }, // Ansan / Siheung
  { lat: 37.1995, lon: 126.8312, coreBoost: 4.8, radiusKm: 22 }, // Hwaseong / Osan
  { lat: 36.9921, lon: 127.1129, coreBoost: 4.7, radiusKm: 20 }, // Pyeongtaek
  { lat: 37.6584, lon: 126.832, coreBoost: 4.9, radiusKm: 20 }, // Goyang
  { lat: 37.7381, lon: 127.0337, coreBoost: 4.6, radiusKm: 18 }, // Uijeongbu / Yangju
  { lat: 37.636, lon: 127.2165, coreBoost: 4.6, radiusKm: 18 }, // Namyangju / Guri
  { lat: 37.7599, lon: 126.78, coreBoost: 4.4, radiusKm: 17 }, // Paju / Gimpo
  { lat: 37.272, lon: 127.435, coreBoost: 4.1, radiusKm: 15 }, // Icheon
  { lat: 35.1796, lon: 129.0756, coreBoost: 6.1, radiusKm: 34 }, // Busan
  { lat: 35.8714, lon: 128.6014, coreBoost: 5.7, radiusKm: 30 }, // Daegu
  { lat: 35.8251, lon: 128.7415, coreBoost: 4.5, radiusKm: 16 }, // Gyeongsan
  { lat: 36.3504, lon: 127.3845, coreBoost: 5.3, radiusKm: 26 }, // Daejeon
  { lat: 36.48, lon: 127.289, coreBoost: 4.4, radiusKm: 16 }, // Sejong
  { lat: 35.1595, lon: 126.8526, coreBoost: 5.2, radiusKm: 25 }, // Gwangju
  { lat: 35.5384, lon: 129.3114, coreBoost: 5.1, radiusKm: 24 }, // Ulsan
  { lat: 35.2279, lon: 128.6811, coreBoost: 4.9, radiusKm: 21 }, // Changwon
  { lat: 35.2285, lon: 128.8894, coreBoost: 4.5, radiusKm: 17 }, // Gimhae
  { lat: 35.335, lon: 129.0372, coreBoost: 4.3, radiusKm: 15 }, // Yangsan
  { lat: 34.8806, lon: 128.6211, coreBoost: 4.0, radiusKm: 14 }, // Geoje
  { lat: 36.6424, lon: 127.489, coreBoost: 4.7, radiusKm: 19 }, // Cheongju
  { lat: 36.8151, lon: 127.1139, coreBoost: 4.7, radiusKm: 19 }, // Cheonan
  { lat: 36.7898, lon: 127.0019, coreBoost: 4.4, radiusKm: 16 }, // Asan
  { lat: 36.991, lon: 127.9259, coreBoost: 3.9, radiusKm: 14 }, // Chungju
  { lat: 35.8242, lon: 127.148, coreBoost: 4.6, radiusKm: 19 }, // Jeonju
  { lat: 35.9483, lon: 126.9576, coreBoost: 4.2, radiusKm: 15 }, // Iksan
  { lat: 35.9677, lon: 126.7366, coreBoost: 4.2, radiusKm: 15 }, // Gunsan
  { lat: 36.019, lon: 129.3435, coreBoost: 4.5, radiusKm: 18 }, // Pohang
  { lat: 35.8562, lon: 129.2247, coreBoost: 4.1, radiusKm: 15 }, // Gyeongju
  { lat: 36.1195, lon: 128.3446, coreBoost: 4.4, radiusKm: 17 }, // Gumi
  { lat: 36.5684, lon: 128.7294, coreBoost: 3.8, radiusKm: 14 }, // Andong
  { lat: 35.18, lon: 128.1076, coreBoost: 4.1, radiusKm: 16 }, // Jinju
  { lat: 37.8813, lon: 127.7298, coreBoost: 4.0, radiusKm: 15 }, // Chuncheon
  { lat: 37.3422, lon: 127.9202, coreBoost: 4.1, radiusKm: 16 }, // Wonju
  { lat: 37.7519, lon: 128.8761, coreBoost: 3.8, radiusKm: 14 }, // Gangneung
  { lat: 38.207, lon: 128.5918, coreBoost: 3.6, radiusKm: 13 }, // Sokcho
  { lat: 33.4996, lon: 126.5312, coreBoost: 4.6, radiusKm: 16 }, // Jeju City
  { lat: 33.2541, lon: 126.5601, coreBoost: 3.7, radiusKm: 12 }, // Seogwipo
  { lat: 34.8118, lon: 126.3922, coreBoost: 3.9, radiusKm: 15 }, // Mokpo
  { lat: 34.7604, lon: 127.6622, coreBoost: 4.2, radiusKm: 16 }, // Yeosu / Suncheon / Gwangyang
  // Global mega-cities
  { lat: 35.6762, lon: 139.6503, coreBoost: 6.8, radiusKm: 55 }, // Tokyo
  { lat: 34.6937, lon: 135.5023, coreBoost: 6.2, radiusKm: 40 }, // Osaka
  { lat: 39.9042, lon: 116.4074, coreBoost: 6.6, radiusKm: 55 }, // Beijing
  { lat: 31.2304, lon: 121.4737, coreBoost: 6.6, radiusKm: 55 }, // Shanghai
  { lat: 22.3193, lon: 114.1694, coreBoost: 6.5, radiusKm: 35 }, // Hong Kong
  { lat: 25.033, lon: 121.5654, coreBoost: 6.0, radiusKm: 30 }, // Taipei
  { lat: 40.7128, lon: -74.006, coreBoost: 6.7, radiusKm: 55 }, // New York
  { lat: 34.0522, lon: -118.2437, coreBoost: 6.6, radiusKm: 55 }, // Los Angeles
  { lat: 51.5072, lon: -0.1276, coreBoost: 6.4, radiusKm: 45 }, // London
  { lat: 48.8566, lon: 2.3522, coreBoost: 6.3, radiusKm: 42 }, // Paris
  { lat: -33.8688, lon: 151.2093, coreBoost: 5.8, radiusKm: 36 }, // Sydney
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat * 0.5) * Math.sin(dLat * 0.5) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon * 0.5) * Math.sin(dLon * 0.5);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export interface EstimatedSiteBortle {
  bortle: number;
  matchedName?: string;
}

/**
 * Estimates a realistic Bortle scale class (1..9) from the observing site's
 * coordinates and optional name (matching known observatories/dark-sky sites
 * first, then falling back to an urban light-dome distance decay model
 * calibrated to real Korean VIIRS/SQM skyglow conditions).
 */
export function estimateSiteBortleClass(
  lat: number,
  lon: number,
  name?: string
): EstimatedSiteBortle {
  const normName = (name ?? '').toLowerCase();

  // 1. Check known observatories / dark-sky sites by proximity or name match
  for (const site of KNOWN_SITES) {
    const dist = haversineKm(lat, lon, site.lat, site.lon);
    const nameMatch = site.keywords.some((kw) => normName.includes(kw));
    if (dist <= site.radiusKm || (nameMatch && dist <= site.radiusKm * 3.5)) {
      return { bortle: site.bortle };
    }
  }

  // 2. Urban skyglow dome accumulation model (calibrated for real Korean light pollution)
  const inKorea = lat >= 33.0 && lat <= 38.7 && lon >= 124.5 && lon <= 131.0;
  const base = inKorea ? 3.45 : 2.1;
  let maxSingleContribution = 0;
  let secondaryContribution = 0;

  for (const hub of URBAN_HUBS) {
    const dist = haversineKm(lat, lon, hub.lat, hub.lon);
    if (dist > hub.radiusKm * 4.5) continue;
    const contrib = hub.coreBoost * Math.exp(-dist / hub.radiusKm);
    if (contrib > maxSingleContribution) {
      secondaryContribution += maxSingleContribution * 0.3;
      maxSingleContribution = contrib;
    } else {
      secondaryContribution += contrib * 0.28;
    }
  }

  let est = base + maxSingleContribution + Math.min(1.4, secondaryContribution);

  // Subtle keyword refinement for mountain observatories vs urban downtown
  if (
    normName.includes('천문대') ||
    normName.includes('휴양림') ||
    normName.includes('팔각정') ||
    normName.includes('국립공원')
  ) {
    est -= 0.25;
  } else if (normName.includes('도심') || normName.includes('시청') || normName.includes('강남')) {
    est += 0.45;
  }

  return { bortle: clampBortleClass(est) };
}

/**
 * Effective limiting magnitude penalty (mag) from Bortle light pollution,
 * scaled realistically between wide-field / naked-eye views (strong NELM drop)
 * and zoomed-in telescopic views (contrast & sky-background noise penalty).
 */
export function computeBortleMagPenalty(bortleClass: number, fszDeg: number): number {
  const b = clampBortleClass(bortleClass);
  if (b <= 1) return 0;
  // Wide-field naked-eye loss relative to Bortle 1 (up to ~3.7 mag at Bortle 9)
  const wideLossTable = [0, 0.35, 0.75, 1.2, 1.7, 2.2, 2.75, 3.3, 3.85];
  const wideLoss = wideLossTable[b - 1];
  // Scale smoothly: full wide-field penalty at fsz >= 45°, ~55% penalty at narrow telescopic FOV
  const fovFactor = Math.max(0.55, Math.min(1.0, 0.55 + ((fszDeg - 3) / 42) * 0.45));
  return wideLoss * fovFactor;
}

/**
 * Contrast / visibility attenuation multiplier (0..1) for Deep Sky Objects
 * under Bortle light pollution. Extended low-surface-brightness objects (GX, DN,
 * SNR, DARK) fade much faster in suburban/urban skies than compact clusters (OC, GC, PN).
 */
export function computeBortleDsoAttenuation(bortleClass: number, dsoType: DsoType): number {
  const b = clampBortleClass(bortleClass);
  if (b <= 2) return 1.0;
  const isExtendedLowSb =
    dsoType === 'GX' || dsoType === 'DN' || dsoType === 'SNR' || dsoType === 'DARK';
  const extendedTable = [1.0, 1.0, 0.92, 0.78, 0.56, 0.34, 0.18, 0.1, 0.06];
  const compactTable = [1.0, 1.0, 0.96, 0.88, 0.74, 0.56, 0.38, 0.24, 0.15];
  return isExtendedLowSb ? extendedTable[b - 1] : compactTable[b - 1];
}

/**
 * Additional DSO magnitude cutoff penalty (mag) from Bortle skyglow.
 */
export function computeBortleDsoMagPenalty(bortleClass: number, dsoType: DsoType): number {
  const b = clampBortleClass(bortleClass);
  if (b <= 2) return 0;
  const isExtendedLowSb =
    dsoType === 'GX' || dsoType === 'DN' || dsoType === 'SNR' || dsoType === 'DARK';
  const extPen = [0, 0, 0.35, 0.85, 1.55, 2.35, 3.25, 4.2, 5.1];
  const cmpPen = [0, 0, 0.2, 0.5, 0.95, 1.5, 2.15, 2.85, 3.6];
  return isExtendedLowSb ? extPen[b - 1] : cmpPen[b - 1];
}
