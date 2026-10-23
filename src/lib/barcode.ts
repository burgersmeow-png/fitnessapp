// Packaged food by barcode, from Open Food Facts (openfoodfacts.org, data under the Open Database
// Licence). Pure: parsing and maths only; the lookup lives in src/services/barcode.ts.
import type { FoodItem, Macros } from './nutrition';

export interface Product {
  barcode: string;
  name: string;
  brand: string | null;
  per100g: Macros;
  /** Grams in one serving as printed on the pack, when known. */
  servingGrams: number | null;
  servingLabel: string | null;
}

/** Digits only, and a valid EAN-8, UPC-A, EAN-13 or GTIN-14 check digit; otherwise null. */
export function normalizeBarcode(raw: string): string | null {
  const code = raw.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(code.length)) return null;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // Weights 3,1,3,1… counted from the digit next to the check digit.
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? code : null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const KJ_PER_KCAL = 4.184;

/** Reads an Open Food Facts v2 product response. Null when the product or its nutrition is missing. */
export function productFromOff(barcode: string, json: unknown): Product | null {
  const body = json as { status?: number; product?: Record<string, unknown> } | null;
  const p = body?.product;
  if (!p || body?.status === 0) return null;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  let calories = num(n['energy-kcal_100g']);
  if (calories == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
    if (kj != null) calories = kj / KJ_PER_KCAL;
  }
  if (calories == null && protein != null && carbs != null && fat != null) calories = protein * 4 + carbs * 4 + fat * 9;
  if (calories == null) return null;

  const name = [p.product_name, p.generic_name, p.abbreviated_product_name].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const brand = typeof p.brands === 'string' && p.brands.trim() ? p.brands.split(',')[0].trim() : null;
  const servingGrams = num(p.serving_quantity);
  return {
    barcode,
    name: name?.trim() ?? (brand ? `${brand} product` : 'Packaged food'),
    brand,
    per100g: { calories: Math.round(calories), protein: round1(protein ?? 0), carbs: round1(carbs ?? 0), fat: round1(fat ?? 0) },
    servingGrams: servingGrams && servingGrams > 0 && servingGrams < 2000 ? servingGrams : null,
    servingLabel: typeof p.serving_size === 'string' && p.serving_size.trim() ? p.serving_size.trim() : null,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The food to log for `grams` of a product. */
export function itemForGrams(product: Product, grams: number, portion = `${round1(grams)} g`): FoodItem {
  const f = grams / 100;
  return {
    name: product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.name} (${product.brand})` : product.name,
    portion,
    calories: Math.round(product.per100g.calories * f),
    protein: round1(product.per100g.protein * f),
    carbs: round1(product.per100g.carbs * f),
    fat: round1(product.per100g.fat * f),
  };
}
