import AsyncStorage from "@react-native-async-storage/async-storage";

const key = (userId: string) => `finn:notification-rationale:v1:${userId}`;

export async function wasNotificationRationaleShown(userId: string) {
  try {
    return (await AsyncStorage.getItem(key(userId))) === "shown";
  } catch {
    return false;
  }
}

export async function markNotificationRationaleShown(userId: string) {
  await AsyncStorage.setItem(key(userId), "shown");
}
