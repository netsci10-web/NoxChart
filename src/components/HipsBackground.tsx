import React, { useEffect, useRef } from 'react';
import {
  ChartViewState,
  HipsSettings,
  HipsSurveyId,
  ObserverConfig,
  OpticsSettings,
  ThemeMode,
} from '../types/astronomy';
import {
  createProjectionParams,
  DEG2RAD,
  getLSTDeg,
  getStereographicRadiusPx,
  projectStereographicRaw,
  ProjectionParams,
  RAD2DEG,
  unprojectStereographic,
} from '../utils/astronomy';

const SURVEY_URLS: Record<HipsSurveyId, string> = {
  dss2: 'https://cdn.skies.esac.esa.int/DSSColor',
  '2mass': 'https://cdn.skies.esac.esa.int/2MASSColor',
  allwise: 'https://cdn.skies.esac.esa.int/AllWISEColor',
};

const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

function xyf2angContinuous(
  ix: number,
  iy: number,
  face: number,
  nside: number
): { raDeg: number; decDeg: number } {
  const jr = JRLL[face] * nside - ix - iy;
  let z: number;
  let nr: number;
  if (jr < nside) {
    nr = jr;
    z = 1 - (nr * nr) / (3 * nside * nside);
  } else if (jr > 3 * nside) {
    nr = 4 * nside - jr;
    z = (nr * nr) / (3 * nside * nside) - 1;
  } else {
    nr = nside;
    z = ((2 * nside - jr) * 2) / (3 * nside);
  }

  const phi =
    nr > 1e-7
      ? ((JPLL[face] * nr + ix - iy) / (2 * nr)) * (Math.PI / 2)
      : (JPLL[face] * Math.PI) / 4;
  const raDeg = ((phi * RAD2DEG) % 360 + 360) % 360;
  const decDeg = Math.asin(Math.max(-1, Math.min(1, z))) * RAD2DEG;
  return { raDeg, decDeg };
}

function ipix2xyf(ipix: number, nside: number): { ix: number; iy: number; face: number } {
  const npface = nside * nside;
  const face = Math.floor(ipix / npface);
  let rem = ipix - face * npface;
  let ix = 0;
  let iy = 0;
  let bit = 1;
  while (rem > 0) {
    if (rem & 1) ix |= bit;
    if (rem & 2) iy |= bit;
    rem >>= 2;
    bit <<= 1;
  }
  return { ix, iy, face };
}

function ang2pixNest(raDeg: number, decDeg: number, order: number): number {
  const nside = 1 << order;
  const z = Math.sin(decDeg * DEG2RAD);
  const za = Math.abs(z);
  const tt = (((raDeg % 360) + 360) % 360) / 90;

  let face: number;
  let ix: number;
  let iy: number;

  if (za <= 2 / 3) {
    const temp1 = nside * (0.5 + tt);
    const temp2 = nside * z * 0.75;
    const jp = Math.floor(temp1 - temp2);
    const jm = Math.floor(temp1 + temp2);
    const ifp = Math.floor(jp / nside);
    const ifm = Math.floor(jm / nside);
    face = ifp === ifm ? (ifp & 3) + 4 : ifp < ifm ? ifp & 3 : (ifm & 3) + 8;
    ix = ((jm % nside) + nside) % nside;
    iy = nside - 1 - (((jp % nside) + nside) % nside);
  } else {
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * Math.max(0, 1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp));
    const jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) {
      face = ntt;
      ix = nside - 1 - jm;
      iy = nside - 1 - jp;
    } else {
      face = ntt + 8;
      ix = jp;
      iy = jm;
    }
  }

  let local = 0;
  for (let b = 0; b < order; b++) {
    if (ix & (1 << b)) local |= 1 << (2 * b);
    if (iy & (1 << b)) local |= 1 << (2 * b + 1);
  }
  return face * nside * nside + local;
}

// Pass 1: Full-sky stereographic HEALPix Norder3 Allsky.jpg shader (WebGL1 / GLSL ES 1.00)
const ALLSKY_VS = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const ALLSKY_FS = `
precision highp float;

uniform sampler2D uAllsky;
uniform vec2 uResolution;
uniform float uScale;
uniform float uRa0;
uniform float uDec0;
uniform float uAlt0;
uniform float uAz0;
uniform float uLst;
uniform float uLat;
uniform float uIsHorizontal;
uniform float uFlipH;
uniform float uFlipV;
uniform float uRotationRad;
uniform float uEyepieceRadius;
uniform float uOpacity;
uniform float uThemeMode; // 0 = dark, 1 = white, 2 = red

const float PI = 3.14159265359;
const float HALF_PI = 1.57079632679;
const float TWO_PI = 6.28318530718;

vec3 applyTheme(vec3 col, float mode) {
  if (mode > 1.5) {
    // Pure scotopic red night mode (zero green/blue emission)
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    return vec3(clamp(l * 1.15, 0.0, 1.0), 0.0, 0.0);
  }
  if (mode > 0.5) {
    // White print inverted atlas mode
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    float inv = clamp(1.0 - l * 1.12, 0.0, 1.0);
    return vec3(inv);
  }
  // Dark space mode: crisp contrast
  return clamp((col - 0.02) * 1.08, 0.0, 1.0);
}

void main() {
  // Screen pixel coords matching Canvas2D (y=0 at top)
  float sx = gl_FragCoord.x;
  float sy = uResolution.y - gl_FragCoord.y;

  float distFromCenter = length(vec2(sx, sy) - uResolution * 0.5);
  float inEyepiece = (uEyepieceRadius > 0.5) ? step(distFromCenter, uEyepieceRadius) : 1.0;
  float effFlipH = uFlipH * inEyepiece;
  float effFlipV = uFlipV * inEyepiece;
  float effRot = uRotationRad * inEyepiece;

  float dirX;
  float dirY = (effFlipV > 0.5) ? 1.0 : -1.0;
  if (uIsHorizontal > 0.5) {
    dirX = (effFlipH > 0.5) ? -1.0 : 1.0;
  } else {
    dirX = (effFlipH > 0.5) ? 1.0 : -1.0;
  }

  vec2 rel = vec2(sx, sy) - uResolution * 0.5;
  float cosR = cos(effRot);
  float sinR = sin(effRot);
  vec2 unrot = vec2(rel.x * cosR + rel.y * sinR, -rel.x * sinR + rel.y * cosR);

  float px = unrot.x / (uScale * dirX);
  float py = unrot.y / (uScale * dirY);
  float rho = length(vec2(px, py));
  float c = 2.0 * atan(rho * 0.5);

  vec3 bgCol = (uThemeMode > 1.5)
    ? vec3(0.024, 0.0, 0.0)
    : (uThemeMode > 0.5 ? vec3(1.0) : vec3(0.027, 0.039, 0.071));

  if (c > PI * 0.92) {
    gl_FragColor = vec4(bgCol, 1.0);
    return;
  }

  float raRad;
  float decRad;

  if (uIsHorizontal > 0.5) {
    float altRad;
    float azRad;
    if (rho < 1e-6) {
      altRad = uAlt0;
      azRad = uAz0;
    } else {
      float sinC = sin(c);
      float cosC = cos(c);
      float sinA0 = sin(uAlt0);
      float cosA0 = cos(uAlt0);
      float sinAlt = clamp(cosC * sinA0 + (py * sinC * cosA0) / rho, -1.0, 1.0);
      altRad = asin(sinAlt);
      azRad = uAz0 + atan(px * sinC, rho * cosA0 * cosC - py * sinA0 * sinC);
    }
    float sinAlt = sin(altRad);
    float cosAlt = cos(altRad);
    float sinLat = sin(uLat);
    float cosLat = cos(uLat);
    float sinDec = clamp(sinAlt * sinLat + cosAlt * cosLat * cos(azRad), -1.0, 1.0);
    decRad = asin(sinDec);
    float haRad = atan(-sin(azRad) * cosAlt, sinAlt * cosLat - cosAlt * sinLat * cos(azRad));
    raRad = mod(uLst - haRad + TWO_PI * 2.0, TWO_PI);
  } else {
    if (rho < 1e-6) {
      raRad = uRa0;
      decRad = uDec0;
    } else {
      float sinC = sin(c);
      float cosC = cos(c);
      float sinD0 = sin(uDec0);
      float cosD0 = cos(uDec0);
      float sinD = clamp(cosC * sinD0 + (py * sinC * cosD0) / rho, -1.0, 1.0);
      decRad = asin(sinD);
      raRad = mod(uRa0 + atan(px * sinC, rho * cosD0 * cosC - py * sinD0 * sinC) + TWO_PI * 2.0, TWO_PI);
    }
  }

  // Exact continuous HEALPix NESTED at Norder=3 (Nside=8)
  float nside = 8.0;
  float z = sin(decRad);
  float za = abs(z);
  float tt = mod(raRad / HALF_PI, 4.0);

  float face;
  float ixCont;
  float iyCont;

  if (za <= 0.6666667) {
    float temp1 = nside * (0.5 + tt);
    float temp2 = nside * z * 0.75;
    float jp = temp1 - temp2;
    float jm = temp1 + temp2;
    float ifp = floor(jp / nside);
    float ifm = floor(jm / nside);
    if (abs(ifp - ifm) < 0.5) {
      face = mod(ifp, 4.0) + 4.0;
    } else if (ifp < ifm) {
      face = mod(ifp, 4.0);
    } else {
      face = mod(ifm, 4.0) + 8.0;
    }
    ixCont = mod(jm, nside);
    iyCont = nside - mod(jp, nside);
  } else {
    float ntt = min(3.0, floor(tt));
    float tp = tt - ntt;
    float tmp = nside * sqrt(3.0 * max(0.0, 1.0 - za));
    float jp = clamp(tp * tmp, 0.0, nside - 0.0001);
    float jm = clamp((1.0 - tp) * tmp, 0.0, nside - 0.0001);
    if (z >= 0.0) {
      face = ntt;
      ixCont = nside - jm;
      iyCont = nside - jp;
    } else {
      face = ntt + 8.0;
      ixCont = jp;
      iyCont = jm;
    }
  }

  ixCont = clamp(ixCont, 0.0, nside - 0.0001);
  iyCont = clamp(iyCont, 0.0, nside - 0.0001);

  float ixInt = floor(ixCont);
  float iyInt = floor(iyCont);
  float ixFrac = ixCont - ixInt;
  float iyFrac = iyCont - iyInt;

  // Bit-interleave 3-bit ixInt & iyInt to compute Norder3 NESTED local pixel (0..63)
  float b0x = mod(ixInt, 2.0);
  float b1x = mod(floor(ixInt * 0.5), 2.0);
  float b2x = floor(ixInt * 0.25);
  float b0y = mod(iyInt, 2.0);
  float b1y = mod(floor(iyInt * 0.5), 2.0);
  float b2y = floor(iyInt * 0.25);
  float localPix = b0x + 2.0 * b0y + 4.0 * b1x + 8.0 * b1y + 16.0 * b2x + 32.0 * b2y;
  float ipix = face * 64.0 + localPix;

  // Allsky.jpg is 27 cols x 29 rows of 64x64 JPEG tiles (top-down, u=iyFrac, v=ixFrac)
  float colIdx = mod(ipix, 27.0);
  float rowIdx = floor(ipix / 27.0);
  float uLocal = clamp(iyFrac, 0.5 / 64.0, 63.5 / 64.0);
  float vLocal = clamp(ixFrac, 0.5 / 64.0, 63.5 / 64.0);
  vec2 uv = vec2((colIdx + uLocal) / 27.0, (rowIdx + vLocal) / 29.0);

  vec3 texCol = texture2D(uAllsky, uv).rgb;
  vec3 themed = applyTheme(texCol, uThemeMode);
  vec3 finalCol = mix(bgCol, themed, uOpacity);
  gl_FragColor = vec4(finalCol, 1.0);
}
`;

// Pass 2: High-resolution 512x512 HiPS HEALPix tile mesh overlay shader
const TILE_VS = `
attribute vec2 aPos;
attribute vec2 aUv;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const TILE_FS = `
precision highp float;
uniform sampler2D uTile;
uniform vec2 uResolution;
uniform float uEyepieceRadius;
uniform float uClipMode; // 0 = full, 1 = outside eyepiece only, 2 = inside eyepiece only
uniform float uOpacity;
uniform float uThemeMode;
varying vec2 vUv;

vec3 applyTheme(vec3 col, float mode) {
  if (mode > 1.5) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    return vec3(clamp(l * 1.15, 0.0, 1.0), 0.0, 0.0);
  }
  if (mode > 0.5) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    float inv = clamp(1.0 - l * 1.12, 0.0, 1.0);
    return vec3(inv);
  }
  return clamp((col - 0.02) * 1.08, 0.0, 1.0);
}

void main() {
  if (uClipMode > 0.5 && uEyepieceRadius > 0.5) {
    float sx = gl_FragCoord.x;
    float sy = uResolution.y - gl_FragCoord.y;
    float dist = length(vec2(sx, sy) - uResolution * 0.5);
    if (uClipMode < 1.5 && dist <= uEyepieceRadius) discard;
    if (uClipMode > 1.5 && dist > uEyepieceRadius) discard;
  }
  vec3 bgCol = (uThemeMode > 1.5)
    ? vec3(0.024, 0.0, 0.0)
    : (uThemeMode > 0.5 ? vec3(1.0) : vec3(0.027, 0.039, 0.071));
  vec3 texCol = texture2D(uTile, vUv).rgb;
  vec3 themed = applyTheme(texCol, uThemeMode);
  gl_FragColor = vec4(mix(bgCol, themed, uOpacity), 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function uploadTexture(gl: WebGLRenderingContext, img: HTMLImageElement): WebGLTexture | null {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  return tex;
}

interface TileCacheItem {
  tex: WebGLTexture | null;
  status: 'loading' | 'ready' | 'error';
  lastUsed: number;
}

interface GlState {
  gl: WebGLRenderingContext;
  allskyProg: WebGLProgram;
  tileProg: WebGLProgram;
  quadBuf: WebGLBuffer;
  meshBuf: WebGLBuffer;
  allskyTextures: Partial<Record<HipsSurveyId, WebGLTexture>>;
  allskyLoading: Set<HipsSurveyId>;
  tileTextures: Map<string, TileCacheItem>;
}

interface HipsBackgroundProps {
  hips: HipsSettings;
  view: ChartViewState;
  optics: OpticsSettings;
  observer: ObserverConfig;
  theme: ThemeMode;
  width: number;
  height: number;
}

const MAX_CACHED_TILES = 72;

/**
 * Native WebGL1 HEALPix HiPS real sky survey background renderer (DSS2 / 2MASS / AllWISE)
 * directly sampling ESA HiPS Allsky.jpg + on-demand 512px high-res tiles in exact
 * stereographic alignment with the vector star chart (Equatorial & Horizontal modes).
 */
export function HipsBackground({
  hips,
  view,
  optics,
  observer,
  theme,
  width,
  height,
}: HipsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glStateRef = useRef<GlState | null>(null);
  const renderTriggerRef = useRef<() => void>(() => {});

  // Initialize WebGL1 pipeline lazily when HiPS is enabled
  useEffect(() => {
    if (!hips.enabled) {
      if (glStateRef.current) {
        const st = glStateRef.current;
        for (const tex of Object.values(st.allskyTextures)) {
          if (tex) st.gl.deleteTexture(tex);
        }
        for (const item of st.tileTextures.values()) {
          if (item.tex) st.gl.deleteTexture(item.tex);
        }
        st.gl.deleteBuffer(st.quadBuf);
        st.gl.deleteBuffer(st.meshBuf);
        st.gl.deleteProgram(st.allskyProg);
        st.gl.deleteProgram(st.tileProg);
        glStateRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || glStateRef.current) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const allskyProg = createProgram(gl, ALLSKY_VS, ALLSKY_FS);
    const tileProg = createProgram(gl, TILE_VS, TILE_FS);
    const quadBuf = gl.createBuffer();
    const meshBuf = gl.createBuffer();
    if (!allskyProg || !tileProg || !quadBuf || !meshBuf) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    glStateRef.current = {
      gl,
      allskyProg,
      tileProg,
      quadBuf,
      meshBuf,
      allskyTextures: {},
      allskyLoading: new Set(),
      tileTextures: new Map(),
    };
  }, [hips.enabled]);

  // Ensure Allsky.jpg texture is fetched for active survey
  useEffect(() => {
    if (!hips.enabled) return;
    const st = glStateRef.current;
    if (!st) return;
    const survey = hips.survey;
    if (st.allskyTextures[survey] || st.allskyLoading.has(survey)) return;

    st.allskyLoading.add(survey);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cur = glStateRef.current;
      if (!cur) return;
      cur.allskyLoading.delete(survey);
      const tex = uploadTexture(cur.gl, img);
      if (tex) {
        cur.allskyTextures[survey] = tex;
        renderTriggerRef.current();
      }
    };
    img.onerror = () => {
      glStateRef.current?.allskyLoading.delete(survey);
    };
    img.src = `${SURVEY_URLS[survey]}/Norder3/Allsky.jpg`;
  }, [hips.enabled, hips.survey]);

  // Render HiPS background whenever view / observer / theme / survey / size updates
  useEffect(() => {
    if (!hips.enabled) return;

    const drawFrame = () => {
      const canvas = canvasRef.current;
      const st = glStateRef.current;
      if (!canvas || !st) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const targetW = Math.max(1, Math.floor(width * dpr));
      const targetH = Math.max(1, Math.floor(height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const { gl, allskyProg, tileProg, quadBuf, meshBuf } = st;
      gl.viewport(0, 0, targetW, targetH);

      if (theme === 'white') {
        gl.clearColor(1, 1, 1, 1);
      } else if (theme === 'red') {
        gl.clearColor(0.024, 0, 0, 1);
      } else {
        gl.clearColor(0.027, 0.039, 0.071, 1);
      }
      gl.clear(gl.COLOR_BUFFER_BIT);

      const allskyTex = st.allskyTextures[hips.survey];
      const lstDeg = getLSTDeg(observer.timestampMs, observer.lon);
      const themeModeNum = theme === 'red' ? 2 : theme === 'white' ? 1 : 0;

      const rawFlipActive = view.flipH || view.flipV;
      const normEpRot = optics.showEyepiece
        ? ((optics.eyepieceRotationDeg % 360) + 360) % 360
        : 0;
      const epRotActive = normEpRot > 0.05 && normEpRot < 359.95;
      const epTransformActive = rawFlipActive || epRotActive;
      const epRadiusCss = optics.showEyepiece
        ? getStereographicRadiusPx(optics.eyepieceFovDeg, view.fsz, width, height)
        : 0;
      const diagHalf = Math.hypot(width / 2, height / 2);
      const eyepieceSplitActive =
        optics.showEyepiece && epTransformActive && epRadiusCss >= 3 && epRadiusCss < diagHalf + 2;
      const fullFlipActive = rawFlipActive && (!optics.showEyepiece || epRadiusCss >= diagHalf + 2);
      const fullRotDeg =
        optics.showEyepiece && epRotActive && epRadiusCss >= diagHalf + 2 ? normEpRot : 0;

      const unflippedView: ChartViewState = { ...view, flipH: false, flipV: false };
      const flippedView: ChartViewState = view;
      const unflippedProj = createProjectionParams(
        unflippedView,
        width,
        height,
        lstDeg,
        observer.lat,
        0
      );
      const flippedProj = createProjectionParams(
        flippedView,
        width,
        height,
        lstDeg,
        observer.lat,
        normEpRot
      );
      const baseProj =
        fullFlipActive || fullRotDeg > 0
          ? createProjectionParams(
              fullFlipActive ? view : unflippedView,
              width,
              height,
              lstDeg,
              observer.lat,
              fullRotDeg
            )
          : unflippedProj;

      // Pass 1: Instant full-sky seamless Allsky.jpg stereographic shader
      if (allskyTex) {
        gl.useProgram(allskyProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, allskyTex);
        gl.uniform1i(gl.getUniformLocation(allskyProg, 'uAllsky'), 0);
        gl.uniform2f(gl.getUniformLocation(allskyProg, 'uResolution'), targetW, targetH);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uScale'), baseProj.scale * dpr);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uRa0'), baseProj.ra0Deg * DEG2RAD);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uDec0'), baseProj.dec0Deg * DEG2RAD);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uAlt0'), baseProj.alt0Deg * DEG2RAD);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uAz0'), baseProj.az0Deg * DEG2RAD);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uLst'), lstDeg * DEG2RAD);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uLat'), observer.lat * DEG2RAD);
        gl.uniform1f(
          gl.getUniformLocation(allskyProg, 'uIsHorizontal'),
          view.coordSystem === 'horizontal' ? 1.0 : 0.0
        );
        const shaderFlipH = eyepieceSplitActive || fullFlipActive ? (view.flipH ? 1.0 : 0.0) : 0.0;
        const shaderFlipV = eyepieceSplitActive || fullFlipActive ? (view.flipV ? 1.0 : 0.0) : 0.0;
        const shaderRotRad =
          eyepieceSplitActive || fullRotDeg > 0 ? normEpRot * DEG2RAD : 0.0;
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uFlipH'), shaderFlipH);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uFlipV'), shaderFlipV);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uRotationRad'), shaderRotRad);
        gl.uniform1f(
          gl.getUniformLocation(allskyProg, 'uEyepieceRadius'),
          eyepieceSplitActive ? epRadiusCss * dpr : 0.0
        );
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uOpacity'), hips.opacity);
        gl.uniform1f(gl.getUniformLocation(allskyProg, 'uThemeMode'), themeModeNum);

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        const posLoc = gl.getAttribLocation(allskyProg, 'aPos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(posLoc);
      }

      // Pass 2: Stream & overlay high-resolution 512x512 HiPS tiles when zoomed in (<= 28°)
      if (view.fsz <= 28) {
        const order =
          view.fsz <= 0.55
            ? 8
            : view.fsz <= 1.1
            ? 7
            : view.fsz <= 2.2
            ? 6
            : view.fsz <= 6
            ? 5
            : view.fsz <= 14
            ? 4
            : 3;
        const nside = 1 << order;

        const drawTilesForProj = (
          tileProj: ProjectionParams,
          clipMode: number,
          eyepieceBoundsOnly: boolean
        ) => {
          const visiblePix = new Set<number>();
          const gridN = eyepieceBoundsOnly ? 6 : 10;
          const minX = eyepieceBoundsOnly ? Math.max(0, width / 2 - epRadiusCss * 1.08) : -0.06 * width;
          const maxX = eyepieceBoundsOnly ? Math.min(width, width / 2 + epRadiusCss * 1.08) : 1.06 * width;
          const minY = eyepieceBoundsOnly ? Math.max(0, height / 2 - epRadiusCss * 1.08) : -0.06 * height;
          const maxY = eyepieceBoundsOnly ? Math.min(height, height / 2 + epRadiusCss * 1.08) : 1.06 * height;

          for (let gy = 0; gy <= gridN; gy++) {
            for (let gx = 0; gx <= gridN; gx++) {
              const sx = minX + (gx / gridN) * (maxX - minX);
              const sy = minY + (gy / gridN) * (maxY - minY);
              const eq = unprojectStereographic(sx, sy, tileProj);
              if (eq) {
                visiblePix.add(ang2pixNest(eq.raDeg, eq.decDeg, order));
              }
            }
          }

          const nowMs = Date.now();
          const readyTiles: { ipix: number; tex: WebGLTexture }[] = [];

          for (const ipix of visiblePix) {
            const key = `${hips.survey}_${order}_${ipix}`;
            let entry = st.tileTextures.get(key);
            if (!entry) {
              if (st.tileTextures.size >= MAX_CACHED_TILES) {
                let oldestKey: string | null = null;
                let oldestTime = Infinity;
                for (const [k, v] of st.tileTextures.entries()) {
                  if (v.lastUsed < oldestTime) {
                    oldestTime = v.lastUsed;
                    oldestKey = k;
                  }
                }
                if (oldestKey) {
                  const old = st.tileTextures.get(oldestKey);
                  if (old?.tex) gl.deleteTexture(old.tex);
                  st.tileTextures.delete(oldestKey);
                }
              }
              entry = { tex: null, status: 'loading', lastUsed: nowMs };
              st.tileTextures.set(key, entry);

              const dir = Math.floor(ipix / 10000) * 10000;
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                const cur = glStateRef.current;
                if (!cur) return;
                const rec = cur.tileTextures.get(key);
                if (!rec) return;
                const tex = uploadTexture(cur.gl, img);
                if (tex) {
                  rec.tex = tex;
                  rec.status = 'ready';
                  renderTriggerRef.current();
                } else {
                  rec.status = 'error';
                }
              };
              img.onerror = () => {
                const rec = glStateRef.current?.tileTextures.get(key);
                if (rec) rec.status = 'error';
              };
              img.src = `${SURVEY_URLS[hips.survey]}/Norder${order}/Dir${dir}/Npix${ipix}.jpg`;
            } else {
              entry.lastUsed = nowMs;
              if (entry.status === 'ready' && entry.tex) {
                readyTiles.push({ ipix, tex: entry.tex });
              }
            }
          }

          if (readyTiles.length > 0) {
            gl.useProgram(tileProg);
            gl.uniform2f(gl.getUniformLocation(tileProg, 'uResolution'), targetW, targetH);
            gl.uniform1f(
              gl.getUniformLocation(tileProg, 'uEyepieceRadius'),
              eyepieceSplitActive ? epRadiusCss * dpr : 0.0
            );
            gl.uniform1f(gl.getUniformLocation(tileProg, 'uClipMode'), clipMode);
            gl.uniform1f(gl.getUniformLocation(tileProg, 'uOpacity'), hips.opacity);
            gl.uniform1f(gl.getUniformLocation(tileProg, 'uThemeMode'), themeModeNum);
            gl.uniform1i(gl.getUniformLocation(tileProg, 'uTile'), 0);

            const posLoc = gl.getAttribLocation(tileProg, 'aPos');
            const uvLoc = gl.getAttribLocation(tileProg, 'aUv');
            gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
            gl.enableVertexAttribArray(posLoc);
            gl.enableVertexAttribArray(uvLoc);

            const SUB = 8;
            const verts = new Float32Array(SUB * SUB * 6 * 4);

            for (const tile of readyTiles) {
              const { ix, iy, face } = ipix2xyf(tile.ipix, nside);
              const gridPts: ({ x: number; y: number; u: number; v: number } | null)[][] = [];
              for (let r = 0; r <= SUB; r++) {
                const rowPts: ({ x: number; y: number; u: number; v: number } | null)[] = [];
                const v = r / SUB;
                for (let c = 0; c <= SUB; c++) {
                  const u = c / SUB;
                  const ang = xyf2angContinuous(ix + v, iy + u, face, nside);
                  const pt = projectStereographicRaw(ang.raDeg, ang.decDeg, tileProj, -0.2);
                  if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
                    rowPts.push({
                      x: (pt.x / width) * 2 - 1,
                      y: 1 - (pt.y / height) * 2,
                      u,
                      v,
                    });
                  } else {
                    rowPts.push(null);
                  }
                }
                gridPts.push(rowPts);
              }

              let ptr = 0;
              for (let r = 0; r < SUB; r++) {
                for (let c = 0; c < SUB; c++) {
                  const p00 = gridPts[r][c];
                  const p10 = gridPts[r][c + 1];
                  const p01 = gridPts[r + 1][c];
                  const p11 = gridPts[r + 1][c + 1];
                  if (!p00 || !p10 || !p01 || !p11) continue;
                  if (
                    Math.abs(p10.x - p00.x) > 1.8 ||
                    Math.abs(p01.x - p00.x) > 1.8 ||
                    Math.abs(p11.y - p00.y) > 1.8
                  ) {
                    continue;
                  }
                  const tri = [p00, p10, p01, p01, p10, p11];
                  for (const p of tri) {
                    verts[ptr++] = p.x;
                    verts[ptr++] = p.y;
                    verts[ptr++] = p.u;
                    verts[ptr++] = p.v;
                  }
                }
              }

              if (ptr > 0) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, tile.tex);
                gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, ptr), gl.DYNAMIC_DRAW);
                gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
                gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
                gl.drawArrays(gl.TRIANGLES, 0, ptr / 4);
              }
            }

            gl.disableVertexAttribArray(posLoc);
            gl.disableVertexAttribArray(uvLoc);
          }
        };

        if (eyepieceSplitActive) {
          drawTilesForProj(unflippedProj, 1.0, false);
          drawTilesForProj(flippedProj, 2.0, true);
        } else {
          drawTilesForProj(baseProj, 0.0, false);
        }
      }
    };

    renderTriggerRef.current = drawFrame;
    const rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [
    hips.enabled,
    hips.survey,
    hips.opacity,
    view,
    optics.showEyepiece,
    optics.eyepieceFovDeg,
    optics.eyepieceRotationDeg,
    observer.timestampMs,
    observer.lat,
    observer.lon,
    theme,
    width,
    height,
  ]);

  if (!hips.enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        backgroundColor:
          theme === 'white' ? '#FFFFFF' : theme === 'red' ? '#060000' : '#070A12',
      }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
