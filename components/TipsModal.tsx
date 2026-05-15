import { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useAppStore } from '../stores/appStore';
import { useColors } from '../lib/theme-context';
import { RADIUS, SHADOWS } from '../lib/theme';
import { HouseholdTip } from '../types';
import { getCategoryColor } from '../lib/activities';

const CATEGORY_OPTIONS: { value: HouseholdTip['category']; label: string; emoji: string }[] = [
  { value: 'play',    label: 'Spielen',  emoji: '🎮' },
  { value: 'care',    label: 'Pflege',   emoji: '💆' },
  { value: 'explore', label: 'Erkunden', emoji: '🔍' },
  { value: 'cuddle',  label: 'Kuscheln', emoji: '🤗' },
];

const DURATION_OPTIONS = ['5 Min', '10 Min', '15 Min', '20 Min', '30 Min'];

const EMOJI_SUGGESTIONS = [
  '🎯', '🏰', '🧶', '🪥', '🌿', '🪟', '💤', '🎪', '📦', '🫧',
  '🧸', '💅', '📸', '🎵', '🌺', '🪄', '🍃', '🧩', '🐾', '🎭',
  '🦋', '🌙', '☀️', '🍀', '🎁', '🎀', '🐟', '🦴', '🪁', '🎨',
];

interface FormState {
  emoji: string;
  title: string;
  description: string;
  duration: string;
  category: HouseholdTip['category'];
}

const EMPTY_FORM: FormState = {
  emoji: '🎯',
  title: '',
  description: '',
  duration: '15 Min',
  category: 'care',
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function TipsModal({ visible, onClose }: Props) {
  const { householdTips, addTip, editTip, removeTip } = useAppStore();
  const colors = useColors();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (tip: HouseholdTip) => {
    setForm({
      emoji: tip.emoji,
      title: tip.title,
      description: tip.description,
      duration: tip.duration,
      category: tip.category,
    });
    setEditingId(tip.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    if (editingId) {
      await editTip(editingId, form);
    } else {
      await addTip(form);
    }
    setLoading(false);
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (tip: HouseholdTip) => {
    Alert.alert(
      'Tipp löschen',
      `"${tip.title}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await removeTip(tip.id);
          },
        },
      ],
    );
  };

  const s = makeStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>🎯 Tipps verwalten</Text>
          <TouchableOpacity onPress={openNew} style={s.addBtn}>
            <Text style={s.addBtnText}>+ Neu</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        {showForm && (
          <View style={s.formCard}>
            {/* Emoji picker toggle */}
            <Text style={s.fieldLabel}>Emoji</Text>
            <TouchableOpacity
              style={s.emojiPreviewBtn}
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Text style={s.emojiPreview}>{form.emoji}</Text>
              <Text style={[s.emojiToggle, { color: colors.textMuted }]}>
                {showEmojiPicker ? 'Schließen ▲' : 'Auswählen ▼'}
              </Text>
            </TouchableOpacity>

            {showEmojiPicker && (
              <View style={s.emojiGrid}>
                {EMOJI_SUGGESTIONS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[s.emojiOption, form.emoji === e && { backgroundColor: colors.primaryLight }]}
                    onPress={() => { setForm((f) => ({ ...f, emoji: e })); setShowEmojiPicker(false); }}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={s.fieldLabel}>Titel *</Text>
            <TextInput
              style={s.input}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="z.B. Katzen bürsten"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={s.fieldLabel}>Beschreibung</Text>
            <TextInput
              style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Kurze Erklärung…"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={s.fieldLabel}>Dauer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[s.pill, form.duration === d && s.pillActive]}
                  onPress={() => setForm((f) => ({ ...f, duration: d }))}
                >
                  <Text style={[s.pillText, form.duration === d && { color: colors.primary }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Kategorie</Text>
            <View style={s.catRow}>
              {CATEGORY_OPTIONS.map((cat) => {
                const catColor = getCategoryColor(cat.value);
                const active = form.category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[s.catBtn, { borderColor: active ? catColor : colors.border },
                      active && { backgroundColor: catColor + '20' }]}
                    onPress={() => setForm((f) => ({ ...f, category: cat.value }))}
                  >
                    <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                    <Text style={[s.catLabel, { color: active ? catColor : colors.textSecondary }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.formActions}>
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: colors.primary }, (!form.title.trim() || loading) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!form.title.trim() || loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveBtnText}>{editingId ? '✓ Speichern' : '+ Hinzufügen'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tip list */}
        <ScrollView style={s.list} contentContainerStyle={s.listContent}>
          {householdTips.length === 0 && !showForm && (
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💡</Text>
              <Text style={[s.emptyTitle, { color: colors.text }]}>Noch keine eigenen Tipps</Text>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>
                Füge Tipps hinzu — sie werden täglich als Aktivitätsvorschlag gezeigt.
              </Text>
            </View>
          )}

          {householdTips.map((tip) => {
            const catColor = getCategoryColor(tip.category);
            return (
              <View key={tip.id} style={[s.tipCard, { backgroundColor: colors.card }]}>
                <View style={[s.tipEmojiBadge, { backgroundColor: catColor + '20' }]}>
                  <Text style={{ fontSize: 24 }}>{tip.emoji}</Text>
                </View>
                <View style={s.tipContent}>
                  <Text style={[s.tipTitle, { color: colors.text }]}>{tip.title}</Text>
                  {tip.description ? (
                    <Text style={[s.tipDesc, { color: colors.textMuted }]} numberOfLines={2}>
                      {tip.description}
                    </Text>
                  ) : null}
                  <View style={s.tipMeta}>
                    <View style={[s.durationPill, { backgroundColor: catColor + '20' }]}>
                      <Text style={[s.durationText, { color: catColor }]}>{tip.duration}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.tipActions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(tip)}>
                    <Text style={{ fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => handleDelete(tip)}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
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
  closeBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: colors.textMuted },
  title:        { fontSize: 17, fontWeight: '700', color: colors.text },
  addBtn:       { backgroundColor: colors.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },

  formCard: {
    backgroundColor: colors.card, margin: 16, borderRadius: RADIUS.xl,
    padding: 16, ...SHADOWS.sm,
  },
  fieldLabel:   { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: RADIUS.md,
    padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg,
  },
  emojiPreviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  emojiPreview:    { fontSize: 36 },
  emojiToggle:     { fontSize: 13, fontWeight: '600' },
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8,
  },
  emojiOption: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surface,
  },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: colors.surface, marginRight: 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  pillActive:  { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  pillText:    { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  catRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md,
    borderWidth: 1.5, backgroundColor: colors.surface,
  },
  catLabel:    { fontSize: 12, fontWeight: '600' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: RADIUS.md,
    paddingVertical: 13, alignItems: 'center',
  },
  saveBtn:     { flex: 1, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  list:        { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.xl, padding: 14, marginBottom: 10, ...SHADOWS.sm,
  },
  tipEmojiBadge: {
    width: 52, height: 52, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  tipContent:  { flex: 1 },
  tipTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  tipDesc:     { fontSize: 12, lineHeight: 16, marginBottom: 6 },
  tipMeta:     { flexDirection: 'row' },
  durationPill: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  durationText: { fontSize: 11, fontWeight: '700' },
  tipActions:  { gap: 4 },
  iconBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
});
