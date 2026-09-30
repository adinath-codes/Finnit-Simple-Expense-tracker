import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createMigratingSessionStorage } from "./session-storage-migration";
import type { SessionStorage } from "./session-storage.types";

const secureStorage: SessionStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const legacyStorage: Pick<SessionStorage, "getItem" | "removeItem"> = {
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const sessionStorage = createMigratingSessionStorage(
  secureStorage,
  legacyStorage,
);
