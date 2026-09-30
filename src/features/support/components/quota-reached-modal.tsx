import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { subscribeAiQuotaReached } from "../services/quota-events";
import {
  requestQuotaReview,
} from "../services/quota-support";
import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";

export function QuotaReachedModalHost() {
  const [visible, setVisible] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [contacted, setContacted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  useEffect(
    () =>
      subscribeAiQuotaReached(() => {
        setNotice(null);
        setContacted(false);
        setVisible(true);
      }),
    [],
  );

  const close = () => {
    if (!contacting) setVisible(false);
  };

  const contactSupport = async () => {
    if (contacting) return;
    setContacting(true);
    setNotice(null);
    try {
      await requestQuotaReview();
      captureAnalytics(ANALYTICS_EVENTS.quotaReviewRequested);
      setContacted(true);
      setNotice("Support has been emailed. We’ll review the account activity.");
    } catch {
      setNotice("We couldn’t contact support. Please try again when you’re connected.");
    } finally {
      setContacting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close usage notice"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.iconWrap}>
            <Icon name="sparkle" size={22} color={Finn.primary} animation={false} />
          </View>
          <Text style={styles.title}>Let’s check your activity</Text>
          <Text style={styles.body}>
            It looks like your account has processed more items than usual. This
            can happen after a typo or a repeated sync. Your journal is safe.
          </Text>
          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice}
            </Text>
          )}
          <Button
            label="Contact support"
            disabled={contacting || contacted}
            onPress={() => void contactSupport()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {contacting
                ? "Contacting support…"
                : contacted
                  ? "Support contacted"
                  : "Contact support"}
            </Text>
          </Button>
          <Button label="Maybe later" disabled={contacting} onPress={close}>
            <Text style={styles.secondaryButtonText}>Maybe later</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    backgroundColor: "rgba(23, 23, 23, 0.24)",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 12,
    borderRadius: 28,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  iconWrap: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderRadius: 23,
    backgroundColor: Finn.primarySoft,
  },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 23,
    lineHeight: 28,
  },
  body: {
    marginTop: 9,
    marginBottom: 22,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  notice: {
    marginTop: -8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    color: Finn.ink,
    backgroundColor: Finn.primarySoft,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: Finn.primary,
  },
  primaryButtonText: {
    color: Finn.surface,
    fontFamily: JournalType.bold,
    fontSize: 16,
  },
  secondaryButtonText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 15,
  },
});
