import { Star } from '../types/astronomy';

/**
 * Deterministic tile-based faint field star generator (Level of Detail down to mag 10.5).
 * Generates repeatable pseudo-Tycho/Gaia field stars per 5x5 degree sky cell so stars
 * remain fixed to exact celestial RA/Dec coordinates when panning and zooming.
 */
export function getFieldStarsInBounds(
  raMinDeg: number,
  raMaxDeg: number,
  decMinDeg: number,
  decMaxDeg: number,
  magLimit: number
): Star[] {
  if (magLimit <= 4.6) return [];

  const CELL_DEG = 5;
  const results: Star[] = [];

  const decStart = Math.max(-85, Math.floor(decMinDeg / CELL_DEG) * CELL_DEG);
  const decEnd = Math.min(85, Math.floor(decMaxDeg / CELL_DEG) * CELL_DEG);

  // Handle RA wrapping around 0/360 smoothly
  const raSpan = raMaxDeg - raMinDeg;
  const cellsRa: number[] = [];
  if (raSpan >= 355) {
    for (let r = 0; r < 360; r += CELL_DEG) cellsRa.push(r);
  } else {
    const startCell = Math.floor(raMinDeg / CELL_DEG) * CELL_DEG;
    const endCell = Math.floor(raMaxDeg / CELL_DEG) * CELL_DEG;
    for (let r = startCell; r <= endCell; r += CELL_DEG) {
      cellsRa.push(((r % 360) + 360) % 360);
    }
  }

  for (let d = decStart; d <= decEnd; d += CELL_DEG) {
    const cosDec = Math.max(0.15, Math.cos(((d + CELL_DEG / 2) * Math.PI) / 180));

    for (const r of cellsRa) {
      let seed = ((r * 73856093) ^ ((d + 90) * 19349663)) >>> 0;
      const nextRand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      const galBoost =
        1 +
        1.1 *
          Math.exp(
            -Math.pow(
              Math.sin(((r - 275) * Math.PI) / 180) * 0.65 +
                Math.sin(((d + 25) * Math.PI) / 180) * 0.45,
              2
            ) * 6
          );

      const baseCount = Math.min(
        34,
        Math.floor(Math.pow(1.65, magLimit - 4.5) * 1.4 * cosDec * galBoost)
      );

      for (let i = 0; i < baseCount; i++) {
        const u1 = nextRand();
        const u2 = nextRand();
        const u3 = nextRand();
        const u4 = nextRand();

        const mag = 4.6 + Math.pow(u3, 0.55) * Math.max(0.5, magLimit - 4.6);
        if (mag > magLimit) continue;

        const starRa = (r + u1 * CELL_DEG) % 360;
        const starDec = d + u2 * CELL_DEG;
        const bv = -0.15 + u4 * 1.65;

        results.push({
          id: `TYC-${r}-${d}-${i}`,
          ra: starRa,
          dec: starDec,
          mag,
          bv,
          con: '',
        });
      }
    }
  }

  return results;
}
