import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Crosshair,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Route,
  Star,
  Target,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { CatalogSnapshot } from '../data/catalogLoader';
import {
  ChartViewState,
  EquipmentLockerState,
  ObservationLogEntry,
  ObservationLogStoreState,
  ObservationSeeingGrade,
  ObserverConfig,
  ObservingListGroup,
  ObservingSessionEntry,
  OpticsSettings,
  SavedObservingSite,
  SelectedItem,
  ThemeMode,
} from '../types/astronomy';
import {
  angularDistanceDeg,
  DEG2RAD,
  equatorialToHorizontal,
  findStarHopGuides,
  formatDec,
  formatRA,
  getAltitudeProfile24h,
  getCompassDirection,
  getDsoTypeLabel,
  getLSTDeg,
  RAD2DEG,
} from '../utils/astronomy';
import {
  formatCatalogCode,
  formatObjectDisplayName,
  getBayerExpandedNames,
  getCatalogDesignationPriority,
  getSecondaryDesignations,
  getStarExtraDesignations,
  normalizeCatalogToken,
  sortCatalogDesignations,
} from '../utils/catalogNames';
import {
  buildActiveEquipmentSummary,
  formatObservationDateTime,
  fromDateTimeLocalValue,
  getSeeingLabel,
  getSelectedObjectMeta,
  SEEING_OPTIONS,
  toDateTimeLocalValue,
} from '../utils/observationLogStorage';
import { computePlanetOrientation } from '../utils/planetRenderer';
import { getSolarSystemBodies } from '../utils/solarSystem';
import { getUiTheme } from '../utils/themeClasses';

const IAU_CONSTELLATION_NAMES: Record<string, string> = {
  and: 'Andromeda',
  ant: 'Antlia',
  aps: 'Apus',
  aqr: 'Aquarius',
  aql: 'Aquila',
  ara: 'Ara',
  ari: 'Aries',
  aur: 'Auriga',
  boo: 'Bootes',
  cae: 'Caelum',
  cam: 'Camelopardalis',
  cnc: 'Cancer',
  cvn: 'Canes Venatici',
  cma: 'Canis Major',
  cmi: 'Canis Minor',
  cap: 'Capricornus',
  car: 'Carina',
  cas: 'Cassiopeia',
  cen: 'Centaurus',
  cep: 'Cepheus',
  cet: 'Cetus',
  cha: 'Chamaeleon',
  cir: 'Circinus',
  col: 'Columba',
  com: 'Coma Berenices',
  cra: 'Corona Australis',
  crb: 'Corona Borealis',
  crv: 'Corvus',
  crt: 'Crater',
  cru: 'Crux',
  cyg: 'Cygnus',
  del: 'Delphinus',
  dor: 'Dorado',
  dra: 'Draco',
  equ: 'Equuleus',
  eri: 'Eridanus',
  for: 'Fornax',
  gem: 'Gemini',
  gru: 'Grus',
  her: 'Hercules',
  hor: 'Horologium',
  hya: 'Hydra',
  hyi: 'Hydrus',
  ind: 'Indus',
  lac: 'Lacerta',
  leo: 'Leo',
  lmi: 'Leo Minor',
  lep: 'Lepus',
  lib: 'Libra',
  lup: 'Lupus',
  lyn: 'Lynx',
  lyr: 'Lyra',
  men: 'Mensa',
  mic: 'Microscopium',
  mon: 'Monoceros',
  mus: 'Musca',
  nor: 'Norma',
  oct: 'Octans',
  oph: 'Ophiuchus',
  ori: 'Orion',
  pav: 'Pavo',
  peg: 'Pegasus',
  per: 'Perseus',
  phe: 'Phoenix',
  pic: 'Pictor',
  psc: 'Pisces',
  psa: 'Piscis Austrinus',
  pup: 'Puppis',
  pyx: 'Pyxis',
  ret: 'Reticulum',
  sge: 'Sagitta',
  sgr: 'Sagittarius',
  sco: 'Scorpius',
  scl: 'Sculptor',
  sct: 'Scutum',
  ser: 'Serpens',
  sex: 'Sextans',
  tau: 'Taurus',
  tel: 'Telescopium',
  tri: 'Triangulum',
  tra: 'Triangulum Australe',
  tuc: 'Tucana',
  uma: 'Ursa Major',
  umi: 'Ursa Minor',
  vel: 'Vela',
  vir: 'Virgo',
  vol: 'Volans',
  vul: 'Vulpecula',
};

export interface CelestialInfoWindowProps {
  selected: SelectedItem;
  centerLocked: boolean;
  solarTrails: Record<string, number>;
  theme: ThemeMode;
  observer: ObserverConfig;
  optics: OpticsSettings;
  equipmentLocker: EquipmentLockerState;
  savedSites: SavedObservingSite[];
  catalogs: CatalogSnapshot;
  sessionPlan: ObservingSessionEntry[];
  observingLists: ObservingListGroup[];
  tonightListId: string | null;
  observationLogStore: ObservationLogStoreState;
  asterismMode: boolean;
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  dockSide: 'left' | 'right';
  onChangeDockSide: (side: 'left' | 'right') => void;
  onClose: () => void;
  onToggleCenterLock: () => void;
  onToggleSolarTrail: (bodyId: string) => void;
  onClearSolarTrails: () => void;
  onChangeView: (updater: (prev: ChartViewState) => ChartViewState) => void;
  onChangeOptics: (updater: (prev: OpticsSettings) => OpticsSettings) => void;
  onToggleSessionItem: (item: SelectedItem, targetListId?: string) => void;
  onSaveObservationLog: (entry: ObservationLogEntry) => void;
  onDeleteObservationLog: (id: string) => void;
  onToggleObjectObserved: (
    meta: {
      objectId: string;
      objectKind: ObservationLogEntry['objectKind'];
      objectName: string;
      constellation?: string;
      raDeg: number;
      decDeg: number;
    },
    observed: boolean
  ) => void;
  onOpenObservationLogsTab: () => void;
}

export function CelestialInfoWindow({
  selected,
  centerLocked,
  solarTrails,
  theme,
  observer,
  optics,
  equipmentLocker,
  savedSites,
  catalogs,
  sessionPlan,
  observingLists,
  tonightListId,
  observationLogStore,
  asterismMode,
  leftDrawerOpen,
  rightDrawerOpen,
  dockSide,
  onChangeDockSide,
  onClose,
  onToggleCenterLock,
  onToggleSolarTrail,
  onClearSolarTrails,
  onChangeView,
  onChangeOptics,
  onToggleSessionItem,
  onSaveObservationLog,
  onDeleteObservationLog,
  onToggleObjectObserved,
  onOpenObservationLogsTab,
}: CelestialInfoWindowProps) {
  const ui = getUiTheme(theme);
  const [detailTargetListId, setDetailTargetListId] = useState<string>('__tonight__');
  const [detailLogDraft, setDetailLogDraft] = useState<{
    id: string | null;
    observedAtLocal: string;
    location: string;
    equipment: string;
    seeing: ObservationSeeingGrade;
    rating: number;
    notes: string;
  } | null>(null);

  useEffect(() => {
    setDetailLogDraft(null);
  }, [selected.data.id]);

  useEffect(() => {
    if (
      detailTargetListId !== '__tonight__' &&
      !observingLists.some((l) => l.id === detailTargetListId)
    ) {
      setDetailTargetListId('__tonight__');
    }
  }, [detailTargetListId, observingLists]);

  const effectiveDetailListId =
    detailTargetListId === '__tonight__' ||
    observingLists.some((l) => l.id === detailTargetListId)
      ? detailTargetListId
      : '__tonight__';

  const detailTargetList =
    effectiveDetailListId === '__tonight__'
      ? null
      : observingLists.find((l) => l.id === effectiveDetailListId) ?? null;

  const obsTimeMs = observer.useLiveTime ? Date.now() : observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);

  const selectedAltAz = useMemo(
    () => equatorialToHorizontal(selected.data.ra, selected.data.dec, lstDeg, observer.lat),
    [selected.data.ra, selected.data.dec, lstDeg, observer.lat]
  );

  const selectedPlanetPhys = useMemo(() => {
    if (selected.kind !== 'planet') return null;
    const bodies = getSolarSystemBodies(obsTimeMs);
    const sun = bodies.find((b) => b.id === 'Sun');
    return computePlanetOrientation(selected.data, sun, obsTimeMs)?.phys ?? null;
  }, [selected, obsTimeMs]);

  const altProfile = useMemo(
    () =>
      getAltitudeProfile24h(
        selected.data.ra,
        selected.data.dec,
        observer.lat,
        observer.lon,
        obsTimeMs
      ),
    [selected.data.ra, selected.data.dec, observer.lat, observer.lon, obsTimeMs]
  );

  const hopGuides = useMemo(() => {
    const label =
      selected.kind === 'dso'
        ? selected.data.id
        : selected.kind === 'planet'
        ? selected.data.koName
        : selected.kind === 'double'
        ? selected.data.koName || selected.data.name || selected.data.bayer || selected.data.disc
        : selected.data.koName || selected.data.name || selected.data.bayer || selected.data.id;
    return findStarHopGuides(
      selected.data.ra,
      selected.data.dec,
      label,
      catalogs.brightStars,
      selected.kind === 'star' ? selected.data.id : undefined,
      selected.kind === 'star' ? selected.data.hip : undefined
    );
  }, [selected, catalogs.brightStars]);

  const focusHopRoute = (
    fromRa: number,
    fromDec: number,
    toRa: number,
    toDec: number,
    distDeg: number
  ) => {
    const a1 = fromRa * DEG2RAD;
    const d1 = fromDec * DEG2RAD;
    const a2 = toRa * DEG2RAD;
    const d2 = toDec * DEG2RAD;
    const mx = Math.cos(d1) * Math.cos(a1) + Math.cos(d2) * Math.cos(a2);
    const my = Math.cos(d1) * Math.sin(a1) + Math.cos(d2) * Math.sin(a2);
    const mz = Math.sin(d1) + Math.sin(d2);
    const len = Math.hypot(mx, my, mz) || 1;
    const midRaDeg = (((Math.atan2(my / len, mx / len) * RAD2DEG) + 360) % 360);
    const midDecDeg = Math.asin(Math.max(-1, Math.min(1, mz / len))) * RAD2DEG;
    onChangeOptics((p) => ({ ...p, showStarHop: true }));
    onChangeView((p) => ({
      ...p,
      ra: ((midRaDeg / 15) % 24 + 24) % 24,
      dec: midDecDeg,
      fsz: Math.max(12, Math.min(95, distDeg * 1.65)),
    }));
  };

  const sessionEntry =
    effectiveDetailListId === '__tonight__'
      ? sessionPlan.find((e) => e.id === selected.data.id)
      : detailTargetList?.entries.find((e) => e.id === selected.data.id);

  // Collect ALL names & cross-catalog designations (Messier & Caldwell ALWAYS prioritized first)
  const objectNamesSummary = useMemo(() => {
    const names: string[] = [];
    const rawDesignations: string[] = [];
    const seenNames = new Set<string>();
    const seenDesigs = new Set<string>();

    const pushName = (raw?: string) => {
      const s = raw?.trim();
      if (!s) return;
      const key = s.toLowerCase().replace(/\s+/g, ' ');
      if (seenNames.has(key)) return;
      seenNames.add(key);
      names.push(s);
    };

    const pushDesig = (raw?: string) => {
      const formatted = formatCatalogCode(raw) || raw?.trim() || '';
      if (!formatted) return;
      const norm = normalizeCatalogToken(formatted);
      if (!norm || seenDesigs.has(norm)) return;
      seenDesigs.add(norm);
      rawDesignations.push(formatted);
    };

    let conAbbr = '';
    if (selected.kind === 'dso') {
      const dso = selected.data;
      conAbbr = dso.con || '';
      pushName(dso.koName);
      pushName(dso.name);

      const primaryCode = formatCatalogCode(dso.id) || dso.id;
      pushDesig(primaryCode);
      pushDesig(dso.altId);
      for (const sec of getSecondaryDesignations(primaryCode, dso.altId)) {
        pushDesig(sec);
      }

      // Cross-match Caldwell & all DSO catalogs (by token OR close coordinates) to pull every catalog number
      const collectBaseTokens = () =>
        new Set<string>(
          [dso.id, dso.altId, ...rawDesignations]
            .map((t) => normalizeCatalogToken(t))
            .filter(Boolean)
        );
      let baseTokens = collectBaseTokens();

      for (const c of catalogs.caldwell) {
        const cTokens = [
          normalizeCatalogToken(c.caldwellId),
          normalizeCatalogToken(c.id),
          normalizeCatalogToken(c.altId),
        ].filter(Boolean);
        const posMatch =
          Math.abs(c.dec - dso.dec) < 0.05 &&
          angularDistanceDeg(c.ra, c.dec, dso.ra, dso.dec) < 0.035;
        if (cTokens.some((t) => baseTokens.has(t)) || posMatch) {
          pushDesig(c.caldwellId);
          pushDesig(c.id);
          pushDesig(c.altId);
          for (const sec of getSecondaryDesignations(c.caldwellId, c.altId || c.id)) {
            pushDesig(sec);
          }
          pushName(c.koName);
          pushName(c.name);
        }
      }

      baseTokens = collectBaseTokens();
      for (const other of [
        ...catalogs.dsosBright,
        ...catalogs.darkNebulae,
        ...catalogs.dsosDeep,
      ]) {
        const oTokens = [
          normalizeCatalogToken(other.id),
          normalizeCatalogToken(other.altId),
        ].filter(Boolean);
        const tokenMatch = oTokens.some((t) => baseTokens.has(t));
        const posMatch =
          !tokenMatch &&
          Math.abs(other.dec - dso.dec) < 0.025 &&
          angularDistanceDeg(other.ra, other.dec, dso.ra, dso.dec) < 0.015;
        if (tokenMatch || posMatch) {
          pushDesig(other.id);
          pushDesig(other.altId);
          for (const sec of getSecondaryDesignations(other.id, other.altId)) {
            pushDesig(sec);
          }
          pushName(other.koName);
          pushName(other.name);
        }
      }

      // Second pass over EXTRA_KNOWN_ALIASES for any newly discovered Messier/Caldwell/NGC IDs
      for (const code of [...rawDesignations]) {
        for (const sec of getSecondaryDesignations(code)) {
          pushDesig(sec);
        }
      }
    } else if (selected.kind === 'star') {
      const st = selected.data;
      conAbbr = st.con || '';
      pushName(st.koName);
      pushName(st.name);
      pushDesig(st.bayer);

      let matchedHip = st.hip;
      if (st.hip) {
        pushDesig(`HIP ${st.hip}`);
        for (const extra of getStarExtraDesignations(st.hip)) {
          pushDesig(extra);
        }
      }
      if (st.gaiaId) pushDesig(`Gaia DR3 ${st.gaiaId}`);
      if (st.id && normalizeCatalogToken(st.id) !== normalizeCatalogToken(st.name)) {
        pushDesig(st.id);
      }

      // Cross-match bright star record (by HIP or close coordinates if picked from Gaia/deep layer)
      const matchBright = st.hip
        ? catalogs.brightStars.find((b) => b.hip === st.hip)
        : catalogs.brightStars.find(
            (b) =>
              Math.abs(b.dec - st.dec) < 0.015 &&
              angularDistanceDeg(b.ra, b.dec, st.ra, st.dec) < 0.008
          );
      if (matchBright) {
        if (!conAbbr && matchBright.con) conAbbr = matchBright.con;
        pushName(matchBright.koName);
        pushName(matchBright.name);
        pushDesig(matchBright.bayer);
        if (matchBright.hip) {
          matchedHip = matchBright.hip;
          pushDesig(`HIP ${matchBright.hip}`);
          for (const extra of getStarExtraDesignations(matchBright.hip)) {
            pushDesig(extra);
          }
        }
      }

      // Cross-match deep Hipparcos record when picked from Gaia layer without HIP
      if (!matchedHip) {
        const matchDeep = catalogs.deepStars.find(
          (d) =>
            Math.abs(d.dec - st.dec) < 0.012 &&
            angularDistanceDeg(d.ra, d.dec, st.ra, st.dec) < 0.006
        );
        if (matchDeep?.hip) {
          pushDesig(`HIP ${matchDeep.hip}`);
          for (const extra of getStarExtraDesignations(matchDeep.hip)) {
            pushDesig(extra);
          }
        }
      }

      // Cross-match loaded Gaia DR3 star at the same position
      if (!st.gaiaId && catalogs.gaiaStars.length > 0) {
        const matchGaia = catalogs.gaiaStars.find(
          (g) =>
            g.gaiaId &&
            Math.abs(g.dec - st.dec) < 0.01 &&
            angularDistanceDeg(g.ra, g.dec, st.ra, st.dec) < 0.005
        );
        if (matchGaia?.gaiaId) {
          pushDesig(`Gaia DR3 ${matchGaia.gaiaId}`);
        }
      }

      // Cross-match WDS double/multiple star record at the same position
      for (const dbl of catalogs.doubleStars) {
        if (
          Math.abs(dbl.dec - st.dec) < 0.03 &&
          angularDistanceDeg(dbl.ra, dbl.dec, st.ra, st.dec) < 0.015
        ) {
          if (!conAbbr && dbl.con) conAbbr = dbl.con;
          pushName(dbl.koName);
          pushName(dbl.name);
          pushDesig(dbl.bayer);
          pushDesig(dbl.disc);
          pushDesig(dbl.id);
          if (dbl.pairs) {
            for (const pair of dbl.pairs) {
              pushDesig(pair.disc);
            }
          }
        }
      }
    } else if (selected.kind === 'double') {
      const dbl = selected.data;
      conAbbr = dbl.con || '';
      pushName(dbl.koName);
      pushName(dbl.name);
      pushDesig(dbl.bayer);
      pushDesig(dbl.disc);
      pushDesig(dbl.id);
      if (dbl.pairs) {
        for (const pair of dbl.pairs) {
          pushDesig(pair.disc);
        }
      }

      // Cross-match bright star record at same position for HIP/HR/HD/SAO/Flamsteed/Bayer/proper names
      for (const st of catalogs.brightStars) {
        if (
          Math.abs(st.dec - dbl.dec) < 0.03 &&
          angularDistanceDeg(st.ra, st.dec, dbl.ra, dbl.dec) < 0.015
        ) {
          if (!conAbbr && st.con) conAbbr = st.con;
          pushName(st.koName);
          pushName(st.name);
          pushDesig(st.bayer);
          if (st.hip) {
            pushDesig(`HIP ${st.hip}`);
            for (const extra of getStarExtraDesignations(st.hip)) {
              pushDesig(extra);
            }
          }
          break;
        }
      }

      // Cross-match Gaia DR3 star if loaded
      if (catalogs.gaiaStars.length > 0) {
        const matchGaia = catalogs.gaiaStars.find(
          (g) =>
            g.gaiaId &&
            Math.abs(g.dec - dbl.dec) < 0.012 &&
            angularDistanceDeg(g.ra, g.dec, dbl.ra, dbl.dec) < 0.008
        );
        if (matchGaia?.gaiaId) {
          pushDesig(`Gaia DR3 ${matchGaia.gaiaId}`);
        }
      }
    } else {
      const pl = selected.data;
      pushName(pl.koName);
      pushName(pl.name);
      pushDesig(pl.id);
    }

    // Remove designations that duplicate a proper name verbatim, then sort with Messier & Caldwell ALWAYS first
    const designations = sortCatalogDesignations(
      rawDesignations.filter((d) => !seenNames.has(d.toLowerCase().replace(/\s+/g, ' ')))
    );

    let resolvedConAbbr = conAbbr;
    if (!resolvedConAbbr && catalogs.constellations.length > 0) {
      let nearestCon = '';
      let nearestDist = 15;
      const objRa = selected.data.ra;
      const objDec = selected.data.dec;
      for (const st of catalogs.brightStars) {
        if (!st.con) continue;
        const d = angularDistanceDeg(objRa, objDec, st.ra, st.dec);
        if (d < nearestDist) {
          nearestDist = d;
          nearestCon = st.con;
        }
      }
      for (const dso of catalogs.dsosBright) {
        if (!dso.con) continue;
        const d = angularDistanceDeg(objRa, objDec, dso.ra, dso.dec);
        if (d < nearestDist) {
          nearestDist = d;
          nearestCon = dso.con;
        }
      }
      if (!nearestCon) {
        let bestConDist = Infinity;
        for (const c of catalogs.constellations) {
          const d = angularDistanceDeg(objRa, objDec, c.ra, c.dec);
          if (d < bestConDist) {
            bestConDist = d;
            nearestCon = c.abbr;
          }
        }
      }
      resolvedConAbbr = nearestCon;
    }

    const constellation = resolvedConAbbr
      ? catalogs.constellations.find(
          (c) => c.abbr.toLowerCase() === resolvedConAbbr.toLowerCase()
        )
      : undefined;
    const iauConstellationName = constellation
      ? IAU_CONSTELLATION_NAMES[constellation.abbr.toLowerCase()] || constellation.name
      : '';
    const conLabel = constellation
      ? `${constellation.koName}(${iauConstellationName}, ${constellation.abbr})`
      : resolvedConAbbr;

    const topFallbackCode =
      designations[0] ||
      (selected.kind === 'dso'
        ? formatCatalogCode(selected.data.id) || selected.data.id
        : selected.kind === 'planet'
        ? selected.data.id
        : selected.kind === 'double'
        ? selected.data.bayer || selected.data.disc
        : selected.data.bayer || selected.data.id);

    const primaryTitle = formatObjectDisplayName(
      names[0] && /[가-힣]/.test(names[0]) ? names[0] : selected.data.koName,
      names.find((n) => !/[가-힣]/.test(n)) || selected.data.name,
      topFallbackCode
    );

    // Header designation summary: Messier / Caldwell always first, alongside secondary NGC/IC/HD/HIP numbers
    const headerDesignations = designations.slice(0, 3);

    const allLabels: string[] = [];
    const seenAll = new Set<string>();
    const pushAllLabel = (item: string) => {
      const k = item.toLowerCase().replace(/\s+/g, ' ');
      if (!seenAll.has(k)) {
        seenAll.add(k);
        allLabels.push(item);
      }
    };
    // Put sorted catalog designations FIRST (Messier -> Caldwell -> NGC -> IC -> Bayer (+ expanded forms) -> Flamsteed -> HR -> HD -> HIP...), then alternate names
    for (const item of designations) {
      pushAllLabel(item);
      for (const expanded of getBayerExpandedNames(item)) {
        pushAllLabel(expanded);
      }
    }
    for (const item of names) {
      pushAllLabel(item);
      for (const expanded of getBayerExpandedNames(item)) {
        pushAllLabel(expanded);
      }
    }

    return {
      primaryTitle,
      names,
      designations,
      headerDesignations,
      allLabels,
      conLabel,
    };
  }, [
    selected,
    catalogs.caldwell,
    catalogs.dsosBright,
    catalogs.dsosDeep,
    catalogs.darkNebulae,
    catalogs.brightStars,
    catalogs.deepStars,
    catalogs.gaiaStars,
    catalogs.doubleStars,
    catalogs.constellations,
  ]);

  // Compact SVG polyline for 24h altitude curve + solar day/twilight/night bar
  const svgW = 230;
  const curveH = 74;
  const barGap = 5;
  const barH = 9;
  const barY = curveH + barGap;
  const svgH = barY + barH;
  const offsetToX = (offsetHours: number) => ((offsetHours + 12) / 24) * svgW;
  const altToY = (alt: number) => curveH / 2 - (alt / 90) * (curveH / 2 - 5);
  const horizonY = altToY(0);
  const optimalY = altToY(30);
  const altCurve = altProfile.points;
  const curvePoints = altCurve
    .map((pt) => `${offsetToX(pt.offsetHours).toFixed(1)},${altToY(pt.altDeg).toFixed(1)}`)
    .join(' ');
  const nowPoint = altCurve.find((p) => Math.abs(p.offsetHours) < 1e-6);
  const nowX = offsetToX(0);
  const nowY = nowPoint ? altToY(nowPoint.altDeg) : horizonY;
  const maxAlt = altProfile.maxAlt;

  const strokeColor =
    theme === 'red' ? '#EF4444' : theme === 'white' ? '#2563EB' : '#06B6D4';
  const riseColor =
    theme === 'red' ? '#FCA5A5' : theme === 'white' ? '#059669' : '#34D399';
  const setColor =
    theme === 'red' ? '#F87171' : theme === 'white' ? '#D97706' : '#FBBF24';
  const dayBarFill =
    theme === 'red' ? '#B91C1C' : '#7DD3FC';
  const twilightBarFill =
    theme === 'red' ? '#5C1111' : theme === 'white' ? '#64748B' : '#475569';
  const nightBarFill = '#000000';
  const clampLabelX = (x: number) => Math.max(18, Math.min(svgW - 18, x));

  const targetMeta = getSelectedObjectMeta(selected);
  const objectLogs = observationLogStore.logs.filter(
    (l) => l.objectId === targetMeta.objectId
  );
  const explicitStatus = observationLogStore.observedMap[targetMeta.objectId];
  const isObserved = explicitStatus
    ? explicitStatus.observed
    : objectLogs.length > 0 || Boolean(sessionEntry?.observed);
  const activeEquipSummary = buildActiveEquipmentSummary(equipmentLocker, optics);

  const openNewDetailLog = () => {
    setDetailLogDraft({
      id: null,
      observedAtLocal: toDateTimeLocalValue(obsTimeMs),
      location: observer.name.trim(),
      equipment: activeEquipSummary,
      seeing: '',
      rating: 0,
      notes: '',
    });
  };

  const openEditDetailLog = (log: ObservationLogEntry) => {
    setDetailLogDraft({
      id: log.id,
      observedAtLocal: toDateTimeLocalValue(log.observedAt),
      location: log.location,
      equipment: log.equipment,
      seeing: log.seeing ?? '',
      rating: log.rating ?? 0,
      notes: log.notes,
    });
  };

  const handleSaveDetailLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailLogDraft) return;
    const now = Date.now();
    const existing = detailLogDraft.id
      ? observationLogStore.logs.find((l) => l.id === detailLogDraft.id)
      : undefined;
    const entry: ObservationLogEntry = {
      id: existing?.id ?? `obslog_${now}_${Math.random().toString(36).slice(2, 7)}`,
      objectId: targetMeta.objectId,
      objectKind: targetMeta.objectKind,
      objectName: targetMeta.objectName,
      constellation: targetMeta.constellation,
      raDeg: targetMeta.raDeg,
      decDeg: targetMeta.decDeg,
      observedAt: fromDateTimeLocalValue(detailLogDraft.observedAtLocal, obsTimeMs),
      location: detailLogDraft.location.trim(),
      equipment: detailLogDraft.equipment.trim(),
      seeing: detailLogDraft.seeing,
      transparency: existing?.transparency ?? '',
      rating: detailLogDraft.rating > 0 ? detailLogDraft.rating : undefined,
      notes: detailLogDraft.notes.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    onSaveObservationLog(entry);
    setDetailLogDraft(null);
  };

  return (
    <section
      aria-label="천체 정보"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className={`no-print absolute z-20 top-14 w-[286px] max-h-[calc(100%-68px)] border shadow-2xl backdrop-blur-md flex flex-col overflow-hidden transition-[left,right] duration-200 ${ui.panel}`}
      style={{
        ...(dockSide === 'left'
          ? { left: `${leftDrawerOpen ? 282 : 12}px` }
          : { right: `${(rightDrawerOpen ? 292 : 0) + (asterismMode ? 84 : 12)}px` }),
        borderRadius: '8px',
      }}
    >
      {/* Window Header */}
      <div className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 border-b shrink-0 ${ui.divider}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Target className={`w-3.5 h-3.5 shrink-0 ${ui.accentText}`} />
          <span className={`text-[11px] font-semibold tracking-[-0.04em] truncate ${ui.textPrimary}`}>
            천체 정보
          </span>
          <div className="flex items-center gap-0.5 ml-1 shrink-0" role="group" aria-label="천체 정보 표시 위치">
            <button
              type="button"
              onClick={() => onChangeDockSide('left')}
              title="천체 정보를 왼쪽에 표시"
              aria-label="왼쪽에 표시"
              aria-pressed={dockSide === 'left'}
              className={`p-0.5 border transition-colors ${
                dockSide === 'left' ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onChangeDockSide('right')}
              title="천체 정보를 오른쪽에 표시"
              aria-label="오른쪽에 표시"
              aria-pressed={dockSide === 'right'}
              className={`p-0.5 border transition-colors ${
                dockSide === 'right' ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '4px' }}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="천체 정보 닫기"
          aria-label="천체 정보 닫기"
          className={`p-1 border transition-colors shrink-0 ${ui.buttonIdle}`}
          style={{ borderRadius: '4px' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable Detail Body */}
      <div className="flex-1 min-h-0 overflow-y-auto astro-scroll p-2.5 text-[11px] space-y-3">
        {/* Title, Classification & All Alternate Names / Catalog Designations */}
        <div className="space-y-1">
          {objectNamesSummary.conLabel && (
            <div className={`text-[10px] tracking-[-0.03em] leading-snug break-words ${ui.textMuted}`}>
              {objectNamesSummary.conLabel}
            </div>
          )}
          <h2
            className={`text-[15px] font-semibold leading-tight tracking-[-0.04em] break-keep ${ui.textPrimary}`}
          >
            {objectNamesSummary.primaryTitle}
          </h2>
          <div className={`text-[10.5px] tracking-[-0.04em] truncate ${ui.textSecondary}`}>
            {selected.kind === 'dso'
              ? getDsoTypeLabel(selected.data.type)
              : selected.kind === 'planet'
              ? selected.data.category
              : selected.kind === 'double'
              ? selected.data.isMultiple
                ? `다중성 (Multiple Star · ${selected.data.compCount}구성성)`
                : '이중성 (Double Star · 2구성성)'
              : '항성 (Fixed Star)'}
          </div>
          {objectNamesSummary.allLabels.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1">
              {objectNamesSummary.allLabels.map((lbl) => {
                const prio = getCatalogDesignationPriority(lbl);
                const isMessierOrCaldwell = prio === 0 || prio === 1;
                return (
                  <span
                    key={lbl}
                    className={`px-1.5 py-0.5 border font-mono text-[9.5px] leading-tight tracking-[-0.03em] break-words ${
                      isMessierOrCaldwell
                        ? `${ui.buttonActive} font-semibold`
                        : `${ui.border} ${ui.panelMuted} ${ui.textSecondary}`
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    {lbl}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Row: 시야중심 | 선택마크 | 목록추가 */}
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={onToggleCenterLock}
            title={
              centerLocked
                ? '시야 중심 추적 중 (클릭 또는 하늘 배경 클릭 시 해제)'
                : '시야 중심 고정 (시간 가속 시 자동 추적)'
            }
            className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 ${
              centerLocked ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '5px' }}
          >
            <Crosshair className="w-3 h-3 shrink-0" />
            <span>시야 중심</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeOptics((p) => ({ ...p, showSelectionMark: !p.showSelectionMark }))
            }
            title={optics.showSelectionMark ? '선택 마크 숨기기' : '선택 마크 표시'}
            className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 ${
              optics.showSelectionMark ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '5px' }}
          >
            <Target className="w-3 h-3 shrink-0" />
            <span>선택 마크</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleSessionItem(selected, effectiveDetailListId)}
            title={
              sessionEntry
                ? `‘${
                    effectiveDetailListId === '__tonight__'
                      ? '오늘 밤 관측목록'
                      : detailTargetList?.name ?? '관측 목록'
                  }’에서 제거`
                : `‘${
                    effectiveDetailListId === '__tonight__'
                      ? '오늘 밤 관측목록'
                      : detailTargetList?.name ?? '관측 목록'
                  }’에 추가`
            }
            className={`py-1.5 px-1 border text-[10px] tracking-[-0.06em] font-medium flex flex-col items-center justify-center gap-0.5 whitespace-nowrap shrink-0 ${
              sessionEntry ? ui.buttonActive : ui.buttonIdle
            }`}
            style={{ borderRadius: '5px' }}
          >
            {sessionEntry ? (
              <>
                <BookmarkCheck className="w-3 h-3 shrink-0" />
                <span>저장됨</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3 h-3 shrink-0" />
                <span>목록 추가</span>
              </>
            )}
          </button>
        </div>

        {/* Target Observing List Category Selector (Tonight vs Managed Lists) */}
        {observingLists.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] tracking-[-0.05em] whitespace-nowrap shrink-0 ${ui.textMuted}`}
            >
              대상 목록
            </span>
            <select
              value={effectiveDetailListId}
              onChange={(e) => setDetailTargetListId(e.target.value)}
              aria-label="대상을 담을 관측 목록 선택"
              className={`flex-1 min-w-0 px-1.5 py-1 border text-[10px] truncate ${ui.input}`}
              style={{ borderRadius: '4px' }}
            >
              <option value="__tonight__">
                ★ 오늘 밤 관측목록 ({sessionPlan.length})
                {sessionPlan.some((e) => e.id === selected.data.id) ? ' ✓' : ''}
              </option>
              {observingLists.map((list) => {
                const hasItem = list.entries.some((e) => e.id === selected.data.id);
                const isTonight = list.id === tonightListId;
                return (
                  <option key={list.id} value={list.id}>
                    {isTonight ? '[오늘관측] ' : ''}
                    {list.name} ({list.entries.length})
                    {hasItem ? ' ✓' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Solar System 10-Day Forward Trajectory Button */}
        {selected.kind === 'planet' && (() => {
          const trailStartMs = solarTrails[selected.data.id];
          const isTrailActive = trailStartMs !== undefined;
          const activeTrailCount = Object.keys(solarTrails).length;
          const rangeText = (() => {
            const baseMs = isTrailActive ? trailStartMs : Date.now();
            const d0 = new Date(baseMs);
            const d10 = new Date(baseMs + 10 * 86400000);
            return `${d0.getMonth() + 1}/${d0.getDate()}~${d10.getMonth() + 1}/${d10.getDate()}`;
          })();
          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleSolarTrail(selected.data.id)}
                title={
                  isTrailActive
                    ? `오늘 기준 10일간 궤적(${rangeText}) 숨기기`
                    : `오늘 날짜 기준으로 앞으로 10일간(${rangeText})의 궤적과 매일 날짜 라벨 표시`
                }
                className={`flex-1 py-1.5 px-2 border text-[10.5px] tracking-[-0.05em] font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                  isTrailActive ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '5px' }}
              >
                <Route className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isTrailActive ? `궤적 표시 중 (${rangeText})` : `궤적 그리기 (10일 · ${rangeText})`}
                </span>
              </button>
              {activeTrailCount > 0 && (
                <button
                  type="button"
                  onClick={onClearSolarTrails}
                  title="표시된 모든 궤적 지우기"
                  className={`py-1.5 px-2 border text-[10px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 transition-colors ${ui.buttonIdle}`}
                  style={{ borderRadius: '5px' }}
                >
                  지우기
                </button>
              )}
            </div>
          );
        })()}

        {/* Precision Telemetry Grid */}
        <div
          className={`border divide-y text-[10.5px] ${ui.border} ${ui.divider}`}
          style={{ borderRadius: '6px' }}
        >
          <div className="flex items-center justify-between gap-1 px-2 py-1.5">
            <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
              적경 RA
            </span>
            <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
              {formatRA(selected.data.ra)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 px-2 py-1.5">
            <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
              적위 Dec
            </span>
            <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
              {formatDec(selected.data.dec)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 px-2 py-1.5">
            <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
              고도 / 방위
            </span>
            <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
              {selectedAltAz.altDeg.toFixed(1)}° / {selectedAltAz.azDeg.toFixed(0)}°(
              {getCompassDirection(selectedAltAz.azDeg)})
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 px-2 py-1.5">
            <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
              겉보기 등급
            </span>
            <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right">
              {selected.data.mag.toFixed(2)}m
            </span>
          </div>
          {selected.kind === 'dso' ? (
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
              <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                시직경 / PA
              </span>
              <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                {selected.data.majAx.toFixed(1)}′×{selected.data.minAx.toFixed(1)}′ · {selected.data.pa}°
              </span>
            </div>
          ) : selected.kind === 'planet' ? (
            <>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                  지구 거리
                </span>
                <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                  {selected.data.id === 'Moon'
                    ? `${Math.round(selected.data.distAu * 149597870.7).toLocaleString()} km`
                    : `${selected.data.distAu.toFixed(3)} AU`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                  위상 / 이각
                </span>
                <span className="flex items-center justify-end gap-1 font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                  {selected.data.group === 'comet' && selected.data.elongationDeg < 20 && (
                    <span
                      className={`px-1 py-0.5 rounded font-sans text-[9px] font-medium leading-none shrink-0 ${
                        theme === 'white'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : theme === 'red'
                          ? 'bg-red-950/90 text-red-300 border border-red-800/80'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      태양근접
                    </span>
                  )}
                  <span>
                    {selected.data.phasePct}% · {selected.data.elongationDeg.toFixed(1)}°
                  </span>
                </span>
              </div>
              {selected.data.group === 'comet' && (
                <>
                  {selected.data.helioDistAu !== undefined && (
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                        태양 거리 (r)
                      </span>
                      <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                        {selected.data.helioDistAu.toFixed(3)} AU
                      </span>
                    </div>
                  )}
                  {selected.data.perihelionIso && (
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                        근일점 통과
                      </span>
                      <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                        {selected.data.perihelionIso}
                      </span>
                    </div>
                  )}
                  {selected.data.eccentricity !== undefined && (
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                        이심률 / 꼬리 PA
                      </span>
                      <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                        e={selected.data.eccentricity.toFixed(4)}
                        {selected.data.tailPaDeg !== undefined
                          ? ` · PA ${selected.data.tailPaDeg.toFixed(0)}°`
                          : ''}
                      </span>
                    </div>
                  )}
                </>
              )}
              {selectedPlanetPhys && (
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                    {selectedPlanetPhys.hasRings ? '고리 / 자전축' : '자전축 PA / B'}
                  </span>
                  <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                    {selectedPlanetPhys.hasRings
                      ? `${selectedPlanetPhys.ringTiltDeg >= 0 ? '+' : ''}${selectedPlanetPhys.ringTiltDeg.toFixed(1)}° · PA ${selectedPlanetPhys.northPolePaDeg.toFixed(0)}°`
                      : `PA ${selectedPlanetPhys.northPolePaDeg.toFixed(0)}° · ${selectedPlanetPhys.subEarthLatDeg >= 0 ? '+' : ''}${selectedPlanetPhys.subEarthLatDeg.toFixed(1)}°`}
                  </span>
                </div>
              )}
            </>
          ) : selected.kind === 'double' ? (
            <>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                  주성 / 동반성
                </span>
                <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                  {selected.data.mag1.toFixed(2)}m / {selected.data.mag2.toFixed(2)}m (Δ
                  {Math.abs(selected.data.mag2 - selected.data.mag1).toFixed(1)})
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                  이격각(ρ) / PA(θ)
                </span>
                <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right truncate">
                  {selected.data.sep.toFixed(1)}″ · {selected.data.pa}° ({selected.data.lastYear})
                </span>
              </div>
              {selected.data.spec && (
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                    분광형
                  </span>
                  <span className="font-mono text-[10px] tracking-[-0.04em] text-right truncate">
                    {selected.data.spec}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
              <span className={`whitespace-nowrap tracking-[-0.06em] shrink-0 ${ui.textMuted}`}>
                색지수 B-V
              </span>
              <span className="font-mono text-[10px] tracking-[-0.04em] tabular-nums text-right">
                {selected.data.bv.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Multiple Star Component Pairs Breakdown */}
        {selected.kind === 'double' && selected.data.pairs && selected.data.pairs.length > 1 && (
          <div className={`border p-2 space-y-1.5 ${ui.border}`} style={{ borderRadius: '6px' }}>
            <div className="flex items-center justify-between gap-1">
              <span className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
                구성성 페어 목록 (WDS)
              </span>
              <span className={`font-mono text-[9.5px] tabular-nums ${ui.textMuted}`}>
                {selected.data.pairs.length}쌍
              </span>
            </div>
            <div className={`divide-y ${ui.divider} font-mono text-[10px] tabular-nums`}>
              {selected.data.pairs.map((pair, idx) => (
                <div
                  key={`${pair.comp}-${idx}`}
                  className="py-1 flex items-center justify-between gap-1"
                >
                  <span className={`font-semibold shrink-0 ${ui.accentText}`}>{pair.comp}</span>
                  <span className={`truncate ${ui.textSecondary}`}>
                    {pair.mag1.toFixed(1)}/{pair.mag2.toFixed(1)}m
                  </span>
                  <span className={`shrink-0 ${ui.textMuted}`}>
                    {pair.sep.toFixed(1)}″ · {pair.pa}°
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 24-Hour Altitude Curve */}
        <div className={`border p-2 space-y-1.5 ${ui.border}`} style={{ borderRadius: '6px' }}>
          <div className="flex items-center justify-between gap-1">
            <span className={`font-semibold whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}>
              24시간 고도
            </span>
            <span className={`font-mono text-[9.5px] tracking-[-0.04em] tabular-nums whitespace-nowrap ${ui.textMuted}`}>
              최고 {maxAlt.altDeg.toFixed(0)}° ({maxAlt.label})
            </span>
          </div>
          <div
            className={`flex items-center justify-between gap-2 font-mono text-[9.5px] tracking-[-0.04em] tabular-nums ${ui.textSecondary}`}
          >
            {altProfile.isCircumpolar ? (
              <span className={ui.textMuted}>항상 지평선 위 (주극성)</span>
            ) : altProfile.isNeverRises ? (
              <span className={ui.textMuted}>항상 지평선 아래</span>
            ) : (
              <>
                <span className="whitespace-nowrap">
                  <span style={{ color: riseColor }}>↑ 뜸</span>{' '}
                  <span className="font-semibold">{altProfile.primaryRise?.label ?? '--:--'}</span>
                </span>
                <span className="whitespace-nowrap">
                  <span style={{ color: setColor }}>↓ 짐</span>{' '}
                  <span className="font-semibold">{altProfile.primarySet?.label ?? '--:--'}</span>
                </span>
              </>
            )}
          </div>
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full overflow-visible"
            style={{ height: `${svgH}px` }}
          >
            <defs>
              <clipPath id="nox-sky-phase-bar-clip">
                <rect x={0} y={barY} width={svgW} height={barH} rx={2.5} ry={2.5} />
              </clipPath>
            </defs>
            <line
              x1={0}
              y1={optimalY}
              x2={svgW}
              y2={optimalY}
              stroke="currentColor"
              strokeOpacity={0.18}
              strokeDasharray="3 3"
            />
            <line
              x1={0}
              y1={horizonY}
              x2={svgW}
              y2={horizonY}
              stroke="currentColor"
              strokeOpacity={0.4}
            />
            <line
              x1={nowX}
              y1={2}
              x2={nowX}
              y2={barY + barH}
              stroke={strokeColor}
              strokeOpacity={0.28}
              strokeWidth={0.9}
              strokeDasharray="2 2"
            />
            <polyline fill="none" stroke={strokeColor} strokeWidth={1.6} points={curvePoints} />
            {altProfile.rises.map((crossing, idx) => {
              const cx = offsetToX(crossing.offsetHours);
              const isPrimary = altProfile.primaryRise === crossing;
              return (
                <g key={`rise-${idx}`}>
                  <circle cx={cx} cy={horizonY} r={2.3} fill={riseColor} />
                  {isPrimary && (
                    <text
                      x={clampLabelX(cx)}
                      y={horizonY - 16}
                      textAnchor="middle"
                      fontSize={8.2}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill={riseColor}
                    >
                      ↑{crossing.label}
                    </text>
                  )}
                </g>
              );
            })}
            {altProfile.sets.map((crossing, idx) => {
              const cx = offsetToX(crossing.offsetHours);
              const isPrimary = altProfile.primarySet === crossing;
              return (
                <g key={`set-${idx}`}>
                  <circle cx={cx} cy={horizonY} r={2.3} fill={setColor} />
                  {isPrimary && (
                    <text
                      x={clampLabelX(cx)}
                      y={horizonY + 22}
                      textAnchor="middle"
                      fontSize={8.2}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill={setColor}
                    >
                      ↓{crossing.label}
                    </text>
                  )}
                </g>
              );
            })}
            <circle cx={nowX} cy={nowY} r={3} fill={strokeColor} />

            {/* Day (transparent) / Twilight (mid-tone) / Night (black) bar */}
            <g clipPath="url(#nox-sky-phase-bar-clip)">
              {altProfile.skySegments.map((seg, idx) => {
                const x1 = offsetToX(seg.startOffsetHours);
                const x2 = offsetToX(seg.endOffsetHours);
                const w = Math.max(0.5, x2 - x1);
                const fill =
                  seg.phase === 'day'
                    ? dayBarFill
                    : seg.phase === 'twilight'
                    ? twilightBarFill
                    : nightBarFill;
                const phaseTitle =
                  seg.phase === 'day'
                    ? `낮 (${seg.startLabel}~${seg.endLabel})`
                    : seg.phase === 'twilight'
                    ? `박명 (${seg.startLabel}~${seg.endLabel})`
                    : `밤 (${seg.startLabel}~${seg.endLabel})`;
                return (
                  <rect
                    key={`sky-seg-${idx}`}
                    x={x1}
                    y={barY}
                    width={w}
                    height={barH}
                    fill={fill}
                  >
                    <title>{phaseTitle}</title>
                  </rect>
                );
              })}
            </g>
            <rect
              x={0.4}
              y={barY + 0.4}
              width={svgW - 0.8}
              height={barH - 0.8}
              rx={2.5}
              ry={2.5}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={0.8}
            />
            <line
              x1={nowX}
              y1={barY}
              x2={nowX}
              y2={barY + barH}
              stroke={strokeColor}
              strokeWidth={1.2}
            />
          </svg>
          <div
            className={`flex justify-between text-[9.5px] font-mono tracking-[-0.05em] tabular-nums ${ui.textMuted}`}
          >
            <span>-12h</span>
            <span>0° 지평 · +30°</span>
            <span>+12h</span>
          </div>
          <div
            className={`flex items-center justify-end gap-2.5 text-[8.5px] tracking-[-0.03em] ${ui.textMuted}`}
          >
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2 border border-current/30"
                style={{ backgroundColor: dayBarFill, borderRadius: '1.5px' }}
              />
              낮
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2 border border-current/30"
                style={{ backgroundColor: twilightBarFill, borderRadius: '1.5px' }}
              />
              박명
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2 border border-current/35"
                style={{ backgroundColor: nightBarFill, borderRadius: '1.5px' }}
              />
              밤
            </span>
          </div>
        </div>

        {/* Star-Hopping Guide(s) */}
        {hopGuides.length > 0 && (
          <div className={`border p-2 space-y-2 ${ui.border}`} style={{ borderRadius: '6px' }}>
            <div className="flex items-center justify-between gap-1">
              <span
                className={`font-semibold flex items-center gap-1 whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
              >
                <Navigation className="w-3 h-3 shrink-0" />
                <span>별 호핑{hopGuides.length > 1 ? ` (${hopGuides.length})` : ''}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeOptics((p) => ({ ...p, showStarHop: !p.showStarHop }))
                }
                className={`px-1.5 py-0.5 border text-[10px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${
                  optics.showStarHop ? ui.buttonActive : ui.buttonIdle
                }`}
                style={{ borderRadius: '4px' }}
              >
                {optics.showStarHop ? '표시 중' : '경로 표시'}
              </button>
            </div>

            <div className={`divide-y ${ui.divider}`}>
              {hopGuides.map((guide, idx) => (
                <div
                  key={guide.fromStar.id}
                  className={idx > 0 ? 'pt-2 mt-2 space-y-1' : 'space-y-1'}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div
                      className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums truncate ${ui.textSecondary}`}
                    >
                      {hopGuides.length > 1 ? `${idx + 1}. ` : ''}
                      <span className="font-semibold">
                        {guide.fromStar.koName || guide.fromStar.name || guide.fromStar.bayer}
                      </span>{' '}
                      ({guide.fromStar.mag.toFixed(1)}m)
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        focusHopRoute(
                          guide.fromStar.ra,
                          guide.fromStar.dec,
                          guide.toRa,
                          guide.toDec,
                          guide.distanceDeg
                        )
                      }
                      className={`px-1.5 py-0.5 border text-[9.5px] tracking-[-0.05em] font-medium whitespace-nowrap shrink-0 ${ui.buttonIdle}`}
                      style={{ borderRadius: '4px' }}
                    >
                      보기
                    </button>
                  </div>
                  <div className={`font-mono text-[10px] tracking-[-0.04em] tabular-nums ${ui.textMuted}`}>
                    이격 {guide.distanceDeg.toFixed(2)}° · PA {guide.paDeg.toFixed(0)}°
                  </div>
                  {guide.note && (
                    <div className={`text-[10px] tracking-[-0.03em] leading-snug break-keep ${ui.textMuted}`}>
                      {guide.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hopGuides.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  onChangeOptics((p) => ({ ...p, showStarHop: true }));
                  onChangeView((p) => ({
                    ...p,
                    ra: ((selected.data.ra / 15) % 24 + 24) % 24,
                    dec: selected.data.dec,
                    fsz: 74,
                  }));
                }}
                className={`w-full py-1 px-1.5 border text-[10px] tracking-[-0.05em] font-medium transition-colors ${ui.buttonIdle}`}
                style={{ borderRadius: '4px' }}
              >
                두 경로 한눈에 보기
              </button>
            )}
          </div>
        )}

        {/* Observed Status & Observation Logs for Selected Object */}
        <div className={`border p-2 space-y-2 ${ui.border}`} style={{ borderRadius: '6px' }}>
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`font-semibold flex items-center gap-1 whitespace-nowrap tracking-[-0.05em] ${ui.textPrimary}`}
            >
              <BookOpen className="w-3 h-3 shrink-0" />
              <span>관측 여부 · 기록</span>
              {objectLogs.length > 0 && (
                <span className={`font-mono text-[9.5px] ${ui.textMuted}`}>
                  ({objectLogs.length})
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => (detailLogDraft ? setDetailLogDraft(null) : openNewDetailLog())}
              className={`px-1.5 py-0.5 border text-[9.5px] font-medium flex items-center gap-0.5 whitespace-nowrap shrink-0 transition-colors ${
                detailLogDraft ? ui.buttonIdle : ui.buttonActive
              }`}
              style={{ borderRadius: '4px' }}
            >
              {detailLogDraft ? (
                <>
                  <X className="w-2.5 h-2.5" />
                  <span>닫기</span>
                </>
              ) : (
                <>
                  <Plus className="w-2.5 h-2.5" />
                  <span>기록 작성</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onToggleObjectObserved(targetMeta, !isObserved)}
            className={`w-full py-1.5 px-2 border text-[10.5px] font-semibold flex items-center justify-between gap-1.5 transition-colors ${
              isObserved
                ? theme === 'white'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                  : theme === 'red'
                  ? 'bg-[#2A0505] border-[#DC2626] text-[#FF6B6B]'
                  : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                : ui.buttonIdle
            }`}
            style={{ borderRadius: '5px' }}
          >
            <span className="flex items-center gap-1.5">
              {isObserved ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 shrink-0 opacity-60" />
              )}
              <span>{isObserved ? '관측 완료' : '미관측 (클릭하여 완료 표시)'}</span>
            </span>
            {isObserved && explicitStatus?.updatedAt && (
              <span className="font-mono text-[9px] opacity-75">
                {formatObservationDateTime(explicitStatus.updatedAt).slice(0, 10)}
              </span>
            )}
          </button>

          {detailLogDraft && (
            <form
              onSubmit={handleSaveDetailLog}
              className={`border p-2 space-y-1.5 ${ui.panelMuted} ${ui.border}`}
              style={{ borderRadius: '5px' }}
            >
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <label className={`text-[9.5px] ${ui.textMuted}`}>관측 일시</label>
                  <button
                    type="button"
                    onClick={() =>
                      setDetailLogDraft({
                        ...detailLogDraft,
                        observedAtLocal: toDateTimeLocalValue(Date.now()),
                      })
                    }
                    className={`text-[9px] underline underline-offset-2 ${ui.accentText}`}
                  >
                    현재 시각
                  </button>
                </div>
                <input
                  type="datetime-local"
                  value={detailLogDraft.observedAtLocal}
                  onChange={(e) =>
                    setDetailLogDraft({
                      ...detailLogDraft,
                      observedAtLocal: e.target.value,
                    })
                  }
                  className={`w-full px-1.5 py-1 border text-[10px] font-mono ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <label className={`text-[9.5px] ${ui.textMuted}`}>관측 장소</label>
                  {savedSites.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setDetailLogDraft({
                            ...detailLogDraft,
                            location: e.target.value,
                          });
                        }
                      }}
                      aria-label="저장된 관측지 선택"
                      className={`max-w-[120px] px-1 py-0.5 border text-[9px] ${ui.input}`}
                      style={{ borderRadius: '4px' }}
                    >
                      <option value="">관측지 선택…</option>
                      {savedSites.map((site) => (
                        <option key={site.id} value={site.name}>
                          {site.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="text"
                  value={detailLogDraft.location}
                  onChange={(e) =>
                    setDetailLogDraft({ ...detailLogDraft, location: e.target.value })
                  }
                  placeholder="예: 강원 화천 조경철천문대"
                  className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <label className={`text-[9.5px] ${ui.textMuted}`}>사용 장비</label>
                  {activeEquipSummary && (
                    <button
                      type="button"
                      onClick={() =>
                        setDetailLogDraft({
                          ...detailLogDraft,
                          equipment: activeEquipSummary,
                        })
                      }
                      className={`text-[9px] underline underline-offset-2 ${ui.accentText}`}
                    >
                      활성 장비
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={detailLogDraft.equipment}
                  onChange={(e) =>
                    setDetailLogDraft({ ...detailLogDraft, equipment: e.target.value })
                  }
                  placeholder="예: 150mm 뉴턴 + 25mm 아이피스"
                  className={`w-full px-1.5 py-1 border text-[10px] ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                />
              </div>

              <div className="flex items-center justify-between gap-1.5">
                <select
                  value={detailLogDraft.seeing}
                  onChange={(e) =>
                    setDetailLogDraft({
                      ...detailLogDraft,
                      seeing: e.target.value as ObservationSeeingGrade,
                    })
                  }
                  aria-label="시상 등급"
                  className={`flex-1 px-1.5 py-1 border text-[9.5px] ${ui.input}`}
                  style={{ borderRadius: '4px' }}
                >
                  {SEEING_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      시상: {opt.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setDetailLogDraft({
                          ...detailLogDraft,
                          rating: detailLogDraft.rating === n ? 0 : n,
                        })
                      }
                      className="p-0.5"
                      title={`별점 ${n}점`}
                    >
                      <Star
                        className={`w-3 h-3 ${
                          n <= detailLogDraft.rating
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

              <textarea
                rows={3}
                value={detailLogDraft.notes}
                onChange={(e) =>
                  setDetailLogDraft({ ...detailLogDraft, notes: e.target.value })
                }
                placeholder="관측 소감, 보인 형태, 배율·필터 느낌 등..."
                className={`w-full p-1.5 border text-[10px] leading-snug resize-y ${ui.input}`}
                style={{ borderRadius: '4px' }}
              />

              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setDetailLogDraft(null)}
                  className={`px-2 py-1 border text-[9.5px] ${ui.buttonIdle}`}
                  style={{ borderRadius: '4px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`px-2 py-1 border text-[9.5px] font-semibold ${ui.buttonActive}`}
                  style={{ borderRadius: '4px' }}
                >
                  {detailLogDraft.id ? '수정 저장' : '기록 저장'}
                </button>
              </div>
            </form>
          )}

          {objectLogs.length > 0 ? (
            <div className={`divide-y ${ui.divider}`}>
              {objectLogs.map((log) => {
                const seeingTxt = getSeeingLabel(log.seeing);
                return (
                  <div key={log.id} className="py-1.5 first:pt-0.5 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[9.5px] tabular-nums ${ui.textSecondary}`}
                      >
                        <Calendar className={`w-2.5 h-2.5 shrink-0 ${ui.textMuted}`} />
                        <span>{formatObservationDateTime(log.observedAt)}</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {seeingTxt && (
                          <span className={`text-[9px] font-mono ${ui.accentText}`}>
                            {seeingTxt}
                          </span>
                        )}
                        {log.rating && log.rating > 0 ? (
                          <span
                            className={`text-[9px] ${
                              theme === 'red' ? 'text-red-400' : 'text-amber-400'
                            }`}
                          >
                            {'★'.repeat(log.rating)}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEditDetailLog(log)}
                          title="기록 수정"
                          className={`p-0.5 ${ui.textMuted} hover:opacity-100`}
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteObservationLog(log.id)}
                          title="기록 삭제"
                          className={`p-0.5 ${ui.textMuted} hover:text-rose-400`}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    {(log.location || log.equipment) && (
                      <div className={`space-y-0.5 text-[9.5px] ${ui.textMuted}`}>
                        {log.location && (
                          <div className="flex items-center gap-1 min-w-0">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{log.location}</span>
                          </div>
                        )}
                        {log.equipment && (
                          <div className="flex items-center gap-1 min-w-0">
                            <Wrench className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{log.equipment}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {log.notes && (
                      <p
                        className={`text-[10px] leading-snug whitespace-pre-wrap break-keep ${ui.textPrimary}`}
                      >
                        {log.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !detailLogDraft && (
              <p className={`text-[10px] leading-snug break-keep ${ui.textMuted}`}>
                아직 기록이 없습니다. ‘기록 작성’을 눌러 일시·장소·장비·관측 내용을 남겨보세요.
              </p>
            )
          )}

          <button
            type="button"
            onClick={onOpenObservationLogsTab}
            className={`w-full py-1 px-1.5 border text-[9.5px] tracking-[-0.04em] font-medium transition-colors ${ui.buttonIdle}`}
            style={{ borderRadius: '4px' }}
          >
            전체 관측기록 탭에서 관리 ({observationLogStore.logs.length}건) →
          </button>
        </div>
      </div>
    </section>
  );
}
