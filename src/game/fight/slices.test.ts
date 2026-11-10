import { startingHeroes, type HeroDef } from '@/content/heroes';

import { resumeFight, simulateFight } from './engine';
import { sliceTimeline } from './slices';
import type { Assignment, CrossingDef, FightEvent, FightHero, FightState, RoomDef, Timeline } from './types';

const roster = Object.fromEntries(startingHeroes.map((h) => [h.id, h])) as Record<string, HeroDef>;
const fresh = (hero: HeroDef): FightHero => ({ hero, tired: false, deathsDoor: false });
const only = (...heroes: HeroDef[]) => ({ heroes: heroes.map(fresh), consumables: [] });
const crossingDef = (id: string, name: string, pack: string[], arrival: number): CrossingDef => ({
  id,
  name,
  terrain: 'open',
  pack,
  arrival,
  threats: [],
});

const busy: RoomDef = {
  id: 'r',
  name: 'R',
  crossings: [
    crossingDef('west', 'West stair', ['ghoul', 'barrowWight', 'direWolf', 'ghoul', 'direWolf'], 1),
    crossingDef('east', 'East culvert', ['direWolf', 'greyWolf', 'ghoul', 'direWolf', 'ghoul'], 2),
    crossingDef('north', 'North gate', ['rockGolem', 'clockworkGuard', 'rockGolem', 'stoneWarden'], 4),
  ],
};
const busyAssignment: Assignment = {
  west: only(roster.mira, roster.wren),
  east: only(roster.sly, roster.fen),
  north: only(roster.bram, roster.odo),
};
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const keyRounds = (t: Timeline) => new Set(t.events.filter((e) => e.importance === 3).map((e) => e.round));

/** A one-crossing timeline with set tug values and key events, for testing the choice of cuts. */
function synthetic(tugs: number[], keyAt: number[]): Timeline {
  const state = { crossings: [{ id: 'a', name: 'A', broken: false, cleared: false }], done: false } as unknown as FightState;
  const events: FightEvent[] = keyAt.map((round) => ({ round, type: 'bend', crossing: 'a', heroes: [], text: `Round ${round}`, importance: 3 }));
  return {
    seed: 's',
    snapshots: tugs.map((tug, round) => ({ round, tug: { a: tug }, state })),
    events,
    result: { rounds: tugs.length - 1, timedOut: false, crossings: {}, heroes: {}, extraLootRolls: {}, looted: [] },
  };
}

describe('sliceTimeline', () => {
  it('gives one slice per action plus one, covering the fight with no gaps', () => {
    for (const seed of SEEDS) {
      const t = simulateFight(busy, busyAssignment, seed);
      for (const count of [2, 3, 4]) {
        const slices = sliceTimeline(t, count);
        expect(slices).toHaveLength(count);
        expect(slices[0].fromRound).toBe(0);
        slices.slice(1).forEach((s, i) => expect(s.fromRound).toBe(slices[i].toRound));
        for (const s of slices) {
          expect(s.toRound).toBeGreaterThan(s.fromRound);
          expect(s.snapshot.round).toBe(s.toRound);
        }
      }
    }
  });

  it('ends the last slice with the fight', () => {
    for (const seed of SEEDS) {
      const t = simulateFight(busy, busyAssignment, seed);
      const last = sliceTimeline(t, 4).at(-1)!;
      expect(last.toRound).toBe(t.result.rounds);
      expect(last.snapshot.state.done).toBe(true);
    }
  });

  it('ends the other slices on rounds with a key event when there are enough of them', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const t = simulateFight(busy, busyAssignment, seed);
      const key = keyRounds(t);
      key.delete(t.result.rounds);
      if (key.size < 2) continue;
      checked += 1;
      for (const s of sliceTimeline(t, 3).slice(0, -1)) expect(key.has(s.toRound)).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('prefers the most uncertain key moments: a tug near 0.5, or falling fast', () => {
    expect(sliceTimeline(synthetic([0.7, 0.95, 0.9, 0.5, 0.9, 0.9, 1], [1, 3, 5]), 2)[0].toRound).toBe(3);
    expect(sliceTimeline(synthetic([0.7, 0.95, 0.9, 0.85, 0.9, 0.15, 0], [1, 3, 5]), 2)[0].toRound).toBe(5);
  });

  it('cuts evenly by rounds with too few key events', () => {
    expect(sliceTimeline(synthetic([0.5, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.8], [4]), 4).map((s) => s.toRound)).toEqual([2, 4, 6, 8]);
  });

  it('shows calm lines for the crossings that stayed quiet', () => {
    const late: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('east', 'East culvert', ['giantRat'], 9), crossingDef('west', 'West stair', ['giantRat'], 9)] };
    const t = simulateFight(late, { east: only(roster.bram), west: only(roster.odo) }, 'seed');
    const [first] = sliceTimeline(t, 4);
    expect(first.lines).toEqual([
      { crossing: 'east', text: 'East culvert: quiet so far', heroes: [], importance: 0 },
      { crossing: 'west', text: 'West stair: quiet so far', heroes: [], importance: 0 },
    ]);
  });

  it('keeps at most 3 lines per slice, key events first', () => {
    for (const seed of SEEDS) {
      for (const s of sliceTimeline(simulateFight(busy, busyAssignment, seed), 4)) {
        expect(s.lines.length).toBeLessThanOrEqual(3);
        s.lines.slice(1).forEach((line, i) => expect(line.importance).toBeLessThanOrEqual(s.lines[i].importance));
      }
    }
  });

  it('slices a fight shorter than the action budget one round at a time', () => {
    const quick: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', 'A', ['giantRat'], 1)] };
    const t = simulateFight(quick, { a: only(roster.bram, roster.mira) }, 'seed');
    expect(t.result.rounds).toBeLessThan(4);
    expect(sliceTimeline(t, 4).map((s) => s.toRound)).toEqual(Array.from({ length: t.result.rounds }, (_, i) => i + 1));
  });

  it('slices a resumed fight in 2 from the intervention round, after a Go forward', () => {
    for (const seed of SEEDS) {
      const original = simulateFight(busy, busyAssignment, seed);
      const resumed = resumeFight(original.snapshots[2], { kind: 'addHero', crossingId: 'west', hero: fresh({ ...roster.bram, id: 'bram2' }) }, seed);
      const slices = sliceTimeline(resumed, 2);
      expect(slices).toHaveLength(2);
      expect(slices[0].fromRound).toBe(2);
      expect(slices[0].lines[0]).toMatchObject({ importance: 3, text: expect.stringContaining('The strategist sends') });
      expect(slices[1].toRound).toBe(resumed.result.rounds);
      expect(slices[1].snapshot.state.done).toBe(true);
    }
  });
});
