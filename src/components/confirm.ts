import { Alert, Platform } from 'react-native';

/** Asks before doing something. Web previews have no Alert buttons, so they use the browser's confirm. */
export function confirm(title: string, message: string, action: string, run: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) run();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, onPress: run, style: destructive ? 'destructive' : 'default' },
  ]);
}
