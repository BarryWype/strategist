import { useId } from 'react';
import { ClipPath, Circle, Defs, FeColorMatrix, Filter, G, Image, Line, Path, Polyline, RadialGradient, Rect, Stop, Text } from 'react-native-svg';

import type { Terrain } from '@/content/fight';
import { heroClasses, type HeroDef } from '@/content/heroes';
import { fonts, map } from '@/theme';

import { ROOM, type Corridor } from './layout';

/** An id safe inside `url(#…)`. */
function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function Parchment({ x = 0, y = 0, width, height }: { x?: number; y?: number; width: number; height: number }) {
  const id = useSvgId('parchment');
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="70%">
          <Stop offset="60%" stopColor={map.parchment} />
          <Stop offset="100%" stopColor={map.parchmentEdge} />
        </RadialGradient>
      </Defs>
      <Rect x={x} y={y} width={width} height={height} fill={`url(#${id})`} />
    </>
  );
}

/** A map label: serif italic by default, as ink on parchment. */
export function Label({
  x,
  y,
  children,
  size = 13,
  color = map.inkSoft,
  anchor = 'start',
  italic = true,
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  italic?: boolean;
}) {
  return (
    <Text x={x} y={y} fontFamily={italic ? fonts.serifItalic : fonts.serif} fontSize={size} fill={color} textAnchor={anchor}>
      {children}
    </Text>
  );
}

export function Chamber({ cx = ROOM.cx, cy = ROOM.cy, hw = ROOM.hw, hh = ROOM.hh, faint = false }: { cx?: number; cy?: number; hw?: number; hh?: number; faint?: boolean }) {
  const d = `M${cx - hw} ${cy - hh + 2} L${cx + hw} ${cy - hh} L${cx + hw + 2} ${cy + hh} L${cx - hw - 2} ${cy + hh + 1} Z`;
  return faint ? (
    <Path d={d} fill="none" stroke={map.ink} strokeWidth={2} opacity={0.4} />
  ) : (
    <Path d={d} fill={map.chamber} stroke={map.ink} strokeWidth={3} strokeLinejoin="round" />
  );
}

/** A corridor drawn by its terrain: open is wide, narrow has stairs, dark is hatched, flooded is hatched with waves. */
export function CorridorShape({ c, terrain }: { c: Corridor; terrain: Terrain }) {
  const half = c.width / 2;
  const steps = (gap: number) => Array.from({ length: Math.floor((c.end - c.mouth) / gap) }, (_, i) => c.mouth + 6 + i * gap);
  const wall = (side: number) => {
    const a = c.at(c.mouth, side * half);
    const b = c.at(c.end, side * half);
    return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={map.ink} strokeWidth={3} strokeLinecap="round" />;
  };
  return (
    <G>
      {(terrain === 'dark' || terrain === 'flooded') &&
        steps(6).map((d) => {
          const a = c.at(d, -half);
          const b = c.at(d + 6, half);
          return <Line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={map.ink} strokeWidth={1.2} opacity={0.45} />;
        })}
      {terrain === 'narrow' &&
        steps(12).map((d) => {
          const a = c.at(d, -half);
          const b = c.at(d, half);
          return <Line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={map.ink} strokeWidth={1.2} opacity={0.6} />;
        })}
      {terrain === 'flooded' && (
        <Polyline
          points={steps(3)
            .map((d) => c.at(d, 3 * Math.sin(d / 3)))
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}
          fill="none"
          stroke={map.ink}
          strokeWidth={1.2}
          opacity={0.7}
        />
      )}
      {wall(-1)}
      {wall(1)}
    </G>
  );
}

/** The way back: a corridor south to the room behind, faint, with the strategist's dotted trail. */
export function BehindLink({ name }: { name: string }) {
  const top = ROOM.cy + ROOM.hh;
  return (
    <G>
      <Path d={`M${ROOM.cx - 10} ${top} L${ROOM.cx - 10} ${top + 60} M${ROOM.cx + 10} ${top} L${ROOM.cx + 10} ${top + 60}`} stroke={map.ink} strokeWidth={3} strokeLinecap="round" />
      <Chamber cy={top + 95} hw={55} hh={35} faint />
      <Path d={`M${ROOM.cx} ${top + 125} L${ROOM.cx} ${top + 6}`} stroke={map.redInk} strokeWidth={1.5} strokeDasharray="3 5" opacity={0.7} />
      <Label x={ROOM.cx} y={top + 99} anchor="middle">{`${name}, behind you`}</Label>
    </G>
  );
}

/** An enemy pack: a red wax seal with its count. */
export function WaxSeal({ x, y, count, r = 17 }: { x: number; y: number; count: number; r?: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={map.redInk} stroke={map.waxDark} strokeWidth={2} />
      <Text x={x} y={y + 5} textAnchor="middle" fontFamily={fonts.serifBold} fontSize={14} fill={map.onWax}>
        {String(count)}
      </Text>
    </G>
  );
}

/** A threat as a small diamond seal: brass when the crossing answers it, a red outline when not. */
export function ThreatSeal({ x, y, label, answered, anchor = 'start' }: { x: number; y: number; label: string; answered: boolean; anchor?: 'start' | 'end' }) {
  const color = answered ? map.ink : map.redInk;
  return (
    <G>
      <Path
        d={`M${x - 8} ${y} l8 -8 l8 8 l-8 8 z`}
        fill={answered ? map.brass : 'none'}
        stroke={answered ? map.seam : map.redInk}
        strokeWidth={answered ? 1 : 2}
      />
      <Text x={anchor === 'start' ? x + 13 : x - 13} y={y + 4} textAnchor={anchor} fontFamily={fonts.serifBold} fontSize={11} fill={color}>
        {label}
      </Text>
    </G>
  );
}

export type TokenState = 'ready' | 'tired' | 'deathsDoor' | 'dead';

/** A hero as a round portrait token. States are overlays: greyscale when tired or dead, a red ring at death's door, a black ribbon when dead. */
export function HeroToken({ x, y, hero, state, r = 16, selected = false }: { x: number; y: number; hero: HeroDef; state: TokenState; r?: number; selected?: boolean }) {
  const clip = useSvgId('clip');
  const grey = useSvgId('grey');
  const faded = state === 'tired' || state === 'dead';
  return (
    <G>
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={x} cy={y} r={r - 1} />
        </ClipPath>
        <Filter id={grey}>
          <FeColorMatrix type="saturate" values="0" />
        </Filter>
      </Defs>
      {selected && <Circle cx={x} cy={y} r={r + 6} fill="none" stroke={map.brassLight} strokeWidth={2} strokeDasharray="3 3" />}
      <Circle cx={x} cy={y} r={r} fill={map.woodLight} />
      <Image
        x={x - r}
        y={y - r}
        width={r * 2}
        height={r * 2}
        href={heroClasses[hero.classId].portrait}
        clipPath={`url(#${clip})`}
        filter={faded ? `url(#${grey})` : undefined}
        opacity={faded ? 0.6 : 1}
        preserveAspectRatio="xMidYMid slice"
      />
      <Circle cx={x} cy={y} r={r} fill="none" stroke={state === 'deathsDoor' ? map.wound : faded ? map.seam : map.brass} strokeWidth={state === 'deathsDoor' ? 4 : 3} />
      {state === 'dead' && <Path d={`M${x - r} ${y + r * 0.2} L${x + r * 0.2} ${y - r} L${x + r * 0.6} ${y - r * 0.6} L${x - r * 0.6} ${y + r * 0.6} Z`} fill="#111" opacity={0.85} />}
    </G>
  );
}

/** A red ink front line across a corridor, `d` from the chamber's centre. */
export function FrontLine({ c, d }: { c: Corridor; d: number }) {
  const half = c.width / 2 + 2;
  const points = Array.from({ length: Math.ceil((half * 2) / 6) + 1 }, (_, i) => c.at(d + (i % 2 ? 3 : -3), -half + i * 6));
  return <Polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={map.redInk} strokeWidth={2.5} />;
}

export function Tent({ x, y, size = 14, faint = false }: { x: number; y: number; size?: number; faint?: boolean }) {
  return (
    <Path
      d={`M${x - size} ${y + size} L${x} ${y - size} L${x + size} ${y + size} Z M${x} ${y - size} L${x} ${y + size}`}
      fill={faint ? map.chamber : '#d8c49a'}
      stroke={map.ink}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

export function Grave({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Path d={`M${x} ${y - 20} L${x} ${y + 12} M${x - 10} ${y - 10} L${x + 10} ${y - 10}`} stroke={map.ink} strokeWidth={3} strokeLinecap="round" />
      <Path d={`M${x - 16} ${y + 16} q16 -8 32 0`} stroke={map.ink} strokeWidth={2} fill="none" />
    </G>
  );
}

/** Crossed-out marks for bodies; faint once searched. */
export function Bodies({ x, y, searched }: { x: number; y: number; searched: boolean }) {
  return (
    <G stroke={map.ink} strokeWidth={2.5} opacity={searched ? 0.35 : 0.85}>
      <Path d={`M${x - 18} ${y - 14} l10 10 m0 -10 l-10 10`} />
      <Path d={`M${x + 2} ${y - 4} l10 10 m0 -10 l-10 10`} />
      <Path d={`M${x - 14} ${y + 8} l10 10 m0 -10 l-10 10`} />
    </G>
  );
}

/** An anvil, for repairing a tired hero's kit. */
export function Anvil({ x, y }: { x: number; y: number }) {
  return <Path d={`M${x - 16} ${y - 8} L${x + 16} ${y - 8} L${x + 10} ${y} L${x + 4} ${y} L${x + 8} ${y + 12} L${x - 8} ${y + 12} L${x - 4} ${y} L${x - 16} ${y} Z`} fill="#d8c49a" stroke={map.ink} strokeWidth={2} strokeLinejoin="round" />;
}

/** A dashed brass ring around a point the strategist can act on. */
export function ActionRing({ x, y }: { x: number; y: number }) {
  return <Circle cx={x} cy={y} r={30} fill="none" stroke={map.brass} strokeWidth={2} strokeDasharray="4 4" />;
}
