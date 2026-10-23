import { StyleSheet, Text, View } from 'react-native';
import { avatarHue, initials, type Profile } from '../../lib/social';

export function Avatar({ profile, size = 40 }: { profile: Profile; size?: number }) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${avatarHue(profile.id)}, 55%, 42%)` }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(profile.displayName)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '800' },
});
