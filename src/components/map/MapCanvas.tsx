import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

/** A tappable point of the drawing, in the drawing's coordinates. */
export type Hit = { key: string; x: number; y: number; label: string; onPress: () => void; size?: number };

type Props = {
  viewBox: { x?: number; y?: number; width: number; height: number };
  hits?: Hit[];
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Draws an SVG map scaled to fit its space, with invisible buttons laid over its tappable points.
 * Every button is at least 44 px, whatever the scale.
 */
export function MapCanvas({ viewBox, hits = [], style, children }: Props) {
  const { x = 0, y = 0, width, height } = viewBox;
  const window = useWindowDimensions();
  const [space, setSpace] = useState<{ width: number; height: number } | null>(null);
  const scale = Math.min((space?.width ?? window.width) / width, (space?.height ?? Infinity) / height);
  return (
    <View style={[styles.space, style]} onLayout={(e) => setSpace(e.nativeEvent.layout)}>
      <View style={{ width: width * scale, height: height * scale }}>
        <Svg width="100%" height="100%" viewBox={`${x} ${y} ${width} ${height}`}>
          {children}
        </Svg>
        {hits.map((hit) => {
          const size = Math.max(44, (hit.size ?? 44) * scale);
          return (
            <Pressable
              key={hit.key}
              accessibilityRole="button"
              accessibilityLabel={hit.label}
              onPress={hit.onPress}
              style={{ position: 'absolute', left: (hit.x - x) * scale - size / 2, top: (hit.y - y) * scale - size / 2, width: size, height: size }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  space: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
