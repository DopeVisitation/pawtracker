// ============================================================
// PawTracker – Core Type Definitions
// ============================================================

export type MealType = 'morning' | 'noon' | 'evening' | 'extra';
export type FoodType = 'wet' | 'dry' | 'treat' | 'supplement';
export type EatenStatus = 'all' | 'most' | 'little' | 'none';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
  household_id?: string;
  points: number;
  push_token?: string;
  created_at: string;
}

export interface Cat {
  id: string;
  household_id: string;
  name: string;
  photo_url?: string;
  birth_date?: string;
  notes?: string;
  intolerances?: string;
  favorite_food_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Food {
  id: string;
  household_id: string;
  name: string;
  brand?: string;
  variety?: string;
  type: FoodType;
  unit: string;
  stock_count: number;
  min_stock: number;
  photo_url?: string;
  barcode?: string;
  is_active: boolean;
  created_at: string;
}

export interface Feeding {
  id: string;
  household_id: string;
  cat_id: string;
  food_id?: string;
  meal_type: MealType;
  fed_at: string;
  fed_by?: string;
  notes?: string;
  eaten_status?: EatenStatus;
  rating?: number;
  points_awarded: number;
  created_at: string;
  // joined fields
  cat?: Cat;
  food?: Food;
  fed_by_profile?: Profile;
}

export interface ShoppingItem {
  id: string;
  household_id: string;
  food_id?: string;
  custom_item?: string;
  quantity: number;
  checked: boolean;
  created_by?: string;
  created_at: string;
  food?: Food;
}

export interface TodayFeedingStatus {
  cat_id: string;
  household_id: string;
  cat_name: string;
  photo_url?: string;
  morning_fed_at?: string;
  morning_fed_by?: string;
  noon_fed_at?: string;
  noon_fed_by?: string;
  evening_fed_at?: string;
  evening_fed_by?: string;
}

export interface MealStatus {
  type: MealType;
  label: string;
  emoji: string;
  fedAt?: string;
  fedBy?: string;
  isDue: boolean;
  isOverdue: boolean;
}

export const MEAL_SCHEDULE: Record<MealType, { label: string; emoji: string; startHour: number; dueHour: number }> = {
  morning: { label: 'Morgens',  emoji: '🌅', startHour: 6,  dueHour: 10 },
  noon:    { label: 'Mittags',  emoji: '☀️', startHour: 11, dueHour: 14 },
  evening: { label: 'Abends',   emoji: '🌙', startHour: 17, dueHour: 21 },
  extra:   { label: 'Extra',    emoji: '⭐', startHour: 0,  dueHour: 24 },
};

export const EATEN_STATUS_LABELS: Record<EatenStatus, { label: string; emoji: string }> = {
  all:    { label: 'Sehr gut gefressen!', emoji: '😻' },
  most:   { label: 'Normal gegessen',     emoji: '🙂' },
  little: { label: 'Wenig gegessen',      emoji: '😿' },
  none:   { label: 'Verweigert',          emoji: '❌' },
};

// ──────────────────────────────────────────────────────────────
// TIPS
// ──────────────────────────────────────────────────────────────
export interface HouseholdTip {
  id: string;
  household_id: string;
  emoji: string;
  title: string;
  description: string;
  duration: string;
  category: 'play' | 'care' | 'explore' | 'cuddle';
  created_by?: string;
  is_active: boolean;
  created_at: string;
}

export interface TipDayStatus {
  completed: boolean;
  rolled: boolean;
  active_tip_id?: string | null;
}
