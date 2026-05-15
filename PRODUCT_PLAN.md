# PawTracker — Vollständiger Produktentwicklungsplan

> **Tagline:** *"Wer hat die Katzen gefüttert? Du weißt es sofort."*

---

## 1. Produktvision & Positionierung

**PawTracker** ist eine Echtzeit-Haushalt-App für Katzenbesitzer, die mit mehreren Personen zusammenleben. Das Kernproblem: "Hat jemand die Katzen schon gefüttert?" führt zu Doppelfütterungen oder vergessenen Mahlzeiten. PawTracker löst das mit einem Blick.

### Zielgruppe
- Haushalte mit 2–6 Personen und 1–6 Katzen
- Alle Altersgruppen (Design muss für 60+ funktionieren)
- iOS & Android, mit Web-Zugang als Bonus

### Alleinstellungsmerkmale
1. **Real-Time Board** — Fütterungsstatus ändert sich sofort für alle
2. **Intelligente Warnungen** — Doppel-Fütterung wird sofort erkannt
3. **Vorratstracking** — Futter läuft nie aus ohne Vorwarnung
4. **Gamification** — Haushaltsmitglieder sammeln Punkte
5. **One-Tap Feeding** — Fütterung in unter 3 Sekunden eintragen

---

## 2. App-Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  React Native + Expo (iOS, Android, Web)                │
│  Expo Router · NativeWind · Zustand                     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                  SUPABASE BACKEND                       │
│                                                         │
│  Auth ──── Realtime ──── Database ──── Storage          │
│  (JWT)     (WebSocket)   (PostgreSQL)  (Photos/Assets)  │
│                                                         │
│  Edge Functions (Notifications, Prognosen)              │
└─────────────────────────────────────────────────────────┘
```

### Tech-Stack Entscheidung

| Kategorie | Empfehlung | Begründung |
|-----------|------------|------------|
| Frontend | React Native + Expo SDK 52 | Ein Codebase für iOS, Android, Web |
| Navigation | Expo Router v4 | File-based, ähnlich Next.js |
| Styling | NativeWind v4 | Tailwind CSS für React Native |
| State | Zustand | Minimal, kein Redux-Overhead |
| Backend | Supabase | PostgreSQL + Realtime + Auth |
| Auth | Supabase Auth | Email + Google + Apple Login |
| Push | Expo Notifications | Cross-platform |
| Charts | Victory Native | Moderne Visualisierungen |
| Forms | React Hook Form + Zod | Typsichere Formulare |

---

## 3. Datenbankstruktur (PostgreSQL / Supabase)

### Tabellen-Übersicht

```
households ─────┬── profiles (users)
                ├── cats
                ├── foods
                └── feedings ──── feeding_ratings

```

### Vollständiges Schema (→ supabase/schema.sql)

```sql
-- Haushalte
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substring(gen_random_uuid()::text, 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nutzerprofile
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  household_id UUID REFERENCES households(id),
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Katzen
CREATE TABLE cats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  birth_date DATE,
  notes TEXT,
  favorite_food_id UUID,
  intolerances TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Futtersorten
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  variety TEXT,
  type TEXT CHECK (type IN ('wet', 'dry', 'treat', 'supplement')),
  unit TEXT DEFAULT 'Portion',
  stock_count INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  photo_url TEXT,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fütterungen
CREATE TABLE feedings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) NOT NULL,
  cat_id UUID REFERENCES cats(id) NOT NULL,
  food_id UUID REFERENCES foods(id),
  meal_type TEXT CHECK (meal_type IN ('morning', 'noon', 'evening', 'extra')),
  fed_at TIMESTAMPTZ DEFAULT NOW(),
  fed_by UUID REFERENCES profiles(id),
  notes TEXT,
  eaten_status TEXT CHECK (eaten_status IN ('all', 'most', 'little', 'none')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Einkaufsliste
CREATE TABLE shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) NOT NULL,
  food_id UUID REFERENCES foods(id),
  custom_item TEXT,
  quantity INTEGER DEFAULT 1,
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedings ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- Policy: Nur Haushaltsmitglieder sehen eigene Daten
CREATE POLICY "household_access" ON feedings
  USING (household_id = (
    SELECT household_id FROM profiles WHERE id = auth.uid()
  ));
```

---

## 4. UI/UX Design-Konzept

### Design-System

```
Primärfarbe:   #FF6B6B  (Warmes Korallrot — Katzen-Energie)
Sekundär:      #4ECDC4  (Türkis — frisch, modern)
Akzent:        #FFE66D  (Gelb — Warnungen, Punkte)
Hintergrund:   #F8F9FF  (Fast-Weiß mit Blaustich)
Karten:        #FFFFFF  mit box-shadow
Dark-Mode BG:  #1A1B2E

Schrift:       Inter (System) oder Outfit (Google Fonts)
Radius:        16px (Karten), 12px (Buttons), 999px (Pills)
Spacing:       4/8/12/16/24/32px Grid
```

### Farbsemantik für Mahlzeiten

```
Grüner Kreis  = ✅ Gefüttert  (#22C55E)
Grauer Kreis  = ⭕ Ausstehend  (#94A3B8)
Roter Puls    = ⚠️ Überfällig  (#EF4444, animiert)
Oranger Ring  = 🕐 Bald fällig (#F97316)
```

---

## 5. Screens & Navigation

```
Root
 ├── (auth)
 │    ├── /login          — Email/Google/Apple Login
 │    └── /register       — Registrierung + Haushalt erstellen/beitreten
 │
 └── (app)               — Tab Navigation
      ├── / (Dashboard)   — Fütterungs-Board (Heute)
      ├── /cats           — Katzenverwaltung
      ├── /food           — Futtervorrat
      ├── /stats          — Statistiken & Charts
      └── /settings       — Haushalt, Profil, Benachrichtigungen

 Modals:
      ├── /feed-modal     — Fütterung eintragen
      ├── /cat-detail     — Katzen-Detailseite
      ├── /food-detail    — Futter-Detailseite
      └── /invite         — Mitglieder einladen
```

---

## 6. Screens im Detail

### Screen 1: Dashboard (Hauptansicht)

```
┌────────────────────────────────┐
│  Mittwoch, 14. Mai     🔔  👤  │
│  ─────────────────────────────│
│  Guten Morgen, Sarah! 🌅       │
│                                │
│  Heute noch offen:  1 Katze   │
│  ┌─────────────────────────┐  │
│  │  🐱 Luna                │  │
│  │  ☀️ Morgens  ✅ 07:12   │  │
│  │  ☀️ Mittags  ✅ 12:45   │  │
│  │  🌙 Abends   ⭕ offen   │  │
│  │  ──────────────────────│  │
│  │  [  + Jetzt füttern  ] │  │
│  └─────────────────────────┘  │
│                                │
│  ┌─────────────────────────┐  │
│  │  🐱 Momo     Alle ✅   │  │
│  └─────────────────────────┘  │
└────────────────────────────────┘
```

### Screen 2: Fütterungs-Modal (One-Tap)

```
┌────────────────────────────────┐
│  ⬇ Luna füttern                │
│  ─────────────────────────────│
│  Mahlzeit:  [ 🌙 Abends ]     │
│                                │
│  Futter wählen:               │
│  ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ Miez │ │ Royal │ │ Felix│  │
│  │ Menu │ │ Canin │ │      │  │
│  └──────┘ └──────┘ └──────┘  │
│                                │
│  Notiz: (optional)            │
│  ┌────────────────────────┐   │
│  │                        │   │
│  └────────────────────────┘   │
│                                │
│  [    ✅ Fütterung eintragen  ]│
└────────────────────────────────┘
```

### Screen 3: Statistiken

```
┌────────────────────────────────┐
│  📊 Auswertungen               │
│  ─────────────────────────────│
│  Diese Woche                   │
│  ┌────────────────────────┐   │
│  │ Heatmap: Fütterzeit    │   │
│  │ Mo Di Mi Do Fr Sa So  │   │
│  │ ██ ██ ██ ██ ██ ░░ ░░  │   │
│  └────────────────────────┘   │
│                                │
│  Lieblingsfutter               │
│  Luna: ██████ Miez Menu (72%) │
│  Momo: ████   Royal Canin(48%)│
│                                │
│  Wer füttert am meisten?      │
│  🥇 Sarah   34 Fütterungen    │
│  🥈 Tom     28 Fütterungen    │
└────────────────────────────────┘
```

---

## 7. MVP vs. Vollversion

### MVP (4–6 Wochen Entwicklung)

- [x] Login / Registrierung
- [x] Haushalt erstellen & beitreten
- [x] Katzen anlegen (Name, Foto)
- [x] Fütterungs-Board (Heute)
- [x] Fütterung eintragen (Katze, Futter, Mahlzeit)
- [x] Echtzeit-Sync via Supabase Realtime
- [x] Push-Benachrichtigung bei vergessener Mahlzeit
- [x] Einfache Futterauswahl

### Version 1.5 (2–3 Wochen nach MVP)

- [ ] Futtervorratsystem mit Verbrauchstracking
- [ ] Bewertungssystem nach Fütterung
- [ ] Statistik-Dashboard mit Charts
- [ ] Wochenübersicht
- [ ] Dark Mode

### Version 2.0 (Langfristig)

- [ ] Barcode-Scanner für Futter
- [ ] Apple Watch / WearOS Widget
- [ ] Siri / Google Assistant Shortcuts
- [ ] Automatische Verbrauchsprognose (ML)
- [ ] Gamification + Punkte-System
- [ ] Tierarzt-Terminkalender
- [ ] Gewichtstracking
- [ ] Medikamenten-Erinnerungen

---

## 8. Supabase Edge Functions (Backend-Logik)

```
supabase/functions/
├── check-missed-meals/     — Cron: prüft ob Mahlzeiten vergessen
├── deduct-stock/           — Trigger: zieht Vorrat ab nach Fütterung
├── send-push/              — Expo Push API aufrufen
└── generate-invite/        — Eindeutigen Invite-Code erstellen
```

---

## 9. Gamification-System

```
Punkte-Vergabe:
  +10 Punkte  → Fütterung pünktlich eintragen
  +5 Punkte   → Bewertung hinterlassen
  +3 Punkte   → Notiz hinzufügen
  +20 Punkte  → Streak: 7 Tage alle Mahlzeiten eingetragen
  -0 Punkte   → Keine Strafe (motivierend, nicht bestrafend)

Abzeichen (Badges):
  🐾 Erstes Füttern
  ⭐ Bewerter (10 Bewertungen)
  🦁 Katzen-Experte (100 Fütterungen)
  🔥 Streak-König (30 Tage)
  🛒 Vorratswächter (3x Bestand aufgefüllt)
```

---

## 10. Sicherheit & Datenschutz

- Row Level Security (RLS) in Supabase — Nutzer sehen NUR eigene Haushaltsdaten
- JWT-Tokens mit kurzer Laufzeit + Auto-Refresh
- Foto-Upload: nur authentifizierte Nutzer, Bucket-Policies in Supabase Storage
- Keine persönlichen Daten an Dritte weitergegeben
- DSGVO-konform: Datenlöschung auf Anfrage möglich

---

*Erstellt mit PawTracker Product Plan Generator — Version 1.0*
