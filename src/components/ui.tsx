import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, space, TAP, type } from '../lib/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'secondary' && { backgroundColor: colors.surfaceRaised },
        variant === 'danger' && { backgroundColor: 'transparent', borderColor: colors.danger, borderWidth: 1 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'danger' && { color: colors.danger }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

/** Shown while a screen's data loads, instead of a blank screen. */
export function Loading() {
  return (
    <View style={styles.centered} accessibilityLabel="Loading">
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

/** A friendly failure with a way out, never a raw error. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.centered, { padding: space.lg }]}>
      <Text style={[type.title, { textAlign: 'center' }]}>Something went wrong</Text>
      <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', marginTop: space.sm }]}>{message}</Text>
      {onRetry && <Button title="Try again" onPress={onRetry} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>{String(children).toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  button: {
    minHeight: TAP,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonText: { color: colors.accentText, fontSize: 17, fontWeight: '700' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  // Bold so white on the accent meets WCAG AA for large text (3:1).
  chipText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
