import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { authHelpers } from '../../lib/supabase';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    setLoading(true);
    const { error } = await authHelpers.signIn(email.trim().toLowerCase(), password);
    setLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setErrorMsg('Email noch nicht bestätigt. Bitte prüfe dein Postfach.');
      } else if (error.message.includes('Invalid login')) {
        setErrorMsg('E-Mail oder Passwort ist falsch.');
      } else {
        setErrorMsg(error.message);
      }
    }
    // Navigation handled by _layout.tsx auth listener
  };

  return (
    <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🐾</Text>
          <Text style={styles.logoText}>PawTracker</Text>
          <Text style={styles.logoSub}>Fütterung im Überblick</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Willkommen zurück</Text>

          <TextInput
            style={styles.input}
            placeholder="E-Mail"
            placeholderTextColor={COLORS.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Passwort"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Anmelden</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.linkBtn}>
              <Text style={styles.linkText}>
                Noch kein Konto? <Text style={styles.linkBold}>Registrieren</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  inner:      { flex: 1, justifyContent: 'center', padding: 24 },
  logoWrap:   { alignItems: 'center', marginBottom: 40 },
  logoEmoji:  { fontSize: 64, marginBottom: 8 },
  logoText:   { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  logoSub:    { fontSize: 15, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontWeight: '700', fontSize: 17 },
  linkBtn:        { alignItems: 'center' },
  linkText:       { color: COLORS.textMuted, fontSize: 14 },
  linkBold:       { color: COLORS.primary, fontWeight: '600' },
  errorBox: {
    backgroundColor: '#FEE2E2', borderRadius: RADIUS.md,
    padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  errorText:      { color: '#991B1B', fontSize: 14, fontWeight: '500' },
});
