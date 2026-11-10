// From pocket-quartermaster src/components/IconLabel.tsx, trimmed for the POC.
import type { ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { GameIcon } from './GameIcon';
import { Text } from './Text';

type Props = {
  /** The icon's emoji; its pixel art when `icon` is set (content with art only, like families, passes no emoji). */
  emoji?: string;
  /** The words next to it: a string or any inline content. */
  label: ReactNode;
  icon?: ImageSourcePropType;
  /** The icon's square size; the label keeps its own style. */
  size?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * An icon or emoji beside its words, each in its own element. The game font has
 * no emoji glyphs, so a Text mixing them measures wrong and clips the label in
 * anything sized to its content — never put both in one Text (the
 * noMixedEmojiText guard test fails on it).
 */
export function IconLabel({ emoji, label, icon, size = 18, gap = 4, style, labelStyle, testID }: Props) {
  return (
    <View style={[styles.row, { gap }, style]} testID={testID}>
      <GameIcon emoji={emoji} icon={icon} size={size} />
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
