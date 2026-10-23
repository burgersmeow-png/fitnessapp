import type { SQLiteDatabase } from 'expo-sqlite';
import { productFromOff, type Product } from '../lib/barcode';
import { loadRecord, saveRecord } from '../lib/db';

// Overridable only so the flow can be tested against a stand-in.
const OFF = (process.env.EXPO_PUBLIC_OFF_URL ?? 'https://world.openfoodfacts.org').replace(/\/$/, '');
const FIELDS = 'product_name,generic_name,abbreviated_product_name,brands,serving_size,serving_quantity,nutriments';

export class BarcodeError extends Error {}

/**
 * Looks a barcode up in Open Food Facts, free and open. Products found once are kept on the phone,
 * so scanning the same thing again works offline. Returns null when the product isn't listed.
 */
export async function lookupBarcode(db: SQLiteDatabase, barcode: string): Promise<Product | null> {
  const key = `barcode:${barcode}`;
  const cached = await loadRecord<Product>(db, key);
  if (cached) return cached;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${OFF}/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
      // Open Food Facts asks apps to identify themselves.
      headers: { 'User-Agent': 'LiftLab/1.0 (iOS; in development)' },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new BarcodeError('The food database is busy. Try again in a moment.');
    const product = productFromOff(barcode, await res.json());
    if (product) await saveRecord(db, key, product);
    return product;
  } catch (error) {
    if (error instanceof BarcodeError) throw error;
    throw new BarcodeError('Couldn’t reach the food database. Check your connection, or add the food by hand.');
  } finally {
    clearTimeout(timeout);
  }
}
