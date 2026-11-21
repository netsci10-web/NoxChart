import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  EQUIPMENT_PRESETS,
  EquipmentPreset,
  normalizeTelescopeOpticalType,
  TELESCOPE_OPTICAL_TYPES,
  TelescopeOpticalType,
} from '../data/equipmentCatalog';
import {
  EquipmentCategory,
  EquipmentItem,
  EquipmentLockerState,
  ThemeMode,
} from '../types/astronomy';
import { RAD2DEG } from '../utils/astronomy';
import {
  downloadSkylistFile,
  exportEquipmentToSkylist,
  parseEquipmentFromSkylist,
} from '../utils/skylist';
import { getUiTheme } from '../utils/themeClasses';

interface EquipmentLockerPanelProps {
  theme: ThemeMode;
  locker: EquipmentLockerState;
  onAddOrUpdateItem: (item: EquipmentItem) => void;
  onDeleteItem: (id: string) => void;
  onToggleActiveItem: (category: EquipmentCategory, id: string) => void;
  onImportLocker: (imported: EquipmentLockerState) => void;
}

const CATEGORY_TABS: { id: EquipmentCategory; label: string }[] = [
  { id: 'telescope', label: '경통' },
  { id: 'eyepiece', label: '아이피스' },
  { id: 'barlow', label: '바로우' },
  { id: 'filter', label: '필터' },
  { id: 'camera', label: '카메라' },
];

interface FormDraft {
  id: string | null;
  name: string;
  note: string;
  apertureMm: string;
  focalLengthMm: string;
  opticalType: TelescopeOpticalType;
  afovDeg: string;
  factor: string;
  filterType: string;
  sensorWidthMm: string;
  sensorHeightMm: string;
  pixelSizeUm: string;
  isSmartTelescope: boolean;
  supportsSensorRotation: boolean;
}

function createEmptyDraft(category: EquipmentCategory): FormDraft {
  return {
    id: null,
    name: '',
    note: '',
    apertureMm: category === 'telescope' ? '102' : '',
    focalLengthMm: category === 'telescope' ? '714' : category === 'eyepiece' ? '25' : '',
    opticalType: '굴절',
    afovDeg: category === 'eyepiece' ? '68' : '',
    factor: category === 'barlow' ? '2.0' : '',
    filterType: category === 'filter' ? 'UHC' : '',
    sensorWidthMm: category === 'camera' ? '11.3' : '',
    sensorHeightMm: category === 'camera' ? '11.3' : '',
    pixelSizeUm: category === 'camera' ? '3.76' : '',
    isSmartTelescope: false,
    supportsSensorRotation: false,
  };
}

function itemToDraft(item: EquipmentItem): FormDraft {
  return {
    id: item.id,
    name: item.name,
    note: item.note ?? '',
    apertureMm: item.apertureMm !== undefined ? String(item.apertureMm) : '',
    focalLengthMm: item.focalLengthMm !== undefined ? String(item.focalLengthMm) : '',
    opticalType: normalizeTelescopeOpticalType(item.opticalType),
    afovDeg: item.afovDeg !== undefined ? String(item.afovDeg) : '',
    factor: item.factor !== undefined ? String(item.factor) : '',
    filterType: item.filterType ?? '',
    sensorWidthMm: item.sensorWidthMm !== undefined ? String(item.sensorWidthMm) : '',
    sensorHeightMm: item.sensorHeightMm !== undefined ? String(item.sensorHeightMm) : '',
    pixelSizeUm: item.pixelSizeUm !== undefined ? String(item.pixelSizeUm) : '',
    isSmartTelescope: Boolean(item.isSmartTelescope),
    supportsSensorRotation: Boolean(item.supportsSensorRotation),
  };
}

function presetToDraft(preset: EquipmentPreset): FormDraft {
  return {
    id: null,
    name: preset.name,
    note: '',
    apertureMm: preset.apertureMm !== undefined ? String(preset.apertureMm) : '',
    focalLengthMm: preset.focalLengthMm !== undefined ? String(preset.focalLengthMm) : '',
    opticalType: preset.opticalType ?? '굴절',
    afovDeg: preset.afovDeg !== undefined ? String(preset.afovDeg) : '',
    factor: preset.factor !== undefined ? String(preset.factor) : '',
    filterType: preset.filterType ?? '',
    sensorWidthMm: preset.sensorWidthMm !== undefined ? String(preset.sensorWidthMm) : '',
    sensorHeightMm: preset.sensorHeightMm !== undefined ? String(preset.sensorHeightMm) : '',
    pixelSizeUm: preset.pixelSizeUm !== undefined ? String(preset.pixelSizeUm) : '',
    isSmartTelescope: Boolean(preset.isSmartTelescope),
    supportsSensorRotation: Boolean(preset.supportsSensorRotation),
  };
}

function formatPresetSpec(preset: EquipmentPreset): string {
  switch (preset.category) {
    case 'telescope': {
      const parts: string[] = [];
      if (preset.apertureMm) parts.push(`D${preset.apertureMm}mm`);
      if (preset.focalLengthMm) parts.push(`FL${preset.focalLengthMm}mm`);
      if (preset.apertureMm && preset.focalLengthMm) {
        parts.push(`f/${(preset.focalLengthMm / preset.apertureMm).toFixed(1)}`);
      }
      if (preset.opticalType) parts.push(preset.opticalType);
      return parts.join(' · ');
    }
    case 'eyepiece':
      return `${preset.focalLengthMm ?? ''}mm · ${preset.afovDeg ?? ''}°`;
    case 'barlow':
      return preset.factor
        ? `${preset.factor}× (${preset.factor < 1 ? '리듀서' : '바로우'})`
        : '바로우';
    case 'filter':
      return preset.filterType || '필터';
    case 'camera': {
      const parts: string[] = [];
      if (preset.isSmartTelescope) {
        parts.push(preset.supportsSensorRotation ? '스마트(회전)' : '스마트');
        if (preset.apertureMm) parts.push(`D${preset.apertureMm}`);
        if (preset.focalLengthMm) parts.push(`FL${preset.focalLengthMm}mm`);
        if (preset.focalLengthMm && preset.sensorWidthMm && preset.sensorHeightMm) {
          const w = 2 * Math.atan(preset.sensorWidthMm / (2 * preset.focalLengthMm)) * RAD2DEG;
          const h = 2 * Math.atan(preset.sensorHeightMm / (2 * preset.focalLengthMm)) * RAD2DEG;
          parts.push(`${w.toFixed(2)}°×${h.toFixed(2)}°`);
        }
        return parts.join(' · ');
      }
      if (preset.sensorWidthMm && preset.sensorHeightMm) {
        parts.push(`${preset.sensorWidthMm}×${preset.sensorHeightMm}mm`);
      }
      if (preset.pixelSizeUm) parts.push(`${preset.pixelSizeUm}µm`);
      return parts.join(' · ');
    }
  }
}

function formatItemSpec(item: EquipmentItem): string {
  switch (item.category) {
    case 'telescope': {
      const parts: string[] = [];
      if (item.apertureMm) parts.push(`D${item.apertureMm}mm`);
      if (item.focalLengthMm) parts.push(`FL${item.focalLengthMm}mm`);
      if (item.apertureMm && item.focalLengthMm) {
        parts.push(`f/${(item.focalLengthMm / item.apertureMm).toFixed(1)}`);
      }
      if (item.opticalType) parts.push(item.opticalType);
      return parts.join(' · ') || '경통';
    }
    case 'eyepiece': {
      const parts: string[] = [];
      if (item.focalLengthMm) parts.push(`${item.focalLengthMm}mm`);
      if (item.afovDeg) parts.push(`${item.afovDeg}°`);
      return parts.join(' · ') || '아이피스';
    }
    case 'barlow': {
      if (item.factor) {
        const tag = item.factor < 1 ? '리듀서' : '바로우';
        return `${item.factor}× (${tag})`;
      }
      return '바로우';
    }
    case 'filter':
      return item.filterType || '필터';
    case 'camera': {
      const parts: string[] = [];
      if (item.isSmartTelescope) {
        parts.push(item.supportsSensorRotation ? '스마트(회전)' : '스마트');
        if (item.focalLengthMm) parts.push(`FL${item.focalLengthMm}mm`);
      }
      if (item.sensorWidthMm && item.sensorHeightMm) {
        parts.push(`${item.sensorWidthMm}×${item.sensorHeightMm}mm`);
      }
      if (item.pixelSizeUm) parts.push(`${item.pixelSizeUm}µm`);
      return parts.join(' · ') || '카메라';
    }
  }
}

export function EquipmentLockerPanel({
  theme,
  locker,
  onAddOrUpdateItem,
  onDeleteItem,
  onToggleActiveItem,
  onImportLocker,
}: EquipmentLockerPanelProps) {
  const ui = getUiTheme(theme);
  const [activeTab, setActiveTab] = useState<EquipmentCategory>('telescope');
  const [formOpen, setFormOpen] = useState(false);
  const [registerMode, setRegisterMode] = useState<'preset' | 'custom'>('preset');
  const [cameraPresetFilter, setCameraPresetFilter] = useState<'all' | 'smart' | 'standard'>('all');
  const [presetQuery, setPresetQuery] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetNote, setPresetNote] = useState('');
  const [draft, setDraft] = useState<FormDraft>(() => createEmptyDraft('telescope'));
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotice = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => {
      setStatusMsg((cur) => (cur === msg ? null : cur));
    }, 3600);
  };

  const categoryItems = useMemo(
    () => locker.items.filter((it) => it.category === activeTab),
    [locker.items, activeTab]
  );

  const filteredPresets = useMemo(() => {
    const q = presetQuery.trim().toLowerCase();
    let list = EQUIPMENT_PRESETS.filter((p) => p.category === activeTab);
    if (activeTab === 'camera') {
      if (cameraPresetFilter === 'smart') {
        list = list.filter((p) => p.isSmartTelescope);
      } else if (cameraPresetFilter === 'standard') {
        list = list.filter((p) => !p.isSmartTelescope);
      }
    }
    if (!q) return list;
    return list.filter((p) => {
      const hay = `${p.brand} ${p.name} ${p.opticalType ?? ''} ${p.filterType ?? ''} ${
        p.isSmartTelescope ? '스마트망원경 스마트 smart' : ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeTab, presetQuery, cameraPresetFilter]);

  const selectedPreset = useMemo(
    () =>
      selectedPresetId
        ? EQUIPMENT_PRESETS.find((p) => p.id === selectedPresetId && p.category === activeTab) ??
          null
        : null,
    [selectedPresetId, activeTab]
  );

  const existingNamesSet = useMemo(
    () => new Set(categoryItems.map((it) => it.name.trim().toLowerCase())),
    [categoryItems]
  );

  const activeRig = useMemo(() => {
    const byId = new Map(locker.items.map((it) => [it.id, it]));
    const telescope = locker.activeIds.telescope ? byId.get(locker.activeIds.telescope) : undefined;
    const eyepiece = locker.activeIds.eyepiece ? byId.get(locker.activeIds.eyepiece) : undefined;
    const barlow = locker.activeIds.barlow ? byId.get(locker.activeIds.barlow) : undefined;
    const filter = locker.activeIds.filter ? byId.get(locker.activeIds.filter) : undefined;
    const camera = locker.activeIds.camera ? byId.get(locker.activeIds.camera) : undefined;

    const factor = barlow?.factor && barlow.factor > 0 ? barlow.factor : 1;
    const effFl = telescope?.focalLengthMm ? telescope.focalLengthMm * factor : null;
    const mag =
      effFl && eyepiece?.focalLengthMm && eyepiece.focalLengthMm > 0
        ? effFl / eyepiece.focalLengthMm
        : null;
    const tfov = mag && eyepiece?.afovDeg ? eyepiece.afovDeg / mag : null;
    const camEffFl =
      camera?.isSmartTelescope && camera.focalLengthMm ? camera.focalLengthMm : effFl;
    const camW =
      camEffFl && camera?.sensorWidthMm
        ? 2 * Math.atan(camera.sensorWidthMm / (2 * camEffFl)) * RAD2DEG
        : null;
    const camH =
      camEffFl && camera?.sensorHeightMm
        ? 2 * Math.atan(camera.sensorHeightMm / (2 * camEffFl)) * RAD2DEG
        : null;

    return { telescope, eyepiece, barlow, filter, camera, factor, effFl, mag, tfov, camW, camH };
  }, [locker]);

  const handleTabSwitch = (nextTab: EquipmentCategory) => {
    setActiveTab(nextTab);
    setFormOpen(false);
    setCameraPresetFilter('all');
    setPresetQuery('');
    setSelectedPresetId(null);
    setPresetNote('');
    setDraft(createEmptyDraft(nextTab));
  };

  const handleStartAdd = () => {
    setRegisterMode('preset');
    setCameraPresetFilter('all');
    setPresetQuery('');
    setSelectedPresetId(null);
    setPresetNote('');
    setDraft(createEmptyDraft(activeTab));
    setFormOpen(true);
  };

  const handleStartEdit = (item: EquipmentItem) => {
    setActiveTab(item.category);
    setRegisterMode('custom');
    setDraft(itemToDraft(item));
    setFormOpen(true);
  };

  const handleRegisterSelectedPreset = () => {
    if (!selectedPreset) {
      showNotice('등록할 장비를 목록에서 선택해 주세요.');
      return;
    }
    const item: EquipmentItem = {
      id: `eq_${activeTab}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: selectedPreset.category,
      name: selectedPreset.name,
      note: presetNote.trim() || undefined,
      apertureMm: selectedPreset.apertureMm,
      focalLengthMm: selectedPreset.focalLengthMm,
      opticalType: selectedPreset.opticalType,
      afovDeg: selectedPreset.afovDeg,
      factor: selectedPreset.factor,
      filterType: selectedPreset.filterType,
      sensorWidthMm: selectedPreset.sensorWidthMm,
      sensorHeightMm: selectedPreset.sensorHeightMm,
      pixelSizeUm: selectedPreset.pixelSizeUm,
      isSmartTelescope: selectedPreset.isSmartTelescope,
      supportsSensorRotation: selectedPreset.supportsSensorRotation,
    };
    onAddOrUpdateItem(item);
    setFormOpen(false);
    setSelectedPresetId(null);
    setPresetNote('');
    setPresetQuery('');
    showNotice(`'${selectedPreset.name}' 장비를 등록했습니다.`);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      showNotice('장비 이름을 입력해주세요.');
      return;
    }

    const parsePos = (s: string): number | undefined => {
      const v = parseFloat(s);
      return Number.isFinite(v) && v > 0 ? v : undefined;
    };

    const item: EquipmentItem = {
      id: draft.id ?? `eq_${activeTab}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: activeTab,
      name: trimmedName,
      note: draft.note.trim() || undefined,
    };

    if (activeTab === 'telescope') {
      item.apertureMm = parsePos(draft.apertureMm);
      item.focalLengthMm = parsePos(draft.focalLengthMm);
      item.opticalType = draft.opticalType;
    } else if (activeTab === 'eyepiece') {
      item.focalLengthMm = parsePos(draft.focalLengthMm);
      item.afovDeg = parsePos(draft.afovDeg);
    } else if (activeTab === 'barlow') {
      item.factor = parsePos(draft.factor) ?? 2.0;
    } else if (activeTab === 'filter') {
      item.filterType = draft.filterType.trim() || undefined;
    } else if (activeTab === 'camera') {
      item.sensorWidthMm = parsePos(draft.sensorWidthMm);
      item.sensorHeightMm = parsePos(draft.sensorHeightMm);
      item.pixelSizeUm = parsePos(draft.pixelSizeUm);
      if (draft.isSmartTelescope) {
        item.isSmartTelescope = true;
        item.supportsSensorRotation = draft.supportsSensorRotation;
        item.apertureMm = parsePos(draft.apertureMm);
        item.focalLengthMm = parsePos(draft.focalLengthMm);
      }
    }

    onAddOrUpdateItem(item);
    setFormOpen(false);
    setDraft(createEmptyDraft(activeTab));
    showNotice(draft.id ? '장비 정보를 수정했습니다.' : '새 장비를 등록했습니다.');
  };

  const handleExportSkylist = () => {
    if (locker.items.length === 0) {
      showNotice('저장할 장비가 없습니다.');
      return;
    }
    const content = exportEquipmentToSkylist(locker);
    const today = new Date().toISOString().slice(0, 10);
    downloadSkylistFile(content, `noxchart-equipment-${today}.skylist`);
    showNotice(`장비 ${locker.items.length}개 .skylist 저장 완료`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseEquipmentFromSkylist(text);
      if (parsed.items.length === 0) {
        showNotice('파일에서 장비 항목을 찾지 못했습니다.');
        return;
      }
      onImportLocker(parsed);
      showNotice(`장비 ${parsed.items.length}개 불러옴 (.skylist)`);
    } catch {
      showNotice('.skylist 파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  const summaryBoxCls =
    theme === 'white'
      ? 'bg-slate-50 border-slate-200'
      : theme === 'red'
      ? 'bg-[#180303] border-[#4A1010]'
      : 'bg-[#0C1728] border-[#223452]';

  const hasAnyActive = Boolean(
    activeRig.telescope ||
      activeRig.eyepiece ||
      activeRig.barlow ||
      activeRig.filter ||
      activeRig.camera
  );

  return (
    <div className="space-y-2">
      {/* Header + .skylist Save/Load */}
      <div className="flex items-center justify-between gap-1">
        <span
          className={`font-semibold flex items-center gap-1 whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
        >
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span>내 장비함 ({locker.items.length})</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".skylist,.txt"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="로컬 .skylist 장비 파일 불러오기"
            className={`px-1.5 py-0.5 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center gap-0.5 whitespace-nowrap ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Upload className="w-2.5 h-2.5 shrink-0" />
            <span>불러오기</span>
          </button>
          <button
            type="button"
            onClick={handleExportSkylist}
            title="내 장비함을 .skylist 파일로 로컬 저장"
            className={`px-1.5 py-0.5 border text-[9.5px] tracking-[-0.05em] font-medium flex items-center gap-0.5 whitespace-nowrap ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            <Download className="w-2.5 h-2.5 shrink-0" />
            <span>저장</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`px-2 py-1 border text-[10px] tracking-[-0.04em] rounded ${summaryBoxCls} ${ui.accentText}`}
        >
          {statusMsg}
        </div>
      )}

      {/* 5 Equipment Category Tabs */}
      <div className="grid grid-cols-5 gap-0.5">
        {CATEGORY_TABS.map((cat) => {
          const isCurrent = activeTab === cat.id;
          const hasSelected = Boolean(locker.activeIds[cat.id]);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleTabSwitch(cat.id)}
              className={`relative py-1 px-0.5 border text-[9.5px] tracking-[-0.06em] font-medium whitespace-nowrap transition-colors ${
                isCurrent ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              <span>{cat.label}</span>
              {hasSelected && (
                <span
                  className={`absolute top-0.5 right-0.5 w-1 h-1 rounded-full ${
                    theme === 'red'
                      ? 'bg-[#FF4D4D]'
                      : isCurrent
                      ? 'bg-white'
                      : 'bg-cyan-400'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Rig Summary Strip */}
      {hasAnyActive && (
        <div
          className={`px-2 py-1.5 border rounded space-y-0.5 text-[9.5px] tracking-[-0.04em] ${summaryBoxCls}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className={ui.textMuted}>장착 조합</span>
            {activeRig.effFl && (
              <span className={`font-mono tabular-nums font-semibold ${ui.accentText}`}>
                유효 FL {Math.round(activeRig.effFl)}mm
                {activeRig.factor !== 1 ? ` (${activeRig.factor}×)` : ''}
              </span>
            )}
          </div>
          <div className={`truncate ${ui.textSecondary}`}>
            {[
              activeRig.telescope?.name,
              activeRig.barlow?.name,
              activeRig.eyepiece?.name,
              activeRig.camera?.name,
              activeRig.filter?.name,
            ]
              .filter(Boolean)
              .join(' + ')}
          </div>
          {(activeRig.mag || activeRig.camW) && (
            <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono tabular-nums ${ui.textMuted}`}>
              {activeRig.mag && activeRig.tfov && (
                <span>
                  안시 {activeRig.mag.toFixed(0)}× · {activeRig.tfov.toFixed(2)}°
                </span>
              )}
              {activeRig.camW && activeRig.camH && (
                <span>
                  센서 {activeRig.camW.toFixed(2)}°×{activeRig.camH.toFixed(2)}°
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Items List in Current Tab */}
      <div className="space-y-1">
        {categoryItems.length === 0 ? (
          <div
            className={`px-2 py-2.5 border text-center text-[10px] tracking-[-0.04em] rounded ${ui.border} ${ui.textMuted}`}
          >
            등록된 {CATEGORY_TABS.find((c) => c.id === activeTab)?.label} 장비가 없습니다.
          </div>
        ) : (
          categoryItems.map((item) => {
            const isSelected = locker.activeIds[activeTab] === item.id;
            return (
              <div
                key={item.id}
                className={`px-2 py-1.5 border flex items-center justify-between gap-1 transition-colors ${
                  isSelected ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
              >
                <button
                  type="button"
                  onClick={() => onToggleActiveItem(activeTab, item.id)}
                  className="flex-1 text-left min-w-0"
                  title="클릭하여 장착/해제 (광학계 시야 자동 반영)"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {isSelected && <Check className="w-3 h-3 shrink-0" />}
                    <span className="text-[10.5px] font-medium truncate tracking-[-0.04em]">
                      {item.name}
                    </span>
                  </div>
                  <div className="font-mono text-[9.5px] tabular-nums opacity-80 truncate">
                    {formatItemSpec(item)}
                  </div>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    title="장비 수정"
                    className="p-1 opacity-75 hover:opacity-100"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteItem(item.id);
                      if (draft.id === item.id) {
                        setFormOpen(false);
                        setDraft(createEmptyDraft(activeTab));
                      }
                    }}
                    title="장비 삭제"
                    className="p-1 opacity-75 hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Form */}
      {formOpen ? (
        <div className={`p-2 border rounded space-y-1.5 ${summaryBoxCls}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-semibold ${ui.textPrimary}`}>
              {CATEGORY_TABS.find((c) => c.id === activeTab)?.label}{' '}
              {draft.id ? '수정' : '등록'}
            </span>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className={`p-0.5 ${ui.textMuted} hover:opacity-100`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Preset vs Custom Mode Switcher (when registering new equipment) */}
          {!draft.id && (
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setRegisterMode('preset')}
                className={`py-1 px-1 border text-[9.5px] font-semibold tracking-[-0.05em] whitespace-nowrap transition-colors ${
                  registerMode === 'preset' ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
              >
                주요 장비 선택
              </button>
              <button
                type="button"
                onClick={() => setRegisterMode('custom')}
                className={`py-1 px-1 border text-[9.5px] font-semibold tracking-[-0.05em] whitespace-nowrap transition-colors ${
                  registerMode === 'custom' ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
              >
                커스텀 직접 입력
              </button>
            </div>
          )}

          {!draft.id && registerMode === 'preset' ? (
            <div className="space-y-1.5">
              {activeTab === 'camera' && (
                <div className="grid grid-cols-3 gap-0.5">
                  {(
                    [
                      ['all', '전체'],
                      ['smart', '스마트망원경'],
                      ['standard', '전용·DSLR'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setCameraPresetFilter(val);
                        setSelectedPresetId(null);
                      }}
                      className={`py-0.5 px-0.5 border text-[9px] tracking-[-0.05em] font-medium whitespace-nowrap transition-colors ${
                        cameraPresetFilter === val ? ui.buttonActive : ui.buttonIdle
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search
                  className={`w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${ui.textMuted}`}
                />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'camera'
                      ? '카메라·스마트망원경 검색...'
                      : '모델명·제조사 검색...'
                  }
                  value={presetQuery}
                  onChange={(e) => setPresetQuery(e.target.value)}
                  className={`w-full pl-6 pr-2 py-1 border text-[10px] ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
              </div>

              <div className="max-h-40 overflow-y-auto astro-scroll space-y-1 pr-0.5">
                {filteredPresets.length === 0 ? (
                  <div
                    className={`px-2 py-2.5 border rounded text-center text-[10px] space-y-1 ${ui.border} ${ui.textMuted}`}
                  >
                    <div>일치하는 모델이 없습니다.</div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          ...createEmptyDraft(activeTab),
                          name: presetQuery.trim(),
                        });
                        setRegisterMode('custom');
                      }}
                      className={`underline underline-offset-2 ${ui.accentText}`}
                    >
                      커스텀 장비로 직접 입력하기
                    </button>
                  </div>
                ) : (
                  filteredPresets.map((preset) => {
                    const isPicked = selectedPresetId === preset.id;
                    const alreadyAdded = existingNamesSet.has(preset.name.trim().toLowerCase());
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPresetId(preset.id)}
                        className={`w-full text-left px-2 py-1 border transition-colors ${
                          isPicked ? ui.buttonActive : ui.buttonIdle
                        }`}
                        style={{ borderRadius: '4px' }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-medium truncate tracking-[-0.04em]">
                            {preset.name}
                          </span>
                          {alreadyAdded && (
                            <span className="text-[8.5px] opacity-75 shrink-0">등록됨</span>
                          )}
                        </div>
                        <div className="font-mono text-[9px] tabular-nums opacity-80 truncate">
                          {formatPresetSpec(preset)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedPreset && (
                <div className="space-y-1 pt-0.5">
                  <input
                    type="text"
                    placeholder="메모 (선택)"
                    value={presetNote}
                    onChange={(e) => setPresetNote(e.target.value)}
                    className={`w-full px-2 py-1 border text-[10px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={handleRegisterSelectedPreset}
                      className={`py-1 border text-[10px] font-semibold ${ui.buttonActive}`}
                      style={{ borderRadius: '4px' }}
                    >
                      선택 장비 등록
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...presetToDraft(selectedPreset), note: presetNote });
                        setRegisterMode('custom');
                      }}
                      className={`py-1 border text-[10px] font-medium ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      사양 수정 입력
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveForm} className="space-y-1.5">
              <input
                type="text"
                placeholder="장비명 (예: 102mm F7 ED)"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className={`w-full px-2 py-1 border text-[10.5px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              />

              {activeTab === 'telescope' && (
                <>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>구경 (mm)</label>
                      <input
                        type="number"
                        min={10}
                        max={2000}
                        step={1}
                        value={draft.apertureMm}
                        onChange={(e) => setDraft((d) => ({ ...d, apertureMm: e.target.value }))}
                        className={`w-full px-1.5 py-1 border font-mono text-[10.5px] ${ui.input}`}
                        style={{ borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>초점거리 (mm)</label>
                      <input
                        type="number"
                        min={30}
                        max={15000}
                        step={1}
                        value={draft.focalLengthMm}
                        onChange={(e) => setDraft((d) => ({ ...d, focalLengthMm: e.target.value }))}
                        className={`w-full px-1.5 py-1 border font-mono text-[10.5px] ${ui.input}`}
                        style={{ borderRadius: '4px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>광학 형식</label>
                    <div className="grid grid-cols-4 gap-1">
                      {TELESCOPE_OPTICAL_TYPES.map((optType) => (
                        <button
                          key={optType}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, opticalType: optType }))}
                          className={`py-1 px-0.5 border text-[10px] font-medium whitespace-nowrap transition-colors ${
                            draft.opticalType === optType ? ui.buttonActive : ui.buttonIdle
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          {optType}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'eyepiece' && (
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>초점거리 (mm)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={0.1}
                      value={draft.focalLengthMm}
                      onChange={(e) => setDraft((d) => ({ ...d, focalLengthMm: e.target.value }))}
                      className={`w-full px-1.5 py-1 border font-mono text-[10.5px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>AFOV (°)</label>
                    <input
                      type="number"
                      min={20}
                      max={120}
                      step={1}
                      value={draft.afovDeg}
                      onChange={(e) => setDraft((d) => ({ ...d, afovDeg: e.target.value }))}
                      className={`w-full px-1.5 py-1 border font-mono text-[10.5px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'barlow' && (
                <div>
                  <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>
                    배율 / 리듀서 계수 (예: 2.0, 3.0, 0.63)
                  </label>
                  <input
                    type="number"
                    min={0.2}
                    max={10}
                    step={0.05}
                    value={draft.factor}
                    onChange={(e) => setDraft((d) => ({ ...d, factor: e.target.value }))}
                    className={`w-full px-1.5 py-1 border font-mono text-[10.5px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                </div>
              )}

              {activeTab === 'filter' && (
                <div>
                  <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>필터 종류 / 대역</label>
                  <input
                    type="text"
                    placeholder="예: UHC, O-III, Hα, Dual-Band, 문필터"
                    value={draft.filterType}
                    onChange={(e) => setDraft((d) => ({ ...d, filterType: e.target.value }))}
                    className={`w-full px-2 py-1 border text-[10px] ${ui.input}`}
                    style={{ borderRadius: '4px' }}
                  />
                </div>
              )}

              {activeTab === 'camera' && (
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                    <span className={`text-[9.5px] tracking-[-0.04em] ${ui.textSecondary}`}>
                      스마트 망원경 (내장 경통 포함)
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.isSmartTelescope}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          isSmartTelescope: e.target.checked,
                          apertureMm:
                            e.target.checked && !d.apertureMm ? '50' : d.apertureMm,
                          focalLengthMm:
                            e.target.checked && !d.focalLengthMm ? '250' : d.focalLengthMm,
                        }))
                      }
                      className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                    />
                  </label>

                  {draft.isSmartTelescope && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>
                            내장 구경 (mm)
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={500}
                            step={1}
                            value={draft.apertureMm}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, apertureMm: e.target.value }))
                            }
                            className={`w-full px-1.5 py-1 border font-mono text-[10px] ${ui.input}`}
                            style={{ borderRadius: '4px' }}
                          />
                        </div>
                        <div>
                          <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>
                            내장 초점거리 (mm)
                          </label>
                          <input
                            type="number"
                            min={30}
                            max={2000}
                            step={1}
                            value={draft.focalLengthMm}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, focalLengthMm: e.target.value }))
                            }
                            className={`w-full px-1.5 py-1 border font-mono text-[10px] ${ui.input}`}
                            style={{ borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                      <label className="flex items-center justify-between gap-1.5 py-0.5 cursor-pointer">
                        <span className={`text-[9.5px] tracking-[-0.04em] ${ui.textMuted}`}>
                          센서 회전 지원 (로테이터 내장 · 예: Draco)
                        </span>
                        <input
                          type="checkbox"
                          checked={draft.supportsSensorRotation}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              supportsSensorRotation: e.target.checked,
                            }))
                          }
                          className="w-3.5 h-3.5 shrink-0 accent-cyan-500"
                        />
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>가로(mm)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={0.1}
                        value={draft.sensorWidthMm}
                        onChange={(e) => setDraft((d) => ({ ...d, sensorWidthMm: e.target.value }))}
                        className={`w-full px-1 py-1 border font-mono text-[10px] ${ui.input}`}
                        style={{ borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>세로(mm)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={0.1}
                        value={draft.sensorHeightMm}
                        onChange={(e) => setDraft((d) => ({ ...d, sensorHeightMm: e.target.value }))}
                        className={`w-full px-1 py-1 border font-mono text-[10px] ${ui.input}`}
                        style={{ borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label className={`block text-[9.5px] mb-0.5 ${ui.textMuted}`}>픽셀(µm)</label>
                      <input
                        type="number"
                        min={0.5}
                        max={30}
                        step={0.01}
                        value={draft.pixelSizeUm}
                        onChange={(e) => setDraft((d) => ({ ...d, pixelSizeUm: e.target.value }))}
                        className={`w-full px-1 py-1 border font-mono text-[10px] ${ui.input}`}
                        style={{ borderRadius: '4px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <input
                type="text"
                placeholder="메모 (선택)"
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                className={`w-full px-2 py-1 border text-[10px] ${ui.input}`}
                style={{ borderRadius: '4px' }}
              />

              <div className="grid grid-cols-2 gap-1 pt-0.5">
                <button
                  type="submit"
                  className={`py-1 border text-[10px] font-semibold ${ui.buttonActive}`}
                  style={{ borderRadius: '4px' }}
                >
                  {draft.id ? '수정 저장' : '장비 등록'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className={`py-1 border text-[10px] font-medium ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStartAdd}
          className={`w-full py-1.5 border border-dashed text-[10px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1 transition-colors ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
        >
          <Plus className="w-3 h-3 shrink-0" />
          <span>{CATEGORY_TABS.find((c) => c.id === activeTab)?.label} 추가 등록</span>
        </button>
      )}
    </div>
  );
}
