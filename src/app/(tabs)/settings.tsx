import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip, SectionLabel } from '../../components/ui';
import { loadSettings, saveSettings } from '../../lib/db';
import { colors, space } from '../../lib/theme';
import { ALL_EQUIPMENT, type Goal, type Settings } from '../../lib/types';
import { useFocusData } from '../../lib/useData';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Muscle' },
  { value: 'endurance', label: 'Endurance' },
];
const LENGTHS = [30, 45, 60, 75];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [settings, reload] = useFocusData(() => loadSettings(db));
  if (!settings) return <View style={styles.screen} />;

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
});
