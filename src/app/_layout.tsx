import {
     Stack,
     DefaultTheme,
     ThemeProvider,
     useNavigationContainerRef,
} from "expo-router";
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { ContentFade } from "@/components/ui/motion";
import { AppProviders } from "@/providers/app-providers";
import { Finn } from "@/constants/theme";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { QuotaReachedModalHost } from "@/features/support/components/quota-reached-modal";
import { ToastProvider } from "@/components/ui/toast-provider";
import { GuidanceToastHost } from "@/features/guidance/components/guidance-toast-host";
import { NotificationPermissionHost } from "@/features/notifications/components/notification-permission-host";
import { ErrorRecoveryScreen } from "@/features/support/components/error-recovery-screen";
import { SentryUserContext } from "@/lib/observability/sentry-user-context";
import { sentryNavigationIntegration } from "@/lib/observability/sentry";
import {
     AnalyticsProvider,
     AnalyticsRuntime,
} from "@/lib/analytics/analytics-provider";
import {
     SessionProvider,
     useSession,
} from "@/features/auth/providers/session-provider";
import {
     SubscriptionProvider,
     useSubscription,
} from "@/features/paywall/providers/subscription-provider";

void SplashScreen.preventAutoHideAsync();

function RootLayout() {
     return (
          <GestureHandlerRootView style={{ flex: 1 }}>
               <KeyboardProvider>
                    <SafeAreaProvider>
                         <ToastProvider>
                              <Sentry.ErrorBoundary
                                   fallback={({ eventId, resetError }) => (
                                        <ErrorRecoveryScreen
                                             eventId={eventId}
                                             onRetry={resetError}
                                        />
                                   )}
                                   beforeCapture={(scope) => {
                                        scope.setTag(
                                             "surface",
                                             "global_error_boundary",
                                        );
                                   }}
                              >
                                   <AnalyticsProvider>
                                        <RootApplication />
                                   </AnalyticsProvider>
                              </Sentry.ErrorBoundary>
                         </ToastProvider>
                    </SafeAreaProvider>
               </KeyboardProvider>
          </GestureHandlerRootView>
     );
}

function RootApplication() {
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
     if (fontError) throw fontError;
     if (!fontsLoaded) return null;
     return (
          <SessionProvider>
               <SentryUserContext />
               <SubscriptionProvider>
                    <AppProviders>
                         <AnalyticsRuntime />
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
                              <GuidanceToastHost />
                              <NotificationPermissionHost />
                         </ThemeProvider>
                    </AppProviders>
               </SubscriptionProvider>
          </SessionProvider>
     );
}

function RootNavigator({ reduced }: { reduced: boolean }) {
     const { session, loading, onboardingComplete } = useSession();
     const subscription = useSubscription();
     const navigationRef = useNavigationContainerRef();
     const booting =
          loading ||
          (!!session &&
               (subscription.state === "signed-out" ||
                    subscription.state === "loading"));

     useEffect(() => {
          sentryNavigationIntegration.registerNavigationContainer(navigationRef);
     }, [navigationRef]);

     useEffect(() => {
          if (!booting) {
               SplashScreen.hide();
          }
     }, [booting]);

     if (booting) return null;

     const authenticated = onboardingComplete && !!session;
     const premiumAccess = authenticated && subscription.isActive;

     return (
          <ContentFade style={{ flex: 1 }}>
               <Stack
                    ref={navigationRef}
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
                    <Stack.Protected guard={authenticated && !subscription.isActive}>
                         <Stack.Screen
                              name="paywall"
                              options={{
                                   gestureEnabled: false,
                                   animation: reduced ? "fade" : "default",
                              }}
                         />
                    </Stack.Protected>
                    <Stack.Protected guard={authenticated}>
                         <Stack.Screen
                              name="settings/index"
                              options={{
                                   presentation: "formSheet",
                                   sheetAllowedDetents: [0.92, 1],
                                   sheetGrabberVisible: true,
                                   sheetCornerRadius: 30,
                              }}
                         />
                    </Stack.Protected>
                    <Stack.Protected guard={premiumAccess}>
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

export default Sentry.wrap(RootLayout);
