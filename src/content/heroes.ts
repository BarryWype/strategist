// From pocket-quartermaster src/content/heroes.ts, trimmed for the POC.

import type { ImageSourcePropType } from 'react-native';

import type { Element } from './elements';
import type { FamilyId } from './families';
import type { ArmourType, WeaponQuality, WeaponType } from './gear';
import type { SpecialId } from './specials';
import type { TraitId } from './traits';

export type HeroClassId =
  | 'warrior'
  | 'paladin'
  | 'barbarian'
  | 'fireMage'
  | 'troubadour'
  | 'cleric'
  | 'exorcist'
  | 'druid'
  | 'scout'
  | 'thief';

export type Stats = { hp: number; power: number; magic: number; armour: number; resistance: number; evasion: number; speed: number; crit: number };

export type HeroClassDef = {
  id: HeroClassId;
  name: string;
  familyTag: FamilyId;
  baseStats: Stats;
  damageStat: 'power' | 'magic';
  special: SpecialId;
  element?: Element;
  portrait: ImageSourcePropType;
};

export const heroClasses: Record<HeroClassId, HeroClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    familyTag: 'bulwark',
    baseStats: { hp: 30, power: 4, magic: 0, armour: 3, resistance: 1, evasion: 0, speed: 5, crit: 5 },
    damageStat: 'power',
    special: 'taunt',
    portrait: require('../../assets/characters/warrior/290.png'),
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    familyTag: 'bulwark',
    baseStats: { hp: 32, power: 3, magic: 0, armour: 4, resistance: 3, evasion: 0, speed: 5, crit: 5 },
    damageStat: 'power',
    special: 'smite',
    portrait: require('../../assets/characters/paladin/237.png'),
  },
  barbarian: {
    id: 'barbarian',
    name: 'Barbarian',
    familyTag: 'bloodrage',
    baseStats: { hp: 32, power: 6, magic: 0, armour: 0, resistance: 1, evasion: 0, speed: 5, crit: 10 },
    damageStat: 'power',
    special: 'cleave',
    portrait: require('../../assets/characters/barbarian/282.png'),
  },
  fireMage: {
    id: 'fireMage',
    name: 'Fire mage',
    familyTag: 'spellweave',
    baseStats: { hp: 22, power: 0, magic: 6, armour: 0, resistance: 1, evasion: 0, speed: 7, crit: 10 },
    damageStat: 'magic',
    special: 'elementalBlast',
    element: 'fire',
    portrait: require('../../assets/characters/fire-mage/342.png'),
  },
  troubadour: {
    id: 'troubadour',
    name: 'Troubadour',
    familyTag: 'rally',
    baseStats: { hp: 22, power: 2, magic: 2, armour: 1, resistance: 1, evasion: 5, speed: 7, crit: 5 },
    damageStat: 'magic',
    special: 'distraction',
    portrait: require('../../assets/characters/troubadour/120.png'),
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    familyTag: 'faith',
    baseStats: { hp: 26, power: 2, magic: 3, armour: 2, resistance: 3, evasion: 0, speed: 5, crit: 5 },
    damageStat: 'magic',
    special: 'mend',
    portrait: require('../../assets/characters/cleric/257.png'),
  },
  exorcist: {
    id: 'exorcist',
    name: 'Exorcist',
    familyTag: 'faith',
    baseStats: { hp: 26, power: 5, magic: 0, armour: 2, resistance: 3, evasion: 0, speed: 5, crit: 10 },
    damageStat: 'power',
    special: 'banish',
    portrait: require('../../assets/characters/exorcist/80.png'),
  },
  druid: {
    id: 'druid',
    name: 'Druid',
    familyTag: 'wild',
    baseStats: { hp: 24, power: 0, magic: 5, armour: 1, resistance: 1, evasion: 5, speed: 5, crit: 5 },
    damageStat: 'magic',
    special: 'entangle',
    element: 'grass',
    portrait: require('../../assets/characters/druid/333.png'),
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    familyTag: 'watch',
    baseStats: { hp: 22, power: 5, magic: 0, armour: 1, resistance: 1, evasion: 5, speed: 7, crit: 5 },
    damageStat: 'power',
    special: 'aimedStrike',
    portrait: require('../../assets/characters/scout/427.png'),
  },
  thief: {
    id: 'thief',
    name: 'Thief',
    familyTag: 'cunning',
    baseStats: { hp: 22, power: 5, magic: 0, armour: 1, resistance: 1, evasion: 5, speed: 5, crit: 10 },
    damageStat: 'power',
    special: 'poison',
    portrait: require('../../assets/characters/thief/302.png'),
  },
};

/** A hero as the roster holds them between rooms. */
export type HeroDef = {
  id: string;
  name: string;
  classId: HeroClassId;
  trait: TraitId;
  weapon: WeaponType | null;
  armour: ArmourType | null;
  /** The carried weapon's quality; the starting gear has none. */
  weaponQuality?: WeaponQuality;
  /** Rooms fought this run, toward the veteran bonus (veteranRules). */
  veteran?: number;
};

/** Each room a hero fights adds this to their max HP and damage, up to maxRooms rooms. */
export const veteranRules = { step: 0.05, maxRooms: 5 };

/** The run's first six: one hero for each threat family, a tank and a caster. */
export const startingHeroes: HeroDef[] = [
  { id: 'bram', name: 'Bram', classId: 'warrior', trait: 'resilient', weapon: 'sword', armour: 'plate' },
  { id: 'mira', name: 'Mira', classId: 'fireMage', trait: 'lucky', weapon: 'wand', armour: 'robes' },
  { id: 'odo', name: 'Odo', classId: 'cleric', trait: 'quickHealer', weapon: 'mace', armour: 'mail' },
  { id: 'fen', name: 'Fen', classId: 'druid', trait: 'hardy', weapon: 'spear', armour: 'leather' },
  { id: 'wren', name: 'Wren', classId: 'scout', trait: 'lightEater', weapon: 'bow', armour: 'leather' },
  { id: 'sly', name: 'Sly', classId: 'thief', trait: 'tough', weapon: 'dagger', armour: 'leather' },
];

/** Classes the peddler can offer as recruits. */
export const recruitClasses: HeroClassId[] = ['paladin', 'barbarian', 'troubadour', 'exorcist', 'warrior', 'cleric', 'druid', 'scout', 'thief', 'fireMage'];

export const rosterRules = { max: 8 };
