import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ref, set, get } from 'firebase/database';
import { db } from '../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(userId) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    if (userId && token) {
      await set(ref(db, `users/${userId}/pushToken`), token);
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
      });
    }

    return token;
  } catch (error) {
    console.log('Push token hatası:', error);
    return null;
  }
}

export async function sendPushNotificationToPartner(partnerId, title, body) {
  try {
    const tokenSnap = await get(ref(db, `users/${partnerId}/pushToken`));
    if (!tokenSnap.exists()) return;

    const pushToken = tokenSnap.val();

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        color: '#D4AF37',
      }),
    });
  } catch (error) {
    console.log('Bildirim gönderme hatası:', error);
  }
}