import { Constellation, ThemeMode } from '../types/astronomy';
import { DEG2RAD, ProjectionParams, projectStereographicRaw, RAD2DEG } from './astronomy';

type Vec3 = [number, number, number];

interface ArtContour {
  /** Normalized local tangent coordinates [u, v] in [-1, 1]; +u = East (left in North-up sky), +v = North */
  pts: [number, number][];
  closed?: boolean;
  fill?: boolean;
  stroke?: boolean;
  /** Relative line weight multiplier */
  weight?: number;
  /** Subtle interior engraving hatch lines */
  hatch?: boolean;
}

interface PreparedConstellationArt {
  abbr: string;
  centerVec: Vec3;
  eastVec: Vec3;
  northVec: Vec3;
  halfEastRad: number;
  halfNorthRad: number;
  boundRadiusRad: number;
  /** Exact closed IAU boundary polygons in [raDeg, decDeg][] extracted from constellation-boundaries.json */
  boundaryPolys: [number, number][][];
  /** Normalized fallback skeleton segments in [u1, v1, u2, v2] */
  skeletonNorm: [number, number, number, number][];
}

function toVec3(raDeg: number, decDeg: number): Vec3 {
  const a = raDeg * DEG2RAD;
  const d = decDeg * DEG2RAD;
  const cd = Math.cos(d);
  return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm3(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function vec3ToRaDec(v: Vec3): [number, number] {
  const ra = ((Math.atan2(v[1], v[0]) * RAD2DEG) + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, v[2]))) * RAD2DEG;
  return [ra, dec];
}

function makeTangentBasis(center: Vec3): { east: Vec3; north: Vec3 } {
  const pole: Vec3 = Math.abs(center[2]) < 0.96 ? [0, 0, 1] : [1, 0, 0];
  // East = increasing RA direction = pole × center
  const east = norm3(cross3(pole, center));
  // North = center × east
  const north = norm3(cross3(center, east));
  return { east, north };
}

function pointInPolygon2D(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Extract all 89 exact closed IAU constellation boundary polygons from the shared border polyline graph.
 */
function extractBoundaryFaces(boundaries: [number, number][][]): [number, number][][] {
  if (boundaries.length === 0) return [];

  const keyOf = (p: [number, number]) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
  const adj = new Map<string, number[]>();
  const chains: { from: string; to: string; pts: [number, number][] }[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const seg = boundaries[i];
    if (seg.length < 2) continue;
    const a = keyOf(seg[0]);
    const z = keyOf(seg[seg.length - 1]);
    const fId = chains.length;
    chains.push({ from: a, to: z, pts: seg });
    const rId = chains.length;
    chains.push({ from: z, to: a, pts: [...seg].reverse() });
    let listA = adj.get(a);
    if (!listA) {
      listA = [];
      adj.set(a, listA);
    }
    listA.push(fId);
    let listZ = adj.get(z);
    if (!listZ) {
      listZ = [];
      adj.set(z, listZ);
    }
    listZ.push(rId);
  }

  for (const list of adj.values()) {
    if (list.length <= 2) continue;
    const p0 = chains[list[0]].pts[0];
    const n = toVec3(p0[0], p0[1]);
    const { east: ex, north: ey } = makeTangentBasis(n);
    list.sort((idA, idB) => {
      const pA = chains[idA].pts[1];
      const pB = chains[idB].pts[1];
      const vA = toVec3(pA[0], pA[1]);
      const vB = toVec3(pB[0], pB[1]);
      const dA: Vec3 = [vA[0] - n[0], vA[1] - n[1], vA[2] - n[2]];
      const dB: Vec3 = [vB[0] - n[0], vB[1] - n[1], vB[2] - n[2]];
      return Math.atan2(dot3(dA, ey), dot3(dA, ex)) - Math.atan2(dot3(dB, ey), dot3(dB, ex));
    });
  }

  const visited = new Uint8Array(chains.length);
  const faces: [number, number][][] = [];

  for (let i = 0; i < chains.length; i++) {
    if (visited[i]) continue;
    let cur = i;
    const poly: [number, number][] = [];
    let guard = 0;
    while (!visited[cur] && guard < 240) {
      visited[cur] = 1;
      const ch = chains[cur];
      for (let k = 0; k < ch.pts.length - 1; k++) {
        poly.push(ch.pts[k]);
      }
      const rev = cur ^ 1;
      const out = adj.get(ch.to);
      if (!out || out.length === 0) break;
      const idx = out.indexOf(rev);
      if (idx < 0) break;
      cur = out[(idx - 1 + out.length) % out.length];
      guard++;
    }
    if (poly.length >= 3) {
      faces.push(poly);
    }
  }
  return faces;
}

interface FaceCacheEntry {
  poly: [number, number][];
  center: Vec3;
  east: Vec3;
  north: Vec3;
  maxCos: number;
  proj2D: [number, number][];
}

function pointInsideSphericalFace(pt: Vec3, face: FaceCacheEntry): boolean {
  const cosAng = dot3(pt, face.center);
  if (cosAng < face.maxCos - 0.03) return false;
  if (cosAng <= 0.05) return false;
  // Gnomonic tangent projection around face centroid
  const inv = 1 / cosAng;
  const px = dot3(pt, face.east) * inv;
  const py = dot3(pt, face.north) * inv;
  return pointInPolygon2D(px, py, face.proj2D);
}

/**
 * Handcrafted classical Urania's Mirror / Hevelius-style vector artwork for major & zodiacal constellations.
 * Coordinates are in local celestial tangent space (u: East +1 / West -1, v: North +1 / South -1).
 */
const CLASSICAL_ART_LIBRARY: Record<string, ArtContour[]> = {
  // Orion — Classical Hunter with raised club, lion-pelt shield, belt & striding legs
  Ori: [
    // Torso & tunic silhouette
    {
      pts: [
        [-0.32, 0.44],
        [0.02, 0.56],
        [0.34, 0.46],
        [0.24, 0.04],
        [0.36, -0.34],
        [0.08, -0.44],
        [-0.18, -0.38],
        [-0.22, 0.04],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Head & plumed helmet crest
    {
      pts: [
        [-0.12, 0.62],
        [-0.04, 0.78],
        [0.14, 0.76],
        [0.14, 0.6],
        [0.02, 0.56],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Raised right arm & club (NE)
    {
      pts: [
        [0.28, 0.46],
        [0.48, 0.74],
        [0.36, 0.96],
        [0.2, 0.92],
        [0.34, 0.68],
        [0.18, 0.5],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Lion-pelt shield sweeping West
    {
      pts: [
        [-0.32, 0.42],
        [-0.64, 0.62],
        [-0.86, 0.44],
        [-0.92, 0.12],
        [-0.82, -0.18],
        [-0.64, -0.06],
        [-0.62, 0.24],
        [-0.44, 0.34],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Belt sash & hanging sword
    {
      pts: [
        [-0.24, 0.03],
        [0.0, 0.0],
        [0.25, -0.02],
      ],
      stroke: true,
      weight: 1.5,
    },
    {
      pts: [
        [0.02, -0.02],
        [0.08, -0.28],
        [-0.02, -0.34],
      ],
      stroke: true,
      weight: 1.2,
    },
    // Striding legs (Rigel W, Saiph E)
    {
      pts: [
        [-0.16, -0.38],
        [-0.46, -0.78],
        [-0.58, -0.88],
        [-0.36, -0.88],
        [-0.06, -0.44],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    {
      pts: [
        [0.12, -0.42],
        [0.34, -0.84],
        [0.48, -0.86],
        [0.28, -0.4],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Ursa Major — Great Bear with iconic curved tail & striding paws
  UMa: [
    // Bear torso & shoulders
    {
      pts: [
        [-0.54, 0.14],
        [-0.36, 0.42],
        [0.06, 0.48],
        [0.34, 0.28],
        [0.28, -0.14],
        [-0.18, -0.22],
        [-0.56, -0.12],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Bear head & snout (W)
    {
      pts: [
        [-0.52, 0.18],
        [-0.74, 0.32],
        [-0.92, 0.2],
        [-0.86, 0.04],
        [-0.58, -0.04],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Iconic celestial-atlas long curved tail (E)
    {
      pts: [
        [0.3, 0.26],
        [0.62, 0.42],
        [0.92, 0.28],
        [0.94, 0.16],
        [0.62, 0.26],
        [0.32, 0.08],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Forelegs & hindlegs
    {
      pts: [
        [-0.48, -0.12],
        [-0.66, -0.58],
        [-0.5, -0.62],
        [-0.3, -0.2],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    {
      pts: [
        [-0.22, -0.2],
        [-0.26, -0.72],
        [-0.08, -0.72],
        [-0.04, -0.22],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    {
      pts: [
        [0.08, -0.18],
        [0.18, -0.74],
        [0.36, -0.7],
        [0.26, -0.12],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Ursa Minor — Little Bear reaching toward Polaris
  UMi: [
    {
      pts: [
        [-0.58, -0.18],
        [-0.44, 0.18],
        [-0.04, 0.28],
        [0.24, 0.12],
        [0.14, -0.26],
        [-0.34, -0.34],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    {
      pts: [
        [0.2, 0.14],
        [0.54, 0.36],
        [0.86, 0.64],
        [0.88, 0.5],
        [0.54, 0.2],
        [0.22, -0.02],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    {
      pts: [
        [-0.48, -0.24],
        [-0.76, -0.12],
        [-0.78, -0.32],
        [-0.46, -0.38],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Cassiopeia — Queen seated on her royal throne
  Cas: [
    // Ornate throne frame
    {
      pts: [
        [-0.74, -0.58],
        [-0.68, 0.56],
        [-0.42, 0.68],
        [-0.38, 0.06],
        [0.34, 0.06],
        [0.44, -0.56],
      ],
      stroke: true,
      weight: 1.35,
    },
    // Seated robed Queen silhouette
    {
      pts: [
        [-0.46, 0.1],
        [-0.32, 0.44],
        [0.02, 0.42],
        [0.28, 0.06],
        [0.64, -0.28],
        [0.44, -0.54],
        [-0.06, -0.38],
        [-0.48, -0.44],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Royal crown & halo
    {
      pts: [
        [-0.3, 0.48],
        [-0.24, 0.66],
        [-0.12, 0.56],
        [-0.02, 0.68],
        [0.06, 0.48],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Cygnus — Soaring Swan with sweeping feathered wings
  Cyg: [
    // Swan body, long neck & head (SW)
    {
      pts: [
        [0.52, 0.48],
        [0.2, 0.24],
        [-0.16, -0.06],
        [-0.58, -0.42],
        [-0.84, -0.68],
        [-0.74, -0.76],
        [-0.46, -0.5],
        [-0.04, -0.22],
        [0.36, 0.14],
        [0.66, 0.34],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Upper-left wing (NW)
    {
      pts: [
        [0.14, 0.16],
        [-0.08, 0.54],
        [-0.48, 0.86],
        [-0.68, 0.72],
        [-0.5, 0.4],
        [-0.24, 0.18],
        [-0.04, 0.02],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Lower-right wing (SE)
    {
      pts: [
        [0.18, 0.02],
        [0.54, -0.18],
        [0.86, -0.54],
        [0.72, -0.74],
        [0.38, -0.52],
        [0.14, -0.26],
        [-0.04, -0.14],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Scorpius — Great Scorpion with claws & curled stinger tail
  Sco: [
    // Armored body & curved segmented tail
    {
      pts: [
        [-0.36, 0.42],
        [-0.06, 0.3],
        [0.18, 0.02],
        [0.22, -0.34],
        [0.44, -0.62],
        [0.76, -0.54],
        [0.82, -0.26],
        [0.66, -0.18],
        [0.62, -0.42],
        [0.42, -0.46],
        [0.34, -0.22],
        [0.32, 0.12],
        [0.06, 0.46],
        [-0.28, 0.54],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Upper pincer claw (NW)
    {
      pts: [
        [-0.32, 0.52],
        [-0.68, 0.78],
        [-0.86, 0.68],
        [-0.72, 0.56],
        [-0.46, 0.44],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Lower pincer claw (W)
    {
      pts: [
        [-0.36, 0.4],
        [-0.76, 0.46],
        [-0.88, 0.28],
        [-0.7, 0.24],
        [-0.42, 0.28],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Leo — Crouching Nemean Lion with flowing Sickle mane
  Leo: [
    // Lion body & hindquarters
    {
      pts: [
        [-0.32, 0.26],
        [0.08, 0.3],
        [0.48, 0.24],
        [0.72, -0.04],
        [0.46, -0.34],
        [-0.12, -0.26],
        [-0.42, -0.22],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Flowing Sickle mane & proud head (W)
    {
      pts: [
        [-0.34, 0.26],
        [-0.56, 0.64],
        [-0.82, 0.58],
        [-0.9, 0.32],
        [-0.74, 0.08],
        [-0.44, -0.12],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Forepaws & tufted tail (Denebola)
    {
      pts: [
        [-0.42, -0.18],
        [-0.74, -0.44],
        [-0.58, -0.54],
        [-0.26, -0.26],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    {
      pts: [
        [0.68, 0.0],
        [0.9, 0.16],
        [0.92, 0.32],
        [0.78, 0.28],
      ],
      stroke: true,
      weight: 1.4,
    },
  ],

  // Taurus — Charging Bull forequarters & sweeping horns
  Tau: [
    // Massive bull head & neck
    {
      pts: [
        [-0.76, -0.18],
        [-0.44, 0.28],
        [0.02, 0.36],
        [0.24, 0.1],
        [0.14, -0.32],
        [-0.34, -0.42],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Sweeping upper horn (Elnath)
    {
      pts: [
        [-0.08, 0.32],
        [0.36, 0.62],
        [0.86, 0.74],
        [0.44, 0.44],
        [0.08, 0.22],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Sweeping lower horn (ζ Tau)
    {
      pts: [
        [0.14, 0.14],
        [0.54, 0.28],
        [0.9, 0.22],
        [0.52, 0.12],
        [0.2, 0.02],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Forelegs
    {
      pts: [
        [-0.22, -0.36],
        [-0.46, -0.78],
        [-0.28, -0.78],
        [-0.04, -0.36],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Gemini — Twin classical figures Castor & Pollux
  Gem: [
    // Left twin (Pollux)
    {
      pts: [
        [-0.48, 0.56],
        [-0.2, 0.58],
        [-0.14, -0.58],
        [-0.56, -0.62],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Right twin (Castor)
    {
      pts: [
        [0.14, 0.64],
        [0.46, 0.6],
        [0.56, -0.56],
        [0.12, -0.58],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Twin heads & linked arms
    {
      pts: [
        [-0.44, 0.66],
        [-0.34, 0.82],
        [-0.22, 0.66],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    {
      pts: [
        [0.2, 0.72],
        [0.32, 0.88],
        [0.42, 0.72],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    {
      pts: [
        [-0.22, 0.24],
        [0.2, 0.28],
      ],
      stroke: true,
      weight: 1.5,
    },
  ],

  // Aquila — Soaring Eagle with spread pinions
  Aql: [
    {
      pts: [
        [0.0, 0.56],
        [0.22, 0.24],
        [0.82, 0.34],
        [0.64, -0.14],
        [0.24, -0.18],
        [0.16, -0.66],
        [-0.16, -0.64],
        [-0.22, -0.16],
        [-0.78, -0.28],
        [-0.86, 0.16],
        [-0.24, 0.24],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Lyra — Classical Ornate Harp
  Lyr: [
    // Soundbox base
    {
      pts: [
        [-0.46, -0.24],
        [0.46, -0.24],
        [0.38, -0.74],
        [-0.38, -0.74],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Twin curved arms & top yoke
    {
      pts: [
        [-0.38, -0.24],
        [-0.64, 0.36],
        [-0.44, 0.78],
        [0.44, 0.78],
        [0.64, 0.36],
        [0.38, -0.24],
      ],
      stroke: true,
      weight: 1.5,
    },
    // Harp strings
    { pts: [[-0.22, 0.74], [-0.22, -0.24]], stroke: true, weight: 0.75 },
    { pts: [[0.0, 0.74], [0.0, -0.24]], stroke: true, weight: 0.75 },
    { pts: [[0.22, 0.74], [0.22, -0.24]], stroke: true, weight: 0.75 },
  ],

  // Pegasus — Winged Horse (Great Square torso + sweeping wing + arched neck)
  Peg: [
    // Horse torso
    {
      pts: [
        [-0.42, 0.38],
        [0.36, 0.4],
        [0.38, -0.26],
        [-0.42, -0.28],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Sweeping wing
    {
      pts: [
        [0.06, 0.38],
        [0.48, 0.84],
        [0.86, 0.64],
        [0.64, 0.2],
        [0.36, 0.1],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Arched equine neck & head (W)
    {
      pts: [
        [-0.42, 0.16],
        [-0.78, 0.04],
        [-0.92, -0.26],
        [-0.76, -0.34],
        [-0.58, -0.14],
        [-0.4, -0.18],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Raised forelegs (NW)
    {
      pts: [
        [-0.36, 0.38],
        [-0.74, 0.66],
        [-0.56, 0.78],
        [-0.18, 0.4],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Andromeda — Classical Draped Princess with outstretched arms
  And: [
    {
      pts: [
        [-0.72, -0.28],
        [-0.24, 0.14],
        [0.36, 0.44],
        [0.78, 0.56],
        [0.66, 0.24],
        [0.18, -0.06],
        [-0.44, -0.48],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Outstretched arms & chain arcs
    {
      pts: [
        [-0.28, 0.18],
        [-0.54, 0.64],
        [-0.74, 0.72],
      ],
      stroke: true,
      weight: 1.3,
    },
    {
      pts: [
        [-0.1, -0.06],
        [0.14, -0.58],
        [0.34, -0.72],
      ],
      stroke: true,
      weight: 1.3,
    },
  ],

  // Perseus — Hero holding curved blade & shield
  Per: [
    {
      pts: [
        [-0.16, 0.64],
        [0.24, 0.54],
        [0.32, -0.14],
        [0.54, -0.74],
        [0.24, -0.74],
        [0.02, -0.22],
        [-0.28, -0.68],
        [-0.5, -0.58],
        [-0.26, -0.04],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Raised curved sword (N)
    {
      pts: [
        [0.22, 0.54],
        [0.54, 0.86],
        [0.72, 0.78],
        [0.44, 0.48],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Gorgon shield (W / Algol)
    {
      pts: [
        [-0.24, 0.32],
        [-0.68, 0.4],
        [-0.76, 0.08],
        [-0.44, -0.04],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Canis Major — Leaping Great Hound
  CMa: [
    {
      pts: [
        [-0.54, 0.42],
        [-0.18, 0.44],
        [0.36, 0.04],
        [0.54, -0.44],
        [0.24, -0.52],
        [-0.08, -0.18],
        [-0.48, 0.06],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Hound head & ears (NW)
    {
      pts: [
        [-0.46, 0.42],
        [-0.78, 0.62],
        [-0.86, 0.44],
        [-0.64, 0.24],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Tail & hind paw
    {
      pts: [
        [0.48, -0.28],
        [0.84, -0.46],
        [0.74, -0.62],
        [0.4, -0.44],
      ],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Sagittarius — Centaur Archer with drawn bow & arrow
  Sgr: [
    // Drawn bow arc (W)
    {
      pts: [
        [-0.24, 0.72],
        [-0.68, 0.44],
        [-0.8, 0.0],
        [-0.64, -0.48],
        [-0.22, -0.68],
      ],
      stroke: true,
      weight: 1.6,
    },
    // Bowstring & arrow aiming West
    {
      pts: [
        [-0.24, 0.72],
        [0.14, 0.04],
        [-0.22, -0.68],
      ],
      stroke: true,
      weight: 0.9,
    },
    {
      pts: [
        [0.28, 0.06],
        [-0.92, 0.04],
      ],
      stroke: true,
      weight: 1.5,
    },
    // Archer torso & flowing cape (E)
    {
      pts: [
        [-0.04, 0.44],
        [0.48, 0.56],
        [0.78, 0.24],
        [0.64, -0.48],
        [0.08, -0.44],
        [0.06, 0.04],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Virgo — Winged Classical Maiden with wheat sprig
  Vir: [
    // Draped figure
    {
      pts: [
        [-0.78, 0.34],
        [-0.24, 0.44],
        [0.34, 0.16],
        [0.84, -0.26],
        [0.68, -0.54],
        [0.08, -0.24],
        [-0.58, -0.1],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Sweeping classical wing
    {
      pts: [
        [-0.26, 0.4],
        [0.06, 0.84],
        [0.48, 0.68],
        [0.24, 0.24],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Aries — Golden Ram with curled horn
  Ari: [
    {
      pts: [
        [-0.64, 0.24],
        [-0.14, 0.44],
        [0.54, 0.26],
        [0.68, -0.18],
        [0.18, -0.34],
        [-0.44, -0.24],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Curled ram horn
    {
      pts: [
        [-0.48, 0.34],
        [-0.78, 0.52],
        [-0.86, 0.26],
        [-0.68, 0.08],
        [-0.56, 0.22],
      ],
      stroke: true,
      weight: 1.5,
    },
  ],

  // Cancer — Celestial Crab
  Cnc: [
    {
      pts: [
        [-0.46, 0.18],
        [0.0, 0.44],
        [0.46, 0.18],
        [0.38, -0.34],
        [-0.38, -0.34],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Twin pincers
    { pts: [[-0.32, 0.34], [-0.66, 0.72], [-0.46, 0.8]], stroke: true, weight: 1.4 },
    { pts: [[0.32, 0.34], [0.66, 0.72], [0.46, 0.8]], stroke: true, weight: 1.4 },
    // Legs
    { pts: [[-0.42, -0.06], [-0.82, -0.24]], stroke: true, weight: 1.1 },
    { pts: [[-0.38, -0.28], [-0.74, -0.64]], stroke: true, weight: 1.1 },
    { pts: [[0.42, -0.06], [0.82, -0.24]], stroke: true, weight: 1.1 },
    { pts: [[0.38, -0.28], [0.74, -0.64]], stroke: true, weight: 1.1 },
  ],

  // Libra — Classical Justice Balance Scales
  Lib: [
    // Central pillar & beam
    { pts: [[0, 0.68], [0, -0.68]], stroke: true, weight: 1.5 },
    { pts: [[-0.76, 0.34], [0.76, 0.34]], stroke: true, weight: 1.6 },
    // Left weighing pan
    {
      pts: [[-0.72, 0.34], [-0.88, -0.18], [-0.44, -0.18], [-0.6, 0.34]],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Right weighing pan
    {
      pts: [[0.6, 0.34], [0.44, -0.18], [0.88, -0.18], [0.72, 0.34]],
      closed: true,
      fill: true,
      stroke: true,
    },
    // Base pedestal
    {
      pts: [[-0.34, -0.68], [0.34, -0.68], [0.18, -0.48], [-0.18, -0.48]],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Capricornus — Sea-Goat with coiled fish tail
  Cap: [
    {
      pts: [
        [-0.76, 0.36],
        [-0.24, 0.24],
        [0.44, 0.38],
        [0.84, 0.14],
        [0.54, -0.42],
        [-0.08, -0.56],
        [-0.58, -0.2],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Sweeping horns (W) & forked fish fluke (E)
    { pts: [[-0.64, 0.34], [-0.84, 0.72], [-0.48, 0.62]], stroke: true, weight: 1.4 },
    {
      pts: [[0.78, 0.18], [0.96, 0.44], [0.86, 0.08], [0.96, -0.22], [0.72, -0.06]],
      closed: true,
      fill: true,
      stroke: true,
    },
  ],

  // Aquarius — Amphora Urn & Rippling Water Streams
  Aqr: [
    // Classical Amphora Urn
    {
      pts: [
        [-0.34, 0.62],
        [0.24, 0.64],
        [0.42, 0.34],
        [0.26, 0.04],
        [-0.24, 0.04],
        [-0.44, 0.32],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Flowing water waves southward
    {
      pts: [
        [-0.14, 0.04],
        [-0.42, -0.22],
        [-0.12, -0.48],
        [-0.46, -0.78],
      ],
      stroke: true,
      weight: 1.5,
    },
    {
      pts: [
        [0.14, 0.04],
        [-0.08, -0.24],
        [0.24, -0.52],
        [0.02, -0.82],
      ],
      stroke: true,
      weight: 1.5,
    },
  ],

  // Pisces — Twin Fishes linked by a ribbon cord
  Psc: [
    // Western Fish (Circlet)
    {
      pts: [
        [-0.84, -0.02],
        [-0.58, 0.24],
        [-0.32, 0.06],
        [-0.56, -0.22],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Northern Fish
    {
      pts: [
        [0.36, 0.82],
        [0.64, 0.64],
        [0.48, 0.36],
        [0.24, 0.56],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Undulating connecting ribbon (Alrescha knot)
    {
      pts: [
        [-0.34, -0.04],
        [0.06, -0.34],
        [0.54, -0.58],
        [0.48, -0.08],
        [0.42, 0.38],
      ],
      stroke: true,
      weight: 1.35,
    },
  ],

  // Auriga — Charioteer pentagon cloak & reins
  Aur: [
    {
      pts: [
        [-0.06, 0.78],
        [0.58, 0.42],
        [0.54, -0.34],
        [0.02, -0.76],
        [-0.58, -0.28],
        [-0.54, 0.46],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    {
      pts: [[-0.38, 0.44], [0.02, 0.14], [0.42, 0.38]],
      stroke: true,
      weight: 1.2,
    },
  ],

  // Boötes — Herdsman kite cloak & crook
  Boo: [
    {
      pts: [
        [0.02, 0.84],
        [0.54, 0.26],
        [0.24, -0.56],
        [0.0, -0.82],
        [-0.28, -0.54],
        [-0.54, 0.22],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Shepherd's staff/crook
    {
      pts: [[0.44, -0.58], [0.68, 0.68], [0.84, 0.78], [0.88, 0.56]],
      stroke: true,
      weight: 1.35,
    },
  ],

  // Draco — Coiling Celestial Dragon
  Dra: [
    {
      pts: [
        [-0.74, -0.44],
        [-0.44, -0.62],
        [0.12, -0.46],
        [0.56, -0.14],
        [0.36, 0.32],
        [-0.18, 0.46],
        [-0.64, 0.24],
        [-0.78, 0.56],
      ],
      stroke: true,
      weight: 2.2,
    },
    // Crested Dragon Head (Eltanin / Rastaban)
    {
      pts: [
        [0.52, -0.14],
        [0.84, -0.02],
        [0.88, -0.34],
        [0.58, -0.4],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Cepheus — Crowned King
  Cep: [
    {
      pts: [
        [0.0, 0.84],
        [0.56, 0.24],
        [0.48, -0.68],
        [-0.48, -0.68],
        [-0.56, 0.24],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    {
      pts: [[-0.46, 0.28], [0.0, 0.46], [0.46, 0.28]],
      stroke: true,
      weight: 1.3,
    },
  ],

  // Hercules — Kneeling Hero with Keystone torso
  Her: [
    {
      pts: [
        [-0.36, 0.34],
        [0.36, 0.38],
        [0.26, -0.28],
        [-0.28, -0.3],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    { pts: [[-0.34, 0.32], [-0.74, 0.68]], stroke: true, weight: 1.5 },
    { pts: [[0.34, 0.36], [0.76, 0.72]], stroke: true, weight: 1.5 },
    { pts: [[-0.26, -0.28], [-0.64, -0.78]], stroke: true, weight: 1.5 },
    { pts: [[0.24, -0.28], [0.68, -0.74]], stroke: true, weight: 1.5 },
  ],

  // Ophiuchus — Serpent Bearer
  Oph: [
    {
      pts: [
        [0.0, 0.82],
        [0.52, 0.26],
        [0.46, -0.58],
        [0.0, -0.76],
        [-0.48, -0.58],
        [-0.54, 0.24],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
    // Serpent held across waist
    {
      pts: [[-0.88, -0.14], [-0.36, -0.32], [0.32, -0.22], [0.88, -0.36]],
      stroke: true,
      weight: 1.8,
    },
  ],

  // Cetus — Classical Sea Monster
  Cet: [
    {
      pts: [
        [-0.78, -0.14],
        [-0.36, 0.32],
        [0.28, 0.22],
        [0.72, 0.52],
        [0.86, 0.24],
        [0.58, -0.14],
        [0.04, -0.44],
        [-0.56, -0.46],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Crux — Baroque Celestial Cross
  Cru: [
    {
      pts: [
        [-0.14, 0.84],
        [0.14, 0.84],
        [0.08, 0.14],
        [0.74, 0.22],
        [0.74, -0.06],
        [0.08, -0.02],
        [0.16, -0.84],
        [-0.16, -0.84],
        [-0.08, -0.02],
        [-0.74, -0.06],
        [-0.74, 0.22],
        [-0.08, 0.14],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Corona Borealis — Jeweled Diadem Crown
  CrB: [
    {
      pts: [
        [-0.78, 0.26],
        [-0.54, -0.34],
        [0.0, -0.56],
        [0.54, -0.34],
        [0.78, 0.26],
        [0.52, -0.02],
        [0.26, -0.22],
        [0.0, 0.08],
        [-0.26, -0.22],
        [-0.52, -0.02],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Delphinus — Leaping Dolphin
  Del: [
    {
      pts: [
        [-0.74, -0.38],
        [-0.28, 0.26],
        [0.34, 0.46],
        [0.78, 0.14],
        [0.44, -0.04],
        [-0.08, -0.14],
        [-0.56, -0.58],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Carina — Argo Ship Keel
  Car: [
    {
      pts: [
        [-0.84, 0.24],
        [-0.24, -0.18],
        [0.44, -0.22],
        [0.86, 0.18],
        [0.56, -0.58],
        [-0.48, -0.54],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Vela — Billowing Ship Sail
  Vel: [
    {
      pts: [
        [-0.64, 0.64],
        [0.62, 0.54],
        [0.82, -0.34],
        [-0.48, -0.56],
        [-0.36, 0.08],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],

  // Centaurus — Centaur
  Cen: [
    {
      pts: [
        [-0.54, 0.56],
        [0.08, 0.68],
        [0.42, 0.14],
        [0.76, -0.22],
        [0.52, -0.68],
        [-0.14, -0.42],
        [-0.68, -0.62],
        [-0.58, -0.04],
      ],
      closed: true,
      fill: true,
      stroke: true,
      hatch: true,
    },
  ],
};

const artCache = new WeakMap<Constellation[], Map<string, PreparedConstellationArt>>();

function getPreparedConstellationArts(
  constellations: Constellation[],
  boundaries: [number, number][][]
): PreparedConstellationArt[] {
  let cachedMap = artCache.get(constellations);
  if (cachedMap && cachedMap.size > 0) {
    return Array.from(cachedMap.values());
  }

  // 1. Extract exact closed IAU boundary faces & cache their tangent-plane projections
  const rawFaces = extractBoundaryFaces(boundaries);
  const faces: FaceCacheEntry[] = rawFaces.map((poly) => {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const vecs = poly.map(([ra, dec]) => {
      const v = toVec3(ra, dec);
      sx += v[0];
      sy += v[1];
      sz += v[2];
      return v;
    });
    const center = norm3([sx, sy, sz]);
    const { east, north } = makeTangentBasis(center);
    let maxCos = 1;
    const proj2D: [number, number][] = vecs.map((v) => {
      const c = dot3(v, center);
      if (c < maxCos) maxCos = c;
      const inv = 1 / Math.max(0.08, c);
      return [dot3(v, east) * inv, dot3(v, north) * inv];
    });
    return { poly, center, east, north, maxCos, proj2D };
  });

  // 2. Match each constellation to its exact IAU boundary polygon(s) & compute tangent art frame
  cachedMap = new Map<string, PreparedConstellationArt>();
  const usedFaceIdx = new Set<number>();

  for (const con of constellations) {
    const activeLines =
      con.traditionalLines && con.traditionalLines.length > 0 ? con.traditionalLines : con.lines;
    const verts: [number, number][] = [];
    for (const [r1, d1, r2, d2] of activeLines) {
      verts.push([r1, d1], [r2, d2]);
    }
    if (verts.length === 0) {
      verts.push([con.ra, con.dec]);
    }

    // Center of figure on unit sphere
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const vertVecs = verts.map(([ra, dec]) => {
      const v = toVec3(ra, dec);
      sx += v[0];
      sy += v[1];
      sz += v[2];
      return v;
    });
    const centerVec = norm3([sx, sy, sz]);
    const { east: eastVec, north: northVec } = makeTangentBasis(centerVec);

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const v of vertVecs) {
      const c = Math.max(0.15, dot3(v, centerVec));
      const u = dot3(v, eastVec) / c;
      const w = dot3(v, northVec) / c;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (w < minV) minV = w;
      if (w > maxV) maxV = w;
    }

    // Re-center tangent frame cleanly on midpoint of figure bounds
    const midU = (minU + maxU) / 2;
    const midV = (minV + maxV) / 2;
    const shiftedCenter = norm3([
      centerVec[0] + eastVec[0] * midU + northVec[0] * midV,
      centerVec[1] + eastVec[1] * midU + northVec[1] * midV,
      centerVec[2] + eastVec[2] * midU + northVec[2] * midV,
    ]);
    const basis = makeTangentBasis(shiftedCenter);

    const halfEastRad = Math.max(3.5 * DEG2RAD, Math.min(26 * DEG2RAD, ((maxU - minU) / 2) * 1.18));
    const halfNorthRad = Math.max(3.5 * DEG2RAD, Math.min(26 * DEG2RAD, ((maxV - minV) / 2) * 1.18));

    // Match boundary polygon(s) containing this constellation's label point or vertices
    const labelVec = toVec3(con.ra, con.dec);
    const matchedPolys: [number, number][][] = [];
    const faceVotes = new Map<number, number>();
    const testVecs = [labelVec, shiftedCenter, ...vertVecs.slice(0, 12)];

    for (let fi = 0; fi < faces.length; fi++) {
      let hits = 0;
      for (const tv of testVecs) {
        if (pointInsideSphericalFace(tv, faces[fi])) hits++;
      }
      if (hits > 0) faceVotes.set(fi, hits);
    }

    const sortedFaces = Array.from(faceVotes.entries()).sort((a, b) => b[1] - a[1]);
    const maxWanted = con.abbr === 'Ser' ? 2 : 1;
    for (const [fi] of sortedFaces) {
      if (matchedPolys.length >= maxWanted) break;
      if (usedFaceIdx.has(fi) && sortedFaces.length > 1) continue;
      usedFaceIdx.add(fi);
      matchedPolys.push(faces[fi].poly);
    }

    // Compute overall spherical bounding radius (covers boundary polygon or art box)
    let boundRadiusRad = Math.hypot(halfEastRad, halfNorthRad) * 1.35;
    for (const poly of matchedPolys) {
      for (let k = 0; k < poly.length; k += 2) {
        const pv = toVec3(poly[k][0], poly[k][1]);
        const ang = Math.acos(Math.max(-1, Math.min(1, dot3(pv, shiftedCenter))));
        if (ang > boundRadiusRad) boundRadiusRad = ang;
      }
    }

    // Normalized skeleton segments for fallback classical calligraphic ribbons
    const skeletonNorm: [number, number, number, number][] = activeLines.map(([r1, d1, r2, d2]) => {
      const v1 = toVec3(r1, d1);
      const v2 = toVec3(r2, d2);
      const c1 = Math.max(0.15, dot3(v1, shiftedCenter));
      const c2 = Math.max(0.15, dot3(v2, shiftedCenter));
      return [
        dot3(v1, basis.east) / c1 / halfEastRad,
        dot3(v1, basis.north) / c1 / halfNorthRad,
        dot3(v2, basis.east) / c2 / halfEastRad,
        dot3(v2, basis.north) / c2 / halfNorthRad,
      ];
    });

    cachedMap.set(con.abbr, {
      abbr: con.abbr,
      centerVec: shiftedCenter,
      eastVec: basis.east,
      northVec: basis.north,
      halfEastRad,
      halfNorthRad,
      boundRadiusRad: Math.min(Math.PI * 0.48, boundRadiusRad),
      boundaryPolys: matchedPolys,
      skeletonNorm,
    });
  }

  artCache.set(constellations, cachedMap);
  return Array.from(cachedMap.values());
}

/**
 * Trace a closed IAU boundary polygon onto the canvas path (returns true if cleanly projectable without horizon split).
 */
function traceProjectedBoundaryPolygon(
  ctx: CanvasRenderingContext2D,
  poly: [number, number][],
  proj: ProjectionParams,
  maxJumpPx: number
): boolean {
  if (poly.length < 3) return false;
  const screenPts: { x: number; y: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = projectStereographicRaw(poly[i][0], poly[i][1], proj);
    if (!p) return false;
    if (screenPts.length > 0) {
      const prev = screenPts[screenPts.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > maxJumpPx) return false;
    }
    screenPts.push(p);
  }
  const first = screenPts[0];
  const last = screenPts[screenPts.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > maxJumpPx) return false;

  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < screenPts.length; i++) {
    ctx.lineTo(screenPts[i].x, screenPts[i].y);
  }
  ctx.closePath();
  return true;
}

/**
 * Draw a smooth curved contour using midpoint quadratic splines for an organic engraved-atlas silhouette.
 */
function traceSmoothScreenPath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  closed: boolean
) {
  if (pts.length < 2) return;
  ctx.beginPath();
  if (pts.length === 2) {
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }
  if (closed) {
    const startX = (pts[pts.length - 1].x + pts[0].x) / 2;
    const startY = (pts[pts.length - 1].y + pts[0].y) / 2;
    ctx.moveTo(startX, startY);
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const next = pts[(i + 1) % pts.length];
      const midX = (cur.x + next.x) / 2;
      const midY = (cur.y + next.y) / 2;
      ctx.quadraticCurveTo(cur.x, cur.y, midX, midY);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
  }
}

/**
 * Independent Rendering Layer:
 * Softly projects classical celestial-atlas constellation illustrations inside each constellation's
 * exact IAU boundary polygon, aligned with stereographic sky coordinates & theme palette.
 */
export function renderClassicalConstellationArtLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fsz: number,
  theme: ThemeMode,
  opacity: number,
  constellations: Constellation[],
  constellationBoundaries: [number, number][][],
  proj: ProjectionParams
): void {
  if (constellations.length === 0 || opacity <= 0.01) return;

  // Gently fade out classical figures when deeply zoomed into narrow eyepiece/sensor framing
  const zoomFade = fsz < 6 ? 0 : fsz < 14 ? (fsz - 6) / 8 : 1;
  const masterAlpha = Math.max(0, Math.min(0.9, opacity)) * zoomFade;
  if (masterAlpha <= 0.008) return;

  const prepared = getPreparedConstellationArts(constellations, constellationBoundaries);
  const maxJumpPx = Math.max(width, height) * 1.15;

  // Theme-adapted antique celestial-atlas engraving colors
  const artColors =
    theme === 'white'
      ? {
          wash: 'rgba(138, 114, 76, 0.16)',
          innerBorder: 'rgba(107, 90, 62, 0.34)',
          fill: 'rgba(116, 98, 70, 0.24)',
          stroke: 'rgba(67, 79, 108, 0.72)',
          hatch: 'rgba(82, 92, 118, 0.32)',
          flourish: 'rgba(146, 104, 48, 0.52)',
        }
      : theme === 'red'
      ? {
          wash: 'rgba(145, 22, 22, 0.18)',
          innerBorder: 'rgba(195, 44, 44, 0.36)',
          fill: 'rgba(175, 34, 34, 0.26)',
          stroke: 'rgba(226, 74, 74, 0.72)',
          hatch: 'rgba(205, 52, 52, 0.34)',
          flourish: 'rgba(235, 88, 88, 0.5)',
        }
      : {
          wash: 'rgba(92, 134, 198, 0.15)',
          innerBorder: 'rgba(196, 168, 112, 0.32)',
          fill: 'rgba(142, 174, 224, 0.24)',
          stroke: 'rgba(218, 190, 130, 0.74)',
          hatch: 'rgba(186, 164, 122, 0.34)',
          flourish: 'rgba(232, 198, 124, 0.54)',
        };

  const projectLocalUv = (
    art: PreparedConstellationArt,
    u: number,
    v: number
  ): { x: number; y: number } | null => {
    const px =
      art.centerVec[0] +
      art.eastVec[0] * (u * art.halfEastRad) +
      art.northVec[0] * (v * art.halfNorthRad);
    const py =
      art.centerVec[1] +
      art.eastVec[1] * (u * art.halfEastRad) +
      art.northVec[1] * (v * art.halfNorthRad);
    const pz =
      art.centerVec[2] +
      art.eastVec[2] * (u * art.halfEastRad) +
      art.northVec[2] * (v * art.halfNorthRad);
    const len = Math.hypot(px, py, pz) || 1;
    const [raDeg, decDeg] = vec3ToRaDec([px / len, py / len, pz / len]);
    return projectStereographicRaw(raDeg, decDeg, proj);
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const art of prepared) {
    // Fast sphere/screen frustum cull
    const [cRa, cDec] = vec3ToRaDec(art.centerVec);
    const centerPt = projectStereographicRaw(cRa, cDec, proj);
    if (!centerPt) continue;
    const approxRadPx = 2 * proj.scale * Math.tan(art.boundRadiusRad / 2) + 80;
    if (
      centerPt.x + approxRadPx < 0 ||
      centerPt.x - approxRadPx > width ||
      centerPt.y + approxRadPx < 0 ||
      centerPt.y - approxRadPx > height
    ) {
      continue;
    }

    ctx.save();

    // 1. Clip strictly inside the constellation's exact IAU boundary polygon(s)
    let hasClip = false;
    if (art.boundaryPolys.length > 0) {
      ctx.beginPath();
      let polyCount = 0;
      for (const poly of art.boundaryPolys) {
        if (traceProjectedBoundaryPolygon(ctx, poly, proj, maxJumpPx)) {
          polyCount++;
        }
      }
      if (polyCount > 0) {
        ctx.clip();
        hasClip = true;

        // Subtle antique celestial-atlas territory tint & inner border glaze inside boundary
        ctx.globalAlpha = masterAlpha;
        ctx.fillStyle = artColors.wash;
        ctx.fill();

        ctx.strokeStyle = artColors.innerBorder;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    // 2. Render Classical Engraved Figure (handcrafted mythological art or calligraphic ribbon fallback)
    const customContours = CLASSICAL_ART_LIBRARY[art.abbr];
    const baseStrokeW = Math.max(0.85, Math.min(2.1, proj.scale / 360));

    if (customContours) {
      for (const contour of customContours) {
        const screenPts: { x: number; y: number }[] = [];
        let ok = true;
        for (const [u, v] of contour.pts) {
          const sp = projectLocalUv(art, u, v);
          if (!sp) {
            ok = false;
            break;
          }
          if (screenPts.length > 0) {
            const prev = screenPts[screenPts.length - 1];
            if (Math.hypot(sp.x - prev.x, sp.y - prev.y) > maxJumpPx) {
              ok = false;
              break;
            }
          }
          screenPts.push(sp);
        }
        if (!ok || screenPts.length < 2) continue;

        traceSmoothScreenPath(ctx, screenPts, Boolean(contour.closed));

        if (contour.fill) {
          ctx.globalAlpha = masterAlpha;
          ctx.fillStyle = artColors.fill;
          ctx.fill();
        }

        // Authentic copperplate engraving parallel rib hatching clipped to the silhouette
        if (contour.hatch && contour.closed && screenPts.length >= 3) {
          ctx.save();
          ctx.clip();
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          for (const sp of screenPts) {
            if (sp.x < minX) minX = sp.x;
            if (sp.x > maxX) maxX = sp.x;
            if (sp.y < minY) minY = sp.y;
            if (sp.y > maxY) maxY = sp.y;
          }
          const span = Math.max(maxX - minX, maxY - minY);
          const step = Math.max(6, Math.min(14, span / 14));
          if (span >= 18 && span < Math.max(width, height) * 1.6) {
            ctx.globalAlpha = masterAlpha * 0.85;
            ctx.strokeStyle = artColors.hatch;
            ctx.lineWidth = Math.max(0.55, baseStrokeW * 0.55);
            ctx.beginPath();
            for (let d = -span; d <= span * 1.4; d += step) {
              ctx.moveTo(minX + d, minY - 6);
              ctx.lineTo(minX + d - span * 0.65, maxY + 6);
            }
            ctx.stroke();
          }
          ctx.restore();
          // Re-trace outline path after clip restore
          traceSmoothScreenPath(ctx, screenPts, Boolean(contour.closed));
        }

        if (contour.stroke !== false) {
          ctx.globalAlpha = masterAlpha;
          ctx.strokeStyle = artColors.stroke;
          ctx.lineWidth = baseStrokeW * (contour.weight ?? 1.0);
          ctx.stroke();
        }
      }
    } else if (art.skeletonNorm.length > 0) {
      // Cohesive antique calligraphic engraving ribbon & baroque medallion for remaining constellations
      ctx.globalAlpha = masterAlpha;
      const ribbonW = Math.max(6, Math.min(26, (proj.scale * art.halfEastRad) * 0.24));

      // Soft translucent brush aura following the constellation figure
      ctx.strokeStyle = artColors.fill;
      ctx.lineWidth = ribbonW;
      ctx.beginPath();
      for (const [u1, v1, u2, v2] of art.skeletonNorm) {
        const p1 = projectLocalUv(art, u1, v1);
        const p2 = projectLocalUv(art, u2, v2);
        if (!p1 || !p2) continue;
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > maxJumpPx) continue;
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const bend = 0.08;
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(mx - dy * bend, my + dx * bend, p2.x, p2.y);
      }
      ctx.stroke();

      // Delicate twin antique engraved contours flanking the constellation figure
      ctx.strokeStyle = artColors.stroke;
      ctx.lineWidth = baseStrokeW * 0.85;
      ctx.beginPath();
      for (const [u1, v1, u2, v2] of art.skeletonNorm) {
        const p1 = projectLocalUv(art, u1, v1);
        const p2 = projectLocalUv(art, u2, v2);
        if (!p1 || !p2) continue;
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (segLen < 4 || segLen > maxJumpPx) continue;
        const nx = -(p2.y - p1.y) / segLen;
        const ny = (p2.x - p1.x) / segLen;
        const offset = Math.min(ribbonW * 0.44, segLen * 0.18);
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(mx + nx * offset, my + ny * offset, p2.x, p2.y);
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(mx - nx * offset, my - ny * offset, p2.x, p2.y);
      }
      ctx.stroke();
    }

    // 3. Subtle antique star-atlas rosette medallion at constellation figure center (if visible & medium/wide FOV)
    if (hasClip && fsz <= 135) {
      const rPx = Math.max(8, Math.min(28, (proj.scale * Math.min(art.halfEastRad, art.halfNorthRad)) * 0.22));
      if (rPx >= 10) {
        ctx.globalAlpha = masterAlpha * 0.6;
        ctx.strokeStyle = artColors.flourish;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(centerPt.x, centerPt.y, rPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  ctx.restore();
}
