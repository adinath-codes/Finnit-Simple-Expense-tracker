import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionStorage } from "./session-storage.types";

// Browsers have no SecureStore/Keychain equivalent. Native builds resolve the
// .native adapter; the static web build keeps the existing browser persistence.
export const sessionStorage: SessionStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
