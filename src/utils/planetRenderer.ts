import { SolarSystemBody, ThemeMode } from '../types/astronomy';
import { DEG2RAD, RAD2DEG } from './astronomy';

import sunMapUrl from '../assets/images/sun_surface_map_1795091328106.jpg';
import moonMapUrl from '../assets/images/moon_surface_clean_1795091351550.jpg';
import mercuryMapUrl from '../assets/images/mercury_surface_map_1795091328602.jpg';
import venusMapUrl from '../assets/images/venus_surface_map_1795091326581.jpg';
import marsMapUrl from '../assets/images/mars_surface_map_1795091328518.jpg';
import jupiterMapUrl from '../assets/images/jupiter_surface_map_1795091327728.jpg';
import saturnMapUrl from '../assets/images/saturn_surface_map_1795091329293.jpg';
import neptuneMapUrl from '../assets/images/neptune_surface_map_1795091329045.jpg';

type Vec3 = [number, number, number];

export interface PlanetPhysicalParams {
  /** Sub-Earth planetocentric latitude B (degrees, >0 north pole tilted toward Earth) */
  subEarthLatDeg: number;
  /** Position angle of the planet's north rotational pole East of celestial North (degrees) */
  northPolePaDeg: number;
  /** Central meridian longitude facing Earth (degrees, 0..360) */
  centralMeridianDeg: number;
  /** Illuminated fraction (0..1) */
  phaseFrac: number;
  /** True oblateness (flattening f = (Re - Rp) / Re) */
  flattening: number;
  /** Ring outer/inner radii in equatorial radii (if ringed) */
  hasRings: boolean;
  /** Ring opening angle (same as subEarthLatDeg for equatorial rings) */
  ringTiltDeg: number;
}

interface IauRotationDef {
  alpha0: number; // North pole RA J2000 (deg)
  delta0: number; // North pole Dec J2000 (deg)
  w0: number; // Prime meridian at J2000.0 (deg)
  wRate: number; // Sidereal rotation rate (deg/day)
  flattening: number;
  ringInner?: number;
  ringOuter?: number;
  ringStyle?: number; // 1 = Saturn, 2 = Uranus
  isEmissive?: boolean;
  tidalLockedToEarth?: boolean;
  earthshine?: number;
  uvVClamp?: [number, number];
}

// Official IAU WGCCRE rotational pole & prime-meridian constants
const BODY_IAU_DEFS: Record<string, IauRotationDef> = {
  Sun: {
    alpha0: 286.13,
    delta0: 63.87,
    w0: 84.176,
    wRate: 14.1844,
    flattening: 0.0,
    isEmissive: true,
  },
  Moon: {
    alpha0: 270.0,
    delta0: 66.54,
    w0: 0,
    wRate: 0,
    flattening: 0.0012,
    tidalLockedToEarth: true,
    earthshine: 0.055,
    uvVClamp: [0.02, 0.94],
  },
  Mercury: {
    alpha0: 281.01,
    delta0: 61.45,
    w0: 329.5469,
    wRate: 6.1385025,
    flattening: 0.0,
    earthshine: 0.015,
  },
  Venus: {
    alpha0: 272.76,
    delta0: 67.16,
    w0: 160.2,
    wRate: -1.4813688,
    flattening: 0.0,
    earthshine: 0.02,
  },
  Mars: {
    alpha0: 317.68143,
    delta0: 52.8865,
    w0: 176.63,
    wRate: 350.89198226,
    flattening: 0.00589,
    earthshine: 0.02,
  },
  Jupiter: {
    alpha0: 268.056595,
    delta0: 64.495303,
    w0: 284.95,
    wRate: 870.536, // System II cloud-band rotation
    flattening: 0.06487,
    earthshine: 0.03,
  },
  Saturn: {
    alpha0: 40.589,
    delta0: 83.537,
    w0: 38.9,
    wRate: 810.7939024,
    flattening: 0.09796,
    ringInner: 1.24,
    ringOuter: 2.33,
    ringStyle: 1,
    earthshine: 0.03,
  },
  Uranus: {
    alpha0: 257.311,
    delta0: -15.175,
    w0: 203.81,
    wRate: -501.1600928,
    flattening: 0.0229,
    ringInner: 1.62,
    ringOuter: 2.02,
    ringStyle: 2,
    earthshine: 0.025,
  },
  Neptune: {
    alpha0: 299.36,
    delta0: 43.46,
    w0: 253.18,
    wRate: 536.3128492,
    flattening: 0.0171,
    earthshine: 0.025,
  },
};

const TEXTURE_URLS: Record<string, string> = {
  Sun: sunMapUrl,
  Moon: moonMapUrl,
  Mercury: mercuryMapUrl,
  Venus: venusMapUrl,
  Mars: marsMapUrl,
  Jupiter: jupiterMapUrl,
  Saturn: saturnMapUrl,
  Neptune: neptuneMapUrl,
};

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
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function raDecToVec(raDeg: number, decDeg: number): Vec3 {
  const a = raDeg * DEG2RAD;
  const d = decDeg * DEG2RAD;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

/**
 * Compute exact physical orientation (pole tilt B, position angle P, central meridian, 3D Sun direction)
 * for any major solar system body at a given timestamp.
 */
export function computePlanetOrientation(
  body: SolarSystemBody,
  sun: SolarSystemBody | undefined,
  timestampMs: number
): {
  phys: PlanetPhysicalParams;
  /** Sun light direction in the planet's sky-aligned camera frame:
   *  +x = planet equatorial East (right of north pole), +y = planet projected North, +z = toward Earth */
  lightInCam: Vec3;
  /** Spin-pole inclination toward Earth in radians (sub-Earth latitude B) */
  subEarthLatRad: number;
  /** Central meridian longitude in radians */
  centralMeridianRad: number;
} | null {
  const def = BODY_IAU_DEFS[body.id];
  if (!def) return null;

  const jd = timestampMs / 86400000 + 2440587.5;
  const dJ2000 = jd - 2451545.0;

  // Geocentric unit vector Earth -> Body
  const uBody = raDecToVec(body.ra, body.dec);
  // Unit vector Body -> Earth (camera direction)
  const vCam: Vec3 = [-uBody[0], -uBody[1], -uBody[2]];

  // Celestial North & East tangent basis on sky at body's (RA, Dec)
  const raRad = body.ra * DEG2RAD;
  const decRad = body.dec * DEG2RAD;
  const eNorthSky: Vec3 = [
    -Math.sin(decRad) * Math.cos(raRad),
    -Math.sin(decRad) * Math.sin(raRad),
    Math.cos(decRad),
  ];
  const eEastSky: Vec3 = [-Math.sin(raRad), Math.cos(raRad), 0];

  // IAU North rotational pole vector in equatorial J2000
  const pPole = raDecToVec(def.alpha0, def.delta0);

  // Sub-Earth planetocentric latitude B (rad): positive => north pole tilted toward Earth
  const sinB = Math.max(-1, Math.min(1, dot3(pPole, vCam)));
  const subEarthLatRad = Math.asin(sinB);

  // Project pole onto sky plane (perpendicular to vCam)
  const poleN = dot3(pPole, eNorthSky);
  const poleE = dot3(pPole, eEastSky);
  // Position angle P measured East from Celestial North
  const northPolePaRad = Math.atan2(poleE, poleN);

  // Build planet-aligned camera frame (xCam = right when north is up, yCam = projected north, zCam = toward Earth)
  // Note: On sky looking out, East is LEFT of North! So screen-right = West = -East when north is up.
  // Let's keep camera frame strictly right-handed:
  // yCam = projected north pole on sky plane
  // xCam = cross(yCam, vCam) -> points West-of-North (right on sky when North is up)
  let yCamRaw: Vec3 = [
    pPole[0] - sinB * vCam[0],
    pPole[1] - sinB * vCam[1],
    pPole[2] - sinB * vCam[2],
  ];
  if (Math.hypot(yCamRaw[0], yCamRaw[1], yCamRaw[2]) < 1e-5) {
    yCamRaw = eNorthSky;
  }
  const yCam = norm3(yCamRaw);
  const xCam = norm3(cross3(yCam, vCam));

  // Sun illumination unit vector Body -> Sun
  let lightVec: Vec3 = vCam;
  if (sun && body.id !== 'Sun') {
    const uSun = raDecToVec(sun.ra, sun.dec);
    const rSun = sun.distAu;
    const rBody = body.distAu;
    const dx = rSun * uSun[0] - rBody * uBody[0];
    const dy = rSun * uSun[1] - rBody * uBody[1];
    const dz = rSun * uSun[2] - rBody * uBody[2];
    lightVec = norm3([dx, dy, dz]);
  }

  const lightInCam: Vec3 = norm3([
    dot3(lightVec, xCam),
    dot3(lightVec, yCam),
    dot3(lightVec, vCam),
  ]);

  // Central meridian longitude facing Earth
  let centralMeridianDeg = 0;
  if (def.tidalLockedToEarth) {
    // Moon nearside (u = 0.5 in equirectangular map) faces Earth with subtle optical libration
    const librationLon = 5.2 * Math.sin((dJ2000 / 27.55455) * Math.PI * 2);
    centralMeridianDeg = librationLon;
  } else {
    // Node of planet equator on Earth's J2000 equator: Q = normalize(Z_eq x pPole)
    const nodeQ = norm3(cross3([0, 0, 1], pPole));
    const nodeR = norm3(cross3(pPole, nodeQ));
    const subEarthEqX = dot3(vCam, nodeQ);
    const subEarthEqY = dot3(vCam, nodeR);
    const lonFromNodeDeg = Math.atan2(subEarthEqY, subEarthEqX) * RAD2DEG;
    const W = def.w0 + def.wRate * dJ2000;
    centralMeridianDeg = (((W - lonFromNodeDeg) % 360) + 360) % 360;
  }

  const phaseFrac = Math.max(0, Math.min(1, (1 + dot3(lightVec, vCam)) * 0.5));

  return {
    phys: {
      subEarthLatDeg: subEarthLatRad * RAD2DEG,
      northPolePaDeg: ((northPolePaRad * RAD2DEG) % 360 + 360) % 360,
      centralMeridianDeg,
      phaseFrac,
      flattening: def.flattening,
      hasRings: Boolean(def.ringInner && def.ringOuter),
      ringTiltDeg: subEarthLatRad * RAD2DEG,
    },
    lightInCam,
    subEarthLatRad,
    centralMeridianRad: centralMeridianDeg * DEG2RAD,
  };
}

// ============================================================================
// Offscreen WebGL 1.0 Ray-Sphere + Analytical Ring-Plane Photorealistic Engine
// ============================================================================

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_tex;
uniform float u_canvasExtent;   // Half-extent of quad in equatorial radii (e.g. 1.12 or 2.55 for Saturn)
uniform float u_invOneMinusF;   // 1.0 / (1.0 - flattening) for oblate spheroid
uniform float u_sinB;           // sin(subEarthLat)
uniform float u_cosB;           // cos(subEarthLat)
uniform float u_lonOffset;      // Central meridian rotation in radians
uniform vec3  u_lightDir;       // Normalized Sun direction in planet-camera frame
uniform float u_isEmissive;     // 1.0 for Sun, 0.0 for illuminated bodies
uniform float u_earthshine;     // Ambient nightside glow (e.g. Moon earthshine)
uniform float u_ringInner;      // Inner ring radius in Re (0 if none)
uniform float u_ringOuter;      // Outer ring radius in Re
uniform float u_ringStyle;      // 1.0 Saturn, 2.0 Uranus
uniform float u_redMode;        // 1.0 for scotopic red night vision mode
uniform float u_whiteMode;      // 1.0 for light print theme
uniform vec2  u_vClamp;         // [vMin, vMax] texture latitude clamp

const float PI = 3.14159265359;

// Convert planet-camera point p=(x,y,z) to planet body frame where +Y_body is north spin pole
vec3 camToBody(vec3 p) {
  return vec3(
    p.x,
    p.y * u_cosB + p.z * u_sinB,
   -p.y * u_sinB + p.z * u_cosB
  );
}

// Analytical Saturn / Uranus ring albedo & optical opacity by radial distance r (in Re)
vec4 evalRing(float r) {
  if (u_ringStyle < 1.5) {
    // Saturn realistic multi-band ring profile (C, B, Cassini Division, A, Encke Gap, F)
    float alpha = 0.0;
    vec3 col = vec3(0.84, 0.77, 0.62);

    // C ring (Crepe ring): 1.24 .. 1.525
    if (r >= 1.24 && r < 1.525) {
      float t = (r - 1.24) / (1.525 - 1.24);
      alpha = mix(0.10, 0.28, smoothstep(0.0, 0.25, t)) * (0.9 + 0.1 * sin(r * 160.0));
      col = vec3(0.56, 0.50, 0.42);
    }
    // B ring (Brightest, densest): 1.525 .. 1.948
    else if (r >= 1.525 && r < 1.948) {
      float t = (r - 1.525) / (1.948 - 1.525);
      float ringlets = 0.90 + 0.10 * sin(r * 190.0) * cos(r * 73.0);
      alpha = mix(0.68, 0.96, sin(t * 2.4 + 0.35)) * ringlets;
      col = mix(vec3(0.84, 0.77, 0.61), vec3(0.95, 0.90, 0.77), smoothstep(0.15, 0.85, t)) * (0.94 + 0.06 * sin(r * 240.0));
    }
    // Cassini Division: 1.948 .. 2.025
    else if (r >= 1.948 && r < 2.025) {
      alpha = 0.04;
      col = vec3(0.32, 0.29, 0.24);
    }
    // A ring (with Encke Gap near 2.214): 2.025 .. 2.269
    else if (r >= 2.025 && r <= 2.269) {
      float t = (r - 2.025) / (2.269 - 2.025);
      float encke = 1.0 - 0.85 * exp(-pow((r - 2.214) / 0.0085, 2.0));
      float ringlets = 0.93 + 0.07 * sin(r * 210.0);
      alpha = mix(0.62, 0.48, t) * encke * ringlets;
      col = mix(vec3(0.79, 0.74, 0.63), vec3(0.73, 0.69, 0.60), t);
    }
    // Delicate outer F ring: 2.31 .. 2.33
    else if (r >= 2.305 && r <= 2.33) {
      float fPeak = exp(-pow((r - 2.318) / 0.006, 2.0));
      alpha = 0.26 * fPeak;
      col = vec3(0.82, 0.78, 0.68);
    }
    return vec4(col, clamp(alpha, 0.0, 0.98));
  } else {
    // Uranus delicate icy epsilon & main rings
    float eps = exp(-pow((r - 1.96) / 0.018, 2.0));
    float inner = exp(-pow((r - 1.74) / 0.035, 2.0)) * 0.45;
    float alpha = clamp((eps * 0.42 + inner * 0.22), 0.0, 0.5);
    return vec4(vec3(0.68, 0.86, 0.92), alpha);
  }
}

vec3 applyTheme(vec3 rgb) {
  if (u_redMode > 0.5) {
    float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
    return vec3(pow(lum, 0.92) * 0.95, 0.0, 0.0);
  }
  return rgb;
}

void main() {
  vec2 xy = v_uv * u_canvasExtent;
  float pxAA = max(0.012, u_canvasExtent / 140.0);

  // Oblate spheroid ray intersection along -z (orthographic camera looking along -z from +z)
  // Equation in body space: xb^2 + (yb * invOneMinusF)^2 + zb^2 = 1
  // With p_cam = (xy.x, xy.y, z):
  // yb(z) = xy.y * cosB + z * sinB
  // zb(z) = -xy.y * sinB + z * cosB
  float s = u_invOneMinusF;
  float s2 = s * s;
  float cB = u_cosB;
  float sB = u_sinB;

  float A = s2 * sB * sB + cB * cB;
  float B = 2.0 * xy.y * sB * cB * (s2 - 1.0);
  float C = xy.x * xy.x + xy.y * xy.y * (s2 * cB * cB + sB * sB) - 1.0;

  float disc = B * B - 4.0 * A * C;
  bool hitSphere = disc >= 0.0;
  float zSphere = -1e5;
  float sphereEdgeAlpha = 0.0;

  if (hitSphere) {
    zSphere = (-B + sqrt(max(0.0, disc))) / (2.0 * A);
    sphereEdgeAlpha = smoothstep(0.0, pxAA * 2.4, sqrt(max(0.0, disc)) / (2.0 * A));
  }

  vec3 sphereCol = vec3(0.0);
  if (hitSphere) {
    vec3 pCam = vec3(xy.x, xy.y, zSphere);
    vec3 pBody = camToBody(pCam);

    // Surface normal of oblate spheroid in body frame, then back to camera frame
    vec3 nBody = normalize(vec3(pBody.x, pBody.y * s2, pBody.z));
    vec3 nCam = normalize(vec3(
      nBody.x,
      nBody.y * cB - nBody.z * sB,
      nBody.y * sB + nBody.z * cB
    ));

    // Spherical texture coordinates (prograde rotation shifts central meridian West-to-East)
    float lat = asin(clamp(pBody.y * s, -1.0, 1.0));
    float lon = atan(pBody.x, pBody.z) - u_lonOffset;
    float u = fract(lon / (2.0 * PI) + 0.5);
    float v = 0.5 - lat / PI;
    v = clamp(v, u_vClamp.x, u_vClamp.y);

    vec3 albedo = texture2D(u_tex, vec2(u, v)).rgb;

    if (u_isEmissive > 0.5) {
      // Solar photosphere limb darkening (Eddington/solar-limb law) + subtle warm flare
      float mu = clamp(nCam.z, 0.0, 1.0);
      float limb = 0.38 + 0.62 * pow(mu, 0.55);
      vec3 limbTint = mix(vec3(1.0, 0.42, 0.08), vec3(1.06, 0.99, 0.88), pow(mu, 0.42));
      sphereCol = albedo * limb * limbTint * 1.18;
    } else {
      // Physically motivated planetary lighting (Oren-Nayar / Lommel-Seeliger-Lambert blend)
      float ndotl = dot(nCam, u_lightDir);
      float mu = clamp(nCam.z, 0.0, 1.0);
      float litSoft = smoothstep(-0.04, 0.08, ndotl);
      float diffuse = pow(max(0.0, ndotl), 0.78);
      // Realistic subtle spherical limb darkening
      float limbDark = mix(0.64, 1.05, pow(mu, 0.36));

      // Ring shadow cast onto Saturn's cloud deck
      float ringShadow = 1.0;
      if (u_ringInner > 0.5) {
        vec3 lBody = camToBody(u_lightDir);
        if (abs(lBody.y) > 0.004) {
          float tRing = -pBody.y / lBody.y;
          if (tRing > 0.0) {
            vec3 hitR = pBody + lBody * tRing;
            float rr = length(hitR.xz);
            if (rr >= u_ringInner && rr <= u_ringOuter) {
              vec4 rSample = evalRing(rr);
              ringShadow = 1.0 - rSample.a * 0.78;
            }
          }
        }
      }

      float illum = max(u_earthshine * (0.6 + 0.4 * mu), diffuse * litSoft * ringShadow * 1.12);
      sphereCol = albedo * illum * limbDark;

      // Subtle atmospheric forward limb rim on sunlit crescent side
      float rim = pow(1.0 - mu, 3.0) * max(0.0, ndotl) * 0.14;
      sphereCol += albedo * rim;
    }
  }

  // Analytical Ring Plane intersection (y_body = 0)
  // y_body = xy.y * cosB + z * sinB = 0 => zRing = -xy.y * cosB / sinB
  vec4 backRing = vec4(0.0);
  vec4 frontRing = vec4(0.0);

  if (u_ringInner > 0.5) {
    float absSinB = abs(sB);
    if (absSinB > 0.008) {
      float zRing = -xy.y * cB / sB;
      vec3 pRingCam = vec3(xy.x, xy.y, zRing);
      vec3 pRingBody = camToBody(pRingCam);
      float rRing = length(pRingBody.xz);

      if (rRing >= u_ringInner && rRing <= u_ringOuter) {
        vec4 rSample = evalRing(rRing);
        if (rSample.a > 0.005) {
          // Planet shadow cast onto rings along u_lightDir
          vec3 lBody = normalize(camToBody(u_lightDir));
          // Intersect ray pRingBody + t*lBody with oblate spheroid x^2 + (y*s)^2 + z^2 = 1
          vec3 pS = vec3(pRingBody.x, pRingBody.y * s, pRingBody.z);
          vec3 lS = vec3(lBody.x, lBody.y * s, lBody.z);
          float qa = dot(lS, lS);
          float qb = 2.0 * dot(pS, lS);
          float qc = dot(pS, pS) - 1.0;
          float qd = qb * qb - 4.0 * qa * qc;
          float planetShadow = 1.0;
          if (qd > 0.0) {
            float tHit = (-qb - sqrt(qd)) / (2.0 * qa);
            if (tHit > 0.0) {
              planetShadow = 0.14;
            }
          }

          // Subtle ring backscatter + shadow
          float ringLit = (0.78 + 0.22 * abs(lBody.y)) * planetShadow;
          vec3 ringRgb = rSample.rgb * ringLit;
          if (zRing >= zSphere || !hitSphere) {
            frontRing = vec4(ringRgb, rSample.a);
          } else {
            backRing = vec4(ringRgb, rSample.a);
          }
        }
      }
    } else {
      // Edge-on ring razor line when Saturn ring plane crosses Earth (~0 deg)
      if (abs(xy.y) < pxAA * 1.4 && abs(xy.x) >= 1.0 && abs(xy.x) <= u_ringOuter) {
        float edgeA = smoothstep(pxAA * 1.4, 0.0, abs(xy.y)) * 0.82;
        frontRing = vec4(vec3(0.84, 0.77, 0.62), edgeA);
      }
    }
  }

  // Composite: Back Ring -> Oblate Planet Sphere -> Front Ring
  vec3 outRgb = backRing.rgb;
  float outA = backRing.a;

  if (hitSphere) {
    outRgb = mix(outRgb, sphereCol, sphereEdgeAlpha);
    outA = sphereEdgeAlpha + outA * (1.0 - sphereEdgeAlpha);
  }

  if (frontRing.a > 0.001) {
    outRgb = mix(outRgb, frontRing.rgb, frontRing.a);
    outA = frontRing.a + outA * (1.0 - frontRing.a);
  }

  if (outA < 0.004) discard;
  outRgb = applyTheme(outRgb);
  gl_FragColor = vec4(outRgb * outA, outA);
}
`;

class WebGLPlanetEngine {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private textures = new Map<string, WebGLTexture>();
  private loadingStarted = false;
  private listeners = new Set<() => void>();
  private readyCount = 0;

  constructor() {
    if (typeof document === 'undefined') return;
    this.initWebGL();
  }

  private initWebGL() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
      });
      if (!gl) return;

      const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) return;

      const prog = gl.createProgram();
      if (!prog) return;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      const aPos = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const uNames = [
        'u_tex',
        'u_canvasExtent',
        'u_invOneMinusF',
        'u_sinB',
        'u_cosB',
        'u_lonOffset',
        'u_lightDir',
        'u_isEmissive',
        'u_earthshine',
        'u_ringInner',
        'u_ringOuter',
        'u_ringStyle',
        'u_redMode',
        'u_whiteMode',
        'u_vClamp',
      ];
      for (const name of uNames) {
        this.uniforms[name] = gl.getUniformLocation(prog, name);
      }

      this.canvas = canvas;
      this.gl = gl;
      this.program = prog;
      this.createUranusProceduralTexture();
      this.loadAllTextures();
    } catch {
      this.gl = null;
    }
  }

  private compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private uploadCanvasOrImage(id: string, source: HTMLImageElement | HTMLCanvasElement) {
    const gl = this.gl;
    if (!gl) return;
    const tex = gl.createTexture();
    if (!tex) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.textures.set(id, tex);
    this.readyCount++;
    this.notifyListeners();
  }

  private createUranusProceduralTexture() {
    if (typeof document === 'undefined') return;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0.0, '#CBEFF4'); // Bright polar hood
    g.addColorStop(0.18, '#A9E4EC');
    g.addColorStop(0.36, '#87D5E2');
    g.addColorStop(0.5, '#7BCBD9');
    g.addColorStop(0.68, '#6EC1D1');
    g.addColorStop(0.86, '#84D3DF');
    g.addColorStop(1.0, '#9FE0E8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
    // Subtle zonal methane haze bands
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 26, 256, 8);
    ctx.fillRect(0, 56, 256, 6);
    ctx.fillRect(0, 88, 256, 7);
    this.uploadCanvasOrImage('Uranus', c);
  }

  private loadAllTextures() {
    if (this.loadingStarted) return;
    this.loadingStarted = true;
    for (const [id, url] of Object.entries(TEXTURE_URLS)) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.uploadCanvasOrImage(id, img);
      };
      img.src = url;
    }
  }

  public onTextureReady(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners() {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public hasTexture(bodyId: string): boolean {
    return this.gl !== null && this.textures.has(bodyId);
  }

  /**
   * Render a photorealistic 3D planet/Sun/Moon directly onto the 2D star chart canvas.
   * Returns true if rendered via WebGL textures, false if caller should fall back to 2D schematic.
   */
  public drawBodyToCanvas2D(
    ctx: CanvasRenderingContext2D,
    body: SolarSystemBody,
    sun: SolarSystemBody | undefined,
    cx: number,
    cy: number,
    equatorialRadiusPx: number,
    skyNorthX: number,
    skyNorthY: number,
    skyEastX: number,
    skyEastY: number,
    timestampMs: number,
    theme: ThemeMode
  ): boolean {
    const gl = this.gl;
    const canvas = this.canvas;
    const prog = this.program;
    const def = BODY_IAU_DEFS[body.id];
    const tex = this.textures.get(body.id);
    if (!gl || !canvas || !prog || !def || !tex) return false;

    const orient = computePlanetOrientation(body, sun, timestampMs);
    if (!orient) return false;

    const hasRings = Boolean(def.ringInner && def.ringOuter);
    const extentRe = hasRings ? (def.ringOuter! + 0.16) : 1.08;
    const drawHalfPx = equatorialRadiusPx * extentRe;

    // Choose offscreen buffer size crisp enough for current zoom (capped at 512px for 60fps)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const desiredPx = Math.max(64, Math.min(512, Math.ceil(drawHalfPx * 2 * dpr)));
    const texSize =
      desiredPx <= 96 ? 96 : desiredPx <= 160 ? 160 : desiredPx <= 256 ? 256 : desiredPx <= 384 ? 384 : 512;

    if (canvas.width !== texSize || canvas.height !== texSize) {
      canvas.width = texSize;
      canvas.height = texSize;
    }

    gl.viewport(0, 0, texSize, texSize);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this.uniforms.u_tex, 0);
    gl.uniform1f(this.uniforms.u_canvasExtent, extentRe);
    gl.uniform1f(this.uniforms.u_invOneMinusF, 1.0 / (1.0 - def.flattening));
    gl.uniform1f(this.uniforms.u_sinB, Math.sin(orient.subEarthLatRad));
    gl.uniform1f(this.uniforms.u_cosB, Math.cos(orient.subEarthLatRad));
    gl.uniform1f(this.uniforms.u_lonOffset, orient.centralMeridianRad);
    gl.uniform3f(
      this.uniforms.u_lightDir,
      orient.lightInCam[0],
      orient.lightInCam[1],
      orient.lightInCam[2]
    );
    gl.uniform1f(this.uniforms.u_isEmissive, def.isEmissive ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_earthshine, def.earthshine ?? 0.02);
    gl.uniform1f(this.uniforms.u_ringInner, def.ringInner ?? 0.0);
    gl.uniform1f(this.uniforms.u_ringOuter, def.ringOuter ?? 0.0);
    gl.uniform1f(this.uniforms.u_ringStyle, def.ringStyle ?? 0.0);
    gl.uniform1f(this.uniforms.u_redMode, theme === 'red' ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_whiteMode, theme === 'white' ? 1.0 : 0.0);
    const vClamp = def.uvVClamp ?? [0.005, 0.995];
    gl.uniform2f(this.uniforms.u_vClamp, vClamp[0], vClamp[1]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Map the planet's camera-frame basis (+xCam = West-of-Pole, +yCam = Projected North Pole)
    // onto the exact 2D canvas coordinate basis using local skyNorth & skyEast vectors!
    // This automatically honors Equatorial vs Horizontal rotation AND flipH / flipV mirrors!
    const paRad = orient.phys.northPolePaDeg * DEG2RAD;
    const cosP = Math.cos(paRad);
    const sinP = Math.sin(paRad);

    // Planet projected North Pole direction on screen (unit vector)
    const pNorthX = skyNorthX * cosP + skyEastX * sinP;
    const pNorthY = skyNorthY * cosP + skyEastY * sinP;

    // Planet camera +X axis (West-of-Pole on sky = -East*cosP + North*sinP)
    const pWestX = -skyEastX * cosP + skyNorthX * sinP;
    const pWestY = -skyEastY * cosP + skyNorthY * sinP;

    // Draw the rendered WebGL quad using exact affine basis (canvas +X -> pWest, canvas -Y -> pNorth)
    ctx.save();
    ctx.translate(cx, cy);
    // In Canvas 2D, drawImage maps local +x to (a, b) and local +y (downward) to (c, d).
    // In our WebGL texture, top (local -y) is +yCam (North Pole), so local +y is -pNorth!
    ctx.transform(pWestX, pWestY, -pNorthX, -pNorthY, 0, 0);
    ctx.drawImage(canvas, -drawHalfPx, -drawHalfPx, drawHalfPx * 2, drawHalfPx * 2);
    ctx.restore();

    return true;
  }
}

let singletonEngine: WebGLPlanetEngine | null = null;

export function getPlanetRenderer(): WebGLPlanetEngine {
  if (!singletonEngine) {
    singletonEngine = new WebGLPlanetEngine();
  }
  return singletonEngine;
}
