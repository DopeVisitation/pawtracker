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
import { getFoodVisual } from '../../lib/foodIcons';

interface NoteEntry {
  id: string;
  fed_at: string;
  notes: string;
  meal_type: string;
  cat: { name: string; photo_url?: string };
  food?: { name: string; brand?: string; type: string };
  fed_by_profile?: { display_name: string };
}

export default function NotesScreen() {
  const { household } = useAppStore();
  const colors = useColors();
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('feedings')
      .select(`
        id, fed_at, notes, meal_type,
        cat:cats(name, photo_url),
        food:foods(name, brand, type),
        fed_by_profile:profiles!feedings_fed_by_fkey(display_name)
      `)
      .eq('household_id', household.id)
      .not('notes', 'is', null)
      .neq('notes', '')
      .order('fed_at', { ascending: false })
      .limit(100);
    setNotes((data as any[]) ?? []);
    setLoading(false);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const mealEmoji = (t: string) =>
    ({ morning: '🌅', noon: '☀️', evening: '🌙', extra: '⭐' }[t] ?? '🍽️');

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Group by date
  const grouped: Record<string, NoteEntry[]> = {};
  for (const n of notes) {
    const key = formatDate(n.fed_at);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>📝 Notizen</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {notes.length} Notizen aus Fütterungen
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {Object.entries(grouped).map(([date, items]) => (
            <View key={date}>
              <View style={styles.dateRow}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{date}</Text>
                <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
              </View>

              {items.map((item) => {
                const visual = item.food ? getFoodVisual(item.food as any) : null;
                return (
                  <View key={item.id} style={[styles.noteCard, { backgroundColor: colors.card }]}>
                    {/* Header: cat + meal */}
                    <View style={styles.noteHeader}>
                      <View style={styles.catRow}>
                        {item.cat?.photo_url ? (
                          <Image source={{ uri: item.cat.photo_url }} style={styles.catAvatar} contentFit="cover" />
                        ) : (
                          <View style={[styles.catAvatarFallback, { backgroundColor: colors.primaryLight }]}>
                            <Text style={{ fontSize: 14 }}>🐱</Text>
                          </View>
                        )}
                        <Text style={[styles.catName, { color: colors.text }]}>{item.cat?.name}</Text>
                      </View>
                      <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
                        {mealEmoji(item.meal_type)} {formatTime(item.fed_at)}
                      </Text>
                    </View>

                    {/* Food */}
                    {item.food && visual && (
                      <View style={[styles.foodRow, { backgroundColor: visual.bgColor }]}>
                        <Text style={{ fontSize: 14 }}>{visual.emoji}</Text>
                        <Text style={[styles.foodName, { color: visual.color }]}>
                          {item.food.name}{item.food.brand ? ` (${item.food.brand})` : ''}
                        </Text>
                      </View>
                    )}

                    {/* Note text */}
                    <View style={[styles.noteTextWrap, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.noteText, { color: colors.text }]}>{item.notes}</Text>
                    </View>

                    {/* Author */}
                    {item.fed_by_profile && (
                      <Text style={[styles.author, { color: colors.textMuted }]}>
                        — {item.fed_by_profile.display_name}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {notes.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📝</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch keine Notizen</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Füge beim Eintragen einer Fütterung eine Notiz hinzu — sie erscheint hier.
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
  scrollContent: { padding: 16, paddingBottom: 40 },

  dateRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  dateLabel:    { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  dateLine:     { flex: 1, height: 1 },

  noteCard:     { borderRadius: RADIUS.xl, padding: 14, marginBottom: 10, ...SHADOWS.sm },
  noteHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catAvatar:    { width: 28, height: 28, borderRadius: 999 },
  catAvatarFallback: { width: 28, height: 28, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  catName:      { fontSize: 14, fontWeight: '700' },
  timeLabel:    { fontSize: 12 },

  foodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 10, alignSelf: 'flex-start',
  },
  foodName:     { fontSize: 12, fontWeight: '700' },

  noteTextWrap: { borderRadius: RADIUS.md, padding: 12, marginBottom: 8 },
  noteText:     { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  author:       { fontSize: 11, textAlign: 'right' },

  empty:        { alignItems: 'center', paddingTop: 80, padding: 24 },
  emptyTitle:   { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText:    { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
