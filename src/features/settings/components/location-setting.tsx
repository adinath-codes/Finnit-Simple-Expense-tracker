import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";
import {
  getEntryLocationPermission,
  requestEntryLocationPermission,
} from "@/services/location-service";

type PermissionSnapshot = {
  status: "granted" | "denied" | "undetermined";
  canAskAgain: boolean;
} | null;

/** Keeps the preference honest: it is enabled only after foreground access. */
export function useLocationSetting(
  enabled: boolean,
  savePreference: (enabled: boolean) => Promise<unknown>,
) {
  const [permission, setPermission] = useState<PermissionSnapshot>(null);
  const [busy, setBusy] = useState(false);

  const refreshPermission = useCallback(async () => {
    const next = await getEntryLocationPermission();
    setPermission(next ? {
      status: next.status,
      canAskAgain: next.canAskAgain,
    } : null);
  }, []);

  useEffect(() => {
    void refreshPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPermission();
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  const setEnabled = useCallback(async (nextEnabled: boolean) => {
    if (!nextEnabled) {
      await savePreference(false);
      return;
    }

    setBusy(true);
    try {
      const next = await requestEntryLocationPermission();
      setPermission(next ? {
        status: next.status,
        canAskAgain: next.canAskAgain,
      } : null);
      await savePreference(next?.status === "granted");
    } finally {
      setBusy(false);
    }
  }, [savePreference]);

  const permissionGranted = permission?.status === "granted";
  return {
    busy,
    permissionGranted,
    needsSettings: permission?.status === "denied" && !permission.canAskAgain,
    subtitle: permission === null
      ? enabled
        ? "Checking location permission"
        : "Journal works normally without it"
      : permission.status === "denied" && !permission.canAskAgain
        ? "Location access is off in device settings"
      : !enabled
        ? "Journal works normally without it"
      : permissionGranted
        ? "Approximate place context enabled"
        : permission.canAskAgain
          ? "Allow location to add place context"
          : "Location access is off in device settings",
    setEnabled,
    openSettings: () => void Linking.openSettings(),
  };
}
