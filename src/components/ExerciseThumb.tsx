import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';
import type { Exercise } from '../lib/types';
import { BodyMap, regionFor, sideFor, type MuscleFills } from './BodyMap';

/** A square tile with a small body figure that lights up the exercise's muscles. */
export function ExerciseThumb({ exercise, size = 56 }: { exercise: Exercise; size?: number }) {
  const fills: MuscleFills = {};
  for (const m of exercise.secondary) fills[m] = { color: colors.accent, opacity: 0.4 };
  for (const m of exercise.primary) fills[m] = { color: colors.accent };
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.24 }]}>
      <BodyMap fills={fills} sides={sideFor(exercise.primary)} region={regionFor(exercise.primary)} height={size * 0.92} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
});
