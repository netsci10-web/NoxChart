import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  InfoWindow,
  Pin,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  BookmarkPlus,
  Check,
  Crosshair,
  Download,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ObserverConfig,
  SavedObservingSite,
  ThemeMode,
} from '../types/astronomy';
import {
  clampLat,
  clampLon,
  downloadObservingSitesFile,
  formatCoordsShort,
  parseObservingSitesFromJson,
} from '../utils/observingSites';
import { getUiTheme } from '../utils/themeClasses';

type MapStyleType = 'roadmap' | 'terrain' | 'hybrid';

interface CameraTarget {
  lat: number;
  lng: number;
  zoom?: number;
  seq: number;
}

interface ObservingSiteMapModalProps {
  open: boolean;
  theme: ThemeMode;
  observer: ObserverConfig;
  savedSites: SavedObservingSite[];
  initialFocusSite?: SavedObservingSite | null;
  onClose: () => void;
  onApplySite: (site: { name: string; lat: number; lon: number }) => void;
  onSaveSite: (site: SavedObservingSite) => void;
  onDeleteSite: (id: string) => void | Promise<boolean>;
  onImportSites: (
    sites: SavedObservingSite[]
  ) => { addedCount: number; updatedCount: number };
}

function isQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === 'string'
      ? err
      : JSON.stringify(err ?? '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('OverQuota') ||
    msg.includes('429')
  );
}

function MapCameraController({ target }: { target: CameraTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    if (typeof target.zoom === 'number') {
      map.setZoom(target.zoom);
    }
  }, [map, target]);
  return null;
}

function MapLoadStatusOverlay({ theme }: { theme: ThemeMode }) {
  const isLoaded = useApiIsLoaded();
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div
        className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center ${
          theme === 'white'
            ? 'bg-slate-100/95 text-slate-800'
            : theme === 'red'
            ? 'bg-[#120000]/95 text-[#FF6B6B]'
            : 'bg-[#070B14]/95 text-slate-200'
        }`}
      >
        <MapPin className="w-8 h-8 mb-2 opacity-70" />
        <div className="text-sm font-semibold mb-1">지도를 불러올 수 없습니다</div>
        <p className="text-xs opacity-75 max-w-sm leading-relaxed">
          Google Maps API 인증 또는 네트워크 상태를 확인해 주세요. 우측 입력란에서 위도·경도를 직접 입력해 관측지를 설정하고 저장할 수 있습니다.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center gap-2 text-xs ${
          theme === 'white'
            ? 'bg-slate-100/80 text-slate-700'
            : theme === 'red'
            ? 'bg-[#120000]/80 text-[#FF6B6B]'
            : 'bg-[#070B14]/80 text-slate-300'
        }`}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>지도 불러오는 중...</span>
      </div>
    );
  }

  return null;
}

interface PlaceSearchBarProps {
  theme: ThemeMode;
  onSelectPlace: (placeInfo: {
    name: string;
    lat: number;
    lon: number;
    viewport?: google.maps.LatLngBounds | null;
  }) => void;
}

function PlaceSearchBar({ theme, onSelectPlace }: PlaceSearchBarProps) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const trimmed = inputValue.trim();
    if (!placesLib || trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    debounceRef.current = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          language: 'ko',
        });
        if (!cancelled) {
          const list = Array.isArray(res?.suggestions) ? res.suggestions : [];
          setSuggestions(list);
          setDropdownOpen(true);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          setSuggestions([]);
          setSearchError('장소 검색에 실패했습니다. 지도를 직접 클릭해 위치를 선택할 수 있습니다.');
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [placesLib, inputValue]);

  const handlePickSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });
        const loc = place.location;
        if (loc) {
          const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
          const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            if (place.viewport && map) {
              map.fitBounds(place.viewport);
            }
            const label =
              place.displayName ||
              suggestion.placePrediction.mainText?.text ||
              suggestion.placePrediction.text?.text ||
              `관측지 (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
            onSelectPlace({
              name: label,
              lat,
              lon: lng,
              viewport: place.viewport ?? null,
            });
          }
        }
        setInputValue('');
        setSuggestions([]);
        setDropdownOpen(false);
        sessionTokenRef.current = null;
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSearchError('선택한 장소의 좌표를 가져오지 못했습니다.');
      }
    },
    [placesLib, map, onSelectPlace]
  );

  const surfaceCls =
    theme === 'white'
      ? 'bg-white/95 border-slate-300 text-slate-900 shadow-md'
      : theme === 'red'
      ? 'bg-[#120101]/95 border-[#5A1212] text-[#FF5252] shadow-md'
      : 'bg-[#0B1220]/95 border-[#2C3E5C] text-slate-100 shadow-lg';

  const itemHoverCls =
    theme === 'white'
      ? 'hover:bg-blue-50 text-slate-800'
      : theme === 'red'
      ? 'hover:bg-[#2B0404] text-[#FF6B6B]'
      : 'hover:bg-[#17253B] text-slate-200';

  return (
    <div className="relative w-full max-w-xs">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md ${surfaceCls}`}>
        <Search className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setDropdownOpen(true);
          }}
          placeholder="관측지, 천문대, 지명 검색..."
          className="w-full bg-transparent text-xs outline-none placeholder:opacity-60"
        />
        {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 opacity-75" />}
        {inputValue && !isSearching && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setSuggestions([]);
              setDropdownOpen(false);
              setSearchError(null);
            }}
            aria-label="검색어 지우기"
            className="opacity-65 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {dropdownOpen && suggestions.length > 0 && (
        <ul
          className={`absolute left-0 right-0 top-full mt-1 border rounded-md overflow-hidden max-h-56 overflow-y-auto astro-scroll z-30 ${surfaceCls}`}
        >
          {suggestions.map((sug, idx) => {
            const pred = sug.placePrediction;
            if (!pred) return null;
            const mainText = pred.mainText?.text || pred.text?.text || '';
            const secondaryText = pred.secondaryText?.text || '';
            return (
              <li key={pred.placeId || idx}>
                <button
                  type="button"
                  onClick={() => void handlePickSuggestion(sug)}
                  className={`w-full text-left px-2.5 py-2 text-xs transition-colors border-b last:border-b-0 ${
                    theme === 'white'
                      ? 'border-slate-100'
                      : theme === 'red'
                      ? 'border-[#300606]'
                      : 'border-[#1E2B42]'
                  } ${itemHoverCls}`}
                >
                  <div className="font-medium truncate">{mainText}</div>
                  {secondaryText && (
                    <div className="text-[10.5px] opacity-65 truncate mt-0.5">
                      {secondaryText}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {searchError && (
        <div
          className={`mt-1 px-2 py-1 text-[10.5px] border rounded ${surfaceCls}`}
        >
          {searchError}
        </div>
      )}
    </div>
  );
}

export function ObservingSiteMapModal({
  open,
  theme,
  observer,
  savedSites,
  initialFocusSite,
  onClose,
  onApplySite,
  onSaveSite,
  onDeleteSite,
  onImportSites,
}: ObservingSiteMapModalProps) {
  const ui = getUiTheme(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mapsApiKey, setMapsApiKey] = useState<string>(() => {
    const buildKey =
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '');
    return buildKey || '';
  });
  const [keyChecked, setKeyChecked] = useState<boolean>(() => Boolean(mapsApiKey));

  const [pickedLat, setPickedLat] = useState<number>(observer.lat);
  const [pickedLon, setPickedLon] = useState<number>(observer.lon);
  const [siteName, setSiteName] = useState<string>(observer.name);
  const [siteNote, setSiteNote] = useState<string>('');
  const [siteBortle, setSiteBortle] = useState<string>('');
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapStyleType>('terrain');
  const [redFilterEnabled, setRedFilterEnabled] = useState<boolean>(true);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [activeInfoSiteId, setActiveInfoSiteId] = useState<string | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showNotice = useCallback((msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => {
      setStatusMsg((cur) => (cur === msg ? null : cur));
    }, 3600);
  }, []);

  // Runtime fallback fetch for Maps API key if not embedded at build time
  useEffect(() => {
    if (!open || mapsApiKey) return;
    let active = true;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { apiKey?: string } | null) => {
        if (!active) return;
        if (data?.apiKey) {
          setMapsApiKey(data.apiKey);
        }
        setKeyChecked(true);
      })
      .catch(() => {
        if (active) setKeyChecked(true);
      });
    return () => {
      active = false;
    };
  }, [open, mapsApiKey]);

  // Sync modal state whenever opened
  useEffect(() => {
    if (!open) return;
    const focus = initialFocusSite;
    if (focus) {
      setPickedLat(focus.lat);
      setPickedLon(focus.lon);
      setSiteName(focus.name);
      setSiteNote(focus.note ?? '');
      setSiteBortle(focus.bortle ? String(focus.bortle) : '');
      setEditingSiteId(focus.id);
      setActiveInfoSiteId(focus.id);
      setCameraTarget({ lat: focus.lat, lng: focus.lon, zoom: 12, seq: Date.now() });
    } else {
      setPickedLat(observer.lat);
      setPickedLon(observer.lon);
      setSiteName(observer.name);
      setSiteNote('');
      setSiteBortle('');
      setEditingSiteId(null);
      setActiveInfoSiteId(null);
      setCameraTarget({ lat: observer.lat, lng: observer.lon, zoom: 11, seq: Date.now() });
    }
  }, [open, initialFocusSite, observer.lat, observer.lon, observer.name]);

  // Escape key to close modal
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isAutoName = (name: string) =>
    !name.trim() || name.startsWith('지도 선택 (') || name === '사용자 지정';

  const handleMapClick = (ev: { detail?: { latLng?: { lat: number; lng: number } | null } }) => {
    const ll = ev.detail?.latLng;
    if (!ll) return;
    const nextLat = Number(clampLat(ll.lat).toFixed(5));
    const nextLon = Number(clampLon(ll.lng).toFixed(5));
    setPickedLat(nextLat);
    setPickedLon(nextLon);
    setEditingSiteId(null);
    setActiveInfoSiteId(null);
    if (isAutoName(siteName) || siteName === observer.name) {
      setSiteName(`지도 선택 (${nextLat.toFixed(3)}, ${nextLon.toFixed(3)})`);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showNotice('이 브라우저에서는 위치 정보(GPS)를 지원하지 않습니다.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = Number(clampLat(pos.coords.latitude).toFixed(5));
        const nextLon = Number(clampLon(pos.coords.longitude).toFixed(5));
        setPickedLat(nextLat);
        setPickedLon(nextLon);
        setEditingSiteId(null);
        setSiteName('현재 위치 (GPS)');
        setCameraTarget({ lat: nextLat, lng: nextLon, zoom: 13, seq: Date.now() });
        setLocatingGps(false);
        showNotice('현재 GPS 위치로 이동했습니다.');
      },
      () => {
        setLocatingGps(false);
        showNotice('위치 권한이 거부되었거나 좌표를 가져올 수 없습니다.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleApplyCurrent = () => {
    const cleanName =
      siteName.trim() || `관측지 (${pickedLat.toFixed(3)}, ${pickedLon.toFixed(3)})`;
    onApplySite({
      name: cleanName,
      lat: Number(clampLat(pickedLat).toFixed(6)),
      lon: Number(clampLon(pickedLon).toFixed(6)),
    });
    onClose();
  };

  const handleSaveToList = (alsoApply: boolean) => {
    const cleanName =
      siteName.trim() || `관측지 (${pickedLat.toFixed(3)}, ${pickedLon.toFixed(3)})`;
    const bortleVal = parseInt(siteBortle, 10);
    const existing = editingSiteId
      ? savedSites.find((s) => s.id === editingSiteId)
      : undefined;
    const saved: SavedObservingSite = {
      id:
        existing?.id ||
        `site_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      lat: Number(clampLat(pickedLat).toFixed(6)),
      lon: Number(clampLon(pickedLon).toFixed(6)),
      note: siteNote.trim() || undefined,
      bortle:
        Number.isFinite(bortleVal) && bortleVal >= 1 && bortleVal <= 9
          ? bortleVal
          : undefined,
      createdAt: existing?.createdAt || Date.now(),
    };
    onSaveSite(saved);
    setEditingSiteId(saved.id);
    if (alsoApply) {
      onApplySite({ name: saved.name, lat: saved.lat, lon: saved.lon });
      showNotice(`"${saved.name}" 저장 및 현재 관측지로 적용되었습니다.`);
    } else {
      showNotice(
        existing
          ? `"${saved.name}" 관측지 정보가 수정되었습니다.`
          : `"${saved.name}" 관측지가 저장되었습니다.`
      );
    }
  };

  const handleSelectSavedSite = (site: SavedObservingSite) => {
    setPickedLat(site.lat);
    setPickedLon(site.lon);
    setSiteName(site.name);
    setSiteNote(site.note ?? '');
    setSiteBortle(site.bortle ? String(site.bortle) : '');
    setEditingSiteId(site.id);
    setActiveInfoSiteId(site.id);
    setCameraTarget({ lat: site.lat, lng: site.lon, zoom: 12, seq: Date.now() });
  };

  const handleExportFile = () => {
    if (savedSites.length === 0) {
      showNotice('저장된 관측지가 없습니다. 먼저 관측지를 저장해 주세요.');
      return;
    }
    downloadObservingSitesFile(savedSites);
    showNotice(`${savedSites.length}개의 관측지를 로컬 파일(.json)로 저장했습니다.`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseObservingSitesFromJson(text);
      if (parsed.error) {
        showNotice(parsed.error);
        return;
      }
      const { addedCount, updatedCount } = onImportSites(parsed.sites);
      if (parsed.sites[0]) {
        setCameraTarget({
          lat: parsed.sites[0].lat,
          lng: parsed.sites[0].lon,
          zoom: 10,
          seq: Date.now(),
        });
      }
      showNotice(
        `파일 불러오기 완료: 신규 ${addedCount}개${
          updatedCount > 0 ? ` · 갱신 ${updatedCount}개` : ''
        }`
      );
    } catch {
      showNotice('파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  const modalShellCls =
    theme === 'white'
      ? 'bg-white border-slate-300 text-slate-900 shadow-2xl'
      : theme === 'red'
      ? 'bg-[#0B0000] border-[#5A1212] text-[#FF4D4D] shadow-2xl'
      : 'bg-[#0B1220] border-[#25334D] text-slate-100 shadow-2xl';

  const cardSurfaceCls =
    theme === 'white'
      ? 'bg-slate-50 border-slate-200'
      : theme === 'red'
      ? 'bg-[#140101] border-[#3F0A0A]'
      : 'bg-[#0F182A] border-[#1F2F49]';

  const primaryCtaCls =
    theme === 'white'
      ? 'bg-blue-700 hover:bg-blue-800 text-white border-blue-800'
      : theme === 'red'
      ? 'bg-[#8F1616] hover:bg-[#A61B1B] text-[#FFE0E0] border-[#B91C1C]'
      : 'bg-[#0094B8] hover:bg-[#00A8D0] text-white border-[#06B6D4]';

  const activeInfoSite = activeInfoSiteId
    ? savedSites.find((s) => s.id === activeInfoSiteId) ?? null
    : null;

  const isSameAsActive =
    Math.abs(pickedLat - observer.lat) < 0.0002 &&
    Math.abs(pickedLon - observer.lon) < 0.0002;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="관측지 지도 선택 및 관리"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-[min(96vw,1040px)] h-[min(90vh,700px)] border rounded-xl flex flex-col overflow-hidden ${modalShellCls}`}
      >
        {/* Modal Header */}
        <div
          className={`shrink-0 px-3.5 py-2.5 border-b flex items-center justify-between gap-3 ${ui.divider}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className={`w-4 h-4 shrink-0 ${ui.accentText}`} />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight truncate">
                지도에서 관측지 선택 및 관리
              </h2>
              <p className={`text-[10.5px] truncate ${ui.textMuted}`}>
                지도를 클릭하거나 핀을 드래그해 관측 좌표를 지정하고 로컬 파일(.json)로 저장·불러오기 할 수 있습니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={`p-1.5 border rounded-md transition-colors shrink-0 ${ui.buttonIdle}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Interactive Google Map Canvas */}
          <div className="relative flex-1 min-h-[300px] md:min-h-0 h-full overflow-hidden">
            {mapsApiKey ? (
              <APIProvider
                apiKey={mapsApiKey}
                language="ko"
                region="KR"
                libraries={['places', 'marker']}
              >
                <div
                  className="w-full h-full relative"
                  style={
                    theme === 'red' && redFilterEnabled
                      ? {
                          filter:
                            'sepia(1) hue-rotate(-55deg) saturate(2.3) brightness(0.68)',
                        }
                      : undefined
                  }
                >
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    defaultCenter={{ lat: pickedLat, lng: pickedLon }}
                    defaultZoom={11}
                    mapTypeId={mapType}
                    gestureHandling="greedy"
                    streetViewControl={false}
                    mapTypeControl={false}
                    fullscreenControl={false}
                    clickableIcons={false}
                    onClick={handleMapClick}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <MapCameraController target={cameraTarget} />

                    {/* Current active observer marker (if distinct from candidate) */}
                    {!isSameAsActive && (
                      <AdvancedMarker
                        position={{ lat: observer.lat, lng: observer.lon }}
                        title={`현재 관측지: ${observer.name}`}
                        onClick={() => {
                          setPickedLat(observer.lat);
                          setPickedLon(observer.lon);
                          setSiteName(observer.name);
                          setEditingSiteId(null);
                        }}
                      >
                        <Pin
                          background="#0284C7"
                          borderColor="#0369A1"
                          glyphColor="#E0F2FE"
                          scale={0.9}
                        />
                      </AdvancedMarker>
                    )}

                    {/* Saved Observing Sites Markers */}
                    {savedSites.map((site) => {
                      const isEditingThis = editingSiteId === site.id;
                      if (isEditingThis) return null;
                      return (
                        <AdvancedMarker
                          key={site.id}
                          position={{ lat: site.lat, lng: site.lon }}
                          title={site.name}
                          onClick={() => handleSelectSavedSite(site)}
                        >
                          <Pin
                            background={theme === 'red' ? '#991B1B' : '#7C3AED'}
                            borderColor={theme === 'red' ? '#450A0A' : '#4C1D95'}
                            glyphColor="#FFFFFF"
                            scale={0.95}
                          />
                        </AdvancedMarker>
                      );
                    })}

                    {/* Candidate / Picked Location Draggable Marker */}
                    <AdvancedMarker
                      position={{ lat: pickedLat, lng: pickedLon }}
                      draggable={true}
                      title={siteName || '선택된 관측지'}
                      onDragEnd={(ev) => {
                        const ll = ev.latLng;
                        if (!ll) return;
                        const nextLat = Number(clampLat(ll.lat()).toFixed(5));
                        const nextLon = Number(clampLon(ll.lng()).toFixed(5));
                        setPickedLat(nextLat);
                        setPickedLon(nextLon);
                        if (isAutoName(siteName)) {
                          setSiteName(
                            `지도 선택 (${nextLat.toFixed(3)}, ${nextLon.toFixed(3)})`
                          );
                        }
                      }}
                    >
                      <Pin
                        background={theme === 'red' ? '#EF4444' : '#F59E0B'}
                        borderColor={theme === 'red' ? '#7F1D1D' : '#B45309'}
                        glyphColor="#FFFFFF"
                        scale={1.2}
                      />
                    </AdvancedMarker>

                    {activeInfoSite && (
                      <InfoWindow
                        position={{ lat: activeInfoSite.lat, lng: activeInfoSite.lon }}
                        pixelOffset={[0, -38]}
                        onCloseClick={() => setActiveInfoSiteId(null)}
                      >
                        <div className="text-slate-900 text-xs max-w-[200px] p-0.5">
                          <div className="font-bold text-slate-900">
                            {activeInfoSite.name}
                          </div>
                          <div className="font-mono text-[10.5px] text-slate-600 mt-0.5">
                            {formatCoordsShort(activeInfoSite.lat, activeInfoSite.lon)}
                          </div>
                          {activeInfoSite.bortle && (
                            <div className="text-[10.5px] text-indigo-700 font-medium mt-0.5">
                              Bortle {activeInfoSite.bortle}등급
                            </div>
                          )}
                          {activeInfoSite.note && (
                            <div className="text-[10.5px] text-slate-600 mt-0.5">
                              {activeInfoSite.note}
                            </div>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                </div>

                <MapLoadStatusOverlay theme={theme} />

                {/* Top-Left Search Bar Overlay (unfiltered for crisp readability) */}
                <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
                  <div className="pointer-events-auto flex-1 min-w-[200px] max-w-xs">
                    <PlaceSearchBar
                      theme={theme}
                      onSelectPlace={({ name, lat, lon, viewport }) => {
                        const cLat = Number(clampLat(lat).toFixed(5));
                        const cLon = Number(clampLon(lon).toFixed(5));
                        setPickedLat(cLat);
                        setPickedLon(cLon);
                        setSiteName(name);
                        setEditingSiteId(null);
                        setActiveInfoSiteId(null);
                        if (!viewport) {
                          setCameraTarget({
                            lat: cLat,
                            lng: cLon,
                            zoom: 13,
                            seq: Date.now(),
                          });
                        }
                      }}
                    />
                  </div>

                  {/* Top-Right Map Type & GPS Controls */}
                  <div className="pointer-events-auto flex items-center gap-1.5">
                    <div
                      className={`flex items-center p-0.5 border rounded-md ${
                        theme === 'white'
                          ? 'bg-white/95 border-slate-300 shadow-sm'
                          : theme === 'red'
                          ? 'bg-[#120101]/95 border-[#5A1212] shadow-sm'
                          : 'bg-[#0B1220]/95 border-[#2C3E5C] shadow-md'
                      }`}
                    >
                      {(
                        [
                          { id: 'roadmap', label: '지도' },
                          { id: 'terrain', label: '지형' },
                          { id: 'hybrid', label: '위성' },
                        ] as const
                      ).map((mt) => (
                        <button
                          key={mt.id}
                          type="button"
                          onClick={() => setMapType(mt.id)}
                          className={`px-2 py-1 text-[10.5px] font-medium rounded transition-colors ${
                            mapType === mt.id ? ui.buttonActive : ui.textSecondary
                          }`}
                        >
                          {mt.label}
                        </button>
                      ))}
                    </div>

                    {theme === 'red' && (
                      <button
                        type="button"
                        onClick={() => setRedFilterEnabled((v) => !v)}
                        title="적색 야간 지도 필터 토글"
                        className={`px-2 py-1.5 border rounded-md text-[10.5px] font-medium ${
                          redFilterEnabled ? ui.buttonActive : ui.buttonIdle
                        }`}
                      >
                        {redFilterEnabled ? '적색필터' : '원본색'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLocateMe}
                      disabled={locatingGps}
                      title="현재 GPS 위치로 이동"
                      className={`px-2 py-1.5 border rounded-md text-[11px] font-medium flex items-center gap-1 shadow-sm ${
                        theme === 'white'
                          ? 'bg-white/95 border-slate-300 text-slate-700 hover:bg-slate-50'
                          : theme === 'red'
                          ? 'bg-[#120101]/95 border-[#5A1212] text-[#FF5252] hover:bg-[#240303]'
                          : 'bg-[#0B1220]/95 border-[#2C3E5C] text-slate-200 hover:bg-[#162235]'
                      }`}
                    >
                      {locatingGps ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LocateFixed className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">내 위치</span>
                    </button>
                  </div>
                </div>

                {/* Bottom-Left Live Coordinate HUD */}
                <div
                  className={`absolute bottom-2.5 left-2.5 z-20 px-2.5 py-1.5 border rounded-md text-[11px] font-mono tabular-nums flex items-center gap-2 pointer-events-none ${
                    theme === 'white'
                      ? 'bg-white/95 border-slate-300 text-slate-800 shadow-sm'
                      : theme === 'red'
                      ? 'bg-[#120101]/95 border-[#5A1212] text-[#FF6B6B] shadow-sm'
                      : 'bg-[#0B1220]/95 border-[#2C3E5C] text-cyan-300 shadow-md'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span>{formatCoordsShort(pickedLat, pickedLon)}</span>
                </div>
              </APIProvider>
            ) : (
              <div
                className={`w-full h-full flex flex-col items-center justify-center p-6 text-center ${
                  theme === 'white'
                    ? 'bg-slate-100 text-slate-700'
                    : theme === 'red'
                    ? 'bg-[#120000] text-[#FF6B6B]'
                    : 'bg-[#070B14] text-slate-300'
                }`}
              >
                {!keyChecked ? (
                  <div className="flex items-center gap-2 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>지도 설정 확인 중...</span>
                  </div>
                ) : (
                  <>
                    <MapPin className="w-8 h-8 mb-2 opacity-60" />
                    <div className="text-sm font-semibold mb-1">
                      Google Maps API 키를 찾을 수 없습니다
                    </div>
                    <p className="text-xs opacity-75 max-w-sm leading-relaxed">
                      우측 패널에서 위도·경도를 직접 입력해 관측지를 설정하거나 로컬 파일(.json)로 관측지를 저장·불러오기 할 수 있습니다.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Side Panel: Selected Coordinates + Save + Saved List + File I/O */}
          <div
            className={`w-full md:w-[300px] shrink-0 border-t md:border-t-0 md:border-l flex flex-col min-h-0 overflow-hidden ${ui.divider}`}
          >
            {/* Selected Site Editor */}
            <div className={`p-3 border-b space-y-2.5 shrink-0 ${ui.divider}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold ${ui.textPrimary}`}>
                  {editingSiteId ? '저장된 관측지 편집' : '선택한 위치'}
                </span>
                {editingSiteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSiteId(null);
                      setSiteNote('');
                      setSiteBortle('');
                    }}
                    className={`text-[10px] underline ${ui.textMuted}`}
                  >
                    새 관측지로 저장
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <div>
                  <label className={`block text-[10.5px] mb-0.5 ${ui.textMuted}`}>
                    관측지 이름
                  </label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="예: 강원도 안반데기, 양평 벗고개"
                    className={`w-full px-2 py-1.5 border rounded text-xs ${ui.input}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className={`block text-[10.5px] mb-0.5 ${ui.textMuted}`}>
                      위도 Lat (°)
                    </label>
                    <input
                      type="number"
                      min={-90}
                      max={90}
                      step={0.001}
                      value={Number(pickedLat.toFixed(5))}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) {
                          const cLat = clampLat(v);
                          setPickedLat(cLat);
                          setCameraTarget({ lat: cLat, lng: pickedLon, seq: Date.now() });
                        }
                      }}
                      className={`w-full px-2 py-1 border rounded font-mono tabular-nums text-[11px] ${ui.input}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10.5px] mb-0.5 ${ui.textMuted}`}>
                      경도 Lon (°)
                    </label>
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      step={0.001}
                      value={Number(pickedLon.toFixed(5))}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) {
                          const cLon = clampLon(v);
                          setPickedLon(cLon);
                          setCameraTarget({ lat: pickedLat, lng: cLon, seq: Date.now() });
                        }
                      }}
                      className={`w-full px-2 py-1 border rounded font-mono tabular-nums text-[11px] ${ui.input}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div className="col-span-2">
                    <label className={`block text-[10.5px] mb-0.5 ${ui.textMuted}`}>
                      메모 (선택)
                    </label>
                    <input
                      type="text"
                      value={siteNote}
                      onChange={(e) => setSiteNote(e.target.value)}
                      placeholder="시야, 주차, 접근성..."
                      className={`w-full px-2 py-1 border rounded text-[11px] ${ui.input}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10.5px] mb-0.5 ${ui.textMuted}`}>
                      Bortle
                    </label>
                    <select
                      value={siteBortle}
                      onChange={(e) => setSiteBortle(e.target.value)}
                      className={`w-full px-1.5 py-1 border rounded text-[11px] ${ui.input}`}
                    >
                      <option value="">미지정</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) => (
                        <option key={b} value={String(b)}>
                          B{b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleApplyCurrent}
                  className={`w-full py-2 px-3 border rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${primaryCtaCls}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>이 위치로 관측지 설정</span>
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSaveToList(false)}
                    className={`py-1.5 px-2 border rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${ui.buttonIdle}`}
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>{editingSiteId ? '수정 저장' : '목록에 저장'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveToList(true)}
                    className={`py-1.5 px-2 border rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${ui.buttonActive}`}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>저장 후 적용</span>
                  </button>
                </div>
              </div>

              {statusMsg && (
                <div
                  className={`px-2 py-1.5 rounded border text-[10.5px] leading-snug ${cardSurfaceCls} ${ui.accentText}`}
                >
                  {statusMsg}
                </div>
              )}
            </div>

            {/* Saved Sites List */}
            <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                <span className={`text-[11px] font-semibold ${ui.textPrimary}`}>
                  저장된 관측지 ({savedSites.length})
                </span>
                <span className={`text-[10px] ${ui.textMuted}`}>
                  클릭하여 지도 이동
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto astro-scroll space-y-1.5 pr-0.5">
                {savedSites.length === 0 ? (
                  <div
                    className={`p-3 border rounded-md text-center text-[11px] leading-relaxed ${cardSurfaceCls} ${ui.textMuted}`}
                  >
                    저장된 관측지가 없습니다. 지도에서 원하는 장소를 클릭한 뒤{' '}
                    <strong>목록에 저장</strong>을 눌러 보세요.
                  </div>
                ) : (
                  savedSites.map((site) => {
                    const isFocused = editingSiteId === site.id;
                    const isActiveObs =
                      Math.abs(observer.lat - site.lat) < 0.0005 &&
                      Math.abs(observer.lon - site.lon) < 0.0005 &&
                      observer.name === site.name;
                    return (
                      <div
                        key={site.id}
                        className={`border rounded-md p-2 transition-colors ${
                          isFocused ? ui.buttonActive : cardSurfaceCls
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSelectSavedSite(site)}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-[11.5px] font-semibold truncate ${ui.textPrimary}`}
                              >
                                {site.name}
                              </span>
                              {isActiveObs && (
                                <span
                                  className={`px-1 py-0.5 text-[9px] rounded font-semibold shrink-0 ${
                                    theme === 'white'
                                      ? 'bg-blue-100 text-blue-700'
                                      : theme === 'red'
                                      ? 'bg-[#3D0808] text-[#FF6B6B]'
                                      : 'bg-cyan-500/20 text-cyan-300'
                                  }`}
                                >
                                  적용중
                                </span>
                              )}
                            </div>
                            <div
                              className={`font-mono text-[10px] tabular-nums mt-0.5 ${ui.textMuted}`}
                            >
                              {site.lat.toFixed(4)}°, {site.lon.toFixed(4)}°
                              {site.bortle ? ` · B${site.bortle}` : ''}
                            </div>
                            {site.note && (
                              <div className={`text-[10px] truncate mt-0.5 ${ui.textMuted}`}>
                                {site.note}
                              </div>
                            )}
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onApplySite({
                                  name: site.name,
                                  lat: site.lat,
                                  lon: site.lon,
                                });
                                onClose();
                              }}
                              title="이 관측지로 즉시 설정"
                              className={`px-1.5 py-1 border rounded text-[10px] font-medium ${ui.buttonIdle}`}
                            >
                              적용
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await onDeleteSite(site.id);
                                if (ok === false) return;
                                if (editingSiteId === site.id) {
                                  setEditingSiteId(null);
                                }
                                if (activeInfoSiteId === site.id) {
                                  setActiveInfoSiteId(null);
                                }
                              }}
                              title="삭제"
                              aria-label={`${site.name} 삭제`}
                              className={`p-1 border rounded ${ui.buttonIdle} hover:text-red-400`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Local File Export / Import Footer */}
              <div className={`pt-2.5 mt-2.5 border-t grid grid-cols-2 gap-1.5 shrink-0 ${ui.divider}`}>
                <button
                  type="button"
                  onClick={handleExportFile}
                  className={`py-1.5 px-2 border rounded-md text-[10.5px] font-medium flex items-center justify-center gap-1 ${ui.buttonIdle}`}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>파일 저장 (.json)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`py-1.5 px-2 border rounded-md text-[10.5px] font-medium flex items-center justify-center gap-1 ${ui.buttonIdle}`}
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>파일 불러오기</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void handleImportFile(e)}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
