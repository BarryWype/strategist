// From pocket-quartermaster src/game/generation/rng.ts, trimmed for the POC.
import seedrandom from 'seedrandom';

/** seedrandom's ARC4 state: enough to resume a stream exactly where it was. */
export type RngState = seedrandom.State.Arc4;

export type Rng = {
  next: () => number;
  /** Integer in [min, max], both inclusive. */
  int: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  weighted: <T>(items: readonly T[], weightOf: (item: T) => number) => T;
  /** A copy of the stream's position; pass it to `restoreRng` to continue from here. */
  state: () => RngState;
};

function wrap(random: seedrandom.StatefulPRNG<seedrandom.State.Arc4>): Rng {
  return {
    next: () => random(),
    int: (min, max) => min + Math.floor(random() * (max - min + 1)),
    chance: (probability) => random() < probability,
    weighted: (items, weightOf) => {
      const total = items.reduce((sum, item) => sum + weightOf(item), 0);
      if (items.length === 0 || total <= 0) {
        throw new Error('weighted() needs at least one item with a positive weight');
      }
      let roll = random() * total;
      for (const item of items) {
        roll -= weightOf(item);
        if (roll < 0) return item;
      }
      return items[items.length - 1];
    },
    state: () => random.state(),
  };
}

export function createRng(seed: string): Rng {
  return wrap(seedrandom(seed, { state: true }));
}

/** A stream that continues exactly where the one that produced `state` was. */
export function restoreRng(state: RngState): Rng {
  return wrap(seedrandom('', { state }));
}
