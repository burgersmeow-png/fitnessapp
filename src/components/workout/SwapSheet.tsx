import * as Haptics from 'expo-haptics';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MUSCLE_LABELS } from '../../lib/format';
import type { SwapOption } from '../../lib/swap';
import { colors, radius, space, type } from '../../lib/theme';
import type { Exercise } from '../../lib/types';
import { ExerciseThumb } from '../ExerciseThumb';
import { Button } from '../ui';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Bottom sheet listing stand-ins for a lift, with the weight each would start at. */
export function SwapSheet({
  current,
  options,
  units,
  weightFor,
  partlyDone,
  onPick,
  onClose,
}: {
  current: Exercise | null;
  options: SwapOption[];
  units: 'kg' | 'lb';
  weightFor: (e: Exercise) => number | null;
  /** Some sets are already done; those stay with the original lift. */
  partlyDone: boolean;
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={current != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.grabber} />
        <Text style={type.title}>Swap {current?.name}</Text>
        <Text style={styles.sub}>
          {partlyDone ? 'The sets you have left move to the new lift. Done sets stay as they are.' : 'Your sets move to the new lift.'}
        </Text>
        <ScrollView style={{ maxHeight: 460 }}>
          {options.length === 0 && <Text style={styles.sub}>Nothing else works this muscle with your equipment.</Text>}
          {options.map(({ exercise: e, match }) => {
            const w = e.equipment === 'bodyweight' ? null : weightFor(e);
            return (
              <Pressable
                key={e.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  onPick(e);
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }]}
                accessibilityRole="button"
                accessibilityLabel={`Swap to ${e.name}`}
              >
                <ExerciseThumb exercise={e} size={44} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={styles.name}>{e.name}</Text>
                  <Text style={styles.meta}>
                    {cap(e.equipment)} · {match === 'same' ? 'Same muscles' : e.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}
                  </Text>
                </View>
                <Text style={styles.weight}>{e.equipment === 'bodyweight' ? 'Body' : w != null ? `${w} ${units}` : 'New'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button title="Keep this lift" variant="secondary" onPress={onClose} style={{ marginTop: space.md }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.md },
  sub: { color: colors.textMuted, fontSize: 15, marginTop: space.xs, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: space.xs, borderRadius: radius.sm },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  weight: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], marginLeft: space.sm },
});
