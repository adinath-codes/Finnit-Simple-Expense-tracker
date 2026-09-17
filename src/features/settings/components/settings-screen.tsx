import { useState, type ReactNode } from "react";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import {
  AppSheet,
  SectionLabel,
  sheetStyles as shared,
} from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
export default function SettingsScreen() {
  const { settings, updateSettings } = useJournal();
  const [picker, setPicker] = useState<"frequency" | "time" | null>(null);
  const [showCurrency, setShowCurrency] = useState(false);
  return (
    <AppSheet title="Settings">
      <SectionLabel>Saved entries</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="bookmark"
          color={Finn.amber}
          title="Manage saved entries"
          subtitle="Your everyday shortcuts"
          onPress={() => router.push("/settings/presets")}
        />
      </View>
      <SectionLabel>Daily mindfulness</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="location"
          color={Finn.green}
          title="Use location for places"
          subtitle={
            settings.location ? "Bengaluru, India · preview" : "Location is off"
          }
          accessory={
            <Switch
              accessibilityLabel="Use location for places"
              value={settings.location}
              onValueChange={(location) => updateSettings({ location })}
              trackColor={{ false: "#E6E2DF", true: "#41CF7D" }}
              thumbColor="#fff"
              {...(Platform.OS === "web"
                ? { activeThumbColor: "#fff", style: { width: 43, height: 26 } }
                : {})}
            />
          }
        />
      </View>
      <SectionLabel>Reminders</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="bell"
          color={Finn.blue}
          title="Daily tracking reminders"
          accessory={
            <Switch
              accessibilityLabel="Daily tracking reminders"
              value={settings.reminders}
              onValueChange={(reminders) => updateSettings({ reminders })}
              trackColor={{ false: "#E6E2DF", true: "#41CF7D" }}
              thumbColor="#fff"
              {...(Platform.OS === "web"
                ? { activeThumbColor: "#fff", style: { width: 43, height: 26 } }
                : {})}
            />
          }
        />
        {settings.reminders && (
          <>
            <View style={styles.separator} />
            <SettingsRow
              title="Frequency"
              value={settings.reminderFrequency}
              onPress={() =>
                setPicker(picker === "frequency" ? null : "frequency")
              }
            />
            {picker === "frequency" && (
              <Options
                values={["Every evening", "Twice a day", "Weekdays only"]}
                selected={settings.reminderFrequency}
                onSelect={(reminderFrequency) => {
                  updateSettings({ reminderFrequency });
                  setPicker(null);
                }}
              />
            )}
            <View style={styles.separator} />
            <SettingsRow
              title="Time"
              value={settings.reminderTime}
              onPress={() => setPicker(picker === "time" ? null : "time")}
            />
            {picker === "time" && (
              <Options
                values={["7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM"]}
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
      {settings.reminders && (
        <View style={styles.notification}>
          <View style={styles.notificationAvatar}>
            <Icon name="sparkle" size={20} color={Finn.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={shared.row}>
              <Text style={styles.notificationTitle}>A little reminder</Text>
              <Text style={styles.notificationTime}>
                {settings.reminderTime}
              </Text>
            </View>
            <Text style={styles.notificationBody}>
              Anything you’d like to remember from today?
            </Text>
          </View>
        </View>
      )}
      <SectionLabel>General</SectionLabel>
      <View style={styles.group}>
        <SettingsRow
          icon="globe"
          color={Finn.purple}
          title="Currency"
          value="INR ₹"
          onPress={() => setShowCurrency(!showCurrency)}
        />
        {showCurrency && (
          <Text style={styles.currencyNote}>
            This preview uses Indian rupees. Currency conversion will be
            connected with your account.
          </Text>
        )}
      </View>
      <Text style={styles.preview}>
        {"UI preview · sample data\n"}Preferences are for this session. No
        notifications are scheduled.
      </Text>
      <View style={styles.brand}>
        <Text style={styles.brandName}>finn</Text>
        <Text style={styles.brandCaption}>a place for the everyday.</Text>
      </View>
    </AppSheet>
  );
}
function SettingsRow({
  icon,
  color,
  title,
  subtitle,
  value,
  accessory,
  onPress,
}: {
  icon?: IconName;
  color?: string;
  title: string;
  subtitle?: string;
  value?: string;
  accessory?: ReactNode;
  onPress?: () => void;
}) {
  const contents = (
    <>
      {icon && <Icon name={icon} color={color} size={17} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {accessory ?? <Icon name="chevron" color={Finn.muted} size={12} />}
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
function Options({
  values,
  selected,
  onSelect,
}: {
  values: string[];
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
            style={{
              color: selected === value ? Finn.purple : Finn.secondary,
              fontSize: 13,
            }}
          >
            {value}
          </Text>
          {selected === value && (
            <Icon name="check" color={Finn.purple} size={14} />
          )}
        </Button>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  group: {
    backgroundColor: Finn.surface,
    borderRadius: 18,
    overflow: "hidden",
    ...Finn.shadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTitle: { fontSize: 13, color: Finn.ink },
  rowSubtitle: { fontSize: 10, color: Finn.secondary, marginTop: 5 },
  rowValue: { color: Finn.secondary, fontSize: 11 },
  separator: { height: 1, backgroundColor: "#F5F0EC", marginLeft: 16 },
  options: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    backgroundColor: "#FDFBFA",
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
  },
  notification: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 14,
    marginTop: 16,
    backgroundColor: "#F2EDF5",
    borderRadius: 17,
  },
  notificationAvatar: {
    width: 34,
    height: 34,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Finn.ink,
    flex: 1,
  },
  notificationTime: { fontSize: 9, color: Finn.muted },
  notificationBody: {
    color: Finn.secondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
  },
  preview: {
    textAlign: "center",
    color: Finn.muted,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 22,
  },
  brand: { alignItems: "center", marginTop: 30, marginBottom: 5 },
  brandName: {
    fontSize: 26,
    color: "#B9AAA2",
    fontWeight: "600",
    letterSpacing: -1.4,
  },
  brandCaption: { fontSize: 10, color: Finn.muted, marginTop: 4 },
  currencyNote: {
    color: Finn.secondary,
    fontSize: 12,
    lineHeight: 20,
    padding: 16,
    paddingTop: 0,
  },
});
