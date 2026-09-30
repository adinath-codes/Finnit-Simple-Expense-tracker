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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
     Extrapolation,
     interpolate,
     useAnimatedStyle,
     useDerivedValue,
     useSharedValue,
     withTiming,
     type SharedValue,
} from "react-native-reanimated";
import { Button, type ButtonProps } from "@/components/ui/button";
import { SkeletonBlock } from "@/components/common/loading-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Motion } from "@/constants/motion";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { JournalGlyph, type JournalGlyphName } from "./journal-glyph";
import {
     useJournalData,
     useJournalStatus,
} from "@/providers/app-providers";
import { entryTotal } from "@/utils/amounts";
import { currencySymbol, moneyValue } from "@/utils/currency";
import { SpendingBreakdownCard } from "@/features/summary/components/spending-breakdown-card";
import { ReceiptCameraSheet } from "@/features/camera/components/receipt-camera-sheet";
import type { ReceiptPhoto } from "@/types/domain";

const TOOL_BUTTON_SIZE = 44;
const TOOL_GAP = 12;
const CLOSED_TOOLBAR_INSET = 8;
const EXPANDED_ACTION_SPACE = TOOL_BUTTON_SIZE * 3 + TOOL_GAP * 3;

export function JournalComposer({
     focused,
     draft,
     saveValue,
     saveLabel,
     editingEntry,
     aiEnabled,
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
     saveValue: string;
     saveLabel: string;
     editingEntry: boolean;
     aiEnabled: boolean;
     submitting: boolean;
     input: RefObject<TextInput | null>;
     onSave: () => void;
     onReceiptCaptured: (photo: ReceiptPhoto) => void;
     onDismiss: () => void;
     tool: "add" | "receipt" | null;
     setTool: (tool: "add" | "receipt" | null) => void;
}) {
     const { entries, selectedDate, settings } = useJournalData();
     const { syncStatus, journalLoading } = useJournalStatus();
     const insets = useSafeAreaInsets();
     const reduced = useMotionPreference();
     const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();
     const [summaryOpen, setSummaryOpen] = useState(false);
     const cameraButton = useRef<View>(null);
     const [cameraOrigin, setCameraOrigin] = useState<CameraOrigin | null>(null);
     const [keepToolbar, setKeepToolbar] = useState(false);
     const retainedProgress = useSharedValue(keepToolbar ? 1 : 0);
     const webFocusProgress = useSharedValue(focused ? 1 : 0);
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
     useEffect(() => {
          retainedProgress.set(withTiming(keepToolbar ? 1 : 0, {
               duration: Motion.layout,
               easing: Motion.easeInOut,
          }));
     }, [keepToolbar, retainedProgress]);
     useEffect(() => {
          if (Platform.OS !== "web") return;
          webFocusProgress.set(withTiming(focused ? 1 : 0, {
               duration: reduced ? Motion.fade : Motion.layout,
               easing: Motion.easeInOut,
          }));
     }, [focused, reduced, webFocusProgress]);

     const toolbarProgress = useDerivedValue(() => {
          const keyboard = Platform.OS === "web"
               ? webFocusProgress.get()
               : keyboardProgress.get();
          return Math.min(1, Math.max(0, Math.max(keyboard, retainedProgress.get())));
     });
     const surfaceStyle = useAnimatedStyle(() => {
          const progress = toolbarProgress.get();
          if (reduced) {
               return {
                    opacity: interpolate(progress, [0, 0.45, 0.55, 1], [1, 1, 0, 0], Extrapolation.CLAMP),
                    left: CLOSED_TOOLBAR_INSET,
                    right: CLOSED_TOOLBAR_INSET,
               };
          }
          return {
               opacity: 1,
               left: interpolate(progress, [0, 1], [CLOSED_TOOLBAR_INSET, 0], Extrapolation.CLAMP),
               right: interpolate(
                    progress,
                    [0, 1],
                    [CLOSED_TOOLBAR_INSET, EXPANDED_ACTION_SPACE],
                    Extrapolation.CLAMP,
               ),
          };
     });
     const reducedCompactSurfaceStyle = useAnimatedStyle(() => ({
          opacity: reduced
               ? interpolate(toolbarProgress.get(), [0, 0.45, 0.55, 1], [0, 0, 1, 1], Extrapolation.CLAMP)
               : 0,
     }));
     const closedContentStyle = useAnimatedStyle(() => {
          const progress = toolbarProgress.get();
          return {
               opacity: interpolate(
                    progress,
                    reduced ? [0, 0.45, 0.55, 1] : [0, 0.32, 1],
                    reduced ? [1, 1, 0, 0] : [1, 0, 0],
                    Extrapolation.CLAMP,
               ),
               transform: [{
                    translateX: reduced
                         ? 0
                         : interpolate(progress, [0, 0.32], [0, -4], Extrapolation.CLAMP),
               }],
          };
     });
     const compactContentStyle = useAnimatedStyle(() => {
          const progress = toolbarProgress.get();
          return {
               opacity: interpolate(
                    progress,
                    reduced ? [0, 0.45, 0.55, 1] : [0, 0.28, 0.58, 1],
                    reduced ? [0, 0, 1, 1] : [0, 0, 1, 1],
                    Extrapolation.CLAMP,
               ),
               transform: [{
                    translateX: reduced
                         ? 0
                         : interpolate(progress, [0.28, 0.58], [-6, 0], Extrapolation.CLAMP),
               }],
          };
     });
     const checkStyle = useToolbarPeelStyle(toolbarProgress, 0.05, 0.65, reduced);
     const cameraStyle = useToolbarPeelStyle(toolbarProgress, 0.12, 0.78, reduced);
     const plusStyle = useToolbarPeelStyle(toolbarProgress, 0.20, 0.92, reduced);
     const expanded = focused || keepToolbar;
     const summaryLabel = journalLoading
          ? "Loading journal total"
          : summaryOpen
          ? "Hide spending breakdown"
          : "View spending breakdown and goals";
     const toggleSummary = () => {
          const nextOpen = !summaryOpen;
          if (nextOpen) {
               Keyboard.dismiss();
               input.current?.blur();
               onDismiss();
          }
          setSummaryOpen(nextOpen);
     };
     return (
          <>
               <View
                    style={[
                         styles.footer,
                         {
                              paddingHorizontal: 28,
                              paddingBottom: 16,
                         },
                    ]}
               >
                              <SpendingBreakdownCard visible={summaryOpen} />
                              {syncStatus.conflicts > 0 && (
                                   <SyncConflictStatus count={syncStatus.conflicts} />
                              )}
                              <View style={styles.toolbar}>
                                   <Animated.View
                                        pointerEvents="none"
                                        style={[styles.summarySurface, summaryOpen && styles.summaryOpen, surfaceStyle]}
                                   />
                                   <Animated.View
                                        pointerEvents="none"
                                        style={[
                                             styles.summarySurface,
                                             styles.compactSummarySurface,
                                             summaryOpen && styles.summaryOpen,
                                             reducedCompactSurfaceStyle,
                                        ]}
                                   />
                                   <Animated.View
                                        pointerEvents={expanded ? "none" : "auto"}
                                        accessibilityElementsHidden={expanded}
                                        importantForAccessibility={expanded ? "no-hide-descendants" : "auto"}
                                        style={[styles.closedSummaryLayer, closedContentStyle]}
                                   >
                                        <Button
                                             label={summaryLabel}
                                             disabled={journalLoading || editingEntry}
                                             onPress={toggleSummary}
                                             style={styles.summaryContent}
                                        >
                                             {journalLoading ? (
                                                  <SkeletonBlock width={116} height={18} radius={9} />
                                             ) : (
                                                  <>
                                                       <Text style={styles.currencyIcon}>
                                                            {currencySymbol(settings.currency)}
                                                       </Text>
                                                       <Text style={styles.total}>{moneyValue(total)}</Text>
                                                       {(["food", "transport", "shopping"] as const).map((category, index) => (
                                                            <View key={category} style={styles.mini}>
                                                                 <Text style={styles.separator}>·</Text>
                                                                 <JournalGlyph
                                                                      name={(["food", "car", "bag"] as const)[index]}
                                                                      size={11}
                                                                      color={(["#EF7899", "#EBC64F", Finn.primary] as const)[index]}
                                                                 />
                                                                 <Text style={styles.miniValue}>
                                                                      {moneyValue(
                                                                           categoryTotal(category),
                                                                           settings.currency,
                                                                      )}
                                                                 </Text>
                                                            </View>
                                                       ))}
                                                  </>
                                             )}
                                        </Button>
                                   </Animated.View>
                                   <Animated.View
                                        pointerEvents={expanded ? "auto" : "none"}
                                        accessibilityElementsHidden={!expanded}
                                        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
                                        style={[styles.compactSummaryLayer, compactContentStyle]}
                                   >
                                        <Button
                                             label={summaryLabel}
                                             disabled={journalLoading || editingEntry}
                                             onPress={toggleSummary}
                                             style={styles.summaryContent}
                                        >
                                             {journalLoading ? (
                                                  <SkeletonBlock width={82} height={18} radius={9} />
                                             ) : (
                                                  <>
                                                       <Text style={styles.currencyIcon}>
                                                            {currencySymbol(settings.currency)}
                                                       </Text>
                                                       <Text style={styles.total}>
                                                            {moneyValue(total)}
                                                       </Text>
                                                       <Text style={styles.remaining}>spent</Text>
                                                  </>
                                             )}
                                        </Button>
                                   </Animated.View>
                                   <Animated.View
                                        pointerEvents={expanded ? "auto" : "none"}
                                        accessibilityElementsHidden={!expanded}
                                        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
                                        style={[styles.toolSlot, styles.plusSlot, plusStyle]}
                                   >
                                        {editingEntry ? (
                                             <ToolbarButton
                                                  name="plus"
                                                  color="#EDB16D"
                                                  label="Open saved entries"
                                                  disabled
                                             />
                                        ) : (
                                             <ZoomLink href="/settings/presets"><ToolbarButton
                                                  name="plus"
                                                  color="#EDB16D"
                                                  label="Open saved entries"
                                                  onPress={openSavedEntries}
                                             /></ZoomLink>
                                        )}
                                   </Animated.View>
                                   <Animated.View
                                        pointerEvents={expanded ? "auto" : "none"}
                                        accessibilityElementsHidden={!expanded}
                                        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
                                        style={[styles.toolSlot, styles.cameraSlot, cameraStyle]}
                                   >
                                        <ToolbarButton
                                             ref={cameraButton}
                                             name="camera"
                                             color={Finn.ink}
                                             label={aiEnabled
                                                  ? "Open receipt camera"
                                                  : "Receipt scanning requires AI permission in Settings"}
                                             disabled={editingEntry || !aiEnabled}
                                             onPress={() => {
                                                  const show = () => { setKeepToolbar(true); openTool("receipt"); };
                                                  if (!cameraButton.current) { setCameraOrigin(null); show(); return; }
                                                  cameraButton.current.measureInWindow((x, y, width, height) => {
                                                       setCameraOrigin(width && height ? { x, y, width, height } : null);
                                                       show();
                                                  });
                                             }}
                                        />
                                   </Animated.View>
                                   <Animated.View
                                        pointerEvents={expanded ? "auto" : "none"}
                                        accessibilityElementsHidden={!expanded}
                                        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
                                        style={[styles.toolSlot, styles.checkSlot, checkStyle]}
                                   >
                                        <ToolbarButton
                                             name="check"
                                             color={Finn.surface}
                                             filled
                                             label={saveLabel}
                                             disabled={(!editingEntry && !saveValue.trim()) || submitting}
                                             onPress={onSave}
                                        />
                                   </Animated.View>
                              </View>
               </View>
               {aiEnabled && <ReceiptCameraSheet
                    visible={tool === "receipt"}
                    origin={cameraOrigin}
                    onDismissed={() => setKeepToolbar(false)}
                    onClose={() => setTool(null)}
                    onUsePhoto={(photo) => {
                         setTool(null);
                         onReceiptCaptured(photo);
                    }}
               />}
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

function SyncConflictStatus({ count }: { count: number }) {
     return (
          <View accessible accessibilityLiveRegion="polite" style={[styles.offlineStatus, styles.syncIssueStatus]}>
               <Icon name="refresh" color="#A16D20" size={16} />
               <Text style={[styles.offlineStatusText, { color: "#A16D20" }]}>
                    {count} {count === 1 ? "change needs" : "changes need"} a version choice
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

function useToolbarPeelStyle(
     progress: SharedValue<number>,
     start: number,
     end: number,
     reduced: boolean,
) {
     return useAnimatedStyle(() => {
          const current = progress.get();
          const range = reduced ? [0.45, 0.55] : [start, end];
          const opacity = interpolate(current, range, [0, 1], Extrapolation.CLAMP);
          return {
               opacity,
               transform: [
                    {
                         translateX: reduced
                              ? 0
                              : interpolate(current, [start, end], [-10, 0], Extrapolation.CLAMP),
                    },
                    {
                         scale: reduced
                              ? 1
                              : interpolate(current, [start, end], [0.94, 1], Extrapolation.CLAMP),
                    },
               ],
          };
     });
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
     toolbar: {
          height: 48,
          position: "relative",
     },
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
     summarySurface: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 48,
          borderRadius: 28,
          backgroundColor: "rgba(255,255,255,0.92)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.96)",
          boxShadow: "0px 8px 26px rgba(161, 125, 75, 0.11)",
     },
     compactSummarySurface: {
          right: EXPANDED_ACTION_SPACE,
     },
     closedSummaryLayer: {
          position: "absolute",
          left: CLOSED_TOOLBAR_INSET,
          right: CLOSED_TOOLBAR_INSET,
          top: 0,
          height: 48,
          zIndex: 1,
     },
     compactSummaryLayer: {
          position: "absolute",
          left: 0,
          right: EXPANDED_ACTION_SPACE,
          top: 0,
          height: 48,
          zIndex: 1,
     },
     summaryContent: {
          width: "100%",
          height: 48,
          minHeight: 48,
          flexDirection: "row",
          gap: 4,
          paddingHorizontal: 12,
     },
     toolSlot: {
          position: "absolute",
          top: 2,
          width: TOOL_BUTTON_SIZE,
          height: TOOL_BUTTON_SIZE,
          zIndex: 2,
     },
     plusSlot: {
          right: (TOOL_BUTTON_SIZE + TOOL_GAP) * 2,
     },
     cameraSlot: {
          right: TOOL_BUTTON_SIZE + TOOL_GAP,
     },
     checkSlot: {
          right: 0,
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
