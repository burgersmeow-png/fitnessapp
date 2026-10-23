import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space } from '../lib/theme';

/**
 * The coach's input. Speech comes from the iPhone keyboard's dictation mic, which works in Expo Go;
 * always-on listening needs a development build with a native speech module.
 */
export function CoachBar({
  reply,
  examples,
  placeholder,
  onSubmit,
}: {
  reply: string | null;
  examples: string[];
  placeholder: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const submit = (value: string) => {
    if (!value.trim()) return;
    onSubmit(value);
    setText('');
  };
  return (
    <View style={styles.coach}>
      <TextInput
        style={styles.coachInput}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => submit(text)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="send"
        autoFocus
        accessibilityLabel="Coach command. Use the keyboard microphone to speak."
      />
      {reply ? (
        <Text style={styles.coachReply} accessibilityLiveRegion="polite">
          {reply}
        </Text>
      ) : (
        <Text style={styles.coachHint}>Tap the mic on your keyboard and speak.</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: space.sm }}>
        {examples.map((e) => (
          <Pressable key={e} onPress={() => submit(e)} style={styles.coachChip} accessibilityRole="button">
            <Text style={styles.coachChipText}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  coach: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  coachInput: { minHeight: 44, color: colors.text, fontSize: 18, fontWeight: '600' },
  coachReply: { color: colors.success, fontSize: 15, fontWeight: '600', marginTop: space.xs },
  coachHint: { color: colors.textMuted, fontSize: 14, marginTop: space.xs },
  coachChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    marginRight: space.sm,
  },
  coachChipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
