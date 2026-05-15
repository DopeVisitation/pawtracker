-- ============================================================
-- PawTracker – Katzenklo + Freigang Migration
-- Im Supabase SQL Editor ausführen
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- LITTER_BOXES: Katzenklos im Haushalt
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS litter_boxes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  location     TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- LITTER_CLEANINGS: Säuberungs-Einträge pro Klo
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS litter_cleanings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  litter_box_id  UUID REFERENCES litter_boxes(id) ON DELETE CASCADE NOT NULL,
  household_id   UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  cleaned_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cleaned_at     TIMESTAMPTZ DEFAULT NOW(),
  notes          TEXT
);

-- ──────────────────────────────────────────────────────────────
-- OUTDOOR_SESSIONS: Freigang-Zeiten
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outdoor_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  started_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ended_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes        TEXT,
  is_active    BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS litter_boxes_household_idx ON litter_boxes (household_id, is_active);
CREATE INDEX IF NOT EXISTS litter_cleanings_box_idx ON litter_cleanings (litter_box_id, cleaned_at DESC);
CREATE INDEX IF NOT EXISTS outdoor_sessions_household_idx ON outdoor_sessions (household_id, started_at DESC);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
ALTER TABLE litter_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE litter_cleanings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outdoor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "litter_boxes_household" ON litter_boxes
  FOR ALL USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "litter_cleanings_household" ON litter_cleanings
  FOR ALL USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "outdoor_sessions_household" ON outdoor_sessions
  FOR ALL USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());
