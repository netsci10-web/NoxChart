import React from 'react';
import type { User } from 'firebase/auth';
import {
  Cloud,
  CloudAlert,
  CloudCheck,
  Loader2,
  LogOut,
  X,
} from 'lucide-react';
import { ThemeMode } from '../types/astronomy';
import { CloudSyncStatus } from '../utils/cloudSync';

interface AuthSyncControlsProps {
  theme: ThemeMode;
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: number | null;
  syncError: string | null;
  authError: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onManualSync: () => void;
  onDismissError: () => void;
}

function formatTimeShort(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export const AuthSyncControls: React.FC<AuthSyncControlsProps> = ({
  theme,
  user,
  authReady,
  authBusy,
  syncStatus,
  lastSyncedAt,
  syncError,
  authError,
  onLogin,
  onLogout,
  onManualSync,
  onDismissError,
}) => {
  const activeNotice = authError || (syncStatus === 'error' ? syncError : null);

  const containerTone =
    theme === 'white'
      ? 'bg-slate-100 border-slate-300 text-slate-700'
      : theme === 'red'
      ? 'bg-[#100101] border-[#420C0C] text-[#DC2626]'
      : 'bg-[#0B1220] border-[#25334D] text-slate-200';

  const loginBtnTone =
    theme === 'white'
      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
      : theme === 'red'
      ? 'bg-[#1A0303] border-[#5A1212] text-[#FF5A5A] hover:bg-[#2A0505] hover:border-[#8A1C1C]'
      : 'bg-[#111C2F] border-[#2C3F60] text-slate-100 hover:bg-[#192842] hover:border-cyan-400/60';

  const logoutBtnTone =
    theme === 'white'
      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
      : theme === 'red'
      ? 'text-[#B83232] hover:text-[#FF5252] hover:bg-[#260404]'
      : 'text-slate-400 hover:text-white hover:bg-[#182438]';

  const syncTone = (() => {
    if (syncStatus === 'error') {
      return theme === 'white'
        ? 'text-rose-700 hover:bg-rose-100'
        : theme === 'red'
        ? 'text-[#FF4D4D] hover:bg-[#2A0505]'
        : 'text-amber-300 hover:bg-amber-500/15';
    }
    if (syncStatus === 'updated') {
      return theme === 'white'
        ? 'text-blue-700 bg-sky-100/80 hover:bg-sky-200/80'
        : theme === 'red'
        ? 'text-[#FF6B6B] bg-[#300707] hover:bg-[#3F0A0A]'
        : 'text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25';
    }
    if (syncStatus === 'saved') {
      return theme === 'white'
        ? 'text-emerald-700 hover:bg-emerald-100/70'
        : theme === 'red'
        ? 'text-[#EF4444] hover:bg-[#240404]'
        : 'text-emerald-400 hover:bg-emerald-500/10';
    }
    return theme === 'white'
      ? 'text-sky-700 hover:bg-slate-200/70'
      : theme === 'red'
      ? 'text-[#DC2626] hover:bg-[#240404]'
      : 'text-cyan-300 hover:bg-[#182438]';
  })();

  const syncLabel =
    syncStatus === 'loading'
      ? '불러오는 중'
      : syncStatus === 'checking'
      ? '확인 중'
      : syncStatus === 'saving' || syncStatus === 'pending'
      ? '저장 중'
      : syncStatus === 'updated'
      ? '반영됨'
      : syncStatus === 'saved'
      ? '저장됨'
      : syncStatus === 'error'
      ? '오류'
      : '';

  const syncTitle =
    syncStatus === 'loading'
      ? '클라우드에서 설정과 관측 데이터를 실시간 동기화 연결 중입니다.'
      : syncStatus === 'checking'
      ? '데이터베이스 실시간 연결 및 최신 수정사항을 확인하는 중입니다.'
      : syncStatus === 'saving' || syncStatus === 'pending'
      ? '변경 사항을 Firestore 클라우드에 자동 저장하는 중입니다.'
      : syncStatus === 'updated'
      ? `다른 기기/데이터베이스의 변경사항을 실시간 반영했습니다${lastSyncedAt ? ` (${formatTimeShort(lastSyncedAt)})` : ''}`
      : syncStatus === 'saved'
      ? `실시간 클라우드 동기화 연결됨${lastSyncedAt ? ` (${formatTimeShort(lastSyncedAt)})` : ''} · 클릭하여 지금 동기화`
      : syncStatus === 'error'
      ? `${syncError || '동기화 오류'} · 클릭하여 재시도`
      : '클라우드 동기화';

  const displayName = user?.displayName || user?.email?.split('@')[0] || '사용자';
  const initialChar = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <div className="relative flex items-center gap-1 shrink-0">
      {!authReady ? (
        <div
          className={`h-7 px-2 rounded-lg border flex items-center gap-1 text-[11px] opacity-70 ${containerTone}`}
          aria-label="인증 상태 확인 중"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        </div>
      ) : !user ? (
        <button
          type="button"
          onClick={onLogin}
          disabled={authBusy}
          title="Google 계정으로 로그인하여 설정·장비·관측 목록을 클라우드에 실시간 동기화"
          className={`h-7 px-2 sm:px-2.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-60 ${loginBtnTone}`}
        >
          {authBusy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : (
            <svg viewBox="0 0 18 18" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
              {theme === 'red' ? (
                <path
                  fill="#FF5A5A"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615zM9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18zM3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332zM9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                />
              ) : (
                <>
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                  />
                </>
              )}
            </svg>
          )}
          <span className="hidden md:inline">Google 로그인</span>
          <span className="md:hidden">로그인</span>
        </button>
      ) : (
        <div
          className={`h-8 px-1.5 rounded-lg border flex items-center gap-1 shrink-0 ${containerTone}`}
        >
          {/* Compact cloud sync status badge */}
          {syncStatus !== 'idle' && (
            <button
              type="button"
              onClick={onManualSync}
              title={syncTitle}
              aria-label={syncTitle}
              className={`h-6 px-1.5 rounded-md flex items-center gap-1 text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${syncTone}`}
            >
              {syncStatus === 'loading' ||
              syncStatus === 'checking' ||
              syncStatus === 'saving' ||
              syncStatus === 'pending' ? (
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              ) : syncStatus === 'saved' || syncStatus === 'updated' ? (
                <CloudCheck className="w-3.5 h-3.5 shrink-0" />
              ) : syncStatus === 'error' ? (
                <CloudAlert className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Cloud className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">{syncLabel}</span>
            </button>
          )}

          {/* User Avatar + Name */}
          <div
            className="flex items-center gap-1.5 pl-0.5 pr-1 max-w-[130px] sm:max-w-[155px]"
            title={`${displayName}${user.email ? ` (${user.email})` : ''}`}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                className={`w-5 h-5 rounded-full object-cover shrink-0 border ${
                  theme === 'red'
                    ? 'border-[#7F1D1D] opacity-80 sepia hue-rotate-[-50deg]'
                    : theme === 'white'
                    ? 'border-slate-300'
                    : 'border-cyan-400/50'
                }`}
              />
            ) : (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  theme === 'white'
                    ? 'bg-blue-600 text-white'
                    : theme === 'red'
                    ? 'bg-[#7F1D1D] text-[#FCA5A5]'
                    : 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                }`}
              >
                {initialChar}
              </span>
            )}
            <span className="hidden md:inline text-[11px] font-medium truncate">
              {displayName}
            </span>
          </div>

          {/* Logout button */}
          <button
            type="button"
            onClick={onLogout}
            disabled={authBusy}
            title="로그아웃 (로컬 모드로 전환)"
            aria-label="로그아웃"
            className={`h-6 px-1.5 rounded-md flex items-center gap-1 text-[10.5px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${logoutBtnTone}`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      )}

      {/* Top-of-screen alert toast for Firestore permission / network / auth errors */}
      {activeNotice && (
        <div
          role="alert"
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-[120] max-w-[92vw] w-[420px] px-3 py-2.5 rounded-lg border shadow-2xl flex items-start gap-2.5 text-[11.5px] leading-snug backdrop-blur-md ${
            theme === 'white'
              ? 'bg-white/95 border-rose-400 text-rose-900'
              : theme === 'red'
              ? 'bg-[#1A0202]/95 border-[#B91C1C] text-[#FCA5A5]'
              : 'bg-[#121829]/95 border-amber-500/70 text-amber-100'
          }`}
        >
          <CloudAlert
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              theme === 'white'
                ? 'text-rose-600'
                : theme === 'red'
                ? 'text-[#FF5252]'
                : 'text-amber-400'
            }`}
          />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="font-semibold text-[11.5px]">
              {authError ? 'Google 로그인 오류' : 'Firestore 클라우드 동기화 오류'}
            </div>
            <div className="text-[11px] opacity-90 break-keep">{activeNotice}</div>
          </div>
          {!authError && user && (
            <button
              type="button"
              onClick={onManualSync}
              className={`px-2 py-1 rounded border text-[10.5px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                theme === 'white'
                  ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                  : theme === 'red'
                  ? 'bg-[#2E0606] border-[#7F1D1D] text-[#FF7A7A] hover:bg-[#440909]'
                  : 'bg-amber-500/15 border-amber-400/50 text-amber-200 hover:bg-amber-500/25'
              }`}
            >
              재시도
            </button>
          )}
          <button
            type="button"
            onClick={onDismissError}
            aria-label="알림 닫기"
            title="알림 닫기"
            className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
