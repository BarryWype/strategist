import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BehindMap, type BehindPoint } from '@/components/map/BehindMap';
import { unitState } from '@/components/map/describe';
import { MapCanvas } from '@/components/map/MapCanvas';
import { Label, Parchment, Tent } from '@/components/map/pieces';
import { RoomMap, type CrossingView } from '@/components/map/RoomMap';
import { nodeTitle } from '@/components/map/RunMapView';
import { MapButton } from '@/components/MapButton';
import { MapScreen } from '@/components/MapScreen';
import { Sheet, SheetOption } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { consumables, type ConsumableId } from '@/content/consumables';
import { familyById } from '@/content/families';
import { armours, weaponName, type ArmourType, type Weapon } from '@/content/gear';
import { heroClasses } from '@/content/heroes';
import { peddlerRules, runRules } from '@/content/run';
import { traits } from '@/content/traits';
import { crossingTagCounts } from '@/game/fight/engine';
import { answers } from '@/game/families';
import type { FightState, Snapshot } from '@/game/fight/types';
import { useTweened } from '@/hooks/useTweened';
import { nodeById } from '@/game/run/map';
import {
  bury,
  buy,
  continueFight,
  currentSnapshot,
  endTurn,
  goForward,
  heroesInFight,
  maxHpOf,
  openPeddler,
  recruit,
  repair,
  search,
  sell,
  tend,
  type Help,
} from '@/game/run/run';
import type { Find, RoomFight, RunState } from '@/game/run/types';
import { screenFor, useRunStore } from '@/store/runStore';
import { map } from '@/theme';

type SheetKind = 'peddler' | 'repair' | 'forward' | { bury: string } | null;

/** The fight ahead, revealed slice by slice, and the aftermath of the room behind. */
export default function RoomScreen() {
  const run = useRunStore((s) => s.run);
  const act = useRunStore((s) => s.act);
  const [sheet, setSheet] = useState<SheetKind>(null);
  if (!run || run.phase !== 'room' || !run.fight) return <Redirect href={run ? screenFor(run) : '/'} />;

  const fight = run.fight;
  const behind = run.aftermath;
  const behindName = behind.nodeId ? nodeTitle(run, nodeById(run.map, behind.nodeId)) || 'the camp' : 'the entrance';
  const nothingBehind = behind.kind === 'none' || behind.left;
  const forward = fight.forward;
  const reveal = forward ?? fight;
  const moreToSee = reveal.revealed < reveal.slices.length;

  const end = () => {
    act(endTurn);
    const after = useRunStore.getState().run!;
    if (after.phase !== 'room') router.replace(screenFor(after));
  };
  const step = (fn: (s: RunState) => RunState) => act(fn);

  return (
    <MapScreen title={fight.room ? `Ahead · ${fight.room.name}` : 'The camp'} right={fight.room ? (shown(fight).state.done ? 'over' : 'fighting') : 'resting'}>
      {fight.room ? <Ahead fight={fight} /> : <CampAhead />}
      <News fight={fight} />
      <View style={styles.behindHeader}>
        <Text style={styles.behindTitle}>{nothingBehind ? 'Behind · nothing' : `Behind · ${behindName}`}</Text>
        {!nothingBehind && <Diamonds total={behind.kind === 'camp' ? runRules.campActions : runRules.actions} left={behind.actionsLeft} />}
      </View>
      {behind.found && !nothingBehind && <Text style={styles.found}>{foundLine(behind.found)}</Text>}
      {nothingBehind ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {behind.left ? `You left ${behindName} for good. You are with them now.` : 'The camp is behind you, nothing left to do there.'}
          </Text>
        </View>
      ) : (
        <View style={styles.behind}>
          <BehindMap points={behindPoints(run, step, setSheet)} />
        </View>
      )}
      <View style={styles.footer}>
        {nothingBehind && fight.timeline ? (
          moreToSee ? (
            <MapButton title="Continue" onPress={() => step(continueFight)} />
          ) : (
            <MapButton title="See the report" onPress={end} />
          )
        ) : !fight.room ? (
          <MapButton
            title={behind.kind === 'camp' ? 'Break camp' : `Leave ${behindName}`}
            variant={behind.actionsLeft === 0 ? 'brass' : 'quiet'}
            onPress={end}
          />
        ) : (
          <>
            <MapButton title="Go forward to help" variant="outline" disabled={shown(fight).state.done} onPress={() => setSheet('forward')} />
            <Text style={styles.leave}>{`You leave ${behindName} for good.`}</Text>
            <MapButton title="End the turn" variant={behind.actionsLeft === 0 ? 'brass' : 'quiet'} onPress={end} />
          </>
        )}
      </View>
      {sheet === 'peddler' && <PeddlerSheet run={run} onClose={() => setSheet(null)} />}
      {sheet === 'repair' && (
        <Sheet title="Repair" subtitle="One hero's kit mended: no longer tired." onClose={() => setSheet(null)}>
          {run.roster
            .filter((r) => r.tired)
            .map((r) => (
              <SheetOption
                key={r.hero.id}
                title={`Repair ${r.hero.name}'s kit`}
                onPress={() => {
                  act(repair, r.hero.id);
                  setSheet(null);
                }}
              />
            ))}
        </Sheet>
      )}
      {sheet && typeof sheet === 'object' && (
        <Sheet title={`Bury ${sheet.bury}`} subtitle="Their gear comes back to the stash; a keepsake goes to one survivor." onClose={() => setSheet(null)}>
          {run.roster.map((r) => {
            const fallen = behind.fallen.find((f) => f.hero.id === sheet.bury)!;
            const family = familyById[heroClasses[fallen.hero.classId].familyTag].name;
            return (
              <SheetOption
                key={r.hero.id}
                title={`Keepsake to ${r.hero.name}`}
                detail={`+1 ${family} for the rest of the run`}
                onPress={() => {
                  act(bury, sheet.bury, r.hero.id);
                  setSheet(null);
                }}
              />
            );
          })}
        </Sheet>
      )}
      {sheet === 'forward' && <ForwardSheet run={run} behindName={behindName} onClose={() => setSheet(null)} />}
    </MapScreen>
  );
}

/** The snapshot the strategist has seen last: the start, or the end of the last revealed slice. */
function shown(fight: RoomFight): Snapshot {
  if (fight.forward) {
    const f = fight.forward;
    return f.revealed > 0 ? f.slices[f.revealed - 1].snapshot : f.timeline.snapshots[0];
  }
  return currentSnapshot(fight)!;
}

function statusOf(state: FightState, crossingId: string, tug: number): { text: string; warn: boolean } {
  const c = state.crossings.find((x) => x.id === crossingId)!;
  if (c.broken) return { text: 'broken', warn: true };
  if (c.cleared) return { text: 'cleared', warn: false };
  if (!c.arrived) return { text: 'waiting', warn: false };
  if (tug >= 0.6) return { text: 'holding', warn: false };
  if (tug >= 0.35) return { text: 'clashing', warn: false };
  return { text: 'bending', warn: true };
}

function Ahead({ fight }: { fight: RoomFight }) {
  const snapshot = shown(fight);
  const tug = useTweened(snapshot.tug);
  const { state } = snapshot;
  const views: CrossingView[] = fight.room!.crossings.map((c) => {
    const counts = crossingTagCounts(state, c.id);
    return {
      def: c,
      heroes: state.heroes
        .filter((h) => h.crossing === c.id)
        .map((h) => ({
          hero: fight.assignment[c.id]?.heroes.find((x) => x.hero.id === h.id)?.hero ?? heroOfUnit(fight, h.id),
          state: unitState(h),
        })),
      enemies: state.enemies.filter((e) => (e.crossing === c.id && e.status === 'active') || (e.home === c.id && e.status === 'waiting')).length,
      answered: c.threats.map((t) => answers(counts, t)),
      notes: [],
      tug: state.crossings.find((x) => x.id === c.id)!.cleared ? 1 : (tug[c.id] ?? snapshot.tug[c.id]),
      status: statusOf(state, c.id, snapshot.tug[c.id]),
    };
  });
  return (
    <View style={styles.ahead}>
      <RoomMap name={fight.room!.name} crossings={views} fight />
    </View>
  );
}

/** The hero a Go forward sent in, who isn't in the briefing's assignment. */
function heroOfUnit(fight: RoomFight, heroId: string) {
  const intervention = fight.forward?.intervention;
  if (intervention?.kind === 'addHero' && intervention.hero.hero.id === heroId) return intervention.hero.hero;
  throw new Error(`No hero ${heroId} in the fight`);
}

function CampAhead() {
  return (
    <View style={styles.ahead}>
      <MapCanvas viewBox={{ width: 390, height: 200 }}>
        <Parchment width={390} height={200} />
        <Tent x={195} y={90} size={36} />
        <Label x={195} y={165} anchor="middle" size={15} color={map.ink}>
          The party rests by the fire.
        </Label>
      </MapCanvas>
    </View>
  );
}

function News({ fight }: { fight: RoomFight }) {
  const reveal = fight.forward ?? fight;
  const slice = reveal.revealed > 0 ? reveal.slices[reveal.revealed - 1] : null;
  const lines = !fight.room
    ? [{ text: 'No fight here: the party is resting.', importance: 0 }]
    : slice
      ? slice.lines
      : [
          {
            text: fight.forward ? 'You run to catch up with them.' : 'They go in. Each action you spend shows the next stretch of the fight.',
            importance: 0,
          },
        ];
  return (
    <View style={styles.news}>
      {lines.map((l, i) => (
        <Text key={`${i}${l.text}`} style={[styles.newsLine, l.importance === 3 && styles.newsKey, l.importance === 0 && styles.newsCalm]}>
          {l.text}
        </Text>
      ))}
    </View>
  );
}

function Diamonds({ total, left }: { total: number; left: number }) {
  return (
    <View style={styles.diamonds} accessibilityLabel={`${left} of ${total} actions left`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.diamond, i < total - left ? styles.diamondSpent : styles.diamondLeft]} />
      ))}
    </View>
  );
}

function foundLine(find: Find): string {
  const parts = [
    find.gold > 0 ? `${find.gold} gold` : '',
    find.rations > 0 ? `${find.rations} ration${find.rations > 1 ? 's' : ''}` : '',
    ...find.consumables.map((id) => `a ${consumables[id].name.toLowerCase()}`),
    ...find.weapons.map((w) => `a ${weaponName(w).toLowerCase()}`),
  ].filter(Boolean);
  return parts.length > 0 ? `Found ${parts.join(', ')}.` : 'Found nothing of use.';
}

/** What the room behind offers: bodies, the peddler, the wounded, the dead, a hero's kit to repair. */
function behindPoints(run: RunState, step: (fn: (s: RunState) => RunState) => void, open: (sheet: SheetKind) => void) {
  const a = run.aftermath;
  const can = a.actionsLeft > 0;
  const points: (BehindPoint & {
    key: string;
    label: string;
    onPress?: () => void;
  })[] = [];
  if (a.bodies)
    points.push({
      key: 'bodies',
      kind: 'bodies',
      searched: false,
      label: 'Search',
      onPress: can ? () => step(search) : undefined,
    });
  else if (a.found)
    points.push({
      key: 'bodies',
      kind: 'bodies',
      searched: true,
      label: 'Searched',
    });
  points.push({
    key: 'peddler',
    kind: 'peddler',
    label: a.peddlerOpen ? 'Peddler (open)' : 'Peddler',
    onPress: a.peddlerOpen
      ? () => open('peddler')
      : can
        ? () => {
            step(openPeddler);
            open('peddler');
          }
        : undefined,
  });
  const inFight = heroesInFight(run.fight);
  for (const r of run.roster.filter((x) => x.deathsDoor && !inFight.includes(x.hero.id))) {
    points.push({
      key: `tend-${r.hero.id}`,
      kind: 'wounded',
      hero: r.hero,
      label: `Tend ${r.hero.name}`,
      onPress: can ? () => step((s) => tend(s, r.hero.id)) : undefined,
    });
  }
  for (const f of a.fallen)
    points.push({
      key: `bury-${f.hero.id}`,
      kind: 'grave',
      hero: f.hero,
      label: f.looted ? `${f.hero.name}, looted` : `Bury ${f.hero.name}`,
      onPress: can && !f.looted ? () => open({ bury: f.hero.id }) : undefined,
    });
  if (run.roster.some((r) => r.tired))
    points.push({
      key: 'repair',
      kind: 'anvil',
      label: 'Repair',
      onPress: can ? () => open('repair') : undefined,
    });
  return points;
}

function PeddlerSheet({ run, onClose }: { run: RunState; onClose: () => void }) {
  const act = useRunStore((s) => s.act);
  const stock = run.aftermath.peddler;
  const sellable: { item: ConsumableId | Weapon | ArmourType; name: string; price: number }[] = [
    ...(Object.keys(run.stash.consumables) as ConsumableId[])
      .filter((id) => (run.stash.consumables[id] ?? 0) > 0)
      .map((id) => ({ item: id, name: consumables[id].name, price: consumables[id].price })),
    ...run.stash.weapons.map((w) => ({ item: w, name: weaponName(w), price: peddlerRules.weaponPrice[w.quality ?? 'base'] })),
    ...run.stash.armours.map((id) => ({ item: id, name: armours[id].name, price: peddlerRules.armourPrice })),
  ];
  return (
    <Sheet
      title="The peddler"
      subtitle={`Gold ${run.gold} · Rations ${run.rations} · buy and sell as much as you like`}
      onClose={onClose}
      footer={<MapButton title="Done" onPress={onClose} />}
    >
      <Text style={styles.sheetHeading}>Buy</Text>
      {stock.consumables.map((id) => (
        <SheetOption
          key={id}
          title={consumables[id].name}
          detail={consumables[id].description}
          aside={`${consumables[id].price} gold`}
          disabled={run.gold < consumables[id].price}
          onPress={() => act(buy, id)}
        />
      ))}
      <SheetOption
        title={`${peddlerRules.rations.count} rations`}
        aside={`${peddlerRules.rations.price} gold`}
        disabled={run.gold < peddlerRules.rations.price}
        onPress={() => act(buy, 'rations')}
      />
      {stock.weapon && (
        <SheetOption
          title={weaponName(stock.weapon)}
          detail="One quality step above the starting gear: +2 damage."
          aside={`${peddlerRules.fineWeaponPrice} gold`}
          disabled={run.gold < peddlerRules.fineWeaponPrice}
          onPress={() => act(buy, 'weapon')}
        />
      )}
      {stock.recruits.map((h) => (
        <SheetOption
          key={h.id}
          title={`Recruit ${h.name}, ${heroClasses[h.classId].name}`}
          detail={`${traits[h.trait].name} · ${maxHpOf(h)} HP`}
          aside={`${peddlerRules.recruitPrice} gold`}
          disabled={run.gold < peddlerRules.recruitPrice || run.roster.length >= 8}
          onPress={() => act(recruit, h.id)}
        />
      ))}
      {sellable.length > 0 && <Text style={styles.sheetHeading}>Sell</Text>}
      {sellable.map((s, i) => (
        <SheetOption
          key={`${s.name}${i}`}
          title={`Sell the ${s.name.toLowerCase()}`}
          aside={`${Math.floor(s.price * peddlerRules.sellShare)} gold`}
          onPress={() => act(sell, s.item)}
        />
      ))}
    </Sheet>
  );
}

/** Go forward: one thing brought to the fight, and the list of what stays behind for good. */
function ForwardSheet({ run, behindName, onClose }: { run: RunState; behindName: string; onClose: () => void }) {
  const act = useRunStore((s) => s.act);
  const [choice, setChoice] = useState<Help | null>(null);
  const fight = run.fight!;
  const { state } = shown(fight);
  const open = fight.room!.crossings.filter((c) => !state.crossings.find((x) => x.id === c.id)!.broken);
  const inFight = heroesInFight(fight);
  const options: {
    help: Help;
    title: string;
    detail: string;
    aside?: string;
  }[] = [];
  const draughts = run.stash.consumables.healingDraught ?? 0;
  if (draughts > 0) {
    for (const h of state.heroes.filter((x) => x.status === 'standing')) {
      const crossing = fight.room!.crossings.find((c) => c.id === h.crossing)!;
      const heal = consumables.healingDraught.effect;
      const hp = heal.kind === 'heal' ? Math.round(heal.pct * h.maxHp) : 0;
      options.push({
        help: { kind: 'heal', heroId: h.id },
        title: `Healing draught → ${h.name}`,
        detail: `+${hp} HP, ${crossing.name}`,
        aside: `×${draughts}`,
      });
    }
  }
  for (const id of (Object.keys(run.stash.consumables) as ConsumableId[]).filter(
    (x) => consumables[x].target === 'crossing' && (run.stash.consumables[x] ?? 0) > 0,
  )) {
    for (const c of open)
      options.push({
        help: { kind: 'consumable', crossingId: c.id, consumable: id },
        title: `${consumables[id].name} → ${c.name}`,
        detail: consumables[id].description,
        aside: `×${run.stash.consumables[id]}`,
      });
  }
  for (const r of run.roster.filter((x) => !inFight.includes(x.hero.id) && x.hp > 0)) {
    for (const c of open) {
      const warn = r.deathsDoor ? "At death's door: one knockout kills." : r.tired ? 'Tired: deals less damage.' : `${r.hp} HP`;
      options.push({
        help: { kind: 'addHero', crossingId: c.id, heroId: r.hero.id },
        title: `Send ${r.hero.name} to ${c.name}`,
        detail: warn,
      });
    }
  }
  const a = run.aftermath;
  const lost = [
    a.actionsLeft > 0 ? `${a.actionsLeft} action${a.actionsLeft > 1 ? 's' : ''} unspent` : '',
    a.bodies ? 'The bodies stay unsearched' : '',
    ...run.roster.filter((r) => r.deathsDoor && !inFight.includes(r.hero.id)).map((r) => `${r.hero.name} stays at death's door`),
    ...a.fallen.filter((f) => !f.looted).map((f) => `${f.hero.name} stays unburied, their gear lost`),
    'The peddler moves on',
  ].filter(Boolean);
  const same = (h: Help) => JSON.stringify(h) === JSON.stringify(choice);

  return (
    <Sheet
      title="Go forward to help"
      subtitle="You catch up with them as things stand now. Bring one thing with you."
      onClose={onClose}
      footer={
        <View style={styles.sheetButtons}>
          <View style={styles.flex}>
            <MapButton title="Stay behind" variant="quiet" onPress={onClose} />
          </View>
          <View style={styles.flex}>
            <MapButton title="Go forward" variant="outline" disabled={!choice} onPress={() => choice && act(goForward, choice) && onClose()} />
          </View>
        </View>
      }
    >
      {options.length === 0 && <Text style={styles.sheetLine}>You have nothing to bring: no draught, no flask, no one on the bench.</Text>}
      {options.map((o) => (
        <SheetOption key={JSON.stringify(o.help)} title={o.title} detail={o.detail} aside={o.aside} selected={same(o.help)} onPress={() => setChoice(o.help)} />
      ))}
      <Text style={styles.sheetHeading}>{`Left behind in ${behindName}, for good`}</Text>
      {lost.map((line) => (
        <Text key={line} style={styles.sheetLine}>
          {line}
        </Text>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  ahead: { flex: 5 },
  news: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: map.woodLight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: map.seam,
    gap: 2,
  },
  newsLine: { fontSize: 15, color: map.onWood },
  newsKey: { color: map.wound },
  newsCalm: { color: map.onWoodMuted },
  behindHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  behindTitle: { fontSize: 17, color: map.onWood },
  found: { paddingHorizontal: 16, fontSize: 14, color: map.brassLight },
  diamonds: { flexDirection: 'row', gap: 8 },
  diamond: { width: 11, height: 11, transform: [{ rotate: '45deg' }] },
  diamondLeft: { backgroundColor: map.brassLight },
  diamondSpent: {
    backgroundColor: '#3a2c20',
    borderWidth: 1,
    borderColor: map.seam,
  },
  behind: { flex: 4 },
  empty: { flex: 4, justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: map.onWoodMuted, textAlign: 'center' },
  footer: { padding: 12, gap: 6 },
  leave: { fontSize: 13, color: map.onWoodMuted, textAlign: 'center' },
  sheetHeading: { fontSize: 16, color: map.onWoodMuted, marginTop: 6 },
  sheetLine: { fontSize: 15, color: map.onWood },
  sheetButtons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
