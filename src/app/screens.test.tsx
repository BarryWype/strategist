import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { generateMap, nextNodes } from '@/game/run/map';
import { generateRoom } from '@/game/run/rooms';
import { endTurn, newRun, sendIn, type Brief } from '@/game/run/run';
import type { RunState } from '@/game/run/types';
import { useRunStore } from '@/store/runStore';

import BriefScreen from './brief';
import StartScreen from './index';
import ReportScreen from './report';
import RoomScreen from './room';
import RunScreen from './run';

const mockRouter = { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

let tree: ReactTestRenderer | null = null;
function mount(Screen: () => React.ReactNode) {
  act(() => {
    tree = create(<Screen />);
  });
  return tree!;
}
const text = () => JSON.stringify(tree!.toJSON());
const buttons = () => tree!.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
const button = (label: string): ReactTestInstance => {
  const found = buttons().filter((n) => n.props.accessibilityLabel === label);
  if (found.length === 0) throw new Error(`No button "${label}" among: ${buttons().map((n) => n.props.accessibilityLabel).join(', ')}`);
  return found[0];
};
const press = (label: string) =>
  act(() => {
    button(label).props.onPress();
  });
const run = () => useRunStore.getState().run!;
const setRun = (r: RunState) =>
  act(() => {
    useRunStore.setState({ run: r });
  });

/** Every hero who can fight, spread over the crossings, but those left on the bench. */
function briefFor(s: RunState, nodeId: string, bench: string[] = []): Brief {
  const room = generateRoom(s.seed, nextNodes(s).find((n) => n.id === nodeId)!)!;
  const brief: Brief = { crossings: {}, draughts: [] };
  for (const c of room.crossings) brief.crossings[c.id] = { heroes: [], consumables: [] };
  s.roster.filter((r) => !bench.includes(r.hero.id)).forEach((r, i) => brief.crossings[room.crossings[i % room.crossings.length].id].heroes.push(r.hero.id));
  return brief;
}
const fighting = (bench: string[] = []) => {
  const s = newRun('seed');
  const node = nextNodes(s)[0].id;
  return sendIn(s, node, briefFor(s, node, bench));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  act(() => {
    useRunStore.setState({ run: null });
  });
});
afterEach(() => {
  if (tree) act(() => tree!.unmount());
  tree = null;
});

describe('screens', () => {
  it('starts a run from the start screen', () => {
    mount(StartScreen);
    press('New run');
    expect(run().phase).toBe('brief');
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/run');
  });

  it('picks the next room on the run map and opens its briefing', () => {
    setRun(newRun('seed'));
    mount(RunScreen);
    expect(text()).toContain('The Drowned King');
    const [first] = nextNodes(run());
    const title = generateRoom('seed', first)!.name;
    press(`Room ${title}`);
    press(`Brief: ${title}`);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/brief', params: { node: first.id } });
  });

  it('places a hero with a tap on the token, then on a crossing, and sends them in', () => {
    setRun(newRun('seed'));
    const node = nextNodes(run())[0];
    const room = generateRoom('seed', node)!;
    mockParams = { node: node.id };
    mount(BriefScreen);
    expect(button('Send them in').props.accessibilityState.disabled).toBe(true);
    press('Bench Bram');
    press(`Crossing ${room.crossings[0].name}`);
    expect(text()).toContain('Bram, alone');
    expect(() => button('Bench Bram')).toThrow();
    press('Send them in');
    expect(run().phase).toBe('room');
    expect(run().fight!.assignment[room.crossings[0].id].heroes.map((h) => h.hero.id)).toEqual(['bram']);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/room');
  });

  it('spends an action at the peddler, buys several things in one visit, and ends the turn', () => {
    setRun(fighting());
    mount(RoomScreen);
    expect(tree!.root.findByProps({ accessibilityLabel: '3 of 3 actions left' })).toBeTruthy();
    press('Peddler');
    expect(text()).toContain('The peddler');
    press('5 rations');
    press('Healing draught');
    expect(run().gold).toBe(40 - 6 - 12);
    press('Done');
    expect(tree!.root.findByProps({ accessibilityLabel: '2 of 3 actions left' })).toBeTruthy();
    expect(run().fight!.revealed).toBe(1);
    press('End the turn');
    expect(run().phase).toBe('report');
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/report');
  });

  it('goes forward with a benched hero, then reveals the rest with Continue', () => {
    setRun(fighting(['bram']));
    const crossing = run().fight!.room!.crossings[0].name;
    mount(RoomScreen);
    press('Go forward to help');
    expect(text()).toContain('The peddler moves on');
    expect(button('Go forward').props.accessibilityState.disabled).toBe(true);
    press(`Send Bram to ${crossing}`);
    press('Go forward');
    expect(run().aftermath.left).toBe(true);
    press('Continue');
    expect(text()).toContain('The strategist sends Bram');
    while (buttons().some((b) => b.props.accessibilityLabel === 'Continue')) press('Continue');
    press('See the report');
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/report');
  });

  it('reports each crossing with a stamp and goes back to the map', () => {
    setRun(endTurn(fighting()));
    mount(ReportScreen);
    const stamps = Object.values(run().report!.crossings).map((r) => r.toUpperCase());
    for (const stamp of stamps) expect(text()).toContain(stamp);
    const back = buttons().find((b) => String(b.props.accessibilityLabel).startsWith('Back to the map'))!;
    act(() => {
      back.props.onPress();
    });
    expect(run().phase).toBe('brief');
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/run');
  });

  it('tells a routed party why the run ended, and offers a new run', () => {
    const ended = endTurn(fighting());
    setRun({ ...ended, phase: 'lost', report: { ...ended.report!, routed: true }, outcome: { kind: 'rout', survivors: ended.roster.map((r) => r.hero) } });
    mount(ReportScreen);
    expect(text()).toContain('The party is routed.');
    expect(text()).toContain('Survivors: ');
    press('New run');
    expect(run().phase).toBe('brief');
  });

  it('makes camp, finishes the room behind, spends the camp’s actions, then breaks camp', () => {
    let seed = '';
    for (let i = 0; !seed; i++) if (generateMap(`s${i}`).rows.flat().some((n) => n.type === 'camp')) seed = `s${i}`;
    const s = newRun(seed);
    const camp = s.map.rows.flat().find((n) => n.type === 'camp')!;
    const before = s.map.rows[camp.row - 1].find((n) => n.next.includes(camp.id))!;
    setRun({ ...s, at: before.id });
    mockParams = { node: camp.id };
    mount(BriefScreen);
    press('Make camp');
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/room');
    act(() => tree!.unmount());
    mount(RoomScreen);
    press(buttons().find((b) => String(b.props.accessibilityLabel).startsWith('Leave'))!.props.accessibilityLabel);
    expect(tree!.root.findByProps({ accessibilityLabel: '5 of 5 actions left' })).toBeTruthy();
    press('Break camp');
    expect(run().phase).toBe('brief');
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/run');
  });

  it('keeps every touch target at least 44 px', () => {
    const screens: [() => React.ReactNode, () => void][] = [
      [StartScreen, () => setRun(newRun('seed'))],
      [RunScreen, () => setRun(newRun('seed'))],
      [
        BriefScreen,
        () => {
          setRun(newRun('seed'));
          mockParams = { node: nextNodes(run())[0].id };
        },
      ],
      [RoomScreen, () => setRun(fighting(['bram']))],
      [ReportScreen, () => setRun(endTurn(fighting()))],
    ];
    for (const [Screen, setUp] of screens) {
      setUp();
      mount(Screen);
      for (const b of buttons()) {
        const style = StyleSheet.flatten(typeof b.props.style === 'function' ? b.props.style({ pressed: false }) : b.props.style) ?? {};
        const height = style.height ?? style.minHeight;
        expect([b.props.accessibilityLabel, height]).toEqual([b.props.accessibilityLabel, expect.any(Number)]);
        expect(height).toBeGreaterThanOrEqual(44);
        if (style.width !== undefined) expect(style.width).toBeGreaterThanOrEqual(44);
      }
      act(() => tree!.unmount());
      tree = null;
    }
  });
});
