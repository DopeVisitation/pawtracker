import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { useColors } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { MEAL_SCHEDULE, MealType, TodayFeedingStatus, EATEN_STATUS_LABELS, EatenStatus } from '../../types';
import { getCategoryColor, fetchTodayTip, rollNewTip, completeTip } from '../../lib/activities';
import { Activity } from '../../lib/activities';
import { getAllCatsMealRecs } from '../../lib/recommendations';
import { getFoodVisual } from '../../lib/foodIcons';
import { supabase } from '../../lib/supabase';
import FeedModal from '../../components/FeedModal';
import TipsModal from '../../components/TipsModal';
import SuccessToast from '../../components/SuccessToast';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function getGreeting(name: string) {
  const h = new Date().getHours();
  if (h < 12) return `Guten Morgen, ${name}! 🌅`;
  if (h < 17) return `Guten Tag, ${name}! ☀️`;
  return `Guten Abend, ${name}! 🌙`;
}

// ──────────────────────────────────────────────────────────────
// MealPill
// ──────────────────────────────────────────────────────────────
function MealPill({
  type, fedAt, fedBy, foodEmoji, onPress, colors,
}: {
  type: MealType; fedAt?: string; fedBy?: string; foodEmoji?: string;
  onPress: () => void; colors: ReturnType<typeof useColors>;
}) {
  const info = MEAL_SCHEDULE[type];
  const isFed = Boolean(fedAt);
  const now = new Date();
  const isOverdue = !isFed && now.getHours() > info.dueHour;
  const isDue = !isFed && now.getHours() >= info.startHour && !isOverdue;
  const timeStr = fedAt
    ? new Date(fedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.mealPill,
        { borderColor: 'transparent', backgroundColor: colors.mutedLight },
        isFed && { backgroundColor: colors.successLight, borderColor: colors.success },
        isOverdue && { backgroundColor: colors.dangerLight, borderColor: colors.danger },
        isDue && { backgroundColor: colors.warningLight, borderColor: colors.warning },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isFed}
    >
      <Text style={styles.mealEmoji}>{foodEmoji || info.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.mealLabel, { color: isFed ? '#166534' : colors.textSecondary }]}>
          {info.label}
        </Text>
        {isFed ? (
          <Text style={[styles.mealTime, { color: colors.textMuted }]}>{timeStr} · {fedBy}</Text>
        ) : (
          <Text style={[styles.mealOpenText, { color: isOverdue ? colors.danger : colors.textMuted }]}>
            {isOverdue ? 'Überfällig!' : 'Noch offen'}
          </Text>
        )}
      </View>
      {isFed && <Text style={[styles.checkmark, { color: colors.success }]}>✓</Text>}
      {!isFed && (
        <View style={[styles.feedBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.feedBtnText}>+</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ──────────────────────────────────────────────────────────────
// CatCard
// ──────────────────────────────────────────────────────────────
function CatCard({
  status, onFeed, colors,
}: {
  status: TodayFeedingStatus;
  onFeed: (catId: string, mealType: MealType) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const allFed = Boolean(status.morning_fed_at && status.noon_fed_at && status.evening_fed_at);

  return (
    <View style={[styles.catCard, { backgroundColor: colors.card },
      allFed && { borderWidth: 2, borderColor: colors.successLight }]}>
      <View style={styles.catHeader}>
        <View style={styles.catAvatarWrap}>
          {status.photo_url ? (
            <Image source={{ uri: status.photo_url }} style={styles.catAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.catAvatarFallback, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.catAvatarEmoji}>🐱</Text>
            </View>
          )}
          {allFed && (
            <View style={[styles.catBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.catBadgeText}>✓</Text>
            </View>
          )}
        </View>
        <View style={styles.catInfo}>
          <Text style={[styles.catName, { color: colors.text }]}>{status.cat_name}</Text>
          <Text style={[styles.catSubtitle, { color: colors.textMuted }]}>
            {allFed ? '🎉 Alle Mahlzeiten erledigt!' : 'Mahlzeiten heute'}
          </Text>
        </View>
      </View>
      <View style={styles.mealRow}>
        {(['morning', 'noon', 'evening'] as MealType[]).map((type) => (
          <MealPill
            key={type} type={type} colors={colors}
            fedAt={status[`${type}_fed_at` as keyof TodayFeedingStatus] as string}
            fedBy={status[`${type}_fed_by` as keyof TodayFeedingStatus] as string}
            onPress={() => onFeed(status.cat_id, type)}
          />
        ))}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// ActivityCard — with completion, rolling, CRUD button
// ──────────────────────────────────────────────────────────────
function ActivityCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { profile, household } = useAppStore();
  const [tip, setTip] = useState<Activity | null>(null);
  const [completed, setCompleted] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [activeTipId, setActiveTipId] = useState<string | null>(null);
  const [loadingTip, setLoadingTip] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);

  useEffect(() => {
    if (!profile || !household) return;
    fetchTodayTip(profile.id, household.id).then(({ tip: t, status }) => {
      setTip(t);
      setCompleted(status.completed);
      setRolled(status.rolled);
      setActiveTipId(status.active_tip_id ?? null);
      setLoadingTip(false);
    });
  }, [profile?.id, household?.id]);

  const handleComplete = async () => {
    if (!profile || !household || completed) return;
    await completeTip(profile.id, household.id);
    setCompleted(true);
  };

  const handleRoll = async () => {
    if (!profile || !household || rolled || rolling) return;
    setRolling(true);
    const { tip: newTip } = await rollNewTip(profile.id, household.id, activeTipId);
    setTip(newTip);
    setRolled(true);
    setRolling(false);
  };

  if (loadingTip || !tip) {
    return (
      <View style={[styles.activityCard, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', minHeight: 100 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const catColor = getCategoryColor(tip.category);

  return (
    <>
      <View style={[styles.activityCard, { backgroundColor: colors.card }]}>
        <View style={styles.activityHeader}>
          <Text style={[styles.activityTitle, { color: colors.text }]}>🎯 Tipp des Tages</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={[styles.durationPill, { backgroundColor: catColor + '20' }]}>
              <Text style={[styles.durationText, { color: catColor }]}>{tip.duration}</Text>
            </View>
            <TouchableOpacity
              style={[styles.editTipBtn, { backgroundColor: colors.surface }]}
              onPress={() => setShowTipsModal(true)}
            >
              <Text style={{ fontSize: 14 }}>✏️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.activityBody}>
          <View style={[styles.activityEmojiWrap, { backgroundColor: catColor + '20' }]}>
            <Text style={styles.activityEmoji}>{tip.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activityName, { color: colors.text }]}>{tip.title}</Text>
            <Text style={[styles.activityDesc, { color: colors.textSecondary }]}>{tip.description}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.activityActions}>
          <TouchableOpacity
            style={[
              styles.activityBtn,
              { backgroundColor: completed ? colors.successLight : colors.primary },
              completed && { borderWidth: 1, borderColor: colors.success },
            ]}
            onPress={handleComplete}
            disabled={completed}
            activeOpacity={0.8}
          >
            <Text style={[styles.activityBtnText, { color: completed ? '#166834' : '#fff' }]}>
              {completed ? '✅ Erledigt!' : '✓ Als erledigt markieren'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.activityBtnSecondary,
              { backgroundColor: colors.surface, borderColor: colors.border },
              rolled && { opacity: 0.5 },
            ]}
            onPress={handleRoll}
            disabled={rolled || rolling}
            activeOpacity={0.8}
          >
            {rolling
              ? <ActivityIndicator color={colors.textMuted} size="small" />
              : <Text style={[styles.activityBtnSecondaryText, { color: rolled ? colors.textMuted : colors.text }]}>
                  {rolled ? '🎲 Heute bereits gewechselt' : '🎲 Neuen Tipp'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <TipsModal visible={showTipsModal} onClose={() => setShowTipsModal(false)} />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// AllCats Recommendation Card
// ──────────────────────────────────────────────────────────────
function AllCatsRecommendationCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { cats, foods, household } = useAppStore();
  const [recentFeedings, setRecentFeedings] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!household || cats.length === 0) return;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    supabase.from('feedings').select('*')
      .eq('household_id', household.id)
      .gte('fed_at', weekAgo)
      .then(({ data }) => {
        setRecentFeedings(data ?? []);
        setLoaded(true);
      });
  }, [household?.id, cats.length]);

  if (!loaded || cats.length === 0 || foods.length === 0) return null;

  const recs = getAllCatsMealRecs(cats, foods, recentFeedings);

  const MEALS = [
    { key: 'morning' as const, emoji: '🌅', label: 'Morgens' },
    { key: 'noon' as const,    emoji: '☀️', label: 'Mittags' },
    { key: 'evening' as const, emoji: '🌙', label: 'Abends' },
  ];

  return (
    <View style={[styles.recCard, { backgroundColor: colors.card }]}>
      <Text style={[styles.recTitle, { color: colors.text }]}>🍽️ Futter-Empfehlung für heute</Text>

      {MEALS.map(({ key, emoji, label }, idx) => {
        const mealRecs = recs[key];
        const hasRecs = mealRecs.some((r) => r.food !== null);

        return (
          <View key={key} style={[styles.mealSection, idx < MEALS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={styles.mealSectionHeader}>
              <Text style={styles.mealSectionEmoji}>{emoji}</Text>
              <Text style={[styles.mealSectionLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>

            {hasRecs ? (
              mealRecs.map((rec) => {
                if (!rec.food) {
                  return (
                    <View key={rec.cat_id} style={styles.recRow}>
                      <Text style={[styles.recCatName, { color: colors.text }]}>{rec.cat_name}</Text>
                      <Text style={[styles.recNoFood, { color: colors.textMuted }]}>{rec.reason || 'Leichter Snack'}</Text>
                    </View>
                  );
                }
                const visual = getFoodVisual(rec.food);
                return (
                  <View key={rec.cat_id} style={styles.recRow}>
                    <Text style={[styles.recCatName, { color: colors.text }]}>{rec.cat_name}</Text>
                    <View style={[styles.recFoodChip, { backgroundColor: visual.bgColor }]}>
                      <Text style={styles.recFoodEmoji}>{visual.emoji}</Text>
                      <View>
                        <Text style={[styles.recFoodName, { color: visual.color }]}>
                          {rec.food.name}{rec.food.brand ? ` (${rec.food.brand})` : ''}
                        </Text>
                        {rec.reason ? (
                          <Text style={[styles.recFoodReason, { color: colors.textMuted }]}>{rec.reason}</Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={[styles.recNoFood, { color: colors.textMuted, marginLeft: 8, marginBottom: 8 }]}>
                Leichter Snack
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// RecentFeedingsCard — kompakte Verlaufsübersicht auf dem Dashboard
// ──────────────────────────────────────────────────────────────
interface FeedingEntry {
  id: string;
  fed_at: string;
  meal_type: string;
  eaten_status?: EatenStatus;
  cat: { name: string; photo_url?: string };
  food?: { name: string; brand?: string; type: string };
  fed_by_profile?: { display_name: string };
}

function RecentFeedingsCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { household } = useAppStore();
  const [feedings, setFeedings] = useState<FeedingEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data } = await supabase
      .from('feedings')
      .select(`
        id, fed_at, meal_type, eaten_status,
        cat:cats(name, photo_url),
        food:foods(name, brand, type),
        fed_by_profile:profiles!feedings_fed_by_fkey(display_name)
      `)
      .eq('household_id', household.id)
      .gte('fed_at', yesterday)
      .order('fed_at', { ascending: false })
      .limit(10);
    setFeedings((data as any[]) ?? []);
    setLoaded(true);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || feedings.length === 0) return null;

  const todayStr = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

  const today = feedings.filter((f) =>
    new Date(f.fed_at).toDateString() === new Date().toDateString()
  );
  const yesterday = feedings.filter((f) =>
    new Date(f.fed_at).toDateString() === new Date(Date.now() - 86400000).toDateString()
  );

  const renderEntry = (entry: FeedingEntry) => {
    const time = new Date(entry.fed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const mealEmoji = { morning: '🌅', noon: '☀️', evening: '🌙', extra: '⭐' }[entry.meal_type] ?? '🍽️';
    const statusData = entry.eaten_status ? EATEN_STATUS_LABELS[entry.eaten_status] : null;
    const foodVisual = entry.food ? getFoodVisual(entry.food as any) : null;

    return (
      <View key={entry.id} style={[styles.feedEntry, { borderBottomColor: colors.border }]}>
        {/* Cat avatar */}
        {entry.cat?.photo_url ? (
          <Image source={{ uri: entry.cat.photo_url }} style={styles.feedCatAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.feedCatAvatarFallback, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ fontSize: 14 }}>🐱</Text>
          </View>
        )}

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={styles.feedEntryRow}>
            <Text style={[styles.feedCatName, { color: colors.text }]}>{entry.cat?.name}</Text>
            <Text style={[styles.feedTime, { color: colors.textMuted }]}>{mealEmoji} {time}</Text>
          </View>
          <View style={styles.feedEntryRow}>
            {entry.food && foodVisual ? (
              <View style={styles.feedFoodRow}>
                <View style={[styles.feedFoodIconBadge, { backgroundColor: foodVisual.bgColor }]}>
                  <Text style={{ fontSize: 12 }}>{foodVisual.emoji}</Text>
                </View>
                <Text style={[styles.feedFoodName, { color: colors.textSecondary }]}>
                  {entry.food.name}{entry.food.brand ? ` (${entry.food.brand})` : ''}
                </Text>
              </View>
            ) : (
              <Text style={[styles.feedFoodName, { color: colors.textMuted }]}>—</Text>
            )}
            {statusData && (
              <Text style={styles.feedStatusEmoji}>{statusData.emoji}</Text>
            )}
          </View>
          {entry.fed_by_profile && (
            <Text style={[styles.feedBy, { color: colors.textMuted }]}>
              von {entry.fed_by_profile.display_name}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.historyCard, { backgroundColor: colors.card }]}>
      <Text style={[styles.historyTitle, { color: colors.text }]}>📋 Letzte Fütterungen</Text>

      {today.length > 0 && (
        <View>
          <Text style={[styles.historyDateLabel, { color: colors.textMuted, backgroundColor: colors.surface }]}>
            Heute · {todayStr}
          </Text>
          {today.map(renderEntry)}
        </View>
      )}

      {yesterday.length > 0 && (
        <View>
          <Text style={[styles.historyDateLabel, { color: colors.textMuted, backgroundColor: colors.surface }]}>
            Gestern · {yesterdayStr}
          </Text>
          {yesterday.map(renderEntry)}
        </View>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Dashboard
// ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { profile, todayStatus, isLoading, fetchTodayStatus } = useAppStore();
  const colors = useColors();
  const [feedTarget, setFeedTarget] = useState<{ catId: string; mealType: MealType } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTodayStatus();
    setRefreshing(false);
  }, []);

  const pendingCount = todayStatus.filter(
    (s) => !s.morning_fed_at || !s.noon_fed_at || !s.evening_fed_at
  ).length;

  const dateStr = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>{dateStr}</Text>
          <Text style={[styles.greeting, { color: colors.text }]}>
            {profile ? getGreeting(profile.display_name) : 'Hallo! 👋'}
          </Text>
          {pendingCount > 0 ? (
            <View style={[styles.alertBanner, { backgroundColor: colors.warningLight, borderLeftColor: colors.warning }]}>
              <Text style={[styles.alertText, { color: colors.warning }]}>
                ⚠️ {pendingCount} {pendingCount === 1 ? 'Katze hat' : 'Katzen haben'} noch offene Mahlzeiten
              </Text>
            </View>
          ) : todayStatus.length > 0 ? (
            <View style={[styles.successBanner, { backgroundColor: colors.successLight, borderLeftColor: colors.success }]}>
              <Text style={[styles.successText, { color: '#166534' }]}>🎉 Alle Katzen wurden heute gefüttert!</Text>
            </View>
          ) : null}
        </View>

        {/* Tipp des Tages */}
        <ActivityCard colors={colors} />

        {/* Futter-Empfehlung für alle Katzen (Morgens / Mittags / Abends) */}
        <AllCatsRecommendationCard colors={colors} />

        {/* Katzen-Karten mit Fütterungsstatus */}
        {todayStatus.map((status) => (
          <CatCard
            key={status.cat_id}
            status={status}
            colors={colors}
            onFeed={(catId, mealType) => setFeedTarget({ catId, mealType })}
          />
        ))}

        {/* Kompakte Verlaufsübersicht */}
        <RecentFeedingsCard colors={colors} />

        {todayStatus.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🐾</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch keine Katzen</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Lege deine Katzen unter "Katzen" an.
            </Text>
          </View>
        )}
      </ScrollView>

      <FeedModal
        visible={Boolean(feedTarget)}
        catId={feedTarget?.catId}
        mealType={feedTarget?.mealType}
        onClose={() => setFeedTarget(null)}
        onSuccess={() => setToast(true)}
      />

      <SuccessToast
        message="Fütterung eingetragen!"
        visible={toast}
        onHide={() => setToast(false)}
      />
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:         { flex: 1 },
  scroll:       { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header:       { marginBottom: 16 },
  dateText:     { fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  greeting:     { fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  alertBanner:  { borderRadius: RADIUS.md, padding: 12, borderLeftWidth: 3 },
  alertText:    { fontWeight: '600', fontSize: 14 },
  successBanner: { borderRadius: RADIUS.md, padding: 12, borderLeftWidth: 3 },
  successText:  { fontWeight: '600', fontSize: 14 },

  // Activity card
  activityCard: {
    borderRadius: RADIUS.xl, padding: 16, marginBottom: 14, ...SHADOWS.sm,
  },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activityTitle:  { fontSize: 14, fontWeight: '700' },
  durationPill:   { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  durationText:   { fontSize: 12, fontWeight: '700' },
  editTipBtn:     { width: 32, height: 32, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  activityBody:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  activityEmojiWrap: { width: 60, height: 60, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  activityEmoji:  { fontSize: 34 },
  activityName:   { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  activityDesc:   { fontSize: 13, lineHeight: 18 },
  activityActions: { flexDirection: 'row', gap: 8 },
  activityBtn: {
    flex: 1, borderRadius: RADIUS.md, paddingVertical: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  activityBtnText: { fontWeight: '700', fontSize: 13 },
  activityBtnSecondary: {
    flex: 1, borderRadius: RADIUS.md, paddingVertical: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  activityBtnSecondaryText: { fontWeight: '600', fontSize: 13 },

  // Cat card
  catCard:      { borderRadius: RADIUS.xl, padding: 20, marginBottom: 8, ...SHADOWS.md },
  catHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  catAvatarWrap: { position: 'relative', marginRight: 14 },
  catAvatar:    { width: 56, height: 56, borderRadius: 999 },
  catAvatarFallback: {
    width: 56, height: 56, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  catAvatarEmoji: { fontSize: 28 },
  catBadge: {
    position: 'absolute', bottom: -2, right: -2,
    borderRadius: 999, width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  catBadgeText:  { color: '#fff', fontSize: 10, fontWeight: '800' },
  catInfo:       { flex: 1 },
  catName:       { fontSize: 20, fontWeight: '800' },
  catSubtitle:   { fontSize: 13, marginTop: 2 },
  mealRow:       { gap: 8 },
  mealPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: RADIUS.md, borderWidth: 1.5,
  },
  mealEmoji:    { fontSize: 20 },
  mealLabel:    { fontSize: 14, fontWeight: '600' },
  mealTime:     { fontSize: 11, marginTop: 1 },
  mealOpenText: { fontSize: 11, marginTop: 1 },
  checkmark:    { marginLeft: 'auto', fontSize: 18, fontWeight: '700' },
  feedBtn: {
    width: 28, height: 28, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center', marginLeft: 'auto',
  },
  feedBtnText:  { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },

  // Recommendation card
  recCard:          { borderRadius: RADIUS.xl, padding: 16, marginBottom: 14, ...SHADOWS.sm },
  recTitle:         { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  mealSection:      { paddingBottom: 10, marginBottom: 10 },
  mealSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  mealSectionEmoji: { fontSize: 16 },
  mealSectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  recRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingLeft: 4 },
  recCatName:       { fontSize: 13, fontWeight: '700', width: 60 },
  recFoodChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6,
  },
  recFoodEmoji:     { fontSize: 18 },
  recFoodName:      { fontSize: 13, fontWeight: '700' },
  recFoodReason:    { fontSize: 10, marginTop: 1 },
  recNoFood:        { fontSize: 12, fontStyle: 'italic' },

  // Recent feedings card
  historyCard:      { borderRadius: RADIUS.xl, padding: 0, marginBottom: 14, ...SHADOWS.sm, overflow: 'hidden' },
  historyTitle:     { fontSize: 14, fontWeight: '700', padding: 14, paddingBottom: 8 },
  historyDateLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 14, paddingVertical: 6,
  },
  feedEntry: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  feedCatAvatar:        { width: 34, height: 34, borderRadius: 999 },
  feedCatAvatarFallback: {
    width: 34, height: 34, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  feedEntryRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  feedCatName:      { fontSize: 13, fontWeight: '700' },
  feedTime:         { fontSize: 11 },
  feedFoodRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  feedFoodIconBadge: { width: 22, height: 22, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  feedFoodName:     { fontSize: 12, flex: 1 },
  feedStatusEmoji:  { fontSize: 16, marginLeft: 4 },
  feedBy:           { fontSize: 11, marginTop: 1 },

  // Empty state
  emptyState:   { alignItems: 'center', paddingTop: 80 },
  emptyEmoji:   { fontSize: 64, marginBottom: 16 },
  emptyTitle:   { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText:    { fontSize: 15, textAlign: 'center' },
});
