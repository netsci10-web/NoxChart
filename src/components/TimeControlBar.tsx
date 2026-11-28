import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { ObserverConfig, ThemeMode } from '../types/astronomy';

type TimeUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  year: '년',
  month: '월',
  day: '일',
  hour: '시',
  minute: '분',
  second: '초',
};

const TIME_SPEED_STEPS = [
  -2592000, -864000, -432000, -86400, -14400, -3600, -900, -300, -60, -10, -1,
  1, 10, 60, 300, 900, 3600, 14400, 86400, 432000, 864000, 2592000,
];

function formatTimeRateBadge(rate: number): string {
  const sign = rate < 0 ? '-' : '';
  const abs = Math.abs(rate);
  let unitText: string;
  if (abs < 60) {
    unitText = `${abs}초`;
  } else if (abs < 3600) {
    unitText = `${Math.round(abs / 60)}분`;
  } else if (abs < 86400) {
    unitText = `${Math.round(abs / 3600)}시간`;
  } else {
    unitText = `${Math.round(abs / 86400)}일`;
  }
  return `${sign}x${abs}(${unitText})`;
}

function addTimeUnit(baseMs: number, unit: TimeUnit, delta: number): number {
  const d = new Date(baseMs);
  switch (unit) {
    case 'year': {
      const targetYear = d.getFullYear() + delta;
      const month = d.getMonth();
      const origDay = d.getDate();
      const maxDay = new Date(targetYear, month + 1, 0).getDate();
      d.setFullYear(targetYear, month, Math.min(origDay, maxDay));
      return d.getTime();
    }
    case 'month': {
      const origDay = d.getDate();
      const totalMonths = d.getFullYear() * 12 + d.getMonth() + delta;
      const targetYear = Math.floor(totalMonths / 12);
      const targetMonth = ((totalMonths % 12) + 12) % 12;
      const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      d.setFullYear(targetYear, targetMonth, Math.min(origDay, maxDay));
      return d.getTime();
    }
    case 'day':
      d.setDate(d.getDate() + delta);
      return d.getTime();
    case 'hour':
      d.setHours(d.getHours() + delta);
      return d.getTime();
    case 'minute':
      d.setMinutes(d.getMinutes() + delta);
      return d.getTime();
    case 'second':
      d.setSeconds(d.getSeconds() + delta);
      return d.getTime();
  }
}

interface TimeControlBarProps {
  theme: ThemeMode;
  observer: ObserverConfig;
  onChangeObserver: (updater: (prev: ObserverConfig) => ObserverConfig) => void;
  onCollapse?: () => void;
}

export function TimeControlBar({
  theme,
  observer,
  onChangeObserver,
  onCollapse,
}: TimeControlBarProps) {
  const [selectedUnit, setSelectedUnit] = useState<TimeUnit>('hour');

  const displayMs = observer.timestampMs;

  const d = new Date(displayMs);
  const parts: { unit: TimeUnit; value: string; gapAfter?: boolean }[] = [
    { unit: 'year', value: String(d.getFullYear()) },
    { unit: 'month', value: String(d.getMonth() + 1).padStart(2, '0') },
    { unit: 'day', value: String(d.getDate()).padStart(2, '0'), gapAfter: true },
    { unit: 'hour', value: String(d.getHours()).padStart(2, '0') },
    { unit: 'minute', value: String(d.getMinutes()).padStart(2, '0') },
    { unit: 'second', value: String(d.getSeconds()).padStart(2, '0') },
  ];

  const stepSelectedUnit = (delta: number, unitOverride?: TimeUnit) => {
    const targetUnit = unitOverride ?? selectedUnit;
    onChangeObserver((p) => {
      const baseMs = p.isPlaying && p.useLiveTime ? Date.now() : p.timestampMs;
      return {
        ...p,
        useLiveTime: false,
        timestampMs: addTimeUnit(baseMs, targetUnit, delta),
      };
    });
  };

  const handleResetNow = () => {
    const now = Date.now();
    onChangeObserver((p) => ({
      ...p,
      useLiveTime: true,
      isPlaying: true,
      timeRateSecPerSec: 1,
      timestampMs: now,
    }));
  };

  const handleTogglePlay = () => {
    onChangeObserver((p) => {
      const nextPlaying = !p.isPlaying;
      const keepLive = nextPlaying && p.useLiveTime && p.timeRateSecPerSec === 1;
      return {
        ...p,
        useLiveTime: keepLive,
        timestampMs: p.isPlaying && p.useLiveTime ? Date.now() : p.timestampMs,
        isPlaying: nextPlaying,
      };
    });
  };

  const handleDecelerate = () => {
    onChangeObserver((p) => {
      const idx = TIME_SPEED_STEPS.findIndex((v) => v >= p.timeRateSecPerSec);
      const curIdx = idx === -1 ? TIME_SPEED_STEPS.length - 1 : idx;
      const nextIdx = Math.max(0, curIdx - 1);
      return {
        ...p,
        useLiveTime: false,
        isPlaying: true,
        timestampMs: p.useLiveTime ? Date.now() : p.timestampMs,
        timeRateSecPerSec: TIME_SPEED_STEPS[nextIdx],
      };
    });
  };

  const handleAccelerate = () => {
    onChangeObserver((p) => {
      const idx = TIME_SPEED_STEPS.findIndex((v) => v >= p.timeRateSecPerSec);
      const curIdx = idx === -1 ? TIME_SPEED_STEPS.length - 1 : idx;
      const nextIdx = Math.min(TIME_SPEED_STEPS.length - 1, curIdx + 1);
      return {
        ...p,
        useLiveTime: false,
        isPlaying: true,
        timestampMs: p.useLiveTime ? Date.now() : p.timestampMs,
        timeRateSecPerSec: TIME_SPEED_STEPS[nextIdx],
      };
    });
  };

  const barCls =
    'bg-[var(--ui-bg-main)] border-[var(--ui-border)] text-[var(--ui-text-primary)]';

  const clockSegmentIdleCls =
    'text-[var(--ui-accent-text)] border-transparent hover:bg-[var(--ui-bg-hover)] hover:border-[var(--ui-border)]';

  const clockSegmentActiveCls =
    'bg-[var(--ui-accent)] border-[var(--ui-accent)] text-[var(--ui-accent-contrast)] shadow-xs';

  const unitSuffixIdleCls = 'text-[var(--ui-text-muted)]';

  const unitSuffixActiveCls = 'text-[var(--ui-accent-contrast)] opacity-80';

  const minusBtnCls =
    'bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] hover:text-[var(--ui-accent-text)]';

  const plusBtnCls =
    'bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] hover:text-[var(--ui-accent-text)]';

  const capsuleCls = 'bg-[var(--ui-bg-surface)] border-[var(--ui-border)]';

  const decelBtnCls =
    'bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] hover:text-[var(--ui-accent-text)]';

  const accelBtnCls =
    'bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] hover:text-[var(--ui-accent-text)]';

  const playBtnCls = observer.isPlaying
    ? 'bg-[var(--ui-accent)] border-[var(--ui-accent)] text-[var(--ui-accent-contrast)]'
    : 'bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)]';

  const isLiveNow = observer.useLiveTime;
  const nowBtnCls = isLiveNow
    ? 'bg-[var(--ui-bg-hover)] border-[var(--ui-accent)] text-[var(--ui-accent-text)]'
    : 'bg-[var(--ui-bg-surface)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] hover:text-[var(--ui-text-primary)]';

  const speedBadgeCls =
    'bg-[var(--ui-bg-surface)] border-[var(--ui-accent)] text-[var(--ui-accent-text)]';

  const activeUnitLabel = TIME_UNIT_LABELS[selectedUnit];

  const collapseBtnCls =
    'bg-[var(--ui-accent)] hover:opacity-90 text-[var(--ui-accent-contrast)] border-[var(--ui-border)] shadow-xs';

  return (
    <div
      className={`no-print shrink-0 border-t px-3 pt-1.5 flex items-center justify-center gap-2 flex-wrap select-none ${barCls}`}
      style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Left: [v] [-] [YYYY년 MM월 DD일  HH시 MM분 SS초] [+] */}
      <div className="flex items-center justify-center gap-1.5 shrink-0">
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="시간 조절바 아래로 숨기기"
            aria-label="시간 조절바 숨기기"
            aria-expanded={true}
            className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${collapseBtnCls}`}
          >
            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
        <button
          type="button"
          onClick={() => stepSelectedUnit(-1)}
          title={`선택 단위(${activeUnitLabel}) -1`}
          aria-label={`선택 단위 ${activeUnitLabel} 감소`}
          className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors shrink-0 ${minusBtnCls}`}
        >
          <Minus className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border font-mono text-[14px] sm:text-[15px] font-bold tabular-nums leading-tight ${capsuleCls}`}
          role="group"
          aria-label="날짜 및 시간 단위 선택"
        >
          {parts.map((part) => {
            const isSelected = selectedUnit === part.unit;
            const unitLabel = TIME_UNIT_LABELS[part.unit];
            return (
              <React.Fragment key={part.unit}>
                <button
                  type="button"
                  onClick={() => setSelectedUnit(part.unit)}
                  onWheel={(e) => {
                    e.preventDefault();
                    setSelectedUnit(part.unit);
                    stepSelectedUnit(e.deltaY < 0 ? 1 : -1, part.unit);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === '+') {
                      e.preventDefault();
                      stepSelectedUnit(1, part.unit);
                    } else if (e.key === 'ArrowDown' || e.key === '-') {
                      e.preventDefault();
                      stepSelectedUnit(-1, part.unit);
                    }
                  }}
                  aria-pressed={isSelected}
                  title={`${unitLabel} 선택 (클릭 후 +/- 또는 휠로 조절)`}
                  className={`px-1 py-0.5 rounded border transition-colors inline-flex items-baseline gap-[1px] cursor-pointer ${
                    isSelected ? clockSegmentActiveCls : clockSegmentIdleCls
                  }`}
                >
                  <span>{part.value}</span>
                  <span
                    className={`font-sans text-[10px] font-medium ${
                      isSelected ? unitSuffixActiveCls : unitSuffixIdleCls
                    }`}
                  >
                    {unitLabel}
                  </span>
                </button>
                {part.gapAfter && (
                  <span className="w-2 inline-block shrink-0" aria-hidden="true" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => stepSelectedUnit(1)}
          title={`선택 단위(${activeUnitLabel}) +1`}
          aria-label={`선택 단위 ${activeUnitLabel} 증가`}
          className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors shrink-0 ${plusBtnCls}`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Right of Date/Time: Fixed Max-Width Speed Readout + Playback/Acceleration Capsule [<<] [▶/⏸] [↺] [>>] */}
      <div className="flex items-center justify-center gap-1.5 shrink-0">
        {/* Fixed max-width box sized for widest value (-x2592000(30일)) so layout never shifts */}
        <div
          title="현재 시간 가감속 배율 (<< / >> 버튼으로 조절)"
          className={`w-[152px] h-7 px-2 rounded-md border shrink-0 flex items-center justify-center font-mono text-xs font-semibold tabular-nums whitespace-nowrap transition-opacity ${speedBadgeCls} ${
            observer.isPlaying ? 'opacity-100' : 'opacity-85'
          }`}
        >
          {formatTimeRateBadge(observer.timeRateSecPerSec)}
        </div>

        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border shrink-0 ${capsuleCls}`}
        >
          <button
            type="button"
            onClick={handleDecelerate}
            title="감속 (속도 감소 / 역방향 가속)"
            aria-label="감속"
            className={`h-6 w-6 rounded border flex items-center justify-center transition-colors shrink-0 ${decelBtnCls}`}
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            title={observer.isPlaying ? '정지' : '재생'}
            aria-label={observer.isPlaying ? '정지' : '재생'}
            className={`h-6 w-7 rounded border flex items-center justify-center transition-colors shrink-0 ${playBtnCls}`}
          >
            {observer.isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={handleResetNow}
            title="현재 시각으로 복귀 (1배속)"
            aria-label="현재 시각"
            className={`h-6 w-7 rounded border flex items-center justify-center transition-colors shrink-0 ${nowBtnCls}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleAccelerate}
            title="가속 (속도 증가)"
            aria-label="가속"
            className={`h-6 w-6 rounded border flex items-center justify-center transition-colors shrink-0 ${accelBtnCls}`}
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
