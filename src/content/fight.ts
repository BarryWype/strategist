// From pocket-quartermaster src/content/dungeons.ts (expeditionRules), trimmed for the POC.

export type Terrain = 'narrow' | 'open' | 'dark' | 'flooded';

export const terrainInfo: Record<Terrain, { name: string; description: string }> = {
  narrow: { name: 'Narrow', description: 'At most 2 enemies attack each round; Bulwark is stronger.' },
  open: { name: 'Open', description: 'No limit on attackers.' },
  dark: { name: 'Dark', description: 'Brings Darkness (level 1) when the crossing has none.' },
  flooded: { name: 'Flooded', description: 'Heroes wade: −2 Speed.' },
};

export const fightRules = {
  /** Damage taken = incoming × 100 / (100 + defenseFactor × defense). */
  defenseFactor: 4,
  /** Every hit varies by up to ±this share. */
  damageVariance: 0.2,
  critMultiplier: 1.5,
  /** Enemies' flat crit chance; heroes use their Crit stat instead. */
  enemyCritChance: 0.1,
  /** Enemy hits are avoided with chance min(Evasion, cap) %. */
  evasionCap: 40,
  /** The share of an armoured enemy's armour that blocks Magic hits. */
  magicArmourShare: 0.5,
  /** Tired heroes' damage. */
  tiredDamage: 0.9,
  /** The room ends after this many rounds, whatever is left. */
  maxRounds: 30,
  narrow: {
    /** Enemies that attack per round on a narrow crossing. */
    attackers: 2,
    /** Bulwark's reductions on a narrow crossing are this many times larger. */
    bulwarkScale: 1.5,
  },
  flooded: { heroSpeed: -2 },
  breach: {
    /** Breached enemies join another crossing this many rounds after the breach. */
    centreRounds: 2,
    /** The share of them (rounded up, strongest first) that moves on; the rest stay to loot the broken crossing. */
    moveShare: 0.5,
  },
  /** A crossing whose tug value falls below this is bending (a key event). */
  bendBelow: 0.5,
};
