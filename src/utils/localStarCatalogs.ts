import { DEG2RAD } from './astronomy';

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
    estSizeLabel: '약 1.9 MB',
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
    estSizeLabel: '약 3.5 MB',
    estStarsLabel: '약 22만 개',
    decBands: 6,
    raBands: 6,
  },
  {
    tier: 3,
    title: '쌍안경·파인더 심층 3단계 (Gaia DR3)',
    magMin: 10.25,
    magMax: 11.0,
    estSizeLabel: '약 5.6 MB',
    estStarsLabel: '약 35만 개',
    decBands: 6,
    raBands: 8,
  },
  {
    tier: 4,
    title: '소구경 망원경 4단계 (Gaia DR3)',
    magMin: 11.0,
    magMax: 11.75,
    estSizeLabel: '약 8.3 MB',
    estStarsLabel: '약 52만 개',
    decBands: 6,
    raBands: 12,
  },
  {
    tier: 5,
    title: '중구경 망원경 5단계 (Gaia DR3)',
    magMin: 11.75,
    magMax: 12.5,
    estSizeLabel: '약 12.5 MB',
    estStarsLabel: '약 78만 개',
    decBands: 8,
    raBands: 12,
  },
  {
    tier: 6,
    title: '딥스카이 정밀 6단계 (Gaia DR3)',
    magMin: 12.5,
    magMax: 13.5,
    estSizeLabel: '약 19.2 MB',
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

export interface LocalStarCatalogState {
  initialized: boolean;
  installedTiers: InstalledStarPackMeta[];
  totalStars: number;
  totalBytes: number;
  maxMag: number;
  folderStatus: LocalFolderStatus;
  folderDisplayName: string | null;
  persistentStorageGranted: boolean;
  downloading: StarPackDownloadProgress | null;
  lastError: string | null;
  revision: number;
}

// Binary .noxstars file format header (28 bytes):
// [0..3]  ASCII "NXST"
// [4..5]  uint16 version = 1
// [6..7]  uint16 tier (1..6)
// [8..11] uint32 starCount
// [12..15] float32 magMin
// [16..19] float32 magMax
// [20..27] float64 savedAt (ms)
// [28..]  Float32Array of length starCount * 4: [raDeg, decDeg, mag, bv]
const PACK_MAGIC_0 = 0x4e; // 'N'
const PACK_MAGIC_1 = 0x58; // 'X'
const PACK_MAGIC_2 = 0x53; // 'S'
const PACK_MAGIC_3 = 0x54; // 'T'
const PACK_HEADER_BYTES = 28;
const PACK_VERSION = 1;

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
interface WindowWithDirPicker extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    mode?: 'read' | 'readwrite';
  }) => Promise<FsDirectoryHandleLike>;
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

export function encodeStarPackBinary(
  tier: number,
  magMin: number,
  magMax: number,
  starsFlat: Float32Array,
  savedAt = Date.now()
): ArrayBuffer {
  const starCount = Math.floor(starsFlat.length / 4);
  const byteLength = PACK_HEADER_BYTES + starCount * 16;
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
  return buf;
}

export function decodeStarPackBinary(buffer: ArrayBuffer): {
  tier: number;
  starCount: number;
  magMin: number;
  magMax: number;
  savedAt: number;
  starsFlat: Float32Array;
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
  if (version !== PACK_VERSION) return null;
  const tier = view.getUint16(6, true);
  const starCount = view.getUint32(8, true);
  const magMin = view.getFloat32(12, true);
  const magMax = view.getFloat32(16, true);
  const savedAt = view.getFloat64(20, true);
  if (tier < 1 || tier > 20) return null;
  const expectedBytes = PACK_HEADER_BYTES + starCount * 16;
  if (buffer.byteLength < expectedBytes) return null;
  const starsFlat = new Float32Array(buffer, PACK_HEADER_BYTES, starCount * 4);
  return { tier, starCount, magMin, magMax, savedAt, starsFlat };
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
// Each cell holds a Float32Array sorted by magnitude ascending: [ra, dec, mag, bv, ...]
const DEC_CELL_DEG = 10;
const RA_CELL_DEG = 10;
const DEC_CELL_COUNT = 18;
const RA_CELL_COUNT = 36;

export type LocalStarSpatialIndex = Map<string, Float32Array>;

const loadedPackDataByTier = new Map<number, { meta: InstalledStarPackMeta; starsFlat: Float32Array }>();
let spatialIndex: LocalStarSpatialIndex = new Map();
let activeDirHandle: FsDirectoryHandleLike | null = null;
let activeDownloadAbort: AbortController | null = null;
let initPromise: Promise<void> | null = null;

const stateListeners = new Set<() => void>();

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
  downloading: null,
  lastError: null,
  revision: 0,
};

function rebuildSpatialIndex(): void {
  const buckets = new Map<string, number[]>();
  const tierEntries = Array.from(loadedPackDataByTier.values()).sort(
    (a, b) => a.meta.tier - b.meta.tier
  );

  for (const entry of tierEntries) {
    const flat = entry.starsFlat;
    for (let i = 0; i < flat.length; i += 4) {
      const ra = flat[i];
      const dec = flat[i + 1];
      const mag = flat[i + 2];
      const bv = flat[i + 3];
      const normRa = ((ra % 360) + 360) % 360;
      const dBin = Math.max(0, Math.min(DEC_CELL_COUNT - 1, Math.floor((dec + 90) / DEC_CELL_DEG)));
      const rBin = Math.max(0, Math.min(RA_CELL_COUNT - 1, Math.floor(normRa / RA_CELL_DEG)));
      const key = `${dBin}_${rBin}`;
      let arr = buckets.get(key);
      if (!arr) {
        arr = [];
        buckets.set(key, arr);
      }
      arr.push(normRa, dec, mag, bv);
    }
  }

  const nextIndex: LocalStarSpatialIndex = new Map();
  for (const [key, arr] of buckets.entries()) {
    const count = arr.length / 4;
    // Sort star indices by magnitude ascending so renderer can break early at magLimit
    const order = new Uint32Array(count);
    for (let i = 0; i < count; i++) order[i] = i;
    order.sort((a, b) => arr[a * 4 + 2] - arr[b * 4 + 2]);
    const sorted = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const src = order[i] * 4;
      const dst = i * 4;
      sorted[dst] = arr[src];
      sorted[dst + 1] = arr[src + 1];
      sorted[dst + 2] = arr[src + 2];
      sorted[dst + 3] = arr[src + 3];
    }
    nextIndex.set(key, sorted);
  }
  spatialIndex = nextIndex;
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
  const endDec = Math.min(DEC_CELL_COUNT - 1, Math.floor((Math.min(89.999, decMax) + 90) / DEC_CELL_DEG));

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
    await writable.write(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }));
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
            loadedPackDataByTier.set(decoded.tier, { meta, starsFlat: decoded.starsFlat });
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
    // Request browser persistent storage so IndexedDB is protected against cache eviction
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

    // Load previously saved packs from IndexedDB immediately
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
      });
    }
    rebuildSpatialIndex();

    // Restore previously linked 문서/noxchart folder handle if available
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
    // If we already have a handle waiting for re-permission, try requesting permission directly first
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

  const chunks = buildChunksForTier(def);
  const collected: number[] = [];
  const dedupKeys = new Set<string>();
  let failedChunks = 0;

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

  const addStarTuples = (rows: [number, number, number, number][]) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ra = Number(row[0]);
      const dec = Number(row[1]);
      const mag = Number(row[2]);
      const bv = Number(row[3]);
      if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
      const normRa = ((ra % 360) + 360) % 360;
      // Coarse ~7" spatial key for deduplicating Hipparcos/Gaia overlap
      const k = `${Math.round(normRa * 500)}_${Math.round((dec + 90) * 500)}`;
      if (dedupKeys.has(k)) continue;
      dedupKeys.add(k);
      collected.push(normRa, dec, mag, Number.isFinite(bv) ? bv : 0.6);
    }
  };

  try {
    const CONCURRENCY = 3;
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
          const params = new URLSearchParams({
            tier: String(def.tier),
            source: chunk.source,
            raMin: chunk.raMin.toFixed(2),
            raMax: chunk.raMax.toFixed(2),
            decMin: chunk.decMin.toFixed(2),
            decMax: chunk.decMax.toFixed(2),
            magMin: def.magMin.toFixed(2),
            magMax: def.magMax.toFixed(2),
          });
          let success = false;
          for (let attempt = 0; attempt < 2 && !success; attempt++) {
            if (abortCtrl.signal.aborted) return;
            try {
              const res = await fetch(`/api/star-packs/chunk?${params.toString()}`, {
                signal: abortCtrl.signal,
              });
              if (res.ok) {
                const json = (await res.json()) as {
                  stars?: [number, number, number, number][];
                  degraded?: boolean;
                };
                if (Array.isArray(json.stars) && !json.degraded) {
                  addStarTuples(json.stars);
                  success = true;
                }
              }
            } catch {
              // Retry once unless aborted
            }
          }
          if (!success && !abortCtrl.signal.aborted) {
            failedChunks++;
          }
          completed++;
          updateStateSummary({
            downloading: {
              tier: def.tier,
              completedChunks: completed,
              totalChunks: chunks.length,
              starsCollected: collected.length / 4,
              statusText: `구역 ${completed}/${chunks.length} 내려받는 중 (${(
                collected.length / 4
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

    const starCount = collected.length / 4;
    if (starCount === 0) {
      const errMsg =
        '외부 천문 데이터베이스(Gaia DR3) 응답이 지연되어 별 목록을 내려받지 못했습니다. 잠시 후 다시 시도해 주세요.';
      updateStateSummary({ downloading: null, lastError: errMsg });
      return { ok: false, message: errMsg };
    }

    const starsFlat = new Float32Array(collected);
    const savedAt = Date.now();
    const fileName = getTierFileName(def.tier);
    const buffer = encodeStarPackBinary(def.tier, def.magMin, def.magMax, starsFlat, savedAt);

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
    loadedPackDataByTier.set(def.tier, { meta, starsFlat });
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
      entry.meta.savedAt
    );
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
      loadedPackDataByTier.set(decoded.tier, { meta, starsFlat: decoded.starsFlat });
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
