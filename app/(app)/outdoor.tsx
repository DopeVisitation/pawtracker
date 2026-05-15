import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useAppStore } from '../../stores/appStore';
import { useColors } from '../../lib/theme-context';
import { RADIUS, SHADOWS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

interface OutdoorSession {
  id: string;
  started_at: string;
  ended_at?: string;
  notes?: string;
  is_active: boolean;
  started_by_profile?: { display_name: string };
  ended_by_profile?: { display_name: string };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatDuration(start: string, end?: string): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

// ──────────────────────────────────────────────────────────────
// Active Session Banner
// ──────────────────────────────────────────────────────────────
function ActiveSessionBanner({
  session, onStop, colors,
}: {
  session: OutdoorSession;
  onStop: (notes: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [elapsed, setElapsed] = useState(formatDuration(session.started_at));
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatDuration(session.started_at));
    }, 30000);
    return () => clearInterval(interval);
  }, [session.started_at]);

  const handleStop = () => {
    Alert.alert('Freigang beenden', 'Die Katzen sind wieder drinnen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Beenden', onPress: () => onStop(notes) },
    ]);
  };

  return (
    <View style={[styles.activeBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
      <View style={styles.activeHeader}>
        <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.activeTitle, { color: colors.primary }]}>🌿 Freigang läuft</Text>
        <Text style={[styles.activeDuration, { color: colors.primary }]}>{elapsed}</Text>
      </View>

      <Text style={[styles.activeInfo, { color: colors.textSecondary }]}>
        Gestartet um {formatTime(session.started_at)}{' '}
        von <Text style={{ fontWeight: '700' }}>{session.started_by_profile?.display_name ?? '—'}</Text>
      </Text>

      {showNotes ? (
        <TextInput
          style={[styles.notesInput, { borderColor: colors.primary, color: colors.text, backgroundColor: colors.card }]}
          value={notes} onChangeText={setNotes}
          placeholder="Notiz hinzufügen (optional)…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
      ) : (
        <TouchableOpacity onPress={() => setShowNotes(true)}>
          <Text style={[styles.addNoteLink, { color: colors.primary }]}>+ Notiz hinzufügen</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.stopBtn, { backgroundColor: colors.primary }]}
        onPress={handleStop}
        activeOpacity={0.85}
      >
        <Text style={styles.stopBtnText}>⬛ Freigang beenden</Text>
      </TouchableOpacity>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Session History Item
// ──────────────────────────────────────────────────────────────
function SessionItem({ session, colors }: { session: OutdoorSession; colors: ReturnType<typeof useColors> }) {
  const duration = session.ended_at ? formatDuration(session.started_at, session.ended_at) : null;
  const isToday = new Date(session.started_at).toDateString() === new Date().toDateString();

  return (
    <View style={[styles.sessionCard, { backgroundColor: colors.card }]}>
      <View style={styles.sessionHeader}>
        <View style={[styles.sessionIcon, { backgroundColor: colors.successLight }]}>
          <Text style={{ fontSize: 20 }}>🌿</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionDate, { color: colors.text }]}>
            {isToday ? 'Heute' : formatDate(session.started_at)}
          </Text>
          <Text style={[styles.sessionTimes, { color: colors.textSecondary }]}>
            {formatTime(session.started_at)}
            {session.ended_at ? ` – ${formatTime(session.ended_at)}` : ' (läuft noch)'}
          </Text>
        </View>
        {duration && (
          <View style={[styles.durationBadge, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.durationText, { color: colors.success }]}>{duration}</Text>
          </View>
        )}
      </View>

      <View style={styles.sessionMeta}>
        <Text style={[styles.sessionMetaText, { color: colors.textMuted }]}>
          Raus: <Text style={{ color: colors.text, fontWeight: '600' }}>
            {session.started_by_profile?.display_name ?? '—'}
          </Text>
        </Text>
        {session.ended_at && (
          <Text style={[styles.sessionMetaText, { color: colors.textMuted }]}>
            Rein: <Text style={{ color: colors.text, fontWeight: '600' }}>
              {session.ended_by_profile?.display_name ?? '—'}
            </Text>
          </Text>
        )}
      </View>

      {session.notes && (
        <View style={[styles.sessionNotes, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sessionNotesText, { color: colors.textSecondary }]}>📝 {session.notes}</Text>
        </View>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────
export default function OutdoorScreen() {
  const { household, profile } = useAppStore();
  const colors = useColors();
  const [activeSession, setActiveSession] = useState<OutdoorSession | null>(null);
  const [sessions, setSessions] = useState<OutdoorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startNotes, setStartNotes] = useState('');
  const [showStartNotes, setShowStartNotes] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;

    const SELECT = `
      id, started_at, ended_at, notes, is_active,
      started_by_profile:profiles!outdoor_sessions_started_by_fkey(display_name),
      ended_by_profile:profiles!outdoor_sessions_ended_by_fkey(display_name)
    `;

    const [activeRes, historyRes] = await Promise.all([
      supabase.from('outdoor_sessions').select(SELECT)
        .eq('household_id', household.id)
        .eq('is_active', true)
        .maybeSingle(),
      supabase.from('outdoor_sessions').select(SELECT)
        .eq('household_id', household.id)
        .eq('is_active', false)
        .order('started_at', { ascending: false })
        .limit(30),
    ]);

    setActiveSession((activeRes.data as any) ?? null);
    setSessions((historyRes.data as any[]) ?? []);
    setLoading(false);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleStart = async () => {
    if (!household || !profile) return;
    await supabase.from('outdoor_sessions').insert({
      household_id: household.id,
      started_by: profile.id,
      started_at: new Date().toISOString(),
      notes: startNotes.trim() || null,
      is_active: true,
    });
    setStartNotes('');
    setShowStartNotes(false);
    await load();
  };

  const handleStop = async (notes: string) => {
    if (!activeSession || !profile) return;
    await supabase.from('outdoor_sessions').update({
      ended_at: new Date().toISOString(),
      ended_by: profile.id,
      notes: notes.trim() || activeSession.notes || null,
      is_active: false,
    }).eq('id', activeSession.id);
    await load();
  };

  // Group history by date
  const grouped: Record<string, OutdoorSession[]> = {};
  for (const s of sessions) {
    const key = formatDate(s.started_at);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>🌿 Freigang</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {activeSession ? 'Katzen sind draußen' : 'Katzen sind drinnen'}
        </Text>
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
          {/* Active session or start button */}
          {activeSession ? (
            <ActiveSessionBanner session={activeSession} onStop={handleStop} colors={colors} />
          ) : (
            <View style={[styles.startCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.startEmoji]}>🌿</Text>
              <Text style={[styles.startTitle, { color: colors.text }]}>Freigang starten</Text>
              <Text style={[styles.startDesc, { color: colors.textMuted }]}>
                Lass die Katzen raus und tracke ihre Außenzeit.
              </Text>

              {showStartNotes ? (
                <TextInput
                  style={[styles.notesInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                  value={startNotes} onChangeText={setStartNotes}
                  placeholder="Notiz (optional)…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              ) : (
                <TouchableOpacity onPress={() => setShowStartNotes(true)} style={{ marginBottom: 12 }}>
                  <Text style={[styles.addNoteLink, { color: colors.primary }]}>+ Notiz hinzufügen</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: colors.primary }]}
                onPress={handleStart}
                activeOpacity={0.85}
              >
                <Text style={styles.startBtnText}>🌿 Freigang starten</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* History */}
          {sessions.length > 0 && (
            <Text style={[styles.historyTitle, { color: colors.text }]}>Vergangene Freigänge</Text>
          )}
          {Object.entries(grouped).map(([date, items]) => (
            <View key={date}>
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{date}</Text>
              {items.map((s) => (
                <SessionItem key={s.id} session={s} colors={colors} />
              ))}
            </View>
          ))}

          {sessions.length === 0 && !activeSession && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🌿</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch kein Freigang</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Starte den ersten Freigang wenn die Katzen raus gehen.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { padding: 20, paddingBottom: 8 },
  title:        { fontSize: 26, fontWeight: '800' },
  subtitle:     { fontSize: 13, marginTop: 2 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  activeBanner: {
    borderRadius: RADIUS.xl, padding: 18, marginBottom: 16,
    borderWidth: 2, ...SHADOWS.md,
  },
  activeHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  activeDot:      { width: 10, height: 10, borderRadius: 999 },
  activeTitle:    { fontSize: 16, fontWeight: '800', flex: 1 },
  activeDuration: { fontSize: 15, fontWeight: '700' },
  activeInfo:     { fontSize: 13, marginBottom: 12 },
  addNoteLink:    { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  notesInput: {
    borderWidth: 1.5, borderRadius: RADIUS.md,
    padding: 12, fontSize: 14, minHeight: 60,
    textAlignVertical: 'top', marginBottom: 12,
  },
  stopBtn:        { borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  stopBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },

  startCard: {
    borderRadius: RADIUS.xl, padding: 24, marginBottom: 20,
    alignItems: 'center', ...SHADOWS.md,
  },
  startEmoji:     { fontSize: 48, marginBottom: 12 },
  startTitle:     { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  startDesc:      { fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  startBtn:       { borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 32 },
  startBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },

  historyTitle:   { fontSize: 17, fontWeight: '800', marginBottom: 8, marginTop: 4 },
  dateLabel: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },

  sessionCard:    { borderRadius: RADIUS.xl, padding: 14, marginBottom: 10, ...SHADOWS.sm },
  sessionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  sessionIcon: {
    width: 44, height: 44, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  sessionDate:    { fontSize: 15, fontWeight: '700' },
  sessionTimes:   { fontSize: 13, marginTop: 2 },
  durationBadge:  { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  durationText:   { fontSize: 12, fontWeight: '700' },
  sessionMeta:    { flexDirection: 'row', gap: 16, marginBottom: 6 },
  sessionMetaText: { fontSize: 13 },
  sessionNotes:   { borderRadius: RADIUS.md, padding: 10 },
  sessionNotesText: { fontSize: 13, fontStyle: 'italic' },

  empty:          { alignItems: 'center', paddingTop: 40 },
  emptyTitle:     { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText:      { fontSize: 14, textAlign: 'center' },
});
