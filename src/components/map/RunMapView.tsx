import { Circle, Defs, G, Line, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';

import { boss, bossWeaknesses } from '@/content/enemies';
import { familyById } from '@/content/families';
import { elementInfo } from '@/content/elements';
import { threatById } from '@/content/threats';
import { nextNodes, nodeById, nodeVisibility, sightRange } from '@/game/run/map';
import { generateRoom } from '@/game/run/rooms';
import type { MapNode, RunState } from '@/game/run/types';
import { map } from '@/theme';

import { MapCanvas, type Hit } from './MapCanvas';
import { Label, Parchment, Tent, ThreatSeal } from './pieces';

const WIDTH = 390;
const HEIGHT = 698;
const ENTRANCE = { x: 195, y: 662 };
const BOSS_Y = 48;

const rowY = (row: number) => (row >= 8 ? BOSS_Y : 610 - row * 72);
const COLUMNS: Record<number, number[]> = { 1: [195], 2: [130, 260], 3: [90, 195, 300] };

function position(run: RunState, node: MapNode) {
  const row = run.map.rows[node.row];
  return { x: COLUMNS[row.length][row.indexOf(node)], y: rowY(node.row) };
}

/** What the run map writes beside a node the party can enter next. */
export function nodeTitle(run: RunState, node: MapNode): string {
  if (node.type === 'camp') return 'Camp';
  return generateRoom(run.seed, node)?.name ?? '';
}

type Props = { run: RunState; selected: string | null; onSelect?: (nodeId: string) => void };

/** The run on parchment: the trail walked, the rooms ahead within sight, fog beyond, the Drowned King at the top. */
export function RunMapView({ run, selected, onSelect }: Props) {
  const next = run.phase === 'brief' ? nextNodes(run) : [];
  const at = run.at ? nodeById(run.map, run.at) : null;
  const atRow = at?.row ?? -1;
  const lastSeen = atRow + sightRange(run);
  const fogTo = lastSeen >= 7 ? 0 : rowY(lastSeen + 1) + 40;
  const route = [ENTRANCE, ...run.route.map((id) => position(run, nodeById(run.map, id)))];
  const hits: Hit[] = next.map((n) => {
    const p = position(run, n);
    return { key: n.id, x: p.x, y: p.y, size: 52, label: `Room ${nodeTitle(run, n)}`, onPress: () => onSelect?.(n.id) };
  });

  const links = run.map.rows.flatMap((row) =>
    row.flatMap((node) =>
      node.next.map((id) => {
        const from = position(run, node);
        const to = position(run, nodeById(run.map, id));
        const walked = run.route.includes(node.id) && run.route.includes(id);
        if (walked) return null;
        const option = node.id === run.at && run.phase === 'brief';
        return (
          <Line
            key={`${node.id}-${id}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={map.ink}
            strokeWidth={option ? 2 : 1.5}
            strokeDasharray={option ? '6 5' : undefined}
            opacity={option ? 1 : node.row < atRow ? 0.25 : 0.6}
          />
        );
      }),
    ),
  );

  return (
    <MapCanvas viewBox={{ width: WIDTH, height: HEIGHT }} hits={hits}>
      <Parchment width={WIDTH} height={HEIGHT} />
      <Defs>
        <LinearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={map.fog} stopOpacity={0.75} />
          <Stop offset="100%" stopColor={map.fog} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {links}
      {run.map.rows[0].map((n) => {
        const p = position(run, n);
        const option = run.at === null && run.phase === 'brief';
        return <Line key={`entrance-${n.id}`} x1={ENTRANCE.x} y1={ENTRANCE.y} x2={p.x} y2={p.y} stroke={map.ink} strokeWidth={option ? 2 : 1.5} strokeDasharray={option ? '6 5' : undefined} opacity={option ? 1 : 0.25} />;
      })}
      <Polyline points={route.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={map.redInk} strokeWidth={2.5} strokeDasharray="4 5" />

      <Circle cx={ENTRANCE.x} cy={ENTRANCE.y} r={10} fill="#d5c39b" stroke={map.ink} strokeWidth={2.5} opacity={0.55} />
      <Label x={ENTRANCE.x + 20} y={ENTRANCE.y + 4} size={12}>
        entrance
      </Label>

      {run.map.rows.slice(0, -1).flat().map((node) => (
        <NodeMark key={node.id} run={run} node={node} option={next.includes(node)} selected={selected === node.id} />
      ))}

      {fogTo > 0 && (
        <G>
          <Rect x={0} y={0} width={WIDTH} height={fogTo} fill="url(#fog)" />
          <Path d={`M14 ${fogTo - 6} L376 ${fogTo - 6}`} stroke={map.ink} strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />
          <Label x={376} y={fogTo - 12} size={12} color={map.ink} anchor="end">
            edge of sight
          </Label>
        </G>
      )}

      <BossSeal option={next.some((n) => n.type === 'boss')} selected={selected === 'boss'} />
    </MapCanvas>
  );
}

function NodeMark({ run, node, option, selected }: { run: RunState; node: MapNode; option: boolean; selected: boolean }) {
  const { x, y } = position(run, node);
  const seen = nodeVisibility(run, node);
  const visited = run.route.includes(node.id);
  const here = run.at === node.id;
  const left = x < 195;
  const labelX = left ? x - 22 : x + 22;
  const anchor = left ? 'end' : 'start';

  if (seen === 'hidden') return <Rect x={x - 14} y={y - 14} width={28} height={28} fill="none" stroke={map.ink} strokeWidth={2} strokeDasharray="3 3" opacity={0.35} />;

  const room = option ? generateRoom(run.seed, node) : null;
  const doors = room?.crossings.length ?? 0;
  const ticks = [`M${x - 14} ${y} h-6`, `M${x + 14} ${y} h6`, `M${x} ${y - 14} v-6`, `M${x} ${y + 14} v6`].slice(0, doors).join(' ');
  const threats = room?.crossings.flatMap((c) => c.threats) ?? [];
  const note = node.type === 'camp' ? 'rest, 5 actions' : node.type === 'vault' ? 'sealed vault · Cunning 2' : node.type === 'elite' ? 'an elite leads' : null;

  return (
    <G opacity={visited && !here ? 0.55 : seen === 'type' && !option ? 0.75 : 1}>
      {(here || selected) && <Circle cx={x} cy={y} r={26} fill="none" stroke={map.brass} strokeWidth={3} strokeDasharray={selected ? '5 4' : undefined} />}
      {node.type === 'camp' ? (
        <Tent x={x} y={y} />
      ) : (
        <G>
          <Rect x={x - 14} y={y - 14} width={28} height={28} fill={map.chamber} stroke={node.type === 'elite' ? map.redInk : map.ink} strokeWidth={node.type === 'elite' ? 3.5 : 2.5} />
          {ticks ? <Path d={ticks} stroke={map.ink} strokeWidth={2.5} /> : null}
          {node.type === 'vault' && (
            <G>
              <Circle cx={x} cy={y - 3} r={4} fill={map.ink} />
              <Path d={`M${x} ${y - 1} L${x} ${y + 7}`} stroke={map.ink} strokeWidth={3} />
            </G>
          )}
          {node.type === 'elite' && <Circle cx={x + 12} cy={y - 12} r={6} fill={map.redInk} stroke={map.waxDark} strokeWidth={1.5} />}
        </G>
      )}
      {here && (
        <Label x={labelX} y={y + 4} color={map.ink}>
          you are here
        </Label>
      )}
      {option && (
        <G>
          <Label x={labelX} y={y - 4} size={14} color={map.ink} italic={false} anchor={anchor}>
            {nodeTitle(run, node)}
          </Label>
          {note && (
            <Label x={labelX} y={y + 12} size={12} anchor={anchor}>
              {note}
            </Label>
          )}
          {threats.slice(0, 3).map((t, i) => {
            const tx = left ? x - 30 - i * 60 : x + 30 + i * 60;
            return <ThreatSeal key={`${t.id}${i}`} x={tx} y={y + (note ? 30 : 16)} label={`${threatById[t.id].name} ${t.level}`} answered />;
          })}
        </G>
      )}
      {!option && !here && seen === 'type' && note && (
        <Label x={x} y={y + 30} size={12} anchor="middle">
          {note}
        </Label>
      )}
    </G>
  );
}

/** The boss, shown from the start: a red seal with a crown, his name and his weaknesses. */
function BossSeal({ option, selected }: { option: boolean; selected: boolean }) {
  const x = 195;
  const y = BOSS_Y;
  const weak = bossWeaknesses(boss)
    .map((w) => (w.kind === 'element' ? elementInfo[w.element].name : familyById[w.family].name))
    .join(', ');
  return (
    <G>
      {(option || selected) && <Circle cx={x} cy={y} r={34} fill="none" stroke={map.brass} strokeWidth={3} strokeDasharray={selected ? '5 4' : undefined} />}
      <Circle cx={x} cy={y} r={28} fill={map.redInk} stroke={map.waxDark} strokeWidth={3} />
      <Path d={`M${x - 15} ${y + 8} L${x - 15} ${y - 8} L${x - 7} ${y} L${x} ${y - 12} L${x + 7} ${y} L${x + 15} ${y - 8} L${x + 15} ${y + 8} Z`} fill={map.brassLight} stroke={map.waxDark} strokeWidth={1.5} strokeLinejoin="round" />
      <Label x={x + 40} y={y - 4} size={15} color={map.redInk} italic={false}>
        {boss.name.replace(/^the /, 'The ')}
      </Label>
      <Label x={x + 40} y={y + 14} size={11} color={map.redInk}>
        {`weak to ${weak}`}
      </Label>
    </G>
  );
}
