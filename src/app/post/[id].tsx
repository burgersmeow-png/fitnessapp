import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Avatar } from '../../components/social/Avatar';
import { FeedCard } from '../../components/social/FeedCard';
import { Loading } from '../../components/ui';
import { timeAgo } from '../../lib/social';
import { colors, radius, space, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';
import { addComment, deleteComment, deletePost, loadComments, loadPost, setHighFive, SocialError } from '../../services/social';
import { supabase } from '../../services/supabase';

/** A shared session with its comments. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [data, reload] = useFocusData(async () => {
    const [{ data: s }, post, comments] = await Promise.all([supabase.auth.getSession(), loadPost(postId), loadComments(postId)]);
    return { me: s.session?.user.id ?? '', post, comments };
  }, [postId]);

  if (!data) return <Loading />;
  const { me, post, comments } = data;

  const run = async (work: () => Promise<void>) => {
    setNote(null);
    try {
      await work();
      reload();
    } catch (e) {
      setNote(e instanceof SocialError ? e.message : 'Something went wrong. Try again.');
    }
  };

  const send = () => {
    if (!text.trim()) return;
    const value = text;
    setText('');
    run(() => addComment(postId, value));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <Text style={type.title}>Comments</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <Icon name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
        {post ? (
          <FeedCard post={post} me={me} detail onHighFive={(on) => run(() => setHighFive(post.id, on))} />
        ) : (
          <Text style={styles.muted}>This post was removed.</Text>
        )}
        {comments.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Avatar profile={c.author} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={styles.author}>
                {c.author.id === me ? 'You' : c.author.displayName} <Text style={styles.muted}>· {timeAgo(c.createdAt)}</Text>
              </Text>
              <Text style={styles.text}>{c.text}</Text>
            </View>
            {(c.author.id === me || post?.author.id === me) && (
              <Pressable onPress={() => run(() => deleteComment(c.id))} accessibilityRole="button" accessibilityLabel="Delete comment" hitSlop={10}>
                <Icon name="trash" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        ))}
        {comments.length === 0 && post && <Text style={styles.muted}>No comments yet. Say something encouraging.</Text>}
        {note && <Text style={styles.note}>{note}</Text>}
        {post?.author.id === me && (
          <Pressable onPress={() => run(async () => { await deletePost(post.id); router.back(); })} accessibilityRole="button" style={{ marginTop: space.xl, alignSelf: 'center' }}>
            <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '600' }}>Remove from feed</Text>
          </Pressable>
        )}
      </ScrollView>
      {post && (
        <View style={[styles.composer, { paddingBottom: insets.bottom + space.sm }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Add a comment"
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            onSubmitEditing={send}
            returnKeyType="send"
            accessibilityLabel="Add a comment"
          />
          <Pressable onPress={send} accessibilityRole="button" accessibilityLabel="Send comment" hitSlop={8}>
            <Icon name="send" size={32} color={text.trim() ? colors.accent : colors.textMuted} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md },
  muted: { color: colors.textMuted, fontSize: 14 },
  note: { color: colors.warning, fontSize: 15, marginTop: space.sm },
  comment: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, alignItems: 'flex-start' },
  author: { color: colors.text, fontSize: 14, fontWeight: '700' },
  text: { color: colors.text, fontSize: 16, marginTop: 2, lineHeight: 21 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: { flex: 1, minHeight: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text, fontSize: 16, paddingHorizontal: space.md },
});
