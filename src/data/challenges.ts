import { ChallengeCheckpoint, ChallengeTrack, DeepSkyObject } from '../types/astronomy';

interface MessierStageSpec {
  stage: string;
  ids: string[];
}

const MESSIER_MARATHON_STAGES: MessierStageSpec[] = [
  {
    stage: '1구간 · 일몰 직후 서쪽 저고도 탈출',
    ids: ['M74', 'M77', 'M33', 'M31', 'M32', 'M110', 'M52', 'M103'],
  },
  {
    stage: '2구간 · 초저녁 겨울 은하수 호핑',
    ids: ['M76', 'M34', 'M45', 'M79', 'M42', 'M43', 'M78', 'M1', 'M35', 'M37', 'M36', 'M38'],
  },
  {
    stage: '3구간 · 자정 전후 봄철 은하단',
    ids: [
      'M41', 'M93', 'M47', 'M46', 'M50', 'M48',
      'M44', 'M67',
      'M95', 'M96', 'M105', 'M65', 'M66',
      'M81', 'M82', 'M97', 'M108', 'M109', 'M40', 'M106', 'M94', 'M63', 'M51', 'M101',
      'M102',
    ],
  },
  {
    stage: '4구간 · 새벽 처녀자리 은하단 미로',
    ids: [
      'M53', 'M64', 'M85', 'M100', 'M98', 'M99', 'M84', 'M86', 'M87', 'M89',
      'M90', 'M88', 'M91', 'M58', 'M59', 'M60', 'M49', 'M61', 'M104',
      'M68', 'M83',
    ],
  },
  {
    stage: '5구간 · 새벽녘 여름 은하수 스퍼트',
    ids: [
      'M3', 'M5', 'M13', 'M92',
      'M57', 'M56', 'M29', 'M39',
      'M27', 'M71',
      'M10', 'M12', 'M14', 'M107', 'M9', 'M19', 'M62',
      'M4', 'M80', 'M6', 'M7',
      'M11', 'M26', 'M16', 'M17', 'M18', 'M24', 'M25', 'M23', 'M21', 'M20',
      'M8', 'M28', 'M22', 'M69', 'M70', 'M54', 'M55', 'M75',
      'M15', 'M2', 'M72', 'M73',
      'M30',
    ],
  },
];

function buildMessierMarathonCheckpoints(): ChallengeCheckpoint[] {
  const list: ChallengeCheckpoint[] = [];
  let seq = 1;
  for (const group of MESSIER_MARATHON_STAGES) {
    for (const id of group.ids) {
      list.push({
        id: `mm-${id.toLowerCase()}`,
        code: `#${String(seq).padStart(3, '0')}`,
        name: id,
        catalogId: id,
        kind: 'dso',
        stage: group.stage,
        guideNote:
          id === 'M74'
            ? '일몰 직후 서쪽 저고도에서 가장 먼저 잡아야 하는 출발점입니다.'
            : id === 'M30'
            ? '일출 직전 남동쪽 지평선 위로 떠오르는 메시에 마라톤 최종 피니시 대상입니다.'
            : undefined,
        observed: false,
      });
      seq++;
    }
  }
  return list;
}

const WINTER_HEXAGON_CHECKPOINTS: ChallengeCheckpoint[] = [
  // Stage 1
  {
    id: 'wh-cp01',
    code: 'CP 01',
    name: '플레이아데스 성단 (M45)',
    catalogId: 'M45',
    kind: 'dso',
    stage: 'Stage 1 · 황소의 뿔과 별의 요람',
    constellation: 'Tau',
    objectType: '산개성단',
    mag: 1.6,
    ra: 56.75,
    dec: 24.1167,
    guideNote: '원정 출발점. 쌍안경이나 광시야 굴절로 푸른 반사성운(메로페 성운) 기운 확인',
    observed: false,
  },
  {
    id: 'wh-cp02',
    code: 'CP 02',
    name: '히아데스 & 알데바란',
    catalogId: 'HIP 21421',
    kind: 'star',
    stage: 'Stage 1 · 황소의 뿔과 별의 요람',
    constellation: 'Tau',
    objectType: '산개성단 · 1등성',
    mag: 0.87,
    ra: 68.9802,
    dec: 16.5093,
    guideNote: 'M45에서 남동쪽 약 14° 이동. V자형 히아데스 성단 끝의 주황색 1등성 알데바란 확인',
    observed: false,
  },
  {
    id: 'wh-cp03',
    code: 'CP 03',
    name: '게성운 (M1 / NGC 1952)',
    catalogId: 'M1',
    kind: 'dso',
    stage: 'Stage 1 · 황소의 뿔과 별의 요람',
    constellation: 'Tau',
    objectType: '초신성잔해',
    mag: 8.4,
    ra: 83.6332,
    dec: 22.0145,
    guideNote: '황소 남쪽 뿔끝 별 ζ Tau(티엔관)에서 북서쪽으로 약 1.1° 이동',
    observed: false,
  },
  // Stage 2
  {
    id: 'wh-cp04',
    code: 'CP 04',
    name: '리겔 (Rigel / β Ori)',
    catalogId: 'HIP 24436',
    kind: 'star',
    stage: 'Stage 2 · 오리온의 허리와 대성운 복합체',
    constellation: 'Ori',
    objectType: '청백색 초거성',
    mag: 0.18,
    ra: 78.6345,
    dec: -8.2016,
    guideNote: '겨울철 육각형 남서쪽 꼭짓점. 고배율(150배 이상)에서 6.8등급 반성 분리 도전',
    observed: false,
  },
  {
    id: 'wh-cp05',
    code: 'CP 05',
    name: '오리온 대성운 (M42 · M43)',
    catalogId: 'M42',
    kind: 'dso',
    stage: 'Stage 2 · 오리온의 허리와 대성운 복합체',
    constellation: 'Ori',
    objectType: '발광성운',
    mag: 4.0,
    ra: 83.8187,
    dec: -5.3897,
    guideNote: '오리온 소삼태성 중앙. 대구경으로 트라페지움(E, F별) 및 날개 구조 확인',
    observed: false,
  },
  {
    id: 'wh-cp06',
    code: 'CP 06',
    name: '런닝맨 성운 (NGC 1977)',
    catalogId: 'NGC 1977',
    kind: 'dso',
    stage: 'Stage 2 · 오리온의 허리와 대성운 복합체',
    constellation: 'Ori',
    objectType: '반사성운',
    mag: 7.0,
    ra: 83.8208,
    dec: -4.8708,
    guideNote: 'M42 바로 북쪽 0.5° 인접. 광시야 경통이나 스마트 망원경으로 M42와 한 화각 프레이밍',
    observed: false,
  },
  {
    id: 'wh-cp07',
    code: 'CP 07',
    name: '불꽃 & 말머리 성운 (NGC 2024 · IC 434)',
    catalogId: 'IC 434',
    kind: 'dso',
    stage: 'Stage 2 · 오리온의 허리와 대성운 복합체',
    constellation: 'Ori',
    objectType: '발광·암흑성운',
    mag: 7.2,
    ra: 85.2537,
    dec: -2.4538,
    guideNote: '삼태성 동쪽 끝별 알니탁(ζ Ori) 바로 옆. 듀얼밴드/H-beta 필터로 말머리 실루엣 탐사',
    observed: false,
  },
  {
    id: 'wh-cp08',
    code: 'CP 08',
    name: '반사성운 M78 (NGC 2068)',
    catalogId: 'M78',
    kind: 'dso',
    stage: 'Stage 2 · 오리온의 허리와 대성운 복합체',
    constellation: 'Ori',
    objectType: '반사성운',
    mag: 8.3,
    ra: 86.6909,
    dec: 0.0793,
    guideNote: '알니탁에서 북동쪽으로 약 2.3° 이동. 캐스퍼 유령처럼 몽환적인 두 눈의 반사성운',
    observed: false,
  },
  {
    id: 'wh-cp09',
    code: 'CP 09',
    name: '베텔게우스 (Betelgeuse / α Ori)',
    catalogId: 'HIP 27989',
    kind: 'star',
    stage: 'Stage 2 · 오리온의 허리와 대성운 복합체',
    constellation: 'Ori',
    objectType: '적색 초거성',
    mag: 0.45,
    ra: 88.7929,
    dec: 7.4071,
    guideNote: '겨울철 대삼각형의 첫 번째 꼭짓점. 리겔과의 강렬한 적색-청백색 온도 대비 확인',
    observed: false,
  },
  // Stage 3
  {
    id: 'wh-cp10',
    code: 'CP 10',
    name: '시리우스 (Sirius / α CMa)',
    catalogId: 'HIP 32349',
    kind: 'star',
    stage: 'Stage 3 · 은하수 남단과 대삼각형 완성',
    constellation: 'CMa',
    objectType: '주계열성',
    mag: -1.44,
    ra: 101.2872,
    dec: -16.7161,
    guideNote: '겨울철 대삼각형 두 번째 꼭짓점. 밤하늘 최고 밝기 별의 대기의 빛깔 산란 관찰',
    observed: false,
  },
  {
    id: 'wh-cp11',
    code: 'CP 11',
    name: '작은 벌집 성단 (M41)',
    catalogId: 'M41',
    kind: 'dso',
    stage: 'Stage 3 · 은하수 남단과 대삼각형 완성',
    constellation: 'CMa',
    objectType: '산개성단',
    mag: 4.5,
    ra: 101.4998,
    dec: -20.7542,
    guideNote: '시리우스에서 정남쪽으로 약 4° 아래. 파인더 한 시야 안에서 붉은 중심별과 100여 개 별무리 확인',
    observed: false,
  },
  {
    id: 'wh-cp12',
    code: 'CP 12',
    name: '프로키온 (Procyon / α CMi)',
    catalogId: 'HIP 37279',
    kind: 'star',
    stage: 'Stage 3 · 은하수 남단과 대삼각형 완성',
    constellation: 'CMi',
    objectType: '주계열성',
    mag: 0.4,
    ra: 114.8255,
    dec: 5.225,
    guideNote: '겨울철 대삼각형 마지막 꼭짓점. 베텔게우스-시리우스-프로키온의 정삼각형 완성',
    observed: false,
  },
  // Stage 4
  {
    id: 'wh-cp13',
    code: 'CP 13',
    name: '쌍둥이자리 성단 (M35 & NGC 2158)',
    catalogId: 'M35',
    kind: 'dso',
    stage: 'Stage 4 · 천정 은하수 산개성단 벨트',
    constellation: 'Gem',
    objectType: '산개성단',
    mag: 5.1,
    ra: 92.2711,
    dec: 24.3386,
    guideNote: '쌍둥이 발끝 η Gem(프로푸스) 북서쪽 2.2°. 대구경으로 바로 옆 밀집 성단 NGC 2158 동시 포착',
    observed: false,
  },
  {
    id: 'wh-cp14',
    code: 'CP 14',
    name: '카스토르 & 폴룩스',
    catalogId: 'HIP 37826',
    kind: 'star',
    stage: 'Stage 4 · 천정 은하수 산개성단 벨트',
    constellation: 'Gem',
    objectType: '다중성 · 거성',
    mag: 1.16,
    ra: 116.329,
    dec: 28.0262,
    guideNote: '겨울철 육각형 북동쪽 꼭짓점. 카스토르의 고배율 쌍성 분리 확인',
    observed: false,
  },
  {
    id: 'wh-cp15',
    code: 'CP 15',
    name: '마차부자리 3연성단 (M37 · M36 · M38)',
    catalogId: 'M37',
    kind: 'dso',
    stage: 'Stage 4 · 천정 은하수 산개성단 벨트',
    constellation: 'Aur',
    objectType: '산개성단',
    mag: 5.6,
    ra: 88.0765,
    dec: 32.553,
    guideNote: '겨울철 은하수를 가로지르는 보석 벨트. 가장 촘촘한 M37에서 시작해 M36 → M38 순서로 북서진 호핑',
    observed: false,
  },
  {
    id: 'wh-cp16',
    code: 'CP 16',
    name: '카펠라 (Capella / α Aur)',
    catalogId: 'HIP 24608',
    kind: 'star',
    stage: 'Stage 4 · 천정 은하수 산개성단 벨트',
    constellation: 'Aur',
    objectType: '황색 거성',
    mag: 0.08,
    ra: 79.1723,
    dec: 45.998,
    guideNote: '천정 부근의 겨울철 육각형 최북단 꼭짓점. M45와 연결하며 겨울철 대육각형(Winter Hexagon) 폐합 완주',
    observed: false,
  },
];

function createSummerNebulaTour(): ChallengeTrack {
  const specs: { id: string; note: string }[] = [
    { id: 'M57', note: '거문고자리 베가 남쪽의 대표적인 고리 행성상 성운' },
    { id: 'M27', note: '여우자리 아령 성운 — 쌍안경에서도 또렷한 대형 행성상 성운' },
    { id: 'M11', note: '방패자리 야생오리 성단 — 은하수 구름 속 촘촘한 산개성단' },
    { id: 'M16', note: '뱀자리 독수리 성운 — 창조의 기둥을 품은 발광성운과 성단' },
    { id: 'M17', note: '궁수자리 오메가(백조) 성운 — UHC 필터로 환상적인 고니 실루엣' },
    { id: 'M20', note: '궁수자리 삼렬 성운 — 발광성운과 푸른 반사성운의 대비' },
    { id: 'M8', note: '궁수자리 석호 성운 — 여름철 은하수 중심부의 거대한 발광성운' },
    { id: 'M22', note: '궁수자리 대표 구상성단 — 북반구에서 가장 웅장한 구상성단 중 하나' },
  ];
  const checkpoints: ChallengeCheckpoint[] = specs.map((sp, i) => ({
    id: `sum-${sp.id.toLowerCase()}`,
    code: `S${String(i + 1).padStart(2, '0')}`,
    name: sp.id,
    catalogId: sp.id,
    kind: 'dso',
    stage: i < 4 ? '1구간 · 백조~방패 여름 은하수' : '2구간 · 궁수자리 은하 중심 성운대',
    guideNote: sp.note,
    observed: false,
  }));

  return {
    id: 'summer-milkyway-nebula-tour',
    title: '여름철 은하수 성운 투어',
    subtitle: '여름 은하수 핵심 성운·성단 8역 노선',
    description: '거문고자리 고리 성운부터 궁수자리 석호·삼렬 성운까지 여름철 은하수 중심부를 남하하는 성운 투어 노선입니다.',
    season: 'summer',
    lineColor: '#34D399',
    completedColor: '#FBBF24',
    activeOnChart: false,
    builtIn: true,
    badges: [
      {
        id: 'sum-master',
        title: '여름 은하수 성운 정복자',
        description: '여름철 은하수 성운 투어 8개 천체 전원 관측 완료',
        requiredCheckpointIds: [],
        isMaster: true,
      },
    ],
    checkpoints,
    createdAt: 1700000003000,
  };
}

function createSpringGalaxyTour(): ChallengeTrack {
  const specs: { id: string; note: string }[] = [
    { id: 'M81', note: '큰곰자리 보데 은하 — M82와 한 시야에 담기는 밝은 나선은하' },
    { id: 'M82', note: '시가 은하 — 격렬한 별 생성이 일어나는 엣지온 은하' },
    { id: 'M51', note: '사냥개자리 소용돌이 은하 — 동반은하 NGC 5195와 나선팔 구조' },
    { id: 'M101', note: '큰곰자리 바람개비 은하 — 어두운 하늘에서 빛나는 거대 정면 나선은하' },
    { id: 'M65', note: '사자자리 삼중 은하의 서쪽 구성원' },
    { id: 'M66', note: '사자자리 삼중 은하 중 가장 밝은 나선은하' },
    { id: 'M64', note: '머리털자리 검은눈 은하 — 핵 앞의 짙은 암흑먼지 띠' },
    { id: 'M104', note: '처녀자리 솜브레로 은하 — 선명한 적도 먼지 띠와 거대 헤일로' },
  ];
  const checkpoints: ChallengeCheckpoint[] = specs.map((sp, i) => ({
    id: `spr-${sp.id.toLowerCase()}`,
    code: `G${String(i + 1).padStart(2, '0')}`,
    name: sp.id,
    catalogId: sp.id,
    kind: 'dso',
    stage: i < 4 ? '1구간 · 북쪽 큰곰·사냥개 은하벨트' : '2구간 · 사자~처녀 은하 회랑',
    guideNote: sp.note,
    observed: false,
  }));

  return {
    id: 'spring-galaxy-tour',
    title: '봄철 은하 투어',
    subtitle: '큰곰~사자~처녀자리 대표 은하 8역 노선',
    description: '북쪽 하늘의 M81·M82, M51에서 출발해 사자자리 삼중 은하와 솜브레로 은하까지 잇는 봄철 은하 탐사 노선입니다.',
    season: 'spring',
    lineColor: '#A78BFA',
    completedColor: '#FBBF24',
    activeOnChart: false,
    builtIn: true,
    badges: [
      {
        id: 'spr-master',
        title: '봄철 은하 항해사',
        description: '봄철 은하 투어 8개 대표 은하 전원 관측 완료',
        requiredCheckpointIds: [],
        isMaster: true,
      },
    ],
    checkpoints,
    createdAt: 1700000004000,
  };
}

export function createDefaultChallengeTracks(): ChallengeTrack[] {
  const marathonCheckpoints = buildMessierMarathonCheckpoints();
  const stageIds = (stagePrefix: string) =>
    marathonCheckpoints
      .filter((c) => c.stage.startsWith(stagePrefix))
      .map((c) => c.id);

  const winterTrack: ChallengeTrack = {
    id: 'winter-hexagon-orion-spur',
    title: '겨울철 대삼각형 & 오리온팔 원정대',
    subtitle: 'Winter Hexagon & Orion Spur · 4 Stage 16 CP',
    description:
      '서쪽 황소자리(M45)에서 출발해 오리온 대성운 복합체, 큰개·작은개 대삼각형을 거쳐 쌍둥이·마차부자리 천정 산개성단 벨트까지 겨울철 대육각형을 완주하는 16개 체크포인트 원정 트랙입니다.',
    season: 'winter',
    lineColor: '#38BDF8',
    completedColor: '#FBBF24',
    activeOnChart: false,
    builtIn: true,
    guidePolygons: [
      {
        id: 'winter-hexagon-base',
        label: '겨울철 대육각형',
        closed: true,
        color: '#93C5FD',
        points: [
          { name: '알데바란', ra: 68.9802, dec: 16.5093 },
          { name: '리겔', ra: 78.6345, dec: -8.2016 },
          { name: '시리우스', ra: 101.2872, dec: -16.7161 },
          { name: '프로키온', ra: 114.8255, dec: 5.225 },
          { name: '폴룩스', ra: 116.329, dec: 28.0262 },
          { name: '카펠라', ra: 79.1723, dec: 45.998 },
        ],
      },
      {
        id: 'winter-triangle-base',
        label: '겨울철 대삼각형',
        closed: true,
        color: '#BAE6FD',
        points: [
          { name: '베텔게우스', ra: 88.7929, dec: 7.4071 },
          { name: '시리우스', ra: 101.2872, dec: -16.7161 },
          { name: '프로키온', ra: 114.8255, dec: 5.225 },
        ],
      },
    ],
    badges: [
      {
        id: 'badge-orion-hunter',
        title: '오리온의 사냥꾼',
        description: 'CP 04 ~ CP 09 (오리온 대성운 복합체 구간) 완료',
        requiredCheckpointIds: ['wh-cp04', 'wh-cp05', 'wh-cp06', 'wh-cp07', 'wh-cp08', 'wh-cp09'],
      },
      {
        id: 'badge-winter-triangle',
        title: '대삼각형 정복자',
        description: 'CP 09(베텔게우스), CP 10(시리우스), CP 12(프로키온) 완료',
        requiredCheckpointIds: ['wh-cp09', 'wh-cp10', 'wh-cp12'],
      },
      {
        id: 'badge-orion-spur-master',
        title: '오리온팔 마스터 (Orion Spur Explorer)',
        description: 'CP 01 ~ CP 16 전원 완주 · 황금 트랙 완주 인증 성도 잠금 해제',
        requiredCheckpointIds: [],
        isMaster: true,
      },
    ],
    checkpoints: WINTER_HEXAGON_CHECKPOINTS.map((c) => ({ ...c })),
    createdAt: 1700000001000,
  };

  const messierMarathonTrack: ChallengeTrack = {
    id: 'messier-marathon-110',
    title: '메시에 마라톤 110 종주 코스',
    subtitle: 'Messier Marathon Track · 일몰~일출 110 천체',
    description:
      '3월 중순~4월 초 하룻밤 동안 서쪽 저고도의 M74에서 시작해 일출 직전의 M30까지 110개 메시에 천체 전부를 5개 구간으로 주파하는 천문 관측의 최종 보스 트랙입니다.',
    season: 'spring',
    lineColor: '#60A5FA',
    completedColor: '#FBBF24',
    activeOnChart: false,
    builtIn: true,
    badges: [
      {
        id: 'mm-stage1',
        title: '서쪽 저고도 탈출자',
        description: '1구간 (M74 ~ M103, 8개) 완료',
        requiredCheckpointIds: stageIds('1구간'),
      },
      {
        id: 'mm-stage2',
        title: '겨울 은하수 호퍼',
        description: '2구간 (M76 ~ M38, 12개) 완료',
        requiredCheckpointIds: stageIds('2구간'),
      },
      {
        id: 'mm-stage3',
        title: '봄철 은하단 돌파',
        description: '3구간 (M41 ~ M102, 25개) 완료',
        requiredCheckpointIds: stageIds('3구간'),
      },
      {
        id: 'mm-stage4',
        title: '처녀자리 미로 정복자',
        description: '4구간 (M53 ~ M83, 21개) 완료',
        requiredCheckpointIds: stageIds('4구간'),
      },
      {
        id: 'mm-master',
        title: '메시에 마라톤 110 완주자',
        description: '전체 110개 메시에 천체 전원 완주 · 황금 트랙 인증 성도 잠금 해제',
        requiredCheckpointIds: [],
        isMaster: true,
      },
    ],
    checkpoints: marathonCheckpoints,
    createdAt: 1700000002000,
  };

  return [
    messierMarathonTrack,
    winterTrack,
    createSummerNebulaTour(),
    createSpringGalaxyTour(),
  ];
}

/**
 * Hydrates built-in challenge checkpoints with coordinates, magnitudes, and localized names
 * once external DSO JSON catalogs finish loading from /public/data/*.json.
 */
export function hydrateChallengeTracksWithCatalog(
  tracks: ChallengeTrack[],
  dsosBright: DeepSkyObject[]
): ChallengeTrack[] {
  if (dsosBright.length === 0) return tracks;
  const dsoByNorm = new Map<string, DeepSkyObject>();
  for (const d of dsosBright) {
    dsoByNorm.set(d.id.replace(/\s+/g, '').toUpperCase(), d);
    if (d.altId) dsoByNorm.set(d.altId.replace(/\s+/g, '').toUpperCase(), d);
  }

  let anyChanged = false;
  const next = tracks.map((track) => {
    let trackChanged = false;
    const checkpoints = track.checkpoints.map((cp) => {
      if (cp.kind !== 'dso' || !cp.catalogId) return cp;
      const ref = dsoByNorm.get(cp.catalogId.replace(/\s+/g, '').toUpperCase());
      if (!ref) return cp;

      const richName =
        cp.name === cp.catalogId
          ? ref.koName
            ? `${cp.catalogId} ${ref.koName}`
            : ref.name
            ? `${cp.catalogId} (${ref.name})`
            : cp.name
          : cp.name;

      const needsUpdate =
        cp.ra === undefined ||
        cp.dec === undefined ||
        cp.mag === undefined ||
        !cp.constellation ||
        !cp.objectType ||
        richName !== cp.name;

      if (!needsUpdate) return cp;
      trackChanged = true;
      anyChanged = true;
      return {
        ...cp,
        name: richName,
        constellation: cp.constellation ?? ref.con,
        objectType: cp.objectType ?? ref.type,
        mag: cp.mag ?? ref.mag,
        ra: cp.ra ?? ref.ra,
        dec: cp.dec ?? ref.dec,
      };
    });
    return trackChanged ? { ...track, checkpoints } : track;
  });

  return anyChanged ? next : tracks;
}

