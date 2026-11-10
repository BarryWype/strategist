import type { ConsumableId } from './consumables';
import type { Terrain } from './fight';
import type { FamilyId } from './families';

export const runRules = {
  startingGold: 40,
  startingRations: 18,
  /** Rows from the entrance to the boss; the boss sits on the last. */
  rows: 9,
  /** Aftermath actions; one more slice of the fight is revealed by ending the turn. */
  actions: 3,
  /** Actions in the aftermath of a camp. */
  campActions: 5,
  /** Slices of a resumed fight after "Go forward". */
  forwardSlices: 2,
  /** Rows ahead whose node types show: the next row in full, the rest as types. */
  sight: 2,
  /** A knocked-out hero gets up after the room with this share of max HP, still at death's door. */
  getUpHp: 0.25,
  /** A tended hero comes back from death's door with at least this share of max HP. */
  tendedHp: 0.5,
  /** The party is routed (the run is lost) when more than this share of a room's crossings break: both of 2, 2 of 3, 3 of 4. */
  routShare: 0.5,
  /** Heroes who fought a room heal this share of max HP after it, once knockouts are settled (at death's door too). */
  foughtHeal: 0.15,
  /** A hero who has fought this many rooms in a row is tired for the next (tired from their 4th). */
  tiredAfter: 3,
  /** Heroes who sit out a room heal this share of max HP. */
  benchHeal: 0.4,
  /** At a camp, everyone heals this share of max HP. */
  campHeal: 0.5,
};

export const mapRules = {
  nodesPerRow: { min: 2, max: 3 },
  /** Node type weights, and the first row (0 = the first room) each type can appear on. */
  types: {
    fight: { weight: 6, fromRow: 0 },
    vault: { weight: 1.5, fromRow: 1 },
    camp: { weight: 1.5, fromRow: 2 },
    elite: { weight: 1.5, fromRow: 3 },
  },
  /** The chance a node links to a second node of the next row (when it doesn't cross another link). */
  secondLink: 0.4,
};

export const roomRules = {
  /** Crossings per room by row (the last is the boss's). */
  crossings: [[2], [2], [2], [2, 3], [3], [3], [3], [3, 4], [4]] as number[][],
  /** Enemies per pack: base + 0–1, and one more from each of these rows (kept off the row tough enemies arrive). */
  pack: { base: 2, growsOnRows: [6, 8] },
  /** Before this row, packs leave out the toughest of each tag. */
  toughFromRow: 3,
  /** Scaled HP above which an enemy counts as tough. */
  toughHp: 26,
  arrivals: [1, 2, 3],
  terrain: { open: 4, narrow: 2, dark: 2, flooded: 2 } as Record<Terrain, number>,
  threatChance: 0.5,
  /** From this row, threats reach level 2. */
  threatLevel2FromRow: 3,
  /** The vault opens with this level of Cunning on any crossing. */
  vaultCunning: 2,
};

export const lootRules = {
  gold: { regular: 4, elite: 15, boss: 0 },
  /** Rolls when searching: one, plus Cunning 3's extra rolls, plus one for an open vault. */
  consumableChance: 0.35,
  weaponChance: 0.35,
  /** Weapons found are Fine, and Masterwork from this row (0 = the first room). */
  masterworkFromRow: 3,
  rations: { min: 0, max: 2 },
  vaultGold: 30,
};

/** The peddler, reachable from every aftermath. */
export const peddlerRules = {
  /** Always for sale, whatever else the peddler carries that day. */
  alwaysStocked: ['healingDraught', 'stormFlask'] as ConsumableId[],
  /** Other consumables on sale each visit. */
  extraStock: 1,
  rations: { count: 5, price: 6 },
  recruits: 2,
  recruitPrice: 30,
  /** The share of the price the peddler pays when buying back. */
  sellShare: 0.5,
  /** The peddler buys weapons back at sellShare of these. */
  weaponPrice: { base: 20, fine: 35, masterwork: 50 },
  /** One Fine weapon for sale per visit. */
  fineWeaponPrice: 35,
  armourPrice: 20,
};

export type TitleId = 'unbroken' | 'beastslayer' | 'gravewalker';

export const titles: Record<TitleId, { name: string; description: string; family: FamilyId }> = {
  unbroken: { name: 'Unbroken', description: 'Held a crossing alone 3 times.', family: 'bulwark' },
  beastslayer: { name: 'Beastslayer', description: 'Slew 10 beasts.', family: 'wild' },
  gravewalker: { name: 'Gravewalker', description: "Came back from death's door.", family: 'faith' },
};

export const titleRules = { heldAlone: 3, beasts: 10 };

export const roomNames = [
  'The cistern',
  'The collapsed chapel',
  'The ossuary',
  'The flooded mill',
  'The guardroom',
  'The root cellar',
  'The broken bridge',
  'The bell tower',
  'The salt mine',
  'The old forge',
  'The drowned crypt',
  'The kennels',
  'The library',
  'The well shaft',
];

export const crossingNames = [
  'Culvert',
  'Stairs',
  'Gate',
  'Breach',
  'Old drain',
  'Collapsed arch',
  'Postern',
  'Rope bridge',
  'Chapel door',
  'Cellar hatch',
];

export const recruitNames = ['Ada', 'Bors', 'Cael', 'Dara', 'Eli', 'Gus', 'Hale', 'Ines', 'Jory', 'Kit', 'Lena', 'Moss', 'Nell', 'Pell', 'Rook', 'Tam'];
