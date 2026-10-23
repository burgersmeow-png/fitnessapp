import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, SectionLabel, Loading } from '../../components/ui';
import { fromKg, loadSettings, saveSettings, toKg } from '../../lib/db';
import { dailyTargets } from '../../lib/nutrition';
import { colors, radius, space } from '../../lib/theme';
import { ALL_EQUIPMENT, type Goal, type Settings } from '../../lib/types';
import { useFocusData } from '../../lib/useData';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Muscle' },
  { value: 'endurance', label: 'Endurance' },
];
const LENGTHS = [30, 45, 60, 75];
const DIETS: { value: Settings['nutritionGoal']; label: string }[] = [
  { value: 'lose', label: 'Lose fat' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Build muscle' },
];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [settings, reload] = useFocusData(() => loadSettings(db));
  const [weightText, setWeightText] = useState('');
  useEffect(() => {
    if (settings) setWeightText(settings.bodyWeightKg ? String(Math.round(fromKg(settings.bodyWeightKg))) : '');
  }, [settings]);
  if (!settings) return <Loading />;
  const targets = dailyTargets(settings.bodyWeightKg, settings.nutritionGoal, settings.goal);

  const update = async (patch: Partial<Settings>) => {
    await saveSettings(db, { ...settings, ...patch });
    reload();
  };
  const toggleEquipment = (e: (typeof ALL_EQUIPMENT)[number]) => {
    const has = settings.equipment.includes(e);
    const next = has ? settings.equipment.filter((x) => x !== e) : [...settings.equipment, e];
    if (next.length > 0) update({ equipment: next });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md }}>
      <SectionLabel>Goal</SectionLabel>
      <View style={styles.wrap}>
        {GOALS.map((g) => (
          <Chip key={g.value} label={g.label} selected={settings.goal === g.value} onPress={() => update({ goal: g.value })} />
        ))}
      </View>
      <SectionLabel>Workout length</SectionLabel>
      <View style={styles.wrap}>
        {LENGTHS.map((m) => (
          <Chip key={m} label={`${m} min`} selected={settings.minutes === m} onPress={() => update({ minutes: m })} />
        ))}
      </View>
      <SectionLabel>Equipment you have</SectionLabel>
      <View style={styles.wrap}>
        {ALL_EQUIPMENT.map((e) => (
          <Chip key={e} label={e[0].toUpperCase() + e.slice(1)} selected={settings.equipment.includes(e)} onPress={() => toggleEquipment(e)} />
        ))}
      </View>
      <SectionLabel>Body weight</SectionLabel>
      <View style={styles.weightRow}>
        <TextInput
          style={styles.weightInput}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={colors.textMuted}
          value={weightText}
          onChangeText={setWeightText}
          onBlur={() => {
            const n = Number(weightText);
            update({ bodyWeightKg: weightText.trim() && n > 0 ? Math.round(toKg(n) * 10) / 10 : null });
          }}
          accessibilityLabel={`Body weight in ${settings.units}`}
          maxFontSizeMultiplier={1.4}
        />
        <Text style={styles.unit}>{settings.units}</Text>
      </View>
      <SectionLabel>Nutrition goal</SectionLabel>
      <View style={styles.wrap}>
        {DIETS.map((d) => (
          <Chip key={d.value} label={d.label} selected={settings.nutritionGoal === d.value} onPress={() => update({ nutritionGoal: d.value })} />
        ))}
      </View>
      <Text style={styles.note}>
        Daily target: {targets.calories.toLocaleString()} kcal, {targets.protein} g protein, {targets.carbs} g carbs, {targets.fat} g fat.
        {settings.bodyWeightKg == null ? ' Add your body weight to make it personal.' : ''}
      </Text>
      <SectionLabel>Units</SectionLabel>
      <View style={styles.wrap}>
        <Chip label="Kilograms (kg, km)" selected={settings.units === 'kg'} onPress={() => update({ units: 'kg' })} />
        <Chip label="Pounds (lb, mi)" selected={settings.units === 'lb'} onPress={() => update({ units: 'lb' })} />
      </View>
      <Text style={styles.note}>Switching converts all your past weights and distances too.</Text>
      <Text style={[styles.note, { marginTop: space.md }]}>Today's plan updates as soon as you change these.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  note: { color: colors.textMuted, fontSize: 14, marginTop: space.lg },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  weightInput: {
    width: 110,
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
