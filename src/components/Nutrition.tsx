import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatNumber } from '../lib/format';
import type { Macros } from '../lib/nutrition';
import { colors, space } from '../lib/theme';

export const MACRO_COLORS = { protein: '#4DA3FF', carbs: '#F5B53D', fat: '#C77DFF' };

/** Big ring for the day's calories: fills as you eat, turns amber past the target. */
export function CalorieRing({ eaten, target, size = 168 }: { eaten: number; target: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = target > 0 ? Math.min(1, eaten / target) : 0;
  const over = eaten > target;
  const left = Math.round(target - eaten);
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${formatNumber(Math.round(eaten))} of ${formatNumber(target)} calories eaten. ${
        over ? `${formatNumber(-left)} over` : `${formatNumber(left)} left`
      }`}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceRaised} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.warning : colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.big} maxFontSizeMultiplier={1.2}>
          {formatNumber(Math.abs(left))}
        </Text>
        <Text style={styles.small} maxFontSizeMultiplier={1.3}>
          {over ? 'KCAL OVER' : 'KCAL LEFT'}
        </Text>
      </View>
    </View>
  );
}

export function MacroBar({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  const fraction = target > 0 ? Math.min(1, eaten / target) : 0;
  return (
    <View style={{ marginBottom: space.sm }} accessible accessibilityLabel={`${label}: ${Math.round(eaten)} of ${target} grams`}>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>
          {Math.round(eaten)}
          <Text style={{ color: colors.textMuted }}> / {target} g</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** "P 32 · C 40 · F 12" with each macro in its color. */
export function MacroLine({ m }: { m: Macros }) {
  return (
    <Text style={styles.line}>
      <Text style={{ color: MACRO_COLORS.protein }}>P {Math.round(m.protein)}</Text>
      {'  '}
      <Text style={{ color: MACRO_COLORS.carbs }}>C {Math.round(m.carbs)}</Text>
      {'  '}
      <Text style={{ color: MACRO_COLORS.fat }}>F {Math.round(m.fat)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  big: { color: colors.text, fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  small: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  barValue: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  line: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
