import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteMeasurement, logMeasurement } from '../lib/db';
import { BODY_PARTS, latestByPart, lengthUnit, saneLength, toCm, type BodyPart, type Measurement } from '../lib/measurements';
import { colors, radius, space } from '../lib/theme';
import { LineChart } from './LineChart';
import { Button, Card, Chip } from './ui';

/** Tape measurements on the Progress screen: pick a part, log it, see its chart. */
export function Measurements({ entries, units, onChange }: { entries: Measurement[]; units: 'kg' | 'lb'; onChange: () => void }) {
  const db = useSQLiteContext();
  const latest = latestByPart(entries);
  const [part, setPart] = useState<BodyPart>(() => BODY_PARTS.find((p) => latest.has(p.value))?.value ?? 'waist');
  const [entry, setEntry] = useState('');
  const [warn, setWarn] = useState<string | null>(null);
  const unit = lengthUnit(units);
  const info = BODY_PARTS.find((p) => p.value === part)!;
  const list = entries.filter((e) => e.part === part);
  const now = latest.get(part);
  const fmt = (v: number) => `${Math.round(v * 10) / 10} ${unit}`;

  const log = async () => {
    const n = Number(entry.replace(',', '.'));
    if (!saneLength(toCm(n, units))) return setWarn(`Enter your ${info.label.toLowerCase()} in ${unit}.`);
    setWarn(null);
    setEntry('');
    await logMeasurement(db, part, n);
    onChange();
  };

  return (
    <Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {BODY_PARTS.map((p) => {
          const l = latest.get(p.value);
          return (
            <Chip
              key={p.value}
              label={l ? `${p.label} ${l.value}` : p.label}
              selected={part === p.value}
              onPress={() => {
                setPart(p.value);
                setWarn(null);
              }}
            />
          );
        })}
      </ScrollView>

      {now?.change ? (
        <Text style={styles.headline}>
          {info.label} {now.change > 0 ? 'up' : 'down'} {fmt(Math.abs(now.change))} in the last 3 months
        </Text>
      ) : (
        <View style={{ height: space.md }} />
      )}
      {list.length >= 2 ? (
        <LineChart
          points={list.map((e) => ({ t: Date.parse(e.measuredAt), v: e.value }))}
          format={fmt}
          height={110}
          label={`${info.label} chart, latest ${fmt(list[list.length - 1].value)}.`}
        />
      ) : (
        <Text style={styles.muted}>{list.length === 1 ? 'One more reading and the chart starts.' : `How to measure: ${info.how}`}</Text>
      )}
      {list.length > 0 && <Text style={[styles.muted, { marginTop: space.sm }]}>{info.how}</Text>}

      <View style={styles.logRow}>
        <TextInput
          style={styles.input}
          value={entry}
          onChangeText={setEntry}
          placeholder={now ? String(now.value) : '—'}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          accessibilityLabel={`${info.label} in ${unit}`}
          onSubmitEditing={log}
          maxFontSizeMultiplier={1.4}
        />
        <Text style={styles.unit}>{unit}</Text>
        <Button title="Log" onPress={log} style={{ flex: 1 }} />
      </View>
      {warn && <Text style={styles.warn}>{warn}</Text>}
      {list.length > 0 && (
        <Pressable
          onPress={async () => {
            await deleteMeasurement(db, list[list.length - 1].id);
            onChange();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Remove the last ${info.label.toLowerCase()} reading, ${fmt(list[list.length - 1].value)}`}
          hitSlop={8}
          style={{ alignSelf: 'flex-start', marginTop: space.sm }}
        >
          <Text style={styles.muted}>Remove last ({fmt(list[list.length - 1].value)})</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { color: colors.text, fontSize: 16, fontWeight: '700', marginVertical: space.md },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: space.sm },
  warn: { color: colors.warning, fontSize: 14, marginTop: space.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  input: {
    width: 100,
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  unit: { color: colors.textMuted, fontSize: 17, fontWeight: '600' },
});
