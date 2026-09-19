import AsyncStorage from "@react-native-async-storage/async-storage";
/** Supabase's documented React Native adapter. Use OS/device security for local data. */
export const sessionStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
