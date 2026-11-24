import React, { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { ThemeMode } from '../types/astronomy';
import { getUiTheme } from '../utils/themeClasses';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PendingConfirmRequest {
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}

export type ConfirmDialogFn = (options: ConfirmDialogOptions) => Promise<boolean>;

const defaultConfirmFn: ConfirmDialogFn = async () => true;

export const ConfirmDialogContext = createContext<ConfirmDialogFn>(defaultConfirmFn);

export function useConfirmDialog(): ConfirmDialogFn {
  return useContext(ConfirmDialogContext);
}

interface ConfirmDialogModalProps {
  request: PendingConfirmRequest | null;
  theme: ThemeMode;
  onResolve: (confirmed: boolean) => void;
}

export function ConfirmDialogModal({ request, theme, onResolve }: ConfirmDialogModalProps) {
  const ui = getUiTheme(theme);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    // Focus cancel button by default to prevent accidental double-enter deletion
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onResolve(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [request, onResolve]);

  if (!request) return null;

  const {
    title,
    message,
    detail,
    confirmLabel = '삭제',
    cancelLabel = '취소',
    danger = true,
  } = request.options;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="noxchart-confirm-dialog-title"
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={() => onResolve(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={`w-full max-w-[330px] border shadow-2xl p-4 space-y-3 ${ui.panel} ${ui.border}`}
        style={{ borderRadius: '8px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`p-1.5 rounded-md shrink-0 ${
              danger
                ? theme === 'white'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-red-500/15 text-red-400'
                : theme === 'white'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-cyan-500/15 text-cyan-400'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              id="noxchart-confirm-dialog-title"
              className={`text-[13px] font-semibold leading-tight tracking-[-0.03em] ${ui.textPrimary}`}
            >
              {title}
            </h3>
            <p className={`text-[11.5px] leading-relaxed break-keep ${ui.textSecondary}`}>
              {message}
            </p>
            {detail && (
              <p className={`text-[10.5px] leading-snug break-keep ${ui.textMuted}`}>
                {detail}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={() => onResolve(false)}
            className={`px-3 py-1.5 border text-[11px] font-medium transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '5px' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`px-3 py-1.5 border text-[11px] font-semibold transition-colors ${
              danger
                ? theme === 'white'
                  ? 'bg-red-600 border-red-700 text-white hover:bg-red-700'
                  : 'bg-red-600 border-red-500 text-white hover:bg-red-500'
                : ui.buttonActive
            }`}
            style={{ borderRadius: '5px' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
