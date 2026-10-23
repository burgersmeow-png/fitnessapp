import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { CalorieRing, MACRO_COLORS, MacroBar, MacroLine } from '../../components/Nutrition';
import { Card, Loading, SectionLabel } from '../../components/ui';
import { deleteFood, loadFoodForDay, loadSettings } from '../../lib/db';
import { formatNumber } from '../../lib/format';
import { dailyTargets, MEAL_LABELS, MEALS, sumMacros, type FoodEntry } from '../../lib/nutrition';
import { colors, radius, space, TAP, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';

export default function FoodScreen() {
  const db = useSQLiteContext();
  const [data, reload] = useFocusData(async () => {
    const [entries, settings] = await Promise.all([loadFoodForDay(db, new Date()), loadSettings(db)]);
    return { entries, settings };
  });
  if (!data) return <Loading />;

  const { entries, settings } = data;
  const target = dailyTargets(settings.bodyWeightKg, settings.nutritionGoal, settings.goal);
  const eaten = sumMacros(entries);

  const remove = (entry: FoodEntry) => {
    const doIt = async () => {
      await deleteFood(db, entry.id);
      reload();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${entry.name}?`)) doIt();
    } else {
      Alert.alert(`Remove ${entry.name}?`, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <Card style={styles.summary}>
        <CalorieRing eaten={eaten.calories} target={target.calories} />
        <View style={{ flex: 1, marginLeft: space.lg }}>
          <Text style={type.label}>EATEN</Text>
          <Text style={[type.number, { fontSize: 24 }]}>{formatNumber(eaten.calories)}</Text>
          <Text style={[type.label, { marginTop: space.sm }]}>TARGET</Text>
          <Text style={[type.number, { fontSize: 24 }]}>{formatNumber(target.calories)}</Text>
        </View>
      </Card>
      <Card style={{ marginTop: space.md }}>
        <MacroBar label="Protein" eaten={eaten.protein} target={target.protein} color={MACRO_COLORS.protein} />
        <MacroBar label="Carbs" eaten={eaten.carbs} target={target.carbs} color={MACRO_COLORS.carbs} />
        <MacroBar label="Fat" eaten={eaten.fat} target={target.fat} color={MACRO_COLORS.fat} />
        {settings.bodyWeightKg == null && (
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button">
            <Text style={styles.hint}>Add your body weight in Settings for personal targets ›</Text>
          </Pressable>
        )}
      </Card>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/food-add?mode=photo')}
          accessibilityRole="button"
          accessibilityHint="Take a photo of your meal and get calories and macros"
        >
          <Icon name="camera" size={22} color={colors.accentText} />
          <Text style={[styles.actionText, { color: colors.accentText }]}>Snap a meal</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, styles.actionSmall, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/food-add?mode=scan')}
          accessibilityRole="button"
          accessibilityLabel="Scan a barcode"
        >
          <Icon name="barcode" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/food-add?mode=search')}
          accessibilityRole="button"
        >
          <Icon name="search" size={20} color={colors.text} />
          <Text style={styles.actionText}>Add food</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="food" size={36} color={colors.textMuted} />
          <Text style={[type.title, { marginTop: space.sm, textAlign: 'center' }]}>Nothing logged yet today</Text>
          <Text style={styles.emptyText}>
            Snap a photo of your next meal and we&apos;ll work out the calories and protein for you.
          </Text>
        </View>
      ) : (
        MEALS.map((meal) => {
          const items = entries.filter((e) => e.meal === meal);
          if (items.length === 0) return null;
          const total = sumMacros(items);
          return (
            <View key={meal}>
              <View style={styles.mealHeader}>
                <SectionLabel>{MEAL_LABELS[meal]}</SectionLabel>
                <Text style={styles.mealTotal}>{formatNumber(total.calories)} kcal</Text>
              </View>
              <Card style={{ paddingVertical: space.xs }}>
                {items.map((e, i) => (
                  <Pressable
                    key={e.id}
                    onLongPress={() => remove(e)}
                    style={[styles.entry, i > 0 && styles.divider]}
                    accessibilityLabel={`${e.name}, ${e.portion}, ${Math.round(e.calories)} calories`}
                    accessibilityHint="Long press to remove"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryName}>
                        {e.source === 'photo' && <Icon name="sparkles" size={13} color={colors.accent} />} {e.name}
                      </Text>
                      <Text style={styles.entryMeta}>{e.portion}</Text>
                      <MacroLine m={e} />
                    </View>
                    <Text style={styles.entryKcal}>{Math.round(e.calories)}</Text>
                    <Pressable onPress={() => remove(e)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${e.name}`}>
                      <Icon name="trash" size={18} color={colors.textMuted} />
                    </Pressable>
                  </Pressable>
                ))}
              </Card>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  summary: { flexDirection: 'row', alignItems: 'center' },
  hint: { color: colors.accent, fontSize: 14, fontWeight: '600', marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  action: {
    flex: 1,
    minHeight: TAP,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  actionPrimary: { backgroundColor: colors.accent },
  actionSmall: { flexGrow: 0, flexShrink: 0, flexBasis: 56, paddingHorizontal: 0 },
  actionText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: space.xs, lineHeight: 21 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mealTotal: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: space.sm },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entryName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  entryMeta: { color: colors.textMuted, fontSize: 13, marginVertical: 2 },
  entryKcal: { color: colors.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
