import { G } from 'react-native-svg';

import type { HeroDef } from '@/content/heroes';
import { threatById } from '@/content/threats';
import type { CrossingDef } from '@/game/fight/types';
import { map } from '@/theme';

import { corridor, frontAt, ROOM, tokenSlot } from './layout';
import { MapCanvas, type Hit } from './MapCanvas';
import { BehindLink, Chamber, CorridorShape, FrontLine, HeroToken, Label, Parchment, ThreatSeal, WaxSeal, type TokenState } from './pieces';

export type CrossingView = {
  def: CrossingDef;
  heroes: { hero: HeroDef; state: TokenState }[];
  /** Enemies still to face there. */
  enemies: number;
  /** Per threat of the crossing, in order: answered by the families on it. */
  answered: boolean[];
  /** Italic notes beside the corridor: families, items, warnings. */
  notes: { text: string; warn?: boolean }[];
  /** The fight: the tug value and its word (holding, clashing, bending…). */
  tug?: number;
  status?: { text: string; warn: boolean };
};

type Props = {
  name: string;
  subtitle?: string;
  crossings: CrossingView[];
  /** The room behind, drawn at the bottom in the briefing. */
  behind?: string;
  /** Fight mode: crops to the crossings and draws the front lines. */
  fight?: boolean;
  selectedHero?: string | null;
  onHero?: (heroId: string) => void;
  onCrossing?: (crossingId: string) => void;
};

/** The room ahead: a chamber, a corridor per crossing (drawn by terrain), packs as wax seals, heroes as tokens. */
export function RoomMap({ name, subtitle, crossings, behind, fight = false, selectedHero, onHero, onCrossing }: Props) {
  const geometry = crossings.map((v, i) => corridor(i, crossings.length, v.def.terrain));
  const hits: Hit[] = [];
  const top = fight ? 10 : 0;
  const height = fight ? 380 : ROOM.height;

  const drawn = crossings.map((v, i) => {
    const c = geometry[i];
    const end = c.at(c.end);
    const front = v.tug === undefined ? undefined : frontAt(c, v.tug);
    const anchor = c.side === 1 ? 'end' : 'start';
    const labelX = c.side === 0 ? end.x : Math.min(Math.max(end.x, 16), ROOM.width - 16);
    const labelY = c.sideways ? end.y - c.width / 2 - 12 : end.y - 28;
    // Straight east–west corridors keep their threats and notes under the seal; the others beside it, between corridors.
    const under = c.sideways && Math.abs(c.at(1).y - c.at(0).y) < 0.1;
    const besideX = under ? end.x : c.side === 1 ? end.x - 28 : end.x + 28;
    const besideAnchor = c.side === 1 ? 'end' : 'start';
    const threatY = (k: number) => (under ? end.y + 34 + k * 18 : end.y - 4 + k * 18);
    const noteX = under ? (c.side === 1 ? ROOM.width - 16 : 16) : c.side === 0 ? besideX : end.x - c.side * 70;
    const noteY = (k: number) => (under ? end.y + 38 : end.y + 18) + v.def.threats.length * 18 + k * 15;
    const tokens = v.heroes.map((h, j) => ({ ...h, at: tokenSlot(c, j, v.heroes.length, front === undefined ? undefined : front - 18) }));

    if (onCrossing) hits.push({ key: `c-${v.def.id}`, x: end.x, y: end.y, size: 52, label: `Crossing ${v.def.name}`, onPress: () => onCrossing(v.def.id) });
    if (onHero) for (const t of tokens) hits.push({ key: `h-${t.hero.id}`, x: t.at.x, y: t.at.y, size: 36, label: `Hero ${t.hero.name}`, onPress: () => onHero(t.hero.id) });

    return (
      <G key={v.def.id}>
        <CorridorShape c={c} terrain={v.def.terrain} />
        {front !== undefined && <FrontLine c={c} d={front} />}
        <Label x={labelX} y={labelY} size={14} color={map.ink} italic={false} anchor={c.side === 0 ? 'middle' : anchor}>
          {v.def.name}
        </Label>
        {v.enemies > 0 && <WaxSeal x={end.x} y={end.y} count={v.enemies} />}
        {v.def.threats.map((t, k) => (
          <ThreatSeal
            key={t.id}
            x={besideX}
            y={threatY(k)}
            label={`${threatById[t.id].name} ${t.level}`}
            answered={v.answered[k]}
            anchor={besideAnchor}
          />
        ))}
        {v.status && (
          <Label x={labelX} y={labelY - 16} color={v.status.warn ? map.redInk : map.ink} anchor={c.side === 0 ? 'middle' : anchor}>
            {v.status.text}
          </Label>
        )}
        {v.notes.map((n, k) => (
          <Label key={n.text} x={noteX} y={noteY(k)} color={n.warn ? map.redInk : '#6b4a1a'} size={12} anchor={besideAnchor}>
            {n.text}
          </Label>
        ))}
        {tokens.map((t) => (
          <HeroToken key={t.hero.id} x={t.at.x} y={t.at.y} hero={t.hero} state={t.state} r={15} selected={selectedHero === t.hero.id} />
        ))}
      </G>
    );
  });

  return (
    <MapCanvas viewBox={{ y: top, width: ROOM.width, height }} hits={hits}>
      <Parchment y={top} width={ROOM.width} height={height} />
      {!fight && (
        <>
          <Label x={20} y={30} size={22} color={map.ink} italic={false}>
            {name}
          </Label>
          {subtitle ? <Label x={20} y={48}>{subtitle}</Label> : null}
        </>
      )}
      {behind && !fight && <BehindLink name={behind} />}
      <Chamber />
      {drawn}
    </MapCanvas>
  );
}
