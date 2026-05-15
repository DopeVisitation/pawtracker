// Food visual category definitions — emoji + colors for rich UI display
export interface FoodVisual {
  emoji: string;
  color: string;      // text/icon color
  bgColor: string;    // badge background color
  label: string;      // German category label
}

export const FOOD_CATEGORIES: Record<string, FoodVisual> = {
  chicken:   { emoji: '🐔', color: '#D97706', bgColor: '#FEF3C7', label: 'Huhn' },
  beef:      { emoji: '🥩', color: '#DC2626', bgColor: '#FEE2E2', label: 'Rind' },
  veal:      { emoji: '🐄', color: '#B45309', bgColor: '#FEF9C3', label: 'Kalb' },
  fish:      { emoji: '🐟', color: '#2563EB', bgColor: '#DBEAFE', label: 'Fisch' },
  salmon:    { emoji: '🐠', color: '#EA580C', bgColor: '#FFEDD5', label: 'Lachs' },
  duck:      { emoji: '🦆', color: '#15803D', bgColor: '#DCFCE7', label: 'Ente' },
  turkey:    { emoji: '🦃', color: '#92400E', bgColor: '#FEF3C7', label: 'Truthahn' },
  rabbit:    { emoji: '🐰', color: '#7C3AED', bgColor: '#EDE9FE', label: 'Kaninchen' },
  lamb:      { emoji: '🐑', color: '#6D28D9', bgColor: '#F5F3FF', label: 'Lamm' },
  shrimp:    { emoji: '🦐', color: '#E11D48', bgColor: '#FFE4E6', label: 'Garnele' },
  venison:   { emoji: '🦌', color: '#854D0E', bgColor: '#FEF9C3', label: 'Wild' },
  tuna:      { emoji: '🐡', color: '#0369A1', bgColor: '#E0F2FE', label: 'Thunfisch' },
  mix:       { emoji: '🎨', color: '#6366F1', bgColor: '#EEF2FF', label: 'Mix' },
  sensitive: { emoji: '💚', color: '#16A34A', bgColor: '#DCFCE7', label: 'Sensitive' },
  kitten:    { emoji: '🐱', color: '#EC4899', bgColor: '#FCE7F3', label: 'Kitten' },
  senior:    { emoji: '🐈', color: '#64748B', bgColor: '#F1F5F9', label: 'Senior' },
  dry:       { emoji: '🌾', color: '#CA8A04', bgColor: '#FEF9C3', label: 'Trocken' },
  treat:     { emoji: '⭐', color: '#EAB308', bgColor: '#FFFBEB', label: 'Snack' },
  supplement:{ emoji: '💊', color: '#0891B2', bgColor: '#ECFEFF', label: 'Ergänzung' },
  vegetable: { emoji: '🥦', color: '#16A34A', bgColor: '#DCFCE7', label: 'Gemüse' },
};

// Keyword → category key mapping (order matters — more specific first)
const KEYWORD_CATEGORY: [string[], string][] = [
  [['lachs', 'salmon'],                                  'salmon'],
  [['thun', 'tuna'],                                     'tuna'],
  [['garnele', 'shrimp', 'krebs', 'crab'],              'shrimp'],
  [['huhn', 'chicken', 'hähnchen', 'geflügel', 'hühn'], 'chicken'],
  [['kalb', 'veal'],                                     'veal'],
  [['rind', 'beef', 'rindflei'],                        'beef'],
  [['ente', 'duck'],                                     'duck'],
  [['lamm', 'lamb', 'schaf'],                            'lamb'],
  [['pute', 'turkey', 'truthahn'],                       'turkey'],
  [['hase', 'kaninchen', 'rabbit'],                      'rabbit'],
  [['wild', 'wildschwein', 'hirsch', 'reh', 'venison'], 'venison'],
  [['fisch', 'fish', 'forelle', 'trout', 'barsch'],     'fish'],
  [['sensitive', 'sensibel', 'schonkost'],               'sensitive'],
  [['kitten', 'junior', 'baby'],                         'kitten'],
  [['senior', 'alt', 'mature'],                          'senior'],
  [['mix', 'gemischt', 'auswahl', 'variety'],            'mix'],
  [['trocken', 'dry', 'kibble', 'biscuit', 'knabber'],  'dry'],
  [['leckerli', 'snack', 'treat'],                       'treat'],
  [['supplement', 'vitamin', 'mineral', 'ergänzung'],    'supplement'],
  [['gemüse', 'vegetable', 'vegan', 'veggie', 'kürbis'], 'vegetable'],
];

export function getFoodCategory(food: { name: string; type: string; brand?: string }): string {
  const text = `${food.name} ${food.brand ?? ''}`.toLowerCase();
  for (const [keywords, category] of KEYWORD_CATEGORY) {
    if (keywords.some((k) => text.includes(k))) return category;
  }
  // Fallback by type
  if (food.type === 'dry') return 'dry';
  if (food.type === 'treat') return 'treat';
  if (food.type === 'supplement') return 'supplement';
  return 'fish'; // default wet food fallback
}

export function getFoodVisual(food: { name: string; type: string; brand?: string }): FoodVisual {
  const category = getFoodCategory(food);
  return FOOD_CATEGORIES[category] ?? FOOD_CATEGORIES.fish;
}

export function getFoodEmoji(food: { name: string; type: string; brand?: string }): string {
  return getFoodVisual(food).emoji;
}

export const FOOD_TYPE_ICONS: Record<string, string> = {
  wet:        '🥫',
  dry:        '🌾',
  treat:      '⭐',
  supplement: '💊',
};
