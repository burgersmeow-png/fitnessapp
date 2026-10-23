import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button, Chip } from '../components/ui';
import { loadSettings, logBodyWeight, saveSettings } from '../lib/db';
import {
  EQUIPMENT_PRESETS,
  EXPERIENCE,
  goalSettings,
  MAIN_GOALS,
  recommendProgram,
  suggestedDays,
  unitsForLocale,
  type Experience,
  type MainGoal,
} from '../lib/onboarding';
import { PROGRAM_BY_ID } from '../lib/programs';
import { colors, radius, space, type } from '../lib/theme';
import type { Settings } from '../lib/types';
import { startProgram } from '../services/programs';

const STEPS = ['intro', 'goal', 'experience', 'days', 'equipment', 'body', 'plan'] as const;
const LENGTHS = [30, 45, 60, 75];

/** First-run setup: a few taps to a first workout that fits. */
export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [main, setMain] = useState<MainGoal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(45);
  const [preset, setPreset] = useState<string | null>(null);
  const [units, setUnits] = useState<Settings['units']>(() => unitsForLocale(Intl.DateTimeFormat().resolvedOptions().locale));
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const name = STEPS[step];
  const programId = main && experience && days ? recommendProgram(main, experience, days) : null;
  const program = programId ? PROGRAM_BY_ID.get(programId) : undefined;

  const ready = { intro: true, goal: !!main, experience: !!experience, days: !!days, equipment: !!preset, body: true, plan: true }[name];
  const next = () => {
    if (name === 'experience' && experience && !days) setDays(suggestedDays(experience));
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const finish = async (withProgram: boolean, skip = false) => {
    if (busy) return;
    setBusy(true);
    const current = await loadSettings(db);
    if (skip) {
      await saveSettings(db, { ...current, onboarded: true, units });
    } else {
      await saveSettings(db, {
        ...current,
        ...goalSettings(main!),
        experience: experience!,
        weeklyGoal: days!,
        minutes,
        equipment: EQUIPMENT_PRESETS.find((p) => p.id === preset)!.equipment,
        units,
        onboarded: true,
      });
      const n = Number(weight.replace(',', '.'));
      if (n > 0) await logBodyWeight(db, n);
      if (withProgram && programId) await startProgram(db, programId);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.top}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
            <Icon name="chevron" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.dots} accessible accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i <= step && { backgroundColor: colors.accent }]} />
          ))}
        </View>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {name === 'intro' && (
          <View>
            <LinearGradient colors={['#FF6A2B', '#E5341B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
              <Icon name="today" size={44} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[type.hero, { marginTop: space.lg }]}>Workouts that adapt to you</Text>
            <Text style={styles.lead}>
              Every session is planned from what you’ve recovered from, what equipment you have, and how your last sets went.
            </Text>
            {[
              ['barbell', 'Weights that go up when you’re ready'],
              ['food', 'Food tracking with photos and barcodes'],
              ['friends', 'Friends, streaks and a coach if you want one'],
            ].map(([icon, text]) => (
              <View key={text} style={styles.point}>
                <Icon name={icon as 'barbell'} size={22} color={colors.accent} />
                <Text style={type.body}>{text}</Text>
              </View>
            ))}
            <Text style={[styles.muted, { marginTop: space.lg }]}>Five quick questions. Everything stays on your phone.</Text>
          </View>
        )}

        {name === 'goal' && (
          <Question title="What’s your main goal?">
            {MAIN_GOALS.map((g) => (
              <Option key={g.value} title={g.title} detail={g.detail} selected={main === g.value} onPress={() => setMain(g.value)} />
            ))}
          </Question>
        )}

        {name === 'experience' && (
          <Question title="How much have you lifted?">
            {EXPERIENCE.map((e) => (
              <Option key={e.value} title={e.title} detail={e.detail} selected={experience === e.value} onPress={() => setExperience(e.value)} />
            ))}
          </Question>
        )}

        {name === 'days' && (
          <Question title="How many days a week can you train?" note="Pick what you can keep up on a busy week. You can always do more.">
            <View style={styles.wrap}>
              {[2, 3, 4, 5, 6].map((n) => (
                <Chip key={n} label={`${n} days`} selected={days === n} onPress={() => setDays(n)} />
              ))}
            </View>
            <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>HOW LONG PER SESSION</Text>
            <View style={styles.wrap}>
              {LENGTHS.map((m) => (
                <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </View>
          </Question>
        )}

        {name === 'equipment' && (
          <Question title="Where do you train?" note="You can fine-tune equipment in Settings.">
            {EQUIPMENT_PRESETS.map((p) => (
              <Option key={p.id} title={p.title} detail={p.detail} selected={preset === p.id} onPress={() => setPreset(p.id)} />
            ))}
          </Question>
        )}

        {name === 'body' && (
          <Question title="Units and body weight" note="Body weight sets your calorie and protein targets. You can skip it.">
            <View style={styles.wrap}>
              <Chip label="Pounds (lb, mi)" selected={units === 'lb'} onPress={() => setUnits('lb')} />
              <Chip label="Kilograms (kg, km)" selected={units === 'kg'} onPress={() => setUnits('kg')} />
            </View>
            <View style={styles.weightRow}>
              <TextInput
                style={styles.weight}
                value={weight}
                onChangeText={setWeight}
                placeholder="—"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                accessibilityLabel={`Body weight in ${units}, optional`}
                maxFontSizeMultiplier={1.4}
              />
              <Text style={styles.unit}>{units}</Text>
            </View>
          </Question>
        )}

        {name === 'plan' && (
          <Question title="Your plan">
            {program ? (
              <View style={styles.planCard}>
                <Text style={type.label}>RECOMMENDED PROGRAM</Text>
                <Text style={[type.title, { marginTop: space.xs }]}>{program.name}</Text>
                <Text style={styles.muted}>
                  {program.daysPerWeek} days a week · {program.weeks} weeks · {minutes} min sessions
                </Text>
                <Text style={[type.body, { marginTop: space.sm, lineHeight: 22 }]}>{program.blurb}</Text>
                {program.daysPerWeek !== days && (
                  <Text style={[styles.muted, { marginTop: space.sm }]}>
                    {`It’s ${program.daysPerWeek} days rather than ${days}: that’s what suits ${experience === 'new' ? 'someone starting out' : 'your schedule'} best. Extra days can be cardio.`}
                  </Text>
                )}
              </View>
            ) : null}
            <Text style={[styles.muted, { marginTop: space.md }]}>
              Or skip the program and let the app plan each day from whatever you’ve recovered from.
            </Text>
          </Question>
        )}
      </ScrollView>

      {name === 'plan' ? (
        <View style={styles.footer}>
          <Button title={program ? `Start ${program.name}` : 'Start training'} onPress={() => finish(true)} />
          <Pressable onPress={() => finish(false)} accessibilityRole="button" style={styles.secondary} hitSlop={8}>
            <Text style={styles.link}>Plan each day for me instead</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Button title={name === 'intro' ? 'Get started' : 'Continue'} onPress={() => ready && next()} variant={ready ? 'primary' : 'secondary'} />
          {name === 'intro' && (
            <Pressable onPress={() => finish(false, true)} accessibilityRole="button" style={styles.secondary} hitSlop={8}>
              <Text style={styles.link}>Skip, I’ll set things up myself</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Question({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={[type.hero, { fontSize: 30, marginBottom: space.sm }]} accessibilityRole="header">
        {title}
      </Text>
      {note && <Text style={[styles.muted, { marginBottom: space.md }]}>{note}</Text>}
      <View style={{ marginTop: note ? 0 : space.md }}>{children}</View>
    </View>
  );
}

function Option({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <Icon name="check" size={14} color={colors.accentText} />}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, height: 44 },
  back: { width: 44, height: 44, justifyContent: 'center', transform: [{ scaleX: -1 }] },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised },
  body: { padding: space.lg, paddingTop: space.md },
  badge: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  lead: { color: colors.textMuted, fontSize: 17, lineHeight: 24, marginTop: space.sm, marginBottom: space.lg },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  muted: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: space.sm,
  },
  optionOn: { borderColor: colors.accent },
  optionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  weight: {
    width: 120,
    minHeight: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  unit: { color: colors.textMuted, fontSize: 18, fontWeight: '600' },
  planCard: { padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  footer: { paddingHorizontal: space.lg, gap: space.sm },
  secondary: { alignSelf: 'center', padding: space.sm },
  link: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
});
