import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Web uses localStorage, native uses AsyncStorage
const getStorage = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@react-native-async-storage/async-storage').default;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// ──────────────────────────────────────────────────────────────
// Auth helpers
// ──────────────────────────────────────────────────────────────
export const authHelpers = {
  signUp: (email: string, password: string, displayName: string) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    }),

  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signOut: () => supabase.auth.signOut(),

  getSession: () => supabase.auth.getSession(),
};

// ──────────────────────────────────────────────────────────────
// Household helpers
// ──────────────────────────────────────────────────────────────
export const householdHelpers = {
  create: async (name: string, userId: string) => {
    const { data: household, error: hError } = await supabase
      .from('households')
      .insert({ name })
      .select()
      .single();

    if (hError || !household) return { error: hError };

    const { error: pError } = await supabase
      .from('profiles')
      .update({ household_id: household.id })
      .eq('id', userId);

    return { data: household, error: pError };
  },

  joinByCode: async (code: string, userId: string) => {
    const { data: household, error: hError } = await supabase
      .from('households')
      .select('id')
      .eq('invite_code', code.toUpperCase())
      .single();

    if (hError || !household) return { error: hError ?? new Error('Code nicht gefunden') };

    const { error: pError } = await supabase
      .from('profiles')
      .update({ household_id: household.id })
      .eq('id', userId);

    return { data: household, error: pError };
  },
};

// ──────────────────────────────────────────────────────────────
// Feeding helpers
// ──────────────────────────────────────────────────────────────
export const feedingHelpers = {
  getTodayStatus: (householdId: string) =>
    supabase
      .from('today_feeding_status')
      .select('*')
      .eq('household_id', householdId),

  addFeeding: (data: {
    household_id: string;
    cat_id: string;
    food_id?: string;
    meal_type: string;
    fed_by: string;
    notes?: string;
    eaten_status?: string;
    rating?: number;
  }) =>
    supabase.from('feedings').insert(data).select().single(),

  getHistory: (householdId: string, limit = 50) =>
    supabase
      .from('feedings')
      .select(`
        *,
        cat:cats(name, photo_url),
        food:foods(name, brand),
        fed_by_profile:profiles!feedings_fed_by_fkey(display_name, avatar_url)
      `)
      .eq('household_id', householdId)
      .order('fed_at', { ascending: false })
      .limit(limit),

  checkDuplicate: async (catId: string, mealType: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('feedings')
      .select('id, fed_at, fed_by_profile:profiles!feedings_fed_by_fkey(display_name)')
      .eq('cat_id', catId)
      .eq('meal_type', mealType)
      .gte('fed_at', `${today}T00:00:00`)
      .limit(1);

    return { isDuplicate: (data?.length ?? 0) > 0, existingFeeding: data?.[0], error };
  },
};

// ──────────────────────────────────────────────────────────────
// Tip helpers
// ──────────────────────────────────────────────────────────────
export const tipHelpers = {
  fetchTips: (householdId: string) =>
    supabase
      .from('household_tips')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),

  createTip: (data: {
    household_id: string;
    created_by: string;
    emoji: string;
    title: string;
    description: string;
    duration: string;
    category: string;
  }) =>
    supabase.from('household_tips').insert(data).select().single(),

  updateTip: (id: string, updates: { emoji?: string; title?: string; description?: string; duration?: string; category?: string }) =>
    supabase.from('household_tips').update(updates).eq('id', id),

  deleteTip: (id: string) =>
    supabase.from('household_tips').update({ is_active: false }).eq('id', id),

  fetchUserStatus: (profileId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return supabase
      .from('tip_user_status')
      .select('*')
      .eq('profile_id', profileId)
      .eq('tip_date', today)
      .maybeSingle();
  },

  upsertUserStatus: (data: {
    profile_id: string;
    household_id: string;
    tip_date: string;
    completed?: boolean;
    rolled?: boolean;
    active_tip_id?: string | null;
  }) =>
    supabase
      .from('tip_user_status')
      .upsert(data, { onConflict: 'profile_id,tip_date' })
      .select()
      .single(),
};

// ──────────────────────────────────────────────────────────────
// Realtime subscription factory
// ──────────────────────────────────────────────────────────────
export const subscribeToFeedings = (
  householdId: string,
  onUpdate: () => void,
) => {
  const channel = supabase
    .channel(`feedings:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'feedings',
        filter: `household_id=eq.${householdId}`,
      },
      onUpdate,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};
