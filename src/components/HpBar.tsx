// From pocket-quartermaster src/components/HpBar.tsx, trimmed for the POC.
import { StyleSheet } from 'react-native';

import { colors, fonts } from '@/theme';

import { IconLabel } from './IconLabel';
import { PixelBar } from './PixelBar';

/** Below this share of max HP the bar turns red. */
const HURT_SHARE = 0.3;

type Props = {
  hp: number;
  max: number;
};

/** A hero's HP as a segmented bar with the count drawn inside it. */
export function HpBar({ hp, max }: Props) {
  const share = max > 0 ? hp / max : 0;
  return (
    <PixelBar
      value={share}
      color={share < HURT_SHARE ? colors.danger : colors.success}
      height={28}
      overlay={<IconLabel emoji="❤️" label={`${Math.max(0, Math.floor(hp))}/${max}`} size={14} labelStyle={styles.count} />}
    />
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.serifBold, fontSize: 14, color: colors.parchment },
});
