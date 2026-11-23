import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Circle,
  Copy,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  Hexagon,
  Layers,
  Magnet,
  MapPin,
  MousePointer2,
  Navigation,
  Plus,
  QrCode,
  Redo2,
  Share2,
  SlidersHorizontal,
  Spline,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  AsterismDraftState,
  AsterismGroup,
  AsterismLayer,
  AsterismLineStyle,
  AsterismObject,
  AsterismStoreState,
  AsterismTool,
  AsterismToolboxPopover,
  ChartViewState,
  OpticsSettings,
  ThemeMode,
} from '../types/astronomy';
import {
  ASTERISM_COLOR_SWATCHES,
  buildAsterismShareUrl,
  downloadAsterismsJson,
  downloadSingleAsterismJson,
  parseAsterismsFromJson,
} from '../utils/asterismStorage';
import { formatAngularSeparation, getCircleRadiusDeg } from '../utils/asterismRenderer';
import { getUiTheme } from '../utils/themeClasses';

interface AsterismToolboxProps {
  theme: ThemeMode;
  rightDrawerOpen: boolean;
  view: ChartViewState;
  optics: OpticsSettings;
  store: AsterismStoreState;
  activeTool: AsterismTool;
  popover: AsterismToolboxPopover;
  onChangePopover: (next: AsterismToolboxPopover) => void;
  selectedObjectId: string | null;
  draft: AsterismDraftState | null;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: AsterismTool) => void;
  onFinishDraft: () => void;
  onUndoDraftPoint: () => void;
  onCancelDraft: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCloseDrawingMode: () => void;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (id: string, patch: Partial<AsterismObject>) => void;
  onDeleteObject: (id: string) => void;
  onUpdateSettings: (patch: Partial<AsterismStoreState['settings']>) => void;
  onSetActiveLayer: (layerId: string) => void;
  onToggleLayerVisible: (layerId: string) => void;
  onCreateLayer: (name: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onSetActiveAsterism: (asterismId: string | null) => void;
  onCreateAsterismGroup: (name?: string) => string;
  onUpdateAsterismGroup: (asterismId: string, patch: Partial<AsterismGroup>) => void;
  onDeleteAsterismGroup: (asterismId: string) => void;
  onToggleAsterismGroupVisible: (asterismId: string) => void;
  onSaveAsterismGroupView: (asterismId: string) => void;
  onFocusAsterismGroup: (grp: AsterismGroup) => void;
  onLoadPresets: () => number;
  onImportBundle: (
    layers: AsterismLayer[],
    asterisms: AsterismGroup[],
    objects: AsterismObject[]
  ) => { addedCount: number };
  onChangeOptics: (updater: (prev: OpticsSettings) => OpticsSettings) => void;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
}

const TOOL_BUTTONS: {
  id: AsterismTool;
  label: string;
  shortLabel: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'select',
    label: '선택 · 편집',
    shortLabel: '선택',
    hint: '도형 클릭 선택 · 꼭짓점 드래그 · 미선택 시 항성 클릭으로 새 성군 생성',
    icon: MousePointer2,
  },
  {
    id: 'polyline',
    label: '폴리라인 (선 / 원호)',
    shortLabel: '폴리라인',
    hint: '항성을 차례로 클릭 연결 (속성에서 직선/원호 선택 · 더블클릭 또는 Enter로 완료)',
    icon: Spline,
  },
  {
    id: 'polygon',
    label: '다각형 (폐합)',
    shortLabel: '다각형',
    hint: '삼각형·사각형 등 폐합 패턴 (3점 이상 찍고 더블클릭/Enter)',
    icon: Hexagon,
  },
  {
    id: 'circle',
    label: '원 그리기',
    shortLabel: '원',
    hint: '중심·반경 2클릭 또는 아이피스·파인더 시야 연동 1클릭 원 그리기',
    icon: Circle,
  },
  {
    id: 'arrow',
    label: '방향 지시선',
    shortLabel: '방향선',
    hint: 'A→B 두 별로 방향 포인터 생성 (1×~5× 연장 지원)',
    icon: ArrowUpRight,
  },
  {
    id: 'label',
    label: '텍스트 요소',
    shortLabel: '텍스트',
    hint: '클릭한 위치에 여러 줄 관측 텍스트 배치',
    icon: Type,
  },
];

const FOV_PRESETS: { label: string; range: [number, number] }[] = [
  { label: '전역', range: [0.05, 120] },
  { label: '파인더', range: [1.0, 25] },
  { label: '성단', range: [0.1, 8] },
  { label: '고배율', range: [0.05, 2.5] },
];

function getShapeTypeLabel(obj: AsterismObject): string {
  if (obj.type === 'polyline') return obj.smooth ? '원호' : '선';
  if (obj.type === 'polygon') return '다각형';
  if (obj.type === 'circle') return '원';
  if (obj.type === 'arrow') return '방향선';
  return '텍스트';
}

function formatShortRa(raDeg: number): string {
  const h = (((raDeg / 15) % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}h${String(mm).padStart(2, '0')}m`;
}

function formatShortDec(decDeg: number): string {
  const sign = decDeg >= 0 ? '+' : '-';
  const abs = Math.abs(decDeg);
  const dd = Math.floor(abs);
  const mm = Math.floor((abs - dd) * 60);
  return `${sign}${String(dd).padStart(2, '0')}°${String(mm).padStart(2, '0')}′`;
}

export function AsterismToolbox({
  theme,
  rightDrawerOpen,
  view,
  optics,
  store,
  activeTool,
  popover,
  onChangePopover,
  selectedObjectId,
  draft,
  canUndo,
  canRedo,
  onChangeTool,
  onFinishDraft,
  onUndoDraftPoint,
  onCancelDraft,
  onUndo,
  onRedo,
  onCloseDrawingMode,
  onSelectObject,
  onUpdateObject,
  onDeleteObject,
  onUpdateSettings,
  onSetActiveAsterism,
  onCreateAsterismGroup,
  onUpdateAsterismGroup,
  onDeleteAsterismGroup,
  onToggleAsterismGroupVisible,
  onSaveAsterismGroupView,
  onFocusAsterismGroup,
  onImportBundle,
  onChangeOptics,
  onChangeView,
}: AsterismToolboxProps) {
  const ui = getUiTheme(theme);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const finderFovDeg = optics.finderFovDeg ?? 7.0;
  const finderLabel = optics.finderLabel?.trim() || '7×50 파인더';

  const selectedObj = selectedObjectId
    ? store.objects.find((o) => o.id === selectedObjectId) ?? null
    : null;

  const activeAsterism =
    (selectedObj
      ? store.asterisms.find((g) => g.id === selectedObj.asterismId)
      : null) ??
    (store.activeAsterismId
      ? store.asterisms.find((g) => g.id === store.activeAsterismId) ?? null
      : null);

  const activeAsterismShapes = activeAsterism
    ? store.objects.filter((o) => o.asterismId === activeAsterism.id)
    : [];

  const activeAsterismLayer = activeAsterism
    ? store.layers.find((l) => l.id === activeAsterism.layerId) ?? null
    : null;

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Generate share URL & QR when Share modal opens
  useEffect(() => {
    if (!shareOpen) return;
    if (store.asterisms.length === 0 && store.objects.length === 0) {
      setShareUrl('');
      setQrDataUrl(null);
      setQrError('공유할 성군이 없습니다. 먼저 성군을 작도하세요.');
      return;
    }
    const url = buildAsterismShareUrl(store.layers, store.asterisms, store.objects, {
      ra: view.ra,
      dec: view.dec,
      fsz: view.fsz,
    });
    setShareUrl(url);
    if (url.length > 2600) {
      setQrDataUrl(null);
      setQrError(
        `데이터 크기가 커서(${url.length}자) QR 코드 용량을 초과했습니다. JSON 파일 내보내기 또는 URL 복사를 이용하세요.`
      );
      return;
    }
    setQrError(null);
    QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      color: {
        dark: theme === 'red' ? '#FF4444' : '#0F172A',
        light: theme === 'red' ? '#120202' : '#FFFFFF',
      },
    })
      .then((data) => setQrDataUrl(data))
      .catch(() => setQrError('QR 코드 생성에 실패했습니다.'));
  }, [shareOpen, store.layers, store.asterisms, store.objects, view.ra, view.dec, view.fsz, theme]);

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 1800);
    } catch {
      setNotice('클립보드 복사가 차단되었습니다. URL을 직접 복사하세요.');
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = parseAsterismsFromJson(text, store.activeLayerId);
      if (res.error) {
        setNotice(res.error);
      } else {
        const { addedCount } = onImportBundle(res.layers, res.asterisms, res.objects);
        setNotice(
          addedCount > 0
            ? `성군·도형 ${addedCount}개 항목을 불러왔습니다.`
            : '이미 동일한 성군 데이터가 모두 존재합니다.'
        );
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleToggleCircleLinkEyepiece = (checked: boolean) => {
    onUpdateSettings({
      circleLinkEyepiece: checked,
      circleLinkFinder: checked ? false : store.settings.circleLinkFinder,
    });
    if (checked) {
      onChangeOptics((p) => ({ ...p, showEyepiece: true }));
    }
  };

  const handleToggleCircleLinkFinder = (checked: boolean) => {
    onUpdateSettings({
      circleLinkFinder: checked,
      circleLinkEyepiece: checked ? false : store.settings.circleLinkEyepiece,
    });
    if (checked) {
      onChangeOptics((p) => ({ ...p, showFinder7x50: true }));
    }
  };

  const rightEdgeOffsetPx = rightDrawerOpen ? 304 : 12;
  const popoverRightPx = rightEdgeOffsetPx + 58;

  const accentRangeCls =
    theme === 'white'
      ? 'accent-blue-600'
      : theme === 'red'
      ? 'accent-[#EF4444]'
      : 'accent-cyan-400';

  const currentEyepieceTag = (() => {
    const mag =
      optics.eyepieceFocalLengthMm > 0
        ? Math.round(optics.telescopeFocalLengthMm / optics.eyepieceFocalLengthMm)
        : 0;
    return `${optics.eyepieceFocalLengthMm}mm ${optics.eyepieceAfovDeg}°${mag > 0 ? ` · ${mag}×` : ''}`;
  })();

  const activeToolMeta = TOOL_BUTTONS.find((t) => t.id === activeTool) ?? TOOL_BUTTONS[0];

  const popoverTitle =
    popover === 'props'
      ? selectedObj
        ? '선택된 도형 속성'
        : '성군 속성'
      : popover === 'layers'
      ? '성군레이어 관리'
      : '아이피스 · 파인더 시야 연동';

  const renderColorPalette = (currentColor: string, onPick: (hex: string) => void) => {
    const normalized = (currentColor || '#FFFFFF').toUpperCase();
    const isPreset = ASTERISM_COLOR_SWATCHES.some(
      (sw) => sw.hex.toUpperCase() === normalized
    );
    const isCustomSelected = !isPreset;
    const pickerValue = /^#[0-9A-F]{6}$/.test(normalized) ? normalized : '#FFFFFF';
    const activeRingCls =
      theme === 'white'
        ? 'scale-115 ring-2 ring-slate-800'
        : 'scale-115 ring-2 ring-white';

    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {ASTERISM_COLOR_SWATCHES.map((sw) => {
          const isSelected = normalized === sw.hex.toUpperCase();
          const isWhiteSwatch = sw.hex.toUpperCase() === '#FFFFFF';
          return (
            <button
              key={sw.hex}
              type="button"
              title={sw.label}
              aria-label={sw.label}
              onClick={() => onPick(sw.hex)}
              className={`w-4 h-4 rounded-full border transition-transform shrink-0 ${
                isSelected ? activeRingCls : 'opacity-85 hover:opacity-100'
              }`}
              style={{
                backgroundColor: sw.hex,
                borderColor:
                  theme === 'white'
                    ? isSelected
                      ? '#0F172A'
                      : isWhiteSwatch
                      ? '#94A3B8'
                      : 'rgba(15,23,42,0.28)'
                    : isSelected
                    ? '#FFFFFF'
                    : 'rgba(255,255,255,0.35)',
              }}
            />
          );
        })}
        <label
          title={`색선택${isCustomSelected ? ` (${pickerValue})` : ''}`}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[9.5px] font-medium cursor-pointer transition-colors shrink-0 ${
            isCustomSelected ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <span
            className="w-3 h-3 rounded-full border shrink-0"
            style={
              isCustomSelected
                ? {
                    backgroundColor: pickerValue,
                    borderColor:
                      theme === 'white' ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.65)',
                  }
                : {
                    background:
                      'conic-gradient(from 0deg, #EF4444, #F97316, #EAB308, #22C55E, #3B82F6, #A855F7, #EF4444)',
                    borderColor:
                      theme === 'white' ? 'rgba(15,23,42,0.28)' : 'rgba(255,255,255,0.45)',
                  }
            }
          />
          <span>색선택</span>
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => onPick(e.target.value.toUpperCase())}
            aria-label="색선택"
            className="sr-only"
          />
        </label>
      </div>
    );
  };

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportJsonFile}
      />

      {/* Top-Center Active Drawing Status Banner */}
      <div
        className={`no-print absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 border text-[11px] shadow-sm backdrop-blur-sm max-w-[92vw] ${ui.hudOverlay}`}
        style={{ borderRadius: '6px' }}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            theme === 'red' ? 'bg-red-500' : theme === 'white' ? 'bg-blue-600' : 'bg-cyan-400'
          }`}
        />
        <span className={`font-semibold whitespace-nowrap ${ui.textPrimary}`}>성군 작도</span>
        {activeAsterism ? (
          <span
            className={`px-1.5 py-0.5 border text-[10px] font-medium truncate max-w-[140px] ${
              theme === 'white'
                ? 'border-amber-400/70 bg-amber-50 text-amber-800'
                : theme === 'red'
                ? 'border-red-800 bg-[#260606] text-red-300'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
            }`}
            style={{ borderRadius: '4px' }}
            title={`현재 제작중인 성군: ${activeAsterism.name}`}
          >
            {activeAsterism.name}
          </span>
        ) : (
          <span className={`text-[10px] whitespace-nowrap ${ui.textMuted}`}>
            (항성 클릭 시 새 성군 생성)
          </span>
        )}
        <span className={`text-[10px] truncate hidden md:inline ${ui.textSecondary}`}>
          {draft
            ? draft.type === 'circle'
              ? '중심 지정됨 · 외곽 반경을 클릭하여 원 완성 (ESC 취소)'
              : `${draft.vertices.length}개 정점 · 더블클릭 / Enter로 완료 · ESC 취소`
            : activeTool === 'circle' &&
              (store.settings.circleLinkEyepiece || store.settings.circleLinkFinder)
            ? store.settings.circleLinkEyepiece
              ? `아이피스 시야(Ø${optics.eyepieceFovDeg.toFixed(2)}°) 연동 · 클릭으로 즉시 원 그리기`
              : `파인더 시야(Ø${finderFovDeg.toFixed(2)}°) 연동 · 클릭으로 즉시 원 그리기`
            : activeToolMeta.hint}
        </span>
        {draft && (
          <div className="flex items-center gap-1 ml-1">
            {draft.type !== 'circle' && (
              <button
                type="button"
                onClick={onFinishDraft}
                disabled={draft.vertices.length < (draft.type === 'polygon' ? 3 : 2)}
                className={`px-1.5 py-0.5 border text-[10px] font-semibold flex items-center gap-0.5 ${
                  draft.vertices.length >= (draft.type === 'polygon' ? 3 : 2)
                    ? ui.buttonActive
                    : `${ui.buttonIdle} opacity-45 cursor-not-allowed`
                }`}
                style={{ borderRadius: '4px' }}
              >
                <Check className="w-3 h-3" />
                <span>완료</span>
              </button>
            )}
            <button
              type="button"
              onClick={onUndoDraftPoint}
              className={`px-1.5 py-0.5 border text-[10px] ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
              title="마지막 점 되돌리기 (Backspace)"
            >
              점 취소
            </button>
            <button
              type="button"
              onClick={onCancelDraft}
              className={`px-1.5 py-0.5 border text-[10px] ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
              title="작도 취소 (ESC)"
            >
              취소
            </button>
          </div>
        )}
        {notice && (
          <span className={`text-[10px] font-medium ml-1 ${ui.accentText}`}>· {notice}</span>
        )}
      </div>

      {/* Right-Edge Vertical Floating Drawing Toolbox */}
      <div
        className={`no-print absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 p-1.5 border shadow-md backdrop-blur-sm transition-all ${ui.hudOverlay}`}
        style={{ right: `${rightEdgeOffsetPx}px`, borderRadius: '8px' }}
        aria-label="성군 작도 도구"
      >
        {/* 6 Vector Tools */}
        {TOOL_BUTTONS.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onChangeTool(tool.id)}
              title={`${tool.label} — ${tool.hint}`}
              className={`w-9 h-9 border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '5px' }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[8px] leading-none font-medium tracking-[-0.04em]">
                {tool.shortLabel}
              </span>
            </button>
          );
        })}

        <div className={`w-6 h-px my-0.5 ${ui.divider} border-t`} />

        {/* Magnetic Snap Quick Toggle */}
        <button
          type="button"
          onClick={() => onUpdateSettings({ snapEnabled: !store.settings.snapEnabled })}
          title={
            store.settings.snapEnabled
              ? `별 스냅 켜짐 (반경 ${store.settings.snapRadiusPx}px, ≤${store.settings.snapMaxMag}m)`
              : '별 스냅 꺼짐 (자유 좌표)'
          }
          className={`w-9 h-8 border flex flex-col items-center justify-center gap-0.5 transition-colors ${
            store.settings.snapEnabled ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '5px' }}
        >
          <Magnet className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[8px] leading-none font-medium">스냅</span>
        </button>

        {/* Properties Popover Toggle ("속성") */}
        <button
          type="button"
          onClick={() => onChangePopover(popover === 'props' ? 'none' : 'props')}
          title={selectedObj ? '선택된 도형 속성 편집' : '성군 속성 및 작도 스타일 설정'}
          className={`w-9 h-8 border flex flex-col items-center justify-center gap-0.5 transition-colors ${
            popover === 'props' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '5px' }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[8px] leading-none font-medium">속성</span>
        </button>

        {/* Active Asterism Layer Manager Popover Toggle */}
        <button
          type="button"
          onClick={() => onChangePopover(popover === 'layers' ? 'none' : 'layers')}
          title="현재 제작중인 성군레이어 관리"
          className={`w-9 h-8 border flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
            popover === 'layers' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '5px' }}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[8px] leading-none font-medium">레이어</span>
          {activeAsterismShapes.length > 0 && (
            <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-cyan-500 text-slate-950 font-mono text-[8px] font-bold flex items-center justify-center">
              {activeAsterismShapes.length}
            </span>
          )}
        </button>

        {/* Optical Eyepiece / Finder Integration Popover Toggle */}
        <button
          type="button"
          onClick={() => onChangePopover(popover === 'optics' ? 'none' : 'optics')}
          title="아이피스 · 파인더 시야 원 연동"
          className={`w-9 h-8 border flex flex-col items-center justify-center gap-0.5 transition-colors ${
            popover === 'optics' || optics.showEyepiece || optics.showFinder7x50
              ? ui.buttonActive
              : ui.buttonIdle
          }`}
          style={{ borderRadius: '5px' }}
        >
          <Crosshair className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[8px] leading-none font-medium">시야원</span>
        </button>

        <div className={`w-6 h-px my-0.5 ${ui.divider} border-t`} />

        {/* Undo / Redo */}
        <div className="flex flex-col gap-1 w-full items-center">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="실행 취소 (Ctrl+Z)"
            className={`w-9 h-7 border flex items-center justify-center ${
              canUndo ? ui.buttonIdle : `${ui.buttonIdle} opacity-40 cursor-not-allowed`
            }`}
            style={{ borderRadius: '5px' }}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="다시 실행 (Ctrl+Y)"
            className={`w-9 h-7 border flex items-center justify-center ${
              canRedo ? ui.buttonIdle : `${ui.buttonIdle} opacity-40 cursor-not-allowed`
            }`}
            style={{ borderRadius: '5px' }}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Share / Backup Modal */}
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          title="개별/전체 성군 JSON 백업 · URL/QR 공유"
          className={`w-9 h-8 border flex flex-col items-center justify-center gap-0.5 transition-colors ${ui.buttonIdle}`}
          style={{ borderRadius: '5px' }}
        >
          <Share2 className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[8px] leading-none font-medium">백업</span>
        </button>

        {/* Close Drawing Mode */}
        <button
          type="button"
          onClick={onCloseDrawingMode}
          title="성군 작도 모드 종료"
          className={`w-9 h-7 border flex items-center justify-center transition-colors ${ui.buttonIdle}`}
          style={{ borderRadius: '5px' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Contextual Floating Popover Panel (to the left of the vertical toolbox) */}
      {popover !== 'none' && (
        <div
          className={`no-print absolute top-1/2 -translate-y-1/2 z-20 w-[284px] max-h-[80vh] overflow-y-auto astro-scroll border p-3 shadow-lg backdrop-blur-md text-[11px] space-y-3 ${ui.panel}`}
          style={{ right: `${popoverRightPx}px`, borderRadius: '8px' }}
        >
          <div className={`flex items-center justify-between pb-1.5 border-b ${ui.divider}`}>
            <span className={`font-semibold text-[11.5px] ${ui.textPrimary}`}>{popoverTitle}</span>
            <button
              type="button"
              onClick={() => onChangePopover('none')}
              aria-label="닫기"
              className={`p-0.5 border ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* POPOVER 1: PROPERTIES ("속성") */}
          {popover === 'props' && (
            <div className="space-y-2.5">
              {/* CASE A: A SHAPE IS SELECTED -> "선택된 도형 속성" */}
              {selectedObj ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 border text-[9.5px] font-semibold ${ui.buttonActive}`}
                      style={{ borderRadius: '4px' }}
                    >
                      {getShapeTypeLabel(selectedObj)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectObject(null)}
                        title="도형 선택 해제 (성군 속성 보기)"
                        className={`px-1.5 py-0.5 border text-[9.5px] ${ui.buttonIdle}`}
                        style={{ borderRadius: '4px' }}
                      >
                        성군 속성
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteObject(selectedObj.id)}
                        title="선택된 도형 삭제"
                        className={`p-1 border text-red-400 hover:bg-red-500/15 ${ui.border}`}
                        style={{ borderRadius: '4px' }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Shape Name (not rendered on chart) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className={`text-[10px] ${ui.textSecondary}`}>도형 이름</label>
                      <span className={`text-[9px] ${ui.textMuted}`}>성도에 미표시</span>
                    </div>
                    <input
                      type="text"
                      value={selectedObj.label}
                      onChange={(e) => onUpdateObject(selectedObj.id, { label: e.target.value })}
                      placeholder="예: 선 1, 원 2"
                      className={`w-full px-2 py-1 border text-[11px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    />
                  </div>

                  {/* Layer / Parent Asterism ABOVE memo/text */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-1">
                      <label className={`text-[10px] block ${ui.textSecondary}`}>레이어 (그룹)</label>
                      <select
                        value={activeAsterism?.layerId ?? selectedObj.layerId}
                        onChange={(e) => {
                          const nextLayerId = e.target.value;
                          if (activeAsterism) {
                            onUpdateAsterismGroup(activeAsterism.id, { layerId: nextLayerId });
                          } else {
                            onUpdateObject(selectedObj.id, { layerId: nextLayerId });
                          }
                        }}
                        className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                        style={{ borderRadius: '4px' }}
                      >
                        {store.layers.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] block ${ui.textSecondary}`}>소속 성군</label>
                      <select
                        value={selectedObj.asterismId}
                        onChange={(e) => {
                          const targetGrp = store.asterisms.find((g) => g.id === e.target.value);
                          if (targetGrp) {
                            onUpdateObject(selectedObj.id, {
                              asterismId: targetGrp.id,
                              layerId: targetGrp.layerId,
                            });
                            onSetActiveAsterism(targetGrp.id);
                          }
                        }}
                        className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                        style={{ borderRadius: '4px' }}
                      >
                        {store.asterisms.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Polyline Mode: 선 (직선) vs 원호 (곡선) */}
                  {selectedObj.type === 'polyline' && (
                    <div className="space-y-1">
                      <span className={`text-[10px] block ${ui.textSecondary}`}>폴리라인 형태</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateObject(selectedObj.id, { smooth: false })}
                          className={`py-1 border text-[10px] font-medium ${
                            !selectedObj.smooth ? ui.buttonActive : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          선 (직선 연결)
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateObject(selectedObj.id, { smooth: true })}
                          className={`py-1 border text-[10px] font-medium ${
                            selectedObj.smooth ? ui.buttonActive : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          원호 (부드러운 곡선)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Circle Properties: Interior Fill + Eyepiece/Finder FOV Link */}
                  {selectedObj.type === 'circle' && (
                    <div className={`space-y-2 p-2 border ${ui.panelMuted} ${ui.border}`} style={{ borderRadius: '5px' }}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={ui.textSecondary}>현재 원 크기</span>
                        <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                          R {formatAngularSeparation(getCircleRadiusDeg(selectedObj))} · Ø{' '}
                          {formatAngularSeparation(getCircleRadiusDeg(selectedObj) * 2)}
                        </span>
                      </div>

                      <label className="flex items-center justify-between cursor-pointer text-[10px]">
                        <span className={ui.textSecondary}>내부 채우기</span>
                        <input
                          type="checkbox"
                          checked={(selectedObj.fillAlpha ?? 0) > 0}
                          onChange={(e) =>
                            onUpdateObject(selectedObj.id, {
                              fillAlpha: e.target.checked
                                ? Math.max(0.08, store.settings.defaultFillAlpha || 0.12)
                                : 0,
                            })
                          }
                          className={`w-3.5 h-3.5 ${accentRangeCls}`}
                        />
                      </label>

                      {(selectedObj.fillAlpha ?? 0) > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={ui.textMuted}>채우기 투명도</span>
                            <span className={`font-mono ${ui.textPrimary}`}>
                              {Math.round((selectedObj.fillAlpha ?? 0) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.02}
                            max={0.45}
                            step={0.01}
                            value={selectedObj.fillAlpha ?? 0.12}
                            onChange={(e) =>
                              onUpdateObject(selectedObj.id, { fillAlpha: Number(e.target.value) })
                            }
                            className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                          />
                        </div>
                      )}

                      <div className={`pt-1.5 border-t space-y-1 ${ui.divider}`}>
                        <span className={`text-[9.5px] block ${ui.textMuted}`}>
                          광학 시야 크기로 원 크기 맞추기
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateObject(selectedObj.id, {
                                radiusDeg: Math.max(0.02, optics.eyepieceFovDeg / 2),
                              })
                            }
                            className={`py-1 px-1.5 border text-[9.5px] font-mono ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            아이피스 Ø{optics.eyepieceFovDeg.toFixed(2)}°
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateObject(selectedObj.id, {
                                radiusDeg: Math.max(0.1, finderFovDeg / 2),
                              })
                            }
                            className={`py-1 px-1.5 border text-[9.5px] font-mono ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            파인더 Ø{finderFovDeg.toFixed(2)}°
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Polygon Interior Fill */}
                  {selectedObj.type === 'polygon' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={ui.textSecondary}>내부 채우기 투명도</span>
                        <span className={`font-mono ${ui.textPrimary}`}>
                          {Math.round((selectedObj.fillAlpha ?? 0.08) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.45}
                        step={0.02}
                        value={selectedObj.fillAlpha ?? 0.08}
                        onChange={(e) =>
                          onUpdateObject(selectedObj.id, { fillAlpha: Number(e.target.value) })
                        }
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>
                  )}

                  {/* Arrow Extension Multiplier */}
                  {selectedObj.type === 'arrow' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={ui.textSecondary}>방향 연장 배수 (1×~5×)</span>
                        <span className={`font-mono ${ui.textPrimary}`}>
                          {(selectedObj.extensionFactor ?? 1).toFixed(1)}×
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={0.5}
                        value={selectedObj.extensionFactor ?? 1}
                        onChange={(e) =>
                          onUpdateObject(selectedObj.id, {
                            extensionFactor: Number(e.target.value),
                          })
                        }
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>
                  )}

                  {/* Text Element: Multiline Content Box + Dedicated Text Opacity */}
                  {selectedObj.type === 'label' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className={`text-[10px] block ${ui.textSecondary}`}>
                          텍스트 내용 (관측 메모 · 여러 줄 가능)
                        </label>
                        <textarea
                          rows={3}
                          value={selectedObj.memo ?? ''}
                          onChange={(e) => onUpdateObject(selectedObj.id, { memo: e.target.value })}
                          placeholder={'성도에 표시할 텍스트를 입력하세요.\nEnter로 줄바꿈할 수 있습니다.'}
                          className={`w-full px-2 py-1.5 border text-[10.5px] leading-snug resize-y ${ui.input}`}
                          style={{ borderRadius: '4px' }}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={ui.textSecondary}>텍스트 크기</span>
                          <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                            {Math.round(selectedObj.textSize ?? 11)}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={8}
                          max={32}
                          step={1}
                          value={selectedObj.textSize ?? 11}
                          onChange={(e) =>
                            onUpdateObject(selectedObj.id, {
                              textSize: Number(e.target.value),
                            })
                          }
                          className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={ui.textSecondary}>텍스트 투명도</span>
                          <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                            {Math.round((selectedObj.textOpacity ?? selectedObj.opacity ?? 0.95) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={1.0}
                          step={0.05}
                          value={selectedObj.textOpacity ?? selectedObj.opacity ?? 0.95}
                          onChange={(e) =>
                            onUpdateObject(selectedObj.id, {
                              textOpacity: Number(e.target.value),
                            })
                          }
                          className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stroke Style / Width (up to 10px) / Opacity for non-label shapes */}
                  {selectedObj.type !== 'label' && (
                    <div className={`pt-2 border-t space-y-2 ${ui.divider}`}>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            ['solid', '실선'],
                            ['dashed', '점선'],
                            ['dashdot', '일점쇄선'],
                          ] as [AsterismLineStyle, string][]
                        ).map(([st, lbl]) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => onUpdateObject(selectedObj.id, { lineStyle: st })}
                            className={`py-1 border text-[10px] ${
                              selectedObj.lineStyle === st ? ui.buttonActive : ui.buttonIdle
                            }`}
                            style={{ borderRadius: '4px' }}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={ui.textSecondary}>선 두께</span>
                          <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                            {selectedObj.lineWidth.toFixed(1)}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.5}
                          max={10.0}
                          step={0.1}
                          value={selectedObj.lineWidth}
                          onChange={(e) =>
                            onUpdateObject(selectedObj.id, { lineWidth: Number(e.target.value) })
                          }
                          className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={ui.textSecondary}>선 투명도</span>
                          <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                            {Math.round(selectedObj.opacity * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={1.0}
                          step={0.05}
                          value={selectedObj.opacity}
                          onChange={(e) =>
                            onUpdateObject(selectedObj.id, { opacity: Number(e.target.value) })
                          }
                          className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Color Swatches + Custom Color Picker */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className={`text-[10px] shrink-0 ${ui.textSecondary}`}>색상</span>
                    {renderColorPalette(selectedObj.color, (hex) =>
                      onUpdateObject(selectedObj.id, { color: hex })
                    )}
                  </div>
                </div>
              ) : (
                /* CASE B: NO SHAPE SELECTED -> "성군 속성" */
                <div className="space-y-3">
                  {activeAsterism ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`px-1.5 py-0.5 border text-[9.5px] font-semibold ${
                            theme === 'white'
                              ? 'border-amber-400/70 bg-amber-50 text-amber-800'
                              : theme === 'red'
                              ? 'border-red-800 bg-[#260606] text-red-300'
                              : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          성군 · 도형 {activeAsterismShapes.length}개
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onFocusAsterismGroup(activeAsterism)}
                            title="이 성군 위치·시야로 바로가기"
                            className={`p-1 border ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            <Navigation className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadSingleAsterismJson(store, activeAsterism.id);
                              setNotice(`‘${activeAsterism.name}’ 개별 백업 완료`);
                            }}
                            title="이 성군만 개별 JSON 백업"
                            className={`p-1 border ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onCreateAsterismGroup()}
                            title="새 성군 만들기"
                            className={`px-1.5 py-0.5 border text-[9.5px] flex items-center gap-0.5 ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>새 성군</span>
                          </button>
                        </div>
                      </div>

                      {/* Asterism Name (NOT rendered on chart) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className={`text-[10px] ${ui.textSecondary}`}>성군 이름</label>
                          <span className={`text-[9px] ${ui.textMuted}`}>성도에 미표시</span>
                        </div>
                        <input
                          type="text"
                          value={activeAsterism.name}
                          onChange={(e) =>
                            onUpdateAsterismGroup(activeAsterism.id, { name: e.target.value })
                          }
                          placeholder="예: 약혼반지, M45 별 사슬"
                          className={`w-full px-2 py-1 border text-[11px] ${ui.input}`}
                          style={{ borderRadius: '4px' }}
                        />
                      </div>

                      {/* Layer Selector ABOVE Observation Memo + Apply View Button underneath */}
                      <div className="space-y-1.5">
                        <label className={`text-[10px] block ${ui.textSecondary}`}>
                          레이어 (그룹)
                        </label>
                        <select
                          value={activeAsterism.layerId}
                          onChange={(e) =>
                            onUpdateAsterismGroup(activeAsterism.id, { layerId: e.target.value })
                          }
                          className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
                          style={{ borderRadius: '4px' }}
                        >
                          {store.layers.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>

                        {/* Save Current Position & FOV Button directly beneath Layer */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onSaveAsterismGroupView(activeAsterism.id);
                              setNotice('현재 성도 위치와 시야각을 저장했습니다.');
                            }}
                            className={`flex-1 py-1 px-2 border text-[10px] font-medium flex items-center justify-center gap-1 ${ui.buttonActive}`}
                            style={{ borderRadius: '4px' }}
                            title="현재 성도 중심 좌표와 시야각을 저장하여 바로가기 시 그대로 이동합니다"
                          >
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>위치·시야 적용</span>
                          </button>
                          {activeAsterism.savedView && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateAsterismGroup(activeAsterism.id, { savedView: undefined })
                              }
                              title="저장된 위치·시야 초기화"
                              className={`px-1.5 py-1 border text-[9.5px] ${ui.buttonIdle}`}
                              style={{ borderRadius: '4px' }}
                            >
                              초기화
                            </button>
                          )}
                        </div>
                        {activeAsterism.savedView && (
                          <div
                            className={`text-[9.5px] font-mono tabular-nums px-1.5 py-1 border ${ui.panelMuted} ${ui.border} ${ui.textSecondary}`}
                            style={{ borderRadius: '4px' }}
                          >
                            저장 시야: {formatShortRa(activeAsterism.savedView.raDeg)}{' '}
                            {formatShortDec(activeAsterism.savedView.decDeg)} ·{' '}
                            {activeAsterism.savedView.fsz.toFixed(2)}°
                          </div>
                        )}
                      </div>

                      {/* Observation Memo (Multiline Textarea) */}
                      <div className="space-y-1">
                        <label className={`text-[10px] block ${ui.textSecondary}`}>
                          관측 메모 (여러 줄)
                        </label>
                        <textarea
                          rows={3}
                          value={activeAsterism.memo ?? ''}
                          onChange={(e) =>
                            onUpdateAsterismGroup(activeAsterism.id, { memo: e.target.value })
                          }
                          placeholder={'성군 관측 포인트나 호핑 안내를 여러 줄로 기록하세요.'}
                          className={`w-full px-2 py-1.5 border text-[10.5px] leading-snug resize-y ${ui.input}`}
                          style={{ borderRadius: '4px' }}
                        />
                      </div>

                      {/* Recommended Magnification (Line-broken cleanly) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <label className={`text-[10px] ${ui.textSecondary}`}>권장 배율</label>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAsterismGroup(activeAsterism.id, {
                                eyepieceTag: currentEyepieceTag,
                              })
                            }
                            title={`현재 장비(${currentEyepieceTag}) 자동 입력`}
                            className={`px-1.5 py-0.5 border text-[9.5px] ${ui.buttonIdle}`}
                            style={{ borderRadius: '4px' }}
                          >
                            현재장비 적용
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={activeAsterism.eyepieceTag ?? ''}
                          onChange={(e) =>
                            onUpdateAsterismGroup(activeAsterism.id, {
                              eyepieceTag: e.target.value,
                            })
                          }
                          placeholder={'예: 30mm 82° · 50×\n저배율 광시야 권장'}
                          className={`w-full px-2 py-1 border text-[10.5px] leading-snug resize-y ${ui.input}`}
                          style={{ borderRadius: '4px' }}
                        />
                      </div>

                      {/* Display FOV Range ("표시 시야각") */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={ui.textSecondary}>표시 시야각</span>
                          <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                            {activeAsterism.visibleFovRange[0]}° ~{' '}
                            {activeAsterism.visibleFovRange[1]}°
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <label className={`text-[9.5px] ${ui.textMuted}`}>
                            최소 시야각(°)
                            <input
                              type="number"
                              min={0.02}
                              max={180}
                              step={0.05}
                              value={activeAsterism.visibleFovRange[0]}
                              onChange={(e) => {
                                const minV = Math.max(0.02, Number(e.target.value) || 0.05);
                                onUpdateAsterismGroup(activeAsterism.id, {
                                  visibleFovRange: [
                                    minV,
                                    Math.max(minV, activeAsterism.visibleFovRange[1]),
                                  ],
                                });
                              }}
                              className={`w-full mt-0.5 px-1.5 py-0.5 border font-mono text-[10px] ${ui.input}`}
                              style={{ borderRadius: '4px' }}
                            />
                          </label>
                          <label className={`text-[9.5px] ${ui.textMuted}`}>
                            최대 시야각(°)
                            <input
                              type="number"
                              min={0.05}
                              max={180}
                              step={0.5}
                              value={activeAsterism.visibleFovRange[1]}
                              onChange={(e) => {
                                const maxV = Math.max(
                                  activeAsterism.visibleFovRange[0],
                                  Number(e.target.value) || 15
                                );
                                onUpdateAsterismGroup(activeAsterism.id, {
                                  visibleFovRange: [activeAsterism.visibleFovRange[0], maxV],
                                });
                              }}
                              className={`w-full mt-0.5 px-1.5 py-0.5 border font-mono text-[10px] ${ui.input}`}
                              style={{ borderRadius: '4px' }}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          {FOV_PRESETS.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() =>
                                onUpdateAsterismGroup(activeAsterism.id, {
                                  visibleFovRange: [p.range[0], p.range[1]],
                                })
                              }
                              className={`py-0.5 border text-[9px] ${ui.buttonIdle}`}
                              style={{ borderRadius: '4px' }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-2.5 border space-y-2 text-center ${ui.panelMuted} ${ui.border}`}
                      style={{ borderRadius: '6px' }}
                    >
                      <p className={`text-[10px] leading-snug break-keep ${ui.textSecondary}`}>
                        현재 선택된 성군이 없습니다. 성도의 항성을 클릭하거나 아래 버튼으로 새 성군을 만드세요.
                      </p>
                      <button
                        type="button"
                        onClick={() => onCreateAsterismGroup()}
                        className={`w-full py-1.5 px-2 border text-[10.5px] font-semibold flex items-center justify-center gap-1 ${ui.buttonActive}`}
                        style={{ borderRadius: '4px' }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>새 성군 만들기</span>
                      </button>
                    </div>
                  )}

                  {/* Tool-specific & Default Drawing Style Settings */}
                  <div
                    className={`p-2.5 border space-y-2 ${
                      theme === 'white'
                        ? 'bg-sky-50/90 border-sky-200'
                        : theme === 'red'
                        ? 'bg-[#1D0404] border-[#5A1414]'
                        : 'bg-[#0B2030]/90 border-[#1C4866]'
                    }`}
                    style={{ borderRadius: '6px' }}
                  >
                    <div
                      className={`text-[10.5px] font-semibold ${
                        theme === 'white'
                          ? 'text-sky-900'
                          : theme === 'red'
                          ? 'text-[#FCA5A5]'
                          : 'text-cyan-300'
                      }`}
                    >
                      새 도형 기본 작도 속성
                    </div>

                    {/* Polyline Mode Default: 선 vs 원호 */}
                    <div className="space-y-1">
                      <span className={`text-[9.5px] block ${ui.textMuted}`}>
                        폴리라인 모드
                      </span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ defaultSmooth: false })}
                          className={`py-1 border text-[10px] font-medium ${
                            !store.settings.defaultSmooth ? ui.buttonActive : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          선 (직선)
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ defaultSmooth: true })}
                          className={`py-1 border text-[10px] font-medium ${
                            store.settings.defaultSmooth ? ui.buttonActive : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          원호 (곡선)
                        </button>
                      </div>
                    </div>

                    {/* Circle Properties Default: Interior Fill + Eyepiece / Finder FOV Link */}
                    <div
                      className={`p-2 border space-y-1.5 ${ui.panelMuted} ${ui.border}`}
                      style={{ borderRadius: '5px' }}
                    >
                      <div className={`text-[10px] font-semibold ${ui.textPrimary}`}>
                        원 그리기 속성
                      </div>
                      <label className="flex items-center justify-between cursor-pointer text-[10px]">
                        <span className={ui.textSecondary}>원 내부 채우기</span>
                        <input
                          type="checkbox"
                          checked={store.settings.defaultCircleFillEnabled}
                          onChange={(e) =>
                            onUpdateSettings({ defaultCircleFillEnabled: e.target.checked })
                          }
                          className={`w-3.5 h-3.5 ${accentRangeCls}`}
                        />
                      </label>
                      {store.settings.defaultCircleFillEnabled && (
                        <div>
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className={ui.textMuted}>채우기 투명도</span>
                            <span className={`font-mono ${ui.textPrimary}`}>
                              {Math.round(store.settings.defaultFillAlpha * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.02}
                            max={0.45}
                            step={0.01}
                            value={store.settings.defaultFillAlpha}
                            onChange={(e) =>
                              onUpdateSettings({ defaultFillAlpha: Number(e.target.value) })
                            }
                            className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                          />
                        </div>
                      )}
                      <label className="flex items-center justify-between cursor-pointer text-[10px] pt-0.5">
                        <span className={ui.textSecondary}>
                          아이피스 시야 연동 (Ø{optics.eyepieceFovDeg.toFixed(2)}°)
                        </span>
                        <input
                          type="checkbox"
                          checked={store.settings.circleLinkEyepiece}
                          onChange={(e) => handleToggleCircleLinkEyepiece(e.target.checked)}
                          className={`w-3.5 h-3.5 ${accentRangeCls}`}
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer text-[10px]">
                        <span className={ui.textSecondary}>
                          파인더 시야 연동 (Ø{finderFovDeg.toFixed(2)}°)
                        </span>
                        <input
                          type="checkbox"
                          checked={store.settings.circleLinkFinder}
                          onChange={(e) => handleToggleCircleLinkFinder(e.target.checked)}
                          className={`w-3.5 h-3.5 ${accentRangeCls}`}
                        />
                      </label>
                      {(store.settings.circleLinkEyepiece || store.settings.circleLinkFinder) && (
                        <p className={`text-[9px] leading-snug break-keep ${ui.accentText}`}>
                          원 도구 활성화 후 성도를 클릭하면 시야 크기의 원이 즉시 그려집니다.
                        </p>
                      )}
                    </div>

                    {/* Line Style */}
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          ['solid', '실선'],
                          ['dashed', '점선'],
                          ['dashdot', '일점쇄선'],
                        ] as [AsterismLineStyle, string][]
                      ).map(([st, lbl]) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => onUpdateSettings({ defaultLineStyle: st })}
                          className={`py-1 border text-[10px] ${
                            store.settings.defaultLineStyle === st
                              ? ui.buttonActive
                              : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    {/* Color Swatches + Custom Color Picker */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] shrink-0 ${ui.textMuted}`}>기본 색상</span>
                      {renderColorPalette(store.settings.defaultColor, (hex) =>
                        onUpdateSettings({ defaultColor: hex })
                      )}
                    </div>

                    {/* Line Width up to 10.0px */}
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={ui.textMuted}>선 두께</span>
                        <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                          {store.settings.defaultLineWidth.toFixed(1)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={10.0}
                        step={0.1}
                        value={store.settings.defaultLineWidth}
                        onChange={(e) =>
                          onUpdateSettings({ defaultLineWidth: Number(e.target.value) })
                        }
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>

                    {/* Line Opacity */}
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={ui.textMuted}>선 투명도</span>
                        <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                          {Math.round(store.settings.defaultOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        value={store.settings.defaultOpacity}
                        onChange={(e) =>
                          onUpdateSettings({ defaultOpacity: Number(e.target.value) })
                        }
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>

                    {/* Text Size */}
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={ui.textMuted}>텍스트 크기</span>
                        <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                          {Math.round(store.settings.defaultTextSize)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={32}
                        step={1}
                        value={store.settings.defaultTextSize}
                        onChange={(e) =>
                          onUpdateSettings({ defaultTextSize: Number(e.target.value) })
                        }
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>

                    {/* Dedicated Text Opacity */}
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={ui.textMuted}>텍스트 투명도</span>
                        <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                          {Math.round(store.settings.defaultTextOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        value={store.settings.defaultTextOpacity}
                        onChange={(e) =>
                          onUpdateSettings({ defaultTextOpacity: Number(e.target.value) })
                        }
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>
                  </div>

                  {/* Magnetic Snap Settings */}
                  <div className={`pt-2 border-t space-y-1.5 ${ui.divider}`}>
                    <div className={`text-[10px] font-semibold ${ui.textSecondary}`}>
                      별 자석 스냅 설정
                    </div>
                      <label className="flex items-center justify-between cursor-pointer text-[10px]">
                        <span className={ui.textMuted}>항성·DSO 자동 스냅</span>
                        <input
                          type="checkbox"
                          checked={store.settings.snapEnabled}
                          onChange={(e) => onUpdateSettings({ snapEnabled: e.target.checked })}
                          className={`w-3.5 h-3.5 ${accentRangeCls}`}
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer text-[10px]">
                        <span className={ui.textMuted}>빈 공간 자유 좌표 허용</span>
                        <input
                          type="checkbox"
                          checked={store.settings.allowFreeSpace}
                          onChange={(e) => onUpdateSettings({ allowFreeSpace: e.target.checked })}
                          className={`w-3.5 h-3.5 ${accentRangeCls}`}
                        />
                      </label>
                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={ui.textMuted}>스냅 반경 / 한계 등급</span>
                          <span className={`font-mono tabular-nums ${ui.textPrimary}`}>
                            {store.settings.snapRadiusPx}px · ≤{store.settings.snapMaxMag.toFixed(1)}m
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <input
                            type="range"
                            min={8}
                            max={36}
                            step={2}
                            value={store.settings.snapRadiusPx}
                            onChange={(e) =>
                              onUpdateSettings({ snapRadiusPx: Number(e.target.value) })
                            }
                            className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                          />
                          <input
                            type="range"
                            min={4.0}
                            max={14.0}
                            step={0.5}
                            value={store.settings.snapMaxMag}
                            onChange={(e) =>
                              onUpdateSettings({ snapMaxMag: Number(e.target.value) })
                            }
                            className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                          />
                        </div>
                      </div>
                    </div>
                </div>
              )}
            </div>
          )}

          {/* POPOVER 2: ACTIVE ASTERISM LAYER MANAGER (ONLY CURRENT WORKING ASTERISM!) */}
          {popover === 'layers' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className={`text-[10px] ${ui.textSecondary}`}>현재 제작중인 성군</span>
                <button
                  type="button"
                  onClick={() => onCreateAsterismGroup()}
                  className={`px-2 py-0.5 border text-[10px] font-medium flex items-center gap-0.5 ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  <Plus className="w-3 h-3" />
                  <span>새 성군</span>
                </button>
              </div>

              {activeAsterism ? (
                <div
                  className={`border overflow-hidden ${ui.border}`}
                  style={{ borderRadius: '6px' }}
                >
                  {/* Active Asterism Header (Amber tinted) */}
                  <div
                    className={`px-2 py-1.5 flex items-center gap-1.5 ${
                      theme === 'white'
                        ? 'bg-amber-50/90'
                        : theme === 'red'
                        ? 'bg-[#260606]'
                        : 'bg-amber-500/12'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleAsterismGroupVisible(activeAsterism.id)}
                      title={activeAsterism.visible ? '성군 숨기기' : '성군 표시'}
                      className={`p-0.5 shrink-0 ${
                        activeAsterism.visible ? ui.accentText : ui.textMuted
                      }`}
                    >
                      {activeAsterism.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSetActiveAsterism(activeAsterism.id);
                        onSelectObject(null);
                        onChangePopover('props');
                      }}
                      title="클릭하여 성군 속성 편집"
                      className="min-w-0 flex-1 text-left rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <div className={`text-[11px] font-semibold truncate ${ui.textPrimary}`}>
                        {activeAsterism.name}
                      </div>
                      <div className={`text-[9px] truncate ${ui.textMuted}`}>
                        그룹: {activeAsterismLayer?.name ?? '기본'} · 표시 시야각{' '}
                        {activeAsterism.visibleFovRange[0]}°~{activeAsterism.visibleFovRange[1]}°
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onFocusAsterismGroup(activeAsterism)}
                      title="이 성군 위치·시야로 바로가기"
                      className={`p-1 border shrink-0 ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      <Navigation className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAsterismGroup(activeAsterism.id)}
                      title="현재 성군 삭제"
                      className={`p-1 ${ui.textMuted} hover:text-red-400 shrink-0`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Child Shapes of Current Working Asterism ONLY (NO quick-jump icon on shapes!) */}
                  <div className={`border-t divide-y ${ui.divider}`}>
                    {activeAsterismShapes.length === 0 ? (
                      <div className={`px-2.5 py-3 text-center text-[10px] ${ui.textMuted}`}>
                        도형 도구를 선택해 성도에 도형을 추가하세요.
                      </div>
                    ) : (
                      activeAsterismShapes.map((obj) => {
                        const isSel = obj.id === selectedObjectId;
                        return (
                          <div
                            key={obj.id}
                            className={`px-2 py-1.5 flex items-center gap-1.5 text-[10px] transition-colors ${
                              isSel
                                ? theme === 'white'
                                  ? 'bg-sky-100/90'
                                  : theme === 'red'
                                  ? 'bg-red-950/50'
                                  : 'bg-cyan-500/20'
                                : theme === 'white'
                                ? 'bg-sky-50/40 hover:bg-sky-50'
                                : theme === 'red'
                                ? 'bg-[#140303] hover:bg-[#1E0505]'
                                : 'bg-slate-900/40 hover:bg-slate-800/50'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                theme === 'white' ? 'border border-slate-400/70' : ''
                              }`}
                              style={{
                                backgroundColor: theme === 'red' ? '#EF4444' : obj.color,
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onSelectObject(obj.id);
                                onChangePopover('props');
                              }}
                              className="flex-1 text-left min-w-0 flex items-center gap-1.5"
                              title="클릭하여 도형 선택 및 속성 편집"
                            >
                              <span
                                className={`px-1 py-[0.5px] border text-[8.5px] shrink-0 ${ui.border} ${ui.textMuted}`}
                                style={{ borderRadius: '3px' }}
                              >
                                {getShapeTypeLabel(obj)}
                              </span>
                              <span className={`truncate font-medium ${ui.textPrimary}`}>
                                {obj.label || '(이름 없음)'}
                              </span>
                            </button>
                            <span className={`font-mono text-[9px] tabular-nums shrink-0 ${ui.textMuted}`}>
                              {obj.type === 'circle'
                                ? `Ø${formatAngularSeparation(getCircleRadiusDeg(obj) * 2)}`
                                : obj.type === 'label'
                                ? '텍스트'
                                : `${obj.vertices.length}점`}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteObject(obj.id)}
                              title="도형 삭제"
                              className={`p-0.5 ${ui.textMuted} hover:text-red-400 shrink-0`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`p-3 border text-center space-y-2 ${ui.panelMuted} ${ui.border}`}
                  style={{ borderRadius: '6px' }}
                >
                  <p className={`text-[10px] leading-snug break-keep ${ui.textMuted}`}>
                    현재 제작중인 성군이 없습니다. 성도의 항성을 클릭하거나 새 성군을 만들어 시작하세요.
                  </p>
                  <button
                    type="button"
                    onClick={() => onCreateAsterismGroup()}
                    className={`w-full py-1.5 border text-[10px] font-semibold flex items-center justify-center gap-1 ${ui.buttonActive}`}
                    style={{ borderRadius: '4px' }}
                  >
                    <Plus className="w-3 h-3" />
                    <span>새 성군 시작</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* POPOVER 3: OPTICAL EYEPIECE / FINDER CIRCLE INTEGRATION */}
          {popover === 'optics' && (
            <div className="space-y-2">
              <p className={`text-[10px] leading-snug break-keep ${ui.textMuted}`}>
                아이피스·파인더 시야 원을 띄우거나, 원 그리기 도구와 연동하여 시야 크기 그대로 원을 작도할 수 있습니다.
              </p>

              <div className="space-y-1">
                <label className="flex items-center justify-between py-0.5 cursor-pointer">
                  <span className={ui.textSecondary}>
                    망원경 아이피스 원 ({optics.eyepieceFovDeg.toFixed(2)}°)
                  </span>
                  <input
                    type="checkbox"
                    checked={optics.showEyepiece}
                    onChange={(e) =>
                      onChangeOptics((p) => ({ ...p, showEyepiece: e.target.checked }))
                    }
                    className={`w-3.5 h-3.5 ${accentRangeCls}`}
                  />
                </label>
                <label className="flex items-center justify-between py-0.5 cursor-pointer">
                  <span className={`truncate ${ui.textSecondary}`}>
                    {finderLabel} ({finderFovDeg.toFixed(1)}°)
                  </span>
                  <input
                    type="checkbox"
                    checked={optics.showFinder7x50}
                    onChange={(e) =>
                      onChangeOptics((p) => ({ ...p, showFinder7x50: e.target.checked }))
                    }
                    className={`w-3.5 h-3.5 ${accentRangeCls}`}
                  />
                </label>
                <label className="flex items-center justify-between py-0.5 cursor-pointer">
                  <span className={ui.textSecondary}>텔라드 동심원 (0.5°/2°/4°)</span>
                  <input
                    type="checkbox"
                    checked={optics.showTelrad}
                    onChange={(e) =>
                      onChangeOptics((p) => ({ ...p, showTelrad: e.target.checked }))
                    }
                    className={`w-3.5 h-3.5 ${accentRangeCls}`}
                  />
                </label>
              </div>

              <div className={`pt-2 border-t space-y-1 ${ui.divider}`}>
                <div className={`text-[10px] font-medium ${ui.textSecondary}`}>
                  원 그리기 시야 연동 (클릭 시 원 생성)
                </div>
                <label className="flex items-center justify-between py-0.5 cursor-pointer">
                  <span className={ui.textSecondary}>아이피스 시야 크기 연동</span>
                  <input
                    type="checkbox"
                    checked={store.settings.circleLinkEyepiece}
                    onChange={(e) => {
                      handleToggleCircleLinkEyepiece(e.target.checked);
                      if (e.target.checked) onChangeTool('circle');
                    }}
                    className={`w-3.5 h-3.5 ${accentRangeCls}`}
                  />
                </label>
                <label className="flex items-center justify-between py-0.5 cursor-pointer">
                  <span className={ui.textSecondary}>파인더 시야 크기 연동</span>
                  <input
                    type="checkbox"
                    checked={store.settings.circleLinkFinder}
                    onChange={(e) => {
                      handleToggleCircleLinkFinder(e.target.checked);
                      if (e.target.checked) onChangeTool('circle');
                    }}
                    className={`w-3.5 h-3.5 ${accentRangeCls}`}
                  />
                </label>
              </div>

              <div className={`pt-2 border-t space-y-1 ${ui.divider}`}>
                <div className={`text-[10px] font-medium ${ui.textSecondary}`}>
                  광학계 반전 동기화 (라벨 정방향 유지)
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => onChangeView((p) => ({ ...p, flipH: !p.flipH }))}
                    className={`py-1 border text-[10px] ${
                      view.flipH ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    좌우반전 (천정미러)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeView((p) => ({
                        ...p,
                        flipH: !(p.flipH && p.flipV),
                        flipV: !(p.flipH && p.flipV),
                      }))
                    }
                    className={`py-1 border text-[10px] ${
                      view.flipH && view.flipV ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    180° 도립 (뉴턴식)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Share & Individual / Full Backup Modal */}
      {shareOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className={`w-full max-w-md border p-4 space-y-3 text-xs shadow-xl ${ui.panel}`}
            style={{ borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-2 border-b ${ui.divider}`}>
              <div className="flex items-center gap-1.5">
                <QrCode className={`w-4 h-4 ${ui.accentText}`} />
                <h3 className={`font-semibold text-sm ${ui.textPrimary}`}>
                  성군 백업 및 공유 관리
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                aria-label="공유 모달 닫기"
                className={`p-1 border ${ui.buttonIdle}`}
                style={{ borderRadius: '4px' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Individual & Full JSON Backup / Import */}
            <div className="space-y-1.5">
              <div className={`text-[11px] font-semibold ${ui.textSecondary}`}>
                JSON 백업 파일 ({store.layers.length}그룹 · {store.asterisms.length}성군 ·{' '}
                {store.objects.length}도형)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!activeAsterism}
                  onClick={() => {
                    if (activeAsterism) {
                      downloadSingleAsterismJson(store, activeAsterism.id);
                      setNotice(`‘${activeAsterism.name}’ 개별 백업 완료`);
                    }
                  }}
                  className={`py-1.5 px-2.5 border font-medium flex items-center justify-center gap-1.5 ${
                    !activeAsterism
                      ? `${ui.buttonIdle} opacity-45 cursor-not-allowed`
                      : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>개별 성군 백업</span>
                </button>
                <button
                  type="button"
                  disabled={store.asterisms.length === 0}
                  onClick={() => downloadAsterismsJson(store)}
                  className={`py-1.5 px-2.5 border font-medium flex items-center justify-center gap-1.5 ${
                    store.asterisms.length === 0
                      ? `${ui.buttonIdle} opacity-45 cursor-not-allowed`
                      : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>전체 성군 백업</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className={`w-full py-1.5 px-2.5 border font-medium flex items-center justify-center gap-1.5 ${ui.buttonIdle}`}
                style={{ borderRadius: '5px' }}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>JSON 백업 불러오기 (개별 / 전체)</span>
              </button>
            </div>

            {/* URL Share & QR Code */}
            <div className={`pt-2.5 border-t space-y-2 ${ui.divider}`}>
              <div className={`text-[11px] font-semibold ${ui.textSecondary}`}>
                URL 압축 링크 및 QR 코드 공유
              </div>
              {shareUrl && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className={`flex-1 min-w-0 px-2 py-1 border font-mono text-[10px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    className={`px-2.5 py-1 border font-medium flex items-center gap-1 shrink-0 ${
                      copiedShare ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    {copiedShare ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedShare ? '복사됨' : '복사'}</span>
                  </button>
                </div>
              )}

              {qrDataUrl ? (
                <div className="flex flex-col items-center gap-1.5 py-2">
                  <img
                    src={qrDataUrl}
                    alt="성군 벡터 데이터 공유 QR 코드"
                    className={`w-[196px] h-[196px] border p-1.5 ${ui.border}`}
                    style={{ borderRadius: '6px' }}
                  />
                  <span className={`text-[10px] ${ui.textMuted}`}>
                    스마트폰·태블릿으로 스캔하면 현재 시야와 성군 데이터가 즉시 불러와집니다.
                  </span>
                </div>
              ) : (
                qrError && (
                  <p className={`text-[10.5px] leading-snug ${ui.textMuted}`}>{qrError}</p>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
