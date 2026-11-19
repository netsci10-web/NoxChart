export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Spatial-Hash-accelerated Label Collision Detection.
 * Uses 50x50px spatial grid cells so AABB checks stay O(1) even with thousands of objects.
 */
export class LabelPlacer {
  private readonly cellSize = 50;
  private grid = new Map<string, BoundingBox[]>();

  private getCellKeys(box: BoundingBox): string[] {
    const cx1 = Math.floor(box.x1 / this.cellSize);
    const cy1 = Math.floor(box.y1 / this.cellSize);
    const cx2 = Math.floor(box.x2 / this.cellSize);
    const cy2 = Math.floor(box.y2 / this.cellSize);
    const keys: string[] = [];
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  }

  private insertBox(box: BoundingBox): void {
    const keys = this.getCellKeys(box);
    for (const key of keys) {
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
      }
      bucket.push(box);
    }
  }

  public isOverlapping(box: BoundingBox): boolean {
    const keys = this.getCellKeys(box);
    for (const key of keys) {
      const bucket = this.grid.get(key);
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const b = bucket[i];
        if (box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Register bright stars or DSO symbols as obstacles so labels never cover them.
   */
  public registerObstacle(cx: number, cy: number, radius: number): void {
    const r = Math.max(2, radius);
    this.insertBox({
      x1: cx - r,
      y1: cy - r,
      x2: cx + r,
      y2: cy + r,
    });
  }

  /**
   * Find optimal non-overlapping label placement around (cx, cy) via 8-direction search.
   */
  public placeLabel(
    cx: number,
    cy: number,
    radius: number,
    textW: number,
    textH: number,
    viewWidth: number,
    viewHeight: number
  ): { x: number; y: number } | null {
    const pad = 4;
    const r = radius + pad;

    const offsets = [
      { dx: r, dy: -r - textH },              // Top-right
      { dx: r, dy: r },                       // Bottom-right
      { dx: -r - textW, dy: -r - textH },     // Top-left
      { dx: -r - textW, dy: r },              // Bottom-left
      { dx: -textW / 2, dy: -r - textH },     // Top-center
      { dx: -textW / 2, dy: r },              // Bottom-center
      { dx: r + 2, dy: -textH / 2 },          // Right-middle
      { dx: -r - textW - 2, dy: -textH / 2 }, // Left-middle
    ];

    for (const offset of offsets) {
      const x1 = cx + offset.dx;
      const y1 = cy + offset.dy;
      const x2 = x1 + textW;
      const y2 = y1 + textH;

      // Keep labels inside viewport bounds
      if (x1 < 6 || y1 < 6 || x2 > viewWidth - 6 || y2 > viewHeight - 6) {
        continue;
      }

      const box: BoundingBox = { x1, y1, x2, y2 };
      if (!this.isOverlapping(box)) {
        this.insertBox(box);
        return { x: x1, y: y1 };
      }
    }

    return null;
  }
}
