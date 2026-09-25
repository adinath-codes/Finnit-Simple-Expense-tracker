import { forwardRef, useCallback, useEffect, useRef, useState, type RefObject } from "react";
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
import { useFocusEffect } from "expo-router";
import { ZoomLink } from "@/components/navigation/zoom-link";
import type { CameraOrigin } from "@/features/camera/components/receipt-camera-sheet";
import * as Network from "expo-network";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Button, type ButtonProps } from "@/components/ui/button";
import { SkeletonBlock } from "@/components/common/loading-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Finn, JournalType } from "@/constants/theme";
import { JournalGlyph, type JournalGlyphName } from "./journal-glyph";
import { useJournal } from "@/providers/app-providers";
import { entryTotal } from "@/utils/amounts";
import { currencySymbol, moneyValue } from "@/utils/currency";
import { SpendingBreakdownCard } from "@/features/summary/components/spending-breakdown-card";
import { ReceiptCameraSheet } from "@/features/camera/components/receipt-camera-sheet";
import type { ReceiptPhoto } from "@/types/domain";
import { subscribePendingJournalChangeCount } from "../services/journal-service";

export function JournalComposer({
     focused,
     draft,
     submitting,
     input,
     onSave,
     onReceiptCaptured,
     onDismiss,
     tool,
     setTool,
}: {
     focused: boolean;
     draft: string;
     submitting: boolean;
     input: RefObject<TextInput | null>;
     onSave: () => void;
     onReceiptCaptured: (photo: ReceiptPhoto) => void;
     onDismiss: () => void;
     tool: "add" | "receipt" | null;
     setTool: (tool: "add" | "receipt" | null) => void;
}) {
     const { entries, selectedDate, goals, settings, syncStatus, journalLoading } = useJournal();
     const insets = useSafeAreaInsets();
     const reduced = useReducedMotion();
     const { isOffline, queuedItemCount } = useOfflineQueueStatus();
     const [summaryOpen, setSummaryOpen] = useState(false);
     const cameraButton = useRef<View>(null);
     const [cameraOrigin, setCameraOrigin] = useState<CameraOrigin | null>(null);
     const [keepToolbar, setKeepToolbar] = useState(false);
     const receiptOpen = useRef(tool === "receipt");
     receiptOpen.current = tool === "receipt";
     useFocusEffect(useCallback(() => {
          // Keep the native source mounted until the reverse zoom has settled.
          const timer = setTimeout(() => { if (!receiptOpen.current) setKeepToolbar(false); }, 400);
          return () => clearTimeout(timer);
     }, []));
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
     const openSavedEntries = () => {
          setKeepToolbar(true);
          setSummaryOpen(false);
          Keyboard.dismiss();
          input.current?.blur();
          onDismiss();

     };
     const categoryTotal = (category: string) =>
          dayEntries.reduce(
               (sum, entry) =>
                    sum +
                    entry.items
                         .filter((item) => item.category === category)
                         .reduce(
                              (acc, item) =>
                                   acc + item.amountMinor,
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
                              {isOffline && (
                                   <OfflineQueueStatus
                                        queuedItemCount={queuedItemCount}
                                   />
                              )}
                              {!isOffline && syncStatus.pending > 0 && (
                                   <SyncProgressStatus count={syncStatus.pending} />
                              )}
                              {syncStatus.blocked > 0 && (
                                   <SyncIssueStatus
                                        conflicts={syncStatus.conflicts}
                                        failed={syncStatus.failed}
                                   />
                              )}
                              <View style={styles.toolbar}>
                                   <View style={{ flex: 1 }}>
                                        <Button
                                             label={
                                                  journalLoading
                                                       ? "Loading journal total"
                                                       : summaryOpen
                                                       ? "Hide spending breakdown"
                                                       : "View spending breakdown and goals"
                                             }
                                             disabled={journalLoading}
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
                                                  summaryOpen &&
                                                       styles.summaryOpen,
                                             ]}
                                        >
                                             {journalLoading ? (
                                                  <SkeletonBlock width={116} height={18} radius={9} />
                                             ) : (
                                                  <>
                                                       <Text style={styles.currencyIcon}>
                                                            {currencySymbol(settings.currency)}
                                                       </Text>
                                                       <Text style={styles.total}>
                                                            {moneyValue(
                                                                 focused
                                                                      ? Math.max(0, (goals[0]?.limit ?? 0) - total)
                                                                      : total,
                                                            )}
                                                       </Text>
                                                       {focused ? (
                                                            <Text style={styles.remaining}>spent</Text>
                                                       ) : (
                                                            (["food", "transport", "shopping"] as const).map((category, index) => (
                                                                 <View key={category} style={styles.mini}>
                                                                      <Text style={styles.separator}>·</Text>
                                                                      <JournalGlyph
                                                                           name={(["food", "car", "bag"] as const)[index]}
                                                                           size={11}
                                                                           color={(["#EF7899", "#EBC64F", Finn.primary] as const)[index]}
                                                                      />
                                                                      <Text style={styles.miniValue}>
                                                                           {Math.round(categoryTotal(category) / 100)}
                                                                      </Text>
                                                                 </View>
                                                            ))
                                                       )}
                                                  </>
                                             )}
                                        </Button>
                                   </View>
                                   {(focused || keepToolbar) && (
                                        <>
                                             <ZoomLink href="/settings/presets"><ToolbarButton
                                                  name="plus"
                                                  color="#EDB16D"
                                                  label="Open saved entries"
                                                  onPress={openSavedEntries}
                                             /></ZoomLink>
                                             <ToolbarButton
                                                  ref={cameraButton}
                                                  name="camera"
                                                  color={Finn.ink}
                                                  label="Open receipt camera"
                                                  onPress={() => {
                                                       const show = () => { setKeepToolbar(true); openTool("receipt"); };
                                                       if (!cameraButton.current) { setCameraOrigin(null); show(); return; }
                                                       cameraButton.current.measureInWindow((x, y, width, height) => {
                                                            setCameraOrigin(width && height ? { x, y, width, height } : null);
                                                            show();
                                                       });
                                                  }}
                                             />
                                             <ToolbarButton
                                                  name="check"
                                                  color={Finn.surface}
                                                  filled
                                                  label="Save note"
                                                  disabled={!draft.trim() || submitting}
                                                  onPress={onSave}
                                             />
                                        </>
                                   )}
                              </View>
               </View>
               <ReceiptCameraSheet
                    visible={tool === "receipt"}
                    origin={cameraOrigin}
                    onDismissed={() => setKeepToolbar(false)}
                    onClose={() => setTool(null)}
                    onUsePhoto={(photo) => {
                         setTool(null);
                         onReceiptCaptured(photo);
                    }}
               />
               <Modal
                    visible={tool === "add"}
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
                                        A little easier to remember
                                   </Text>
                                   <IconButton
                                        name="close"
                                        label="Close entry options"
                                        onPress={() => setTool(null)}
                                   />
                              </View>
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
                         </View>
                    </View>
               </Modal>
          </>
     );
}

function useOfflineQueueStatus() {
     const network = Network.useNetworkState();
     const [queuedItemCount, setQueuedItemCount] = useState(0);

     useEffect(
          () => subscribePendingJournalChangeCount(setQueuedItemCount),
          [],
     );

     return {
          isOffline:
               network.isConnected === false ||
               network.isInternetReachable === false,
          queuedItemCount,
     };
}

function OfflineQueueStatus({ queuedItemCount }: { queuedItemCount: number }) {
     const itemLabel = queuedItemCount === 1 ? "item" : "items";

     return (
          <View
               accessible
               accessibilityLabel={`Offline. ${queuedItemCount} ${itemLabel} queued for syncing.`}
               accessibilityLiveRegion="polite"
               style={styles.offlineStatus}
          >
               <Icon name="offline" color="#D59A52" size={16} />
               <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    numberOfLines={1}
                    style={styles.offlineStatusText}
               >
                    Offline · {queuedItemCount} {itemLabel} queued for syncing
               </Text>
          </View>
     );
}

function SyncProgressStatus({ count }: { count: number }) {
     const changeLabel = count === 1 ? "change" : "changes";
     return (
          <View accessible accessibilityLiveRegion="polite" style={styles.offlineStatus}>
               <Icon name="refresh" color={Finn.muted} size={16} />
               <Text style={[styles.offlineStatusText, styles.syncProgressText]}>
                    {count} journal {changeLabel} waiting to sync
               </Text>
          </View>
     );
}

function SyncIssueStatus({
     failed,
     conflicts,
}: {
     failed: number;
     conflicts: number;
}) {
     const parts = [
          conflicts > 0
               ? `${conflicts} ${conflicts === 1 ? "conflict" : "conflicts"} to resolve`
               : null,
          failed > 0
               ? `${failed} failed ${failed === 1 ? "change" : "changes"} to retry`
               : null,
     ].filter(Boolean);
     return (
          <View accessible accessibilityLiveRegion="polite" style={[styles.offlineStatus, styles.syncIssueStatus]}>
               <Icon name="offline" color={Finn.danger} size={16} />
               <Text style={[styles.offlineStatusText, { color: Finn.danger }]}>
                    {parts.join(" · ")}
               </Text>
          </View>
     );
}

const ToolbarButton = forwardRef<View, Omit<ButtonProps, "children"> & {
     name: JournalGlyphName; color?: string; filled?: boolean;
}>(function ToolbarButton({ name, color = Finn.ink, filled = false, ...props }, ref) {
     return <Button
          {...props}
          ref={ref}
          style={[styles.toolButton, filled && styles.toolButtonFilled]}
     >
          <JournalGlyph name={name} color={color} size={20} />
     </Button>;
});

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
                    <Icon name={icon} color={Finn.primary} />
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
     offlineStatus: {
          alignItems: "center",
          alignSelf: "stretch",
          backgroundColor: "rgba(255,255,255,0.78)",
          borderColor: "rgba(255,255,255,0.9)",
          borderRadius: 22,
          borderWidth: 1,
          boxShadow: "0px 8px 24px rgba(161, 125, 75, 0.08)",
          flexDirection: "row",
          gap: 9,
          justifyContent: "center",
          marginBottom: 12,
          minHeight: 44,
          paddingHorizontal: 16,
     },
     offlineStatusText: {
          color: "#D59A52",
          fontFamily: JournalType.medium,
          fontSize: 13,
          flexShrink: 1,
          includeFontPadding: false,
          lineHeight: 17,
     },
     syncIssueStatus: { backgroundColor: "rgba(255,244,242,0.92)" },
     syncProgressText: { color: Finn.muted },
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
     toolButtonFilled: {
          backgroundColor: Finn.primary,
          borderColor: Finn.primary,
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
          backgroundColor: Finn.primarySoft,
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
          backgroundColor: Finn.primarySoft,
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
          backgroundColor: Finn.primary,
          borderRadius: 23,
          marginBottom: Platform.OS === "ios" ? 8 : 0,
     },
});
