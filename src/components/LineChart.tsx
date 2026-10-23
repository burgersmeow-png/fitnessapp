import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import type { Point } from '../lib/progress';
import { colors, space } from '../lib/theme';

const PAD_Y = 10;
// Room so end markers aren't cut off at the edges.
const PAD_X = 6;
const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * A single-series line over time. With `trend`, the raw readings are faint dots and the trend is the
 * line. Touch and drag to read any point. One axis only; the min and max are labelled on the right.
 */
export function LineChart({
  points,
  trend,
  format,
  height = 160,
  label,
}: {
  points: Point[];
  trend?: Point[];
  format: (v: number) => string;
  height?: number;
  /** What VoiceOver reads for the whole chart, e.g. "Body weight, down 1.2 kg over 30 days". */
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const line = trend ?? points;
  const all = [...points, ...line];
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  let lo = Math.min(...all.map((p) => p.v));
  let hi = Math.max(...all.map((p) => p.v));
  if (hi - lo < 1e-6) [lo, hi] = [lo - 1, hi + 1];
  const plotW = Math.max(0, width - 56);
  const x = (t: number) => (t1 === t0 ? plotW / 2 : PAD_X + ((t - t0) / (t1 - t0)) * (plotW - 2 * PAD_X));
  const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (height - 2 * PAD_Y);

  const pick = (e: GestureResponderEvent) => {
    const px = e.nativeEvent.locationX;
    let best = 0;
    line.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(line[best].t) - px)) best = i;
    });
    setPicked(best);
  };
  const shown = picked != null ? line[picked] : line[line.length - 1];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Text style={styles.readout} maxFontSizeMultiplier={1.4}>
        <Text style={styles.readoutValue}>{format(shown.v)}</Text>
        {`  ${picked != null ? shortDate(shown.t) : 'latest'}${trend ? ' · trend' : ''}`}
      </Text>
      <View
        style={{ height, flexDirection: 'row' }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderTerminationRequest={() => false}
      >
        {width > 0 && (
          <Svg width={plotW} height={height}>
            {[lo, (lo + hi) / 2, hi].map((v) => (
              <Line key={v} x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={StyleSheet.hairlineWidth} />
            ))}
            {trend && points.map((p) => <Circle key={`d${p.t}`} cx={x(p.t)} cy={y(p.v)} r={3} fill={colors.textMuted} opacity={0.5} />)}
            {line.length > 1 && (
              <Polyline
                points={line.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {!trend && line.map((p) => <Circle key={`p${p.t}`} cx={x(p.t)} cy={y(p.v)} r={4} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />)}
            {picked != null && <Line x1={x(shown.t)} x2={x(shown.t)} y1={0} y2={height} stroke={colors.textMuted} strokeWidth={1} />}
            <Circle cx={x(shown.t)} cy={y(shown.v)} r={5} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />
          </Svg>
        )}
        <View style={styles.axis}>
          <Text style={styles.axisText}>{format(hi)}</Text>
          <Text style={styles.axisText}>{format(lo)}</Text>
        </View>
      </View>
      <View style={[styles.dates, { width: plotW }]}>
        <Text style={styles.axisText}>{shortDate(t0)}</Text>
        <Text style={styles.axisText}>{shortDate(t1)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { color: colors.textMuted, fontSize: 14, marginBottom: space.sm },
  readoutValue: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  axis: { width: 56, justifyContent: 'space-between', paddingVertical: PAD_Y - 7, paddingLeft: space.sm },
  axisText: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  dates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
});
