import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { rosterState } from '@/components/map/describe';
import { nodeTitle, RunMapView } from '@/components/map/RunMapView';
import { MapButton } from '@/components/MapButton';
import { MapScreen } from '@/components/MapScreen';
import { Text } from '@/components/Text';
import { TokenBadge } from '@/components/TokenBadge';
import { runRules } from '@/content/run';
import { nextNodes, nodeById } from '@/game/run/map';
import { screenFor, useRunStore } from '@/store/runStore';
import { map } from '@/theme';

/** The run map: the trail so far, the rooms within sight, and the choice of the next room. */
export default function RunScreen() {
  const run = useRunStore((s) => s.run);
  const options = run?.phase === 'brief' ? nextNodes(run) : [];
  const [picked, setPicked] = useState<string | null>(null);
  if (!run) return <Redirect href="/" />;

  const selected = options.length === 1 ? options[0].id : picked;
  const here = run.at ? nodeTitle(run, nodeById(run.map, run.at)) : 'The entrance';
  const target = selected ? options.find((n) => n.id === selected) : undefined;

  return (
    <MapScreen title={here} right={`Room ${Math.min(run.route.length + 1, runRules.rows)} of ${runRules.rows}`}>
      <RunMapView run={run} selected={selected} onSelect={setPicked} />
      <View style={styles.footer}>
        <View style={styles.party}>
          {run.roster.map((r) => (
            <TokenBadge key={r.hero.id} hero={r.hero} state={rosterState(r)} size={30} />
          ))}
          <View style={styles.supplies}>
            <Text style={styles.supply}>{`Rations ${run.rations}`}</Text>
            <Text style={styles.supply}>{`Gold ${run.gold}`}</Text>
          </View>
        </View>
        {run.phase !== 'brief' ? (
          <MapButton title="Back to the room" onPress={() => router.replace(screenFor(run))} />
        ) : target ? (
          <MapButton title={`Brief: ${nodeTitle(run, target)}`} onPress={() => router.push({ pathname: '/brief', params: { node: target.id } })} />
        ) : (
          <Text style={styles.hint}>Tap the next room on the map.</Text>
        )}
      </View>
    </MapScreen>
  );
}

const styles = StyleSheet.create({
  footer: { padding: 12, gap: 10, borderTopWidth: 2, borderTopColor: map.seam },
  party: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  supplies: { marginLeft: 'auto', alignItems: 'flex-end' },
  supply: { fontSize: 14, color: map.onWoodMuted },
  hint: { textAlign: 'center', fontSize: 16, color: map.onWoodMuted, minHeight: 48, textAlignVertical: 'center' },
});
