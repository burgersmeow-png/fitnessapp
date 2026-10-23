import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BAR, describePlates, PLATES, platesPerSide, warmupSets } from '../../lib/plates';
import { colors, plateColors, radius, space } from '../../lib/theme';
import type { Exercise } from '../../lib/types';
import { Icon } from '../Icon';

/**
 * Warm-up ramp and plate maths for one lift. Warm-ups are ticked off here but never logged,
 * so they don't count toward volume, PRs or progression.
 */
export function LiftTools({
  exercise,
  units,
  working,
  next,
  warmupFirst,
}: {
  exercise: Exercise;
  units: 'kg' | 'lb';
  /** First working set's weight. */
  working: number | null;
  /** The next set to do, for the plate maths. */
  next: number | null;
  /** Opens the warm-up for the session's first heavy lift. */
  warmupFirst: boolean;
}) {
  const warmups = warmupSets(working, units, exercise.equipment);
  const barbell = exercise.equipment === 'barbell';
  const [open, setOpen] = useState<'warmup' | 'plates' | null>(warmupFirst && warmups.length ? 'warmup' : null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  if (!warmups.length && !(barbell && next)) return null;
  const toggle = (panel: 'warmup' | 'plates') => setOpen((o) => (o === panel ? null : panel));

  return (
    <View style={{ marginBottom: space.sm }}>
      <View style={styles.chips}>
        {warmups.length > 0 && (
          <Chip label={`Warm-up · ${warmups.length}`} on={open === 'warmup'} onPress={() => toggle('warmup')} done={ticked.size === warmups.length} />
        )}
        {barbell && next != null && <Chip label={`Plates for ${next}`} on={open === 'plates'} onPress={() => toggle('plates')} />}
      </View>

      {open === 'warmup' && (
        <View style={styles.panel}>
          {warmups.map((w, i) => {
            const isOn = ticked.has(i);
            return (
              <Pressable
                key={i}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTicked((t) => {
                    const n = new Set(t);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  });
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isOn }}
                accessibilityLabel={`Warm-up ${i + 1}: ${w.weight} ${units} for ${w.reps} reps`}
                style={styles.warmRow}
              >
                <Text style={[styles.warmLabel, isOn && styles.dim]}>{w.label}</Text>
                <Text style={[styles.warmValue, isOn && styles.dim]}>
                  {w.weight} {units} × {w.reps}
                </Text>
                <View style={[styles.check, isOn && styles.checkOn]}>{isOn && <Icon name="check" size={14} color={colors.accentText} />}</View>
              </Pressable>
            );
          })}
          <Text style={styles.note}>Easy reps, short rests. These aren’t logged.</Text>
        </View>
      )}

      {open === 'plates' && next != null && <PlatePanel total={next} units={units} />}
    </View>
  );
}

function PlatePanel({ total, units }: { total: number; units: 'kg' | 'lb' }) {
  const { plates, left } = platesPerSide(total, units);
  const max = PLATES[units][0];
  return (
    <View style={styles.panel} accessible accessibilityLabel={`${total} ${units}: ${plates.length ? `${describePlates(plates)} on each side` : 'just the bar'} of a ${BAR[units]} ${units} bar`}>
      <View style={styles.barRow}>
        <View style={styles.sleeveEnd} />
        {plates.map((p, i) => (
          <View
            key={i}
            style={[
              styles.plate,
              {
                height: 28 + 52 * (p / max),
                width: p >= max * 0.4 ? 14 : 9,
                backgroundColor: plateColors[PLATES[units].indexOf(p as never)] ?? colors.textMuted,
              },
            ]}
          />
        ))}
        <View style={styles.sleeve} />
      </View>
      <Text style={styles.plateText}>{plates.length ? `Each side: ${describePlates(plates)}` : 'Just the bar'}</Text>
      <Text style={styles.note}>
        On a {BAR[units]} {units} bar{left > 0 ? `. ${left} ${units} can’t be made with standard plates; round to the nearest you can load.` : '.'}
      </Text>
    </View>
  );
}

function Chip({ label, on, done, onPress }: { label: string; on: boolean; done?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: on }}
      style={[styles.chip, on && styles.chipOn]}
      hitSlop={6}
    >
      {done && <Icon name="check" size={12} color={colors.success} />}
      <Text style={[styles.chipText, on && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: { borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  panel: { marginTop: space.sm, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  warmRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.md },
  warmLabel: { width: 76, color: colors.textMuted, fontSize: 14 },
  warmValue: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dim: { opacity: 0.45 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  note: { color: colors.textMuted, fontSize: 13, marginTop: space.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', height: 84, gap: 2 },
  sleeveEnd: { width: 10, height: 18, borderRadius: 3, backgroundColor: colors.textMuted },
  sleeve: { flex: 1, height: 8, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: colors.textMuted },
  plate: { borderRadius: 3 },
  plateText: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: space.sm, fontVariant: ['tabular-nums'] },
});
