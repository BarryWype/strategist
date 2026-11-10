// From pocket-quartermaster src/content/enemies.ts, trimmed for the POC.
// Enemies are written at PQ's tier-1 strength, then scaled once; step 7's sim tunes SCALE.

import { elementInfo, elementRules, type Element } from './elements';
import type { FamilyId } from './families';
import type { WeaponType } from './gear';

export type EnemyTag = 'undead' | 'beast' | 'construct' | 'cultist';
export type SpeedClass = 'slow' | 'normal' | 'fast';

export type EnemyDef = {
  id: string;
  name: string;
  hp: number;
  damage: number;
  damageType: 'power' | 'magic';
  speed: number;
  tags: EnemyTag[];
  element?: Element;
  /** The share of a Power hit it blocks (constructs). */
  armour?: number;
  rank: 'regular' | 'elite' | 'boss';
};

export type BossDef = EnemyDef & {
  /** Shown from the start of the run, with the elements that beat his own (bossWeaknesses). */
  weakFamily: keyof typeof enemyRules.weakness;
};

export type Weakness =
  | { kind: 'element'; element: Element; multiplier: number; reason: string }
  | { kind: 'family'; family: FamilyId; multiplier: number };

export const enemyRules = {
  speed: { slow: 3, normal: 5, fast: 7 } satisfies Record<SpeedClass, number>,
  /** PQ's tier-1 armour of the armoured kinds. */
  constructArmour: 0.15,
  /** How much stronger Spellweave's effects are against the boss. His Electric weakness needs no number: Electric beats his Water on the element wheel. */
  weakness: { spellweave: 1.5 },
};

/** PQ's tier-1 dungeons sit around 2.5; the POC's base game (no unlocks) is tuned to 1.625 by the balance sim. */
const SCALE = 1.625;

function mob(
  id: string,
  name: string,
  hp: number,
  damage: number,
  tags: EnemyTag[],
  element?: Element,
  speedClass: SpeedClass = 'normal',
  rank: EnemyDef['rank'] = 'regular',
): EnemyDef {
  return {
    id,
    name,
    hp: Math.round(hp * SCALE),
    damage: Math.round(damage * SCALE),
    // Elemental enemies and cultists hit with Magic, everyone else with Power.
    damageType: element || tags.includes('cultist') ? 'magic' : 'power',
    speed: enemyRules.speed[speedClass],
    tags,
    element,
    ...(tags.includes('construct') ? { armour: enemyRules.constructArmour } : {}),
    rank,
  };
}

export const enemies: EnemyDef[] = [
  mob('restlessBones', 'restless bones', 8, 3, ['undead']),
  mob('barrowWight', 'barrow wight', 14, 4, ['undead']),
  mob('ghoul', 'ghoul', 18, 5, ['undead']),
  mob('drownedSoldier', 'drowned soldier', 20, 5, ['undead'], 'water'),
  mob('giantRat', 'giant rat', 8, 3, ['beast'], undefined, 'fast'),
  mob('greyWolf', 'grey wolf', 14, 4, ['beast'], undefined, 'fast'),
  mob('wildBoar', 'wild boar', 14, 4, ['beast'], 'grass', 'slow'),
  mob('direWolf', 'dire wolf', 20, 5, ['beast'], undefined, 'fast'),
  mob('brassBeetle', 'brass beetle', 10, 3, ['construct']),
  mob('stoneWarden', 'stone warden', 16, 4, ['construct'], 'stone', 'slow'),
  mob('clockworkGuard', 'clockwork guard', 16, 5, ['construct']),
  mob('rockGolem', 'rock golem', 20, 5, ['construct'], undefined, 'slow'),
  mob('flameCultist', 'flame cultist', 10, 4, ['cultist'], 'fire'),
  mob('tempestCaller', 'tempest caller', 18, 5, ['cultist'], 'electric'),
  mob('abyssalPriest', 'abyssal priest', 18, 5, ['cultist'], 'water'),
];

export const elites: EnemyDef[] = [
  mob('alphaWolf', 'alpha wolf', 55, 7, ['beast'], undefined, 'fast', 'elite'),
  mob('barnacledKnight', 'barnacled knight', 70, 8, ['undead'], 'water', 'slow', 'elite'),
];

export const boss: BossDef = {
  ...mob('drownedKing', 'the Drowned King', 125, 10, ['undead'], 'water', 'normal', 'boss'),
  weakFamily: 'spellweave',
};

export const enemyById = Object.fromEntries([...enemies, ...elites, boss].map((e) => [e.id, e])) as Record<string, EnemyDef>;

/** The weapon a search of the bodies may turn up, by the enemies' tag. */
export const weaponDrops: Record<EnemyTag, WeaponType[]> = {
  undead: ['mace', 'censer', 'runestone'],
  beast: ['spear', 'axe', 'bow', 'totem'],
  construct: ['crossbow', 'sword', 'staff'],
  cultist: ['wand', 'dagger', 'lute'],
};

/** A boss's weaknesses for display: the elements that beat his on the wheel, then his weak family. */
export function bossWeaknesses(b: BossDef): Weakness[] {
  const own = b.element;
  const elements = own ? (Object.keys(elementRules.beats) as Element[]).filter((e) => elementRules.beats[e] === own) : [];
  return [
    ...elements.map((element) => ({
      kind: 'element' as const,
      element,
      multiplier: elementRules.strongMultiplier,
      reason: `${elementInfo[element].name} beats ${elementInfo[own!].name}`,
    })),
    { kind: 'family', family: b.weakFamily, multiplier: enemyRules.weakness[b.weakFamily] },
  ];
}
