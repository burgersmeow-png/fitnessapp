import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type } from '../lib/theme';
import { TITLE_MAX, workoutUrl, type WorkoutLink } from '../lib/workoutLink';
import { linkWithMyCode } from '../services/creatorCode';
import { SITE_URL } from '../services/server';
import { shareLink } from '../services/shareLink';
import { Button } from './ui';

/** Name a workout and share it as a link followers can open in LiftLab. */
export function WorkoutLinkSheet({ link, onClose }: { link: WorkoutLink | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [dare, setDare] = useState(true);
  useEffect(() => {
    setTitle(link?.title ?? '');
    setStatus(null);
    setDare(true);
  }, [link]);

  const share = async () => {
    if (!link) return;
    const { beat, ...rest } = link;
    const named = { ...rest, title: title.trim() || 'My workout', ...(beat && dare ? { beat } : {}) };
    const text = named.beat
      ? `I did "${named.title}" for ${named.beat.volume.toLocaleString('en-US')} ${named.beat.units}. Can you beat it on LiftLab?`
      : `Try my workout "${named.title}" on LiftLab:`;
    try {
      const r = await shareLink(text, await linkWithMyCode(db, workoutUrl(SITE_URL, named)));
      setStatus(r === 'copied' ? 'Link copied. Paste it in your bio, story or a message.' : null);
    } catch {
      setStatus('Could not share the link.');
    }
  };

  return (
    <Modal visible={link != null} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.head}>
          <Text style={type.title}>Share as a link</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
          <Text style={styles.sub}>Anyone with the link can load this workout in LiftLab. Their weights come from their own history.</Text>
          <Text style={styles.label}>WORKOUT NAME</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
            placeholder="e.g. Push day"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Workout name"
          />
          {link?.beat && (
            <Pressable
              onPress={() => setDare(!dare)}
              style={styles.dare}
              accessibilityRole="switch"
              accessibilityState={{ checked: dare }}
              accessibilityLabel="Dare them to beat my volume"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Dare them to beat it</Text>
                <Text style={styles.meta}>
                  Your {link.beat.volume.toLocaleString('en-US')} {link.beat.units} goes in the link as the score to top.
                </Text>
              </View>
              <View style={[styles.toggle, dare && styles.toggleOn]}>
                <View style={[styles.knob, dare && styles.knobOn]} />
              </View>
            </Pressable>
          )}
          <Text style={styles.label}>WHAT’S IN IT</Text>
          {link?.lifts.map((l, i) => (
            <View key={`${l.id}-${i}`} style={[styles.row, i > 0 && styles.divider]}>
              <Text style={styles.name} numberOfLines={1}>{l.name}</Text>
              <Text style={styles.meta}>{l.sets} × {l.reps}</Text>
            </View>
          ))}
        </ScrollView>
        {status && <Text style={styles.status}>{status}</Text>}
        <Button title="Share link" onPress={share} style={{ marginHorizontal: space.md }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  close: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 15, marginBottom: space.md },
  label: { ...type.label, marginTop: space.md, marginBottom: space.sm },
  input: { minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.md, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 15, fontVariant: ['tabular-nums'] },
  dare: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surface },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: colors.surfaceRaised, padding: 3 },
  toggleOn: { backgroundColor: colors.accent },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.textMuted },
  knobOn: { backgroundColor: colors.text, marginLeft: 20 },
  status: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: space.sm, paddingHorizontal: space.md },
});
