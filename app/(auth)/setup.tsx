import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { householdHelpers, supabase } from '../../lib/supabase';
import { useAppStore } from '../../stores/appStore';
import { COLORS, RADIUS } from '../../lib/theme';

type Choice = 'create' | 'join';

export default function SetupScreen() {
  const { profile, setHousehold, fetchAll } = useAppStore();
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!profile) return;
    setErrorMsg('');
    setLoading(true);

    let householdId: string | undefined;

    if (choice === 'create') {
      if (!householdName.trim()) {
        setErrorMsg('Bitte einen Haushaltsnamen eingeben.');
        setLoading(false);
        return;
      }
      const { data, error } = await householdHelpers.create(householdName.trim(), profile.id);
      if (error || !data) {
        setErrorMsg(error?.message ?? 'Fehler beim Erstellen.');
        setLoading(false);
        return;
      }
      householdId = data.id;
    } else {
      if (!inviteCode.trim()) {
        setErrorMsg('Bitte den Einladungscode eingeben.');
        setLoading(false);
        return;
      }
      const { data, error } = await householdHelpers.joinByCode(inviteCode.trim(), profile.id);
      if (error || !data) {
        setErrorMsg('Haushalt nicht gefunden. Code prüfen.');
        setLoading(false);
        return;
      }
      householdId = data.id;
    }

    // Haushalt laden und in Store speichern
    const { data: household } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single();

    if (household) {
      setHousehold(household);
      await fetchAll();
    }

    setLoading(false);
    router.replace('/');
  };

  return (
    <LinearGradient colors={['#4ECDC4', '#2196F3']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🏠</Text>
          <Text style={styles.logoText}>Haushalt einrichten</Text>
          <Text style={styles.logoSub}>Hallo {profile?.display_name}! Fast geschafft.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.choiceRow}>
            {(['create', 'join'] as Choice[]).map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.choiceBtn, choice === c && styles.choiceBtnActive]}
                onPress={() => setChoice(c)}
              >
                <Text style={styles.choiceEmoji}>{c === 'create' ? '🏠' : '🔗'}</Text>
                <Text style={[styles.choiceLabel, choice === c && styles.choiceLabelActive]}>
                  {c === 'create' ? 'Neu erstellen' : 'Beitreten'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {choice === 'create' ? (
            <>
              <Text style={styles.fieldLabel}>Name des Haushalts</Text>
              <TextInput
                style={styles.input}
                placeholder="z.B. Familie Müller"
                placeholderTextColor={COLORS.textMuted}
                value={householdName}
                onChangeText={setHouseholdName}
                autoCapitalize="words"
              />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Einladungscode</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="ABC123"
                placeholderTextColor={COLORS.textMuted}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
              />
            </>
          )}

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Loslegen 🎉</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  inner:         { flex: 1, justifyContent: 'center', padding: 24 },
  logoWrap:      { alignItems: 'center', marginBottom: 32 },
  logoEmoji:     { fontSize: 56, marginBottom: 8 },
  logoText:      { fontSize: 28, fontWeight: '800', color: '#fff' },
  logoSub:       { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
  },
  choiceRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  choiceBtn: {
    flex: 1, alignItems: 'center', padding: 14, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  choiceBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  choiceEmoji:   { fontSize: 28, marginBottom: 4 },
  choiceLabel:   { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  choiceLabelActive: { color: COLORS.primary },
  fieldLabel:    { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: COLORS.text, marginBottom: 20, backgroundColor: COLORS.surface,
  },
  codeInput:     { textAlign: 'center', letterSpacing: 6, fontSize: 22, fontWeight: '800' },
  button: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 16, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:    { color: '#fff', fontWeight: '700', fontSize: 17 },
  errorBox: {
    backgroundColor: '#FEE2E2', borderRadius: RADIUS.md,
    padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  errorText: { color: '#991B1B', fontSize: 14, fontWeight: '500' },
});
