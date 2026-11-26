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

export interface CaldwellEntry extends DeepSkyObject {
  caldwellNumber: number; // 1..109
  caldwellId: string; // C1..C109
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
  gridLineWidth: number; // 0.2..2.5 좌표 그리드 선 굵기 (px)
  gridLineOpacity: number; // 0.05..1.0 좌표 그리드 선 진하기
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
  showSolarSun: boolean;
  showSolarPlanets: boolean;
  showSolarMoons: boolean;
  showSolarDwarfs: boolean;
  showSolarAsteroids: boolean;
  showSolarComets: boolean;
  cometObservableOnly: boolean; // 관측 가능한 혜성만 표시 (D/ 소멸·근일점 1년 경과 어두운 혜성 제외)
  cometMaxMag: number; // 6.0..18.0 혜성 한계 실시등급
  cometHideBelowHorizon: boolean; // 지평선 아래(고도 < 0°) 혜성 숨기기
  cometHideNearSun: boolean; // 태양 근처(이각 < 15°) 혜성 숨기기
  showPlanetSurface: boolean;
  showSolarSystemOrbits: boolean;
  showSolarSystemLabels: boolean;
  showStarOutlines: boolean;
  starOutlineOpacity: number; // 0.05..1.0 항성표시 원형 테두리 진하기
  showStarColors: boolean;
  showDoubleStars: boolean;
  showDoublePairs: boolean; // 이중성 (2성)
  showMultipleStars: boolean; // 다중성 (3성 이상)
  doubleStarDensityPct: number; // 0..100 (% of currently visible on-screen systems)
  doubleStarMinSepArcsec: number; // Minimum separation filter in arcseconds
  showDoubleStarLabels: boolean;
  doubleStarLabelDensityPct: number; // 0..100
  doubleStarSymbolOpacity: number; // 0.05..1.0 이중성 · 다중성 심볼 진하기
  doubleStarLabelOpacity: number; // 0.05..1.0 이중성 · 다중성 라벨 진하기
  showDso: boolean;
  showMessierCatalog: boolean; // 알려진 심우주 천체: 메시에 (M1-M110) 독립 표시
  showCaldwellCatalog: boolean; // 알려진 심우주 천체: 콜드웰 (C1-C109) 독립 표시
  dsoSymbolDensityPct: number; // 0..100 (% of currently visible on-screen DSOs to render)
  hideDsoSymbols?: boolean; // Runtime override: hide DSO symbols/rings while preserving DSO labels (e.g. during guided tour)
  showDsoLabels: boolean;
  dsoLabelDensityPct: number; // 0..100 (% of currently visible on-screen DSOs to label)
  dsoSymbolOpacity: number; // 0.05..1.0 심우주 천체 심볼 진하기
  dsoLabelOpacity: number; // 0.05..1.0 심우주 천체 라벨 진하기
  showStarLabels: boolean;
  starLabelLanguage?: 'ko' | 'en' | 'ko_en'; // 항성 이름 표시 언어 (한글 / 영어 / 한글(영어))
  showProperStarNames: boolean; // 알려진 항성 고유 이름 표시 (항성 이름 표시 OFF 시에도 표시)
  starLabelDensityPct: number; // 0..100 (% of currently visible on-screen stars to label)
  starLabelOpacity: number; // 0.05..1.0 항성 이름 표시 진하기
  showFieldStars: boolean;
  enableGaiaLive: boolean;
  magOffset: number; // -3.0 to +4.0 star limiting magnitude adjustment
  dsoMagOffset: number; // -4.0 to +4.0 DSO limiting magnitude adjustment
  dsoCategories: Record<DsoType, boolean>;
  catalogFilter: 'all' | 'messier' | 'ngc' | 'ic' | 'barnard';
  highlightSessionPlan: boolean; // 관측 목록 강조 모드
  sessionPlanColor: string; // #RRGGBB 오늘의 관측목록 성도 표시색
  sessionPlanOpacity: number; // 0.1..1.0 관측 목록 강조 모드 진하기
  challengeColor: string; // '' (코스 기본색) 또는 #RRGGBB 챌린지 성도 표시색
  challengeOpacity: number; // 0.05..1.0 성도 위 챌린지 노선·마커 투명도
  challengeLineWidth: number; // 0.3..3.0 성도 위 챌린지 노선 선 굵기 (px)
  showAtmosphericExtinction: boolean; // 대기 소광 효과 활성화 여부
  extinctionCoeff: number; // 0.10..0.80 대기 소광 계수 k (mag/airmass)
}

export interface MilkyWayLayer {
  id: string;
  polys: [number, number][][];
}

export interface SensorExportCaptionConfig {
  showTargetName: boolean; // 중심 천체명
  showCoordinates: boolean; // 적경·적위 좌표 (RA, Dec)
  showDateTime: boolean; // 관측 일시
  showLocation: boolean; // 관측지 이름
  showConstellation: boolean; // 별자리명
  showEquipmentFov: boolean; // 장비명 및 센서 화각 크기
  showRotation: boolean; // 좌표계(J2000) 및 지평 회전각
  showNoxChartBrand: boolean; // NoxChart 출처 표기
  customNote: string; // 사용자 추가 메모 / 촬영자 표기
}

export const DEFAULT_SENSOR_EXPORT_CAPTION: SensorExportCaptionConfig = {
  showTargetName: true,
  showCoordinates: true,
  showDateTime: true,
  showLocation: false,
  showConstellation: true,
  showEquipmentFov: true,
  showRotation: true,
  showNoxChartBrand: true,
  customNote: '',
};

export type OpticsLabelDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface OpticsSettings {
  showCrosshair: boolean; // 중앙 십자선
  showTelrad: boolean; // 0.5°, 2°, 4° concentric circles
  showFinder7x50: boolean; // 파인더 시야 링 (기본 7×50 파인더 7.0° 또는 내 장비 파인더)
  finderFovDeg?: number; // 활성 파인더 실 시야각 (°)
  finderLabel?: string; // 활성 파인더 이름
  finderColor?: string; // 활성 파인더 시야원 색상 (미지정 시 테마 기본색)
  finderCrosshair?: boolean; // 파인더 중심 십자선 표시 여부
  showEyepiece: boolean;
  eyepieceFovDeg: number; // Custom or calculated circular TFOV in degrees
  eyepieceRotationDeg: number; // Clockwise rotation angle (0..360°) inside telescope eyepiece circle
  eyepieceLabel: string;
  eyepieceInputMode: 'direct' | 'calc' | 'equipment';
  telescopeFocalLengthMm: number; // 망원경 초점거리 (mm)
  eyepieceFocalLengthMm: number; // 아이피스 초점거리 (mm)
  eyepieceAfovDeg: number; // 아이피스 겉보기 시야각 (AFOV, °)
  reticleLineWidth?: number; // 아이피스·파인더 시야연동 선 두께 (0.5..6.0 px)
  reticleOpacity?: number; // 아이피스·파인더 시야연동 선 투명도 (0.1..1.0)
  showReticleLabel?: boolean; // 연동 제목 표시 여부 (예: 파인더(7°), 아이피스(1.7°))
  reticleLabelDirection?: OpticsLabelDirection; // 연동 제목 8방향 위치
  showSensorBox: boolean;
  sensorWidthDeg: number;
  sensorHeightDeg: number;
  sensorRotationDeg: number; // Clockwise rotation angle (0..360°) of camera sensor framing box
  sensorEquipmentLabel?: string; // Active camera / telescope / smart scope label for sensor frame export
  sensorRotationLocked?: boolean; // True when a non-rotatable smart telescope is active
  sensorMosaicSupported?: boolean; // True when a mosaic-capable smart telescope is active
  sensorMosaicMaxScale?: number; // Max mosaic scale multiplier supported by active smart telescope (e.g., 2.0, 2.5)
  sensorMosaicScaleW?: number; // Horizontal mosaic multiplier (1.0 .. maxScale)
  sensorMosaicScaleH?: number; // Vertical mosaic multiplier (1.0 .. maxScale)
  sensorExportCaption?: SensorExportCaptionConfig; // 촬영센서 화각 PNG 저장 시 하단 설명 설정
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
  bortleEnabled: boolean; // 관측지 보틀 등급 광공해 효과 활성화 여부
  bortleClass: number; // 1..9 보틀 등급 (현재 관측지 기준 자동 설정 + 수동 조정 가능)
}

export type SolarSystemGroup = 'star' | 'planet' | 'dwarf' | 'asteroid' | 'comet' | 'moon';

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
  helioDistAu?: number; // Heliocentric distance in AU (comets)
  tailPaDeg?: number; // Anti-solar comet tail position angle on sky (0..360°, N through E)
  perihelionIso?: string; // Perihelion passage date YYYY-MM-DD (comets)
  perihelionDeltaDays?: number; // |JD_now - JD_Tp| in days from perihelion (comets)
  cometOrbitType?: string; // 'P' | 'C' | 'D' | 'A' | 'I' (comets)
  eccentricity?: number; // Orbital eccentricity e (comets)
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

export interface ObservingListGroup {
  id: string;
  name: string;
  createdAt: number;
  entries: ObservingSessionEntry[];
}

export interface ObservingListsState {
  lists: ObservingListGroup[];
  tonightListId: string | null;
  tonightEntries: ObservingSessionEntry[];
  tonightOrder?: string[];
  tonightLinkedOverrides?: Record<
    string,
    { observed?: boolean; notes?: string; excluded?: boolean }
  >;
}

export type ObservationSeeingGrade = 'excellent' | 'good' | 'fair' | 'poor' | '';

export interface ObservationLogEntry {
  id: string;
  objectId: string;
  objectKind: 'star' | 'dso' | 'planet' | 'double';
  objectName: string;
  constellation?: string;
  raDeg: number;
  decDeg: number;
  observedAt: number; // Epoch ms of observation date & time
  location: string; // 관측 장소
  equipment: string; // 사용 장비
  seeing?: ObservationSeeingGrade; // 시상
  transparency?: ObservationSeeingGrade; // 투명도
  rating?: number; // 1..5 optional rating
  notes: string; // 관측 내용
  createdAt: number;
  updatedAt: number;
}

export interface ObservedObjectStatus {
  objectId: string;
  objectKind: 'star' | 'dso' | 'planet' | 'double';
  objectName: string;
  constellation?: string;
  raDeg: number;
  decDeg: number;
  observed: boolean;
  updatedAt: number;
}

export interface ObservationLogStoreState {
  observedMap: Record<string, ObservedObjectStatus>;
  logs: ObservationLogEntry[];
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

export type EquipmentCategory = 'telescope' | 'eyepiece' | 'finder' | 'barlow' | 'filter' | 'camera';

export interface EquipmentItem {
  id: string;
  category: EquipmentCategory;
  name: string;
  note?: string;
  apertureMm?: number;
  focalLengthMm?: number;
  opticalType?: string;
  afovDeg?: number;
  magnification?: number;
  fovDeg?: number;
  finderColor?: string;
  finderCrosshair?: boolean;
  factor?: number;
  filterType?: string;
  sensorWidthMm?: number;
  sensorHeightMm?: number;
  pixelSizeUm?: number;
  isSmartTelescope?: boolean;
  supportsSensorRotation?: boolean;
  supportsMosaic?: boolean;
  mosaicMaxScale?: number;
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

export interface ChallengeGuidePolygon {
  id: string;
  label: string;
  closed: boolean;
  points: { name: string; ra: number; dec: number }[];
  color?: string;
}

export interface ChallengeBadgeRule {
  id: string;
  title: string;
  description: string;
  /** Checkpoint IDs required to unlock this badge (empty array means all checkpoints) */
  requiredCheckpointIds: string[];
  isMaster?: boolean;
}

export interface ChallengeCheckpoint {
  id: string;
  code: string;
  name: string;
  catalogId?: string;
  kind: 'dso' | 'star' | 'double' | 'planet';
  stage: string;
  constellation?: string;
  objectType?: string;
  mag?: number;
  ra?: number;
  dec?: number;
  fovDeg?: number;
  guideNote?: string;
  observed: boolean;
  observedAt?: number;
  logNote?: string;
}

export interface ChallengeTrack {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  season?: 'spring' | 'summer' | 'autumn' | 'winter' | 'all';
  lineColor: string;
  completedColor: string;
  activeOnChart: boolean;
  builtIn?: boolean;
  guidePolygons?: ChallengeGuidePolygon[];
  badges?: ChallengeBadgeRule[];
  checkpoints: ChallengeCheckpoint[];
  createdAt: number;
}

export type AsterismTool = 'select' | 'polyline' | 'polygon' | 'circle' | 'arrow' | 'label';
export type AsterismToolboxPopover = 'none' | 'props' | 'layers' | 'optics';
export type AsterismLineStyle = 'dashed' | 'dashdot' | 'solid';
export type AsterismLabelAnchor = 'top' | 'bottom' | 'left' | 'right';

export interface AsterismVertex {
  /** J2000.0 Right Ascension in degrees (0..360) */
  raDeg: number;
  /** J2000.0 Declination in degrees (-90..+90) */
  decDeg: number;
  /** Optional bound catalog identifier (e.g. "HIP 11767", "M45", "Gaia ...") */
  catalogId?: string;
  /** Optional display name of snapped star/DSO */
  starName?: string;
  /** Apparent magnitude of snapped star (for reference) */
  mag?: number;
}

export interface AsterismSavedView {
  /** Saved chart center RA in degrees (0..360) */
  raDeg: number;
  /** Saved chart center Dec in degrees (-90..+90) */
  decDeg: number;
  /** Saved chart field of view in degrees */
  fsz: number;
}

/**
 * Asterism entity (성군) — belongs to a Layer/Group (AsterismLayer),
 * and owns multiple child shape elements (AsterismObject[]).
 */
export interface AsterismGroup {
  id: string;
  layerId: string;
  name: string;
  visible: boolean;
  /** Optional multiline observation memo for this asterism */
  memo?: string;
  /** Optional recommended eyepiece / magnification note */
  eyepieceTag?: string;
  /** Scale-dependent FOV LOD visibility window [minFovDeg, maxFovDeg] ("표시 시야각") */
  visibleFovRange: [number, number];
  /** Optional saved chart center & FOV applied via "위치·시야 적용" */
  savedView?: AsterismSavedView;
  createdAt: number;
}

export interface AsterismObject {
  id: string;
  layerId: string;
  /** Parent AsterismGroup ID (성군 > 도형요소 계층) */
  asterismId: string;
  type: 'polyline' | 'polygon' | 'circle' | 'arrow' | 'label';
  vertices: AsterismVertex[];
  /** Angular radius in degrees for 'circle' shapes */
  radiusDeg?: number;
  /** Polyline mode: false = 선(직선 연결), true = 원호(부드러운 곡선) */
  smooth?: boolean;
  /** Line style: dashed | dashdot | solid */
  lineStyle: AsterismLineStyle;
  color: string;
  lineWidth: number; // 0.5..10.0 px
  opacity: number; // 0.1..1.0 (stroke opacity)
  /** Dedicated opacity for 'label' text elements (0.1..1.0) */
  textOpacity?: number;
  /** Dedicated font size in px for 'label' text elements (8..32 px) */
  textSize?: number;
  /** Polygon / Circle interior fill opacity (0..0.5) */
  fillAlpha?: number;
  /** Optional extension multiplier for direction vector (e.g. 2.5 = extend 2.5x beyond AB) */
  extensionFactor?: number;
  /** Legacy/fallback FOV range (rendering inherits parent AsterismGroup.visibleFovRange) */
  visibleFovRange: [number, number];
  /** Shape display name in manager (NOT rendered on star chart canvas) */
  label: string;
  /** Multiline text content for 'label' shapes (rendered on canvas) */
  memo?: string;
  /** Legacy optional recommended eyepiece tag */
  eyepieceTag?: string;
  /** Optional linked optical title rendered on circle rim (e.g. "파인더(7°)", "아이피스(1.7°)") */
  linkedTitle?: string;
  /** 8-direction rim placement for linkedTitle */
  linkedTitleDirection?: OpticsLabelDirection;
  /** Legacy upright label anchor */
  labelAnchor: AsterismLabelAnchor;
  createdAt: number;
}

export interface AsterismLayer {
  id: string;
  name: string;
  visible: boolean;
  createdAt: number;
}

export interface AsterismSettings {
  snapEnabled: boolean;
  snapRadiusPx: number; // 8..36 px
  snapMaxMag: number; // 4.0..14.0m (only snap stars brighter than or equal to this)
  allowFreeSpace: boolean;
  defaultLineStyle: AsterismLineStyle;
  defaultSmooth: boolean;
  defaultColor: string;
  defaultLineWidth: number; // 0.5..10.0 px
  defaultOpacity: number; // 0.1..1.0
  defaultTextOpacity: number; // 0.1..1.0
  defaultTextSize: number; // 8..32 px
  defaultFillAlpha: number; // 0..0.45
  defaultCircleFillEnabled: boolean;
  circleLinkEyepiece: boolean;
  circleLinkFinder: boolean;
  defaultExtensionFactor: number;
  defaultVisibleFovRange: [number, number];
  defaultLabelAnchor: AsterismLabelAnchor;
}

export interface AsterismStoreState {
  layers: AsterismLayer[];
  activeLayerId: string;
  asterisms: AsterismGroup[];
  activeAsterismId: string | null;
  objects: AsterismObject[];
  settings: AsterismSettings;
}

export interface AsterismSnapPreview {
  x: number;
  y: number;
  raDeg: number;
  decDeg: number;
  snapped: boolean;
  catalogId?: string;
  starName?: string;
  mag?: number;
}

export interface AsterismDraftState {
  type: 'polyline' | 'polygon' | 'circle' | 'arrow';
  vertices: AsterismVertex[];
}

export interface RulerPoint {
  /** J2000.0 Right Ascension in degrees (0..360) */
  raDeg: number;
  /** J2000.0 Declination in degrees (-90..+90) */
  decDeg: number;
  /** True when snapped to a celestial object (star, double star, DSO, planet) */
  snapped?: boolean;
  /** Optional display label of the snapped celestial object */
  label?: string;
}

export interface RulerMeasurement {
  start: RulerPoint;
  end: RulerPoint | null;
}
