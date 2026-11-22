import React from 'react';
import {
  CheckCircle2,
  Circle,
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
import {
  formatFovLabel,
  GuidedTourState,
  TOUR_DWELL_OPTIONS,
} from '../utils/tonightTour';

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

export function TourGuideOverlay({
  tour,
  dwellProgress,
  theme,
  isCurrentCheckpointObserved = false,
  onPrev,
  onNext,
  onTogglePlay,
  onJump,
  onStop,
  onCycleDwellSec,
  onToggleObserved,
}: TourGuideOverlayProps) {
  if (!tour.active || tour.stops.length === 0) return null;

  const ui = getUiTheme(theme);
  const stop = tour.stops[tour.currentIndex] ?? tour.stops[0];
  const total = tour.stops.length;

  const progressFill =
    theme === 'red'
      ? '#EF4444'
      : theme === 'white'
      ? '#2563EB'
      : '#22D3EE';

  const statusText = tour.completed
    ? '투어 완료'
    : !tour.playing
    ? tour.pausedByUser
      ? '일시정지 · 수동 조작'
      : '일시정지'
    : tour.phase === 'slewing'
    ? '시야각·방향 이동 중…'
    : `자동 순회 · ${tour.dwellSec}초`;

  const nextDwellIdx =
    (TOUR_DWELL_OPTIONS.indexOf(tour.dwellSec as (typeof TOUR_DWELL_OPTIONS)[number]) + 1) %
    TOUR_DWELL_OPTIONS.length;
  const nextDwellSec = TOUR_DWELL_OPTIONS[nextDwellIdx];

  return (
    <div
      className={`no-print pointer-events-auto absolute z-30 bottom-3 left-1/2 -translate-x-1/2 w-[min(470px,calc(100%-24px))] border shadow-xl backdrop-blur-md overflow-hidden ${ui.hudOverlay}`}
      style={{ borderRadius: '10px' }}
      role="region"
      aria-label="오늘의 투어 자동 순회 가이드"
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

      <div className="px-3 py-2 space-y-1.5">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${ui.accentText}`} />
            <span className={`text-[10.5px] font-semibold truncate ${ui.textPrimary}`}>
              {tour.title}
            </span>
            <span
              className={`px-1.5 py-[1px] border text-[9px] font-mono tabular-nums whitespace-nowrap shrink-0 ${
                tour.playing && tour.phase === 'slewing'
                  ? ui.buttonActive
                  : `${ui.border} ${ui.textMuted}`
              }`}
              style={{ borderRadius: '4px' }}
            >
              {statusText}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-mono tabular-nums font-semibold ${ui.accentText}`}>
              {tour.currentIndex + 1} / {total}
            </span>
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

        {/* Target Info */}
        <div className="space-y-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className={`font-mono text-[11.5px] font-bold shrink-0 ${ui.accentText}`}>
                {stop.code}
              </span>
              <h3 className={`text-[13px] font-semibold truncate tracking-[-0.03em] ${ui.textPrimary}`}>
                {stop.title}
              </h3>
            </div>
            <span
              className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.textMuted}`}
              title="자동 설정된 시야각"
            >
              화각 {formatFovLabel(stop.recommendedFovDeg)}
            </span>
          </div>
          <div className={`text-[9.5px] font-mono tabular-nums truncate ${ui.textMuted}`}>
            {stop.subtitle} · 고도 {stop.altDeg.toFixed(0)}°({stop.compass})
          </div>
          <p className={`text-[11px] leading-snug break-keep pt-0.5 ${ui.textSecondary}`}>
            {stop.guideText}
          </p>
        </div>

        {/* Controls & Step Dots */}
        <div className={`pt-1.5 border-t flex items-center justify-between gap-2 ${ui.divider}`}>
          <div className="flex items-center gap-1">
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
              className={`px-2 py-1 border text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${ui.buttonActive}`}
              style={{ borderRadius: '4px' }}
            >
              {tour.completed ? (
                <>
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  <span>다시 투어</span>
                </>
              ) : tour.playing ? (
                <>
                  <Pause className="w-3 h-3 shrink-0" />
                  <span>일시정지</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 shrink-0" />
                  <span>계속</span>
                </>
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
              onClick={onCycleDwellSec}
              title={`머무름 시간 변경 (클릭 시 ${nextDwellSec}초)`}
              className={`px-1.5 py-1 border text-[9.5px] font-mono tabular-nums transition-colors ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              {tour.dwellSec}초
            </button>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {total <= 14 && (
              <div className="hidden sm:flex items-center gap-1">
                {tour.stops.map((s, idx) => {
                  const active = idx === tour.currentIndex;
                  const passed = idx < tour.currentIndex;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onJump(idx)}
                      title={`${idx + 1}. ${s.code} ${s.title}`}
                      aria-label={`${idx + 1}번 ${s.title}로 이동`}
                      className={`h-1.5 rounded-full transition-all ${
                        active ? 'w-3.5' : 'w-1.5 opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: active
                          ? progressFill
                          : passed
                          ? progressFill
                          : 'rgba(148, 163, 184, 0.45)',
                      }}
                    />
                  );
                })}
              </div>
            )}

            {tour.trackId && stop.checkpointId && onToggleObserved && (
              <button
                type="button"
                onClick={onToggleObserved}
                title={isCurrentCheckpointObserved ? '관측 완료 취소' : '이 대상 관측 완료 체크'}
                className={`px-1.5 py-1 border text-[9.5px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                  isCurrentCheckpointObserved ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
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
        </div>
      </div>
    </div>
  );
}
