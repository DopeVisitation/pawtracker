import { HouseholdTip, TipDayStatus } from '../types';
import { tipHelpers, supabase } from './supabase';

export interface Activity {
  id: string;
  title: string;
  description: string;
  duration: string;
  emoji: string;
  category: 'play' | 'care' | 'explore' | 'cuddle';
}

export const CAT_ACTIVITIES: Activity[] = [
  { id: 'a1',  emoji: '🏰', title: 'Spielfestung bauen',    description: 'Kartons und Decken zu einer Burg zusammenstellen',           duration: '20 Min', category: 'play' },
  { id: 'a2',  emoji: '🐟', title: 'Snack-Versteck',        description: 'Leckerlis in der Wohnung verstecken und suchen lassen',       duration: '15 Min', category: 'explore' },
  { id: 'a3',  emoji: '🧶', title: 'Wollknäuel-Jagd',       description: 'Mit einem Wollknäuel auf dem Boden spielen',                 duration: '15 Min', category: 'play' },
  { id: 'a4',  emoji: '🪥', title: 'Bürstmassage',          description: 'Sanft bürsten — entspannend für Katze und Mensch',           duration: '10 Min', category: 'care' },
  { id: 'a5',  emoji: '🌿', title: 'Katzengras anbieten',   description: 'Frisches Katzengras oder Minze zum Beschnuppern',            duration: '10 Min', category: 'explore' },
  { id: 'a6',  emoji: '🪟', title: 'Fenster-Kino',          description: 'Fenster öffnen und Vogel-/Straßengeräusche genießen',        duration: '20 Min', category: 'explore' },
  { id: 'a7',  emoji: '💤', title: 'Extra Kuschel-Session',  description: 'Einfach zusammen auf der Couch entspannen',                 duration: '20 Min', category: 'cuddle' },
  { id: 'a8',  emoji: '🎯', title: 'Laserpointer-Training', description: 'Mit Laserpointer spielen und mit Leckerli belohnen',         duration: '10 Min', category: 'play' },
  { id: 'a9',  emoji: '📦', title: 'Karton-Erkundung',      description: 'Einen neuen Karton hinstellen und erkunden lassen',          duration: '15 Min', category: 'explore' },
  { id: 'a10', emoji: '🎪', title: 'Spielzeug-Rotation',    description: 'Altes Spielzeug wieder hervorkramen — wirkt wie neu!',       duration: '15 Min', category: 'play' },
  { id: 'a11', emoji: '🫧', title: 'Seifenblasen-Jagd',     description: 'Seifenblasen pusten und fangen lassen',                     duration: '10 Min', category: 'play' },
  { id: 'a12', emoji: '🧸', title: 'Stoffmaus-Versteck',    description: 'Spielzeug unter Schränken/Sofas verstecken',                duration: '15 Min', category: 'play' },
  { id: 'a13', emoji: '💅', title: 'Krallenpflege',         description: 'Krallen kontrollieren und ggf. vorsichtig stutzen',          duration: '10 Min', category: 'care' },
  { id: 'a14', emoji: '📸', title: 'Foto-Session',          description: 'Die schönsten Katzenmomente festhalten',                    duration: '15 Min', category: 'cuddle' },
  { id: 'a15', emoji: '🎵', title: 'Katzenmusik abspielen', description: 'Spezielle Katzen-Musik auf YouTube spielen',                 duration: '20 Min', category: 'cuddle' },
  { id: 'a16', emoji: '🌺', title: 'Katzenbett wechseln',   description: 'Frische Decke oder neues Kissen ins Katzenbett legen',      duration: '5 Min',  category: 'care' },
  { id: 'a17', emoji: '🪄', title: 'Angel-Training',        description: 'Mit einer Katzenangel spielen und Jagdinstinkt wecken',      duration: '15 Min', category: 'play' },
  { id: 'a18', emoji: '🍃', title: 'Balkon-Zeit',           description: 'Gesicherte Balkon-Erkundung mit frischer Luft',             duration: '20 Min', category: 'explore' },
  { id: 'a19', emoji: '🧩', title: 'Intelligenzspielzeug',  description: 'Futterpuzzle oder Schnüffelbox ausprobieren',               duration: '15 Min', category: 'explore' },
  { id: 'a20', emoji: '🐾', title: 'Massage-Session',       description: 'Sanfte Streicheleinheiten und Körperpflege-Check',          duration: '10 Min', category: 'cuddle' },
];

const CATEGORY_COLORS = {
  play:    '#FF6B6B',
  care:    '#4ECDC4',
  explore: '#F59E0B',
  cuddle:  '#FF9ECD',
};

export function getDailyActivity(): Activity {
  const dayOfYear = Math.floor(Date.now() / 86400000);
  return CAT_ACTIVITIES[dayOfYear % CAT_ACTIVITIES.length];
}

export function getCategoryColor(category: Activity['category']): string {
  return CATEGORY_COLORS[category];
}

// ──────────────────────────────────────────────────────────────
// DB-backed tip management
// ──────────────────────────────────────────────────────────────

export function householdTipToActivity(tip: HouseholdTip): Activity {
  return {
    id: tip.id,
    title: tip.title,
    description: tip.description,
    duration: tip.duration,
    emoji: tip.emoji,
    category: tip.category,
  };
}

export async function fetchTodayTip(
  profileId: string,
  householdId: string,
): Promise<{ tip: Activity; status: TipDayStatus; isCustom: boolean }> {
  const { data: statusRow } = await tipHelpers.fetchUserStatus(profileId);

  const status: TipDayStatus = {
    completed: statusRow?.completed ?? false,
    rolled: statusRow?.rolled ?? false,
    active_tip_id: statusRow?.active_tip_id ?? null,
  };

  // If user has a custom tip active today, fetch it
  if (status.active_tip_id) {
    const { data: tipData } = await supabase
      .from('household_tips')
      .select('*')
      .eq('id', status.active_tip_id)
      .single();

    if (tipData) {
      return { tip: householdTipToActivity(tipData as HouseholdTip), status, isCustom: true };
    }
  }

  // Try to use a household tip (deterministic by day)
  const { data: tips } = await tipHelpers.fetchTips(householdId);
  if (tips && tips.length > 0) {
    const dayIndex = Math.floor(Date.now() / 86400000);
    const tip = (tips as HouseholdTip[])[dayIndex % tips.length];
    return { tip: householdTipToActivity(tip), status, isCustom: true };
  }

  // Fallback: built-in CAT_ACTIVITIES
  return { tip: getDailyActivity(), status, isCustom: false };
}

export async function rollNewTip(
  profileId: string,
  householdId: string,
  currentTipId?: string | null,
): Promise<{ tip: Activity; error?: string }> {
  const today = new Date().toISOString().split('T')[0];

  const { data: tips } = await tipHelpers.fetchTips(householdId);

  if (tips && tips.length > 0) {
    const available = (tips as HouseholdTip[]).filter((t) => t.id !== currentTipId);
    const pool = available.length > 0 ? available : (tips as HouseholdTip[]);
    const newTip = pool[Math.floor(Math.random() * pool.length)];

    await tipHelpers.upsertUserStatus({
      profile_id: profileId,
      household_id: householdId,
      tip_date: today,
      rolled: true,
      active_tip_id: newTip.id,
    });

    return { tip: householdTipToActivity(newTip) };
  }

  // Fallback: random built-in activity
  const current = getDailyActivity();
  const pool = CAT_ACTIVITIES.filter((a) => a.id !== current.id);
  const newActivity = pool[Math.floor(Math.random() * pool.length)];
  await tipHelpers.upsertUserStatus({
    profile_id: profileId,
    household_id: householdId,
    tip_date: today,
    rolled: true,
    active_tip_id: null,
  });
  return { tip: newActivity };
}

export async function completeTip(profileId: string, householdId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await tipHelpers.upsertUserStatus({
    profile_id: profileId,
    household_id: householdId,
    tip_date: today,
    completed: true,
  });
}

export async function fetchHouseholdTips(householdId: string): Promise<HouseholdTip[]> {
  const { data } = await tipHelpers.fetchTips(householdId);
  return (data as HouseholdTip[]) ?? [];
}

export async function createHouseholdTip(
  householdId: string,
  profileId: string,
  tip: Pick<HouseholdTip, 'emoji' | 'title' | 'description' | 'duration' | 'category'>,
): Promise<HouseholdTip | null> {
  const { data } = await tipHelpers.createTip({
    household_id: householdId,
    created_by: profileId,
    ...tip,
  });
  return data as HouseholdTip | null;
}

export async function updateHouseholdTip(
  id: string,
  updates: Partial<Pick<HouseholdTip, 'emoji' | 'title' | 'description' | 'duration' | 'category'>>,
): Promise<void> {
  await tipHelpers.updateTip(id, updates);
}

export async function deleteHouseholdTip(id: string): Promise<void> {
  await tipHelpers.deleteTip(id);
}
