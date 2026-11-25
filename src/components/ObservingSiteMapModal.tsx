import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BookmarkPlus,
  Check,
  Crosshair,
  Download,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ObserverConfig,
  SavedObservingSite,
  ThemeMode,
} from '../types/astronomy';
import { estimateSiteBortleClass } from '../utils/bortle';
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
  bounds?: [number, number, number, number]; // [south, north, west, east]
  seq: number;
}

interface GeocodeSuggestion {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
  boundingbox?: [number, number, number, number];
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPinIcon(fillColor: string, strokeColor: string, scale = 1): L.DivIcon {
  const w = Math.round(26 * scale);
  const h = Math.round(36 * scale);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 26 36" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45)); display: block;">
      <path d="M13 1.5C6.65 1.5 1.5 6.65 1.5 13c0 8.5 10.35 19.6 10.8 20.08a.95.95 0 0 0 1.4 0C14.15 32.6 24.5 21.5 24.5 13 24.5 6.65 19.35 1.5 13 1.5z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
      <circle cx="13" cy="12.5" r="4.3" fill="#ffffff" fill-opacity="0.95"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'noxchart-leaflet-pin',
    iconSize: [w, h],
    iconAnchor: [Math.round(w / 2), h],
    popupAnchor: [0, -h + 4],
  });
}

async function queryOpenGeocode(query: string, signal: AbortSignal): Promise<GeocodeSuggestion[]> {
  // 1. Try local Express open-API geocode proxy (Nominatim + Photon with proper User-Agent & cache)
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { results?: GeocodeSuggestion[] };
      if (Array.isArray(data.results)) {
        return data.results;
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
  }

  // 2. Direct browser fallback to OpenStreetMap Nominatim Open API
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=ko&q=${encodeURIComponent(
        query
      )}`,
      { signal, headers: { Accept: 'application/json' } }
    );
    if (nomRes.ok) {
      const rows = (await nomRes.json()) as Array<{
        place_id?: number | string;
        name?: string;
        display_name?: string;
        lat?: string;
        lon?: string;
        boundingbox?: [string, string, string, string];
      }>;
      if (Array.isArray(rows) && rows.length > 0) {
        return rows
          .map((r, idx): GeocodeSuggestion | null => {
            const lat = Number(r.lat);
            const lon = Number(r.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            const full = String(r.display_name || '').trim();
            const parts = full.split(',').map((s) => s.trim()).filter(Boolean);
            const name = (r.name && r.name.trim()) || parts[0] || query;
            const detail = parts.length > 1 ? parts.slice(1).join(', ') : '';
            let bbox: [number, number, number, number] | undefined;
            if (Array.isArray(r.boundingbox) && r.boundingbox.length === 4) {
              const nums = r.boundingbox.map(Number);
              if (nums.every(Number.isFinite)) {
                bbox = [nums[0], nums[1], nums[2], nums[3]];
              }
            }
            return {
              id: `nom_${r.place_id ?? idx}`,
              name,
              detail: detail === name ? '' : detail,
              lat,
              lon,
              boundingbox: bbox,
            };
          })
          .filter((x): x is GeocodeSuggestion => x !== null);
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
  }

  // 3. Direct browser fallback to Komoot Photon Open API
  const photonRes = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8`,
    { signal, headers: { Accept: 'application/json' } }
  );
  if (!photonRes.ok) return [];
  const payload = (await photonRes.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        osm_id?: number;
        name?: string;
        street?: string;
        city?: string;
        county?: string;
        state?: string;
        country?: string;
        extent?: [number, number, number, number];
      };
    }>;
  };
  const feats = Array.isArray(payload?.features) ? payload.features : [];
  return feats
    .map((f, idx): GeocodeSuggestion | null => {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const p = f.properties || {};
      const name = p.name || p.street || p.city || p.state || query;
      const detailParts = [p.city, p.county, p.state, p.country].filter(
        (v): v is string => Boolean(v && v !== name)
      );
      let bbox: [number, number, number, number] | undefined;
      if (Array.isArray(p.extent) && p.extent.length === 4) {
        const [west, north, east, south] = p.extent.map(Number);
        if ([west, north, east, south].every(Number.isFinite)) {
          bbox = [south, north, west, east];
        }
      }
      return {
        id: `pho_${p.osm_id ?? idx}_${lat.toFixed(4)}`,
        name,
        detail: detailParts.join(', '),
        lat,
        lon,
        boundingbox: bbox,
      };
    })
    .filter((x): x is GeocodeSuggestion => x !== null);
}

interface PlaceSearchBarProps {
  theme: ThemeMode;
  onSelectPlace: (placeInfo: {
    name: string;
    lat: number;
    lon: number;
    bounds?: [number, number, number, number];
  }) => void;
}

function OpenPlaceSearchBar({ theme, onSelectPlace }: PlaceSearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await queryOpenGeocode(trimmed, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setDropdownOpen(true);
        if (results.length === 0) {
          setSearchError('검색 결과가 없습니다. 영문 지명이나 인근 시·군 이름으로 검색해 보세요.');
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setSuggestions([]);
        setSearchError('장소 검색 중 오류가 발생했습니다. 지도를 직접 클릭해 선택할 수 있습니다.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const trimmed = inputValue.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 360);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, runSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handlePickSuggestion = useCallback(
    (item: GeocodeSuggestion) => {
      onSelectPlace({
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        bounds: item.boundingbox,
      });
      setInputValue('');
      setSuggestions([]);
      setDropdownOpen(false);
      setSearchError(null);
    },
    [onSelectPlace]
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
              }
              void runSearch(inputValue);
            }
          }}
          placeholder="관측지, 천문대, 지명 검색 (OSM)..."
          className="w-full bg-transparent text-xs outline-none placeholder:opacity-60"
        />
        {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 opacity-75" />}
        {inputValue && !isSearching && (
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              setInputValue('');
              setSuggestions([]);
              setDropdownOpen(false);
              setSearchError(null);
            }}
            aria-label="검색어 지우기"
            className="opacity-65 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {dropdownOpen && suggestions.length > 0 && (
        <ul
          className={`absolute left-0 right-0 top-full mt-1 border rounded-md overflow-hidden max-h-56 overflow-y-auto astro-scroll z-30 ${surfaceCls}`}
        >
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handlePickSuggestion(item)}
                className={`w-full text-left px-2.5 py-2 text-xs transition-colors border-b last:border-b-0 cursor-pointer ${
                  theme === 'white'
                    ? 'border-slate-100'
                    : theme === 'red'
                    ? 'border-[#300606]'
                    : 'border-[#1E2B42]'
                } ${itemHoverCls}`}
              >
                <div className="font-medium truncate">{item.name}</div>
                {item.detail && (
                  <div className="text-[10.5px] opacity-65 truncate mt-0.5">{item.detail}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchError && (
        <div className={`mt-1 px-2 py-1 text-[10.5px] border rounded ${surfaceCls}`}>
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const savedLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const activeObsMarkerRef = useRef<L.Marker | null>(null);
  const candidateMarkerRef = useRef<L.Marker | null>(null);

  const [pickedLat, setPickedLat] = useState<number>(observer.lat);
  const [pickedLon, setPickedLon] = useState<number>(observer.lon);
  const [siteName, setSiteName] = useState<string>(observer.name);
  const [siteNote, setSiteNote] = useState<string>('');
  const [siteBortle, setSiteBortle] = useState<string>('');
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapStyleType>('roadmap');
  const [redFilterEnabled, setRedFilterEnabled] = useState<boolean>(true);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const siteNameRef = useRef(siteName);
  siteNameRef.current = siteName;
  const observerNameRef = useRef(observer.name);
  observerNameRef.current = observer.name;

  const showNotice = useCallback((msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => {
      setStatusMsg((cur) => (cur === msg ? null : cur));
    }, 3600);
  }, []);

  const isAutoName = useCallback(
    (name: string) =>
      !name.trim() || name.startsWith('지도 선택 (') || name === '사용자 지정',
    []
  );

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
      setCameraTarget({ lat: focus.lat, lng: focus.lon, zoom: 12, seq: Date.now() });
    } else {
      setPickedLat(observer.lat);
      setPickedLon(observer.lon);
      setSiteName(observer.name);
      setSiteNote('');
      setSiteBortle('');
      setEditingSiteId(null);
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

  const handleSelectSavedSite = useCallback((site: SavedObservingSite) => {
    setPickedLat(site.lat);
    setPickedLon(site.lon);
    setSiteName(site.name);
    setSiteNote(site.note ?? '');
    setSiteBortle(site.bortle ? String(site.bortle) : '');
    setEditingSiteId(site.id);
    setCameraTarget({ lat: site.lat, lng: site.lon, zoom: 12, seq: Date.now() });
  }, []);

  // Initialize Leaflet map when modal opens
  useEffect(() => {
    if (!open) return;
    const container = mapContainerRef.current;
    if (!container) return;

    const initLat = initialFocusSite ? initialFocusSite.lat : observer.lat;
    const initLon = initialFocusSite ? initialFocusSite.lon : observer.lon;
    const initZoom = initialFocusSite ? 12 : 11;

    const map = L.map(container, {
      center: [initLat, initLon],
      zoom: initZoom,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const baseGroup = L.layerGroup().addTo(map);
    const savedGroup = L.layerGroup().addTo(map);
    baseLayerGroupRef.current = baseGroup;
    savedLayerGroupRef.current = savedGroup;
    mapInstanceRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const nextLat = Number(clampLat(e.latlng.lat).toFixed(5));
      const nextLon = Number(clampLon(e.latlng.lng).toFixed(5));
      setPickedLat(nextLat);
      setPickedLon(nextLon);
      setEditingSiteId(null);
      if (isAutoName(siteNameRef.current) || siteNameRef.current === observerNameRef.current) {
        setSiteName(`지도 선택 (${nextLat.toFixed(3)}, ${nextLon.toFixed(3)})`);
      }
    });

    // Ensure Leaflet measures container properly after modal renders/resizes
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const timer = window.setTimeout(() => map.invalidateSize(), 160);
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      baseLayerGroupRef.current = null;
      savedLayerGroupRef.current = null;
      activeObsMarkerRef.current = null;
      candidateMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Switch open tile layer (OpenStreetMap / OpenTopoMap / Esri Satellite + Labels)
  useEffect(() => {
    if (!open || !baseLayerGroupRef.current) return;
    const group = baseLayerGroupRef.current;
    group.clearLayers();

    if (mapType === 'terrain') {
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '© OpenStreetMap, © OpenTopoMap (CC-BY-SA)',
      }).addTo(group);
    } else if (mapType === 'hybrid') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          attribution: 'Tiles © Esri, Maxar, Earthstar Geographics',
        }
      ).addTo(group);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          opacity: 0.9,
        }
      ).addTo(group);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(group);
    }
  }, [open, mapType]);

  // Pan / Zoom / FitBounds camera when target changes
  useEffect(() => {
    if (!open || !mapInstanceRef.current || !cameraTarget) return;
    const map = mapInstanceRef.current;
    if (cameraTarget.bounds) {
      const [south, north, west, east] = cameraTarget.bounds;
      if (
        Number.isFinite(south) &&
        Number.isFinite(north) &&
        Number.isFinite(west) &&
        Number.isFinite(east) &&
        Math.abs(north - south) > 0.002 &&
        Math.abs(east - west) > 0.002
      ) {
        map.fitBounds(
          [
            [south, west],
            [north, east],
          ],
          { maxZoom: 14, padding: [36, 36] }
        );
        return;
      }
    }
    if (typeof cameraTarget.zoom === 'number') {
      map.setView([cameraTarget.lat, cameraTarget.lng], cameraTarget.zoom, { animate: true });
    } else {
      map.panTo([cameraTarget.lat, cameraTarget.lng], { animate: true });
    }
  }, [open, cameraTarget]);

  const isSameAsActive =
    Math.abs(pickedLat - observer.lat) < 0.0002 &&
    Math.abs(pickedLon - observer.lon) < 0.0002;

  // Render Current Active Observer marker (when distinct from candidate)
  useEffect(() => {
    if (!open || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (activeObsMarkerRef.current) {
      activeObsMarkerRef.current.remove();
      activeObsMarkerRef.current = null;
    }
    if (!isSameAsActive) {
      const marker = L.marker([observer.lat, observer.lon], {
        icon: createPinIcon('#0284C7', '#0369A1', 0.92),
        title: `현재 관측지: ${observer.name}`,
      }).addTo(map);
      marker.on('click', () => {
        setPickedLat(observer.lat);
        setPickedLon(observer.lon);
        setSiteName(observer.name);
        setEditingSiteId(null);
      });
      activeObsMarkerRef.current = marker;
    }
  }, [open, isSameAsActive, observer.lat, observer.lon, observer.name]);

  // Render Saved Observing Site markers
  useEffect(() => {
    if (!open || !savedLayerGroupRef.current) return;
    const group = savedLayerGroupRef.current;
    group.clearLayers();

    const fillColor = theme === 'red' ? '#991B1B' : '#7C3AED';
    const strokeColor = theme === 'red' ? '#450A0A' : '#4C1D95';

    for (const site of savedSites) {
      if (editingSiteId === site.id) continue;
      const marker = L.marker([site.lat, site.lon], {
        icon: createPinIcon(fillColor, strokeColor, 0.95),
        title: site.name,
      });

      const popupLines = [
        `<div style="font-weight:700;color:#0f172a;font-size:12px;">${escapeHtml(site.name)}</div>`,
        `<div style="font-family:monospace;font-size:10.5px;color:#475569;margin-top:2px;">${escapeHtml(
          formatCoordsShort(site.lat, site.lon)
        )}</div>`,
      ];
      if (site.bortle) {
        popupLines.push(
          `<div style="font-size:10.5px;color:#4338ca;font-weight:600;margin-top:2px;">Bortle ${site.bortle}등급</div>`
        );
      }
      if (site.note) {
        popupLines.push(
          `<div style="font-size:10.5px;color:#475569;margin-top:2px;">${escapeHtml(site.note)}</div>`
        );
      }
      marker.bindPopup(`<div style="min-width:130px;max-width:210px;">${popupLines.join('')}</div>`);
      marker.on('click', () => {
        handleSelectSavedSite(site);
      });
      marker.addTo(group);
    }
  }, [open, savedSites, editingSiteId, theme, handleSelectSavedSite]);

  // Render Candidate / Picked Location draggable marker
  useEffect(() => {
    if (!open || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const fillColor = theme === 'red' ? '#EF4444' : '#F59E0B';
    const strokeColor = theme === 'red' ? '#7F1D1D' : '#B45309';

    if (!candidateMarkerRef.current) {
      const marker = L.marker([pickedLat, pickedLon], {
        draggable: true,
        zIndexOffset: 500,
        icon: createPinIcon(fillColor, strokeColor, 1.18),
        title: siteName || '선택된 관측지',
      }).addTo(map);
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        const nextLat = Number(clampLat(ll.lat).toFixed(5));
        const nextLon = Number(clampLon(ll.lng).toFixed(5));
        setPickedLat(nextLat);
        setPickedLon(nextLon);
        if (isAutoName(siteNameRef.current)) {
          setSiteName(`지도 선택 (${nextLat.toFixed(3)}, ${nextLon.toFixed(3)})`);
        }
      });
      candidateMarkerRef.current = marker;
    } else {
      candidateMarkerRef.current.setLatLng([pickedLat, pickedLon]);
      candidateMarkerRef.current.setIcon(createPinIcon(fillColor, strokeColor, 1.18));
    }
  }, [open, pickedLat, pickedLon, theme, siteName, isAutoName]);

  if (!open) return null;

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
                지도에서 관측지 선택 및 관리 (OpenStreetMap)
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
            className={`p-1.5 border rounded-md transition-colors shrink-0 cursor-pointer ${ui.buttonIdle}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Interactive OpenStreetMap / Leaflet Canvas */}
          <div className="relative flex-1 min-h-[300px] md:min-h-0 h-full overflow-hidden">
            <div
              ref={mapContainerRef}
              className="w-full h-full"
              style={
                theme === 'red' && redFilterEnabled
                  ? {
                      filter:
                        'sepia(1) hue-rotate(-55deg) saturate(2.3) brightness(0.68)',
                    }
                  : undefined
              }
            />

            {/* Top-Left Search Bar Overlay (above Leaflet z-index) */}
            <div className="absolute top-2.5 left-2.5 right-2.5 z-[1050] flex flex-wrap items-start justify-between gap-2 pointer-events-none">
              <div className="pointer-events-auto flex-1 min-w-[200px] max-w-xs">
                <OpenPlaceSearchBar
                  theme={theme}
                  onSelectPlace={({ name, lat, lon, bounds }) => {
                    const cLat = Number(clampLat(lat).toFixed(5));
                    const cLon = Number(clampLon(lon).toFixed(5));
                    setPickedLat(cLat);
                    setPickedLon(cLon);
                    setSiteName(name);
                    setEditingSiteId(null);
                    setCameraTarget({
                      lat: cLat,
                      lng: cLon,
                      zoom: 13,
                      bounds,
                      seq: Date.now(),
                    });
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
                      className={`px-2 py-1 text-[10.5px] font-medium rounded transition-colors cursor-pointer ${
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
                    className={`px-2 py-1.5 border rounded-md text-[10.5px] font-medium cursor-pointer ${
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
                  className={`px-2 py-1.5 border rounded-md text-[11px] font-medium flex items-center gap-1 shadow-sm cursor-pointer ${
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
              className={`absolute bottom-2.5 left-2.5 z-[1040] px-2.5 py-1.5 border rounded-md text-[11px] font-mono tabular-nums flex items-center gap-2 pointer-events-none ${
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
                    className={`text-[10px] underline cursor-pointer ${ui.textMuted}`}
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

                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-7">
                    <label className={`flex items-center h-4 text-[10.5px] mb-0.5 ${ui.textMuted}`}>
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
                  <div className="col-span-5">
                    <div className="flex items-center justify-between gap-1 h-4 mb-0.5">
                      <label className={`text-[10.5px] ${ui.textMuted}`}>
                        Bortle
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const est = estimateSiteBortleClass(pickedLat, pickedLon, siteName);
                          setSiteBortle(String(est.bortle));
                          showNotice(`좌표 기준 보틀 등급이 B${est.bortle}로 자동 추정되었습니다.`);
                        }}
                        title="현재 위도·경도 좌표로 보틀 등급 자동 추정"
                        className={`px-1.5 py-0.5 border rounded text-[9.5px] font-medium leading-none flex items-center gap-0.5 whitespace-nowrap cursor-pointer transition-colors ${ui.buttonIdle}`}
                      >
                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                        <span>자동추정</span>
                      </button>
                    </div>
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
                  className={`w-full py-2 px-3 border rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${primaryCtaCls}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>이 위치로 관측지 설정</span>
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSaveToList(false)}
                    className={`py-1.5 px-2 border rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${ui.buttonIdle}`}
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>{editingSiteId ? '수정 저장' : '목록에 저장'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveToList(true)}
                    className={`py-1.5 px-2 border rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${ui.buttonActive}`}
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
                            className="flex-1 text-left min-w-0 cursor-pointer"
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
                              className={`px-1.5 py-1 border rounded text-[10px] font-medium cursor-pointer ${ui.buttonIdle}`}
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
                              }}
                              title="삭제"
                              aria-label={`${site.name} 삭제`}
                              className={`p-1 border rounded cursor-pointer ${ui.buttonIdle} hover:text-red-400`}
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
              <div
                className={`pt-2.5 mt-2.5 border-t grid grid-cols-2 gap-1.5 shrink-0 ${ui.divider}`}
              >
                <button
                  type="button"
                  onClick={handleExportFile}
                  className={`py-1.5 px-2 border rounded-md text-[10.5px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${ui.buttonSave}`}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>파일 저장 (.json)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`py-1.5 px-2 border rounded-md text-[10.5px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${ui.buttonLoad}`}
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
