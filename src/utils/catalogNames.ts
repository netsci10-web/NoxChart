import { DeepSkyObject } from '../types/astronomy';

/**
 * Additional NGC/IC, Arp, UGC, PGC, Sharpless, Melotte, Collinder, PK, and ESO
 * cross-catalog aliases for Messier (M1-M110), Caldwell (C1-C109), and iconic DSOs.
 */
export const EXTRA_KNOWN_ALIASES: Record<string, string[]> = {
  M1: ['NGC 1952', 'Sh2-244', 'LBN 833'],
  M3: ['NGC 5272'],
  M4: ['NGC 6121'],
  M5: ['NGC 5904'],
  M6: ['NGC 6405', 'Cr 341', 'Mel 178'],
  M7: ['NGC 6475', 'Cr 354', 'Mel 183'],
  M8: ['NGC 6523', 'NGC 6530', 'Sh2-25', 'LBN 25'],
  M11: ['NGC 6705', 'Cr 391', 'Mel 213'],
  M13: ['NGC 6205'],
  M15: ['NGC 7078'],
  M16: ['NGC 6611', 'IC 4703', 'Sh2-49'],
  M17: ['NGC 6618', 'IC 4706', 'IC 4707', 'Sh2-45'],
  M20: ['NGC 6514', 'Sh2-30'],
  M22: ['NGC 6656'],
  M24: ['IC 4715', 'NGC 6603'],
  M25: ['IC 4725', 'Cr 382', 'Mel 204'],
  M27: ['NGC 6853', 'PK 60-3.1'],
  M31: ['NGC 224', 'UGC 454', 'PGC 2557'],
  M32: ['NGC 221', 'UGC 452', 'PGC 2555', 'Arp 168'],
  M33: ['NGC 598', 'UGC 1117', 'PGC 5818'],
  M35: ['NGC 2168', 'Cr 82', 'Mel 41'],
  M36: ['NGC 1960', 'Cr 71', 'Mel 37'],
  M37: ['NGC 2099', 'Cr 75', 'Mel 38'],
  M38: ['NGC 1912', 'Cr 67', 'Mel 36'],
  M40: ['Winnecke 4', 'WNC 4'],
  M42: ['NGC 1976', 'Sh2-281', 'LBN 974'],
  M43: ['NGC 1982', 'Sh2-281'],
  M44: ['NGC 2632', 'Cr 189', 'Mel 88'],
  M45: ['Mel 22', 'Cr 42', 'NGC 1432', 'NGC 1435'],
  M46: ['NGC 2437', 'Cr 159', 'Mel 75'],
  M47: ['NGC 2422', 'Cr 152', 'Mel 71'],
  M51: ['NGC 5194', 'NGC 5195', 'Arp 85', 'UGC 8493', 'PGC 47404'],
  M57: ['NGC 6720', 'PK 63+13.1'],
  M63: ['NGC 5055', 'UGC 8334', 'PGC 46153'],
  M64: ['NGC 4826', 'UGC 8062', 'PGC 44182'],
  M65: ['NGC 3623', 'Arp 317', 'UGC 6328', 'PGC 34612'],
  M66: ['NGC 3627', 'Arp 16', 'Arp 317', 'UGC 6346', 'PGC 34695'],
  M74: ['NGC 628', 'UGC 1149', 'PGC 5974'],
  M76: ['NGC 650', 'NGC 651', 'PK 130-10.1'],
  M77: ['NGC 1068', 'Arp 37', 'UGC 2188', 'PGC 10266'],
  M78: ['NGC 2068', 'LDN 1630'],
  M81: ['NGC 3031', 'UGC 5318', 'PGC 28630'],
  M82: ['NGC 3034', 'Arp 337', 'UGC 5322', 'PGC 28655'],
  M83: ['NGC 5236', 'PGC 48082'],
  M84: ['NGC 4374', 'UGC 7494', 'PGC 40455'],
  M86: ['NGC 4406', 'UGC 7532', 'PGC 40653'],
  M87: ['NGC 4486', 'Arp 152', 'UGC 7654', 'PGC 41361'],
  M92: ['NGC 6341'],
  M97: ['NGC 3587', 'PK 148+57.1'],
  M101: ['NGC 5457', 'Arp 26', 'UGC 8981', 'PGC 50063'],
  M102: ['NGC 5866', 'UGC 9723', 'PGC 53933'],
  M104: ['NGC 4594', 'PGC 42407'],
  M106: ['NGC 4258', 'UGC 7353', 'PGC 39600'],
  M108: ['NGC 3556', 'UGC 6225', 'PGC 34030'],
  M109: ['NGC 3992', 'UGC 6937', 'PGC 37617'],
  M110: ['NGC 205', 'UGC 426', 'PGC 2429'],
  C4: ['NGC 7023', 'LBN 487'],
  C5: ['IC 342', 'UGC 2847', 'PGC 13826'],
  C6: ['NGC 6543', 'PK 96+29.1'],
  C9: ['Sh2-155', 'LBN 529'],
  C11: ['NGC 7635', 'Sh2-162', 'LBN 549'],
  C13: ['NGC 457', 'Cr 12', 'Mel 7'],
  C14: ['NGC 869', 'NGC 884', 'Cr 24', 'Cr 25', 'Mel 13', 'Mel 14'],
  C19: ['IC 5146', 'Sh2-125', 'Cr 470'],
  C20: ['NGC 7000', 'Sh2-117', 'LBN 373'],
  C23: ['NGC 891', 'UGC 1831', 'PGC 9031'],
  C27: ['NGC 6888', 'Sh2-105', 'LBN 203'],
  C30: ['NGC 7331', 'UGC 12113', 'PGC 69327'],
  C31: ['IC 405', 'Sh2-229', 'LBN 795'],
  C33: ['NGC 6992', 'NGC 6995', 'IC 1340'],
  C34: ['NGC 6960', 'Sh2-103'],
  C38: ['NGC 4565', 'UGC 7772', 'PGC 42038'],
  C39: ['NGC 2392', 'PK 197+17.1'],
  C41: ['Mel 25', 'Cr 50'],
  C49: ['NGC 2237', 'NGC 2238', 'NGC 2239', 'NGC 2244', 'NGC 2246', 'Sh2-275'],
  C50: ['NGC 2244', 'NGC 2239', 'Cr 99'],
  C59: ['NGC 3242', 'PK 261+32.1'],
  C60: ['NGC 4038', 'NGC 4039', 'Arp 244'],
  C61: ['NGC 4039', 'NGC 4038', 'Arp 244'],
  C63: ['NGC 7293', 'PK 36-57.1'],
  C65: ['NGC 253', 'PGC 2789'],
  C77: ['NGC 5128', 'Arp 153', 'PGC 46957'],
  C80: ['NGC 5139', 'ESO 270-SC11'],
  C92: ['NGC 3372'],
  C103: ['NGC 2070', 'ESO 57-EN6'],
  C106: ['NGC 104', 'ESO 50-SC8'],
  'IC 434': ['B 33', 'Sh2-277', 'LBN 954'],
  'B 33': ['IC 434', 'LDN 1630'],
  'IC 1805': ['Sh2-190', 'Mel 15', 'Cr 26'],
  'IC 1848': ['Sh2-199', 'W5', 'Cr 33'],
  'IC 1396': ['Sh2-131', 'Tr 37'],
  'NGC 2024': ['Sh2-277', 'LBN 954'],
  'NGC 281': ['IC 1590', 'Sh2-184'],
  'NGC 7635': ['C11', 'Sh2-162'],
  'NGC 6888': ['C27', 'Sh2-105'],
  'NGC 7293': ['C63', 'PK 36-57.1'],
  'NGC 7000': ['C20', 'Sh2-117'],
  'NGC 2237': ['C49', 'NGC 2244', 'Sh2-275'],
  'NGC 2244': ['C50', 'C49', 'Cr 99'],
  'NGC 5457': ['M101', 'Arp 26', 'UGC 8981', 'PGC 50063'],
  'NGC 5194': ['M51', 'NGC 5195', 'Arp 85'],
  'NGC 1976': ['M42', 'Sh2-281'],
  'NGC 224': ['M31', 'UGC 454', 'PGC 2557'],
};

/**
 * Cross-catalog designations (Flamsteed, HR, HD, SAO, Gliese/GJ) for major bright stars, keyed by HIP number.
 */
export const STAR_EXTRA_DESIGNATIONS_BY_HIP: Record<number, string[]> = {
  32349: ['9 CMa', 'HR 2491', 'HD 48915', 'SAO 151881', 'GJ 244'], // Sirius
  30438: ['HR 2326', 'HD 45348', 'SAO 234480'], // Canopus
  71683: ['HR 5459', 'HD 128620', 'SAO 252838', 'GJ 559 A'], // Rigil Kentaurus
  69673: ['16 Boo', 'HR 5340', 'HD 124897', 'SAO 100944', 'GJ 541'], // Arcturus
  91262: ['3 Lyr', 'HR 7001', 'HD 172167', 'SAO 67174', 'GJ 721'], // Vega
  24608: ['13 Aur', 'HR 1708', 'HD 34029', 'SAO 40186', 'GJ 194'], // Capella
  24436: ['19 Ori', 'HR 1713', 'HD 34085', 'SAO 131907'], // Rigel
  37279: ['10 CMi', 'HR 2943', 'HD 61421', 'SAO 115756', 'GJ 280'], // Procyon
  7588: ['HR 472', 'HD 10144', 'SAO 232481'], // Achernar
  27989: ['58 Ori', 'HR 2061', 'HD 39801', 'SAO 113271'], // Betelgeuse
  68702: ['HR 5267', 'HD 122451', 'SAO 252582'], // Hadar
  97649: ['53 Aql', 'HR 7557', 'HD 187642', 'SAO 125122', 'GJ 768'], // Altair
  60718: ['HR 4730', 'HD 108248', 'SAO 251904'], // Acrux
  21421: ['87 Tau', 'HR 1457', 'HD 29139', 'SAO 94027', 'GJ 171.1'], // Aldebaran
  65474: ['67 Vir', 'HR 5056', 'HD 116658', 'SAO 157923'], // Spica
  80763: ['21 Sco', 'HR 6134', 'HD 148478', 'SAO 184415'], // Antares
  37826: ['78 Gem', 'HR 2990', 'HD 62509', 'SAO 79666', 'GJ 286'], // Pollux
  113368: ['24 PsA', 'HR 8728', 'HD 216956', 'SAO 191524', 'GJ 881'], // Fomalhaut
  102098: ['50 Cyg', 'HR 7924', 'HD 197345', 'SAO 49941'], // Deneb
  62434: ['HR 4853', 'HD 111123', 'SAO 240259'], // Mimosa
  49669: ['32 Leo', 'HR 3982', 'HD 87901', 'SAO 98967'], // Regulus
  33579: ['21 CMa', 'HR 2618', 'HD 52089', 'SAO 172676'], // Adhara
  36850: ['66 Gem', 'HR 2891', 'HD 60179', 'SAO 60198', 'GJ 278'], // Castor
  85927: ['35 Sco', 'HR 6527', 'HD 158926', 'SAO 208954'], // Shaula
  25336: ['24 Ori', 'HR 1790', 'HD 35468', 'SAO 112740'], // Bellatrix
  25428: ['112 Tau', 'HR 1791', 'HD 35497', 'SAO 77168'], // Elnath
  45238: ['HR 3685', 'HD 80007', 'SAO 250495'], // Miaplacidus
  26311: ['46 Ori', 'HR 1903', 'HD 37128', 'SAO 132346'], // Alnilam
  109268: ['HR 8425', 'HD 209952', 'SAO 231004'], // Alnair
  26727: ['50 Ori', 'HR 1948', 'HD 37742', 'SAO 132444'], // Alnitak
  25930: ['34 Ori', 'HR 1852', 'HD 36486', 'SAO 132220'], // Mintaka
  27366: ['53 Ori', 'HR 2004', 'HD 38771', 'SAO 132542'], // Saiph
  62956: ['77 UMa', 'HR 4905', 'HD 112185', 'SAO 28553'], // Alioth
  54061: ['50 UMa', 'HR 4301', 'HD 95689', 'SAO 15384'], // Dubhe
  53910: ['48 UMa', 'HR 4295', 'HD 95418', 'SAO 27876'], // Merak
  58001: ['64 UMa', 'HR 4554', 'HD 103287', 'SAO 28179'], // Phecda
  59774: ['69 UMa', 'HR 4660', 'HD 106591', 'SAO 28315'], // Megrez
  65378: ['79 UMa', 'HR 5054', 'HD 116656', 'SAO 28737'], // Mizar
  65477: ['80 UMa', 'HR 5062', 'HD 116842', 'SAO 28751'], // Alcor
  67301: ['85 UMa', 'HR 5191', 'HD 120315', 'SAO 44752'], // Alkaid
  15863: ['33 Per', 'HR 1017', 'HD 20902', 'SAO 38787'], // Mirfak
  34444: ['25 CMa', 'HR 2693', 'HD 54605', 'SAO 173047'], // Wezen
  90185: ['20 Sgr', 'HR 6879', 'HD 169022', 'SAO 210091'], // Kaus Australis
  86228: ['HR 6553', 'HD 159532', 'SAO 228201'], // Sargas
  92855: ['34 Sgr', 'HR 7121', 'HD 175191', 'SAO 187448'], // Nunki
  28360: ['34 Aur', 'HR 2088', 'HD 40183', 'SAO 40750'], // Menkalinan
  31681: ['24 Gem', 'HR 2421', 'HD 47105', 'SAO 95912'], // Alhena
  11767: ['1 UMi', 'HR 424', 'HD 8890', 'SAO 308'], // Polaris
  72607: ['7 UMi', 'HR 5563', 'HD 131873', 'SAO 8102'], // Kochab
  75097: ['13 UMi', 'HR 5735', 'HD 137422', 'SAO 8215'], // Pherkad
  30324: ['2 CMa', 'HR 2294', 'HD 44743', 'SAO 151428'], // Mirzam
  46390: ['30 Hya', 'HR 3748', 'HD 81797', 'SAO 136871'], // Alphard
  9884: ['13 Ari', 'HR 617', 'HD 12929', 'SAO 75151'], // Hamal
  8903: ['6 Ari', 'HR 553', 'HD 11636', 'SAO 75012'], // Sheratan
  50583: ['41 Leo', 'HR 4057', 'HD 89484', 'SAO 81298'], // Algieba
  57632: ['94 Leo', 'HR 4534', 'HD 102647', 'SAO 99809', 'GJ 448'], // Denebola
  3419: ['16 Cet', 'HR 188', 'HD 4128', 'SAO 147420'], // Diphda
  10826: ['68 Cet', 'HR 681', 'HD 14386', 'SAO 129825'], // Mira
  5447: ['43 And', 'HR 337', 'HD 6860', 'SAO 54471'], // Mirach
  677: ['21 And', 'HR 15', 'HD 358', 'SAO 73765'], // Alpheratz
  9640: ['57 And', 'HR 603', 'HD 12533', 'SAO 37734'], // Almach
  86032: ['55 Oph', 'HR 6556', 'HD 159561', 'SAO 102932'], // Rasalhague
  14576: ['26 Per', 'HR 936', 'HD 19356', 'SAO 38592'], // Algol
  95947: ['6 Cyg', 'HR 7417', 'HD 183912', 'SAO 87301'], // Albireo
  100453: ['37 Cyg', 'HR 7796', 'HD 194093', 'SAO 49528'], // Sadr
  102488: ['53 Cyg', 'HR 7949', 'HD 197989', 'SAO 70474'], // Gienah Cyg
  63125: ['12 CVn', 'HR 4915', 'HD 112413', 'SAO 63257'], // Cor Caroli
  107315: ['8 Peg', 'HR 8308', 'HD 206778', 'SAO 127029'], // Enif
  113963: ['54 Peg', 'HR 8781', 'HD 218045', 'SAO 108378'], // Markab
  113881: ['53 Peg', 'HR 8775', 'HD 217906', 'SAO 90981'], // Scheat
  1067: ['88 Peg', 'HR 39', 'HD 886', 'SAO 91781'], // Algenib
  3179: ['18 Cas', 'HR 168', 'HD 3712', 'SAO 21609'], // Schedar
  746: ['11 Cas', 'HR 21', 'HD 432', 'SAO 21133'], // Caph
  4427: ['27 Cas', 'HR 264', 'HD 5394', 'SAO 11482'], // Gamma Cas
  6686: ['37 Cas', 'HR 403', 'HD 8538', 'SAO 22268'], // Ruchbah
  87833: ['33 Dra', 'HR 6705', 'HD 164058', 'SAO 30653'], // Etamin
  68756: ['11 Dra', 'HR 5291', 'HD 123299', 'SAO 16266'], // Thuban
  17702: ['25 Tau', 'HR 1165', 'HD 23630', 'SAO 76199'], // Alcyone
  91919: ['4 Lyr', 'HR 7051', 'HD 173582', 'SAO 67310'], // Epsilon1 Lyr
  91926: ['5 Lyr', 'HR 7053', 'HD 173607', 'SAO 67315'], // Epsilon2 Lyr
  72622: ['9 Lib', 'HR 5531', 'HD 130841', 'SAO 158840'], // Zubenelgenubi
  74785: ['27 Lib', 'HR 5685', 'HD 135742', 'SAO 140430'], // Zubeneschamali
  77070: ['24 Ser', 'HR 5854', 'HD 140573', 'SAO 121157'], // Unukalhai
  105199: ['5 Cep', 'HR 8162', 'HD 203280', 'SAO 19302'], // Alderamin
};

/**
 * Formats catalog codes consistently for display:
 * - "NGC1952" / "NGC 0224"    -> "NGC 1952" / "NGC 224"
 * - "IC4715"  / "IC 0342"     -> "IC 4715"  / "IC 342"
 * - "M 031"   / "Messier 101" -> "M31"      / "M101"
 * - "C 014"   / "Caldwell 14" -> "C14"
 */
export function formatCatalogCode(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const ngcIc = /^(NGC|IC)\s*[-_]?\s*0*(\d+[A-Z]?)$/i.exec(trimmed);
  if (ngcIc) {
    return `${ngcIc[1].toUpperCase()} ${ngcIc[2].toUpperCase()}`;
  }

  const messier = /^(?:M|Messier)\s*[-_]?\s*0*(\d+)$/i.exec(trimmed);
  if (messier) {
    return `M${messier[1]}`;
  }

  const caldwell = /^(?:C|Cal|Caldwell)\s*[-_]?\s*0*(\d+)$/i.exec(trimmed);
  if (caldwell) {
    return `C${caldwell[1]}`;
  }

  const barnard = /^(?:B|Barnard)\s*[-_]?\s*0*(\d+[A-Z]?)$/i.exec(trimmed);
  if (barnard) {
    return `B ${barnard[1].toUpperCase()}`;
  }

  const starCat = /^(HIP|HD|HR|SAO|GJ|Arp|PGC|UGC|LDN|LBN|Mel|Cr|Tr|WNC)\s*[-_]?\s*0*(\d+[A-Z]?)$/i.exec(
    trimmed
  );
  if (starCat) {
    const prefixMap: Record<string, string> = {
      hip: 'HIP',
      hd: 'HD',
      hr: 'HR',
      sao: 'SAO',
      gj: 'GJ',
      arp: 'Arp',
      pgc: 'PGC',
      ugc: 'UGC',
      ldn: 'LDN',
      lbn: 'LBN',
      mel: 'Mel',
      cr: 'Cr',
      tr: 'Tr',
      wnc: 'WNC',
    };
    const p = prefixMap[starCat[1].toLowerCase()] || starCat[1];
    return `${p} ${starCat[2]}`;
  }

  const sh2 = /^Sh\s*2\s*[-_]?\s*0*(\d+)$/i.exec(trimmed);
  if (sh2) {
    return `Sh2-${sh2[1]}`;
  }

  return trimmed;
}

/**
 * Normalizes a catalog code or search token for forgiving matching:
 * strips spaces/hyphens/underscores and strips leading zeros on catalog numbers.
 * e.g. "NGC 0224" -> "ngc224", "M 031" -> "m31", "Caldwell 106" -> "c106", "IC-342" -> "ic342"
 */
export function normalizeCatalogToken(raw?: string): string {
  if (!raw) return '';
  const compact = raw.trim().toLowerCase().replace(/[\s\-_]+/g, '');
  if (!compact) return '';

  const caldwell = /^(?:caldwell|cal)0*(\d+)$/.exec(compact);
  if (caldwell) {
    return `c${caldwell[1]}`;
  }

  const messier = /^messier0*(\d+)$/.exec(compact);
  if (messier) {
    return `m${messier[1]}`;
  }

  const barnard = /^barnard0*(\d+[a-z]?)$/.exec(compact);
  if (barnard) {
    return `b${barnard[1]}`;
  }

  const cat =
    /^(ngc|ic|m|c|b|sh2|mel|melotte|cr|tr|hip|hd|hr|sao|gj|wds|wnc|arp|ugc|pgc|ldn|lbn|pk|eso)0*(\d+[a-z]?)$/.exec(
      compact
    );
  if (cat) {
    const prefix = cat[1] === 'melotte' ? 'mel' : cat[1];
    return `${prefix}${cat[2]}`;
  }
  return compact;
}

/**
 * Priority rank for catalog designations so Messier and Caldwell are ALWAYS prioritized first.
 */
export function getCatalogDesignationPriority(code: string): number {
  const s = code.trim();
  if (/^M\d+$/i.test(s)) return 0; // Messier always #1
  if (/^C\d+$/i.test(s)) return 1; // Caldwell always #2
  if (/^NGC\s*\d+/i.test(s)) return 2;
  if (/^IC\s*\d+/i.test(s)) return 3;
  if (/^(B|LDN|LBN|Sh2|Mel|Cr|Tr|Arp|UGC|PGC|PK|ESO|WNC)\b/i.test(s)) return 4;
  if (/^[α-ωΑ-Ω]/.test(s)) return 5; // Bayer
  if (/^\d+\s+[A-Z][a-z]{2}$/.test(s)) return 6; // Flamsteed
  if (/^HR\s*\d+/i.test(s)) return 7;
  if (/^HD\s*\d+/i.test(s)) return 8;
  if (/^HIP\s*\d+/i.test(s)) return 9;
  if (/^(SAO|GJ)\s*/i.test(s)) return 10;
  if (/^(WDS|STF|STT|AGC|SHJ|HJ|BU|ADS|RHD|SHB|GNT)\b/i.test(s)) return 11;
  if (/^Gaia\b/i.test(s)) return 12;
  return 13;
}

/**
 * Sorts catalog designations with Messier first, Caldwell second, then NGC, IC, etc.
 */
export function sortCatalogDesignations(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const pa = getCatalogDesignationPriority(a);
    const pb = getCatalogDesignationPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, 'en', { numeric: true });
  });
}

/**
 * Returns extra catalog designations (Flamsteed, HR, HD, SAO, GJ) for a star by HIP number.
 */
export function getStarExtraDesignations(hip?: number): string[] {
  if (!hip) return [];
  return STAR_EXTRA_DESIGNATIONS_BY_HIP[hip] ?? [];
}

/**
 * Returns canonical extra catalog aliases (formatted) for a given Messier, Caldwell, or NGC/IC ID.
 */
export function getExtraAliasesForKnownId(id?: string, altId?: string): string[] {
  const keys = [formatCatalogCode(id), formatCatalogCode(altId)].filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const extras = EXTRA_KNOWN_ALIASES[k];
    if (!extras) continue;
    for (const alias of extras) {
      const formatted = formatCatalogCode(alias);
      const norm = normalizeCatalogToken(formatted);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        out.push(formatted);
      }
    }
  }
  return out;
}

/**
 * Returns formatted secondary catalog designations for a DSO (altId + extra known NGC/IC aliases),
 * deduplicated against the primary ID and sorted with Messier & Caldwell first.
 */
export function getSecondaryDesignations(
  primaryId: string,
  altId?: string,
  extraKnownKey?: string
): string[] {
  const seen = new Set<string>();
  const primNorm = normalizeCatalogToken(primaryId);
  if (primNorm) seen.add(primNorm);

  const out: string[] = [];
  const pushUnique = (raw?: string) => {
    const formatted = formatCatalogCode(raw);
    const norm = normalizeCatalogToken(formatted);
    if (!formatted || !norm || seen.has(norm)) return;
    seen.add(norm);
    out.push(formatted);
  };

  pushUnique(altId);
  for (const alias of getExtraAliasesForKnownId(primaryId, extraKnownKey || altId)) {
    pushUnique(alias);
  }
  return sortCatalogDesignations(out);
}

/**
 * Formats a celestial object's display name as "한국어명 (English Name)" whenever
 * both exist and are distinct; falls back cleanly to whichever name or ID is available.
 */
export function formatObjectDisplayName(
  koName?: string,
  name?: string,
  fallback?: string
): string {
  const ko = koName?.trim() || '';
  const en = name?.trim() || '';

  if (ko && en) {
    const koLower = ko.toLowerCase();
    const enLower = en.toLowerCase();
    if (koLower === enLower || koLower.includes(enLower)) {
      return ko;
    }
    return `${ko} (${en})`;
  }
  if (ko) return ko;
  if (en) return en;
  return fallback?.trim() || '';
}

/**
 * Extracts all searchable catalog tokens for a DSO (including NGC/IC cross-designations).
 */
export function getDsoSearchAliases(dso: DeepSkyObject, extraPrimary?: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const push = (v?: string) => {
    if (!v) return;
    const f = formatCatalogCode(v);
    const norm = normalizeCatalogToken(f);
    if (f && norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(f);
    }
  };
  push(extraPrimary);
  push(dso.id);
  push(dso.altId);
  for (const alias of getExtraAliasesForKnownId(extraPrimary || dso.id, dso.altId || dso.id)) {
    push(alias);
  }
  return sortCatalogDesignations(result);
}

const GREEK_BAYER_LETTERS: Record<string, { en: string; ko: string }> = {
  α: { en: 'Alpha', ko: '알파' },
  Α: { en: 'Alpha', ko: '알파' },
  β: { en: 'Beta', ko: '베타' },
  Β: { en: 'Beta', ko: '베타' },
  γ: { en: 'Gamma', ko: '감마' },
  Γ: { en: 'Gamma', ko: '감마' },
  δ: { en: 'Delta', ko: '델타' },
  Δ: { en: 'Delta', ko: '델타' },
  ε: { en: 'Epsilon', ko: '엡실론' },
  Ε: { en: 'Epsilon', ko: '엡실론' },
  ζ: { en: 'Zeta', ko: '제타' },
  Ζ: { en: 'Zeta', ko: '제타' },
  η: { en: 'Eta', ko: '에타' },
  Η: { en: 'Eta', ko: '에타' },
  θ: { en: 'Theta', ko: '세타' },
  Θ: { en: 'Theta', ko: '세타' },
  ϑ: { en: 'Theta', ko: '세타' },
  ι: { en: 'Iota', ko: '이오타' },
  Ι: { en: 'Iota', ko: '이오타' },
  κ: { en: 'Kappa', ko: '카파' },
  Κ: { en: 'Kappa', ko: '카파' },
  λ: { en: 'Lambda', ko: '람다' },
  Λ: { en: 'Lambda', ko: '람다' },
  μ: { en: 'Mu', ko: '뮤' },
  Μ: { en: 'Mu', ko: '뮤' },
  ν: { en: 'Nu', ko: '뉴' },
  Ν: { en: 'Nu', ko: '뉴' },
  ξ: { en: 'Xi', ko: '크시' },
  Ξ: { en: 'Xi', ko: '크시' },
  ο: { en: 'Omicron', ko: '오미크론' },
  Ο: { en: 'Omicron', ko: '오미크론' },
  π: { en: 'Pi', ko: '파이' },
  Π: { en: 'Pi', ko: '파이' },
  ϖ: { en: 'Pi', ko: '파이' },
  ρ: { en: 'Rho', ko: '로' },
  Ρ: { en: 'Rho', ko: '로' },
  ϱ: { en: 'Rho', ko: '로' },
  σ: { en: 'Sigma', ko: '시그마' },
  Σ: { en: 'Sigma', ko: '시그마' },
  ς: { en: 'Sigma', ko: '시그마' },
  τ: { en: 'Tau', ko: '타우' },
  Τ: { en: 'Tau', ko: '타우' },
  υ: { en: 'Upsilon', ko: '입실론' },
  Υ: { en: 'Upsilon', ko: '입실론' },
  φ: { en: 'Phi', ko: '파이' },
  Φ: { en: 'Phi', ko: '파이' },
  ϕ: { en: 'Phi', ko: '파이' },
  χ: { en: 'Chi', ko: '카이' },
  Χ: { en: 'Chi', ko: '카이' },
  ψ: { en: 'Psi', ko: '프시' },
  Ψ: { en: 'Psi', ko: '프시' },
  ω: { en: 'Omega', ko: '오메가' },
  Ω: { en: 'Omega', ko: '오메가' },
};

const IAU_CONSTELLATION_GENITIVES: Record<
  string,
  { abbr: string; genitive: string; koGenitive: string }
> = {
  and: { abbr: 'And', genitive: 'Andromedae', koGenitive: '안드로메다이' },
  ant: { abbr: 'Ant', genitive: 'Antliae', koGenitive: '안틀리아이' },
  aps: { abbr: 'Aps', genitive: 'Apodis', koGenitive: '아포디스' },
  aqr: { abbr: 'Aqr', genitive: 'Aquarii', koGenitive: '아쿠아리이' },
  aql: { abbr: 'Aql', genitive: 'Aquilae', koGenitive: '아퀼라이' },
  ara: { abbr: 'Ara', genitive: 'Arae', koGenitive: '아라이' },
  ari: { abbr: 'Ari', genitive: 'Arietis', koGenitive: '아리에티스' },
  aur: { abbr: 'Aur', genitive: 'Aurigae', koGenitive: '아우리가이' },
  boo: { abbr: 'Boo', genitive: 'Bootis', koGenitive: '보오티스' },
  cae: { abbr: 'Cae', genitive: 'Caeli', koGenitive: '카엘리' },
  cam: { abbr: 'Cam', genitive: 'Camelopardalis', koGenitive: '카멜로파르달리스' },
  cnc: { abbr: 'Cnc', genitive: 'Cancri', koGenitive: '칸크리' },
  cvn: { abbr: 'CVn', genitive: 'Canum Venaticorum', koGenitive: '카눔 베나티코룸' },
  cma: { abbr: 'CMa', genitive: 'Canis Majoris', koGenitive: '카니스 마요리스' },
  cmi: { abbr: 'CMi', genitive: 'Canis Minoris', koGenitive: '카니스 미노리스' },
  cap: { abbr: 'Cap', genitive: 'Capricorni', koGenitive: '카프리코르니' },
  car: { abbr: 'Car', genitive: 'Carinae', koGenitive: '카리나이' },
  cas: { abbr: 'Cas', genitive: 'Cassiopeiae', koGenitive: '카시오페이아이' },
  cen: { abbr: 'Cen', genitive: 'Centauri', koGenitive: '센타우리' },
  cep: { abbr: 'Cep', genitive: 'Cephei', koGenitive: '세페이' },
  cet: { abbr: 'Cet', genitive: 'Ceti', koGenitive: '세티' },
  cha: { abbr: 'Cha', genitive: 'Chamaeleontis', koGenitive: '카멜레온티스' },
  cir: { abbr: 'Cir', genitive: 'Circini', koGenitive: '키르키니' },
  col: { abbr: 'Col', genitive: 'Columbae', koGenitive: '콜룸바이' },
  com: { abbr: 'Com', genitive: 'Comae Berenices', koGenitive: '코마이 베레니케스' },
  cra: { abbr: 'CrA', genitive: 'Coronae Australis', koGenitive: '코로나이 아우스트랄리스' },
  crb: { abbr: 'CrB', genitive: 'Coronae Borealis', koGenitive: '코로나이 보레알리스' },
  crv: { abbr: 'Crv', genitive: 'Corvi', koGenitive: '코르비' },
  crt: { abbr: 'Crt', genitive: 'Crateris', koGenitive: '크라테리스' },
  cru: { abbr: 'Cru', genitive: 'Crucis', koGenitive: '크루키스' },
  cyg: { abbr: 'Cyg', genitive: 'Cygni', koGenitive: '시그니' },
  del: { abbr: 'Del', genitive: 'Delphini', koGenitive: '델피니' },
  dor: { abbr: 'Dor', genitive: 'Doradus', koGenitive: '도라두스' },
  dra: { abbr: 'Dra', genitive: 'Draconis', koGenitive: '드라코니스' },
  equ: { abbr: 'Equ', genitive: 'Equulei', koGenitive: '에쿠울레이' },
  eri: { abbr: 'Eri', genitive: 'Eridani', koGenitive: '에리다니' },
  for: { abbr: 'For', genitive: 'Fornacis', koGenitive: '포르나키스' },
  gem: { abbr: 'Gem', genitive: 'Geminorum', koGenitive: '게미노룸' },
  gru: { abbr: 'Gru', genitive: 'Gruis', koGenitive: '그루이스' },
  her: { abbr: 'Her', genitive: 'Herculis', koGenitive: '헤르쿨리스' },
  hor: { abbr: 'Hor', genitive: 'Horologii', koGenitive: '호롤로기이' },
  hya: { abbr: 'Hya', genitive: 'Hydrae', koGenitive: '히드라이' },
  hyi: { abbr: 'Hyi', genitive: 'Hydri', koGenitive: '히드리' },
  ind: { abbr: 'Ind', genitive: 'Indi', koGenitive: '인디' },
  lac: { abbr: 'Lac', genitive: 'Lacertae', koGenitive: '라케르타이' },
  leo: { abbr: 'Leo', genitive: 'Leonis', koGenitive: '레오니스' },
  lmi: { abbr: 'LMi', genitive: 'Leonis Minoris', koGenitive: '레오니스 미노리스' },
  lep: { abbr: 'Lep', genitive: 'Leporis', koGenitive: '레포리스' },
  lib: { abbr: 'Lib', genitive: 'Librae', koGenitive: '리브라이' },
  lup: { abbr: 'Lup', genitive: 'Lupi', koGenitive: '루피' },
  lyn: { abbr: 'Lyn', genitive: 'Lyncis', koGenitive: '린키스' },
  lyr: { abbr: 'Lyr', genitive: 'Lyrae', koGenitive: '리라이' },
  men: { abbr: 'Men', genitive: 'Mensae', koGenitive: '멘사이' },
  mic: { abbr: 'Mic', genitive: 'Microscopii', koGenitive: '미크로스코피이' },
  mon: { abbr: 'Mon', genitive: 'Monocerotis', koGenitive: '모노케로티스' },
  mus: { abbr: 'Mus', genitive: 'Muscae', koGenitive: '무스카이' },
  nor: { abbr: 'Nor', genitive: 'Normae', koGenitive: '노르마이' },
  oct: { abbr: 'Oct', genitive: 'Octantis', koGenitive: '옥탄티스' },
  oph: { abbr: 'Oph', genitive: 'Ophiuchi', koGenitive: '오피우키' },
  ori: { abbr: 'Ori', genitive: 'Orionis', koGenitive: '오리오니스' },
  pav: { abbr: 'Pav', genitive: 'Pavonis', koGenitive: '파보니스' },
  peg: { abbr: 'Peg', genitive: 'Pegasi', koGenitive: '페가시' },
  per: { abbr: 'Per', genitive: 'Persei', koGenitive: '페르세이' },
  phe: { abbr: 'Phe', genitive: 'Phoenicis', koGenitive: '포이니키스' },
  pic: { abbr: 'Pic', genitive: 'Pictoris', koGenitive: '픽토리스' },
  psc: { abbr: 'Psc', genitive: 'Piscium', koGenitive: '피스키움' },
  psa: { abbr: 'PsA', genitive: 'Piscis Austrini', koGenitive: '피스키스 아우스트리니' },
  pup: { abbr: 'Pup', genitive: 'Puppis', koGenitive: '푸피스' },
  pyx: { abbr: 'Pyx', genitive: 'Pyxidis', koGenitive: '픽시디스' },
  ret: { abbr: 'Ret', genitive: 'Reticuli', koGenitive: '레티쿨리' },
  sge: { abbr: 'Sge', genitive: 'Sagittae', koGenitive: '사기타이' },
  sgr: { abbr: 'Sgr', genitive: 'Sagittarii', koGenitive: '사기타리이' },
  sco: { abbr: 'Sco', genitive: 'Scorpii', koGenitive: '스코르피이' },
  scl: { abbr: 'Scl', genitive: 'Sculptoris', koGenitive: '스쿨프토리스' },
  sct: { abbr: 'Sct', genitive: 'Scuti', koGenitive: '스쿠티' },
  ser: { abbr: 'Ser', genitive: 'Serpentis', koGenitive: '세르펜티스' },
  sex: { abbr: 'Sex', genitive: 'Sextantis', koGenitive: '섹스탄티스' },
  tau: { abbr: 'Tau', genitive: 'Tauri', koGenitive: '타우리' },
  tel: { abbr: 'Tel', genitive: 'Telescopii', koGenitive: '텔레스코피이' },
  tri: { abbr: 'Tri', genitive: 'Trianguli', koGenitive: '트리앙굴리' },
  tra: { abbr: 'TrA', genitive: 'Trianguli Australis', koGenitive: '트리앙굴리 아우스트랄리스' },
  tuc: { abbr: 'Tuc', genitive: 'Tucanae', koGenitive: '투카나이' },
  uma: { abbr: 'UMa', genitive: 'Ursae Majoris', koGenitive: '우르사이 마요리스' },
  umi: { abbr: 'UMi', genitive: 'Ursae Minoris', koGenitive: '우르사이 미노리스' },
  vel: { abbr: 'Vel', genitive: 'Velorum', koGenitive: '벨로룸' },
  vir: { abbr: 'Vir', genitive: 'Virginis', koGenitive: '비르기니스' },
  vol: { abbr: 'Vol', genitive: 'Volantis', koGenitive: '볼란티스' },
  vul: { abbr: 'Vul', genitive: 'Vulpeculae', koGenitive: '불페쿨라이' },
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

/**
 * Expands a Greek (or Latin-letter) Bayer designation into readable English genitive,
 * English abbreviated, and Korean genitive forms.
 * Example: "δ Cep" -> ["Delta Cephei", "Delta Cep", "델타 세페이"]
 * Example: "ε1 Lyr" -> ["Epsilon1 Lyrae", "Epsilon1 Lyr", "엡실론1 리라이"]
 */
export function getBayerExpandedNames(raw?: string): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (!s) return [];

  const greekMatch = /^([α-ωΑ-Ωϑϕϱϖς])([0-9⁰¹²³⁴⁵⁶⁷⁸⁹]?)\s+([A-Za-z]{3})$/.exec(s);
  if (greekMatch) {
    const letter = GREEK_BAYER_LETTERS[greekMatch[1]];
    const con = IAU_CONSTELLATION_GENITIVES[greekMatch[3].toLowerCase()];
    if (letter && con) {
      const num = greekMatch[2] ? SUPERSCRIPT_DIGITS[greekMatch[2]] ?? greekMatch[2] : '';
      return [
        `${letter.en}${num} ${con.genitive}`,
        `${letter.en}${num} ${con.abbr}`,
        `${letter.ko}${num} ${con.koGenitive}`,
      ];
    }
  }

  const latinMatch = /^([A-Za-z])([0-9⁰¹²³⁴⁵⁶⁷⁸⁹]?)\s+([A-Za-z]{3})$/.exec(s);
  if (latinMatch) {
    const con = IAU_CONSTELLATION_GENITIVES[latinMatch[3].toLowerCase()];
    if (con) {
      const num = latinMatch[2] ? SUPERSCRIPT_DIGITS[latinMatch[2]] ?? latinMatch[2] : '';
      return [`${latinMatch[1]}${num} ${con.genitive}`];
    }
  }

  return [];
}
