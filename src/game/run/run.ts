import { consumables, type ConsumableId } from '@/content/consumables';
import { weaponDrops, type EnemyTag } from '@/content/enemies';
import { armours, classAffinities, weapons, type ArmourType, type GearType, type Weapon, type WeaponType } from '@/content/gear';
import { heroClasses, recruitClasses, rosterRules, startingHeroes, veteranRules, type HeroClassId, type HeroDef } from '@/content/heroes';
import { lootRules, peddlerRules, recruitNames, roomRules, runRules, titleRules, titles, type TitleId } from '@/content/run';
import { traits, type TraitId } from '@/content/traits';

import { crossingLevels, resumeFight, simulateFight } from '../fight/engine';
import { sliceTimeline } from '../fight/slices';
import type { Assignment, FightEvent, Intervention, Snapshot } from '../fight/types';
import { heroUnit } from '../fight/units';
import { createRng, type Rng } from '../generation/rng';
import { generateMap, nextNodes, nodeById } from './map';
import { generateRoom } from './rooms';
import type { Aftermath, Bodies, Fallen, Find, PeddlerStock, Report, RoomFight, RosterHero, RunOutcome, RunState, Stash } from './types';

/** Who goes where, as the briefing sets it. */
export type Brief = {
  crossings: Record<string, { heroes: string[]; consumables: ConsumableId[] }>;
  /** Heroes handed a healing draught. */
  draughts: string[];
  /** When rations are short, the heroes who go without (as many as are missing); defaultHungry when left out. */
  hungry?: string[];
};

/** "Go forward": one thing brought to the fight ahead. */
export type Help =
  | { kind: 'heal'; heroId: string }
  | { kind: 'consumable'; crossingId: string; consumable: ConsumableId }
  | { kind: 'addHero'; crossingId: string; heroId: string };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** A working copy: everything an action may change is copied, the map and timelines are shared. */
function draft(s: RunState): RunState {
  return {
    ...s,
    route: [...s.route],
    roster: clone(s.roster),
    stash: clone(s.stash),
    aftermath: clone(s.aftermath),
    fight: s.fight && { ...s.fight, titles: [...s.fight.titles], forward: s.fight.forward && { ...s.fight.forward } },
  };
}

export function maxHpOf(hero: HeroDef): number {
  return heroUnit({ hero, tired: false, deathsDoor: false }, '').maxHp;
}

function rosterHero(hero: HeroDef): RosterHero {
  return { hero, hp: maxHpOf(hero), deathsDoor: false, tired: false, roomsInARow: 0, roomsSinceMeal: 0, extraTags: {}, titles: [], heldAlone: 0, beasts: 0 };
}

function heroOf(s: RunState, heroId: string): RosterHero {
  const r = s.roster.find((x) => x.hero.id === heroId);
  check(r, `No hero ${heroId} in the roster`);
  return r;
}

function take(stash: Stash, id: ConsumableId) {
  check((stash.consumables[id] ?? 0) > 0, `No ${id} in the stash`);
  stash.consumables[id] = (stash.consumables[id] ?? 0) - 1;
}

function give(stash: Stash, id: ConsumableId, n = 1) {
  stash.consumables[id] = (stash.consumables[id] ?? 0) + n;
}

export function newRun(seed: string): RunState {
  return {
    seed,
    map: generateMap(seed),
    at: null,
    route: [],
    roster: startingHeroes.map(rosterHero),
    stash: { consumables: {}, weapons: [], armours: [] },
    gold: runRules.startingGold,
    rations: runRules.startingRations,
    watchSight: false,
    phase: 'brief',
    fight: null,
    aftermath: aftermathOf(seed, null, 'entrance', null, []),
    report: null,
    outcome: null,
  };
}

function aftermathOf(seed: string, nodeId: string | null, kind: Aftermath['kind'], bodies: Bodies | null, fallen: Fallen[]): Aftermath {
  return {
    nodeId,
    kind,
    actionsLeft: { camp: runRules.campActions, none: 0, entrance: runRules.actions, fight: runRules.actions }[kind],
    bodies,
    fallen,
    peddler: kind === 'none' ? { consumables: [], recruits: [], weapon: null } : stockOf(createRng(`${seed}:${nodeId ?? 'entrance'}:peddler`), nodeId ?? 'entrance'),
    peddlerOpen: false,
    found: null,
    left: false,
  };
}

function stockOf(rng: Rng, place: string): PeddlerStock {
  const others = (Object.keys(consumables) as ConsumableId[]).filter((id) => !peddlerRules.alwaysStocked.includes(id));
  const extra = Array.from({ length: peddlerRules.extraStock }, () => others.splice(rng.int(0, others.length - 1), 1)[0]);
  const recruits = Array.from({ length: peddlerRules.recruits }, (_, i) => {
    const classId = recruitClasses[rng.int(0, recruitClasses.length - 1)];
    const traitIds = Object.keys(traits) as TraitId[];
    return {
      id: `${place}-recruit${i}`,
      name: recruitNames[rng.int(0, recruitNames.length - 1)],
      classId,
      trait: traitIds[rng.int(0, traitIds.length - 1)],
      weapon: favoured(classId, Object.keys(weapons) as WeaponType[]),
      armour: favoured(classId, Object.keys(armours) as ArmourType[]),
    };
  });
  const types = Object.keys(weapons) as WeaponType[];
  return { consumables: [...peddlerRules.alwaysStocked, ...extra], recruits, weapon: { type: types[rng.int(0, types.length - 1)], quality: 'fine' } };
}

function favoured<T extends GearType>(classId: HeroClassId, gear: T[]): T | null {
  return gear.find((g) => classAffinities[classId][g] === 'favoured') ?? null;
}

// ---- Briefing ----

const sameWeapon = (a: Weapon, b: Weapon) => a.type === b.type && (a.quality ?? null) === (b.quality ?? null);

/** The weapon a hero carries, as the stash holds it. */
export function carriedWeapon(hero: HeroDef): Weapon | null {
  if (!hero.weapon) return null;
  return hero.weaponQuality ? { type: hero.weapon, quality: hero.weaponQuality } : { type: hero.weapon };
}

export function equip(state: RunState, heroId: string, slot: 'weapon' | 'armour', item: Weapon | ArmourType | null): RunState {
  check(state.phase === 'brief', 'Gear moves in the briefing');
  const s = draft(state);
  const r = heroOf(s, heroId);
  if (slot === 'weapon') {
    const weapon = item as Weapon | null;
    if (weapon) {
      const i = s.stash.weapons.findIndex((w) => sameWeapon(w, weapon));
      check(i >= 0, `No ${weapon.type} in the stash`);
      s.stash.weapons.splice(i, 1);
    }
    const old = carriedWeapon(r.hero);
    if (old) s.stash.weapons.push(old);
    r.hero = { ...r.hero, weapon: weapon?.type ?? null, weaponQuality: weapon?.quality };
  } else {
    const armour = item as ArmourType | null;
    if (armour) {
      check(s.stash.armours.includes(armour), `No ${armour} in the stash`);
      s.stash.armours.splice(s.stash.armours.indexOf(armour), 1);
    }
    if (r.hero.armour) s.stash.armours.push(r.hero.armour);
    r.hero = { ...r.hero, armour };
  }
  r.hp = Math.min(r.hp, maxHpOf(r.hero));
  return s;
}

/** The heroes sent who need a ration this room, and how many rations are missing. */
export function rationNeeds(state: RunState, sent: string[]): { eaters: string[]; missing: number } {
  const eaters = sent.filter((id) => {
    const r = heroOf(state, id);
    const trait = traits[r.hero.trait].effect;
    return r.roomsSinceMeal + 1 >= (trait.kind === 'rationEvery' ? trait.rooms : 1);
  });
  return { eaters, missing: Math.max(0, eaters.length - state.rations) };
}

/** By default, the heroes with the most HP go without. */
export function defaultHungry(state: RunState, sent: string[]): string[] {
  const { eaters, missing } = rationNeeds(state, sent);
  return [...eaters].sort((a, b) => heroOf(state, b).hp - heroOf(state, a).hp).slice(0, missing);
}

/**
 * Confirms the briefing: the next room is fought once, now, and the aftermath behind begins.
 * A camp has no fight: the party rests on arrival, and the strategist finishes the aftermath behind.
 */
export function sendIn(state: RunState, nodeId: string, brief: Brief): RunState {
  check(state.phase === 'brief', 'Not briefing');
  const node = nextNodes(state).find((n) => n.id === nodeId);
  check(node, `${nodeId} is not reachable`);
  const s = draft(state);
  const room = generateRoom(s.seed, node);
  s.at = nodeId;
  s.route.push(nodeId);
  s.phase = 'room';
  if (!room) {
    for (const r of s.roster) {
      r.tired = false;
      r.roomsInARow = 0;
      r.hp = Math.min(maxHpOf(r.hero), r.hp + Math.round(runRules.campHeal * maxHpOf(r.hero)));
    }
    s.fight = { nodeId, room, assignment: {}, hungry: [], timeline: null, slices: [], revealed: 0, forward: null, titles: [] };
    return s;
  }

  const sent = Object.values(brief.crossings).flatMap((c) => c.heroes);
  check(new Set(sent).size === sent.length, 'A hero can hold one crossing');
  for (const id of Object.keys(brief.crossings)) check(room.crossings.some((c) => c.id === id), `No crossing ${id}`);
  for (const id of sent) check(heroOf(s, id).hp > 0, `${id} can't fight`);
  for (const c of Object.values(brief.crossings)) {
    for (const id of c.consumables) {
      check(consumables[id].target === 'crossing', `${id} is handed to a hero`);
      take(s.stash, id);
    }
  }
  for (const id of brief.draughts) {
    check(sent.includes(id), `${id} is not going in`);
    take(s.stash, 'healingDraught');
  }

  const { eaters, missing } = rationNeeds(s, sent);
  const hungry = brief.hungry ?? defaultHungry(s, sent);
  check(hungry.length === missing && hungry.every((id) => eaters.includes(id)), `${missing} heroes must go without`);
  for (const id of sent) {
    const r = heroOf(s, id);
    r.roomsSinceMeal = eaters.includes(id) && !hungry.includes(id) ? 0 : r.roomsSinceMeal + 1;
  }
  s.rations -= eaters.length - missing;

  const assignment: Assignment = Object.fromEntries(
    Object.entries(brief.crossings).map(([id, c]) => [
      id,
      {
        consumables: c.consumables,
        heroes: c.heroes.map((heroId) => {
          const r = heroOf(s, heroId);
          const hardy = traits[r.hero.trait].effect.kind === 'hungerImmune';
          return {
            hero: r.hero,
            hp: r.hp,
            tired: r.tired || (hungry.includes(heroId) && !hardy),
            deathsDoor: r.deathsDoor,
            draught: brief.draughts.includes(heroId),
            extraTags: r.extraTags,
          };
        }),
      },
    ]),
  );
  const timeline = simulateFight(room, assignment, `${s.seed}:${nodeId}:fight`);
  // With nothing behind (after a camp), the fight is revealed with "Continue", as after "Go forward".
  const count = s.aftermath.kind === 'none' ? runRules.forwardSlices : s.aftermath.actionsLeft + 1;
  s.fight = { nodeId, room, assignment, hungry, timeline, slices: sliceTimeline(timeline, count), revealed: 0, forward: null, titles: [] };
  return s;
}

// ---- Aftermath ----

/** The fight as far as the strategist has seen it. */
export function currentSnapshot(fight: RoomFight): Snapshot | null {
  if (!fight.timeline) return null;
  return fight.revealed > 0 ? fight.slices[fight.revealed - 1].snapshot : fight.timeline.snapshots[0];
}

export function heroesInFight(fight: RoomFight | null): string[] {
  if (!fight) return [];
  const added = fight.forward?.intervention.kind === 'addHero' ? [fight.forward.intervention.hero.hero.id] : [];
  return [...Object.values(fight.assignment).flatMap((c) => c.heroes.map((h) => h.hero.id)), ...added];
}

/** Every aftermath action costs one action and reveals the next slice of the fight ahead. */
function spend(s: RunState) {
  check(s.phase === 'room' && !s.aftermath.left, 'The aftermath is over');
  check(s.aftermath.actionsLeft > 0, 'No actions left');
  s.aftermath.actionsLeft -= 1;
  s.aftermath.peddlerOpen = false;
  const fight = s.fight!;
  fight.revealed = Math.min(fight.revealed + 1, fight.slices.length);
}

function earn(s: RunState, r: RosterHero, title: TitleId) {
  if (r.titles.includes(title)) return;
  r.titles.push(title);
  const family = titles[title].family;
  r.extraTags[family] = (r.extraTags[family] ?? 0) + 1;
  s.fight?.titles.push({ heroId: r.hero.id, title });
}

/** Gold, rations, maybe consumables and a weapon from the enemies' tags; an open vault adds gold and a roll. */
export function search(state: RunState): RunState {
  const s = draft(state);
  const bodies = s.aftermath.bodies;
  check(bodies, 'Nothing to search');
  spend(s);
  const rng = createRng(`${s.seed}:${s.aftermath.nodeId}:search`);
  const tags = (Object.keys(bodies.kills) as EnemyTag[]).filter((t) => (bodies.kills[t] ?? 0) > 0);
  const kinds = Object.keys(consumables) as ConsumableId[];
  const row = s.aftermath.nodeId ? nodeById(s.map, s.aftermath.nodeId).row : 0;
  const find: Find = {
    gold: bodies.regulars * lootRules.gold.regular + bodies.elites * lootRules.gold.elite + (bodies.vault ? lootRules.vaultGold : 0),
    rations: rng.int(lootRules.rations.min, lootRules.rations.max),
    consumables: [],
    weapons: [],
  };
  for (let i = 0; i < 1 + bodies.extraRolls + (bodies.vault ? 1 : 0); i++) {
    if (rng.chance(lootRules.consumableChance)) find.consumables.push(kinds[rng.int(0, kinds.length - 1)]);
    if (tags.length > 0 && rng.chance(lootRules.weaponChance)) {
      const drops = weaponDrops[tags[rng.int(0, tags.length - 1)]];
      find.weapons.push({ type: drops[rng.int(0, drops.length - 1)], quality: row >= lootRules.masterworkFromRow ? 'masterwork' : 'fine' });
    }
  }
  s.gold += find.gold;
  s.rations += find.rations;
  for (const id of find.consumables) give(s.stash, id);
  s.stash.weapons.push(...find.weapons);
  s.aftermath.bodies = null;
  s.aftermath.found = find;
  return s;
}

/** Brings a hero back from death's door. Heroes in the fight ahead are out of reach. */
export function tend(state: RunState, heroId: string): RunState {
  const s = draft(state);
  const r = heroOf(s, heroId);
  check(r.deathsDoor, `${heroId} is not at death's door`);
  check(!heroesInFight(s.fight).includes(heroId), `${heroId} is in the fight ahead`);
  spend(s);
  const trait = traits[r.hero.trait].effect;
  const share = runRules.tendedHp + (trait.kind === 'tendedHp' ? trait.add : 0);
  r.deathsDoor = false;
  r.hp = Math.max(r.hp, Math.round(share * maxHpOf(r.hero)));
  earn(s, r, 'gravewalker');
  return s;
}

/** Rests one tired hero: no longer tired, and their rooms in a row count from 0 again. */
export function repair(state: RunState, heroId: string): RunState {
  const s = draft(state);
  const r = heroOf(s, heroId);
  check(r.tired, `${heroId} is not tired`);
  spend(s);
  r.tired = false;
  r.roomsInARow = 0;
  return s;
}

/** Recovers a fallen hero's gear, and leaves a keepsake: +1 of their class's family to a survivor. */
export function bury(state: RunState, fallenId: string, heirId: string): RunState {
  const s = draft(state);
  const fallen = s.aftermath.fallen.find((f) => f.hero.id === fallenId);
  check(fallen, `${fallenId} doesn't lie here`);
  check(!fallen.looted, `${fallenId}'s grave was looted`);
  const heir = heroOf(s, heirId);
  spend(s);
  const weapon = carriedWeapon(fallen.hero);
  if (weapon) s.stash.weapons.push(weapon);
  if (fallen.hero.armour) s.stash.armours.push(fallen.hero.armour);
  const family = heroClasses[fallen.hero.classId].familyTag;
  heir.extraTags[family] = (heir.extraTags[family] ?? 0) + 1;
  s.aftermath.fallen = s.aftermath.fallen.filter((f) => f !== fallen);
  return s;
}

/** One action opens the peddler: buy, sell and recruit as much as gold allows, until the next action. */
export function openPeddler(state: RunState): RunState {
  check(!state.aftermath.peddlerOpen, 'The peddler is open');
  const s = draft(state);
  spend(s);
  s.aftermath.peddlerOpen = true;
  return s;
}

function atPeddler(state: RunState): RunState {
  check(state.phase === 'room' && state.aftermath.peddlerOpen, 'The peddler is not open');
  return draft(state);
}

export function buy(state: RunState, item: ConsumableId | 'rations' | 'weapon'): RunState {
  const s = atPeddler(state);
  const stock = s.aftermath.peddler;
  const price = item === 'rations' ? peddlerRules.rations.price : item === 'weapon' ? peddlerRules.fineWeaponPrice : consumables[item].price;
  check(item === 'rations' || (item === 'weapon' ? stock.weapon : stock.consumables.includes(item)), `${item} is not for sale`);
  check(s.gold >= price, 'Not enough gold');
  s.gold -= price;
  if (item === 'rations') s.rations += peddlerRules.rations.count;
  else if (item === 'weapon') {
    s.stash.weapons.push(stock.weapon!);
    stock.weapon = null;
  } else give(s.stash, item);
  return s;
}

export function sell(state: RunState, item: ConsumableId | Weapon | ArmourType): RunState {
  const s = atPeddler(state);
  if (typeof item === 'object') {
    const i = s.stash.weapons.findIndex((w) => sameWeapon(w, item));
    check(i >= 0, `No ${item.type} in the stash`);
    s.stash.weapons.splice(i, 1);
    s.gold += Math.floor(peddlerRules.weaponPrice[item.quality ?? 'base'] * peddlerRules.sellShare);
  } else if (item in consumables) {
    take(s.stash, item as ConsumableId);
    s.gold += Math.floor(consumables[item as ConsumableId].price * peddlerRules.sellShare);
  } else {
    check(s.stash.armours.includes(item as ArmourType), `No ${item} in the stash`);
    s.stash.armours.splice(s.stash.armours.indexOf(item as ArmourType), 1);
    s.gold += Math.floor(peddlerRules.armourPrice * peddlerRules.sellShare);
  }
  return s;
}

export function recruit(state: RunState, recruitId: string): RunState {
  const s = atPeddler(state);
  const hero = s.aftermath.peddler.recruits.find((h) => h.id === recruitId);
  check(hero, `${recruitId} is not on offer`);
  check(s.roster.length < rosterRules.max, 'The roster is full');
  check(s.gold >= peddlerRules.recruitPrice, 'Not enough gold');
  s.gold -= peddlerRules.recruitPrice;
  s.roster.push(rosterHero(hero));
  s.aftermath.peddler.recruits = s.aftermath.peddler.recruits.filter((h) => h !== hero);
  return s;
}

// ---- Go forward ----

/**
 * Leaves the room behind for good (its unused actions and leftovers are lost) and brings
 * one thing to the fight ahead, from the snapshot of the last slice seen.
 */
export function goForward(state: RunState, help: Help): RunState {
  check(state.phase === 'room' && !state.aftermath.left, 'The strategist already went forward');
  check(state.aftermath.kind !== 'none', 'There is no room behind to leave');
  const s = draft(state);
  const fight = s.fight!;
  const snapshot = currentSnapshot(fight);
  check(snapshot && !snapshot.state.done, 'There is no fight left to help');
  let intervention: Intervention;
  if (help.kind === 'heal') {
    take(s.stash, 'healingDraught');
    intervention = help;
  } else if (help.kind === 'consumable') {
    check(consumables[help.consumable].target === 'crossing', `${help.consumable} is handed to a hero`);
    take(s.stash, help.consumable);
    intervention = help;
  } else {
    const r = heroOf(s, help.heroId);
    check(!heroesInFight(fight).includes(help.heroId) && r.hp > 0, `${help.heroId} can't be sent`);
    const hero = { hero: r.hero, hp: r.hp, tired: r.tired, deathsDoor: r.deathsDoor, extraTags: r.extraTags };
    intervention = { kind: 'addHero', crossingId: help.crossingId, hero };
  }
  const timeline = resumeFight(snapshot, intervention, fight.timeline!.seed);
  fight.forward = { intervention, timeline, slices: sliceTimeline(timeline, runRules.forwardSlices), revealed: 0 };
  s.aftermath.left = true;
  s.aftermath.actionsLeft = 0;
  s.aftermath.peddlerOpen = false;
  return s;
}

/** "Continue": reveals the next slice when there are no actions to spend (after "Go forward", or after a camp). */
export function continueFight(state: RunState): RunState {
  check(state.phase === 'room' && (state.fight?.forward || (state.aftermath.kind === 'none' && state.fight?.timeline)), 'Nothing to continue');
  const s = draft(state);
  const reveal = s.fight!.forward ?? s.fight!;
  reveal.revealed = Math.min(reveal.revealed + 1, reveal.slices.length);
  return s;
}

// ---- The end of a room ----

/**
 * Ends the aftermath (unused actions are lost), reveals the rest of the fight and settles the room.
 * At a camp, it ends the aftermath behind, then the camp's own, then goes to the briefing.
 */
export function endTurn(state: RunState): RunState {
  check(state.phase === 'room', 'No room under way');
  const s = draft(state);
  const fight = s.fight!;
  const node = nodeById(s.map, fight.nodeId);
  const timeline = fight.forward?.timeline ?? fight.timeline;
  fight.revealed = fight.slices.length;
  if (fight.forward) fight.forward.revealed = fight.forward.slices.length;

  if (!timeline) {
    if (s.aftermath.kind === 'camp' && s.aftermath.nodeId === node.id) {
      s.aftermath = aftermathOf(s.seed, node.id, 'none', null, []);
      s.fight = null;
      s.phase = 'brief';
    } else s.aftermath = aftermathOf(s.seed, node.id, 'camp', null, []);
    return s;
  }

  const final = timeline.snapshots[timeline.snapshots.length - 1].state;
  const { result } = timeline;
  const events: FightEvent[] = fight.forward
    ? [...fight.timeline!.events.filter((e) => e.round <= timeline.snapshots[0].round), ...timeline.events]
    : timeline.events;
  const fallen: Fallen[] = [];
  const wounded: string[] = [];
  const tired: string[] = [];
  const veterans: Report['veterans'] = [];
  const results = Object.values(result.crossings);
  const routed = results.filter((r) => r === 'broken').length > results.length * runRules.routShare;

  for (const r of [...s.roster]) {
    const unit = final.heroes.find((h) => h.id === r.hero.id);
    const max = maxHpOf(r.hero);
    if (!unit) {
      r.tired = false;
      r.roomsInARow = 0;
      r.hp = Math.min(max, r.hp + Math.round(runRules.benchHeal * max));
      continue;
    }
    const outcome = result.heroes[r.hero.id];
    // A routed party flees without the heroes down on its broken crossings.
    const leftBehind = routed && outcome.hp === 0 && result.crossings[unit.crossing] === 'broken';
    if (outcome.dead || leftBehind) {
      s.roster = s.roster.filter((x) => x !== r);
      const line = outcome.dead ? (events.filter((e) => e.heroes.includes(r.hero.id)).at(-1)?.text ?? '') : `${r.hero.name} was left behind as the party fled.`;
      fallen.push({ hero: r.hero, lastLine: line, looted: result.looted.includes(unit.crossing) });
      continue;
    }
    if (outcome.hp === 0) {
      wounded.push(r.hero.id);
      r.hp = Math.round(runRules.getUpHp * max);
    } else r.hp = outcome.hp;
    r.hp = Math.min(max, r.hp + Math.round(runRules.foughtHeal * max));
    r.deathsDoor = outcome.deathsDoor;
    if (unit.draught) give(s.stash, 'healingDraught');
    r.roomsInARow += 1;
    if (!r.tired && r.roomsInARow >= runRules.tiredAfter) tired.push(r.hero.id);
    r.tired = r.roomsInARow >= runRules.tiredAfter;
    const veteran = Math.min((r.hero.veteran ?? 0) + 1, veteranRules.maxRooms);
    if (veteran > (r.hero.veteran ?? 0)) {
      r.hero = { ...r.hero, veteran };
      veterans.push({ heroId: r.hero.id, bonus: Math.round(veteran * veteranRules.step * 100) / 100 });
    }
    r.beasts += outcome.kills.beast ?? 0;
    if (r.beasts >= titleRules.beasts) earn(s, r, 'beastslayer');
  }

  for (const c of final.crossings) {
    const on = final.heroes.filter((h) => h.crossing === c.id);
    const alone = on.length === 1 ? s.roster.find((r) => r.hero.id === on[0].id) : undefined;
    if (result.crossings[c.id] !== 'held' || !alone) continue;
    alone.heldAlone += 1;
    if (alone.heldAlone >= titleRules.heldAlone) earn(s, alone, 'unbroken');
  }

  for (const c of final.crossings) for (const id of c.flasks) give(s.stash, id);
  s.watchSight = final.crossings.some((c) => (crossingLevels(final, c.id).watch ?? 0) >= 2);

  const dead = final.enemies.filter((e) => e.status === 'dead');
  const kills: Bodies['kills'] = {};
  for (const e of dead) for (const tag of e.tags) kills[tag] = (kills[tag] ?? 0) + 1;
  const starts = [fight.timeline!, fight.forward?.timeline].filter((t) => t !== undefined).map((t) => t.snapshots[0].state);
  const vault =
    node.type === 'vault' && starts.some((st) => st.crossings.some((c) => (crossingLevels(st, c.id).cunning ?? 0) >= roomRules.vaultCunning));
  const bodies: Bodies = {
    kills,
    regulars: dead.filter((e) => e.rank === 'regular').length,
    elites: dead.filter((e) => e.rank === 'elite').length,
    extraRolls: Object.values(result.extraLootRolls).reduce((a, b) => a + b, 0),
    vault,
  };

  s.report = { nodeId: node.id, crossings: result.crossings, fallen, titles: fight.titles, wounded, tired, hungry: fight.hungry, timedOut: result.timedOut, routed, veterans };
  s.aftermath = aftermathOf(s.seed, node.id, 'fight', dead.length > 0 || vault ? bodies : null, fallen);
  const bossDown = final.enemies.some((e) => e.rank === 'boss' && e.status === 'dead');
  const end: RunOutcome['kind'] | null =
    node.type === 'boss' && bossDown ? 'win' : !canField(s) ? 'wipe' : routed ? 'rout' : node.type === 'boss' ? 'bossStands' : null;
  if (end) {
    s.phase = end === 'win' ? 'won' : 'lost';
    s.outcome = { kind: end, survivors: s.roster.map((r) => r.hero) };
  } else s.phase = 'report';
  return s;
}

/** The run is lost when no hero is alive or none can be sent in. */
export function canField(s: RunState): boolean {
  return s.roster.some((r) => r.hp > 0);
}

/** From the report to the next briefing. */
export function nextRoom(state: RunState): RunState {
  check(state.phase === 'report', 'No report to leave');
  return { ...state, phase: 'brief', fight: null, report: null };
}
