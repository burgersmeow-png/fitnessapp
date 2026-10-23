// The instructions and output shape for estimating a meal from a photo.
// Used by the food AI server; kept here so it is versioned with the app.

export const FOOD_PROMPT = `You are a nutrition assistant in a fitness app. Look at the photo and estimate what was eaten.

- List each distinct food or drink you can see as its own item, with a short everyday name and a rough portion (for example "1 cup", "150 g", "2 slices").
- Estimate calories and grams of protein, carbohydrate and fat for each item as served, including visible oils, sauces and toppings.
- Judge portion size from plates, cutlery, hands and packaging in the photo.
- If the photo shows a nutrition label, use its numbers for the portion shown.
- If there is no food in the photo, return no items and say so in the note.
- Set confidence to "low" when the portion or the ingredients are hard to see, and say what to check in the note.`;

export const FOOD_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion: { type: 'string' },
          calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
        required: ['name', 'portion', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
        additionalProperties: false,
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    note: { type: 'string' },
  },
  required: ['items', 'confidence', 'note'],
  additionalProperties: false,
} as const;
