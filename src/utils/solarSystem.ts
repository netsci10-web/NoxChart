import { SolarSystemBody, SolarSystemGroup } from '../types/astronomy';
import { DEG2RAD, RAD2DEG } from './astronomy';

const norm360 = (deg: number) => ((deg % 360) + 360) % 360;
const KM_PER_AU = 149597870.7;

function solveKepler(mDeg: number, e: number): number {
  const mRad = mDeg * DEG2RAD;
  let E = mRad + e * Math.sin(mRad) * (1 + e * Math.cos(mRad));
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - mRad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }
  return E;
}

interface OrbitalElements {
  id: string;
  name: string;
  koName: string;
  symbol: string;
  color: string;
  group: SolarSystemGroup;
  category: string;
  N0: number;
  Nd: number;
  i0: number;
  id_: number;
  w0: number;
  wd: number;
  a0: number;
  ad: number;
  e0: number;
  ed: number;
  M0: number;
  Md: number;
  H0: number; // Absolute magnitude H (for planets/asteroids/dwarfs)
  slopeG?: number; // IAU H-G phase slope parameter for minor bodies
  epochJd?: number; // Custom epoch JD (defaults to 2451543.5 = 2000 Jan 0.0 UT)
}

// Standard J2000-epoch orbital elements for major planets (Paul Schlyter / Meeus)
const PLANET_ELEMENTS: OrbitalElements[] = [
  {
    id: 'Mercury',
    name: 'Mercury',
    koName: '수성',
    symbol: '☿',
    color: '#CBD5E1',
    group: 'planet',
    category: '내행성',
    N0: 48.3313,
    Nd: 3.24587e-5,
    i0: 7.0047,
    id_: 5.0e-8,
    w0: 29.1241,
    wd: 1.01444e-5,
    a0: 0.387098,
    ad: 0,
    e0: 0.205635,
    ed: 5.59e-10,
    M0: 168.6562,
    Md: 4.0923344368,
    H0: -0.36,
  },
  {
    id: 'Venus',
    name: 'Venus',
    koName: '금성',
    symbol: '♀',
    color: '#FEF3C7',
    group: 'planet',
    category: '내행성',
    N0: 76.6799,
    Nd: 2.4659e-5,
    i0: 3.3946,
    id_: 2.75e-8,
    w0: 54.891,
    wd: 1.38374e-5,
    a0: 0.72333,
    ad: 0,
    e0: 0.006773,
    ed: -1.302e-9,
    M0: 48.0052,
    Md: 1.6021302244,
    H0: -4.34,
  },
  {
    id: 'Mars',
    name: 'Mars',
    koName: '화성',
    symbol: '♂',
    color: '#FB923C',
    group: 'planet',
    category: '외행성',
    N0: 49.5574,
    Nd: 2.11081e-5,
    i0: 1.8497,
    id_: -1.78e-8,
    w0: 286.5016,
    wd: 2.92961e-5,
    a0: 1.523688,
    ad: 0,
    e0: 0.093405,
    ed: 2.516e-9,
    M0: 18.6021,
    Md: 0.5240207766,
    H0: -1.51,
  },
  {
    id: 'Jupiter',
    name: 'Jupiter',
    koName: '목성',
    symbol: '♃',
    color: '#FDE68A',
    group: 'planet',
    category: '외행성',
    N0: 100.4542,
    Nd: 2.76854e-5,
    i0: 1.303,
    id_: -1.557e-7,
    w0: 273.8777,
    wd: 1.64505e-5,
    a0: 5.20256,
    ad: 0,
    e0: 0.048498,
    ed: 4.469e-9,
    M0: 19.895,
    Md: 0.0830853001,
    H0: -9.25,
  },
  {
    id: 'Saturn',
    name: 'Saturn',
    koName: '토성',
    symbol: '♄',
    color: '#FCD34D',
    group: 'planet',
    category: '외행성',
    N0: 113.6634,
    Nd: 2.3898e-5,
    i0: 2.4886,
    id_: -1.081e-7,
    w0: 339.3939,
    wd: 2.97661e-5,
    a0: 9.55475,
    ad: 0,
    e0: 0.055546,
    ed: -9.499e-9,
    M0: 316.967,
    Md: 0.0334442282,
    H0: -8.95,
  },
  {
    id: 'Uranus',
    name: 'Uranus',
    koName: '천왕성',
    symbol: '♅',
    color: '#67E8F9',
    group: 'planet',
    category: '외행성',
    N0: 74.0005,
    Nd: 1.3978e-5,
    i0: 0.7733,
    id_: 1.9e-8,
    w0: 96.6612,
    wd: 3.0565e-5,
    a0: 19.18171,
    ad: -1.55e-8,
    e0: 0.047318,
    ed: 7.45e-9,
    M0: 142.5905,
    Md: 0.011725806,
    H0: -7.15,
  },
  {
    id: 'Neptune',
    name: 'Neptune',
    koName: '해왕성',
    symbol: '♆',
    color: '#60A5FA',
    group: 'planet',
    category: '외행성',
    N0: 131.7806,
    Nd: 3.0173e-5,
    i0: 1.77,
    id_: -2.55e-7,
    w0: 272.8461,
    wd: -6.027e-6,
    a0: 30.05826,
    ad: 3.313e-8,
    e0: 0.008606,
    ed: 2.15e-9,
    M0: 260.2471,
    Md: 0.005995147,
    H0: -6.9,
  },
];

// J2000.0 (JD 2451545.0) osculating Keplerian elements for Dwarf Planets & Major Asteroids (JPL / MPC)
const J2000_JD = 2451545.0;
const MINOR_BODY_ELEMENTS: OrbitalElements[] = [
  // Dwarf Planets (왜행성)
  {
    id: 'Pluto',
    name: '134340 Pluto',
    koName: '명왕성',
    symbol: '♇',
    color: '#D8B4FE',
    group: 'dwarf',
    category: '왜행성 (카이퍼대)',
    N0: 110.299,
    Nd: 0,
    i0: 17.1405,
    id_: 0,
    w0: 113.834,
    wd: 0,
    a0: 39.4821,
    ad: 0,
    e0: 0.248827,
    ed: 0,
    M0: 14.53,
    Md: 0.0039747,
    H0: -0.7,
    slopeG: 0.15,
    epochJd: J2000_JD,
  },
  {
    id: 'Ceres',
    name: '1 Ceres',
    koName: '세레스',
    symbol: '⚳',
    color: '#C4B5FD',
    group: 'dwarf',
    category: '왜행성 (소행성대)',
    N0: 80.3055,
    Nd: 0,
    i0: 10.593,
    id_: 0,
    w0: 73.5977,
    wd: 0,
    a0: 2.7675,
    ad: 0,
    e0: 0.075823,
    ed: 0,
    M0: 95.9891,
    Md: 0.2140817,
    H0: 3.34,
    slopeG: 0.12,
    epochJd: 2457000.5, // 2014 Dec 9.0 TT (MPC/JPL standard epoch)
  },
  {
    id: 'Haumea',
    name: '136108 Haumea',
    koName: '하우메아',
    symbol: '✧',
    color: '#E9D5FF',
    group: 'dwarf',
    category: '왜행성 (카이퍼대)',
    N0: 122.167,
    Nd: 0,
    i0: 28.2137,
    id_: 0,
    w0: 239.041,
    wd: 0,
    a0: 43.116,
    ad: 0,
    e0: 0.19642,
    ed: 0,
    M0: 218.205,
    Md: 0.0034812,
    H0: 0.2,
    slopeG: 0.15,
    epochJd: 2458600.5,
  },
  {
    id: 'Makemake',
    name: '136472 Makemake',
    koName: '마케마케',
    symbol: '✦',
    color: '#F5D0FE',
    group: 'dwarf',
    category: '왜행성 (카이퍼대)',
    N0: 79.62,
    Nd: 0,
    i0: 28.9835,
    id_: 0,
    w0: 294.834,
    wd: 0,
    a0: 45.43,
    ad: 0,
    e0: 0.16126,
    ed: 0,
    M0: 165.514,
    Md: 0.0032177,
    H0: -0.3,
    slopeG: 0.15,
    epochJd: 2458600.5,
  },
  {
    id: 'Eris',
    name: '136199 Eris',
    koName: '에리스',
    symbol: '⯰',
    color: '#A5B4FC',
    group: 'dwarf',
    category: '왜행성 (산란원반)',
    N0: 35.951,
    Nd: 0,
    i0: 44.04,
    id_: 0,
    w0: 151.639,
    wd: 0,
    a0: 67.864,
    ad: 0,
    e0: 0.43607,
    ed: 0,
    M0: 205.989,
    Md: 0.0017629,
    H0: -1.17,
    slopeG: 0.15,
    epochJd: 2458600.5,
  },

  // Major Asteroids (주요 소행성)
  {
    id: 'Vesta',
    name: '4 Vesta',
    koName: '베스타',
    symbol: '⚶',
    color: '#6EE7B7',
    group: 'asteroid',
    category: '소행성 (소행성대)',
    N0: 103.851,
    Nd: 0,
    i0: 7.1404,
    id_: 0,
    w0: 151.198,
    wd: 0,
    a0: 2.36179,
    ad: 0,
    e0: 0.08874,
    ed: 0,
    M0: 20.8638,
    Md: 0.2715447,
    H0: 3.2,
    slopeG: 0.32,
    epochJd: 2457000.5,
  },
  {
    id: 'Pallas',
    name: '2 Pallas',
    koName: '팔라스',
    symbol: '⚴',
    color: '#5EEAD4',
    group: 'asteroid',
    category: '소행성 (소행성대)',
    N0: 173.08,
    Nd: 0,
    i0: 34.837,
    id_: 0,
    w0: 310.049,
    wd: 0,
    a0: 2.773,
    ad: 0,
    e0: 0.23054,
    ed: 0,
    M0: 78.2287,
    Md: 0.213446,
    H0: 4.13,
    slopeG: 0.11,
    epochJd: 2457000.5,
  },
  {
    id: 'Juno',
    name: '3 Juno',
    koName: '주노',
    symbol: '⚵',
    color: '#34D399',
    group: 'asteroid',
    category: '소행성 (소행성대)',
    N0: 169.852,
    Nd: 0,
    i0: 12.989,
    id_: 0,
    w0: 248.066,
    wd: 0,
    a0: 2.6691,
    ad: 0,
    e0: 0.25623,
    ed: 0,
    M0: 33.077,
    Md: 0.226033,
    H0: 5.33,
    slopeG: 0.32,
    epochJd: 2457000.5,
  },
  {
    id: 'Hygiea',
    name: '10 Hygiea',
    koName: '히기에이아',
    symbol: '❖',
    color: '#2DD4BF',
    group: 'asteroid',
    category: '소행성 (소행성대)',
    N0: 283.204,
    Nd: 0,
    i0: 3.8316,
    id_: 0,
    w0: 312.315,
    wd: 0,
    a0: 3.1415,
    ad: 0,
    e0: 0.11251,
    ed: 0,
    M0: 152.185,
    Md: 0.177049,
    H0: 5.43,
    slopeG: 0.15,
    epochJd: 2457000.5,
  },
  {
    id: 'Iris',
    name: '7 Iris',
    koName: '아이리스',
    symbol: '◈',
    color: '#6EE7B7',
    group: 'asteroid',
    category: '소행성 (소행성대)',
    N0: 259.563,
    Nd: 0,
    i0: 5.521,
    id_: 0,
    w0: 145.265,
    wd: 0,
    a0: 2.3861,
    ad: 0,
    e0: 0.23015,
    ed: 0,
    M0: 229.66,
    Md: 0.267401,
    H0: 5.51,
    slopeG: 0.15,
    epochJd: 2457000.5,
  },
  {
    id: 'Eunomia',
    name: '15 Eunomia',
    koName: '유노미아',
    symbol: '◇',
    color: '#5EEAD4',
    group: 'asteroid',
    category: '소행성 (소행성대)',
    N0: 293.208,
    Nd: 0,
    i0: 11.737,
    id_: 0,
    w0: 97.767,
    wd: 0,
    a0: 2.6437,
    ad: 0,
    e0: 0.18661,
    ed: 0,
    M0: 140.42,
    Md: 0.229297,
    H0: 5.28,
    slopeG: 0.23,
    epochJd: 2457000.5,
  },
  {
    id: 'Psyche',
    name: '16 Psyche',
    koName: '프시케',
    symbol: '◆',
    color: '#99F6E4',
    group: 'asteroid',
    category: '소행성 (금속형 M형)',
    N0: 150.205,
    Nd: 0,
    i0: 3.096,
    id_: 0,
    w0: 228.046,
    wd: 0,
    a0: 2.9228,
    ad: 0,
    e0: 0.13392,
    ed: 0,
    M0: 290.96,
    Md: 0.197254,
    H0: 5.9,
    slopeG: 0.2,
    epochJd: 2457000.5,
  },
];

interface PlanetaryMoonDef {
  id: string;
  name: string;
  koName: string;
  parentId: 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
  category: string;
  color: string;
  semiMajorKm: number; // Orbital radius around host planet (km)
  periodDays: number; // Sidereal period (negative = retrograde)
  phaseJ2000Deg: number; // Orbital phase at J2000.0
  paDeg: number; // Equatorial plane position angle on sky
  tiltFrac: number; // Apparent ellipse minor/major ratio
  baseMag: number; // Visual magnitude at mean opposition
  refDistAu: number; // Reference opposition distance
}

const PLANETARY_MOONS: PlanetaryMoonDef[] = [
  // Mars Moons (화성 위성)
  {
    id: 'Phobos',
    name: 'Phobos (M I)',
    koName: '포보스',
    parentId: 'Mars',
    category: '화성 위성',
    color: '#FDBA74',
    semiMajorKm: 9376,
    periodDays: 0.31891,
    phaseJ2000Deg: 92.4,
    paDeg: 35,
    tiltFrac: 0.35,
    baseMag: 11.4,
    refDistAu: 0.52,
  },
  {
    id: 'Deimos',
    name: 'Deimos (M II)',
    koName: '데이모스',
    parentId: 'Mars',
    category: '화성 위성',
    color: '#FED7AA',
    semiMajorKm: 23463,
    periodDays: 1.263,
    phaseJ2000Deg: 214.1,
    paDeg: 35,
    tiltFrac: 0.35,
    baseMag: 12.45,
    refDistAu: 0.52,
  },
  // Jupiter Moons (목성 갈릴레이 위성)
  {
    id: 'Io',
    name: 'Io (J I)',
    koName: '이오',
    parentId: 'Jupiter',
    category: '목성 위성 (갈릴레이)',
    color: '#FDE047',
    semiMajorKm: 421800,
    periodDays: 1.769138,
    phaseJ2000Deg: 106.08,
    paDeg: 25,
    tiltFrac: 0.06,
    baseMag: 5.02,
    refDistAu: 4.2,
  },
  {
    id: 'Europa',
    name: 'Europa (J II)',
    koName: '유로파',
    parentId: 'Jupiter',
    category: '목성 위성 (갈릴레이)',
    color: '#E2E8F0',
    semiMajorKm: 671100,
    periodDays: 3.551181,
    phaseJ2000Deg: 175.73,
    paDeg: 25,
    tiltFrac: 0.06,
    baseMag: 5.29,
    refDistAu: 4.2,
  },
  {
    id: 'Ganymede',
    name: 'Ganymede (J III)',
    koName: '가니메데',
    parentId: 'Jupiter',
    category: '목성 위성 (갈릴레이)',
    color: '#FEF3C7',
    semiMajorKm: 1070400,
    periodDays: 7.154553,
    phaseJ2000Deg: 120.56,
    paDeg: 25,
    tiltFrac: 0.06,
    baseMag: 4.61,
    refDistAu: 4.2,
  },
  {
    id: 'Callisto',
    name: 'Callisto (J IV)',
    koName: '칼리스토',
    parentId: 'Jupiter',
    category: '목성 위성 (갈릴레이)',
    color: '#CBD5E1',
    semiMajorKm: 1882700,
    periodDays: 16.689018,
    phaseJ2000Deg: 84.44,
    paDeg: 25,
    tiltFrac: 0.06,
    baseMag: 5.65,
    refDistAu: 4.2,
  },
  // Saturn Moons (토성 위성)
  {
    id: 'Titan',
    name: 'Titan (S VI)',
    koName: '타이탄',
    parentId: 'Saturn',
    category: '토성 위성',
    color: '#FBBF24',
    semiMajorKm: 1221870,
    periodDays: 15.945421,
    phaseJ2000Deg: 163.3,
    paDeg: 21,
    tiltFrac: 0.22,
    baseMag: 8.4,
    refDistAu: 8.5,
  },
  {
    id: 'Rhea',
    name: 'Rhea (S V)',
    koName: '레아',
    parentId: 'Saturn',
    category: '토성 위성',
    color: '#E2E8F0',
    semiMajorKm: 527108,
    periodDays: 4.518212,
    phaseJ2000Deg: 42.8,
    paDeg: 21,
    tiltFrac: 0.22,
    baseMag: 9.7,
    refDistAu: 8.5,
  },
  {
    id: 'Enceladus',
    name: 'Enceladus (S II)',
    koName: '엔셀라두스',
    parentId: 'Saturn',
    category: '토성 위성',
    color: '#F8FAFC',
    semiMajorKm: 238020,
    periodDays: 1.370218,
    phaseJ2000Deg: 112.5,
    paDeg: 21,
    tiltFrac: 0.22,
    baseMag: 11.7,
    refDistAu: 8.5,
  },
  // Uranus Moons (천왕성 위성)
  {
    id: 'Titania',
    name: 'Titania (U III)',
    koName: '티타니아',
    parentId: 'Uranus',
    category: '천왕성 위성',
    color: '#A5F3FC',
    semiMajorKm: 435910,
    periodDays: 8.706234,
    phaseJ2000Deg: 64.2,
    paDeg: 82,
    tiltFrac: 0.65,
    baseMag: 13.9,
    refDistAu: 18.2,
  },
  {
    id: 'Oberon',
    name: 'Oberon (U IV)',
    koName: '오베론',
    parentId: 'Uranus',
    category: '천왕성 위성',
    color: '#CFFAFE',
    semiMajorKm: 583520,
    periodDays: 13.463234,
    phaseJ2000Deg: 198.7,
    paDeg: 82,
    tiltFrac: 0.65,
    baseMag: 14.1,
    refDistAu: 18.2,
  },
  // Neptune Moon (해왕성 위성)
  {
    id: 'Triton',
    name: 'Triton (N I)',
    koName: '트리톤',
    parentId: 'Neptune',
    category: '해왕성 위성 (역행)',
    color: '#BAE6FD',
    semiMajorKm: 354759,
    periodDays: -5.876854,
    phaseJ2000Deg: 215.4,
    paDeg: 38,
    tiltFrac: 0.38,
    baseMag: 13.47,
    refDistAu: 29.0,
  },
  // Pluto Moon (명왕성 위성)
  {
    id: 'Charon',
    name: 'Charon (P I)',
    koName: '카론',
    parentId: 'Pluto',
    category: '명왕성 위성',
    color: '#E9D5FF',
    semiMajorKm: 19591,
    periodDays: 6.38723,
    phaseJ2000Deg: 141.0,
    paDeg: 48,
    tiltFrac: 0.55,
    baseMag: 16.8,
    refDistAu: 33.0,
  },
];

function eclipticToEquatorial(
  lonDeg: number,
  latDeg: number,
  eclDeg: number
): { ra: number; dec: number } {
  const lon = lonDeg * DEG2RAD;
  const lat = latDeg * DEG2RAD;
  const ecl = eclDeg * DEG2RAD;

  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.cos(lat) * Math.sin(lon);
  const z = Math.sin(lat);

  const xe = x;
  const ye = y * Math.cos(ecl) - z * Math.sin(ecl);
  const ze = y * Math.sin(ecl) + z * Math.cos(ecl);

  return {
    ra: norm360(Math.atan2(ye, xe) * RAD2DEG),
    dec: Math.atan2(ze, Math.hypot(xe, ye)) * RAD2DEG,
  };
}

/**
 * Compute real-time geocentric apparent positions (RA, Dec, visual mag, distance, phase)
 * for Sun, Moon, 7 major planets, 5 dwarf planets, 7 major asteroids, and 7 major planetary moons.
 */
export function getSolarSystemBodies(timestampMs: number): SolarSystemBody[] {
  // Days since 2000 Jan 0.0 UT (JD 2451543.5)
  const jd = timestampMs / 86400000 + 2440587.5;
  const d = jd - 2451543.5;
  const dJ2000 = jd - J2000_JD;
  const ecl = 23.4393 - 3.563e-7 * d; // Obliquity of the ecliptic

  // 1. Sun
  const wSun = norm360(282.9404 + 4.70935e-5 * d);
  const eSun = 0.016709 - 1.151e-9 * d;
  const MSun = norm360(356.047 + 0.9856002585 * d);
  const ESun = solveKepler(MSun, eSun);
  const xvSun = Math.cos(ESun) - eSun;
  const yvSun = Math.sqrt(1 - eSun * eSun) * Math.sin(ESun);
  const vSun = Math.atan2(yvSun, xvSun) * RAD2DEG;
  const rSun = Math.hypot(xvSun, yvSun);
  const lonSun = norm360(vSun + wSun);

  const xs = rSun * Math.cos(lonSun * DEG2RAD);
  const ys = rSun * Math.sin(lonSun * DEG2RAD);
  const sunEq = eclipticToEquatorial(lonSun, 0, ecl);

  const bodies: SolarSystemBody[] = [
    {
      id: 'Sun',
      name: 'Sun',
      koName: '태양',
      symbol: '☉',
      color: '#FDE047',
      group: 'star',
      category: '태양 (항성)',
      ra: sunEq.ra,
      dec: sunEq.dec,
      mag: -26.74,
      distAu: Number(rSun.toFixed(4)),
      phasePct: 100,
      elongationDeg: 0,
    },
  ];

  // 2. Moon (with primary lunar perturbations)
  const NM = norm360(125.1228 - 0.0529538083 * d);
  const iM = 5.1454;
  const wM = norm360(318.0634 + 0.1643573223 * d);
  const aM = 60.2666; // Earth radii
  const eM = 0.0549;
  const MM = norm360(115.3654 + 13.0649929509 * d);
  const EM = solveKepler(MM, eM);
  const xvM = aM * (Math.cos(EM) - eM);
  const yvM = aM * Math.sqrt(1 - eM * eM) * Math.sin(EM);
  const vM = Math.atan2(yvM, xvM) * RAD2DEG;
  const rM = Math.hypot(xvM, yvM);

  const nMRad = NM * DEG2RAD;
  const vwMRad = (vM + wM) * DEG2RAD;
  const iMRad = iM * DEG2RAD;

  const xhM =
    rM * (Math.cos(nMRad) * Math.cos(vwMRad) - Math.sin(nMRad) * Math.sin(vwMRad) * Math.cos(iMRad));
  const yhM =
    rM * (Math.sin(nMRad) * Math.cos(vwMRad) + Math.cos(nMRad) * Math.sin(vwMRad) * Math.cos(iMRad));
  const zhM = rM * (Math.sin(vwMRad) * Math.sin(iMRad));

  let lonM = norm360(Math.atan2(yhM, xhM) * RAD2DEG);
  let latM = Math.atan2(zhM, Math.hypot(xhM, yhM)) * RAD2DEG;

  const Ls = norm360(MSun + wSun);
  const Lm = norm360(MM + wM + NM);
  const Dm = norm360(Lm - Ls);
  const Fm = norm360(Lm - NM);

  lonM = norm360(
    lonM -
      1.274 * Math.sin((MM - 2 * Dm) * DEG2RAD) +
      0.658 * Math.sin(2 * Dm * DEG2RAD) -
      0.186 * Math.sin(MSun * DEG2RAD) -
      0.059 * Math.sin((2 * MM - 2 * Dm) * DEG2RAD) -
      0.057 * Math.sin((MM - 2 * Dm + MSun) * DEG2RAD) +
      0.053 * Math.sin((MM + 2 * Dm) * DEG2RAD) +
      0.046 * Math.sin((2 * Dm - MSun) * DEG2RAD) +
      0.041 * Math.sin((MM - MSun) * DEG2RAD) -
      0.035 * Math.sin(Dm * DEG2RAD) -
      0.031 * Math.sin((MM + MSun) * DEG2RAD)
  );
  latM =
    latM -
    0.173 * Math.sin((Fm - 2 * Dm) * DEG2RAD) -
    0.055 * Math.sin((MM - Fm - 2 * Dm) * DEG2RAD) -
    0.046 * Math.sin((MM + Fm - 2 * Dm) * DEG2RAD) +
    0.033 * Math.sin((Fm + 2 * Dm) * DEG2RAD);

  const moonEq = eclipticToEquatorial(lonM, latM, ecl);
  const moonElong =
    Math.acos(
      Math.max(-1, Math.min(1, Math.cos((lonM - lonSun) * DEG2RAD) * Math.cos(latM * DEG2RAD)))
    ) * RAD2DEG;
  const moonPhasePct = ((1 - Math.cos(moonElong * DEG2RAD)) / 2) * 100;
  const moonAgeDays = (norm360(lonM - lonSun) / 360) * 29.530588;
  const phaseAngleDeg = 180 - moonElong;
  const moonMag = -12.74 + 0.026 * phaseAngleDeg + 4e-9 * Math.pow(phaseAngleDeg, 4);

  bodies.push({
    id: 'Moon',
    name: 'Moon',
    koName: '달',
    symbol: '☽',
    color: '#E2E8F0',
    group: 'moon',
    parentId: 'Earth',
    category: `지구 위성 · 월령 ${moonAgeDays.toFixed(1)}일`,
    ra: moonEq.ra,
    dec: moonEq.dec,
    mag: Number(moonMag.toFixed(1)),
    distAu: Number(((rM * 6378.14) / KM_PER_AU).toFixed(5)),
    phasePct: Math.round(moonPhasePct),
    elongationDeg: Number(moonElong.toFixed(1)),
  });

  // Mean anomalies for Jupiter/Saturn/Uranus mutual perturbations
  const Mj = norm360(19.895 + 0.0830853001 * d);
  const Ms = norm360(316.967 + 0.0334442282 * d);
  const Mu = norm360(142.5905 + 0.011725806 * d);

  const moonsByParent = new Map<string, PlanetaryMoonDef[]>();
  for (const m of PLANETARY_MOONS) {
    const list = moonsByParent.get(m.parentId);
    if (list) list.push(m);
    else moonsByParent.set(m.parentId, [m]);
  }

  // 3. Planets, Dwarf Planets, Asteroids — with each planet's moons immediately following their host
  const allKeplerBodies = [...PLANET_ELEMENTS, ...MINOR_BODY_ELEMENTS];
  for (const el of allKeplerBodies) {
    const dt = el.epochJd ? jd - el.epochJd : d;
    const N = norm360(el.N0 + el.Nd * dt);
    const inc = el.i0 + el.id_ * dt;
    const w = norm360(el.w0 + el.wd * dt);
    const a = el.a0 + el.ad * dt;
    const e = el.e0 + el.ed * dt;
    const M = norm360(el.M0 + el.Md * dt);

    const E = solveKepler(M, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv) * RAD2DEG;
    const r = Math.hypot(xv, yv);

    const nRad = N * DEG2RAD;
    const vwRad = (v + w) * DEG2RAD;
    const iRad = inc * DEG2RAD;

    const xh =
      r * (Math.cos(nRad) * Math.cos(vwRad) - Math.sin(nRad) * Math.sin(vwRad) * Math.cos(iRad));
    const yh =
      r * (Math.sin(nRad) * Math.cos(vwRad) + Math.cos(nRad) * Math.sin(vwRad) * Math.cos(iRad));
    const zh = r * (Math.sin(vwRad) * Math.sin(iRad));

    let lonHelio = norm360(Math.atan2(yh, xh) * RAD2DEG);
    let latHelio = Math.atan2(zh, Math.hypot(xh, yh)) * RAD2DEG;

    if (el.id === 'Jupiter') {
      lonHelio +=
        -0.332 * Math.sin((2 * Mj - 5 * Ms - 67.6) * DEG2RAD) -
        0.056 * Math.sin((2 * Mj - 2 * Ms + 21) * DEG2RAD) +
        0.042 * Math.sin((3 * Mj - 5 * Ms + 21) * DEG2RAD);
    } else if (el.id === 'Saturn') {
      lonHelio +=
        0.812 * Math.sin((2 * Mj - 5 * Ms - 67.6) * DEG2RAD) -
        0.229 * Math.cos((2 * Mj - 4 * Ms - 2) * DEG2RAD) +
        0.119 * Math.sin((Mj - 2 * Ms - 3) * DEG2RAD);
      latHelio += -0.02 * Math.cos((2 * Mj - 4 * Ms - 2) * DEG2RAD);
    } else if (el.id === 'Uranus') {
      lonHelio +=
        0.04 * Math.sin((Ms - 2 * Mu + 6) * DEG2RAD) +
        0.035 * Math.sin((Ms - 3 * Mu + 33) * DEG2RAD);
    }

    const xhCorr = r * Math.cos(latHelio * DEG2RAD) * Math.cos(lonHelio * DEG2RAD);
    const yhCorr = r * Math.cos(latHelio * DEG2RAD) * Math.sin(lonHelio * DEG2RAD);
    const zhCorr = r * Math.sin(latHelio * DEG2RAD);

    // Geocentric ecliptic coordinates
    const xg = xhCorr + xs;
    const yg = yhCorr + ys;
    const zg = zhCorr;

    const distAu = Math.hypot(xg, yg, zg);
    const lonGeo = norm360(Math.atan2(yg, xg) * RAD2DEG);
    const latGeo = Math.atan2(zg, Math.hypot(xg, yg)) * RAD2DEG;
    const eq = eclipticToEquatorial(lonGeo, latGeo, ecl);

    // Phase angle & visual magnitude
    const cosFv = Math.max(-1, Math.min(1, (r * r + distAu * distAu - rSun * rSun) / (2 * r * distAu)));
    const fv = Math.acos(cosFv) * RAD2DEG;
    const phasePct = Math.round(((1 + cosFv) / 2) * 100);
    const cosElong = Math.max(
      -1,
      Math.min(1, (rSun * rSun + distAu * distAu - r * r) / (2 * rSun * distAu))
    );
    const elong = Math.acos(cosElong) * RAD2DEG;

    let mag = el.H0 + 5 * Math.log10(Math.max(0.01, r * distAu));
    if (el.id === 'Mercury') {
      mag += 0.027 * fv + 2.2e-13 * Math.pow(fv, 6);
    } else if (el.id === 'Venus') {
      mag += 0.013 * fv + 4.2e-7 * Math.pow(fv, 3);
    } else if (el.id === 'Mars') {
      mag += 0.016 * fv;
    } else if (el.id === 'Jupiter') {
      mag += 0.005 * fv;
    } else if (el.id === 'Saturn') {
      mag += 0.044 * fv - 0.6;
    } else if (el.slopeG !== undefined) {
      // IAU H-G phase curve for asteroids & dwarf planets
      const fvRad = fv * DEG2RAD;
      const tanHalf = Math.tan(fvRad / 2);
      const phi1 = Math.exp(-3.33 * Math.pow(tanHalf, 0.63));
      const phi2 = Math.exp(-1.87 * Math.pow(tanHalf, 1.22));
      const G = el.slopeG;
      mag -= 2.5 * Math.log10(Math.max(1e-4, (1 - G) * phi1 + G * phi2));
    }

    const body: SolarSystemBody = {
      id: el.id,
      name: el.name,
      koName: el.koName,
      symbol: el.symbol,
      color: el.color,
      group: el.group,
      category: el.category,
      ra: eq.ra,
      dec: eq.dec,
      mag: Number(mag.toFixed(1)),
      distAu: Number(distAu.toFixed(3)),
      phasePct,
      elongationDeg: Number(elong.toFixed(1)),
    };
    bodies.push(body);

    // Emit this host body's moons right after it (e.g. Mars -> Phobos/Deimos -> Jupiter -> Io/Europa/...)
    const hostMoons = moonsByParent.get(el.id);
    if (hostMoons) {
      for (const m of hostMoons) {
        const angRad = (m.phaseJ2000Deg + (dJ2000 / m.periodDays) * 360) * DEG2RAD;
        const maxSepDeg = ((m.semiMajorKm / KM_PER_AU) / Math.max(0.3, body.distAu)) * RAD2DEG;

        // Projected offset in equatorial plane (x along orbit line, y perpendicular)
        const xOrb = Math.sin(angRad) * maxSepDeg;
        const yOrb = Math.cos(angRad) * maxSepDeg * m.tiltFrac;
        const paRad = m.paDeg * DEG2RAD;

        // Rotate by equatorial PA into sky East/North offsets
        const dEastDeg = xOrb * Math.cos(paRad) - yOrb * Math.sin(paRad);
        const dNorthDeg = xOrb * Math.sin(paRad) + yOrb * Math.cos(paRad);

        const cosDec = Math.max(0.15, Math.cos(body.dec * DEG2RAD));
        const ra = norm360(body.ra + dEastDeg / cosDec);
        const dec = Math.max(-89.9, Math.min(89.9, body.dec + dNorthDeg));
        const moonMag = m.baseMag + 5 * Math.log10(Math.max(0.25, body.distAu / m.refDistAu));

        bodies.push({
          id: m.id,
          name: m.name,
          koName: m.koName,
          symbol: '•',
          color: m.color,
          group: 'moon',
          parentId: m.parentId,
          category: m.category,
          ra,
          dec,
          mag: Number(moonMag.toFixed(1)),
          distAu: body.distAu,
          phasePct: body.phasePct,
          elongationDeg: body.elongationDeg,
        });
      }
    }
  }

  return bodies;
}

export interface SolarSystemOrbitTrack {
  id: string;
  koName: string;
  color: string;
  group: 'star' | 'moon' | 'planet';
  isPlanetaryMoon?: boolean;
  /** Apparent geocentric sky path before current observation time */
  pastPoints: { raDeg: number; decDeg: number }[];
  /** Apparent geocentric sky path after current observation time */
  futurePoints: { raDeg: number; decDeg: number }[];
}

const ORBIT_SPAN_CONFIG: Record<string, { halfSpanDays: number; stepsPerSide: number }> = {
  Sun: { halfSpanDays: 182.62, stepsPerSide: 48 },
  Moon: { halfSpanDays: 13.66, stepsPerSide: 40 },
  Mercury: { halfSpanDays: 58, stepsPerSide: 36 },
  Venus: { halfSpanDays: 150, stepsPerSide: 44 },
  Mars: { halfSpanDays: 220, stepsPerSide: 48 },
  Jupiter: { halfSpanDays: 260, stepsPerSide: 40 },
  Saturn: { halfSpanDays: 365, stepsPerSide: 36 },
  Uranus: { halfSpanDays: 540, stepsPerSide: 32 },
  Neptune: { halfSpanDays: 540, stepsPerSide: 32 },
};

let cachedOrbitBucket = Number.NaN;
let cachedOrbitTracks: SolarSystemOrbitTrack[] = [];

/**
 * Compute apparent geocentric orbital paths across the sky for Sun, Moon, 7 major planets,
 * and major planetary moons around timestampMs. Cached in 3-hour buckets for 60fps panning.
 */
export function getSolarSystemOrbitTracks(timestampMs: number): SolarSystemOrbitTrack[] {
  // Quantize to 3-hour buckets so dragging/zooming never recomputes ephemerides
  const bucket = Math.round(timestampMs / (3 * 3600 * 1000));
  if (bucket === cachedOrbitBucket && cachedOrbitTracks.length > 0) {
    return cachedOrbitTracks;
  }

  const baseMs = bucket * 3 * 3600 * 1000;
  const nowBodies = getSolarSystemBodies(baseMs);
  const bodyById = new Map(nowBodies.map((b) => [b.id, b]));
  const tracks: SolarSystemOrbitTrack[] = [];

  // 1. Sun, Moon, and Major Planets apparent geocentric tracks
  const trackIds = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

  // Sample each body's own optimal time window so fast bodies (Moon/Mercury) stay silky smooth
  const DAY_MS = 86400000;
  for (const id of trackIds) {
    const cfg = ORBIT_SPAN_CONFIG[id];
    const meta = bodyById.get(id);
    if (!cfg || !meta) continue;
    const pastPts: { raDeg: number; decDeg: number }[] = [];
    const futurePts: { raDeg: number; decDeg: number }[] = [];

    for (let s = -cfg.stepsPerSide; s <= cfg.stepsPerSide; s++) {
      const tMs = baseMs + (s / cfg.stepsPerSide) * cfg.halfSpanDays * DAY_MS;
      const sample = getSolarSystemBodies(tMs).find((b) => b.id === id);
      if (!sample) continue;
      const pt = { raDeg: sample.ra, decDeg: sample.dec };
      if (s <= 0) pastPts.push(pt);
      if (s >= 0) futurePts.push(pt);
    }

    tracks.push({
      id: meta.id,
      koName: meta.koName,
      color: meta.color,
      group: meta.group === 'star' ? 'star' : meta.group === 'moon' ? 'moon' : 'planet',
      pastPoints: pastPts,
      futurePoints: futurePts,
    });
  }

  // 2. Planetary Moon closed orbital ellipses around their host planet at current epoch
  const jd = baseMs / DAY_MS + 2440587.5;
  const dJ2000 = jd - J2000_JD;
  for (const m of PLANETARY_MOONS) {
    const parent = bodyById.get(m.parentId);
    if (!parent) continue;
    const maxSepDeg = ((m.semiMajorKm / KM_PER_AU) / Math.max(0.3, parent.distAu)) * RAD2DEG;
    const paRad = m.paDeg * DEG2RAD;
    const cosDec = Math.max(0.15, Math.cos(parent.dec * DEG2RAD));
    const curAngDeg = m.phaseJ2000Deg + (dJ2000 / m.periodDays) * 360;
    const pts: { raDeg: number; decDeg: number }[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const angRad = (curAngDeg + (i / steps) * 360) * DEG2RAD;
      const xOrb = Math.sin(angRad) * maxSepDeg;
      const yOrb = Math.cos(angRad) * maxSepDeg * m.tiltFrac;
      const dEastDeg = xOrb * Math.cos(paRad) - yOrb * Math.sin(paRad);
      const dNorthDeg = xOrb * Math.sin(paRad) + yOrb * Math.cos(paRad);
      pts.push({
        raDeg: norm360(parent.ra + dEastDeg / cosDec),
        decDeg: Math.max(-89.9, Math.min(89.9, parent.dec + dNorthDeg)),
      });
    }
    tracks.push({
      id: m.id,
      koName: m.koName,
      color: m.color,
      group: 'moon',
      isPlanetaryMoon: true,
      pastPoints: [],
      futurePoints: pts,
    });
  }

  cachedOrbitBucket = bucket;
  cachedOrbitTracks = tracks;
  return tracks;
}

export interface SolarTrailDayPoint {
  dayOffset: number;
  timestampMs: number;
  dateLabel: string;
  raDeg: number;
  decDeg: number;
}

export interface SolarSystemDailyTrail {
  bodyId: string;
  koName: string;
  name: string;
  symbol: string;
  color: string;
  startMs: number;
  days: number;
  curvePoints: { raDeg: number; decDeg: number }[];
  dailyPoints: SolarTrailDayPoint[];
  centerRaDeg: number;
  centerDecDeg: number;
  spanDeg: number;
}

const dailyTrailCache = new Map<string, SolarSystemDailyTrail>();

function formatMonthDayLabel(timestampMs: number): string {
  const dt = new Date(timestampMs);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

/**
 * Compute a forward daily trajectory (day 0 through +days) for any Solar System body
 * anchored at startMs (e.g. today's date), with smooth sub-daily curve points and exact daily date markers.
 */
export function getSolarSystemDailyTrail(
  bodyId: string,
  startMs: number,
  days = 10
): SolarSystemDailyTrail | null {
  const minuteBucket = Math.floor(startMs / 60000);
  const cacheKey = `${bodyId}:${minuteBucket}:${days}`;
  const cached = dailyTrailCache.get(cacheKey);
  if (cached) return cached;

  const anchorMs = minuteBucket * 60000;
  const startBody = getSolarSystemBodies(anchorMs).find((b) => b.id === bodyId);
  if (!startBody) return null;

  const DAY_MS = 86400000;
  const isPlanetaryMoon = startBody.group === 'moon' && startBody.id !== 'Moon';
  const subStepsPerDay = isPlanetaryMoon ? 24 : 6;
  const totalSubSteps = days * subStepsPerDay;

  const curvePoints: { raDeg: number; decDeg: number }[] = [];
  const dailyPoints: SolarTrailDayPoint[] = [];

  for (let s = 0; s <= totalSubSteps; s++) {
    const tMs = anchorMs + (s / subStepsPerDay) * DAY_MS;
    const sample = getSolarSystemBodies(tMs).find((b) => b.id === bodyId);
    if (!sample) continue;

    curvePoints.push({ raDeg: sample.ra, decDeg: sample.dec });

    if (s % subStepsPerDay === 0) {
      const dayOffset = Math.round(s / subStepsPerDay);
      dailyPoints.push({
        dayOffset,
        timestampMs: tMs,
        dateLabel: formatMonthDayLabel(tMs),
        raDeg: sample.ra,
        decDeg: sample.dec,
      });
    }
  }

  if (dailyPoints.length === 0) return null;

  // Spherical centroid (handles RA 0h/24h wrap-around cleanly)
  let sx = 0;
  let sy = 0;
  let sz = 0;
  const unitPts: [number, number, number][] = [];
  for (const p of dailyPoints) {
    const a = p.raDeg * DEG2RAD;
    const d = p.decDeg * DEG2RAD;
    const ux = Math.cos(d) * Math.cos(a);
    const uy = Math.cos(d) * Math.sin(a);
    const uz = Math.sin(d);
    sx += ux;
    sy += uy;
    sz += uz;
    unitPts.push([ux, uy, uz]);
  }
  const norm = Math.hypot(sx, sy, sz) || 1;
  const cx = sx / norm;
  const cy = sy / norm;
  const cz = sz / norm;
  const centerRaDeg = norm360(Math.atan2(cy, cx) * RAD2DEG);
  const centerDecDeg = Math.asin(Math.max(-1, Math.min(1, cz))) * RAD2DEG;

  let maxRadFromCenter = 0;
  for (const [ux, uy, uz] of unitPts) {
    const dot = Math.max(-1, Math.min(1, ux * cx + uy * cy + uz * cz));
    const ang = Math.acos(dot) * RAD2DEG;
    if (ang > maxRadFromCenter) maxRadFromCenter = ang;
  }

  const trail: SolarSystemDailyTrail = {
    bodyId: startBody.id,
    koName: startBody.koName,
    name: startBody.name,
    symbol: startBody.symbol,
    color: startBody.color,
    startMs: anchorMs,
    days,
    curvePoints,
    dailyPoints,
    centerRaDeg,
    centerDecDeg,
    spanDeg: maxRadFromCenter * 2,
  };

  if (dailyTrailCache.size > 40) {
    const oldestKey = dailyTrailCache.keys().next().value;
    if (oldestKey) dailyTrailCache.delete(oldestKey);
  }
  dailyTrailCache.set(cacheKey, trail);
  return trail;
}


