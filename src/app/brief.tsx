import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';

import { familyNotes, packSummary, rosterState } from '@/components/map/describe';
import { Label, Parchment, Tent } from '@/components/map/pieces';
import { RoomMap, type CrossingView } from '@/components/map/RoomMap';
import { nodeTitle } from '@/components/map/RunMapView';
import { MapButton } from '@/components/MapButton';
import { MapScreen } from '@/components/MapScreen';
import { SheetOption } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TokenBadge } from '@/components/TokenBadge';
import { consumables, type ConsumableId } from '@/content/consumables';
import { terrainInfo } from '@/content/fight';
import { armours, weaponName, type ArmourType } from '@/content/gear';
import { heroClasses, veteranRules } from '@/content/heroes';
import { runRules } from '@/content/run';
import { threatById } from '@/content/threats';
import { traits } from '@/content/traits';
import { answers, familyCounts, familyLevels, type FamilyCounts } from '@/game/families';
import { nextNodes, nodeById, sightRange } from '@/game/run/map';
import { generateRoom } from '@/game/run/rooms';
import { defaultHungry, equip, maxHpOf, rationNeeds, sendIn } from '@/game/run/run';
import type { RunState } from '@/game/run/types';
import { useRunStore } from '@/store/runStore';
import { map } from '@/theme';

type Selection = { kind: 'hero'; id: string } | { kind: 'item'; id: ConsumableId } | { kind: 'crossing'; id: string } | null;

/** The briefing: the next room in full; tap a hero, then a crossing, to place them. */
export default function BriefScreen() {
  const run = useRunStore((s) => s.run);
  const { node: nodeId } = useLocalSearchParams<{ node: string }>();
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Record<string, ConsumableId[]>>({});
  const [draughts, setDraughts] = useState<string[]>([]);
  const [hungryPick, setHungryPick] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Selection>(null);

  const node = run?.phase === 'brief' ? nextNodes(run).find((n) => n.id === nodeId) : undefined;
  if (!run || !node) return <Redirect href="/run" />;
  const room = generateRoom(run.seed, node);
  const go = (next: RunState) => {
    if (useRunStore.getState().act(() => next)) router.replace('/room');
  };

  if (!room) {
    return (
      <MapScreen title="A camp" right={`Sight ${sightRange(run)}`}>
        <Svg width="100%" height={240} viewBox="0 0 390 240">
          <Parchment width={390} height={240} />
          <Tent x={195} y={110} size={40} />
          <Label x={195} y={190} anchor="middle" size={16} color={map.ink}>
            The party rests: half their HP back, fatigue gone.
          </Label>
        </Svg>
        <View style={styles.footer}>
          <Text style={styles.note}>Then you finish the room behind, and have 5 actions at the camp before the next briefing.</Text>
          <MapButton title="Make camp" onPress={() => go(sendIn(run, node.id, { crossings: {}, draughts: [] }))} />
        </View>
      </MapScreen>
    );
  }

  const heroOf = (id: string) => run.roster.find((r) => r.hero.id === id)!;
  const on = (crossingId: string) => run.roster.filter((r) => placed[r.hero.id] === crossingId);
  const sent = Object.keys(placed);
  const { eaters, missing } = rationNeeds(run, sent);
  const pickValid = hungryPick && hungryPick.length === missing && hungryPick.every((id) => eaters.includes(id));
  const hungry = pickValid ? hungryPick : defaultHungry(run, sent);
  const used = (id: ConsumableId) => Object.values(items).flat().filter((x) => x === id).length + (id === 'healingDraught' ? draughts.length : 0);
  const left = (id: ConsumableId) => (run.stash.consumables[id] ?? 0) - used(id);

  const views: CrossingView[] = room.crossings.map((c) => {
    const heroes = on(c.id);
    const bonus: FamilyCounts = {};
    for (const id of items[c.id] ?? []) {
      const effect = consumables[id].effect;
      if (effect.kind === 'familyTag') bonus[effect.family] = (bonus[effect.family] ?? 0) + effect.add;
    }
    const counts = familyCounts(heroes, bonus);
    const levels = familyLevels(counts);
    return {
      def: c,
      heroes: heroes.map((r) => ({ hero: r.hero, state: rosterState(r) })),
      enemies: c.pack.length,
      answered: c.threats.map((t) => answers(counts, t)),
      notes: [
        ...familyNotes(levels),
        ...(items[c.id] ?? []).map((id) => ({ text: `+ ${consumables[id].name.toLowerCase()}` })),
        ...(heroes.length === 1 ? [{ text: `${heroes[0].hero.name}, alone`, warn: true }] : []),
        ...(heroes.length === 0 ? [{ text: 'no one holds it', warn: true }] : []),
      ],
    };
  });

  const toggleItemOn = (crossingId: string, id: ConsumableId) => {
    const here = items[crossingId] ?? [];
    if (here.includes(id)) setItems({ ...items, [crossingId]: here.filter((x, i) => i !== here.indexOf(id)) });
    else if (left(id) > 0) setItems({ ...items, [crossingId]: [...here, id] });
  };
  const onCrossing = (crossingId: string) => {
    if (selected?.kind === 'hero') {
      setPlaced({ ...placed, [selected.id]: crossingId });
      setSelected(null);
    } else if (selected?.kind === 'item' && consumables[selected.id].target === 'crossing') {
      toggleItemOn(crossingId, selected.id);
      setSelected(null);
    } else setSelected({ kind: 'crossing', id: crossingId });
  };
  const onHero = (heroId: string) => {
    if (selected?.kind === 'item' && selected.id === 'healingDraught' && placed[heroId]) {
      setDraughts(draughts.includes(heroId) ? draughts.filter((d) => d !== heroId) : left('healingDraught') > 0 ? [...draughts, heroId] : draughts);
      setSelected(null);
    } else setSelected(selected?.kind === 'hero' && selected.id === heroId ? null : { kind: 'hero', id: heroId });
  };
  const bench = (heroId: string) => {
    const { [heroId]: _, ...rest } = placed;
    setPlaced(rest);
    setDraughts(draughts.filter((d) => d !== heroId));
    setSelected(null);
  };
  const toggleHungry = (heroId: string) => {
    const others = [...eaters].filter((id) => !hungry.includes(id)).sort((a, b) => heroOf(b).hp - heroOf(a).hp);
    if (hungry.includes(heroId)) setHungryPick([...hungry.filter((id) => id !== heroId), others[0]]);
    else setHungryPick([...hungry.slice(0, -1), heroId]);
  };
  const send = () =>
    go(
      sendIn(run, node.id, {
        crossings: Object.fromEntries(room.crossings.map((c) => [c.id, { heroes: on(c.id).map((r) => r.hero.id), consumables: items[c.id] ?? [] }])),
        draughts,
        hungry,
      }),
    );

  const benched = run.roster.filter((r) => !placed[r.hero.id]);
  const stocked = (Object.keys(run.stash.consumables) as ConsumableId[]).filter((id) => (run.stash.consumables[id] ?? 0) > 0);

  return (
    <MapScreen title="Place your heroes" left={`Room ${run.route.length + 1}`} right={`Sight ${sightRange(run)}`}>
      <RoomMap
        name={room.name}
        subtitle={`${room.crossings.length} ways in`}
        crossings={views}
        behind={run.at ? nodeTitle(run, nodeById(run.map, run.at)) : 'the entrance'}
        selectedHero={selected?.kind === 'hero' ? selected.id : null}
        onHero={onHero}
        onCrossing={onCrossing}
      />
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        {selected?.kind === 'hero' && (
          <HeroPanel
            run={run}
            heroId={selected.id}
            placed={!!placed[selected.id]}
            draught={draughts.includes(selected.id)}
            hungry={hungry.includes(selected.id)}
            canGoHungry={missing > 0 && eaters.includes(selected.id)}
            onBench={() => bench(selected.id)}
            onHungry={() => toggleHungry(selected.id)}
          />
        )}
        {selected?.kind === 'crossing' && (
          <CrossingPanel view={views.find((v) => v.def.id === selected.id)!} items={items[selected.id] ?? []} onTakeBack={(id) => toggleItemOn(selected.id, id)} />
        )}
        <View style={styles.row}>
          <Text style={styles.heading}>Bench</Text>
          {benched.map((r) => (
            <TokenBadge
              key={r.hero.id}
              hero={r.hero}
              state={rosterState(r)}
              selected={selected?.kind === 'hero' && selected.id === r.hero.id}
              lines={[r.hero.name, r.deathsDoor ? "death's door" : r.tired ? 'tired' : `${r.hp} HP`]}
              warn={r.deathsDoor}
              label={`Bench ${r.hero.name}`}
              onPress={() => onHero(r.hero.id)}
            />
          ))}
        </View>
        {stocked.length > 0 && (
          <View style={styles.row}>
            <Text style={styles.heading}>Supplies</Text>
            {stocked.map((id) => (
              <MapButton
                key={id}
                title={`${consumables[id].name} ×${left(id)}`}
                variant={selected?.kind === 'item' && selected.id === id ? 'brass' : 'quiet'}
                onPress={() => setSelected(selected?.kind === 'item' && selected.id === id ? null : { kind: 'item', id })}
              />
            ))}
          </View>
        )}
        {selected?.kind === 'item' && (
          <Text style={styles.note}>{consumables[selected.id].target === 'crossing' ? 'Tap a crossing to leave it there.' : 'Tap a placed hero to hand it over.'}</Text>
        )}
        <Text style={[styles.note, missing > 0 && styles.warn]}>
          {missing > 0
            ? `Rations ${run.rations}, ${eaters.length} to feed: ${hungry.map((id) => heroOf(id).hero.name).join(', ')} go without.`
            : `Rations ${run.rations}, ${eaters.length} to feed.`}
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <MapButton title="Send them in" disabled={sent.length === 0} onPress={send} />
      </View>
    </MapScreen>
  );
}

function HeroPanel(props: {
  run: RunState;
  heroId: string;
  placed: boolean;
  draught: boolean;
  hungry: boolean;
  canGoHungry: boolean;
  onBench: () => void;
  onHungry: () => void;
}) {
  const { run, heroId } = props;
  const r = run.roster.find((x) => x.hero.id === heroId)!;
  const act = useRunStore((s) => s.act);
  const carried = r.hero.weapon ? weaponName({ type: r.hero.weapon, quality: r.hero.weaponQuality }) : 'no weapon';
  const armourName = r.hero.armour ? armours[r.hero.armour].name : 'no armour';
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{`${r.hero.name}, ${heroClasses[r.hero.classId].name}`}</Text>
      <Text style={styles.cardLine}>{`${r.hp}/${maxHpOf(r.hero)} HP · ${traits[r.hero.trait].name} · ${carried}, ${armourName}`}</Text>
      <Text style={styles.cardLine}>
        {`${r.roomsInARow} room${r.roomsInARow === 1 ? '' : 's'} in a row (tired from ${runRules.tiredAfter + 1})${r.hero.veteran ? ` · veteran +${Math.round(r.hero.veteran * veteranRules.step * 100)}%` : ''}`}
      </Text>
      {(r.deathsDoor || r.tired) && <Text style={[styles.cardLine, styles.warn]}>{r.deathsDoor ? "At death's door: one more knockout kills." : 'Tired: deals 20% less damage.'}</Text>}
      {props.draught && <Text style={styles.cardLine}>Carries a healing draught.</Text>}
      {props.placed && <SheetOption title="Back to the bench" onPress={props.onBench} />}
      {props.canGoHungry && <SheetOption title={props.hungry ? 'Feed instead' : 'Goes without a ration'} detail={props.hungry ? 'Goes in tired, unless hardy.' : undefined} onPress={props.onHungry} />}
      {run.stash.weapons.map((w, i) => (
        <SheetOption key={`w${i}`} title={`Take the ${weaponName(w).toLowerCase()}`} detail={`Leaves ${carried.toLowerCase()} in the stash.`} onPress={() => act(equip, heroId, 'weapon', w)} />
      ))}
      {run.stash.armours.map((a: ArmourType, i) => (
        <SheetOption key={`a${i}`} title={`Wear the ${armours[a].name.toLowerCase()}`} detail={`Leaves ${armourName.toLowerCase()} in the stash.`} onPress={() => act(equip, heroId, 'armour', a)} />
      ))}
    </View>
  );
}

function CrossingPanel({ view, items, onTakeBack }: { view: CrossingView; items: ConsumableId[]; onTakeBack: (id: ConsumableId) => void }) {
  const c = view.def;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{`${c.name} · ${terrainInfo[c.terrain].name}`}</Text>
      <Text style={styles.cardLine}>{terrainInfo[c.terrain].description}</Text>
      <Text style={styles.cardLine}>{`${packSummary(c.pack)}, ${c.arrival === 1 ? 'at once' : `from round ${c.arrival}`}.`}</Text>
      {c.threats.map((t, i) => (
        <Text key={t.id} style={[styles.cardLine, !view.answered[i] && styles.warn]}>
          {`${threatById[t.id].name} ${t.level}: ${view.answered[i] ? 'answered' : threatById[t.id].description}`}
        </Text>
      ))}
      {items.map((id, i) => (
        <SheetOption key={`${id}${i}`} title={`Take back the ${consumables[id].name.toLowerCase()}`} onPress={() => onTakeBack(id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { maxHeight: 240, borderTopWidth: 2, borderTopColor: map.seam },
  panelContent: { padding: 12, gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  heading: { fontSize: 16, color: map.onWoodMuted, marginRight: 4 },
  note: { fontSize: 15, color: map.onWoodMuted },
  warn: { color: map.wound },
  card: { gap: 6, padding: 10, borderRadius: 8, backgroundColor: map.woodLight, borderWidth: 1, borderColor: map.seam },
  cardTitle: { fontSize: 18, color: map.onWood },
  cardLine: { fontSize: 14, color: map.onWoodMuted },
  footer: { padding: 12, gap: 8, borderTopWidth: 2, borderTopColor: map.seam },
});
