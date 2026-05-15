import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, Modal, TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../../stores/appStore';
import { useColors } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

interface LitterBox {
  id: string;
  name: string;
  location?: string;
  last_cleaning?: {
    cleaned_at: string;
    cleaned_by_name: string;
  };
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Gerade eben';
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return `vor ${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ──────────────────────────────────────────────────────────────
// LitterBoxCard
// ──────────────────────────────────────────────────────────────
function LitterBoxCard({
  box, onClean, onDelete, colors,
}: {
  box: LitterBox;
  onClean: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const hasRecent = box.last_cleaning &&
    Date.now() - new Date(box.last_cleaning.cleaned_at).getTime() < 86400000;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: hasRecent ? colors.successLight : colors.warningLight }]}>
          <Text style={{ fontSize: 26 }}>🚿</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.boxName, { color: colors.text }]}>{box.name}</Text>
          {box.location && (
            <Text style={[styles.boxLocation, { color: colors.textMuted }]}>📍 {box.location}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => onDelete(box.id, box.name)} style={styles.deleteBtn}>
          <Text style={{ fontSize: 16, color: colors.textMuted }}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {/* Last cleaning */}
      <View style={[styles.lastClean, { backgroundColor: colors.surface }]}>
        {box.last_cleaning ? (
          <>
            <View style={[styles.statusDot, { backgroundColor: hasRecent ? colors.success : colors.warning }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.lastCleanText, { color: colors.text }]}>
                Zuletzt gesäubert von <Text style={{ fontWeight: '700' }}>{box.last_cleaning.cleaned_by_name}</Text>
              </Text>
              <Text style={[styles.lastCleanTime, { color: colors.textMuted }]}>
                {formatDateTime(box.last_cleaning.cleaned_at)} ({formatRelative(box.last_cleaning.cleaned_at)})
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.statusDot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.lastCleanText, { color: colors.textMuted }]}>Noch nie gesäubert</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.cleanBtn, { backgroundColor: colors.primary }]}
        onPress={() => onClean(box.id)}
        activeOpacity={0.85}
      >
        <Text style={styles.cleanBtnText}>✓ Jetzt gesäubert</Text>
      </TouchableOpacity>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// AddLitterBoxModal
// ──────────────────────────────────────────────────────────────
function AddLitterBoxModal({
  visible, onClose, onSave, colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, location: string) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), location.trim());
    setSaving(false);
    setName(''); setLocation('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Klo hinzufügen</Text>
          <TouchableOpacity onPress={handle} disabled={!name.trim() || saving}>
            {saving
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Speichern</Text>
            }
          </TouchableOpacity>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name / Bezeichnung *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={name} onChangeText={setName}
            placeholder="z.B. Klo 1, Badezimmer-Klo" placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Standort</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={location} onChangeText={setLocation}
            placeholder="z.B. Badezimmer, Flur, Keller" placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────
export default function LitterScreen() {
  const { household, profile } = useAppStore();
  const colors = useColors();
  const [boxes, setBoxes] = useState<LitterBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const { data: boxData } = await supabase
      .from('litter_boxes')
      .select('id, name, location')
      .eq('household_id', household.id)
      .eq('is_active', true)
      .order('created_at');

    if (!boxData) { setLoading(false); return; }

    const enriched: LitterBox[] = await Promise.all(
      boxData.map(async (box) => {
        const { data: cleaning } = await supabase
          .from('litter_cleanings')
          .select('cleaned_at, cleaned_by_profile:profiles!litter_cleanings_cleaned_by_fkey(display_name)')
          .eq('litter_box_id', box.id)
          .order('cleaned_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...box,
          last_cleaning: cleaning
            ? {
                cleaned_at: cleaning.cleaned_at,
                cleaned_by_name: (cleaning as any).cleaned_by_profile?.display_name ?? 'Unbekannt',
              }
            : undefined,
        };
      })
    );

    setBoxes(enriched);
    setLoading(false);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleClean = async (boxId: string) => {
    if (!household || !profile) return;
    await supabase.from('litter_cleanings').insert({
      litter_box_id: boxId,
      household_id: household.id,
      cleaned_by: profile.id,
      cleaned_at: new Date().toISOString(),
    });
    await load();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Klo löschen', `"${name}" wirklich entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          await supabase.from('litter_boxes').update({ is_active: false }).eq('id', id);
          await load();
        },
      },
    ]);
  };

  const handleAdd = async (name: string, location: string) => {
    if (!household) return;
    await supabase.from('litter_boxes').insert({
      household_id: household.id,
      name,
      location: location || null,
    });
    await load();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>🚿 Katzenklos</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{boxes.length} Klos im Haushalt</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Hinzufügen</Text>
        </TouchableOpacity>
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
          {boxes.map((box) => (
            <LitterBoxCard
              key={box.id} box={box} colors={colors}
              onClean={handleClean}
              onDelete={handleDelete}
            />
          ))}
          {boxes.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🚿</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch keine Klos</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Füge die Katzenklos in deinem Haushalt hinzu.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <AddLitterBoxModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleAdd}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 12,
  },
  title:        { fontSize: 26, fontWeight: '800' },
  subtitle:     { fontSize: 13, marginTop: 2 },
  addBtn:       { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  card:         { borderRadius: RADIUS.xl, padding: 16, marginBottom: 14, ...SHADOWS.md },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBadge: {
    width: 52, height: 52, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  boxName:      { fontSize: 18, fontWeight: '800' },
  boxLocation:  { fontSize: 13, marginTop: 2 },
  deleteBtn:    { padding: 6 },
  lastClean: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: RADIUS.md, padding: 12, marginBottom: 12,
  },
  statusDot:    { width: 10, height: 10, borderRadius: 999, marginTop: 4, flexShrink: 0 },
  lastCleanText: { fontSize: 13 },
  lastCleanTime: { fontSize: 11, marginTop: 2 },
  cleanBtn: {
    borderRadius: RADIUS.md, paddingVertical: 13,
    alignItems: 'center', ...SHADOWS.sm,
  },
  cleanBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Modal
  modalContainer: { flex: 1 },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  modalTitle:   { fontSize: 18, fontWeight: '700' },
  fieldLabel:   { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1.5, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },

  empty:        { alignItems: 'center', paddingTop: 80 },
  emptyTitle:   { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText:    { fontSize: 14, textAlign: 'center' },
});
