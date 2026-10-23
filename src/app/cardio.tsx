import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyMap, type MuscleFills } from '../components/BodyMap';
import { Icon } from '../components/Icon';
import { Button, SectionLabel } from '../components/ui';
import { MUSCLE_LABELS } from '../lib/format';
import { CARDIO_BY_TYPE, CARDIO_KINDS, EFFORTS, type CardioType } from '../lib/cardio';
import { loadSettings, saveCardio, toKm } from '../lib/db';
import { cardioTitle } from '../lib/social';
import { sharePost } from '../services/social';
import { useFocusData } from '../lib/useData';
import { colors, radius, space, type } from '../lib/theme';
import type { Muscle } from '../lib/types';

const DURATIONS = [10, 20, 30, 45, 60, 90];

export default function CardioScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<CardioType>('run');
  const [minutes, setMinutes] = useState(30);
  const [distance, setDistance] = useState('');
  const [rpe, setRpe] = useState(5);
  const selected = CARDIO_BY_TYPE.get(kind)!;
  const [settings] = useFocusData(() => loadSettings(db));
  const distanceUnit = settings?.units === 'kg' ? 'km' : 'mi';

  const fills: MuscleFills = {};
  for (const [m, share] of Object.entries(selected.load) as [Muscle, number][]) {
    fills[m] = { color: colors.accent, opacity: 0.3 + 0.7 * share };
  }

  const save = async () => {
    const startedAt = new Date(Date.now() - minutes * 6e4).toISOString();
    const dist = selected.hasDistance && distance.trim() !== '' && !Number.isNaN(Number(distance)) ? Number(distance) : null;
    await saveCardio(db, { type: kind, startedAt, minutes, distance: dist, rpe });
    if (settings?.shareWithFriends) {
      const km = toKm(dist);
      sharePost(db, {
        clientId: `cardio:${startedAt}`,
        kind: 'cardio',
        title: cardioTitle(startedAt, selected.label),
        happenedAt: startedAt,
        body: { cardioType: kind, minutes, distanceKm: km == null ? null : Math.round(km * 100) / 100 },
      }).catch(() => {});
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={styles.headerLink}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Log cardio</Text>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.grid}>
          {CARDIO_KINDS.map((k) => {
            const on = k.type === kind;
            return (
              <Pressable
                key={k.type}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setKind(k.type);
                }}
                style={[styles.kind, on && styles.kindOn]}
              >
                <Icon name={k.icon} size={28} color={on ? colors.accentText : colors.text} />
                <Text style={[styles.kindLabel, on && { color: colors.accentText }]}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.mapCard}>
          <BodyMap fills={fills} height={150} label={`${selected.label} works your ${Object.keys(selected.load).map((m) => MUSCLE_LABELS[m as Muscle]).join(', ')}`} />
          <Text style={[type.label, { marginTop: space.sm }]}>MUSCLES THIS WORKS</Text>
        </View>

        <SectionLabel>Duration</SectionLabel>
        <View style={styles.row}>
          {DURATIONS.map((d) => (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: minutes === d }} onPress={() => setMinutes(d)} style={[styles.pill, minutes === d && styles.pillOn]}>
              <Text style={[styles.pillText, minutes === d && { color: colors.accentText }]}>{d} min</Text>
            </Pressable>
          ))}
        </View>

        {selected.hasDistance && (
          <>
            <SectionLabel>{`Distance in ${distanceUnit} (optional)`}</SectionLabel>
            <TextInput
              style={styles.input}
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
              placeholder="e.g. 3.1"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}

        <SectionLabel>Effort</SectionLabel>
        <View style={styles.row}>
          {EFFORTS.map((e) => (
            <Pressable key={e.rpe} accessibilityRole="button" accessibilityState={{ selected: rpe === e.rpe }} onPress={() => setRpe(e.rpe)} style={[styles.pill, styles.effort, rpe === e.rpe && styles.pillOn]}>
              <Text style={[styles.pillText, rpe === e.rpe && { color: colors.accentText }]}>{e.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>Cardio counts toward muscle recovery, so a hard run moves leg day back.</Text>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button title={`Save ${minutes} min ${selected.label.toLowerCase()}`} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md },
  headerLink: { color: colors.textMuted, fontSize: 17 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kind: {
    width: '23%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kindOn: { backgroundColor: colors.accent },
  kindLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  mapCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  pillOn: { backgroundColor: colors.accent },
  pillText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  effort: { flexGrow: 1, alignItems: 'center' },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: space.md,
  },
  note: { color: colors.textMuted, fontSize: 14, marginTop: space.lg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md, backgroundColor: colors.background },
});
