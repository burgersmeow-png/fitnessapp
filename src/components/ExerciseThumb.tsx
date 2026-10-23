import { Image, StyleSheet, View } from 'react-native';
import { EXERCISE_MEDIA } from '../lib/exerciseMedia';
import { colors } from '../lib/theme';
import type { Exercise } from '../lib/types';
import { BodyMap, regionFor, sideFor, type MuscleFills } from './BodyMap';

/**
 * A square tile for an exercise: the demo photo with a small body figure that
 * lights up the target muscles, or just the figure when there's no photo.
 */
export function ExerciseThumb({ exercise, size = 56 }: { exercise: Exercise; size?: number }) {
  const fills: MuscleFills = {};
  for (const m of exercise.secondary) fills[m] = { color: colors.accent, opacity: 0.4 };
  for (const m of exercise.primary) fills[m] = { color: colors.accent };
  const photo = EXERCISE_MEDIA[exercise.id]?.frames[0];
  const figure = (h: number) => (
    <BodyMap fills={fills} sides={sideFor(exercise.primary)} region={regionFor(exercise.primary)} height={h} />
  );

  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.24 }]}>
      {photo != null ? (
        <>
          <Image source={photo} style={{ position: 'absolute', width: size, height: size }} resizeMode="cover" />
          <View style={[styles.badge, { width: size * 0.42, height: size * 0.42, borderRadius: size * 0.12 }]}>
            {figure(size * 0.38)}
          </View>
        </>
      ) : (
        figure(size * 0.92)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  badge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    backgroundColor: 'rgba(14,15,18,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
