import { Stack, DefaultTheme, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { AppProviders } from "@/providers/app-providers";
import { Finn } from "@/constants/theme";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const reduced = useReducedMotion();
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === "ios" ? {} : {
      "SFProDisplay-Regular": require("../../assets/sf-pro-display/SFPRODISPLAYREGULAR.OTF"),
      "SFProDisplay-Medium": require("../../assets/sf-pro-display/SFPRODISPLAYMEDIUM.OTF"),
      "SFProDisplay-Bold": require("../../assets/sf-pro-display/SFPRODISPLAYBOLD.OTF"),
    },
  );
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <ThemeProvider
            value={{
              ...DefaultTheme,
              colors: { ...DefaultTheme.colors, background: Finn.canvas },
            }}
          >
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Finn.canvas },
                animation: reduced ? "fade" : "default",
              }}
            >
              <Stack.Screen name="index" />
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
            </Stack>
          </ThemeProvider>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
