import type { FightEvent, Snapshot, Timeline } from './types';

export type SliceLine = {
  crossing: string;
  text: string;
  heroes: string[];
  /** 0 for a calm line on a quiet crossing, else the event's importance. */
  importance: 0 | FightEvent['importance'];
};

export type Slice = {
  /** The slice shows rounds after this one, up to and including toRound. */
  fromRound: number;
  toRound: number;
  /** The fight as it stands at the end of the slice. */
  snapshot: Snapshot;
  lines: SliceLine[];
};

const MAX_LINES = 3;

/**
 * Cuts a timeline (from the start or from a resumed round) into `count` slices: one per
 * aftermath action, plus the one that ends the fight. Slices end on rounds with a key event,
 * the most uncertain first (a tug near 0.5, or falling fast); with too few key events, the
 * cuts are even. A fight shorter than `count` rounds gives one slice per round.
 */
export function sliceTimeline(timeline: Timeline, count: number): Slice[] {
  const { snapshots, events } = timeline;
  const start = snapshots[0].round;
  const end = snapshots[snapshots.length - 1].round;
  const snapshotAt = (round: number) => snapshots[round - start];
  const cuts = [...cutRounds(timeline, Math.min(count, Math.max(1, end - start))), end];

  return cuts.map((toRound, i) => {
    const fromRound = i === 0 ? start : cuts[i - 1];
    const inSlice = events.filter((e) => (i === 0 ? e.round >= fromRound : e.round > fromRound) && e.round <= toRound);
    return { fromRound, toRound, snapshot: snapshotAt(toRound), lines: linesOf(inSlice, snapshotAt(toRound)) };
  });
}

/** The rounds that end every slice but the last. */
function cutRounds({ snapshots, events }: Timeline, count: number): number[] {
  const start = snapshots[0].round;
  const end = snapshots[snapshots.length - 1].round;
  const keyRounds = [...new Set(events.filter((e) => e.importance === 3 && e.round > start && e.round < end).map((e) => e.round))];
  if (keyRounds.length < count - 1) {
    return Array.from({ length: count - 1 }, (_, i) => start + Math.round(((i + 1) * (end - start)) / count));
  }
  const uncertainty = (round: number) => {
    const now = snapshots[round - start].tug;
    const before = snapshots[round - start - 1].tug;
    return Math.max(...Object.keys(now).map((id) => Math.max(1 - 2 * Math.abs(now[id] - 0.5), 2 * (before[id] - now[id]))));
  };
  return keyRounds
    .sort((a, b) => uncertainty(b) - uncertainty(a) || a - b)
    .slice(0, count - 1)
    .sort((a, b) => a - b);
}

/** Key events first; spare lines go to crossings still in play that stayed quiet. */
function linesOf(events: FightEvent[], snapshot: Snapshot): SliceLine[] {
  const lines: SliceLine[] = [...events]
    .sort((a, b) => b.importance - a.importance || a.round - b.round)
    .slice(0, MAX_LINES)
    .map(({ crossing, text, heroes, importance }) => ({ crossing, text, heroes, importance }));
  const quiet = snapshot.state.crossings.filter((c) => !c.broken && !c.cleared && !events.some((e) => e.crossing === c.id));
  for (const c of quiet.slice(0, MAX_LINES - lines.length)) {
    lines.push({ crossing: c.id, text: `${c.name}: quiet so far`, heroes: [], importance: 0 });
  }
  return lines;
}
