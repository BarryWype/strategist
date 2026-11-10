// A room is several fights side by side, one per crossing, played round by round.
// Learnt from pocket-quartermaster src/game/expeditions/simulate.ts, written anew for crossings.

import { consumables, type ConsumableId } from '@/content/consumables';
import { elementRules, type Element } from '@/content/elements';
import { enemyRules } from '@/content/enemies';
import { familyEffectRules as F, familyOfThreat, type FamilyId } from '@/content/families';
import { fightRules as R } from '@/content/fight';
import { specials } from '@/content/specials';
import { threatById, threatRules, type ThreatPenalty } from '@/content/threats';

import { crossingTags, familyLevel, type FamilyCounts } from '../families';
import { createRng, restoreRng, type Rng } from '../generation/rng';
import type {
  Assignment,
  CrossingDef,
  CrossingState,
  EnemyUnit,
  FightEvent,
  FightEventType,
  FightResult,
  FightState,
  HeroUnit,
  Intervention,
  RoomDef,
  Snapshot,
  Timeline,
} from './types';
import { enemyUnit, heroUnit } from './units';

type Ctx = { state: FightState; events: FightEvent[]; rng: Rng };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Plays a room from its briefing to its end. */
export function simulateFight(room: RoomDef, assignment: Assignment, seed: string): Timeline {
  const state: FightState = {
    round: 0,
    heroes: room.crossings.flatMap((c) => (assignment[c.id]?.heroes ?? []).map((h) => heroUnit(h, c.id))),
    enemies: room.crossings.flatMap((c) => c.pack.map((id, i) => enemyUnit(id, c.id, i))),
    crossings: room.crossings.map((c) => crossingState(c, assignment[c.id]?.consumables ?? [])),
    rng: createRng(seed).state(),
    done: false,
  };
  return play(state, seed, []);
}

/**
 * Plays on from a round snapshot, with the random stream saved in it. With an intervention,
 * it is applied first: the help changes the fight, the luck stays the same. Without one,
 * the rest matches the original timeline.
 */
export function resumeFight(snapshot: Snapshot, intervention: Intervention | null, seed: string): Timeline {
  const state = clone(snapshot.state);
  const events: FightEvent[] = [];
  if (intervention) {
    const ctx: Ctx = { state, events, rng: restoreRng(state.rng) };
    applyIntervention(ctx, intervention);
    state.rng = ctx.rng.state();
    state.done = isDone(state);
  }
  return play(state, seed, events);
}

/** The family tags on a crossing, from the heroes and items on it. */
export function crossingTagCounts(state: FightState, crossingId: string): FamilyCounts {
  return tagsOf(state, crossing(state, crossingId));
}

/** The family levels a crossing reaches with the heroes and items on it. */
export function crossingLevels(state: FightState, crossingId: string): Partial<Record<FamilyId, number>> {
  const tags = tagsOf(state, crossing(state, crossingId));
  return Object.fromEntries(Object.entries(tags).map(([family, n]) => [family, familyLevel(n ?? 0)]));
}

function play(state: FightState, seed: string, events: FightEvent[]): Timeline {
  refreshTug(state, null);
  const snapshots = [snapshotOf(state)];
  while (!state.done) {
    playRound(state, events);
    snapshots.push(snapshotOf(state));
  }
  return { seed, snapshots, events, result: resultOf(state) };
}

function snapshotOf(state: FightState): Snapshot {
  return { round: state.round, tug: Object.fromEntries(state.crossings.map((c) => [c.id, c.tug])), state: clone(state) };
}

function crossingState(def: CrossingDef, items: ConsumableId[]): CrossingState {
  const threats = [...def.threats];
  if (def.terrain === 'dark' && !threats.some((t) => t.id === 'darkness')) threats.push({ id: 'darkness', level: 1 });
  const c: CrossingState = {
    id: def.id,
    name: def.name,
    terrain: def.terrain,
    arrival: def.arrival,
    threats,
    flasks: [],
    bonusTags: {},
    arrived: false,
    broken: false,
    cleared: false,
    knockout: false,
    bent: false,
    firstHitDone: false,
    reviveUsed: false,
    calmUsed: false,
    family3Told: [],
    tug: 0,
  };
  for (const id of items) addConsumable(c, id);
  return c;
}

function addConsumable(c: CrossingState, id: ConsumableId) {
  const effect = consumables[id].effect;
  if (effect.kind === 'familyTag') c.bonusTags[effect.family] = (c.bonusTags[effect.family] ?? 0) + effect.add;
  else if (effect.kind === 'elementDamage') c.flasks.push(id);
  else throw new Error(`${id} is carried by a hero, not left on a crossing`);
}

// ---- Lookups ----

const crossing = (s: FightState, id: string) => {
  const c = s.crossings.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown crossing ${id}`);
  return c;
};
const standing = (s: FightState, c: CrossingState) => s.heroes.filter((h) => h.crossing === c.id && h.status === 'standing');
const active = (s: FightState, c: CrossingState) => s.enemies.filter((e) => e.crossing === c.id && e.status === 'active');
const calmed = (s: FightState, c: CrossingState) => s.enemies.filter((e) => e.crossing === c.id && e.status === 'calmed');

function tagsOf(s: FightState, c: CrossingState): FamilyCounts {
  const heroes = s.heroes.filter((h) => h.crossing === c.id);
  const counts = crossingTags(heroes);
  for (const extra of [...heroes.map((h) => h.extraTags), c.bonusTags]) {
    for (const [family, n] of Object.entries(extra) as [FamilyId, number][]) counts[family] = (counts[family] ?? 0) + n;
  }
  return counts;
}

const level = (s: FightState, c: CrossingState, family: FamilyId) => familyLevel(tagsOf(s, c)[family] ?? 0);

/** Every penalty of the crossing's missed threats, with the share it applies at (half when one tag short). */
function penalties(s: FightState, c: CrossingState): { penalty: ThreatPenalty; share: number }[] {
  const tags = tagsOf(s, c);
  return c.threats.flatMap((threat) => {
    const short = threat.level - (tags[familyOfThreat(threat.id)] ?? 0);
    if (short <= 0) return [];
    const share = short === 1 ? threatRules.halfShare : 1;
    return threatById[threat.id].penalties[threat.level - 1].map((penalty) => ({ penalty, share }));
  });
}

function penaltyPct(s: FightState, c: CrossingState, kind: 'enemyHp' | 'enemyDamage' | 'weakened' | 'trapWounds'): number {
  return penalties(s, c).reduce((sum, { penalty, share }) => sum + (penalty.kind === kind ? penalty.pct * share : 0), 0);
}

const exposed = (s: FightState, c: CrossingState) => penalties(s, c).some(({ penalty }) => penalty.kind === 'exposed');

function wheel(attacker: Element | undefined, defender: Element | undefined): number {
  if (!attacker || !defender) return 1;
  if (elementRules.beats[attacker] === defender) return elementRules.strongMultiplier;
  if (elementRules.beats[defender] === attacker) return elementRules.weakMultiplier;
  return 1;
}

const variance = (rng: Rng) => 1 + (rng.next() - 0.5) * 2 * R.damageVariance;
const lowestHp = (enemies: EnemyUnit[]) => enemies.reduce((low, e) => (e.hp < low.hp ? e : low));
const weakest = (heroes: HeroUnit[]) => heroes.reduce((low, h) => (h.hp / h.maxHp < low.hp / low.maxHp ? h : low));

// ---- News ----

function say(ctx: Ctx, c: CrossingState, type: FightEventType, text: string, importance: 1 | 2 | 3, heroes: string[] = []) {
  ctx.events.push({ round: ctx.state.round, type, crossing: c.id, heroes, text, importance });
}

/** A level-3 family effect makes the news the first time it fires on a crossing. */
function tell3(ctx: Ctx, c: CrossingState, family: FamilyId, text: string, heroes: string[] = []) {
  if (c.family3Told.includes(family)) return;
  c.family3Told.push(family);
  say(ctx, c, 'family3', text, 3, heroes);
}

function describe(enemies: EnemyUnit[]): string {
  const counts = new Map<string, number>();
  for (const e of enemies) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}

// ---- A round ----

function playRound(state: FightState, events: FightEvent[]) {
  const ctx: Ctx = { state, events, rng: restoreRng(state.rng) };
  state.round += 1;
  joinFromCentre(ctx);
  for (const c of state.crossings) if (!c.arrived && c.arrival <= state.round) arrive(ctx, c);
  for (const c of state.crossings) fightRound(ctx, c);
  for (const h of state.heroes) {
    if (h.tauntRounds > 0) h.tauntRounds -= 1;
    if (h.shieldRounds > 0) h.shieldRounds -= 1;
  }
  refreshTug(state, ctx);
  state.rng = ctx.rng.state();
  state.done = isDone(state);
}

/** Enemies that broke through last round fall on the crossing whose heroes have the most HP left. */
function joinFromCentre(ctx: Ctx) {
  const s = ctx.state;
  const waiting = s.enemies.filter((e) => e.status === 'centre' && s.round - e.centreRound >= R.breach.centreRounds);
  if (waiting.length === 0) return;
  const hpLeft = (c: CrossingState) => standing(s, c).reduce((sum, h) => sum + h.hp, 0);
  const target = s.crossings.filter((c) => !c.broken && standing(s, c).length > 0).sort((a, b) => hpLeft(b) - hpLeft(a))[0];
  if (!target) return;
  for (const e of waiting) {
    e.status = 'active';
    e.crossing = target.id;
  }
  target.cleared = false;
  say(ctx, target, 'join', `${target.name}: ${describe(waiting)} come out of the centre.`, 2);
}

function arrive(ctx: Ctx, c: CrossingState) {
  const s = ctx.state;
  c.arrived = true;
  const pack = s.enemies.filter((e) => e.home === c.id && e.status === 'waiting');
  if (standing(s, c).length === 0) {
    breach(ctx, c, pack, (moving) => `No one holds ${c.name}: ${describe(moving)} slip through to the centre.`);
    return;
  }
  for (const e of pack) e.status = 'active';
  const undeadHp = penaltyPct(s, c, 'enemyHp');
  for (const e of pack) {
    if (undeadHp > 0 && e.tags.includes('undead')) {
      e.maxHp = Math.round(e.maxHp * (1 + undeadHp));
      e.hp = e.maxHp;
    }
  }
  say(ctx, c, 'arrival', `${c.name}: ${describe(pack)} arrive.`, 2);

  if (level(s, c, 'watch') >= 2) {
    const slipped = pack.filter((e) => e.status === 'active' && e.rank !== 'boss').sort((a, b) => a.maxHp - b.maxHp)[0];
    if (slipped && active(s, c).length > 1) {
      slipped.status = 'avoided';
      slipped.crossing = null;
      say(ctx, c, 'special', `${c.name}: the heroes slip past the ${slipped.name}.`, 1);
    }
  }
  if (level(s, c, 'watch') >= 3) tell3(ctx, c, 'watch', `${c.name}: the watch is set; the heroes strike first.`);
  if (level(s, c, 'wild') >= 3 && !c.calmUsed) {
    const beast = active(s, c).find((e) => e.rank === 'regular' && e.tags.includes('beast'));
    if (beast && active(s, c).length > 1) {
      c.calmUsed = true;
      beast.status = 'calmed';
      tell3(ctx, c, 'wild', `${c.name}: a ${beast.name} is calmed and turns on its pack.`);
    }
  }
  const cunning = level(s, c, 'cunning');
  if (cunning >= 1) {
    const enemies = active(s, c);
    const caught = cunning >= 2 ? enemies : [enemies[ctx.rng.int(0, enemies.length - 1)]];
    for (const e of caught) hurtEnemy(ctx, c, e, Math.ceil(e.maxHp * F.cunning.trapHit), null);
    say(ctx, c, 'trap', `${c.name}: a trap springs on the ${describe(caught)}.`, 1);
  }
  throwFlasks(ctx, c);
  const trap = penaltyPct(s, c, 'trapWounds');
  if (trap > 0) {
    const heroes = standing(s, c);
    const victim = heroes[ctx.rng.int(0, heroes.length - 1)];
    say(ctx, c, 'trap', `${c.name}: ${victim.name} is caught in a snare.`, 2, [victim.id]);
    hurtHero(ctx, c, victim, Math.round(trap * victim.maxHp));
  }
  if (level(s, c, 'rally') >= 2) for (const h of standing(s, c)) heal(h, F.rally.healShare);
  const rally3 = level(s, c, 'rally') >= 3;
  if (rally3) tell3(ctx, c, 'rally', `${c.name}: the rally rings out; every special can fire twice.`);
  for (const h of standing(s, c)) {
    h.specialUses = 1 + (rally3 ? F.rally.extraSpecialUses : 0);
    fightStartSpecial(ctx, c, h);
  }
  checkCrossing(ctx, c);
}

function throwFlasks(ctx: Ctx, c: CrossingState) {
  for (const id of c.flasks) {
    const effect = consumables[id].effect;
    if (effect.kind !== 'elementDamage') continue;
    say(ctx, c, 'special', `${c.name}: a ${consumables[id].name.toLowerCase()} bursts over the pack.`, 2);
    for (const e of active(ctx.state, c)) hurtEnemy(ctx, c, e, Math.round(effect.damage * wheel(effect.element, e.element)), null);
  }
  c.flasks = [];
}

function fightStartSpecial(ctx: Ctx, c: CrossingState, h: HeroUnit) {
  const special = specials[h.special];
  if (special.trigger.kind !== 'fightStart' || h.specialUses <= 0) return;
  const enemies = active(ctx.state, c);
  if (enemies.length < (special.trigger.minEnemies ?? 1)) return;
  h.specialUses -= 1;
  if (special.effect.kind === 'sureCrit') {
    h.sureCrit = true;
    say(ctx, c, 'special', `${c.name}: ${h.name} takes aim.`, 1, [h.id]);
  } else if (special.effect.kind === 'allEnemies') {
    say(ctx, c, 'special', `${c.name}: ${h.name}'s ${special.name.toLowerCase()} sweeps the pack.`, 2, [h.id]);
    for (const e of enemies) hurtEnemy(ctx, c, e, heroHit(ctx, c, h, e, special.effect.share), h);
  }
}

function fightRound(ctx: Ctx, c: CrossingState) {
  const s = ctx.state;
  if (c.broken) return;
  for (const e of active(s, c)) {
    if (!e.poison) continue;
    hurtEnemy(ctx, c, e, e.poison.damage, s.heroes.find((h) => h.id === e.poison?.by) ?? null);
    if (e.poison) e.poison = e.poison.rounds > 1 ? { ...e.poison, rounds: e.poison.rounds - 1 } : null;
  }
  checkCrossing(ctx, c);
  if (active(s, c).length === 0 || standing(s, c).length === 0) return;

  const first = s.round === c.arrival;
  const watch = level(s, c, 'watch');
  const ambushed = first && exposed(s, c);
  const heroSpeed = (h: HeroUnit) =>
    h.speed + (c.terrain === 'flooded' ? R.flooded.heroSpeed : 0) + (watch >= 1 && first ? F.watch.firstRoundSpeed : 0);
  type Actor = { kind: 'hero'; unit: HeroUnit; speed: number } | { kind: 'ally' | 'enemy'; unit: EnemyUnit; speed: number };
  const actors: Actor[] = [
    ...standing(s, c).map((unit) => ({ kind: 'hero' as const, unit, speed: heroSpeed(unit) })),
    ...calmed(s, c).map((unit) => ({ kind: 'ally' as const, unit, speed: unit.speed })),
    ...active(s, c).map((unit) => ({ kind: 'enemy' as const, unit, speed: unit.speed })),
  ];
  // Watch 3 puts the heroes first; a missed Darkness puts the pack first in its first round.
  const group = (a: Actor) => (watch >= 3 ? (a.kind === 'enemy' ? 1 : 0) : ambushed ? (a.kind === 'enemy' ? 0 : 1) : 0);
  const kindOrder = { hero: 0, ally: 1, enemy: 2 };
  actors.sort((a, b) => group(a) - group(b) || b.speed - a.speed || kindOrder[a.kind] - kindOrder[b.kind]);

  let attacks = 0;
  for (const actor of actors) {
    if (active(s, c).length === 0 || standing(s, c).length === 0) break;
    if (actor.kind === 'hero') {
      const h = actor.unit;
      if (h.status !== 'standing') continue;
      heroTurn(ctx, c, h);
      if (level(s, c, 'bloodrage') >= 3 && h.status === 'standing' && h.hp < F.bloodrage.extraBelowHp * h.maxHp && active(s, c).length > 0) {
        tell3(ctx, c, 'bloodrage', `${c.name}: ${h.name}, bleeding, fights twice as hard.`, [h.id]);
        heroTurn(ctx, c, h);
      }
    } else if (actor.kind === 'ally') {
      if (actor.unit.status !== 'calmed') continue;
      const target = lowestHp(active(s, c));
      hurtEnemy(ctx, c, target, Math.round(actor.unit.damage * variance(ctx.rng)), null);
    } else {
      const e = actor.unit;
      if (e.status !== 'active') continue;
      if (e.skipTurns > 0) {
        e.skipTurns -= 1;
        continue;
      }
      if (c.terrain === 'narrow' && attacks >= R.narrow.attackers) continue;
      attacks += 1;
      enemyTurn(ctx, c, e);
    }
  }
  checkCrossing(ctx, c);
}

function heroTurn(ctx: Ctx, c: CrossingState, h: HeroUnit) {
  const s = ctx.state;
  const enemies = active(s, c);
  if (enemies.length === 0) return;
  const special = specials[h.special];
  if (h.specialUses > 0 && special.trigger.kind === 'heroTurnVsTags') {
    const tags = special.trigger.tags;
    const removes = special.effect.kind === 'removeEnemy';
    const mark = enemies.find((e) => e.tags.some((t) => tags.includes(t)) && (!removes || e.rank === 'regular'));
    if (mark) {
      h.specialUses -= 1;
      if (special.effect.kind === 'removeEnemy') {
        say(ctx, c, 'special', `${c.name}: ${h.name} banishes the ${mark.name}.`, 2, [h.id]);
        hurtEnemy(ctx, c, mark, mark.hp, h);
      } else if (special.effect.kind === 'strike') {
        say(ctx, c, 'special', `${c.name}: ${h.name} smites the ${mark.name}.`, 2, [h.id]);
        hurtEnemy(ctx, c, mark, heroHit(ctx, c, h, mark, special.effect.multiplier), h);
      }
      return;
    }
  }
  const target = lowestHp(enemies);
  let poison: { share: number; rounds: number } | null = null;
  if (h.specialUses > 0 && special.trigger.kind === 'heroTurn' && ctx.rng.chance(special.trigger.chance)) {
    h.specialUses -= 1;
    if (special.effect.kind === 'skipTurn') {
      if (ctx.rng.chance(special.effect.chance)) target.skipTurns = 1;
      say(ctx, c, 'special', `${c.name}: ${h.name} entangles the ${target.name}.`, 1, [h.id]);
    } else if (special.effect.kind === 'damageOverTime') {
      poison = { share: special.effect.share, rounds: special.effect.rounds };
      say(ctx, c, 'special', `${c.name}: ${h.name} poisons the ${target.name}.`, 1, [h.id]);
    }
  }
  const damage = heroHit(ctx, c, h, target);
  hurtEnemy(ctx, c, target, damage, h);
  if (poison && target.status === 'active') target.poison = { damage: Math.round(damage * poison.share), rounds: poison.rounds, by: h.id };
  if (level(s, c, 'faith') >= 2 && target.tags.some((t) => F.faith.vsTags.includes(t))) {
    h.hp = Math.min(h.maxHp, h.hp + Math.round(F.faith.healShare * damage));
  }
  if (h.damageStat === 'magic' && level(s, c, 'spellweave') >= 2) {
    const other = active(s, c).find((e) => e !== target);
    const scale = other?.rank === 'boss' ? enemyRules.weakness.spellweave : 1;
    if (other) hurtEnemy(ctx, c, other, Math.round(damage * F.spellweave.chainShare * scale), h);
  }
}

/** A hero's hit on an enemy, every multiplier in. */
function heroHit(ctx: Ctx, c: CrossingState, h: HeroUnit, target: EnemyUnit, multiplier = 1): number {
  const s = ctx.state;
  // Spellweave is stronger against the boss (his weakness).
  const weave = target.rank === 'boss' ? enemyRules.weakness.spellweave : 1;
  let m = multiplier * variance(ctx.rng);
  if (h.tired) m *= R.tiredDamage;
  m *= 1 - penaltyPct(s, c, 'weakened');
  if (level(s, c, 'rally') >= 1) m *= F.rally.damage;
  if (level(s, c, 'faith') >= 1 && target.tags.some((t) => F.faith.vsTags.includes(t))) m *= F.faith.damage;
  if (level(s, c, 'bloodrage') >= 1 && h.hp < F.bloodrage.belowHp * h.maxHp) m *= F.bloodrage.damage;
  const spellweave = level(s, c, 'spellweave');
  if (spellweave >= 1 && h.damageStat === 'magic') {
    const rounds = Math.max(1, s.round - c.arrival + 1);
    m *= 1 + Math.min(F.spellweave.perRound * rounds, F.spellweave.max) * weave;
  }
  const advantage = wheel(h.element, target.element);
  if (advantage > 1 && spellweave >= 3) {
    m *= 1 + (advantage - 1) * F.spellweave.advantageScale * weave;
    tell3(ctx, c, 'spellweave', `${c.name}: ${h.name}'s magic finds the ${target.name}'s weak spot.`, [h.id]);
  } else m *= advantage;
  m *= 1 - target.armour * (h.damageStat === 'power' ? 1 : R.magicArmourShare);
  const critChance = h.crit / 100 + (level(s, c, 'watch') >= 3 && target.rank !== 'regular' ? F.watch.eliteCrit : 0);
  if (h.sureCrit) {
    h.sureCrit = false;
    m *= R.critMultiplier;
  } else if (ctx.rng.chance(critChance)) m *= R.critMultiplier;
  return Math.max(1, Math.round(h.attack * m));
}

function enemyTurn(ctx: Ctx, c: CrossingState, e: EnemyUnit) {
  const s = ctx.state;
  const heroes = standing(s, c);
  const taunting = heroes.filter((h) => h.tauntRounds > 0);
  const unshielded = heroes.filter((h) => h.shieldRounds === 0);
  const pool = taunting.length > 0 ? taunting : unshielded.length > 0 ? unshielded : heroes;
  const target = pool[ctx.rng.int(0, pool.length - 1)];
  if (ctx.rng.chance(Math.min(target.evasion, R.evasionCap) / 100)) return;

  let damage = e.damage * variance(ctx.rng);
  if (ctx.rng.chance(R.enemyCritChance)) damage *= R.critMultiplier;
  if (e.tags.includes('beast')) {
    damage *= 1 + penaltyPct(s, c, 'enemyDamage');
    if (level(s, c, 'wild') >= 1) damage *= F.wild.damageTaken;
  }
  damage *= 100 / (100 + R.defenseFactor * (e.damageType === 'power' ? target.armour : target.resistance));
  damage *= target.damageTaken;
  const taunt = specials.taunt.effect;
  if (target.tauntRounds > 0 && taunt.kind === 'taunt') damage *= taunt.damageTaken;

  const bulwark = level(s, c, 'bulwark');
  const scale = c.terrain === 'narrow' ? R.narrow.bulwarkScale : 1;
  const reduced = (taken: number) => 1 - (1 - taken) * scale;
  if (bulwark >= 3 && !c.firstHitDone) {
    damage *= reduced(F.bulwark.firstHitTaken);
    tell3(ctx, c, 'bulwark', `${c.name}: the shield wall takes the first blow.`);
  }
  c.firstHitDone = true;
  const front = heroes.reduce((top, h) => (h.maxHp > top.maxHp ? h : top));
  if (bulwark >= 1 && target === front) damage *= reduced(F.bulwark.frontTaken);
  let guarded = 0;
  if (bulwark >= 2 && target !== front && target === weakest(heroes)) {
    guarded = damage * Math.min(1, F.bulwark.guardShare * scale);
    damage -= guarded;
  }
  hurtHero(ctx, c, target, Math.round(damage));
  if (guarded > 0) hurtHero(ctx, c, front, Math.round(guarded * reduced(F.bulwark.frontTaken)));
  afterHit(ctx, c);
}

/** Draughts and the specials that answer a hurt ally. */
function afterHit(ctx: Ctx, c: CrossingState) {
  const s = ctx.state;
  const draught = consumables.healingDraught.effect;
  for (const h of standing(s, c)) {
    if (!h.draught || draught.kind !== 'heal' || h.hp >= draught.below * h.maxHp) continue;
    h.draught = false;
    heal(h, draught.pct);
    say(ctx, c, 'draught', `${c.name}: ${h.name} drinks a healing draught.`, 2, [h.id]);
  }
  for (const h of standing(s, c)) {
    const special = specials[h.special];
    if (h.specialUses <= 0 || special.trigger.kind !== 'hpBelow') continue;
    const pct = special.trigger.pct;
    const hurt = standing(s, c).filter((o) => o !== h && o.hp < pct * o.maxHp);
    if (hurt.length === 0) continue;
    h.specialUses -= 1;
    const ally = weakest(hurt);
    if (special.effect.kind === 'taunt') {
      h.tauntRounds = special.effect.rounds;
      say(ctx, c, 'special', `${c.name}: ${h.name} roars and draws every blow.`, 2, [h.id]);
    } else if (special.effect.kind === 'shieldWeakest') {
      ally.shieldRounds = special.effect.rounds;
      say(ctx, c, 'special', `${c.name}: ${h.name} draws the pack away from ${ally.name}.`, 2, [h.id, ally.id]);
    } else if (special.effect.kind === 'heal') {
      heal(ally, special.effect.pct);
      say(ctx, c, 'special', `${c.name}: ${h.name} mends ${ally.name}'s wounds.`, 1, [h.id, ally.id]);
    }
  }
}

function heal(h: HeroUnit, pct: number) {
  if (h.status === 'standing') h.hp = Math.min(h.maxHp, h.hp + Math.round(pct * h.maxHp));
}

function hurtEnemy(ctx: Ctx, c: CrossingState, e: EnemyUnit, amount: number, by: HeroUnit | null) {
  if (e.status !== 'active' || amount <= 0) return;
  e.hp -= amount;
  if (e.hp > 0) return;
  e.hp = 0;
  e.status = 'dead';
  e.poison = null;
  if (!by) {
    say(ctx, c, 'kill', `${c.name}: the ${e.name} falls.`, 1);
    return;
  }
  for (const tag of e.tags) by.kills[tag] = (by.kills[tag] ?? 0) + 1;
  say(ctx, c, 'kill', `${c.name}: ${by.name} fells the ${e.name}.`, 1, [by.id]);
  if (level(ctx.state, c, 'bloodrage') >= 2) heal(by, F.bloodrage.healOnKill);
}

/** A knockout sends a hero to death's door and out of the fight; at death's door already, it kills them. */
function hurtHero(ctx: Ctx, c: CrossingState, h: HeroUnit, amount: number) {
  if (h.status !== 'standing' || amount <= 0) return;
  h.hp -= amount;
  if (h.hp > 0) return;
  if (level(ctx.state, c, 'faith') >= 3 && !c.reviveUsed) {
    c.reviveUsed = true;
    h.hp = Math.max(1, Math.round(F.faith.revivePct * h.maxHp));
    tell3(ctx, c, 'faith', `${c.name}: ${h.name} falls, and Faith lifts them back up.`, [h.id]);
    return;
  }
  h.hp = 0;
  h.knockedOut = true;
  c.knockout = true;
  if (h.deathsDoor) {
    h.status = 'dead';
    say(ctx, c, 'death', `${c.name}: ${h.name} has fallen.`, 3, [h.id]);
  } else {
    h.deathsDoor = true;
    h.status = 'down';
    say(ctx, c, 'knockout', `${c.name}: ${h.name} is down, at death's door.`, 3, [h.id]);
  }
}

function checkCrossing(ctx: Ctx, c: CrossingState) {
  const s = ctx.state;
  if (c.broken) return;
  const enemies = active(s, c);
  if (enemies.length > 0 && standing(s, c).length === 0) {
    breach(ctx, c, enemies, (moving) => `${c.name} breaks! ${describe(moving)} pour into the centre.`);
  } else if (enemies.length === 0 && c.arrived && !c.cleared) {
    c.cleared = true;
    say(ctx, c, 'cleared', `${c.name} is clear.`, 2);
    const fellBeasts = s.enemies.some((e) => e.crossing === c.id && e.status === 'dead' && e.tags.includes('beast'));
    if (fellBeasts && level(s, c, 'wild') >= 2) for (const h of standing(s, c)) heal(h, F.wild.healShare);
    if (level(s, c, 'cunning') >= 3) tell3(ctx, c, 'cunning', `${c.name}: the bodies here are worth a second look.`);
  }
}

/** A crossing breaks: the strongest half of its enemies (rounded up) head for the centre, the rest stay to loot it. */
function breach(ctx: Ctx, c: CrossingState, enemies: EnemyUnit[], text: (moving: EnemyUnit[]) => string) {
  c.broken = true;
  c.cleared = false;
  const byStrength = [...enemies].sort((a, b) => b.hp * b.damage - a.hp * a.damage);
  const moving = byStrength.slice(0, Math.ceil(enemies.length * R.breach.moveShare));
  for (const e of moving) {
    e.status = 'centre';
    e.crossing = null;
    e.centreRound = ctx.state.round;
  }
  for (const e of byStrength.slice(moving.length)) {
    e.status = 'looting';
    e.crossing = c.id;
  }
  say(ctx, c, 'breach', text(moving), 3);
  if (moving.length < enemies.length) say(ctx, c, 'breach', `Half of them stay to loot the ${c.name.toLowerCase()}.`, 2);
}

/** Each crossing's tug value: the heroes' share of its strength (HP × damage); a fall below the bend line makes the news. */
function refreshTug(s: FightState, ctx: Ctx | null) {
  for (const c of s.crossings) {
    const heroes = standing(s, c).reduce((sum, h) => sum + h.hp * h.attack, 0);
    const enemies = active(s, c).reduce((sum, e) => sum + e.hp * e.damage, 0);
    const tug = c.broken ? 0 : heroes + enemies === 0 ? (standing(s, c).length > 0 ? 1 : 0) : heroes / (heroes + enemies);
    if (ctx && !c.broken && tug < R.bendBelow && c.tug >= R.bendBelow) say(ctx, c, 'bend', `${c.name} is bending.`, 3);
    if (ctx && !c.broken && tug < R.bendBelow) c.bent = true;
    c.tug = Math.round(tug * 1000) / 1000;
  }
}

function isDone(s: FightState): boolean {
  return s.round >= R.maxRounds || resolved(s);
}

/** Every crossing has broken or has no pack left, and nothing in the centre can still join a fight. */
function resolved(s: FightState): boolean {
  if (s.crossings.some((c) => !c.broken && (!c.arrived || active(s, c).length > 0))) return false;
  const centre = s.enemies.some((e) => e.status === 'centre');
  return !centre || !s.crossings.some((c) => !c.broken && standing(s, c).length > 0);
}

/**
 * Judged on the whole room: Held if cleared without ever bending below the line and without a
 * knockout; Bent if it bent, lost a hero to a knockout, or still fights at the round cap (a
 * crossing cleared, reopened and losing a hero is Bent); Broken if its heroes all fell.
 */
function resultOf(s: FightState): FightResult {
  return {
    rounds: s.round,
    timedOut: !resolved(s),
    crossings: Object.fromEntries(
      s.crossings.map((c) => [c.id, c.broken ? 'broken' : c.knockout || c.bent || active(s, c).length > 0 ? 'bent' : 'held']),
    ),
    heroes: Object.fromEntries(
      s.heroes.map((h) => [h.id, { hp: h.hp, deathsDoor: h.deathsDoor, dead: h.status === 'dead', knockedOut: h.knockedOut, kills: h.kills }]),
    ),
    extraLootRolls: Object.fromEntries(s.crossings.map((c) => [c.id, !c.broken && level(s, c, 'cunning') >= 3 ? F.cunning.lootRolls : 0])),
    looted: s.crossings.filter((c) => s.enemies.some((e) => e.status === 'looting' && e.crossing === c.id)).map((c) => c.id),
  };
}

function applyIntervention(ctx: Ctx, intervention: Intervention) {
  const s = ctx.state;
  if (intervention.kind === 'heal') {
    const h = s.heroes.find((x) => x.id === intervention.heroId);
    const draught = consumables.healingDraught.effect;
    if (!h || h.status !== 'standing' || draught.kind !== 'heal') throw new Error(`${intervention.heroId} can't be reached with a draught`);
    heal(h, draught.pct);
    say(ctx, crossing(s, h.crossing), 'intervention', `The strategist reaches ${h.name} with a healing draught.`, 3, [h.id]);
    return;
  }
  const c = crossing(s, intervention.crossingId);
  if (c.broken) throw new Error(`${c.name} has already broken`);
  if (intervention.kind === 'consumable') {
    addConsumable(c, intervention.consumable);
    say(ctx, c, 'intervention', `The strategist arrives at ${c.name} with a ${consumables[intervention.consumable].name.toLowerCase()}.`, 3);
    if (c.arrived) throwFlasks(ctx, c);
  } else {
    if (s.heroes.some((h) => h.id === intervention.hero.hero.id)) throw new Error(`${intervention.hero.hero.name} is already in the fight`);
    const h = heroUnit(intervention.hero, c.id);
    s.heroes.push(h);
    say(ctx, c, 'intervention', `The strategist sends ${h.name} to ${c.name}.`, 3, [h.id]);
  }
  checkCrossing(ctx, c);
}
