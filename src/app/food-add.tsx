import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeScan } from '../components/BarcodeScan';
import { Icon } from '../components/Icon';
import { MacroLine } from '../components/Nutrition';
import { Button, Card, Chip, SectionLabel } from '../components/ui';
import { saveFood } from '../lib/db';
import { formatNumber } from '../lib/format';
import {
  COMMON_FOODS,
  MEAL_LABELS,
  MEALS,
  mealForTime,
  scaleItem,
  sumMacros,
  type FoodItem,
  type FoodEntry,
  type Meal,
  type PhotoEstimate,
} from '../lib/nutrition';
import { colors, radius, space, type } from '../lib/theme';
import { estimatePhoto, FoodAiError, foodAiConfigured } from '../services/foodAi';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/food');
}

/** A food in the meal being logged, scaled by how many servings were eaten. */
interface DraftItem {
  key: number;
  base: FoodItem;
  servings: number;
}
const TABS = {
  photo: { label: 'Photo', icon: 'camera' },
  scan: { label: 'Scan', icon: 'barcode' },
  search: { label: 'Search', icon: 'search' },
} as const;

let nextKey = 1;
const draftOf = (base: FoodItem): DraftItem => ({ key: nextKey++, base, servings: 1 });

type PhotoState =
  | { status: 'idle' }
  | { status: 'estimating'; uri: string }
  | { status: 'done'; uri: string; estimate: PhotoEstimate }
  | { status: 'error'; uri?: string; message: string };

export default function AddFoodScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [tab, setTab] = useState<'photo' | 'scan' | 'search'>(mode === 'photo' ? 'photo' : mode === 'scan' ? 'scan' : 'search');
  const [meal, setMeal] = useState<Meal>(mealForTime(new Date()));
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [source, setSource] = useState<FoodEntry['source']>('quick');
  const [photo, setPhoto] = useState<PhotoState>({ status: 'idle' });
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  const items = draft.map((d) => scaleItem(d.base, d.servings));
  const total = sumMacros(items);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COMMON_FOODS.filter((f) => f.name.toLowerCase().includes(q)) : COMMON_FOODS;
  }, [query]);

  const pick = async (fromCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.4, base64: true };
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setPhoto({ status: 'error', message: 'Camera access is off. You can turn it on in Settings, or choose a photo instead.' });
        return;
      }
    }
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    setPhoto({ status: 'estimating', uri: asset.uri });
    try {
      const estimate = await estimatePhoto(asset.base64, asset.mimeType ?? 'image/jpeg');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhoto({ status: 'done', uri: asset.uri, estimate });
      setDraft(estimate.items.map(draftOf));
      setSource('photo');
    } catch (error) {
      setPhoto({ status: 'error', uri: asset.uri, message: error instanceof FoodAiError ? error.message : 'Something went wrong.' });
    }
  };

  const addQuick = (food: FoodItem) => {
    Haptics.selectionAsync();
    setDraft((d) => [...d, draftOf(food)]);
    if (source !== 'photo') setSource('quick');
  };

  const addCustom = () => {
    const n = (s: string) => Math.max(0, Number(s) || 0);
    if (!custom.name.trim()) return;
    const protein = n(custom.protein), carbs = n(custom.carbs), fat = n(custom.fat);
    const calories = n(custom.calories) || Math.round(protein * 4 + carbs * 4 + fat * 9);
    setDraft((d) => [...d, draftOf({ name: custom.name.trim(), portion: '1 serving', calories, protein, carbs, fat })]);
    setCustom({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    setSource('manual');
  };

  const setServings = (key: number, servings: number) =>
    setDraft((d) => d.map((x) => (x.key === key ? { ...x, servings: Math.max(0.5, Math.round(servings * 2) / 2) } : x)));
  const removeItem = (key: number) => setDraft((d) => d.filter((x) => x.key !== key));

  const save = async () => {
    if (draft.length === 0) return;
    await saveFood(db, items, meal, source);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={styles.headerLink}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Log food</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={styles.segment} accessibilityRole="tablist">
          {(['photo', 'scan', 'search'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.segmentItem, tab === t && styles.segmentOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
              <Icon name={TABS[t].icon} size={16} color={tab === t ? colors.text : colors.textMuted} />
              <Text style={[styles.segmentText, tab === t && { color: colors.text }]}>{TABS[t].label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'photo' && (
          <View style={{ marginTop: space.md }}>
            {photo.status === 'idle' && (
              <Card style={{ alignItems: 'center', paddingVertical: space.lg }}>
                <Icon name="sparkles" size={30} color={colors.accent} />
                <Text style={[type.title, { marginTop: space.sm, textAlign: 'center' }]}>Snap it, we&apos;ll count it</Text>
                <Text style={styles.muted}>
                  Take a photo of your plate and get calories, protein, carbs and fat in seconds. You can adjust anything before saving.
                </Text>
                {!foodAiConfigured && (
                  <Text style={[styles.muted, { color: colors.warning }]}>
                    Photo estimates need the food AI server, which isn&apos;t connected in this build yet.
                  </Text>
                )}
              </Card>
            )}
            {'uri' in photo && photo.uri && <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Your meal photo" />}
            {photo.status === 'estimating' && (
              <View style={styles.estimating} accessibilityLiveRegion="polite">
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.estimatingText}>Working out what&apos;s on your plate…</Text>
              </View>
            )}
            {photo.status === 'error' && <Text style={[styles.muted, { color: colors.warning }]}>{photo.message}</Text>}
            {photo.status === 'done' && (
              <View style={[styles.banner, photo.estimate.confidence === 'low' && { borderColor: colors.warning }]}>
                <Text style={styles.bannerText}>
                  {photo.estimate.items.length === 0
                    ? photo.estimate.note || 'No food found in this photo.'
                    : `${photo.estimate.confidence === 'high' ? 'Good' : photo.estimate.confidence === 'low' ? 'Rough' : 'Fair'} estimate. Check the portions below.${photo.estimate.note ? ` ${photo.estimate.note}` : ''}`}
                </Text>
              </View>
            )}
            <View style={styles.photoButtons}>
              <Button title={photo.status === 'idle' ? 'Take photo' : 'Retake'} onPress={() => pick(true)} style={{ flex: 1 }} />
              <Button title="Choose photo" variant="secondary" onPress={() => pick(false)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {tab === 'scan' && (
          <BarcodeScan
            onAdd={(item) => {
              setDraft((d) => [...d, draftOf(item)]);
              if (source !== 'photo') setSource('barcode');
            }}
          />
        )}

        {tab === 'search' && (
          <View style={{ marginTop: space.md }}>
            <TextInput
              style={styles.search}
              placeholder="Search foods"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search foods"
              clearButtonMode="while-editing"
            />
            <Card style={{ marginTop: space.sm, paddingVertical: space.xs }}>
              {results.slice(0, 12).map((f, i) => (
                <Pressable
                  key={f.name}
                  onPress={() => addQuick(f)}
                  style={[styles.result, i > 0 && styles.divider]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${f.name}, ${f.portion}, ${f.calories} calories`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{f.name}</Text>
                    <Text style={styles.itemMeta}>
                      {f.portion} · {f.calories} kcal
                    </Text>
                  </View>
                  <Icon name="add" size={26} color={colors.accent} />
                </Pressable>
              ))}
              {results.length === 0 && <Text style={[styles.muted, { padding: space.sm }]}>No match. Add it by hand below.</Text>}
            </Card>

            <SectionLabel>Add by hand</SectionLabel>
            <Card>
              <TextInput
                style={styles.field}
                placeholder="Food name"
                placeholderTextColor={colors.textMuted}
                value={custom.name}
                onChangeText={(name) => setCustom((c) => ({ ...c, name }))}
                accessibilityLabel="Food name"
              />
              <View style={styles.fieldRow}>
                {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
                  <TextInput
                    key={k}
                    style={[styles.field, styles.fieldSmall]}
                    placeholder={k === 'calories' ? 'kcal' : `${k[0].toUpperCase()}${k.slice(1)} g`}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={custom[k]}
                    onChangeText={(v) => setCustom((c) => ({ ...c, [k]: v }))}
                    accessibilityLabel={k === 'calories' ? 'Calories' : `${k} in grams`}
                  />
                ))}
              </View>
              <Button title="Add" variant="secondary" onPress={addCustom} style={{ marginTop: space.sm }} />
            </Card>
          </View>
        )}

        {draft.length > 0 && (
          <>
            <SectionLabel>Your meal</SectionLabel>
            <Card style={{ paddingVertical: space.xs }}>
              {draft.map((d, i) => (
                <DraftRow
                  key={d.key}
                  item={items[i]}
                  servings={d.servings}
                  first={i === 0}
                  onServings={(s) => setServings(d.key, s)}
                  onRemove={() => removeItem(d.key)}
                />
              ))}
            </Card>
            <SectionLabel>Meal</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {MEALS.map((m) => (
                <Chip key={m} label={MEAL_LABELS[m]} selected={meal === m} onPress={() => setMeal(m)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {draft.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={[type.number, { fontSize: 22 }]}>{formatNumber(total.calories)} kcal</Text>
            <MacroLine m={total} />
          </View>
          <Button title={`Save to ${MEAL_LABELS[meal].toLowerCase()}`} onPress={save} />
        </View>
      )}
    </View>
  );
}

/** One food in the meal being logged: adjust servings, or remove it. */
function DraftRow({
  item,
  servings,
  first,
  onServings,
  onRemove,
}: {
  item: FoodItem;
  servings: number;
  first: boolean;
  onServings: (s: number) => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.result, !first && styles.divider]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemMeta}>
          {item.portion} · {Math.round(item.calories)} kcal
        </Text>
        <MacroLine m={item} />
      </View>
      <View style={styles.stepper}>
        <Pressable onPress={() => onServings(servings - 0.5)} hitSlop={8} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Less ${item.name}`}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue} accessibilityLabel={`${servings} servings`}>
          {servings}×
        </Text>
        <Pressable onPress={() => onServings(servings + 0.5)} hitSlop={8} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`More ${item.name}`}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
        <Icon name="trash" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md, paddingBottom: space.sm },
  headerLink: { color: colors.textMuted, fontSize: 17 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segmentOn: { backgroundColor: colors.surfaceRaised },
  segmentText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: space.sm, lineHeight: 21 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  estimating: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.md },
  estimatingText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  banner: { marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  bannerText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  photoButtons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  search: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, fontSize: 17, paddingHorizontal: space.md },
  result: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, gap: space.md, minHeight: 52 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  itemMeta: { color: colors.textMuted, fontSize: 13, marginVertical: 2 },
  field: { minHeight: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text, fontSize: 16, paddingHorizontal: space.sm },
  fieldRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  fieldSmall: { flex: 1, minWidth: 0, flexBasis: 0, textAlign: 'center', paddingHorizontal: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  stepValue: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.md,
    padding: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
