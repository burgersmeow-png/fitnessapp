import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { codeFromUrl, normalizeCode, type CreatorState } from '../lib/creatorCode';
import { colors, radius, space } from '../lib/theme';
import { applyCode, checkCode, creatorCodesAvailable, loadCreator } from '../services/creatorCode';
import { Icon } from './Icon';
import { Button } from './ui';

/**
 * "Have a creator code?" for followers of an influencer. A code in the link they tapped
 * (…?code=ALEX10) is filled in and checked for them. Once applied, it shows who sent them.
 */
export function CreatorCodeEntry({ startOpen = false }: { startOpen?: boolean }) {
  const db = useSQLiteContext();
  const url = Linking.useURL();
  const [applied, setApplied] = useState<CreatorState | null | undefined>(undefined);
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCreator(db).then(setApplied);
  }, [db]);

  const apply = async (raw: string) => {
    const code = normalizeCode(raw);
    if (!code) return setError('Codes are 3 to 20 letters and numbers.');
    setBusy(true);
    setError(null);
    try {
      const found = await checkCode(code);
      await applyCode(db, found);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setApplied(await loadCreator(db));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code isn’t valid.');
    } finally {
      setBusy(false);
    }
  };

  // Followers usually arrive from a creator's link, so use the code in it.
  useEffect(() => {
    const fromLink = codeFromUrl(url);
    if (applied === null && fromLink && !busy && !text) {
      setOpen(true);
      setText(fromLink);
      apply(fromLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, applied]);

  if (!creatorCodesAvailable() || applied === undefined) return null;

  if (applied) {
    return (
      <View style={styles.applied} accessible accessibilityLabel={`Creator code ${applied.code} from ${applied.creatorName} applied`}>
        <Icon name="check" size={20} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.appliedTitle}>Welcome from {applied.creatorName}</Text>
          <Text style={styles.muted}>{applied.welcome ?? `Code ${applied.code} is on your account.`}</Text>
        </View>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
        <Text style={styles.link}>Have a creator code?</Text>
      </Pressable>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t.toUpperCase());
            setError(null);
          }}
          placeholder="CREATOR CODE"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={24}
          style={styles.input}
          accessibilityLabel="Creator code"
          onSubmitEditing={() => apply(text)}
        />
        <Button title={busy ? 'Checking…' : 'Apply'} onPress={() => !busy && apply(text)} variant="secondary" style={{ minWidth: 110 }} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, width: '100%' },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },
  error: { color: colors.warning, fontSize: 14, marginTop: space.sm },
  applied: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.success },
  appliedTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
});
