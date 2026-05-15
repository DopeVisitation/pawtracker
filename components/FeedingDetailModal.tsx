import { useEffect, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '../lib/theme-context';
import { RADIUS, SHADOWS } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { EATEN_STATUS_LABELS, EatenStatus, MEAL_SCHEDULE, MealType } from '../types';
import { getFoodVisual } from '../lib/foodIcons';

interface FeedingDetail {
  id: string;
  fed_at: string;
  meal_type: MealType;
  eaten_status?: EatenStatus;
  rating?: number;
  notes?: string;
  cat: { name: string; photo_url?: string };
  food?: { name: string; brand?: string; type: string };
  fed_by_profile?: { display_name: string; avatar_url?: string };
}

interface Props {
  visible: boolean;
  catId?: string;
  mealType?: MealType;
  onClose: () => void;
}

export default function FeedingDetailModal({ visible, catId, mealType, onClose }: Props) {
  const colors = useColors();
  const [detail, setDetail] = useState<FeedingDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !catId || !mealType) return;
    setLoading(true);
    setDetail(null);

    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('feedings')
      .select(`
        id, fed_at, meal_type, eaten_status, rating, notes,
        cat:cats(name, photo_url),
        food:foods(name, brand, type),
        fed_by_profile:profiles!feedings_fed_by_fkey(display_name, avatar_url)
      `)
      .eq('cat_id', catId)
      .eq('meal_type', mealType)
      .gte('fed_at', `${today}T00:00:00`)
      .order('fed_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setDetail(data as any);
        setLoading(false);
      });
  }, [visible, catId, mealType]);

  const colors_ = useColors();
  const s = makeStyles(colors);

  const mealInfo = mealType ? MEAL_SCHEDULE[mealType] : null;
  const statusData = detail?.eaten_status ? EATEN_STATUS_LABELS[detail.eaten_status] : null;
  const foodVisual = detail?.food ? getFoodVisual(detail.food as any) : null;
  const time = detail
    ? new Date(detail.fed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.handle} />

        <View style={s.header}>
          <View style={{ width: 36 }} />
          <Text style={s.headerTitle}>
            {mealInfo ? `${mealInfo.emoji} ${mealInfo.label}` : 'Mahlzeit'}
          </Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !detail ? (
          <View style={s.center}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Keine Details gefunden</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.content}>
            {/* Cat info */}
            <View style={[s.catRow, { backgroundColor: colors.primaryLight }]}>
              {detail.cat?.photo_url ? (
                <Image source={{ uri: detail.cat.photo_url }} style={s.catAvatar} contentFit="cover" />
              ) : (
                <View style={[s.catAvatarFallback, { backgroundColor: colors.card }]}>
                  <Text style={{ fontSize: 28 }}>🐱</Text>
                </View>
              )}
              <View>
                <Text style={[s.catName, { color: colors.text }]}>{detail.cat?.name}</Text>
                <Text style={[s.timeText, { color: colors.textSecondary }]}>
                  gefüttert um {time} Uhr
                </Text>
              </View>
            </View>

            {/* Food */}
            {detail.food && foodVisual && (
              <View style={[s.section, { backgroundColor: colors.card }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>Futter</Text>
                <View style={s.foodRow}>
                  <View style={[s.foodIcon, { backgroundColor: foodVisual.bgColor }]}>
                    <Text style={{ fontSize: 28 }}>{foodVisual.emoji}</Text>
                  </View>
                  <View>
                    <Text style={[s.foodName, { color: colors.text }]}>{detail.food.name}</Text>
                    {detail.food.brand && (
                      <Text style={[s.foodBrand, { color: colors.textMuted }]}>{detail.food.brand}</Text>
                    )}
                    <View style={[s.categoryPill, { backgroundColor: foodVisual.bgColor }]}>
                      <Text style={[s.categoryText, { color: foodVisual.color }]}>{foodVisual.label}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Eaten status */}
            {statusData && (
              <View style={[s.section, { backgroundColor: colors.card }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>Wie viel gegessen</Text>
                <View style={s.statusRow}>
                  <Text style={s.statusEmoji}>{statusData.emoji}</Text>
                  <Text style={[s.statusLabel, { color: colors.text }]}>{statusData.label}</Text>
                </View>
              </View>
            )}

            {/* Rating */}
            {detail.rating && (
              <View style={[s.section, { backgroundColor: colors.card }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>Bewertung</Text>
                <Text style={s.stars}>
                  {'★'.repeat(detail.rating)}{'☆'.repeat(5 - detail.rating)}
                </Text>
              </View>
            )}

            {/* Notes */}
            {detail.notes && (
              <View style={[s.section, { backgroundColor: colors.card }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>Notiz</Text>
                <Text style={[s.notesText, { color: colors.text }]}>📝 {detail.notes}</Text>
              </View>
            )}

            {/* Fed by */}
            {detail.fed_by_profile && (
              <View style={[s.section, { backgroundColor: colors.card }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>Eingetragen von</Text>
                <View style={s.fedByRow}>
                  <View style={[s.fedByAvatar, { backgroundColor: colors.primaryLight }]}>
                    <Text style={{ fontSize: 16 }}>👤</Text>
                  </View>
                  <Text style={[s.fedByName, { color: colors.text }]}>
                    {detail.fed_by_profile.display_name}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: colors.text },
  closeBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: colors.textMuted },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText:    { fontSize: 15 },
  content:      { padding: 16, gap: 10, paddingBottom: 40 },

  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: RADIUS.xl, padding: 16,
  },
  catAvatar:        { width: 56, height: 56, borderRadius: 999 },
  catAvatarFallback: {
    width: 56, height: 56, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  catName:    { fontSize: 20, fontWeight: '800' },
  timeText:   { fontSize: 13, marginTop: 2 },

  section:    { borderRadius: RADIUS.xl, padding: 16, ...SHADOWS.sm },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  foodRow:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  foodIcon: {
    width: 56, height: 56, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  foodName:   { fontSize: 17, fontWeight: '700' },
  foodBrand:  { fontSize: 13, marginTop: 2 },
  categoryPill: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  categoryText: { fontSize: 11, fontWeight: '700' },

  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusEmoji:  { fontSize: 36 },
  statusLabel:  { fontSize: 17, fontWeight: '700' },

  stars:        { fontSize: 28, color: '#F59E0B', letterSpacing: 2 },

  notesText:    { fontSize: 15, lineHeight: 22 },

  fedByRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fedByAvatar: {
    width: 36, height: 36, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  fedByName:    { fontSize: 16, fontWeight: '600' },
});
