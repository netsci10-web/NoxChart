import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CircleDot,
  Copy,
  Delete,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  Layers,
  Magnet,
  MousePointer2,
  MoveUpRight,
  Navigation,
  Pencil,
  Pentagon,
  QrCode,
  Redo2,
  SlidersHorizontal,
  Sparkles,
  Spline,
  Trash2,
  Type,
  Undo2,
  Upload,
  Waypoints,
  X,
} from 'lucide-react';
import {
  AsterismDraftState,
  AsterismLabelAnchor,
  AsterismLineStyle,
  AsterismObject,
  AsterismStoreState,
  AsterismTool,
  ChartViewState,
  OpticsSettings,
  ThemeMode,
} from '../types/astronomy';
import {
  ASTERISM_COLOR_SWATCHES,
  buildAsterismShareUrl,
  downloadAsterismsJson,
  parseAsterismsFromJson,
} from '../utils/asterismStorage';
import { getUiTheme } from '../utils/themeClasses';

interface AsterismToolboxProps {
  theme: ThemeMode;
  rightDrawerOpen: boolean;
  view: ChartViewState;
  optics: OpticsSettings;
  store: AsterismStoreState;
  activeTool: AsterismTool;
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
  onLoadPresets: () => number;
  onImportBundle: (
    layers: AsterismStoreState['layers'],
    objects: AsterismObject[]
  ) => { addedCount: number };
  onFocusObject: (obj: AsterismObject) => void;
  onChangeOptics: (updater: (prev: OpticsSettings) => OpticsSettings) => void;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
}

const TOOL_BUTTONS: {
  id: AsterismTool;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'select',
    label: '선택 · 탐색 (대기)',
    hint: '기본 모드 — 별 클릭 시 천체 선택, 성군 클릭 시 정점 편집 (그리려면 아래 작도 도구 선택)',
    Icon: MousePointer2,
  },
  {
    id: 'polyline',
    label: '폴리라인 (스타 체인)',
    hint: '클릭으로 별 사슬 연결 · 더블클릭/Enter로 완료',
    Icon: Waypoints,
  },
  {
    id: 'polygon',
    label: '다각형 (호핑 도형)',
    hint: '삼각형·마름모 등 반투명 채움 폐곡선 · 더블클릭/Enter로 닫기',
    Icon: Pentagon,
  },
  {
    id: 'arrow',
    label: '방향 벡터 (화살표)',
    hint: '호핑 방향 및 연장 배수 지시선 · 더블클릭/Enter로 완료',
    Icon: MoveUpRight,
  },
  {
    id: 'label',
    label: '텍스트 · 배율 태그',
    hint: '클릭 위치에 스케일 종속 성군 이름·관측 메모·배율 태그 부착',
    Icon: Type,
  },
];

const LINE_STYLE_OPTIONS: { id: AsterismLineStyle; label: string }[] = [
  { id: 'dashed', label: '점선' },
  { id: 'dashdot', label: '일점쇄선' },
  { id: 'solid', label: '실선' },
];

const ANCHOR_OPTIONS: { id: AsterismLabelAnchor; label: string }[] = [
  { id: 'top', label: '상' },
  { id: 'bottom', label: '하' },
  { id: 'left', label: '좌' },
  { id: 'right', label: '우' },
];

export function AsterismToolbox({
  theme,
  rightDrawerOpen,
  view,
  optics,
  store,
  activeTool,
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
  onSetActiveLayer,
  onToggleLayerVisible,
  onCreateLayer,
  onRenameLayer,
  onDeleteLayer,
  onLoadPresets,
  onImportBundle,
  onFocusObject,
  onChangeOptics,
  onChangeView,
}: AsterismToolboxProps) {
  const ui = getUiTheme(theme);
  const [popover, setPopover] = useState<'style' | 'layers' | 'optics' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newLayerName, setNewLayerName] = useState('');
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const selectedObj = selectedObjectId
    ? store.objects.find((o) => o.id === selectedObjectId) ?? null
    : null;

  // Auto-open style/properties popover when a standalone label is created & selected
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedObj && selectedObj.id !== prevSelectedRef.current) {
      if (selectedObj.type === 'label') {
        setPopover('style');
      }
    }
    prevSelectedRef.current = selectedObj?.id ?? null;
  }, [selectedObj]);

  // Generate compressed share URL & QR code whenever Share modal opens
  useEffect(() => {
    if (!shareOpen) return;
    if (store.objects.length === 0) {
      setShareUrl('');
      setQrDataUrl(null);
      setQrError('공유할 성군 벡터 데이터가 없습니다. 먼저 성도 위에 작도하거나 프리셋을 불러오세요.');
      return;
    }
    const url = buildAsterismShareUrl(store.layers, store.objects, {
      ra: view.ra,
      dec: view.dec,
      fsz: view.fsz,
    });
    setShareUrl(url);
    if (url.length > 2600) {
      setQrDataUrl(null);
      setQrError(
        `데이터가 커서(${url.length}자) QR 코드 한도를 초과했습니다. JSON 파일 내보내기를 이용하세요.`
      );
      return;
    }
    setQrError(null);
    QRCode.toDataURL(url, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: theme === 'red' ? '#DC2626' : '#0F172A',
        light: theme === 'red' ? '#140202' : '#FFFFFF',
      },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrError('QR 코드 생성에 실패했습니다. URL 복사 또는 JSON 내보내기를 이용하세요.'));
  }, [shareOpen, store.layers, store.objects, view.ra, view.dec, view.fsz, theme]);

  const rightEdgeOffsetPx = rightDrawerOpen ? 282 : 12;
  const popoverRightPx = rightEdgeOffsetPx + 48;

  const activeColor = selectedObj ? selectedObj.color : store.settings.defaultColor;
  const activeStyle = selectedObj ? selectedObj.lineStyle : store.settings.defaultLineStyle;
  const activeSmooth = selectedObj ? Boolean(selectedObj.smooth) : store.settings.defaultSmooth;
  const activeWidth = selectedObj ? selectedObj.lineWidth : store.settings.defaultLineWidth;
  const activeOpacity = selectedObj ? selectedObj.opacity : store.settings.defaultOpacity;
  const activeFillAlpha = selectedObj
    ? selectedObj.fillAlpha ?? 0.08
    : store.settings.defaultFillAlpha;
  const activeExt = selectedObj
    ? selectedObj.extensionFactor ?? 1
    : store.settings.defaultExtensionFactor;
  const activeFovRange = selectedObj
    ? selectedObj.visibleFovRange
    : store.settings.defaultVisibleFovRange;
  const activeAnchor = selectedObj ? selectedObj.labelAnchor : store.settings.defaultLabelAnchor;

  const isCustomColor = !ASTERISM_COLOR_SWATCHES.some(
    (s) => s.hex.toLowerCase() === activeColor.toLowerCase()
  );

  const applyStylePatch = (patch: Partial<AsterismObject>) => {
    if (selectedObj) {
      onUpdateObject(selectedObj.id, patch);
    }
    const settingsPatch: Partial<AsterismStoreState['settings']> = {};
    if (patch.color !== undefined) settingsPatch.defaultColor = patch.color;
    if (patch.lineStyle !== undefined) settingsPatch.defaultLineStyle = patch.lineStyle;
    if (patch.smooth !== undefined) settingsPatch.defaultSmooth = patch.smooth;
    if (patch.lineWidth !== undefined) settingsPatch.defaultLineWidth = patch.lineWidth;
    if (patch.opacity !== undefined) settingsPatch.defaultOpacity = patch.opacity;
    if (patch.fillAlpha !== undefined) settingsPatch.defaultFillAlpha = patch.fillAlpha;
    if (patch.extensionFactor !== undefined) settingsPatch.defaultExtensionFactor = patch.extensionFactor;
    if (patch.visibleFovRange !== undefined) settingsPatch.defaultVisibleFovRange = patch.visibleFovRange;
    if (patch.labelAnchor !== undefined) settingsPatch.defaultLabelAnchor = patch.labelAnchor;
    if (Object.keys(settingsPatch).length > 0) {
      onUpdateSettings(settingsPatch);
    }
  };

  const buildCurrentOpticsTag = (): string => {
    const fl = optics.telescopeFocalLengthMm;
    const ep = optics.eyepieceFocalLengthMm;
    const afov = optics.eyepieceAfovDeg;
    if (fl > 0 && ep > 0) {
      const mag = Math.round(fl / ep);
      return `${ep}mm ${afov}° · ${mag}×`;
    }
    return `화각 ${optics.eyepieceFovDeg.toFixed(2)}°`;
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseAsterismsFromJson(text, store.activeLayerId);
      if (parsed.error) {
        setNotice(parsed.error);
        return;
      }
      const res = onImportBundle(parsed.layers, parsed.objects);
      setNotice(`성군 벡터 ${res.addedCount}개를 가져왔습니다.`);
    } catch {
      setNotice('JSON 파일을 읽지 못했습니다.');
    }
  };

  const handleCopyShareUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard
      ?.writeText(shareUrl)
      .then(() => {
        setCopiedShare(true);
        window.setTimeout(() => setCopiedShare(false), 1800);
      })
      .catch(() => {
        setNotice('클립보드 복사에 실패했습니다.');
      });
  };

  const draftCanFinish =
    draft !== null &&
    ((draft.type === 'polygon' && draft.vertices.length >= 3) ||
      ((draft.type === 'polyline' || draft.type === 'arrow') && draft.vertices.length >= 2));

  const accentRangeCls = theme === 'red' ? 'accent-red-600' : 'accent-cyan-500';

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJsonFile}
      />

      {/* Vertical Top-to-Bottom Floating Toolbox anchored at the right edge of the Star Chart */}
      <div
        className={`no-print absolute z-20 top-[56px] flex flex-col items-center gap-1 p-1 border backdrop-blur-sm transition-[right] duration-200 ease-out shadow-sm ${ui.hudOverlay}`}
        style={{
          borderRadius: '6px',
          right: `${rightEdgeOffsetPx}px`,
          maxHeight: 'calc(100% - 76px)',
          overflowY: 'auto',
        }}
        aria-label="성군 및 스타 체인 작도 도구상자"
      >
        {/* 1. Core Drawing Tools */}
        {TOOL_BUTTONS.map(({ id, label, hint, Icon }) => {
          const active = activeTool === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTool(id)}
              title={`${label} — ${hint}`}
              aria-label={label}
              aria-pressed={active}
              className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
                active ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}

        <div className={`w-6 border-t my-0.5 ${ui.divider}`} />

        {/* 2. Quick Toggles: Spline, Magnetic Snap, Optical Circle */}
        <button
          type="button"
          onClick={() => applyStylePatch({ smooth: !activeSmooth })}
          title={
            activeSmooth
              ? '부드러운 곡선(스플라인) 켜짐 — 클릭하여 직선 폴리라인 전환'
              : '부드러운 곡선(스플라인) 켜기 (스타 체인용)'
          }
          aria-label="곡선 스플라인 토글"
          aria-pressed={activeSmooth}
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            activeSmooth ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Spline className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onUpdateSettings({ snapEnabled: !store.settings.snapEnabled })}
          title={
            store.settings.snapEnabled
              ? `마그네틱 별 스냅 켜짐 (≤${store.settings.snapMaxMag.toFixed(1)}m · ${store.settings.snapRadiusPx}px)`
              : '마그네틱 별 스냅 꺼짐 (자유 좌표 지정)'
          }
          aria-label="마그네틱 스냅 토글"
          aria-pressed={store.settings.snapEnabled}
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            store.settings.snapEnabled ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Magnet className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setPopover((p) => (p === 'optics' ? null : 'optics'))}
          title="아이피스 · 파인더 시야 원 및 광학 반전 연동"
          aria-label="광학 시야 원 연동"
          aria-pressed={popover === 'optics' || optics.showEyepiece || optics.showFinder7x50}
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            popover === 'optics'
              ? ui.buttonActive
              : optics.showEyepiece || optics.showFinder7x50
              ? `${ui.buttonIdle} ${ui.accentText}`
              : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <CircleDot className="w-4 h-4" />
        </button>

        {/* Active Draft Controls (when placing points) */}
        {draft && (
          <>
            <div className={`w-6 border-t my-0.5 ${ui.divider}`} />
            <button
              type="button"
              disabled={!draftCanFinish}
              onClick={onFinishDraft}
              title="현재 작도 완료 (Enter)"
              aria-label="작도 완료"
              className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
                draftCanFinish
                  ? ui.buttonActive
                  : `${ui.buttonIdle} opacity-40 cursor-not-allowed`
              }`}
              style={{ borderRadius: '4px' }}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onUndoDraftPoint}
              title="방금 찍은 꼭짓점 취소 (Backspace)"
              aria-label="마지막 점 취소"
              className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <Delete className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancelDraft}
              title="작도 취소 (Esc)"
              aria-label="작도 취소"
              className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <div className={`w-6 border-t my-0.5 ${ui.divider}`} />

        {/* 3. Undo / Redo */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="실행 취소 (Ctrl+Z)"
          aria-label="실행 취소"
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            canUndo ? ui.buttonIdle : `${ui.buttonIdle} opacity-35 cursor-not-allowed`
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title="다시 실행 (Ctrl+Y)"
          aria-label="다시 실행"
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            canRedo ? ui.buttonIdle : `${ui.buttonIdle} opacity-35 cursor-not-allowed`
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className={`w-6 border-t my-0.5 ${ui.divider}`} />

        {/* 4. Popover Panels: Style/Properties, Layers/Presets, Share/QR */}
        <button
          type="button"
          onClick={() => setPopover((p) => (p === 'style' ? null : 'style'))}
          title="선 스타일 · 스냅 · FOV LOD · 선택 객체 속성"
          aria-label="작도 속성 및 스타일"
          aria-pressed={popover === 'style'}
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            popover === 'style' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setPopover((p) => (p === 'layers' ? null : 'layers'))}
          title={`성군 레이어 관리 (${store.layers.length}) 및 대표 프리셋`}
          aria-label="레이어 관리"
          aria-pressed={popover === 'layers'}
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            popover === 'layers' ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          title="JSON 내보내기/가져오기 · URL 압축 링크 · QR 코드 공유"
          aria-label="성군 공유 및 저장"
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${
            shareOpen ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '4px' }}
        >
          <QrCode className="w-3.5 h-3.5" />
        </button>

        <div className={`w-6 border-t my-0.5 ${ui.divider}`} />

        {/* 5. Exit Drawing Mode */}
        <button
          type="button"
          onClick={onCloseDrawingMode}
          title="성군 작도 모드 종료"
          aria-label="성군 작도 모드 종료"
          className={`w-8 h-8 border flex items-center justify-center transition-colors shrink-0 ${ui.buttonIdle} hover:text-red-400`}
          style={{ borderRadius: '4px' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Contextual Floating Side Popover (immediately to the left of the vertical toolbox) */}
      {popover && (
        <div
          className={`no-print absolute z-20 top-[56px] w-[264px] max-h-[calc(100%-76px)] overflow-y-auto astro-scroll border p-2.5 text-[11px] space-y-2.5 backdrop-blur-sm shadow-lg transition-[right] duration-200 ease-out ${ui.panel}`}
          style={{
            borderRadius: '6px',
            right: `${popoverRightPx}px`,
          }}
        >
          {/* Popover Header */}
          <div className={`flex items-center justify-between gap-1 pb-1.5 border-b ${ui.divider}`}>
            <span className={`font-semibold tracking-[-0.04em] ${ui.textPrimary}`}>
              {popover === 'style'
                ? selectedObj
                  ? '선택된 성군 속성'
                  : '작도 스타일 · 스냅 · LOD'
                : popover === 'layers'
                ? '성군 레이어 & 프리셋'
                : '아이피스 · 파인더 시야 연동'}
            </span>
            <button
              type="button"
              onClick={() => setPopover(null)}
              aria-label="속성 창 닫기"
              className={`p-0.5 border ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {notice && (
            <div
              className={`px-2 py-1 border text-[10px] flex items-start justify-between gap-1 ${ui.border} ${ui.accentText}`}
              style={{ borderRadius: '4px' }}
            >
              <span className="break-keep">{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* POPOVER 1: STYLE, PROPERTIES, SNAP & FOV LOD */}
          {popover === 'style' && (
            <div className="space-y-2.5">
              {/* Selected Object Metadata Editor */}
              {selectedObj && (
                <div className={`space-y-1.5 pb-2 border-b ${ui.divider}`}>
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className={ui.textMuted}>
                      {selectedObj.type === 'polyline'
                        ? '폴리라인'
                        : selectedObj.type === 'polygon'
                        ? '다각형'
                        : selectedObj.type === 'arrow'
                        ? '방향 벡터'
                        : '라벨 태그'}{' '}
                      · 꼭짓점 {selectedObj.vertices.length}개
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteObject(selectedObj.id)}
                      className={`px-1.5 py-0.5 border text-[9.5px] flex items-center gap-0.5 ${ui.buttonIdle} hover:text-red-400`}
                      style={{ borderRadius: '4px' }}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>삭제</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={selectedObj.label}
                    onChange={(e) => onUpdateObject(selectedObj.id, { label: e.target.value })}
                    placeholder="성군 명칭 (예: 약혼반지, M13 호핑)"
                    className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={selectedObj.memo ?? ''}
                    onChange={(e) => onUpdateObject(selectedObj.id, { memo: e.target.value })}
                    placeholder="관측 메모 (특징, 호핑 설명...)"
                    className={`w-full px-2 py-1 border text-[10px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={selectedObj.eyepieceTag ?? ''}
                      onChange={(e) =>
                        onUpdateObject(selectedObj.id, { eyepieceTag: e.target.value })
                      }
                      placeholder="권장 배율/아이피스 (예: 30mm 82°)"
                      className={`flex-1 min-w-0 px-2 py-1 border text-[10px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateObject(selectedObj.id, {
                          eyepieceTag: buildCurrentOpticsTag(),
                        })
                      }
                      title="현재 광학계 아이피스·배율 자동 입력"
                      className={`px-1.5 py-1 border text-[9.5px] whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      현재장비
                    </button>
                  </div>

                  {/* Layer Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] shrink-0 ${ui.textMuted}`}>레이어</span>
                    <select
                      value={selectedObj.layerId}
                      onChange={(e) => onUpdateObject(selectedObj.id, { layerId: e.target.value })}
                      className={`flex-1 min-w-0 px-1.5 py-0.5 border text-[10px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    >
                      {store.layers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Label Anchor */}
              <div className="space-y-1">
                <div className={`text-[10px] font-medium ${ui.textSecondary}`}>라벨 앵커 위치</div>
                <div className="grid grid-cols-4 gap-1">
                  {ANCHOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => applyStylePatch({ labelAnchor: opt.id })}
                      className={`py-1 border text-[10px] font-medium ${
                        activeAnchor === opt.id ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Style + Color */}
              {(!selectedObj || selectedObj.type !== 'label') && (
                <>
                  <div className="space-y-1">
                    <div className={`text-[10px] font-medium ${ui.textSecondary}`}>선 스타일</div>
                    <div className="grid grid-cols-3 gap-1">
                      {LINE_STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => applyStylePatch({ lineStyle: opt.id })}
                          className={`py-1 border text-[10px] font-medium ${
                            activeStyle === opt.id ? ui.buttonActive : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Line Width & Opacity */}
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className={ui.textMuted}>선 두께</span>
                        <span className="font-mono tabular-nums">{activeWidth.toFixed(1)}px</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={4.0}
                        step={0.1}
                        value={activeWidth}
                        onChange={(e) => applyStylePatch({ lineWidth: Number(e.target.value) })}
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className={ui.textMuted}>투명도</span>
                        <span className="font-mono tabular-nums">
                          {Math.round(activeOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        value={activeOpacity}
                        onChange={(e) => applyStylePatch({ opacity: Number(e.target.value) })}
                        className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                      />
                    </div>

                    {/* Polygon Fill Alpha */}
                    {(!selectedObj || selectedObj.type === 'polygon') && (
                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span className={ui.textMuted}>다각형 채움 투명도</span>
                          <span className="font-mono tabular-nums">
                            {Math.round(activeFillAlpha * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.4}
                          step={0.02}
                          value={activeFillAlpha}
                          onChange={(e) =>
                            applyStylePatch({ fillAlpha: Number(e.target.value) })
                          }
                          className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                        />
                      </div>
                    )}

                    {/* Arrow Extension Factor */}
                    {((!selectedObj && activeTool === 'arrow') ||
                      selectedObj?.type === 'arrow') && (
                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span className={ui.textMuted}>화살표 연장 배수</span>
                          <span className="font-mono tabular-nums">
                            {activeExt <= 1.05 ? '1.0× (기본)' : `${activeExt.toFixed(1)}× 연장`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1.0}
                          max={5.0}
                          step={0.5}
                          value={activeExt}
                          onChange={(e) =>
                            applyStylePatch({ extensionFactor: Number(e.target.value) })
                          }
                          className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Color Swatches + 7th Custom Picker */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`font-medium ${ui.textSecondary}`}>색상</span>
                  {theme === 'red' && (
                    <span className="text-[9px] text-red-400">야간 적색 모드 자동 대응</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {ASTERISM_COLOR_SWATCHES.map((sw) => {
                    const selectedSw = activeColor.toLowerCase() === sw.hex.toLowerCase();
                    return (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() => applyStylePatch({ color: sw.hex })}
                        title={sw.label}
                        className={`w-5 h-5 border transition-transform ${
                          selectedSw ? 'scale-110 ring-1 ring-white border-white' : ui.border
                        }`}
                        style={{ backgroundColor: sw.hex, borderRadius: '4px' }}
                      />
                    );
                  })}
                  <label
                    title="커스텀 색상 선택"
                    className={`relative w-5 h-5 border flex items-center justify-center cursor-pointer overflow-hidden ${
                      isCustomColor ? 'scale-110 ring-1 ring-white border-white' : ui.border
                    }`}
                    style={{
                      borderRadius: '4px',
                      background: isCustomColor
                        ? activeColor
                        : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)',
                    }}
                  >
                    <input
                      type="color"
                      value={activeColor}
                      onChange={(e) => applyStylePatch({ color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      aria-label="성군 커스텀 색상 선택"
                    />
                  </label>
                </div>
              </div>

              {/* FOV-based LOD Visibility Range */}
              <div className={`pt-2 border-t space-y-1.5 ${ui.divider}`}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`font-medium ${ui.textSecondary}`}>노출 화시야 (LOD FOV)</span>
                  <span className="font-mono tabular-nums">
                    {activeFovRange[0]}° ~ {activeFovRange[1]}°
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="space-y-0.5">
                    <span className={`text-[9.5px] ${ui.textMuted}`}>최소 FOV (°)</span>
                    <input
                      type="number"
                      min={0.02}
                      max={180}
                      step={0.05}
                      value={activeFovRange[0]}
                      onChange={(e) => {
                        const v = Math.max(0.02, Math.min(180, Number(e.target.value) || 0.05));
                        applyStylePatch({
                          visibleFovRange: [v, Math.max(v, activeFovRange[1])],
                        });
                      }}
                      className={`w-full px-1.5 py-0.5 border font-mono text-[10px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className={`text-[9.5px] ${ui.textMuted}`}>최대 FOV (°)</span>
                    <input
                      type="number"
                      min={0.1}
                      max={180}
                      step={0.5}
                      value={activeFovRange[1]}
                      onChange={(e) => {
                        const v = Math.max(activeFovRange[0], Math.min(180, Number(e.target.value) || 15));
                        applyStylePatch({ visibleFovRange: [activeFovRange[0], v] });
                      }}
                      className={`w-full px-1.5 py-0.5 border font-mono text-[10px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: '전천 180°', range: [0.05, 180] as [number, number] },
                    { label: '파인더 ≤15°', range: [0.1, 15] as [number, number] },
                    { label: '성단 ≤2.5°', range: [0.05, 2.5] as [number, number] },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyStylePatch({ visibleFovRange: p.range })}
                      className={`py-0.5 border text-[9.5px] whitespace-nowrap ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Magnetic Snapping Controls */}
              <div className={`pt-2 border-t space-y-1.5 ${ui.divider}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-medium ${ui.textSecondary}`}>
                    마그네틱 별 스냅핑
                  </span>
                  <input
                    type="checkbox"
                    checked={store.settings.snapEnabled}
                    onChange={(e) => onUpdateSettings({ snapEnabled: e.target.checked })}
                    className={`w-3.5 h-3.5 ${accentRangeCls}`}
                  />
                </div>
                <div className={store.settings.snapEnabled ? 'space-y-1.5' : 'space-y-1.5 opacity-45'}>
                  <div>
                    <div className="flex justify-between text-[10px]">
                      <span className={ui.textMuted}>스냅 한계등급 (이하 별만)</span>
                      <span className="font-mono tabular-nums">
                        ≤ {store.settings.snapMaxMag.toFixed(1)}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={14}
                      step={0.5}
                      disabled={!store.settings.snapEnabled}
                      value={store.settings.snapMaxMag}
                      onChange={(e) =>
                        onUpdateSettings({ snapMaxMag: Number(e.target.value) })
                      }
                      className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px]">
                      <span className={ui.textMuted}>스냅 포착 반경</span>
                      <span className="font-mono tabular-nums">{store.settings.snapRadiusPx}px</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={36}
                      step={2}
                      disabled={!store.settings.snapEnabled}
                      value={store.settings.snapRadiusPx}
                      onChange={(e) =>
                        onUpdateSettings({ snapRadiusPx: Number(e.target.value) })
                      }
                      className={`w-full h-1.5 cursor-pointer ${accentRangeCls}`}
                    />
                  </div>
                </div>
                <label className="flex items-center justify-between text-[10px] cursor-pointer">
                  <span className={ui.textMuted}>빈 하늘 자유 좌표 찍기 허용</span>
                  <input
                    type="checkbox"
                    checked={store.settings.allowFreeSpace}
                    onChange={(e) => onUpdateSettings({ allowFreeSpace: e.target.checked })}
                    className={`w-3.5 h-3.5 ${accentRangeCls}`}
                  />
                </label>
              </div>
            </div>
          )}

          {/* POPOVER 2: LAYER GROUPS & BUILT-IN PRESETS */}
          {popover === 'layers' && (
            <div className="space-y-2.5">
              {/* Add New Layer */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newLayerName}
                  onChange={(e) => setNewLayerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLayerName.trim()) {
                      onCreateLayer(newLayerName.trim());
                      setNewLayerName('');
                    }
                  }}
                  placeholder="새 레이어 이름..."
                  className={`flex-1 min-w-0 px-2 py-1 border text-[10px] ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newLayerName.trim() || `성군 레이어 ${store.layers.length + 1}`;
                    onCreateLayer(name);
                    setNewLayerName('');
                  }}
                  className={`px-2 py-1 border text-[10px] flex items-center gap-1 whitespace-nowrap shrink-0 ${ui.buttonActive}`}
                  style={{ borderRadius: '4px' }}
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>추가</span>
                </button>
              </div>

              {/* Built-in Presets Button */}
              <button
                type="button"
                onClick={() => {
                  const added = onLoadPresets();
                  setNotice(
                    added > 0
                      ? `대표 성군 프리셋 ${added}개를 불러왔습니다 (약혼반지·M45 물줄기·이중성단 체인).`
                      : '대표 성군 프리셋이 이미 모두 등록되어 있습니다.'
                  );
                }}
                className={`w-full py-1.5 px-2 border text-[10px] font-medium flex items-center justify-center gap-1.5 ${ui.buttonIdle}`}
                style={{ borderRadius: '4px' }}
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>대표 성군 샘플 불러오기 (약혼반지·M45 등)</span>
              </button>

              {/* Layer List */}
              <div className="space-y-1.5">
                {store.layers.map((layer) => {
                  const layerObjs = store.objects.filter((o) => o.layerId === layer.id);
                  const isActive = layer.id === store.activeLayerId;
                  const isRenaming = renamingLayerId === layer.id;

                  return (
                    <div
                      key={layer.id}
                      className={`border ${isActive ? ui.accentText : ui.border}`}
                      style={{ borderRadius: '5px' }}
                    >
                      <div className="px-2 py-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleLayerVisible(layer.id)}
                          title={layer.visible ? '레이어 숨기기' : '레이어 표시'}
                          className={`p-0.5 shrink-0 ${
                            layer.visible ? ui.accentText : ui.textMuted
                          }`}
                        >
                          {layer.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 opacity-50" />
                          )}
                        </button>

                        {isRenaming ? (
                          <div className="flex-1 flex items-center gap-1 min-w-0">
                            <input
                              type="text"
                              value={renameDraft}
                              autoFocus
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && renameDraft.trim()) {
                                  onRenameLayer(layer.id, renameDraft.trim());
                                  setRenamingLayerId(null);
                                } else if (e.key === 'Escape') {
                                  setRenamingLayerId(null);
                                }
                              }}
                              className={`flex-1 min-w-0 px-1 py-0.5 border text-[10px] ${ui.input}`}
                              style={{ borderRadius: '3px' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (renameDraft.trim()) onRenameLayer(layer.id, renameDraft.trim());
                                setRenamingLayerId(null);
                              }}
                              className={`p-0.5 border ${ui.buttonActive}`}
                              style={{ borderRadius: '3px' }}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSetActiveLayer(layer.id)}
                            className="flex-1 text-left min-w-0"
                            title="클릭하여 새 작도 대상 레이어로 선택"
                          >
                            <div
                              className={`text-[10.5px] font-medium truncate ${
                                isActive ? ui.accentText : ui.textPrimary
                              }`}
                            >
                              {isActive ? '● ' : ''}
                              {layer.name}
                            </div>
                          </button>
                        )}

                        <span className={`font-mono text-[9.5px] tabular-nums shrink-0 ${ui.textMuted}`}>
                          {layerObjs.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingLayerId(layer.id);
                            setRenameDraft(layer.name);
                          }}
                          title="레이어 이름 수정"
                          className={`p-0.5 ${ui.textMuted} hover:opacity-100 shrink-0`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {store.layers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteLayer(layer.id)}
                            title="레이어 삭제"
                            className={`p-0.5 ${ui.textMuted} hover:text-red-400 shrink-0`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {layerObjs.length > 0 && (
                        <div className={`border-t divide-y ${ui.divider}`}>
                          {layerObjs.map((obj) => (
                            <div
                              key={obj.id}
                              className={`px-2 py-1 flex items-center gap-1.5 text-[10px] ${
                                obj.id === selectedObjectId
                                  ? theme === 'white'
                                    ? 'bg-blue-50/70'
                                    : theme === 'red'
                                    ? 'bg-red-950/40'
                                    : 'bg-cyan-950/35'
                                  : ''
                              }`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: theme === 'red' ? '#EF4444' : obj.color,
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectObject(obj.id);
                                  onFocusObject(obj);
                                }}
                                className={`flex-1 text-left truncate ${ui.textPrimary}`}
                                title="클릭하여 해당 성군 위치로 이동 및 선택"
                              >
                                {obj.label || '(이름 없는 성군)'}
                              </button>
                              <span className={`font-mono text-[9px] tabular-nums shrink-0 ${ui.textMuted}`}>
                                ≤{obj.visibleFovRange[1]}°
                              </span>
                              <button
                                type="button"
                                onClick={() => onFocusObject(obj)}
                                title="성군 위치로 이동"
                                className={`p-0.5 ${ui.textMuted} hover:opacity-100 shrink-0`}
                              >
                                <Navigation className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteObject(obj.id)}
                                title="삭제"
                                className={`p-0.5 ${ui.textMuted} hover:text-red-400 shrink-0`}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* POPOVER 3: OPTICAL EYEPIECE / FINDER CIRCLE INTEGRATION */}
          {popover === 'optics' && (
            <div className="space-y-2">
              <p className={`text-[10px] leading-snug break-keep ${ui.textMuted}`}>
                아이피스·파인더 시야 원을 띄운 상태에서 한 시야 안에 들어오는 별 패턴 단위로 호핑 경로를 설계하세요.
              </p>

              <div className="space-y-1">
                <label className="flex items-center justify-between py-0.5 cursor-pointer">
                  <span className={ui.textSecondary}>망원경 아이피스 원 ({optics.eyepieceFovDeg.toFixed(2)}°)</span>
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
                  <span className={ui.textSecondary}>7×50 파인더 원 (7.0°)</span>
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
                  빠른 접안렌즈 실화시야 프리셋
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { label: '30mm 82° (약 1.55° · 광시야)', fov: 1.55, ep: 30, afov: 82 },
                    { label: '18mm 82° (약 0.93° · 중배율)', fov: 0.93, ep: 18, afov: 82 },
                    { label: '11mm 82° (약 0.57° · 고배율)', fov: 0.57, ep: 11, afov: 82 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        onChangeOptics((p) => ({
                          ...p,
                          showEyepiece: true,
                          eyepieceFovDeg: preset.fov,
                          eyepieceFocalLengthMm: preset.ep,
                          eyepieceAfovDeg: preset.afov,
                          eyepieceLabel: `${preset.ep}mm ${preset.afov}°`,
                        }))
                      }
                      className={`py-1 px-2 border text-left text-[10px] font-mono tabular-nums ${
                        optics.showEyepiece && Math.abs(optics.eyepieceFovDeg - preset.fov) < 0.03
                          ? ui.buttonActive
                          : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`pt-2 border-t space-y-1 ${ui.divider}`}>
                <div className={`text-[10px] font-medium ${ui.textSecondary}`}>
                  광학계 반전 동기화 (라벨 정방향 유지)
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeView((p) => ({ ...p, flipH: !p.flipH }))
                    }
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

      {/* Share & Export/Import Modal (JSON + Compressed URL + QR Code) */}
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
                  성군 · 스타 체인 공유 및 데이터 관리
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

            {/* JSON Export / Import */}
            <div className="space-y-1.5">
              <div className={`text-[11px] font-semibold ${ui.textSecondary}`}>
                표준 JSON 벡터 파일 ({store.objects.length}개 성군 · {store.layers.length}개 레이어)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={store.objects.length === 0}
                  onClick={() => downloadAsterismsJson(store)}
                  className={`py-1.5 px-2.5 border font-medium flex items-center justify-center gap-1.5 ${
                    store.objects.length === 0
                      ? `${ui.buttonIdle} opacity-45 cursor-not-allowed`
                      : ui.buttonIdle
                  }`}
                  style={{ borderRadius: '5px' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON 내보내기</span>
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className={`py-1.5 px-2.5 border font-medium flex items-center justify-center gap-1.5 ${ui.buttonIdle}`}
                  style={{ borderRadius: '5px' }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>JSON 불러오기</span>
                </button>
              </div>
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
                    {copiedShare ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
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
                    스마트폰·태블릿으로 스캔하면 현재 시야와 성군 벡터가 즉시 불러와집니다.
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
