import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type Svg from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CardContent } from '../lib/shareCard';
import { colors, radius, space, type } from '../lib/theme';
import { shareCardImage } from '../services/shareImage';
import { CARD_H, CARD_W, ShareCard } from './ShareCard';
import { Button } from './ui';

/** Full-screen preview of the share card with a button to post it. */
export function ShareCardSheet({
  content,
  onClose,
  title = 'Share your workout',
  fileName = 'liftlab-workout.png',
}: {
  content: CardContent | null;
  onClose: () => void;
  title?: string;
  fileName?: string;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ref = useRef<Svg>(null);
  const [status, setStatus] = useState<string | null>(null);
  // Fit the 9:16 card between the title and the buttons.
  const cardW = Math.min(width - 2 * space.xl, ((height - insets.top - insets.bottom - 220) * CARD_W) / CARD_H);

  const share = async () => {
    setStatus(null);
    try {
      const r = await shareCardImage(ref.current, 'liftlab-share-card', fileName);
      if (r === 'saved') setStatus('Saved. Post it from your photos or downloads.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not share the card.');
    }
  };

  return (
    <Modal visible={content != null} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.head}>
          <Text style={type.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.cardWrap} nativeID="liftlab-share-card">
          {content && <ShareCard ref={ref} content={content} width={cardW} />}
        </View>
        {status && <Text style={styles.status}>{status}</Text>}
        <Button title="Share image" onPress={share} style={{ marginHorizontal: space.md }} />
        <Text style={styles.hint}>Story-sized for Instagram and TikTok.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, marginBottom: space.md },
  close: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  cardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, overflow: 'hidden' },
  status: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: space.sm },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: space.sm },
});
