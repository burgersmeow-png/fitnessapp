import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { drawFigure, squareBounds } from '../lib/figure';
import { MOTIONS } from '../lib/motions';
import { colors } from '../lib/theme';
import type { Exercise } from '../lib/types';
import { BodyMap, regionFor, sideFor, type MuscleFills } from './BodyMap';
import { FigureSvg } from './Figure';

/**
 * A square tile for an exercise: the drawn figure at the hardest point of the
 * rep with the working muscles lit, or the body map if there's no drawing.
 */
export function ExerciseThumb({ exercise, size = 56 }: { exercise: Exercise; size?: number }) {
  const motion = MOTIONS[exercise.id];
  const figure = useMemo(() => {
    if (!motion) return null;
    const shapes = drawFigure(motion, 0.55, exercise.primary);
    const box = squareBounds(shapes);
    return { shapes, viewBox: `${box.x} ${box.y} ${box.size} ${box.size}` };
  }, [motion, exercise.primary]);

  const fills: MuscleFills = {};
  for (const m of exercise.secondary) fills[m] = { color: colors.accent, opacity: 0.4 };
  for (const m of exercise.primary) fills[m] = { color: colors.accent };

  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.24 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {figure ? (
        <FigureSvg shapes={figure.shapes} viewBox={figure.viewBox} width={size} height={size} />
      ) : (
        <BodyMap fills={fills} sides={sideFor(exercise.primary)} region={regionFor(exercise.primary)} height={size * 0.92} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
});
