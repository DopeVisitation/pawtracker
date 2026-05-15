import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { authHelpers, householdHelpers } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { COLORS, RADIUS } from '../../lib/theme';

type Step = 'account' | 'household';
type HouseholdChoice = 'create' | 'join';

export default function RegisterScreen() {
  const [step, setStep] = useState<Step>('account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const [householdChoice, setHouseholdChoice] = useState<HouseholdChoice>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [userId, setUserId] = useState('');

  const handleAccountStep = async () => {
    if (!email || !password || !name) {
      Alert.alert('Felder ausfüllen', 'Bitte alle Felder ausfüllen.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Passwort zu kurz', 'Mindestens 6 Zeichen.');
      return;
    }

    setLoading(true);
    const { data, error } = await authHelpers.signUp(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);

    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }

    if (data.user) {
      // Create profile
      await supabase.from('profiles').insert({ id: data.user.id, display_name: name.trim() });
      setUserId(data.user.id);
      setStep('household');
    }
  };

  const handleHouseholdStep = async () => {
    setLoading(true);

    if (householdChoice === 'create') {
      if (!householdName.trim()) {
        Alert.alert('Name fehlt', 'Bitte einen Haushaltsnamen eingeben.');
        setLoading(false);
        return;
      }
      const { error } = await householdHelpers.create(householdName.trim(), userId);
      if (error) {
        Alert.alert('Fehler', error.message);
        setLoading(false);
        return;
      }
    } else {
      if (!inviteCode.trim()) {
        Alert.alert('Code fehlt', 'Bitte den Einladungscode eingeben.');
        setLoading(false);
        return;
      }
      const { error } = await householdHelpers.joinByCode(inviteCode.trim(), userId);
      if (error) {
        Alert.alert('Code ungültig', 'Haushalt nicht gefunden. Bitte Code prüfen.');
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    // Auth listener in _layout.tsx handles redirect
  };

  return (
    <LinearGradient colors={[COLORS.secondary, '#2196F3']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>🐾</Text>
            <Text style={styles.logoText}>PawTracker</Text>
            <Text style={styles.logoSub}>
              {step === 'account' ? 'Konto erstellen' : 'Haushalt einrichten'}
            </Text>
          </View>

          <View style={styles.card}>
            {/* Step indicator */}
            <View style={styles.steps}>
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <View style={[styles.stepLine, step === 'household' && styles.stepLineActive]} />
              <View style={[styles.stepDot, step === 'household' && styles.stepDotActive]} />
            </View>

            {step === 'account' ? (
              <>
                <Text style={styles.cardTitle}>Dein Konto</Text>

                <TextInput style={styles.input} placeholder="Name" placeholderTextColor={COLORS.textMuted}
                  value={name} onChangeText={setName} autoCapitalize="words" />
                <TextInput style={styles.input} placeholder="E-Mail" placeholderTextColor={COLORS.textMuted}
                  value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <TextInput style={styles.input} placeholder="Passwort (min. 6 Zeichen)" placeholderTextColor={COLORS.textMuted}
                  value={password} onChangeText={setPassword} secureTextEntry />

                <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleAccountStep} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Weiter →</Text>}
                </TouchableOpacity>

                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity style={styles.linkBtn}>
                    <Text style={styles.linkText}>Bereits registriert? <Text style={styles.linkBold}>Anmelden</Text></Text>
                  </TouchableOpacity>
                </Link>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Dein Haushalt</Text>

                <View style={styles.choiceRow}>
                  {(['create', 'join'] as HouseholdChoice[]).map((choice) => (
                    <TouchableOpacity
                      key={choice}
                      style={[styles.choiceBtn, householdChoice === choice && styles.choiceBtnActive]}
                      onPress={() => setHouseholdChoice(choice)}
                    >
                      <Text style={styles.choiceEmoji}>{choice === 'create' ? '🏠' : '🔗'}</Text>
                      <Text style={[styles.choiceLabel, householdChoice === choice && styles.choiceLabelActive]}>
                        {choice === 'create' ? 'Neu erstellen' : 'Beitreten'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {householdChoice === 'create' ? (
                  <TextInput style={styles.input} placeholder="Name des Haushalts (z.B. Familie Müller)"
                    placeholderTextColor={COLORS.textMuted} value={householdName} onChangeText={setHouseholdName} />
                ) : (
                  <TextInput style={[styles.input, styles.codeInput]} placeholder="EINLADUNGSCODE"
                    placeholderTextColor={COLORS.textMuted} value={inviteCode}
                    onChangeText={(t) => setInviteCode(t.toUpperCase())}
                    autoCapitalize="characters" maxLength={6} />
                )}

                <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleHouseholdStep} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Loslegen 🎉</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  inner:        { flex: 1, justifyContent: 'center', padding: 24 },
  logoWrap:     { alignItems: 'center', marginBottom: 32, marginTop: 60 },
  logoEmoji:    { fontSize: 56, marginBottom: 8 },
  logoText:     { fontSize: 30, fontWeight: '800', color: '#fff' },
  logoSub:      { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 12, marginBottom: 32,
  },
  steps:        { flexDirection: 'row', alignItems: 'center', marginBottom: 24, justifyContent: 'center' },
  stepDot:      { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepLine:     { flex: 0.3, height: 2, backgroundColor: COLORS.border, marginHorizontal: 8 },
  stepLineActive: { backgroundColor: COLORS.primary },
  cardTitle:    { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: COLORS.text, marginBottom: 14, backgroundColor: COLORS.surface,
  },
  codeInput:    { textAlign: 'center', letterSpacing: 6, fontSize: 22, fontWeight: '800' },
  button: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:   { color: '#fff', fontWeight: '700', fontSize: 17 },
  linkBtn:      { alignItems: 'center' },
  linkText:     { color: COLORS.textMuted, fontSize: 14 },
  linkBold:     { color: COLORS.primary, fontWeight: '600' },
  choiceRow:    { flexDirection: 'row', gap: 10, marginBottom: 16 },
  choiceBtn: {
    flex: 1, alignItems: 'center', padding: 14, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  choiceBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  choiceEmoji:  { fontSize: 28, marginBottom: 4 },
  choiceLabel:  { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  choiceLabelActive: { color: COLORS.primary },
});
