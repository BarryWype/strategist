import type { ConsumableId } from '@/content/consumables';
import type { Element } from '@/content/elements';
import type { EnemyDef, EnemyTag } from '@/content/enemies';
import type { FamilyId } from '@/content/families';
import type { Terrain } from '@/content/fight';
import type { ArmourType, WeaponType } from '@/content/gear';
import type { HeroClassId, HeroDef } from '@/content/heroes';
import type { SpecialId } from '@/content/specials';
import type { ThreatId } from '@/content/threats';

import type { FamilyCounts } from '../families';
import type { RngState } from '../generation/rng';

// ---- Input ----

export type ActiveThreat = { id: ThreatId; level: number };

export type CrossingDef = {
  id: string;
  name: string;
  terrain: Terrain;
  /** Enemy ids (content/enemies.ts). */
  pack: string[];
  /** The round the pack enters the crossing. */
  arrival: number;
  threats: ActiveThreat[];
};

export type RoomDef = { id: string; name: string; crossings: CrossingDef[] };

export type FightHero = {
  hero: HeroDef;
  /** HP carried in from earlier rooms; full when left out. */
  hp?: number;
  tired: boolean;
  deathsDoor: boolean;
  /** A healing draught in hand. */
  draught?: boolean;
  /** Tags earned during the run (titles, keepsakes). */
  extraTags?: FamilyCounts;
};

export type CrossingAssignment = { heroes: FightHero[]; consumables: ConsumableId[] };

/** Heroes and consumables per crossing id; a crossing left out has no one. */
export type Assignment = Record<string, CrossingAssignment>;

export type Intervention =
  /** A healing draught brought to a standing hero. */
  | { kind: 'heal'; heroId: string }
  /** A flask or holy water brought to a crossing. */
  | { kind: 'consumable'; crossingId: string; consumable: ConsumableId }
  /** A benched hero sent in. */
  | { kind: 'addHero'; crossingId: string; hero: FightHero };

// ---- Engine state (plain data: snapshots are copies of it) ----

export type HeroUnit = {
  id: string;
  name: string;
  classId: HeroClassId;
  weapon: WeaponType | null;
  armourType: ArmourType | null;
  extraTags: FamilyCounts;
  crossing: string;
  hp: number;
  maxHp: number;
  /** The damage of a normal hit, before every multiplier. */
  attack: number;
  damageStat: 'power' | 'magic';
  element?: Element;
  armour: number;
  resistance: number;
  evasion: number;
  speed: number;
  /** Crit chance in percent. */
  crit: number;
  /** The trait's multiplier on damage taken. */
  damageTaken: number;
  tired: boolean;
  deathsDoor: boolean;
  status: 'standing' | 'down' | 'dead';
  draught: boolean;
  special: SpecialId;
  specialUses: number;
  tauntRounds: number;
  shieldRounds: number;
  sureCrit: boolean;
  knockedOut: boolean;
  kills: Partial<Record<EnemyTag, number>>;
};

export type EnemyUnit = {
  uid: string;
  defId: string;
  name: string;
  rank: EnemyDef['rank'];
  tags: EnemyTag[];
  element?: Element;
  armour: number;
  damageType: 'power' | 'magic';
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  /** The crossing whose pack it came with. */
  home: string;
  /** Where it fights now; null in the centre. */
  crossing: string | null;
  /**
   * waiting: not arrived; active: fighting; centre: after a breach, before joining;
   * calmed: fights for the heroes (Wild 3); avoided: slipped past (Watch 2);
   * looting: stayed on a broken crossing to loot it.
   */
  status: 'waiting' | 'active' | 'centre' | 'dead' | 'calmed' | 'avoided' | 'looting';
  /** The round it reached the centre. */
  centreRound: number;
  skipTurns: number;
  poison: { damage: number; rounds: number; by: string } | null;
};

export type CrossingState = {
  id: string;
  name: string;
  terrain: Terrain;
  arrival: number;
  threats: ActiveThreat[];
  /** Flasks waiting for the pack. */
  flasks: ConsumableId[];
  /** Tags from holy water. */
  bonusTags: FamilyCounts;
  arrived: boolean;
  broken: boolean;
  cleared: boolean;
  /** A hero was knocked out here. */
  knockout: boolean;
  /** Its tug fell below the bend line at some point: cleared, it is Bent rather than Held. */
  bent: boolean;
  firstHitDone: boolean;
  reviveUsed: boolean;
  calmUsed: boolean;
  /** Level-3 family effects that already made the news. */
  family3Told: FamilyId[];
  tug: number;
};

export type FightState = {
  round: number;
  heroes: HeroUnit[];
  enemies: EnemyUnit[];
  crossings: CrossingState[];
  rng: RngState;
  done: boolean;
};

// ---- Output ----

export type FightEventType =
  | 'arrival'
  | 'breach'
  | 'join'
  | 'knockout'
  | 'death'
  | 'bend'
  | 'cleared'
  | 'family3'
  | 'special'
  | 'trap'
  | 'draught'
  | 'kill'
  | 'intervention';

export type FightEvent = {
  round: number;
  type: FightEventType;
  crossing: string;
  heroes: string[];
  text: string;
  /** 1 minor, 2 notable, 3 key. */
  importance: 1 | 2 | 3;
};

export type Snapshot = {
  round: number;
  /** Per crossing: the heroes' share of its remaining strength, 0 to 1. */
  tug: Record<string, number>;
  state: FightState;
};

export type CrossingResult = 'held' | 'bent' | 'broken';

export type HeroOutcome = {
  hp: number;
  deathsDoor: boolean;
  dead: boolean;
  knockedOut: boolean;
  kills: Partial<Record<EnemyTag, number>>;
};

export type FightResult = {
  rounds: number;
  /** The room hit the round cap with a fight still going. */
  timedOut: boolean;
  crossings: Record<string, CrossingResult>;
  heroes: Record<string, HeroOutcome>;
  /** Extra loot rolls earned per crossing (Cunning 3). */
  extraLootRolls: Record<string, number>;
  /** Broken crossings that enemies stayed behind to loot: the dead there lose their gear. */
  looted: string[];
};

export type Timeline = {
  seed: string;
  snapshots: Snapshot[];
  events: FightEvent[];
  result: FightResult;
};
