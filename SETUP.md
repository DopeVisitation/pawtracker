# PawTracker – Setup-Anleitung

## Voraussetzungen

- Node.js 18+
- Expo CLI: `npm install -g expo-cli eas-cli`
- Supabase Account (kostenlos auf supabase.com)
- iOS Simulator (Mac) oder Android Emulator

---

## 1. Projekt einrichten

```bash
# Dependencies installieren
npm install

# Umgebungsvariablen einrichten
cp .env.example .env
```

---

## 2. Supabase einrichten

1. Gehe zu [supabase.com](https://supabase.com) → "New Project"
2. Projekt erstellen (Name: `pawtracker`, Region: Frankfurt)
3. Unter **Settings → API** die URL und den Anon Key kopieren
4. In `.env` eintragen:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
   ```

---

## 3. Datenbank einrichten

Im Supabase Dashboard unter **SQL Editor**:

```sql
-- Komplettes Schema einfügen aus:
-- supabase/schema.sql
```

Oder via Supabase CLI:
```bash
npx supabase db push
```

---

## 4. Storage einrichten

Im Supabase Dashboard unter **Storage**:
- Neuen Bucket `photos` erstellen
- Bucket auf "Public" setzen (oder mit Policies sichern)

---

## 5. App starten

```bash
# Entwicklungsserver starten
npx expo start

# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android

# Web (Browser)
npx expo start --web
```

---

## 6. Edge Functions deployen (optional, für Push Notifications)

```bash
npx supabase functions deploy check-missed-meals

# Cron Job einrichten (Supabase Dashboard → Edge Functions → Schedules)
# Cron: 0 11,14,22 * * *
```

---

## 7. Production Build (EAS)

```bash
# EAS konfigurieren
eas build:configure

# iOS TestFlight Build
eas build --platform ios --profile preview

# Android APK
eas build --platform android --profile preview

# App Store / Play Store
eas build --platform all --profile production
```

---

## Dateistruktur

```
PawTracker/
├── app/
│   ├── _layout.tsx          ← Root Layout + Auth Handling
│   ├── (auth)/
│   │   ├── login.tsx         ← Login Screen
│   │   └── register.tsx      ← Registrierung (2-Step)
│   └── (app)/
│       ├── _layout.tsx       ← Tab Navigation + Realtime
│       ├── index.tsx         ← 🏠 Dashboard (Fütterungs-Board)
│       ├── cats.tsx          ← 🐱 Katzenverwaltung
│       ├── food.tsx          ← 🥫 Futtervorrat
│       ├── stats.tsx         ← 📊 Statistiken
│       └── settings.tsx      ← ⚙️ Einstellungen
├── components/
│   └── FeedModal.tsx         ← Fütterungs-Modal
├── lib/
│   ├── supabase.ts           ← Supabase Client + Helpers
│   ├── theme.ts              ← Design Tokens
│   └── notifications.ts      ← Push Notifications
├── stores/
│   └── appStore.ts           ← Zustand Global State
├── types/
│   └── index.ts              ← TypeScript Types
└── supabase/
    ├── schema.sql            ← PostgreSQL Schema
    └── edge-functions/
        └── check-missed-meals/ ← Cron für Erinnerungen
```

---

## Technologie-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Framework | React Native + Expo | Einmal coden, überall deployen |
| Backend | Supabase | PostgreSQL + Auth + Realtime out-of-the-box |
| State | Zustand | Minimal, kein Boilerplate |
| Navigation | Expo Router | File-based, modern |
| Push | Expo Notifications | Cross-platform, kein eigener Server |

---

## Kosten-Übersicht

| Service | Plan | Kosten |
|---|---|---|
| Supabase | Free Tier | 0€/Monat (bis 50K MAU) |
| Expo EAS | Free Tier | 0€/Monat (30 Builds/Monat) |
| Apple Developer | Pflicht für iOS | 99€/Jahr |
| Google Play | Einmalig | 25$ einmalig |

**Fazit: Für Privatnutzung komplett kostenlos!**
