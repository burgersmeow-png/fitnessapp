import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/ui';
import { timeAgo } from '../../lib/social';
import { colors, radius, space } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';
import { loadMessages, sendMessage } from '../../services/coaching';
import { myId, SocialError } from '../../services/social';

/** Messages between a coach and one client. Checks for new ones every 15 seconds while open. */
export default function ChatScreen() {
  const { coach, client, name } = useLocalSearchParams<{ coach: string; client: string; name: string }>();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [data, reload] = useFocusData(async () => ({ me: await myId(), messages: await loadMessages(coach, client) }), [coach, client]);

  useEffect(() => {
    const t = setInterval(reload, 15_000);
    return () => clearInterval(t);
  }, [reload]);

  if (!data) return <Loading />;

  const send = async () => {
    if (!text.trim()) return;
    const value = text;
    setText('');
    setNote(null);
    try {
      await sendMessage(coach, client, value);
      reload();
    } catch (e) {
      setText(value);
      setNote(e instanceof SocialError ? e.message : 'Couldn’t send. Try again.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={styles.screen}>
      <Stack.Screen options={{ title: name ?? 'Messages' }} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.md }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {data.messages.length === 0 && <Text style={styles.empty}>No messages yet. Say hello.</Text>}
        {data.messages.map((m) => {
          const mine = m.sender === data.me;
          return (
            <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.text, mine && { color: colors.accentText }]}>{m.text}</Text>
              <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.75)' }]}>{timeAgo(m.createdAt)}</Text>
            </View>
          );
        })}
        {note && <Text style={styles.note}>{note}</Text>}
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: insets.bottom + space.sm }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          accessibilityLabel="Message"
        />
        <Pressable onPress={send} accessibilityRole="button" accessibilityLabel="Send message" hitSlop={8}>
          <Icon name="send" size={32} color={text.trim() ? colors.accent : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  empty: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: space.xl },
  bubble: { maxWidth: '80%', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised },
  text: { color: colors.text, fontSize: 16, lineHeight: 21 },
  time: { color: colors.textMuted, fontSize: 11, marginTop: 2, alignSelf: 'flex-end' },
  note: { color: colors.warning, fontSize: 14, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text, fontSize: 16, paddingHorizontal: space.md, paddingTop: 12 },
});
