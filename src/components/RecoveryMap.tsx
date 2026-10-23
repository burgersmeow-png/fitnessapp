import { StyleSheet, Text, View } from 'react-native';
import { MUSCLE_LABELS } from '../lib/format';
import { colors, space } from '../lib/theme';
import { ALL_MUSCLES, type Muscle } from '../lib/types';

function tone(value: number): string {
  if (value >= 0.85) return colors.success;
  if (value >= 0.6) return colors.warning;
  return colors.danger;
}

/** Recovery per muscle as a row of bars: green is fresh, amber is partly recovered, red is fatigued. */
export function RecoveryMap({ recovery }: { recovery: Record<Muscle, number> }) {
  return (
    <View style={styles.grid}>
      {ALL_MUSCLES.map((m) => (
        <View key={m} style={styles.item}>
          <View style={styles.track}>
            <View style={[styles.fill, { height: `${Math.round(recovery[m] * 100)}%`, backgroundColor: tone(recovery[m]) }]} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {MUSCLE_LABELS[m].slice(0, 5)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { alignItems: 'center', flex: 1 },
  track: {
    width: 14,
    height: 64,
    borderRadius: 7,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 7 },
  label: { color: colors.textMuted, fontSize: 10.5, marginTop: space.xs },
});
