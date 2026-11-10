import type { Terrain } from '@/content/fight';

/** The room drawing's frame: the chamber in the middle, corridors out to its crossings. */
export const ROOM = { width: 390, height: 540, cx: 195, cy: 300, hw: 74, hh: 62 };

/** Corridor directions in degrees (0 east, −90 north), by crossing count; south leads back to the room behind. */
const ANGLES: Record<number, number[]> = { 1: [-90], 2: [180, 0], 3: [180, -90, 0], 4: [180, -130, -50, 0] };

const WIDTH: Record<Terrain, number> = { open: 36, narrow: 22, dark: 30, flooded: 30 };

export type Point = { x: number; y: number };

export type Corridor = {
  angle: number;
  width: number;
  /** Distances from the chamber's centre: where the corridor leaves the chamber, and where it ends. */
  mouth: number;
  end: number;
  /** Mostly east–west rather than north–south. */
  sideways: boolean;
  /** −1 west, 1 east, 0 north. */
  side: -1 | 0 | 1;
  /** A point `d` along the corridor, `across` to its side. */
  at: (d: number, across?: number) => Point;
};

export function corridor(index: number, count: number, terrain: Terrain): Corridor {
  const angle = (ANGLES[count] ?? ANGLES[4])[index];
  const dx = Math.cos((angle * Math.PI) / 180);
  const dy = Math.sin((angle * Math.PI) / 180);
  const mouth = Math.min(Math.abs(dx) > 1e-6 ? ROOM.hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? ROOM.hh / Math.abs(dy) : Infinity);
  const end = Math.min(Math.abs(dx) > 1e-6 ? 168 / Math.abs(dx) : Infinity, dy < -1e-6 ? (ROOM.cy - 92) / -dy : Infinity);
  const sideways = Math.abs(dx) > 0.5;
  return {
    angle,
    width: WIDTH[terrain],
    mouth,
    end,
    sideways,
    side: sideways ? (dx < 0 ? -1 : 1) : 0,
    at: (d, across = 0) => ({ x: ROOM.cx + dx * d - dy * across, y: ROOM.cy + dy * d + dx * across }),
  };
}

/** Where the i-th of `count` hero tokens stands, holding the corridor from `front` back toward the chamber. */
export function tokenSlot(c: Corridor, i: number, count: number, front = c.mouth + 18): Point {
  const pairs = count > 2;
  const d = Math.min(front, c.mouth + 18) - (pairs ? Math.floor(i / 2) : i) * 32;
  return c.at(d, pairs ? (i % 2 ? 16 : -16) : 0);
}

/** The front line's distance along the corridor: at the mouth when the pack has pushed in (tug 0), near the end when held (tug 1). */
export function frontAt(c: Corridor, tug: number): number {
  return c.mouth + 8 + tug * (c.end - 30 - c.mouth - 8);
}
