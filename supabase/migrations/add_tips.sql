-- ============================================================
-- PawTracker – Tips CRUD + User Status Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- HOUSEHOLD_TIPS: Verwaltbare Tipp-Liste pro Haushalt
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS household_tips (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  emoji        TEXT DEFAULT '🎯',
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  duration     TEXT DEFAULT '15 Min',
  category     TEXT CHECK (category IN ('play', 'care', 'explore', 'cuddle')) DEFAULT 'care',
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- TIP_USER_STATUS: Pro Benutzer pro Tag – erledigt + gewürfelt
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tip_user_status (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  tip_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  completed       BOOLEAN DEFAULT FALSE,
  rolled          BOOLEAN DEFAULT FALSE,
  active_tip_id   UUID REFERENCES household_tips(id) ON DELETE SET NULL,
  UNIQUE (profile_id, tip_date)
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS household_tips_household_idx ON household_tips (household_id, is_active);
CREATE INDEX IF NOT EXISTS tip_user_status_profile_date_idx ON tip_user_status (profile_id, tip_date DESC);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
ALTER TABLE household_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_user_status ENABLE ROW LEVEL SECURITY;

-- Alle Haushaltsmitglieder können Tipps lesen/schreiben
CREATE POLICY "household_tips_all" ON household_tips
  FOR ALL
  USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());

-- Jeder User sieht nur seinen eigenen Status
CREATE POLICY "tip_user_status_own" ON tip_user_status
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
