import * as Speech from 'expo-speech';

/** Speaks a short coach reply, cutting off anything still being said. */
export function say(text: string): void {
  Speech.stop()
    .catch(() => {})
    .finally(() => Speech.speak(text, { language: 'en', rate: 1.02 }));
}
