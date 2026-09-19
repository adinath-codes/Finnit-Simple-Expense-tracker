import { useState, type ReactNode } from "react";
import { Alert, Platform, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { AppSheet, SectionLabel } from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  deleteCurrentAccount,
  signOutCurrentDevice,
} from "@/features/auth/services/auth-service";
import {
  clearOnboardingSnapshot,
} from "@/storage/onboarding-repository";

const CURRENCIES = [
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
] as const;

const FREQUENCIES = ["Every evening", "Twice a day", "Weekdays only"];
const TIMES = ["7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM"];

type Picker = "frequency" | "time" | "currency" | null;

export default function SettingsScreen() {
  const { presets, settings, updateSettings } = useJournal();
  const { session, setOnboardingComplete } = useSession();
  const [picker, setPicker] = useState<Picker>(null);
  const [accountBusy, setAccountBusy] = useState<"sign-out" | "delete" | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const selectedCurrency =
    CURRENCIES.find(({ code }) => code === settings.currency) ?? CURRENCIES[0];

  const togglePicker = (next: Exclude<Picker, null>) => {
    setPicker((current) => (current === next ? null : next));
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
        await deleteCurrentAccount();
        await clearOnboardingSnapshot();
        setOnboardingComplete(false);
      } catch (error) {
        setAccountError(error instanceof Error ? error.message : "Couldn’t delete your account. Try again.");
        setAccountBusy(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Permanently delete your Finn account and synced journal? This cannot be undone.")) {
        void perform();
      }
      return;
    }
    Alert.alert(
      "Delete your account?",
      "Your synced journal and account will be permanently deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void perform() },
      ],
    );
  };

  return (
    <AppSheet title="Settings" bodyStyle={styles.body}>
      <SectionLabel style={styles.sectionLabel}>Saved entries</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="bookmark"
          color={Finn.amber}
          title="Manage saved entries"
          subtitle={`${presets.length} saved ${presets.length === 1 ? "entry" : "entries"}`}
          onPress={() => router.push("/settings/presets")}
        />
      </View>

      <SectionLabel style={styles.sectionLabel}>Journal context</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="location"
          color="#05C65A"
          title="Use location for journal entries"
          subtitle={
            settings.location
              ? "Bengaluru, India · sample"
              : "Journal works normally without it"
          }
          accessory={
            <FinnSwitch
              label="Use location for journal entries"
              value={settings.location}
              onValueChange={(location) => updateSettings({ location })}
            />
          }
        />
      </View>
      <Text style={styles.helperText}>
        Adds approximate place context only when you save an entry. Finn never
        tracks you continuously.
      </Text>

      {Platform.OS === "ios" && (
        <>
          <SectionLabel style={styles.sectionLabel}>Quick capture</SectionLabel>
          <View style={styles.group}>
            <SettingsRow
              icon="sparkle"
              color={Finn.primary}
              title="Back Tap quick add"
              subtitle="Open a focused expense note from an iPhone Back Tap"
              accessory={
                <FinnSwitch
                  label="Back Tap quick add"
                  value={settings.backTapQuickAdd}
                  onValueChange={(backTapQuickAdd) =>
                    updateSettings({ backTapQuickAdd })
                  }
                />
              }
            />
            {settings.backTapQuickAdd && (
              <>
                <Divider />
                <View style={styles.setup}>
                  <Text style={styles.setupTitle}>One-time iPhone setup</Text>
                  <Text style={styles.setupStep}>
                    1. In Shortcuts, create a shortcut that opens
                    {" "}<Text style={styles.setupLink}>finn://quick-add</Text>.
                  </Text>
                  <Text style={styles.setupStep}>
                    2. In Settings, choose Accessibility → Touch → Back Tap.
                  </Text>
                  <Text style={styles.setupStep}>
                    3. Pick Double Tap or Triple Tap, then select that shortcut.
                  </Text>
                </View>
              </>
            )}
          </View>
          <Text style={styles.helperText}>
            Apple controls the Back Tap assignment. Turning this off makes the
            Finn shortcut return to the journal instead of opening quick add.
          </Text>
        </>
      )}

      <SectionLabel style={styles.sectionLabel}>Gentle reminders</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="bell"
          color="#48AEEB"
          title="Daily journal reminder"
          accessory={
            <FinnSwitch
              label="Daily journal reminder"
              value={settings.reminders}
              onValueChange={(reminders) => {
                updateSettings({ reminders });
                if (!reminders) setPicker(null);
              }}
            />
          }
        />
        {settings.reminders && (
          <>
            <Divider />
            <SettingsRow
              title="Frequency"
              value={settings.reminderFrequency}
              disclosure="down"
              onPress={() => togglePicker("frequency")}
            />
            {picker === "frequency" && (
              <Options
                values={FREQUENCIES}
                selected={settings.reminderFrequency}
                onSelect={(reminderFrequency) => {
                  updateSettings({ reminderFrequency });
                  setPicker(null);
                }}
              />
            )}
            <Divider />
            <SettingsRow
              title="Time"
              value={settings.reminderTime}
              disclosure="down"
              onPress={() => togglePicker("time")}
            />
            {picker === "time" && (
              <Options
                values={TIMES}
                selected={settings.reminderTime}
                onSelect={(reminderTime) => {
                  updateSettings({ reminderTime });
                  setPicker(null);
                }}
              />
            )}
          </>
        )}
      </View>

      <SectionLabel style={styles.sectionLabel}>Journal settings</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="globe"
          color="#D529D7"
          title="Base currency"
          value={`${selectedCurrency.code} ${selectedCurrency.symbol}`}
          disclosure="down"
          onPress={() => togglePicker("currency")}
        />
        {picker === "currency" && (
          <CurrencyOptions
            selected={settings.currency}
            onSelect={(currency) => {
              updateSettings({ currency });
              setPicker(null);
            }}
          />
        )}
        <Divider />
        <SettingsRow
          icon="check"
          color={Finn.primary}
          title="Offline capture"
          subtitle="Entries save on this device first"
          value="Ready"
          disclosure="none"
        />
      </View>

      <Text style={styles.preview}>
        Preferences are saved on this device. Reminder scheduling and location
        collection are not connected yet.
      </Text>

      <SectionLabel style={styles.sectionLabel}>Privacy & legal</SectionLabel>
      <View style={styles.group}>
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
          icon="wallet"
          color={Finn.primary}
          title={session?.user.email ?? "Finn account"}
          subtitle="Your journal is protected by this account"
          disclosure="none"
        />
        <Divider />
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
          title={accountBusy === "delete" ? "Deleting account…" : "Delete my account"}
          titleColor={Finn.danger}
          subtitle="Permanently removes your account and synced journal"
          disclosure="none"
          onPress={confirmDelete}
        />
      </View>
      {accountError ? <Text accessibilityRole="alert" style={styles.accountError}>{accountError}</Text> : null}

      <View style={styles.brand}>
        <Text style={styles.brandName}>finn</Text>
        <Text style={styles.brandCaption}>notes for your money.</Text>
      </View>
    </AppSheet>
  );
}

function FinnSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#DEDAD7", true: "#05C65A" }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#DEDAD7"
      {...(Platform.OS === "web"
        ? { activeThumbColor: "#FFFFFF", style: styles.webSwitch }
        : {})}
    />
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

function Options({
  values,
  selected,
  onSelect,
}: {
  values: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.options}>
      {values.map((value) => (
        <Button
          key={value}
          label={value}
          onPress={() => onSelect(value)}
          style={styles.option}
        >
          <Text
            style={[
              styles.optionLabel,
              selected === value && styles.optionLabelSelected,
            ]}
          >
            {value}
          </Text>
          {selected === value && (
            <Icon name="check" color={Finn.primary} size={15} />
          )}
        </Button>
      ))}
    </View>
  );
}

function CurrencyOptions({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (currency: string) => void;
}) {
  return (
    <View style={styles.options}>
      {CURRENCIES.map(({ code, label, symbol }) => (
        <Button
          key={code}
          label={`${label}, ${code}`}
          onPress={() => onSelect(code)}
          style={styles.option}
        >
          <View>
            <Text
              style={[
                styles.optionLabel,
                selected === code && styles.optionLabelSelected,
              ]}
            >
              {label}
            </Text>
            <Text style={styles.optionDetail}>{`${code} ${symbol}`}</Text>
          </View>
          {selected === code && (
            <Icon name="check" color={Finn.primary} size={15} />
          )}
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 6 },
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
  helperText: {
    color: "#9E9997",
    fontFamily: JournalType.regular,
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 5,
    marginTop: 8,
  },
  accountError: {
    fontFamily: JournalType.regular,
    color: Finn.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  setup: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 17,
    backgroundColor: "#FEFCFB",
  },
  setupTitle: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 12,
    marginBottom: 8,
  },
  setupStep: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  setupLink: {
    color: Finn.primary,
    fontFamily: JournalType.medium,
  },
  options: {
    paddingHorizontal: 18,
    paddingBottom: 9,
    backgroundColor: "#FEFCFB",
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 45,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EFEAE7",
  },
  optionLabel: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
  },
  optionLabelSelected: {
    color: Finn.primary,
    fontFamily: JournalType.medium,
  },
  optionDetail: {
    color: Finn.muted,
    fontFamily: JournalType.regular,
    fontSize: 10,
    marginTop: 2,
  },
  webSwitch: { width: 43, height: 26 },
  preview: {
    textAlign: "center",
    color: Finn.muted,
    fontFamily: JournalType.regular,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 22,
    paddingHorizontal: 18,
  },
  brand: { alignItems: "center", marginTop: 27, marginBottom: 5 },
  brandName: {
    fontFamily: JournalType.medium,
    fontSize: 26,
    color: "#B9AAA2",
    letterSpacing: -1.4,
  },
  brandCaption: {
    fontFamily: JournalType.regular,
    fontSize: 10,
    color: Finn.muted,
    marginTop: 3,
  },
});
