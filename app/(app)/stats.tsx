import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, Dimensions,
} from 'react-native';
import { useAppStore } from '../../stores/appStore';
import { COLORS, RADIUS, SHADOWS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

// ── Simple bar chart (no library needed for basic stats) ───────
function BarChart({ data, label }: { data: { label: string; value: number; color?: string }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{label}</Text>
      <View style={styles.barsWrap}>
        {data.map((item, i) => (
          <View key={i} style={styles.barGroup}>
            <Text style={styles.barValue}>{item.value}</Text>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color ?? COLORS.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function LeaderboardRow({ rank, name, count, points }: { rank: number; name: string; count: number; points: number }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <View style={styles.leaderRow}>
      <Text style={styles.leaderMedal}>{medals[rank - 1] ?? `${rank}.`}</Text>
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderName}>{name}</Text>
        <Text style={styles.leaderSub}>{count} Fütterungen · {points} Punkte</Text>
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const { household, cats, foods, members, profile } = useAppStore();
  const [stats, setStats] = useState({
    totalFeedings: 0,
    thisWeek: 0,
    missedMeals: 0,
    avgRating: 0,
    feedingsByMember: [] as { name: string; count: number; points: number }[],
    feedingsByMealType: [] as { label: string; value: number }[],
    topFoods: [] as { label: string; value: number }[],
  });

  useEffect(() => {
    if (!household) return;

    const load = async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [allFeedingsRes, weekFeedingsRes, ratingsRes] = await Promise.all([
        supabase.from('feedings').select('id, meal_type, fed_by, food_id, rating').eq('household_id', household.id),
        supabase.from('feedings').select('id').eq('household_id', household.id).gte('fed_at', weekAgo.toISOString()),
        supabase.from('feedings').select('rating').eq('household_id', household.id).not('rating', 'is', null),
      ]);

      const all = allFeedingsRes.data ?? [];
      const weekCount = weekFeedingsRes.data?.length ?? 0;

      // Ratings
      const ratings = ratingsRes.data ?? [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((s, r) => s + (r.rating ?? 0), 0) / ratings.length
        : 0;

      // By member
      const memberMap: Record<string, { count: number }> = {};
      all.forEach((f) => {
        if (f.fed_by) memberMap[f.fed_by] = { count: (memberMap[f.fed_by]?.count ?? 0) + 1 };
      });
      const feedingsByMember = members.map((m) => ({
        name: m.display_name,
        count: memberMap[m.id]?.count ?? 0,
        points: m.points,
      })).sort((a, b) => b.count - a.count);

      // By meal type
      const mealMap: Record<string, number> = { morning: 0, noon: 0, evening: 0, extra: 0 };
      all.forEach((f) => { if (f.meal_type) mealMap[f.meal_type]++; });
      const feedingsByMealType = [
        { label: '🌅 Morgens', value: mealMap.morning },
        { label: '☀️ Mittags', value: mealMap.noon },
        { label: '🌙 Abends',  value: mealMap.evening },
        { label: '⭐ Extra',   value: mealMap.extra },
      ];

      // Top foods
      const foodMap: Record<string, number> = {};
      all.forEach((f) => { if (f.food_id) foodMap[f.food_id] = (foodMap[f.food_id] ?? 0) + 1; });
      const topFoods = Object.entries(foodMap)
        .map(([id, value]) => ({
          label: foods.find((f) => f.id === id)?.name ?? 'Unbekannt',
          value,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      setStats({
        totalFeedings: all.length,
        thisWeek: weekCount,
        missedMeals: 0, // would require more complex logic
        avgRating: Math.round(avgRating * 10) / 10,
        feedingsByMember,
        feedingsByMealType,
        topFoods,
      });
    };

    load();
  }, [household, members, foods]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>📊 Auswertungen</Text>
        <Text style={styles.screenSubtitle}>Überblick über alle Fütterungen</Text>

        {/* Quick stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginBottom: 20 }}>
          <View style={styles.statsRow}>
            <StatCard emoji="🍽️" label="Gesamt" value={String(stats.totalFeedings)} sub="Fütterungen" />
            <StatCard emoji="📅" label="Diese Woche" value={String(stats.thisWeek)} sub="Fütterungen" />
            <StatCard emoji="⭐" label="Ø Bewertung" value={stats.avgRating > 0 ? `${stats.avgRating}/5` : '–'} />
            <StatCard emoji="🐱" label="Katzen" value={String(cats.length)} />
            <StatCard emoji="🥫" label="Futtersorten" value={String(foods.length)} />
          </View>
        </ScrollView>

        {/* Feedings by meal type */}
        <BarChart
          label="Fütterungen nach Mahlzeit"
          data={stats.feedingsByMealType.map((d, i) => ({
            ...d,
            color: [COLORS.morning, COLORS.noon, COLORS.evening, COLORS.success][i],
          }))}
        />

        {/* Top foods */}
        {stats.topFoods.length > 0 && (
          <BarChart
            label="Beliebteste Futtersorten"
            data={stats.topFoods.map((d, i) => ({
              ...d,
              color: [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.morning, COLORS.noon][i],
            }))}
          />
        )}

        {/* Leaderboard */}
        {stats.feedingsByMember.length > 0 && (
          <View style={styles.leaderCard}>
            <Text style={styles.chartTitle}>🏆 Wer füttert am meisten?</Text>
            {stats.feedingsByMember.map((m, i) => (
              <LeaderboardRow key={i} rank={i + 1} name={m.name} count={m.count} points={m.points} />
            ))}
          </View>
        )}

        {/* Points of current user */}
        {profile && (
          <View style={styles.pointsCard}>
            <Text style={styles.pointsEmoji}>🏅</Text>
            <Text style={styles.pointsTitle}>Deine Punkte</Text>
            <Text style={styles.pointsValue}>{profile.points}</Text>
            <Text style={styles.pointsHint}>+10 pro Fütterung · +5 mit Bewertung · +3 mit Notiz</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.background },
  scrollContent:  { padding: 16, paddingBottom: 40 },
  screenTitle:    { fontSize: 26, fontWeight: '800', color: COLORS.text },
  screenSubtitle: { fontSize: 13, color: COLORS.textMuted, marginBottom: 20, marginTop: 2 },

  statsRow:       { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  statCard: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 16,
    alignItems: 'center', minWidth: 100, ...SHADOWS.sm,
  },
  statEmoji:  { fontSize: 28, marginBottom: 6 },
  statValue:  { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  statSub:    { fontSize: 10, color: COLORS.textMuted },

  chartCard: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 20,
    marginBottom: 16, ...SHADOWS.sm,
  },
  chartTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  barsWrap:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 120 },
  barGroup:       { alignItems: 'center', flex: 1 },
  barValue:       { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  barBg: {
    width: 32, height: 80, backgroundColor: COLORS.mutedLight,
    borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill:        { width: '100%', borderRadius: 8 },
  barLabel:       { fontSize: 10, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },

  leaderCard: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 20,
    marginBottom: 16, ...SHADOWS.sm,
  },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  leaderMedal:  { fontSize: 24, width: 32 },
  leaderInfo:   { flex: 1 },
  leaderName:   { fontSize: 16, fontWeight: '700', color: COLORS.text },
  leaderSub:    { fontSize: 12, color: COLORS.textMuted },

  pointsCard: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 24,
    alignItems: 'center', ...SHADOWS.md,
  },
  pointsEmoji:  { fontSize: 40, marginBottom: 8 },
  pointsTitle:  { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  pointsValue:  { fontSize: 48, fontWeight: '800', color: '#fff', marginVertical: 4 },
  pointsHint:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 },
});
