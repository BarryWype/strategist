import { enemyById } from '@/content/enemies';

import { answers, familyCounts } from '../families';
import { generateMap, nextNodes } from '../run/map';
import { generateRoom } from '../run/rooms';
import { bury, newRun, openPeddler, repair, search, sendIn, tend } from '../run/run';
import type { RoomDef } from '../fight/types';
import type { MapNode, RunState } from '../run/types';
import { botAction, botBrief, botEquip, botForward, playRun } from './bot';

const sent = (brief: ReturnType<typeof botBrief>) => Object.values(brief.crossings).flatMap((c) => c.heroes);
const mark = (s: RunState, ids: string[], change: object): RunState => ({ ...s, roster: s.roster.map((r) => (ids.includes(r.hero.id) ? { ...r, ...change } : r)) });
const packStrength = (pack: string[]) => pack.reduce((sum, id) => sum + enemyById[id].hp * enemyById[id].damage, 0);

/** A node (and the seed of its map) whose room has this many crossings. */
function nodeWith(crossings: number): { seed: string; node: MapNode } {
  for (let i = 0; ; i++) {
    const node = generateMap(`b${i}`).rows.flat().find((n) => generateRoom(`b${i}`, n)?.crossings.length === crossings);
    if (node) return { seed: `b${i}`, node };
  }
}

describe('the balance bot', () => {
  it('plays a run to its end, the same way for the same seed', () => {
    const record = playRun('bot');
    expect(record).toEqual(playRun('bot'));
    expect(record.fights).toBeGreaterThan(0);
  });

  it('answers every threat it can and leaves no crossing empty with enough heroes', () => {
    const s = newRun('seed');
    for (const node of nextNodes(s)) {
      const room = generateRoom(s.seed, node)!;
      const brief = botBrief(s, node.id);
      for (const c of room.crossings) {
        const heroes = brief.crossings[c.id].heroes.map((id) => s.roster.find((r) => r.hero.id === id)!);
        expect(heroes.length).toBeGreaterThan(0);
        for (const t of c.threats) expect(answers(familyCounts(heroes), t)).toBe(true);
      }
    }
  });

  it('benches tired heroes while every crossing still gets a hero', () => {
    const s = newRun('seed');
    const node = nextNodes(s)[0];
    expect(generateRoom(s.seed, node)!.crossings).toHaveLength(2);
    expect(sent(botBrief(mark(s, ['bram', 'mira'], { tired: true }), node.id)).sort()).toEqual(['fen', 'odo', 'sly', 'wren']);
    // Five tired: the one rested hero, and the strongest tired one for the other crossing.
    const fiveTired = sent(botBrief(mark(s, ['bram', 'mira', 'odo', 'fen', 'sly'], { tired: true }), node.id));
    expect(fiveTired).toHaveLength(2);
    expect(fiveTired).toContain('wren');
  });

  it('rotates ahead of time: benches heroes this room would tire, unless they answer a threat or a crossing needs them', () => {
    const find = (match: (room: RoomDef) => boolean) => {
      for (let i = 0; i < 200; i++) {
        const node = generateMap(`r${i}`).rows.flat().find((n) => n.type !== 'camp' && match(generateRoom(`r${i}`, n)!));
        if (node) return { s: newRun(`r${i}`), node };
      }
      throw new Error('No such room in 200 maps');
    };
    // No threats: Bram and Mira, two rooms in a row, sit this one out.
    const quiet = find((room) => room.crossings.every((c) => c.threats.length === 0));
    expect(sent(botBrief(mark(quiet.s, ['bram', 'mira'], { roomsInARow: 2 }), quiet.node.id)).sort()).toEqual(['fen', 'odo', 'sly', 'wren']);
    // Holy 2: Odo is the only hero with two Faith tags, so he goes anyway.
    const holy = find((room) => room.crossings.some((c) => c.threats.some((t) => t.id === 'holy' && t.level === 2)));
    expect(sent(botBrief(mark(holy.s, ['odo'], { roomsInARow: 2 }), holy.node.id))).toContain('odo');
    // Everyone about to tire: every crossing still gets a hero.
    const all = botBrief(mark(quiet.s, quiet.s.roster.map((r) => r.hero.id), { roomsInARow: 2 }), quiet.node.id);
    expect(Object.values(all.crossings).every((c) => c.heroes.length === 1)).toBe(true);
  });

  it('gives a better weapon to a hero it upgrades: same type first, then same main family', () => {
    const s = { ...newRun('seed'), stash: { consumables: {}, weapons: [{ type: 'bow' as const, quality: 'fine' as const }, { type: 'crossbow' as const, quality: 'masterwork' as const }], armours: [] } };
    const equipped = botEquip(s);
    expect(equipped.roster.find((r) => r.hero.id === 'wren')!.hero).toMatchObject({ weapon: 'bow', weaponQuality: 'fine' });
    // No one carries a crossbow, and its main family (Cunning) matches Sly's dagger.
    expect(equipped.roster.find((r) => r.hero.id === 'sly')!.hero).toMatchObject({ weapon: 'crossbow', weaponQuality: 'masterwork' });
  });

  it('leaves the weakest crossing empty rather than send a hero at death’s door there', () => {
    const { seed, node } = nodeWith(3);
    const room = generateRoom(seed, node)!;
    const weakest = [...room.crossings].sort((a, b) => packStrength(a.pack) - packStrength(b.pack))[0].id;
    const s = mark(newRun(seed), ['mira', 'odo', 'fen', 'wren', 'sly'], { deathsDoor: true });
    const brief = botBrief(s, node.id);
    expect(brief.crossings[weakest].heroes).toEqual([]);
    // The two other crossings are still held: Bram, and one hero at death's door.
    expect(room.crossings.filter((c) => c.id !== weakest).every((c) => brief.crossings[c.id].heroes.length === 1)).toBe(true);
    expect(sent(brief)).toContain('bram');
  });

  it('goes forward when a crossing’s tug falls below 0.45 and it holds a draught or a flask', () => {
    for (let i = 0; ; i++) {
      let s = newRun(`f${i}`);
      const node = nextNodes(s)[0];
      s = sendIn(s, node.id, botBrief(s, node.id));
      const fight = s.fight!;
      const snapshot = fight.slices[0]?.snapshot;
      const c0 = snapshot?.state.crossings[0];
      if (!snapshot || snapshot.state.done || !c0?.arrived || c0.broken) continue;
      const at = (tug: number, stash: RunState['stash']['consumables']): RunState => ({
        ...s,
        stash: { ...s.stash, consumables: stash },
        fight: { ...fight, revealed: 1, slices: [{ ...fight.slices[0], snapshot: { ...snapshot, tug: { ...snapshot.tug, [c0.id]: tug } } }, ...fight.slices.slice(1)] },
      });
      expect(botForward(at(0.44, { fireFlask: 1 })).fight!.forward?.intervention).toEqual({ kind: 'consumable', crossingId: c0.id, consumable: 'fireFlask' });
      expect(botForward(at(0.44, { healingDraught: 1 })).fight!.forward?.intervention.kind).toBe('heal');
      expect(botForward(at(0.46, { healingDraught: 1, fireFlask: 1 })).fight!.forward).toBeNull();
      expect(botForward(at(0.44, {})).fight!.forward).toBeNull();
      return;
    }
  });

  it('tends first, rests a tired hero while more than half are tired, then searches, shops and buries', () => {
    let s = newRun('seed');
    s = mark(s, ['odo'], { deathsDoor: true });
    const node = nextNodes(s)[0];
    s = sendIn(s, node.id, botBrief(s, node.id));
    expect(Object.values(s.fight!.assignment).flatMap((c) => c.heroes.map((h) => h.hero.id))).not.toContain('odo');
    s = mark(s, ['bram', 'mira', 'fen', 'sly'], { tired: true });
    s = {
      ...s,
      aftermath: {
        ...s.aftermath,
        actionsLeft: 10,
        bodies: { kills: { beast: 2 }, regulars: 2, elites: 0, extraRolls: 0, vault: false },
        fallen: [{ hero: { id: 'ghost', name: 'Ghost', classId: 'warrior', trait: 'tough', weapon: 'sword', armour: 'mail' }, lastLine: '', looted: false }],
      },
    };
    const order: string[] = [];
    let shopped = false;
    for (let action = botAction(s, shopped); action; action = botAction(s, shopped)) {
      order.push(action.kind);
      if (action.kind === 'tend') s = tend(s, action.heroId);
      else if (action.kind === 'rest') s = repair(s, action.heroId);
      else if (action.kind === 'search') s = search(s);
      else if (action.kind === 'bury') s = bury(s, action.fallenId, action.heirId);
      else {
        s = openPeddler(s);
        shopped = true;
      }
    }
    // Four of six tired: one rest brings it to three, no longer more than half.
    expect(order).toEqual(['tend', 'rest', 'search', 'peddler', 'bury']);
  });
});
