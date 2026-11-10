import { consumables, type ConsumableId } from '@/content/consumables';
import { enemyById } from '@/content/enemies';
import { familyOfThreat } from '@/content/families';
import { weapons, type Weapon } from '@/content/gear';
import { peddlerRules, runRules } from '@/content/run';

import { answers, familyCounts, heroTags } from '../families';
import type { CrossingResult } from '../fight/types';
import { heroUnit } from '../fight/units';
import { createRng } from '../generation/rng';
import { nextNodes, nodeById } from '../run/map';
import { generateRoom } from '../run/rooms';
import {
  bury,
  buy,
  carriedWeapon,
  equip,
  continueFight,
  currentSnapshot,
  endTurn,
  goForward,
  heroesInFight,
  maxHpOf,
  newRun,
  nextRoom,
  openPeddler,
  recruit,
  repair,
  search,
  sendIn,
  tend,
  type Brief,
} from '../run/run';
import type { RosterHero, RunOutcome, RunState } from '../run/types';

/** What one run did, for the balance report. */
export type RunRecord = {
  seed: string;
  won: boolean;
  end: RunOutcome['kind'] | null;
  /** Nodes entered, camps included (the boss is the 9th). */
  reached: number;
  deaths: number;
  crossings: Record<CrossingResult, number>;
  fights: number;
  timedOut: number;
  bossFought: boolean;
  bossTimedOut: boolean;
  forwards: number;
  /** Crossings whose result a Go forward changed, for better or worse. */
  forwardBetter: number;
  forwardWorse: number;
  /** Every crossing a Go forward made worse, to see why. */
  worseCases: { row: number; crossing: string; before: CrossingResult; after: CrossingResult; help: string }[];
  hungry: number;
  goldLeft: number;
  /** Per fight: the party as it went in, and how the room's crossings ended. */
  rooms: RoomRecord[];
};

export type RoomRecord = {
  row: number;
  heroes: number;
  hpShare: number;
  tired: number;
  crossings: number;
  broken: number;
  packHp: number;
  /** HP × damage of the heroes sent, and of the room's enemies. */
  partyStrength: number;
  enemyStrength: number;
};

/** The bot goes forward when a crossing's tug falls below this and it holds a healing draught or a flask. */
const FORWARD_BELOW = 0.45;
const FLASKS: ConsumableId[] = ['stormFlask', 'fireFlask'];
const RANK: Record<CrossingResult, number> = { broken: 0, bent: 1, held: 2 };

const strength = (r: RosterHero) => r.hp * heroUnit({ hero: r.hero, hp: r.hp, tired: r.tired, deathsDoor: r.deathsDoor, extraTags: r.extraTags }, '').attack;
const byStrength = (a: RosterHero, b: RosterHero) => strength(b) - strength(a);

/**
 * The briefing. Heroes rotate ahead of time: one this room would tire stays on the bench unless
 * they answer a threat or a crossing would otherwise be empty; tired ones only fill empty crossings.
 * If a crossing could only be filled with a hero at death's door and its pack is the room's
 * weakest, it is left empty (a breach accepted). Heroes go greedily to answer each crossing's
 * threats (highest first), then by strength to the crossing whose heroes are weakest against
 * its pack. Holy water goes where Holy is still short, flasks to the strongest pack; draughts
 * are kept for Go forward.
 */
export function botBrief(s: RunState, nodeId: string): Brief {
  const room = generateRoom(s.seed, nodeById(s.map, nodeId));
  if (!room) return { crossings: {}, draughts: [] };
  const packStrength = (crossingId: string) =>
    room.crossings.find((c) => c.id === crossingId)!.pack.reduce((sum, id) => sum + enemyById[id].hp * enemyById[id].damage, 0);

  // Fresh heroes all go. A hero this room would tire, a tired one, or one at death's door only
  // answers a threat (those about to tire) or gives an empty crossing its one hero.
  const fit = s.roster.filter((r) => r.hp > 0);
  const willTire = (r: RosterHero) => r.roomsInARow + 1 >= runRules.tiredAfter;
  const fresh = fit.filter((r) => !r.deathsDoor && !r.tired && !willTire(r)).sort(byStrength);
  const tiring = fit.filter((r) => !r.deathsDoor && !r.tired && willTire(r)).sort(byStrength);
  const tired = fit.filter((r) => !r.deathsDoor && r.tired).sort(byStrength);
  const dying = fit.filter((r) => r.deathsDoor).sort(byStrength);
  let targets = room.crossings.map((c) => c.id);
  if (fresh.length + tiring.length + tired.length < targets.length) {
    const weakestPack = [...targets].sort((a, b) => packStrength(a) - packStrength(b))[0];
    targets = targets.filter((id) => id !== weakestPack);
  }

  const on: Record<string, RosterHero[]> = Object.fromEntries(room.crossings.map((c) => [c.id, []]));
  const used = new Set<string>();
  const unused = (list: RosterHero[]) => list.filter((r) => !used.has(r.hero.id));
  const take = (r: RosterHero, crossingId: string) => {
    used.add(r.hero.id);
    on[crossingId].push(r);
  };
  const threats = room.crossings
    .filter((c) => targets.includes(c.id))
    .flatMap((c) => c.threats.map((t) => ({ c, t })))
    .sort((a, b) => b.t.level - a.t.level);
  for (const { c, t } of threats) {
    const family = familyOfThreat(t.id);
    const tags = (r: RosterHero) => (heroTags(r.hero)[family] ?? 0) + (r.extraTags[family] ?? 0);
    while (!answers(familyCounts(on[c.id]), t)) {
      const best = unused([...fresh, ...tiring])
        .filter((r) => tags(r) > 0)
        .sort((a, b) => tags(b) - tags(a) || byStrength(a, b))[0];
      if (!best) break;
      take(best, c.id);
    }
  }
  const empty = () => targets.filter((id) => on[id].length === 0);
  while (empty().length > unused(fresh).length) {
    const stand = unused([...tiring, ...tired, ...dying])[0];
    if (!stand) break;
    take(stand, empty()[0]);
  }
  const free = unused(fresh);
  const ratio = (crossingId: string) => on[crossingId].reduce((sum, r) => sum + strength(r), 0) / packStrength(crossingId);
  for (const r of free) take(r, [...targets].sort((a, b) => ratio(a) - ratio(b))[0]);

  const items: Record<string, ConsumableId[]> = Object.fromEntries(room.crossings.map((c) => [c.id, []]));
  const stock = { ...s.stash.consumables };
  const strongest = [...targets].sort((a, b) => packStrength(b) - packStrength(a))[0];
  for (const c of room.crossings) {
    if ((stock.holyWater ?? 0) > 0 && c.threats.some((t) => t.id === 'holy' && !answers(familyCounts(on[c.id]), t))) {
      items[c.id].push('holyWater');
      stock.holyWater! -= 1;
    }
  }
  if (strongest) for (const id of FLASKS) for (let n = stock[id] ?? 0; n > 0; n--) items[strongest].push(id);

  return {
    crossings: Object.fromEntries(room.crossings.map((c) => [c.id, { heroes: on[c.id].map((r) => r.hero.id), consumables: items[c.id] }])),
    draughts: [],
  };
}

/**
 * Goes forward when a crossing's tug has fallen below the line: a draught to its weakest standing
 * hero, or else a flask on the crossing.
 */
export function botForward(s: RunState): RunState {
  const fight = s.fight;
  if (!fight?.timeline || s.aftermath.left || s.aftermath.kind === 'none') return s;
  const snapshot = currentSnapshot(fight)!;
  if (snapshot.state.done) return s;
  const draught = (s.stash.consumables.healingDraught ?? 0) > 0;
  const flask = FLASKS.find((id) => (s.stash.consumables[id] ?? 0) > 0);
  for (const c of snapshot.state.crossings) {
    if (c.broken || !c.arrived || snapshot.tug[c.id] >= FORWARD_BELOW) continue;
    const hero = snapshot.state.heroes.filter((h) => h.crossing === c.id && h.status === 'standing').sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (draught && hero) return goForward(s, { kind: 'heal', heroId: hero.id });
    if (flask) return goForward(s, { kind: 'consumable', crossingId: c.id, consumable: flask });
  }
  return s;
}

const QUALITY = { base: 0, fine: 1, masterwork: 2 };
const qualityOf = (w: Weapon) => QUALITY[w.quality ?? 'base'];

/** The hero a weapon would upgrade: one carrying the same type, or a weapon of the same main family, at a lower quality. */
function upgradeFor(s: RunState, w: Weapon): RosterHero | undefined {
  const lower = (r: RosterHero) => {
    const c = carriedWeapon(r.hero);
    return !c || qualityOf(c) < qualityOf(w);
  };
  return (
    s.roster.find((r) => r.hero.weapon === w.type && lower(r)) ??
    s.roster.find((r) => r.hero.weapon && weapons[r.hero.weapon].family === weapons[w.type].family && lower(r))
  );
}

/** Before the briefing: the best weapons in the stash go to the heroes they upgrade. */
export function botEquip(s: RunState): RunState {
  for (const w of [...s.stash.weapons].sort((a, b) => qualityOf(b) - qualityOf(a))) {
    const hero = upgradeFor(s, w);
    if (hero) s = equip(s, hero.hero.id, 'weapon', w);
  }
  return s;
}

type Purchase = ConsumableId | 'rations' | 'recruit' | 'weapon';

/** The peddler is worth a visit for rations, draughts, a storm flask before the boss, a recruit, or a Fine weapon someone can use. */
function shoppingList(s: RunState): Purchase[] {
  const list: Purchase[] = [];
  let gold = s.gold;
  const want = (item: Purchase, price: number) => {
    if (gold < price) return;
    gold -= price;
    list.push(item);
  };
  if (s.roster.length < 6 && s.aftermath.peddler.recruits.length > 0) want('recruit', peddlerRules.recruitPrice);
  for (let r = s.rations; r < s.roster.length * 2; r += peddlerRules.rations.count) want('rations', peddlerRules.rations.price);
  for (let d = s.stash.consumables.healingDraught ?? 0; d < 2; d++) want('healingDraught', consumables.healingDraught.price);
  const row = s.at ? nodeById(s.map, s.at).row : -1;
  if (row >= 5 && (s.stash.consumables.stormFlask ?? 0) === 0) want('stormFlask', consumables.stormFlask.price);
  const weapon = s.aftermath.peddler.weapon;
  if (weapon && upgradeFor(s, weapon)) want('weapon', peddlerRules.fineWeaponPrice);
  return list;
}

export type BotAction =
  | { kind: 'tend'; heroId: string }
  | { kind: 'rest'; heroId: string }
  | { kind: 'search' }
  | { kind: 'peddler'; list: Purchase[] }
  | { kind: 'bury'; fallenId: string; heirId: string };

/** The next aftermath action: tend, then rest a tired hero when more than half are tired, then search, the peddler (once), and burials. */
export function botAction(s: RunState, shopped: boolean): BotAction | null {
  const inFight = heroesInFight(s.fight);
  const wounded = s.roster.find((r) => r.deathsDoor && !inFight.includes(r.hero.id));
  if (wounded) return { kind: 'tend', heroId: wounded.hero.id };
  const tired = s.roster.filter((r) => r.tired).sort(byStrength);
  if (tired.length * 2 > s.roster.length) return { kind: 'rest', heroId: tired[0].hero.id };
  if (s.aftermath.bodies) return { kind: 'search' };
  const list = shopped ? [] : shoppingList(s);
  if (list.length > 0) return { kind: 'peddler', list };
  const heir = [...s.roster].sort(byStrength)[0];
  const grave = s.aftermath.fallen.find((f) => !f.looted);
  if (grave && heir) return { kind: 'bury', fallenId: grave.hero.id, heirId: heir.hero.id };
  return null;
}

function aftermath(s: RunState): RunState {
  s = botForward(s);
  let shopped = false;
  while (s.phase === 'room' && s.aftermath.actionsLeft > 0 && !s.aftermath.left) {
    const action = botAction(s, shopped);
    if (!action) break;
    if (action.kind === 'tend') s = tend(s, action.heroId);
    else if (action.kind === 'rest') s = repair(s, action.heroId);
    else if (action.kind === 'search') s = search(s);
    else if (action.kind === 'bury') s = bury(s, action.fallenId, action.heirId);
    else {
      s = openPeddler(s);
      for (const item of action.list) s = item === 'recruit' ? recruit(s, s.aftermath.peddler.recruits[0].id) : buy(s, item);
      shopped = true;
    }
    s = botForward(s);
  }
  while (s.fight?.forward && s.fight.forward.revealed < s.fight.forward.slices.length) s = continueFight(s);
  return s;
}

/** Plays a whole run with the bot. */
export function playRun(seed: string): RunRecord {
  let s = newRun(seed);
  const record: RunRecord = {
    seed,
    won: false,
    end: null,
    reached: 0,
    deaths: 0,
    crossings: { held: 0, bent: 0, broken: 0 },
    fights: 0,
    timedOut: 0,
    bossFought: false,
    bossTimedOut: false,
    forwards: 0,
    forwardBetter: 0,
    forwardWorse: 0,
    worseCases: [],
    hungry: 0,
    goldLeft: 0,
    rooms: [],
  };
  const pick = createRng(`${seed}:bot`);

  for (let guard = 0; s.phase === 'brief' && guard < 40; guard++) {
    const options = nextNodes(s);
    const node = options[pick.int(0, options.length - 1)];
    const party = { heroes: s.roster.length, hpShare: s.roster.reduce((sum, r) => sum + r.hp / maxHpOf(r.hero), 0) / s.roster.length, tired: s.roster.filter((r) => r.tired).length };
    s = botEquip(s);
    s = sendIn(s, node.id, botBrief(s, node.id));
    s = aftermath(s);
    if (s.fight?.room === null) {
      // A camp: the aftermath behind, then the camp's own.
      s = aftermath(endTurn(s));
      s = endTurn(s);
      continue;
    }
    const fight = s.fight!;
    if (fight.forward) {
      record.forwards += 1;
      const before = fight.timeline!.result.crossings;
      for (const [id, after] of Object.entries(fight.forward.timeline.result.crossings)) {
        if (RANK[after] > RANK[before[id]]) record.forwardBetter += 1;
        if (RANK[after] < RANK[before[id]]) {
          record.forwardWorse += 1;
          const help = fight.forward.intervention;
          const what = help.kind === 'heal' ? `draught to ${help.heroId}` : help.kind === 'consumable' ? `${help.consumable} on ${help.crossingId}` : `${help.hero.hero.id} to ${help.crossingId}`;
          record.worseCases.push({ row: node.row, crossing: id, before: before[id], after, help: `${what} at round ${fight.forward.timeline.snapshots[0].round}` });
        }
      }
    }
    s = endTurn(s);
    const report = s.report!;
    record.fights += 1;
    record.deaths += report.fallen.length;
    record.hungry += report.hungry.length;
    for (const result of Object.values(report.crossings)) record.crossings[result] += 1;
    const results = Object.values(report.crossings);
    const enemies = fight.room!.crossings.flatMap((c) => c.pack.map((id) => enemyById[id]));
    const sent = fight.timeline!.snapshots[0].state.heroes;
    record.rooms.push({
      row: node.row,
      ...party,
      crossings: results.length,
      broken: results.filter((r) => r === 'broken').length,
      packHp: enemies.reduce((sum, e) => sum + e.hp, 0),
      partyStrength: sent.reduce((sum, h) => sum + h.hp * h.attack, 0),
      enemyStrength: enemies.reduce((sum, e) => sum + e.hp * e.damage, 0),
    });
    if (report.timedOut) record.timedOut += 1;
    if (node.type === 'boss') {
      record.bossFought = true;
      record.bossTimedOut = report.timedOut;
    }
    if (s.phase === 'report') s = nextRoom(s);
  }

  record.won = s.phase === 'won';
  record.end = s.outcome?.kind ?? null;
  record.reached = s.route.length;
  record.goldLeft = s.gold;
  return record;
}
