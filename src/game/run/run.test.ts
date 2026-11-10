import { sliceTimeline } from '../fight/slices';
import { simulateFight } from '../fight/engine';
import type { RoomDef } from '../fight/types';
import { generateMap, nextNodes } from './map';
import { generateRoom } from './rooms';
import {
  bury,
  buy,
  continueFight,
  defaultHungry,
  endTurn,
  equip,
  goForward,
  maxHpOf,
  newRun,
  nextRoom,
  openPeddler,
  rationNeeds,
  recruit,
  repair,
  search,
  sendIn,
  tend,
  type Brief,
} from './run';
import type { RunState } from './types';

/** Every hero who can fight, spread over the crossings, but those left on the bench. */
function briefFor(s: RunState, nodeId: string, bench: string[] = []): Brief {
  const room = generateRoom(s.seed, nextNodes(s).find((n) => n.id === nodeId)!);
  const brief: Brief = { crossings: {}, draughts: [] };
  if (!room) return brief;
  for (const c of room.crossings) brief.crossings[c.id] = { heroes: [], consumables: [] };
  s.roster
    .filter((r) => r.hp > 0 && !bench.includes(r.hero.id))
    .forEach((r, i) => brief.crossings[room.crossings[i % room.crossings.length].id].heroes.push(r.hero.id));
  return brief;
}

const enterFirst = (s: RunState, bench: string[] = []) => sendIn(s, nextNodes(s)[0].id, briefFor(s, nextNodes(s)[0].id, bench));

/** A run whose next room is a hand-made fight, as if sent in from the briefing. */
function staged(s: RunState, room: RoomDef, crossings: Record<string, string[]>, nodeId = s.map.rows[0][0].id, seed = 'seed'): RunState {
  const assignment = Object.fromEntries(
    Object.entries(crossings).map(([id, heroIds]) => [
      id,
      {
        consumables: [],
        heroes: heroIds.map((heroId) => {
          const r = s.roster.find((x) => x.hero.id === heroId)!;
          return { hero: r.hero, hp: r.hp, tired: r.tired, deathsDoor: r.deathsDoor, extraTags: r.extraTags };
        }),
      },
    ]),
  );
  const timeline = simulateFight(room, assignment, seed);
  return {
    ...s,
    phase: 'room',
    at: nodeId,
    fight: { nodeId, room, assignment, hungry: [], timeline, slices: sliceTimeline(timeline, 4), revealed: 0, forward: null, titles: [] },
  };
}

const mark = (s: RunState, ids: string[], change: object): RunState => ({ ...s, roster: s.roster.map((r) => (ids.includes(r.hero.id) ? { ...r, ...change } : r)) });

const oneCrossing = (pack: string[], id = 'r'): RoomDef => ({
  id,
  name: 'R',
  crossings: [{ id: 'c0', name: 'Hall', terrain: 'open', pack, arrival: 1, threats: [] }],
});

/** The first seed whose map has a node of this type. */
function seedWith(type: string): string {
  for (let i = 0; ; i++) if (generateMap(`s${i}`).rows.flat().some((n) => n.type === type)) return `s${i}`;
}

describe('the run', () => {
  it('starts at the entrance with six heroes, gold, rations and three actions', () => {
    const s = newRun('seed');
    expect(s).toMatchObject({ phase: 'brief', at: null, gold: 40, rations: 18, aftermath: { kind: 'entrance', actionsLeft: 3 } });
    expect(s.roster).toHaveLength(6);
  });

  it('spends one action per aftermath step, each revealing a slice, without touching the fight', () => {
    let s = enterFirst(newRun('seed'));
    const timeline = s.fight!.timeline;
    expect(s.fight!.slices.length).toBe(Math.min(4, timeline!.result.rounds));
    s = openPeddler(s);
    s = buy(buy(s, 'rations'), 'healingDraught');
    expect(s.aftermath.actionsLeft).toBe(2);
    expect(s.fight!.revealed).toBe(1);

    s = { ...s, roster: s.roster.map((r) => ({ ...r, tired: true })) };
    s = repair(repair(s, 'bram'), 'mira');
    expect(s.aftermath.actionsLeft).toBe(0);
    expect(s.fight!.revealed).toBe(Math.min(3, s.fight!.slices.length));
    expect(() => repair(s, 'odo')).toThrow('No actions left');
    expect(s.fight!.timeline).toEqual(timeline);

    s = endTurn(s);
    expect(s.phase).toBe('report');
    expect(s.fight!.revealed).toBe(s.fight!.slices.length);
  });

  it('closes the peddler with the next action: buying several things is one action', () => {
    let s = openPeddler(enterFirst(newRun('seed')));
    s = buy(buy(buy(s, 'rations'), 'rations'), 'stormFlask');
    expect(s.aftermath.actionsLeft).toBe(2);
    expect(s.gold).toBe(40 - 6 - 6 - 15);
    s = { ...s, roster: s.roster.map((r) => ({ ...r, tired: true })) };
    s = repair(s, 'bram');
    expect(() => buy(s, 'rations')).toThrow('not open');
  });

  it('pauses at a camp: rest on arrival, the aftermath behind, then the camp’s 5 actions, then a fight revealed with Continue', () => {
    const seed = seedWith('camp');
    const map = generateMap(seed);
    const camp = map.rows.flat().find((n) => n.type === 'camp')!;
    const before = map.rows[camp.row - 1].find((n) => n.next.includes(camp.id))!;
    let s: RunState = { ...newRun(seed), at: before.id };
    s = { ...s, roster: s.roster.map((r) => ({ ...r, tired: true, roomsInARow: 3, hp: 1 })) };

    s = sendIn(s, camp.id, { crossings: {}, draughts: [] });
    expect(s.roster.every((r) => !r.tired && r.roomsInARow === 0 && r.hp > 1)).toBe(true);
    expect(s.rations).toBe(18);
    expect(s.aftermath).toMatchObject({ kind: 'entrance', actionsLeft: 3 });
    s = openPeddler(s);
    s = endTurn(s);
    expect(s).toMatchObject({ phase: 'room', aftermath: { kind: 'camp', nodeId: camp.id, actionsLeft: 5 } });
    s = endTurn(openPeddler(s));
    expect(s).toMatchObject({ phase: 'brief', fight: null, report: null, aftermath: { kind: 'none', actionsLeft: 0 } });

    s = enterFirst(s);
    const fight = s.fight!;
    expect(fight.slices).toHaveLength(Math.min(2, fight.timeline!.result.rounds));
    expect(() => openPeddler(s)).toThrow('No actions left');
    expect(() => goForward(s, { kind: 'heal', heroId: 'bram' })).toThrow('no room behind');
    expect(continueFight(s).fight!.revealed).toBe(1);
  });

  it('loses the unused actions and the room behind on Go forward, and plays the rest from the snapshot', () => {
    let s = enterFirst(newRun('seed'));
    s = nextRoom(endTurn(s));
    expect(s.aftermath.bodies).not.toBeNull();
    s = enterFirst(s, ['bram']);
    const gold = s.gold;
    s = goForward(s, { kind: 'addHero', crossingId: 'c0', heroId: 'bram' });

    expect(s.aftermath).toMatchObject({ actionsLeft: 0, left: true });
    expect(() => search(s)).toThrow('aftermath is over');
    expect(() => goForward(s, { kind: 'addHero', crossingId: 'c1', heroId: 'bram' })).toThrow();
    const forward = s.fight!.forward!;
    expect(forward.slices).toHaveLength(Math.min(2, forward.timeline.result.rounds));
    expect(forward.slices[0].lines[0].text).toContain('The strategist sends Bram');
    s = continueFight(s);
    expect(s.fight!.forward!.revealed).toBe(1);

    s = endTurn(s);
    expect(s.report!.crossings).toEqual(forward.timeline.result.crossings);
    expect(s.gold).toBe(gold);
    expect(s.aftermath.nodeId).toBe(s.at);
  });

  it('takes help from the stash only', () => {
    const s = enterFirst(newRun('seed'));
    expect(() => goForward(s, { kind: 'heal', heroId: 'bram' })).toThrow('No healingDraught');
  });

  it('feeds one ration per hero sent; when short, the player picks who goes without, the most HP by default', () => {
    const fed = enterFirst(newRun('seed'));
    // Wren eats every other room.
    expect(fed.rations).toBe(18 - 5);
    expect(fed.fight!.hungry).toEqual([]);

    const short = { ...newRun('seed'), rations: 2 };
    const node = nextNodes(short)[0].id;
    const brief = briefFor(short, node);
    const sent = Object.values(brief.crossings).flatMap((c) => c.heroes);
    const needs = rationNeeds(short, sent);
    expect([needs.eaters.sort(), needs.missing]).toEqual([['bram', 'fen', 'mira', 'odo', 'sly'], 3]);
    const byHp = [...short.roster].filter((r) => r.hero.id !== 'wren').sort((a, b) => b.hp - a.hp).map((r) => r.hero.id);
    expect(defaultHungry(short, sent).sort()).toEqual(byHp.slice(0, 3).sort());

    const tiredIn = (s: RunState) =>
      Object.values(s.fight!.assignment)
        .flatMap((c) => c.heroes)
        .filter((h) => h.tired)
        .map((h) => h.hero.id)
        .sort();
    const chosen = sendIn(short, node, { ...brief, hungry: ['fen', 'odo', 'sly'] });
    expect(chosen.rations).toBe(0);
    expect(chosen.fight!.hungry).toEqual(['fen', 'odo', 'sly']);
    // Fen is hardy.
    expect(tiredIn(chosen)).toEqual(['odo', 'sly']);
    expect(() => sendIn(short, node, { ...brief, hungry: ['odo'] })).toThrow('3 heroes must go without');
  });

  it('returns unused flasks to the stash', () => {
    let s = newRun('seed');
    s = { ...s, stash: { ...s.stash, consumables: { fireFlask: 2 } } };
    const node = nextNodes(s)[0].id;
    const brief = briefFor(s, node);
    const [held, empty] = Object.keys(brief.crossings);
    brief.crossings[held] = { heroes: s.roster.map((r) => r.hero.id), consumables: ['fireFlask'] };
    brief.crossings[empty] = { heroes: [], consumables: ['fireFlask'] };
    s = endTurn(sendIn(s, node, brief));
    // The flask on the held crossing burst; the one left on the empty crossing comes back.
    expect(s.stash.consumables.fireFlask).toBe(1);
  });

  it('remembers Watch 2 on a crossing for the next sight', () => {
    const s = newRun('seed');
    // Wren (Scout, bow) and Fen (spear) bring 3 Watch tags: Watch 2.
    expect(endTurn(staged(s, oneCrossing(['giantRat']), { c0: ['wren', 'fen'] })).watchSight).toBe(true);
    expect(endTurn(staged(s, oneCrossing(['giantRat']), { c0: ['wren'] })).watchSight).toBe(false);
  });

  it('heals after a room: 15% for those who fought (on top of getting up from a knockout), 40% for those who sat out', () => {
    let s = newRun('seed');
    s = { ...s, roster: s.roster.map((r) => (r.hero.id === 'odo' ? { ...r, hp: 10 } : r)) };
    const max = (id: string) => maxHpOf(s.roster.find((r) => r.hero.id === id)!.hero);
    const fought = staged(s, oneCrossing(['giantRat']), { c0: ['bram'] });
    const bramAfterFight = fought.fight!.timeline!.result.heroes.bram.hp;
    expect(bramAfterFight).toBeGreaterThan(0);
    expect(endTurn(fought).roster.find((r) => r.hero.id === 'bram')!.hp).toBe(Math.min(max('bram'), bramAfterFight + Math.round(0.15 * max('bram'))));

    // Two crossings hold, so the party isn't routed and Wren gets up.
    const room: RoomDef = {
      id: 'r',
      name: 'R',
      crossings: [
        { id: 'c0', name: 'Pit', terrain: 'open', pack: ['direWolf', 'direWolf', 'ghoul', 'ghoul'], arrival: 1, threats: [] },
        { id: 'c1', name: 'Hall', terrain: 'open', pack: ['giantRat'], arrival: 1, threats: [] },
        { id: 'c2', name: 'Gate', terrain: 'open', pack: ['giantRat'], arrival: 1, threats: [] },
      ],
    };
    const after = endTurn(staged(s, room, { c0: ['wren'], c1: ['bram', 'mira'], c2: ['fen', 'sly'] }));
    expect(after.report!.routed).toBe(false);
    const hp = (id: string) => after.roster.find((r) => r.hero.id === id)!;
    expect(hp('wren')).toMatchObject({ deathsDoor: true, hp: Math.round(0.25 * max('wren')) + Math.round(0.15 * max('wren')) });
    expect(hp('odo').hp).toBe(10 + Math.round(0.4 * max('odo')));
  });

  it('tires a hero from their 4th room in a row, until they sit out one or rest', () => {
    let s = newRun('seed');
    const rats = oneCrossing(['giantRat']);
    const bram = () => s.roster.find((r) => r.hero.id === 'bram')!;
    for (let room = 1; room <= 2; room++) s = nextRoom(endTurn(staged(s, rats, { c0: ['bram'] })));
    expect(bram()).toMatchObject({ roomsInARow: 2, tired: false });
    s = endTurn(staged(s, rats, { c0: ['bram'] }));
    expect(s.report!.tired).toEqual(['bram']);
    s = nextRoom(s);
    expect(bram()).toMatchObject({ roomsInARow: 3, tired: true });
    s = nextRoom(endTurn(staged(s, rats, { c0: ['odo'] })));
    expect(bram()).toMatchObject({ roomsInARow: 0, tired: false });

    for (let room = 1; room <= 3; room++) s = nextRoom(endTurn(staged(s, rats, { c0: ['bram'] })));
    expect(bram().tired).toBe(true);
    s = repair(staged(s, rats, { c0: ['odo'] }), 'bram');
    expect(bram()).toMatchObject({ roomsInARow: 0, tired: false });
  });

  it("brings a tended hero back from death's door as a Gravewalker (+1 Faith)", () => {
    let s = newRun('seed');
    s = { ...s, roster: s.roster.map((r) => (r.hero.id === 'odo' ? { ...r, deathsDoor: true, hp: 5 } : r)) };
    s = enterFirst(s, ['odo']);
    s = tend(s, 'odo');
    const odo = s.roster.find((r) => r.hero.id === 'odo')!;
    expect(odo).toMatchObject({ deathsDoor: false, titles: ['gravewalker'], extraTags: { faith: 1 } });
    // Odo is a quick healer: back with 70% of max HP.
    expect(odo.hp).toBeGreaterThan(5);
    expect(endTurn(s).report!.titles).toEqual([{ heroId: 'odo', title: 'gravewalker' }]);
    expect(() => tend(enterFirst({ ...newRun('seed'), roster: s.roster.map((r) => ({ ...r, deathsDoor: true })) }), 'bram')).toThrow('in the fight ahead');
  });

  it('finds Fine weapons on the first three rows and Masterwork from the fourth', () => {
    const s = enterFirst(newRun('seed'));
    const bodies = { kills: { beast: 3 }, regulars: 3, elites: 0, extraRolls: 40, vault: false };
    const found = (row: number) => search({ ...s, aftermath: { ...s.aftermath, nodeId: s.map.rows[row][0].id, bodies } }).aftermath.found!.weapons;
    expect(found(2).length).toBeGreaterThan(0);
    expect(found(2).every((w) => w.quality === 'fine')).toBe(true);
    expect(found(3).every((w) => w.quality === 'masterwork')).toBe(true);
  });

  it('sells one Fine weapon per visit at the peddler, for 35 gold', () => {
    let s = openPeddler(enterFirst(newRun('seed')));
    const offered = s.aftermath.peddler.weapon!;
    expect(offered.quality).toBe('fine');
    s = buy(s, 'weapon');
    expect(s.gold).toBe(40 - 35);
    expect(s.stash.weapons).toEqual([offered]);
    expect(() => buy({ ...s, gold: 100 }, 'weapon')).toThrow('not for sale');
  });

  it('keeps a weapon’s quality through the stash, equipping and burial', () => {
    let s = newRun('seed');
    s = { ...s, stash: { ...s.stash, weapons: [{ type: 'bow', quality: 'masterwork' }] } };
    s = equip(s, 'wren', 'weapon', { type: 'bow', quality: 'masterwork' });
    expect(s.roster.find((r) => r.hero.id === 'wren')!.hero).toMatchObject({ weapon: 'bow', weaponQuality: 'masterwork' });
    expect(s.stash.weapons).toEqual([{ type: 'bow' }]);
    expect(() => equip(s, 'fen', 'weapon', { type: 'bow', quality: 'fine' })).toThrow('No bow');
  });

  it('makes veterans: +5% max HP and damage per room fought, up to +25%; recruits start at +0%', () => {
    let s = newRun('seed');
    s = { ...s, roster: s.roster.map((r) => (r.hero.id === 'odo' ? { ...r, hero: { ...r.hero, veteran: 5 } } : r)) };
    s = endTurn(staged(s, oneCrossing(['giantRat']), { c0: ['bram', 'odo'] }));
    expect(s.roster.find((r) => r.hero.id === 'bram')!.hero.veteran).toBe(1);
    expect(s.roster.find((r) => r.hero.id === 'odo')!.hero.veteran).toBe(5);
    expect(s.report!.veterans).toEqual([{ heroId: 'bram', bonus: 0.05 }]);
    s = openPeddler(enterFirst(nextRoom({ ...s, gold: 100 })));
    s = recruit(s, s.aftermath.peddler.recruits[0].id);
    expect(s.roster.at(-1)!.hero.veteran ?? 0).toBe(0);
  });

  it('names a Beastslayer at 10 beasts (+1 Wild) and an Unbroken at 3 crossings held alone (+1 Bulwark)', () => {
    let s = newRun('seed');
    s = { ...s, roster: s.roster.map((r) => (r.hero.id === 'bram' ? { ...r, beasts: 9, heldAlone: 2 } : r)) };
    s = endTurn(staged(s, oneCrossing(['giantRat']), { c0: ['bram'] }));
    expect(s.report!.crossings.c0).toBe('held');
    const bram = s.roster.find((r) => r.hero.id === 'bram')!;
    expect(bram).toMatchObject({ beasts: 10, heldAlone: 3, extraTags: { wild: 1, bulwark: 1 } });
    expect(s.report!.titles.map((t) => t.title).sort()).toEqual(['beastslayer', 'unbroken']);
  });

  it('leaves the dead in the room, to be buried for their gear and a keepsake', () => {
    // Wren dies at Bram's side; Bram holds, so nothing loots the crossing.
    const base = mark(newRun('seed'), ['wren'], { deathsDoor: true, hp: 1 });
    const rats = oneCrossing(['giantRat', 'giantRat', 'giantRat']);
    let s = base;
    for (let i = 0; ; i++) {
      s = endTurn(staged(base, rats, { c0: ['bram', 'wren'] }, base.map.rows[0][0].id, `s${i}`));
      if (s.report!.fallen.length === 1 && s.report!.crossings.c0 !== 'broken') break;
    }
    expect(s.report!.fallen[0]).toMatchObject({ hero: { id: 'wren' }, looted: false });
    expect(s.report!.fallen[0].lastLine).toContain('Wren has fallen');
    expect(s.roster.map((r) => r.hero.id)).not.toContain('wren');
    s = enterFirst(nextRoom(s));
    s = bury(s, 'wren', 'fen');
    expect(s.stash).toMatchObject({ weapons: [{ type: 'bow' }], armours: ['leather'] });
    expect(s.roster.find((r) => r.hero.id === 'fen')!.extraTags).toEqual({ watch: 1 });
    expect(s.aftermath.fallen).toEqual([]);
  });

  it('loses a hero’s gear and keepsake when their crossing breaks and is looted', () => {
    let s = mark(newRun('seed'), ['wren'], { deathsDoor: true, hp: 1 });
    // The other two crossings hold, so the party isn't routed.
    const room: RoomDef = {
      id: 'r',
      name: 'R',
      crossings: [
        { id: 'c0', name: 'Pit', terrain: 'open', pack: ['direWolf', 'ghoul'], arrival: 1, threats: [] },
        { id: 'c1', name: 'Hall', terrain: 'open', pack: ['giantRat'], arrival: 1, threats: [] },
        { id: 'c2', name: 'Gate', terrain: 'open', pack: ['giantRat'], arrival: 1, threats: [] },
      ],
    };
    s = endTurn(staged(s, room, { c0: ['wren'], c1: ['bram'], c2: ['odo', 'fen'] }));
    expect(s.report).toMatchObject({ routed: false, crossings: { c0: 'broken' } });
    expect(s.report!.fallen[0]).toMatchObject({ hero: { id: 'wren' }, looted: true });
    s = enterFirst(nextRoom(s));
    expect(() => bury(s, 'wren', 'fen')).toThrow('looted');
  });

  it('wins when the boss falls; a party routed in his hall loses', () => {
    const hall = oneCrossing(['drownedKing'], 'boss');
    const s = newRun('seed');
    const all = s.roster.map((r) => r.hero.id);
    const won = endTurn(staged(s, hall, { c0: all }, 'boss'));
    expect(won).toMatchObject({ phase: 'won', outcome: { kind: 'win' } });
    expect(won.outcome!.survivors.length).toBeGreaterThan(0);
    expect(endTurn(staged(s, hall, { c0: ['wren'] }, 'boss'))).toMatchObject({ phase: 'lost', outcome: { kind: 'rout' } });
  });

  it('routs the party when most crossings of a room break, and records the survivors', () => {
    const rats = (empty: number): RoomDef => ({
      id: 'r',
      name: 'R',
      crossings: ['c0', 'c1', 'c2'].map((id) => ({ id, name: id, terrain: 'open' as const, pack: ['giantRat'], arrival: 1, threats: [] })),
    });
    const s = newRun('seed');
    // Two of three crossings left empty break at once: routed.
    const routed = endTurn(staged(s, rats(2), { c0: ['bram'] }));
    expect(routed.report).toMatchObject({ routed: true, crossings: { c1: 'broken', c2: 'broken' } });
    expect(routed).toMatchObject({ phase: 'lost', outcome: { kind: 'rout' } });
    expect(routed.outcome!.survivors.map((h) => h.id)).toEqual(s.roster.map((r) => r.hero.id));
    // One of three: the party carries on.
    const held = endTurn(staged(s, rats(1), { c0: ['bram'], c1: ['odo'] }));
    expect(held.report!.routed).toBe(false);
    expect(held).toMatchObject({ phase: 'report', outcome: null });
  });

  it('leaves heroes down on a broken crossing behind when the party is routed: they die', () => {
    const s = newRun('seed');
    const room: RoomDef = {
      id: 'r',
      name: 'R',
      crossings: [
        { id: 'c0', name: 'Hall', terrain: 'open', pack: ['giantRat'], arrival: 1, threats: [] },
        { id: 'c1', name: 'Pit', terrain: 'open', pack: ['direWolf', 'direWolf', 'ghoul', 'ghoul'], arrival: 1, threats: [] },
        { id: 'c2', name: 'Gate', terrain: 'open', pack: ['giantRat'], arrival: 1, threats: [] },
      ],
    };
    const fought = staged(s, room, { c0: ['bram'], c1: ['wren'] });
    // Wren is only knocked out in the fight itself.
    expect(fought.fight!.timeline!.result.heroes.wren).toMatchObject({ dead: false, hp: 0 });
    const end = endTurn(fought);
    expect(end).toMatchObject({ phase: 'lost', outcome: { kind: 'rout' } });
    expect(end.report!.fallen).toContainEqual(expect.objectContaining({ hero: expect.objectContaining({ id: 'wren' }), lastLine: 'Wren was left behind as the party fled.' }));
    expect(end.outcome!.survivors.map((h) => h.id)).not.toContain('wren');
  });

  it('is wiped out when no hero is left alive', () => {
    let s = newRun('seed');
    s = { ...s, roster: s.roster.filter((r) => r.hero.id === 'wren').map((r) => ({ ...r, deathsDoor: true })) };
    const end = endTurn(staged(s, oneCrossing(['direWolf', 'direWolf', 'ghoul', 'ghoul']), { c0: ['wren'] }));
    expect(end).toMatchObject({ phase: 'lost', outcome: { kind: 'wipe', survivors: [] } });
  });
});
