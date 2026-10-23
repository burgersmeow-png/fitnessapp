// Food logging: daily targets, totals, and cleaning up AI photo estimates.
// Pure TypeScript so it is shared by the app, the food AI server and tests.
import type { Goal, Settings } from './types';

export type NutritionGoal = Settings['nutritionGoal'];
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem extends Macros {
  name: string;
  /** Rough portion, e.g. "1 cup" or "150 g". */
  portion: string;
}

export interface FoodEntry extends FoodItem {
  id: number;
  eatenAt: string;
  meal: Meal;
  source: 'photo' | 'quick' | 'manual' | 'barcode';
}

export const DEFAULT_BODY_WEIGHT_KG = 75;

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Daily calorie and macro targets. Maintenance is estimated at 33 kcal per kg
 * for an active lifter, then adjusted for the goal; protein is set per kg of
 * body weight (higher while cutting to protect muscle) and fat at 0.8 g/kg,
 * with carbs filling the rest.
 */
export function dailyTargets(bodyWeightKg: number | null, goal: NutritionGoal, training: Goal): Macros {
  const kg = bodyWeightKg && bodyWeightKg > 30 ? bodyWeightKg : DEFAULT_BODY_WEIGHT_KG;
  const maintenance = kg * (training === 'endurance' ? 35 : 33);
  const calories = roundTo(maintenance * (goal === 'lose' ? 0.8 : goal === 'gain' ? 1.1 : 1), 50);
  const protein = Math.round(kg * (goal === 'lose' ? 2.2 : training === 'endurance' ? 1.6 : 2));
  const fat = Math.round(kg * 0.8);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (t, i) => ({ calories: t.calories + i.calories, protein: t.protein + i.protein, carbs: t.carbs + i.carbs, fat: t.fat + i.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function scaleItem(item: FoodItem, servings: number): FoodItem {
  const r = (n: number) => Math.round(n * servings * 10) / 10;
  return {
    ...item,
    portion: servings === 1 ? item.portion : `${servings} × ${item.portion}`,
    calories: Math.round(item.calories * servings),
    protein: r(item.protein),
    carbs: r(item.carbs),
    fat: r(item.fat),
  };
}

/** The meal a time of day most likely belongs to. */
export function mealForTime(date: Date): Meal {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 17.5) return 'dinner';
  return 'snack';
}

export interface PhotoEstimate {
  items: FoodItem[];
  /** "high", "medium" or "low", so the app can nudge the user to check. */
  confidence: 'high' | 'medium' | 'low';
  note: string;
}

const num = (v: unknown, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 10) / 10)) : 0;
};

/**
 * Validates an estimate from the food AI. Anything malformed is dropped rather
 * than trusted, and calories are reconciled with the macros when they disagree
 * wildly (4 kcal per gram of protein and carbs, 9 per gram of fat).
 */
export function normalizeEstimate(raw: unknown): PhotoEstimate {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.items) ? obj.items : [];
  const items: FoodItem[] = [];
  for (const it of list.slice(0, 12)) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 60) : '';
    if (!name) continue;
    // The AI answers in *_g fields; the server passes the checked shape on without them.
    const protein = num(r.protein_g ?? r.protein, 300);
    const carbs = num(r.carbs_g ?? r.carbs, 500);
    const fat = num(r.fat_g ?? r.fat, 300);
    let calories = Math.round(num(r.calories, 5000));
    const fromMacros = protein * 4 + carbs * 4 + fat * 9;
    if (fromMacros > 0 && (calories === 0 || Math.abs(calories - fromMacros) / fromMacros > 0.35)) {
      calories = Math.round(fromMacros);
    }
    const portion = typeof r.portion === 'string' ? r.portion.trim().slice(0, 40) : '1 serving';
    items.push({ name, portion: portion || '1 serving', calories, protein, carbs, fat });
  }
  const confidence = obj.confidence === 'high' || obj.confidence === 'low' ? obj.confidence : 'medium';
  const note = typeof obj.note === 'string' ? obj.note.trim().slice(0, 200) : '';
  return { items, confidence, note };
}

/** Everyday foods for one-tap logging. Values are typical per the portion shown. */
export const COMMON_FOODS: FoodItem[] = [
  { name: 'Eggs', portion: '2 large', calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  { name: 'Oats', portion: '50 g dry', calories: 190, protein: 6.5, carbs: 33, fat: 3.5 },
  { name: 'Greek yogurt, plain', portion: '170 g', calories: 100, protein: 17, carbs: 6, fat: 0.7 },
  { name: 'Banana', portion: '1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Apple', portion: '1 medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Blueberries', portion: '1 cup', calories: 85, protein: 1.1, carbs: 21, fat: 0.5 },
  { name: 'Whole milk', portion: '250 ml', calories: 155, protein: 8, carbs: 12, fat: 8.5 },
  { name: 'Whey protein shake', portion: '1 scoop + water', calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: 'Wholemeal toast', portion: '1 slice', calories: 80, protein: 4, carbs: 13, fat: 1 },
  { name: 'Peanut butter', portion: '1 tbsp', calories: 95, protein: 3.5, carbs: 3, fat: 8 },
  { name: 'Chicken breast, cooked', portion: '150 g', calories: 248, protein: 46, carbs: 0, fat: 5.4 },
  { name: 'Salmon fillet, cooked', portion: '150 g', calories: 310, protein: 33, carbs: 0, fat: 19 },
  { name: 'Lean beef mince, cooked', portion: '150 g', calories: 330, protein: 39, carbs: 0, fat: 19 },
  { name: 'Tuna, canned in water', portion: '1 can (120 g)', calories: 130, protein: 29, carbs: 0, fat: 1 },
  { name: 'Tofu, firm', portion: '150 g', calories: 215, protein: 23, carbs: 4, fat: 13 },
  { name: 'White rice, cooked', portion: '1 cup', calories: 205, protein: 4.3, carbs: 45, fat: 0.4 },
  { name: 'Brown rice, cooked', portion: '1 cup', calories: 218, protein: 4.5, carbs: 46, fat: 1.6 },
  { name: 'Pasta, cooked', portion: '1 cup', calories: 220, protein: 8, carbs: 43, fat: 1.3 },
  { name: 'Potato, baked', portion: '1 medium', calories: 160, protein: 4.3, carbs: 37, fat: 0.2 },
  { name: 'Sweet potato, baked', portion: '1 medium', calories: 115, protein: 2, carbs: 27, fat: 0.2 },
  { name: 'Broccoli', portion: '1 cup', calories: 55, protein: 3.7, carbs: 11, fat: 0.6 },
  { name: 'Mixed salad', portion: '1 bowl', calories: 25, protein: 1.5, carbs: 5, fat: 0.2 },
  { name: 'Avocado', portion: '1/2 fruit', calories: 120, protein: 1.5, carbs: 6, fat: 11 },
  { name: 'Olive oil', portion: '1 tbsp', calories: 120, protein: 0, carbs: 0, fat: 14 },
  { name: 'Almonds', portion: '30 g', calories: 175, protein: 6.3, carbs: 6, fat: 15 },
  { name: 'Cheddar cheese', portion: '30 g', calories: 120, protein: 7, carbs: 0.4, fat: 10 },
  { name: 'Cottage cheese', portion: '150 g', calories: 150, protein: 17, carbs: 5, fat: 6.5 },
  { name: 'Hummus', portion: '2 tbsp', calories: 70, protein: 2, carbs: 4, fat: 5 },
  { name: 'Wrap / tortilla', portion: '1 large', calories: 210, protein: 6, carbs: 35, fat: 5 },
  { name: 'Pizza', portion: '1 slice', calories: 285, protein: 12, carbs: 36, fat: 10 },
  { name: 'Burger', portion: '1 regular', calories: 520, protein: 28, carbs: 40, fat: 27 },
  { name: 'Fries', portion: 'medium portion', calories: 365, protein: 4, carbs: 48, fat: 17 },
  { name: 'Protein bar', portion: '1 bar', calories: 210, protein: 20, carbs: 22, fat: 7 },
  { name: 'Dark chocolate', portion: '25 g', calories: 150, protein: 2, carbs: 11, fat: 11 },
  { name: 'Orange juice', portion: '250 ml', calories: 110, protein: 1.7, carbs: 26, fat: 0.5 },
  { name: 'Latte', portion: 'medium', calories: 190, protein: 12, carbs: 18, fat: 7 },
  { name: 'Beer', portion: '1 pint', calories: 210, protein: 2, carbs: 17, fat: 0 },
  { name: 'Wine', portion: '1 glass (175 ml)', calories: 145, protein: 0.1, carbs: 4.5, fat: 0 },
];
