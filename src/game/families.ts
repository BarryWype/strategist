import { familyOfThreat, familyRules, type FamilyId } from '@/content/families';
import { heroClasses, type HeroDef } from '@/content/heroes';
import { weapons } from '@/content/gear';
import type { ThreatId } from '@/content/threats';

export type FamilyCounts = Partial<Record<FamilyId, number>>;

/** A hero's family tags: one from their class, one or two from their weapon. */
export function heroTags(hero: Pick<HeroDef, 'classId' | 'weapon'>): FamilyCounts {
  const counts: FamilyCounts = {};
  const add = (family: FamilyId, n: number) => (counts[family] = (counts[family] ?? 0) + n);
  add(heroClasses[hero.classId].familyTag, 1);
  if (hero.weapon) {
    const weapon = weapons[hero.weapon];
    add(weapon.family, weapon.twoHanded ? 2 : 1);
    if (weapon.secondFamily) add(weapon.secondFamily, 1);
  }
  return counts;
}

/** The tags of every hero on one crossing, summed. */
export function crossingTags(heroes: Pick<HeroDef, 'classId' | 'weapon'>[]): FamilyCounts {
  const counts: FamilyCounts = {};
  for (const hero of heroes) {
    for (const [family, n] of Object.entries(heroTags(hero)) as [FamilyId, number][]) {
      counts[family] = (counts[family] ?? 0) + n;
    }
  }
  return counts;
}

/** The level (0–3) a tag count reaches. */
export function familyLevel(count: number): number {
  return familyRules.levels.filter((threshold) => count >= threshold).length;
}

/** The family tags on a crossing: its heroes' own, their earned tags, and any bonus tags (holy water). */
export function familyCounts(heroes: { hero: Pick<HeroDef, 'classId' | 'weapon'>; extraTags?: FamilyCounts }[], bonus: FamilyCounts = {}): FamilyCounts {
  const counts = crossingTags(heroes.map((h) => h.hero));
  for (const extra of [...heroes.map((h) => h.extraTags ?? {}), bonus]) {
    for (const [family, n] of Object.entries(extra) as [FamilyId, number][]) counts[family] = (counts[family] ?? 0) + n;
  }
  return counts;
}

export function familyLevels(counts: FamilyCounts): Partial<Record<FamilyId, number>> {
  return Object.fromEntries(Object.entries(counts).map(([family, n]) => [family, familyLevel(n ?? 0)]));
}

/** A threat at level N is answered by N tags of its family on the crossing. */
export function answers(counts: FamilyCounts, threat: { id: ThreatId; level: number }): boolean {
  return (counts[familyOfThreat(threat.id)] ?? 0) >= threat.level;
}
