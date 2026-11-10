import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { newRun } from '@/game/run/run';
import type { RunState } from '@/game/run/types';

type RunStore = {
  run: RunState | null;
  start: (seed?: string) => void;
  /**
   * Applies a run step (src/game/run/run.ts): `act(tend, heroId)`. A step the rules refuse
   * leaves the run as it was and returns false.
   */
  act: <A extends unknown[]>(step: (run: RunState, ...args: A) => RunState, ...args: A) => boolean;
  abandon: () => void;
};

export const useRunStore = create<RunStore>()(
  persist(
    (set, get) => ({
      run: null,
      start: (seed = Date.now().toString(36)) => set({ run: newRun(seed) }),
      act: (step, ...args) => {
        const { run } = get();
        if (!run) return false;
        try {
          set({ run: step(run, ...args) });
          return true;
        } catch (error) {
          if (__DEV__) console.warn(error);
          return false;
        }
      },
      abandon: () => set({ run: null }),
    }),
    {
      name: 'strategist-run',
      // Save compatibility doesn't matter in the POC: bump the version and older runs reset.
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ run }) => ({ run }),
      migrate: () => ({ run: null }),
    },
  ),
);

/** The screen a run in this phase is played on. */
export function screenFor(run: RunState): '/run' | '/room' | '/report' {
  return run.phase === 'brief' ? '/run' : run.phase === 'room' ? '/room' : '/report';
}
