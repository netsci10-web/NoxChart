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

export interface DoubleStarPair {
  comp: string; // e.g., "AB", "AC", "CD"
  sep: number; // Angular separation in arcseconds
  pa: number; // Position angle in degrees (0..360, N through E)
  mag1: number;
  mag2: number;
  disc: string; // Discoverer designation
}

export interface DoubleStarSystem {
  id: string; // Primary unique ID ("WDS 19307+2758")
  wdsId: string; // 10-char WDS identifier ("19307+2758")
  disc: string; // Primary discoverer + components (e.g., "STFA 43 AB")
  ra: number; // J2000 Right Ascension in degrees (0..360)
  dec: number; // J2000 Declination in degrees (-90..90)
  mag: number; // Brightest visual magnitude for sorting/display
  mag1: number; // Primary magnitude
  mag2: number; // Secondary magnitude
  sep: number; // Primary pair separation in arcseconds
  pa: number; // Primary pair position angle in degrees
  compCount: number; // 2 = double, >= 3 = multiple
  isMultiple: boolean; // compCount >= 3
  spec?: string; // Spectral type
  lastYear: number; // Latest WDS observation epoch
  name?: string; // Proper English name (matched to Hipparcos)
  koName?: string; // Proper Korean name (matched to Hipparcos)
  bayer?: string; // Bayer/Flamsteed designation
  con: string; // IAU 3-letter constellation abbreviation
  pairs?: DoubleStarPair[]; // Additional pairs in multiple star systems
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
  constellationLineOpacity: number; // 0.05..1.0
  showConstellationBoundaries: boolean;
  showConstellationNames: boolean;
  showSolarSystem: boolean;
  showPlanetSurface: boolean;
  showSolarSystemOrbits: boolean;
  showSolarSystemLabels: boolean;
  showStarColors: boolean;
  showDoubleStars: boolean;
  showDoublePairs: boolean; // 이중성 (2성)
  showMultipleStars: boolean; // 다중성 (3성 이상)
  doubleStarDensityPct: number; // 0..100 (% of currently visible on-screen systems)
  doubleStarMinSepArcsec: number; // Minimum separation filter in arcseconds
  showDoubleStarLabels: boolean;
  doubleStarLabelDensityPct: number; // 0..100
  showDso: boolean;
  showMessierCatalog: boolean; // 알려진 심우주 천체: 메시에 (M1-M110) 독립 표시
  showCaldwellCatalog: boolean; // 알려진 심우주 천체: 콜드웰 (C1-C109) 독립 표시
  dsoSymbolDensityPct: number; // 0..100 (% of currently visible on-screen DSOs to render)
  showDsoLabels: boolean;
  dsoLabelDensityPct: number; // 0..100 (% of currently visible on-screen DSOs to label)
  showStarLabels: boolean;
  starLabelDensityPct: number; // 0..100 (% of currently visible on-screen stars to label)
  showFieldStars: boolean;
  enableGaiaLive: boolean;
  magOffset: number; // -3.0 to +3.0 star limiting magnitude adjustment
  dsoMagOffset: number; // -4.0 to +4.0 DSO limiting magnitude adjustment
  dsoCategories: Record<DsoType, boolean>;
  catalogFilter: 'all' | 'messier' | 'ngc' | 'ic' | 'barnard';
  highlightSessionPlan: boolean; // 관측 목록 강조 모드
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
  eyepieceRotationDeg: number; // Clockwise rotation angle (0..360°) inside telescope eyepiece circle
  eyepieceLabel: string;
  eyepieceInputMode: 'direct' | 'calc';
  telescopeFocalLengthMm: number; // 망원경 초점거리 (mm)
  eyepieceFocalLengthMm: number; // 아이피스 초점거리 (mm)
  eyepieceAfovDeg: number; // 아이피스 겉보기 시야각 (AFOV, °)
  showSensorBox: boolean;
  sensorWidthDeg: number;
  sensorHeightDeg: number;
  showStarHop: boolean;
  showSelectionMark: boolean; // 선택 천체 타겟 마크 표시 여부
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
  | { kind: 'planet'; data: SolarSystemBody }
  | { kind: 'double'; data: DoubleStarSystem };

export interface ScreenTarget {
  kind: 'star' | 'dso' | 'planet' | 'double';
  id: string;
  x: number;
  y: number;
  radius: number;
  mag: number;
  item: SelectedItem;
}

export interface ObservingSessionEntry {
  id: string;
  kind: 'star' | 'dso' | 'planet' | 'double';
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

export type EquipmentCategory = 'telescope' | 'eyepiece' | 'barlow' | 'filter' | 'camera';

export interface EquipmentItem {
  id: string;
  category: EquipmentCategory;
  name: string;
  note?: string;
  apertureMm?: number;
  focalLengthMm?: number;
  opticalType?: string;
  afovDeg?: number;
  factor?: number;
  filterType?: string;
  sensorWidthMm?: number;
  sensorHeightMm?: number;
  pixelSizeUm?: number;
}

export interface EquipmentLockerState {
  items: EquipmentItem[];
  activeIds: Partial<Record<EquipmentCategory, string>>;
}

export interface SavedObservingSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  note?: string;
  bortle?: number; // Optional Bortle scale 1..9
  createdAt: number;
}


