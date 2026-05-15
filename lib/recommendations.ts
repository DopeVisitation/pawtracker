import { Food, Feeding, Cat } from '../types';

export interface FoodScore {
  food: Food;
  score: number;
  reason: string;
}

export interface MealRecommendation {
  cat_id: string;
  cat_name: string;
  food: Food | null;
  reason: string;
}

// Score all foods for a specific cat based on recent feedings
function scoreFoods(foods: Food[], catFeedings: Feeding[]): FoodScore[] {
  const now = Date.now();
  const DAY = 86400000;

  return foods.map((food) => {
    let score = 50;
    let reason = '';

    // Boost high-rated foods
    const rated = catFeedings.filter((f) => f.food_id === food.id && f.rating);
    if (rated.length > 0) {
      const avg = rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length;
      score += (avg - 3) * 15;
      if (avg >= 4) reason = 'Wird oft gut bewertet';
    }

    // Penalize recently used (promote variety)
    const lastUsed = catFeedings
      .filter((f) => f.food_id === food.id)
      .sort((a, b) => new Date(b.fed_at).getTime() - new Date(a.fed_at).getTime())[0];

    if (lastUsed) {
      const daysAgo = (now - new Date(lastUsed.fed_at).getTime()) / DAY;
      if (daysAgo < 1) {
        score -= 30;
        reason = 'Heute schon gegessen';
      } else if (daysAgo < 2) {
        score -= 15;
      } else if (daysAgo > 5) {
        score += 10;
        reason = reason || 'Schon länger nicht gehabt';
      }
    } else {
      score += 20;
      reason = reason || 'Noch nie probiert';
    }

    // Penalize low eaten status
    const lowEaten = catFeedings.filter(
      (f) => f.food_id === food.id && (f.eaten_status === 'none' || f.eaten_status === 'little'),
    );
    if (lowEaten.length > 0) {
      score -= lowEaten.length * 10;
      if (lowEaten.length >= 2) reason = 'Wird oft nicht gut gefressen';
    }

    // Boost favorite food status via eaten_status 'all'
    const allEaten = catFeedings.filter(
      (f) => f.food_id === food.id && f.eaten_status === 'all',
    );
    if (allEaten.length >= 2) {
      score += allEaten.length * 5;
      reason = reason || 'Lieblingsessen!';
    }

    // Low stock penalty
    if (food.stock_count <= 0) score -= 100;
    else if (food.stock_count <= food.min_stock) score -= 20;

    return { food, score: Math.max(0, score), reason };
  });
}

// Original per-cat recommendation (2-3 foods)
export function getRecommendations(
  foods: Food[],
  recentFeedings: Feeding[],
  catId: string,
  count = 3,
): FoodScore[] {
  if (foods.length === 0) return [];
  const catFeedings = recentFeedings.filter((f) => f.cat_id === catId);
  return scoreFoods(foods, catFeedings)
    .filter((s) => s.food.stock_count > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

// New: per-meal-time recommendations for ALL cats
export interface AllCatsMealRecs {
  morning: MealRecommendation[];
  noon: MealRecommendation[];
  evening: MealRecommendation[];
}

export function getAllCatsMealRecs(
  cats: Cat[],
  foods: Food[],
  recentFeedings: Feeding[],
): AllCatsMealRecs {
  const result: AllCatsMealRecs = { morning: [], noon: [], evening: [] };
  if (foods.length === 0 || cats.length === 0) return result;

  const inStock = foods.filter((f) => f.stock_count > 0);

  for (const cat of cats) {
    const catFeedings = recentFeedings.filter((f) => f.cat_id === cat.id);
    const scored = scoreFoods(inStock, catFeedings).sort((a, b) => b.score - a.score);

    // Morning: best wet food (not eaten today)
    const morningCandidates = scored.filter((s) => s.food.type === 'wet' || s.food.type === 'dry');
    const morning = morningCandidates[0] ?? scored[0] ?? null;
    result.morning.push({
      cat_id: cat.id,
      cat_name: cat.name,
      food: morning?.food ?? null,
      reason: morning?.reason ?? '',
    });

    // Noon: prefer treat or dry (lighter meal); skip if nothing fits
    const noonOption =
      scored.find((s) => s.food.type === 'treat' || s.food.type === 'dry') ?? null;
    result.noon.push({
      cat_id: cat.id,
      cat_name: cat.name,
      food: noonOption?.food ?? null,
      reason: noonOption?.reason ?? 'Leichter Snack',
    });

    // Evening: wet food different from morning pick
    const eveningCandidates = scored.filter(
      (s) => s.food.type === 'wet' && s.food.id !== morning?.food?.id,
    );
    const evening = eveningCandidates[0] ?? (morning?.food?.id ? scored.find((s) => s.food.id !== morning?.food?.id) : scored[0]) ?? morning;
    result.evening.push({
      cat_id: cat.id,
      cat_name: cat.name,
      food: evening?.food ?? null,
      reason: evening?.reason ?? 'Abwechslung',
    });
  }

  return result;
}
