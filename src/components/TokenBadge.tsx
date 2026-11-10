import { Pressable, StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';

import type { HeroDef } from '@/content/heroes';
import { map } from '@/theme';

import { HeroToken, type TokenState } from './map/pieces';
import { Text } from './Text';

type Props = {
  hero: HeroDef;
  state: TokenState;
  size?: number;
  selected?: boolean;
  /** Lines beside the token (name, state). */
  lines?: string[];
  warn?: boolean;
  onPress?: () => void;
  label?: string;
};

/** A hero's portrait token outside the map drawings: the bench, the party row, the report. */
export function TokenBadge({ hero, state, size = 40, selected, lines = [], warn, onPress, label }: Props) {
  const pad = 7;
  const content = (
    <View style={styles.row}>
      <Svg width={size + pad * 2} height={size + pad * 2} viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}>
        <HeroToken x={size / 2} y={size / 2} r={size / 2 - 1} hero={hero} state={state} selected={selected} />
      </Svg>
      {lines.length > 0 && (
        <View>
          {lines.map((line) => (
            <Text key={line} style={[styles.line, warn && styles.warn]}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? hero.name} onPress={onPress} style={styles.target}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  target: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  line: { fontSize: 14, lineHeight: 16, color: map.onWoodMuted },
  warn: { color: map.wound },
});
