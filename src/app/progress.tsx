import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { LineChart } from '../components/LineChart';
import { Button, Card, Loading, SectionLabel } from '../components/ui';
import { deleteBodyWeight, loadBodyWeights, loadExercises, loadHistory, loadSettings, logBodyWeight } from '../lib/db';
import { formatNumber, MUSCLE_LABELS } from '../lib/format';
import { liftTrends, setsPerMuscle, trainingDaysPerWeek, trend, trendChange, WEEKLY_SETS, weightNote } from '../lib/progress';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { loadSessionDates } from '../services/habits';

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const [entry, setEntry] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);
  const [data, reload] = useFocusData(async () => {
    const [weights, history, exercises, settings, dates] = await Promise.all([
      loadBodyWeights(db, 120),
      loadHistory(db, 84),
      loadExercises(db),
      loadSettings(db),
      loadSessionDates(db),
    ]);
    return {
      weights,
      settings,
      names: new Map(exercises.map((e) => [e.id, e.name])),
      lifts: liftTrends(history),
      weeks: trainingDaysPerWeek(dates),
      muscles: setsPerMuscle(history, new Map(exercises.map((e) => [e.id, e]))),
    };
  });
  if (!data) return <Loading />;
  const { weights, settings, lifts, weeks, names, muscles } = data;
  // Scale so the top of the target band and the busiest muscle both fit.
  const muscleMax = Math.max(WEEKLY_SETS.high + 4, ...muscles.map((m) => m.sets));
  const unit = settings.units;
  const points = weights.map((w) => ({ t: Date.parse(w.measuredAt), v: w.weight }));
  const smooth = trend(points);
  const change = trendChange(points, 30);
  const fmt = (v: number) => `${formatNumber(Math.round(v * 10) / 10)} ${unit}`;
  // Headroom above the tallest bar or the goal, so the goal line never sits on the top edge.
  const most = Math.max(settings.weeklyGoal, ...weeks.map((w) => w.days)) + 1;
  const week = weeks[pickedWeek ?? weeks.length - 1];

  const log = async () => {
    const n = Number(entry.replace(',', '.'));
    const sane = unit === 'kg' ? n >= 25 && n <= 350 : n >= 55 && n <= 770;
    if (!sane) return setNote(`Enter your weight in ${unit}.`);
    setNote(null);
    setEntry('');
    await logBodyWeight(db, n);
    reload();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
      <SectionLabel>Body weight</SectionLabel>
      <Card>
        {smooth.length > 0 && (
          <Text style={styles.headline}>{weightNote(change, settings.nutritionGoal, unit)}</Text>
        )}
        {points.length >= 2 ? (
          <LineChart
            points={points}
            trend={smooth}
            format={fmt}
            label={`Body weight chart. ${weightNote(change, settings.nutritionGoal, unit)} Latest trend ${fmt(smooth[smooth.length - 1].v)}.`}
          />
        ) : (
          <Text style={styles.muted}>
            {points.length === 1
              ? `Logged ${fmt(points[0].v)}. One more weigh-in and your chart starts.`
              : 'Weigh in a few mornings a week. The chart smooths out daily ups and downs so you see the real trend.'}
          </Text>
        )}
        <View style={styles.logRow}>
          <TextInput
            style={styles.input}
            value={entry}
            onChangeText={setEntry}
            placeholder={settings.bodyWeightKg ? String(Math.round(points[points.length - 1]?.v ?? 0) || '') : '—'}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel={`Today's weight in ${unit}`}
            onSubmitEditing={log}
            maxFontSizeMultiplier={1.4}
          />
          <Text style={styles.unit}>{unit}</Text>
          <Button title="Log" onPress={log} style={{ flex: 1 }} />
        </View>
        {note && <Text style={styles.warn}>{note}</Text>}
        {weights.length > 0 && (
          <Pressable
            onPress={async () => {
              await deleteBodyWeight(db, weights[weights.length - 1].id);
              reload();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove the last weigh-in, ${fmt(weights[weights.length - 1].weight)}`}
            hitSlop={8}
            style={{ alignSelf: 'flex-start', marginTop: space.sm }}
          >
            <Text style={styles.muted}>Remove last ({fmt(weights[weights.length - 1].weight)})</Text>
          </Pressable>
        )}
      </Card>

      <SectionLabel>Training days per week</SectionLabel>
      <Card>
        <Text style={styles.muted}>
          <Text style={styles.value}>{week.days}</Text>
          {`  week of ${week.weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · goal ${settings.weeklyGoal}`}
        </Text>
        <View style={styles.bars} accessibilityLabel={`Training days for the last ${weeks.length} weeks: ${weeks.map((w) => w.days).join(', ')}. Goal ${settings.weeklyGoal}.`} accessible>
          <View style={[styles.goalLine, { bottom: `${(settings.weeklyGoal / most) * 100}%` }]} />
          <Text style={[styles.small, styles.goalLabel, { bottom: `${(settings.weeklyGoal / most) * 100}%` }]}>goal</Text>
          {weeks.map((w, i) => (
            <Pressable key={w.weekStart.getTime()} style={styles.barSlot} onPress={() => setPickedWeek(i)} hitSlop={4}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max(3, (w.days / most) * 100)}%`, backgroundColor: w.days >= settings.weeklyGoal ? colors.accent : colors.textMuted, opacity: w.days >= settings.weeklyGoal ? 1 : 0.45 },
                  i === (pickedWeek ?? weeks.length - 1) && styles.barPicked,
                ]}
              />
            </Pressable>
          ))}
        </View>
        <View style={styles.dates}>
          <Text style={styles.small}>{weeks.length} weeks ago</Text>
          <Text style={styles.small}>This week</Text>
        </View>
        <Text style={[styles.small, { marginTop: space.sm }]}>Orange weeks hit your goal. Tap a week to see it.</Text>
      </Card>

      <SectionLabel>Sets per muscle, last 7 days</SectionLabel>
      <Card>
        {muscles.map(({ muscle, sets }) => {
          const inRange = sets >= WEEKLY_SETS.low;
          return (
            <View key={muscle} style={styles.muscleRow} accessible accessibilityLabel={`${MUSCLE_LABELS[muscle]}: ${sets} sets`}>
              <Text style={styles.muscleName}>{MUSCLE_LABELS[muscle]}</Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.band,
                    { left: `${(WEEKLY_SETS.low / muscleMax) * 100}%`, width: `${((WEEKLY_SETS.high - WEEKLY_SETS.low) / muscleMax) * 100}%` },
                  ]}
                />
                {sets > 0 && (
                  <View
                    style={[
                      styles.fill,
                      { width: `${(sets / muscleMax) * 100}%`, backgroundColor: inRange ? colors.accent : colors.textMuted, opacity: inRange ? 1 : 0.6 },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.muscleSets}>{Number.isInteger(sets) ? sets : sets.toFixed(1)}</Text>
            </View>
          );
        })}
        <Text style={[styles.small, { marginTop: space.sm }]}>
          The shaded zone is {WEEKLY_SETS.low}–{WEEKLY_SETS.high} sets a week, where most people grow best. Lifts count half for muscles they only help.
        </Text>
      </Card>

      <SectionLabel>Strength (estimated 1-rep max)</SectionLabel>
      {lifts.length === 0 && (
        <Card>
          <Text style={styles.muted}>Log a few workouts and your most-trained lifts show up here with their strength trend.</Text>
        </Card>
      )}
      {lifts.map((l) => (
        <Card key={l.exerciseId} style={{ marginBottom: space.sm }}>
          <Pressable
            onPress={() => router.push(`/exercise/${l.exerciseId}`)}
            accessibilityRole="button"
            accessibilityHint="Shows the lift and every session"
            style={styles.liftHead}
          >
            <Text style={[styles.liftName, { flex: 1 }]} numberOfLines={1}>
              {names.get(l.exerciseId) ?? l.exerciseId}
            </Text>
            {l.changePct != null && (
              <Text style={[styles.change, { color: l.changePct > 0 ? colors.success : colors.textMuted }]}>
                {l.changePct > 0 ? '▲' : l.changePct < 0 ? '▼' : ''} {Math.abs(l.changePct)}%
              </Text>
            )}
            <Icon name="chevron" size={14} color={colors.textMuted} />
          </Pressable>
          {l.points.length >= 2 ? (
            <LineChart
              points={l.points}
              format={(v) => `${Math.round(v)} ${unit}`}
              height={90}
              label={`${names.get(l.exerciseId)} strength chart, best ${Math.round(l.best)} ${unit}${l.changePct != null ? `, ${l.changePct}% over 12 weeks` : ''}.`}
            />
          ) : (
            <Text style={styles.muted}>{`${Math.round(l.best)} ${unit} so far. Train it again to start a trend.`}</Text>
          )}
        </Card>
      ))}
      <Text style={[styles.small, { marginTop: space.sm }]}>Your most-trained lifts over the last 12 weeks. Change compares your first and last two weeks.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headline: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: space.md },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  small: { color: colors.textMuted, fontSize: 12 },
  warn: { color: colors.warning, fontSize: 14, marginTop: space.sm },
  value: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 },
  muscleName: { width: 92, color: colors.text, fontSize: 14 },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.border },
  fill: { height: '100%', borderRadius: 6 },
  muscleSets: { width: 36, textAlign: 'right', color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, marginTop: space.md, gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barPicked: { borderWidth: 2, borderColor: colors.text, opacity: 1 },
  goalLabel: { position: 'absolute', left: 0, marginBottom: 2 },
  goalLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.textMuted, opacity: 0.6 },
  dates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  liftHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  liftName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  change: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
