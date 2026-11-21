import React, { useEffect, useState } from 'react';
import {
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
}

export function TimeControlBar({
  theme,
  observer,
  onChangeObserver,
}: TimeControlBarProps) {
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());
  const [selectedUnit, setSelectedUnit] = useState<TimeUnit>('hour');

  // Tick local clock every 1s when live time is active so HH:MM:SS updates smoothly
  useEffect(() => {
    if (!observer.useLiveTime || observer.isPlaying) return;
    setLiveNowMs(Date.now());
    const id = window.setInterval(() => {
      setLiveNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [observer.useLiveTime, observer.isPlaying]);

  const displayMs =
    observer.useLiveTime && !observer.isPlaying ? liveNowMs : observer.timestampMs;

  const d = new Date(displayMs);
  const parts: { unit: TimeUnit; value: string; sep?: string }[] = [
    { unit: 'year', value: String(d.getFullYear()), sep: '-' },
    { unit: 'month', value: String(d.getMonth() + 1).padStart(2, '0'), sep: '-' },
    { unit: 'day', value: String(d.getDate()).padStart(2, '0'), sep: ' ' },
    { unit: 'hour', value: String(d.getHours()).padStart(2, '0'), sep: ':' },
    { unit: 'minute', value: String(d.getMinutes()).padStart(2, '0'), sep: ':' },
    { unit: 'second', value: String(d.getSeconds()).padStart(2, '0') },
  ];

  const stepSelectedUnit = (delta: number, unitOverride?: TimeUnit) => {
    const targetUnit = unitOverride ?? selectedUnit;
    onChangeObserver((p) => {
      const baseMs = p.useLiveTime ? Date.now() : p.timestampMs;
      return {
        ...p,
        useLiveTime: false,
        timestampMs: addTimeUnit(baseMs, targetUnit, delta),
      };
    });
  };

  const handleResetNow = () => {
    const now = Date.now();
    setLiveNowMs(now);
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
        timestampMs: p.useLiveTime ? Date.now() : p.timestampMs,
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
    theme === 'white'
      ? 'bg-slate-50 border-slate-200 text-slate-800'
      : theme === 'red'
      ? 'bg-[#070000] border-[#300808] text-[#DC2626]'
      : 'bg-[#070B14] border-[#1B273D] text-slate-200';

  const clockSegmentIdleCls =
    theme === 'white'
      ? 'text-blue-700 border-transparent hover:bg-blue-50 hover:border-blue-200'
      : theme === 'red'
      ? 'text-[#FF4D4D] border-transparent hover:bg-[#1E0303] hover:border-[#5A1212]'
      : 'text-[#22D3EE] border-transparent hover:bg-[#102038] hover:border-[#2A4266]';

  const clockSegmentActiveCls =
    theme === 'white'
      ? 'bg-blue-600 border-blue-700 text-white shadow-xs'
      : theme === 'red'
      ? 'bg-[#6B1212] border-[#EF4444] text-[#FFE0E0]'
      : 'bg-[#0C354A] border-[#22D3EE] text-white';

  const unitSuffixIdleCls =
    theme === 'white'
      ? 'text-slate-400'
      : theme === 'red'
      ? 'text-[#A02828]'
      : 'text-slate-400';

  const unitSuffixActiveCls =
    theme === 'white'
      ? 'text-blue-100'
      : theme === 'red'
      ? 'text-[#FF9E9E]'
      : 'text-cyan-200';

  const sepCls =
    theme === 'white'
      ? 'text-slate-400'
      : theme === 'red'
      ? 'text-[#7A1B1B]'
      : 'text-slate-500';

  const minusBtnCls =
    theme === 'white'
      ? 'bg-indigo-50/90 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
      : theme === 'red'
      ? 'bg-[#170202] border-[#521010] text-[#E04040] hover:bg-[#260505] hover:text-[#FF5A5A]'
      : 'bg-[#121D36] border-[#314E89] text-[#93C5FD] hover:bg-[#19284A] hover:text-[#BFDBFE]';

  const plusBtnCls =
    theme === 'white'
      ? 'bg-sky-50/90 border-sky-300 text-sky-700 hover:bg-sky-100'
      : theme === 'red'
      ? 'bg-[#1C0303] border-[#6B1515] text-[#F05252] hover:bg-[#2C0606] hover:text-[#FF6B6B]'
      : 'bg-[#0A2234] border-[#0C7BB3] text-[#7DD3FC] hover:bg-[#103048] hover:text-[#BAE6FD]';

  const capsuleCls =
    theme === 'white'
      ? 'bg-slate-100 border-slate-300'
      : theme === 'red'
      ? 'bg-[#100101] border-[#420C0C]'
      : 'bg-[#0D1424] border-[#26344E]';

  const decelBtnCls =
    theme === 'white'
      ? 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100'
      : theme === 'red'
      ? 'bg-[#220404] border-[#8A1818] text-[#FF6B6B] hover:bg-[#330707] hover:text-[#FF8585]'
      : 'bg-[#2A1806] border-[#D97706]/80 text-[#FBBF24] hover:bg-[#3A220A] hover:text-[#FDE68A]';

  const accelBtnCls =
    theme === 'white'
      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 hover:bg-emerald-100'
      : theme === 'red'
      ? 'bg-[#280505] border-[#B91C1C] text-[#FF4D4D] hover:bg-[#3A0808] hover:text-[#FF6E6E]'
      : 'bg-[#062822] border-[#10B981]/80 text-[#34D399] hover:bg-[#0A3A31] hover:text-[#6EE7B7]';

  const playBtnCls = observer.isPlaying
    ? theme === 'white'
      ? 'bg-blue-700 border-blue-700 text-white'
      : theme === 'red'
      ? 'bg-[#7F1D1D] border-[#EF4444] text-[#FF5252]'
      : 'bg-[#0891B2] border-[#22D3EE] text-white'
    : theme === 'white'
    ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
    : theme === 'red'
    ? 'bg-[#1A0303] border-[#5A1212] text-[#EF4444] hover:bg-[#280505]'
    : 'bg-[#1A2438] border-[#314261] text-white hover:bg-[#23314A]';

  const isLiveNow = observer.useLiveTime;
  const nowBtnCls = isLiveNow
    ? theme === 'white'
      ? 'bg-sky-50 border-sky-500 text-sky-700'
      : theme === 'red'
      ? 'bg-[#2B0404] border-[#DC2626] text-[#FF3B3B]'
      : 'bg-[#082B3A] border-[#06B6D4] text-[#22D3EE]'
    : theme === 'white'
    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
    : theme === 'red'
    ? 'bg-[#150202] border-[#420C0C] text-[#B91C1C] hover:bg-[#220404] hover:text-[#EF4444]'
    : 'bg-[#141D2F] border-[#26344E] text-slate-300 hover:bg-[#1C2840]';

  const speedBadgeCls =
    theme === 'white'
      ? 'bg-emerald-50 border-emerald-500/70 text-emerald-700'
      : theme === 'red'
      ? 'bg-[#1E0303] border-[#991B1B] text-[#EF4444]'
      : 'bg-[#062420] border-[#0D9488]/80 text-[#34E2A3]';

  const activeUnitLabel = TIME_UNIT_LABELS[selectedUnit];

  return (
    <div
      className={`no-print shrink-0 border-t px-3 py-1.5 flex flex-col items-center justify-center gap-1 select-none ${barCls}`}
    >
      {/* Top Row: [-] [YYYY년 - MM월 - DD일  HH시 : MM분 : SS초] [+] */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
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
          className={`flex items-center px-1.5 py-0.5 rounded-lg border font-mono text-[14px] sm:text-[15px] font-bold tabular-nums leading-tight ${capsuleCls}`}
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
                {part.sep && (
                  <span
                    className={`px-0.5 font-normal ${
                      part.sep === ' ' ? 'w-1.5 inline-block' : sepCls
                    }`}
                    aria-hidden="true"
                  >
                    {part.sep === ' ' ? '' : part.sep}
                  </span>
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

      {/* Bottom Row: Playback Capsule [<<] [▶/⏸] [↺] [>>] + Speed Badge */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
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

        <div className="w-[144px] shrink-0 flex items-center justify-start">
          <div
            title="현재 시간 가감속 배율 (<< / >> 버튼으로 조절)"
            className={`h-7 px-2.5 rounded-md border flex items-center justify-center font-mono text-xs font-semibold tabular-nums whitespace-nowrap transition-opacity ${speedBadgeCls} ${
              observer.isPlaying ? 'opacity-100' : 'opacity-85'
            }`}
          >
            {formatTimeRateBadge(observer.timeRateSecPerSec)}
          </div>
        </div>
      </div>
    </div>
  );
}
