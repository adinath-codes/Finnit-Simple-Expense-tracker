import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { Motion } from "@/constants/motion";
import { ContentFade, Reveal, MotionLayout } from "@/components/ui/motion";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppSheet, sheetStyles as shared } from "@/components/sheets/app-sheet";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Finn, Categories } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import { money } from "@/utils/currency";
import type { Category, Preset } from "@/types/domain";
export default function PresetList() {
  const {
    presets,
    savePreset,
    deletePreset,
    capturePreset,
    selectedDate,
    mutationError,
    clearMutationError,
  } = useJournal();
  const [search, setSearch] = useState("");
  const reduced = useMotionPreference();
  const [animateList, setAnimateList] = useState(false);
  const [success, setSuccess] = useState({ trigger: 0, message: "" });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Preset | null>(null);
  const [amount, setAmount] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const beginEdit = (preset?: Preset) => {
    setAnimateList(true);
    setForm(
      preset ?? {
        id: `preset-${Date.now()}`,
        name: "",
        note: "",
        amountMinor: 0,
        category: "food",
      },
    );
    setAmount(preset ? String(preset.amountMinor / 100) : "");
  };
  const add = async (preset: Preset) => {
    try { await capturePreset(preset, selectedDate); } catch { return; }
    setAdded(preset.id);
    setSuccess((current) => ({ trigger: current.trigger + 1, message: "Added to your journal" }));
  };
  const filtered = presets.filter((preset) =>
    `${preset.name} ${preset.note}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <AppSheet
      title="Saved entries"
      right={
        <View style={shared.row}>
          <Button
            label={
              editing ? "Finish editing saved entries" : "Edit saved entries"
            }
            onPress={() => {
              setAnimateList(true);
              setEditing(!editing);
              setForm(null);
            }}
            style={{ width: 32 }}
          >
            <Icon name={editing ? "check" : "edit"} size={17} />
          </Button>
          <Button
            label="Create saved entry"
            onPress={() => beginEdit()}
            style={{ width: 28 }}
          >
            <Icon name="plus" size={20} />
          </Button>
        </View>
      }
    >
      <View style={styles.search}>
        <Icon name="search" size={16} color={Finn.muted} />
        <TextInput
          accessibilityLabel="Search saved entries"
          placeholder="Search saved entries"
          placeholderTextColor={Finn.muted}
          value={search}
          onFocus={() => setAnimateList(false)}
          onChangeText={(value) => { setAnimateList(false); setSearch(value); }}
          style={styles.searchInput}
        />
        {search ? (
          <Button label="Clear search" onPress={() => { setAnimateList(false); setSearch(""); }}>
            <Icon name="close" size={14} color={Finn.muted} />
          </Button>
        ) : null}
      </View>
      <Text style={styles.intro}>The everyday things. Already remembered.</Text>
      {mutationError && (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <Text style={styles.errorText}>{mutationError}</Text>
          <Button label="Dismiss saved-entry error" onPress={clearMutationError}>
            <Text style={styles.errorAction}>Dismiss</Text>
          </Button>
        </View>
      )}
      <Reveal open={!!form} style={[shared.card, { marginBottom: 18, gap: 12 }]}>{form && <>
          <Text style={styles.formTitle}>
            {presets.some((item) => item.id === form.id)
              ? "Edit saved entry"
              : "A new everyday thing"}
          </Text>
          <TextInput
            accessibilityLabel="Saved entry name"
            placeholder="Name, e.g. Morning coffee"
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name, note: name })}
            style={shared.input}
            autoFocus
          />
          <TextInput
            accessibilityLabel="Saved entry amount"
            placeholder="Amount in ₹"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            style={shared.input}
          />
          <View style={styles.categories}>
            {(Object.keys(Categories) as Category[]).map((category) => (
              <Button
                key={category}
                label={`Choose ${Categories[category].label}`}
                onPress={() => setForm({ ...form, category })}
                style={[
                  styles.category,
                  form.category === category && {
                    backgroundColor: Finn.primarySoft,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color:
                      form.category === category ? Finn.primary : Finn.secondary,
                  }}
                >
                  {Categories[category].label}
                </Text>
              </Button>
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 22,
            }}
          >
            <Button label="Cancel saved entry" onPress={() => setForm(null)}>
              <Text style={shared.subtle}>Cancel</Text>
            </Button>
            <Button
              label="Save shortcut"
              disabled={
                !form.name.trim() ||
                !/^\d+(\.\d{1,2})?$/.test(amount) ||
                Number(amount) <= 0
              }
              onPress={async () => {
                setAnimateList(true);
                try {
                  await savePreset({
                    ...form,
                    name: form.name.trim(),
                    amountMinor: Math.round(Number(amount) * 100),
                  });
                } catch { return; }
                setForm(null);
                setSuccess((current) => ({ trigger: current.trigger + 1, message: "Saved to your shortcuts" }));
              }}
            >
              <Text style={{ color: Finn.primary, fontWeight: "600" }}>
                Save entry
              </Text>
            </Button>
          </View>
      </>}</Reveal>
      <MotionLayout animate={animateList} style={{ gap: 11 }}>
        {filtered.map((preset) => (
          <Animated.View key={preset.id} style={styles.preset}
            layout={animateList && !reduced ? LinearTransition.duration(Motion.layout).easing(Motion.easeOut) : undefined}
            entering={animateList ? FadeIn.duration(Motion.fade) : undefined}
            exiting={animateList ? FadeOut.duration(Motion.fade) : undefined}>
            <View style={{ flex: 1 }}>
              <Button
                label={`Edit saved entry ${preset.name}`}
                onPress={() => beginEdit(preset)}
                style={styles.presetBody}
              >
                <Text style={styles.name}>{preset.name}</Text>
                <View style={styles.meta}>
                  <Icon name="wallet" size={10} color={Finn.amber} />
                  <Text style={styles.amount}>{money(preset.amountMinor)}</Text>
                  <Text
                    style={{
                      color: Categories[preset.category].color,
                      fontSize: 8,
                    }}
                  >
                    ●
                  </Text>
                  <Text style={styles.detail}>
                    {Categories[preset.category].label}
                  </Text>
                </View>
              </Button>
            </View>
            <Button
              label={
                editing
                  ? `Delete saved entry ${preset.name}`
                  : `Add ${preset.name} to journal`
              }
              onPress={async () => {
                if (editing) {
                  setAnimateList(true);
                  try { await deletePreset(preset.id); } catch { return; }
                } else await add(preset);
              }}
              style={styles.addButton}
            >
              <View
                style={[
                  styles.addCircle,
                  editing && { backgroundColor: "#FBEAED" },
                  added === preset.id &&
                    !editing && { backgroundColor: Finn.primary },
                ]}
              >
                <Icon
                  name={
                    editing ? "trash" : added === preset.id ? "check" : "plus"
                  }
                  animation={false}
                  size={16}
                  color={editing ? Finn.danger : "#fff"}
                />
              </View>
            </Button>
          </Animated.View>
        ))}
      </MotionLayout>
      {!filtered.length && (
        <Text style={styles.empty}>
          {search
            ? "No saved entries match your search."
            : "Save your first everyday expense using +."}
        </Text>
      )}
      {success.trigger > 0 && (
        <ContentFade key={success.trigger}>
          <View accessibilityLiveRegion="polite" style={styles.confirmation}>
            <Icon name="check" color={Finn.primary} size={14} animation="bounce" animationTrigger={success.trigger} />
            <Text style={{ color: Finn.primary, fontSize: 12 }}>{success.message}</Text>
          </View>
        </ContentFade>
      )}
      <Text style={styles.hint}>
        Tap + to add it to your day. Tap a name to edit.
      </Text>
    </AppSheet>
  );
}
const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: Finn.surface,
    borderRadius: 15,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  searchInput: { flex: 1, color: Finn.ink, fontSize: 13, paddingVertical: 12 },
  intro: {
    color: Finn.secondary,
    fontSize: 12,
    marginTop: 15,
    marginBottom: 25,
    textAlign: "center",
  },
  error: {
    alignItems: "center",
    backgroundColor: "#FFF4F2",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    padding: 10,
  },
  errorText: { color: Finn.danger, flex: 1, fontSize: 12 },
  errorAction: { color: Finn.danger, fontSize: 11, fontWeight: "600" },
  preset: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Finn.surface,
    borderRadius: 17,
    paddingLeft: 16,
    paddingRight: 10,
    ...Finn.shadow,
  },
  presetBody: { alignItems: "flex-start", paddingVertical: 16, width: "100%" },
  name: { color: Finn.ink, fontSize: 14, marginBottom: 7 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  amount: { color: Finn.secondary, fontSize: 10, marginRight: 5 },
  detail: { fontSize: 10, color: Finn.secondary },
  addButton: { width: 44 },
  addCircle: {
    borderRadius: 15,
    backgroundColor: Finn.primary,
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontSize: 11,
    lineHeight: 18,
    color: Finn.muted,
    textAlign: "center",
    marginTop: 25,
  },
  empty: {
    color: Finn.secondary,
    fontSize: 14,
    textAlign: "center",
    marginVertical: 30,
  },
  confirmation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingTop: 24,
  },
  formTitle: { fontSize: 16, fontWeight: "600", color: Finn.ink },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  category: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Finn.wash,
  },
});
