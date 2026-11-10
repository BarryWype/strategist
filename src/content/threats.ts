// From pocket-quartermaster src/content/threats.ts, trimmed for the POC.
// A threat at level N on a crossing needs N tags of its family on that crossing.

export type ThreatId = 'holy' | 'beasts' | 'darkness' | 'traps';

/** What a missed threat does to its crossing's fight. */
export type ThreatPenalty =
  /** The undead get this share more max HP. */
  | { kind: 'enemyHp'; tag: 'undead'; pct: number }
  /** Beasts deal this share more damage. */
  | { kind: 'enemyDamage'; tag: 'beast'; pct: number }
  /** The pack strikes first in the round it arrives. */
  | { kind: 'exposed' }
  /** The heroes deal this share less damage. */
  | { kind: 'weakened'; pct: number }
  /** As the pack arrives, a trap wounds one hero for this share of their max HP. */
  | { kind: 'trapWounds'; pct: number };

export type ThreatDef = {
  id: ThreatId;
  name: string;
  emoji: string;
  /** Penalties at threat levels 1, 2 and 3. */
  penalties: [ThreatPenalty[], ThreatPenalty[], ThreatPenalty[]];
  description: string;
};

export const threats: ThreatDef[] = [
  {
    id: 'holy',
    name: 'Holy',
    emoji: '👻',
    penalties: [
      [{ kind: 'enemyHp', tag: 'undead', pct: 0.7 }],
      [{ kind: 'enemyHp', tag: 'undead', pct: 0.8 }],
      [{ kind: 'enemyHp', tag: 'undead', pct: 0.9 }],
    ],
    description: 'The dead walk and the ground is profaned; missed, the undead are harder to put down.',
  },
  {
    id: 'beasts',
    name: 'Beasts',
    emoji: '🐺',
    penalties: [
      [{ kind: 'enemyDamage', tag: 'beast', pct: 0.2 }],
      [{ kind: 'enemyDamage', tag: 'beast', pct: 0.3 }],
      [{ kind: 'enemyDamage', tag: 'beast', pct: 0.4 }],
    ],
    description: 'Beasts prowl here; missed, they hit harder.',
  },
  {
    id: 'darkness',
    name: 'Darkness',
    emoji: '🌑',
    penalties: [
      [{ kind: 'exposed' }, { kind: 'weakened', pct: 0.25 }],
      [{ kind: 'exposed' }, { kind: 'weakened', pct: 0.35 }],
      [{ kind: 'exposed' }, { kind: 'weakened', pct: 0.45 }],
    ],
    description: 'Pitch dark and ambushers; missed, enemies strike first and the heroes hit softer.',
  },
  {
    id: 'traps',
    name: 'Traps',
    emoji: '🪤',
    penalties: [[{ kind: 'trapWounds', pct: 0.4 }], [{ kind: 'trapWounds', pct: 0.6 }], [{ kind: 'trapWounds', pct: 0.8 }]],
    description: 'Snares, locks and caved-in ways; missed, they wound whoever they catch.',
  },
];

export const threatById = Object.fromEntries(threats.map((threat) => [threat.id, threat])) as Record<ThreatId, ThreatDef>;

export const threatRules = {
  /** One tag short: every penalty number at this share. Two or more short: the full penalty. */
  halfShare: 0.5,
};
