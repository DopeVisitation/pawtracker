import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('feedings', {
      name: 'Fütterungen',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Save token to profile
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);

  return token;
}

// Schedule local notifications for meal reminders
export async function scheduleMealReminders() {
  // Cancel existing
  await Notifications.cancelAllScheduledNotificationsAsync();

  const meals = [
    { hour: 7, minute: 30, label: 'Morgens', emoji: '🌅' },
    { hour: 12, minute: 0,  label: 'Mittags', emoji: '☀️' },
    { hour: 18, minute: 30, label: 'Abends',  emoji: '🌙' },
  ];

  for (const meal of meals) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${meal.emoji} ${meal.label} Fütterung`,
        body: 'Wurden die Katzen schon gefüttert? Schnell nachschauen!',
        data: { meal: meal.label.toLowerCase() },
        sound: true,
      },
      trigger: {
        hour: meal.hour,
        minute: meal.minute,
        repeats: true,
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
      },
    });
  }
}

export async function sendLowStockNotification(foodName: string, stock: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🛒 Vorrat wird knapp!',
      body: `${foodName} hat nur noch ${stock} Portionen. Bitte nachkaufen!`,
      data: { type: 'low_stock' },
    },
    trigger: null, // Show immediately
  });
}

export async function sendDoubleFeedingWarning(catName: string, mealType: string, fedBy: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Doppelfütterung!',
      body: `${catName} wurde für ${mealType} schon von ${fedBy} gefüttert!`,
      data: { type: 'double_feeding' },
    },
    trigger: null,
  });
}
