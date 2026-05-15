import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useAppStore } from '../../stores/appStore';
import { useColors } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { getFoodVisual } from '../../lib/foodIcons';
import { EatenStatus } from '../../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CAL_COLS = 7;
const CAL_GAP = 4;
const CAL_CELL = Math.min(
  Math.floor((Math.min(SCREEN_W, 420) - 64 - CAL_GAP * (CAL_COLS - 1)) / CAL_COLS),
  52,
);

interface FeedingData {
  id: string;
  cat_id: string;
  food_id?: string;
  eaten_status?: EatenStatus;
  fed_at: string;
  food?: { name: string; brand?: string; type: string };
}

interface OutdoorData {
  started_at: string;
  ended_at?: string;
}

interface FoodStat {
  food_id: string;
  name: string;
  brand?: string;
  type: string;
  percent: number;
  count: number;
  matchCount: number;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function computeTopFoods(feedings: FeedingData[], statuses: string[], limit: number): FoodStat[] {
  const map: Record<string, { name: string; brand?: string; type: string; total: number; match: number }> = {};
  for (const f of feedings) {
    if (!f.food_id || !f.food || !f.eaten_status) continue;
    if (!map[f.food_id]) map[f.food_id] = { name: f.food.name, brand: f.food.brand, type: f.food.type, total: 0, match: 0 };
    map[f.food_id].total++;
    if (statuses.includes(f.eaten_status)) map[f.food_id].match++;
  }
  return Object.entries(map)
    .filter(([_, v]) => v.match > 0)
    .map(([id, v]) => ({
      food_id: id, name: v.name, brand: v.brand, type: v.type,
      percent: Math.round((v.match / v.total) * 100),
      count: v.total, matchCount: v.match,
    }))
    .sort((a, b) => b.percent - a.percent || b.matchCount - a.matchCount)
    .slice(0, limit);
}

function computeMonthCalendar(feedings: FeedingData[], month: Date) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const dayMap: Record<number, { total: number; score: number }> = {};
  for (const f of feedings) {
    if (!f.eaten_status) continue;
    const d = new Date(f.fed_at);
    if (d.getMonth() !== m || d.getFullYear() !== year) continue;
    const day = d.getDate();
    if (!dayMap[day]) dayMap[day] = { total: 0, score: 0 };
    dayMap[day].total++;
    const score = ({ all: 4, most: 3, little: 2, none: 1 } as any)[f.eaten_status] ?? 0;
    dayMap[day].score += score;
  }
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const data = dayMap[day];
    const avg = data && data.total > 0 ? data.score / data.total : null;
    return { day, avg, total: data?.total ?? 0 };
  });
}

function computeOutdoorByDay(sessions: OutdoorData[], days: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    const dateStr = date.toDateString();
    const label = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const minutes = sessions
      .filter((s) => s.ended_at && new Date(s.started_at).toDateString() === dateStr)
      .reduce((sum, s) => sum + Math.round((new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000), 0);
    return { label, minutes };
  });
}

function calColor(avg: number | null, mutedLight: string): string {
  if (avg === null) return mutedLight;
  if (avg >= 3.5) return '#16a34a';
  if (avg >= 2.5) return '#86efac';
  if (avg >= 1.5) return '#fb923c';
  return '#f87171';
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────
function FoodRankRow({ rank, stat, isFlop, colors }: { rank: number; stat: FoodStat; isFlop: boolean; colors: any }) {
  const visual = getFoodVisual({ name: stat.name, brand: stat.brand, type: stat.type } as any);
  return (
    <View style={[rankRow.row, { borderBottomColor: colors.border }]}>
      <Text style={[rankRow.rank, { color: colors.textMuted }]}>{rank}.</Text>
      <View style={[rankRow.icon, { backgroundColor: visual.bgColor }]}>
        <Text style={{ fontSize: 18 }}>{visual.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rankRow.name, { color: colors.text }]} numberOfLines={1}>
          {stat.name}{stat.brand ? ` (${stat.brand})` : ''}
        </Text>
        <Text style={[rankRow.sub, { color: colors.textMuted }]}>{stat.count}× eingetragen</Text>
      </View>
      <View style={[rankRow.badge, { backgroundColor: isFlop ? '#fee2e2' : '#dcfce7' }]}>
        <Text style={[rankRow.percent, { color: isFlop ? '#dc2626' : '#16a34a' }]}>{stat.percent}%</Text>
        <Text style={[rankRow.matchCount, { color: isFlop ? '#ef4444' : '#22c55e' }]}>{stat.matchCount}×</Text>
      </View>
    </View>
  );
}
const rankRow = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rank:       { fontSize: 15, fontWeight: '700', width: 22 },
  icon:       { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  name:       { fontSize: 13, fontWeight: '600' },
  sub:        { fontSize: 11, marginTop: 1 },
  badge:      { alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 52 },
  percent:    { fontSize: 16, fontWeight: '800' },
  matchCount: { fontSize: 11, fontWeight: '600' },
});

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const { household, cats } = useAppStore();
  const colors = useColors();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [feedings, setFeedings] = useState<FeedingData[]>([]);
  const [outdoorSessions, setOutdoorSessions] = useState<OutdoorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [feedRes, outdoorRes] = await Promise.all([
      supabase.from('feedings')
        .select('id, cat_id, food_id, eaten_status, fed_at, food:foods(name, brand, type)')
        .eq('household_id', household.id)
        .gte('fed_at', monthStart.toISOString())
        .lte('fed_at', monthEnd.toISOString()),
      supabase.from('outdoor_sessions')
        .select('started_at, ended_at')
        .eq('household_id', household.id)
        .eq('is_active', false)
        .gte('started_at', thirtyDaysAgo.toISOString()),
    ]);

    setFeedings((feedRes.data as any[]) ?? []);
    setOutdoorSessions((outdoorRes.data as any[]) ?? []);
    setLoading(false);
  }, [household?.id, selectedMonth]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const prevMonth = () => setSelectedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    const now = new Date(); now.setDate(1);
    if (next <= now) setSelectedMonth(next);
  };
  const isCurrentMonth =
    selectedMonth.getMonth() === new Date().getMonth() &&
    selectedMonth.getFullYear() === new Date().getFullYear();

  const filtered = selectedCatId ? feedings.filter((f) => f.cat_id === selectedCatId) : feedings;
  const topFav = computeTopFoods(filtered, ['all'], 5);
  const topFlop = computeTopFoods(filtered, ['little', 'none'], 5);
  const calData = computeMonthCalendar(filtered, selectedMonth);
  const outdoorData = computeOutdoorByDay(outdoorSessions, 7);
  const maxOutdoor = Math.max(...outdoorData.map((d) => d.minutes), 1);

  // Calendar first-day offset (Monday = 0)
  const firstDow = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
  const calOffset = firstDow === 0 ? 6 : firstDow - 1;

  const monthLabel = selectedMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const selectedCatName = selectedCatId ? (cats.find((c) => c.id === selectedCatId)?.name ?? 'Alle') : 'Alle';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>📊 Auswertungen</Text>
        <Text style={[s.subtitle, { color: colors.textMuted }]}>{selectedCatName}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Month navigator */}
          <View style={[s.monthNav, { backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Text style={[s.navArrow, { color: colors.primary }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[s.navLabel, { color: colors.text }]}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn} disabled={isCurrentMonth}>
              <Text style={[s.navArrow, { color: isCurrentMonth ? colors.textMuted : colors.primary }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Cat filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={s.catRow}>
              {[{ id: null as string | null, name: 'Alle' }, ...cats.map((c) => ({ id: c.id, name: c.name }))].map((cat) => (
                <TouchableOpacity
                  key={cat.id ?? 'all'}
                  style={[s.catPill, { backgroundColor: selectedCatId === cat.id ? colors.primary : colors.card }]}
                  onPress={() => setSelectedCatId(cat.id)}
                >
                  <Text style={[s.catPillText, { color: selectedCatId === cat.id ? '#fff' : colors.text }]}>
                    {cat.id ? '🐱 ' : ''}{cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Top 5 Lieblinge */}
          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>❤️ Top 5 Lieblingsfutter</Text>
            <Text style={[s.cardSub, { color: colors.textMuted }]}>% "Sehr gut gefressen" aller Einträge</Text>
            {topFav.length > 0
              ? topFav.map((stat, i) => <FoodRankRow key={stat.food_id} rank={i + 1} stat={stat} isFlop={false} colors={colors} />)
              : <Text style={[s.empty, { color: colors.textMuted }]}>Noch keine Daten</Text>
            }
          </View>

          {/* Top 5 Flops */}
          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>😿 Top 5 Flop-Futter</Text>
            <Text style={[s.cardSub, { color: colors.textMuted }]}>% "Wenig/Verweigert" aller Einträge</Text>
            {topFlop.length > 0
              ? topFlop.map((stat, i) => <FoodRankRow key={stat.food_id} rank={i + 1} stat={stat} isFlop={true} colors={colors} />)
              : <Text style={[s.empty, { color: colors.textMuted }]}>Noch keine Daten</Text>
            }
          </View>

          {/* Freigang letzte 7 Tage */}
          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>🌿 Freigang letzte 7 Tage</Text>
            {outdoorData.some((d) => d.minutes > 0) ? (
              <View style={s.barChart}>
                {outdoorData.map((d, i) => (
                  <View key={i} style={s.barGroup}>
                    <Text style={[s.barValue, { color: colors.textSecondary }]}>
                      {d.minutes > 0 ? (d.minutes >= 60 ? `${Math.floor(d.minutes / 60)}h` : `${d.minutes}m`) : ''}
                    </Text>
                    <View style={[s.barBg, { backgroundColor: colors.mutedLight }]}>
                      <View style={[s.barFill, {
                        height: `${(d.minutes / maxOutdoor) * 100}%`,
                        backgroundColor: colors.primary,
                        opacity: d.minutes > 0 ? 1 : 0.2,
                      }]} />
                    </View>
                    <Text style={[s.barLabel, { color: colors.textMuted }]}>{d.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[s.empty, { color: colors.textMuted }]}>Keine Freigang-Daten für diesen Zeitraum</Text>
            )}
          </View>

          {/* Monatsübersicht Kalender */}
          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>📅 Monatsübersicht</Text>
            <Text style={[s.cardSub, { color: colors.textMuted }]}>Ø Fressqualität pro Tag</Text>

            {/* Legend */}
            <View style={s.legend}>
              {([
                { color: '#16a34a', label: 'Super' },
                { color: '#86efac', label: 'Gut' },
                { color: '#fb923c', label: 'Wenig' },
                { color: '#f87171', label: 'Kaum' },
                { color: colors.mutedLight, label: 'Keine Daten' },
              ] as const).map((item) => (
                <View key={item.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[s.legendText, { color: colors.textMuted }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Weekday headers */}
            <View style={s.calGrid}>
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                <View key={d} style={[s.calCell, { backgroundColor: 'transparent' }]}>
                  <Text style={[s.calWeekday, { color: colors.textMuted }]}>{d}</Text>
                </View>
              ))}
              {/* Offset empty cells */}
              {Array.from({ length: calOffset }, (_, i) => (
                <View key={`e${i}`} style={[s.calCell, { backgroundColor: 'transparent' }]} />
              ))}
              {/* Day cells */}
              {calData.map(({ day, avg, total }) => (
                <View key={day} style={[s.calCell, { backgroundColor: calColor(avg, colors.mutedLight) }]}>
                  <Text style={[s.calNum, { color: avg !== null ? '#fff' : colors.textMuted }]}>{day}</Text>
                  {total > 0 && (
                    <Text style={[s.calCount, { color: avg !== null ? 'rgba(255,255,255,0.8)' : colors.textMuted }]}>
                      {total}×
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },
  header:   { padding: 20, paddingBottom: 8 },
  title:    { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:   { padding: 16, paddingBottom: 40 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: RADIUS.xl, padding: 8, marginBottom: 12 },
  navBtn:   { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  navArrow: { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  navLabel: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },

  catRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  catPill:     { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  catPillText: { fontSize: 13, fontWeight: '700' },

  card:      { borderRadius: RADIUS.xl, padding: 16, marginBottom: 14, ...SHADOWS.sm },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  cardSub:   { fontSize: 12, marginBottom: 12 },
  empty:     { fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 4, marginTop: 8 },
  barGroup: { flex: 1, alignItems: 'center' },
  barValue: { fontSize: 9, fontWeight: '700', marginBottom: 2, height: 12 },
  barBg:    { width: '100%', height: 72, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill:  { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 9, marginTop: 4, textAlign: 'center' },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 10, height: 10, borderRadius: 999 },
  legendText: { fontSize: 11 },

  calGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: CAL_GAP },
  calCell:    { width: CAL_CELL, height: CAL_CELL, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  calWeekday: { fontSize: 10, fontWeight: '700' },
  calNum:     { fontSize: 11, fontWeight: '700' },
  calCount:   { fontSize: 9 },
});
