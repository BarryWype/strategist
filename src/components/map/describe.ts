import { enemyById } from '@/content/enemies';
import { familyById, type FamilyId } from '@/content/families';
import type { HeroUnit } from '@/game/fight/types';
import type { RosterHero } from '@/game/run/types';

import type { TokenState } from './pieces';

function plural(name: string): string {
  if (name.endsWith('s')) return name;
  if (name.endsWith('f')) return `${name.slice(0, -1)}ves`;
  return `${name}s`;
}

/** "2 ghouls, a barrow wight". */
export function packSummary(pack: string[]): string {
  const counts = new Map<string, number>();
  for (const id of pack) counts.set(enemyById[id].name, (counts.get(enemyById[id].name) ?? 0) + 1);
  return [...counts]
    .map(([name, n]) => (n > 1 ? `${n} ${plural(name)}` : name.startsWith('the ') ? name : `a ${name}`))
    .join(', ');
}

export function rosterState(r: RosterHero): TokenState {
  return r.deathsDoor ? 'deathsDoor' : r.tired ? 'tired' : 'ready';
}

export function unitState(h: HeroUnit): TokenState {
  if (h.status === 'dead') return 'dead';
  if (h.deathsDoor || h.status === 'down') return 'deathsDoor';
  return h.tired ? 'tired' : 'ready';
}

/** "Faith ●●": the families a crossing reaches, one dot per level. */
export function familyNotes(levels: Partial<Record<FamilyId, number>>): { text: string }[] {
  return (Object.entries(levels) as [FamilyId, number][])
    .filter(([, level]) => level > 0)
    .map(([family, level]) => ({ text: `${familyById[family].name} ${'●'.repeat(level)}` }));
}
