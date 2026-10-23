import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform, type ColorValue } from 'react-native';

/** Icons by meaning: SF Symbols on iOS, matching Ionicons elsewhere (Android, web preview). */
const ICONS = {
  today: { sf: 'bolt.fill', ion: 'flash' },
  history: { sf: 'calendar', ion: 'calendar' },
  exercises: { sf: 'dumbbell.fill', ion: 'barbell' },
  settings: { sf: 'slider.horizontal.3', ion: 'options' },
  play: { sf: 'play.fill', ion: 'play' },
  pause: { sf: 'pause.fill', ion: 'pause' },
  shuffle: { sf: 'shuffle', ion: 'shuffle' },
  time: { sf: 'clock', ion: 'time-outline' },
  sets: { sf: 'square.stack.3d.up', ion: 'layers-outline' },
  goal: { sf: 'flag', ion: 'flag-outline' },
  barbell: { sf: 'dumbbell', ion: 'barbell-outline' },
  chevron: { sf: 'chevron.right', ion: 'chevron-forward' },
  flame: { sf: 'flame.fill', ion: 'flame' },
  trophy: { sf: 'trophy.fill', ion: 'trophy' },
  pulse: { sf: 'waveform.path.ecg', ion: 'pulse' },
  add: { sf: 'plus.circle.fill', ion: 'add-circle' },
  copy: { sf: 'arrow.uturn.down', ion: 'return-down-forward' },
  check: { sf: 'checkmark', ion: 'checkmark' },
  warning: { sf: 'exclamationmark.triangle.fill', ion: 'warning' },
  run: { sf: 'figure.run', ion: 'walk' },
  walk: { sf: 'figure.walk', ion: 'footsteps' },
  ride: { sf: 'figure.outdoor.cycle', ion: 'bicycle' },
  row: { sf: 'figure.rower', ion: 'boat' },
  swim: { sf: 'figure.pool.swim', ion: 'water' },
  elliptical: { sf: 'figure.elliptical', ion: 'sync' },
  intervals: { sf: 'bolt.heart.fill', ion: 'flash' },
  food: { sf: 'fork.knife', ion: 'restaurant' },
  mic: { sf: 'mic.fill', ion: 'mic' },
  camera: { sf: 'camera.fill', ion: 'camera' },
  photos: { sf: 'photo.on.rectangle', ion: 'images' },
  search: { sf: 'magnifyingglass', ion: 'search' },
  trash: { sf: 'trash', ion: 'trash-outline' },
  sparkles: { sf: 'sparkles', ion: 'sparkles' },
  close: { sf: 'xmark', ion: 'close' },
} as const satisfies Record<string, { sf: SFSymbol; ion: keyof typeof Ionicons.glyphMap }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  const { sf, ion } = ICONS[name];
  const fallback = <Ionicons name={ion} size={size} color={color as string} />;
  if (Platform.OS !== 'ios') return fallback;
  return (
    <SymbolView
      name={sf}
      size={size}
      tintColor={color as string}
      type="hierarchical"
      fallback={fallback}
      style={{ width: size, height: size }}
    />
  );
}
