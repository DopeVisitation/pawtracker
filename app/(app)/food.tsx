import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, Modal, TextInput, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../lib/theme';
import { Food, FoodType } from '../../types';

const FOOD_TYPE_LABELS: Record<FoodType, { label: string; emoji: string; color: string }> = {
  wet:         { label: 'Nassfutter',    emoji: '🥫', color: '#3B82F6' },
  dry:         { label: 'Trockenfutter', emoji: '🌾', color: '#F59E0B' },
  treat:       { label: 'Leckerli',      emoji: '🐟', color: '#EC4899' },
  supplement:  { label: 'Ergänzung',     emoji: '💊', color: '#8B5CF6' },
};

function StockBar({ stock, minStock }: { stock: number; minStock: number }) {
  const ratio = Math.min(stock / Math.max(minStock * 3, 1), 1);
  const isLow = stock <= minStock;
  const color = isLow ? COLORS.danger : ratio < 0.4 ? COLORS.warning : COLORS.success;

  return (
    <View style={styles.stockBarWrap}>
      <View style={styles.stockBarBg}>
        <View style={[styles.stockBarFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.stockLabel, { color }]}>
        {stock} {isLow ? '⚠️ Niedrig' : 'auf Lager'}
      </Text>
    </View>
  );
}

function FoodCard({ food }: { food: Food }) {
  const { updateFoodStock } = useAppStore();
  const typeInfo = FOOD_TYPE_LABELS[food.type];

  return (
    <View style={styles.foodCard}>
      <View style={styles.foodCardHeader}>
        <View style={styles.foodIconWrap}>
          {food.photo_url ? (
            <Image source={{ uri: food.photo_url }} style={styles.foodPhoto} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 32 }}>{typeInfo.emoji}</Text>
          )}
        </View>
        <View style={styles.foodInfo}>
          <Text style={styles.foodName}>{food.name}</Text>
          {food.brand && <Text style={styles.foodBrand}>{food.brand}</Text>}
          <View style={[styles.foodTypePill, { backgroundColor: typeInfo.color + '20' }]}>
            <Text style={[styles.foodTypePillText, { color: typeInfo.color }]}>
              {typeInfo.emoji} {typeInfo.label}
            </Text>
          </View>
        </View>
        <View style={styles.stockControls}>
          <TouchableOpacity
            style={styles.stockBtn}
            onPress={() => updateFoodStock(food.id, -1)}
          >
            <Text style={styles.stockBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stockCount}>{food.stock_count}</Text>
          <TouchableOpacity
            style={[styles.stockBtn, styles.stockBtnAdd]}
            onPress={() => updateFoodStock(food.id, 1)}
          >
            <Text style={[styles.stockBtnText, { color: COLORS.primary }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <StockBar stock={food.stock_count} minStock={food.min_stock} />
    </View>
  );
}

function AddFoodModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addFood } = useAppStore();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [type, setType] = useState<FoodType>('wet');
  const [stock, setStock] = useState('10');
  const [minStock, setMinStock] = useState('5');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name fehlt', 'Bitte einen Namen für das Futter eingeben.');
      return;
    }
    await addFood({
      name: name.trim(),
      brand: brand.trim() || undefined,
      type,
      stock_count: parseInt(stock) || 0,
      min_stock: parseInt(minStock) || 5,
      unit: 'Portion',
    });
    setName(''); setBrand(''); setType('wet'); setStock('10'); setMinStock('5');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.handle} />
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>Abbrechen</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Futter hinzufügen</Text>
          <TouchableOpacity onPress={handleSave}><Text style={styles.saveText}>Speichern</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="z.B. Lachs Menü" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Marke</Text>
          <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="z.B. Whiskas" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Art</Text>
          <View style={styles.typeGrid}>
            {(Object.entries(FOOD_TYPE_LABELS) as [FoodType, any][]).map(([key, val]) => (
              <TouchableOpacity
                key={key}
                style={[styles.typeBtn, type === key && styles.typeBtnActive]}
                onPress={() => setType(key)}
              >
                <Text style={styles.typeEmoji}>{val.emoji}</Text>
                <Text style={[styles.typeLabel, type === key && styles.typeLabelActive]}>{val.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Anfangsbestand</Text>
              <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Mindestbestand</Text>
              <TextInput style={styles.input} value={minStock} onChangeText={setMinStock} keyboardType="number-pad" />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function FoodScreen() {
  const { foods } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const lowStockFoods = foods.filter((f) => f.stock_count <= f.min_stock);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>🥫 Futtervorrat</Text>
          <Text style={styles.screenSubtitle}>{foods.length} Sorten verfügbar</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {lowStockFoods.length > 0 && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>⚠️ Niedriger Bestand</Text>
            <Text style={styles.alertText}>
              {lowStockFoods.map((f) => f.name).join(', ')} müssen bald nachgekauft werden.
            </Text>
          </View>
        )}

        {foods.map((food) => (
          <FoodCard key={food.id} food={food} />
        ))}

        {foods.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🥫</Text>
            <Text style={styles.emptyTitle}>Noch kein Futter</Text>
            <Text style={styles.emptyText}>Füge Futtersorten hinzu, um den Vorrat zu tracken.</Text>
          </View>
        )}
      </ScrollView>

      <AddFoodModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 12,
  },
  screenTitle:    { fontSize: 26, fontWeight: '800', color: COLORS.text },
  screenSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  addBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  addBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  scrollContent:  { padding: 16, paddingBottom: 32 },

  alertCard: {
    backgroundColor: COLORS.warningLight, borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 16, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  alertTitle:     { fontWeight: '700', color: COLORS.warning, marginBottom: 4 },
  alertText:      { fontSize: 13, color: '#92400E' },

  foodCard: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 16,
    marginBottom: 12, ...SHADOWS.sm,
  },
  foodCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  foodIconWrap: {
    width: 56, height: 56, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  foodPhoto:      { width: 56, height: 56, borderRadius: RADIUS.md },
  foodInfo:       { flex: 1 },
  foodName:       { fontSize: 16, fontWeight: '700', color: COLORS.text },
  foodBrand:      { fontSize: 13, color: COLORS.textMuted },
  foodTypePill: {
    alignSelf: 'flex-start', borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
  },
  foodTypePillText: { fontSize: 11, fontWeight: '600' },

  stockControls:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockBtn: {
    width: 32, height: 32, borderRadius: 999, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
  stockBtnAdd:    { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primaryLight },
  stockBtnText:   { fontSize: 20, fontWeight: '700', color: COLORS.textSecondary, lineHeight: 24 },
  stockCount:     { fontSize: 18, fontWeight: '800', color: COLORS.text, minWidth: 28, textAlign: 'center' },

  stockBarWrap:   { gap: 6 },
  stockBarBg:     { height: 6, backgroundColor: COLORS.mutedLight, borderRadius: 999 },
  stockBarFill:   { height: 6, borderRadius: 999 },
  stockLabel:     { fontSize: 12, fontWeight: '600' },

  emptyState:     { alignItems: 'center', paddingTop: 80 },
  emptyTitle:     { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText:      { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelText:   { fontSize: 16, color: COLORS.textMuted },
  saveText:     { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  typeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  typeBtn: {
    flex: 1, minWidth: '45%', alignItems: 'center', padding: 12,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  typeEmoji:    { fontSize: 28, marginBottom: 4 },
  typeLabel:    { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  typeLabelActive: { color: COLORS.primary },
});
