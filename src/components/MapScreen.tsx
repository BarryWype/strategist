import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { map } from '@/theme';

import { Text } from './Text';

/** A screen framed in dark wood, with its own header bar. */
export function MapScreen({ title, left, right, children }: { title: string; left?: string; right?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.side}>{left ?? ''}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.side, styles.right]}>{right ?? ''}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: map.wood },
  header: { height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: map.seam },
  title: { flex: 2, textAlign: 'center', fontSize: 20, color: map.brassLight },
  side: { flex: 1, fontSize: 14, color: map.onWoodMuted },
  right: { textAlign: 'right' },
});
