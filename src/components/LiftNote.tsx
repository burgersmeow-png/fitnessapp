import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NOTE_MAX } from '../lib/notes';
import { colors, radius, space } from '../lib/theme';

/**
 * A lift's personal note, edited in place. Empty notes show a quiet "Add a note" link so
 * the card stays clean for lifts that don't need one.
 */
export function LiftNote({ note, onSave }: { note: string | undefined; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? '');
  useEffect(() => setText(note ?? ''), [note]);

  const done = () => {
    setEditing(false);
    if (text.trim() !== (note ?? '')) onSave(text);
  };

  if (editing) {
    return (
      <View style={styles.box}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={done}
          onSubmitEditing={done}
          autoFocus
          maxLength={NOTE_MAX}
          placeholder="Seat height, grip, cues…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          style={styles.input}
          accessibilityLabel="Note for this lift"
        />
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => setEditing(true)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={note ? `Note: ${note}. Edit note` : 'Add a note'}
      style={note ? styles.box : styles.link}
    >
      <Text style={note ? styles.text : styles.add}>{note ?? '+ Add a note'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { marginBottom: space.sm, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  link: { alignSelf: 'flex-start', marginBottom: space.sm },
  text: { color: colors.text, fontSize: 15 },
  add: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  input: { color: colors.text, fontSize: 15, padding: 0, minHeight: 22 },
});
