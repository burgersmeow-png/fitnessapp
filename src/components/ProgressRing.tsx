import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../lib/theme';

// Animated SVG props leak into the DOM on web (the preview), so the ring
// only animates on the phone.
const NativeCircle = Animated.createAnimatedComponent(Circle);
const AnimatedCircle = (Platform.OS === 'web' ? Circle : NativeCircle) as typeof NativeCircle;

/** A ring that fills as sets are completed, with "3/12" in the middle. */
export function ProgressRing({
  done,
  total,
  size = 44,
  stroke = 4,
  what = 'sets',
}: {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  /** Read out by VoiceOver: "3 of 12 sets done". */
  what?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(0)).current;
  const fraction = total > 0 ? Math.min(1, done / total) : 0;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: fraction,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fraction, progress]);

  const offset =
    Platform.OS === 'web'
      ? circumference * (1 - fraction)
      : progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  const complete = total > 0 && done >= total;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${done} of ${total} ${what} done`}
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceRaised} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={complete ? colors.success : colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.label, size >= 60 && { fontSize: 17 }]} maxFontSizeMultiplier={1.2}>
          {done}/{total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
