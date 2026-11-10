import { enemyById } from '@/content/enemies';
import { affinityRules, armours, classAffinities, qualityRules, weapons, type GearType } from '@/content/gear';
import { heroClasses, veteranRules } from '@/content/heroes';
import { traits } from '@/content/traits';

import type { EnemyUnit, FightHero, HeroUnit } from './types';

/** A hero's fight stats: class base, gear scaled by the class's affinity, their trait, and the veteran bonus to HP and damage. */
export function heroUnit(input: FightHero, crossing: string): HeroUnit {
  const { hero } = input;
  const cls = heroClasses[hero.classId];
  const base = cls.baseStats;
  const affinity = (gear: GearType) => affinityRules[classAffinities[hero.classId][gear]];
  const armour = hero.armour ? armours[hero.armour] : null;
  const armourScale = hero.armour ? affinity(hero.armour) : 1;
  // Affinity scales the piece's stats, not its flat Speed or Evasion.
  const fromArmour = (stat: 'hp' | 'armour' | 'resistance' | 'magic') => (armour?.stats[stat] ?? 0) * armourScale;
  const weapon = hero.weapon ? weapons[hero.weapon] : null;
  const trait = traits[hero.trait].effect;
  const veteran = 1 + Math.min(hero.veteran ?? 0, veteranRules.maxRooms) * veteranRules.step;
  const weaponDamage = weapon ? weapon.damage + (hero.weaponQuality ? qualityRules[hero.weaponQuality].damage : 0) : 0;

  const maxHp = Math.round((base.hp + fromArmour('hp')) * (trait.kind === 'maxHp' ? trait.multiplier : 1) * veteran);
  const stat = base[cls.damageStat] + (cls.damageStat === 'magic' ? fromArmour('magic') : 0);
  return {
    id: hero.id,
    name: hero.name,
    classId: hero.classId,
    weapon: hero.weapon,
    armourType: hero.armour,
    extraTags: input.extraTags ?? {},
    crossing,
    hp: Math.min(input.hp ?? maxHp, maxHp),
    maxHp,
    attack: (stat + (hero.weapon ? weaponDamage * affinity(hero.weapon) : 0)) * veteran,
    damageStat: cls.damageStat,
    element: weapon?.element ?? cls.element,
    armour: base.armour + fromArmour('armour'),
    resistance: base.resistance + fromArmour('resistance'),
    evasion: base.evasion + (armour?.stats.evasion ?? 0),
    speed: base.speed + (armour?.stats.speed ?? 0) + (weapon?.extras.speed ?? 0),
    crit: base.crit + (weapon?.extras.crit ?? 0) + (trait.kind === 'critBonus' ? trait.chance * 100 : 0),
    damageTaken: trait.kind === 'damageTaken' ? trait.multiplier : 1,
    tired: input.tired,
    deathsDoor: input.deathsDoor,
    status: 'standing',
    draught: input.draught ?? false,
    special: cls.special,
    specialUses: 1,
    tauntRounds: 0,
    shieldRounds: 0,
    sureCrit: false,
    knockedOut: false,
    kills: {},
  };
}

export function enemyUnit(defId: string, crossing: string, index: number): EnemyUnit {
  const def = enemyById[defId];
  if (!def) throw new Error(`Unknown enemy ${defId}`);
  return {
    uid: `${crossing}:${index}:${defId}`,
    defId,
    name: def.name,
    rank: def.rank,
    tags: def.tags,
    element: def.element,
    armour: def.armour ?? 0,
    damageType: def.damageType,
    hp: def.hp,
    maxHp: def.hp,
    damage: def.damage,
    speed: def.speed,
    home: crossing,
    crossing,
    status: 'waiting',
    centreRound: 0,
    skipTurns: 0,
    poison: null,
  };
}
