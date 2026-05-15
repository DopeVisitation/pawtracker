// Supabase Edge Function: Prüft täglich ob Mahlzeiten vergessen wurden
// Cron: 0 11,14,22 * * *  (11:00, 14:00, 22:00 Uhr)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MEAL_WINDOWS: Record<string, { startHour: number; label: string }> = {
  morning: { startHour: 10, label: 'Frühstück' },
  noon:    { startHour: 14, label: 'Mittagessen' },
  evening: { startHour: 22, label: 'Abendessen' },
};

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date();
  const hour = now.getHours();
  const today = now.toISOString().split('T')[0];

  // Find which meal window just closed
  const currentMeal = Object.entries(MEAL_WINDOWS).find(
    ([, v]) => hour === v.startHour,
  );
  if (!currentMeal) return new Response('No meal window', { status: 200 });

  const [mealType, mealInfo] = currentMeal;

  // Find all households
  const { data: households } = await supabase.from('households').select('id, name');
  if (!households) return new Response('No households', { status: 200 });

  for (const household of households) {
    // Get all active cats
    const { data: cats } = await supabase
      .from('cats')
      .select('id, name')
      .eq('household_id', household.id)
      .eq('is_active', true);

    if (!cats) continue;

    // Check which cats were NOT fed
    const { data: feedings } = await supabase
      .from('feedings')
      .select('cat_id')
      .eq('household_id', household.id)
      .eq('meal_type', mealType)
      .gte('fed_at', `${today}T00:00:00`);

    const fedCatIds = new Set((feedings ?? []).map((f) => f.cat_id));
    const unfinishedCats = cats.filter((c) => !fedCatIds.has(c.id));

    if (unfinishedCats.length === 0) continue;

    // Get push tokens of household members
    const { data: profiles } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('household_id', household.id)
      .not('push_token', 'is', null);

    const tokens = (profiles ?? []).map((p) => p.push_token).filter(Boolean);
    if (tokens.length === 0) continue;

    const catNames = unfinishedCats.map((c) => c.name).join(', ');

    // Send Expo push notifications
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map((token) => ({
        to: token,
        title: `⚠️ ${mealInfo.label} vergessen!`,
        body: `${catNames} ${unfinishedCats.length === 1 ? 'wartet' : 'warten'} noch auf ihr ${mealInfo.label}!`,
        data: { meal_type: mealType },
        sound: 'default',
        badge: unfinishedCats.length,
      }))),
    });
  }

  return new Response(JSON.stringify({ checked: true, meal: mealType }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
