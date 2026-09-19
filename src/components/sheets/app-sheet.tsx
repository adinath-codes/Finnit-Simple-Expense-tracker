import { type ReactNode } from "react";
import {
     KeyboardAvoidingView,
     Platform,
     ScrollView,
     StyleSheet,
     type StyleProp,
     Text,
     type TextStyle,
     View,
     type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Finn, JournalType } from "@/constants/theme";
import { Screen } from "@/components/common/screen";
import { IconButton } from "@/components/ui/icon-button";
export function closeSheet() {
     if (router.canGoBack()) router.back();
     else router.replace("/");
}
export function AppSheet({
     title,
     children,
     right,
     footer,
     headerLayout = "centered",
     bodyStyle,
     headerScrollable = false,
}: {
     title: string;
     children: ReactNode;
     right?: ReactNode;
     footer?: ReactNode;
     headerLayout?: "centered" | "leading";
     bodyStyle?: StyleProp<ViewStyle>;
     headerScrollable?: boolean;
}) {
     const insets = useSafeAreaInsets();
     const header = (
          <View
               style={[
                    styles.header,
                    { paddingTop: Platform.OS === "web" ? 25 : 16 },
               ]}
          >
               {headerLayout === "leading" ? (
                    <>
                         <Text
                              accessibilityRole="header"
                              style={[styles.title, styles.leadingTitle]}
                         >
                              {title}
                         </Text>
                         <View style={styles.leadingActions}>{right}</View>
                    </>
               ) : (
                    <>
                         <View style={styles.headerSide}>
                              <IconButton
                                   name="close"
                                   label={`Close ${title}`}
                                   onPress={closeSheet}
                              />
                         </View>
                         <Text accessibilityRole="header" style={styles.title}>
                              {title}
                         </Text>
                         <View
                              style={[
                                   styles.headerSide,
                                   styles.headerSideRight,
                              ]}
                         >
                              {right}
                         </View>
                    </>
               )}
          </View>
     );
     return (
          <Screen>
               <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
               >
                    {!headerScrollable && header}
                    <ScrollView
                         // On Android, let the content consume upward drags until it
                         // reaches its top edge; only then can the native form sheet
                         // take over and dismiss.
                         nestedScrollEnabled={Platform.OS === "android"}
                         keyboardShouldPersistTaps="handled"
                         showsVerticalScrollIndicator={false}
                         contentContainerStyle={[
                              !headerScrollable && styles.body,
                              !headerScrollable && bodyStyle,
                              {
                                   paddingBottom:
                                        Math.max(insets.bottom, 22) +
                                        (footer ? 85 : 12),
                              },
                         ]}
                    >
                         {headerScrollable ? (
                              <>
                                   {header}
                                   <View style={[styles.body, bodyStyle]}>
                                        {children}
                                   </View>
                              </>
                         ) : (
                              children
                         )}
                    </ScrollView>
                    {footer && (
                         <View
                              style={[
                                   styles.footer,
                                   {
                                        paddingBottom: Math.max(
                                             insets.bottom,
                                             20,
                                        ),
                                   },
                              ]}
                         >
                              {footer}
                         </View>
                    )}
               </KeyboardAvoidingView>
          </Screen>
     );
}
export function SectionLabel({
     children,
     style,
}: {
     children: ReactNode;
     style?: StyleProp<TextStyle>;
}) {
     return <Text style={[styles.section, style]}>{children}</Text>;
}
export const sheetStyles = StyleSheet.create({
     card: {
          padding: 18,
          backgroundColor: Finn.surface,
          borderRadius: 20,
          ...Finn.shadow,
     },
     row: { flexDirection: "row", alignItems: "center", gap: 12 },
     text: { fontSize: 15, lineHeight: 23, color: Finn.ink },
     subtle: { fontSize: 12, lineHeight: 18, color: Finn.secondary },
     input: {
          borderRadius: 14,
          backgroundColor: Finn.surface,
          padding: 16,
          fontSize: 16,
          color: Finn.ink,
          borderWidth: 1,
          borderColor: Finn.line,
     },
     primary: {
          borderRadius: 24,
          paddingHorizontal: 24,
          backgroundColor: Finn.primary,
          minHeight: 48,
     },
});
const styles = StyleSheet.create({
     header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingBottom: 22,
     },
     title: {
          flex: 1,
          textAlign: "center",
          fontSize: 15,
          fontFamily: JournalType.medium,
          color: Finn.ink,
     },
     leadingTitle: {
          textAlign: "left",
          fontFamily: JournalType.bold,
          fontSize: 18,
          letterSpacing: -0.25,
     },
     leadingActions: {
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "flex-end",
     },
     headerSide: { width: 76, alignItems: "flex-start" },
     headerSideRight: { alignItems: "flex-end" },
     body: { paddingHorizontal: 22 },
     section: {
          fontSize: 12,
          color: Finn.secondary,
          marginTop: 25,
          marginBottom: 10,
          paddingLeft: 3,
     },
     footer: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 18,
          backgroundColor: Finn.canvas,
     },
});
