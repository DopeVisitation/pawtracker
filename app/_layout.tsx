import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../stores/appStore';
import { useRouter, useSegments } from 'expo-router';
import { ThemeProvider, useTheme } from '../lib/theme-context';

function RootNavigator() {
  const { isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { setProfile, setHousehold, fetchAll } = useAppStore();
  const navigationReady = useRef(false);

  useEffect(() => {
    navigationReady.current = true;
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => handleSession(session?.user?.id), 100);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setTimeout(() => handleSession(session?.user?.id), 200);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSession = async (userId?: string) => {
    const currentSegment = segments[0] as string | undefined;
    const inAuth = currentSegment === '(auth)' || currentSegment === undefined;

    if (!userId) {
      setProfile(null);
      setHousehold(null);
      if (!inAuth) router.replace('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) {
      if (!inAuth) router.replace('/login');
      return;
    }

    setProfile(profile);

    if (profile.household_id) {
      const { data: household } = await supabase
        .from('households')
        .select('*')
        .eq('id', profile.household_id)
        .single();

      if (household) {
        setHousehold(household);
        await fetchAll();
        if (inAuth) router.replace('/');
        return;
      }
    }

    router.replace('/setup');
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
