-- Rekursive Policy entfernen
DROP POLICY IF EXISTS "read_household_profiles" ON profiles;

-- Hilfsfunktion mit SECURITY DEFINER (läuft als Admin, umgeht RLS)
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$;

-- Policy neu erstellen — nutzt jetzt die sichere Funktion
CREATE POLICY "read_household_profiles" ON profiles
  FOR SELECT USING (
    household_id IS NOT NULL AND
    household_id = get_my_household_id()
  );
