import { Pressable, StyleSheet } from 'react-native';

import { map } from '@/theme';

import { Text } from './Text';

type Props = {
  title: string;
  onPress: () => void;
  /** brass: the main action; outline: a choice with consequences; quiet: secondary. */
  variant?: 'brass' | 'outline' | 'quiet';
  disabled?: boolean;
};

export function MapButton({ title, onPress, variant = 'brass', disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.label, variant === 'brass' ? styles.onBrass : styles.onWood]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  brass: { backgroundColor: map.brass, borderColor: map.brassLight },
  outline: { backgroundColor: map.woodLight, borderColor: map.ember },
  quiet: { backgroundColor: 'transparent', borderColor: map.seam },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 19 },
  onBrass: { color: map.wood },
  onWood: { color: map.onWood },
});
