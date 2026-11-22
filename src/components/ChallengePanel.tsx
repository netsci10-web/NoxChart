import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Crosshair,
  Download,
  Edit3,
  Eye,
  EyeOff,
  MapPin,
  Maximize2,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { CALDWELL_CATALOG } from '../data/caldwell';
import { createDefaultChallengeTracks } from '../data/challenges';
import { CatalogSnapshot, ensureDeepDsos } from '../data/catalogLoader';
import {
  ChallengeCheckpoint,
  ChallengeTrack,
  ObserverConfig,
  ThemeMode,
} from '../types/astronomy';
import {
  equatorialToHorizontal,
  formatDec,
  formatRA,
  getCompassDirection,
  getLSTDeg,
} from '../utils/astronomy';
import {
  downloadChallengesFile,
  evaluateTrackBadges,
  parseChallengesFromJson,
} from '../utils/challengeStorage';
import { getUiTheme } from '../utils/themeClasses';

interface ChallengePanelProps {
  tracks: ChallengeTrack[];
  theme: ThemeMode;
  observer: ObserverConfig;
  catalogs: CatalogSnapshot;
  challengeOpacity: number;
  onChangeChallengeOpacity: (opacity: number) => void;
  challengeLineWidth: number;
  onChangeChallengeLineWidth: (lineWidth: number) => void;
  draft: ChallengeTrack | null;
  isCreatingDraft: boolean;
  pickAllowEmpty: boolean;
  draftNotice: string | null;
  onStartCreateDraft: () => void;
  onStartEditDraft: (track: ChallengeTrack) => void;
  onChangeDraft: React.Dispatch<React.SetStateAction<ChallengeTrack | null>>;
  onCancelDraft: () => void;
  onChangePickAllowEmpty: (allow: boolean) => void;
  onClearDraftNotice: () => void;
  onAddCenterCheckpoint: () => void;
  onToggleTrackOnChart: (trackId: string) => void;
  onToggleCheckpoint: (trackId: string, checkpointId: string) => void;
  onUpdateCheckpointNote: (trackId: string, checkpointId: string, note: string) => void;
  onSelectCheckpoint: (track: ChallengeTrack, checkpoint: ChallengeCheckpoint) => void;
  onFrameTrack: (track: ChallengeTrack) => void;
  onPrintCertificate: (track: ChallengeTrack) => void;
  onSaveTrack: (track: ChallengeTrack) => void;
  onDeleteTrack: (trackId: string) => void;
  onResetBuiltInTrack: (trackId: string) => void;
  onImportTracks: (tracks: ChallengeTrack[]) => { addedCount: number; updatedCount: number };
}

const SEASON_LABELS: Record<NonNullable<ChallengeTrack['season']>, string> = {
  spring: '봄철',
  summer: '여름철',
  autumn: '가을철',
  winter: '겨울철',
  all: '사계절',
};

const LINE_COLOR_SWATCHES = [
  '#38BDF8',
  '#60A5FA',
  '#34D399',
  '#A78BFA',
  '#FB7185',
  '#F97316',
];

interface CatalogSearchHit {
  id: string;
  name: string;
  kind: ChallengeCheckpoint['kind'];
  constellation?: string;
  objectType?: string;
  mag?: number;
  ra: number;
  dec: number;
}

export function ChallengePanel({
  tracks,
  theme,
  observer,
  catalogs,
  challengeOpacity,
  onChangeChallengeOpacity,
  challengeLineWidth,
  onChangeChallengeLineWidth,
  draft,
  isCreatingDraft,
  pickAllowEmpty,
  draftNotice,
  onStartCreateDraft,
  onStartEditDraft,
  onChangeDraft,
  onCancelDraft,
  onChangePickAllowEmpty,
  onClearDraftNotice,
  onAddCenterCheckpoint,
  onToggleTrackOnChart,
  onToggleCheckpoint,
  onUpdateCheckpointNote,
  onSelectCheckpoint,
  onFrameTrack,
  onPrintCertificate,
  onSaveTrack,
  onDeleteTrack,
  onResetBuiltInTrack,
  onImportTracks,
}: ChallengePanelProps) {
  const ui = getUiTheme(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'list' | 'detail'>('list');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'done'>('all');
  const [expandedCpId, setExpandedCpId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChallengeTrack | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget]);

  // Edit / Create Form Local Fields
  const [catalogQuery, setCatalogQuery] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualStage, setManualStage] = useState('1구간 · 기본 코스');
  const [manualRa, setManualRa] = useState('');
  const [manualDec, setManualDec] = useState('');
  const [manualGuide, setManualGuide] = useState('');

  const obsTimeMs = observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);

  const belowHorizonTextCls =
    theme === 'white'
      ? 'text-slate-400'
      : theme === 'red'
      ? 'text-[#732626]'
      : 'text-slate-500';

  const belowHorizonSubCls =
    theme === 'white'
      ? 'text-slate-300'
      : theme === 'red'
      ? 'text-[#551B1B]'
      : 'text-slate-600';

  const resolveCheckpointCoords = (
    cp: ChallengeCheckpoint
  ): { ra: number; dec: number } | null => {
    if (cp.ra !== undefined && cp.dec !== undefined) {
      return { ra: cp.ra, dec: cp.dec };
    }
    const key = cp.catalogId ? cp.catalogId.replace(/\s+/g, '').toUpperCase() : '';
    if (!key) return null;
    if (cp.kind === 'dso') {
      const pools = [
        catalogs.dsosBright,
        CALDWELL_CATALOG,
        catalogs.dsosDeep,
        catalogs.darkNebulae,
      ];
      for (const pool of pools) {
        const hit = pool.find(
          (d) =>
            d.id.replace(/\s+/g, '').toUpperCase() === key ||
            (d.altId && d.altId.replace(/\s+/g, '').toUpperCase() === key)
        );
        if (hit) return { ra: hit.ra, dec: hit.dec };
      }
    } else if (cp.kind === 'star') {
      const hit = catalogs.brightStars.find(
        (s) =>
          s.id.replace(/\s+/g, '').toUpperCase() === key ||
          (s.hip && `HIP${s.hip}` === key) ||
          (s.name && s.name.replace(/\s+/g, '').toUpperCase() === key)
      );
      if (hit) return { ra: hit.ra, dec: hit.dec };
    } else if (cp.kind === 'double') {
      const hit = catalogs.doubleStars.find(
        (d) => d.id.replace(/\s+/g, '').toUpperCase() === key
      );
      if (hit) return { ra: hit.ra, dec: hit.dec };
    }
    return null;
  };

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? null,
    [tracks, selectedTrackId]
  );

  const missingBuiltInTracks = useMemo(() => {
    const existingIds = new Set(tracks.map((t) => t.id));
    return createDefaultChallengeTracks().filter((d) => !existingIds.has(d.id));
  }, [tracks]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const deletedTitle = deleteTarget.title;
    const deletedId = deleteTarget.id;
    onDeleteTrack(deletedId);
    if (selectedTrackId === deletedId) {
      setSelectedTrackId(null);
      setMode('list');
    }
    if (draft?.id === deletedId) {
      onCancelDraft();
      setMode('list');
    }
    setDeleteTarget(null);
    setNotice(`'${deletedTitle}' 챌린지를 삭제했습니다.`);
  };

  // Live catalog search for Edit / Create checkpoint picker
  const catalogHits = useMemo<CatalogSearchHit[]>(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    const results: CatalogSearchHit[] = [];
    const seen = new Set<string>();

    const allDsos = [
      ...catalogs.dsosBright,
      ...CALDWELL_CATALOG,
      ...catalogs.dsosDeep,
      ...catalogs.darkNebulae,
    ];
    for (const d of allDsos) {
      if (results.length >= 10) break;
      const key = d.id.toUpperCase();
      if (seen.has(key)) continue;
      if (
        d.id.toLowerCase().includes(q) ||
        (d.altId && d.altId.toLowerCase().includes(q)) ||
        (d.koName && d.koName.toLowerCase().includes(q)) ||
        (d.name && d.name.toLowerCase().includes(q))
      ) {
        seen.add(key);
        results.push({
          id: d.id,
          name: d.koName ? `${d.id} ${d.koName}` : d.name ? `${d.id} (${d.name})` : d.id,
          kind: 'dso',
          constellation: d.con,
          objectType: d.type,
          mag: d.mag,
          ra: d.ra,
          dec: d.dec,
        });
      }
    }

    for (const s of catalogs.brightStars) {
      if (results.length >= 14) break;
      const key = `STAR:${s.id.toUpperCase()}`;
      if (seen.has(key)) continue;
      if (
        (s.koName && s.koName.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.bayer && s.bayer.toLowerCase().includes(q)) ||
        s.id.toLowerCase().includes(q)
      ) {
        seen.add(key);
        results.push({
          id: s.hip ? `HIP ${s.hip}` : s.id,
          name: s.koName
            ? `${s.koName} (${s.name || s.bayer || s.id})`
            : s.name || s.bayer || s.id,
          kind: 'star',
          constellation: s.con,
          objectType: '항성',
          mag: s.mag,
          ra: s.ra,
          dec: s.dec,
        });
      }
    }

    for (const dbl of catalogs.doubleStars) {
      if (results.length >= 16) break;
      if (
        (dbl.koName && dbl.koName.toLowerCase().includes(q)) ||
        (dbl.name && dbl.name.toLowerCase().includes(q)) ||
        dbl.disc.toLowerCase().includes(q)
      ) {
        results.push({
          id: dbl.id,
          name: dbl.koName || dbl.name || dbl.disc,
          kind: 'double',
          constellation: dbl.con,
          objectType: dbl.isMultiple ? '다중성' : '이중성',
          mag: dbl.mag,
          ra: dbl.ra,
          dec: dbl.dec,
        });
      }
    }

    return results.slice(0, 8);
  }, [catalogQuery, catalogs]);

  const startCreateTrack = () => {
    setCatalogQuery('');
    setShowManualAdd(false);
    setNotice(null);
    onClearDraftNotice();
    onStartCreateDraft();
  };

  const startEditTrack = (track: ChallengeTrack) => {
    setCatalogQuery('');
    setShowManualAdd(false);
    setNotice(null);
    onClearDraftNotice();
    onStartEditDraft(track);
  };

  const addCatalogHitToDraft = (hit: CatalogSearchHit) => {
    onChangeDraft((prev) => {
      if (!prev) return prev;
      const idx = prev.checkpoints.length + 1;
      const lastStage =
        prev.checkpoints[prev.checkpoints.length - 1]?.stage || '1구간 · 기본 코스';
      const newCp: ChallengeCheckpoint = {
        id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: `CP ${String(idx).padStart(2, '0')}`,
        name: hit.name,
        catalogId: hit.id,
        kind: hit.kind,
        stage: lastStage,
        constellation: hit.constellation,
        objectType: hit.objectType,
        mag: hit.mag,
        ra: hit.ra,
        dec: hit.dec,
        observed: false,
      };
      return {
        ...prev,
        checkpoints: [...prev.checkpoints, newCp],
      };
    });
    setCatalogQuery('');
  };

  const addManualCheckpointToDraft = () => {
    const raVal = parseFloat(manualRa);
    const decVal = parseFloat(manualDec);
    if (!manualName.trim() || !Number.isFinite(raVal) || !Number.isFinite(decVal)) {
      setNotice('천체 이름과 유효한 적경(0~360°), 적위(-90~90°)를 입력해 주세요.');
      return;
    }
    onChangeDraft((prev) => {
      if (!prev) return prev;
      const idx = prev.checkpoints.length + 1;
      const newCp: ChallengeCheckpoint = {
        id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: `CP ${String(idx).padStart(2, '0')}`,
        name: manualName.trim(),
        kind: 'dso',
        stage: manualStage.trim() || '1구간 · 기본 코스',
        ra: ((raVal % 360) + 360) % 360,
        dec: Math.max(-90, Math.min(90, decVal)),
        guideNote: manualGuide.trim() || undefined,
        observed: false,
      };
      return {
        ...prev,
        checkpoints: [...prev.checkpoints, newCp],
      };
    });
    setManualName('');
    setManualRa('');
    setManualDec('');
    setManualGuide('');
    setShowManualAdd(false);
    setNotice(null);
  };

  const moveDraftCheckpoint = (index: number, delta: -1 | 1) => {
    onChangeDraft((prev) => {
      if (!prev) return prev;
      const targetIdx = index + delta;
      if (targetIdx < 0 || targetIdx >= prev.checkpoints.length) return prev;
      const next = [...prev.checkpoints];
      const [moved] = next.splice(index, 1);
      next.splice(targetIdx, 0, moved);
      return { ...prev, checkpoints: next };
    });
  };

  const removeDraftCheckpoint = (cpId: string) => {
    onChangeDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checkpoints: prev.checkpoints.filter((c) => c.id !== cpId),
      };
    });
  };

  const updateDraftCheckpointField = (
    cpId: string,
    field: 'code' | 'name' | 'stage' | 'guideNote',
    value: string
  ) => {
    onChangeDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checkpoints: prev.checkpoints.map((c) =>
          c.id === cpId ? { ...c, [field]: value } : c
        ),
      };
    });
  };

  const handleCommitDraft = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setNotice('챌린지 제목을 입력해 주세요.');
      return;
    }
    if (draft.checkpoints.length === 0) {
      setNotice('최소 1개 이상의 체크포인트를 추가해 주세요.');
      return;
    }
    const cleanTrack: ChallengeTrack = {
      ...draft,
      title: draft.title.trim(),
      subtitle: draft.subtitle?.trim() || undefined,
      description: draft.description.trim(),
      checkpoints: draft.checkpoints.map((c, idx) => ({
        ...c,
        code: c.code.trim() || `CP ${String(idx + 1).padStart(2, '0')}`,
        name: c.name.trim() || c.catalogId || `대상 ${idx + 1}`,
        stage: c.stage.trim() || '1구간 · 기본 코스',
        guideNote: c.guideNote?.trim() || undefined,
      })),
    };
    const wasCreating = isCreatingDraft;
    onSaveTrack(cleanTrack);
    onCancelDraft();
    setSelectedTrackId(cleanTrack.id);
    setMode('detail');
    setNotice(wasCreating ? '새 챌린지 트랙을 생성했습니다.' : '챌린지 트랙을 저장했습니다.');
  };

  const goldTextClass =
    theme === 'white'
      ? 'text-amber-700'
      : theme === 'red'
      ? 'text-[#FF5252]'
      : 'text-amber-400';

  const goldBgClass =
    theme === 'white'
      ? 'bg-amber-50 border-amber-300 text-amber-800'
      : theme === 'red'
      ? 'bg-[#2A0505] border-[#7F1D1D] text-[#FCA5A5]'
      : 'bg-amber-500/15 border-amber-400/50 text-amber-300';

  const progressFillColor =
    theme === 'white' ? '#D97706' : theme === 'red' ? '#EF4444' : '#FBBF24';

  const renderChallengeSettings = () => (
    <div
      className={`border px-2 py-1.5 space-y-2 ${ui.border}`}
      style={{ borderRadius: '6px' }}
    >
      <button
        type="button"
        onClick={() => setSettingsOpen((o) => !o)}
        aria-expanded={settingsOpen}
        className="w-full flex items-center justify-between gap-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
      >
        <span className={`flex items-center gap-1 text-[10.5px] font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${ui.textMuted} ${
              settingsOpen ? '' : '-rotate-90'
            }`}
          />
          <SlidersHorizontal className="w-3 h-3 shrink-0" />
          <span>챌린지 설정</span>
        </span>
        <span className={`font-mono text-[9.5px] tabular-nums whitespace-nowrap ${ui.textMuted}`}>
          {challengeLineWidth.toFixed(1)}px · {Math.round(challengeOpacity * 100)}%
        </span>
      </button>

      {settingsOpen && (
        <div className={`pt-1.5 border-t space-y-2 ${ui.divider}`}>
          {/* 1. 챌린지 선 굵기 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <span className={`font-medium whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                챌린지 선 굵기
              </span>
              <span className={`font-mono tabular-nums font-semibold ${ui.textPrimary}`}>
                {challengeLineWidth.toFixed(1)}px
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={3.0}
              step={0.1}
              value={challengeLineWidth}
              onChange={(e) => onChangeChallengeLineWidth(Number(e.target.value))}
              aria-label="챌린지 노선 선 굵기"
              className={`w-full h-1.5 cursor-pointer ${
                theme === 'red' ? 'accent-red-600' : 'accent-amber-500'
              }`}
            />
          </div>

          {/* 2. 챌린지 투명도 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <span className={`font-medium whitespace-nowrap tracking-[-0.05em] ${ui.textSecondary}`}>
                챌린지 투명도
              </span>
              <span className={`font-mono tabular-nums font-semibold ${ui.textPrimary}`}>
                {Math.round(challengeOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={challengeOpacity}
              onChange={(e) => onChangeChallengeOpacity(Number(e.target.value))}
              aria-label="챌린지 성도 표시 투명도"
              className={`w-full h-1.5 cursor-pointer ${
                theme === 'red' ? 'accent-red-600' : 'accent-amber-500'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );

  // =================== EDIT / CREATE VIEW ===================
  if (draft) {
    const activeNotice = draftNotice || notice;
    return (
      <div className="space-y-2.5">
        {renderChallengeSettings()}
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => {
              onCancelDraft();
              setMode(selectedTrack ? 'detail' : 'list');
              setNotice(null);
              onClearDraftNotice();
            }}
            className={`px-1.5 py-1 border text-[10px] tracking-[-0.05em] font-medium flex items-center gap-1 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <ArrowLeft className="w-3 h-3" />
            <span>취소</span>
          </button>
          <span className={`font-semibold text-[11px] tracking-[-0.05em] ${ui.textPrimary}`}>
            {isCreatingDraft ? '새 챌린지 생성' : '챌린지 편집'}
          </span>
          <button
            type="button"
            onClick={handleCommitDraft}
            className={`px-2 py-1 border text-[10px] tracking-[-0.05em] font-semibold flex items-center gap-1 ${ui.buttonActive}`}
            style={{ borderRadius: '4px' }}
          >
            <Save className="w-3 h-3" />
            <span>저장</span>
          </button>
        </div>

        {/* Interactive Star-Chart Picking Guide Banner */}
        <div
          className={`border p-2 space-y-1.5 ${goldBgClass}`}
          style={{ borderRadius: '6px' }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-[10.5px] tracking-[-0.04em] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>성도 직접 지정 활성화</span>
            </span>
            <span className="text-[9.5px] font-mono tabular-nums opacity-85">
              {draft.checkpoints.length}개 지정
            </span>
          </div>
          <p className="text-[9.5px] leading-snug tracking-[-0.03em] break-keep opacity-90">
            성도의 천체나 원하는 위치를 클릭하면 천체 정보로 이동하지 않고 체크포인트로 바로 추가되며, 루트가 성도에 실시간 표시됩니다.
          </p>
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => onChangePickAllowEmpty(true)}
              className={`py-1 px-1.5 border text-[9.5px] tracking-[-0.04em] font-medium transition-colors ${
                pickAllowEmpty ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              천체 + 빈 위치
            </button>
            <button
              type="button"
              onClick={() => onChangePickAllowEmpty(false)}
              className={`py-1 px-1.5 border text-[9.5px] tracking-[-0.04em] font-medium transition-colors ${
                !pickAllowEmpty ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              천체만 선택
            </button>
          </div>
          <button
            type="button"
            onClick={onAddCenterCheckpoint}
            className={`w-full py-1 px-2 border text-[9.5px] tracking-[-0.04em] font-medium flex items-center justify-center gap-1 transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Crosshair className="w-3 h-3 shrink-0" />
            <span>현재 성도 중심 위치 추가</span>
          </button>
        </div>

        {activeNotice && (
          <div
            className={`px-2 py-1.5 border text-[10px] tracking-[-0.04em] leading-snug break-keep flex items-start justify-between gap-1 ${ui.border} ${ui.accentText}`}
            style={{ borderRadius: '4px' }}
          >
            <span>{activeNotice}</span>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                onClearDraftNotice();
              }}
              className="shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Basic Metadata */}
        <div className={`border p-2 space-y-2 ${ui.border}`} style={{ borderRadius: '6px' }}>
          <div className="space-y-1">
            <label className={`block text-[10px] font-medium ${ui.textMuted}`}>트랙 제목 *</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => onChangeDraft((p) => (p ? { ...p, title: e.target.value } : p))}
              placeholder="예: 가을철 안드로메다 은하 투어"
              className={`w-full px-2 py-1 border text-[11px] ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
          </div>
          <div className="space-y-1">
            <label className={`block text-[10px] font-medium ${ui.textMuted}`}>부제 / 요약</label>
            <input
              type="text"
              value={draft.subtitle ?? ''}
              onChange={(e) => onChangeDraft((p) => (p ? { ...p, subtitle: e.target.value } : p))}
              placeholder="예: 1호선 메시에 성단 투어 · 5역"
              className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
          </div>
          <div className="space-y-1">
            <label className={`block text-[10px] font-medium ${ui.textMuted}`}>설명</label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => onChangeDraft((p) => (p ? { ...p, description: e.target.value } : p))}
              placeholder="코스 개요 및 관측 팁..."
              className={`w-full px-2 py-1 border text-[10.5px] resize-none ${ui.input}`}
              style={{ borderRadius: '4px' }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1 flex-1">
              <label className={`block text-[10px] font-medium ${ui.textMuted}`}>계절</label>
              <select
                value={draft.season ?? 'all'}
                onChange={(e) =>
                  onChangeDraft((p) =>
                    p ? { ...p, season: e.target.value as ChallengeTrack['season'] } : p
                  )
                }
                className={`w-full px-1.5 py-1 border text-[10.5px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              >
                <option value="all">사계절</option>
                <option value="spring">봄철</option>
                <option value="summer">여름철</option>
                <option value="autumn">가을철</option>
                <option value="winter">겨울철</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={`block text-[10px] font-medium ${ui.textMuted}`}>노선 색</label>
              <div className="flex items-center gap-1 pt-0.5">
                {LINE_COLOR_SWATCHES.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onChangeDraft((p) => (p ? { ...p, lineColor: col } : p))}
                    className={`w-4 h-4 rounded-full border transition-transform ${
                      draft.lineColor.toLowerCase() === col.toLowerCase()
                        ? 'scale-110 ring-2 ring-amber-400 border-white'
                        : 'border-white/30 opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col }}
                    aria-label={`노선 색상 ${col}`}
                  />
                ))}
                {(() => {
                  const isCustomSelected = !LINE_COLOR_SWATCHES.some(
                    (c) => c.toLowerCase() === (draft.lineColor || '').toLowerCase()
                  );
                  const pickerValue = /^#[0-9a-f]{6}$/i.test(draft.lineColor)
                    ? draft.lineColor
                    : '#FACC15';
                  return (
                    <label
                      title={`커스텀 노선 색 선택${isCustomSelected ? ` (${draft.lineColor})` : ''}`}
                      className={`relative w-4 h-4 rounded-full border cursor-pointer flex items-center justify-center transition-transform shrink-0 ${
                        isCustomSelected
                          ? 'scale-110 ring-2 ring-amber-400 border-white'
                          : 'border-white/50 opacity-85 hover:opacity-100'
                      }`}
                      style={
                        isCustomSelected
                          ? { backgroundColor: draft.lineColor }
                          : {
                              background:
                                'conic-gradient(from 0deg, #EF4444, #F59E0B, #10B981, #38BDF8, #A78BFA, #EC4899, #EF4444)',
                            }
                      }
                    >
                      {!isCustomSelected && (
                        <Plus className="w-2.5 h-2.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                      )}
                      <input
                        type="color"
                        value={pickerValue}
                        onChange={(e) => {
                          const nextColor = e.target.value;
                          onChangeDraft((p) => (p ? { ...p, lineColor: nextColor } : p));
                        }}
                        aria-label="커스텀 노선 색 선택"
                        className="sr-only"
                      />
                    </label>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Add Checkpoint via Catalog Search or Manual */}
        <div className={`border p-2 space-y-2 ${ui.border}`} style={{ borderRadius: '6px' }}>
          <div className="flex items-center justify-between gap-1">
            <span className={`font-semibold text-[10.5px] ${ui.textPrimary}`}>
              검색 · 좌표로 추가 ({draft.checkpoints.length})
            </span>
            <button
              type="button"
              onClick={() => setShowManualAdd((v) => !v)}
              className={`px-1.5 py-0.5 border text-[9.5px] font-medium ${
                showManualAdd ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              {showManualAdd ? '검색으로 추가' : '좌표 직접 입력'}
            </button>
          </div>

          {!showManualAdd ? (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className={`w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 ${ui.textMuted}`} />
                <input
                  type="text"
                  value={catalogQuery}
                  onFocus={() => {
                    void ensureDeepDsos();
                  }}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="M42, NGC 7000, 시리우스, 알비레오 검색..."
                  className={`w-full pl-6 pr-2 py-1 border text-[10.5px] ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
              </div>
              {catalogHits.length > 0 && (
                <div
                  className={`border divide-y max-h-36 overflow-y-auto astro-scroll ${ui.border} ${ui.divider}`}
                  style={{ borderRadius: '4px' }}
                >
                  {catalogHits.map((hit) => (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      onClick={() => addCatalogHitToDraft(hit)}
                      className={`w-full px-2 py-1 text-left flex items-center justify-between gap-1 hover:bg-white/5 transition-colors`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-medium truncate ${ui.textPrimary}`}>
                          {hit.name}
                        </div>
                        <div className={`text-[9.5px] font-mono ${ui.textMuted}`}>
                          {hit.constellation || ''} · {hit.objectType || hit.kind}
                          {hit.mag !== undefined ? ` · ${hit.mag.toFixed(1)}m` : ''}
                        </div>
                      </div>
                      <Plus className={`w-3.5 h-3.5 shrink-0 ${ui.accentText}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="천체 이름 (예: 말머리 성운 B33)"
                className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              />
              <input
                type="text"
                value={manualStage}
                onChange={(e) => setManualStage(e.target.value)}
                placeholder="구간명 (예: 1구간 · 오리온)"
                className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              />
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={manualRa}
                  onChange={(e) => setManualRa(e.target.value)}
                  placeholder="RA (0~360°)"
                  className={`w-full px-2 py-1 border text-[10.5px] font-mono ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
                <input
                  type="number"
                  step="0.01"
                  value={manualDec}
                  onChange={(e) => setManualDec(e.target.value)}
                  placeholder="Dec (-90~90°)"
                  className={`w-full px-2 py-1 border text-[10.5px] font-mono ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
              </div>
              <input
                type="text"
                value={manualGuide}
                onChange={(e) => setManualGuide(e.target.value)}
                placeholder="호핑 길잡이 메모 (선택)"
                className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              />
              <button
                type="button"
                onClick={addManualCheckpointToDraft}
                className={`w-full py-1 border text-[10.5px] font-medium flex items-center justify-center gap-1 ${ui.buttonActive}`}
                style={{ borderRadius: '4px' }}
              >
                <Plus className="w-3 h-3" />
                <span>체크포인트 추가</span>
              </button>
            </div>
          )}
        </div>

        {/* Editable Checkpoint List */}
        {draft.checkpoints.length > 0 && (
          <div className={`border divide-y ${ui.border} ${ui.divider}`} style={{ borderRadius: '6px' }}>
            {draft.checkpoints.map((cp, idx) => (
              <div key={cp.id} className="p-1.5 space-y-1">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={cp.code}
                    onChange={(e) => updateDraftCheckpointField(cp.id, 'code', e.target.value)}
                    className={`w-12 px-1 py-0.5 border text-[9.5px] font-mono ${ui.input}`}
                    style={{ borderRadius: '3px' }}
                  />
                  <input
                    type="text"
                    value={cp.name}
                    onChange={(e) => updateDraftCheckpointField(cp.id, 'name', e.target.value)}
                    className={`flex-1 min-w-0 px-1.5 py-0.5 border text-[10px] ${ui.input}`}
                    style={{ borderRadius: '3px' }}
                  />
                  <button
                    type="button"
                    onClick={() => moveDraftCheckpoint(idx, -1)}
                    disabled={idx === 0}
                    title="위로 이동"
                    className={`p-0.5 ${ui.textMuted} disabled:opacity-30`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraftCheckpoint(idx, 1)}
                    disabled={idx === draft.checkpoints.length - 1}
                    title="아래로 이동"
                    className={`p-0.5 ${ui.textMuted} disabled:opacity-30`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDraftCheckpoint(cp.id)}
                    title="체크포인트 삭제"
                    className={`p-0.5 ${ui.textMuted} hover:text-red-400`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {cp.ra !== undefined && cp.dec !== undefined && (
                  <div className={`text-[9px] font-mono tabular-nums px-0.5 ${ui.textMuted}`}>
                    {cp.catalogId ? `${cp.catalogId} · ` : '지정 좌표 · '}
                    RA {formatRA(cp.ra)} · Dec {formatDec(cp.dec)}
                  </div>
                )}
                <input
                  type="text"
                  value={cp.stage}
                  onChange={(e) => updateDraftCheckpointField(cp.id, 'stage', e.target.value)}
                  placeholder="구간명"
                  className={`w-full px-1.5 py-0.5 border text-[9.5px] ${ui.input}`}
                  style={{ borderRadius: '3px' }}
                />
                <input
                  type="text"
                  value={cp.guideNote ?? ''}
                  onChange={(e) => updateDraftCheckpointField(cp.id, 'guideNote', e.target.value)}
                  placeholder="호핑 길잡이 (선택)"
                  className={`w-full px-1.5 py-0.5 border text-[9.5px] ${ui.input}`}
                  style={{ borderRadius: '3px' }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Delete / Reset Built-In Footer */}
        {!isCreatingDraft && (
          <div className="pt-1 flex items-center gap-1">
            {draft.builtIn && (
              <button
                type="button"
                onClick={() => {
                  onResetBuiltInTrack(draft.id);
                  onCancelDraft();
                  setMode('detail');
                  setNotice('기본 챌린지 구성을 초기값으로 복원했습니다.');
                }}
                className={`flex-1 py-1.5 px-2 border text-[10px] font-medium flex items-center justify-center gap-1 ${ui.buttonIdle}`}
                style={{ borderRadius: '4px' }}
              >
                <RotateCcw className="w-3 h-3" />
                <span>초기화</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeleteTarget(draft)}
              className="flex-1 py-1.5 px-2 border border-red-500/45 text-red-400 hover:bg-red-500/15 text-[10px] font-medium flex items-center justify-center gap-1"
              style={{ borderRadius: '4px' }}
            >
              <Trash2 className="w-3 h-3" />
              <span>챌린지 삭제</span>
            </button>
          </div>
        )}
        {deleteTarget && renderDeleteConfirmModal()}
      </div>
    );
  }

  // =================== DETAIL VIEW ===================
  if (mode === 'detail' && selectedTrack) {
    const total = selectedTrack.checkpoints.length;
    const done = selectedTrack.checkpoints.filter((c) => c.observed).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isCompleted = total > 0 && done === total;
    const badgeStates = evaluateTrackBadges(selectedTrack);

    const filteredCheckpoints = selectedTrack.checkpoints.filter((c) => {
      if (filterStatus === 'todo') return !c.observed;
      if (filterStatus === 'done') return c.observed;
      return true;
    });

    // Group checkpoints by stage preserving original order
    const stageGroups: { stage: string; items: ChallengeCheckpoint[]; stageDone: number; stageTotal: number }[] = [];
    const stageIndex = new Map<string, number>();
    for (const cp of selectedTrack.checkpoints) {
      let idx = stageIndex.get(cp.stage);
      if (idx === undefined) {
        idx = stageGroups.length;
        stageIndex.set(cp.stage, idx);
        stageGroups.push({ stage: cp.stage, items: [], stageDone: 0, stageTotal: 0 });
      }
      stageGroups[idx].stageTotal++;
      if (cp.observed) stageGroups[idx].stageDone++;
    }
    for (const cp of filteredCheckpoints) {
      const idx = stageIndex.get(cp.stage);
      if (idx !== undefined) {
        stageGroups[idx].items.push(cp);
      }
    }

    return (
      <div className="space-y-2.5">
        {renderChallengeSettings()}
        {/* Top Action Bar */}
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`px-1.5 py-1 border text-[10px] tracking-[-0.05em] font-medium flex items-center gap-1 ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <ArrowLeft className="w-3 h-3" />
            <span>목록</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleTrackOnChart(selectedTrack.id)}
              title={selectedTrack.activeOnChart ? '성도 오버레이 끄기' : '성도에 코스 표시'}
              className={`px-1.5 py-1 border text-[10px] tracking-[-0.05em] font-medium flex items-center gap-1 ${
                selectedTrack.activeOnChart ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              {selectedTrack.activeOnChart ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              <span>{selectedTrack.activeOnChart ? '성도 ON' : '성도 OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => onFrameTrack(selectedTrack)}
              title="코스 전체가 보이도록 성도 맞추기"
              className={`p-1 border ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => startEditTrack(selectedTrack)}
              title="챌린지 편집"
              className={`p-1 border ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                downloadChallengesFile(
                  [selectedTrack],
                  `noxchart-challenge-${selectedTrack.id}.json`
                );
                setNotice(`'${selectedTrack.title}' JSON 파일로 저장했습니다.`);
              }}
              title="이 챌린지만 파일로 저장 (.json)"
              className={`p-1 border ${ui.buttonIdle}`}
              style={{ borderRadius: '4px' }}
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(selectedTrack)}
              title="이 챌린지 삭제"
              aria-label="챌린지 삭제"
              className={`p-1 border transition-colors ${
                theme === 'white'
                  ? 'border-red-300 text-red-600 hover:bg-red-50'
                  : 'border-red-500/40 text-red-400 hover:bg-red-500/15'
              }`}
              style={{ borderRadius: '4px' }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`px-2 py-1.5 border text-[10px] tracking-[-0.04em] leading-snug break-keep flex items-start justify-between gap-1 ${ui.border} ${ui.accentText}`}
            style={{ borderRadius: '4px' }}
          >
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Track Overview & Progress */}
        <div className={`border p-2 space-y-1.5 ${ui.border}`} style={{ borderRadius: '6px' }}>
          <div className="flex items-start gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
              style={{ backgroundColor: isCompleted ? progressFillColor : selectedTrack.lineColor }}
            />
            <div className="min-w-0 flex-1">
              <div className={`text-[12px] font-semibold leading-snug break-keep ${ui.textPrimary}`}>
                {selectedTrack.title}
              </div>
              {selectedTrack.subtitle && (
                <div className={`text-[9.5px] font-mono truncate ${ui.textMuted}`}>
                  {selectedTrack.subtitle}
                </div>
              )}
            </div>
          </div>
          {selectedTrack.description && (
            <p className={`text-[10px] leading-relaxed break-keep ${ui.textSecondary}`}>
              {selectedTrack.description}
            </p>
          )}
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
              <span className={isCompleted ? `font-semibold ${goldTextClass}` : ui.textMuted}>
                {isCompleted ? '★ 전 구간 황금 트랙 완주!' : '관측 진척도'}
              </span>
              <span className={isCompleted ? `font-bold ${goldTextClass}` : ui.textPrimary}>
                {done} / {total} ({pct}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: progressFillColor,
                }}
              />
            </div>
          </div>

          {isCompleted && (
            <button
              type="button"
              onClick={() => onPrintCertificate(selectedTrack)}
              className={`w-full mt-1 py-1.5 px-2 border text-[10.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${goldBgClass}`}
              style={{ borderRadius: '5px' }}
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>황금 트랙 완주 인증 성도 출력</span>
            </button>
          )}
        </div>

        {/* Badges Section */}
        {badgeStates.length > 0 && (
          <div className={`border p-2 space-y-1.5 ${ui.border}`} style={{ borderRadius: '6px' }}>
            <div className="flex items-center justify-between">
              <span className={`font-semibold text-[10.5px] flex items-center gap-1 ${ui.textPrimary}`}>
                <Trophy className={`w-3 h-3 ${goldTextClass}`} />
                <span>달성 뱃지</span>
              </span>
              <span className={`text-[9.5px] font-mono ${ui.textMuted}`}>
                {badgeStates.filter((b) => b.unlocked).length}/{badgeStates.length}
              </span>
            </div>
            <div className="space-y-1">
              {badgeStates.map(({ badge, unlocked, done: bDone, total: bTotal }) => (
                <div
                  key={badge.id}
                  className={`px-1.5 py-1 border flex items-start gap-1.5 ${
                    unlocked ? goldBgClass : `${ui.border} opacity-75`
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  <Award
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      unlocked ? goldTextClass : ui.textMuted
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold truncate">{badge.title}</span>
                      <span className="text-[9px] font-mono tabular-nums shrink-0">
                        {bDone}/{bTotal}
                      </span>
                    </div>
                    <div className="text-[9px] opacity-80 leading-snug break-keep">
                      {badge.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ['all', `전체 (${total})`],
              ['todo', `미관측 (${total - done})`],
              ['done', `완료 (${done})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterStatus(key)}
              className={`py-1 px-1 border text-[9.5px] tracking-[-0.05em] font-medium whitespace-nowrap ${
                filterStatus === key ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stage-Grouped Checkpoints */}
        <div className="space-y-2">
          {stageGroups.map((group) => {
            if (group.items.length === 0) return null;
            const stageComplete = group.stageDone === group.stageTotal && group.stageTotal > 0;
            return (
              <div
                key={group.stage}
                className={`border overflow-hidden ${ui.border}`}
                style={{ borderRadius: '6px' }}
              >
                <div
                  className={`px-2 py-1 border-b flex items-center justify-between gap-1 ${ui.divider} ${
                    theme === 'white'
                      ? 'bg-slate-50'
                      : theme === 'red'
                      ? 'bg-[#160202]'
                      : 'bg-[#0C1424]'
                  }`}
                >
                  <span
                    className={`text-[10px] font-semibold tracking-[-0.04em] truncate ${
                      stageComplete ? goldTextClass : ui.textPrimary
                    }`}
                  >
                    {group.stage}
                  </span>
                  <span
                    className={`text-[9.5px] font-mono tabular-nums shrink-0 ${
                      stageComplete ? goldTextClass : ui.textMuted
                    }`}
                  >
                    {group.stageDone}/{group.stageTotal}
                  </span>
                </div>
                <div className={`divide-y ${ui.divider}`}>
                  {group.items.map((cp) => {
                    const expanded = expandedCpId === cp.id;
                    const coords = resolveCheckpointCoords(cp);
                    const hz = coords
                      ? equatorialToHorizontal(coords.ra, coords.dec, lstDeg, observer.lat)
                      : null;
                    const isBelowHorizon = hz !== null && hz.altDeg < 0;
                    return (
                      <div
                        key={cp.id}
                        className={`p-1.5 space-y-1 transition-opacity ${
                          isBelowHorizon ? 'opacity-70' : ''
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => onToggleCheckpoint(selectedTrack.id, cp.id)}
                            title={cp.observed ? '관측 완료 취소' : '관측 완료 체크 (황금선 채우기)'}
                            className="mt-0.5 shrink-0"
                          >
                            {cp.observed ? (
                              <CheckCircle2
                                className={`w-3.5 h-3.5 ${
                                  isBelowHorizon ? belowHorizonTextCls : goldTextClass
                                }`}
                              />
                            ) : (
                              <Circle
                                className={`w-3.5 h-3.5 ${
                                  isBelowHorizon ? belowHorizonSubCls : ui.textMuted
                                }`}
                              />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectCheckpoint(selectedTrack, cp)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={`text-[9.5px] font-mono font-semibold shrink-0 ${
                                  isBelowHorizon
                                    ? belowHorizonTextCls
                                    : cp.observed
                                    ? goldTextClass
                                    : ui.accentText
                                }`}
                              >
                                {cp.code}
                              </span>
                              <span
                                className={`text-[10.5px] font-medium truncate ${
                                  isBelowHorizon
                                    ? `${cp.observed ? 'line-through ' : ''}${belowHorizonTextCls}`
                                    : cp.observed
                                    ? `line-through opacity-75 ${ui.textPrimary}`
                                    : ui.textPrimary
                                }`}
                              >
                                {cp.name}
                              </span>
                            </div>
                            <div
                              className={`text-[9px] font-mono tabular-nums truncate ${
                                isBelowHorizon ? belowHorizonSubCls : ui.textMuted
                              }`}
                            >
                              {[
                                cp.constellation,
                                cp.objectType,
                                cp.mag !== undefined ? `${cp.mag.toFixed(1)}m` : null,
                                hz
                                  ? `고도 ${hz.altDeg.toFixed(0)}°(${getCompassDirection(hz.azDeg)})`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedCpId(expanded ? null : cp.id)}
                            title="호핑 길잡이 및 관측 로그"
                            className={`p-0.5 shrink-0 ${ui.textMuted} hover:opacity-100`}
                          >
                            {expanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {expanded && (
                          <div className="pl-5 pr-1 pt-1 space-y-1.5">
                            {cp.guideNote && (
                              <div
                                className={`text-[9.5px] leading-snug break-keep ${ui.textSecondary}`}
                              >
                                {cp.guideNote}
                              </div>
                            )}
                            <input
                              type="text"
                              value={cp.logNote ?? ''}
                              onChange={(e) =>
                                onUpdateCheckpointNote(selectedTrack.id, cp.id, e.target.value)
                              }
                              placeholder="관측 로그 메모 (아이피스, 필터, 소감...)"
                              className={`w-full px-1.5 py-1 border text-[9.5px] ${ui.input}`}
                              style={{ borderRadius: '4px' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {deleteTarget && renderDeleteConfirmModal()}
      </div>
    );
  }

  // =================== LIST VIEW ===================
  const activeCount = tracks.filter((t) => t.activeOnChart).length;

  return (
    <div className="space-y-2.5">
      {renderChallengeSettings()}
      {/* Header & File I/O Toolbar */}
      <div className="flex items-center justify-between gap-1">
        <span className={`font-semibold tracking-[-0.05em] flex items-center gap-1 ${ui.textPrimary}`}>
          <Trophy className={`w-3.5 h-3.5 ${goldTextClass}`} />
          <span>관측 투어 · 챌린지</span>
        </span>
        {activeCount > 0 && (
          <span className={`text-[9.5px] font-mono ${goldTextClass}`}>
            성도 표시 {activeCount}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={startCreateTrack}
          title="새 커스텀 챌린지 코스 만들기"
          className={`py-1 px-1 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1 whitespace-nowrap ${ui.buttonActive}`}
          style={{ borderRadius: '4px' }}
        >
          <Plus className="w-3 h-3 shrink-0" />
          <span>새 챌린지</span>
        </button>
        <button
          type="button"
          onClick={() => {
            downloadChallengesFile(tracks);
            setNotice(`전체 ${tracks.length}개 챌린지 파일을 저장했습니다.`);
          }}
          title="모든 챌린지 코스와 관측 진행 상황을 .json 파일로 저장"
          className={`py-1 px-1 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1 whitespace-nowrap ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
        >
          <Download className="w-3 h-3 shrink-0" />
          <span>파일 저장</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="로컬 .json 챌린지 파일 불러오기"
          className={`py-1 px-1 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1 whitespace-nowrap ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
        >
          <Upload className="w-3 h-3 shrink-0" />
          <span>불러오기</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const text = await file.text();
              const parsed = parseChallengesFromJson(text);
              if (parsed.error) {
                setNotice(parsed.error);
                return;
              }
              const res = onImportTracks(parsed.tracks);
              setNotice(
                `불러오기 완료: 신규 ${res.addedCount}개 추가 · 기존 ${res.updatedCount}개 업데이트`
              );
            } catch {
              setNotice('챌린지 파일을 읽는 중 오류가 발생했습니다.');
            }
          }}
        />
      </div>

      {notice && (
        <div
          className={`px-2 py-1.5 border text-[10px] tracking-[-0.04em] leading-snug break-keep flex items-start justify-between gap-1 ${ui.border} ${ui.accentText}`}
          style={{ borderRadius: '4px' }}
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Track Cards */}
      <div className="space-y-2">
        {tracks.map((track) => {
          const total = track.checkpoints.length;
          const done = track.checkpoints.filter((c) => c.observed).length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isCompleted = total > 0 && done === total;
          const unlockedBadges = evaluateTrackBadges(track).filter((b) => b.unlocked).length;

          return (
            <div
              key={track.id}
              className={`border p-2 space-y-1.5 transition-colors ${
                track.activeOnChart
                  ? theme === 'white'
                    ? 'border-blue-500 bg-blue-50/40'
                    : theme === 'red'
                    ? 'border-[#DC2626] bg-[#1E0303]'
                    : 'border-cyan-500/60 bg-cyan-950/20'
                  : ui.border
              }`}
              style={{ borderRadius: '6px' }}
            >
              <div className="flex items-start justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTrackId(track.id);
                    setFilterStatus('all');
                    setExpandedCpId(null);
                    setMode('detail');
                  }}
                  className="flex-1 min-w-0 text-left space-y-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isCompleted ? progressFillColor : track.lineColor,
                      }}
                    />
                    <span
                      className={`text-[11px] font-semibold tracking-[-0.04em] truncate ${ui.textPrimary}`}
                    >
                      {track.title}
                    </span>
                  </div>
                  <div className={`text-[9.5px] font-mono truncate ${ui.textMuted}`}>
                    {track.season ? `${SEASON_LABELS[track.season]} · ` : ''}
                    {total}개 대상
                    {unlockedBadges > 0 ? ` · 뱃지 ${unlockedBadges}` : ''}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleTrackOnChart(track.id)}
                    title={track.activeOnChart ? '성도 오버레이 끄기' : '성도 위에 점선/황금선 노선 표시'}
                    className={`px-1.5 py-0.5 border text-[9.5px] font-medium flex items-center gap-0.5 ${
                      track.activeOnChart ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    {track.activeOnChart ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                    <span>{track.activeOnChart ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onFrameTrack(track)}
                    title="성도에 코스 전체 맞춤 보기"
                    className={`p-1 border ${ui.buttonIdle}`}
                    style={{ borderRadius: '4px' }}
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(track)}
                    title="챌린지 삭제"
                    aria-label={`${track.title} 삭제`}
                    className={`p-1 border transition-colors ${
                      theme === 'white'
                        ? 'border-red-300 text-red-600 hover:bg-red-50'
                        : 'border-red-500/40 text-red-400 hover:bg-red-500/15'
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTrackId(track.id);
                  setFilterStatus('all');
                  setExpandedCpId(null);
                  setMode('detail');
                }}
                className="w-full block space-y-1 text-left"
              >
                <div className="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: progressFillColor,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9.5px] font-mono tabular-nums">
                  <span className={isCompleted ? `font-semibold ${goldTextClass}` : ui.textMuted}>
                    {isCompleted ? '★ 완주 완료' : '클릭하여 체크포인트 열기'}
                  </span>
                  <span className={isCompleted ? `font-bold ${goldTextClass}` : ui.textSecondary}>
                    {done}/{total} ({pct}%)
                  </span>
                </div>
              </button>
            </div>
          );
        })}

        {tracks.length === 0 && (
          <div
            className={`border p-4 text-center space-y-2 ${ui.border} ${ui.textMuted}`}
            style={{ borderRadius: '6px' }}
          >
            <div className="text-[11px]">등록된 챌린지가 없습니다.</div>
            <p className="text-[10px] leading-snug break-keep">
              새 챌린지를 만들거나 아래 버튼으로 기본 챌린지 코스를 복원할 수 있습니다.
            </p>
          </div>
        )}

        {missingBuiltInTracks.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const res = onImportTracks(missingBuiltInTracks);
              setNotice(`삭제된 기본 챌린지 ${res.addedCount}개를 복원했습니다.`);
            }}
            className={`w-full py-1.5 px-2 border text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '5px' }}
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span>기본 챌린지 코스 복원 ({missingBuiltInTracks.length}개)</span>
          </button>
        )}
      </div>

      {deleteTarget && renderDeleteConfirmModal()}
    </div>
  );

  function renderDeleteConfirmModal() {
    if (!deleteTarget) return null;
    const observedCount = deleteTarget.checkpoints.filter((c) => c.observed).length;
    const totalCount = deleteTarget.checkpoints.length;

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-delete-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
        onClick={() => setDeleteTarget(null)}
      >
        <div
          className={`w-full max-w-[320px] border p-4 shadow-2xl space-y-3 ${ui.panel} ${ui.border}`}
          style={{ borderRadius: '8px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2.5">
            <div
              className={`p-1.5 rounded-md shrink-0 ${
                theme === 'white'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3
                id="challenge-delete-title"
                className={`text-[13px] font-semibold leading-tight ${ui.textPrimary}`}
              >
                챌린지 삭제 확인
              </h3>
              <p className={`text-[11px] leading-relaxed break-keep ${ui.textSecondary}`}>
                <span className={`font-semibold ${ui.textPrimary}`}>
                  &lsquo;{deleteTarget.title}&rsquo;
                </span>{' '}
                챌린지({totalCount}개 대상)를 삭제하시겠습니까?
              </p>
              {observedCount > 0 && (
                <p
                  className={`text-[10.5px] leading-snug break-keep ${
                    theme === 'white' ? 'text-red-600' : 'text-red-400'
                  }`}
                >
                  관측 완료 기록 {observedCount}건도 함께 삭제됩니다.
                </p>
              )}
              {deleteTarget.builtIn && (
                <p className={`text-[10px] leading-snug break-keep ${ui.textMuted}`}>
                  삭제 후에도 목록 하단의 &lsquo;기본 챌린지 코스 복원&rsquo; 버튼으로 다시 불러올 수 있습니다.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className={`px-3 py-1.5 border text-[11px] font-medium transition-colors ${ui.buttonIdle}`}
              style={{ borderRadius: '5px' }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className={`px-3 py-1.5 border text-[11px] font-semibold transition-colors ${
                theme === 'white'
                  ? 'bg-red-600 border-red-700 text-white hover:bg-red-700'
                  : 'bg-red-600 border-red-500 text-white hover:bg-red-500'
              }`}
              style={{ borderRadius: '5px' }}
            >
              삭제
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }
}
