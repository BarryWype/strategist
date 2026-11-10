import AsyncStorage from '@react-native-async-storage/async-storage';

import { nextNodes } from '@/game/run/map';
import { openPeddler, sendIn } from '@/game/run/run';

import { useRunStore } from './runStore';

describe('runStore', () => {
  beforeEach(() => useRunStore.getState().start('seed'));

  it('persists the run to storage', async () => {
    const raw = await AsyncStorage.getItem('strategist-run');
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ state: { run: { seed: 'seed', phase: 'brief' } }, version: 1 });
  });

  it('applies a step, and leaves the run as it was when the rules refuse it', () => {
    const before = useRunStore.getState().run!;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(useRunStore.getState().act(openPeddler)).toBe(false);
    expect(useRunStore.getState().run).toBe(before);

    const node = nextNodes(before)[0].id;
    expect(useRunStore.getState().act(sendIn, node, { crossings: { c0: { heroes: ['bram'], consumables: [] } }, draughts: [] })).toBe(true);
    expect(useRunStore.getState().run!.phase).toBe('room');
  });
});
