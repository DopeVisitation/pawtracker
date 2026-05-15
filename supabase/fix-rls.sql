-- Alle alten Policies entfernen
DROP POLICY IF EXISTS "own_profile" ON profiles;
DROP POLICY IF EXISTS "read_own_profile" ON profiles;
DROP POLICY IF EXISTS "read_household_profiles" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "read_own_household" ON households;
DROP POLICY IF EXISTS "create_household" ON households;
DROP POLICY IF EXISTS "update_own_household" ON households;

-- Neue Policies setzen
CREATE POLICY "read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "read_household_profiles" ON profiles
  FOR SELECT USING (
    household_id IS NOT NULL AND
    household_id = (SELECT household_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "read_own_household" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "create_household" ON households
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "update_own_household" ON households
  FOR UPDATE USING (
    id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );
