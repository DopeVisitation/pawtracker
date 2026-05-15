import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Share, Switch, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useAppStore } from '../../stores/appStore';
import { useColors, useTheme } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { authHelpers, supabase } from '../../lib/supabase';

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

// ──────────────────────────────────────────────────────────────
// Delete Data Modal (password = household invite code)
// ──────────────────────────────────────────────────────────────
function DeleteDataModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { household } = useAppStore();
  const colors = useColors();
  const [code, setCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reset = () => { setCode(''); setError(''); setDone(false); };

  const handleDelete = async () => {
    if (!household) return;
    if (code.trim().toUpperCase() !== household.invite_code.toUpperCase()) {
      setError('Falscher Code. Bitte den Einladungscode eingeben.');
      return;
    }
    setDeleting(true);
    setError('');
    await Promise.all([
      supabase.from('feedings').delete().eq('household_id', household.id),
      supabase.from('outdoor_sessions').delete().eq('household_id', household.id),
      supabase.from('gallery_photos').delete().eq('household_id', household.id),
      supabase.from('litter_boxes').delete().eq('household_id', household.id),
      supabase.from('cats').update({ is_active: false }).eq('household_id', household.id),
      supabase.from('foods').update({ is_active: false }).eq('household_id', household.id),
    ]);
    setDeleting(false);
    setDone(true);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={onClose} onShow={reset}>
      <View style={[dm.container, { backgroundColor: colors.card }]}>
        <View style={[dm.handle, { backgroundColor: colors.border }]} />
        <View style={[dm.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[dm.cancel, { color: colors.textMuted }]}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={[dm.title, { color: '#dc2626' }]}>Daten löschen</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {done ? (
            <View style={dm.doneWrap}>
              <Text style={{ fontSize: 64 }}>✅</Text>
              <Text style={[dm.doneTitle, { color: colors.text }]}>Alle Daten gelöscht</Text>
              <Text style={[dm.doneSub, { color: colors.textMuted }]}>
                Alle Fütterungen, Katzen, Futter und Aktivitäten wurden entfernt.
              </Text>
              <TouchableOpacity style={[dm.doneBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
                <Text style={dm.doneBtnText}>Schließen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[dm.warningBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                <Text style={dm.warningTitle}>⚠️ Achtung – unwiderruflich!</Text>
                <Text style={dm.warningText}>
                  Diese Aktion löscht dauerhaft:{'\n'}
                  • Alle Fütterungen & Notizen{'\n'}
                  • Alle Katzen & Futter{'\n'}
                  • Alle Freigang-Einträge{'\n'}
                  • Alle Galerie-Fotos{'\n'}
                  • Alle Klo-Einträge{'\n\n'}
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </Text>
              </View>

              <Text style={[dm.label, { color: colors.textSecondary }]}>
                Zur Bestätigung Einladungscode eingeben:
              </Text>
              <View style={[dm.codeHint, { backgroundColor: colors.surface }]}>
                <Text style={[dm.codeHintLabel, { color: colors.textMuted }]}>Dein Einladungscode</Text>
                <Text style={[dm.codeHintValue, { color: colors.primary }]}>{household?.invite_code}</Text>
              </View>
              <TextInput
                style={[dm.input, { borderColor: error ? '#ef4444' : colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                value={code} onChangeText={(t) => { setCode(t); setError(''); }}
                placeholder="Code eingeben…" placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
              {error ? <Text style={dm.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[dm.deleteBtn, { backgroundColor: code.trim() ? '#dc2626' : colors.surface, opacity: deleting ? 0.6 : 1 }]}
                onPress={handleDelete} disabled={deleting || !code.trim()}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[dm.deleteBtnText, { color: code.trim() ? '#fff' : colors.textMuted }]}>
                      🗑️ Alle Daten endgültig löschen
                    </Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  container:      { flex: 1 },
  handle:         { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title:          { fontSize: 18, fontWeight: '700' },
  cancel:         { fontSize: 16 },
  warningBox:     { borderRadius: RADIUS.xl, borderWidth: 1.5, padding: 16, marginBottom: 24 },
  warningTitle:   { fontSize: 15, fontWeight: '800', color: '#dc2626', marginBottom: 8 },
  warningText:    { fontSize: 14, color: '#b91c1c', lineHeight: 22 },
  label:          { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  codeHint:       { borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginBottom: 10 },
  codeHintLabel:  { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  codeHintValue:  { fontSize: 22, fontWeight: '800', letterSpacing: 4 },
  input:          { borderWidth: 1.5, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18, textAlign: 'center', letterSpacing: 4, fontWeight: '700', marginBottom: 8 },
  errorText:      { color: '#ef4444', fontSize: 13, marginBottom: 8 },
  deleteBtn:      { borderRadius: RADIUS.xl, padding: 16, alignItems: 'center', marginTop: 8 },
  deleteBtnText:  { fontSize: 16, fontWeight: '700' },
  doneWrap:       { alignItems: 'center', paddingTop: 32, gap: 12 },
  doneTitle:      { fontSize: 22, fontWeight: '800' },
  doneSub:        { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  doneBtn:        { borderRadius: RADIUS.full, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  doneBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default function SettingsScreen() {
  const { profile, household, members } = useAppStore();
  const colors = useColors();
  const { mode, setMode, isDark } = useTheme();

  const [notifMorning, setNotifMorning] = useState(true);
  const [notifNoon, setNotifNoon] = useState(true);
  const [notifEvening, setNotifEvening] = useState(true);
  const [notifLowStock, setNotifLowStock] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

        {/* Danger zone */}
        <Section title="GEFAHRENZONE">
          <SettingsRow
            emoji="🗑️"
            label="Alle Daten löschen"
            sub="Fütterungen, Katzen, Galerie, Freigang – alles"
            danger
            onPress={() => setShowDeleteModal(true)}
            right={null}
          />
        </Section>

        <Text style={[styles.version, { color: colors.textMuted }]}>PawTracker v1.0 · Made with 🐾</Text>
      </ScrollView>

      <DeleteDataModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
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
