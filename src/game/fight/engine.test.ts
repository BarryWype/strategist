import { enemyById } from '@/content/enemies';
import { startingHeroes, type HeroDef } from '@/content/heroes';

import { affinityRules, classAffinities, weaponName } from '@/content/gear';

import { crossingLevels, resumeFight, simulateFight } from './engine';
import { heroUnit } from './units';
import type { Assignment, CrossingDef, FightHero, RoomDef } from './types';

const roster = Object.fromEntries(startingHeroes.map((h) => [h.id, h])) as Record<string, HeroDef>;
const fresh = (hero: HeroDef, extra: Partial<FightHero> = {}): FightHero => ({ hero, tired: false, deathsDoor: false, ...extra });
const crossingDef = (id: string, pack: string[], extra: Partial<CrossingDef> = {}): CrossingDef => ({
  id,
  name: id,
  terrain: 'open',
  pack,
  arrival: 1,
  threats: [],
  ...extra,
});
const only = (heroes: FightHero[]) => ({ heroes, consumables: [] });

const room: RoomDef = {
  id: 'cistern',
  name: 'The cistern',
  crossings: [
    crossingDef('west', ['ghoul', 'restlessBones', 'barrowWight'], { threats: [{ id: 'holy', level: 1 }] }),
    crossingDef('east', ['greyWolf', 'direWolf'], { terrain: 'narrow', arrival: 2 }),
    crossingDef('north', ['clockworkGuard', 'brassBeetle', 'rockGolem'], { arrival: 3 }),
  ],
};
const assignment: Assignment = {
  west: only([fresh(roster.odo), fresh(roster.mira)]),
  east: only([fresh(roster.bram), fresh(roster.fen)]),
  north: only([fresh(roster.sly), fresh(roster.wren)]),
};
const SEEDS = ['s1', 's2', 's3', 's4', 's5', 's6'];

describe('fight engine', () => {
  it('plays the same timeline for the same input', () => {
    expect(simulateFight(room, assignment, 'seed')).toEqual(simulateFight(room, assignment, 'seed'));
  });

  it('gives a different timeline for another seed', () => {
    expect(simulateFight(room, assignment, 'a').events).not.toEqual(simulateFight(room, assignment, 'b').events);
  });

  it('carries on exactly as the original when resumed from any round without an intervention', () => {
    for (const seed of SEEDS) {
      const original = simulateFight(room, assignment, seed);
      for (const snapshot of original.snapshots) {
        const resumed = resumeFight(snapshot, null, seed);
        expect(resumed.snapshots).toEqual(original.snapshots.slice(snapshot.round));
        expect(resumed.events).toEqual(original.events.filter((e) => e.round > snapshot.round));
        expect(resumed.result).toEqual(original.result);
      }
    }
  });

  it('changes the fight with an intervention', () => {
    const lone: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', ['ghoul', 'direWolf', 'ghoul'], { arrival: 2 })] };
    const results = SEEDS.map((seed) => {
      const original = simulateFight(lone, { a: only([fresh(roster.mira)]) }, seed);
      const helped = resumeFight(original.snapshots[1], { kind: 'addHero', crossingId: 'a', hero: fresh(roster.bram) }, seed);
      expect(helped.snapshots).not.toEqual(original.snapshots.slice(1));
      expect(helped.events[0]).toMatchObject({ round: 1, type: 'intervention', importance: 3 });
      return [original.result.crossings.a, helped.result.crossings.a];
    });
    expect(results.every(([before]) => before === 'broken')).toBe(true);
    expect(results.some(([, after]) => after !== 'broken')).toBe(true);
  });

  it('keeps the luck after an intervention: a healed hero has more HP in every later snapshot until hit again', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const original = simulateFight(room, assignment, seed);
      const from = original.snapshots.find((snap) => {
        const odo = snap.state.heroes.find((h) => h.id === 'odo')!;
        return !snap.state.done && odo.status === 'standing' && odo.hp < odo.maxHp;
      });
      if (!from) continue;
      const healed = resumeFight(from, { kind: 'heal', heroId: 'odo' }, seed);
      expect(healed.snapshots[0].state.rng).toEqual(from.state.rng);
      const hp = (snap: (typeof healed.snapshots)[number]) => snap.state.heroes.find((h) => h.id === 'odo')!.hp;
      let last = hp(healed.snapshots[0]);
      for (const snap of healed.snapshots.slice(1)) {
        if (hp(snap) < last) break;
        expect(hp(snap)).toBeGreaterThan(hp(original.snapshots[snap.round]));
        last = hp(snap);
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('breaks an empty crossing as its pack arrives: the strongest half joins the crossing with the most HP two rounds later, the rest loot', () => {
    const breach: RoomDef = {
      id: 'r',
      name: 'R',
      crossings: [
        crossingDef('empty', ['giantRat', 'greyWolf', 'giantRat'], { name: 'Stairs' }),
        crossingDef('strong', ['ghoul'], { arrival: 4 }),
        crossingDef('weak', ['ghoul'], { arrival: 4 }),
      ],
    };
    const t = simulateFight(breach, { strong: only([fresh(roster.bram), fresh(roster.odo)]), weak: only([fresh(roster.wren)]) }, 'seed');
    const pack = (round: number) => t.snapshots[round].state.enemies.filter((e) => e.home === 'empty').map((e) => [e.defId, e.status, e.crossing]);
    expect(t.events).toContainEqual(expect.objectContaining({ round: 1, type: 'breach', crossing: 'empty', importance: 3 }));
    expect(t.events).toContainEqual(expect.objectContaining({ round: 1, crossing: 'empty', text: 'Half of them stay to loot the stairs.', importance: 2 }));
    // Three enemies: two move on, the wolf (the strongest) among them; one rat stays.
    expect(pack(1)).toEqual([
      ['giantRat', 'centre', null],
      ['greyWolf', 'centre', null],
      ['giantRat', 'looting', 'empty'],
    ]);
    expect(pack(2)).toEqual(pack(1));
    expect(pack(3).map(([, , crossing]) => crossing)).toEqual(['strong', 'strong', 'empty']);
    expect(t.events).toContainEqual(expect.objectContaining({ round: 3, type: 'join', crossing: 'strong' }));
    expect(t.result.crossings.empty).toBe('broken');
    expect(t.result.looted).toEqual(['empty']);
  });

  it("sends a fresh hero to death's door and kills one already there", () => {
    const deadly: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', ['direWolf', 'direWolf', 'ghoul', 'ghoul'])] };
    const freshRun = simulateFight(deadly, { a: only([fresh(roster.wren)]) }, 'seed');
    expect(freshRun.result.heroes.wren).toMatchObject({ knockedOut: true, deathsDoor: true, dead: false });
    expect(freshRun.events).toContainEqual(expect.objectContaining({ type: 'knockout', importance: 3, heroes: ['wren'] }));

    const doorRun = simulateFight(deadly, { a: only([fresh(roster.wren, { deathsDoor: true })]) }, 'seed');
    expect(doorRun.result.heroes.wren).toMatchObject({ knockedOut: true, dead: true });
    expect(doorRun.events).toContainEqual(expect.objectContaining({ type: 'death', importance: 3 }));
    expect(doorRun.result.crossings.a).toBe('broken');
  });

  it("applies a threat's penalty only on the crossing that misses it", () => {
    const holy = { threats: [{ id: 'holy' as const, level: 2 }] };
    const r: RoomDef = {
      id: 'r',
      name: 'R',
      crossings: [crossingDef('missed', ['ghoul'], holy), crossingDef('answered', ['ghoul'], holy), crossingDef('short', ['ghoul'], holy)],
    };
    const t = simulateFight(
      r,
      {
        // Bram has no Faith; Odo (cleric, mace) has 2; Mira's wand none, but holy water adds 1: one short.
        missed: only([fresh(roster.bram)]),
        answered: only([fresh(roster.odo)]),
        short: { heroes: [fresh(roster.mira)], consumables: ['holyWater'] },
      },
      'seed',
    );
    const ghoulHp = (crossing: string) => t.snapshots[1].state.enemies.find((e) => e.home === crossing)!.maxHp;
    const hp = enemyById.ghoul.hp;
    expect(ghoulHp('answered')).toBe(hp);
    expect(ghoulHp('missed')).toBe(Math.round(hp * 1.8));
    expect(ghoulHp('short')).toBe(Math.round(hp * 1.4));
  });

  it('counts families per crossing: split across two crossings, the same heroes lose their level', () => {
    const cleric: HeroDef = { id: 'c', name: 'C', classId: 'cleric', trait: 'tough', weapon: 'censer', armour: 'mail' };
    const exorcist: HeroDef = { id: 'x', name: 'X', classId: 'exorcist', trait: 'tough', weapon: 'mace', armour: 'mail' };
    const r: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', ['ghoul']), crossingDef('b', ['ghoul'])] };
    const together = simulateFight(r, { a: only([fresh(cleric), fresh(exorcist)]) }, 'seed').snapshots[0].state;
    const split = simulateFight(r, { a: only([fresh(cleric)]), b: only([fresh(exorcist)]) }, 'seed').snapshots[0].state;
    expect(crossingLevels(together, 'a').faith).toBe(3);
    expect(crossingLevels(split, 'a').faith).toBe(1);
    expect(crossingLevels(split, 'b').faith).toBe(1);
  });

  it('records a snapshot per round with a tug value per crossing and ends every crossing held, bent or broken', () => {
    const t = simulateFight(room, assignment, 'seed');
    expect(t.snapshots.map((s) => s.round)).toEqual(t.snapshots.map((_, i) => i));
    for (const s of t.snapshots) {
      for (const tug of Object.values(s.tug)) expect(tug).toBeGreaterThanOrEqual(0);
      for (const tug of Object.values(s.tug)) expect(tug).toBeLessThanOrEqual(1);
    }
    for (const result of Object.values(t.result.crossings)) expect(['held', 'bent', 'broken']).toContain(result);
  });

  it('judges a crossing on the whole room: cleared, reopened by a breach, a hero knocked out → Bent', () => {
    const r: RoomDef = {
      id: 'r',
      name: 'R',
      crossings: [crossingDef('a', ['giantRat']), crossingDef('empty', ['direWolf', 'direWolf'], { arrival: 3 })],
    };
    // The seed where the rat falls first, the breached pack reopens the crossing, Wren is knocked out, and Bram clears it again.
    let found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const t = simulateFight(r, { a: only([fresh(roster.bram), fresh(roster.wren, { hp: 3 })]) }, `s${i}`);
      const onA = t.events.filter((e) => e.crossing === 'a').map((e) => e.type);
      const join = onA.indexOf('join');
      if (onA.indexOf('cleared') < 0 || join < onA.indexOf('cleared') || onA.indexOf('knockout') < join || onA.at(-1) !== 'cleared') continue;
      expect(t.result.crossings.a).toBe('bent');
      found = true;
    }
    expect(found).toBe(true);
  });

  it('caps a narrow crossing at 2 enemy attacks a round', () => {
    const pack = ['giantRat', 'giantRat', 'giantRat', 'giantRat', 'giantRat'];
    const hits = (terrain: 'narrow' | 'open') => {
      const r: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', pack, { terrain })] };
      return SEEDS.reduce((sum, seed) => {
        const t = simulateFight(r, { a: only([fresh(roster.bram)]) }, seed);
        return sum + t.snapshots[0].state.heroes[0].hp - t.snapshots[1].state.heroes[0].hp;
      }, 0);
    };
    expect(hits('narrow')).toBeLessThan(hits('open') * 0.6);
  });

  it('flags a room that hits the round cap', () => {
    const r: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', ['ghoul'], { arrival: 99 })] };
    const t = simulateFight(r, { a: only([fresh(roster.bram)]) }, 'seed');
    expect(t.result).toMatchObject({ rounds: 30, timedOut: true });
    expect(simulateFight(room, assignment, 'seed').result.timedOut).toBe(false);
  });

  it('starts a resumed timeline at the intervention round, ready to be sliced', () => {
    const original = simulateFight(room, assignment, 'seed');
    const resumed = resumeFight(original.snapshots[2], { kind: 'heal', heroId: 'odo' }, 'seed');
    expect(resumed.snapshots[0].round).toBe(2);
    expect(resumed.snapshots.map((s) => s.round)).toEqual(resumed.snapshots.map((_, i) => i + 2));
    expect(resumed.events.every((e) => e.round >= 2)).toBe(true);
    expect(resumed.snapshots.at(-1)!.state.done).toBe(true);
  });

  it('holds a crossing only if it never bent and lost no one; one that bent and still cleared is Bent', () => {
    const r: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', ['direWolf', 'direWolf', 'ghoul', 'greyWolf'])] };
    let found = false;
    for (let i = 0; i < 300 && !found; i++) {
      const t = simulateFight(r, { a: only([fresh(roster.bram), fresh(roster.odo)]) }, `bend${i}`);
      const bent = t.events.some((e) => e.type === 'bend');
      const knockout = t.events.some((e) => e.type === 'knockout' || e.type === 'death');
      if (knockout || t.result.crossings.a === 'broken') continue;
      expect(t.result.crossings.a).toBe(bent ? 'bent' : 'held');
      found = bent;
    }
    expect(found).toBe(true);
  });

  it('adds weapon quality to the weapon’s damage and the veteran bonus to HP and damage', () => {
    const unit = (extra: Partial<HeroDef>) => heroUnit(fresh({ ...roster.odo, ...extra }), 'a');
    const base = unit({});
    // The bonus is scaled by the class's affinity for the weapon, like its damage.
    const affinity = affinityRules[classAffinities.cleric.mace];
    expect(unit({ weaponQuality: 'fine' }).attack - base.attack).toBeCloseTo(2 * affinity);
    expect(unit({ weaponQuality: 'masterwork' }).attack - base.attack).toBeCloseTo(4 * affinity);
    // Max HP is rounded once, after the bonus.
    expect(Math.abs(unit({ veteran: 3 }).maxHp - base.maxHp * 1.15)).toBeLessThanOrEqual(1);
    expect(unit({ veteran: 3 }).attack).toBeCloseTo(base.attack * 1.15);
    expect(unit({ veteran: 9 })).toMatchObject({ maxHp: unit({ veteran: 5 }).maxHp, attack: unit({ veteran: 5 }).attack });
    expect(weaponName({ type: 'mace', quality: 'fine' })).toBe('Fine mace');
  });

  it('makes tired heroes hit softer', () => {
    const r: RoomDef = { id: 'r', name: 'R', crossings: [crossingDef('a', ['rockGolem'])] };
    const golemHp = (tired: boolean) => simulateFight(r, { a: only([fresh(roster.bram, { tired })]) }, 'seed').snapshots[1].state.enemies[0].hp;
    expect(golemHp(true)).toBeGreaterThan(golemHp(false));
  });
});
