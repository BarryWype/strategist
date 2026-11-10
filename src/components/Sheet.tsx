import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { map } from '@/theme';

import { Text } from './Text';

/** A panel over the screen, for a choice that needs more room than the map. */
export function Sheet({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={styles.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.dismiss} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <ScrollView style={styles.body} contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
        {footer}
      </View>
    </View>
  );
}

/** One choice in a sheet: a title, a line under it, and an optional count or price on the right. */
export function SheetOption({ title, detail, aside, selected, disabled, onPress }: { title: string; detail?: string; aside?: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected && styles.selected, disabled && styles.disabled]}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      </View>
      {aside ? <Text style={styles.aside}>{aside}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  dismiss: { flex: 1, minHeight: 44 },
  sheet: { maxHeight: '85%', backgroundColor: map.wood, borderTopWidth: 2, borderColor: map.seam, padding: 16, gap: 8 },
  title: { fontSize: 24, color: map.brassLight },
  subtitle: { fontSize: 15, color: map.onWoodMuted },
  body: { flexGrow: 0 },
  content: { gap: 8, paddingVertical: 4 },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 2, borderColor: map.seam, backgroundColor: map.woodLight },
  selected: { borderColor: map.brassLight },
  disabled: { opacity: 0.4 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 17, color: map.onWood },
  optionDetail: { fontSize: 13, color: map.onWoodMuted },
  aside: { fontSize: 15, color: map.brassLight },
});
