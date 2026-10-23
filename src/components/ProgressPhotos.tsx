import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addProgressPhoto, deleteProgressPhoto } from '../lib/db';
import { beforeAfter, type ProgressPhoto } from '../lib/progressPhotos';
import { colors, radius, space } from '../lib/theme';
import { confirm } from './confirm';
import { Icon } from './Icon';
import { Card } from './ui';

/**
 * Progress photos: a row of thumbnails, a way to add one, and the before-and-after share.
 * Photos are kept in the app's own database on the phone and are never uploaded.
 */
export function ProgressPhotos({ photos, onChange, onShare }: { photos: ProgressPhoto[]; onChange: () => void; onShare: () => void }) {
  const db = useSQLiteContext();
  const [error, setError] = useState<string | null>(null);
  const pair = beforeAfter(photos);

  const pick = async (fromCamera: boolean) => {
    setError(null);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.35, base64: true, allowsEditing: true, aspect: [3, 4] };
    if (fromCamera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      setError('Camera access is off. You can turn it on in Settings, or choose a photo instead.');
      return;
    }
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    await addProgressPhoto(db, `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    onChange();
  };

  const add = () => {
    if (Platform.OS === 'web') return pick(false);
    Alert.alert('Add a progress photo', 'Same spot, same light and same pose each time makes the change easy to see.', [
      { text: 'Take photo', onPress: () => pick(true) },
      { text: 'Choose from library', onPress: () => pick(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const remove = (p: ProgressPhoto) =>
    confirm('Delete this photo?', 'It’s only stored on this phone, so it can’t be brought back.', 'Delete', async () => {
      await deleteProgressPhoto(db, p.id);
      onChange();
    }, true);

  return (
    <Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Add a progress photo" style={({ pressed }) => [styles.tile, styles.add, pressed && { opacity: 0.8 }]}>
          <Icon name="add" size={26} color={colors.accent} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
        {[...photos].reverse().map((p) => {
          const day = new Date(p.takenAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <Pressable key={p.id} onPress={() => remove(p)} accessibilityRole="button" accessibilityLabel={`Progress photo from ${day}. Tap to delete`}>
              <Image source={{ uri: p.uri }} style={styles.tile} />
              <Text style={styles.date}>{day}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.note}>
        {photos.length === 0
          ? 'A photo every few weeks shows changes the scale misses. They stay on this phone.'
          : pair
            ? 'Only on this phone. Tap a photo to delete it.'
            : 'Add another on a later day to make a before and after.'}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {pair && (
        <Pressable onPress={onShare} accessibilityRole="button" style={({ pressed }) => [styles.share, pressed && { opacity: 0.8 }]}>
          <Icon name="share" size={18} color={colors.accent} />
          <Text style={styles.shareText}>Share before & after</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { width: 96, height: 128, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  addText: { color: colors.accent, fontWeight: '700', marginTop: space.xs },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: space.sm },
  error: { color: colors.warning, fontSize: 14, marginTop: space.xs },
  share: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  shareText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
});
