import { ZoomLink } from "@/components/navigation/zoom-link";
import type { Href } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AppSheet, SectionLabel } from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
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

type Picker = "currency" | null;

export default function SettingsScreen() {
  const {
    presets,
    settings,
    updateSettings,
    mutationError,
    clearMutationError,
  } = useJournal();
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

  const togglePicker = (next: Exclude<Picker, null>) => {
    setPicker((current) => (current === next ? null : next));
  };
  const applySettings = (patch: Parameters<typeof updateSettings>[0]) =>
    updateSettings(patch);

  const toggleAnalytics = async () => {
    const enabled = !settings.analyticsEnabled;
    if (enabled) await analyticsClient.optIn();
    await applySettings({ analyticsEnabled: enabled });
    if (enabled) {
      captureAnalytics(ANALYTICS_EVENTS.analyticsPreferenceChanged, { enabled });
    } else {
      await analyticsClient.optOut();
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
          onPress={() => router.push("/legal/privacy")}
        />
        <Divider />
        <SettingsRow
          icon="note"
          color="#8A6C55"
          title="Terms of Service"
          onPress={() => router.push("/legal/terms")}
        />
      </View>

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

    </AppSheet>
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
});
