export type UiFontFamily =
  | 'default'
  | 'ibm_kr'
  | 'nanum_gothic'
  | 'gothic_a1'
  | 'gowun_dodum'
  | 'nanum_myeongjo'
  | 'system';

export interface UiFontOption {
  id: UiFontFamily;
  label: string;
  desc: string;
  cssFamily: string;
}

export const UI_FONT_OPTIONS: readonly UiFontOption[] = [
  {
    id: 'default',
    label: '기본 (IBM Plex · Noto)',
    desc: '균형 잡힌 표준 UI 글꼴',
    cssFamily: '"IBM Plex Sans", "Noto Sans KR", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'ibm_kr',
    label: 'IBM Plex KR',
    desc: '정밀 관측 기기풍 산세리프',
    cssFamily: '"IBM Plex Sans KR", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'nanum_gothic',
    label: '나눔고딕',
    desc: '슬림하고 선명한 가독성',
    cssFamily: '"Nanum Gothic", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'gothic_a1',
    label: '고딕 A1',
    desc: '단정하고 깔끔한 모던 고딕',
    cssFamily: '"Gothic A1", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'gowun_dodum',
    label: '고운돋움',
    desc: '부드럽고 편안한 한글 돋움',
    cssFamily: '"Gowun Dodum", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'nanum_myeongjo',
    label: '나눔명조',
    desc: '고전 성도 감성의 명조체',
    cssFamily: '"Nanum Myeongjo", Georgia, ui-serif, serif',
  },
  {
    id: 'system',
    label: '시스템 기본',
    desc: '기기 기본 탑재 글꼴',
    cssFamily: 'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  },
] as const;

export const UI_FONT_SIZE_MIN_STEP = -2;
export const UI_FONT_SIZE_MAX_STEP = 4;

export interface UiFontSizeMetrics {
  step: number;
  scale: number;
  pct: number;
  letterSpacingEm: number;
  wordSpacingEm: number;
  condenseX: number;
  condensePct: number;
}

const FONT_STEP_TABLE: Record<number, Omit<UiFontSizeMetrics, 'step'>> = {
  [-2]: {
    scale: 0.86,
    pct: 86,
    letterSpacingEm: 0,
    wordSpacingEm: 0,
    condenseX: 1,
    condensePct: 100,
  },
  [-1]: {
    scale: 0.93,
    pct: 93,
    letterSpacingEm: 0,
    wordSpacingEm: 0,
    condenseX: 1,
    condensePct: 100,
  },
  [0]: {
    scale: 1.0,
    pct: 100,
    letterSpacingEm: 0,
    wordSpacingEm: 0,
    condenseX: 1,
    condensePct: 100,
  },
  [1]: {
    scale: 1.08,
    pct: 108,
    letterSpacingEm: -0.045,
    wordSpacingEm: -0.05,
    condenseX: 0.94,
    condensePct: 94,
  },
  [2]: {
    scale: 1.16,
    pct: 116,
    letterSpacingEm: -0.075,
    wordSpacingEm: -0.09,
    condenseX: 0.88,
    condensePct: 88,
  },
  [3]: {
    scale: 1.24,
    pct: 124,
    letterSpacingEm: -0.1,
    wordSpacingEm: -0.13,
    condenseX: 0.83,
    condensePct: 83,
  },
  [4]: {
    scale: 1.32,
    pct: 132,
    letterSpacingEm: -0.12,
    wordSpacingEm: -0.16,
    condenseX: 0.78,
    condensePct: 78,
  },
};

export function isValidUiFontFamily(value: unknown): value is UiFontFamily {
  return (
    typeof value === 'string' && UI_FONT_OPTIONS.some((opt) => opt.id === value)
  );
}

export function getUiFontOption(family: UiFontFamily): UiFontOption {
  return UI_FONT_OPTIONS.find((opt) => opt.id === family) ?? UI_FONT_OPTIONS[0];
}

export function clampUiFontSizeStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(
    UI_FONT_SIZE_MIN_STEP,
    Math.min(UI_FONT_SIZE_MAX_STEP, Math.round(step))
  );
}

export function getUiFontSizeMetrics(step: number): UiFontSizeMetrics {
  const clamped = clampUiFontSizeStep(step);
  const entry = FONT_STEP_TABLE[clamped] ?? FONT_STEP_TABLE[0];
  return { step: clamped, ...entry };
}
