-- ============================================================
-- PawTracker – Supabase PostgreSQL Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- HOUSEHOLDS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE households (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  invite_code  TEXT UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 6)),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- PROFILES  (extends auth.users)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  household_id  UUID REFERENCES households(id) ON DELETE SET NULL,
  points        INTEGER DEFAULT 0,
  push_token    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- CATS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE cats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  photo_url        TEXT,
  birth_date       DATE,
  notes            TEXT,
  intolerances     TEXT,
  favorite_food_id UUID,  -- FK to foods, set later
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- FOODS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE foods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name           TEXT NOT NULL,
  brand          TEXT,
  variety        TEXT,
  type           TEXT CHECK (type IN ('wet', 'dry', 'treat', 'supplement')) DEFAULT 'wet',
  unit           TEXT DEFAULT 'Portion',
  stock_count    INTEGER DEFAULT 0,
  min_stock      INTEGER DEFAULT 5,
  photo_url      TEXT,
  barcode        TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from cats to foods now that foods table exists
ALTER TABLE cats ADD CONSTRAINT cats_favorite_food_fk
  FOREIGN KEY (favorite_food_id) REFERENCES foods(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────
-- FEEDINGS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE feedings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  cat_id         UUID REFERENCES cats(id) ON DELETE CASCADE NOT NULL,
  food_id        UUID REFERENCES foods(id) ON DELETE SET NULL,
  meal_type      TEXT CHECK (meal_type IN ('morning', 'noon', 'evening', 'extra')) NOT NULL,
  fed_at         TIMESTAMPTZ DEFAULT NOW(),
  fed_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes          TEXT,
  eaten_status   TEXT CHECK (eaten_status IN ('all', 'most', 'little', 'none')),
  rating         INTEGER CHECK (rating BETWEEN 1 AND 5),
  points_awarded INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SHOPPING LIST
-- ──────────────────────────────────────────────────────────────
CREATE TABLE shopping_list (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  food_id        UUID REFERENCES foods(id) ON DELETE CASCADE,
  custom_item    TEXT,
  quantity       INTEGER DEFAULT 1,
  checked        BOOLEAN DEFAULT FALSE,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- BADGES / ACHIEVEMENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  badge_type  TEXT NOT NULL,
  earned_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX feedings_household_date_idx ON feedings (household_id, fed_at DESC);
CREATE INDEX feedings_cat_date_idx ON feedings (cat_id, fed_at DESC);
CREATE INDEX feedings_meal_type_idx ON feedings (household_id, meal_type, fed_at DESC);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
ALTER TABLE households   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods        ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges       ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's household
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$;

-- Policies: Household members only
CREATE POLICY "household_cats" ON cats
  USING (household_id = get_my_household_id());

CREATE POLICY "household_foods" ON foods
  USING (household_id = get_my_household_id());

CREATE POLICY "household_feedings" ON feedings
  USING (household_id = get_my_household_id());

CREATE POLICY "household_shopping" ON shopping_list
  USING (household_id = get_my_household_id());

CREATE POLICY "own_profile" ON profiles
  USING (id = auth.uid() OR household_id = get_my_household_id());

CREATE POLICY "my_badges" ON badges
  USING (profile_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- TRIGGER: Auto-deduct stock after feeding
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_food_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.food_id IS NOT NULL THEN
    UPDATE foods
    SET stock_count = GREATEST(stock_count - 1, 0),
        updated_at  = NOW()
    WHERE id = NEW.food_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_feeding_insert
  AFTER INSERT ON feedings
  FOR EACH ROW EXECUTE FUNCTION deduct_food_stock();

-- ──────────────────────────────────────────────────────────────
-- TRIGGER: Award points after feeding
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_feeding_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_points INTEGER := 10;
BEGIN
  IF NEW.notes IS NOT NULL THEN v_points := v_points + 3; END IF;
  IF NEW.rating IS NOT NULL THEN v_points := v_points + 5; END IF;

  UPDATE profiles
  SET points = points + v_points, updated_at = NOW()
  WHERE id = NEW.fed_by;

  UPDATE feedings SET points_awarded = v_points WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_feeding_award_points
  AFTER INSERT ON feedings
  FOR EACH ROW EXECUTE FUNCTION award_feeding_points();

-- ──────────────────────────────────────────────────────────────
-- VIEW: Today's feeding status per cat
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW today_feeding_status AS
SELECT
  c.id               AS cat_id,
  c.household_id,
  c.name             AS cat_name,
  c.photo_url,
  MAX(CASE WHEN f.meal_type = 'morning' THEN f.fed_at END) AS morning_fed_at,
  MAX(CASE WHEN f.meal_type = 'morning' THEN p.display_name END) AS morning_fed_by,
  MAX(CASE WHEN f.meal_type = 'noon'    THEN f.fed_at END) AS noon_fed_at,
  MAX(CASE WHEN f.meal_type = 'noon'    THEN p.display_name END) AS noon_fed_by,
  MAX(CASE WHEN f.meal_type = 'evening' THEN f.fed_at END) AS evening_fed_at,
  MAX(CASE WHEN f.meal_type = 'evening' THEN p.display_name END) AS evening_fed_by
FROM cats c
LEFT JOIN feedings f ON f.cat_id = c.id
  AND f.fed_at::date = CURRENT_DATE
LEFT JOIN profiles p ON p.id = f.fed_by
WHERE c.is_active = TRUE
GROUP BY c.id, c.household_id, c.name, c.photo_url;
