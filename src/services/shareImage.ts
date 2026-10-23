import { Platform, Share } from 'react-native';
import type Svg from 'react-native-svg';
import { CARD_H, CARD_W } from '../components/ShareCard';

/**
 * Turns the share card into a PNG and hands it to the system share sheet, so it can go
 * straight to an Instagram or TikTok story, Messages, or Photos. In a browser without file
 * sharing, the PNG downloads instead. Returns what happened.
 */
export async function shareCardImage(svg: Svg | null, domId: string, fileName: string): Promise<'shared' | 'saved' | 'cancelled'> {
  if (Platform.OS !== 'web') {
    if (!svg) throw new Error('Share card is not ready');
    const base64 = await new Promise<string>((resolve) => svg.toDataURL(resolve, { width: CARD_W, height: CARD_H }));
    const result = await Share.share({ url: `data:image/png;base64,${base64}` });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  }

  const el = document.getElementById(domId)?.querySelector('svg');
  if (!el) throw new Error('Share card is not ready');
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(CARD_W));
  clone.setAttribute('height', String(CARD_H));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not draw the share card'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the image'))), 'image/png'));
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    return 'saved';
  } finally {
    URL.revokeObjectURL(url);
  }
}
