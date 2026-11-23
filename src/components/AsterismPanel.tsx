import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  Layers,
  MapPin,
  Navigation,
  Pencil,
  PenTool,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AsterismGroup,
  AsterismLayer,
  AsterismObject,
  AsterismStoreState,
  ThemeMode,
} from '../types/astronomy';
import {
  downloadAsterismsJson,
  downloadSingleAsterismJson,
  parseAsterismsFromJson,
} from '../utils/asterismStorage';
import { formatAngularSeparation, getCircleRadiusDeg } from '../utils/asterismRenderer';
import { getUiTheme } from '../utils/themeClasses';

interface AsterismPanelProps {
  theme: ThemeMode;
  store: AsterismStoreState;
  asterismMode: boolean;
  selectedObjectId: string | null;
  onToggleAsterismMode: () => void;
  onSelectObject: (id: string | null) => void;
  onDeleteObject: (id: string) => void;
  onSetActiveLayer: (layerId: string) => void;
  onToggleLayerVisible: (layerId: string) => void;
  onSetAllLayersVisible: (visible: boolean) => void;
  onCreateLayer: (name: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onSetActiveAsterism: (asterismId: string | null) => void;
  onOpenAsterismLayers: (asterismId: string) => void;
  onOpenShapeProperties: (asterismId: string, objectId: string) => void;
  onCreateAsterismGroup: (name?: string, layerId?: string) => string;
  onUpdateAsterismGroup: (asterismId: string, patch: Partial<AsterismGroup>) => void;
  onDeleteAsterismGroup: (asterismId: string) => void;
  onToggleAsterismGroupVisible: (asterismId: string) => void;
  onFocusAsterismGroup: (grp: AsterismGroup) => void;
  onImportBundle: (
    layers: AsterismLayer[],
    asterisms: AsterismGroup[],
    objects: AsterismObject[]
  ) => { addedCount: number };
}

function getShapeTypeLabel(obj: AsterismObject): string {
  if (obj.type === 'polyline') return obj.smooth ? '원호' : '선';
  if (obj.type === 'polygon') return '다각형';
  if (obj.type === 'circle') return '원';
  if (obj.type === 'arrow') return '방향선';
  return '텍스트';
}

export function AsterismPanel({
  theme,
  store,
  asterismMode,
  selectedObjectId,
  onToggleAsterismMode,
  onSelectObject,
  onDeleteObject,
  onSetActiveLayer,
  onToggleLayerVisible,
  onSetAllLayersVisible,
  onCreateLayer,
  onRenameLayer,
  onDeleteLayer,
  onSetActiveAsterism,
  onOpenAsterismLayers,
  onOpenShapeProperties,
  onCreateAsterismGroup,
  onUpdateAsterismGroup,
  onDeleteAsterismGroup,
  onToggleAsterismGroupVisible,
  onFocusAsterismGroup,
  onImportBundle,
}: AsterismPanelProps) {
  const ui = getUiTheme(theme);
  const [newLayerName, setNewLayerName] = useState('');
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameLayerDraft, setRenameLayerDraft] = useState('');
  const [renamingAsterismId, setRenamingAsterismId] = useState<string | null>(null);
  const [renameAsterismDraft, setRenameAsterismDraft] = useState('');
  const [openLayers, setOpenLayers] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('noxchart_asterism_collapse_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { openLayers?: Record<string, boolean> };
        if (parsed.openLayers && typeof parsed.openLayers === 'object') {
          return parsed.openLayers;
        }
      }
    } catch {
      // Ignore storage parse failure
    }
    return {};
  });
  const [openAsterisms, setOpenAsterisms] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('noxchart_asterism_collapse_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { openAsterisms?: Record<string, boolean> };
        if (parsed.openAsterisms && typeof parsed.openAsterisms === 'object') {
          return parsed.openAsterisms;
        }
      }
    } catch {
      // Ignore storage parse failure
    }
    return {};
  });
  const [expandedShapeIds, setExpandedShapeIds] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('noxchart_asterism_collapse_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { expandedShapeIds?: Record<string, boolean> };
        if (parsed.expandedShapeIds && typeof parsed.expandedShapeIds === 'object') {
          return parsed.expandedShapeIds;
        }
      }
    } catch {
      // Ignore storage parse failure
    }
    return {};
  });
  const [notice, setNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        'noxchart_asterism_collapse_v1',
        JSON.stringify({ openLayers, openAsterisms, expandedShapeIds })
      );
    } catch {
      // Ignore storage write failure
    }
  }, [openLayers, openAsterisms, expandedShapeIds]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(t);
  }, [notice]);

  const allLayersVisible =
    store.layers.length > 0 &&
    store.layers.every((l) => l.visible) &&
    store.asterisms.every((g) => g.visible);
  const anyLayerVisible =
    store.layers.some((l) => l.visible) || store.asterisms.some((g) => g.visible);

  const handleCreateLayerSubmit = () => {
    const trimmed = newLayerName.trim();
    if (!trimmed) return;
    onCreateLayer(trimmed);
    setNewLayerName('');
    setShowAddLayer(false);
    setNotice(`‘${trimmed}’ 그룹을 추가했습니다.`);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseAsterismsFromJson(text, store.activeLayerId);
      if (parsed.error) {
        setNotice(parsed.error);
      } else {
        const { addedCount } = onImportBundle(parsed.layers, parsed.asterisms, parsed.objects);
        setNotice(
          addedCount > 0
            ? `성군·도형 ${addedCount}개 항목을 불러왔습니다.`
            : '이미 동일한 성군 데이터가 모두 등록되어 있습니다.'
        );
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Distinct visual styling tokens for Group vs Asterism vs Shape!
  const asterismRowTone = (isActive: boolean) => {
    if (theme === 'white') {
      return isActive
        ? 'bg-amber-100/90 border-amber-400/80'
        : 'bg-amber-50/75 border-amber-300/60 hover:bg-amber-100/60';
    }
    if (theme === 'red') {
      return isActive
        ? 'bg-[#360C06] border-red-600/80'
        : 'bg-[#220704] border-red-900/70 hover:bg-[#2C0905]';
    }
    return isActive
      ? 'bg-amber-500/20 border-amber-400/60'
      : 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15';
  };

  const asterismBadgeTone =
    theme === 'white'
      ? 'bg-amber-200/80 text-amber-900 border-amber-400/60'
      : theme === 'red'
      ? 'bg-red-950 text-red-300 border-red-700/70'
      : 'bg-amber-400/20 text-amber-200 border-amber-400/40';

  const shapeRowTone = (isSelected: boolean) => {
    if (theme === 'white') {
      return isSelected
        ? 'bg-sky-100/95 border-sky-400/80'
        : 'bg-sky-50/60 border-sky-200/80 hover:bg-sky-100/60';
    }
    if (theme === 'red') {
      return isSelected
        ? 'bg-[#28040A] border-rose-500/70'
        : 'bg-[#130204] border-red-950/80 hover:bg-[#1B0306]';
    }
    return isSelected
      ? 'bg-cyan-500/22 border-cyan-400/60'
      : 'bg-sky-950/35 border-sky-800/40 hover:bg-sky-900/35';
  };

  const shapeBadgeTone =
    theme === 'white'
      ? 'bg-sky-200/75 text-sky-900 border-sky-300'
      : theme === 'red'
      ? 'bg-[#2B060B] text-rose-300 border-rose-800/60'
      : 'bg-cyan-500/15 text-cyan-200 border-cyan-500/35';

  return (
    <div className="space-y-3 text-xs">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportJson}
      />

      {/* Top Header & Quick Drawing Mode Toggle */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className={`w-3.5 h-3.5 shrink-0 ${ui.accentText}`} />
          <span className={`font-semibold tracking-[-0.04em] truncate ${ui.textPrimary}`}>
            성군 작도 관리
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              onCreateAsterismGroup();
              if (!asterismMode) onToggleAsterismMode();
              setNotice('새 성군을 만들고 작도 모드를 켰습니다.');
            }}
            className={`px-1.5 py-1 border text-[10px] font-medium flex items-center gap-0.5 ${ui.buttonIdle}`}
            style={{ borderRadius: '5px' }}
            title="새 성군 생성 후 작도 시작"
          >
            <Plus className="w-3 h-3" />
            <span>새 성군</span>
          </button>
          <button
            type="button"
            onClick={onToggleAsterismMode}
            className={`px-2 py-1 border text-[10px] font-semibold flex items-center gap-1 transition-colors ${
              asterismMode ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '5px' }}
            title="성도 우측 플로팅 성군 작도 도구 열기/닫기"
          >
            <PenTool className="w-3 h-3" />
            <span>{asterismMode ? '작도 중' : '작도 시작'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`px-2 py-1.5 border text-[10px] leading-snug ${ui.panelMuted} ${ui.border} ${ui.accentText}`}
          style={{ borderRadius: '5px' }}
        >
          {notice}
        </div>
      )}

      {/* Hierarchy Section: 그룹 > 성군 > 도형 요소들 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[10.5px] font-semibold whitespace-nowrap ${ui.textSecondary}`}>
            성군({store.asterisms.length})
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onSetAllLayersVisible(true)}
              disabled={allLayersVisible}
              title="모든 그룹 표시"
              className={`px-1.5 py-0.5 border text-[9.5px] whitespace-nowrap shrink-0 ${
                allLayersVisible ? `${ui.buttonIdle} opacity-40 cursor-not-allowed` : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              모두 표시
            </button>
            <button
              type="button"
              onClick={() => onSetAllLayersVisible(false)}
              disabled={!anyLayerVisible}
              title="모든 그룹 숨기기"
              className={`px-1.5 py-0.5 border text-[9.5px] whitespace-nowrap shrink-0 ${
                !anyLayerVisible ? `${ui.buttonIdle} opacity-40 cursor-not-allowed` : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              모두 숨김
            </button>
            <button
              type="button"
              onClick={() => setShowAddLayer((v) => !v)}
              title="새 그룹 추가"
              className={`p-1 border shrink-0 ${showAddLayer ? ui.buttonActive : ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <FolderPlus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Add New Group Form */}
        {showAddLayer && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateLayerSubmit();
              }}
              placeholder="새 그룹 이름 (예: 겨울 성군)"
              className={`flex-1 min-w-0 px-2 py-1 border text-[10.5px] ${ui.input}`}
              style={{ borderRadius: '4px' }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleCreateLayerSubmit}
              className={`px-2 py-1 border text-[10px] font-medium shrink-0 ${ui.buttonActive}`}
              style={{ borderRadius: '4px' }}
            >
              추가
            </button>
          </div>
        )}

        {/* Group > Asterism > Shapes Tree */}
        <div className="space-y-1.5">
          {store.layers.map((layer) => {
            const layerAsterisms = store.asterisms.filter((g) => g.layerId === layer.id);
            const isActiveLayer = store.activeLayerId === layer.id;
            const isRenamingLayer = renamingLayerId === layer.id;
            const isLayerCollapsed = !openLayers[layer.id];
            const visibleAsterismCount = layerAsterisms.filter((g) => g.visible).length;
            const groupVisState: 'all' | 'partial' | 'none' =
              layerAsterisms.length === 0
                ? layer.visible
                  ? 'all'
                  : 'none'
                : !layer.visible || visibleAsterismCount === 0
                ? 'none'
                : visibleAsterismCount === layerAsterisms.length
                ? 'all'
                : 'partial';
            const groupEyeColorCls =
              groupVisState === 'all'
                ? theme === 'white'
                  ? 'text-sky-600'
                  : theme === 'red'
                  ? 'text-[#FF4D4D]'
                  : 'text-cyan-400'
                : groupVisState === 'partial'
                ? theme === 'white'
                  ? 'text-sky-300'
                  : theme === 'red'
                  ? 'text-[#FCA5A5]/45'
                  : 'text-cyan-400/40'
                : ui.textMuted;

            return (
              <div
                key={layer.id}
                className={`border transition-colors ${
                  isActiveLayer ? ui.border : `${ui.border} opacity-95`
                } ${ui.panelMuted}`}
                style={{ borderRadius: '6px' }}
              >
                {/* Level 1: Group (Layer) Row */}
                <div className="px-2 py-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenLayers((prev) => ({ ...prev, [layer.id]: !prev[layer.id] }))
                    }
                    className={`p-0.5 shrink-0 ${ui.textMuted}`}
                    aria-label="그룹 펼치기/접기"
                  >
                    {isLayerCollapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleLayerVisible(layer.id)}
                    title={
                      groupVisState === 'all'
                        ? '그룹 전체 숨기기'
                        : groupVisState === 'partial'
                        ? '일부 성군 표시 중 · 클릭하여 그룹 전체 표시'
                        : '그룹 전체 표시'
                    }
                    className={`p-0.5 shrink-0 transition-colors ${groupEyeColorCls}`}
                  >
                    {groupVisState === 'none' ? (
                      <EyeOff className="w-3.5 h-3.5 opacity-50" />
                    ) : (
                      <Eye
                        className="w-3.5 h-3.5"
                        strokeWidth={groupVisState === 'all' ? 2.4 : 1.8}
                      />
                    )}
                  </button>

                  {isRenamingLayer ? (
                    <div className="flex-1 flex items-center gap-1 min-w-0">
                      <input
                        type="text"
                        value={renameLayerDraft}
                        autoFocus
                        onChange={(e) => setRenameLayerDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && renameLayerDraft.trim()) {
                            onRenameLayer(layer.id, renameLayerDraft.trim());
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
                          if (renameLayerDraft.trim()) {
                            onRenameLayer(layer.id, renameLayerDraft.trim());
                          }
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
                      title="클릭하여 기본 작업 그룹으로 지정"
                    >
                      <div
                        className={`text-[10.5px] font-semibold truncate ${
                          isActiveLayer ? ui.accentText : ui.textPrimary
                        }`}
                      >
                        {isActiveLayer ? '● ' : ''}
                        {layer.name}
                      </div>
                    </button>
                  )}

                  <span className={`font-mono text-[9px] tabular-nums shrink-0 ${ui.textMuted}`}>
                    {layerAsterisms.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      onCreateAsterismGroup(undefined, layer.id);
                      setOpenLayers((prev) => ({ ...prev, [layer.id]: true }));
                    }}
                    title="이 그룹에 새 성군 추가"
                    className={`p-0.5 ${ui.textMuted} hover:opacity-100 shrink-0`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRenamingLayerId(layer.id);
                      setRenameLayerDraft(layer.name);
                    }}
                    title="그룹 이름 수정"
                    className={`p-0.5 ${ui.textMuted} hover:opacity-100 shrink-0`}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>

                  {store.layers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteLayer(layer.id)}
                      title="그룹 삭제"
                      className={`p-0.5 ${ui.textMuted} hover:text-red-400 shrink-0`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Level 2: Asterisms inside this Group */}
                {!isLayerCollapsed && layerAsterisms.length > 0 && (
                  <div className={`border-t p-1.5 space-y-1.5 ${ui.divider}`}>
                    {layerAsterisms.map((grp) => {
                      const shapes = store.objects.filter((o) => o.asterismId === grp.id);
                      const isActiveGrp = store.activeAsterismId === grp.id;
                      const isGrpCollapsed = !openAsterisms[grp.id];
                      const isRenamingGrp = renamingAsterismId === grp.id;

                      return (
                        <div
                          key={grp.id}
                          className={`border transition-colors overflow-hidden ${asterismRowTone(
                            isActiveGrp
                          )}`}
                          style={{ borderRadius: '5px' }}
                        >
                          {/* Asterism Header Row (Warm Amber Color) — HAS Quick-Jump Navigation Icon! */}
                          <div className="px-1.5 py-1.5 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenAsterisms((prev) => ({
                                  ...prev,
                                  [grp.id]: !prev[grp.id],
                                }))
                              }
                              className={`p-0.5 shrink-0 ${ui.textMuted}`}
                              aria-label="성군 도형 펼치기/접기"
                            >
                              {isGrpCollapsed ? (
                                <ChevronRight className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onToggleAsterismGroupVisible(grp.id)}
                              title={grp.visible ? '성군 숨기기' : '성군 표시'}
                              className={`p-0.5 shrink-0 ${
                                grp.visible ? ui.accentText : ui.textMuted
                              }`}
                            >
                              {grp.visible ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <EyeOff className="w-3 h-3 opacity-50" />
                              )}
                            </button>

                            <span
                              className={`px-1 py-[0.5px] border text-[8.5px] font-semibold shrink-0 ${asterismBadgeTone}`}
                              style={{ borderRadius: '3px' }}
                            >
                              성군
                            </span>

                            {isRenamingGrp ? (
                              <div className="flex-1 flex items-center gap-1 min-w-0">
                                <input
                                  type="text"
                                  value={renameAsterismDraft}
                                  autoFocus
                                  onChange={(e) => setRenameAsterismDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && renameAsterismDraft.trim()) {
                                      onUpdateAsterismGroup(grp.id, {
                                        name: renameAsterismDraft.trim(),
                                      });
                                      setRenamingAsterismId(null);
                                    } else if (e.key === 'Escape') {
                                      setRenamingAsterismId(null);
                                    }
                                  }}
                                  className={`flex-1 min-w-0 px-1 py-0.5 border text-[10px] ${ui.input}`}
                                  style={{ borderRadius: '3px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (renameAsterismDraft.trim()) {
                                      onUpdateAsterismGroup(grp.id, {
                                        name: renameAsterismDraft.trim(),
                                      });
                                    }
                                    setRenamingAsterismId(null);
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
                                onClick={() => onOpenAsterismLayers(grp.id)}
                                className="flex-1 text-left min-w-0"
                                title="클릭하여 성군 선택 및 성도 작도 레이어 펼치기"
                              >
                                <div className={`text-[10.5px] font-semibold truncate ${ui.textPrimary}`}>
                                  {grp.name}
                                </div>
                                <div
                                  className={`text-[8.5px] font-mono tabular-nums truncate flex items-center gap-1 ${ui.textMuted}`}
                                >
                                  <span>도형 {shapes.length}</span>
                                  <span>·</span>
                                  <span>
                                    표시 {grp.visibleFovRange[0]}°~{grp.visibleFovRange[1]}°
                                  </span>
                                  {grp.savedView && (
                                    <span className="inline-flex items-center gap-0.5 text-amber-400">
                                      <MapPin className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </div>
                              </button>
                            )}

                            {/* Quick-Jump Icon — ONLY ON ASTERISM! */}
                            <button
                              type="button"
                              onClick={() => onFocusAsterismGroup(grp)}
                              title={
                                grp.savedView
                                  ? '저장된 위치·시야로 바로가기'
                                  : '성군 위치로 바로가기'
                              }
                              className={`p-1 border shrink-0 ${ui.buttonIdle}`}
                              style={{ borderRadius: '4px' }}
                            >
                              <Navigation className="w-2.5 h-2.5" />
                            </button>

                            {/* Individual Asterism Backup Button */}
                            <button
                              type="button"
                              onClick={() => {
                                downloadSingleAsterismJson(store, grp.id);
                                setNotice(`‘${grp.name}’ 개별 백업 파일을 저장했습니다.`);
                              }}
                              title="이 성군 개별 백업 (JSON)"
                              className={`p-0.5 ${ui.textMuted} hover:opacity-100 shrink-0`}
                            >
                              <Download className="w-2.5 h-2.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRenamingAsterismId(grp.id);
                                setRenameAsterismDraft(grp.name);
                              }}
                              title="성군 이름 수정"
                              className={`p-0.5 ${ui.textMuted} hover:opacity-100 shrink-0`}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteAsterismGroup(grp.id)}
                              title="성군 및 하위 도형 모두 삭제"
                              className={`p-0.5 ${ui.textMuted} hover:text-red-400 shrink-0`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          {/* Level 3: Shapes nested inside this Asterism (Cool Sky/Cyan Color — NO Navigation icon!) */}
                          {!isGrpCollapsed && (
                            <div className="px-1.5 pb-1.5 pl-4 space-y-1">
                              {shapes.length === 0 ? (
                                <div className={`text-[9.5px] py-1 px-1.5 ${ui.textMuted}`}>
                                  등록된 도형이 없습니다.
                                </div>
                              ) : (
                                shapes.map((obj) => {
                                  const isSelected = obj.id === selectedObjectId;
                                  const isExpanded = Boolean(expandedShapeIds[obj.id]);
                                  const hasVerticesDetail =
                                    obj.type !== 'label' && obj.vertices.length > 0;
                                  return (
                                    <div
                                      key={obj.id}
                                      className={`border transition-colors ${shapeRowTone(
                                        isSelected
                                      )}`}
                                      style={{ borderRadius: '4px' }}
                                    >
                                      <div
                                        className="px-1.5 py-1 flex items-center gap-1.5 text-[10px]"
                                        onDoubleClick={() => onOpenShapeProperties(grp.id, obj.id)}
                                      >
                                        {hasVerticesDetail && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedShapeIds((prev) => ({
                                                ...prev,
                                                [obj.id]: !prev[obj.id],
                                              }))
                                            }
                                            onDoubleClick={(e) => e.stopPropagation()}
                                            className={`p-0.5 shrink-0 ${ui.textMuted}`}
                                            title="도형 꼭짓점·구성 요소 보기"
                                          >
                                            {isExpanded ? (
                                              <ChevronDown className="w-2.5 h-2.5" />
                                            ) : (
                                              <ChevronRight className="w-2.5 h-2.5" />
                                            )}
                                          </button>
                                        )}
                                        <span
                                          className={`w-2 h-2 rounded-full shrink-0 ${
                                            theme === 'white' ? 'border border-slate-400/70' : ''
                                          }`}
                                          style={{
                                            backgroundColor: theme === 'red' ? '#EF4444' : obj.color,
                                          }}
                                        />
                                        <span
                                          className={`px-1 py-[0.5px] border text-[8.5px] font-medium shrink-0 ${shapeBadgeTone}`}
                                          style={{ borderRadius: '3px' }}
                                        >
                                          {getShapeTypeLabel(obj)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onSetActiveAsterism(grp.id);
                                            onSelectObject(obj.id);
                                          }}
                                          className="flex-1 text-left min-w-0 truncate"
                                          title="클릭하여 선택 · 더블클릭하여 속성창 펼치기"
                                        >
                                          <span className={`font-medium ${ui.textPrimary}`}>
                                            {obj.label || '(이름 없음)'}
                                          </span>
                                        </button>
                                        <span
                                          className={`font-mono text-[8.5px] tabular-nums shrink-0 ${ui.textMuted}`}
                                        >
                                          {obj.type === 'circle'
                                            ? `Ø${formatAngularSeparation(
                                                getCircleRadiusDeg(obj) * 2
                                              )}`
                                            : obj.type === 'label'
                                            ? '텍스트'
                                            : `${obj.vertices.length}꼭짓점`}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => onDeleteObject(obj.id)}
                                          onDoubleClick={(e) => e.stopPropagation()}
                                          title="도형 삭제"
                                          className={`p-0.5 ${ui.textMuted} hover:text-red-400 shrink-0`}
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>

                                      {/* Nested Vertices / Element Details inside the shape */}
                                      {isExpanded && hasVerticesDetail && (
                                        <div
                                          className={`px-2 py-1 border-t space-y-0.5 text-[9px] font-mono ${ui.divider} ${ui.textMuted}`}
                                        >
                                          {obj.type === 'circle' ? (
                                            <div className="flex items-center justify-between">
                                              <span>
                                                중심: {obj.vertices[0].starName || '자유좌표'}
                                              </span>
                                              <span>
                                                R {formatAngularSeparation(getCircleRadiusDeg(obj))}
                                              </span>
                                            </div>
                                          ) : (
                                            obj.vertices.map((v, vIdx) => (
                                              <div
                                                key={vIdx}
                                                className="flex items-center justify-between gap-1 truncate"
                                              >
                                                <span className="truncate">
                                                  #{vIdx + 1}{' '}
                                                  {v.starName || v.catalogId || '자유좌표'}
                                                </span>
                                                <span className="shrink-0 opacity-75">
                                                  {v.raDeg.toFixed(2)}°/{v.decDeg >= 0 ? '+' : ''}
                                                  {v.decDeg.toFixed(2)}°
                                                </span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Full JSON Backup / Import */}
      <div className={`pt-2.5 border-t space-y-1.5 ${ui.divider}`}>
        <div className={`text-[10px] font-semibold ${ui.textSecondary}`}>
          성군 데이터 백업 · 복원 (JSON)
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={store.asterisms.length === 0}
            onClick={() => downloadAsterismsJson(store)}
            className={`py-1.5 px-2 border text-[10px] font-medium flex items-center justify-center gap-1 ${
              store.asterisms.length === 0
                ? `${ui.buttonIdle} opacity-45 cursor-not-allowed`
                : ui.buttonIdle
            }`}
            style={{ borderRadius: '5px' }}
            title="모든 그룹과 성군을 JSON 파일로 백업"
          >
            <Download className="w-3 h-3" />
            <span>전체 성군 백업</span>
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className={`py-1.5 px-2 border text-[10px] font-medium flex items-center justify-center gap-1 ${ui.buttonIdle}`}
            style={{ borderRadius: '5px' }}
          >
            <Upload className="w-3 h-3" />
            <span>JSON 백업 불러오기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
