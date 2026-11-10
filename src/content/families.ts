// From pocket-quartermaster src/content/families.ts, trimmed for the POC.
// Families: tags counted on one crossing (not across the party) to unlock its levels.

import type { ImageSourcePropType } from 'react-native';

import type { ThreatId } from './threats';

export type FamilyId = 'faith' | 'wild' | 'watch' | 'cunning' | 'bulwark' | 'bloodrage' | 'spellweave' | 'rally';

export type FamilyDef = {
  id: FamilyId;
  name: string;
  kind: 'threat' | 'playstyle';
  /** Only threat families: the threat they answer. */
  answers?: ThreatId;
  icon: ImageSourcePropType;
  /** What each level does on its crossing, for the briefing. */
  levels: [string, string, string];
};

export const families: FamilyDef[] = [
  {
    id: 'faith',
    name: 'Faith',
    kind: 'threat',
    answers: 'holy',
    icon: require('../../assets/icons/abilities-scaled/holy-star.png'),
    levels: [
      'Undead take +10% damage.',
      'Every hit on the undead heals the hero for 3% of the damage.',
      'The first knockout on the crossing gets back up at 25% HP.',
    ],
  },
  {
    id: 'wild',
    name: 'Wild',
    kind: 'threat',
    answers: 'beasts',
    icon: require('../../assets/icons/abilities-scaled/bull-head.png'),
    levels: [
      'Beasts deal −10% damage.',
      'Clearing beasts from the crossing heals its heroes 5%.',
      'Once per fight, a beast is calmed and fights for the heroes.',
    ],
  },
  {
    id: 'watch',
    name: 'Watch',
    kind: 'threat',
    answers: 'darkness',
    icon: require('../../assets/icons/abilities-scaled/stone-tower.png'),
    levels: [
      '+3 Speed in the pack’s first round.',
      'The pack’s weakest enemy is slipped past and never fights.',
      '+10% crit against elites; the heroes always act first.',
    ],
  },
  {
    id: 'cunning',
    name: 'Cunning',
    kind: 'threat',
    answers: 'traps',
    icon: require('../../assets/icons/relics/lockpicks.png'),
    levels: [
      'As the pack arrives, a trap hits one enemy for 10% of its HP.',
      'The trap hits every enemy of the pack.',
      'One extra loot roll when the crossing’s bodies are searched.',
    ],
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    kind: 'playstyle',
    icon: require('../../assets/icons/abilities-scaled/bronze-shield.png'),
    levels: [
      'The front hero takes −10% damage.',
      'The front hero takes 35% of each hit aimed at the weakest ally.',
      'The first hit on the crossing deals −35% damage.',
    ],
  },
  {
    id: 'bloodrage',
    name: 'Bloodrage',
    kind: 'playstyle',
    icon: require('../../assets/icons/abilities-scaled/red-slashes.png'),
    levels: ['+20% damage below half HP.', 'Heal 5% on each kill.', 'Below 25% HP, an extra attack each round.'],
  },
  {
    id: 'spellweave',
    name: 'Spellweave',
    kind: 'playstyle',
    icon: require('../../assets/icons/abilities-scaled/water-vortex.png'),
    levels: [
      'Magic damage +5% each round (up to +25%).',
      'A magic hit jumps to a second enemy for 30%.',
      'Elemental advantage doubled.',
    ],
  },
  {
    id: 'rally',
    name: 'Rally',
    kind: 'playstyle',
    icon: require('../../assets/icons/abilities-scaled/hanging-banner.png'),
    levels: [
      '+10% damage on the crossing.',
      'The crossing’s heroes heal 5% as the pack arrives.',
      'Every special gets one extra use in the fight.',
    ],
  },
];

export const familyById = Object.fromEntries(families.map((family) => [family.id, family])) as Record<FamilyId, FamilyDef>;

/** The family that answers a threat. */
export function familyOfThreat(threatId: ThreatId): FamilyId {
  return families.find((family) => family.answers === threatId)!.id;
}

/** Tags on one crossing that reach levels 1, 2 and 3 (PQ counts 2/4/6 across a party). */
export const familyRules = { levels: [2, 3, 4] };

/** The numbers behind the family effects on a crossing. */
export const familyEffectRules = {
  /** Damage against these tags; the share of that damage healed (level 2); the HP share the crossing's first knockout gets back up at (level 3). */
  faith: { vsTags: ['undead'] as string[], damage: 1.1, healShare: 0.03, revivePct: 0.25 },
  /** Damage taken from these tags; the heal on clearing them (level 2). */
  wild: { fromTags: ['beast'] as string[], damageTaken: 0.9, healShare: 0.05 },
  /** Speed added in the pack's first round; weakest enemies skipped (level 2); crit chance added against elites (level 3). */
  watch: { firstRoundSpeed: 3, skippedEnemies: 1, eliteCrit: 0.1 },
  /** The share of its max HP an enemy loses to a trap as the pack arrives; extra loot rolls (level 3). */
  cunning: { trapHit: 0.1, lootRolls: 1 },
  /** The front hero's damage taken; the share of the weakest ally's hits the front hero takes; the share of the first hit still taken (level 3). */
  bulwark: { frontTaken: 0.9, guardShare: 0.35, firstHitTaken: 0.65 },
  /** Damage below this HP share; the heal on each kill (level 2); the HP share below which a hero attacks twice a round (level 3). */
  bloodrage: { belowHp: 0.5, damage: 1.2, healOnKill: 0.05, extraBelowHp: 0.25 },
  /** Magic damage added each round, up to the max; a magic hit's share that jumps to a second enemy; the scale on elemental advantage. */
  spellweave: { perRound: 0.05, max: 0.25, chainShare: 0.3, advantageScale: 2 },
  /** Crossing damage; the heal as the pack arrives (level 2); extra uses of every special (level 3). */
  rally: { damage: 1.1, healShare: 0.05, extraSpecialUses: 1 },
};
