import { Platform, Share } from 'react-native';

/**
 * Opens the share sheet with a link. Browsers without a share sheet copy it instead.
 * Returns 'copied' when it went to the clipboard.
 */
export async function shareLink(message: string, url: string): Promise<'shared' | 'copied'> {
  if (Platform.OS !== 'web') {
    // iOS shows the url as its own item; Android only shares the message text.
    await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message} ${url}` });
    return 'shared';
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message, url });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'shared';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
