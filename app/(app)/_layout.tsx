import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../lib/theme-context';
import { useAppStore } from '../../stores/appStore';
import { useEffect } from 'react';
import { subscribeToFeedings } from '../../lib/supabase';

function TabIcon({ emoji, label, focused, colors }: {
  emoji: string; label: string; focused: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabEmoji, !focused && { opacity: 0.4 }]}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const { household, fetchTodayStatus } = useAppStore();
  const colors = useColors();

  useEffect(() => {
    if (!household) return;
    const unsubscribe = subscribeToFeedings(household.id, fetchTodayStatus);
    return unsubscribe;
  }, [household?.id]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.tabBarBorder,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Heute" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="cats"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🐱" label="Katzen" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="history"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Verlauf" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="notes"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📝" label="Notizen" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="litter"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🚿" label="Klos" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="outdoor"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🌿" label="Freigang" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="gallery"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🖼️" label="Galerie" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="food"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🥫" label="Vorrat" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="stats"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Stats" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Settings" focused={focused} colors={colors} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem:       { alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabEmoji:      { fontSize: 22 },
  tabLabel:      { fontSize: 10, fontWeight: '600' },
});
