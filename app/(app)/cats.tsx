import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, Modal, TextInput, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { COLORS, RADIUS, SHADOWS } from '../../lib/theme';
import { Cat } from '../../types';
import { supabase } from '../../lib/supabase';

function CatDetailCard({ cat }: { cat: Cat }) {
  const { foods, todayStatus } = useAppStore();
  const favFood = foods.find((f) => f.id === cat.favorite_food_id);
  const status = todayStatus.find((s) => s.cat_id === cat.id);

  const fedCount = [status?.morning_fed_at, status?.noon_fed_at, status?.evening_fed_at].filter(Boolean).length;

  const age = cat.birth_date
    ? `${Math.floor((Date.now() - new Date(cat.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))} Jahre`
    : null;

  return (
    <View style={styles.catCard}>
      <View style={styles.catCardHeader}>
        <View style={styles.catAvatarWrap}>
          {cat.photo_url ? (
            <Image source={{ uri: cat.photo_url }} style={styles.catAvatar} contentFit="cover" />
          ) : (
            <View style={styles.catAvatarFallback}>
              <Text style={{ fontSize: 40 }}>🐱</Text>
            </View>
          )}
        </View>
        <View style={styles.catInfo}>
          <Text style={styles.catName}>{cat.name}</Text>
          {age && <Text style={styles.catMeta}>🎂 {age}</Text>}
          {favFood && <Text style={styles.catMeta}>❤️ {favFood.name}</Text>}
          {cat.intolerances && <Text style={styles.catMeta}>⚠️ {cat.intolerances}</Text>}
        </View>
        <View style={styles.todayBadge}>
          <Text style={styles.todayBadgeNumber}>{fedCount}/3</Text>
          <Text style={styles.todayBadgeLabel}>heute</Text>
        </View>
      </View>
      {cat.notes && (
        <View style={styles.notesWrap}>
          <Text style={styles.notesText}>📝 {cat.notes}</Text>
        </View>
      )}
    </View>
  );
}

function AddCatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addCat, household } = useAppStore();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [notes, setNotes] = useState('');
  const [intolerances, setIntolerances] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const uploadPhoto = async (uri: string): Promise<string | undefined> => {
    if (!household) return;
    const fileName = `cats/${household.id}/${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error } = await supabase.storage.from('photos').upload(fileName, blob, { contentType: 'image/jpeg' });
    if (error || !data) return;
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name fehlt', 'Bitte einen Namen eingeben.');
      return;
    }
    setUploading(true);
    let photoUrl: string | undefined;
    if (photoUri) photoUrl = await uploadPhoto(photoUri);

    await addCat({
      name: name.trim(),
      photo_url: photoUrl,
      birth_date: birthDate || undefined,
      notes: notes.trim() || undefined,
      intolerances: intolerances.trim() || undefined,
    });
    setUploading(false);
    setName(''); setBirthDate(''); setNotes(''); setIntolerances(''); setPhotoUri(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.handle} />
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>Abbrechen</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Katze hinzufügen</Text>
          <TouchableOpacity onPress={handleSave} disabled={uploading}>
            <Text style={[styles.saveText, uploading && { opacity: 0.5 }]}>
              {uploading ? 'Speichert...' : 'Speichern'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Photo */}
          <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPickerImg} contentFit="cover" />
            ) : (
              <View style={styles.photoPickerPlaceholder}>
                <Text style={{ fontSize: 40 }}>📷</Text>
                <Text style={styles.photoPickerText}>Foto auswählen</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="z.B. Luna" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Geburtsdatum</Text>
          <TextInput style={styles.input} value={birthDate} onChangeText={setBirthDate} placeholder="JJJJ-MM-TT" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Unverträglichkeiten</Text>
          <TextInput style={styles.input} value={intolerances} onChangeText={setIntolerances} placeholder="z.B. Rind, Weizen" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Notizen</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={notes} onChangeText={setNotes}
            placeholder="Besonderheiten, Eigenheiten…" placeholderTextColor={COLORS.textMuted}
            multiline
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CatsScreen() {
  const { cats } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>🐱 Unsere Katzen</Text>
          <Text style={styles.screenSubtitle}>{cats.length} {cats.length === 1 ? 'Katze' : 'Katzen'} im Haushalt</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cats.map((cat) => (
          <CatDetailCard key={cat.id} cat={cat} />
        ))}
        {cats.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🐾</Text>
            <Text style={styles.emptyTitle}>Noch keine Katzen</Text>
            <Text style={styles.emptyText}>Füge deine Katzen hinzu, um zu starten.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>+ Erste Katze hinzufügen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <AddCatModal visible={showAdd} onClose={() => setShowAdd(false)} />
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

  catCard:        { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 20, marginBottom: 14, ...SHADOWS.md },
  catCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  catAvatarWrap:  {},
  catAvatar:      { width: 72, height: 72, borderRadius: 999 },
  catAvatarFallback: {
    width: 72, height: 72, borderRadius: 999,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  catInfo:        { flex: 1 },
  catName:        { fontSize: 22, fontWeight: '800', color: COLORS.text },
  catMeta:        { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  todayBadge:     { alignItems: 'center', backgroundColor: COLORS.successLight, borderRadius: RADIUS.lg, padding: 10 },
  todayBadgeNumber: { fontSize: 20, fontWeight: '800', color: COLORS.success },
  todayBadgeLabel:  { fontSize: 10, color: COLORS.success, fontWeight: '600' },
  notesWrap:      { marginTop: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12 },
  notesText:      { fontSize: 13, color: COLORS.textSecondary },

  emptyState:     { alignItems: 'center', paddingTop: 80 },
  emptyTitle:     { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText:      { fontSize: 14, color: COLORS.textMuted, marginBottom: 24, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },

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
  photoPicker:  { alignSelf: 'center', marginBottom: 8 },
  photoPickerImg: { width: 120, height: 120, borderRadius: 999 },
  photoPickerPlaceholder: {
    width: 120, height: 120, borderRadius: 999,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  photoPickerText: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 4 },
});
