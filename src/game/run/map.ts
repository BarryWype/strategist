import { mapRules, runRules } from '@/content/run';

import { createRng } from '../generation/rng';
import type { MapNode, NodeType, RunMap, RunState } from './types';

/** The run's map: rows of 2–3 nodes, links that never cross, the boss alone on the last row. */
export function generateMap(seed: string): RunMap {
  const rng = createRng(`${seed}:map`);
  const rows: MapNode[][] = [];
  for (let row = 0; row < runRules.rows - 1; row++) {
    const count = rng.int(mapRules.nodesPerRow.min, mapRules.nodesPerRow.max);
    const types = (Object.entries(mapRules.types) as [Exclude<NodeType, 'boss'>, { weight: number; fromRow: number }][]).filter(
      ([, t]) => row >= t.fromRow,
    );
    rows.push(
      Array.from({ length: count }, (_, i) => ({
        id: `r${row}n${i}`,
        row,
        type: rng.weighted(types, ([, t]) => t.weight)[0],
        next: [],
      })),
    );
  }
  rows.push([{ id: 'boss', row: runRules.rows - 1, type: 'boss', next: [] }]);

  for (let row = 0; row < rows.length - 1; row++) {
    const from = rows[row];
    const to = rows[row + 1];
    // Spread evenly, so the first and last nodes of each row meet and links keep their order.
    const spread = (i: number, a: number, b: number) => (a === 1 ? 0 : Math.round((i * (b - 1)) / (a - 1)));
    const targets = from.map((_, i) => [spread(i, from.length, to.length)]);
    to.forEach((_, j) => {
      if (!targets.some((t) => t.includes(j))) targets[spread(j, to.length, from.length)].push(j);
    });
    targets.forEach((t, i) => {
      if (t.length >= 2 || !rng.chance(mapRules.secondLink)) return;
      const right = Math.max(...t) + 1;
      const left = Math.min(...t) - 1;
      const rightFree = right < to.length && targets.slice(i + 1).every((o) => Math.min(...o) >= right);
      const leftFree = left >= 0 && targets.slice(0, i).every((o) => Math.max(...o) <= left);
      if (rightFree) t.push(right);
      else if (leftFree) t.push(left);
    });
    from.forEach((node, i) => (node.next = targets[i].sort((a, b) => a - b).map((j) => to[j].id)));
  }
  return { rows };
}

export function nodeById(map: RunMap, id: string): MapNode {
  const node = map.rows.flat().find((n) => n.id === id);
  if (!node) throw new Error(`Unknown node ${id}`);
  return node;
}

/** The nodes the party can enter next. */
export function nextNodes(state: Pick<RunState, 'map' | 'at'>): MapNode[] {
  if (state.at === null) return state.map.rows[0];
  const ids = nodeById(state.map, state.at).next;
  return state.map.rows.flat().filter((n) => ids.includes(n.id));
}

/** How many rows ahead show their node types: 2, or 3 with Watch 2 on a crossing of the last room, or a Scout on their feet. */
export function sightRange(state: Pick<RunState, 'roster' | 'watchSight'>): number {
  const scout = state.roster.some((r) => r.hero.classId === 'scout' && !r.deathsDoor);
  return runRules.sight + (scout || state.watchSight ? 1 : 0);
}

/**
 * What the map shows of a node: its room in full (the rows walked and the next one),
 * its type (within sight, and the boss from the start), or only that it exists.
 */
export function nodeVisibility(state: Pick<RunState, 'map' | 'at' | 'roster' | 'watchSight'>, node: MapNode): 'room' | 'type' | 'hidden' {
  const row = state.at === null ? -1 : nodeById(state.map, state.at).row;
  if (node.row <= row + 1) return 'room';
  if (node.row <= row + sightRange(state) || node.type === 'boss') return 'type';
  return 'hidden';
}
