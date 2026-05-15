import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { useColors } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { EATEN_STATUS_LABELS, EatenStatus } from '../../types';
import { getFoodEmoji } from '../../lib/foodIcons';

interface HistoryEntry {
  id: string;
  fed_at: string;
  meal_type: string;
  notes?: string;
  rating?: number;
  eaten_status?: EatenStatus;
  cat: { name: string; photo_url?: string };
  food?: { name: string; brand?: string; type: string };
  fed_by_profile?: { display_name: string };
}

function HistoryItem({ item, colors }: { item: HistoryEntry; colors: ReturnType<typeof useColors> }) {
  const time = new Date(item.fed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const eaten = item.eaten_status ? EATEN_STATUS_LABELS[item.eaten_status] : null;
  const foodEmoji = item.food ? getFoodEmoji(item.food as any) : '🍽️';
  const mealEmoji = { morning: '🌅', noon: '☀️', evening: '🌙', extra: '⭐' }[item.meal_type] ?? '🍽️';

  return (
    <View style={[styles.item, { backgroundColor: colors.card }]}>
      {/* Left: Cat avatar */}
      <View style={styles.itemLeft}>
        {item.cat?.photo_url ? (
          <Image source={{ uri: item.cat.photo_url }} style={styles.catAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.catAvatarFallback, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ fontSize: 20 }}>🐱</Text>
          </View>
        )}
        <View style={[styles.timeLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Right: Content */}
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={[styles.catName, { color: colors.text }]}>{item.cat?.name}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{mealEmoji} {time}</Text>
        </View>

        {item.food && (
          <View style={styles.foodRow}>
            <Text style={styles.foodEmoji}>{foodEmoji}</Text>
            <Text style={[styles.foodName, { color: colors.textSecondary }]}>
              {item.food.name}
              {item.food.brand ? ` (${item.food.brand})` : ''}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          {eaten && (
            <View style={[styles.eatenBadge, {
              backgroundColor: item.eaten_status === 'all' ? colors.successLight
                : item.eaten_status === 'none' ? colors.dangerLight
                : colors.surface,
            }]}>
              <Text style={styles.eatenEmoji}>{eaten.emoji}</Text>
              <Text style={[styles.eatenLabel, {
                color: item.eaten_status === 'all' ? '#166534'
                  : item.eaten_status === 'none' ? colors.danger
                  : colors.textSecondary,
              }]}>
                {eaten.label}
              </Text>
            </View>
          )}
          {item.rating && (
            <Text style={styles.stars}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</Text>
          )}
        </View>
        {item.fed_by_profile && (
          <Text style={[styles.fedBy, { color: colors.textMuted }]}>
            von {item.fed_by_profile.display_name}
          </Text>
        )}

        {item.notes && (
          <Text style={[styles.notes, { color: colors.textMuted }]}>📝 {item.notes}</Text>
        )}
      </View>
    </View>
  );
}

function groupByDate(feedings: HistoryEntry[]) {
  const groups: Record<string, HistoryEntry[]> = {};
  for (const f of feedings) {
    const date = new Date(f.fed_at).toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(f);
  }
  return groups;
}

export default function HistoryScreen() {
  const { household } = useAppStore();
  const colors = useColors();
  const [feedings, setFeedings] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('feedings')
      .select(`
        id, fed_at, meal_type, notes, rating, eaten_status,
        cat:cats(name, photo_url),
        food:foods(name, brand, type),
        fed_by_profile:profiles!feedings_fed_by_fkey(display_name)
      `)
      .eq('household_id', household.id)
      .order('fed_at', { ascending: false })
      .limit(100);

    setFeedings((data as any[]) ?? []);
    setLoading(false);
  }, [household]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const groups = groupByDate(feedings);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>📋 Verlauf</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {feedings.length} Fütterungen gespeichert
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {Object.entries(groups).map(([date, items]) => (
            <View key={date}>
              <View style={[styles.dateHeader, { backgroundColor: colors.background }]}>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{date}</Text>
                <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
              </View>
              {items.map((item) => (
                <HistoryItem key={item.id} item={item} colors={colors} />
              ))}
            </View>
          ))}

          {feedings.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch kein Verlauf</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Trage Fütterungen ein um sie hier zu sehen.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { padding: 20, paddingBottom: 8 },
  title:        { fontSize: 26, fontWeight: '800' },
  subtitle:     { fontSize: 13, marginTop: 2 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },

  dateHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  dateText:     { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  dateLine:     { flex: 1, height: 1 },

  item:         { flexDirection: 'row', marginHorizontal: 16, marginBottom: 2, borderRadius: RADIUS.lg, ...SHADOWS.sm },
  itemLeft:     { alignItems: 'center', paddingTop: 12, paddingLeft: 12, paddingRight: 8, paddingBottom: 0 },
  catAvatar:    { width: 40, height: 40, borderRadius: 999 },
  catAvatarFallback: {
    width: 40, height: 40, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  timeLine:     { width: 2, flex: 1, marginTop: 6 },
  itemContent:  { flex: 1, padding: 12 },
  itemHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catName:      { fontSize: 15, fontWeight: '700' },
  time:         { fontSize: 12 },
  foodRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  foodEmoji:    { fontSize: 16 },
  foodName:     { fontSize: 13, fontWeight: '500' },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  eatenBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.md, paddingHorizontal: 8, paddingVertical: 4 },
  eatenEmoji:   { fontSize: 15 },
  eatenLabel:   { fontSize: 12, fontWeight: '600' },
  stars:        { fontSize: 13, color: '#F59E0B', letterSpacing: 1 },
  fedBy:        { fontSize: 11, marginBottom: 2 },
  notes:        { fontSize: 12, fontStyle: 'italic', marginTop: 4 },

  empty:        { alignItems: 'center', paddingTop: 80, padding: 24 },
  emptyTitle:   { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText:    { fontSize: 14, textAlign: 'center' },
});
