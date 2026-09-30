import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  journalReminderCopy,
  nextJournalReminderDates,
  trialExpiryReminderDate,
  type TrialReminderEntitlement,
} from "./notification-content";

const CHANNEL_ID = "journal-reminders";
const REMINDER_KIND = "finn-journal-reminder";
const REMINDER_IDENTIFIER_PREFIX = "finn-journal-reminder:";
const TRIAL_CHANNEL_ID = "trial-reminders";
const TRIAL_REMINDER_KIND = "finn-trial-expiry-reminder";
const TRIAL_REMINDER_IDENTIFIER = "finn-trial-expiry-reminder";
const TRIAL_REMINDER_RECORD_KEY = "finn:trial-reminder-expiry:v1";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    }),
  });
}

async function prepareAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Journal reminders",
    description: "Light reminders from Finnit to keep your money journal complete.",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#20C878",
    vibrationPattern: [0, 180],
  });
}

async function prepareTrialReminderChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(TRIAL_CHANNEL_ID, {
    name: "Trial reminders",
    description: "A reminder before your Finnit Premium free trial ends.",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#20C878",
    vibrationPattern: [0, 180],
  });
}

export function notificationPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus,
) {
  return permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function getJournalReminderPermission() {
  if (Platform.OS === "web") return { granted: false, canAskAgain: false };
  const permission = await Notifications.getPermissionsAsync();
  return {
    granted: notificationPermissionGranted(permission),
    canAskAgain: permission.canAskAgain,
  };
}

export async function requestJournalReminderPermission() {
  if (Platform.OS === "web") return false;
  await prepareAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (notificationPermissionGranted(existing)) return true;
  if (!existing.canAskAgain) return false;
  const permission = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return notificationPermissionGranted(permission);
}

async function requestTrialReminderPermission() {
  if (Platform.OS === "web") return false;
  await prepareTrialReminderChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (notificationPermissionGranted(existing)) return true;
  if (!existing.canAskAgain) return false;
  const permission = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return notificationPermissionGranted(permission);
}

async function notificationAttachment() {
  if (Platform.OS !== "ios") return undefined;
  try {
    const [asset] = await Asset.loadAsync(
      require("@/assets/images/character/header/finn-paperwork.png"),
    );
    if (!asset.localUri) return undefined;
    return [{
      identifier: "finn-paperwork",
      url: asset.localUri,
      type: "public.png",
    }];
  } catch {
    // The reminder itself is more important than its optional rich image.
    return undefined;
  }
}

export async function cancelJournalReminders() {
  if (Platform.OS === "web") return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((request) =>
      request.identifier.startsWith(REMINDER_IDENTIFIER_PREFIX) ||
      request.content.data?.kind === REMINDER_KIND,
    )
    .map((request) =>
      Notifications.cancelScheduledNotificationAsync(request.identifier),
    ));
}

export async function cancelTrialExpiryReminder() {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter((request) =>
        request.identifier === TRIAL_REMINDER_IDENTIFIER ||
        request.content.data?.kind === TRIAL_REMINDER_KIND,
      )
      .map((request) =>
        Notifications.cancelScheduledNotificationAsync(request.identifier),
      ));
  } finally {
    await AsyncStorage.removeItem(TRIAL_REMINDER_RECORD_KEY);
  }
}

export async function syncTrialExpiryReminder(
  entitlement: TrialReminderEntitlement | null,
  requestPermission = false,
) {
  if (Platform.OS === "web") return false;
  const reminderDate = trialExpiryReminderDate(entitlement);
  if (!reminderDate) {
    await cancelTrialExpiryReminder();
    return false;
  }

  await prepareTrialReminderChannel();
  const existing = await Notifications.getPermissionsAsync();
  const granted = notificationPermissionGranted(existing) ||
    (requestPermission && await requestTrialReminderPermission());
  if (!granted) return false;

  const expiryKey = String(entitlement?.expirationDateMillis);
  if (await AsyncStorage.getItem(TRIAL_REMINDER_RECORD_KEY) === expiryKey) {
    return true;
  }

  await cancelTrialExpiryReminder();
  const attachments = await notificationAttachment();
  await Notifications.scheduleNotificationAsync({
    identifier: TRIAL_REMINDER_IDENTIFIER,
    content: {
      title: "Your free trial ends soon",
      subtitle: "Finnit Premium",
      body: "Review your subscription before the trial ends if you don’t want it to renew.",
      data: { kind: TRIAL_REMINDER_KIND, url: "/settings" },
      color: "#20C878",
      sound: "default",
      ...(attachments ? { attachments } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      channelId: TRIAL_CHANNEL_ID,
    },
  });
  await AsyncStorage.setItem(TRIAL_REMINDER_RECORD_KEY, expiryKey);
  return true;
}

export async function scheduleJournalReminders(
  reminderTime: string,
  loggedToday: boolean,
) {
  if (Platform.OS === "web") return;
  const permission = await Notifications.getPermissionsAsync();
  if (!notificationPermissionGranted(permission)) return;
  await prepareAndroidChannel();
  await cancelJournalReminders();
  const attachments = await notificationAttachment();
  const dates = nextJournalReminderDates(reminderTime, new Date(), loggedToday);

  await Promise.all(dates.map((date, index) => {
    const copy = journalReminderCopy(index);
    const dayKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    return Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_IDENTIFIER_PREFIX}${dayKey}`,
      content: {
        title: copy.title,
        subtitle: "Finnit · your money wingman",
        body: copy.body,
        data: { kind: REMINDER_KIND, url: "/" },
        color: "#20C878",
        sound: "default",
        ...(attachments ? { attachments } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
  }));
}
