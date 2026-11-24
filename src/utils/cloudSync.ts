import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AsterismStoreState,
  ChallengeTrack,
  CoordSystem,
  EquipmentLockerState,
  HipsSettings,
  LayerSettings,
  ObservationLogStoreState,
  ObservingListsState,
  OpticsSettings,
  SavedObservingSite,
  ThemeMode,
} from '../types/astronomy';

export type CloudSyncStatus = 'idle' | 'loading' | 'pending' | 'saving' | 'saved' | 'error';

export interface CloudAppPrefs {
  theme: ThemeMode;
  coordSystem: CoordSystem;
  fsz: number;
  flipH: boolean;
  flipV: boolean;
}

export interface CloudActiveSite {
  name: string;
  lat: number;
  lon: number;
  minAltitudeDeg: number;
  highlightAboveMinAlt: boolean;
}

export interface CloudUserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface CloudUserRootData {
  profile?: CloudUserProfile;
  prefs?: CloudAppPrefs;
  layers?: LayerSettings;
  hips?: HipsSettings;
  optics?: OpticsSettings;
  activeSite?: CloudActiveSite;
  savedSites?: SavedObservingSite[];
  equipmentLocker?: EquipmentLockerState;
}

export interface CloudSyncPayload {
  root: CloudUserRootData;
  observingLists: ObservingListsState;
  observationLogs: ObservationLogStoreState;
  challenges: ChallengeTrack[];
  asterisms: AsterismStoreState;
}

export interface LoadedCloudData {
  hasAnyCloudData: boolean;
  root: Partial<CloudUserRootData> | null;
  observingLists: ObservingListsState | null;
  observationLogs: ObservationLogStoreState | null;
  challenges: ChallengeTrack[] | null;
  asterisms: AsterismStoreState | null;
}

export type CloudSubDocKey =
  | 'observingLists'
  | 'observationLogs'
  | 'challenges'
  | 'asterisms';

export interface SyncHashes {
  root: string;
  observingLists: string;
  observationLogs: string;
  challenges: string;
  asterisms: string;
}

/**
 * Recursively removes undefined values and non-finite numbers so Firestore setDoc never fails.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function computePayloadHashes(payload: CloudSyncPayload): SyncHashes {
  const rootWithoutProfile = {
    prefs: payload.root.prefs,
    layers: payload.root.layers,
    hips: payload.root.hips,
    optics: payload.root.optics,
    activeSite: payload.root.activeSite,
    savedSites: payload.root.savedSites,
    equipmentLocker: payload.root.equipmentLocker,
  };
  return {
    root: JSON.stringify(stripUndefinedDeep(rootWithoutProfile)),
    observingLists: JSON.stringify(stripUndefinedDeep(payload.observingLists)),
    observationLogs: JSON.stringify(stripUndefinedDeep(payload.observationLogs)),
    challenges: JSON.stringify(stripUndefinedDeep(payload.challenges)),
    asterisms: JSON.stringify(stripUndefinedDeep(payload.asterisms)),
  };
}

export async function loadUserCloudData(uid: string): Promise<LoadedCloudData> {
  const rootPath = `users/${uid}`;
  const listsPath = `users/${uid}/data/observingLists`;
  const logsPath = `users/${uid}/data/observationLogs`;
  const challengesPath = `users/${uid}/data/challenges`;
  const asterismsPath = `users/${uid}/data/asterisms`;

  const readDocSafe = async (path: string, segments: [string, ...string[]]) => {
    try {
      const ref = doc(db, ...segments);
      return await getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  };

  const [rootSnap, listsSnap, logsSnap, challengesSnap, asterismsSnap] = await Promise.all([
    readDocSafe(rootPath, ['users', uid]),
    readDocSafe(listsPath, ['users', uid, 'data', 'observingLists']),
    readDocSafe(logsPath, ['users', uid, 'data', 'observationLogs']),
    readDocSafe(challengesPath, ['users', uid, 'data', 'challenges']),
    readDocSafe(asterismsPath, ['users', uid, 'data', 'asterisms']),
  ]);

  const root = rootSnap.exists() ? (rootSnap.data() as Partial<CloudUserRootData>) : null;
  const observingLists =
    listsSnap.exists() && listsSnap.data()?.state
      ? (listsSnap.data().state as ObservingListsState)
      : null;
  const observationLogs =
    logsSnap.exists() && logsSnap.data()?.state
      ? (logsSnap.data().state as ObservationLogStoreState)
      : null;
  const challenges =
    challengesSnap.exists() && Array.isArray(challengesSnap.data()?.tracks)
      ? (challengesSnap.data().tracks as ChallengeTrack[])
      : null;
  const asterisms =
    asterismsSnap.exists() && asterismsSnap.data()?.state
      ? (asterismsSnap.data().state as AsterismStoreState)
      : null;

  const hasAnyCloudData = Boolean(
    root || observingLists || observationLogs || challenges || asterisms
  );

  return {
    hasAnyCloudData,
    root,
    observingLists,
    observationLogs,
    challenges,
    asterisms,
  };
}

export async function saveUserCloudRoot(
  uid: string,
  rootData: CloudUserRootData
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const clean = stripUndefinedDeep(rootData);
    await setDoc(
      doc(db, 'users', uid),
      {
        ...clean,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserCloudSubdoc(
  uid: string,
  key: CloudSubDocKey,
  value:
    | ObservingListsState
    | ObservationLogStoreState
    | ChallengeTrack[]
    | AsterismStoreState
): Promise<void> {
  const path = `users/${uid}/data/${key}`;
  try {
    const clean = stripUndefinedDeep(value);
    const body =
      key === 'challenges'
        ? { tracks: clean, updatedAt: serverTimestamp() }
        : { state: clean, updatedAt: serverTimestamp() };
    await setDoc(doc(db, 'users', uid, 'data', key), body, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function formatFriendlySyncError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return 'Firestore 접근 권한이 없습니다. 콘솔의 보안 규칙(users/{uid})을 확인해 주세요.';
  }
  if (lower.includes('quota')) {
    return 'Firestore 일일 할당량을 초과했습니다.';
  }
  if (lower.includes('offline') || lower.includes('network') || lower.includes('unavailable')) {
    return '네트워크 연결이 불안정합니다. 변경 사항은 로컬에 보관됩니다.';
  }
  return '클라우드 동기화 중 오류가 발생했습니다. 로컬 저장은 정상 유지됩니다.';
}

export function formatFriendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
    return '';
  }
  if (msg.includes('auth/popup-blocked')) {
    return '브라우저에서 로그인 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.';
  }
  if (msg.includes('auth/unauthorized-domain')) {
    return '현재 도메인이 Firebase 승인된 도메인에 등록되어 있지 않습니다. Firebase 콘솔에서 도메인을 추가해 주세요.';
  }
  if (msg.includes('auth/network-request-failed')) {
    return '네트워크 오류로 로그인에 실패했습니다. 연결을 확인해 주세요.';
  }
  return 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}
