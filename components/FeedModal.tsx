import { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useAppStore } from '../stores/appStore';
import { useColors } from '../lib/theme-context';
import { RADIUS, SHADOWS } from '../lib/theme';
import { MealType, MEAL_SCHEDULE, EATEN_STATUS_LABELS, EatenStatus } from '../types';
import { getFoodVisual } from '../lib/foodIcons';

interface Props {
  visible: boolean;
  catId?: string;
  mealType?: MealType;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function FeedModal({ visible, catId, mealType, onClose, onSuccess }: Props) {
  const { cats, foods, addFeeding } = useAppStore();
  const colors = useColors();
  const [selectedFood, setSelectedFood] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number | undefined>();
  const [eatenStatus, setEatenStatus] = useState<EatenStatus | undefined>();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cat = cats.find((c) => c.id === catId);
  const mealInfo = mealType ? MEAL_SCHEDULE[mealType] : null;

  const reset = () => {
    setSelectedFood(undefined);
    setNotes('');
    setRating(undefined);
    setEatenStatus(undefined);
    setErrorMsg('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!catId || !mealType) return;
    setErrorMsg('');
    setLoading(true);

    const { error } = await addFeeding({
      cat_id: catId,
      food_id: selectedFood,
      meal_type: mealType,
      notes: notes.trim() || undefined,
      eaten_status: eatenStatus,
      rating,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error);
      return;
    }

    reset();
    onSuccess?.();
    onClose();
  };

  const s = makeStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={s.container}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>Fütterung eintragen</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {/* Cat info */}
          <View style={s.infoCard}>
            <View style={s.catAvatarWrap}>
              {cat?.photo_url ? (
                <Image source={{ uri: cat.photo_url }} style={s.catAvatar} contentFit="cover" />
              ) : (
                <View style={s.catAvatarFallback}>
                  <Text style={{ fontSize: 32 }}>🐱</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={s.catName}>{cat?.name}</Text>
              {mealInfo && (
                <Text style={s.mealLabel}>{mealInfo.emoji} {mealInfo.label}</Text>
              )}
            </View>
          </View>

          {/* Error */}
          {errorMsg ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          {/* Food selection */}
          <Text style={s.sectionLabel}>Futter wählen</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.foodScroll}>
            {foods.map((food) => {
              const isSelected = selectedFood === food.id;
              const visual = getFoodVisual(food);
              const label = food.brand ? `${food.name}\n(${food.brand})` : food.name;
              return (
                <TouchableOpacity
                  key={food.id}
                  style={[s.foodChip, isSelected && s.foodChipSelected]}
                  onPress={() => setSelectedFood(isSelected ? undefined : food.id)}
                  activeOpacity={0.8}
                >
                  {food.photo_url ? (
                    <Image source={{ uri: food.photo_url }} style={s.foodPhoto} contentFit="cover" />
                  ) : (
                    <View style={[s.foodIconBadge, { backgroundColor: isSelected ? visual.color + '30' : visual.bgColor }]}>
                      <Text style={s.foodEmoji}>{visual.emoji}</Text>
                    </View>
                  )}
                  <Text
                    style={[s.foodCategoryLabel, { color: visual.color }]}
                    numberOfLines={1}
                  >
                    {visual.label}
                  </Text>
                  <Text
                    style={[s.foodName, isSelected && { color: colors.primary }]}
                    numberOfLines={2}
                    textBreakStrategy="simple"
                  >
                    {label}
                  </Text>
                  {food.stock_count <= food.min_stock && (
                    <View style={s.lowStockDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Rating */}
          <Text style={s.sectionLabel}>Bewertung (optional)</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star === rating ? undefined : star)}>
                <Text style={[s.star, (rating ?? 0) >= star && s.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Eaten status */}
          <Text style={s.sectionLabel}>Wie viel gegessen?</Text>
          <View style={s.statusGrid}>
            {(Object.entries(EATEN_STATUS_LABELS) as [EatenStatus, { label: string; emoji: string }][]).map(
              ([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.statusBtn, eatenStatus === key && s.statusBtnActive]}
                  onPress={() => setEatenStatus(key === eatenStatus ? undefined : key)}
                  activeOpacity={0.8}
                >
                  <Text style={s.statusEmoji}>{val.emoji}</Text>
                  <Text style={[s.statusLabel, eatenStatus === key && { color: colors.primary }]} numberOfLines={2}>
                    {val.label}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Notes */}
          <Text style={s.sectionLabel}>Notiz (optional)</Text>
          <TextInput
            style={s.notesInput}
            placeholder="z.B. hat heute sehr gut gefressen…"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </ScrollView>

        {/* Submit */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitText}>✅ Fütterung eintragen</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.card },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  closeBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: colors.textMuted },
  title:        { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll:       { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 8 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: colors.primaryLight, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 24,
  },
  catAvatarWrap: {},
  catAvatar:     { width: 56, height: 56, borderRadius: 999 },
  catAvatarFallback: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center',
  },
  catName:      { fontSize: 20, fontWeight: '800', color: colors.text },
  mealLabel:    { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  errorBox: {
    backgroundColor: colors.dangerLight, borderRadius: RADIUS.md,
    padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: colors.danger,
  },
  errorText:    { color: colors.danger, fontSize: 14, fontWeight: '500' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 12, marginTop: 4 },
  foodScroll:   { marginBottom: 20, marginHorizontal: -20, paddingHorizontal: 20 },
  foodChip: {
    alignItems: 'center', padding: 10, borderRadius: RADIUS.lg,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent',
    marginRight: 10, width: 92,
  },
  foodChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  foodPhoto:        { width: 44, height: 44, borderRadius: 8, marginBottom: 4 },
  foodIconBadge: {
    width: 52, height: 52, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  foodEmoji:        { fontSize: 28 },
  foodCategoryLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  foodName: {
    fontSize: 10, fontWeight: '600', color: colors.textSecondary,
    textAlign: 'center', lineHeight: 14,
  },
  lowStockDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning,
  },
  starsRow:     { flexDirection: 'row', gap: 8, marginBottom: 20 },
  star:         { fontSize: 36, color: colors.border },
  starActive:   { color: colors.accent },
  statusGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statusBtn: {
    flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: RADIUS.md, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
  },
  statusBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  statusEmoji:  { fontSize: 20 },
  statusLabel:  { fontSize: 12, fontWeight: '600', color: colors.textSecondary, flex: 1 },
  notesInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: RADIUS.md,
    padding: 14, fontSize: 15, color: colors.text,
    backgroundColor: colors.inputBg, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 16,
  },
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: colors.border },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: RADIUS.lg,
    paddingVertical: 18, alignItems: 'center',
    ...SHADOWS.md,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
