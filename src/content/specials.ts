// From pocket-quartermaster src/content/specials.ts, trimmed for the POC.
// One special per class (see heroes.ts), each fired by its trigger, once per fight.

export type SpecialEffect =
  | { kind: 'allEnemies'; share: number; elemental: boolean }
  | { kind: 'sureCrit' }
  | { kind: 'damageOverTime'; share: number; rounds: number }
  | { kind: 'strike'; multiplier: number; tags: string[] }
  | { kind: 'skipTurn'; target: 'one'; chance: number }
  | { kind: 'taunt'; rounds: number; damageTaken: number }
  | { kind: 'shieldWeakest'; rounds: number }
  | { kind: 'heal'; target: 'weakest'; pct: number }
  | { kind: 'removeEnemy'; tags: string[]; chance: number };

export type SpecialTrigger =
  /** The round the hero's pack arrives, with at least this many enemies. */
  | { kind: 'fightStart'; minEnemies?: number }
  | { kind: 'heroTurn'; chance: number }
  /** The hero's first turn against an enemy with one of these tags. */
  | { kind: 'heroTurnVsTags'; tags: string[] }
  | { kind: 'hpBelow'; pct: number; who: 'ally' };

export type SpecialId = 'taunt' | 'smite' | 'cleave' | 'elementalBlast' | 'distraction' | 'mend' | 'banish' | 'entangle' | 'aimedStrike' | 'poison';

export type SpecialDef = {
  id: SpecialId;
  name: string;
  description: string;
  effect: SpecialEffect;
  trigger: SpecialTrigger;
};

export const specials: Record<SpecialId, SpecialDef> = {
  taunt: {
    id: 'taunt',
    name: 'Taunt',
    description: 'Every enemy targets this hero for 2 rounds; the hero takes 50% of the damage. An ally below 40% HP.',
    effect: { kind: 'taunt', rounds: 2, damageTaken: 0.5 },
    trigger: { kind: 'hpBelow', pct: 0.4, who: 'ally' },
  },
  smite: {
    id: 'smite',
    name: 'Smite',
    description: "×4 damage on one undead. The hero's first turn against an undead.",
    effect: { kind: 'strike', multiplier: 4, tags: ['undead'] },
    trigger: { kind: 'heroTurnVsTags', tags: ['undead'] },
  },
  cleave: {
    id: 'cleave',
    name: 'Cleave',
    description: 'Hits every enemy for 45% of a normal hit. A pack of 3+ enemies.',
    effect: { kind: 'allEnemies', share: 0.45, elemental: false },
    trigger: { kind: 'fightStart', minEnemies: 3 },
  },
  elementalBlast: {
    id: 'elementalBlast',
    name: 'Elemental blast',
    description: "Hits every enemy for 45% in the hero's element. A pack of 3+ enemies.",
    effect: { kind: 'allEnemies', share: 0.45, elemental: true },
    trigger: { kind: 'fightStart', minEnemies: 3 },
  },
  distraction: {
    id: 'distraction',
    name: 'Distraction',
    description: "The weakest ally isn't targeted for 4 rounds. An ally below 40% HP.",
    effect: { kind: 'shieldWeakest', rounds: 4 },
    trigger: { kind: 'hpBelow', pct: 0.4, who: 'ally' },
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    description: 'Heals the weakest ally 14% of max HP. An ally below 40% HP.',
    effect: { kind: 'heal', target: 'weakest', pct: 0.14 },
    trigger: { kind: 'hpBelow', pct: 0.4, who: 'ally' },
  },
  banish: {
    id: 'banish',
    name: 'Banish',
    description: "Instantly defeats one undead that isn't an elite or the boss. The hero's first turn against one.",
    effect: { kind: 'removeEnemy', tags: ['undead'], chance: 1 },
    trigger: { kind: 'heroTurnVsTags', tags: ['undead'] },
  },
  entangle: {
    id: 'entangle',
    name: 'Entangle',
    description: "One enemy loses its next turn (75% chance). 20% chance on the hero's turn.",
    effect: { kind: 'skipTurn', target: 'one', chance: 0.75 },
    trigger: { kind: 'heroTurn', chance: 0.2 },
  },
  aimedStrike: {
    id: 'aimedStrike',
    name: 'Aimed strike',
    description: "The hero's next hit is a sure crit. The round the pack arrives.",
    effect: { kind: 'sureCrit' },
    trigger: { kind: 'fightStart' },
  },
  poison: {
    id: 'poison',
    name: 'Poison',
    description: "The target takes damage over 3 rounds (60% of a hit per round). 20% chance on the hero's turn.",
    effect: { kind: 'damageOverTime', share: 0.6, rounds: 3 },
    trigger: { kind: 'heroTurn', chance: 0.2 },
  },
};
