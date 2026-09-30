import { ZoomLink } from "@/components/navigation/zoom-link";
import type { Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState, type ReactNode } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSheet, SectionLabel } from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useAppToast } from "@/components/ui/toast-provider";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import {
  useJournalActions,
  useJournalData,
  useJournalStatus,
} from "@/providers/app-providers";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  deleteCurrentAccount,
  type AccountDeletionTiming,
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
import { isRevenueCatTestStore } from "@/features/paywall/services/subscription-service";
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
  sendContactSupportEmail,
  SUPPORT_EMAIL,
} from "@/features/support/services/quota-support";
import { useAiConsent } from "@/features/ai-consent/providers/ai-consent-provider";
import { AiConsentSettingsModal } from "@/features/ai-consent/components/ai-consent-settings-modal";

type Picker = "currency" | null;

export default function SettingsScreen() {
  const { entries, presets, settings } = useJournalData();
  const { updateSettings, clearMutationError } = useJournalActions();
  const { mutationError } = useJournalStatus();
  const { setOnboardingComplete } = useSession();
  const { showToast } = useAppToast();
  const aiConsent = useAiConsent();
  const {
    entitlement,
    isActive: hasPremiumAccess,
    isBusy: subscriptionBusy,
    manage: manageSubscription,
    refresh: refreshSubscription,
    restore: restoreSubscription,
  } = useSubscription();
  const [picker, setPicker] = useState<Picker>(null);
  const [accountBusy, setAccountBusy] = useState<"sign-out" | "delete" | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportBusy, setSupportBusy] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [showAnalyticsOptOut, setShowAnalyticsOptOut] = useState(false);
  const [showAccountDeletion, setShowAccountDeletion] = useState(false);
  const [deletionTiming, setDeletionTiming] = useState<AccountDeletionTiming>("scheduled");
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);
  const [showAiConsent, setShowAiConsent] = useState(false);
  const [aiConsentError, setAiConsentError] = useState<string | null>(null);

  const togglePicker = (next: Exclude<Picker, null>) => {
    setPicker((current) => (current === next ? null : next));
  };
  const updateAiConsent = async () => {
    setAiConsentError(null);
    try {
      if (aiConsent.status === "granted") await aiConsent.withdraw();
      else await aiConsent.grant();
      setShowAiConsent(false);
    } catch {
      setAiConsentError("Couldn’t update AI data sharing. Please try again.");
    }
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
        showToast({
          id: "journal-reminders-permission-off",
          message: "Notifications are off.",
          highlighted: "Allow them in phone settings for journal nudges.",
          state: "warning",
          action: {
            label: "Open settings",
            onPress: () => { void Linking.openSettings(); },
          },
        });
        return;
      }
      await applySettings({ reminders: true });
      await scheduleJournalReminders(
        settings.reminderTime,
        entries.some((entry) => entry.date === localDayKey()),
      );
    } catch {
      showToast({
        id: "journal-reminders-update-error",
        message: "Couldn’t update reminders.",
        highlighted: "Please try again.",
        state: "error",
      });
    } finally {
      setReminderBusy(false);
    }
  };

  const openSubscriptionManagement = async () => {
    if (isRevenueCatTestStore()) {
      showToast({
        id: "subscription-management-test-store",
        message: "Subscription management is unavailable in the Test Store.",
        highlighted: "Use a Google Play or App Store sandbox to test this link.",
        state: "info",
      });
      return;
    }
    try {
      await manageSubscription();
    } catch (error) {
      showToast({
        id: "subscription-management-error",
        message: "Couldn’t open your subscription settings.",
        highlighted: error instanceof Error ? error.message : "Please try again.",
        state: "error",
      });
    }
  };

  const restorePurchases = async () => {
    const restored = await restoreSubscription();
    showToast(
      restored
        ? {
            id: "restore-purchases-success",
            message: "Purchases restored.",
            highlighted: "Finnit Premium is active.",
            state: "info",
          }
        : {
            id: "restore-purchases-error",
            message: "Couldn’t restore an active purchase.",
            highlighted: "Check the store account, then try again.",
            state: "error",
          },
    );
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
    if (supportBusy) return;
    setSupportError(null);
    setSupportBusy(true);
    try {
      await sendContactSupportEmail();
      showToast({
        id: "support-email-sent",
        message: "Support has been contacted.",
        highlighted: "We’ll reply to your account email.",
        state: "info",
      });
    } catch {
      setSupportError(`Couldn’t contact support. Try again or email ${SUPPORT_EMAIL}.`);
    } finally {
      setSupportBusy(false);
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

  const openAccountDeletion = () => {
    if (accountBusy) return;
    setAccountError(null);
    setDeletionTiming("scheduled");
    setBillingAcknowledged(false);
    setShowAccountDeletion(true);
  };

  const performDelete = async () => {
    if (accountBusy) return;
    setAccountBusy("delete");
    setAccountError(null);
    try {
      await deleteCurrentAccount(deletionTiming);
      await clearOnboardingSnapshot();
      setShowAccountDeletion(false);
      setOnboardingComplete(false);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Couldn’t delete your account. Try again.");
      setAccountBusy(null);
    }
  };

  const cancelSubscriptionBeforeDeletion = async () => {
    setAccountError(null);
    if (isRevenueCatTestStore()) {
      showToast({
        id: "deletion-subscription-management-test-store",
        message: "Subscription management is unavailable in the Test Store.",
        highlighted: "Use an App Store sandbox to test cancellation.",
        state: "info",
      });
      return;
    }
    try {
      await manageSubscription();
      await refreshSubscription();
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "Couldn’t open your subscription settings. Try again.",
      );
    }
  };

  return (
    <AppSheet title="Settings" bodyStyle={styles.body}>
      {hasPremiumAccess && mutationError && (
        <View accessibilityLiveRegion="polite" style={[styles.group, styles.saveError]}>
          <Text style={styles.saveErrorText}>{mutationError}</Text>
          <Button label="Dismiss settings error" onPress={clearMutationError}>
            <Text style={styles.saveErrorAction}>Dismiss</Text>
          </Button>
        </View>
      )}
      {hasPremiumAccess ? (
        <>
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
                  subtitle="Light Finnit nudges when a day might slip by"
                  value={settings.reminders ? "On" : "Off"}
                  disclosure="none"
                  onPress={() => { void toggleReminders(); }}
                />
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <SectionLabel style={styles.sectionLabel}>
        {hasPremiumAccess ? "Finnit Premium" : "Purchases"}
      </SectionLabel>
      <View style={styles.group}>
        {hasPremiumAccess ? (
          <>
            <SettingsRow
              icon="star"
              color={Finn.primary}
              title="Finnit Premium is active"
              subtitle={subscriptionStatus(entitlement)}
              onPress={() => void openSubscriptionManagement()}
            />
            <Divider />
          </>
        ) : null}
        <SettingsRow
          icon="refresh"
          color="#5865D8"
          title={subscriptionBusy ? "Checking purchases…" : "Restore purchases"}
          subtitle="Use the App Store account that originally subscribed"
          disclosure="none"
          onPress={() => void restorePurchases()}
        />
      </View>

      {hasPremiumAccess ? (
        <>
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
                autoFocus={false}
                selected={settings.currency}
                onSelect={(currency) => {
                  applySettings({ currency });
                  setPicker(null);
                }}
              />
            )}
          </View>
        </>
      ) : null}

      <SectionLabel style={styles.sectionLabel}>Privacy & legal</SectionLabel>
      <View style={styles.group}>
        {hasPremiumAccess ? (
          <>
            <SettingsRow
              icon="sparkle"
              color={Finn.primary}
              title="AI features & data sharing"
              subtitle={aiConsent.status === "granted"
                ? "Google Gemini sharing is allowed"
                : "Manual journal is available; Gemini features are off"}
              value={aiConsent.status === "granted" ? "On" : "Off"}
              onPress={() => {
                setAiConsentError(null);
                setShowAiConsent(true);
              }}
            />
            <Divider />
            <SettingsRow
              icon="analytics"
              color="#5865D8"
              title="Share usage analytics"
              subtitle="On by default — never notes, amounts, receipts, or searches"
              value={settings.analyticsEnabled ? "On" : "Off"}
              disclosure="none"
              onPress={() => void toggleAnalytics()}
            />
            <Divider />
          </>
        ) : null}
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
          subtitle="How Finnit uses AI"
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
          title={supportBusy ? "Contacting support…" : "Email support"}
          subtitle={SUPPORT_EMAIL}
          onPress={supportBusy ? undefined : () => void contactSupport()}
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
          title={accountBusy === "delete" ? "Deleting account…" : "Delete my account"}
          titleColor={Finn.danger}
          subtitle="Choose immediate deletion or a 30-day recovery period"
          disclosure="none"
          onPress={openAccountDeletion}
        />
      </View>
      {accountError ? <Text accessibilityRole="alert" style={styles.accountError}>{accountError}</Text> : null}

      {hasPremiumAccess ? (
        <>
          <AnalyticsOptOutModal
            visible={showAnalyticsOptOut}
            onDismiss={() => setShowAnalyticsOptOut(false)}
            onConfirm={() => void turnOffAnalytics()}
          />
          <AiConsentSettingsModal
            busy={aiConsent.saving}
            enabled={aiConsent.status === "granted"}
            error={aiConsentError}
            onConfirm={() => { void updateAiConsent(); }}
            onDismiss={() => setShowAiConsent(false)}
            visible={showAiConsent}
          />
        </>
      ) : null}
      <AccountDeletionModal
        activeSubscription={Boolean(entitlement?.isActive && entitlement.willRenew)}
        billingAcknowledged={billingAcknowledged}
        busy={accountBusy === "delete"}
        error={accountError}
        managingSubscription={subscriptionBusy}
        onBillingAcknowledged={setBillingAcknowledged}
        onConfirm={() => void performDelete()}
        onDismiss={() => {
          if (accountBusy !== "delete") setShowAccountDeletion(false);
        }}
        onManageSubscription={() => void cancelSubscriptionBeforeDeletion()}
        onTimingChange={setDeletionTiming}
        timing={deletionTiming}
        visible={showAccountDeletion}
      />
    </AppSheet>
  );
}

function AccountDeletionModal({
  activeSubscription,
  billingAcknowledged,
  busy,
  error,
  managingSubscription,
  onBillingAcknowledged,
  onConfirm,
  onDismiss,
  onManageSubscription,
  onTimingChange,
  timing,
  visible,
}: {
  activeSubscription: boolean;
  billingAcknowledged: boolean;
  busy: boolean;
  error: string | null;
  managingSubscription: boolean;
  onBillingAcknowledged: (acknowledged: boolean) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onManageSubscription: () => void;
  onTimingChange: (timing: AccountDeletionTiming) => void;
  timing: AccountDeletionTiming;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useMotionPreference();
  const storeName = Platform.OS === "ios" ? "Apple" : "your app store";
  const confirmationDisabled = busy || (activeSubscription && !billingAcknowledged);

  return (
    <Modal
      animationType={reducedMotion ? "none" : "fade"}
      navigationBarTranslucent
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.deletionModalBackdrop}>
        <Pressable
          accessibilityLabel="Keep account"
          accessibilityRole="button"
          disabled={busy}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          accessibilityViewIsModal
          bounces={false}
          contentContainerStyle={styles.deletionModalContent}
          showsVerticalScrollIndicator={false}
          style={[
            styles.deletionModalCard,
            { marginBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.deletionModalIcon}>
            <Icon name="trash" size={22} color={Finn.destructive} animation={false} />
          </View>
          <Text accessibilityRole="header" style={styles.deletionModalTitle}>
            When should we delete your account?
          </Text>
          <Text style={styles.deletionModalBody}>
            Your account and synced journal will be permanently deleted. You’ll be
            signed out on every device.
          </Text>

          <DeletionTimingOption
            description="Keeps a recovery window so an accidental deletion can be undone. Sign in during the 30 days to cancel."
            label="30 days"
            recommended
            selected={timing === "scheduled"}
            onPress={() => onTimingChange("scheduled")}
          />
          <DeletionTimingOption
            description="Deletes your account now. Your journal cannot be recovered afterward."
            label="Immediate deletion"
            selected={timing === "immediate"}
            onPress={() => onTimingChange("immediate")}
          />

          {activeSubscription ? (
            <View style={styles.subscriptionDeletionWarning}>
              <Text style={styles.subscriptionDeletionTitle}>
                Cancel your subscription before continuing
              </Text>
              <Text style={styles.subscriptionDeletionBody}>
                Deleting your Finnit account does not cancel billing. {storeName} will
                keep renewing your subscription until you cancel it.
              </Text>
              <Button
                disabled={busy || managingSubscription}
                label={`Manage ${storeName} subscription`}
                onPress={onManageSubscription}
                style={styles.subscriptionManagementButton}
              >
                <Text style={styles.subscriptionManagementText}>
                  {managingSubscription ? "Opening…" : `Manage ${storeName} subscription`}
                </Text>
              </Button>
              <Button
                accessibilityRole="checkbox"
                accessibilityState={{ checked: billingAcknowledged }}
                disabled={busy}
                label="I understand store billing continues until I cancel"
                onPress={() => onBillingAcknowledged(!billingAcknowledged)}
                style={styles.billingAcknowledgement}
              >
                <View style={[
                  styles.checkbox,
                  billingAcknowledged && styles.checkboxSelected,
                ]}>
                  {billingAcknowledged ? (
                    <Icon name="check" color={Finn.surface} size={12} animation={false} />
                  ) : null}
                </View>
                <Text style={styles.billingAcknowledgementText}>
                  I understand billing continues until I cancel it.
                </Text>
              </Button>
            </View>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" style={styles.deletionModalError}>
              {error}
            </Text>
          ) : null}

          <Button
            disabled={confirmationDisabled}
            label={timing === "immediate" ? "Delete account now" : "Schedule account deletion"}
            onPress={onConfirm}
            style={styles.deletionConfirmButton}
          >
            <Text style={styles.deletionConfirmText}>
              {busy
                ? timing === "immediate" ? "Deleting…" : "Scheduling…"
                : timing === "immediate" ? "Delete account now" : "Delete in 30 days"}
            </Text>
          </Button>
          <Button disabled={busy} label="Keep account" onPress={onDismiss}>
            <Text style={styles.deletionCancelText}>Keep my account</Text>
          </Button>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DeletionTimingOption({
  description,
  label,
  onPress,
  recommended = false,
  selected,
}: {
  description: string;
  label: string;
  onPress: () => void;
  recommended?: boolean;
  selected: boolean;
}) {
  return (
    <Button
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      label={label}
      onPress={onPress}
      style={[styles.deletionOption, selected && styles.deletionOptionSelected]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <View style={styles.deletionOptionCopy}>
        <View style={styles.deletionOptionTitleRow}>
          <Text style={styles.deletionOptionTitle}>{label}</Text>
          {recommended ? (
            <Text style={styles.recommendedBadge}>Recommended</Text>
          ) : null}
        </View>
        <Text style={styles.deletionOptionDescription}>{description}</Text>
      </View>
    </Button>
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
            Finnit will keep working normally. We’ll lose anonymous signals that
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
  deletionModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    backgroundColor: "rgba(23, 23, 23, 0.24)",
  },
  deletionModalCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 440,
    maxHeight: "92%",
    borderRadius: 28,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  deletionModalContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 10,
  },
  deletionModalIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderRadius: 22,
    backgroundColor: "#FFF0EF",
  },
  deletionModalTitle: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 22,
    lineHeight: 27,
  },
  deletionModalBody: {
    marginTop: 7,
    marginBottom: 16,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  deletionOption: {
    minHeight: 0,
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginBottom: 9,
    padding: 13,
    borderWidth: 1,
    borderColor: "#E8E2DE",
    borderRadius: 17,
    backgroundColor: "#FFFEFD",
  },
  deletionOptionSelected: {
    borderColor: Finn.primary,
    backgroundColor: Finn.primarySoft,
  },
  radioOuter: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    borderWidth: 1.5,
    borderColor: "#B7B0AC",
    borderRadius: 10,
  },
  radioOuterSelected: { borderColor: Finn.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Finn.primary,
  },
  deletionOptionCopy: { flex: 1 },
  deletionOptionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  deletionOptionTitle: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 15,
    lineHeight: 19,
  },
  recommendedBadge: {
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    color: Finn.primary,
    backgroundColor: "#FFFFFF",
    fontFamily: JournalType.medium,
    fontSize: 10,
    lineHeight: 14,
  },
  deletionOptionDescription: {
    marginTop: 4,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  subscriptionDeletionWarning: {
    marginTop: 3,
    marginBottom: 10,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FFF8EA",
  },
  subscriptionDeletionTitle: {
    color: "#6E4C14",
    fontFamily: JournalType.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  subscriptionDeletionBody: {
    marginTop: 4,
    color: "#80632E",
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  subscriptionManagementButton: {
    minHeight: 40,
    marginTop: 9,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  subscriptionManagementText: {
    color: Finn.primary,
    fontFamily: JournalType.bold,
    fontSize: 13,
  },
  billingAcknowledgement: {
    minHeight: 0,
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#B5965C",
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  checkboxSelected: {
    borderColor: Finn.primary,
    backgroundColor: Finn.primary,
  },
  billingAcknowledgementText: {
    flex: 1,
    color: "#6E4C14",
    fontFamily: JournalType.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  deletionModalError: {
    marginBottom: 9,
    color: Finn.danger,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  deletionConfirmButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: Finn.destructive,
  },
  deletionConfirmText: {
    color: Finn.surface,
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  deletionCancelText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
});
