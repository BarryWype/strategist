// From pocket-quartermaster src/content/elements.ts, trimmed for the POC.

export type Element = 'fire' | 'grass' | 'stone' | 'electric' | 'water';

export const elementRules = {
  /** Each element beats the next: fire → grass → stone → electric → water → fire. */
  beats: { fire: 'grass', grass: 'stone', stone: 'electric', electric: 'water', water: 'fire' } as Record<Element, Element>,
  /** Damage against the element it beats, and against the one that beats it. */
  strongMultiplier: 1.5,
  weakMultiplier: 0.75,
};

export const elementInfo: Record<Element, { name: string; emoji: string }> = {
  fire: { name: 'Fire', emoji: '🔥' },
  grass: { name: 'Grass', emoji: '🌿' },
  stone: { name: 'Stone', emoji: '🪨' },
  electric: { name: 'Electric', emoji: '⚡' },
  water: { name: 'Water', emoji: '💧' },
};
