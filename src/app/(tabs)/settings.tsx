import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StravaCard } from '../../components/StravaCard';
import { allowReminders, recapNudgeOn, remindersSupported, setRecapNudge, syncReminders } from '../../services/reminders';
import { stravaEnabled } from '../../services/strava';
import { socialConfigured } from '../../services/supabase';
import { Button, Chip, SectionLabel, Loading } from '../../components/ui';
import { exportTrainingLog } from '../../services/exportLog';
import { backupAvailable } from '../../services/backup';
import { BackupCard } from '../../components/BackupCard';
import { CreatorCodeEntry } from '../../components/CreatorCodeEntry';
import { MyCreatorCode } from '../../components/MyCreatorCode';
import { creatorCodesAvailable } from '../../services/creatorCode';
import { fromKg, loadSettings, saveSettings, toKg } from '../../lib/db';
import { formatTime } from '../../lib/habits';
import { dailyTargets } from '../../lib/nutrition';
import { colors, radius, space } from '../../lib/theme';
import { ALL_EQUIPMENT, type Goal, type Settings } from '../../lib/types';
import { useFocusData } from '../../lib/useData';
import { activeGym, addGym, MAX_GYMS, removeGym, renameGym, switchGym, withEquipment, GYM_NAME_MAX, type Gyms } from '../../lib/gyms';
import { loadGyms, saveGyms } from '../../services/gyms';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Muscle' },
  { value: 'endurance', label: 'Endurance' },
];
const LENGTHS = [30, 45, 60, 75];
const GOAL_DAYS = [1, 2, 3, 4, 5, 6];
// Monday first, as the weekly goal counts; values are JavaScript weekdays (0 = Sunday).
const WEEKDAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];
const REMINDER_TIMES = [6 * 60 + 30, 8 * 60, 12 * 60, 17 * 60 + 30, 19 * 60, 20 * 60 + 30];
const DIETS: { value: Settings['nutritionGoal']; label: string }[] = [
  { value: 'lose', label: 'Lose fat' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Build muscle' },
];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [settings, reload] = useFocusData(() => loadSettings(db));
  const [weightText, setWeightText] = useState('');
  const [notifyBlocked, setNotifyBlocked] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [recapOn, setRecapOn] = useState(true);
  const [gyms, setGyms] = useState<Gyms | null>(null);
  const [gymName, setGymName] = useState('');
  useEffect(() => {
    if (settings) loadGyms(db).then(setGyms).catch(() => {});
  }, [db, settings]);
  useEffect(() => {
    if (gyms) setGymName(activeGym(gyms).name);
  }, [gyms?.active]);
  useEffect(() => {
    recapNudgeOn(db).then(setRecapOn).catch(() => {});
  }, [db]);
  useEffect(() => {
    if (settings) setWeightText(settings.bodyWeightKg ? String(Math.round(fromKg(settings.bodyWeightKg))) : '');
  }, [settings]);
  if (!settings) return <Loading />;
  const targets = dailyTargets(settings.bodyWeightKg, settings.nutritionGoal, settings.goal);

  const update = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    await saveSettings(db, next);
    reload();
    if ('reminderDays' in patch || 'reminderMinutes' in patch || 'weeklyGoal' in patch) syncReminders(db, next);
  };
  const toggleRecap = async () => {
    const on = !recapOn;
    if (on && !(await allowReminders())) {
      setNotifyBlocked(true);
      return;
    }
    setRecapOn(on);
    await setRecapNudge(db, on);
  };

  const toggleReminderDay = async (day: number) => {
    const has = settings.reminderDays.includes(day);
    // Ask for permission the first time a day is turned on, not on launch.
    if (!has && settings.reminderDays.length === 0) {
      const ok = await allowReminders();
      setNotifyBlocked(!ok);
      if (!ok) return;
    }
    update({ reminderDays: has ? settings.reminderDays.filter((d) => d !== day) : [...settings.reminderDays, day] });
  };
  const changeGyms = async (next: Gyms) => {
    setGyms(next);
    await saveGyms(db, next);
    reload();
  };
  const toggleEquipment = (e: (typeof ALL_EQUIPMENT)[number]) => {
    const has = settings.equipment.includes(e);
    const next = has ? settings.equipment.filter((x) => x !== e) : [...settings.equipment, e];
    if (next.length === 0) return;
    if (gyms) changeGyms(withEquipment(gyms, next));
    else update({ equipment: next });
  };
  const gym = gyms && activeGym(gyms);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
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
      <SectionLabel>Where you train</SectionLabel>
      {gyms && gym && (
        <>
          <View style={styles.wrap}>
            {gyms.list.map((g) => (
              <Chip key={g.id} label={g.name} selected={g.id === gyms.active} onPress={() => changeGyms(switchGym(gyms, g.id))} />
            ))}
            {gyms.list.length < MAX_GYMS && <Chip label="+ Add a place" selected={false} onPress={() => changeGyms(addGym(gyms) ?? gyms)} />}
          </View>
          <View style={[styles.weightRow, { marginTop: space.sm }]}>
            <TextInput
              style={[styles.weightInput, styles.nameInput]}
              value={gymName}
              onChangeText={setGymName}
              onBlur={() => changeGyms(renameGym(gyms, gym.id, gymName))}
              maxLength={GYM_NAME_MAX}
              accessibilityLabel="Name of this place"
              maxFontSizeMultiplier={1.4}
            />
            {gyms.list.length > 1 && (
              <Pressable onPress={() => changeGyms(removeGym(gyms, gym.id))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${gym.name}`}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
      <SectionLabel>{gym && gyms!.list.length > 1 ? `Equipment at ${gym.name}` : 'Equipment you have'}</SectionLabel>
      <View style={styles.wrap}>
        {ALL_EQUIPMENT.map((e) => (
          <Chip key={e} label={e[0].toUpperCase() + e.slice(1)} selected={settings.equipment.includes(e)} onPress={() => toggleEquipment(e)} />
        ))}
      </View>
      {gyms?.list.length === 1 && <Text style={styles.note}>Train in more than one place? Add it, and switch from Today. Workouts only use what’s there.</Text>}
      <SectionLabel>Weekly goal</SectionLabel>
      <View style={styles.wrap}>
        {GOAL_DAYS.map((n) => (
          <Chip key={n} label={`${n} ${n === 1 ? 'day' : 'days'}`} selected={settings.weeklyGoal === n} onPress={() => update({ weeklyGoal: n })} />
        ))}
      </View>
      <Text style={styles.note}>Days you train each week, lifting or cardio. Hit it to build your streak. A goal you can keep beats an ambitious one you can’t.</Text>
      <SectionLabel>Training reminders</SectionLabel>
      {remindersSupported ? (
        <>
          <View style={styles.wrap}>
            {WEEKDAYS.map((w) => (
              <Chip key={w.day} label={w.label} selected={settings.reminderDays.includes(w.day)} onPress={() => toggleReminderDay(w.day)} />
            ))}
          </View>
          {settings.reminderDays.length > 0 && (
            <View style={[styles.wrap, { marginTop: space.sm }]}>
              {REMINDER_TIMES.map((m) => (
                <Chip key={m} label={formatTime(m)} selected={settings.reminderMinutes === m} onPress={() => update({ reminderMinutes: m })} />
              ))}
            </View>
          )}
          <Text style={styles.note}>
            {notifyBlocked
              ? 'Notifications are off for this app. Turn them on in the iPhone Settings app, then pick your days again.'
              : settings.reminderDays.length === 0
                ? 'Pick the days you plan to train and we’ll nudge you. Off for now.'
                : 'No reminder on a day you’ve already trained, or once this week’s goal is hit.'}
          </Text>
          <View style={[styles.wrap, { marginTop: space.md }]}>
            <Chip label="Sunday recap" selected={recapOn} onPress={toggleRecap} />
          </View>
          <Text style={styles.note}>Sunday at 7pm, a nudge to share your week’s story card. Only in weeks you trained, and only once notifications are allowed.</Text>
        </>
      ) : (
        <Text style={[styles.note, { marginTop: 0 }]}>Reminders work in the app on your phone.</Text>
      )}
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
      {socialConfigured && (
        <>
          <SectionLabel>Friends</SectionLabel>
          <View style={styles.wrap}>
            <Chip label="Share my sessions" selected={settings.shareWithFriends} onPress={() => update({ shareWithFriends: true })} />
            <Chip label="Keep private" selected={!settings.shareWithFriends} onPress={() => update({ shareWithFriends: false })} />
          </View>
          <Text style={styles.note}>When you’re signed in, a summary of each finished workout or cardio session goes to friends you’ve accepted. Kept private, it goes only to your coach, if you have one.</Text>
        </>
      )}
      {stravaEnabled && (
        <>
          <SectionLabel>Strava</SectionLabel>
          <StravaCard />
        </>
      )}
      <Text style={[styles.note, { marginTop: space.md }]}>Today's plan updates as soon as you change these.</Text>
      {creatorCodesAvailable() && (
        <>
          <SectionLabel>Creator code</SectionLabel>
          <CreatorCodeEntry startOpen />
          <MyCreatorCode />
        </>
      )}
      <SectionLabel>Your data</SectionLabel>
      {backupAvailable && (
        <View style={{ marginBottom: space.lg }}>
          <BackupCard onRestored={reload} />
        </View>
      )}
      <Button
        title="Export training log (CSV)"
        variant="secondary"
        onPress={async () => {
          const n = await exportTrainingLog(db);
          setExported(n === 0 ? 'Nothing to export yet. Finish a workout first.' : `Exported ${n} ${n === 1 ? 'set' : 'sets'}.`);
        }}
      />
      <Text style={[styles.note, { marginTop: space.sm }]}>
        {exported ?? 'Every set you’ve logged, as a file that opens in Excel, Numbers or Google Sheets.'}
      </Text>
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
  nameInput: { flex: 1, width: undefined, fontSize: 17, textAlign: 'left', paddingHorizontal: space.md },
  remove: { color: colors.danger, fontSize: 15, fontWeight: '700', paddingHorizontal: space.sm },
});
