-- Tabellen-Berechtigungen explizit setzen
GRANT ALL ON public.households TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.cats TO authenticated;
GRANT ALL ON public.foods TO authenticated;
GRANT ALL ON public.feedings TO authenticated;
GRANT ALL ON public.shopping_list TO authenticated;
GRANT ALL ON public.badges TO authenticated;

-- Household-Policy neu setzen (mit expliziter Rolle)
DROP POLICY IF EXISTS "create_household" ON households;
CREATE POLICY "create_household" ON households
  FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "update_own_household" ON households;
CREATE POLICY "update_own_household" ON households
  FOR UPDATE TO authenticated USING (
    id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "read_own_household" ON households;
CREATE POLICY "read_own_household" ON households
  FOR SELECT TO authenticated USING (
    id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );
