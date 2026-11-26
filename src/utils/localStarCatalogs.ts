import { Star } from '../types/astronomy';
import { angularDistanceDeg, DEG2RAD } from './astronomy';

export interface StarCatalogTierDef {
  tier: number;
  title: string;
  magMin: number;
  magMax: number;
  estSizeLabel: string;
  estStarsLabel: string;
  decBands: number;
  raBands: number;
  includeHipparcosUltra?: boolean;
}

export const STAR_CATALOG_TIERS: readonly StarCatalogTierDef[] = [
  {
    tier: 1,
    title: '전천 확장 1단계 (Hipparcos + Gaia DR3)',
    magMin: 8.0,
    magMax: 9.25,
    estSizeLabel: '약 2.8 MB',
    estStarsLabel: '약 12만 개',
    decBands: 3,
    raBands: 6,
    includeHipparcosUltra: true,
  },
  {
    tier: 2,
    title: '전천 확장 2단계 (Gaia DR3)',
    magMin: 9.25,
    magMax: 10.25,
    estSizeLabel: '약 5.2 MB',
    estStarsLabel: '약 22만 개',
    decBands: 6,
    raBands: 6,
  },
  {
    tier: 3,
    title: '쌍안경·파인더 심층 3단계 (Gaia DR3)',
    magMin: 10.25,
    magMax: 11.0,
    estSizeLabel: '약 8.4 MB',
    estStarsLabel: '약 35만 개',
    decBands: 6,
    raBands: 8,
  },
  {
    tier: 4,
    title: '소구경 망원경 4단계 (Gaia DR3)',
    magMin: 11.0,
    magMax: 11.75,
    estSizeLabel: '약 12.4 MB',
    estStarsLabel: '약 52만 개',
    decBands: 6,
    raBands: 12,
  },
  {
    tier: 5,
    title: '중구경 망원경 5단계 (Gaia DR3)',
    magMin: 11.75,
    magMax: 12.5,
    estSizeLabel: '약 18.7 MB',
    estStarsLabel: '약 78만 개',
    decBands: 8,
    raBands: 12,
  },
  {
    tier: 6,
    title: '딥스카이 정밀 6단계 (Gaia DR3)',
    magMin: 12.5,
    magMax: 13.5,
    estSizeLabel: '약 28.8 MB',
    estStarsLabel: '약 120만 개',
    decBands: 12,
    raBands: 12,
  },
] as const;

export interface InstalledStarPackMeta {
  tier: number;
  starCount: number;
  byteLength: number;
  magMin: number;
  magMax: number;
  savedAt: number;
  savedToFolder: boolean;
  fileName: string;
}

export interface StarPackDownloadProgress {
  tier: number;
  completedChunks: number;
  totalChunks: number;
  starsCollected: number;
  statusText: string;
}

export type LocalFolderStatus =
  | 'disconnected'
  | 'connected'
  | 'needs-permission'
  | 'unsupported';

export type StarPackMirrorMode =
  | 'auto'
  | 'gavo-direct'
  | 'esasky-direct'
  | 'aip'
  | 'ari'
  | 'gavo'
  | 'irsa'
  | 'esa';

export interface StarPackMirrorOption {
  id: StarPackMirrorMode;
  label: string;
}

export const STAR_PACK_MIRROR_OPTIONS: StarPackMirrorOption[] = [
  { id: 'auto', label: '자동 (서버 + GitHub Pages 직접)' },
  { id: 'gavo-direct', label: '직접 연결 · GAVO 독일 (GitHub 호환)' },
  { id: 'esasky-direct', label: '직접 연결 · ESASky 유럽 (GitHub 호환)' },
  { id: 'aip', label: '서버 경유 · Gaia@AIP (독일)' },
  { id: 'ari', label: '서버 경유 · ARI Heidelberg (독일)' },
  { id: 'gavo', label: '서버 경유 · GAVO (독일)' },
  { id: 'irsa', label: '서버 경유 · NASA IRSA (미국)' },
  { id: 'esa', label: '서버 경유 · ESA Gaia (스페인)' },
];

export interface LocalStarCatalogState {
  initialized: boolean;
  installedTiers: InstalledStarPackMeta[];
  totalStars: number;
  totalBytes: number;
  maxMag: number;
  folderStatus: LocalFolderStatus;
  folderDisplayName: string | null;
  persistentStorageGranted: boolean;
  mirrorMode: StarPackMirrorMode;
  downloading: StarPackDownloadProgress | null;
  lastError: string | null;
  revision: number;
}

export interface LocalStarCellData {
  coords: Float32Array; // stride 4: [ra, dec, mag, bv]
  ids: Uint32Array;     // stride 2: [idHi, idLo]
}

export type LocalStarSpatialIndex = Map<string, LocalStarCellData>;

export interface LocalStarSearchHit {
  star: Star;
  score: number;
  badge: string;
  detail?: string;
}

// Binary .noxstars file format header (28 bytes):
// [0..3]   ASCII "NXST"
// [4..5]   uint16 version (1 = coords only; 2 = coords + 64-bit catalog IDs)
// [6..7]   uint16 tier (1..6)
// [8..11]  uint32 starCount
// [12..15] float32 magMin
// [16..19] float32 magMax
// [20..27] float64 savedAt (ms)
// [28 .. 28 + starCount*16]            Float32Array [raDeg, decDeg, mag, bv]
// [28 + starCount*16 .. +starCount*8]  Uint32Array  [idHi, idLo] (version >= 2)
//   idHi === 0xFFFFFFFF -> HIP idLo
//   idHi === 0 && idLo === 0 -> coordinate fallback ID ("Gaia L...")
//   otherwise -> Gaia DR3 64-bit source_id = (BigInt(idHi) << 32n) | BigInt(idLo)
const PACK_MAGIC_0 = 0x4e; // 'N'
const PACK_MAGIC_1 = 0x58; // 'X'
const PACK_MAGIC_2 = 0x53; // 'S'
const PACK_MAGIC_3 = 0x54; // 'T'
const PACK_HEADER_BYTES = 28;
const PACK_VERSION = 2;
const HIP_ID_HI_SENTINEL = 0xffffffff;

const IDB_NAME = 'noxchart_star_catalogs_v1';
const IDB_VERSION = 1;
const STORE_PACKS = 'packs';
const STORE_HANDLES = 'handles';
const FOLDER_HANDLE_KEY = 'noxchart_dir';

// Minimal TypeScript declarations for File System Access API
interface FsPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
interface FsDirectoryHandleLike {
  name: string;
  queryPermission?: (desc?: FsPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (desc?: FsPermissionDescriptor) => Promise<PermissionState>;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FsDirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FsFileHandleLike>;
  removeEntry: (name: string) => Promise<void>;
  values?: () => AsyncIterable<{ kind: 'file' | 'directory'; name: string }>;
}
interface FsFileHandleLike {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: Blob | ArrayBuffer | Uint8Array) => Promise<void>;
    close: () => Promise<void>;
  }>;
}
type PickerStartIn =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'
  | FsDirectoryHandleLike
  | FsFileHandleLike;

interface PickerFileType {
  description?: string;
  accept: Record<string, string[]>;
}

interface WindowWithDirPicker extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    startIn?: PickerStartIn;
    mode?: 'read' | 'readwrite';
  }) => Promise<FsDirectoryHandleLike>;
  showOpenFilePicker?: (options?: {
    id?: string;
    startIn?: PickerStartIn;
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: PickerFileType[];
  }) => Promise<FsFileHandleLike[]>;
  showSaveFilePicker?: (options?: {
    id?: string;
    startIn?: PickerStartIn;
    suggestedName?: string;
    types?: PickerFileType[];
  }) => Promise<FsFileHandleLike>;
}

interface StoredPackRecord {
  tier: number;
  starCount: number;
  byteLength: number;
  magMin: number;
  magMax: number;
  savedAt: number;
  savedToFolder: boolean;
  fileName: string;
  buffer: ArrayBuffer;
}

interface StoredFolderRecord {
  key: string;
  handle: FsDirectoryHandleLike;
  displayName: string;
}

export function getTierFileName(tier: number): string {
  return `noxchart_stars_tier${tier}.noxstars`;
}

function encodeCatalogIdTag(tag?: string): [number, number] {
  if (!tag) return [0, 0];
  const s = tag.trim();
  if (!s) return [0, 0];
  if (s[0] === 'H' || s[0] === 'h') {
    const hip = Number(s.slice(1));
    if (Number.isInteger(hip) && hip > 0 && hip <= 0xfffffffe) {
      return [HIP_ID_HI_SENTINEL, hip >>> 0];
    }
    return [0, 0];
  }
  if (/^\d{1,20}$/.test(s)) {
    try {
      const bi = BigInt(s);
      if (bi > 0n) {
        const hi = Number((bi >> 32n) & 0xffffffffn) >>> 0;
        const lo = Number(bi & 0xffffffffn) >>> 0;
        if (hi !== HIP_ID_HI_SENTINEL) {
          return [hi, lo];
        }
      }
    } catch {
      return [0, 0];
    }
  }
  return [0, 0];
}

export function buildLocalStarObject(
  ra: number,
  dec: number,
  mag: number,
  bv: number,
  idHi: number,
  idLo: number
): Star {
  if (idHi === HIP_ID_HI_SENTINEL && idLo > 0) {
    return {
      id: `HIP ${idLo}`,
      hip: idLo,
      ra,
      dec,
      mag,
      bv,
      con: '',
    };
  }
  if (idHi !== 0 || idLo !== 0) {
    const gaiaFull = ((BigInt(idHi >>> 0) << 32n) | BigInt(idLo >>> 0)).toString();
    return {
      id: `Gaia DR3 ${gaiaFull}`,
      gaiaId: gaiaFull,
      ra,
      dec,
      mag,
      bv,
      con: '',
    };
  }
  const coordId = `Gaia L${Math.round(ra * 1000)}_${Math.round((dec + 90) * 1000)}`;
  return {
    id: coordId,
    gaiaId: coordId.slice(5),
    ra,
    dec,
    mag,
    bv,
    con: '',
  };
}

export function encodeStarPackBinary(
  tier: number,
  magMin: number,
  magMax: number,
  starsFlat: Float32Array,
  starIds: Uint32Array,
  savedAt = Date.now()
): ArrayBuffer {
  const starCount = Math.floor(starsFlat.length / 4);
  const coordsBytes = starCount * 16;
  const idsBytes = starCount * 8;
  const byteLength = PACK_HEADER_BYTES + coordsBytes + idsBytes;
  const buf = new ArrayBuffer(byteLength);
  const u8 = new Uint8Array(buf);
  u8[0] = PACK_MAGIC_0;
  u8[1] = PACK_MAGIC_1;
  u8[2] = PACK_MAGIC_2;
  u8[3] = PACK_MAGIC_3;
  const view = new DataView(buf);
  view.setUint16(4, PACK_VERSION, true);
  view.setUint16(6, tier, true);
  view.setUint32(8, starCount, true);
  view.setFloat32(12, magMin, true);
  view.setFloat32(16, magMax, true);
  view.setFloat64(20, savedAt, true);
  const f32 = new Float32Array(buf, PACK_HEADER_BYTES, starCount * 4);
  f32.set(starsFlat.subarray(0, starCount * 4));
  const u32 = new Uint32Array(buf, PACK_HEADER_BYTES + coordsBytes, starCount * 2);
  u32.set(starIds.subarray(0, starCount * 2));
  return buf;
}

export function decodeStarPackBinary(buffer: ArrayBuffer): {
  tier: number;
  starCount: number;
  magMin: number;
  magMax: number;
  savedAt: number;
  starsFlat: Float32Array;
  starIds: Uint32Array;
} | null {
  if (buffer.byteLength < PACK_HEADER_BYTES) return null;
  const u8 = new Uint8Array(buffer, 0, 4);
  if (
    u8[0] !== PACK_MAGIC_0 ||
    u8[1] !== PACK_MAGIC_1 ||
    u8[2] !== PACK_MAGIC_2 ||
    u8[3] !== PACK_MAGIC_3
  ) {
    return null;
  }
  const view = new DataView(buffer);
  const version = view.getUint16(4, true);
  if (version !== 1 && version !== 2) return null;
  const tier = view.getUint16(6, true);
  const starCount = view.getUint32(8, true);
  const magMin = view.getFloat32(12, true);
  const magMax = view.getFloat32(16, true);
  const savedAt = view.getFloat64(20, true);
  if (tier < 1 || tier > 20) return null;

  const coordsBytes = starCount * 16;
  const expectedBytes =
    version === 2 ? PACK_HEADER_BYTES + coordsBytes + starCount * 8 : PACK_HEADER_BYTES + coordsBytes;
  if (buffer.byteLength < expectedBytes) return null;

  const starsFlat = new Float32Array(buffer, PACK_HEADER_BYTES, starCount * 4);
  const starIds =
    version === 2
      ? new Uint32Array(buffer, PACK_HEADER_BYTES + coordsBytes, starCount * 2)
      : new Uint32Array(starCount * 2);
  return { tier, starCount, magMin, magMax, savedAt, starsFlat, starIds };
}

// IndexedDB helpers
let idbPromise: Promise<IDBDatabase | null> | null = null;

function openStarPackDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PACKS)) {
          db.createObjectStore(STORE_PACKS, { keyPath: 'tier' });
        }
        if (!db.objectStoreNames.contains(STORE_HANDLES)) {
          db.createObjectStore(STORE_HANDLES, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

async function idbGetAllPacks(): Promise<StoredPackRecord[]> {
  const db = await openStarPackDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readonly');
      const req = tx.objectStore(STORE_PACKS).getAll();
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? (req.result as StoredPackRecord[]) : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbGetPack(tier: number): Promise<StoredPackRecord | null> {
  const db = await openStarPackDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readonly');
      const req = tx.objectStore(STORE_PACKS).get(tier);
      req.onsuccess = () => resolve((req.result as StoredPackRecord) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPutPack(record: StoredPackRecord): Promise<boolean> {
  const db = await openStarPackDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      tx.objectStore(STORE_PACKS).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbDeletePack(tier: number): Promise<boolean> {
  const db = await openStarPackDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      tx.objectStore(STORE_PACKS).delete(tier);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGetFolderRecord(): Promise<StoredFolderRecord | null> {
  const db = await openStarPackDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_HANDLES, 'readonly');
      const req = tx.objectStore(STORE_HANDLES).get(FOLDER_HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as StoredFolderRecord) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPutFolderRecord(rec: StoredFolderRecord): Promise<void> {
  const db = await openStarPackDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_HANDLES, 'readwrite');
      tx.objectStore(STORE_HANDLES).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDeleteFolderRecord(): Promise<void> {
  const db = await openStarPackDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_HANDLES, 'readwrite');
      tx.objectStore(STORE_HANDLES).delete(FOLDER_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Spatial tile index: 18 dec bands (10° each) × 36 ra bins (10° each) = 648 cells
// Each cell holds coords Float32Array + ids Uint32Array sorted by magnitude ascending
const DEC_CELL_DEG = 10;
const RA_CELL_DEG = 10;
const DEC_CELL_COUNT = 18;
const RA_CELL_COUNT = 36;

interface LoadedTierEntry {
  meta: InstalledStarPackMeta;
  starsFlat: Float32Array;
  starIds: Uint32Array;
}

const loadedPackDataByTier = new Map<number, LoadedTierEntry>();
let spatialIndex: LocalStarSpatialIndex = new Map();
// O(1) Hipparcos lookup table built from downloaded packs
let hipIndexMap = new Map<number, [number, number, number, number]>();
let activeDirHandle: FsDirectoryHandleLike | null = null;
let activeDownloadAbort: AbortController | null = null;
let initPromise: Promise<void> | null = null;

const stateListeners = new Set<() => void>();

const MIRROR_STORAGE_KEY = 'noxchart_star_pack_mirror_v1';

function readSavedMirrorMode(): StarPackMirrorMode {
  try {
    const raw = localStorage.getItem(MIRROR_STORAGE_KEY);
    if (
      raw === 'auto' ||
      raw === 'gavo-direct' ||
      raw === 'esasky-direct' ||
      raw === 'aip' ||
      raw === 'ari' ||
      raw === 'gavo' ||
      raw === 'irsa' ||
      raw === 'esa'
    ) {
      return raw;
    }
  } catch {
    // Ignore storage read failure
  }
  return 'auto';
}

let currentState: LocalStarCatalogState = {
  initialized: false,
  installedTiers: [],
  totalStars: 0,
  totalBytes: 0,
  maxMag: 8.0,
  folderStatus:
    typeof window !== 'undefined' &&
    typeof (window as WindowWithDirPicker).showDirectoryPicker === 'function'
      ? 'disconnected'
      : 'unsupported',
  folderDisplayName: null,
  persistentStorageGranted: false,
  mirrorMode: typeof window !== 'undefined' ? readSavedMirrorMode() : 'auto',
  downloading: null,
  lastError: null,
  revision: 0,
};

export function setStarPackMirrorMode(mode: StarPackMirrorMode): void {
  try {
    localStorage.setItem(MIRROR_STORAGE_KEY, mode);
  } catch {
    // Ignore storage write failure
  }
  updateStateSummary({ mirrorMode: mode });
}

function rebuildSpatialIndex(): void {
  const coordBuckets = new Map<string, number[]>();
  const idBuckets = new Map<string, number[]>();
  const nextHipMap = new Map<number, [number, number, number, number]>();
  const tierEntries = Array.from(loadedPackDataByTier.values()).sort(
    (a, b) => a.meta.tier - b.meta.tier
  );

  for (const entry of tierEntries) {
    const flat = entry.starsFlat;
    const ids = entry.starIds;
    const count = Math.floor(flat.length / 4);
    for (let idx = 0; idx < count; idx++) {
      const ci = idx * 4;
      const ii = idx * 2;
      const ra = flat[ci];
      const dec = flat[ci + 1];
      const mag = flat[ci + 2];
      const bv = flat[ci + 3];
      const idHi = ids[ii] ?? 0;
      const idLo = ids[ii + 1] ?? 0;
      const normRa = ((ra % 360) + 360) % 360;

      if (idHi === HIP_ID_HI_SENTINEL && idLo > 0 && !nextHipMap.has(idLo)) {
        nextHipMap.set(idLo, [normRa, dec, mag, bv]);
      }

      const dBin = Math.max(0, Math.min(DEC_CELL_COUNT - 1, Math.floor((dec + 90) / DEC_CELL_DEG)));
      const rBin = Math.max(0, Math.min(RA_CELL_COUNT - 1, Math.floor(normRa / RA_CELL_DEG)));
      const key = `${dBin}_${rBin}`;
      let cArr = coordBuckets.get(key);
      let iArr = idBuckets.get(key);
      if (!cArr || !iArr) {
        cArr = [];
        iArr = [];
        coordBuckets.set(key, cArr);
        idBuckets.set(key, iArr);
      }
      cArr.push(normRa, dec, mag, bv);
      iArr.push(idHi, idLo);
    }
  }

  const nextIndex: LocalStarSpatialIndex = new Map();
  for (const [key, cArr] of coordBuckets.entries()) {
    const iArr = idBuckets.get(key)!;
    const count = cArr.length / 4;
    const order = new Uint32Array(count);
    for (let i = 0; i < count; i++) order[i] = i;
    order.sort((a, b) => cArr[a * 4 + 2] - cArr[b * 4 + 2]);
    const sortedCoords = new Float32Array(count * 4);
    const sortedIds = new Uint32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const srcIdx = order[i];
      const srcC = srcIdx * 4;
      const dstC = i * 4;
      sortedCoords[dstC] = cArr[srcC];
      sortedCoords[dstC + 1] = cArr[srcC + 1];
      sortedCoords[dstC + 2] = cArr[srcC + 2];
      sortedCoords[dstC + 3] = cArr[srcC + 3];

      const srcI = srcIdx * 2;
      const dstI = i * 2;
      sortedIds[dstI] = iArr[srcI];
      sortedIds[dstI + 1] = iArr[srcI + 1];
    }
    nextIndex.set(key, { coords: sortedCoords, ids: sortedIds });
  }
  spatialIndex = nextIndex;
  hipIndexMap = nextHipMap;
}

function updateStateSummary(patch?: Partial<LocalStarCatalogState>): void {
  const installedTiers = Array.from(loadedPackDataByTier.values())
    .map((v) => v.meta)
    .sort((a, b) => a.tier - b.tier);

  let totalStars = 0;
  let totalBytes = 0;
  let maxMag = 8.0;
  for (const m of installedTiers) {
    totalStars += m.starCount;
    totalBytes += m.byteLength;
    if (m.magMax > maxMag) maxMag = m.magMax;
  }

  currentState = {
    ...currentState,
    ...patch,
    installedTiers,
    totalStars,
    totalBytes,
    maxMag,
    revision: currentState.revision + 1,
  };

  for (const fn of stateListeners) {
    fn();
  }
}

export function getLocalStarCatalogState(): LocalStarCatalogState {
  return currentState;
}

export function getLocalStarSpatialIndex(): LocalStarSpatialIndex {
  return spatialIndex;
}

export function subscribeLocalStarCatalogs(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function getVisibleLocalStarCellKeys(
  raHours: number,
  decDeg: number,
  fszDeg: number
): string[] {
  if (spatialIndex.size === 0) return [];
  const halfSpan = Math.min(72, fszDeg * 0.72);
  const decMin = Math.max(-90, decDeg - halfSpan);
  const decMax = Math.min(90, decDeg + halfSpan);
  const startDec = Math.max(0, Math.floor((decMin + 90) / DEC_CELL_DEG));
  const endDec = Math.min(
    DEC_CELL_COUNT - 1,
    Math.floor((Math.min(89.999, decMax) + 90) / DEC_CELL_DEG)
  );

  const raCenterDeg = ((raHours * 15) % 360 + 360) % 360;
  const keys: string[] = [];

  for (let d = startDec; d <= endDec; d++) {
    const bandDecMin = -90 + d * DEC_CELL_DEG;
    const bandDecMax = bandDecMin + DEC_CELL_DEG;
    const maxAbsDec = Math.max(Math.abs(bandDecMin), Math.abs(bandDecMax));
    const cosBand = Math.max(0.12, Math.cos(Math.min(85, maxAbsDec) * DEG2RAD));
    const raHalfDeg = Math.min(180, halfSpan / cosBand);

    if (raHalfDeg >= 170) {
      for (let r = 0; r < RA_CELL_COUNT; r++) {
        const k = `${d}_${r}`;
        if (spatialIndex.has(k)) keys.push(k);
      }
    } else {
      const startRa = Math.floor((raCenterDeg - raHalfDeg) / RA_CELL_DEG);
      const endRa = Math.floor((raCenterDeg + raHalfDeg) / RA_CELL_DEG);
      const seen = new Set<number>();
      for (let r = startRa; r <= endRa; r++) {
        const normR = ((r % RA_CELL_COUNT) + RA_CELL_COUNT) % RA_CELL_COUNT;
        if (seen.has(normR)) continue;
        seen.add(normR);
        const k = `${d}_${normR}`;
        if (spatialIndex.has(k)) keys.push(k);
      }
    }
  }
  return keys;
}

// Parse coordinate queries like:
// "05h 35m -05° 23'", "5h35m17s -5d23m", "5:35 -5:23", "83.82 -5.39", "83.82, -5.39"
function parseCoordinateQuery(raw: string): { raDeg: number; decDeg: number } | null {
  const s = raw
    .trim()
    .replace(/^ra\s*/i, '')
    .replace(/\bdec\s*/gi, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ');

  // HMS + DMS (e.g. 05h 35m 17s -05° 23' 28" or 5h35m -5d23m)
  const hmsDms =
    /^(\d{1,2})\s*[h시:]\s*(\d{1,2}(?:\.\d+)?)(?:\s*[m분:]\s*(\d{1,2}(?:\.\d+)?)?)?[s초]?\s+([+-]?\d{1,2})\s*[°d도:]\s*(\d{1,2}(?:\.\d+)?)(?:\s*['′m분:]\s*(\d{1,2}(?:\.\d+)?)?)?["″s초]?$/i.exec(
      s
    );
  if (hmsDms) {
    const h = Number(hmsDms[1]);
    const m = Number(hmsDms[2]);
    const sec = hmsDms[3] ? Number(hmsDms[3]) : 0;
    const dSign = hmsDms[4].startsWith('-') ? -1 : 1;
    const dAbs = Math.abs(Number(hmsDms[4]));
    const dm = Number(hmsDms[5]);
    const ds = hmsDms[6] ? Number(hmsDms[6]) : 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60 && dAbs <= 90 && dm >= 0 && dm < 60) {
      const raDeg = (h + m / 60 + sec / 3600) * 15;
      const decDeg = dSign * (dAbs + dm / 60 + ds / 3600);
      if (Math.abs(decDeg) <= 90) return { raDeg, decDeg };
    }
  }

  // Decimal pair: "83.82 -5.39" or "5.58h -5.39"
  const decPair = /^(\d{1,3}(?:\.\d+)?)(h)?\s+([+-]?\d{1,2}(?:\.\d+)?)[°d]?$/i.exec(s);
  if (decPair) {
    const first = Number(decPair[1]);
    const isHours = Boolean(decPair[2]);
    const decDeg = Number(decPair[3]);
    const raDeg = isHours ? first * 15 : first;
    if (
      Number.isFinite(raDeg) &&
      Number.isFinite(decDeg) &&
      raDeg >= 0 &&
      raDeg <= 360 &&
      decDeg >= -90 &&
      decDeg <= 90
    ) {
      return { raDeg: ((raDeg % 360) + 360) % 360, decDeg };
    }
  }

  return null;
}

function formatSeparationLabel(deg: number): string {
  const arcmin = deg * 60;
  if (arcmin < 1) {
    return `이격 ${(arcmin * 60).toFixed(0)}"`;
  }
  if (arcmin < 60) {
    return `이격 ${arcmin.toFixed(1)}'`;
  }
  return `이격 ${deg.toFixed(2)}°`;
}

/**
 * Fast multi-mode search across all locally downloaded star catalogs (Explore -> All):
 * 1. Exact/prefix HIP number lookup (O(1) map + fast scan)
 * 2. Gaia DR3 source_id & coordinate-ID ("Gaia L...") lookup
 * 3. RA/Dec coordinate proximity search using the 10°×10° spatial index (< 1 ms)
 * 4. Magnitude / range query ("10m", "11등급", "9~10m") prioritized around current chart center
 * 5. Keyword / tier browsing ("로컬", "가이아", "gaia", "1단계"~"6단계") around current chart center
 */
export function searchLocalStarCatalogs(
  rawQuery: string,
  viewCenter: { raHours: number; decDeg: number },
  maxResults = 35
): LocalStarSearchHit[] {
  if (currentState.totalStars === 0 || spatialIndex.size === 0) return [];
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const q = trimmed.toLowerCase();
  const qCompact = q.replace(/\s+/g, '');
  const hits: LocalStarSearchHit[] = [];
  const seenIds = new Set<string>();

  const pushHit = (star: Star, score: number, badge: string, detail?: string) => {
    if (seenIds.has(star.id)) return;
    seenIds.add(star.id);
    hits.push({ star, score, badge, detail });
  };

  // Mode 1: Coordinate proximity search ("05h 35m -05° 23'", "83.8 -5.4")
  const coordTarget = parseCoordinateQuery(trimmed);
  if (coordTarget) {
    const cellKeys = getVisibleLocalStarCellKeys(coordTarget.raDeg / 15, coordTarget.decDeg, 16);
    const nearby: { star: Star; dist: number }[] = [];
    for (let c = 0; c < cellKeys.length; c++) {
      const cell = spatialIndex.get(cellKeys[c]);
      if (!cell) continue;
      const { coords, ids } = cell;
      const count = coords.length / 4;
      for (let i = 0; i < count; i++) {
        const ci = i * 4;
        const ra = coords[ci];
        const dec = coords[ci + 1];
        if (Math.abs(dec - coordTarget.decDeg) > 4.0) continue;
        let dRa = Math.abs(ra - coordTarget.raDeg);
        if (dRa > 180) dRa = 360 - dRa;
        if (dRa * Math.max(0.1, Math.cos(coordTarget.decDeg * DEG2RAD)) > 4.0) continue;
        const dist = angularDistanceDeg(ra, dec, coordTarget.raDeg, coordTarget.decDeg);
        if (dist <= 3.5) {
          const ii = i * 2;
          const star = buildLocalStarObject(ra, dec, coords[ci + 2], coords[ci + 3], ids[ii], ids[ii + 1]);
          nearby.push({ star, dist });
        }
      }
    }
    nearby.sort((a, b) => a.dist - b.dist || a.star.mag - b.star.mag);
    for (let i = 0; i < Math.min(maxResults, nearby.length); i++) {
      const n = nearby[i];
      pushHit(
        n.star,
        118 - Math.min(40, n.dist * 12),
        n.star.hip ? '로컬 HIP' : '로컬 Gaia',
        formatSeparationLabel(n.dist)
      );
    }
    return hits;
  }

  // Mode 2: HIP number search ("HIP 85605", "hip85605", or 2-6 digits)
  const hipMatch = /^(?:hip\s*)?(\d{2,6})$/i.exec(qCompact);
  if (hipMatch && hipIndexMap.size > 0) {
    const digits = hipMatch[1];
    const exactHip = Number(digits);
    const exactRow = hipIndexMap.get(exactHip);
    if (exactRow) {
      const star = buildLocalStarObject(
        exactRow[0],
        exactRow[1],
        exactRow[2],
        exactRow[3],
        HIP_ID_HI_SENTINEL,
        exactHip
      );
      pushHit(star, 122, '로컬 HIP', '로컬 목록');
    }
    if (digits.length >= 3) {
      for (const [hipNum, row] of hipIndexMap.entries()) {
        if (hits.length >= maxResults) break;
        if (hipNum === exactHip) continue;
        if (String(hipNum).startsWith(digits)) {
          const star = buildLocalStarObject(
            row[0],
            row[1],
            row[2],
            row[3],
            HIP_ID_HI_SENTINEL,
            hipNum
          );
          pushHit(star, 94, '로컬 HIP', '로컬 목록');
        }
      }
    }
  }

  // Mode 3: Gaia DR3 / Gaia L... ID search ("Gaia DR3 429...", "Gaia 321...", "Gaia L83812_...", or 5+ digits)
  const gaiaCoordIdMatch = /^(?:gaia\s*)?l(\d{2,6})(?:_(\d{1,6}))?$/i.exec(qCompact);
  if (gaiaCoordIdMatch) {
    const raPrefix = gaiaCoordIdMatch[1];
    const decPrefix = gaiaCoordIdMatch[2] || '';
    for (const entry of loadedPackDataByTier.values()) {
      const flat = entry.starsFlat;
      const ids = entry.starIds;
      const count = flat.length / 4;
      for (let i = 0; i < count && hits.length < maxResults; i++) {
        const ii = i * 2;
        if (ids[ii] !== 0 || ids[ii + 1] !== 0) continue;
        const ci = i * 4;
        const raKey = String(Math.round(flat[ci] * 1000));
        if (!raKey.startsWith(raPrefix)) continue;
        const decKey = String(Math.round((flat[ci + 1] + 90) * 1000));
        if (decPrefix && !decKey.startsWith(decPrefix)) continue;
        const star = buildLocalStarObject(flat[ci], flat[ci + 1], flat[ci + 2], flat[ci + 3], 0, 0);
        const exact = raKey === raPrefix && (!decPrefix || decKey === decPrefix);
        pushHit(star, exact ? 120 : 92, '로컬 Gaia', `${entry.meta.tier}단계`);
      }
    }
    if (hits.length > 0) return hits;
  }

  const gaiaDigitsMatch = /^(?:gaia(?:dr3)?)?(\d{4,20})$/i.exec(qCompact);
  const explicitGaiaIdQuery =
    qCompact.startsWith('gaia') && /\d{2,}/.test(qCompact)
      ? qCompact.replace(/^gaia(?:dr3)?/i, '')
      : gaiaDigitsMatch && gaiaDigitsMatch[1].length >= 5
      ? gaiaDigitsMatch[1]
      : null;

  if (explicitGaiaIdQuery && /^\d+$/.test(explicitGaiaIdQuery)) {
    const needle = explicitGaiaIdQuery;
    const isLongExact = needle.length >= 12;
    let exactHi = -1;
    let exactLo = -1;
    if (isLongExact) {
      try {
        const bi = BigInt(needle);
        exactHi = Number((bi >> 32n) & 0xffffffffn) >>> 0;
        exactLo = Number(bi & 0xffffffffn) >>> 0;
      } catch {
        exactHi = -1;
      }
    }

    for (const entry of loadedPackDataByTier.values()) {
      const flat = entry.starsFlat;
      const ids = entry.starIds;
      const count = flat.length / 4;
      for (let i = 0; i < count && hits.length < maxResults; i++) {
        const ii = i * 2;
        const idHi = ids[ii];
        const idLo = ids[ii + 1];
        if ((idHi === 0 && idLo === 0) || idHi === HIP_ID_HI_SENTINEL) continue;

        if (exactHi >= 0 && idHi === exactHi && idLo === exactLo) {
          const ci = i * 4;
          const star = buildLocalStarObject(
            flat[ci],
            flat[ci + 1],
            flat[ci + 2],
            flat[ci + 3],
            idHi,
            idLo
          );
          pushHit(star, 125, '로컬 Gaia', `${entry.meta.tier}단계`);
          continue;
        }

        const fullStr = ((BigInt(idHi >>> 0) << 32n) | BigInt(idLo >>> 0)).toString();
        if (fullStr === needle) {
          const ci = i * 4;
          const star = buildLocalStarObject(
            flat[ci],
            flat[ci + 1],
            flat[ci + 2],
            flat[ci + 3],
            idHi,
            idLo
          );
          pushHit(star, 125, '로컬 Gaia', `${entry.meta.tier}단계`);
        } else if (
          fullStr.startsWith(needle) ||
          fullStr.endsWith(needle) ||
          (needle.length >= 6 && fullStr.includes(needle))
        ) {
          const ci = i * 4;
          const star = buildLocalStarObject(
            flat[ci],
            flat[ci + 1],
            flat[ci + 2],
            flat[ci + 3],
            idHi,
            idLo
          );
          pushHit(star, fullStr.endsWith(needle) ? 112 : 96, '로컬 Gaia', `${entry.meta.tier}단계`);
        }
      }
    }
    if (hits.length > 0) return hits;
  }

  // Mode 4: Magnitude / range filter ("9.5m", "10등급", "9~10m", "10.5-11.2등급")
  const magRangeMatch =
    /^(\d{1,2}(?:\.\d+)?)\s*[~-]\s*(\d{1,2}(?:\.\d+)?)\s*(?:m|mag|등급)$/i.exec(q);
  const magSingleMatch = /^(\d{1,2}(?:\.\d+)?)\s*(?:m|mag|등급)$/i.exec(q);
  if (magRangeMatch || magSingleMatch) {
    let minM = 8.0;
    let maxM = 14.0;
    if (magRangeMatch) {
      minM = Math.min(Number(magRangeMatch[1]), Number(magRangeMatch[2]));
      maxM = Math.max(Number(magRangeMatch[1]), Number(magRangeMatch[2]));
    } else if (magSingleMatch) {
      const targetM = Number(magSingleMatch[1]);
      const hasDecimal = magSingleMatch[1].includes('.');
      minM = hasDecimal ? targetM - 0.15 : targetM;
      maxM = hasDecimal ? targetM + 0.15 : targetM + 0.99;
    }

    const viewCells = getVisibleLocalStarCellKeys(viewCenter.raHours, viewCenter.decDeg, 35);
    const searchCells = viewCells.length > 0 ? viewCells : Array.from(spatialIndex.keys()).slice(0, 24);
    const candidates: { star: Star; dist: number }[] = [];
    const viewRaDeg = ((viewCenter.raHours * 15) % 360 + 360) % 360;

    for (let c = 0; c < searchCells.length && candidates.length < 240; c++) {
      const cell = spatialIndex.get(searchCells[c]);
      if (!cell) continue;
      const { coords, ids } = cell;
      const count = coords.length / 4;
      for (let i = 0; i < count && candidates.length < 240; i++) {
        const ci = i * 4;
        const mag = coords[ci + 2];
        if (mag > maxM) break;
        if (mag < minM) continue;
        const ii = i * 2;
        const star = buildLocalStarObject(coords[ci], coords[ci + 1], mag, coords[ci + 3], ids[ii], ids[ii + 1]);
        const dist = angularDistanceDeg(star.ra, star.dec, viewRaDeg, viewCenter.decDeg);
        candidates.push({ star, dist });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist || a.star.mag - b.star.mag);
    for (let i = 0; i < Math.min(maxResults, candidates.length); i++) {
      const item = candidates[i];
      pushHit(
        item.star,
        92,
        item.star.hip ? '로컬 HIP' : '로컬 Gaia',
        `현재 시야 ${formatSeparationLabel(item.dist)}`
      );
    }
    return hits;
  }

  // Mode 5: Keyword / tier browsing ("로컬", "로컬별", "가이아", "gaia", "다운로드", "별목록", "1단계"~"6단계")
  const tierMatch = /^([1-6])\s*단계$/.exec(q);
  const wantsLocalBrowse =
    Boolean(tierMatch) ||
    q === 'gaia' ||
    q === 'gaiadr3' ||
    q.includes('가이아') ||
    q.includes('로컬') ||
    q.includes('다운로드') ||
    q.includes('별목록');

  if (wantsLocalBrowse) {
    const viewRaDeg = ((viewCenter.raHours * 15) % 360 + 360) % 360;
    const targetTier = tierMatch ? Number(tierMatch[1]) : null;
    const candidates: { star: Star; dist: number; tierLabel?: string }[] = [];

    if (targetTier !== null) {
      const entry = loadedPackDataByTier.get(targetTier);
      if (entry) {
        const flat = entry.starsFlat;
        const ids = entry.starIds;
        const count = flat.length / 4;
        for (let i = 0; i < count; i++) {
          const ci = i * 4;
          const ra = flat[ci];
          const dec = flat[ci + 1];
          if (Math.abs(dec - viewCenter.decDeg) > 18) continue;
          const dist = angularDistanceDeg(ra, dec, viewRaDeg, viewCenter.decDeg);
          if (dist <= 20) {
            const ii = i * 2;
            const star = buildLocalStarObject(ra, dec, flat[ci + 2], flat[ci + 3], ids[ii], ids[ii + 1]);
            candidates.push({ star, dist, tierLabel: `${targetTier}단계` });
            if (candidates.length >= 200) break;
          }
        }
        // Fallback if current view has few stars in that tier
        if (candidates.length < 15) {
          for (let i = 0; i < Math.min(count, 40); i++) {
            const ci = i * 4;
            const ii = i * 2;
            const star = buildLocalStarObject(
              flat[ci],
              flat[ci + 1],
              flat[ci + 2],
              flat[ci + 3],
              ids[ii],
              ids[ii + 1]
            );
            const dist = angularDistanceDeg(star.ra, star.dec, viewRaDeg, viewCenter.decDeg);
            candidates.push({ star, dist, tierLabel: `${targetTier}단계` });
          }
        }
      }
    } else {
      const viewCells = getVisibleLocalStarCellKeys(viewCenter.raHours, viewCenter.decDeg, 24);
      const cellsToScan = viewCells.length > 0 ? viewCells : Array.from(spatialIndex.keys()).slice(0, 16);
      for (let c = 0; c < cellsToScan.length && candidates.length < 220; c++) {
        const cell = spatialIndex.get(cellsToScan[c]);
        if (!cell) continue;
        const { coords, ids } = cell;
        const count = Math.min(40, coords.length / 4);
        for (let i = 0; i < count; i++) {
          const ci = i * 4;
          const ii = i * 2;
          const star = buildLocalStarObject(
            coords[ci],
            coords[ci + 1],
            coords[ci + 2],
            coords[ci + 3],
            ids[ii],
            ids[ii + 1]
          );
          const dist = angularDistanceDeg(star.ra, star.dec, viewRaDeg, viewCenter.decDeg);
          candidates.push({ star, dist });
        }
      }
    }

    candidates.sort((a, b) => a.star.mag - b.star.mag || a.dist - b.dist);
    for (let i = 0; i < Math.min(maxResults, candidates.length); i++) {
      const item = candidates[i];
      pushHit(
        item.star,
        90,
        item.star.hip ? '로컬 HIP' : '로컬 Gaia',
        item.tierLabel
          ? `${item.tierLabel} · ${formatSeparationLabel(item.dist)}`
          : `시야 주변 · ${formatSeparationLabel(item.dist)}`
      );
    }
  }

  return hits;
}

/**
 * Collects all locally downloaded stars that project inside the current chart viewport frame
 * up to the requested magnitude range, using the 10°×10° magnitude-sorted spatial index.
 */
export function getLocalStarsInFrame(
  viewCenter: { raHours: number; decDeg: number; fszDeg: number },
  magMin: number,
  magMax: number,
  isInFrame: (raDeg: number, decDeg: number) => boolean,
  maxStars = 4000
): { stars: Star[]; totalCount: number } {
  if (currentState.totalStars === 0 || spatialIndex.size === 0) {
    return { stars: [], totalCount: 0 };
  }
  const searchFsz = Math.min(180, Math.max(2, viewCenter.fszDeg * 1.48));
  const cellKeys = getVisibleLocalStarCellKeys(viewCenter.raHours, viewCenter.decDeg, searchFsz);
  const collected: Star[] = [];
  let totalCount = 0;
  const collectCap = Math.max(maxStars * 2, 6000);

  for (let c = 0; c < cellKeys.length; c++) {
    const cell = spatialIndex.get(cellKeys[c]);
    if (!cell || cell.coords.length < 4) continue;
    const { coords, ids } = cell;
    const count = coords.length / 4;
    for (let i = 0; i < count; i++) {
      const ci = i * 4;
      const mag = coords[ci + 2];
      if (mag > magMax) break; // Sorted ascending by magnitude
      if (mag < magMin) continue;
      const ra = coords[ci];
      const dec = coords[ci + 1];
      if (!isInFrame(ra, dec)) continue;
      totalCount++;
      if (collected.length < collectCap) {
        const ii = i * 2;
        collected.push(buildLocalStarObject(ra, dec, mag, coords[ci + 3], ids[ii] ?? 0, ids[ii + 1] ?? 0));
      }
    }
  }

  collected.sort((a, b) => a.mag - b.mag);
  return {
    stars: collected.slice(0, maxStars),
    totalCount,
  };
}

async function writePackToDirectory(
  dir: FsDirectoryHandleLike,
  fileName: string,
  buffer: ArrayBuffer
): Promise<boolean> {
  try {
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

async function writeManifestToDirectory(dir: FsDirectoryHandleLike): Promise<void> {
  try {
    const manifest = {
      app: 'NoxChart',
      formatVersion: PACK_VERSION,
      updatedAt: new Date().toISOString(),
      packs: Array.from(loadedPackDataByTier.values())
        .map((v) => v.meta)
        .sort((a, b) => a.tier - b.tier),
    };
    const fileHandle = await dir.getFileHandle('noxchart_catalog_manifest.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(
      new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
    );
    await writable.close();
  } catch {
    // Non-fatal
  }
}

async function syncDirectoryWithMemory(dir: FsDirectoryHandleLike): Promise<number> {
  let importedCount = 0;

  // 1. Scan directory for existing .noxstars pack files and load any missing in memory/IndexedDB
  if (typeof dir.values === 'function') {
    try {
      for await (const entry of dir.values()) {
        if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.noxstars')) continue;
        try {
          const fh = await dir.getFileHandle(entry.name);
          const file = await fh.getFile();
          const buf = await file.arrayBuffer();
          const decoded = decodeStarPackBinary(buf);
          if (!decoded) continue;

          const existing = loadedPackDataByTier.get(decoded.tier);
          if (!existing || existing.meta.savedAt < decoded.savedAt) {
            const meta: InstalledStarPackMeta = {
              tier: decoded.tier,
              starCount: decoded.starCount,
              byteLength: buf.byteLength,
              magMin: decoded.magMin,
              magMax: decoded.magMax,
              savedAt: decoded.savedAt,
              savedToFolder: true,
              fileName: getTierFileName(decoded.tier),
            };
            loadedPackDataByTier.set(decoded.tier, {
              meta,
              starsFlat: decoded.starsFlat,
              starIds: decoded.starIds,
            });
            await idbPutPack({ ...meta, buffer: buf });
            importedCount++;
          } else if (!existing.meta.savedToFolder) {
            existing.meta = { ...existing.meta, savedToFolder: true };
            const rec = await idbGetPack(decoded.tier);
            if (rec) await idbPutPack({ ...rec, savedToFolder: true });
          }
        } catch {
          // Ignore malformed individual files
        }
      }
    } catch {
      // Ignore directory enumeration failure
    }
  }

  // 2. Push any IndexedDB-only packs into the connected noxchart folder so they persist on disk
  for (const [tier, entry] of loadedPackDataByTier.entries()) {
    if (!entry.meta.savedToFolder) {
      const rec = await idbGetPack(tier);
      const buf =
        rec?.buffer ??
        encodeStarPackBinary(
          tier,
          entry.meta.magMin,
          entry.meta.magMax,
          entry.starsFlat,
          entry.starIds,
          entry.meta.savedAt
        );
      const ok = await writePackToDirectory(dir, entry.meta.fileName, buf);
      if (ok) {
        entry.meta = { ...entry.meta, savedToFolder: true };
        await idbPutPack({ ...entry.meta, buffer: buf });
      }
    }
  }

  await writeManifestToDirectory(dir);
  if (importedCount > 0) {
    rebuildSpatialIndex();
  }
  return importedCount;
}

export async function initLocalStarCatalogs(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    let persistentGranted = false;
    try {
      if (navigator.storage?.persisted) {
        persistentGranted = await navigator.storage.persisted();
        if (!persistentGranted && navigator.storage.persist) {
          persistentGranted = await navigator.storage.persist();
        }
      }
    } catch {
      // Ignore storage persistence API errors
    }

    const records = await idbGetAllPacks();
    for (const rec of records) {
      const decoded = decodeStarPackBinary(rec.buffer);
      if (!decoded) continue;
      loadedPackDataByTier.set(decoded.tier, {
        meta: {
          tier: decoded.tier,
          starCount: decoded.starCount,
          byteLength: rec.buffer.byteLength,
          magMin: decoded.magMin,
          magMax: decoded.magMax,
          savedAt: decoded.savedAt,
          savedToFolder: Boolean(rec.savedToFolder),
          fileName: rec.fileName || getTierFileName(decoded.tier),
        },
        starsFlat: decoded.starsFlat,
        starIds: decoded.starIds,
      });
    }
    rebuildSpatialIndex();

    const supportsDirPicker =
      typeof window !== 'undefined' &&
      typeof (window as WindowWithDirPicker).showDirectoryPicker === 'function';
    let folderStatus: LocalFolderStatus = supportsDirPicker ? 'disconnected' : 'unsupported';
    let folderDisplayName: string | null = null;

    if (supportsDirPicker) {
      const savedFolder = await idbGetFolderRecord();
      if (savedFolder?.handle) {
        folderDisplayName = savedFolder.displayName || '문서/noxchart';
        try {
          const perm = savedFolder.handle.queryPermission
            ? await savedFolder.handle.queryPermission({ mode: 'readwrite' })
            : 'granted';
          if (perm === 'granted') {
            activeDirHandle = savedFolder.handle;
            folderStatus = 'connected';
            await syncDirectoryWithMemory(activeDirHandle);
          } else {
            activeDirHandle = savedFolder.handle;
            folderStatus = 'needs-permission';
          }
        } catch {
          folderStatus = 'disconnected';
        }
      }
    }

    updateStateSummary({
      initialized: true,
      folderStatus,
      folderDisplayName,
      persistentStorageGranted: persistentGranted,
    });
  })();
  return initPromise;
}

export async function connectNoxchartFolder(): Promise<{
  ok: boolean;
  message: string;
  importedCount: number;
}> {
  const win = window as WindowWithDirPicker;
  if (typeof win.showDirectoryPicker !== 'function') {
    updateStateSummary({ folderStatus: 'unsupported' });
    return {
      ok: false,
      message:
        '현재 브라우저는 폴더 직접 연결을 지원하지 않습니다. 별 목록은 브라우저 영구 저장소(IndexedDB)에 자동 보관되며 파일 저장/불러오기로 백업할 수 있습니다.',
      importedCount: 0,
    };
  }

  try {
    if (activeDirHandle && currentState.folderStatus === 'needs-permission') {
      const reqPerm = activeDirHandle.requestPermission
        ? await activeDirHandle.requestPermission({ mode: 'readwrite' })
        : 'granted';
      if (reqPerm === 'granted') {
        const importedCount = await syncDirectoryWithMemory(activeDirHandle);
        updateStateSummary({
          folderStatus: 'connected',
          lastError: null,
        });
        return {
          ok: true,
          message:
            importedCount > 0
              ? `${currentState.folderDisplayName || '문서/noxchart'} 폴더에 다시 연결하여 별 목록 ${importedCount}개를 불러왔습니다.`
              : `${currentState.folderDisplayName || '문서/noxchart'} 폴더에 다시 연결했습니다.`,
          importedCount,
        };
      }
    }

    const picked = await win.showDirectoryPicker({
      id: 'noxchart-star-catalogs',
      startIn: 'documents',
      mode: 'readwrite',
    });

    let targetDir = picked;
    let displayName = `${picked.name}/noxchart`;
    if (picked.name.toLowerCase() === 'noxchart') {
      displayName = '문서/noxchart';
    } else {
      targetDir = await picked.getDirectoryHandle('noxchart', { create: true });
      const lower = picked.name.toLowerCase();
      if (lower === 'documents' || lower === '문서') {
        displayName = '문서/noxchart';
      }
    }

    activeDirHandle = targetDir;
    await idbPutFolderRecord({
      key: FOLDER_HANDLE_KEY,
      handle: targetDir,
      displayName,
    });

    const importedCount = await syncDirectoryWithMemory(targetDir);
    updateStateSummary({
      folderStatus: 'connected',
      folderDisplayName: displayName,
      lastError: null,
    });

    return {
      ok: true,
      message:
        importedCount > 0
          ? `${displayName} 폴더를 연결하고 기존 별 목록 ${importedCount}개를 자동으로 불러왔습니다.`
          : `${displayName} 폴더를 연결했습니다. 내려받는 별 목록이 이곳에 영구 저장됩니다.`,
      importedCount,
    };
  } catch (err) {
    const domErr = err as { name?: string; message?: string };
    if (domErr?.name === 'AbortError') {
      return { ok: false, message: '폴더 선택이 취소되었습니다.', importedCount: 0 };
    }
    if (domErr?.name === 'SecurityError') {
      updateStateSummary({ folderStatus: 'unsupported' });
      return {
        ok: false,
        message:
          '미리보기 프레임(iframe) 보안 정책으로 폴더 직접 접근이 제한됩니다. 새 탭에서 열면 문서/noxchart 폴더를 바로 연결할 수 있으며, 지금도 브라우저 영구 저장소와 파일 저장/불러오기로 안전하게 보관됩니다.',
        importedCount: 0,
      };
    }
    return {
      ok: false,
      message: '폴더 연결 중 오류가 발생했습니다. 브라우저 영구 저장소에 자동 보관됩니다.',
      importedCount: 0,
    };
  }
}

export async function disconnectNoxchartFolder(): Promise<void> {
  activeDirHandle = null;
  await idbDeleteFolderRecord();
  const supportsDirPicker =
    typeof window !== 'undefined' &&
    typeof (window as WindowWithDirPicker).showDirectoryPicker === 'function';
  updateStateSummary({
    folderStatus: supportsDirPicker ? 'disconnected' : 'unsupported',
    folderDisplayName: null,
  });
}

export function getNextAvailableTier(): StarCatalogTierDef | null {
  const installedSet = new Set(currentState.installedTiers.map((m) => m.tier));
  for (const def of STAR_CATALOG_TIERS) {
    if (!installedSet.has(def.tier)) return def;
  }
  return null;
}

export function cancelStarPackDownload(): void {
  if (activeDownloadAbort) {
    activeDownloadAbort.abort();
    activeDownloadAbort = null;
  }
}

interface ChunkZone {
  raMin: number;
  raMax: number;
  decMin: number;
  decMax: number;
  source: 'hip-ultra' | 'gaia';
}

function buildChunksForTier(def: StarCatalogTierDef): ChunkZone[] {
  const chunks: ChunkZone[] = [];
  if (def.includeHipparcosUltra) {
    chunks.push({
      raMin: 0,
      raMax: 360,
      decMin: -90,
      decMax: 90,
      source: 'hip-ultra',
    });
  }
  const decStep = 180 / def.decBands;
  const raStep = 360 / def.raBands;
  for (let d = 0; d < def.decBands; d++) {
    const decMin = -90 + d * decStep;
    const decMax = d === def.decBands - 1 ? 90 : decMin + decStep;
    for (let r = 0; r < def.raBands; r++) {
      const raMin = r * raStep;
      const raMax = r === def.raBands - 1 ? 360 : raMin + raStep;
      chunks.push({
        raMin,
        raMax,
        decMin,
        decMax,
        source: 'gaia',
      });
    }
  }
  return chunks;
}

type CompactStarTuple = [number, number, number, number, string?];

// Remember when running on a static host (e.g. GitHub Pages) without /api/* Express routes
let serverStarPackApiAvailable: boolean | null = null;

function parseDirectGaiaCsvToCompact(csv: string): CompactStarTuple[] | null {
  if (!csv || csv.trimStart().startsWith('<')) return null;
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0]
    .toLowerCase()
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''));
  const hasSeparateBpRp =
    header.includes('phot_bp_mean_mag') && header.includes('phot_rp_mean_mag');
  const rows: CompactStarTuple[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < 4) continue;
    const sid = cols[0].trim().replace(/^"|"$/g, '');
    const ra = Number(cols[1]);
    const dec = Number(cols[2]);
    const mag = Number(cols[3]);
    if (!sid || !Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
    let bpRp = 0.8;
    if (hasSeparateBpRp && cols.length >= 6) {
      const bp = cols[4].trim() !== '' ? Number(cols[4]) : NaN;
      const rp = cols[5].trim() !== '' ? Number(cols[5]) : NaN;
      if (Number.isFinite(bp) && Number.isFinite(rp)) bpRp = bp - rp;
    } else if (cols.length >= 5 && cols[4].trim() !== '') {
      const parsed = Number(cols[4]);
      if (Number.isFinite(parsed)) bpRp = parsed;
    }
    const bv = Math.max(-0.35, Math.min(2.2, (bpRp - 0.15) * 0.78));
    rows.push([
      Number(ra.toFixed(5)),
      Number(dec.toFixed(5)),
      Number(mag.toFixed(2)),
      Number(bv.toFixed(2)),
      sid,
    ]);
  }
  return rows;
}

async function fetchStaticHipUltraRows(signal: AbortSignal): Promise<CompactStarTuple[] | null> {
  const baseUrl = `${import.meta.env.BASE_URL}data/stars-ultra`;
  const tileKeys: string[] = [];
  for (let d = 0; d < 3; d++) {
    for (let r = 0; r < 12; r++) {
      tileKeys.push(`${d}_${r}`);
    }
  }
  const rows: CompactStarTuple[] = [];
  let loadedTiles = 0;
  const BATCH = 6;
  for (let i = 0; i < tileKeys.length; i += BATCH) {
    if (signal.aborted) return null;
    const slice = tileKeys.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (key) => {
        if (signal.aborted) return;
        try {
          const res = await fetch(`${baseUrl}/tile_${key}.json`, { signal });
          if (!res.ok) return;
          const parsed = (await res.json()) as unknown;
          if (!Array.isArray(parsed)) return;
          loadedTiles++;
          for (let j = 0; j < parsed.length; j++) {
            const r = parsed[j];
            if (!Array.isArray(r) || r.length < 5) continue;
            const hip = Number(r[0]);
            const ra = Number(r[1]);
            const dec = Number(r[2]);
            const mag = Number(r[3]);
            const bv = Number(r[4]);
            if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
            rows.push([
              Number(ra.toFixed(5)),
              Number(dec.toFixed(5)),
              Number(mag.toFixed(2)),
              Number((Number.isFinite(bv) ? bv : 0.6).toFixed(2)),
              Number.isInteger(hip) && hip > 0 ? `H${hip}` : undefined,
            ]);
          }
        } catch {
          // Skip failed tile
        }
      })
    );
  }
  return loadedTiles > 0 ? rows : null;
}

async function fetchDirectGavoChunk(
  chunk: ChunkZone,
  def: StarCatalogTierDef,
  signal: AbortSignal
): Promise<CompactStarTuple[] | null> {
  const raSpan = chunk.raMax - chunk.raMin;
  const decSpan = chunk.decMax - chunk.decMin;
  // GAVO Q3C POLYGON stays fast (~1.5s) at <= 30° x 30° sub-tiles with full browser CORS
  const raSubs = Math.max(1, Math.ceil(raSpan / 30));
  const decSubs = Math.max(1, Math.ceil(decSpan / 30));
  const maxRows = def.tier <= 2 ? 18000 : def.tier <= 4 ? 20000 : 24000;
  const perSubLimit = Math.max(1000, Math.ceil(maxRows / (raSubs * decSubs)) + 500);
  const all: CompactStarTuple[] = [];
  let anySucceeded = false;

  for (let d = 0; d < decSubs; d++) {
    if (signal.aborted) return null;
    const d0 = chunk.decMin + (decSpan * d) / decSubs;
    const d1 = d === decSubs - 1 ? chunk.decMax : chunk.decMin + (decSpan * (d + 1)) / decSubs;
    const dOp = d1 >= 89.99 ? '<=' : '<';
    for (let r = 0; r < raSubs; r++) {
      if (signal.aborted) return null;
      const r0 = chunk.raMin + (raSpan * r) / raSubs;
      const r1 = r === raSubs - 1 ? chunk.raMax : chunk.raMin + (raSpan * (r + 1)) / raSubs;
      const rOp = r1 >= 359.99 ? '<=' : '<';

      let spatialClause: string;
      if (d1 >= 85) {
        const capRad = Math.min(45, 90 - d0 + 0.5);
        spatialClause = `1=CONTAINS(POINT('', ra, dec), CIRCLE('', 0, 90, ${capRad.toFixed(2)}))`;
      } else if (d0 <= -85) {
        const capRad = Math.min(45, 90 + d1 + 0.5);
        spatialClause = `1=CONTAINS(POINT('', ra, dec), CIRCLE('', 0, -90, ${capRad.toFixed(2)}))`;
      } else {
        const pD0 = Math.max(-89.8, d0 - 1.5);
        const pD1 = Math.min(89.8, d1 + 1.5);
        spatialClause = `1=CONTAINS(POINT('', ra, dec), POLYGON('', ${r0.toFixed(3)}, ${pD0.toFixed(
          3
        )}, ${r1.toFixed(3)}, ${pD0.toFixed(3)}, ${r1.toFixed(3)}, ${pD1.toFixed(
          3
        )}, ${r0.toFixed(3)}, ${pD1.toFixed(3)}))`;
      }

      const adql =
        `SELECT TOP ${perSubLimit} source_id, ra, dec, phot_g_mean_mag, phot_bp_mean_mag, phot_rp_mean_mag ` +
        `FROM gaia.dr3lite ` +
        `WHERE ${spatialClause} ` +
        `AND ra >= ${r0.toFixed(4)} AND ra ${rOp} ${r1.toFixed(4)} ` +
        `AND dec >= ${d0.toFixed(4)} AND dec ${dOp} ${d1.toFixed(4)} ` +
        `AND phot_g_mean_mag > ${def.magMin.toFixed(2)} AND phot_g_mean_mag <= ${def.magMax.toFixed(2)}`;

      const subCtrl = new AbortController();
      const onOuterAbort = () => subCtrl.abort();
      signal.addEventListener('abort', onOuterAbort, { once: true });
      const timeout = window.setTimeout(() => subCtrl.abort(), 20000);
      try {
        const url =
          'https://dc.g-vo.org/tap/sync?' +
          new URLSearchParams({
            REQUEST: 'doQuery',
            LANG: 'ADQL',
            FORMAT: 'csv',
            QUERY: adql,
          }).toString();
        const res = await fetch(url, { signal: subCtrl.signal });
        window.clearTimeout(timeout);
        if (res.ok) {
          const csv = await res.text();
          const parsed = parseDirectGaiaCsvToCompact(csv);
          if (parsed) {
            anySucceeded = true;
            for (let i = 0; i < parsed.length; i++) all.push(parsed[i]);
          }
        }
      } catch {
        window.clearTimeout(timeout);
      } finally {
        signal.removeEventListener('abort', onOuterAbort);
      }
    }
  }
  return anySucceeded ? all : null;
}

async function fetchDirectEsaSkyChunk(
  chunk: ChunkZone,
  def: StarCatalogTierDef,
  signal: AbortSignal
): Promise<CompactStarTuple[] | null> {
  const maxRows = def.tier <= 2 ? 18000 : def.tier <= 4 ? 20000 : 24000;
  const raOp = chunk.raMax >= 359.99 ? '<=' : '<';
  const decOp = chunk.decMax >= 89.99 ? '<=' : '<';
  const adql =
    `SELECT TOP ${maxRows} source_id, ra, dec, phot_g_mean_mag, bp_rp ` +
    `FROM catalogues.t_gaia_source_dr3_fdw ` +
    `WHERE ra >= ${chunk.raMin.toFixed(4)} AND ra ${raOp} ${chunk.raMax.toFixed(4)} ` +
    `AND dec >= ${chunk.decMin.toFixed(4)} AND dec ${decOp} ${chunk.decMax.toFixed(4)} ` +
    `AND phot_g_mean_mag > ${def.magMin.toFixed(2)} AND phot_g_mean_mag <= ${def.magMax.toFixed(2)}`;

  const subCtrl = new AbortController();
  const onOuterAbort = () => subCtrl.abort();
  signal.addEventListener('abort', onOuterAbort, { once: true });
  const timeout = window.setTimeout(() => subCtrl.abort(), 16000);
  try {
    const url =
      'https://sky.esa.int/esasky-tap/tap/sync?' +
      new URLSearchParams({
        REQUEST: 'doQuery',
        LANG: 'ADQL',
        FORMAT: 'csv',
        QUERY: adql,
      }).toString();
    const res = await fetch(url, { signal: subCtrl.signal });
    window.clearTimeout(timeout);
    if (!res.ok) return null;
    const csv = await res.text();
    return parseDirectGaiaCsvToCompact(csv);
  } catch {
    window.clearTimeout(timeout);
    return null;
  } finally {
    signal.removeEventListener('abort', onOuterAbort);
  }
}

async function fetchServerChunk(
  chunk: ChunkZone,
  def: StarCatalogTierDef,
  serverMirror: string,
  signal: AbortSignal
): Promise<{ stars: CompactStarTuple[] | null; routeLabel: string; apiMissing: boolean }> {
  const params = new URLSearchParams({
    tier: String(def.tier),
    source: chunk.source,
    raMin: chunk.raMin.toFixed(2),
    raMax: chunk.raMax.toFixed(2),
    decMin: chunk.decMin.toFixed(2),
    decMax: chunk.decMax.toFixed(2),
    magMin: def.magMin.toFixed(2),
    magMax: def.magMax.toFixed(2),
    mirror: serverMirror,
  });
  try {
    const res = await fetch(`/api/star-packs/chunk?${params.toString()}`, { signal });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (res.status === 404 || res.status === 405 || ct.includes('text/html')) {
      return { stars: null, routeLabel: '', apiMissing: true };
    }
    if (!res.ok) {
      return { stars: null, routeLabel: '', apiMissing: false };
    }
    const json = (await res.json()) as {
      stars?: CompactStarTuple[];
      degraded?: boolean;
      mirror?: string;
    };
    if (Array.isArray(json.stars) && !json.degraded) {
      const mLabel = json.mirror ? `서버(${json.mirror.toUpperCase()})` : '서버';
      return { stars: json.stars, routeLabel: mLabel, apiMissing: false };
    }
    return { stars: null, routeLabel: '', apiMissing: false };
  } catch {
    return { stars: null, routeLabel: '', apiMissing: false };
  }
}

export async function downloadStarCatalogTier(tierNum: number): Promise<{
  ok: boolean;
  cancelled?: boolean;
  message: string;
  starCount?: number;
}> {
  const def = STAR_CATALOG_TIERS.find((t) => t.tier === tierNum);
  if (!def) {
    return { ok: false, message: '알 수 없는 별 목록 단계입니다.' };
  }
  if (currentState.downloading) {
    return { ok: false, message: '이미 다른 별 목록을 내려받는 중입니다.' };
  }

  const abortCtrl = new AbortController();
  activeDownloadAbort = abortCtrl;
  const mirrorMode = currentState.mirrorMode;

  const chunks = buildChunksForTier(def);
  const collectedCoords: number[] = [];
  const collectedIds: number[] = [];
  const dedupKeys = new Set<string>();
  let failedChunks = 0;
  let lastRouteLabel = '';

  updateStateSummary({
    lastError: null,
    downloading: {
      tier: def.tier,
      completedChunks: 0,
      totalChunks: chunks.length,
      starsCollected: 0,
      statusText: `${def.tier}단계 별 목록 준비 중...`,
    },
  });

  const addStarTuples = (rows: CompactStarTuple[]) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ra = Number(row[0]);
      const dec = Number(row[1]);
      const mag = Number(row[2]);
      const bv = Number(row[3]);
      if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
      const normRa = ((ra % 360) + 360) % 360;
      const k = `${Math.round(normRa * 500)}_${Math.round((dec + 90) * 500)}`;
      if (dedupKeys.has(k)) continue;
      dedupKeys.add(k);
      const [idHi, idLo] = encodeCatalogIdTag(row[4]);
      collectedCoords.push(normRa, dec, mag, Number.isFinite(bv) ? bv : 0.6);
      collectedIds.push(idHi, idLo);
    }
  };

  try {
    const CONCURRENCY = mirrorMode === 'gavo-direct' || mirrorMode === 'esasky-direct' ? 2 : 3;
    let completed = 0;

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      if (abortCtrl.signal.aborted) {
        updateStateSummary({ downloading: null });
        return { ok: false, cancelled: true, message: '별 목록 내려받기를 취소했습니다.' };
      }

      const batch = chunks.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (chunk) => {
          if (abortCtrl.signal.aborted) return;
          let success = false;

          if (chunk.source === 'hip-ultra') {
            if (serverStarPackApiAvailable !== false && mirrorMode !== 'gavo-direct' && mirrorMode !== 'esasky-direct') {
              const res = await fetchServerChunk(chunk, def, 'auto', abortCtrl.signal);
              if (res.apiMissing) {
                serverStarPackApiAvailable = false;
              } else if (res.stars) {
                serverStarPackApiAvailable = true;
                addStarTuples(res.stars);
                lastRouteLabel = '로컬 서버';
                success = true;
              }
            }
            if (!success && !abortCtrl.signal.aborted) {
              const staticRows = await fetchStaticHipUltraRows(abortCtrl.signal);
              if (staticRows && staticRows.length > 0) {
                addStarTuples(staticRows);
                lastRouteLabel = '정적 데이터';
                success = true;
              }
            }
          } else {
            // Gaia DR3 chunk with full multi-route failover (Server 5-mirrors + Direct Browser CORS GAVO & ESASky)
            const preferDirectFirst =
              mirrorMode === 'gavo-direct' ||
              mirrorMode === 'esasky-direct' ||
              (mirrorMode === 'auto' && serverStarPackApiAvailable === false);

            if (!preferDirectFirst) {
              const serverMirror = mirrorMode === 'auto' ? 'auto' : mirrorMode;
              for (let attempt = 0; attempt < 2 && !success; attempt++) {
                if (abortCtrl.signal.aborted) return;
                const res = await fetchServerChunk(chunk, def, serverMirror, abortCtrl.signal);
                if (res.apiMissing) {
                  serverStarPackApiAvailable = false;
                  break;
                }
                if (res.stars) {
                  serverStarPackApiAvailable = true;
                  addStarTuples(res.stars);
                  lastRouteLabel = res.routeLabel;
                  success = true;
                }
              }
            }

            if (!success && !abortCtrl.signal.aborted) {
              const directOrder: ('gavo' | 'esasky')[] =
                mirrorMode === 'esasky-direct' ? ['esasky', 'gavo'] : ['gavo', 'esasky'];
              for (const dm of directOrder) {
                if (abortCtrl.signal.aborted || success) break;
                const rows =
                  dm === 'gavo'
                    ? await fetchDirectGavoChunk(chunk, def, abortCtrl.signal)
                    : await fetchDirectEsaSkyChunk(chunk, def, abortCtrl.signal);
                if (rows) {
                  addStarTuples(rows);
                  lastRouteLabel = dm === 'gavo' ? 'GAVO 직접' : 'ESASky 직접';
                  success = true;
                }
              }
            }
          }

          if (!success && !abortCtrl.signal.aborted) {
            failedChunks++;
          }
          completed++;
          const routePrefix = lastRouteLabel ? `${lastRouteLabel} · ` : '';
          updateStateSummary({
            downloading: {
              tier: def.tier,
              completedChunks: completed,
              totalChunks: chunks.length,
              starsCollected: collectedCoords.length / 4,
              statusText: `${routePrefix}구역 ${completed}/${chunks.length} (${(
                collectedCoords.length / 4
              ).toLocaleString()}개)`,
            },
          });
        })
      );
    }

    if (abortCtrl.signal.aborted) {
      updateStateSummary({ downloading: null });
      return { ok: false, cancelled: true, message: '별 목록 내려받기를 취소했습니다.' };
    }

    const starCount = collectedCoords.length / 4;
    if (starCount === 0) {
      const errMsg =
        '외부 천문 데이터베이스(Gaia DR3) 응답이 지연되어 별 목록을 내려받지 못했습니다. 위 다운로드 경로를 변경하거나 잠시 후 다시 시도해 주세요.';
      updateStateSummary({ downloading: null, lastError: errMsg });
      return { ok: false, message: errMsg };
    }

    const starsFlat = new Float32Array(collectedCoords);
    const starIds = new Uint32Array(collectedIds);
    const savedAt = Date.now();
    const fileName = getTierFileName(def.tier);
    const buffer = encodeStarPackBinary(def.tier, def.magMin, def.magMax, starsFlat, starIds, savedAt);

    let savedToFolder = false;
    if (activeDirHandle && currentState.folderStatus === 'connected') {
      savedToFolder = await writePackToDirectory(activeDirHandle, fileName, buffer);
    }

    const meta: InstalledStarPackMeta = {
      tier: def.tier,
      starCount,
      byteLength: buffer.byteLength,
      magMin: def.magMin,
      magMax: def.magMax,
      savedAt,
      savedToFolder,
      fileName,
    };

    await idbPutPack({ ...meta, buffer });
    loadedPackDataByTier.set(def.tier, { meta, starsFlat, starIds });
    rebuildSpatialIndex();
    if (activeDirHandle && currentState.folderStatus === 'connected') {
      await writeManifestToDirectory(activeDirHandle);
    }

    updateStateSummary({
      downloading: null,
      lastError: null,
    });

    const folderNote = savedToFolder
      ? ` (${currentState.folderDisplayName || '문서/noxchart'}에 저장 완료)`
      : ' (브라우저 영구 저장소에 저장 완료)';
    const partialNote =
      failedChunks > 0 ? ` · 일부 구역(${failedChunks}개)은 응답 지연으로 건너뜀` : '';
    return {
      ok: true,
      starCount,
      message: `${def.tier}단계 별 목록 ${starCount.toLocaleString()}개 설치 완료${folderNote}${partialNote}`,
    };
  } catch (err) {
    const isAbort = (err as { name?: string })?.name === 'AbortError';
    updateStateSummary({
      downloading: null,
      lastError: isAbort ? null : '별 목록 내려받기 중 네트워크 오류가 발생했습니다.',
    });
    return {
      ok: false,
      cancelled: isAbort,
      message: isAbort
        ? '별 목록 내려받기를 취소했습니다.'
        : '별 목록 내려받기 중 오류가 발생했습니다.',
    };
  } finally {
    if (activeDownloadAbort === abortCtrl) {
      activeDownloadAbort = null;
    }
  }
}

export async function removeStarCatalogTier(tierNum: number): Promise<void> {
  const existing = loadedPackDataByTier.get(tierNum);
  loadedPackDataByTier.delete(tierNum);
  await idbDeletePack(tierNum);

  if (activeDirHandle && currentState.folderStatus === 'connected') {
    try {
      await activeDirHandle.removeEntry(existing?.meta.fileName || getTierFileName(tierNum));
      await writeManifestToDirectory(activeDirHandle);
    } catch {
      // Ignore if file already missing on disk
    }
  }

  rebuildSpatialIndex();
  updateStateSummary();
}

const LAST_FILE_HANDLE_KEY = 'noxchart_last_file';
let lastStarFileHandle: FsFileHandleLike | null = null;

async function idbGetLastFileHandle(): Promise<FsFileHandleLike | null> {
  if (lastStarFileHandle) return lastStarFileHandle;
  try {
    const db = await openStarPackDb();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_HANDLES, 'readonly');
      const req = tx.objectStore(STORE_HANDLES).get(LAST_FILE_HANDLE_KEY);
      req.onsuccess = () => {
        const rec = req.result as { key: string; handle: FsFileHandleLike } | undefined;
        if (rec?.handle) lastStarFileHandle = rec.handle;
        resolve(rec?.handle ?? null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSaveLastFileHandle(handle: FsFileHandleLike): Promise<void> {
  lastStarFileHandle = handle;
  try {
    const db = await openStarPackDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_HANDLES, 'readwrite');
      tx.objectStore(STORE_HANDLES).put({ key: LAST_FILE_HANDLE_KEY, handle });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB handle storage failure
  }
}

async function resolveStarDataStartIn(): Promise<PickerStartIn> {
  if (activeDirHandle) return activeDirHandle;
  const savedFolder = await idbGetFolderRecord();
  if (savedFolder?.handle) return savedFolder.handle;
  const savedFile = await idbGetLastFileHandle();
  if (savedFile) return savedFile;
  return 'documents';
}

export async function exportStarPackToFile(tierNum: number): Promise<boolean> {
  const entry = loadedPackDataByTier.get(tierNum);
  if (!entry) return false;
  const rec = await idbGetPack(tierNum);
  const buffer =
    rec?.buffer ??
    encodeStarPackBinary(
      tierNum,
      entry.meta.magMin,
      entry.meta.magMax,
      entry.starsFlat,
      entry.starIds,
      entry.meta.savedAt
    );

  const win = window as WindowWithDirPicker;
  if (typeof win.showSaveFilePicker === 'function') {
    const types: PickerFileType[] = [
      {
        description: 'NoxChart 별 목록 (.noxstars)',
        accept: { 'application/octet-stream': ['.noxstars'] },
      },
    ];
    try {
      const startIn = await resolveStarDataStartIn();
      let fileHandle: FsFileHandleLike;
      try {
        fileHandle = await win.showSaveFilePicker({
          id: 'noxchart-star-catalogs',
          startIn,
          suggestedName: entry.meta.fileName,
          types,
        });
      } catch (innerErr) {
        const innerName = innerErr instanceof DOMException ? innerErr.name : '';
        if (innerName === 'AbortError' || innerName === 'SecurityError') throw innerErr;
        fileHandle = await win.showSaveFilePicker({
          id: 'noxchart-star-catalogs',
          startIn: 'documents',
          suggestedName: entry.meta.fileName,
          types,
        });
      }
      const writable = await fileHandle.createWritable();
      await writable.write(new Uint8Array(buffer));
      await writable.close();
      await idbSaveLastFileHandle(fileHandle);
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return false;
      }
      // Fall through to browser download when restricted (e.g. iframe SecurityError)
    }
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = entry.meta.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function pickAndImportStarPackFiles(): Promise<
  | { status: 'imported'; importedTiers: number[]; totalStars: number; failedCount: number }
  | { status: 'cancelled' }
  | { status: 'fallback' }
> {
  const win = window as WindowWithDirPicker;
  if (typeof win.showOpenFilePicker !== 'function') {
    return { status: 'fallback' };
  }
  const types: PickerFileType[] = [
    {
      description: 'NoxChart 별 목록 (.noxstars)',
      accept: { 'application/octet-stream': ['.noxstars'] },
    },
  ];
  try {
    const startIn = await resolveStarDataStartIn();
    let handles: FsFileHandleLike[];
    try {
      handles = await win.showOpenFilePicker({
        id: 'noxchart-star-catalogs',
        startIn,
        multiple: true,
        types,
      });
    } catch (innerErr) {
      const innerName = innerErr instanceof DOMException ? innerErr.name : '';
      if (innerName === 'AbortError' || innerName === 'SecurityError') throw innerErr;
      handles = await win.showOpenFilePicker({
        id: 'noxchart-star-catalogs',
        startIn: 'documents',
        multiple: true,
        types,
      });
    }
    if (!handles || handles.length === 0) return { status: 'cancelled' };
    await idbSaveLastFileHandle(handles[0]);
    const files: File[] = [];
    for (const h of handles) {
      files.push(await h.getFile());
    }
    const res = await importStarPackFiles(files);
    return { status: 'imported', ...res };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    // Cross-origin iframe or unsupported startIn security restriction -> fall back to <input type="file">
    return { status: 'fallback' };
  }
}

export async function importStarPackFiles(files: FileList | File[]): Promise<{
  importedTiers: number[];
  totalStars: number;
  failedCount: number;
}> {
  const list = Array.from(files);
  const importedTiers: number[] = [];
  let totalStars = 0;
  let failedCount = 0;

  for (const file of list) {
    try {
      const buf = await file.arrayBuffer();
      const decoded = decodeStarPackBinary(buf);
      if (!decoded) {
        failedCount++;
        continue;
      }
      const fileName = getTierFileName(decoded.tier);
      let savedToFolder = false;
      if (activeDirHandle && currentState.folderStatus === 'connected') {
        savedToFolder = await writePackToDirectory(activeDirHandle, fileName, buf);
      }
      const meta: InstalledStarPackMeta = {
        tier: decoded.tier,
        starCount: decoded.starCount,
        byteLength: buf.byteLength,
        magMin: decoded.magMin,
        magMax: decoded.magMax,
        savedAt: decoded.savedAt,
        savedToFolder,
        fileName,
      };
      await idbPutPack({ ...meta, buffer: buf });
      loadedPackDataByTier.set(decoded.tier, {
        meta,
        starsFlat: decoded.starsFlat,
        starIds: decoded.starIds,
      });
      importedTiers.push(decoded.tier);
      totalStars += decoded.starCount;
    } catch {
      failedCount++;
    }
  }

  if (importedTiers.length > 0) {
    rebuildSpatialIndex();
    if (activeDirHandle && currentState.folderStatus === 'connected') {
      await writeManifestToDirectory(activeDirHandle);
    }
    updateStateSummary({ lastError: null });
  }

  return { importedTiers, totalStars, failedCount };
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
