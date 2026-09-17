import { useEffect, useState, type RefObject } from "react";
import {
     Keyboard,
     Modal,
     Platform,
     Pressable,
     StyleSheet,
     Text,
     TextInput,
     View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Finn, JournalType } from "@/constants/theme";
import { JournalGlyph, type JournalGlyphName } from "./journal-glyph";
import { useJournal } from "@/providers/app-providers";
import { entryTotal } from "@/utils/amounts";
import { currencySymbol, moneyValue } from "@/utils/currency";
import { SpendingBreakdownCard } from "@/features/summary/components/spending-breakdown-card";

export function JournalComposer({
     focused,
     draft,
     input,
     onSave,
     onInsert,
     onDismiss,
     tool,
     setTool,
}: {
     focused: boolean;
     draft: string;
     input: RefObject<TextInput | null>;
     onSave: () => void;
     onInsert: (note: string) => void;
     onDismiss: () => void;
     tool: "add" | "voice" | "receipt" | null;
     setTool: (tool: "add" | "voice" | "receipt" | null) => void;
}) {
     const { entries, selectedDate, goals, settings } = useJournal();
     const insets = useSafeAreaInsets();
     const reduced = useReducedMotion();
     const [summaryOpen, setSummaryOpen] = useState(false);
     const dayEntries = entries.filter((entry) => entry.date === selectedDate);
     const total = dayEntries.reduce(
          (sum, entry) => sum + entryTotal(entry),
          0,
     );
     const openTool = (next: typeof tool) => {
          setSummaryOpen(false);
          Keyboard.dismiss();
          input.current?.blur();
          onDismiss();
          setTool(next);
     };
     const insert = (note: string) => {
          onInsert(note);
          setTool(null);
          input.current?.focus();
     };
     const categoryTotal = (category: string) =>
          dayEntries.reduce(
               (sum, entry) =>
                    sum +
                    entry.items
                         .filter((item) => item.category === category)
                         .reduce(
                              (acc, item) =>
                                   acc + item.amountMinor * item.quantity,
                              0,
                         ),
               0,
          );
     useEffect(() => {
          if (focused) setSummaryOpen(false);
     }, [focused]);
     return (
          <>
               <View
                    style={[
                         styles.footer,
                         {
                              paddingHorizontal: focused ? 28 : 36,
                              paddingBottom: 16,
                         },
                    ]}
               >
                    <SpendingBreakdownCard visible={summaryOpen} />
                    <View style={styles.toolbar}>
                         <View style={{ flex: 1 }}>
                              <Button
                                   label={
                                        summaryOpen
                                             ? "Hide spending breakdown"
                                             : "View spending breakdown and goals"
                                   }
                                   onPress={() => {
                                        const nextOpen = !summaryOpen;
                                        if (nextOpen) {
                                             Keyboard.dismiss();
                                             input.current?.blur();
                                             onDismiss();
                                        }
                                        setSummaryOpen(nextOpen);
                                   }}
                                   style={[
                                        styles.summary,
                                        summaryOpen && styles.summaryOpen,
                                   ]}
                              >
                                   <Text style={styles.currencyIcon}>
                                        {currencySymbol(settings.currency)}
                                   </Text>
                                   <Text style={styles.total}>
                                        {moneyValue(
                                             focused
                                                  ? Math.max(
                                                         0,
                                                         (goals[0]?.limit ??
                                                              0) - total,
                                                    )
                                                  : total,
                                        )}
                                   </Text>
                                   {focused ? (
                                        <Text style={styles.remaining}>
                                             spent
                                        </Text>
                                   ) : (
                                        (
                                             [
                                                  "food",
                                                  "transport",
                                                  "shopping",
                                             ] as const
                                        ).map((category, index) => (
                                             <View
                                                  key={category}
                                                  style={styles.mini}
                                             >
                                                  <Text
                                                       style={styles.separator}
                                                  >
                                                       ·
                                                  </Text>
                                                  <JournalGlyph
                                                       name={
                                                            (
                                                                 [
                                                                      "food",
                                                                      "car",
                                                                      "bag",
                                                                 ] as const
                                                            )[index]
                                                       }
                                                       size={11}
                                                       color={
                                                            (
                                                                 [
                                                                      "#EF7899",
                                                                      "#EBC64F",
                                                                      "#CD76DC",
                                                                 ] as const
                                                            )[index]
                                                       }
                                                  />
                                                  <Text
                                                       style={styles.miniValue}
                                                  >
                                                       {Math.round(
                                                            categoryTotal(
                                                                 category,
                                                            ) / 100,
                                                       )}
                                                  </Text>
                                             </View>
                                        ))
                                   )}
                              </Button>
                         </View>
                         {focused && (
                              <>
                                   <ToolbarButton
                                        name="mic"
                                        color={Finn.blue}
                                        label="Open voice preview"
                                        onPress={() => openTool("voice")}
                                   />
                                   <ToolbarButton
                                        name="plus"
                                        color="#EDB16D"
                                        label="Add an entry or use a saved item"
                                        onPress={() => openTool("add")}
                                   />
                                   <ToolbarButton
                                        name="keyboard"
                                        label={
                                             draft.trim()
                                                  ? "Save note and dismiss keyboard"
                                                  : "Dismiss keyboard"
                                        }
                                        onPress={() => {
                                             if (draft.trim()) onSave();
                                             else {
                                                  input.current?.blur();
                                                  Keyboard.dismiss();
                                                  onDismiss();
                                             }
                                        }}
                                   />
                              </>
                         )}
                    </View>
               </View>
               <Modal
                    visible={tool !== null}
                    transparent
                    animationType={reduced ? "none" : "fade"}
                    onRequestClose={() => setTool(null)}
               >
                    <View style={styles.modalBackdrop}>
                         <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Dismiss entry options"
                              onPress={() => setTool(null)}
                              style={StyleSheet.absoluteFill}
                         />
                         <View
                              style={[
                                   styles.menu,
                                   {
                                        marginBottom: Math.max(
                                             insets.bottom,
                                             16,
                                        ),
                                   },
                              ]}
                              accessibilityViewIsModal
                         >
                              <View style={styles.menuHeader}>
                                   <Text style={styles.menuTitle}>
                                        {tool === "add"
                                             ? "A little easier to remember"
                                             : tool === "voice"
                                               ? "Say what happened"
                                               : "Add a receipt"}
                                   </Text>
                                   <IconButton
                                        name="close"
                                        label="Close entry options"
                                        onPress={() => setTool(null)}
                                   />
                              </View>
                              {tool === "add" ? (
                                   <>
                                        {!!draft.trim() && (
                                             <MenuRow
                                                  icon="check"
                                                  title="Save note"
                                                  detail="Add this note to your journal"
                                                  onPress={() => {
                                                       setTool(null);
                                                       onSave();
                                                  }}
                                             />
                                        )}
                                        <MenuRow
                                             icon="bookmark"
                                             title="Saved entries"
                                             detail="Your everyday things, one tap away"
                                             onPress={() => {
                                                  setTool(null);
                                                  router.push(
                                                       "/settings/presets",
                                                  );
                                             }}
                                        />
                                        <MenuRow
                                             icon="mic"
                                             title="Voice note"
                                             detail="Try a sample voice entry"
                                             onPress={() => setTool("voice")}
                                        />
                                        <MenuRow
                                             icon="camera"
                                             title="Receipt"
                                             detail="Preview a receipt entry"
                                             onPress={() => setTool("receipt")}
                                        />
                                   </>
                              ) : (
                                   <>
                                        <View style={styles.demoIcon}>
                                             <Icon
                                                  name={
                                                       tool === "voice"
                                                            ? "mic"
                                                            : "note"
                                                  }
                                                  color={Finn.purple}
                                                  size={30}
                                             />
                                        </View>
                                        <Text style={styles.demoTitle}>
                                             {tool === "voice"
                                                  ? "“Coffee on the way to work, 180”"
                                                  : "Third Wave Coffee\nCappuccino                       ₹180"}
                                        </Text>
                                        <Text style={styles.demoHint}>
                                             {tool === "voice"
                                                  ? "Voice preview · no audio is recorded"
                                                  : "Sample receipt · camera access is not needed"}
                                        </Text>
                                        <Button
                                             label="Use sample entry"
                                             onPress={() =>
                                                  insert(
                                                       "Coffee on the way to work 180",
                                                  )
                                             }
                                             style={styles.useSample}
                                        >
                                             <Text
                                                  style={{
                                                       color: "#fff",
                                                       fontWeight: "600",
                                                  }}
                                             >
                                                  Use sample entry
                                             </Text>
                                        </Button>
                                   </>
                              )}
                         </View>
                    </View>
               </Modal>
          </>
     );
}
function ToolbarButton({
     name,
     label,
     onPress,
     color = Finn.ink,
}: {
     name: JournalGlyphName;
     label: string;
     onPress: () => void;
     color?: string;
}) {
     return (
          <Button label={label} onPress={onPress} style={styles.toolButton}>
               <JournalGlyph name={name} color={color} size={20} />
          </Button>
     );
}

function MenuRow({
     icon,
     title,
     detail,
     onPress,
}: {
     icon: IconName;
     title: string;
     detail: string;
     onPress: () => void;
}) {
     return (
          <Button label={title} onPress={onPress} style={styles.menuRow}>
               <View style={styles.menuIcon}>
                    <Icon name={icon} color={Finn.purple} />
               </View>
               <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{title}</Text>
                    <Text style={styles.menuDetail}>{detail}</Text>
               </View>
               <Icon name="chevron" size={15} color={Finn.muted} />
          </Button>
     );
}
const styles = StyleSheet.create({
     footer: {
          paddingTop: 16,
     },
     toolbar: { flexDirection: "row", alignItems: "center", gap: 12 },
     toolButton: {
          width: 44,
          height: 44,
          minHeight: 44,
          borderRadius: 22,
          backgroundColor: "rgba(255,255,255,0.92)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.96)",
          boxShadow: "0px 8px 26px rgba(161, 125, 75, 0.11)",
     },
     summary: {
          borderRadius: 28,
          minHeight: 48,
          backgroundColor: "rgba(255,255,255,0.92)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.96)",
          flexDirection: "row",
          gap: 4,
          paddingHorizontal: 12,
          boxShadow: "0px 8px 26px rgba(161, 125, 75, 0.11)",
     },
     summaryOpen: {
          boxShadow: "0px 10px 30px rgba(130, 96, 73, 0.16)",
     },
     currencyIcon: {
          fontFamily: JournalType.bold,
          fontSize: 15,
          lineHeight: 18,
          color: "#20C878",
          fontWeight: "700",
          includeFontPadding: false,
     },
     total: {
          fontFamily: JournalType.bold,
          fontSize: 14,
          color: Finn.ink,
          fontWeight: "700",
          includeFontPadding: false,
          fontVariant: ["tabular-nums"],
     },
     remaining: {
          fontFamily: JournalType.regular,
          fontSize: 11,
          color: Finn.secondary,
          includeFontPadding: false,
     },
     separator: {
          fontFamily: JournalType.regular,
          fontSize: 13,
          color: "#B7ADB1",
          marginHorizontal: 3,
          includeFontPadding: false,
     },
     mini: { flexDirection: "row", alignItems: "center", gap: 2 },
     miniValue: {
          fontFamily: JournalType.medium,
          fontSize: 13,
          color: Finn.ink,
          includeFontPadding: false,
          fontVariant: ["tabular-nums"],
     },
     modalBackdrop: {
          flex: 1,
          justifyContent: "flex-end",
          alignItems: "center",
          paddingHorizontal: 12,
          backgroundColor: "rgba(39, 28, 24, 0.18)",
     },
     menu: {
          backgroundColor: Finn.canvas,
          padding: 19,
          borderRadius: 28,
          width: "100%",
          maxWidth: 450,
          ...Finn.shadow,
     },
     menuHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
     },
     menuTitle: { fontSize: 16, fontWeight: "600", color: Finn.ink },
     menuRow: {
          flexDirection: "row",
          gap: 13,
          paddingVertical: 15,
          alignItems: "center",
     },
     menuIcon: {
          width: 42,
          height: 42,
          backgroundColor: Finn.purpleSoft,
          borderRadius: 14,
          justifyContent: "center",
          alignItems: "center",
     },
     menuLabel: { fontSize: 15, color: Finn.ink },
     menuDetail: { fontSize: 11, color: Finn.secondary, marginTop: 4 },
     demoIcon: {
          alignSelf: "center",
          padding: 20,
          borderRadius: 30,
          backgroundColor: Finn.purpleSoft,
          margin: 18,
     },
     demoTitle: {
          fontSize: 20,
          lineHeight: 30,
          textAlign: "center",
          color: Finn.ink,
     },
     demoHint: {
          fontSize: 12,
          color: Finn.secondary,
          textAlign: "center",
          marginVertical: 20,
     },
     useSample: {
          backgroundColor: Finn.purple,
          borderRadius: 23,
          marginBottom: Platform.OS === "ios" ? 8 : 0,
     },
});
