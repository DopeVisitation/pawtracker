import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Share, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { useColors, useTheme } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { authHelpers } from '../../lib/supabase';

function SettingsRow({ emoji, label, sub, onPress, danger, right }: {
  emoji: string; label: string; sub?: string;
  onPress?: () => void; danger?: boolean;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
        {sub && <Text style={[styles.rowSub, { color: colors.textMuted }]}>{sub}</Text>}
      </View>
      {right ?? <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, ...SHADOWS.sm }]}>
        {children}
      </View>
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.border }]} />;
}

export default function SettingsScreen() {
  const { profile, household, members } = useAppStore();
  const colors = useColors();
  const { mode, setMode, isDark } = useTheme();

  const [notifMorning, setNotifMorning] = useState(true);
  const [notifNoon, setNotifNoon] = useState(true);
  const [notifEvening, setNotifEvening] = useState(true);
  const [notifLowStock, setNotifLowStock] = useState(true);

  const handleShareInvite = async () => {
    if (!household) return;
    await Share.share({
      message: `Tritt unserem PawTracker-Haushalt "${household.name}" bei!\n\nEinladungscode: ${household.invite_code}\n\nApp: https://pawtracker-ten.vercel.app`,
      title: 'PawTracker Einladung',
    });
  };

  const handleLogout = () => {
    authHelpers.signOut();
  };

  const cycleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  const themeLabel = { light: '☀️ Hell', dark: '🌙 Dunkel', system: '⚙️ System' }[mode];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>⚙️ Einstellungen</Text>

        {/* Profile */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, ...SHADOWS.sm }]}>
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primaryLight }]}>
                <Text style={{ fontSize: 36 }}>👤</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={[styles.profileName, { color: colors.text }]}>{profile?.display_name}</Text>
            <View style={[styles.pointsBadge, { backgroundColor: colors.accent + '30' }]}>
              <Text style={[styles.pointsBadgeText, { color: '#92400E' }]}>
                🏅 {profile?.points ?? 0} Punkte
              </Text>
            </View>
          </View>
        </View>

        {/* Appearance */}
        <Section title="DARSTELLUNG">
          <SettingsRow
            emoji="🎨"
            label="Design-Modus"
            sub={themeLabel}
            onPress={cycleTheme}
            right={
              <View style={[styles.themePill, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.themePillText, { color: colors.primary }]}>{themeLabel}</Text>
              </View>
            }
          />
        </Section>

        {/* Household */}
        <Section title="HAUSHALT">
          <View style={[styles.householdInfo, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.householdName, { color: colors.text }]}>{household?.name}</Text>
            <View style={[styles.inviteWrap, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.inviteLabel, { color: colors.primary }]}>Einladungscode</Text>
              <Text style={[styles.inviteCode, { color: colors.primary }]}>{household?.invite_code}</Text>
            </View>
          </View>
          <SettingsRow emoji="📨" label="Mitglieder einladen" sub="Code teilen" onPress={handleShareInvite} />
          <Separator />
          <View style={styles.membersList}>
            <Text style={[styles.membersTitle, { color: colors.textMuted }]}>
              Mitglieder ({members.length})
            </Text>
            {members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={[styles.memberDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.memberName, { color: colors.text }]}>{m.display_name}</Text>
                <Text style={[styles.memberPoints, { color: colors.textMuted }]}>{m.points} Pkt.</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Notifications */}
        <Section title="BENACHRICHTIGUNGEN">
          <SettingsRow
            emoji="🌅" label="Morgens erinnern" sub="Frühstück-Erinnerung"
            right={<Switch value={notifMorning} onValueChange={setNotifMorning} trackColor={{ true: colors.primary }} />}
          />
          <Separator />
          <SettingsRow
            emoji="☀️" label="Mittags erinnern" sub="Mittags-Erinnerung"
            right={<Switch value={notifNoon} onValueChange={setNotifNoon} trackColor={{ true: colors.primary }} />}
          />
          <Separator />
          <SettingsRow
            emoji="🌙" label="Abends erinnern" sub="Abend-Erinnerung"
            right={<Switch value={notifEvening} onValueChange={setNotifEvening} trackColor={{ true: colors.primary }} />}
          />
          <Separator />
          <SettingsRow
            emoji="⚠️" label="Niedrig-Bestand Alarm" sub="Bei weniger als Mindestbestand"
            right={<Switch value={notifLowStock} onValueChange={setNotifLowStock} trackColor={{ true: colors.primary }} />}
          />
        </Section>

        {/* Account */}
        <Section title="KONTO">
          <SettingsRow emoji="🚪" label="Abmelden" danger onPress={handleLogout} right={null} />
        </Section>

        <Text style={[styles.version, { color: colors.textMuted }]}>PawTracker v1.0 · Made with 🐾</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  scrollContent:  { padding: 16, paddingBottom: 48 },
  screenTitle:    { fontSize: 26, fontWeight: '800', marginBottom: 20 },
  profileCard: {
    borderRadius: RADIUS.xl, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20,
  },
  avatarWrap:     {},
  avatar:         { width: 64, height: 64, borderRadius: 999 },
  avatarFallback: { width: 64, height: 64, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  profileName:    { fontSize: 20, fontWeight: '800' },
  pointsBadge:    { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  pointsBadgeText: { fontSize: 13, fontWeight: '700' },
  section:        { marginBottom: 20 },
  sectionTitle:   { fontSize: 11, fontWeight: '700', marginBottom: 8, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
  sectionCard:    { borderRadius: RADIUS.xl, overflow: 'hidden' },
  householdInfo:  { padding: 16 },
  householdName:  { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  inviteWrap:     { borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  inviteLabel:    { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  inviteCode:     { fontSize: 24, fontWeight: '800', letterSpacing: 4 },
  separator:      { height: 1, marginLeft: 52 },
  row:            { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, minHeight: 58 },
  rowEmoji:       { fontSize: 22, width: 28 },
  rowInfo:        { flex: 1 },
  rowLabel:       { fontSize: 16, fontWeight: '600' },
  rowSub:         { fontSize: 12, marginTop: 1 },
  rowChevron:     { fontSize: 20 },
  membersList:    { padding: 16 },
  membersTitle:   { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  memberRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  memberDot:      { width: 8, height: 8, borderRadius: 999 },
  memberName:     { flex: 1, fontSize: 15 },
  memberPoints:   { fontSize: 13 },
  themePill:      { borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 4 },
  themePillText:  { fontSize: 13, fontWeight: '700' },
  version:        { textAlign: 'center', fontSize: 12, marginTop: 8 },
});
