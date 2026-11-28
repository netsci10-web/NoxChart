import { ThemeMode, UiThemePresetId } from '../types/astronomy';

export interface UiThemeStyles {
  shell: string;
  header: string;
  panel: string;
  panelMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  input: string;
  buttonIdle: string;
  buttonActive: string;
  buttonSave: string;
  buttonLoad: string;
  accentText: string;
  hudOverlay: string;
  divider: string;
}

export interface UiThemePresetDefinition {
  id: UiThemePresetId;
  order: number;
  name: string;
  subtitle: string;
  accentName: string;
  description: string;
  chartMode: ThemeMode;
  isLight: boolean;
  bgMain: string;
  bgSurface: string;
  bgHover: string;
  accent: string;
  accentText: string;
  accentContrast: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  hudBg: string;
  inputBg: string;
}

export const UI_THEME_PRESETS: readonly UiThemePresetDefinition[] = [
  {
    id: 'pure-carbon',
    order: 1,
    name: '퓨어 카본 & 티타늄',
    subtitle: '기본 · 무채색 미니멀',
    accentName: '실버 화이트',
    description:
      '성도 캔버스 색상을 방해하지 않는 무채색. 메뉴에서 색채를 완전히 배제하여 캔버스 위의 별 등급별 색상(분광형)이나 성운의 본연의 색을 가장 정확하게 보여줍니다.',
    chartMode: 'dark',
    isLight: false,
    bgMain: '#121212',
    bgSurface: '#1E1E1E',
    bgHover: '#2B2B2B',
    accent: '#E4E4E7',
    accentText: '#E4E4E7',
    accentContrast: '#121212',
    textPrimary: '#FAFAFA',
    textSecondary: '#D4D4D8',
    textMuted: '#A1A1AA',
    border: '#2E2E2E',
    hudBg: 'rgba(30, 30, 30, 0.94)',
    inputBg: '#1E1E1E',
  },
  {
    id: 'warm-paper',
    order: 2,
    name: '웜 페이퍼 라이트',
    subtitle: '인쇄·주간 편집용',
    accentName: '인디고 네이비',
    description:
      '출력용 반전 성도(흰 배경·검은 별) 제작용. 실제 종이 인쇄물과 화면의 대비 차이를 줄여 출력 결과를 정확히 가늠할 수 있습니다.',
    chartMode: 'white',
    isLight: true,
    bgMain: '#F8F7F4',
    bgSurface: '#EFECE6',
    bgHover: '#E5E0D7',
    accent: '#1E3A8A',
    accentText: '#1E3A8A',
    accentContrast: '#FFFFFF',
    textPrimary: '#1F2937',
    textSecondary: '#374151',
    textMuted: '#6B7280',
    border: '#D6D3CD',
    hudBg: 'rgba(239, 236, 230, 0.95)',
    inputBg: '#FFFFFF',
  },
  {
    id: 'red-night',
    order: 3,
    name: '적색 암순응 모드',
    subtitle: '야간 필드용',
    accentName: '딥 레드',
    description:
      '실제 관측지 현장 필수 테마. 동공 수축을 막아 암순응을 유지하며, 반전 백색 성도를 띄울 때도 눈부심을 최소화합니다.',
    chartMode: 'red',
    isLight: false,
    bgMain: '#0A0202',
    bgSurface: '#170505',
    bgHover: '#280909',
    accent: '#DC2626',
    accentText: '#EF4444',
    accentContrast: '#FFF5F5',
    textPrimary: '#FCA5A5',
    textSecondary: '#EF4444',
    textMuted: '#B91C1C',
    border: '#3B0A0A',
    hudBg: 'rgba(23, 5, 5, 0.94)',
    inputBg: '#140404',
  },
  {
    id: 'deep-navy',
    order: 4,
    name: '딥 나이트 네이비',
    subtitle: '천문 앱 표준 다크',
    accentName: '시안 블루',
    description:
      '가장 무난한 천문 앱 표준. 어두운 밤하늘 캔버스와 자연스럽게 어우러지며 장시간 편집 시 눈의 피로가 적습니다.',
    chartMode: 'dark',
    isLight: false,
    bgMain: '#0B0F19',
    bgSurface: '#131A2A',
    bgHover: '#1D2840',
    accent: '#38BDF8',
    accentText: '#38BDF8',
    accentContrast: '#07131F',
    textPrimary: '#E2E8F0',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    border: '#1E293B',
    hudBg: 'rgba(19, 26, 42, 0.94)',
    inputBg: '#131A2A',
  },
  {
    id: 'midnight-amber',
    order: 5,
    name: '미드나잇 슬레이트 & 앰버',
    subtitle: '광학 장비 감성',
    accentName: '웜 앰버',
    description:
      '고급 광학 장비·성도집 감성. 차가운 무채색 배경에 따뜻한 호박색 포인트를 주어 시야원(FOV)이나 천체 좌표 표시가 직관적입니다.',
    chartMode: 'dark',
    isLight: false,
    bgMain: '#121417',
    bgSurface: '#1C1F24',
    bgHover: '#272B33',
    accent: '#F59E0B',
    accentText: '#FBBF24',
    accentContrast: '#121417',
    textPrimary: '#F3F4F6',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    border: '#2E323B',
    hudBg: 'rgba(28, 31, 36, 0.94)',
    inputBg: '#1C1F24',
  },
  {
    id: 'antique-parchment',
    order: 6,
    name: '앤티크 양피지 & 청동',
    subtitle: '클래식 성도집',
    accentName: '버니시드 브론즈',
    description:
      '17~18세기 고전 별자리 지도 감성. 출력용 반전 성도에 별자리 그림(아스테리즘)이나 고전적인 장식 요소를 얹을 때 가장 잘 어울립니다.',
    chartMode: 'white',
    isLight: true,
    bgMain: '#F4EFE6',
    bgSurface: '#E8DFD1',
    bgHover: '#DED2BF',
    accent: '#9A3412',
    accentText: '#9A3412',
    accentContrast: '#FFFBEB',
    textPrimary: '#292524',
    textSecondary: '#44403C',
    textMuted: '#78716C',
    border: '#D6CCC2',
    hudBg: 'rgba(232, 223, 209, 0.95)',
    inputBg: '#FAF7F0',
  },
  {
    id: 'obsidian-emerald',
    order: 7,
    name: '옵시디언 & 에메랄드',
    subtitle: '관측 제어 콘솔',
    accentName: '에메랄드 그린',
    description:
      'N.I.N.A.·천체촬영 제어 툴 스타일. 차분한 흑녹색 배경에 시인성 높은 에메랄드 포인트를 주어 좌표나 노출 설정 등 수치 데이터를 읽기에 쾌적합니다.',
    chartMode: 'dark',
    isLight: false,
    bgMain: '#090D0C',
    bgSurface: '#111917',
    bgHover: '#1A2623',
    accent: '#10B981',
    accentText: '#34D399',
    accentContrast: '#052E16',
    textPrimary: '#ECFDF5',
    textSecondary: '#A7F3D0',
    textMuted: '#6EE7B7',
    border: '#1E2E2A',
    hudBg: 'rgba(17, 25, 23, 0.94)',
    inputBg: '#111917',
  },
  {
    id: 'cosmic-violet',
    order: 8,
    name: '코스믹 바이올렛',
    subtitle: '성운·딥스카이 감성',
    accentName: '네뷸라 퍼플',
    description:
      '딥스카이(성운·은하) 관측 특화. 깊은 보랏빛 어둠 속에 자수정 색상을 배치해 메시에(Messier)·NGC 목록을 탐색할 때 신비로운 몰입감을 줍니다.',
    chartMode: 'dark',
    isLight: false,
    bgMain: '#100B1C',
    bgSurface: '#19122B',
    bgHover: '#251B3E',
    accent: '#A855F7',
    accentText: '#C084FC',
    accentContrast: '#FFFFFF',
    textPrimary: '#F3E8FF',
    textSecondary: '#D8B4FE',
    textMuted: '#A78BFA',
    border: '#2E214D',
    hudBg: 'rgba(25, 18, 43, 0.94)',
    inputBg: '#19122B',
  },
  {
    id: 'frost-blue',
    order: 9,
    name: '프로스트 블루',
    subtitle: '주간·설계 도면용',
    accentName: '오션 블루',
    description:
      '정밀 광학 설계도(청사진) 느낌. 밝고 차가운 회청색 톤으로, 주간에 아이피스 시야원(FOV) 계산이나 관측 계획을 짤 때 깔끔하고 정돈된 인상을 줍니다.',
    chartMode: 'white',
    isLight: true,
    bgMain: '#F1F5F9',
    bgSurface: '#E2E8F0',
    bgHover: '#CBD5E1',
    accent: '#0284C7',
    accentText: '#0369A1',
    accentContrast: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    border: '#CBD5E1',
    hudBg: 'rgba(226, 232, 240, 0.95)',
    inputBg: '#FFFFFF',
  },
];

const PRESET_MAP = new Map<UiThemePresetId, UiThemePresetDefinition>(
  UI_THEME_PRESETS.map((p) => [p.id, p])
);

export function isValidUiThemePresetId(value: unknown): value is UiThemePresetId {
  return typeof value === 'string' && PRESET_MAP.has(value as UiThemePresetId);
}

export function getUiThemePreset(id: UiThemePresetId): UiThemePresetDefinition {
  return PRESET_MAP.get(id) ?? UI_THEME_PRESETS[0];
}

export function getDefaultPresetForThemeMode(mode: ThemeMode): UiThemePresetId {
  if (mode === 'red') return 'red-night';
  if (mode === 'white') return 'warm-paper';
  return 'pure-carbon';
}

export function applyUiThemePresetToDom(presetId: UiThemePresetId): UiThemePresetDefinition {
  const preset = getUiThemePreset(presetId);
  if (typeof document !== 'undefined') {
    const el = document.documentElement;
    el.dataset.uiTheme = preset.id;
    el.style.setProperty('--ui-bg-main', preset.bgMain);
    el.style.setProperty('--ui-bg-surface', preset.bgSurface);
    el.style.setProperty('--ui-bg-hover', preset.bgHover);
    el.style.setProperty('--ui-accent', preset.accent);
    el.style.setProperty('--ui-accent-text', preset.accentText);
    el.style.setProperty('--ui-accent-contrast', preset.accentContrast);
    el.style.setProperty('--ui-text-primary', preset.textPrimary);
    el.style.setProperty('--ui-text-secondary', preset.textSecondary);
    el.style.setProperty('--ui-text-muted', preset.textMuted);
    el.style.setProperty('--ui-border', preset.border);
    el.style.setProperty('--ui-hud-bg', preset.hudBg);
    el.style.setProperty('--ui-input-bg', preset.inputBg);
  }
  return preset;
}

export function getUiTheme(theme: ThemeMode): UiThemeStyles {
  if (theme === 'red') {
    return {
      shell: 'bg-[var(--ui-bg-main,#0A0202)] text-[var(--ui-text-primary,#FCA5A5)]',
      header:
        'bg-[var(--ui-bg-main,#0A0202)] border-[var(--ui-border,#3B0A0A)] text-[var(--ui-text-primary,#FCA5A5)]',
      panel:
        'bg-[var(--ui-bg-main,#0A0202)] border-[var(--ui-border,#3B0A0A)] text-[var(--ui-text-primary,#FCA5A5)]',
      panelMuted:
        'bg-[var(--ui-bg-surface,#170505)] border-[var(--ui-border,#3B0A0A)] text-[var(--ui-text-primary,#FCA5A5)]',
      border: 'border-[var(--ui-border,#3B0A0A)]',
      textPrimary: 'text-[var(--ui-text-primary,#FCA5A5)]',
      textSecondary: 'text-[var(--ui-text-secondary,#EF4444)]',
      textMuted: 'text-[var(--ui-text-muted,#B91C1C)]',
      input:
        'bg-[var(--ui-input-bg,#140404)] border-[var(--ui-border,#5C1111)] text-[var(--ui-text-primary,#FCA5A5)] placeholder:text-[var(--ui-text-muted,#7F1D1D)] focus:border-[var(--ui-accent,#DC2626)] focus:outline-none',
      buttonIdle:
        'bg-[var(--ui-bg-surface,#170505)] text-[var(--ui-text-secondary,#EF4444)] border-[var(--ui-border,#3B0A0A)] hover:bg-[var(--ui-bg-hover,#280909)] hover:text-[var(--ui-text-primary,#FCA5A5)]',
      buttonActive:
        'bg-[var(--ui-accent,#DC2626)] text-[var(--ui-accent-contrast,#FFF5F5)] border-[var(--ui-accent,#DC2626)]',
      buttonSave:
        'bg-[#2B0606] text-[#FF7878] border-[#8A1C1C] hover:bg-[#3E0909] hover:text-[#FFA0A0]',
      buttonLoad:
        'bg-[#1F0404] text-[#F87171] border-[#6E1616] hover:bg-[#310707] hover:text-[#FF9494]',
      accentText: 'text-[var(--ui-accent-text,#EF4444)]',
      hudOverlay:
        'bg-[var(--ui-hud-bg,rgba(10,2,2,0.94))] border-[var(--ui-border,#5C1111)] text-[var(--ui-text-primary,#FCA5A5)]',
      divider: 'border-[var(--ui-border,#3B0A0A)]',
    };
  }

  if (theme === 'white') {
    return {
      shell: 'bg-[var(--ui-bg-main,#F8F7F4)] text-[var(--ui-text-primary,#1F2937)]',
      header:
        'bg-[var(--ui-bg-surface,#EFECE6)] border-[var(--ui-border,#D6D3CD)] text-[var(--ui-text-primary,#1F2937)]',
      panel:
        'bg-[var(--ui-bg-main,#F8F7F4)] border-[var(--ui-border,#D6D3CD)] text-[var(--ui-text-primary,#1F2937)]',
      panelMuted:
        'bg-[var(--ui-bg-surface,#EFECE6)] border-[var(--ui-border,#D6D3CD)] text-[var(--ui-text-primary,#1F2937)]',
      border: 'border-[var(--ui-border,#D6D3CD)]',
      textPrimary: 'text-[var(--ui-text-primary,#1F2937)]',
      textSecondary: 'text-[var(--ui-text-secondary,#374151)]',
      textMuted: 'text-[var(--ui-text-muted,#6B7280)]',
      input:
        'bg-[var(--ui-input-bg,#FFFFFF)] border-[var(--ui-border,#D6D3CD)] text-[var(--ui-text-primary,#1F2937)] placeholder:text-[var(--ui-text-muted,#9CA3AF)] focus:border-[var(--ui-accent,#1E3A8A)] focus:outline-none',
      buttonIdle:
        'bg-[var(--ui-bg-surface,#EFECE6)] text-[var(--ui-text-secondary,#374151)] border-[var(--ui-border,#D6D3CD)] hover:bg-[var(--ui-bg-hover,#E5E0D7)] hover:text-[var(--ui-text-primary,#1F2937)]',
      buttonActive:
        'bg-[var(--ui-accent,#1E3A8A)] text-[var(--ui-accent-contrast,#FFFFFF)] border-[var(--ui-accent,#1E3A8A)]',
      buttonSave:
        'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800',
      buttonLoad:
        'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 hover:text-sky-800',
      accentText: 'text-[var(--ui-accent-text,#1E3A8A)]',
      hudOverlay:
        'bg-[var(--ui-hud-bg,rgba(248,247,244,0.94))] border-[var(--ui-border,#D6D3CD)] text-[var(--ui-text-primary,#1F2937)]',
      divider: 'border-[var(--ui-border,#D6D3CD)]',
    };
  }

  // Dark Modes (Default: Pure Carbon & Titanium, plus Deep Navy, Midnight Slate & Amber, Obsidian & Emerald, Cosmic Violet)
  return {
    shell: 'bg-[var(--ui-bg-main,#121212)] text-[var(--ui-text-primary,#FAFAFA)]',
    header:
      'bg-[var(--ui-bg-main,#121212)] border-[var(--ui-border,#2E2E2E)] text-[var(--ui-text-primary,#FAFAFA)]',
    panel:
      'bg-[var(--ui-bg-main,#121212)] border-[var(--ui-border,#2E2E2E)] text-[var(--ui-text-primary,#FAFAFA)]',
    panelMuted:
      'bg-[var(--ui-bg-surface,#1E1E1E)] border-[var(--ui-border,#2E2E2E)] text-[var(--ui-text-primary,#FAFAFA)]',
    border: 'border-[var(--ui-border,#2E2E2E)]',
    textPrimary: 'text-[var(--ui-text-primary,#FAFAFA)]',
    textSecondary: 'text-[var(--ui-text-secondary,#D4D4D8)]',
    textMuted: 'text-[var(--ui-text-muted,#A1A1AA)]',
    input:
      'bg-[var(--ui-input-bg,#1E1E1E)] border-[var(--ui-border,#2E2E2E)] text-[var(--ui-text-primary,#FAFAFA)] placeholder:text-[var(--ui-text-muted,#A1A1AA)] focus:border-[var(--ui-accent,#E4E4E7)] focus:outline-none',
    buttonIdle:
      'bg-[var(--ui-bg-surface,#1E1E1E)] text-[var(--ui-text-secondary,#D4D4D8)] border-[var(--ui-border,#2E2E2E)] hover:bg-[var(--ui-bg-hover,#2B2B2B)] hover:text-[var(--ui-text-primary,#FAFAFA)]',
    buttonActive:
      'bg-[var(--ui-accent,#E4E4E7)] text-[var(--ui-accent-contrast,#121212)] border-[var(--ui-accent,#E4E4E7)]',
    buttonSave:
      'bg-emerald-500/15 text-emerald-300 border-emerald-500/45 hover:bg-emerald-500/25 hover:text-emerald-200',
    buttonLoad:
      'bg-sky-500/15 text-sky-300 border-sky-500/45 hover:bg-sky-500/25 hover:text-sky-200',
    accentText: 'text-[var(--ui-accent-text,#E4E4E7)]',
    hudOverlay:
      'bg-[var(--ui-hud-bg,rgba(30,30,30,0.94))] border-[var(--ui-border,#2E2E2E)] text-[var(--ui-text-primary,#FAFAFA)]',
    divider: 'border-[var(--ui-border,#2E2E2E)]',
  };
}
