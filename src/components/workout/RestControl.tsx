import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClock } from '../../lib/format';
import { REST_STEP } from '../../lib/restTimes';
import { colors, space } from '../../lib/theme';
import { Icon } from '../Icon';

/** "Rest 2:00" on a lift; tap to nudge it. The change sticks for this lift in future workouts. */
export function RestControl({ seconds, custom, onAdjust }: { seconds: number; custom: boolean; onAdjust: (delta: number) => void }) {
  const [open, setOpen] = useState(false);
  const step = (delta: number) => {
    Haptics.selectionAsync();
    onAdjust(delta);
  };
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.pill} accessibilityRole="button" accessibilityLabel={`Rest ${formatClock(seconds)}. Change rest time`}>
        <Icon name="time" size={14} color={custom ? colors.accent : colors.textMuted} />
        <Text style={[styles.text, custom && { color: colors.accent }]}>{formatClock(seconds)}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => step(-REST_STEP)} hitSlop={6} style={styles.btn} accessibilityRole="button" accessibilityLabel="15 seconds less rest">
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <Text style={[styles.text, { color: colors.text, minWidth: 40, textAlign: 'center' }]}>{formatClock(seconds)}</Text>
      <Pressable onPress={() => step(REST_STEP)} hitSlop={6} style={styles.btn} accessibilityRole="button" accessibilityLabel="15 seconds more rest">
        <Text style={styles.btnText}>+</Text>
      </Pressable>
      <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done changing rest">
        <Icon name="check" size={18} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, paddingHorizontal: space.sm, borderRadius: 14, backgroundColor: colors.surfaceRaised },
  text: { color: colors.textMuted, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  btnText: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 22 },
});
