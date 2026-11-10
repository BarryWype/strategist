import type { ConsumableId } from '@/content/consumables';
import type { EnemyTag } from '@/content/enemies';
import type { ArmourType, Weapon } from '@/content/gear';
import type { HeroDef } from '@/content/heroes';
import type { TitleId } from '@/content/run';

import type { FamilyCounts } from '../families';
import type { Slice } from '../fight/slices';
import type { Assignment, CrossingResult, Intervention, RoomDef, Timeline } from '../fight/types';

export type NodeType = 'fight' | 'elite' | 'camp' | 'vault' | 'boss';

export type MapNode = {
  id: string;
  row: number;
  type: NodeType;
  /** Ids of the nodes it leads to on the next row. */
  next: string[];
};

/** Rows from the entrance to the boss; the entrance leads to every node of row 0. */
export type RunMap = { rows: MapNode[][] };

export type RosterHero = {
  hero: HeroDef;
  hp: number;
  deathsDoor: boolean;
  tired: boolean;
  /** Rooms fought in a row; back to 0 after a room on the bench, a camp, or a rest. Tired from runRules.tiredAfter on. */
  roomsInARow: number;
  /** Rooms fought since their last ration (light eaters eat every other room). */
  roomsSinceMeal: number;
  /** Tags from titles and keepsakes, for the rest of the run. */
  extraTags: FamilyCounts;
  titles: TitleId[];
  heldAlone: number;
  beasts: number;
};

export type Stash = {
  consumables: Partial<Record<ConsumableId, number>>;
  weapons: Weapon[];
  armours: ArmourType[];
};

/** A hero who died in a room, waiting there to be buried; on a looted crossing, their gear and keepsake are gone. */
export type Fallen = { hero: HeroDef; lastLine: string; looted: boolean };

/** The bodies of a room, until searched. */
export type Bodies = {
  kills: Partial<Record<EnemyTag, number>>;
  regulars: number;
  elites: number;
  extraRolls: number;
  vault: boolean;
};

/** What the peddler offers this visit; the Fine weapon is null once bought. */
export type PeddlerStock = { consumables: ConsumableId[]; recruits: HeroDef[]; weapon: Weapon | null };

export type Find = { gold: number; rations: number; consumables: ConsumableId[]; weapons: Weapon[] };

/** The room behind the party, where the strategist spends the aftermath. */
export type Aftermath = {
  /** null at the entrance. */
  nodeId: string | null;
  /** none: nothing behind (the fight after a camp), so the fight is revealed with "Continue". */
  kind: 'entrance' | 'camp' | 'fight' | 'none';
  actionsLeft: number;
  bodies: Bodies | null;
  fallen: Fallen[];
  peddler: PeddlerStock;
  peddlerOpen: boolean;
  /** The last search's find, for the UI. */
  found: Find | null;
  /** The strategist went forward: the room and its leftovers are lost. */
  left: boolean;
};

export type TitleEarned = { heroId: string; title: TitleId };

/** The room ahead, as the heroes fight it; at a camp (room null), the pause before the next briefing. */
export type RoomFight = {
  nodeId: string;
  room: RoomDef | null;
  assignment: Assignment;
  /** Heroes who went in without a ration. */
  hungry: string[];
  timeline: Timeline | null;
  slices: Slice[];
  revealed: number;
  forward: { intervention: Intervention; timeline: Timeline; slices: Slice[]; revealed: number } | null;
  /** Titles earned while this room was fought (Gravewalker comes from tending). */
  titles: TitleEarned[];
};

export type Report = {
  nodeId: string;
  crossings: Record<string, CrossingResult>;
  fallen: Fallen[];
  titles: TitleEarned[];
  /** Heroes knocked out this room, now at death's door. */
  wounded: string[];
  /** Heroes tired from this room on. */
  tired: string[];
  hungry: string[];
  timedOut: boolean;
  /** Most crossings broke: the party fled and the run is lost. */
  routed: boolean;
  /** Heroes whose veteran bonus grew this room, with their bonus now (0.15 for +15%). */
  veterans: { heroId: string; bonus: number }[];
};

/** How a run ended; the survivors are kept for meta-progression. */
export type RunOutcome = { kind: 'win' | 'rout' | 'wipe' | 'bossStands'; survivors: HeroDef[] };

export type RunPhase = 'brief' | 'room' | 'report' | 'won' | 'lost';

export type RunState = {
  seed: string;
  map: RunMap;
  /** The last node the party entered; null at the entrance. */
  at: string | null;
  route: string[];
  roster: RosterHero[];
  stash: Stash;
  gold: number;
  rations: number;
  /** A crossing of the last room fought had Watch 2: sight +1. */
  watchSight: boolean;
  phase: RunPhase;
  fight: RoomFight | null;
  aftermath: Aftermath;
  report: Report | null;
  outcome: RunOutcome | null;
};
