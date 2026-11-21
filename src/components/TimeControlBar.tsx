import React, { useEffect, useState } from 'react';
import {
  CalendarMinus2,
  CalendarPlus2,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Pause,
  Play,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { ObserverConfig, ThemeMode } from '../types/astronomy';

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

function formatClockIso(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
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

  // Tick local clock every 1s when live time is active so HH:MM:SS updates smoothly
  useEffect(() => {
    if (!observer.useLiveTime || observer.isPlaying) return;
    setLiveNowMs(Date.now());
    const id = window.setInterval(() => {
      setLiveNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [observer.useLiveTime, observer.isPlaying]);

  const displayMs = observer.useLiveTime && !observer.isPlaying ? liveNowMs : observer.timestampMs;

  const stepTime = (deltaMs: number) => {
    onChangeObserver((p) => ({
      ...p,
      useLiveTime: false,
      timestampMs: (p.useLiveTime ? Date.now() : p.timestampMs) + deltaMs,
    }));
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

  const clockCls =
    theme === 'white'
      ? 'text-blue-700'
      : theme === 'red'
      ? 'text-[#FF3B3B]'
      : 'text-[#22D3EE]';

  const stepBackBtnCls =
    theme === 'white'
      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
      : theme === 'red'
      ? 'bg-[#170202] border-[#521010] text-[#E04040] hover:bg-[#260505] hover:text-[#FF5A5A]'
      : 'bg-[#121D36] border-[#314E89] text-[#93C5FD] hover:bg-[#19284A] hover:text-[#BFDBFE]';

  const stepFwdBtnCls =
    theme === 'white'
      ? 'bg-sky-50/80 border-sky-300 text-sky-700 hover:bg-sky-100'
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

  return (
    <div
      className={`no-print shrink-0 border-t px-3 py-1.5 flex flex-col items-center justify-center gap-1 select-none ${barCls}`}
    >
      {/* Top centered live/simulated clock readout */}
      <div className="flex items-center justify-center font-mono text-[15px] sm:text-base font-bold tabular-nums tracking-wider leading-tight">
        <span className={clockCls}>{formatClockIso(displayMs)}</span>
      </div>

      {/* Bottom time step & playback dock + right-anchored leftward-growing speed readout */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {/* Step Back: -1D, -1H, -1M */}
        <button
          type="button"
          onClick={() => stepTime(-86400 * 1000)}
          title="1일 전 (-1D)"
          aria-label="1일 전 (-1D)"
          className={`h-7 px-1.5 rounded-md border flex items-center justify-center gap-1 transition-colors shrink-0 ${stepBackBtnCls}`}
        >
          <CalendarMinus2 className="w-3.5 h-3.5 opacity-85 shrink-0" />
          <span className="font-mono text-[11px] font-semibold tabular-nums leading-none">-1D</span>
        </button>
        <button
          type="button"
          onClick={() => stepTime(-3600 * 1000)}
          title="1시간 전 (-1H)"
          aria-label="1시간 전 (-1H)"
          className={`h-7 px-1.5 rounded-md border flex items-center justify-center gap-1 transition-colors shrink-0 ${stepBackBtnCls}`}
        >
          <Clock className="w-3.5 h-3.5 opacity-85 shrink-0" />
          <span className="font-mono text-[11px] font-semibold tabular-nums leading-none">-1H</span>
        </button>
        <button
          type="button"
          onClick={() => stepTime(-60 * 1000)}
          title="1분 전 (-1M)"
          aria-label="1분 전 (-1M)"
          className={`h-7 px-1.5 rounded-md border flex items-center justify-center gap-1 transition-colors shrink-0 ${stepBackBtnCls}`}
        >
          <Timer className="w-3.5 h-3.5 opacity-85 shrink-0" />
          <span className="font-mono text-[11px] font-semibold tabular-nums leading-none">-1M</span>
        </button>

        {/* Inner Bordered Playback Capsule: [<<] [▶/⏸] [↺] [>>] */}
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

        {/* Step Forward: +1M, +1H, +1D */}
        <button
          type="button"
          onClick={() => stepTime(60 * 1000)}
          title="1분 후 (+1M)"
          aria-label="1분 후 (+1M)"
          className={`h-7 px-1.5 rounded-md border flex items-center justify-center gap-1 transition-colors shrink-0 ${stepFwdBtnCls}`}
        >
          <span className="font-mono text-[11px] font-semibold tabular-nums leading-none">+1M</span>
          <Timer className="w-3.5 h-3.5 opacity-85 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => stepTime(3600 * 1000)}
          title="1시간 후 (+1H)"
          aria-label="1시간 후 (+1H)"
          className={`h-7 px-1.5 rounded-md border flex items-center justify-center gap-1 transition-colors shrink-0 ${stepFwdBtnCls}`}
        >
          <span className="font-mono text-[11px] font-semibold tabular-nums leading-none">+1H</span>
          <Clock className="w-3.5 h-3.5 opacity-85 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => stepTime(86400 * 1000)}
          title="1일 후 (+1D)"
          aria-label="1일 후 (+1D)"
          className={`h-7 px-1.5 rounded-md border flex items-center justify-center gap-1 transition-colors shrink-0 ${stepFwdBtnCls}`}
        >
          <span className="font-mono text-[11px] font-semibold tabular-nums leading-none">+1D</span>
          <CalendarPlus2 className="w-3.5 h-3.5 opacity-85 shrink-0" />
        </button>

        {/* Fixed-width right-aligned slot so speed badge expands strictly leftward without shifting any buttons */}
        <div className="w-[144px] shrink-0 flex items-center justify-end ml-1">
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
