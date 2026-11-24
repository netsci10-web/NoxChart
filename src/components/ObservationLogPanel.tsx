import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  FileSpreadsheet,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import {
  EquipmentLockerState,
  ObservationLogEntry,
  ObservationLogStoreState,
  ObservationSeeingGrade,
  ObservedObjectStatus,
  ObserverConfig,
  OpticsSettings,
  SavedObservingSite,
  SelectedItem,
  ThemeMode,
} from '../types/astronomy';
import {
  buildActiveEquipmentSummary,
  downloadObservationLogsCsv,
  downloadObservationLogsJson,
  formatObservationDateTime,
  fromDateTimeLocalValue,
  getSeeingLabel,
  getSelectedObjectMeta,
  parseObservationLogsFromJson,
  SEEING_OPTIONS,
  toDateTimeLocalValue,
} from '../utils/observationLogStorage';
import { getUiTheme } from '../utils/themeClasses';
import { useConfirmDialog } from './ConfirmDialog';

interface ObservationLogPanelProps {
  theme: ThemeMode;
  selected: SelectedItem | null;
  observer: ObserverConfig;
  optics: OpticsSettings;
  equipmentLocker: EquipmentLockerState;
  savedSites: SavedObservingSite[];
  store: ObservationLogStoreState;
  onSaveLog: (entry: ObservationLogEntry) => void;
  onDeleteLog: (logId: string) => void;
  onToggleObservedStatus: (
    meta: {
      objectId: string;
      objectKind: 'star' | 'dso' | 'planet' | 'double';
      objectName: string;
      constellation?: string;
      raDeg: number;
      decDeg: number;
    },
    forceObserved?: boolean
  ) => void;
  onFocusTarget: (target: {
    objectId: string;
    objectKind: 'star' | 'dso' | 'planet' | 'double';
    raDeg: number;
    decDeg: number;
  }) => void;
  onImportStore: (incoming: ObservationLogStoreState) => {
    addedLogs: number;
    updatedLogs: number;
  };
  onReorderLogs: (orderedIds: string[]) => void;
}

interface LogFormDraft {
  id: string | null;
  objectId: string;
  objectKind: 'star' | 'dso' | 'planet' | 'double';
  objectName: string;
  constellation?: string;
  raDeg: number;
  decDeg: number;
  observedAtLocal: string;
  location: string;
  equipment: string;
  seeing: ObservationSeeingGrade;
  transparency: ObservationSeeingGrade;
  rating: number;
  notes: string;
}

export function ObservationLogPanel({
  theme,
  selected,
  observer,
  optics,
  equipmentLocker,
  savedSites,
  store,
  onSaveLog,
  onDeleteLog,
  onToggleObservedStatus,
  onFocusTarget,
  onImportStore,
  onReorderLogs,
}: ObservationLogPanelProps) {
  const ui = getUiTheme(theme);
  const confirmDialog = useConfirmDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subTab, setSubTab] = useState<'logs' | 'observed'>('logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'custom' | 'newest' | 'oldest' | 'rating' | 'name'>('custom');
  const [locationFilter, setLocationFilter] = useState<string>('__all__');
  const [draft, setDraft] = useState<LogFormDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragLogId, setDragLogId] = useState<string | null>(null);
  const [dragOverLogId, setDragOverLogId] = useState<string | null>(null);

  const obsTimeMs = observer.useLiveTime ? Date.now() : observer.timestampMs;
  const activeEquipSummary = useMemo(
    () => buildActiveEquipmentSummary(equipmentLocker, optics),
    [equipmentLocker, optics]
  );

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((cur) => (cur === msg ? null : cur));
    }, 3600);
  };

  const openNewDraft = (targetMeta?: {
    objectId: string;
    objectKind: 'star' | 'dso' | 'planet' | 'double';
    objectName: string;
    constellation?: string;
    raDeg: number;
    decDeg: number;
  }) => {
    const meta = targetMeta ?? (selected ? getSelectedObjectMeta(selected) : null);
    setDraft({
      id: null,
      objectId: meta?.objectId ?? '',
      objectKind: meta?.objectKind ?? 'dso',
      objectName: meta?.objectName ?? '',
      constellation: meta?.constellation,
      raDeg: meta?.raDeg ?? 0,
      decDeg: meta?.decDeg ?? 0,
      observedAtLocal: toDateTimeLocalValue(obsTimeMs),
      location: observer.name.trim(),
      equipment: activeEquipSummary,
      seeing: '',
      transparency: '',
      rating: 0,
      notes: '',
    });
    setSubTab('logs');
  };

  const openEditDraft = (entry: ObservationLogEntry) => {
    setDraft({
      id: entry.id,
      objectId: entry.objectId,
      objectKind: entry.objectKind,
      objectName: entry.objectName,
      constellation: entry.constellation,
      raDeg: entry.raDeg,
      decDeg: entry.decDeg,
      observedAtLocal: toDateTimeLocalValue(entry.observedAt),
      location: entry.location,
      equipment: entry.equipment,
      seeing: entry.seeing ?? '',
      transparency: entry.transparency ?? '',
      rating: entry.rating ?? 0,
      notes: entry.notes,
    });
    setSubTab('logs');
  };

  const handleApplySelectedToDraft = () => {
    if (!selected || !draft) return;
    const meta = getSelectedObjectMeta(selected);
    setDraft({
      ...draft,
      objectId: meta.objectId,
      objectKind: meta.objectKind,
      objectName: meta.objectName,
      constellation: meta.constellation,
      raDeg: meta.raDeg,
      decDeg: meta.decDeg,
    });
  };

  const handleSubmitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const trimmedName = draft.objectName.trim();
    if (!trimmedName) {
      showNotice('관측 대상 이름을 입력하거나 성도에서 천체를 선택해 주세요.');
      return;
    }
    const now = Date.now();
    const existing = draft.id ? store.logs.find((l) => l.id === draft.id) : undefined;
    const id = existing?.id ?? `obslog_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const objectId = draft.objectId.trim() || `custom_${trimmedName.toLowerCase().replace(/\s+/g, '_')}`;
    const observedAt = fromDateTimeLocalValue(draft.observedAtLocal, obsTimeMs);

    const entry: ObservationLogEntry = {
      id,
      objectId,
      objectKind: draft.objectKind,
      objectName: trimmedName,
      constellation: draft.constellation,
      raDeg: draft.raDeg,
      decDeg: draft.decDeg,
      observedAt,
      location: draft.location.trim(),
      equipment: draft.equipment.trim(),
      seeing: draft.seeing,
      transparency: draft.transparency,
      rating: draft.rating > 0 ? draft.rating : undefined,
      notes: draft.notes.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    onSaveLog(entry);
    setDraft(null);
    showNotice(existing ? '관측기록을 수정했습니다.' : `‘${trimmedName}’ 관측기록을 저장했습니다.`);
  };

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    for (const l of store.logs) {
      if (l.location.trim()) set.add(l.location.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [store.logs]);

  const logCountByObjectId = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of store.logs) {
      map.set(l.objectId, (map.get(l.objectId) ?? 0) + 1);
    }
    return map;
  }, [store.logs]);

  const observedObjects = useMemo(() => {
    const map = new Map<string, ObservedObjectStatus>();
    for (const st of Object.values(store.observedMap)) {
      if (st.observed) map.set(st.objectId, st);
    }
    for (const log of store.logs) {
      const explicit = store.observedMap[log.objectId];
      if (explicit && !explicit.observed) continue;
      if (!map.has(log.objectId)) {
        map.set(log.objectId, {
          objectId: log.objectId,
          objectKind: log.objectKind,
          objectName: log.objectName,
          constellation: log.constellation,
          raDeg: log.raDeg,
          decDeg: log.decDeg,
          observed: true,
          updatedAt: log.observedAt,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [store]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = store.logs.filter((l) => {
      if (locationFilter !== '__all__' && l.location.trim() !== locationFilter) {
        return false;
      }
      if (!q) return true;
      return (
        l.objectName.toLowerCase().includes(q) ||
        l.objectId.toLowerCase().includes(q) ||
        (l.constellation ?? '').toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        l.equipment.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q)
      );
    });
    if (sortBy === 'custom') return list;
    return [...list].sort((a, b) => {
      if (sortBy === 'oldest') return a.observedAt - b.observedAt;
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0) || b.observedAt - a.observedAt;
      if (sortBy === 'name') return a.objectName.localeCompare(b.objectName, 'ko');
      return b.observedAt - a.observedAt;
    });
  }, [store.logs, searchQuery, locationFilter, sortBy]);

  const handleReorderFilteredLogs = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const baseOrder =
      sortBy === 'custom'
        ? store.logs.map((l) => l.id)
        : [
            ...filteredLogs.map((l) => l.id),
            ...store.logs
              .map((l) => l.id)
              .filter((id) => !filteredLogs.some((fl) => fl.id === id)),
          ];
    const fromIdx = baseOrder.indexOf(fromId);
    const toIdx = baseOrder.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const nextOrder = [...baseOrder];
    const [moved] = nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, moved);
    if (sortBy !== 'custom') setSortBy('custom');
    onReorderLogs(nextOrder);
  };

  const filteredObservedObjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return observedObjects;
    return observedObjects.filter(
      (o) =>
        o.objectName.toLowerCase().includes(q) ||
        o.objectId.toLowerCase().includes(q) ||
        (o.constellation ?? '').toLowerCase().includes(q)
    );
  }, [observedObjects, searchQuery]);

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseObservationLogsFromJson(text);
      if (!parsed) {
        showNotice('유효한 NoxChart 관측기록 JSON 파일이 아닙니다.');
        return;
      }
      const res = onImportStore(parsed);
      showNotice(`관측기록 가져오기 완료 (신규 ${res.addedLogs}건 · 갱신 ${res.updatedLogs}건)`);
    } catch {
      showNotice('파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  const quickSiteNames = useMemo(() => {
    const names = new Set<string>();
    if (observer.name.trim()) names.add(observer.name.trim());
    for (const s of savedSites) {
      if (s.name.trim()) names.add(s.name.trim());
    }
    for (const loc of uniqueLocations) {
      names.add(loc);
    }
    return Array.from(names);
  }, [observer.name, savedSites, uniqueLocations]);

  const appendEquipmentPiece = (piece: string) => {
    if (!draft) return;
    const cur = draft.equipment.trim();
    if (!cur) {
      setDraft({ ...draft, equipment: piece });
      return;
    }
    if (cur.includes(piece)) return;
    setDraft({ ...draft, equipment: `${cur} + ${piece}` });
  };

  return (
    <div className="space-y-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFileChange}
      />

      {/* Top Summary & Primary Action */}
      <div
        className={`border p-2 space-y-2 ${ui.border}`}
        style={{ borderRadius: '6px' }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="min-w-0">
            <div className={`font-semibold flex items-center gap-1 tracking-[-0.04em] ${ui.textPrimary}`}>
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>나의 관측기록부</span>
            </div>
            <div className={`text-[9.5px] font-mono tabular-nums ${ui.textMuted}`}>
              기록 {store.logs.length}건 · 관측 완료 {observedObjects.length}천체
            </div>
          </div>
          <button
            type="button"
            onClick={() => (draft ? setDraft(null) : openNewDraft())}
            className={`px-2 py-1 border text-[10px] font-semibold tracking-[-0.05em] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
              draft ? ui.buttonIdle : ui.buttonActive
            }`}
            style={{ borderRadius: '4px' }}
          >
            {draft ? (
              <>
                <X className="w-3 h-3" />
                <span>닫기</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                <span>새 기록</span>
              </>
            )}
          </button>
        </div>

        {/* Sub-Tabs: 기록 목록 vs 관측 완료 천체 */}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setSubTab('logs')}
            className={`py-1 px-1.5 border text-[10px] tracking-[-0.05em] font-semibold transition-colors ${
              subTab === 'logs' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            관측 기록 ({store.logs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('observed')}
            className={`py-1 px-1.5 border text-[10px] tracking-[-0.05em] font-semibold transition-colors ${
              subTab === 'observed' ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '4px' }}
          >
            관측 완료 ({observedObjects.length})
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`px-2 py-1.5 border text-[10px] tracking-[-0.03em] leading-snug flex items-start justify-between gap-1 ${ui.border} ${ui.accentText}`}
          style={{ borderRadius: '4px' }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Create / Edit Observation Log Form */}
      {draft && (
        <form
          onSubmit={handleSubmitDraft}
          className={`border p-2 space-y-2 ${ui.panelMuted} ${ui.border}`}
          style={{ borderRadius: '6px' }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className={`font-semibold text-[11px] tracking-[-0.04em] ${ui.textPrimary}`}>
              {draft.id ? '관측기록 수정' : '새 관측기록 작성'}
            </span>
            {selected && (
              <button
                type="button"
                onClick={handleApplySelectedToDraft}
                className={`text-[9.5px] underline underline-offset-2 tracking-[-0.04em] ${ui.accentText} hover:opacity-80`}
              >
                선택 천체 불러오기
              </button>
            )}
          </div>

          {/* Target Name */}
          <div className="space-y-0.5">
            <label className={`block text-[9.5px] font-medium ${ui.textMuted}`}>
              관측 대상
            </label>
            <input
              type="text"
              value={draft.objectName}
              onChange={(e) => setDraft({ ...draft, objectName: e.target.value })}
              placeholder="예: M42 오리온 대성운, 토성, 페르세우스 유성우"
              className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
          </div>

          {/* Date & Time */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-1">
              <label className={`text-[9.5px] font-medium ${ui.textMuted}`}>관측 일시</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, observedAtLocal: toDateTimeLocalValue(obsTimeMs) })
                  }
                  className={`text-[9px] underline underline-offset-2 ${ui.textMuted} hover:opacity-80`}
                >
                  성도 시각
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, observedAtLocal: toDateTimeLocalValue(Date.now()) })
                  }
                  className={`text-[9px] underline underline-offset-2 ${ui.accentText} hover:opacity-80`}
                >
                  현재 시각
                </button>
              </div>
            </div>
            <input
              type="datetime-local"
              value={draft.observedAtLocal}
              onChange={(e) => setDraft({ ...draft, observedAtLocal: e.target.value })}
              className={`w-full px-2 py-1 border text-[10px] font-mono ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
          </div>

          {/* Location */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <label className={`text-[9.5px] font-medium ${ui.textMuted}`}>관측 장소</label>
              {quickSiteNames.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setDraft({ ...draft, location: e.target.value });
                  }}
                  aria-label="저장된 관측지 선택"
                  className={`max-w-[130px] px-1 py-0.5 border text-[9px] ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                >
                  <option value="">관측지 선택…</option>
                  {quickSiteNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              type="text"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="예: 강원 화천 조경철천문대 (Bortle 4)"
              className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
          </div>

          {/* Equipment */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <label className={`text-[9.5px] font-medium ${ui.textMuted}`}>사용 장비</label>
              {activeEquipSummary && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, equipment: activeEquipSummary })}
                  className={`text-[9px] underline underline-offset-2 ${ui.accentText} hover:opacity-80`}
                >
                  현재 활성 장비 적용
                </button>
              )}
            </div>
            <input
              type="text"
              value={draft.equipment}
              onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
              placeholder="예: 150mm 뉴턴 + 25mm 아이피스 + UHC 필터"
              className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
            {equipmentLocker.items.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {equipmentLocker.items.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => appendEquipmentPiece(item.name)}
                    className={`px-1.5 py-0.5 border text-[9px] truncate max-w-[125px] transition-colors ${ui.buttonIdle}`}
                    style={{ borderRadius: '3px' }}
                    title={`장비란에 ‘${item.name}’ 추가`}
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Seeing & Transparency */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-0.5">
              <label className={`block text-[9.5px] font-medium ${ui.textMuted}`}>시상</label>
              <select
                value={draft.seeing}
                onChange={(e) =>
                  setDraft({ ...draft, seeing: e.target.value as ObservationSeeingGrade })
                }
                className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              >
                {SEEING_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-0.5">
              <label className={`block text-[9.5px] font-medium ${ui.textMuted}`}>투명도</label>
              <select
                value={draft.transparency}
                onChange={(e) =>
                  setDraft({ ...draft, transparency: e.target.value as ObservationSeeingGrade })
                }
                className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              >
                {SEEING_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[9.5px] font-medium ${ui.textMuted}`}>관측 만족도</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDraft({ ...draft, rating: draft.rating === n ? 0 : n })}
                  title={`${n}점`}
                  className="p-0.5 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      n <= draft.rating
                        ? theme === 'red'
                          ? 'fill-red-500 text-red-500'
                          : 'fill-amber-400 text-amber-400'
                        : ui.textMuted
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-0.5">
            <label className={`block text-[9.5px] font-medium ${ui.textMuted}`}>관측 내용</label>
            <textarea
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="보인 세부 구조, 비껴보기 효과, 필터 비교, 촬영 노출 설정 등을 기록하세요..."
              className={`w-full p-1.5 border text-[10.5px] leading-snug resize-y ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className={`px-2 py-1 border text-[10px] font-medium ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              취소
            </button>
            <button
              type="submit"
              className={`px-2.5 py-1 border text-[10px] font-semibold ${ui.buttonActive}`}
              style={{ borderRadius: '4px' }}
            >
              {draft.id ? '수정 저장' : '기록 저장'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Bar */}
      <div className="space-y-1.5">
        <div className="relative">
          <Search
            className={`w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${ui.textMuted}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="대상, 장소, 장비, 관측내용 검색..."
            className={`w-full pl-6 pr-6 py-1 border text-[10.5px] ${ui.input}`}
            style={{ borderRadius: '4px' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="검색어 지우기"
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${ui.textMuted} hover:opacity-100`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {subTab === 'logs' && store.logs.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'custom' | 'newest' | 'oldest' | 'rating' | 'name')
              }
              aria-label="관측기록 정렬"
              className={`flex-1 min-w-0 px-1.5 py-1 border text-[10px] ${ui.input}`}
              style={{ borderRadius: '4px' }}
            >
              <option value="custom">사용자 지정순</option>
              <option value="newest">최신 관측순</option>
              <option value="oldest">오래된순</option>
              <option value="rating">만족도순</option>
              <option value="name">대상명순</option>
            </select>
            {uniqueLocations.length > 1 && (
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                aria-label="장소 필터"
                className={`flex-1 min-w-0 px-1.5 py-1 border text-[10px] truncate ${ui.input}`}
                style={{ borderRadius: '4px' }}
              >
                <option value="__all__">모든 장소 ({uniqueLocations.length})</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Main List Body */}
      {subTab === 'logs' ? (
        filteredLogs.length === 0 ? (
          <div
            className={`border border-dashed p-5 text-center space-y-2 ${ui.border} ${ui.textMuted}`}
            style={{ borderRadius: '6px' }}
          >
            <BookOpen className="w-5 h-5 mx-auto opacity-50" />
            <div className={`font-medium ${ui.textSecondary}`}>
              {store.logs.length === 0
                ? '저장된 관측기록이 없습니다'
                : '검색 조건에 맞는 기록이 없습니다'}
            </div>
            <p className="text-[10px] leading-relaxed break-keep">
              천체정보에서 바로 기록을 추가하거나 상단의 ‘새 기록’ 버튼으로 일시·장비·장소·관측 내용을 남겨보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, logIdx) => {
              const seeingTxt = getSeeingLabel(log.seeing);
              const transpTxt = getSeeingLabel(log.transparency);
              const hasCoord =
                Number.isFinite(log.raDeg) &&
                Number.isFinite(log.decDeg) &&
                (log.raDeg !== 0 || log.decDeg !== 0 || !log.objectId.startsWith('custom_'));
              return (
                <div
                  key={log.id}
                  draggable={filteredLogs.length > 1}
                  onDragStart={(e) => {
                    setDragLogId(log.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', log.id);
                  }}
                  onDragOver={(e) => {
                    if (!dragLogId || dragLogId === log.id) return;
                    e.preventDefault();
                    setDragOverLogId(log.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverLogId === log.id) setDragOverLogId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragLogId && dragLogId !== log.id) {
                      handleReorderFilteredLogs(dragLogId, log.id);
                    }
                    setDragLogId(null);
                    setDragOverLogId(null);
                  }}
                  onDragEnd={() => {
                    setDragLogId(null);
                    setDragOverLogId(null);
                  }}
                  className={`border p-2 space-y-1.5 transition-colors ${ui.border} ${
                    dragOverLogId === log.id ? 'ring-1 ring-cyan-400' : ''
                  }`}
                  style={{ borderRadius: '6px' }}
                >
                  {/* Header: Reorder + Target Name & Rating */}
                  <div className="flex items-start justify-between gap-1">
                    {filteredLogs.length > 1 && (
                      <div className="flex flex-col shrink-0 -ml-0.5">
                        <button
                          type="button"
                          disabled={logIdx === 0}
                          onClick={() =>
                            handleReorderFilteredLogs(log.id, filteredLogs[logIdx - 1].id)
                          }
                          title="위로 이동"
                          aria-label={`${log.objectName} 기록 위로 이동`}
                          className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          disabled={logIdx === filteredLogs.length - 1}
                          onClick={() =>
                            handleReorderFilteredLogs(log.id, filteredLogs[logIdx + 1].id)
                          }
                          title="아래로 이동"
                          aria-label={`${log.objectName} 기록 아래로 이동`}
                          className={`p-0 leading-none disabled:opacity-25 ${ui.textMuted} hover:opacity-100`}
                        >
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!hasCoord}
                      onClick={() =>
                        hasCoord &&
                        onFocusTarget({
                          objectId: log.objectId,
                          objectKind: log.objectKind,
                          raDeg: log.raDeg,
                          decDeg: log.decDeg,
                        })
                      }
                      className={`text-left min-w-0 flex-1 ${
                        hasCoord ? 'hover:underline cursor-pointer' : 'cursor-default'
                      }`}
                      title={log.objectName}
                    >
                      <div className={`font-semibold text-[11.5px] leading-tight break-keep ${ui.textPrimary}`}>
                        {log.objectName}
                        {log.constellation && (
                          <span className={`ml-1 font-mono text-[9.5px] font-normal ${ui.textMuted}`}>
                            {log.constellation}
                          </span>
                        )}
                      </div>
                    </button>
                    {log.rating && log.rating > 0 ? (
                      <span
                        className={`text-[9.5px] font-mono shrink-0 ${
                          theme === 'red' ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {'★'.repeat(log.rating)}
                      </span>
                    ) : null}
                  </div>

                  {/* Metadata Rows: DateTime / Seeing / Location / Equipment */}
                  <div className={`space-y-0.5 text-[10px] ${ui.textSecondary}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Calendar className={`w-3 h-3 shrink-0 ${ui.textMuted}`} />
                        <span>{formatObservationDateTime(log.observedAt)}</span>
                      </span>
                      {(seeingTxt || transpTxt) && (
                        <span className={`text-[9px] font-mono shrink-0 ${ui.accentText}`}>
                          {seeingTxt ? `시상 ${seeingTxt}` : ''}
                          {seeingTxt && transpTxt ? ' · ' : ''}
                          {transpTxt ? `투명 ${transpTxt}` : ''}
                        </span>
                      )}
                    </div>

                    {log.location && (
                      <div className="flex items-center gap-1 min-w-0">
                        <MapPin className={`w-3 h-3 shrink-0 ${ui.textMuted}`} />
                        <span className="truncate">{log.location}</span>
                      </div>
                    )}

                    {log.equipment && (
                      <div className="flex items-center gap-1 min-w-0">
                        <Wrench className={`w-3 h-3 shrink-0 ${ui.textMuted}`} />
                        <span className="truncate">{log.equipment}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {log.notes && (
                    <p
                      className={`text-[10.5px] leading-relaxed whitespace-pre-wrap break-keep pt-1 border-t ${ui.divider} ${ui.textPrimary}`}
                    >
                      {log.notes}
                    </p>
                  )}

                  {/* Card Footer Actions */}
                  <div className={`flex items-center justify-end gap-1 pt-1 border-t ${ui.divider}`}>
                    {hasCoord && (
                      <button
                        type="button"
                        onClick={() =>
                          onFocusTarget({
                            objectId: log.objectId,
                            objectKind: log.objectKind,
                            raDeg: log.raDeg,
                            decDeg: log.decDeg,
                          })
                        }
                        className={`px-1.5 py-0.5 border text-[9.5px] flex items-center gap-0.5 ${ui.buttonIdle}`}
                        style={{ borderRadius: '4px' }}
                      >
                        <Compass className="w-2.5 h-2.5" />
                        <span>이동</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditDraft(log)}
                      className={`px-1.5 py-0.5 border text-[9.5px] flex items-center gap-0.5 ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>수정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLog(log.id)}
                      className={`px-1.5 py-0.5 border text-[9.5px] flex items-center gap-0.5 ${ui.buttonIdle} hover:text-rose-400`}
                      style={{ borderRadius: '4px' }}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>삭제</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredObservedObjects.length === 0 ? (
        <div
          className={`border border-dashed p-5 text-center space-y-1.5 ${ui.border} ${ui.textMuted}`}
          style={{ borderRadius: '6px' }}
        >
          <CheckCircle2 className="w-5 h-5 mx-auto opacity-50" />
          <div className={`font-medium ${ui.textSecondary}`}>관측 완료된 천체가 없습니다</div>
          <p className="text-[10px] leading-relaxed break-keep">
            천체정보에서 관측 여부를 체크하거나 관측기록을 남기면 이곳에 모아 표시됩니다.
          </p>
        </div>
      ) : (
        <div className={`border divide-y ${ui.border} ${ui.divider}`} style={{ borderRadius: '6px' }}>
          {filteredObservedObjects.map((obj) => {
            const count = logCountByObjectId.get(obj.objectId) ?? 0;
            return (
              <div key={obj.objectId} className="p-2 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onFocusTarget({
                      objectId: obj.objectId,
                      objectKind: obj.objectKind,
                      raDeg: obj.raDeg,
                      decDeg: obj.decDeg,
                    })
                  }
                  className="min-w-0 flex-1 text-left hover:underline"
                  title={obj.objectName}
                >
                  <div className={`font-medium text-[11px] truncate ${ui.textPrimary}`}>
                    {obj.objectName}
                  </div>
                  <div className={`text-[9.5px] font-mono ${ui.textMuted}`}>
                    {obj.constellation ? `${obj.constellation} · ` : ''}
                    기록 {count}건 · {formatObservationDateTime(obj.updatedAt).slice(0, 10)}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openNewDraft(obj)}
                    title="이 천체의 관측기록 작성"
                    className={`px-1.5 py-0.5 border text-[9.5px] ${ui.buttonIdle}`}
                    style={{ borderRadius: '4px' }}
                  >
                    + 기록
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: '관측 완료 해제 확인',
                        message: `‘${obj.objectName}’의 관측 완료 표시를 해제하시겠습니까?`,
                        confirmLabel: '해제',
                      });
                      if (ok) onToggleObservedStatus(obj, false);
                    }}
                    title="관측 완료 해제"
                    className={`p-1 border text-[9.5px] ${ui.buttonIdle} hover:text-rose-400`}
                    style={{ borderRadius: '4px' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Backup & Export Footer */}
      <div className={`pt-2 border-t ${ui.divider} grid grid-cols-3 gap-1`}>
        <button
          type="button"
          onClick={() => downloadObservationLogsJson(store)}
          disabled={store.logs.length === 0 && observedObjects.length === 0}
          className={`py-1 px-1 border text-[9.5px] font-medium flex items-center justify-center gap-0.5 whitespace-nowrap disabled:opacity-40 ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
          title="관측기록 및 관측여부를 JSON 파일로 백업"
        >
          <Download className="w-3 h-3 shrink-0" />
          <span>JSON 백업</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`py-1 px-1 border text-[9.5px] font-medium flex items-center justify-center gap-0.5 whitespace-nowrap ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
          title="백업한 JSON 파일에서 관측기록 불러오기"
        >
          <Upload className="w-3 h-3 shrink-0" />
          <span>가져오기</span>
        </button>
        <button
          type="button"
          onClick={() => downloadObservationLogsCsv(store.logs)}
          disabled={store.logs.length === 0}
          className={`py-1 px-1 border text-[9.5px] font-medium flex items-center justify-center gap-0.5 whitespace-nowrap disabled:opacity-40 ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
          title="관측기록을 엑셀용 CSV로 저장"
        >
          <FileSpreadsheet className="w-3 h-3 shrink-0" />
          <span>CSV 저장</span>
        </button>
      </div>
    </div>
  );
}
