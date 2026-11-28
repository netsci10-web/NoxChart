import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Share2,
  X,
} from 'lucide-react';
import {
  ObserverConfig,
  ObjectNameLanguage,
  SelectedItem,
  StarHopGuide,
  ThemeMode,
} from '../types/astronomy';
import {
  AltitudeProfile24h,
  formatDec,
  formatRA,
  getCompassDirection,
  getDsoTypeLabel,
} from '../utils/astronomy';
import { getUiTheme } from '../utils/themeClasses';

type ShareMode = 'image' | 'text';
type CardAspect = 'landscape' | 'square';
type CardVisualStyle = 'deepsky' | 'obsidian' | 'atlas';
type TextFormatStyle = 'social' | 'markdown' | 'compact';

export interface TargetShareData {
  selected: SelectedItem;
  primaryTitle: string;
  conLabel: string;
  designations: string[];
  altDeg: number;
  azDeg: number;
  altProfile: AltitudeProfile24h;
  hopGuides: StarHopGuide[];
  observer: ObserverConfig;
  obsTimeMs: number;
  nameLanguage: ObjectNameLanguage;
  activeEquipSummary?: string;
}

interface TargetShareModalProps {
  open: boolean;
  theme: ThemeMode;
  data: TargetShareData;
  onClose: () => void;
}

interface CardPalette {
  bgTop: string;
  bgBottom: string;
  cardBg: string;
  cardBorder: string;
  divider: string;
  title: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  rise: string;
  set: string;
  hop: string;
  starDot: string;
  dayBar: string;
  twilightBar: string;
  nightBar: string;
}

const CARD_PALETTES: Record<CardVisualStyle, CardPalette> = {
  deepsky: {
    bgTop: '#050B18',
    bgBottom: '#0B162C',
    cardBg: 'rgba(13, 24, 46, 0.78)',
    cardBorder: 'rgba(56, 189, 248, 0.24)',
    divider: 'rgba(148, 163, 184, 0.16)',
    title: '#F8FAFC',
    textPrimary: '#E2E8F0',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    accent: '#38BDF8',
    accentSoft: 'rgba(56, 189, 248, 0.14)',
    rise: '#34D399',
    set: '#FBBF24',
    hop: '#F59E0B',
    starDot: '#E2E8F0',
    dayBar: '#7DD3FC',
    twilightBar: '#475569',
    nightBar: '#020617',
  },
  obsidian: {
    bgTop: '#09090B',
    bgBottom: '#141418',
    cardBg: 'rgba(24, 24, 29, 0.84)',
    cardBorder: 'rgba(245, 158, 11, 0.26)',
    divider: 'rgba(161, 161, 170, 0.16)',
    title: '#FAFAFA',
    textPrimary: '#F4F4F5',
    textSecondary: '#D4D4D8',
    textMuted: '#A1A1AA',
    accent: '#F59E0B',
    accentSoft: 'rgba(245, 158, 11, 0.14)',
    rise: '#34D399',
    set: '#FB923C',
    hop: '#FBBF24',
    starDot: '#F4F4F5',
    dayBar: '#93C5FD',
    twilightBar: '#52525B',
    nightBar: '#09090B',
  },
  atlas: {
    bgTop: '#F8FAFC',
    bgBottom: '#EEF2F7',
    cardBg: 'rgba(255, 255, 255, 0.92)',
    cardBorder: 'rgba(15, 23, 42, 0.14)',
    divider: 'rgba(15, 23, 42, 0.1)',
    title: '#0F172A',
    textPrimary: '#1E293B',
    textSecondary: '#334155',
    textMuted: '#64748B',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.1)',
    rise: '#059669',
    set: '#D97706',
    hop: '#D97706',
    starDot: '#334155',
    dayBar: '#7DD3FC',
    twilightBar: '#94A3B8',
    nightBar: '#0F172A',
  },
};

function formatDateTimeReadable(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateFileStamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function sanitizeFilename(raw: string): string {
  return (
    raw
      .replace(/[\\/:*?"<>|\s]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'target'
  );
}

function getTargetCategoryLabel(selected: SelectedItem): string {
  if (selected.kind === 'dso') return getDsoTypeLabel(selected.data.type);
  if (selected.kind === 'planet') return selected.data.category;
  if (selected.kind === 'double') {
    return selected.data.isMultiple
      ? `다중성 (${selected.data.compCount}구성성)`
      : '이중성 (Double Star)';
  }
  return selected.data.gaiaId ? 'Gaia DR3 항성' : '항성 (Fixed Star)';
}

function getTargetExtraMetric(selected: SelectedItem): { label: string; value: string } {
  if (selected.kind === 'dso') {
    return {
      label: '시직경 / PA',
      value: `${selected.data.majAx.toFixed(1)}′×${selected.data.minAx.toFixed(1)}′ · ${selected.data.pa}°`,
    };
  }
  if (selected.kind === 'planet') {
    const distStr =
      selected.data.id === 'Moon'
        ? `${Math.round(selected.data.distAu * 149597870.7).toLocaleString()} km`
        : `${selected.data.distAu.toFixed(3)} AU`;
    return {
      label: '거리 / 위상',
      value: `${distStr} · ${selected.data.phasePct}%`,
    };
  }
  if (selected.kind === 'double') {
    return {
      label: '등급 / 이격각',
      value: `${selected.data.mag1.toFixed(1)}/${selected.data.mag2.toFixed(1)}m · ${selected.data.sep.toFixed(1)}″`,
    };
  }
  const bv = selected.data.bv;
  const spec =
    bv < -0.25
      ? 'O형'
      : bv < 0.0
      ? 'B형'
      : bv < 0.3
      ? 'A형'
      : bv < 0.58
      ? 'F형'
      : bv < 0.82
      ? 'G형'
      : bv < 1.4
      ? 'K형'
      : 'M형';
  const teffK = Math.round(
    4600 * (1 / (0.92 * Math.max(-0.4, bv) + 1.7) + 1 / (0.92 * Math.max(-0.4, bv) + 0.62))
  );
  return {
    label: '색지수 / 분광',
    value: `B-V ${bv >= 0 ? '+' : ''}${bv.toFixed(2)} · ${spec} (~${teffK.toLocaleString()}K)`,
  };
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function fitTextEllipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return `${text.slice(0, Math.max(1, lo))}…`;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function renderShareCardCanvas(
  canvas: HTMLCanvasElement,
  data: TargetShareData,
  aspect: CardAspect,
  style: CardVisualStyle,
  options: {
    includeLocation: boolean;
    includeAltitude: boolean;
    includeStarHop: boolean;
  }
) {
  const W = aspect === 'landscape' ? 1200 : 1080;
  const H = aspect === 'landscape' ? 675 : 1080;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const pal = CARD_PALETTES[style];
  const { selected, primaryTitle, conLabel, designations, altDeg, azDeg, altProfile, hopGuides, observer, obsTimeMs, nameLanguage } = data;
  const compass = getCompassDirection(azDeg, nameLanguage);
  const categoryLabel = getTargetCategoryLabel(selected);
  const extraMetric = getTargetExtraMetric(selected);

  // 1. Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, pal.bgTop);
  grad.addColorStop(1, pal.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. Subtle deterministic starfield & celestial coordinate arcs
  let seed = 1337;
  for (let i = 0; i < selected.data.id.length; i++) {
    seed = (seed * 31 + selected.data.id.charCodeAt(i)) >>> 0;
  }
  const rand = seededRand(seed);

  ctx.save();
  for (let i = 0; i < (aspect === 'square' ? 110 : 85); i++) {
    const sx = rand() * W;
    const sy = rand() * H;
    const sr = 0.6 + rand() * 1.6;
    ctx.globalAlpha = (style === 'atlas' ? 0.14 : 0.32) * (0.35 + rand() * 0.65);
    ctx.fillStyle = pal.starDot;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint astrometric target reticle watermark in upper-right corner
  const retX = W - (aspect === 'landscape' ? 128 : 124);
  const retY = aspect === 'landscape' ? 118 : 130;
  ctx.strokeStyle = pal.accent;
  ctx.globalAlpha = style === 'atlas' ? 0.12 : 0.16;
  ctx.lineWidth = 1.4;
  for (const r of [24, 52, 84]) {
    ctx.beginPath();
    ctx.arc(retX, retY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(retX - 102, retY);
  ctx.lineTo(retX - 30, retY);
  ctx.moveTo(retX + 30, retY);
  ctx.lineTo(retX + 102, retY);
  ctx.moveTo(retX, retY - 102);
  ctx.lineTo(retX, retY - 30);
  ctx.moveTo(retX, retY + 30);
  ctx.lineTo(retX, retY + 102);
  ctx.stroke();
  ctx.restore();

  // Outer crisp frame border
  const pad = aspect === 'landscape' ? 44 : 52;
  drawRoundedRectPath(ctx, 18, 18, W - 36, H - 36, 16);
  ctx.strokeStyle = pal.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. Top Eyebrow Row (Constellation + Category | Brand)
  const contentW = W - pad * 2;
  let y = pad + 6;

  ctx.save();
  ctx.font = '600 18px "Pretendard", "IBM Plex Sans", -apple-system, sans-serif';
  ctx.fillStyle = pal.accent;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const eyebrow = [conLabel, categoryLabel].filter(Boolean).join('  ·  ');
  ctx.fillText(fitTextEllipsis(ctx, eyebrow || '천체 관측 카드', contentW - 180), pad, y);

  ctx.textAlign = 'right';
  ctx.font = '700 17px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillStyle = pal.textMuted;
  ctx.fillText('NOXCHART', W - pad, y + 1);
  ctx.restore();

  y += 34;

  // 4. Hero Title
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = pal.title;
  ctx.font = `700 ${aspect === 'landscape' ? 46 : 52}px "Pretendard", "IBM Plex Sans", -apple-system, sans-serif`;
  ctx.fillText(fitTextEllipsis(ctx, primaryTitle, contentW - 120), pad, y);
  ctx.restore();

  y += aspect === 'landscape' ? 60 : 68;

  // 5. Designations line (up to 6 concise catalog codes)
  const desigText = designations.slice(0, 6).join('  ·  ');
  if (desigText) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '500 19px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = pal.textMuted;
    ctx.fillText(fitTextEllipsis(ctx, desigText, contentW), pad, y);
    ctx.restore();
    y += 34;
  } else {
    y += 10;
  }

  // Divider line
  ctx.save();
  ctx.strokeStyle = pal.divider;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  ctx.restore();
  y += aspect === 'landscape' ? 22 : 28;

  // 6. Telemetry Grid (4 structured boxes)
  const metrics = [
    { label: '적경 RA / 적위 Dec', value: `${formatRA(selected.data.ra)}  ${formatDec(selected.data.dec)}` },
    { label: '고도 / 방위', value: `${altDeg.toFixed(1)}°  /  ${azDeg.toFixed(0)}° (${compass})` },
    {
      label: selected.kind === 'star' && selected.data.gaiaId ? 'Gaia G 등급' : '겉보기 등급',
      value: `${selected.data.mag.toFixed(2)}m`,
    },
    extraMetric,
  ];

  const cols = 2;
  const gapX = 18;
  const gapY = 16;
  const boxW = (contentW - gapX) / cols;
  const boxH = aspect === 'landscape' ? 76 : 96;

  metrics.forEach((m, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const bx = pad + col * (boxW + gapX);
    const by = y + row * (boxH + gapY);

    drawRoundedRectPath(ctx, bx, by, boxW, boxH, 10);
    ctx.fillStyle = pal.cardBg;
    ctx.fill();
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '500 15px "Pretendard", "IBM Plex Sans", -apple-system, sans-serif';
    ctx.fillStyle = pal.textMuted;
    ctx.fillText(m.label, bx + 18, by + (aspect === 'landscape' ? 13 : 18));

    ctx.font = `600 ${aspect === 'landscape' ? 22 : 25}px "IBM Plex Mono", "Pretendard", monospace`;
    ctx.fillStyle = pal.textPrimary;
    ctx.fillText(
      fitTextEllipsis(ctx, m.value, boxW - 36),
      bx + 18,
      by + (aspect === 'landscape' ? 39 : 49)
    );
    ctx.restore();
  });

  y += boxH * 2 + gapY + (aspect === 'landscape' ? 20 : 28);

  // 7. 24-Hour Altitude Curve Card (when enabled)
  const footerReserve = aspect === 'landscape' ? 54 : 68;
  const hopReserve = options.includeStarHop && hopGuides.length > 0 ? (aspect === 'landscape' ? 56 : 74) : 0;
  const availH = H - pad - footerReserve - hopReserve - y;

  if (options.includeAltitude && availH >= 112) {
    const chartBoxH = Math.min(aspect === 'landscape' ? 172 : 290, availH - 8);
    drawRoundedRectPath(ctx, pad, y, contentW, chartBoxH, 12);
    ctx.fillStyle = pal.cardBg;
    ctx.fill();
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Header inside chart box
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = '600 16px "Pretendard", "IBM Plex Sans", sans-serif';
    ctx.fillStyle = pal.textPrimary;
    ctx.fillText('24시간 고도 추이', pad + 18, y + 14);

    // Rise / Transit / Set inline summary
    const riseSetSummary = altProfile.isCircumpolar
      ? `주극성 · 최고 ${altProfile.maxAlt.altDeg.toFixed(0)}° (${altProfile.maxAlt.label})`
      : altProfile.isNeverRises
      ? `지평선 아래 · 최고 ${altProfile.maxAlt.altDeg.toFixed(0)}°`
      : `↑ 뜸 ${altProfile.primaryRise?.label ?? '--:--'}   ·   최고 ${altProfile.maxAlt.altDeg.toFixed(0)}° (${altProfile.maxAlt.label})   ·   ↓ 짐 ${altProfile.primarySet?.label ?? '--:--'}`;

    ctx.textAlign = 'right';
    ctx.font = '600 15px "IBM Plex Mono", "Pretendard", monospace';
    ctx.fillStyle = pal.textSecondary;
    ctx.fillText(riseSetSummary, W - pad - 18, y + 15);
    ctx.restore();

    // Plot coordinates
    const plotX = pad + 20;
    const plotW = contentW - 40;
    const plotTop = y + 46;
    const barH = 11;
    const plotH = Math.max(46, chartBoxH - 46 - barH - 24);
    const barY = plotTop + plotH + 8;

    const offsetToX = (oh: number) => plotX + ((oh + 12) / 24) * plotW;
    const altToY = (alt: number) => plotTop + plotH / 2 - (alt / 90) * (plotH / 2 - 6);
    const horizonY = altToY(0);
    const optimalY = altToY(30);
    const nowX = offsetToX(0);

    // +30 deg optimal dashed line
    ctx.save();
    ctx.strokeStyle = pal.textMuted;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(plotX, optimalY);
    ctx.lineTo(plotX + plotW, optimalY);
    ctx.stroke();

    // 0 deg horizon line
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(plotX, horizonY);
    ctx.lineTo(plotX + plotW, horizonY);
    ctx.stroke();

    // Now vertical line
    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(nowX, plotTop);
    ctx.lineTo(nowX, barY + barH);
    ctx.stroke();
    ctx.restore();

    // Altitude curve polyline
    if (altProfile.points.length > 1) {
      ctx.save();
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      altProfile.points.forEach((pt, idx) => {
        const px = offsetToX(pt.offsetHours);
        const py = altToY(pt.altDeg);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Current altitude dot
      const nowPt = altProfile.points.find((p) => Math.abs(p.offsetHours) < 1e-6);
      const nowY = nowPt ? altToY(nowPt.altDeg) : altToY(altDeg);
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(nowX, nowY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Rise / Set dots
      if (altProfile.primaryRise) {
        ctx.fillStyle = pal.rise;
        ctx.beginPath();
        ctx.arc(offsetToX(altProfile.primaryRise.offsetHours), horizonY, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (altProfile.primarySet) {
        ctx.fillStyle = pal.set;
        ctx.beginPath();
        ctx.arc(offsetToX(altProfile.primarySet.offsetHours), horizonY, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Sky phase bar (day / twilight / night)
    ctx.save();
    drawRoundedRectPath(ctx, plotX, barY, plotW, barH, 4);
    ctx.clip();
    for (const seg of altProfile.skySegments) {
      const sx1 = offsetToX(seg.startOffsetHours);
      const sx2 = offsetToX(seg.endOffsetHours);
      ctx.fillStyle =
        seg.phase === 'day'
          ? pal.dayBar
          : seg.phase === 'twilight'
          ? pal.twilightBar
          : pal.nightBar;
      ctx.fillRect(sx1, barY, Math.max(1, sx2 - sx1 + 0.5), barH);
    }
    ctx.restore();
    drawRoundedRectPath(ctx, plotX, barY, plotW, barH, 4);
    ctx.strokeStyle = pal.divider;
    ctx.lineWidth = 1;
    ctx.stroke();

    y += chartBoxH + 14;
  }

  // 8. Star-Hopping Summary Strip (if enabled and available)
  if (options.includeStarHop && hopGuides.length > 0) {
    const primaryHop = hopGuides[0];
    const hopStarName =
      primaryHop.fromStar.koName ||
      primaryHop.fromStar.name ||
      primaryHop.fromStar.bayer ||
      primaryHop.fromStar.id;
    const hopCon = primaryHop.fromConstellationKo ? `${primaryHop.fromConstellationKo} ` : '';
    const hopCompass = getCompassDirection(primaryHop.paDeg, nameLanguage);
    const hopStr = `★ ${hopCon}${hopStarName} (${primaryHop.fromStar.mag.toFixed(1)}m)  →  이격 ${primaryHop.distanceDeg.toFixed(1)}° · 방위 ${primaryHop.paDeg.toFixed(0)}° (${hopCompass})`;

    const hopH = aspect === 'landscape' ? 42 : 52;
    drawRoundedRectPath(ctx, pad, y, contentW, hopH, 9);
    ctx.fillStyle = pal.cardBg;
    ctx.fill();
    ctx.strokeStyle = pal.hop;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '600 15px "Pretendard", "IBM Plex Sans", sans-serif';
    ctx.fillStyle = pal.hop;
    ctx.fillText('별 호핑', pad + 16, y + hopH / 2 + 0.5);

    ctx.font = '600 15.5px "IBM Plex Mono", "Pretendard", monospace';
    ctx.fillStyle = pal.textPrimary;
    ctx.fillText(fitTextEllipsis(ctx, hopStr, contentW - 104), pad + 86, y + hopH / 2 + 0.5);
    ctx.restore();
  }

  // 9. Footer Metadata Bar (Location, Coordinates, Timestamp)
  const footerY = H - pad - 18;
  ctx.save();
  ctx.strokeStyle = pal.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, footerY - 16);
  ctx.lineTo(W - pad, footerY - 16);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.font = '500 15px "IBM Plex Mono", "Pretendard", monospace';
  ctx.fillStyle = pal.textMuted;

  ctx.textAlign = 'left';
  const locText = options.includeLocation
    ? `${observer.name || '관측지'}  (${observer.lat.toFixed(2)}°${observer.lat >= 0 ? 'N' : 'S'}, ${Math.abs(observer.lon).toFixed(2)}°${observer.lon >= 0 ? 'E' : 'W'})`
    : 'NoxChart Star Atlas';
  ctx.fillText(fitTextEllipsis(ctx, locText, contentW * 0.62), pad, footerY + 4);

  ctx.textAlign = 'right';
  const timeText = options.includeLocation ? formatDateTimeReadable(obsTimeMs) : primaryTitle;
  ctx.fillText(timeText, W - pad, footerY + 4);
  ctx.restore();
}

export function TargetShareModal({ open, theme, data, onClose }: TargetShareModalProps) {
  const ui = getUiTheme(theme);
  const [mode, setMode] = useState<ShareMode>('image');
  const [aspect, setAspect] = useState<CardAspect>('landscape');
  const [cardStyle, setCardStyle] = useState<CardVisualStyle>(() =>
    theme === 'white' ? 'atlas' : 'deepsky'
  );
  const [textFormat, setTextFormat] = useState<TextFormatStyle>('social');
  const [includeLocation, setIncludeLocation] = useState(true);
  const [includeAltitude, setIncludeAltitude] = useState(true);
  const [includeStarHop, setIncludeStarHop] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<'text' | 'image' | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const showFeedback = useCallback((msg: string, copied?: 'text' | 'image') => {
    setFeedbackMsg(msg);
    setCopiedKey(copied ?? null);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackMsg(null);
      setCopiedKey(null);
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || mode !== 'image') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderShareCardCanvas(canvas, data, aspect, cardStyle, {
      includeLocation,
      includeAltitude,
      includeStarHop,
    });
  }, [open, mode, data, aspect, cardStyle, includeLocation, includeAltitude, includeStarHop]);

  const formattedText = useMemo(() => {
    const {
      selected,
      primaryTitle,
      conLabel,
      designations,
      altDeg,
      azDeg,
      altProfile,
      hopGuides,
      observer,
      obsTimeMs,
      nameLanguage,
    } = data;
    const compass = getCompassDirection(azDeg, nameLanguage);
    const category = getTargetCategoryLabel(selected);
    const extra = getTargetExtraMetric(selected);
    const raStr = formatRA(selected.data.ra);
    const decStr = formatDec(selected.data.dec);
    const magStr = `${selected.data.mag.toFixed(2)}m`;
    const desigLine = designations.slice(0, 6).join(' · ');
    const riseSetStr = altProfile.isCircumpolar
      ? `주극성 (최고 ${altProfile.maxAlt.altDeg.toFixed(0)}° @ ${altProfile.maxAlt.label})`
      : altProfile.isNeverRises
      ? `지평선 아래 (최고 ${altProfile.maxAlt.altDeg.toFixed(0)}°)`
      : `뜸 ${altProfile.primaryRise?.label ?? '--:--'} / 최고 ${altProfile.maxAlt.altDeg.toFixed(0)}° (${altProfile.maxAlt.label}) / 짐 ${altProfile.primarySet?.label ?? '--:--'}`;
    const locLine = `${observer.name || '관측지'} (${observer.lat.toFixed(2)}°, ${observer.lon.toFixed(2)}°) · ${formatDateTimeReadable(obsTimeMs)}`;

    const primaryHop = hopGuides[0];
    const hopLine = primaryHop
      ? `${primaryHop.fromConstellationKo ? `${primaryHop.fromConstellationKo} ` : ''}${
          primaryHop.fromStar.koName ||
          primaryHop.fromStar.name ||
          primaryHop.fromStar.bayer ||
          primaryHop.fromStar.id
        }(${primaryHop.fromStar.mag.toFixed(1)}m) → ${primaryHop.distanceDeg.toFixed(1)}° · 방위 ${primaryHop.paDeg.toFixed(0)}°(${getCompassDirection(primaryHop.paDeg, nameLanguage)})`
      : null;

    if (textFormat === 'compact') {
      const parts = [
        `${primaryTitle}${conLabel ? ` [${conLabel}]` : ''}`,
        category,
        `등급 ${magStr}`,
        `RA ${raStr} / Dec ${decStr}`,
        `고도 ${altDeg.toFixed(1)}° · 방위 ${azDeg.toFixed(0)}°(${compass})`,
      ];
      if (includeAltitude) parts.push(riseSetStr);
      if (includeStarHop && hopLine) parts.push(`별호핑: ${hopLine}`);
      if (includeLocation) parts.push(locLine);
      return parts.join(' | ');
    }

    if (textFormat === 'markdown') {
      const lines: string[] = [
        `## ${primaryTitle}`,
        conLabel ? `> ${conLabel} · ${category}` : `> ${category}`,
      ];
      if (desigLine) lines.push(`- **카탈로그**: \`${desigLine}\``);
      lines.push(`- **적경 / 적위**: \`${raStr}\` / \`${decStr}\``);
      lines.push(`- **고도 / 방위**: \`${altDeg.toFixed(1)}°\` / \`${azDeg.toFixed(0)}° (${compass})\``);
      lines.push(`- **겉보기 등급**: \`${magStr}\``);
      lines.push(`- **${extra.label}**: ${extra.value}`);
      if (includeAltitude) lines.push(`- **24시간 고도**: ${riseSetStr}`);
      if (includeStarHop && hopLine) lines.push(`- **별 호핑**: ${hopLine}`);
      if (includeLocation) lines.push(`- **관측 정보**: ${locLine}`);
      return lines.join('\n');
    }

    // Default: 'social' structured card
    const lines: string[] = [
      `[${primaryTitle}]`,
      [conLabel, category].filter(Boolean).join(' · '),
    ];
    if (desigLine) lines.push(`별칭: ${desigLine}`);
    lines.push('────────────────────');
    lines.push(`• 좌표: RA ${raStr} / Dec ${decStr}`);
    lines.push(`• 위치: 고도 ${altDeg.toFixed(1)}° · 방위 ${azDeg.toFixed(0)}° (${compass})`);
    lines.push(`• 등급: ${magStr} (${extra.label}: ${extra.value})`);
    if (includeAltitude) lines.push(`• 출몰: ${riseSetStr}`);
    if (includeStarHop && hopLine) lines.push(`• 별호핑: ${hopLine}`);
    if (includeLocation) {
      lines.push('────────────────────');
      lines.push(`관측지: ${locLine}`);
    }
    return lines.join('\n');
  }, [data, textFormat, includeLocation, includeAltitude, includeStarHop]);

  const handleCopyText = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(formattedText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = formattedText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showFeedback('텍스트 카드를 클립보드에 복사했습니다.', 'text');
    } catch {
      showFeedback('클립보드 복사에 실패했습니다. 텍스트를 직접 선택해 복사해 주세요.');
    }
  };

  const handleDownloadText = () => {
    const ext = textFormat === 'markdown' ? 'md' : 'txt';
    const fileName = `noxchart_${sanitizeFilename(data.primaryTitle)}_${formatDateFileStamp(data.obsTimeMs)}.${ext}`;
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback(`${fileName} 파일을 저장했습니다.`);
  };

  const getCardPngBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      renderShareCardCanvas(canvas, data, aspect, cardStyle, {
        includeLocation,
        includeAltitude,
        includeStarHop,
      });
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });

  const handleDownloadImage = async () => {
    const blob = await getCardPngBlob();
    if (!blob) {
      showFeedback('이미지를 생성하지 못했습니다.');
      return;
    }
    const fileName = `noxchart_${sanitizeFilename(data.primaryTitle)}_${formatDateFileStamp(data.obsTimeMs)}.png`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback(`${fileName} 이미지를 저장했습니다.`);
  };

  const handleCopyImage = async () => {
    try {
      const blob = await getCardPngBlob();
      if (!blob) {
        showFeedback('이미지를 생성하지 못했습니다.');
        return;
      }
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.write === 'function' &&
        typeof ClipboardItem !== 'undefined'
      ) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showFeedback('이미지 카드를 클립보드에 복사했습니다.', 'image');
      } else {
        showFeedback('현재 브라우저는 이미지 클립보드 복사를 지원하지 않습니다. PNG 다운로드를 이용해 주세요.');
      }
    } catch {
      showFeedback('브라우저 권한으로 이미지 복사가 제한되었습니다. PNG 다운로드를 이용해 주세요.');
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      if (mode === 'image') {
        const blob = await getCardPngBlob();
        if (blob) {
          const file = new File(
            [blob],
            `noxchart_${sanitizeFilename(data.primaryTitle)}_${formatDateFileStamp(data.obsTimeMs)}.png`,
            { type: 'image/png' }
          );
          if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: data.primaryTitle,
              text: `${data.primaryTitle}${data.conLabel ? ` (${data.conLabel})` : ''}`,
              files: [file],
            });
            return;
          }
        }
      }
      await navigator.share({
        title: data.primaryTitle,
        text: formattedText,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showFeedback('시스템 공유를 열지 못했습니다. 복사 또는 다운로드를 이용해 주세요.');
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="noxchart-target-share-title"
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/65 backdrop-blur-[2px] p-4"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={`w-full max-w-[540px] max-h-[90vh] border shadow-2xl flex flex-col overflow-hidden ${ui.panel} ${ui.border}`}
        style={{ borderRadius: '10px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b shrink-0 ${ui.divider}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Share2 className={`w-4 h-4 shrink-0 ${ui.accentText}`} />
            <div className="min-w-0">
              <h3
                id="noxchart-target-share-title"
                className={`text-[13px] font-semibold tracking-[-0.03em] truncate ${ui.textPrimary}`}
              >
                천체 정보 공유 · {data.primaryTitle}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="공유 창 닫기"
            className={`p-1 border transition-colors shrink-0 cursor-pointer ${ui.buttonIdle}`}
            style={{ borderRadius: '5px' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Switcher Tabs: Image Card vs Text Card */}
        <div className={`px-3.5 pt-3 pb-2 border-b shrink-0 space-y-2 ${ui.divider}`}>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setMode('image')}
              aria-pressed={mode === 'image'}
              className={`py-1.5 px-2.5 border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'image' ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '6px' }}
            >
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>이미지 카드 (PNG)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              aria-pressed={mode === 'text'}
              className={`py-1.5 px-2.5 border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'text' ? ui.buttonActive : ui.buttonIdle
              }`}
              style={{ borderRadius: '6px' }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>텍스트 카드</span>
            </button>
          </div>

          {/* Per-mode options */}
          {mode === 'image' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
              <div className="flex items-center gap-1">
                <span className={`text-[10px] mr-0.5 ${ui.textMuted}`}>비율</span>
                {(
                  [
                    { id: 'landscape', label: '16:9 와이드' },
                    { id: 'square', label: '1:1 정사각' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAspect(opt.id)}
                    aria-pressed={aspect === opt.id}
                    className={`px-2 py-0.5 border text-[10px] font-medium transition-colors cursor-pointer ${
                      aspect === opt.id ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] mr-0.5 ${ui.textMuted}`}>스타일</span>
                {(
                  [
                    { id: 'deepsky', label: '딥스카이' },
                    { id: 'obsidian', label: '옵시디언' },
                    { id: 'atlas', label: '아틀라스' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCardStyle(opt.id)}
                    aria-pressed={cardStyle === opt.id}
                    className={`px-2 py-0.5 border text-[10px] font-medium transition-colors cursor-pointer ${
                      cardStyle === opt.id ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] shrink-0 ${ui.textMuted}`}>형식</span>
              <div className="grid grid-cols-3 gap-1 flex-1">
                {(
                  [
                    { id: 'social', label: '소셜 카드' },
                    { id: 'markdown', label: '마크다운' },
                    { id: 'compact', label: '한 줄 요약' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTextFormat(opt.id)}
                    aria-pressed={textFormat === opt.id}
                    className={`py-0.5 px-2 border text-[10px] font-medium transition-colors cursor-pointer ${
                      textFormat === opt.id ? ui.buttonActive : ui.buttonIdle
                    }`}
                    style={{ borderRadius: '4px' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shared content toggles */}
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] ${ui.textSecondary}`}>
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAltitude}
                onChange={(e) => setIncludeAltitude(e.target.checked)}
                className="accent-cyan-500 cursor-pointer"
              />
              <span>24시간 고도·출몰</span>
            </label>
            {data.hopGuides.length > 0 && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeStarHop}
                  onChange={(e) => setIncludeStarHop(e.target.checked)}
                  className="accent-cyan-500 cursor-pointer"
                />
                <span>별 호핑 기준별</span>
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeLocation}
                onChange={(e) => setIncludeLocation(e.target.checked)}
                className="accent-cyan-500 cursor-pointer"
              />
              <span>관측지·시각</span>
            </label>
          </div>
        </div>

        {/* Live Preview Body */}
        <div className="flex-1 min-h-0 overflow-y-auto astro-scroll p-3.5 space-y-2.5">
          {mode === 'image' ? (
            <div className="flex flex-col items-center justify-center">
              <div
                className={`w-full border overflow-hidden flex items-center justify-center ${ui.panelMuted} ${ui.border}`}
                style={{ borderRadius: '8px' }}
              >
                <canvas
                  ref={canvasRef}
                  className={`block h-auto ${
                    aspect === 'square' ? 'max-h-[360px] w-auto max-w-full' : 'w-full'
                  }`}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                readOnly
                value={formattedText}
                rows={11}
                aria-label="공유용 텍스트 카드 미리보기"
                onFocus={(e) => e.currentTarget.select()}
                className={`w-full p-2.5 border font-mono text-[11px] leading-relaxed resize-none focus:outline-none ${ui.input}`}
                style={{ borderRadius: '6px' }}
              />
            </div>
          )}

          {feedbackMsg && (
            <div
              className={`px-2.5 py-1.5 border text-[10.5px] font-medium ${ui.panelMuted} ${ui.border} ${ui.accentText}`}
              style={{ borderRadius: '5px' }}
            >
              {feedbackMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`px-3.5 py-2.5 border-t flex flex-wrap items-center justify-end gap-1.5 shrink-0 ${ui.divider}`}>
          {mode === 'image' ? (
            <>
              <button
                type="button"
                onClick={handleCopyImage}
                className={`px-3 py-1.5 border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${ui.buttonIdle}`}
                style={{ borderRadius: '5px' }}
              >
                {copiedKey === 'image' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'image' ? '복사됨' : '이미지 복사'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                className={`px-3 py-1.5 border text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${ui.buttonActive}`}
                style={{ borderRadius: '5px' }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG 다운로드</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDownloadText}
                className={`px-3 py-1.5 border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${ui.buttonIdle}`}
                style={{ borderRadius: '5px' }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{textFormat === 'markdown' ? '.md 저장' : '.txt 저장'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyText}
                className={`px-3 py-1.5 border text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${ui.buttonActive}`}
                style={{ borderRadius: '5px' }}
              >
                {copiedKey === 'text' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'text' ? '복사됨' : '텍스트 복사'}</span>
              </button>
            </>
          )}
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className={`px-3 py-1.5 border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${ui.buttonIdle}`}
              style={{ borderRadius: '5px' }}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>시스템 공유</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
