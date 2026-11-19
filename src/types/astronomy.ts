export type ThemeMode = 'dark' | 'white' | 'red';

export type CoordSystem = 'equatorial' | 'horizontal';

export type ConstellationLineStyle = 'modern' | 'traditional';

export type DsoType = 'GX' | 'OC' | 'GC' | 'DN' | 'DARK' | 'PN' | 'SNR' | 'AST';

export type HipsSurveyId = 'dss2' | '2mass' | 'allwise';

export interface HipsSettings {
  enabled: boolean;
  survey: HipsSurveyId;
  opacity: number; // 0.0 .. 1.0
}

export interface Star {
  id: string;
  hip?: number;
  gaiaId?: string;
  ra: number; // J2000 Right Ascension in degrees (0..360)
  dec: number; // J2000 Declination in degrees (-90..90)
  mag: number; // Apparent visual / G magnitude
  bv: number; // B-V color index
  name?: string; // Proper name (e.g., Betelgeuse)
  koName?: string; // Korean proper name (e.g., 베텔게우스)
  bayer?: string; // Bayer/Flamsteed (e.g., α Ori)
  con: string; // IAU 3-letter constellation abbreviation
}

export interface DeepSkyObject {
  id: string; // Primary catalog ID (e.g., M42, NGC 7000, B 33)
  altId?: string; // Secondary ID (e.g., NGC 1976)
  type: DsoType;
  ra: number; // Degrees (0..360)
  dec: number; // Degrees (-90..90)
  mag: number; // Visual magnitude
  majAx: number; // Major axis in arcminutes
  minAx: number; // Minor axis in arcminutes
  pa: number; // Position angle in degrees (0..180, N through E)
  name?: string; // Common English name
  koName?: string; // Common Korean name
  con: string; // Constellation IAU abbreviation
}

export interface NebulaContour {
  id: string;
  lv: 1 | 2 | 3; // Multi-level brightness contour (1=outer faint, 2=mid, 3=bright core)
  c: [number, number, number]; // [centerRaDeg, centerDecDeg, boundingRadiusDeg]
  p: [number, number][]; // Polygon vertices [raDeg, decDeg]
}

export interface Constellation {
  abbr: string;
  name: string;
  koName: string;
  ra: number; // Center RA in degrees
  dec: number; // Center Dec in degrees
  lines: [number, number, number, number][]; // Modern IAU / S&T lines [ra1, dec1, ra2, dec2]
  traditionalLines?: [number, number, number, number][]; // Traditional Classical Western lines
}

export interface ChartViewState {
  ra: number; // Center RA in hours (0..24) for CZSky URL compatibility
  dec: number; // Center Dec in degrees (-90..90)
  fsz: number; // Field Size (FOV diameter) in degrees (0.5..180)
  flipH: boolean; // Mirror left-right (star diagonal)
  flipV: boolean; // Flip top-bottom (Newtonian reflector)
  coordSystem: CoordSystem; // 'equatorial' (RA/Dec North-up) | 'horizontal' (Alt/Az Zenith-up)
}

export interface LayerSettings {
  showGridEq: boolean;
  showGridAltAz: boolean;
  showHorizon: boolean;
  showTerrain: boolean;
  showEcliptic: boolean;
  showMilkyWay: boolean;
  showNebulaContours: boolean;
  showConstellationLines: boolean;
  constellationLineStyle: ConstellationLineStyle;
  showConstellationBoundaries: boolean;
  showConstellationNames: boolean;
  showSolarSystem: boolean;
  showPlanetSurface: boolean;
  showSolarSystemOrbits: boolean;
  showSolarSystemLabels: boolean;
  solarSystemLabelDensityPct: number; // 0..100 (% of currently visible on-screen solar system bodies)
  showStarColors: boolean;
  showDso: boolean;
  showDsoLabels: boolean;
  dsoLabelDensityPct: number; // 0..100 (% of currently visible on-screen DSOs)
  showStarLabels: boolean;
  starLabelDensityPct: number; // 0..100 (% of currently visible on-screen stars)
  showFieldStars: boolean;
  enableGaiaLive: boolean;
  magOffset: number; // -2.0 to +2.5 limiting magnitude adjustment
  dsoCategories: Record<DsoType, boolean>;
  catalogFilter: 'all' | 'messier' | 'ngc' | 'ic' | 'barnard';
}

export interface MilkyWayLayer {
  id: string;
  polys: [number, number][][];
}

export interface OpticsSettings {
  showCrosshair: boolean; // 중앙 십자선
  showTelrad: boolean; // 0.5°, 2°, 4° concentric circles
  showFinder7x50: boolean; // 7×50 파인더 (7.0°)
  showEyepiece: boolean;
  eyepieceFovDeg: number; // Custom or calculated circular TFOV in degrees
  eyepieceLabel: string;
  eyepieceInputMode: 'direct' | 'calc';
  telescopeFocalLengthMm: number; // 망원경 초점거리 (mm)
  eyepieceFocalLengthMm: number; // 아이피스 초점거리 (mm)
  eyepieceAfovDeg: number; // 아이피스 겉보기 시야각 (AFOV, °)
  showSensorBox: boolean;
  sensorWidthDeg: number;
  sensorHeightDeg: number;
  showStarHop: boolean;
}

export interface ObserverConfig {
  name: string;
  lat: number; // Latitude in degrees (-90..90)
  lon: number; // Longitude in degrees (-180..180)
  timestampMs: number; // Epoch ms for observation time
  useLiveTime: boolean;
  isPlaying: boolean; // Time-lapse playback running
  timeRateSecPerSec: number; // Simulated seconds per real second (negative = reverse)
  minAltitudeDeg: number; // -90 (off), 0, 15, 30, 45
  highlightAboveMinAlt: boolean;
}

export type SolarSystemGroup = 'star' | 'planet' | 'dwarf' | 'asteroid' | 'moon';

export interface SolarSystemBody {
  id: string;
  name: string;
  koName: string;
  symbol: string;
  color: string;
  group: SolarSystemGroup;
  parentId?: string;
  category: string;
  ra: number; // Degrees (0..360)
  dec: number; // Degrees (-90..90)
  mag: number; // Apparent visual magnitude
  distAu: number; // Geocentric distance in AU
  phasePct: number; // Illuminated fraction 0..100
  elongationDeg: number; // Solar elongation in degrees
}

export type SelectedItem =
  | { kind: 'star'; data: Star }
  | { kind: 'dso'; data: DeepSkyObject }
  | { kind: 'planet'; data: SolarSystemBody };

export interface ScreenTarget {
  kind: 'star' | 'dso' | 'planet';
  id: string;
  x: number;
  y: number;
  radius: number;
  mag: number;
  item: SelectedItem;
}

export interface ObservingSessionEntry {
  id: string;
  kind: 'star' | 'dso' | 'planet';
  addedAt: number;
  observed: boolean;
  notes: string;
}

export interface StarHopGuide {
  fromStar: Star;
  toRa: number;
  toDec: number;
  toLabel: string;
  distanceDeg: number;
  paDeg: number;
  note?: string;
}
