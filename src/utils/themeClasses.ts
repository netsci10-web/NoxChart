import { ThemeMode } from '../types/astronomy';

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

export function getUiTheme(theme: ThemeMode): UiThemeStyles {
  if (theme === 'white') {
    return {
      shell: 'bg-slate-50 text-slate-900',
      header: 'bg-slate-200 border-slate-300 text-slate-900',
      panel: 'bg-white border-slate-200 text-slate-900',
      panelMuted: 'bg-slate-100/80 border-slate-200 text-slate-800',
      border: 'border-slate-200',
      textPrimary: 'text-slate-900',
      textSecondary: 'text-slate-700',
      textMuted: 'text-slate-500',
      input:
        'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none',
      buttonIdle:
        'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900',
      buttonActive:
        'bg-blue-600 text-white border-blue-600',
      buttonSave:
        'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800',
      buttonLoad:
        'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 hover:text-sky-800',
      accentText: 'text-blue-700',
      hudOverlay: 'bg-white/92 border-slate-300 text-slate-900',
      divider: 'border-slate-200',
    };
  }

  if (theme === 'red') {
    return {
      shell: 'bg-[#050000] text-[#DC2626]',
      header: 'bg-[#0B0101] border-[#3F0A0A] text-[#EF4444]',
      panel: 'bg-[#0B0101] border-[#3F0A0A] text-[#DC2626]',
      panelMuted: 'bg-[#150202] border-[#3F0A0A] text-[#EF4444]',
      border: 'border-[#3F0A0A]',
      textPrimary: 'text-[#EF4444]',
      textSecondary: 'text-[#DC2626]',
      textMuted: 'text-[#991B1B]',
      input:
        'bg-[#130202] border-[#5C1111] text-[#EF4444] placeholder:text-[#7F1D1D] focus:border-[#EF4444] focus:outline-none',
      buttonIdle:
        'bg-[#150202] text-[#DC2626] border-[#450A0A] hover:bg-[#240505] hover:text-[#FF4545]',
      buttonActive:
        'bg-[#7F1D1D] text-[#FF5C5C] border-[#DC2626]',
      buttonSave:
        'bg-[#2B0606] text-[#FF7878] border-[#8A1C1C] hover:bg-[#3E0909] hover:text-[#FFA0A0]',
      buttonLoad:
        'bg-[#1F0404] text-[#F87171] border-[#6E1616] hover:bg-[#310707] hover:text-[#FF9494]',
      accentText: 'text-[#FF3B3B]',
      hudOverlay: 'bg-[#0B0101]/92 border-[#5C1111] text-[#EF4444]',
      divider: 'border-[#3F0A0A]',
    };
  }

  // Dark Mode (Deep Space Obsidian)
  return {
    shell: 'bg-[#07090E] text-slate-100',
    header: 'bg-[#0B0F19] border-slate-800/90 text-slate-100',
    panel: 'bg-[#0D121E] border-slate-800/90 text-slate-100',
    panelMuted: 'bg-[#131A2A] border-slate-800 text-slate-200',
    border: 'border-slate-800/90',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-300',
    textMuted: 'text-slate-400',
    input:
      'bg-[#131A2A] border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none',
    buttonIdle:
      'bg-[#131A2A] text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white',
    buttonActive:
      'bg-cyan-600 text-white border-cyan-500',
    buttonSave:
      'bg-emerald-500/15 text-emerald-300 border-emerald-500/45 hover:bg-emerald-500/25 hover:text-emerald-200',
    buttonLoad:
      'bg-sky-500/15 text-sky-300 border-sky-500/45 hover:bg-sky-500/25 hover:text-sky-200',
    accentText: 'text-cyan-400',
    hudOverlay: 'bg-[#0B0F19]/90 border-slate-800 text-slate-200',
    divider: 'border-slate-800/80',
  };
}
