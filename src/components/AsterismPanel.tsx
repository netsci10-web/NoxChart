import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  Layers,
  Lock,
  MapPin,
  Navigation,
  Pencil,
  PenTool,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AsterismCategory,
  AsterismGroup,
  AsterismLayer,
  AsterismObject,
  AsterismStoreState,
  ThemeMode,
} from '../types/astronomy';
import {
  ASTERISM_CATEGORIES,
  downloadAsterismsJson,
  downloadSingleAsterismJson,
  getAsterismCategoryLabel,
  normalizeAsterismCategory,
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
  onReorderLayers: (fromId: string, toId: string) => void;
  onReorderAsterismGroups: (layerId: string, fromId: string, toId: string) => void;
  onReorderAsterismObjects: (asterismId: string, fromId: string, toId: string) => void;
  onImportBundle: (
    layers: AsterismLayer[],
    asterisms: AsterismGroup[],
    objects: AsterismObject[]
  ) => { addedCount: number };
}

type AsterismSortMode =
  | 'custom'
  | 'visible'
  | 'category'
  | 'name_asc'
  | 'name_desc'
  | 'newest'
  | 'shapes';

const ASTERISM_SORT_STORAGE_KEY = 'noxchart_asterism_sort_v1';
const VALID_SORT_MODES: AsterismSortMode[] = [
  'custom',
  'visible',
  'category',
  'name_asc',
  'name_desc',
  'newest',
  'shapes',
];

const CATEGORY_SORT_ORDER: Record<AsterismCategory, number> = {
  asterism: 0,
  hopping: 1,
  starchain: 2,
  other: 3,
};

function getShapeTypeLabel(obj: AsterismObject): string {
  if (obj.type === 'polyline') return obj.smooth ? '원호' : '선';
  if (obj.type === 'polygon') return '다각형';
  if (obj.type === 'circle') return '원';
  if (obj.type === 'arrow') return '방향선';
  if (obj.type === 'divider') return '등분선';
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
  onReorderLayers,
  onReorderAsterismGroups,
  onReorderAsterismObjects,
  onImportBundle,
}: AsterismPanelProps) {
  const ui = getUiTheme(theme);
  const [newLayerName, setNewLayerName] = useState('');
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameLayerDraft, setRenameLayerDraft] = useState('');
  const [renamingAsterismId, setRenamingAsterismId] = useState<string | null>(null);
  const [renameAsterismDraft, setRenameAsterismDraft] = useState('');
  const [dragState, setDragState] = useState<{
    kind: 'layer' | 'asterism' | 'shape';
    parentId?: string;
    id: string;
  } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [reorderEditMode, setReorderEditMode] = useState(false);
  const [showOnlyChartVisible, setShowOnlyChartVisible] = useState(false);
  const [sortMode, setSortMode] = useState<AsterismSortMode>(() => {
    try {
      const saved = localStorage.getItem(ASTERISM_SORT_STORAGE_KEY) as AsterismSortMode | null;
      return saved && VALID_SORT_MODES.includes(saved) ? saved : 'custom';
    } catch {
      return 'custom';
    }
  });
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

  const activeAsterismGroup = store.activeAsterismId
    ? store.asterisms.find((g) => g.id === store.activeAsterismId) ?? null
    : null;

  // Keep the active asterism and its parent group expanded while drawing,
  // and close list-level edit/add controls so the list stays locked cleanly.
  useEffect(() => {
    if (!asterismMode) return;
    setReorderEditMode(false);
    setShowAddLayer(false);
    setRenamingLayerId(null);
    if (!activeAsterismGroup) return;
    setOpenLayers((prev) =>
      prev[activeAsterismGroup.layerId] ? prev : { ...prev, [activeAsterismGroup.layerId]: true }
    );
    setOpenAsterisms((prev) =>
      prev[activeAsterismGroup.id] ? prev : { ...prev, [activeAsterismGroup.id]: true }
    );
  }, [asterismMode, activeAsterismGroup?.id, activeAsterismGroup?.layerId]);

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
            ? `그리기·도형 ${addedCount}개 항목을 불러왔습니다.`
            : '이미 동일한 그리기 데이터가 모두 등록되어 있습니다.'
        );
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Distinct visual styling tokens for Group vs Asterism vs Shape
  // Selected Group uses a distinct indigo/violet (or luminous crimson in red mode) tone
  // to clearly differentiate clicked groups from unselected groups, amber/cyan asterisms, and sky shapes.
  const groupContainerTone = (isActive: boolean) => {
    if (theme === 'white') {
      return isActive
        ? 'bg-indigo-50/75 border-indigo-400/90 shadow-xs'
        : `${ui.panelMuted} ${ui.border}`;
    }
    if (theme === 'red') {
      return isActive
        ? 'bg-[#2B0606] border-[#F87171]/85'
        : `${ui.panelMuted} ${ui.border}`;
    }
    return isActive
      ? 'bg-indigo-950/40 border-indigo-400/75'
      : `${ui.panelMuted} ${ui.border}`;
  };

  const groupHeaderTone = (isActive: boolean) => {
    if (!isActive) return '';
    if (theme === 'white') return 'bg-indigo-100/85';
    if (theme === 'red') return 'bg-[#450A0A]/80';
    return 'bg-indigo-500/20';
  };

  const groupTitleTone = (isActive: boolean) => {
    if (theme === 'white') {
      return isActive ? 'text-indigo-800' : 'text-slate-700';
    }
    if (theme === 'red') {
      return isActive ? 'text-[#FECACA]' : 'text-[#FCA5A5]/70';
    }
    return isActive ? 'text-indigo-200' : 'text-slate-300';
  };

  const lockBannerTone =
    theme === 'white'
      ? 'bg-amber-50 border-amber-400/80 text-amber-900'
      : theme === 'red'
      ? 'bg-[#2E0707] border-[#DC2626]/75 text-[#FCA5A5]'
      : 'bg-amber-500/12 border-amber-400/45 text-amber-200';

  const asterismRowTone = (isActive: boolean) => {
    if (theme === 'white') {
      return isActive
        ? 'bg-blue-100/85 border-blue-400/80'
        : 'bg-transparent border-slate-200 hover:bg-slate-200/50 hover:border-slate-300';
    }
    if (theme === 'red') {
      return isActive
        ? 'bg-[#380A0A] border-[#DC2626]/80'
        : 'bg-transparent border-[#3F0A0A]/80 hover:bg-[#2A0505]/60 hover:border-[#7F1D1D]/70';
    }
    return isActive
      ? 'bg-cyan-500/20 border-cyan-400/60'
      : 'bg-transparent border-slate-700/60 hover:bg-slate-700/35 hover:border-slate-500/70';
  };

  const getCategoryBadgeTone = (category: AsterismCategory) => {
    if (theme === 'red') {
      if (category === 'hopping') return 'bg-[#2B0810] text-rose-200 border-rose-700/75';
      if (category === 'starchain') return 'bg-[#240707] text-red-200 border-red-600/75';
      if (category === 'other') return 'bg-[#1D0505] text-[#FCA5A5]/75 border-[#5A1414]';
      return 'bg-red-950 text-red-300 border-red-700/70';
    }
    if (theme === 'white') {
      if (category === 'hopping') return 'bg-sky-100 text-sky-900 border-sky-400/70';
      if (category === 'starchain') return 'bg-emerald-100 text-emerald-900 border-emerald-400/70';
      if (category === 'other') return 'bg-slate-200/85 text-slate-700 border-slate-400/60';
      return 'bg-amber-200/80 text-amber-900 border-amber-400/60';
    }
    if (category === 'hopping') return 'bg-sky-400/20 text-sky-200 border-sky-400/45';
    if (category === 'starchain') return 'bg-emerald-400/20 text-emerald-200 border-emerald-400/45';
    if (category === 'other') return 'bg-slate-500/20 text-slate-300 border-slate-500/45';
    return 'bg-amber-400/20 text-amber-200 border-amber-400/40';
  };

  const shapeRowTone = (isSelected: boolean) => {
    if (theme === 'white') {
      return isSelected
        ? 'bg-sky-100/95 border-sky-400/80'
        : 'bg-transparent border-slate-200/90 hover:bg-slate-200/45 hover:border-slate-300';
    }
    if (theme === 'red') {
      return isSelected
        ? 'bg-[#2E060A] border-rose-500/70'
        : 'bg-transparent border-[#380808]/75 hover:bg-[#220406]/55 hover:border-[#6B1212]/70';
    }
    return isSelected
      ? 'bg-cyan-500/22 border-cyan-400/60'
      : 'bg-transparent border-slate-800/70 hover:bg-slate-700/30 hover:border-slate-600/60';
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

      {/* Top Header & Prominent Drawing Mode Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Layers className={`w-4 h-4 shrink-0 ${ui.accentText}`} />
            <span className={`font-semibold text-[12.5px] tracking-[-0.04em] truncate ${ui.textPrimary}`}>
              그리기 관리
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const newId = onCreateAsterismGroup();
              setOpenLayers((prev) => ({ ...prev, [store.activeLayerId]: true }));
              setOpenAsterisms((prev) => ({ ...prev, [newId]: true }));
              if (!asterismMode) onToggleAsterismMode();
              setNotice('새 그리기를 만들고 그리기 모드를 켰습니다.');
            }}
            className={`px-3 py-1.5 border text-[11.5px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${ui.buttonIdle}`}
            style={{ borderRadius: '6px' }}
            title="새 그리기 생성 후 그리기 시작"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>새 그리기</span>
          </button>
        </div>

        {/* Dedicated Full-Width Start Drawing Action Row */}
        <button
          type="button"
          onClick={onToggleAsterismMode}
          className={`w-full py-2.5 px-3 border text-[12.5px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm ${
            asterismMode ? ui.buttonActive : ui.buttonIdle
          }`}
          style={{ borderRadius: '6px' }}
          title="성도 우측 플로팅 그리기 도구 열기/닫기"
        >
          <PenTool className={`w-4 h-4 shrink-0 ${asterismMode ? '' : ui.accentText}`} />
          <span>{asterismMode ? '그리기 중 (종료)' : '그리기 시작'}</span>
        </button>
      </div>

      {/* Full JSON Backup / Import directly below header */}
      <div className={`pb-2 border-b space-y-1 ${ui.divider}`}>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={store.asterisms.length === 0}
            onClick={() => downloadAsterismsJson(store)}
            className={`py-1.5 px-2 border text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${
              store.asterisms.length === 0
                ? `${ui.buttonSave} opacity-45 cursor-not-allowed`
                : `${ui.buttonSave} cursor-pointer`
            }`}
            style={{ borderRadius: '5px' }}
            title="모든 그룹과 그리기를 JSON 파일로 백업"
          >
            <Download className="w-3 h-3 shrink-0" />
            <span>전체 그리기 백업</span>
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className={`py-1.5 px-2 border text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${ui.buttonLoad}`}
            style={{ borderRadius: '5px' }}
            title="백업한 그리기 JSON 파일 불러오기"
          >
            <Upload className="w-3 h-3 shrink-0" />
            <span>JSON 백업 불러오기</span>
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

      {/* Hierarchy Section: 그룹 > 그리기 > 도형 요소들 */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className={`text-[10.5px] font-semibold whitespace-nowrap ${ui.textSecondary}`}>
            그리기({store.asterisms.length})
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1">
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
              onClick={() => {
                setShowOnlyChartVisible((prev) => {
                  const next = !prev;
                  if (next) {
                    setOpenLayers((openPrev) => {
                      const updated = { ...openPrev };
                      for (const l of store.layers) {
                        if (
                          l.visible &&
                          store.asterisms.some((g) => g.layerId === l.id && g.visible)
                        ) {
                          updated[l.id] = true;
                        }
                      }
                      return updated;
                    });
                  }
                  return next;
                });
              }}
              aria-pressed={showOnlyChartVisible}
              title={
                showOnlyChartVisible
                  ? '성도 표시 필터 해제 (전체 항목 보기)'
                  : '성도에 표시 중인 항목만 리스트에 보기'
              }
              className={`px-1.5 py-0.5 border text-[9.5px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                showOnlyChartVisible ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              성도표시
            </button>
            <button
              type="button"
              disabled={asterismMode}
              onClick={() => {
                if (asterismMode) return;
                setReorderEditMode((v) => {
                  const next = !v;
                  if (next) setSortMode('custom');
                  return next;
                });
              }}
              title={
                asterismMode
                  ? '그리기 중에는 순서를 편집할 수 없습니다'
                  : reorderEditMode
                  ? '순서 편집 종료'
                  : '그룹·그리기·도형 순서 편집 (위/아래 이동)'
              }
              className={`px-1.5 py-0.5 border text-[9.5px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                asterismMode
                  ? `${ui.buttonIdle} opacity-40 cursor-not-allowed`
                  : reorderEditMode
                  ? `${ui.buttonActive} cursor-pointer`
                  : `${ui.buttonIdle} cursor-pointer`
              }`}
              style={{ borderRadius: '4px' }}
            >
              <span>{reorderEditMode ? '완료' : '편집'}</span>
            </button>
            <button
              type="button"
              disabled={asterismMode}
              onClick={() => {
                if (asterismMode) return;
                setShowAddLayer((v) => !v);
              }}
              title={asterismMode ? '그리기 중에는 새 그룹을 추가할 수 없습니다' : '새 그룹 추가'}
              className={`p-1 border shrink-0 ${
                asterismMode
                  ? `${ui.buttonIdle} opacity-40 cursor-not-allowed`
                  : showAddLayer
                  ? ui.buttonActive
                  : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              <FolderPlus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Sort Controls Bar */}
        <div
          className={`flex items-center justify-between gap-1.5 px-2 py-1 border ${ui.panelMuted} ${ui.border}`}
          style={{ borderRadius: '5px' }}
        >
          <span className={`flex items-center gap-1 text-[10px] shrink-0 ${ui.textMuted}`}>
            <ArrowUpDown className="w-3 h-3" />
            <span>정렬</span>
          </span>
          <select
            aria-label="그룹 내 항목 정렬 기준"
            value={reorderEditMode ? 'custom' : sortMode}
            onChange={(e) => {
              const next = e.target.value as AsterismSortMode;
              setSortMode(next);
              if (next !== 'custom') setReorderEditMode(false);
              try {
                localStorage.setItem(ASTERISM_SORT_STORAGE_KEY, next);
              } catch {
                // Ignore storage quota errors
              }
            }}
            className={`flex-1 min-w-0 px-1.5 py-0.5 border text-[10px] cursor-pointer ${ui.input}`}
            style={{ borderRadius: '4px' }}
          >
            <option value="custom">기본순 (사용자 지정)</option>
            <option value="visible">성도 표시순</option>
            <option value="category">분류순 (성군·호핑·스타체인·기타)</option>
            <option value="name_asc">이름순 (가→하)</option>
            <option value="name_desc">이름 역순 (하→가)</option>
            <option value="newest">최신 생성순</option>
            <option value="shapes">도형 많은순</option>
          </select>
        </div>

        {/* Drawing Mode List-Lock Notice Banner */}
        {asterismMode && (
          <div
            className={`px-2 py-1.5 border flex items-start gap-1.5 text-[10px] leading-snug ${lockBannerTone}`}
            style={{ borderRadius: '5px' }}
          >
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold">그리기 중 · 리스트 선택 잠금</div>
              <div className="text-[9.5px] opacity-85">
                다른 그리기·그룹은 클릭할 수 없습니다. 그리기 종료 후 전환하세요.
              </div>
            </div>
          </div>
        )}

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
              placeholder="새 그룹 이름 (예: 겨울 관측)"
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
          {(() => {
            const effectiveSort: AsterismSortMode = reorderEditMode ? 'custom' : sortMode;
            const shapeCountByGrp = new Map<string, number>();
            for (const o of store.objects) {
              shapeCountByGrp.set(o.asterismId, (shapeCountByGrp.get(o.asterismId) ?? 0) + 1);
            }
            const compareNames = (a: string, b: string) =>
              a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' });

            // Preserve group (layer) order; apply sort ONLY to items inside each group.
            const layerEntries = store.layers
              .map((layer) => {
                const allLayerAsterisms = store.asterisms.filter((g) => g.layerId === layer.id);
                const filteredAsterisms = showOnlyChartVisible
                  ? allLayerAsterisms.filter((g) => layer.visible && g.visible)
                  : allLayerAsterisms;
                const sortedAsterisms =
                  effectiveSort === 'custom'
                    ? filteredAsterisms
                    : [...filteredAsterisms].sort((a, b) => {
                        if (effectiveSort === 'visible') {
                          const av = layer.visible && a.visible ? 2 : a.visible ? 1 : 0;
                          const bv = layer.visible && b.visible ? 2 : b.visible ? 1 : 0;
                          if (av !== bv) return bv - av;
                          return compareNames(a.name, b.name);
                        }
                        if (effectiveSort === 'category') {
                          const ac = CATEGORY_SORT_ORDER[normalizeAsterismCategory(a.category)];
                          const bc = CATEGORY_SORT_ORDER[normalizeAsterismCategory(b.category)];
                          if (ac !== bc) return ac - bc;
                          return compareNames(a.name, b.name);
                        }
                        if (effectiveSort === 'name_asc') return compareNames(a.name, b.name);
                        if (effectiveSort === 'name_desc') return compareNames(b.name, a.name);
                        if (effectiveSort === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
                        if (effectiveSort === 'shapes') {
                          const ac = shapeCountByGrp.get(a.id) ?? 0;
                          const bc = shapeCountByGrp.get(b.id) ?? 0;
                          if (ac !== bc) return bc - ac;
                          return compareNames(a.name, b.name);
                        }
                        return 0;
                      });
                return { layer, allLayerAsterisms, layerAsterisms: sortedAsterisms };
              })
              .filter((entry) => !showOnlyChartVisible || entry.layerAsterisms.length > 0);

            if (showOnlyChartVisible && layerEntries.length === 0) {
              return (
                <div
                  className={`p-3 border text-center space-y-1.5 ${ui.panelMuted} ${ui.border}`}
                  style={{ borderRadius: '6px' }}
                >
                  <p className={`text-[10px] ${ui.textMuted}`}>
                    현재 성도에 표시 중인 항목이 없습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowOnlyChartVisible(false)}
                    className={`px-2 py-0.5 border text-[9.5px] cursor-pointer ${ui.buttonIdle}`}
                    style={{ borderRadius: '4px' }}
                  >
                    전체 목록 보기
                  </button>
                </div>
              );
            }

            return layerEntries.map(({ layer, allLayerAsterisms, layerAsterisms }) => {
            const isActiveLayer = store.activeLayerId === layer.id;
            const isRenamingLayer = renamingLayerId === layer.id;
            const isLockedOpenLayer =
              asterismMode && activeAsterismGroup?.layerId === layer.id;
            const isLockedOtherLayer =
              asterismMode &&
              (!activeAsterismGroup || activeAsterismGroup.layerId !== layer.id);
            const isLayerCollapsed = !isLockedOpenLayer && !openLayers[layer.id];
            const visibleAsterismCount = allLayerAsterisms.filter((g) => g.visible).length;
            const groupVisState: 'all' | 'partial' | 'none' =
              allLayerAsterisms.length === 0
                ? layer.visible
                  ? 'all'
                  : 'none'
                : !layer.visible || visibleAsterismCount === 0
                ? 'none'
                : visibleAsterismCount === allLayerAsterisms.length
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

            const layerIdx = store.layers.findIndex((l) => l.id === layer.id);
            return (
              <div
                key={layer.id}
                draggable={reorderEditMode && store.layers.length > 1}
                onDragStart={(e) => {
                  if (!reorderEditMode) return;
                  e.stopPropagation();
                  setDragState({ kind: 'layer', id: layer.id });
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', layer.id);
                }}
                onDragOver={(e) => {
                  if (!dragState || dragState.kind !== 'layer' || dragState.id === layer.id) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverKey(`layer:${layer.id}`);
                }}
                onDragLeave={() => {
                  if (dragOverKey === `layer:${layer.id}`) setDragOverKey(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragState && dragState.kind === 'layer' && dragState.id !== layer.id) {
                    onReorderLayers(dragState.id, layer.id);
                  }
                  setDragState(null);
                  setDragOverKey(null);
                }}
                onDragEnd={() => {
                  setDragState(null);
                  setDragOverKey(null);
                }}
                className={`border transition-colors overflow-hidden ${groupContainerTone(
                  isActiveLayer
                )} ${isLockedOtherLayer ? 'opacity-50' : ''} ${
                  dragOverKey === `layer:${layer.id}` ? 'ring-1 ring-cyan-400' : ''
                }`}
                style={{ borderRadius: '6px' }}
              >
                {/* Level 1: Group (Layer) Row */}
                <div
                  className={`px-2 py-1.5 flex items-center gap-1 transition-colors ${groupHeaderTone(
                    isActiveLayer
                  )} ${isLockedOtherLayer ? 'cursor-not-allowed' : ''}`}
                >
                  <button
                    type="button"
                    disabled={isLockedOpenLayer || isLockedOtherLayer}
                    onClick={() => {
                      if (isLockedOpenLayer || isLockedOtherLayer) return;
                      setOpenLayers((prev) => ({ ...prev, [layer.id]: !prev[layer.id] }));
                    }}
                    title={
                      isLockedOpenLayer
                        ? '그리기 중인 항목이 포함된 그룹은 접을 수 없습니다'
                        : isLockedOtherLayer
                        ? '그리기 중에는 다른 그룹을 조작할 수 없습니다'
                        : '그룹 펼치기/접기'
                    }
                    className={`p-0.5 shrink-0 ${ui.textMuted} ${
                      isLockedOpenLayer || isLockedOtherLayer
                        ? 'opacity-45 cursor-not-allowed'
                        : ''
                    }`}
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
                        ? '일부 그리기 표시 중 · 클릭하여 그룹 전체 표시'
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
                      disabled={asterismMode}
                      onClick={() => {
                        if (asterismMode) return;
                        onSetActiveLayer(layer.id);
                      }}
                      className={`flex-1 text-left min-w-0 flex items-center gap-1 ${
                        asterismMode ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      title={
                        asterismMode
                          ? '그리기 중에는 다른 그룹을 선택할 수 없습니다'
                          : layer.name
                      }
                    >
                      {isLockedOtherLayer && (
                        <Lock className="w-2.5 h-2.5 shrink-0 opacity-75" />
                      )}
                      <div
                        className={`text-[10.5px] font-semibold truncate ${groupTitleTone(
                          isActiveLayer
                        )}`}
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
                    disabled={asterismMode}
                    onClick={() => {
                      if (asterismMode) return;
                      const newId = onCreateAsterismGroup(undefined, layer.id);
                      setOpenLayers((prev) => ({ ...prev, [layer.id]: true }));
                      setOpenAsterisms((prev) => ({ ...prev, [newId]: true }));
                    }}
                    title={
                      asterismMode
                        ? '그리기 중에는 그룹에서 그리기를 추가할 수 없습니다'
                        : '이 그룹에 새 그리기 추가'
                    }
                    className={`p-0.5 ${ui.textMuted} shrink-0 ${
                      asterismMode ? 'opacity-35 cursor-not-allowed' : 'hover:opacity-100'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    disabled={isLockedOtherLayer}
                    onClick={() => {
                      if (isLockedOtherLayer) return;
                      setRenamingLayerId(layer.id);
                      setRenameLayerDraft(layer.name);
                    }}
                    title={
                      isLockedOtherLayer
                        ? '그리기 중에는 다른 그룹을 수정할 수 없습니다'
                        : '그룹 이름 수정'
                    }
                    className={`p-0.5 ${ui.textMuted} shrink-0 ${
                      isLockedOtherLayer ? 'opacity-35 cursor-not-allowed' : 'hover:opacity-100'
                    }`}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>

                  {store.layers.length > 1 && (
                    <button
                      type="button"
                      disabled={asterismMode}
                      onClick={() => {
                        if (asterismMode) return;
                        onDeleteLayer(layer.id);
                      }}
                      title={
                        asterismMode
                          ? '그리기 중에는 그룹을 삭제할 수 없습니다'
                          : '그룹 삭제'
                      }
                      className={`p-0.5 ${ui.textMuted} shrink-0 ${
                        asterismMode ? 'opacity-35 cursor-not-allowed' : 'hover:text-red-400'
                      }`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {reorderEditMode && store.layers.length > 1 && (
                    <div className="flex flex-col shrink-0 ml-0.5">
                      <button
                        type="button"
                        disabled={layerIdx <= 0}
                        onClick={() => onReorderLayers(layer.id, store.layers[layerIdx - 1].id)}
                        title="그룹 위로 이동"
                        aria-label={`${layer.name} 위로 이동`}
                        className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={layerIdx >= store.layers.length - 1}
                        onClick={() => onReorderLayers(layer.id, store.layers[layerIdx + 1].id)}
                        title="그룹 아래로 이동"
                        aria-label={`${layer.name} 아래로 이동`}
                        className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Level 2: Asterisms inside this Group */}
                {!isLayerCollapsed && layerAsterisms.length > 0 && (
                  <div className={`border-t p-1.5 space-y-1.5 ${ui.divider}`}>
                    {layerAsterisms.map((grp, grpIdx) => {
                      const shapes = store.objects.filter((o) => o.asterismId === grp.id);
                      const isActiveGrp = store.activeAsterismId === grp.id;
                      const isLockedOpenGrp = asterismMode && isActiveGrp;
                      const isLockedOtherGrp = asterismMode && !isActiveGrp;
                      const isGrpCollapsed = !isLockedOpenGrp && !openAsterisms[grp.id];
                      const isRenamingGrp = !isLockedOtherGrp && renamingAsterismId === grp.id;

                      return (
                        <div
                          key={grp.id}
                          draggable={reorderEditMode && !asterismMode && layerAsterisms.length > 1}
                          onDragStart={(e) => {
                            if (!reorderEditMode) return;
                            e.stopPropagation();
                            setDragState({ kind: 'asterism', parentId: layer.id, id: grp.id });
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', grp.id);
                          }}
                          onDragOver={(e) => {
                            if (
                              !dragState ||
                              dragState.kind !== 'asterism' ||
                              dragState.parentId !== layer.id ||
                              dragState.id === grp.id
                            ) {
                              return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverKey(`asterism:${grp.id}`);
                          }}
                          onDragLeave={() => {
                            if (dragOverKey === `asterism:${grp.id}`) setDragOverKey(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              dragState &&
                              dragState.kind === 'asterism' &&
                              dragState.parentId === layer.id &&
                              dragState.id !== grp.id
                            ) {
                              onReorderAsterismGroups(layer.id, dragState.id, grp.id);
                            }
                            setDragState(null);
                            setDragOverKey(null);
                          }}
                          onDragEnd={() => {
                            setDragState(null);
                            setDragOverKey(null);
                          }}
                          className={`border transition-colors overflow-hidden ${asterismRowTone(
                            isActiveGrp
                          )} ${
                            isLockedOtherGrp
                              ? 'opacity-40 grayscale-[35%] cursor-not-allowed select-none'
                              : ''
                          } ${
                            dragOverKey === `asterism:${grp.id}` ? 'ring-1 ring-cyan-400' : ''
                          }`}
                          style={{ borderRadius: '5px' }}
                          title={
                            isLockedOtherGrp
                              ? '그리기 중에는 다른 그리기를 선택할 수 없습니다'
                              : undefined
                          }
                        >
                          {/* Asterism Header Row (Warm Amber Color) — HAS Quick-Jump Navigation Icon! */}
                          <div
                            className={`px-1.5 py-1.5 flex items-center gap-1 ${
                              isLockedOtherGrp ? 'pointer-events-none' : ''
                            }`}
                          >
                            <button
                              type="button"
                              disabled={isLockedOpenGrp || isLockedOtherGrp}
                              onClick={() => {
                                if (isLockedOpenGrp || isLockedOtherGrp) return;
                                setOpenAsterisms((prev) => ({
                                  ...prev,
                                  [grp.id]: !prev[grp.id],
                                }));
                              }}
                              title={
                                isLockedOpenGrp
                                  ? '그리기 중인 항목은 접을 수 없습니다'
                                  : isLockedOtherGrp
                                  ? '그리기 중에는 다른 그리기를 조작할 수 없습니다'
                                  : '그리기 도형 펼치기/접기'
                              }
                              className={`p-0.5 shrink-0 ${ui.textMuted} ${
                                isLockedOpenGrp || isLockedOtherGrp
                                  ? 'opacity-45 cursor-not-allowed'
                                  : ''
                              }`}
                              aria-label="그리기 도형 펼치기/접기"
                            >
                              {isGrpCollapsed ? (
                                <ChevronRight className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isLockedOtherGrp}
                              onClick={() => {
                                if (isLockedOtherGrp) return;
                                onToggleAsterismGroupVisible(grp.id);
                              }}
                              title={grp.visible ? '그리기 숨기기' : '그리기 표시'}
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

                            {(() => {
                              const currentCat = normalizeAsterismCategory(grp.category);
                              const currentCatLabel = getAsterismCategoryLabel(currentCat);
                              const catIndex = ASTERISM_CATEGORIES.findIndex(
                                (c) => c.id === currentCat
                              );
                              const nextCat =
                                ASTERISM_CATEGORIES[
                                  (catIndex + 1) % ASTERISM_CATEGORIES.length
                                ].id;
                              return (
                                <button
                                  type="button"
                                  disabled={isLockedOtherGrp}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isLockedOtherGrp) return;
                                    onUpdateAsterismGroup(grp.id, { category: nextCat });
                                  }}
                                  title={`분류: ${currentCatLabel} (클릭하여 성군·호핑·스타체인·기타 전환)`}
                                  className={`px-1 py-[0.5px] border text-[8.5px] font-semibold shrink-0 transition-opacity ${getCategoryBadgeTone(
                                    currentCat
                                  )} ${
                                    isLockedOtherGrp
                                      ? 'cursor-not-allowed'
                                      : 'cursor-pointer hover:opacity-85'
                                  }`}
                                  style={{ borderRadius: '3px' }}
                                >
                                  {currentCatLabel}
                                </button>
                              );
                            })()}
                            {isLockedOtherGrp && (
                              <Lock className="w-2.5 h-2.5 shrink-0 opacity-80" />
                            )}

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
                                disabled={isLockedOtherGrp}
                                onClick={() => {
                                  if (isLockedOtherGrp) return;
                                  onOpenAsterismLayers(grp.id);
                                }}
                                className={`flex-1 text-left min-w-0 ${
                                  isLockedOtherGrp ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                title={
                                  isLockedOtherGrp
                                    ? '그리기 중에는 다른 그리기를 선택할 수 없습니다'
                                    : grp.name
                                }
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  <span
                                    className={`text-[10.5px] font-semibold truncate ${ui.textPrimary}`}
                                  >
                                    {grp.name}
                                  </span>
                                  {isLockedOpenGrp && (
                                    <span
                                      className={`px-1 py-[0.5px] text-[8px] font-semibold border shrink-0 ${ui.buttonActive}`}
                                      style={{ borderRadius: '3px' }}
                                    >
                                      그리기 중
                                    </span>
                                  )}
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
                                  : '그리기 위치로 바로가기'
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
                              title="이 그리기 개별 백업 (JSON)"
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
                              title="그리기 이름 수정"
                              className={`p-0.5 ${ui.textMuted} hover:opacity-100 shrink-0`}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteAsterismGroup(grp.id)}
                              title="그리기 및 하위 도형 모두 삭제"
                              className={`p-0.5 ${ui.textMuted} hover:text-red-400 shrink-0`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                            {reorderEditMode && layerAsterisms.length > 1 && (
                              <div className="flex flex-col shrink-0 ml-0.5">
                                <button
                                  type="button"
                                  disabled={grpIdx === 0}
                                  onClick={() =>
                                    onReorderAsterismGroups(
                                      layer.id,
                                      grp.id,
                                      layerAsterisms[grpIdx - 1].id
                                    )
                                  }
                                  title="그리기 위로 이동"
                                  aria-label={`${grp.name} 위로 이동`}
                                  className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={grpIdx === layerAsterisms.length - 1}
                                  onClick={() =>
                                    onReorderAsterismGroups(
                                      layer.id,
                                      grp.id,
                                      layerAsterisms[grpIdx + 1].id
                                    )
                                  }
                                  title="그리기 아래로 이동"
                                  aria-label={`${grp.name} 아래로 이동`}
                                  className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Level 3: Shapes nested inside this Asterism (Cool Sky/Cyan Color — NO Navigation icon!) */}
                          {!isGrpCollapsed && (
                            <div
                              className={`px-1.5 pb-1.5 pl-4 space-y-1 ${
                                isLockedOtherGrp ? 'pointer-events-none' : ''
                              }`}
                            >
                              {shapes.length === 0 ? (
                                <div className={`text-[9.5px] py-1 px-1.5 ${ui.textMuted}`}>
                                  등록된 도형이 없습니다.
                                </div>
                              ) : (
                                shapes.map((obj, shapeIdx) => {
                                  const isSelected = obj.id === selectedObjectId;
                                  const isExpanded = Boolean(expandedShapeIds[obj.id]);
                                  const hasVerticesDetail =
                                    obj.type !== 'label' && obj.vertices.length > 0;
                                  return (
                                    <div
                                      key={obj.id}
                                      draggable={reorderEditMode && shapes.length > 1}
                                      onDragStart={(e) => {
                                        if (!reorderEditMode) return;
                                        e.stopPropagation();
                                        setDragState({
                                          kind: 'shape',
                                          parentId: grp.id,
                                          id: obj.id,
                                        });
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', obj.id);
                                      }}
                                      onDragOver={(e) => {
                                        if (
                                          !dragState ||
                                          dragState.kind !== 'shape' ||
                                          dragState.parentId !== grp.id ||
                                          dragState.id === obj.id
                                        ) {
                                          return;
                                        }
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverKey(`shape:${obj.id}`);
                                      }}
                                      onDragLeave={() => {
                                        if (dragOverKey === `shape:${obj.id}`) setDragOverKey(null);
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (
                                          dragState &&
                                          dragState.kind === 'shape' &&
                                          dragState.parentId === grp.id &&
                                          dragState.id !== obj.id
                                        ) {
                                          onReorderAsterismObjects(grp.id, dragState.id, obj.id);
                                        }
                                        setDragState(null);
                                        setDragOverKey(null);
                                      }}
                                      onDragEnd={() => {
                                        setDragState(null);
                                        setDragOverKey(null);
                                      }}
                                      className={`border transition-colors ${shapeRowTone(
                                        isSelected
                                      )} ${
                                        dragOverKey === `shape:${obj.id}`
                                          ? 'ring-1 ring-cyan-400'
                                          : ''
                                      }`}
                                      style={{ borderRadius: '4px' }}
                                    >
                                      <div
                                        className="px-1.5 py-1 flex items-center gap-1 text-[10px]"
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
                                          title={obj.label || '(이름 없음)'}
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
                                        {reorderEditMode && shapes.length > 1 && (
                                          <div className="flex flex-col shrink-0 ml-0.5">
                                            <button
                                              type="button"
                                              disabled={shapeIdx === 0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onReorderAsterismObjects(
                                                  grp.id,
                                                  obj.id,
                                                  shapes[shapeIdx - 1].id
                                                );
                                              }}
                                              onDoubleClick={(e) => e.stopPropagation()}
                                              title="도형 위로 이동"
                                              aria-label="도형 위로 이동"
                                              className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                                            >
                                              <ChevronUp className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={shapeIdx === shapes.length - 1}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onReorderAsterismObjects(
                                                  grp.id,
                                                  obj.id,
                                                  shapes[shapeIdx + 1].id
                                                );
                                              }}
                                              onDoubleClick={(e) => e.stopPropagation()}
                                              title="도형 아래로 이동"
                                              aria-label="도형 아래로 이동"
                                              className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                                            >
                                              <ChevronDown className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
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
          });
          })()}
        </div>
      </div>
    </div>
  );
}
