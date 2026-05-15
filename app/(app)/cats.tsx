import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { useColors } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { Cat } from '../../types';
import { supabase } from '../../lib/supabase';

// ──────────────────────────────────────────────────────────────
// CatDetailCard
// ──────────────────────────────────────────────────────────────
function CatDetailCard({ cat, onEdit }: { cat: Cat; onEdit: (cat: Cat) => void }) {
  const { foods, todayStatus } = useAppStore();
  const colors = useColors();
  const favFood = foods.find((f) => f.id === cat.favorite_food_id);
  const status = todayStatus.find((s) => s.cat_id === cat.id);
  const fedCount = [status?.morning_fed_at, status?.noon_fed_at, status?.evening_fed_at].filter(Boolean).length;
  const age = cat.birth_date
    ? `${Math.floor((Date.now() - new Date(cat.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))} Jahre`
    : null;

  return (
    <View style={[styles.catCard, { backgroundColor: colors.card }]}>
      <View style={styles.catCardHeader}>
        <View style={styles.catAvatarWrap}>
          {cat.photo_url ? (
            <Image source={{ uri: cat.photo_url }} style={styles.catAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.catAvatarFallback, { backgroundColor: colors.primaryLight }]}>
              <Text style={{ fontSize: 40 }}>🐱</Text>
            </View>
          )}
        </View>
        <View style={styles.catInfo}>
          <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
          {age && <Text style={[styles.catMeta, { color: colors.textSecondary }]}>🎂 {age}</Text>}
          {favFood && <Text style={[styles.catMeta, { color: colors.textSecondary }]}>❤️ {favFood.name}</Text>}
          {cat.intolerances && <Text style={[styles.catMeta, { color: colors.textSecondary }]}>⚠️ {cat.intolerances}</Text>}
        </View>
        <View style={styles.rightCol}>
          <View style={[styles.todayBadge, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.todayBadgeNumber, { color: colors.success }]}>{fedCount}/3</Text>
            <Text style={[styles.todayBadgeLabel, { color: colors.success }]}>heute</Text>
          </View>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onEdit(cat)}
          >
            <Text style={{ fontSize: 15 }}>✏️</Text>
          </TouchableOpacity>
        </View>
      </View>
      {cat.notes && (
        <View style={[styles.notesWrap, { backgroundColor: colors.surface }]}>
          <Text style={[styles.notesText, { color: colors.textSecondary }]}>📝 {cat.notes}</Text>
        </View>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// CatFormModal (shared by Add + Edit)
// ──────────────────────────────────────────────────────────────
interface CatFormModalProps {
  visible: boolean;
  onClose: () => void;
  editCat?: Cat;
}

function CatFormModal({ visible, onClose, editCat }: CatFormModalProps) {
  const { addCat, updateCat, household } = useAppStore();
  const colors = useColors();
  const isEdit = Boolean(editCat);

  const [name, setName] = useState(editCat?.name ?? '');
  const [birthDate, setBirthDate] = useState(editCat?.birth_date ?? '');
  const [notes, setNotes] = useState(editCat?.notes ?? '');
  const [intolerances, setIntolerances] = useState(editCat?.intolerances ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleOpen = () => {
    setName(editCat?.name ?? '');
    setBirthDate(editCat?.birth_date ?? '');
    setNotes(editCat?.notes ?? '');
    setIntolerances(editCat?.intolerances ?? '');
    setPhotoUri(null);
    setUploadError(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung', 'Fotobibliothek-Zugriff wird benötigt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    if (!household) return null;
    try {
      const fileName = `cats/${household.id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from('photos')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (error || !data) return null;
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setUploadError('Bitte einen Namen eingeben.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    let photoUrl: string | undefined = editCat?.photo_url;
    if (photoUri) {
      const uploaded = await uploadPhoto(photoUri);
      if (uploaded) {
        photoUrl = uploaded;
      } else {
        setUploadError('Foto konnte nicht hochgeladen werden. Andere Daten werden trotzdem gespeichert.');
      }
    }

    if (isEdit && editCat) {
      await updateCat(editCat.id, {
        name: name.trim(),
        photo_url: photoUrl,
        birth_date: birthDate || undefined,
        notes: notes.trim() || undefined,
        intolerances: intolerances.trim() || undefined,
      });
    } else {
      await addCat({
        name: name.trim(),
        photo_url: photoUrl,
        birth_date: birthDate || undefined,
        notes: notes.trim() || undefined,
        intolerances: intolerances.trim() || undefined,
      });
    }

    setUploading(false);
    onClose();
  };

  const currentPhoto = photoUri ?? editCat?.photo_url ?? null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {isEdit ? 'Katze bearbeiten' : 'Katze hinzufügen'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={uploading}>
            {uploading
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={[styles.saveText, { color: colors.primary }]}>Speichern</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {uploadError && (
            <View style={[styles.errorBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
              <Text style={styles.errorText}>{uploadError}</Text>
            </View>
          )}
          {/* Photo */}
          <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
            {currentPhoto ? (
              <Image source={{ uri: currentPhoto }} style={styles.photoPickerImg} contentFit="cover" />
            ) : (
              <View style={[styles.photoPickerPlaceholder, { backgroundColor: colors.primaryLight }]}>
                <Text style={{ fontSize: 40 }}>📷</Text>
                <Text style={[styles.photoPickerText, { color: colors.primary }]}>Foto auswählen</Text>
              </View>
            )}
            {currentPhoto && (
              <View style={[styles.photoEditBadge, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontSize: 12 }}>✏️</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={name} onChangeText={setName}
            placeholder="z.B. Luna" placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Geburtsdatum</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={birthDate} onChangeText={setBirthDate}
            placeholder="JJJJ-MM-TT" placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Unverträglichkeiten</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={intolerances} onChangeText={setIntolerances}
            placeholder="z.B. Rind, Weizen" placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notizen</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, minHeight: 80, textAlignVertical: 'top' }]}
            value={notes} onChangeText={setNotes}
            placeholder="Besonderheiten, Eigenheiten…" placeholderTextColor={colors.textMuted}
            multiline
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────
export default function CatsScreen() {
  const { cats } = useAppStore();
  const colors = useColors();
  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<Cat | undefined>();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.text }]}>🐱 Unsere Katzen</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>
            {cats.length} {cats.length === 1 ? 'Katze' : 'Katzen'} im Haushalt
          </Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cats.map((cat) => (
          <CatDetailCard key={cat.id} cat={cat} onEdit={(c) => setEditCat(c)} />
        ))}
        {cats.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🐾</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch keine Katzen</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Füge deine Katzen hinzu, um zu starten.
            </Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>+ Erste Katze hinzufügen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add modal */}
      <CatFormModal visible={showAdd} onClose={() => setShowAdd(false)} />

      {/* Edit modal */}
      {editCat && (
        <CatFormModal
          visible={Boolean(editCat)}
          editCat={editCat}
          onClose={() => setEditCat(undefined)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 12,
  },
  screenTitle:    { fontSize: 26, fontWeight: '800' },
  screenSubtitle: { fontSize: 13, marginTop: 2 },
  addBtn:         { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  scrollContent:  { padding: 16, paddingBottom: 32 },

  catCard:        { borderRadius: RADIUS.xl, padding: 20, marginBottom: 14, ...SHADOWS.md },
  catCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  catAvatarWrap:  {},
  catAvatar:      { width: 72, height: 72, borderRadius: 999 },
  catAvatarFallback: {
    width: 72, height: 72, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  catInfo:        { flex: 1 },
  catName:        { fontSize: 22, fontWeight: '800' },
  catMeta:        { fontSize: 13, marginTop: 3 },
  rightCol:       { alignItems: 'center', gap: 8 },
  todayBadge:     { alignItems: 'center', borderRadius: RADIUS.lg, padding: 10 },
  todayBadgeNumber: { fontSize: 20, fontWeight: '800' },
  todayBadgeLabel:  { fontSize: 10, fontWeight: '600' },
  editBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  notesWrap:      { marginTop: 12, borderRadius: RADIUS.md, padding: 12 },
  notesText:      { fontSize: 13 },

  emptyState:     { alignItems: 'center', paddingTop: 80 },
  emptyTitle:     { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText:      { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  emptyBtn:       { borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },

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
  cancelText:   { fontSize: 16 },
  saveText:     { fontSize: 16, fontWeight: '700' },
  fieldLabel:   { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1.5, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  photoPicker:  { alignSelf: 'center', marginBottom: 8, position: 'relative' },
  photoPickerImg: { width: 120, height: 120, borderRadius: 999 },
  photoPickerPlaceholder: {
    width: 120, height: 120, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  photoPickerText:  { fontSize: 12, fontWeight: '600', marginTop: 4 },
  photoEditBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 28, height: 28, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  errorBox: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 13 },
});
