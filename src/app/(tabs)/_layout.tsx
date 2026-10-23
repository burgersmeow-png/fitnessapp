import { router } from 'expo-router';
import { Pressable, Text, type ColorValue } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { Tabs } from 'expo-router/js-tabs';
import { colors } from '../../lib/theme';

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', headerShown: false, tabBarIcon: icon('today') }} />
      <Tabs.Screen name="food" options={{ title: 'Food', tabBarIcon: icon('food') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', headerShown: false, tabBarIcon: icon('friends') }} />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: icon('history'),
          // The exercise library lives here so the tab bar keeps to five tabs.
          headerRight: () => (
            <Pressable onPress={() => router.push('/exercises')} accessibilityRole="button" hitSlop={10} style={{ marginRight: 16 }}>
              <Text style={{ color: colors.accent, fontSize: 17, fontWeight: '600' }}>Exercises</Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
