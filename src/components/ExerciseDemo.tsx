import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { drawFigure, VIEWBOX } from '../lib/figure';
import { MOTIONS } from '../lib/motions';
import { colors, radius, space } from '../lib/theme';
import type { Exercise } from '../lib/types';
import { FigureSvg } from './Figure';
import { Icon } from './Icon';

const REP_MS = 2800;

/**
 * A looping, drawn demo of one rep with the working muscles lit up.
 * Tap to pause. Starts paused when the system's Reduce Motion is on.
 */
export function ExerciseDemo({ exercise }: { exercise: Exercise }) {
  const motion = MOTIONS[exercise.id];
  const [clock, setClock] = useState(0.55);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => reduce && setPlaying(false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!motion || !playing) return;
    let frame = 0;
    const startedAt = Date.now() - clock * REP_MS;
    const tick = () => {
      setClock(((Date.now() - startedAt) % REP_MS) / REP_MS);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Resume from wherever it was paused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, playing]);

  const shapes = useMemo(() => (motion ? drawFigure(motion, clock, exercise.primary) : []), [motion, clock, exercise.primary]);
  if (!motion) return null;

  return (
    <Pressable
      onPress={() => setPlaying((p) => !p)}
      style={styles.frame}
      accessibilityRole="button"
      accessibilityLabel={`Animated demo of ${exercise.name}`}
      accessibilityHint={playing ? 'Tap to pause' : 'Tap to play'}
    >
      <FigureSvg shapes={shapes} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} width="100%" height="100%" />
      <View style={styles.badge}>
        <Icon name={playing ? 'pause' : 'play'} size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>{playing ? 'Playing' : 'Paused'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: VIEWBOX.width / VIEWBOX.height,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  badge: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
