import { boss, elites } from '@/content/enemies';
import { roomRules, runRules } from '@/content/run';

import { generateMap, nextNodes, nodeVisibility, sightRange } from './map';
import { generateRoom } from './rooms';
import { newRun } from './run';
import type { RunState } from './types';

const SEEDS = Array.from({ length: 30 }, (_, i) => `seed${i}`);

describe('run map', () => {
  it('is the same for the same seed and differs between seeds', () => {
    expect(generateMap('a')).toEqual(generateMap('a'));
    expect(SEEDS.map((s) => JSON.stringify(generateMap(s))).some((m) => m !== JSON.stringify(generateMap('a')))).toBe(true);
  });

  it('has 9 rows of 2–3 nodes, the boss alone at the end, and links of 1–2 nodes that reach every node without crossing', () => {
    for (const seed of SEEDS) {
      const { rows } = generateMap(seed);
      expect(rows).toHaveLength(runRules.rows);
      expect(rows.at(-1)!.map((n) => n.type)).toEqual(['boss']);
      for (const [r, row] of rows.slice(0, -1).entries()) {
        expect(row.length).toBeGreaterThanOrEqual(2);
        expect(row.length).toBeLessThanOrEqual(3);
        const next = rows[r + 1];
        const indexOf = (id: string) => next.findIndex((n) => n.id === id);
        for (const node of row) {
          expect(node.next.length).toBeGreaterThanOrEqual(1);
          expect(node.next.length).toBeLessThanOrEqual(2);
          expect(node.next.every((id) => indexOf(id) >= 0)).toBe(true);
        }
        for (const target of next) expect(row.some((n) => n.next.includes(target.id))).toBe(true);
        row.slice(1).forEach((node, i) => {
          expect(Math.min(...node.next.map(indexOf))).toBeGreaterThanOrEqual(Math.max(...row[i].next.map(indexOf)));
        });
      }
    }
  });

  it('keeps camps, vaults and elites off the first rows', () => {
    for (const seed of SEEDS) {
      const { rows } = generateMap(seed);
      expect(rows[0].every((n) => n.type === 'fight')).toBe(true);
      expect(rows.slice(0, 2).flat().some((n) => n.type === 'camp')).toBe(false);
      expect(rows.slice(0, 3).flat().some((n) => n.type === 'elite')).toBe(false);
    }
  });
});

describe('room generation', () => {
  it('gives each node the same room every time, with crossings fitting its row', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const node of generateMap(seed).rows.flat()) {
        const room = generateRoom(seed, node);
        expect(generateRoom(seed, node)).toEqual(room);
        if (node.type === 'camp') {
          expect(room).toBeNull();
          continue;
        }
        expect(roomRules.crossings[node.row]).toContain(room!.crossings.length);
        expect(room!.crossings[0].arrival).toBe(1);
        for (const c of room!.crossings) {
          expect([1, 2, 3]).toContain(c.arrival);
          expect(c.threats.length).toBeLessThanOrEqual(1);
          for (const t of c.threats) expect([1, 2]).toContain(t.level);
        }
        if (node.type === 'boss') expect(room!.crossings[0]).toMatchObject({ pack: expect.arrayContaining([boss.id]), threats: [{ level: 2 }] });
        if (node.type === 'elite') expect(elites.map((e) => e.id)).toContain(room!.crossings[0].pack[0]);
      }
    }
  });
});

describe('sight', () => {
  const withRoster = (s: RunState, keep: (classId: string) => boolean): RunState => ({ ...s, roster: s.roster.filter((r) => keep(r.hero.classId)) });

  it('shows the next row in full and the row after as types; further rows only exist, except the boss', () => {
    const s = withRoster(newRun('seed'), (c) => c !== 'scout');
    expect(sightRange(s)).toBe(2);
    expect(s.map.rows[0].map((n) => nodeVisibility(s, n))).toEqual(s.map.rows[0].map(() => 'room'));
    expect(s.map.rows[1].every((n) => nodeVisibility(s, n) === 'type')).toBe(true);
    expect(s.map.rows[2].every((n) => nodeVisibility(s, n) === 'hidden')).toBe(true);
    expect(nodeVisibility(s, s.map.rows.at(-1)![0])).toBe('type');

    const further = { ...s, at: s.map.rows[2][0].id };
    expect(s.map.rows[3].every((n) => nodeVisibility(further, n) === 'room')).toBe(true);
    expect(s.map.rows[4].every((n) => nodeVisibility(further, n) === 'type')).toBe(true);
    expect(s.map.rows[5].every((n) => nodeVisibility(further, n) === 'hidden')).toBe(true);
  });

  it('adds a row with a Scout on their feet, or with Watch 2 on a crossing of the last room', () => {
    const s = newRun('seed');
    expect(sightRange(s)).toBe(3);
    expect(s.map.rows[2].every((n) => nodeVisibility(s, n) === 'type')).toBe(true);
    const scoutDown = { ...s, roster: s.roster.map((r) => (r.hero.classId === 'scout' ? { ...r, deathsDoor: true } : r)) };
    expect(sightRange(scoutDown)).toBe(2);
    expect(sightRange({ ...scoutDown, watchSight: true })).toBe(3);
    // Watch tags across the party don't count.
    const noScout = withRoster(s, (c) => c !== 'scout');
    noScout.roster[0] = { ...noScout.roster[0], extraTags: { watch: 5 } };
    expect(sightRange(noScout)).toBe(2);
  });

  it('only lets the party enter the nodes linked to where it stands', () => {
    const s = newRun('seed');
    expect(nextNodes(s)).toEqual(s.map.rows[0]);
    const at = s.map.rows[3][0];
    expect(nextNodes({ ...s, at: at.id }).map((n) => n.id)).toEqual(at.next);
  });
});
