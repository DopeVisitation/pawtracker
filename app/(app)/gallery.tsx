import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, TextInput, ActivityIndicator, Modal, FlatList, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { useColors } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');
const IMG_SIZE = Math.floor((Math.min(SCREEN_W, 640) - 48) / 2);

interface GalleryPhoto {
  id: string;
  photo_url: string;
  caption?: string;
  hashtags: string[];
  cat_ids: string[];
  created_at: string;
}

async function uploadToStorage(householdId: string, uri: string): Promise<string | null> {
  try {
    const fileName = `gallery/${householdId}/${Date.now()}.jpg`;
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
}

// ──────────────────────────────────────────────────────────────
// Upload Modal
// ──────────────────────────────────────────────────────────────
function UploadModal({ visible, onClose, onUploaded }: {
  visible: boolean; onClose: () => void; onUploaded: () => void;
}) {
  const { household, cats, profile } = useAppStore();
  const colors = useColors();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setImageUri(null); setCaption(''); setTagsInput('');
    setSelectedCatIds([]); setError(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, quality: 0.85,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const toggleCat = (id: string) =>
    setSelectedCatIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!imageUri || !household || !profile) return;
    setUploading(true);
    setError(null);
    const photoUrl = await uploadToStorage(household.id, imageUri);
    if (!photoUrl) {
      setError('Upload fehlgeschlagen. Bitte nochmal versuchen.');
      setUploading(false);
      return;
    }
    const hashtags = tagsInput
      .split(/[,\s#]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const { error: dbErr } = await supabase.from('gallery_photos').insert({
      household_id: household.id,
      uploaded_by: profile.id,
      photo_url: photoUrl,
      caption: caption.trim() || null,
      hashtags,
      cat_ids: selectedCatIds,
    });
    setUploading(false);
    if (dbErr) { setError('Fehler beim Speichern.'); return; }
    reset();
    onClose();
    onUploaded();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={onClose} onShow={reset}>
      <View style={[um.container, { backgroundColor: colors.card }]}>
        <View style={[um.handle, { backgroundColor: colors.border }]} />
        <View style={[um.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[um.cancel, { color: colors.textMuted }]}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={[um.title, { color: colors.text }]}>Foto hochladen</Text>
          <TouchableOpacity onPress={handleSave} disabled={!imageUri || uploading}>
            {uploading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[um.save, { color: imageUri ? colors.primary : colors.textMuted }]}>Speichern</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <TouchableOpacity
            style={[um.imgPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={pickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={um.imgPreview} contentFit="cover" />
            ) : (
              <View style={um.imgPlaceholder}>
                <Text style={{ fontSize: 48 }}>📷</Text>
                <Text style={[um.imgPlaceholderText, { color: colors.primary }]}>Foto auswählen</Text>
              </View>
            )}
          </TouchableOpacity>

          {error && (
            <View style={[um.errorBox, { backgroundColor: '#fee2e2' }]}>
              <Text style={um.errorText}>{error}</Text>
            </View>
          )}

          <Text style={[um.label, { color: colors.textSecondary }]}>Beschriftung (optional)</Text>
          <TextInput
            style={[um.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={caption} onChangeText={setCaption}
            placeholder="z.B. Morgenspaziergang" placeholderTextColor={colors.textMuted}
          />

          <Text style={[um.label, { color: colors.textSecondary }]}># Hashtags (kommagetrennt)</Text>
          <TextInput
            style={[um.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={tagsInput} onChangeText={setTagsInput}
            placeholder="z.B. spielen, draußen, niedlich" placeholderTextColor={colors.textMuted}
          />

          <Text style={[um.label, { color: colors.textSecondary }]}>Katzen auf dem Foto</Text>
          <View style={um.catRow}>
            {cats.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[um.catPill, {
                  backgroundColor: selectedCatIds.includes(cat.id) ? colors.primary : colors.surface,
                  borderColor: selectedCatIds.includes(cat.id) ? colors.primary : colors.border,
                }]}
                onPress={() => toggleCat(cat.id)}
              >
                <Text style={[um.catPillText, { color: selectedCatIds.includes(cat.id) ? '#fff' : colors.text }]}>
                  🐱 {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
            {cats.length === 0 && (
              <Text style={[{ color: colors.textMuted, fontSize: 13 }]}>Noch keine Katzen angelegt</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const um = StyleSheet.create({
  container:       { flex: 1 },
  handle:          { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title:           { fontSize: 18, fontWeight: '700' },
  cancel:          { fontSize: 16 },
  save:            { fontSize: 16, fontWeight: '700' },
  imgPicker:       { height: 220, borderRadius: RADIUS.xl, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', marginBottom: 20 },
  imgPreview:      { width: '100%', height: '100%' },
  imgPlaceholder:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  imgPlaceholderText: { fontSize: 15, fontWeight: '600' },
  label:           { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input:           { borderWidth: 1.5, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  catRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catPill:         { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  catPillText:     { fontSize: 13, fontWeight: '600' },
  errorBox:        { borderRadius: RADIUS.md, padding: 12, marginBottom: 8 },
  errorText:       { color: '#dc2626', fontSize: 13 },
});

// ──────────────────────────────────────────────────────────────
// Photo View Modal
// ──────────────────────────────────────────────────────────────
function PhotoViewModal({ photo, cats, onClose, onDelete }: {
  photo: GalleryPhoto; cats: any[]; onClose: () => void; onDelete: () => void;
}) {
  const colors = useColors();
  const photoCats = cats.filter((c) => photo.cat_ids.includes(c.id));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={[pv.container, { backgroundColor: '#000' }]}>
        <Image source={{ uri: photo.photo_url }} style={pv.img} contentFit="contain" />

        {/* Close + Delete buttons */}
        <TouchableOpacity onPress={onClose} style={pv.closeBtn}>
          <Text style={pv.closeText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setConfirmDelete(true)} style={pv.deleteBtn}>
          <Text style={pv.deleteText}>🗑️</Text>
        </TouchableOpacity>

        {/* Info bar */}
        {(photo.caption || photo.hashtags.length > 0 || photoCats.length > 0) && (
          <View style={[pv.info, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            {photo.caption && <Text style={pv.caption}>{photo.caption}</Text>}
            {photoCats.length > 0 && (
              <Text style={pv.cats}>{photoCats.map((c) => `🐱 ${c.name}`).join('  ')}</Text>
            )}
            {photo.hashtags.length > 0 && (
              <Text style={pv.tags}>{photo.hashtags.map((t) => `#${t}`).join('  ')}</Text>
            )}
          </View>
        )}

        {/* Delete confirm */}
        {confirmDelete && (
          <View style={[pv.confirmBox, { backgroundColor: colors.card }]}>
            <Text style={[pv.confirmText, { color: colors.text }]}>Foto löschen?</Text>
            <View style={pv.confirmBtns}>
              <TouchableOpacity style={[pv.confirmCancel, { borderColor: colors.border }]}
                onPress={() => setConfirmDelete(false)}>
                <Text style={[{ color: colors.text, fontWeight: '600' }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[pv.confirmOk, { backgroundColor: '#ef4444' }]}
                onPress={onDelete}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Löschen</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const pv = StyleSheet.create({
  container:    { flex: 1 },
  img:          { flex: 1 },
  closeBtn:     { position: 'absolute', top: 56, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeText:    { color: '#fff', fontSize: 20, fontWeight: '700' },
  deleteBtn:    { position: 'absolute', top: 56, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  deleteText:   { fontSize: 20 },
  info:         { position: 'absolute', bottom: 48, left: 16, right: 16, borderRadius: RADIUS.xl, padding: 16 },
  caption:      { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cats:         { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 4 },
  tags:         { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  confirmBox:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl },
  confirmText:  { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  confirmBtns:  { flexDirection: 'row', gap: 12 },
  confirmCancel:{ flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, padding: 14, alignItems: 'center' },
  confirmOk:    { flex: 1, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center' },
});

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────
export default function GalleryScreen() {
  const { household, cats } = useAppStore();
  const colors = useColors();

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterCatId, setFilterCatId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<GalleryPhoto | null>(null);

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('gallery_photos')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });
    setPhotos((data as GalleryPhoto[]) ?? []);
    setLoading(false);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!viewPhoto) return;
    await supabase.from('gallery_photos').delete().eq('id', viewPhoto.id);
    setViewPhoto(null);
    load();
  };

  // Collect all unique tags from all photos
  const allTags = Array.from(new Set(photos.flatMap((p) => p.hashtags))).sort();

  const filtered = photos.filter((p) => {
    if (filterTag && !p.hashtags.includes(filterTag)) return false;
    if (filterCatId && !p.cat_ids.includes(filterCatId)) return false;
    return true;
  });

  const clearAll = filterCatId === null && filterTag === null;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: colors.text }]}>🖼️ Galerie</Text>
          <Text style={[s.subtitle, { color: colors.textMuted }]}>{filtered.length} Fotos</Text>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowUpload(true)}>
          <Text style={s.addBtnText}>+ Foto</Text>
        </TouchableOpacity>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterInner}>
        <TouchableOpacity
          style={[s.pill, { backgroundColor: clearAll ? colors.primary : colors.card }]}
          onPress={() => { setFilterCatId(null); setFilterTag(null); }}
        >
          <Text style={[s.pillText, { color: clearAll ? '#fff' : colors.text }]}>Alle</Text>
        </TouchableOpacity>

        {cats.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[s.pill, { backgroundColor: filterCatId === cat.id ? colors.primary : colors.card }]}
            onPress={() => { setFilterCatId(filterCatId === cat.id ? null : cat.id); setFilterTag(null); }}
          >
            <Text style={[s.pillText, { color: filterCatId === cat.id ? '#fff' : colors.text }]}>🐱 {cat.name}</Text>
          </TouchableOpacity>
        ))}

        {allTags.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[s.pill, { backgroundColor: filterTag === tag ? colors.primary : colors.card }]}
            onPress={() => { setFilterTag(filterTag === tag ? null : tag); setFilterCatId(null); }}
          >
            <Text style={[s.pillText, { color: filterTag === tag ? '#fff' : colors.text }]}>#{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={{ fontSize: 64 }}>📸</Text>
          <Text style={[s.emptyTitle, { color: colors.text }]}>Noch keine Fotos</Text>
          <Text style={[s.emptySub, { color: colors.textMuted }]}>
            {clearAll ? 'Lade das erste Foto hoch!' : 'Keine Fotos für diesen Filter'}
          </Text>
          {clearAll && (
            <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowUpload(true)}>
              <Text style={s.emptyBtnText}>+ Foto hochladen</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.thumb, { width: IMG_SIZE, height: IMG_SIZE }]}
              onPress={() => setViewPhoto(item)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: item.photo_url }} style={s.thumbImg} contentFit="cover" />
              {(item.hashtags.length > 0 || item.caption || item.cat_ids.length > 0) && (
                <View style={s.thumbOverlay}>
                  {item.caption ? (
                    <Text style={s.thumbCaption} numberOfLines={1}>{item.caption}</Text>
                  ) : null}
                  {item.cat_ids.length > 0 && (
                    <Text style={s.thumbCats} numberOfLines={1}>
                      {cats.filter((c) => item.cat_ids.includes(c.id)).map((c) => `🐱 ${c.name}`).join(' ')}
                    </Text>
                  )}
                  {item.hashtags.slice(0, 2).map((t) => (
                    <Text key={t} style={s.thumbTag}>#{t}</Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <UploadModal visible={showUpload} onClose={() => setShowUpload(false)} onUploaded={load} />
      {viewPhoto && (
        <PhotoViewModal
          photo={viewPhoto}
          cats={cats}
          onClose={() => setViewPhoto(null)}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title:        { fontSize: 26, fontWeight: '800' },
  subtitle:     { fontSize: 13, marginTop: 2 },
  addBtn:       { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  filterScroll: { maxHeight: 52, marginBottom: 8 },
  filterInner:  { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  pill:         { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  pillText:     { fontSize: 13, fontWeight: '700' },

  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 24 },
  emptyTitle:   { fontSize: 20, fontWeight: '700' },
  emptySub:     { fontSize: 14, textAlign: 'center' },
  emptyBtn:     { borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  grid:         { padding: 16, paddingBottom: 32, gap: 8 },
  row:          { gap: 8 },
  thumb:        { borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.sm },
  thumbImg:     { width: '100%', height: '100%' },
  thumbOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg },
  thumbCaption: { color: '#fff', fontSize: 11, fontWeight: '600' },
  thumbCats:    { color: 'rgba(255,255,255,0.85)', fontSize: 10 },
  thumbTag:     { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
});
