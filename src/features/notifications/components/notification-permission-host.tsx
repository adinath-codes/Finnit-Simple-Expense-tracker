import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { useAppToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  useJournalActions,
  useJournalData,
  useJournalStatus,
} from "@/providers/app-providers";
import { localDayKey } from "@/utils/dates";
import { NotificationPermissionModal } from "./notification-permission-modal";
import {
  markNotificationRationaleShown,
  wasNotificationRationaleShown,
} from "../services/notification-consent-store";
import { subscribeToFirstJournalEntry } from "../services/entry-events";
import {
  cancelJournalReminders,
  getJournalReminderPermission,
  requestJournalReminderPermission,
  scheduleJournalReminders,
} from "../services/notification-service";

export function NotificationPermissionHost() {
  const pathname = usePathname();
  const userId = useSession().session?.user.id;
  const { entries, settings } = useJournalData();
  const { updateSettings } = useJournalActions();
  const { initialSyncReady, settingsReady } = useJournalStatus();
  const { setToastPresentationPaused } = useAppToast();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const entriesRef = useRef(entries);
  const eligibleRef = useRef(false);
  const pendingFirstEntryUserId = useRef<string | null>(null);
  settingsRef.current = settings;
  entriesRef.current = entries;
  eligibleRef.current = !!userId && pathname === "/" && settingsReady && initialSyncReady;

  const loggedToday = useCallback(() =>
    entriesRef.current.some((entry) => entry.date === localDayKey()), []);

  const enableReminders = useCallback(async () => {
    if (!userId) return;
    await updateSettings({ reminders: true });
    await scheduleJournalReminders(settingsRef.current.reminderTime, loggedToday());
  }, [loggedToday, updateSettings, userId]);

  const offerPermission = useCallback(async (entryUserId: string) => {
    if (entryUserId !== userId) return;
    if (!eligibleRef.current) {
      pendingFirstEntryUserId.current = entryUserId;
      return;
    }
    pendingFirstEntryUserId.current = null;
    if (await wasNotificationRationaleShown(userId)) return;
    await markNotificationRationaleShown(userId);
    const permission = await getJournalReminderPermission();
    if (!permission.granted && !permission.canAskAgain) return;
    setError(null);
    setToastPresentationPaused(true);
    setVisible(true);
  }, [setToastPresentationPaused, userId]);

  useEffect(() => () => {
    setToastPresentationPaused(false);
  }, [setToastPresentationPaused]);

  useEffect(() => {
    if (Platform.OS === "web" || !userId) return;
    return subscribeToFirstJournalEntry((entryUserId) => {
      void offerPermission(entryUserId);
    });
  }, [offerPermission, userId]);

  useEffect(() => {
    if (!eligibleRef.current || pendingFirstEntryUserId.current !== userId || !userId) return;
    void offerPermission(userId);
  }, [initialSyncReady, offerPermission, pathname, settingsReady, userId]);

  useEffect(() => {
    if (Platform.OS === "web" || !userId || !settingsReady || !initialSyncReady) return;
    if (!settings.reminders) {
      void cancelJournalReminders().catch(() => undefined);
      return;
    }
    void getJournalReminderPermission().then((permission) => {
      if (permission.granted) {
        return scheduleJournalReminders(settings.reminderTime, loggedToday());
      }
    }).catch(() => undefined);
  }, [entries.length, initialSyncReady, loggedToday, settings.reminderTime, settings.reminders, settingsReady, userId]);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const granted = await requestJournalReminderPermission();
      if (!granted) {
        setError("Notifications are still off. You can enable them later in your phone settings.");
        return;
      }
      await enableReminders();
      setVisible(false);
      setToastPresentationPaused(false);
    } catch {
      setError("I couldn’t set reminders up just now. Try once more.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NotificationPermissionModal
      busy={busy}
      error={error}
      onAllow={() => { void allow(); }}
      onDismiss={() => {
        setError(null);
        setVisible(false);
        setToastPresentationPaused(false);
      }}
      visible={visible}
    />
  );
}
