-- Households braucht kein RLS -- nur Name und Einladungscode, keine sensiblen Daten
ALTER TABLE households DISABLE ROW LEVEL SECURITY;
