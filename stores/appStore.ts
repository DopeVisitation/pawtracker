import { create } from 'zustand';
import { Cat, Food, Feeding, Profile, TodayFeedingStatus, Household, HouseholdTip } from '../types';
import { supabase, feedingHelpers } from '../lib/supabase';
import { fetchHouseholdTips, createHouseholdTip, updateHouseholdTip, deleteHouseholdTip } from '../lib/activities';

interface AppState {
  // Auth
  profile: Profile | null;
  household: Household | null;
  setProfile: (profile: Profile | null) => void;
  setHousehold: (household: Household | null) => void;

  // Data
  cats: Cat[];
  foods: Food[];
  todayStatus: TodayFeedingStatus[];
  members: Profile[];
  householdTips: HouseholdTip[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAll: () => Promise<void>;
  fetchTodayStatus: () => Promise<void>;
  addFeeding: (data: {
    cat_id: string;
    food_id?: string;
    meal_type: string;
    notes?: string;
    eaten_status?: string;
    rating?: number;
  }) => Promise<{ error?: string }>;
  addCat: (cat: Omit<Cat, 'id' | 'household_id' | 'created_at' | 'is_active'>) => Promise<void>;
  updateCat: (id: string, updates: Partial<Cat>) => Promise<void>;
  addFood: (food: Omit<Food, 'id' | 'household_id' | 'created_at' | 'is_active'>) => Promise<void>;
  updateFoodStock: (id: string, delta: number) => Promise<void>;

  // Tip management
  fetchTips: () => Promise<void>;
  addTip: (tip: Pick<HouseholdTip, 'emoji' | 'title' | 'description' | 'duration' | 'category'>) => Promise<void>;
  editTip: (id: string, updates: Partial<Pick<HouseholdTip, 'emoji' | 'title' | 'description' | 'duration' | 'category'>>) => Promise<void>;
  removeTip: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: null,
  household: null,
  cats: [],
  foods: [],
  todayStatus: [],
  members: [],
  householdTips: [],
  isLoading: false,
  error: null,

  setProfile: (profile) => set({ profile }),
  setHousehold: (household) => set({ household }),

  fetchAll: async () => {
    const { household } = get();
    if (!household) return;
    set({ isLoading: true, error: null });

    const [catsRes, foodsRes, membersRes] = await Promise.all([
      supabase.from('cats').select('*').eq('household_id', household.id).eq('is_active', true).order('name'),
      supabase.from('foods').select('*').eq('household_id', household.id).eq('is_active', true).order('name'),
      supabase.from('profiles').select('*').eq('household_id', household.id),
    ]);

    set({
      cats: catsRes.data ?? [],
      foods: foodsRes.data ?? [],
      members: membersRes.data ?? [],
      isLoading: false,
    });

    await Promise.all([get().fetchTodayStatus(), get().fetchTips()]);
  },

  fetchTodayStatus: async () => {
    const { household } = get();
    if (!household) return;
    const { data } = await feedingHelpers.getTodayStatus(household.id);
    set({ todayStatus: data ?? [] });
  },

  addFeeding: async ({ cat_id, food_id, meal_type, notes, eaten_status, rating }) => {
    const { profile, household } = get();
    if (!profile || !household) return { error: 'Nicht eingeloggt' };

    const { isDuplicate, existingFeeding } = await feedingHelpers.checkDuplicate(cat_id, meal_type);
    if (isDuplicate) {
      const by = (existingFeeding as any)?.fed_by_profile?.display_name ?? 'Jemand';
      return { error: `${by} hat diese Mahlzeit bereits eingetragen!` };
    }

    const { error } = await feedingHelpers.addFeeding({
      household_id: household.id,
      cat_id,
      food_id,
      meal_type,
      fed_by: profile.id,
      notes,
      eaten_status,
      rating,
    });

    if (error) return { error: error.message };

    await get().fetchTodayStatus();

    if (food_id) {
      const { data: foods } = await supabase
        .from('foods')
        .select('*')
        .eq('household_id', household.id)
        .eq('is_active', true)
        .order('name');
      if (foods) set({ foods });
    }

    return {};
  },

  addCat: async (cat) => {
    const { household } = get();
    if (!household) return;
    const { data } = await supabase
      .from('cats')
      .insert({ ...cat, household_id: household.id })
      .select()
      .single();
    if (data) set((s) => ({ cats: [...s.cats, data].sort((a, b) => a.name.localeCompare(b.name)) }));
  },

  updateCat: async (id, updates) => {
    await supabase.from('cats').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    set((s) => ({ cats: s.cats.map((c) => (c.id === id ? { ...c, ...updates } : c)) }));
  },

  addFood: async (food) => {
    const { household } = get();
    if (!household) return;
    const { data } = await supabase
      .from('foods')
      .insert({ ...food, household_id: household.id })
      .select()
      .single();
    if (data) set((s) => ({ foods: [...s.foods, data].sort((a, b) => a.name.localeCompare(b.name)) }));
  },

  updateFoodStock: async (id, delta) => {
    const food = get().foods.find((f) => f.id === id);
    if (!food) return;
    const newStock = Math.max(0, food.stock_count + delta);
    await supabase.from('foods').update({ stock_count: newStock }).eq('id', id);
    set((s) => ({ foods: s.foods.map((f) => (f.id === id ? { ...f, stock_count: newStock } : f)) }));
  },

  fetchTips: async () => {
    const { household } = get();
    if (!household) return;
    const tips = await fetchHouseholdTips(household.id);
    set({ householdTips: tips });
  },

  addTip: async (tip) => {
    const { household, profile } = get();
    if (!household || !profile) return;
    const created = await createHouseholdTip(household.id, profile.id, tip);
    if (created) set((s) => ({ householdTips: [created, ...s.householdTips] }));
  },

  editTip: async (id, updates) => {
    await updateHouseholdTip(id, updates);
    set((s) => ({
      householdTips: s.householdTips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  removeTip: async (id) => {
    await deleteHouseholdTip(id);
    set((s) => ({ householdTips: s.householdTips.filter((t) => t.id !== id) }));
  },
}));
