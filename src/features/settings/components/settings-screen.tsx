import { ZoomLink } from "@/components/navigation/zoom-link";
import type { Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState, type ReactNode } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSheet, SectionLabel } from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import {
  useJournalActions,
  useJournalData,
  useJournalStatus,
} from "@/providers/app-providers";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  scheduleCurrentAccountDeletion,
  signOutCurrentDevice,
} from "@/features/auth/services/auth-service";
import {
  clearOnboardingSnapshot,
} from "@/storage/onboarding-repository";
import {
  CurrencyPicker,
  currencyDisplay,
} from "@/components/forms/currency-picker";
import {
  ANALYTICS_EVENTS,
  analyticsClient,
  captureAnalytics,
} from "@/lib/analytics/analytics";
import { useSubscription } from "@/features/paywall/providers/subscription-provider";
import {
  FINN_WEBSITE_URLS,
  type FinnWebsiteUrl,
} from "@/constants/website-links";
import {
  cancelJournalReminders,
  requestJournalReminderPermission,
  scheduleJournalReminders,
} from "@/features/notifications/services/notification-service";
import { localDayKey } from "@/utils/dates";
import {
  openSupportEmail,
  SUPPORT_EMAIL,
} from "@/features/support/services/quota-support";

type Picker = "currency" | null;

export default function SettingsScreen() {
  const { entries, presets, settings } = useJournalData();
  const { updateSettings, clearMutationError } = useJournalActions();
  const { mutationError } = useJournalStatus();
  const { setOnboardingComplete } = useSession();
  const {
    entitlement,
    isActive: hasPremiumAccess,
    isBusy: subscriptionBusy,
    manage: manageSubscription,
    restore: restoreSubscription,
  } = useSubscription();
  const [picker, setPicker] = useState<Picker>(null);
  const [accountBusy, setAccountBusy] = useState<"sign-out" | "delete" | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [showAnalyticsOptOut, setShowAnalyticsOptOut] = useState(false);

  const togglePicker = (next: Exclude<Picker, null>) => {
    setPicker((current) => (current === next ? null : next));
  };
  const applySettings = (patch: Parameters<typeof updateSettings>[0]) =>
    updateSettings(patch);

  const toggleAnalytics = async () => {
    if (settings.analyticsEnabled) {
      setShowAnalyticsOptOut(true);
      return;
    }

    await analyticsClient.optIn();
    await applySettings({ analyticsEnabled: true });
    captureAnalytics(ANALYTICS_EVENTS.analyticsPreferenceChanged, { enabled: true });
  };

  const turnOffAnalytics = async () => {
    setShowAnalyticsOptOut(false);
    await applySettings({ analyticsEnabled: false });
    await analyticsClient.optOut();
  };

  const toggleReminders = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      if (settings.reminders) {
        await cancelJournalReminders();
        await applySettings({ reminders: false });
        return;
      }
      const granted = await requestJournalReminderPermission();
      if (!granted) {
        Alert.alert(
          "Notifications are off",
          "Allow notifications in your phone settings whenever you want Finn’s journal nudges.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => { void Linking.openSettings(); } },
          ],
        );
        return;
      }
      await applySettings({ reminders: true });
      await scheduleJournalReminders(
        settings.reminderTime,
        entries.some((entry) => entry.date === localDayKey()),
      );
    } catch {
      Alert.alert(
        "Couldn’t update reminders",
        "Finn couldn’t change that setting just now. Please try again.",
      );
    } finally {
      setReminderBusy(false);
    }
  };

  const openSubscriptionManagement = async () => {
    setAccountError(null);
    try {
      await manageSubscription();
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "Couldn’t open your subscription settings.",
      );
    }
  };

  const openWebsite = async (
    url: FinnWebsiteUrl,
    reportError: (message: string | null) => void = setAccountError,
  ) => {
    reportError(null);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      reportError("Couldn’t open that webpage. Try again later.");
    }
  };

  const contactSupport = async () => {
    setSupportError(null);
    try {
      await openSupportEmail();
    } catch {
      setSupportError(`Couldn’t open your email app. Contact us at ${SUPPORT_EMAIL}.`);
    }
  };

  const signOut = async () => {
    if (accountBusy) return;
    setAccountBusy("sign-out");
    setAccountError(null);
    try {
      await signOutCurrentDevice();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Couldn’t sign out. Try again.");
      setAccountBusy(null);
    }
  };

  const confirmDelete = () => {
    const perform = async () => {
      if (accountBusy) return;
      setAccountBusy("delete");
      setAccountError(null);
      try {
        await scheduleCurrentAccountDeletion();
        await clearOnboardingSnapshot();
        setOnboardingComplete(false);
      } catch (error) {
        setAccountError(error instanceof Error ? error.message : "Couldn’t delete your account. Try again.");
        setAccountBusy(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Schedule your Finn account and synced journal for permanent deletion in 30 days? You’ll be signed out everywhere. Sign back in during the recovery period to cancel.")) {
        void perform();
      }
      return;
    }
    Alert.alert(
      "Schedule account deletion?",
      "Finn will sign you out everywhere and permanently delete your account and synced journal after 30 days. Sign back in during that recovery period to cancel.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Schedule deletion", style: "destructive", onPress: () => void perform() },
      ],
    );
  };

  return (
    <AppSheet title="Settings" bodyStyle={styles.body}>
      {mutationError && (
        <View accessibilityLiveRegion="polite" style={[styles.group, styles.saveError]}>
          <Text style={styles.saveErrorText}>{mutationError}</Text>
          <Button label="Dismiss settings error" onPress={clearMutationError}>
            <Text style={styles.saveErrorAction}>Dismiss</Text>
          </Button>
        </View>
      )}
      <SectionLabel style={styles.sectionLabel}>Saved entries</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="bookmark"
          color={Finn.amber}
          title="Manage saved entries"
          subtitle={`${presets.length} saved ${presets.length === 1 ? "entry" : "entries"}`}
          href="/settings/presets"
        />
      </View>

      {Platform.OS !== "web" && entries.length > 0 ? (
        <>
          <SectionLabel style={styles.sectionLabel}>Reminders</SectionLabel>
          <View style={styles.group}>
            <SettingsRow
              icon="bell"
              color={Finn.primary}
              title={reminderBusy ? "Updating reminders…" : "Journal reminders"}
              subtitle="Light Finn nudges when a day might slip by"
              value={settings.reminders ? "On" : "Off"}
              disclosure="none"
              onPress={() => { void toggleReminders(); }}
            />
          </View>
        </>
      ) : null}

      <SectionLabel style={styles.sectionLabel}>Finn Premium</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="star"
          color={Finn.primary}
          title={hasPremiumAccess ? "Finn Premium is active" : "Premium access required"}
          subtitle={subscriptionStatus(entitlement)}
          disclosure={hasPremiumAccess ? "chevron" : "none"}
          onPress={hasPremiumAccess ? () => void openSubscriptionManagement() : undefined}
        />
        <Divider />
        <SettingsRow
          icon="refresh"
          color="#5865D8"
          title={subscriptionBusy ? "Checking purchases…" : "Restore purchases"}
          subtitle="Use the App Store account that originally subscribed"
          disclosure="none"
          onPress={() => void restoreSubscription()}
        />
      </View>

      <SectionLabel style={styles.sectionLabel}>Currency</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="globe"
          color="#D529D7"
          title="Base currency"
          value={currencyDisplay(settings.currency)}
          disclosure="down"
          onPress={() => togglePicker("currency")}
        />
        {picker === "currency" && (
          <CurrencyPicker
            selected={settings.currency}
            onSelect={(currency) => {
              applySettings({ currency });
              setPicker(null);
            }}
          />
        )}
      </View>

      <SectionLabel style={styles.sectionLabel}>Privacy & legal</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="analytics"
          color="#5865D8"
          title="Share usage analytics"
          subtitle="Feature use only — never notes, amounts, receipts, or searches"
          value={settings.analyticsEnabled ? "On" : "Off"}
          disclosure="none"
          onPress={() => void toggleAnalytics()}
        />
        <Divider />
        <SettingsRow
          icon="globe"
          color="#5865D8"
          title="Privacy Policy"
          subtitle="finn-it.app"
          onPress={() => void openWebsite(FINN_WEBSITE_URLS.privacyPolicy)}
        />
        <Divider />
        <SettingsRow
          icon="note"
          color="#8A6C55"
          title="Terms of Service"
          subtitle="finn-it.app"
          onPress={() => void openWebsite(FINN_WEBSITE_URLS.termsOfService)}
        />
        <Divider />
        <SettingsRow
          icon="analytics"
          color={Finn.primary}
          title="AI Policy"
          subtitle="How Finn uses AI"
          onPress={() => void openWebsite(FINN_WEBSITE_URLS.aiPolicy)}
        />
        <Divider />
        <SettingsRow
          icon="globe"
          color="#5865D8"
          title="Privacy Choices"
          subtitle="Manage your privacy options"
          onPress={() => void openWebsite(FINN_WEBSITE_URLS.privacyChoices)}
        />
        <Divider />
        <SettingsRow
          icon="note"
          color="#7A7572"
          title="Acknowledgement"
          subtitle="finn-it.app"
          onPress={() => void openWebsite(FINN_WEBSITE_URLS.acknowledgement)}
        />
      </View>

      <SectionLabel style={styles.sectionLabel}>Help & support</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="globe"
          color={Finn.primary}
          title="Support Center"
          subtitle="Help and frequently asked questions"
          onPress={() => void openWebsite(FINN_WEBSITE_URLS.support, setSupportError)}
        />
        <Divider />
        <SettingsRow
          icon="note"
          color={Finn.primary}
          title="Email support"
          subtitle={SUPPORT_EMAIL}
          onPress={() => void contactSupport()}
        />
      </View>
      {supportError ? (
        <Text accessibilityRole="alert" style={styles.accountError}>
          {supportError}
        </Text>
      ) : null}

      <SectionLabel style={styles.sectionLabel}>Account</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="arrow"
          color="#7A7572"
          title={accountBusy === "sign-out" ? "Signing out…" : "Sign out"}
          disclosure="none"
          onPress={signOut}
        />
        <Divider />
        <SettingsRow
          icon="note"
          color="#7A7572"
          title="Account deletion information"
          subtitle="Read how account deletion works"
          onPress={() => void openWebsite(FINN_WEBSITE_URLS.deleteAccount)}
        />
        <Divider />
        <SettingsRow
          icon="trash"
          color={Finn.danger}
          title={accountBusy === "delete" ? "Scheduling deletion…" : "Delete my account"}
          titleColor={Finn.danger}
          subtitle="Deletes your account after a 30-day recovery period"
          disclosure="none"
          onPress={confirmDelete}
        />
      </View>
      {accountError ? <Text accessibilityRole="alert" style={styles.accountError}>{accountError}</Text> : null}

      <AnalyticsOptOutModal
        visible={showAnalyticsOptOut}
        onDismiss={() => setShowAnalyticsOptOut(false)}
        onConfirm={() => void turnOffAnalytics()}
      />
    </AppSheet>
  );
}

function AnalyticsOptOutModal({
  visible,
  onDismiss,
  onConfirm,
}: {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useMotionPreference();

  return (
    <Modal
      animationType={reducedMotion ? "none" : "fade"}
      navigationBarTranslucent
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.analyticsModalBackdrop}>
        <Pressable
          accessibilityLabel="Keep sharing usage analytics"
          accessibilityRole="button"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.analyticsModalCard,
            { marginBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.analyticsModalIcon}>
            <Icon name="analytics" size={22} color="#5865D8" animation={false} />
          </View>
          <Text accessibilityRole="header" style={styles.analyticsModalTitle}>
            Turn off usage analytics?
          </Text>
          <Text style={styles.analyticsModalBody}>
            Finn will keep working normally. We’ll lose anonymous signals that
            help us spot performance problems and understand which features need
            improvement, so fixes and future updates may take longer to prioritize.
          </Text>
          <Text style={styles.analyticsModalPrivacy}>
            Your notes, amounts, receipts, and searches are never included.
          </Text>
          <Button
            label="Keep sharing usage analytics"
            onPress={onDismiss}
            style={styles.analyticsModalPrimaryButton}
          >
            <Text style={styles.analyticsModalPrimaryText}>Keep sharing</Text>
          </Button>
          <Button label="Turn off usage analytics" onPress={onConfirm}>
            <Text style={styles.analyticsModalSecondaryText}>Turn off analytics</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

function SettingsRow({
  icon,
  color,
  title,
  titleColor,
  subtitle,
  value,
  accessory,
  disclosure = "chevron",
  onPress,
  href,
}: {
  icon?: IconName;
  color?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  value?: string;
  accessory?: ReactNode;
  disclosure?: "chevron" | "down" | "none";
  onPress?: () => void;
  href?: Href;
}) {
  const contents = (
    <>
      {icon && (
        <View style={styles.iconSlot}>
          <Icon name={icon} color={color} size={18} />
        </View>
      )}
      <View style={styles.labelBlock}>
        <Text style={[styles.rowTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {accessory ??
        (disclosure !== "none" && (
          <Icon
            name={disclosure === "down" ? "down" : "chevron"}
            color="#B5B0AE"
            size={14}
          />
        ))}
    </>
  );

  if (href) return <ZoomLink href={href}><Button label={title} onPress={onPress} style={styles.row}>{contents}</Button></ZoomLink>;
  return onPress ? (
    <Button label={title} onPress={onPress} style={styles.row}>
      {contents}
    </Button>
  ) : (
    <View style={styles.row}>{contents}</View>
  );
}

function Divider() {
  return <View style={styles.separator} />;
}

function subscriptionStatus(
  entitlement: ReturnType<typeof useSubscription>["entitlement"],
) {
  if (!entitlement) return "Subscribe or restore from the premium screen";
  if (!entitlement.expirationDate) return "Active access";
  const date = new Date(entitlement.expirationDate);
  if (!Number.isFinite(date.getTime())) return "Active access";
  const label = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return entitlement.willRenew ? `Renews ${label}` : `Available until ${label}`;
}

const styles = StyleSheet.create({
  body: { paddingBottom: 6 },
  saveError: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    padding: 12,
  },
  saveErrorText: { color: Finn.danger, flex: 1, fontSize: 12, lineHeight: 17 },
  saveErrorAction: { color: Finn.danger, fontSize: 11, fontWeight: "600" },
  sectionLabel: {
    fontFamily: JournalType.regular,
    fontSize: 13,
    color: "#8D8886",
    marginTop: 25,
    marginBottom: 10,
  },
  group: {
    backgroundColor: Finn.surface,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(77, 55, 43, 0.035)",
    boxShadow: "0px 8px 24px rgba(163, 137, 120, 0.10)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 68,
    paddingHorizontal: 17,
    paddingVertical: 14,
  },
  iconSlot: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  labelBlock: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.15,
    color: Finn.ink,
  },
  rowSubtitle: {
    fontFamily: JournalType.regular,
    fontSize: 11,
    lineHeight: 15,
    color: "#9D9896",
    marginTop: 3,
  },
  rowValue: {
    color: "#AAA5A3",
    fontFamily: JournalType.regular,
    fontSize: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EDE8E5",
    marginLeft: 17,
  },
  accountError: {
    fontFamily: JournalType.regular,
    color: Finn.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  analyticsModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    backgroundColor: "rgba(23, 23, 23, 0.24)",
  },
  analyticsModalCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 12,
    borderRadius: 28,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  analyticsModalIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderRadius: 23,
    backgroundColor: "#EEF0FF",
  },
  analyticsModalTitle: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 23,
    lineHeight: 28,
  },
  analyticsModalBody: {
    marginTop: 9,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  analyticsModalPrivacy: {
    marginTop: 9,
    marginBottom: 20,
    color: Finn.primary,
    fontFamily: JournalType.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  analyticsModalPrimaryButton: {
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: Finn.primary,
  },
  analyticsModalPrimaryText: {
    color: "#FFFFFF",
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  analyticsModalSecondaryText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
});
