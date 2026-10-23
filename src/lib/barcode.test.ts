import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemForGrams, normalizeBarcode, productFromOff } from './barcode';

test('barcodes are checked with their check digit', () => {
  assert.equal(normalizeBarcode('3017624010701'), '3017624010701'); // EAN-13
  assert.equal(normalizeBarcode(' 3017-6240-10701 '), '3017624010701');
  assert.equal(normalizeBarcode('3017624010702'), null);
  assert.equal(normalizeBarcode('036000291452'), '036000291452'); // UPC-A
  assert.equal(normalizeBarcode('96385074'), '96385074'); // EAN-8
  assert.equal(normalizeBarcode('12345'), null);
});

const spread = {
  status: 1,
  product: {
    product_name: 'Nutella',
    brands: 'Ferrero, Nutella',
    serving_size: '15 g',
    serving_quantity: '15',
    nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
  },
};

test('an Open Food Facts product is read per 100 g with its serving', () => {
  const p = productFromOff('3017624010701', spread)!;
  assert.deepEqual(p, {
    barcode: '3017624010701',
    name: 'Nutella',
    brand: 'Ferrero',
    per100g: { calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
    servingGrams: 15,
    servingLabel: '15 g',
  });
  assert.deepEqual(itemForGrams(p, 15, '1 serving (15 g)'), {
    name: 'Nutella (Ferrero)', portion: '1 serving (15 g)', calories: 81, protein: 0.9, carbs: 8.6, fat: 4.6,
  });
});

test('energy in kJ only, missing names and missing products are handled', () => {
  const kj = productFromOff('1', { status: 1, product: { brands: 'Acme', nutriments: { energy_100g: 1674, proteins_100g: 10, carbohydrates_100g: '60,5', fat_100g: 8 } } })!;
  assert.equal(kj.per100g.calories, 400);
  assert.equal(kj.per100g.carbs, 60.5);
  assert.equal(kj.name, 'Acme product');
  assert.equal(kj.servingGrams, null);
  assert.equal(productFromOff('1', { status: 0, status_verbose: 'product not found' }), null);
  assert.equal(productFromOff('1', { status: 1, product: { product_name: 'Mystery', nutriments: {} } }), null);
});
