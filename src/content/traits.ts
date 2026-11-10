// From pocket-quartermaster src/content/traits.ts, trimmed for the POC.
// Every hero has one trait.

export type TraitId = 'resilient' | 'tough' | 'lucky' | 'quickHealer' | 'lightEater' | 'hardy';

export type TraitEffect =
  | { kind: 'maxHp'; multiplier: number }
  | { kind: 'damageTaken'; multiplier: number }
  | { kind: 'critBonus'; chance: number }
  /** Added to the HP share a tended hero comes back with. */
  | { kind: 'tendedHp'; add: number }
  /** Eats a ration only every this many rooms. */
  | { kind: 'rationEvery'; rooms: number }
  /** Never tired for want of rations. */
  | { kind: 'hungerImmune' };

export type TraitDef = {
  id: TraitId;
  name: string;
  description: string;
  effect: TraitEffect;
};

export const traits: Record<TraitId, TraitDef> = {
  resilient: { id: 'resilient', name: 'Resilient', description: '+15% max HP.', effect: { kind: 'maxHp', multiplier: 1.15 } },
  tough: { id: 'tough', name: 'Tough', description: '−10% damage taken.', effect: { kind: 'damageTaken', multiplier: 0.9 } },
  lucky: { id: 'lucky', name: 'Lucky', description: '+8% critical hit chance.', effect: { kind: 'critBonus', chance: 0.08 } },
  quickHealer: {
    id: 'quickHealer',
    name: 'Quick healer',
    description: 'Comes back from death’s door with 20% more HP when tended.',
    effect: { kind: 'tendedHp', add: 0.2 },
  },
  lightEater: { id: 'lightEater', name: 'Light eater', description: 'Eats a ration only every other room.', effect: { kind: 'rationEvery', rooms: 2 } },
  hardy: { id: 'hardy', name: 'Hardy', description: 'Never tired when the rations run out.', effect: { kind: 'hungerImmune' } },
};
