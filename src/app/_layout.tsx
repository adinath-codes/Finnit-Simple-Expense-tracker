import { Stack, DefaultTheme, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { LoadingState } from "@/components/common/loading-state";
import { ContentFade } from "@/components/ui/motion";
import { AppProviders } from "@/providers/app-providers";
import { Finn } from "@/constants/theme";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { QuotaReachedModalHost } from "@/features/support/components/quota-reached-modal";
import {
     SessionProvider,
     useSession,
} from "@/features/auth/providers/session-provider";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
     const reduced = useMotionPreference();
     const [fontsLoaded, fontError] = useFonts(
          Platform.OS === "ios"
               ? {}
               : {
                      "SFProDisplay-Regular": require("../../assets/sf-pro-display/SFPRODISPLAYREGULAR.OTF"),
                      "SFProDisplay-Medium": require("../../assets/sf-pro-display/SFPRODISPLAYMEDIUM.OTF"),
                      "SFProDisplay-Bold": require("../../assets/sf-pro-display/SFPRODISPLAYBOLD.OTF"),
                      "SFProDisplay-Black": require("../../assets/sf-pro-display/SF-Pro-Display-Black.otf"),
                 },
     );
     useEffect(() => {
          if (fontsLoaded || fontError) void SplashScreen.hideAsync();
     }, [fontsLoaded, fontError]);
     if (fontError) throw fontError;
     if (!fontsLoaded) return null;
     return (
          <GestureHandlerRootView style={{ flex: 1 }}>
               <KeyboardProvider>
               <SafeAreaProvider>
                    <SessionProvider>
                         <AppProviders>
                              <ThemeProvider
                                   value={{
                                        ...DefaultTheme,
                                        colors: {
                                             ...DefaultTheme.colors,
                                             background: Finn.canvas,
                                        },
                                   }}
                              >
                                   <StatusBar style="dark" />
                                   <RootNavigator reduced={reduced} />
                                   <QuotaReachedModalHost />
                              </ThemeProvider>
                         </AppProviders>
                    </SessionProvider>
               </SafeAreaProvider>
               </KeyboardProvider>
          </GestureHandlerRootView>
     );
}

function RootNavigator({ reduced }: { reduced: boolean }) {
     const { session, loading, onboardingComplete } = useSession();
     if (loading) return <LoadingState label="Opening Finn…" />;

     return (
          <ContentFade style={{ flex: 1 }}>
               <Stack
                    screenOptions={{
                         headerShown: false,
                         contentStyle: { backgroundColor: Finn.canvas },
                         animation: reduced ? "fade" : "default",
                    }}
               >
                    <Stack.Protected guard={!onboardingComplete}>
                         <Stack.Screen
                              name="onboarding/index"
                              options={{
                                   gestureEnabled: false,
                                   animation: reduced ? "fade" : "default",
                              }}
                         />
                    </Stack.Protected>
                    <Stack.Protected guard={onboardingComplete && !session}>
                         <Stack.Screen
                              name="(auth)/sign-in"
                              options={{
                                   gestureEnabled: false,
                                   animation: reduced ? "fade" : "default",
                              }}
                         />
                    </Stack.Protected>
                    <Stack.Protected guard={onboardingComplete}>
                         <Stack.Screen name="auth/callback" />
                         <Stack.Screen name="(auth)/reset-password" />
                         <Stack.Screen
                              name="legal/privacy"
                              options={{
                                   presentation: "formSheet",
                                   sheetAllowedDetents: [0.92, 1],
                                   sheetGrabberVisible: true,
                                   sheetCornerRadius: 30,
                              }}
                         />
                         <Stack.Screen
                              name="legal/terms"
                              options={{
                                   presentation: "formSheet",
                                   sheetAllowedDetents: [0.92, 1],
                                   sheetGrabberVisible: true,
                                   sheetCornerRadius: 30,
                              }}
                         />
                    </Stack.Protected>
                    <Stack.Protected guard={onboardingComplete && !!session}>
                         <Stack.Screen name="index" />
                         <Stack.Screen name="search" />
                         <Stack.Screen
                              name="quick-add"
                              options={{
                                   animation: reduced
                                        ? "fade"
                                        : "slide_from_bottom",
                              }}
                         />
                         <Stack.Screen
                              name="entries/[entryId]"
                              options={{
                                   presentation: "formSheet",
                                   sheetAllowedDetents: [0.92, 1],
                                   sheetGrabberVisible: true,
                                   sheetCornerRadius: 30,
                              }}
                         />
                         <Stack.Screen
                              name="settings/index"
                              options={{
                                   presentation: "formSheet",
                                   sheetAllowedDetents: [0.92, 1],
                                   sheetGrabberVisible: true,
                                   sheetCornerRadius: 30,
                              }}
                         />
                         <Stack.Screen
                              name="settings/presets"
                              options={{
                                   presentation: "formSheet",
                                   sheetAllowedDetents: [0.85, 1],
                                   sheetGrabberVisible: true,
                                   sheetCornerRadius: 30,
                              }}
                         />
                         <Stack.Screen
                              name="calendar"
                              options={{
                                   presentation: "formSheet",
                                   sheetAllowedDetents: [0.7, 1],
                                   sheetGrabberVisible: true,
                                   sheetCornerRadius: 30,
                              }}
                         />
                    </Stack.Protected>
               </Stack>
          </ContentFade>
     );
}
