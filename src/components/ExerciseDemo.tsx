import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { EXERCISE_MEDIA } from '../lib/exerciseMedia';
import { Icon } from './Icon';
import { colors, radius, space } from '../lib/theme';

const HOLD_MS = 1100;
const FADE_MS = 350;

/**
 * Loops between the start and end position of an exercise so it reads like a
 * short demo clip. Tap to pause on a position.
 */
export function ExerciseDemo({ exerciseId }: { exerciseId: string }) {
  const media = EXERCISE_MEDIA[exerciseId];
  const fade = useRef(new Animated.Value(0)).current;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!media || !playing) return;
    const timer = setInterval(() => {
      setFrame((f) => {
        const next = f === 0 ? 1 : 0;
        Animated.timing(fade, { toValue: next, duration: FADE_MS, useNativeDriver: true }).start();
        return next;
      });
    }, HOLD_MS + FADE_MS);
    return () => clearInterval(timer);
  }, [media, playing, fade]);

  if (!media) return null;
  const [start, end] = media.frames;

  return (
    <Pressable onPress={() => setPlaying((p) => !p)} style={styles.frame} accessibilityLabel="Exercise demo, tap to pause">
      <Image source={start} style={styles.image} resizeMode="cover" />
      {end != null && (
        <Animated.Image source={end} style={[styles.image, StyleSheet.absoluteFill, { opacity: fade }]} resizeMode="cover" />
      )}
      <View style={styles.badge}>
        <Icon name={playing ? 'pause' : 'play'} size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>{frame === 0 ? 'Start' : 'Finish'}</Text>
      </View>
      <View style={styles.dots}>
        <View style={[styles.dot, frame === 0 && styles.dotOn]} />
        <View style={[styles.dot, frame === 1 && styles.dotOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dots: { position: 'absolute', bottom: space.sm, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: '#FFFFFF' },
});
