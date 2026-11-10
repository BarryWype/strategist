import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MapButton } from '@/components/MapButton';
import { MapScreen } from '@/components/MapScreen';
import { Text } from '@/components/Text';
import { screenFor, useRunStore } from '@/store/runStore';
import { map } from '@/theme';

export default function StartScreen() {
  const run = useRunStore((s) => s.run);
  const start = () => {
    useRunStore.getState().start();
    router.replace('/run');
  };
  return (
    <MapScreen title="Strategist">
      <View style={styles.body}>
        <Text style={styles.lead}>You can’t fight. They can.</Text>
        <Text style={styles.text}>Brief them for the room ahead, then clean up the room behind while they fight it.</Text>
        <View style={styles.buttons}>
          {run && run.phase !== 'won' && run.phase !== 'lost' && <MapButton title="Continue the run" onPress={() => router.replace(screenFor(run))} />}
          <MapButton title="New run" variant={run ? 'quiet' : 'brass'} onPress={start} />
        </View>
      </View>
    </MapScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  lead: { fontSize: 28, color: map.brassLight, textAlign: 'center' },
  text: { fontSize: 18, color: map.onWoodMuted, textAlign: 'center' },
  buttons: { gap: 12, marginTop: 16 },
});
