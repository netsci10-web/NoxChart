import { CatalogSnapshot } from '../data/catalogLoader';
import {
  ChallengeTrack,
  DeepSkyObject,
  DoubleStarSystem,
  ObserverConfig,
  SelectedItem,
  SolarSystemBody,
  Star,
} from '../types/astronomy';
import {
  angularDistanceDeg,
  equatorialToHorizontal,
  getCompassDirection,
  getDsoTypeLabel,
  getLSTDeg,
} from './astronomy';
import {
  formatCatalogCode,
  formatObjectDisplayName,
  normalizeCatalogToken,
} from './catalogNames';
import { getSolarSystemBodies } from './solarSystem';

export interface TourStop {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  kind: SelectedItem['kind'];
  selectedItem: SelectedItem;
  ra: number;
  dec: number;
  altDeg: number;
  azDeg: number;
  compass: string;
  recommendedFovDeg: number;
  guideText: string;
  checkpointId?: string;
}

export interface GuidedTourState {
  active: boolean;
  title: string;
  trackId: string | null; // null = Tonight's curated tour
  stops: TourStop[];
  currentIndex: number;
  playing: boolean;
  pausedByUser: boolean;
  completed: boolean;
  dwellSec: number;
  phase: 'slewing' | 'dwelling';
}

export const TOUR_DWELL_OPTIONS = [5, 8, 12] as const;

interface CuratedTargetSpec {
  key: string; // M42, C14, Moon, Jupiter, Sirius, Albireo...
  kind: 'planet' | 'dso' | 'star' | 'double';
  priority: number;
  fovOverrideDeg?: number;
  guide: string;
}

const CURATED_TONIGHT_SPECS: CuratedTargetSpec[] = [
  // Solar System
  {
    key: 'Moon',
    kind: 'planet',
    priority: 100,
    fovOverrideDeg: 2.2,
    guide: '오늘 밤 가장 가깝고 선명한 천체입니다. 명암 경계선(터미네이터) 부근의 크레이터 입체감을 감상해 보세요.',
  },
  {
    key: 'Jupiter',
    kind: 'planet',
    priority: 96,
    fovOverrideDeg: 0.35,
    guide: '태양계 최대 행성 목성과 일렬로 늘어선 4대 갈릴레이 위성(이오·유로파·가니메데·칼리스토)을 확인해 보세요.',
  },
  {
    key: 'Saturn',
    kind: 'planet',
    priority: 95,
    fovOverrideDeg: 0.18,
    guide: '아름다운 얼음 고리와 가장 밝은 위성 타이탄을 품은 토성입니다. 소구경 망원경으로도 고리의 기울기를 볼 수 있습니다.',
  },
  {
    key: 'Mars',
    kind: 'planet',
    priority: 88,
    fovOverrideDeg: 0.12,
    guide: '산화철 표면이 붉게 빛나는 화성입니다. 대기 상태가 좋은 밤에는 극관과 어두운 지형 무늬를 관찰할 수 있습니다.',
  },
  {
    key: 'Venus',
    kind: 'planet',
    priority: 90,
    fovOverrideDeg: 0.15,
    guide: '밤하늘에서 달 다음으로 밝은 금성입니다. 내행성 특유의 초승달·반달 위상 변화를 망원경으로 확인할 수 있습니다.',
  },

  // Iconic DSOs across all four seasons
  {
    key: 'M42',
    kind: 'dso',
    priority: 97,
    fovOverrideDeg: 4.8,
    guide: '지구에서 가장 가까운 대규모 별 탄생 영역입니다. 중심부 트라페지움 사중성과 날개처럼 펼쳐진 가스 성운을 보세요.',
  },
  {
    key: 'M31',
    kind: 'dso',
    priority: 96,
    fovOverrideDeg: 7.2,
    guide: '250만 광년 거리의 초대형 이웃 나선은하입니다. 위성은하 M32·M110이 한 시야에 함께 담기는 장관을 이룹니다.',
  },
  {
    key: 'M45',
    kind: 'dso',
    priority: 95,
    fovOverrideDeg: 6.2,
    guide: '푸른 젊은 별들이 무리 지어 빛나는 플레이아데스 산개성단입니다. 맨눈과 쌍안경 모두에서 환상적인 모습을 보여줍니다.',
  },
  {
    key: 'M13',
    kind: 'dso',
    priority: 94,
    fovOverrideDeg: 2.2,
    guide: '약 30만 개 이상의 늙은 별이 공처럼 뭉친 북반구 최고의 구상성단입니다. 가장자리부터 별알이 흩어지듯 분해됩니다.',
  },
  {
    key: 'C14',
    kind: 'dso',
    priority: 92,
    fovOverrideDeg: 3.0,
    guide: 'NGC 869와 NGC 884 두 산개성단이 쌍둥이처럼 나란히 빛나는 페르세우스 이중성단입니다. 저배율 광시야 최고의 명소입니다.',
  },
  {
    key: 'M8',
    kind: 'dso',
    priority: 93,
    fovOverrideDeg: 4.5,
    guide: '여름철 은하수 중심부의 거대한 발광성운(석호 성운)입니다. 내부 산개성단 NGC 6530과 어두운 먼지 띠가 어우러집니다.',
  },
  {
    key: 'M20',
    kind: 'dso',
    priority: 86,
    fovOverrideDeg: 2.8,
    guide: '붉은 발광성운과 푸른 반사성운, 세 갈래 암흑 먼지 띠가 공존하는 삼렬 성운입니다. 석호 성운(M8) 바로 북쪽에 위치합니다.',
  },
  {
    key: 'M17',
    kind: 'dso',
    priority: 87,
    fovOverrideDeg: 3.0,
    guide: '물 위에 떠 있는 백조를 닮아 백조 성운·오메가 성운이라 불립니다. 여름철 은하수에서 가장 밝은 성운 중 하나입니다.',
  },
  {
    key: 'M57',
    kind: 'dso',
    priority: 91,
    fovOverrideDeg: 1.2,
    guide: '거문고자리 β와 γ 별 사이에 떠 있는 고리 모양 행성상성운입니다. 태양과 비슷한 별이 생애 말기에 남긴 빛나는 가스 껍질입니다.',
  },
  {
    key: 'M27',
    kind: 'dso',
    priority: 90,
    fovOverrideDeg: 1.8,
    guide: '시직경이 크고 밝아 관측하기 좋은 아령 성운입니다. 쌍안경에서도 직사각형·모래시계 윤곽이 또렷하게 드러납니다.',
  },
  {
    key: 'M51',
    kind: 'dso',
    priority: 92,
    fovOverrideDeg: 2.2,
    guide: '동반은하 NGC 5195와 중력으로 얽힌 정면 나선은하(소용돌이 은하)입니다. 북두칠성 국자 끝 알카이드 부근에서 찾을 수 있습니다.',
  },
  {
    key: 'M81',
    kind: 'dso',
    priority: 91,
    fovOverrideDeg: 3.2,
    guide: '큰곰자리 북쪽의 우아한 보데 은하입니다. 바로 옆의 폭발적 별생성 은하 시가 은하(M82)와 멋진 한 쌍을 이룹니다.',
  },
  {
    key: 'M82',
    kind: 'dso',
    priority: 85,
    fovOverrideDeg: 2.4,
    guide: 'M81과의 중력 상호작용으로 중심부에서 격렬하게 별이 탄생하는 시가 은하입니다. 옆모습의 가늘고 밝은 띠가 인상적입니다.',
  },
  {
    key: 'M104',
    kind: 'dso',
    priority: 89,
    fovOverrideDeg: 2.0,
    guide: '챙 넓은 멕시코 모자를 닮은 솜브레로 은하입니다. 밝은 중심 팽대부를 가로지르는 짙은 적도 먼지 띠가 특징입니다.',
  },
  {
    key: 'M44',
    kind: 'dso',
    priority: 89,
    fovOverrideDeg: 5.5,
    guide: '게자리 한가운데서 보석처럼 흩뿌려진 프레세페(벌집) 성단입니다. 어두운 하늘에서는 맨눈으로도 희뿌연 구름처럼 보입니다.',
  },
  {
    key: 'M11',
    kind: 'dso',
    priority: 88,
    fovOverrideDeg: 2.0,
    guide: '방패자리 은하수 속에 약 2,900개의 별이 부채꼴로 모인 야생오리 성단입니다. 구상성단처럼 촘촘한 산개성단의 진수를 보여줍니다.',
  },
  {
    key: 'M22',
    kind: 'dso',
    priority: 88,
    fovOverrideDeg: 2.5,
    guide: '궁수자리 주전자 뚜껑 별 북동쪽에 자리한 초대형 구상성단입니다. M13보다 겉보기 크기가 크고 밝아 남쪽 하늘의 보석으로 꼽힙니다.',
  },
  {
    key: 'M33',
    kind: 'dso',
    priority: 84,
    fovOverrideDeg: 4.5,
    guide: '안드로메다 은하와 함께 국부은하군을 이루는 삼각형자리 나선은하입니다. 표면밝기가 낮아 어두운 하늘에서 광시야로 볼 때 아름답습니다.',
  },
  {
    key: 'M1',
    kind: 'dso',
    priority: 85,
    fovOverrideDeg: 1.6,
    guide: '서기 1054년 초신성 폭발의 잔해로 탄생한 게 성운입니다. 메시에 목록의 1번 천체로 중심에 초고속 회전 펄서가 자리합니다.',
  },
  {
    key: 'M35',
    kind: 'dso',
    priority: 84,
    fovOverrideDeg: 2.8,
    guide: '쌍둥이자리 발끝에 빛나는 화려한 산개성단입니다. 바로 남서쪽의 더 작고 빽빽한 NGC 2158 성단과 대비되는 구도가 일품입니다.',
  },
  {
    key: 'M37',
    kind: 'dso',
    priority: 83,
    fovOverrideDeg: 2.5,
    guide: '마차부자리 3대 산개성단(M36·M37·M38) 중 가장 별이 풍성한 성단입니다. 소금과 후추를 뿌린 듯한 중심부의 붉은 거성을 찾아보세요.',
  },
  {
    key: 'M6',
    kind: 'dso',
    priority: 82,
    fovOverrideDeg: 3.0,
    guide: '전갈자리 꼬리 위쪽에서 날개를 펼친 나비 모양으로 배열된 산개성단입니다. 푸른 별들 사이 주황색 거성 BM Sco가 돋보입니다.',
  },
  {
    key: 'M7',
    kind: 'dso',
    priority: 83,
    fovOverrideDeg: 4.5,
    guide: '고대 프톨레마이오스 시대부터 기록된 밝은 산개성단입니다. 은하수 배경 위로 수십 개의 밝은 별이 넓게 펼쳐집니다.',
  },
  {
    key: 'M64',
    kind: 'dso',
    priority: 81,
    fovOverrideDeg: 2.0,
    guide: '밝은 은하핵 바로 앞에 짙은 먼지 띠가 걸려 검은 눈처럼 보이는 검은눈 은하입니다. 과거 은하 합병의 흔적으로 외곽이 반대 방향으로 회전합니다.',
  },
  {
    key: 'M63',
    kind: 'dso',
    priority: 80,
    fovOverrideDeg: 2.2,
    guide: '짧고 촘촘한 나선팔이 해바라기 꽃잎처럼 감겨 있는 해바라기 은하입니다. M51과 같은 은하군에 속합니다.',
  },
  {
    key: 'M15',
    kind: 'dso',
    priority: 82,
    fovOverrideDeg: 2.0,
    guide: '페가수스자리 코끝 너머에 빛나는 고밀도 구상성단입니다. 중심핵이 극도로 밝게 응집된 코어 붕괴 구상성단의 대표 사례입니다.',
  },
  {
    key: 'M3',
    kind: 'dso',
    priority: 83,
    fovOverrideDeg: 2.2,
    guide: '약 50만 개의 별을 거느린 봄철 최고의 구상성단입니다. 아크투루스와 코르 카롤리 사이에서 밝게 빛납니다.',
  },
  {
    key: 'C33',
    kind: 'dso',
    priority: 84,
    fovOverrideDeg: 4.2,
    guide: '약 1만 년 전 초신성 폭발이 남긴 동쪽 베일 성운(NGC 6992)입니다. 백조자리 날개 아래 커튼처럼 흐르는 필라멘트 구조가 장관입니다.',
  },
  {
    key: 'C50',
    kind: 'dso',
    priority: 83,
    fovOverrideDeg: 3.8,
    guide: '장미 성운(C49) 한가운데서 성운을 밝히는 젊은 산개성단(NGC 2244)입니다. 성단 별들의 항성풍이 중심의 거대한 공동을 깎아냈습니다.',
  },
  {
    key: 'C4',
    kind: 'dso',
    priority: 78,
    fovOverrideDeg: 2.4,
    guide: '세페우스자리 은하수 속 푸른 꽃잎처럼 피어난 아이리스 반사성운(NGC 7023)입니다. 주위를 감싸는 짙은 암흑성운과 대비를 이룹니다.',
  },
  {
    key: 'C65',
    kind: 'dso',
    priority: 82,
    fovOverrideDeg: 3.0,
    guide: '가을철 남쪽 하늘 조각가자리의 대표 밝은 나선은하(NGC 253)입니다. 길쭉한 은하 원반이 쌍안경에서도 또렷하게 드러납니다.',
  },
  {
    key: 'C80',
    kind: 'dso',
    priority: 88,
    fovOverrideDeg: 3.5,
    guide: '우리 은하 최대 규모의 구상성단 오메가 센타우리(NGC 5139)입니다. 무려 1,000만 개의 별이 모여 맨눈으로도 뿌연 별처럼 보입니다.',
  },

  // Iconic Double Stars
  {
    key: 'Albireo',
    kind: 'double',
    priority: 89,
    fovOverrideDeg: 0.65,
    guide: '백조자리 부리에 빛나는 밤하늘 최고의 색대비 이중성 알비레오입니다. 황금빛 주성과 사파이어빛 반성이 34″ 간격으로 나란히 빛납니다.',
  },
  {
    key: 'Mizar',
    kind: 'double',
    priority: 86,
    fovOverrideDeg: 0.55,
    guide: '북두칠성 손잡이 두 번째 별 미자르와 알코르입니다. 망원경으로 확대하면 미자르 자체가 다시 두 별로 갈라지는 다중성계입니다.',
  },
  {
    key: 'Castor',
    kind: 'double',
    priority: 82,
    fovOverrideDeg: 0.35,
    guide: '쌍둥이자리의 밝은 α성 카스토르입니다. 실제로는 6개의 별이 중력으로 묶여 공전하는 놀라운 6중성계입니다.',
  },

  // Iconic 1st-Magnitude Stars (wide constellation context)
  {
    key: 'Sirius',
    kind: 'star',
    priority: 86,
    fovOverrideDeg: 18,
    guide: '온 밤하늘에서 가장 밝게 빛나는 항성 시리우스(-1.46등급)입니다. 지구에서 단 8.6광년 거리에 있으며 남쪽 바로 아래에 M41 성단이 있습니다.',
  },
  {
    key: 'Vega',
    kind: 'star',
    priority: 84,
    fovOverrideDeg: 18,
    guide: '여름철 대삼각형의 기준점인 거문고자리 직녀성(베가)입니다. 청백색으로 빛나는 0등급 표준별이자 먼지 원반을 거느린 젊은 별입니다.',
  },
  {
    key: 'Arcturus',
    kind: 'star',
    priority: 83,
    fovOverrideDeg: 20,
    guide: '북반구 하늘에서 가장 밝은 주황색 적색거성 아크투루스입니다. 북두칠성 손잡이 곡선을 따라 연장하면 쉽게 찾을 수 있습니다.',
  },
  {
    key: 'Capella',
    kind: 'star',
    priority: 80,
    fovOverrideDeg: 20,
    guide: '마차부자리의 황금빛 1등성 카펠라입니다. 북쪽 하늘 높이 떠올라 겨울철 육각형의 북쪽 꼭짓점을 이룹니다.',
  },
  {
    key: 'Antares',
    kind: 'star',
    priority: 83,
    fovOverrideDeg: 16,
    guide: '전갈의 심장에서 붉게 타오르는 초거성 안타레스입니다. 태양 지름의 약 700배에 달하며 바로 서쪽에 M4 구상성단이 자리합니다.',
  },
  {
    key: 'Betelgeuse',
    kind: 'star',
    priority: 81,
    fovOverrideDeg: 22,
    guide: '오리온자리 어깨에서 붉게 빛나는 적색 초거성 베텔게우스입니다. 오리온의 사각형과 삼태성, 겨울철 대삼각형의 중심을 이룹니다.',
  },
];

export function computeRecommendedFov(item: SelectedItem, tightDso = false): number {
  if (item.kind === 'planet') {
    const id = item.data.id;
    if (id === 'Moon') return 1.8;
    if (id === 'Sun') return 2.0;
    if (id === 'Jupiter') return 0.25;
    if (id === 'Saturn') return 0.14;
    if (id === 'Mars' || id === 'Venus' || id === 'Mercury') return 0.11;
    if (item.data.group === 'moon') return 0.2;
    return 1.2;
  }
  if (item.kind === 'double') {
    return Math.max(0.18, Math.min(1.6, (item.data.sep / 3600) * 55));
  }
  if (item.kind === 'star') {
    return 14;
  }
  // DSO: scale FOV cleanly to object angular diameter (majAx in arcminutes)
  if (tightDso) {
    const fallbackArcminByType: Record<string, number> = {
      PN: 1.5,
      GC: 8.5,
      G: 7.0,
      OC: 18.0,
      EN: 26.0,
      RN: 18.0,
      DN: 24.0,
      SNR: 28.0,
      DARK: 25.0,
    };
    const majArcmin =
      item.data.majAx && item.data.majAx > 0
        ? item.data.majAx
        : fallbackArcminByType[item.data.type] ?? 10;
    const majDeg = majArcmin / 60;
    // Frame DSO generously to fill most of the viewport (~60% of frame diameter)
    return Math.max(0.06, Math.min(3.6, majDeg * 1.65));
  }
  const majDeg = Math.max(0.02, (item.data.majAx || 10) / 60);
  if (item.data.type === 'PN' && majDeg < 0.08) {
    return 0.45;
  }
  return Math.max(0.35, Math.min(6.5, majDeg * 2.6));
}

function resolveCuratedTarget(
  spec: CuratedTargetSpec,
  solarBodies: SolarSystemBody[],
  catalogs: CatalogSnapshot
): SelectedItem | null {
  const targetNorm = normalizeCatalogToken(spec.key);
  const keyLower = spec.key.toLowerCase();

  if (spec.kind === 'planet') {
    const body = solarBodies.find((b) => b.id.toLowerCase() === keyLower);
    return body ? { kind: 'planet', data: body } : null;
  }

  if (spec.kind === 'dso') {
    const pools: DeepSkyObject[][] = [
      catalogs.dsosBright,
      catalogs.caldwell,
      catalogs.darkNebulae,
      catalogs.dsosDeep,
    ];
    for (const pool of pools) {
      const hit = pool.find(
        (d) =>
          normalizeCatalogToken(d.id) === targetNorm ||
          normalizeCatalogToken(d.altId) === targetNorm
      );
      if (hit) return { kind: 'dso', data: hit };
    }
    return null;
  }

  if (spec.kind === 'double') {
    const hit = catalogs.doubleStars.find(
      (d) =>
        d.name?.toLowerCase() === keyLower ||
        d.koName?.toLowerCase() === keyLower ||
        normalizeCatalogToken(d.id) === targetNorm
    );
    return hit ? { kind: 'double', data: hit } : null;
  }

  const star = catalogs.brightStars.find(
    (s) =>
      s.name?.toLowerCase() === keyLower ||
      normalizeCatalogToken(s.id) === targetNorm
  );
  return star ? { kind: 'star', data: star } : null;
}

function buildSubtitleForItem(item: SelectedItem): string {
  if (item.kind === 'planet') {
    const b = item.data;
    return [
      b.category,
      `${b.mag.toFixed(1)}m`,
      b.id === 'Moon' ? `위상 ${b.phasePct}%` : `${b.distAu.toFixed(2)} AU`,
    ].join(' · ');
  }
  if (item.kind === 'dso') {
    const d = item.data;
    return [
      d.con || null,
      getDsoTypeLabel(d.type).split(' (')[0],
      d.mag < 90 ? `${d.mag.toFixed(1)}m` : null,
      d.majAx > 0 ? `${d.majAx.toFixed(1)}′` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (item.kind === 'double') {
    const ds = item.data;
    return [
      ds.con || null,
      ds.isMultiple ? `다중 ${ds.compCount}성` : '이중성',
      `${ds.mag1.toFixed(1)}/${ds.mag2.toFixed(1)}m`,
      `이격 ${ds.sep.toFixed(1)}″`,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const st = item.data;
  return [
    st.con || null,
    st.bayer || (st.hip ? `HIP ${st.hip}` : null),
    `${st.mag.toFixed(2)}m`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function getCodeForItem(item: SelectedItem): string {
  if (item.kind === 'planet') return item.data.symbol;
  if (item.kind === 'dso') {
    if (item.data.altId && /^C\d+$/i.test(item.data.altId)) {
      return formatCatalogCode(item.data.altId);
    }
    return formatCatalogCode(item.data.id) || item.data.id;
  }
  if (item.kind === 'double') return item.data.bayer || item.data.disc;
  return item.data.bayer || '★';
}

function getTitleForItem(item: SelectedItem): string {
  if (item.kind === 'planet') {
    return formatObjectDisplayName(item.data.koName, item.data.name, item.data.id);
  }
  if (item.kind === 'dso') {
    return formatObjectDisplayName(
      item.data.koName,
      item.data.name,
      formatCatalogCode(item.data.id) || item.data.id
    );
  }
  if (item.kind === 'double') {
    return formatObjectDisplayName(
      item.data.koName,
      item.data.name,
      item.data.bayer || item.data.disc
    );
  }
  return formatObjectDisplayName(
    item.data.koName,
    item.data.name,
    item.data.bayer || item.data.id
  );
}

/**
 * Orders tour stops along a smooth nearest-neighbor path across tonight's sky
 * (starting from the easternmost/highest showcase target) to avoid jarring back-and-forth slews.
 */
function orderStopsSmoothly(stops: TourStop[]): TourStop[] {
  if (stops.length <= 2) return stops;
  const remaining = [...stops];
  // Start with the first high-priority bright target (e.g., Moon/Planet or top Eastern target)
  const ordered: TourStop[] = [remaining.shift()!];

  while (remaining.length > 0) {
    const prev = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = angularDistanceDeg(prev.ra, prev.dec, remaining[i].ra, remaining[i].dec);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

/**
 * Dynamically curates up to `maxStops` (default 10) prime celestial objects currently
 * visible above the horizon for the observer's time and location.
 */
export function buildTonightTourStops(
  observer: ObserverConfig,
  catalogs: CatalogSnapshot,
  maxStops = 10
): TourStop[] {
  const obsTimeMs = observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);
  const solarBodies = getSolarSystemBodies(obsTimeMs);

  interface ScoredCandidate {
    spec: CuratedTargetSpec;
    item: SelectedItem;
    altDeg: number;
    azDeg: number;
    score: number;
  }

  const allCandidates: ScoredCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const spec of CURATED_TONIGHT_SPECS) {
    const item = resolveCuratedTarget(spec, solarBodies, catalogs);
    if (!item) continue;
    const dedupeKey = `${item.kind}:${normalizeCatalogToken(item.data.id)}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const hz = equatorialToHorizontal(item.data.ra, item.data.dec, lstDeg, observer.lat);
    // Favor targets comfortably above horizon (20°..75° sweet spot)
    const altBonus =
      hz.altDeg >= 25 && hz.altDeg <= 78
        ? 14
        : hz.altDeg >= 15
        ? 8
        : hz.altDeg >= 10
        ? 2
        : -25;

    allCandidates.push({
      spec,
      item,
      altDeg: hz.altDeg,
      azDeg: hz.azDeg,
      score: spec.priority + altBonus,
    });
  }

  // Primary pool: targets currently >= 10° above horizon; fallback >= 2° if sky is sparse
  let pool = allCandidates.filter((c) => c.altDeg >= 10);
  if (pool.length < 5) {
    pool = allCandidates.filter((c) => c.altDeg >= 2);
  }
  if (pool.length === 0) {
    pool = [...allCandidates].sort((a, b) => b.altDeg - a.altDeg).slice(0, maxStops);
  }

  // Balanced selection: up to 3 planets/Moon, up to 2 stars/doubles, rest showcase DSOs
  const planets = pool
    .filter((c) => c.spec.kind === 'planet')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const dsos = pool
    .filter((c) => c.spec.kind === 'dso')
    .sort((a, b) => b.score - a.score);
  const starsAndDoubles = pool
    .filter((c) => c.spec.kind === 'star' || c.spec.kind === 'double')
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const chosen: ScoredCandidate[] = [...planets];
  const dsoQuota = Math.max(4, maxStops - chosen.length - starsAndDoubles.length);
  chosen.push(...dsos.slice(0, dsoQuota));
  chosen.push(...starsAndDoubles);

  // Fill remaining slots with next-best DSOs if under maxStops
  if (chosen.length < maxStops) {
    const chosenSet = new Set(chosen.map((c) => c.spec.key));
    for (const extra of dsos) {
      if (chosen.length >= maxStops) break;
      if (!chosenSet.has(extra.spec.key)) {
        chosen.push(extra);
        chosenSet.add(extra.spec.key);
      }
    }
  }

  const rawStops: TourStop[] = chosen.slice(0, maxStops).map((c) => ({
    id: `tonight-${c.spec.key.toLowerCase()}`,
    code: getCodeForItem(c.item),
    title: getTitleForItem(c.item),
    subtitle: buildSubtitleForItem(c.item),
    kind: c.item.kind,
    selectedItem: c.item,
    ra: c.item.data.ra,
    dec: c.item.data.dec,
    altDeg: c.altDeg,
    azDeg: c.azDeg,
    compass: getCompassDirection(c.azDeg),
    recommendedFovDeg: c.spec.fovOverrideDeg ?? computeRecommendedFov(c.item),
    guideText: c.spec.guide,
  }));

  return orderStopsSmoothly(rawStops);
}

/**
 * Converts a ChallengeTrack's checkpoints into an auto-guided tour sequence with
 * automatically computed per-target FOV and observational guide commentary.
 */
export function buildChallengeTourStops(
  track: ChallengeTrack,
  observer: ObserverConfig,
  catalogs: CatalogSnapshot,
  options?: { visibleOnly?: boolean }
): TourStop[] {
  const obsTimeMs = observer.timestampMs;
  const lstDeg = getLSTDeg(obsTimeMs, observer.lon);
  const solarBodies = getSolarSystemBodies(obsTimeMs);
  const allDsos = [
    ...catalogs.dsosBright,
    ...catalogs.caldwell,
    ...catalogs.darkNebulae,
    ...catalogs.dsosDeep,
  ];

  const stops: TourStop[] = [];
  for (const cp of track.checkpoints) {
    const keyNorm = normalizeCatalogToken(cp.catalogId);
    let item: SelectedItem | null = null;

    if (cp.kind === 'dso' && keyNorm) {
      const hit = allDsos.find(
        (d) =>
          normalizeCatalogToken(d.id) === keyNorm ||
          normalizeCatalogToken(d.altId) === keyNorm
      );
      if (hit) item = { kind: 'dso', data: hit };
    } else if (cp.kind === 'star' && keyNorm) {
      const hit = catalogs.brightStars.find(
        (s) =>
          normalizeCatalogToken(s.id) === keyNorm ||
          (s.hip && `hip${s.hip}` === keyNorm) ||
          (s.name && normalizeCatalogToken(s.name) === keyNorm)
      );
      if (hit) item = { kind: 'star', data: hit };
    } else if (cp.kind === 'double' && keyNorm) {
      const hit = catalogs.doubleStars.find((d) => normalizeCatalogToken(d.id) === keyNorm);
      if (hit) item = { kind: 'double', data: hit };
    } else if (cp.kind === 'planet' && cp.catalogId) {
      const hit = solarBodies.find((b) => b.id.toLowerCase() === cp.catalogId!.toLowerCase());
      if (hit) item = { kind: 'planet', data: hit };
    }

    if (!item && cp.ra !== undefined && cp.dec !== undefined) {
      if (cp.kind === 'star') {
        const synthStar: Star = {
          id: cp.catalogId || cp.id,
          ra: cp.ra,
          dec: cp.dec,
          mag: cp.mag ?? 2.0,
          bv: 0.4,
          koName: cp.name,
          con: cp.constellation || '',
        };
        item = { kind: 'star', data: synthStar };
      } else {
        const synthDso: DeepSkyObject = {
          id: cp.catalogId || cp.code,
          type: 'DN',
          ra: cp.ra,
          dec: cp.dec,
          mag: cp.mag ?? 7.0,
          majAx: 18,
          minAx: 14,
          pa: 0,
          koName: cp.name,
          con: cp.constellation || '',
        };
        item = { kind: 'dso', data: synthDso };
      }
    }

    if (!item) continue;

    const hz = equatorialToHorizontal(item.data.ra, item.data.dec, lstDeg, observer.lat);
    if (options?.visibleOnly && hz.altDeg < 5) continue;

    // Look up curated guide note if checkpoint doesn't carry one
    const curatedSpec = CURATED_TONIGHT_SPECS.find(
      (s) =>
        normalizeCatalogToken(s.key) === normalizeCatalogToken(cp.catalogId) ||
        normalizeCatalogToken(s.key) === normalizeCatalogToken(item!.data.id)
    );
    const fallbackGuide = `${cp.stage ? `${cp.stage} · ` : ''}${
      hz.altDeg >= 0
        ? `현재 ${getCompassDirection(hz.azDeg)}쪽 하늘 고도 ${hz.altDeg.toFixed(0)}°에 위치해 있습니다.`
        : `현재 지평선 아래(고도 ${hz.altDeg.toFixed(0)}°)에 있어 관측 시간을 조정하면 더 잘 볼 수 있습니다.`
    }`;

    stops.push({
      id: `ch-${track.id}-${cp.id}`,
      code: cp.code || getCodeForItem(item),
      title: cp.name || getTitleForItem(item),
      subtitle: buildSubtitleForItem(item),
      kind: item.kind,
      selectedItem: item,
      ra: item.data.ra,
      dec: item.data.dec,
      altDeg: hz.altDeg,
      azDeg: hz.azDeg,
      compass: getCompassDirection(hz.azDeg),
      recommendedFovDeg:
        item.kind === 'dso'
          ? computeRecommendedFov(item, true)
          : curatedSpec?.fovOverrideDeg ?? computeRecommendedFov(item, true),
      guideText: cp.guideNote || curatedSpec?.guide || fallbackGuide,
      checkpointId: cp.id,
    });
  }

  return stops;
}

export function formatFovLabel(fovDeg: number): string {
  if (fovDeg >= 10) return `${fovDeg.toFixed(1)}°`;
  if (fovDeg >= 1) return `${fovDeg.toFixed(1)}°`;
  return `${(fovDeg * 60).toFixed(0)}′`;
}
