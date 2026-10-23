import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeCode } from '../lib/creatorCode';
import { colors, radius, space } from '../lib/theme';
import { checkCode, loadMyCode, saveMyCode } from '../services/creatorCode';
import { Button } from './ui';

/** For creators: their own code, added to every link they share so sign-ups count for them. */
export function MyCreatorCode() {
  const db = useSQLiteContext();
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    loadMyCode(db).then((c) => {
      setSaved(c);
      setText(c ?? '');
    });
  }, [db]);

  const save = async () => {
    setNote(null);
    if (!text.trim()) {
      await saveMyCode(db, null);
      setSaved(null);
      return setNote('Removed. Your links go out without a code.');
    }
    const code = normalizeCode(text);
    if (!code) return setNote('Codes are 3 to 20 letters and numbers.');
    try {
      await checkCode(code);
    } catch (e) {
      return setNote(e instanceof Error ? e.message : 'That code isn’t valid.');
    }
    await saveMyCode(db, code);
    setSaved(code);
    setText(code);
    setNote(`Saved. Links and story cards you share now carry ${code}.`);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Are you a creator?</Text>
      <Text style={styles.meta}>Add your code and it goes on every link and story card you share, so sign-ups count for you.</Text>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Your code, e.g. ALEX10"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="Your creator code"
        />
        <Button title={saved && saved === normalizeCode(text) ? 'Saved' : 'Save'} variant="secondary" onPress={save} />
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md, width: '100%' },
  input: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.background, color: colors.text, paddingHorizontal: space.md, fontSize: 17 },
  note: { color: colors.textMuted, fontSize: 14, marginTop: space.sm },
});
