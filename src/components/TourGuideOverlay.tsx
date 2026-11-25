import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Compass,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import { ThemeMode } from '../types/astronomy';
import { getUiTheme } from '../utils/themeClasses';
import { formatFovLabel, GuidedTourState } from '../utils/tonightTour';

interface TourGuideOverlayProps {
  tour: GuidedTourState;
  dwellProgress: number; // 0..1
  theme: ThemeMode;
  isCurrentCheckpointObserved?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onJump: (index: number) => void;
  onStop: () => void;
  onCycleDwellSec: () => void;
  onToggleObserved?: () => void;
}

/**
 * Compact floating tour overlay displaying playback controls and the current stop's
 * title, coordinates/FOV metadata, and observational guide commentary.
 */
export function TourGuideOverlay({
  tour,
  dwellProgress,
  theme,
  isCurrentCheckpointObserved,
  onPrev,
  onNext,
  onTogglePlay,
  onJump,
  onStop,
  onCycleDwellSec,
  onToggleObserved,
}: TourGuideOverlayProps) {
  const [guideCollapsed, setGuideCollapsed] = useState(false);

  if (!tour.active || tour.stops.length === 0) return null;

  const ui = getUiTheme(theme);
  const total = tour.stops.length;
  const stop = tour.stops[Math.min(Math.max(0, tour.currentIndex), total - 1)];

  const progressFill =
    theme === 'red'
      ? '#EF4444'
      : theme === 'white'
      ? '#2563EB'
      : '#22D3EE';

  const statusText = tour.completed
    ? '투어 완료'
    : !tour.playing
    ? '일시정지'
    : tour.phase === 'slewing'
    ? '이동 중'
    : '관측 중';

  return (
    <div
      className={`no-print pointer-events-auto absolute z-30 bottom-7 left-1/2 -translate-x-1/2 w-[min(460px,calc(100%-24px))] border shadow-2xl backdrop-blur-md overflow-hidden ${ui.hudOverlay}`}
      style={{ borderRadius: '10px' }}
      role="region"
      aria-label="챌린지 투어 안내 및 재생 제어"
    >
      {/* Top Progress Hairline */}
      <div className="w-full h-[2.5px] bg-slate-500/20 overflow-hidden">
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${
              tour.completed
                ? 100
                : tour.phase === 'slewing'
                ? 12
                : Math.max(4, Math.min(100, Math.round(dwellProgress * 100)))
            }%`,
            backgroundColor: progressFill,
          }}
        />
      </div>

      {/* Top Row: Tour Title + Counter + Playback Controls */}
      <div className={`px-2.5 py-1.5 flex items-center justify-between gap-2 border-b ${ui.divider}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className={`w-3.5 h-3.5 shrink-0 ${ui.accentText}`} />
          <span className={`text-[10.5px] font-semibold truncate tracking-[-0.04em] ${ui.textPrimary}`}>
            {tour.title}
          </span>
          <span className={`text-[9.5px] font-mono tabular-nums shrink-0 ${ui.textMuted}`}>
            {tour.currentIndex + 1}/{total}
          </span>
          <span className={`text-[9px] tracking-[-0.04em] shrink-0 hidden sm:inline ${ui.textMuted}`}>
            · {statusText}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onCycleDwellSec}
            title="체류 시간 변경 (5초 / 8초 / 12초)"
            className={`px-1.5 py-0.5 border text-[9.5px] font-mono tabular-nums flex items-center gap-0.5 transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span>{tour.dwellSec}s</span>
          </button>
          <button
            type="button"
            onClick={onPrev}
            disabled={tour.currentIndex <= 0}
            title="이전 대상 (←)"
            aria-label="이전 대상"
            className={`p-1 border transition-colors disabled:opacity-35 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            title={
              tour.completed
                ? '처음부터 다시 투어'
                : tour.playing
                ? '일시정지 (Space)'
                : '계속 재생 (Space)'
            }
            aria-label={tour.completed ? '다시 투어' : tour.playing ? '일시정지' : '계속 재생'}
            className={`p-1 border transition-colors ${ui.buttonActive}`}
            style={{ borderRadius: '4px' }}
          >
            {tour.completed ? (
              <RotateCcw className="w-3 h-3" />
            ) : tour.playing ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={tour.currentIndex >= total - 1}
            title="다음 대상 (→)"
            aria-label="다음 대상"
            className={`p-1 border transition-colors disabled:opacity-35 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <SkipForward className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setGuideCollapsed((v) => !v)}
            title={guideCollapsed ? '대상 설명 펼치기' : '대상 설명 접기'}
            aria-label={guideCollapsed ? '대상 설명 펼치기' : '대상 설명 접기'}
            className={`p-1 border transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            {guideCollapsed ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <button
            type="button"
            onClick={onStop}
            title="투어 종료 (Esc)"
            aria-label="투어 종료"
            className={`p-1 border transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Target Title, Metadata & Description */}
      {!guideCollapsed && stop && (
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`px-1.5 py-0.5 border font-mono text-[10px] font-bold leading-none shrink-0 ${ui.buttonActive}`}
                  style={{ borderRadius: '4px' }}
                >
                  {stop.code}
                </span>
                <span className={`text-[13px] font-semibold tracking-[-0.04em] truncate ${ui.textPrimary}`}>
                  {stop.title}
                </span>
              </div>
              <div className={`mt-0.5 flex items-center gap-2 flex-wrap text-[10px] font-mono tabular-nums ${ui.textMuted}`}>
                {stop.subtitle && <span>{stop.subtitle}</span>}
                <span className="inline-flex items-center gap-0.5">
                  <Compass className="w-2.5 h-2.5 shrink-0" />
                  고도 {stop.altDeg.toFixed(0)}° ({stop.compass})
                </span>
                <span>화각 {formatFovLabel(stop.recommendedFovDeg)}</span>
              </div>
            </div>

            {onToggleObserved && (
              <button
                type="button"
                onClick={onToggleObserved}
                title={isCurrentCheckpointObserved ? '관측 완료 해제' : '이 대상 관측 완료 표시'}
                className={`px-2 py-1 border text-[10px] font-medium flex items-center gap-1 shrink-0 transition-colors ${
                  isCurrentCheckpointObserved ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '5px' }}
              >
                {isCurrentCheckpointObserved ? (
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 shrink-0" />
                )}
                <span>{isCurrentCheckpointObserved ? '관측 완료' : '관측 체크'}</span>
              </button>
            )}
          </div>

          {stop.guideText && (
            <p className={`text-[11px] leading-relaxed tracking-[-0.03em] break-keep ${ui.textSecondary}`}>
              {stop.guideText}
            </p>
          )}

          {/* Quick Stop Selector Dots */}
          {total > 1 && total <= 24 && (
            <div className="pt-0.5 flex items-center gap-1 flex-wrap">
              {tour.stops.map((s, idx) => {
                const isCurrent = idx === tour.currentIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onJump(idx)}
                    title={`${idx + 1}. ${s.code} ${s.title}`}
                    aria-label={`${idx + 1}번 ${s.title}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      isCurrent
                        ? 'w-5 opacity-100'
                        : idx < tour.currentIndex
                        ? 'w-2 opacity-60 hover:opacity-100'
                        : 'w-2 opacity-25 hover:opacity-75'
                    }`}
                    style={{ backgroundColor: progressFill }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
