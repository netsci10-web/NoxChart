import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  buildFirestoreErrorInfo,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
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

export type CloudSyncStatus =
  | 'idle'
  | 'loading'
  | 'checking'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'updated'
  | 'error';

export interface CloudAppPrefs {
  theme: ThemeMode;
  coordSystem: CoordSystem;
  fsz?: number;
  flipH: boolean;
  flipV: boolean;
  infoWindowDockSide?: 'left' | 'right';
  sidebarsPinned?: boolean;
}

export interface CloudActiveSite {
  name: string;
  lat: number;
  lon: number;
  minAltitudeDeg: number;
  highlightAboveMinAlt: boolean;
  bortleEnabled?: boolean;
  bortleClass?: number;
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

export function stripEphemeralOptics(optics?: OpticsSettings) {
  if (!optics) return optics;
  const { showSelectionMark: _ignored, ...persistedOptics } = optics;
  return persistedOptics;
}

export function stripEphemeralChallenges(tracks: ChallengeTrack[]) {
  return tracks.map(({ activeOnChart: _ignored, ...persistedTrack }) => persistedTrack);
}

export function stripEphemeralAsterisms(store: AsterismStoreState) {
  return {
    layers: store.layers,
    asterisms: store.asterisms,
    objects: store.objects,
    settings: store.settings,
  };
}

export function computePayloadHashes(payload: CloudSyncPayload): SyncHashes {
  const rootContent = {
    prefs: payload.root.prefs
      ? {
          theme: payload.root.prefs.theme,
          coordSystem: payload.root.prefs.coordSystem,
          flipH: payload.root.prefs.flipH,
          flipV: payload.root.prefs.flipV,
          infoWindowDockSide: payload.root.prefs.infoWindowDockSide ?? 'right',
          sidebarsPinned: payload.root.prefs.sidebarsPinned ?? false,
        }
      : undefined,
    layers: payload.root.layers,
    hips: payload.root.hips,
    optics: stripEphemeralOptics(payload.root.optics),
    activeSite: payload.root.activeSite,
    savedSites: payload.root.savedSites,
    equipmentLocker: payload.root.equipmentLocker,
  };
  return {
    root: JSON.stringify(stripUndefinedDeep(rootContent)),
    observingLists: JSON.stringify(stripUndefinedDeep(payload.observingLists)),
    observationLogs: JSON.stringify(stripUndefinedDeep(payload.observationLogs)),
    challenges: JSON.stringify(stripUndefinedDeep(stripEphemeralChallenges(payload.challenges))),
    asterisms: JSON.stringify(stripUndefinedDeep(stripEphemeralAsterisms(payload.asterisms))),
  };
}

export async function loadUserCloudData(
  uid: string,
  options?: { fromServer?: boolean }
): Promise<LoadedCloudData> {
  const rootPath = `users/${uid}`;
  const listsPath = `users/${uid}/data/observingLists`;
  const logsPath = `users/${uid}/data/observationLogs`;
  const challengesPath = `users/${uid}/data/challenges`;
  const asterismsPath = `users/${uid}/data/asterisms`;
  const fromServer = Boolean(options?.fromServer);

  const readDocSafe = async (path: string, segments: [string, ...string[]]) => {
    try {
      const ref = doc(db, ...segments);
      return fromServer ? await getDocFromServer(ref) : await getDoc(ref);
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
    const clean =
      key === 'challenges'
        ? stripUndefinedDeep(
            (value as ChallengeTrack[]).map((t) => ({ ...t, activeOnChart: false }))
          )
        : stripUndefinedDeep(value);
    const body =
      key === 'challenges'
        ? { tracks: clean, updatedAt: serverTimestamp() }
        : { state: clean, updatedAt: serverTimestamp() };
    await setDoc(doc(db, 'users', uid, 'data', key), body, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CloudRealtimeCallbacks {
  onInitialSnapshot: (data: LoadedCloudData) => void;
  onRemoteUpdate: (data: LoadedCloudData, removedSubdocs: CloudSubDocKey[]) => void;
  onError: (error: unknown, path: string) => void;
}

/**
 * Subscribes in real time (onSnapshot) to users/{uid} and users/{uid}/data collection.
 * Returns an unsubscribe function that cleans up all active Firestore listeners.
 */
export function subscribeUserCloudData(
  uid: string,
  callbacks: CloudRealtimeCallbacks
): () => void {
  const rootPath = `users/${uid}`;
  const dataCollectionPath = `users/${uid}/data`;

  let unsubscribed = false;
  let rootReady = false;
  let dataReady = false;
  let initialEmitted = false;

  let latestRoot: Partial<CloudUserRootData> | null = null;
  let latestLists: ObservingListsState | null = null;
  let latestLogs: ObservationLogStoreState | null = null;
  let latestChallenges: ChallengeTrack[] | null = null;
  let latestAsterisms: AsterismStoreState | null = null;

  const buildLoadedData = (): LoadedCloudData => ({
    hasAnyCloudData: Boolean(
      latestRoot || latestLists || latestLogs || latestChallenges || latestAsterisms
    ),
    root: latestRoot,
    observingLists: latestLists,
    observationLogs: latestLogs,
    challenges: latestChallenges,
    asterisms: latestAsterisms,
  });

  const emitUpdate = (removedSubdocs: CloudSubDocKey[]) => {
    if (unsubscribed) return;
    if (!initialEmitted) {
      if (rootReady && dataReady) {
        initialEmitted = true;
        callbacks.onInitialSnapshot(buildLoadedData());
      }
      return;
    }
    callbacks.onRemoteUpdate(buildLoadedData(), removedSubdocs);
  };

  const unsubRoot = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (unsubscribed) return;
      if (initialEmitted && snap.metadata.hasPendingWrites) return;
      latestRoot = snap.exists() ? (snap.data() as Partial<CloudUserRootData>) : null;
      rootReady = true;
      emitUpdate([]);
    },
    (error) => {
      if (unsubscribed) return;
      const errInfo = buildFirestoreErrorInfo(error, OperationType.GET, rootPath);
      console.error('Firestore Realtime Error:', JSON.stringify(errInfo));
      callbacks.onError(error, rootPath);
    }
  );

  const unsubData = onSnapshot(
    collection(db, 'users', uid, 'data'),
    (querySnap) => {
      if (unsubscribed) return;
      if (initialEmitted && querySnap.metadata.hasPendingWrites) return;

      let nextLists: ObservingListsState | null = null;
      let nextLogs: ObservationLogStoreState | null = null;
      let nextChallenges: ChallengeTrack[] | null = null;
      let nextAsterisms: AsterismStoreState | null = null;

      for (const snapDoc of querySnap.docs) {
        const docData = snapDoc.data();
        if (snapDoc.id === 'observingLists' && docData?.state) {
          nextLists = docData.state as ObservingListsState;
        } else if (snapDoc.id === 'observationLogs' && docData?.state) {
          nextLogs = docData.state as ObservationLogStoreState;
        } else if (snapDoc.id === 'challenges' && Array.isArray(docData?.tracks)) {
          nextChallenges = docData.tracks as ChallengeTrack[];
        } else if (snapDoc.id === 'asterisms' && docData?.state) {
          nextAsterisms = docData.state as AsterismStoreState;
        }
      }

      const removedSubdocs: CloudSubDocKey[] = [];
      if (initialEmitted) {
        for (const change of querySnap.docChanges()) {
          if (
            change.type === 'removed' &&
            (change.doc.id === 'observingLists' ||
              change.doc.id === 'observationLogs' ||
              change.doc.id === 'challenges' ||
              change.doc.id === 'asterisms')
          ) {
            removedSubdocs.push(change.doc.id);
          }
        }
      }

      latestLists = nextLists;
      latestLogs = nextLogs;
      latestChallenges = nextChallenges;
      latestAsterisms = nextAsterisms;
      dataReady = true;
      emitUpdate(removedSubdocs);
    },
    (error) => {
      if (unsubscribed) return;
      const errInfo = buildFirestoreErrorInfo(error, OperationType.LIST, dataCollectionPath);
      console.error('Firestore Realtime Error:', JSON.stringify(errInfo));
      callbacks.onError(error, dataCollectionPath);
    }
  );

  return () => {
    unsubscribed = true;
    unsubRoot();
    unsubData();
  };
}

export function isOfflineSyncError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '').toLowerCase()
      : '';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('failed to get document because the client is offline')
  );
}

export function formatFriendlySyncError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '').toLowerCase()
      : '';
  const msg = err instanceof Error ? err.message : String(err);
  const lower = `${code} ${msg}`.toLowerCase();

  if (
    code === 'permission-denied' ||
    lower.includes('permission-denied') ||
    lower.includes('permission') ||
    lower.includes('insufficient')
  ) {
    return 'Firestore 접근 권한 오류 (permission-denied): Firebase 콘솔 보안 규칙에서 users/{uid} 읽기·쓰기 권한을 확인해 주세요.';
  }
  if (code === 'unauthenticated' || lower.includes('unauthenticated')) {
    return '인증이 만료되었습니다 (unauthenticated). 다시 Google 로그인을 진행해 주세요.';
  }
  if (code === 'resource-exhausted' || lower.includes('quota')) {
    return 'Firestore 할당량을 초과했습니다 (resource-exhausted). 잠시 후 다시 시도해 주세요.';
  }
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    lower.includes('offline') ||
    lower.includes('network') ||
    lower.includes('unavailable') ||
    lower.includes('failed to fetch')
  ) {
    return 'Firestore 네트워크 연결 오류 (unavailable): 인터넷 연결 또는 학교·기관 방화벽을 확인해 주세요. 로컬 저장은 정상 유지됩니다.';
  }
  return `클라우드 동기화 오류가 발생했습니다${code ? ` (${code})` : ''}. 로컬 저장은 정상 유지됩니다.`;
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
