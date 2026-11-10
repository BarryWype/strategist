import { boss, elites, enemies, enemyById, type EnemyTag } from '@/content/enemies';
import { crossingNames, roomNames, roomRules } from '@/content/run';
import type { ThreatId } from '@/content/threats';

import type { ActiveThreat, CrossingDef, RoomDef } from '../fight/types';
import { createRng, type Rng } from '../generation/rng';
import type { MapNode } from './types';

const TAGS: EnemyTag[] = ['undead', 'beast', 'construct', 'cultist'];

/** A node's room, the same every time it is asked for: seeded from the run seed and the node. */
export function generateRoom(seed: string, node: MapNode): RoomDef | null {
  if (node.type === 'camp') return null;
  const rng = createRng(`${seed}:${node.id}:room`);
  const sizes = roomRules.crossings[node.row];
  const count = sizes[rng.int(0, sizes.length - 1)];
  const tags = node.type === 'boss' ? (['undead'] as EnemyTag[]) : pick(rng, TAGS, rng.int(1, 2));
  const names = pick(rng, crossingNames, count);
  const tough = node.row >= roomRules.toughFromRow;
  const pool = enemies.filter((e) => e.tags.some((t) => tags.includes(t)) && (tough || e.hp <= roomRules.toughHp));
  const packSize = roomRules.pack.base + roomRules.pack.growsOnRows.filter((row) => node.row >= row).length;

  const crossings: CrossingDef[] = names.map((name, i) => {
    const pack = Array.from({ length: packSize + rng.int(0, 1) }, () => pool[rng.int(0, pool.length - 1)].id);
    const threats: ActiveThreat[] = rng.chance(roomRules.threatChance) ? [threatFor(rng, pack, node.row)] : [];
    return {
      id: `c${i}`,
      name,
      terrain: rng.weighted(Object.entries(roomRules.terrain), ([, w]) => w)[0] as CrossingDef['terrain'],
      pack,
      arrival: i === 0 ? 1 : roomRules.arrivals[rng.int(0, roomRules.arrivals.length - 1)],
      threats,
    };
  });

  // The elite or the boss leads the first crossing's pack, with a level-2 threat.
  const leader =
    node.type === 'boss' ? boss : node.type === 'elite' ? (elites.find((e) => e.tags.some((t) => tags.includes(t))) ?? elites[0]) : null;
  if (leader) {
    const first = crossings[0];
    first.pack = [leader.id, ...first.pack.slice(0, node.type === 'boss' ? 1 : 2)];
    const threat = threatFor(rng, first.pack, node.row);
    first.threats = [{ id: threat.id, level: 2 }];
  }

  return { id: node.id, name: node.type === 'boss' ? "The Drowned King's hall" : roomNames[rng.int(0, roomNames.length - 1)], crossings };
}

/** A threat fitting the pack: Holy needs undead, Beasts needs beasts; Darkness and Traps fit any. */
function threatFor(rng: Rng, pack: string[], row: number): ActiveThreat {
  const has = (tag: EnemyTag) => pack.some((id) => enemyById[id].tags.includes(tag));
  const ids: ThreatId[] = ['darkness', 'traps', ...(has('undead') ? (['holy'] as const) : []), ...(has('beast') ? (['beasts'] as const) : [])];
  return { id: ids[rng.int(0, ids.length - 1)], level: row >= roomRules.threatLevel2FromRow ? rng.int(1, 2) : 1 };
}

function pick<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const left = [...items];
  return Array.from({ length: Math.min(count, left.length) }, () => left.splice(rng.int(0, left.length - 1), 1)[0]);
}
