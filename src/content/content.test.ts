import { crossingTags, familyLevel, heroTags } from '@/game/families';

import { consumables } from './consumables';
import { boss, bossWeaknesses, enemies } from './enemies';
import { families, familyOfThreat, familyRules } from './families';
import { classAffinities, weapons, type WeaponType } from './gear';
import { heroClasses, startingHeroes, type HeroClassId, type HeroDef } from './heroes';
import { peddlerRules, runRules } from './run';
import { threats } from './threats';

const weaponList = Object.values(weapons);
/** The highest threat level a room shows (bosses and elites). */
const MAX_THREAT_LEVEL = 2;

describe('content', () => {
  it('gives every family at least one weapon', () => {
    for (const family of families) {
      expect(weaponList.some((w) => w.family === family.id || w.secondFamily === family.id)).toBe(true);
    }
  });

  it('tags one-handed weapons with two families and two-handed ones with one', () => {
    for (const weapon of weaponList) {
      if (weapon.twoHanded) expect(weapon.secondFamily).toBeUndefined();
      else expect(weapon.secondFamily && weapon.secondFamily !== weapon.family).toBe(true);
    }
  });

  it('never lets a class reach level 3 of its own family alone, in any gear it can carry', () => {
    const tooStrong: string[] = [];
    for (const classId of Object.keys(heroClasses) as HeroClassId[]) {
      const own = heroClasses[classId].familyTag;
      for (const weapon of Object.keys(weapons) as WeaponType[]) {
        if (familyLevel(heroTags({ classId, weapon })[own] ?? 0) >= 3) tooStrong.push(`${classId} + ${weapon}`);
      }
    }
    expect(tooStrong).toEqual([]);
  });

  it('starts no hero in unfit gear', () => {
    for (const hero of startingHeroes) {
      if (hero.weapon) expect(classAffinities[hero.classId][hero.weapon]).not.toBe('unfit');
      if (hero.armour) expect(classAffinities[hero.classId][hero.armour]).not.toBe('unfit');
    }
  });

  it("shows the Drowned King's weaknesses from the element wheel and his weak family", () => {
    expect(bossWeaknesses(boss)).toEqual([
      { kind: 'element', element: 'electric', multiplier: 1.5, reason: 'Electric beats Water' },
      { kind: 'family', family: 'spellweave', multiplier: 1.5 },
    ]);
  });

  it('lets every run buy damage in the boss\'s weakness element before the boss, without a drop', () => {
    // The peddler is reachable from every aftermath before the boss; the starting gold is enough.
    const weakTo = bossWeaknesses(boss).flatMap((w) => (w.kind === 'element' ? [w.element] : []));
    const affordable = peddlerRules.alwaysStocked
      .map((id) => consumables[id])
      .filter((c) => c.effect.kind === 'elementDamage' && weakTo.includes(c.effect.element) && c.price <= runRules.startingGold);
    expect(affordable.length).toBeGreaterThan(0);
  });

  it('answers all four threats at their highest level at once with the starting roster and gear', () => {
    const needs = threats.map((t) => familyOfThreat(t.id));
    // Each hero goes to one of the four crossings or stays on the bench (index 4).
    const answered = (slots: number[]) =>
      needs.every((family, crossing) => {
        const heroes: HeroDef[] = startingHeroes.filter((_, i) => slots[i] === crossing);
        return (crossingTags(heroes)[family] ?? 0) >= MAX_THREAT_LEVEL;
      });
    const search = (slots: number[]): boolean =>
      slots.length === startingHeroes.length ? answered(slots) : [0, 1, 2, 3, 4].some((slot) => search([...slots, slot]));
    expect(search([])).toBe(true);
  });

  it('counts families per crossing: two heroes reach a level together that neither reaches alone', () => {
    const cleric: HeroDef = { id: 'a', name: 'A', classId: 'cleric', trait: 'tough', weapon: 'censer', armour: null };
    const exorcist: HeroDef = { id: 'b', name: 'B', classId: 'exorcist', trait: 'tough', weapon: 'mace', armour: null };
    expect(familyLevel(crossingTags([cleric]).faith ?? 0)).toBe(1);
    expect(familyLevel(crossingTags([cleric, exorcist]).faith ?? 0)).toBe(3);
    expect(familyRules.levels).toEqual([2, 3, 4]);
  });

  it('has three or four enemies of each tag', () => {
    for (const tag of ['undead', 'beast', 'construct', 'cultist'] as const) {
      const count = enemies.filter((e) => e.tags.includes(tag)).length;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(4);
    }
  });
});
