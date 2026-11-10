// From pocket-quartermaster src/content/equipment.ts, trimmed for the POC.
// One tier of gear. Only weapons carry family tags (doc/design/families/item-tags.csv):
// a one-handed weapon 1 of its family + 1 of another, a two-handed one 2 of one family.
// PQ's seconds outside the POC's 8 families were moved to one inside them.

import type { Element } from './elements';
import type { FamilyId } from './families';
import type { HeroClassId } from './heroes';

export type WeaponType =
  | 'sword'
  | 'axe'
  | 'mace'
  | 'censer'
  | 'dagger'
  | 'bow'
  | 'spear'
  | 'wand'
  | 'lute'
  | 'crossbow'
  | 'runestone'
  | 'staff'
  | 'totem';
export type ArmourType = 'plate' | 'mail' | 'leather' | 'robes';
export type GearType = WeaponType | ArmourType;

export type WeaponDef = {
  id: WeaponType;
  name: string;
  emoji: string;
  family: FamilyId;
  /** A one-handed weapon's second tag, of another family. */
  secondFamily?: FamilyId;
  /** Counts 2 tags of `family`. */
  twoHanded?: boolean;
  damageStat: 'power' | 'magic';
  /** Added to the damage stat. */
  damage: number;
  /** Hits in this element. */
  element?: Element;
  extras: { speed?: number; crit?: number };
};

export type ArmourDef = {
  id: ArmourType;
  name: string;
  emoji: string;
  stats: { hp?: number; armour?: number; resistance?: number; magic?: number; evasion?: number; speed?: number };
};

/** One-handed weapons add 5 to their damage stat, two-handed ones 8 (PQ's tier-1 weapon budget, plus 90% of the off-hand's). */
export const weapons: Record<WeaponType, WeaponDef> = {
  sword: { id: 'sword', name: 'Sword', emoji: '🗡️', family: 'rally', secondFamily: 'bulwark', damageStat: 'power', damage: 5, extras: { crit: 5 } },
  axe: { id: 'axe', name: 'Axe', emoji: '🪓', family: 'bloodrage', secondFamily: 'wild', damageStat: 'power', damage: 5, extras: { speed: -1 } },
  mace: { id: 'mace', name: 'Mace', emoji: '🔨', family: 'faith', secondFamily: 'bulwark', damageStat: 'power', damage: 5, extras: { speed: -1 } },
  censer: { id: 'censer', name: 'Censer', emoji: '🪔', family: 'faith', secondFamily: 'spellweave', damageStat: 'magic', damage: 5, extras: {} },
  dagger: { id: 'dagger', name: 'Dagger', emoji: '🔪', family: 'cunning', secondFamily: 'bloodrage', damageStat: 'power', damage: 5, extras: { speed: 2, crit: 10 } },
  bow: { id: 'bow', name: 'Bow', emoji: '🏹', family: 'watch', secondFamily: 'wild', damageStat: 'power', damage: 5, extras: {} },
  spear: { id: 'spear', name: 'Spear', emoji: '🔱', family: 'wild', secondFamily: 'watch', damageStat: 'power', damage: 5, extras: {} },
  wand: { id: 'wand', name: 'Wand', emoji: '🪄', family: 'spellweave', secondFamily: 'cunning', damageStat: 'magic', damage: 5, extras: { speed: 1 } },
  lute: { id: 'lute', name: 'Lute', emoji: '🪕', family: 'rally', secondFamily: 'cunning', damageStat: 'magic', damage: 5, extras: {} },
  crossbow: { id: 'crossbow', name: 'Crossbow', emoji: '🎯', family: 'cunning', secondFamily: 'watch', damageStat: 'power', damage: 5, extras: { speed: -1 } },
  // The run's one Electric weapon, for the Drowned King's weakness.
  runestone: { id: 'runestone', name: 'Storm runestone', emoji: '💠', family: 'watch', secondFamily: 'faith', damageStat: 'magic', damage: 5, element: 'electric', extras: {} },
  staff: { id: 'staff', name: 'Staff', emoji: '🦯', family: 'spellweave', twoHanded: true, damageStat: 'magic', damage: 8, extras: {} },
  totem: { id: 'totem', name: 'Totem', emoji: '🗿', family: 'wild', twoHanded: true, damageStat: 'magic', damage: 8, extras: { speed: -1 } },
};

/** PQ's armour profiles at the tier-1 budget (6 points; 1 point = 10 HP). */
export const armours: Record<ArmourType, ArmourDef> = {
  plate: { id: 'plate', name: 'Plate', emoji: '🛡️', stats: { armour: 4, hp: 12, speed: -2 } },
  mail: { id: 'mail', name: 'Mail', emoji: '🦺', stats: { armour: 3, resistance: 2, hp: 12 } },
  leather: { id: 'leather', name: 'Leather', emoji: '🧥', stats: { armour: 3, resistance: 1, hp: 24, speed: 1, evasion: 8 } },
  robes: { id: 'robes', name: 'Robes', emoji: '👘', stats: { magic: 1, resistance: 4, hp: 9 } },
};

export type Affinity = 'favoured' | 'usable' | 'unfit';

/** Favoured, usable or unfit per class (PQ's affinities.csv). Unfit gear can be carried, at a cost (affinityRules). */
export const classAffinities: Record<HeroClassId, Record<GearType, Affinity>> = {
  warrior: { sword: 'favoured', axe: 'favoured', mace: 'usable', censer: 'usable', dagger: 'usable', bow: 'usable', spear: 'favoured', wand: 'unfit', lute: 'unfit', crossbow: 'usable', runestone: 'unfit', staff: 'unfit', totem: 'unfit', plate: 'favoured', mail: 'favoured', leather: 'usable', robes: 'unfit' },
  paladin: { sword: 'favoured', axe: 'usable', mace: 'favoured', censer: 'usable', dagger: 'unfit', bow: 'unfit', spear: 'usable', wand: 'unfit', lute: 'usable', crossbow: 'usable', runestone: 'unfit', staff: 'usable', totem: 'unfit', plate: 'favoured', mail: 'favoured', leather: 'usable', robes: 'unfit' },
  barbarian: { sword: 'usable', axe: 'favoured', mace: 'usable', censer: 'unfit', dagger: 'usable', bow: 'usable', spear: 'usable', wand: 'unfit', lute: 'unfit', crossbow: 'usable', runestone: 'unfit', staff: 'usable', totem: 'unfit', plate: 'usable', mail: 'favoured', leather: 'favoured', robes: 'unfit' },
  fireMage: { sword: 'usable', axe: 'unfit', mace: 'unfit', censer: 'usable', dagger: 'usable', bow: 'usable', spear: 'usable', wand: 'favoured', lute: 'usable', crossbow: 'unfit', runestone: 'usable', staff: 'favoured', totem: 'usable', plate: 'unfit', mail: 'usable', leather: 'usable', robes: 'favoured' },
  troubadour: { sword: 'usable', axe: 'unfit', mace: 'unfit', censer: 'usable', dagger: 'usable', bow: 'usable', spear: 'unfit', wand: 'favoured', lute: 'favoured', crossbow: 'unfit', runestone: 'usable', staff: 'usable', totem: 'usable', plate: 'usable', mail: 'usable', leather: 'favoured', robes: 'usable' },
  cleric: { sword: 'usable', axe: 'usable', mace: 'usable', censer: 'favoured', dagger: 'unfit', bow: 'unfit', spear: 'usable', wand: 'usable', lute: 'usable', crossbow: 'unfit', runestone: 'usable', staff: 'favoured', totem: 'usable', plate: 'usable', mail: 'favoured', leather: 'usable', robes: 'usable' },
  exorcist: { sword: 'usable', axe: 'usable', mace: 'favoured', censer: 'usable', dagger: 'unfit', bow: 'unfit', spear: 'usable', wand: 'usable', lute: 'unfit', crossbow: 'usable', runestone: 'unfit', staff: 'usable', totem: 'unfit', plate: 'usable', mail: 'favoured', leather: 'usable', robes: 'usable' },
  druid: { sword: 'unfit', axe: 'unfit', mace: 'usable', censer: 'usable', dagger: 'unfit', bow: 'usable', spear: 'usable', wand: 'usable', lute: 'usable', crossbow: 'unfit', runestone: 'usable', staff: 'favoured', totem: 'favoured', plate: 'unfit', mail: 'usable', leather: 'favoured', robes: 'favoured' },
  scout: { sword: 'usable', axe: 'usable', mace: 'unfit', censer: 'unfit', dagger: 'favoured', bow: 'favoured', spear: 'usable', wand: 'usable', lute: 'usable', crossbow: 'favoured', runestone: 'unfit', staff: 'unfit', totem: 'unfit', plate: 'usable', mail: 'usable', leather: 'favoured', robes: 'usable' },
  thief: { sword: 'usable', axe: 'usable', mace: 'unfit', censer: 'unfit', dagger: 'favoured', bow: 'usable', spear: 'usable', wand: 'usable', lute: 'usable', crossbow: 'usable', runestone: 'unfit', staff: 'unfit', totem: 'unfit', plate: 'usable', mail: 'usable', leather: 'favoured', robes: 'usable' },
};

/** What each affinity does to a piece's stats (damage, or armour stats). */
export const affinityRules: Record<Affinity, number> = { favoured: 1.2, usable: 1, unfit: 0.6 };

export type WeaponQuality = 'fine' | 'masterwork';

/** Quality steps above the starting gear: extra damage, same families. */
export const qualityRules: Record<WeaponQuality, { name: string; damage: number }> = {
  fine: { name: 'Fine', damage: 2 },
  masterwork: { name: 'Masterwork', damage: 4 },
};

/** A weapon as found, carried in the stash or sold: its type and, above the starting gear, its quality. */
export type Weapon = { type: WeaponType; quality?: WeaponQuality };

/** "Sword", "Fine mace", "Masterwork bow". */
export function weaponName({ type, quality }: Weapon): string {
  return quality ? `${qualityRules[quality].name} ${weapons[type].name.toLowerCase()}` : weapons[type].name;
}
