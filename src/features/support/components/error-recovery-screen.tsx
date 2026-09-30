import { useEffect, useState } from "react";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAppToast } from "@/components/ui/toast-provider";
import { Finn } from "@/constants/theme";
import {
  isSentryEnabled,
  recordOperation,
  Sentry,
} from "@/lib/observability/sentry";
import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";
import { sendErrorSupportEmail } from "../services/quota-support";

type ErrorRecoveryScreenProps = {
  eventId?: string;
  onRetry: () => void;
};

const recoveryFont = Platform.select({
  ios: "System",
  android: "sans-serif",
  web: "system-ui",
});

export function ErrorRecoveryScreen({
  eventId,
  onRetry,
}: ErrorRecoveryScreenProps) {
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showToast } = useAppToast();
  const artworkWidth = Math.min(280, Math.max(210, width - 88));

  useEffect(() => {
    void SplashScreen.hideAsync();
    captureAnalytics(ANALYTICS_EVENTS.errorRecoveryShown, {
      associated_with_error: !!eventId,
    });
  }, [eventId]);

  const raiseComplaint = async () => {
    if (reported || reporting) return;
    setReporting(true);
    const associatedEventId = eventId || Sentry.lastEventId();

    if (isSentryEnabled && associatedEventId) {
      Sentry.captureFeedback(
        {
          message: "The user raised a complaint from Finn’s recovery screen.",
          source: "finn_error_recovery",
          associatedEventId,
          tags: {
            feedback_kind: "recovery_complaint",
            surface: "global_error_boundary",
          },
        },
        { includeReplay: true },
      );
    }

    try {
      await sendErrorSupportEmail(associatedEventId);
      recordOperation("error_recovery.complaint", "succeeded", {
        associatedWithError: !!associatedEventId,
        sentryEnabled: isSentryEnabled,
      });
      captureAnalytics(ANALYTICS_EVENTS.errorComplaintSubmitted, {
        associated_with_error: !!associatedEventId,
      });
      setReported(true);
      showToast({
        id: `error-recovery-feedback:${associatedEventId ?? "local"}`,
        message: "Thanks for the heads-up.",
        highlighted: "Support has been emailed with the technical reference.",
        state: "info",
        durationMs: 7_000,
      });
    } catch {
      recordOperation("error_recovery.complaint", "failed", {
        associatedWithError: !!associatedEventId,
        sentryEnabled: isSentryEnabled,
      });
      showToast({
        id: `error-recovery-feedback-failed:${associatedEventId ?? "local"}`,
        message: "Couldn’t email support.",
        highlighted: "Check your connection, then try again.",
        state: "error",
        durationMs: 7_000,
      });
    } finally {
      setReporting(false);
    }
  };

  const retry = () => {
    recordOperation("error_recovery.retry", "started");
    captureAnalytics(ANALYTICS_EVENTS.errorRecoveryAttempted);
    onRetry();
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 24, 40),
            paddingBottom: Math.max(insets.bottom + 28, 40),
          },
        ]}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.artworkStage}
        >
          <View style={styles.greenWash} />
          <Image
            source={require("@/assets/images/character/error/recovery.webp")}
            contentFit="contain"
            style={{
              width: artworkWidth,
              height: artworkWidth * (1322 / 1190),
            }}
          />
        </View>

        <Text style={styles.eyebrow}>A tiny detour</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Finn’s patching things up.
        </Text>
        <Text style={styles.body}>
          Your journal is safe. The useful technical details are already with
          us, so you can try again without explaining everything.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Try again"
            onPress={retry}
            style={styles.primaryButton}
          >
            <View style={styles.buttonRow}>
              <Icon name="refresh" size={17} color={Finn.surface} />
              <Text style={styles.primaryButtonText}>Try again</Text>
            </View>
          </Button>
          <Button
            label={reported ? "Complaint raised" : "Raise a complaint"}
            disabled={reported || reporting}
            onPress={() => void raiseComplaint()}
            style={styles.secondaryButton}
          >
            <View style={styles.buttonRow}>
              <Icon
                name={reported ? "check" : "note"}
                size={16}
                color={Finn.primary}
                animation={false}
              />
              <Text style={styles.secondaryButtonText}>
                {reported
                  ? "Complaint raised"
                  : reporting
                    ? "Sending complaint…"
                    : "Raise a complaint"}
              </Text>
            </View>
          </Button>
        </View>

        <View style={styles.privacyNote}>
          <View style={styles.privacyDot} />
          <Text style={styles.privacyText}>
            The complaint contains technical details, not your journal text.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  artworkStage: {
    width: "100%",
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  greenWash: {
    position: "absolute",
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: Finn.primarySoft,
  },
  eyebrow: {
    marginBottom: 9,
    color: Finn.primary,
    fontFamily: recoveryFont,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1.4,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  title: {
    maxWidth: 360,
    color: Finn.ink,
    fontFamily: recoveryFont,
    fontWeight: "900",
    fontSize: 31,
    lineHeight: 36,
    textAlign: "center",
  },
  body: {
    maxWidth: 350,
    marginTop: 12,
    color: Finn.secondary,
    fontFamily: recoveryFont,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    maxWidth: 350,
    gap: 10,
    marginTop: 28,
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 17,
    backgroundColor: Finn.primary,
  },
  secondaryButton: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#CFEFDC",
    borderRadius: 17,
    backgroundColor: Finn.surface,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: Finn.surface,
    fontFamily: recoveryFont,
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButtonText: {
    color: Finn.primary,
    fontFamily: recoveryFont,
    fontWeight: "700",
    fontSize: 15,
  },
  privacyNote: {
    maxWidth: 330,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 12,
  },
  privacyDot: {
    width: 6,
    height: 6,
    marginTop: 7,
    borderRadius: 3,
    backgroundColor: Finn.primary,
  },
  privacyText: {
    flex: 1,
    color: Finn.muted,
    fontFamily: recoveryFont,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "left",
  },
});
