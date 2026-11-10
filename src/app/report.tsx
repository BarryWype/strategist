import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { unitState } from '@/components/map/describe';
import { nodeTitle } from '@/components/map/RunMapView';
import { MapButton } from '@/components/MapButton';
import { MapScreen } from '@/components/MapScreen';
import { Text } from '@/components/Text';
import { TokenBadge } from '@/components/TokenBadge';
import { armours, weaponName } from '@/content/gear';
import { heroClasses, type HeroDef } from '@/content/heroes';
import { runRules, titles } from '@/content/run';
import { familyById } from '@/content/families';
import type { CrossingResult } from '@/game/fight/types';
import { nodeById } from '@/game/run/map';
import { nextRoom } from '@/game/run/run';
import type { RunOutcome } from '@/game/run/types';
import { screenFor, useRunStore } from '@/store/runStore';
import { map } from '@/theme';

const STAMP: Record<CrossingResult, { text: string; color: string }> = {
  held: { text: 'HELD', color: map.brassLight },
  bent: { text: 'BENT', color: map.ember },
  broken: { text: 'BROKEN', color: map.wound },
};

const ENDING: Record<RunOutcome['kind'], string> = {
  win: 'The Drowned King falls. The run is won.',
  rout: 'The party is routed.',
  wipe: 'No one is left standing.',
  bossStands: 'The Drowned King still holds his hall.',
};

/** The room's outcome: a stamp per crossing, the fallen, what changed, and what waits behind. */
export default function ReportScreen() {
  const run = useRunStore((s) => s.run);
  if (!run) return <Redirect href="/" />;
  if (run.phase === 'brief' || run.phase === 'room') return <Redirect href={screenFor(run)} />;
  const report = run.report!;
  const fight = run.fight!;
  const room = fight.room!;
  const timeline = fight.forward?.timeline ?? fight.timeline!;
  const final = timeline.snapshots[timeline.snapshots.length - 1].state;
  const heroDef = (id: string): HeroDef =>
    run.roster.find((r) => r.hero.id === id)?.hero ??
    report.fallen.find((f) => f.hero.id === id)?.hero ??
    Object.values(fight.assignment)
      .flatMap((c) => c.heroes)
      .find((h) => h.hero.id === id)?.hero ??
    (fight.forward?.intervention.kind === 'addHero' ? fight.forward.intervention.hero.hero : run.roster[0].hero);
  const name = (id: string) => heroDef(id).name;
  const ended = run.phase === 'won' || run.phase === 'lost';
  const allBroken = Object.values(report.crossings).every((r) => r === 'broken');
  const bodies = run.aftermath.bodies;
  const gear = report.fallen
    .filter((f) => !f.looted)
    .flatMap((f) => [f.hero.weapon && weaponName({ type: f.hero.weapon, quality: f.hero.weaponQuality }).toLowerCase(), f.hero.armour && armours[f.hero.armour].name.toLowerCase()].filter(Boolean));
  const waiting = [
    bodies ? `${bodies.regulars + bodies.elites} bodies to search${bodies.vault ? ', and the vault, open' : ''}` : '',
    ...report.fallen.map((f, i) => (gear.length > 0 && i === 0 ? `${gear.join(' and ')} on the fallen` : '')),
  ].filter(Boolean);

  const toMap = () => {
    if (useRunStore.getState().act(nextRoom)) router.replace('/run');
  };
  const newRun = () => {
    useRunStore.getState().start();
    router.replace('/run');
  };

  return (
    <MapScreen title="Report" left={`Room ${run.route.length} of ${runRules.rows}`}>
      <ScrollView contentContainerStyle={styles.body}>
        {run.outcome && <Text style={styles.ending}>{ENDING[run.outcome.kind]}</Text>}
        {run.outcome && run.outcome.survivors.length > 0 && (
          <Text style={styles.muted}>{`Survivors: ${run.outcome.survivors.map((h) => h.name).join(', ')}.`}</Text>
        )}
        <Text style={styles.title}>{allBroken ? `${room.name} is lost` : `${room.name} is cleared`}</Text>
        {report.timedOut && <Text style={styles.muted}>The fight dragged on until the strength ran out on both sides.</Text>}

        {room.crossings.map((c) => (
          <View key={c.id} style={styles.crossing}>
            <Text style={styles.crossingName}>{c.name}</Text>
            <View style={styles.tokens}>
              {final.heroes
                .filter((h) => h.crossing === c.id)
                .map((h) => (
                  <TokenBadge key={h.id} hero={heroDef(h.id)} state={unitState(h)} size={28} />
                ))}
            </View>
            <Text style={[styles.stamp, { color: STAMP[report.crossings[c.id]].color, borderColor: STAMP[report.crossings[c.id]].color }]}>{STAMP[report.crossings[c.id]].text}</Text>
          </View>
        ))}

        {report.fallen.map((f) => (
          <View key={f.hero.id} style={styles.fallen}>
            <TokenBadge hero={f.hero} state="dead" size={48} />
            <View style={styles.flex}>
              <Text style={styles.fallenName}>{`${f.hero.name} has fallen`}</Text>
              <Text style={styles.muted}>{`${heroClasses[f.hero.classId].name}. ${f.lastLine} ${f.looted ? 'Their gear was looted.' : `Their gear lies in ${room.name}.`}`}</Text>
            </View>
          </View>
        ))}

        {(report.titles.length > 0 || report.wounded.length > 0 || report.tired.length > 0 || report.hungry.length > 0 || report.veterans.length > 0) && (
          <Text style={styles.heading}>What changed</Text>
        )}
        {report.titles.map((t) => (
          <Change key={`${t.heroId}${t.title}`} hero={heroDef(t.heroId)} text={`${name(t.heroId)} earns ${titles[t.title].name}`} aside={`+1 ${familyById[titles[t.title].family].name}`} />
        ))}
        {report.wounded.map((id) => (
          <Change key={`w${id}`} hero={heroDef(id)} state="deathsDoor" text={`${name(id)} is at death's door`} aside="Wounded" warn />
        ))}
        {report.tired.map((id) => (
          <Change key={`t${id}`} hero={heroDef(id)} state="tired" text={`${name(id)} is tired`} aside="Sit out a room" />
        ))}
        {report.hungry.map((id) => (
          <Change key={`h${id}`} hero={heroDef(id)} text={`${name(id)} went in hungry`} />
        ))}
        {report.veterans.map((v) => (
          <Change key={`v${v.heroId}`} hero={heroDef(v.heroId)} text={`${name(v.heroId)}: veteran +${Math.round(v.bonus * 100)}%`} />
        ))}

        <Text style={styles.heading}>{`Waiting in ${room.name} for you`}</Text>
        <Text style={styles.muted}>{waiting.length > 0 ? waiting.join(' · ') : 'Nothing left to pick over.'}</Text>
      </ScrollView>
      <View style={styles.footer}>
        {ended ? (
          <MapButton title="New run" onPress={newRun} />
        ) : (
          <MapButton title={`Back to the map${run.at ? ` from ${nodeTitle(run, nodeById(run.map, run.at))}` : ''}`} onPress={toMap} />
        )}
      </View>
    </MapScreen>
  );
}

function Change({ hero, text, aside, state = 'ready', warn }: { hero: HeroDef; text: string; aside?: string; state?: 'ready' | 'tired' | 'deathsDoor'; warn?: boolean }) {
  return (
    <View style={styles.change}>
      <TokenBadge hero={hero} state={state} size={28} />
      <Text style={[styles.changeText, warn && styles.warn]}>{text}</Text>
      {aside ? <Text style={styles.aside}>{aside}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 10 },
  ending: { fontSize: 24, color: map.brassLight, textAlign: 'center' },
  title: { fontSize: 24, color: map.onWood },
  heading: { fontSize: 16, color: map.onWoodMuted, marginTop: 8 },
  crossing: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: map.woodLight },
  crossingName: { width: 110, fontSize: 16, color: map.onWood },
  tokens: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  stamp: { fontSize: 16, borderWidth: 2, borderRadius: 4, paddingHorizontal: 6, transform: [{ rotate: '-6deg' }] },
  fallen: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: map.seam },
  fallenName: { fontSize: 18, color: map.wound },
  flex: { flex: 1 },
  muted: { fontSize: 14, color: map.onWoodMuted },
  change: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  changeText: { flex: 1, fontSize: 15, color: map.onWood },
  warn: { color: map.wound },
  aside: { fontSize: 13, color: map.brassLight },
  footer: { padding: 12, borderTopWidth: 2, borderTopColor: map.seam },
});
