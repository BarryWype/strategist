import { G, Path } from 'react-native-svg';

import type { HeroDef } from '@/content/heroes';
import { map } from '@/theme';

import { MapCanvas, type Hit } from './MapCanvas';
import { ActionRing, Anvil, Bodies, Grave, HeroToken, Label, Parchment, Tent } from './pieces';

export type BehindPoint =
  | { kind: 'bodies'; searched: boolean }
  | { kind: 'peddler' }
  | { kind: 'wounded'; hero: HeroDef }
  | { kind: 'grave'; hero: HeroDef }
  | { kind: 'anvil' };

type Point = BehindPoint & { key: string; label: string; onPress?: () => void };

const WIDTH = 390;
const COLUMNS = 4;
const ROW = 95;

/** The room behind after its fight: points the strategist can act on, laid out across the chamber. */
export function BehindMap({ points }: { points: Point[] }) {
  const rows = Math.max(1, Math.ceil(points.length / COLUMNS));
  const height = 30 + rows * ROW;
  const at = (i: number) => ({ x: 60 + (i % COLUMNS) * 90, y: 62 + Math.floor(i / COLUMNS) * ROW });
  const hits: Hit[] = points.flatMap((p, i) => (p.onPress ? [{ key: p.key, ...at(i), size: 60, label: p.label, onPress: p.onPress }] : []));

  return (
    <MapCanvas viewBox={{ width: WIDTH, height }} hits={hits}>
      <Parchment width={WIDTH} height={height} />
      <Path d={`M28 14 L362 10 L366 ${height - 10} L24 ${height - 8} Z`} fill={map.chamber} />
      <Path d={`M176 12 L28 14 L24 ${height - 8} L366 ${height - 10} L362 10 L214 12`} fill="none" stroke={map.ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M176 12 L176 0 M214 12 L214 0" stroke={map.ink} strokeWidth={3} />
      {points.map((p, i) => {
        const { x, y } = at(i);
        return (
          <G key={p.key} opacity={p.onPress ? 1 : 0.6}>
            {p.onPress && <ActionRing x={x} y={y} />}
            {p.kind === 'bodies' && <Bodies x={x} y={y} searched={p.searched} />}
            {p.kind === 'peddler' && <Tent x={x} y={y} size={16} />}
            {p.kind === 'wounded' && <HeroToken x={x} y={y} hero={p.hero} state="deathsDoor" r={17} />}
            {p.kind === 'grave' && <Grave x={x} y={y} />}
            {p.kind === 'anvil' && <Anvil x={x} y={y} />}
            <Label x={x} y={y + 46} anchor="middle" size={13} color={p.kind === 'wounded' ? map.redInk : map.ink} italic={false}>
              {p.label}
            </Label>
          </G>
        );
      })}
    </MapCanvas>
  );
}
