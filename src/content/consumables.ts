// From pocket-quartermaster src/content/items.ts and provisions.ts, trimmed for the POC.

import type { Element } from './elements';

export type ConsumableId = 'healingDraught' | 'fireFlask' | 'stormFlask' | 'holyWater';

export type ConsumableDef = {
  id: ConsumableId;
  name: string;
  emoji: string;
  description: string;
  /** Who it is handed to in the briefing. */
  target: 'hero' | 'crossing';
  effect:
    /** Drunk once, when the carrier drops below `below` of their max HP. */
    | { kind: 'heal'; pct: number; below: number }
    /** Thrown as the crossing's pack arrives: damage in its element to every enemy of it. */
    | { kind: 'elementDamage'; element: Element; damage: number }
    /** Tags of a family added to the crossing for its fight. */
    | { kind: 'familyTag'; family: 'faith'; add: number };
  price: number;
};

export const consumables: Record<ConsumableId, ConsumableDef> = {
  healingDraught: {
    id: 'healingDraught',
    name: 'Healing draught',
    emoji: '🧪',
    description: 'Heals 30% of max HP when badly hurt.',
    target: 'hero',
    effect: { kind: 'heal', pct: 0.3, below: 0.35 },
    price: 12,
  },
  fireFlask: {
    id: 'fireFlask',
    name: 'Fire flask',
    emoji: '💣',
    description: 'Hits every enemy of the crossing’s pack for 10 fire damage as it arrives.',
    target: 'crossing',
    effect: { kind: 'elementDamage', element: 'fire', damage: 10 },
    price: 15,
  },
  stormFlask: {
    id: 'stormFlask',
    name: 'Storm flask',
    emoji: '⚡',
    description: 'Hits every enemy of the crossing’s pack for 10 Electric damage as it arrives.',
    target: 'crossing',
    effect: { kind: 'elementDamage', element: 'electric', damage: 10 },
    price: 15,
  },
  holyWater: {
    id: 'holyWater',
    name: 'Holy water',
    emoji: '💧',
    description: 'Faith +1 on one crossing for one fight.',
    target: 'crossing',
    effect: { kind: 'familyTag', family: 'faith', add: 1 },
    price: 15,
  },
};
