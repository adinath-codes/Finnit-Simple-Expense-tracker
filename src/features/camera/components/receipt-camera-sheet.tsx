import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { Motion } from "@/constants/motion";
import { ContentFade } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { ReceiptCapture } from "../types/receipt.types";
import { ReceiptReview } from "./receipt-review";
import { pickReceiptFromGallery } from "../services/receipt-service";
import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";

export type CameraOrigin = { x: number; y: number; width: number; height: number };

export function ReceiptCameraSheet({
  visible,
  onClose,
  onUsePhoto,
  origin = null,
  onDismissed,
}: {
  visible: boolean;
  origin?: CameraOrigin | null;
  onDismissed?: () => void;
  onClose: () => void;
  onUsePhoto: (photo: ReceiptCapture) => void;
}) {
  const camera = useRef<CameraView>(null);
  const captureBusy = useRef(false);
  const captureSession = useRef(0);
  const wasVisible = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    captureSession.current += 1;
    captureBusy.current = false;
  }, [visible]);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      captureAnalytics(ANALYTICS_EVENTS.receiptCaptureStarted, {
        permission_state: permission?.granted
          ? "granted"
          : permission?.canAskAgain === false
          ? "blocked"
          : "requestable",
      });
    }
    wasVisible.current = visible;
  }, [permission?.canAskAgain, permission?.granted, visible]);
  const [facing, setFacing] = useState<CameraType>("back");
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ReceiptCapture | null>(null);
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const [present, setPresent] = useState(visible);
  const [laidOut, setLaidOut] = useState(false);
  const surface = useRef<View>(null);
  const progress = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const isVisible = useRef(visible);
  const dismissed = useRef(onDismissed);
  isVisible.current = visible;
  dismissed.current = onDismissed;
  const finishDismissal = useCallback(() => {
    if (isVisible.current) return;
    setPresent(false);
    setLaidOut(false);
    dismissed.current?.();
  }, []);
  useEffect(() => {
    cancelAnimation(progress);
    if (visible) {
      if (!present) { originX.set(0); originY.set(0); }
      setPresent(true);
      if (laidOut) progress.set(withTiming(1, { duration: reduced ? Motion.fade : Motion.panelEnter, easing: Motion.easeOut }));
    } else if (present) {
      progress.set(withTiming(0, { duration: reduced ? Motion.fade : Motion.panelExit, easing: Motion.easeOut }, (finished) => {
        if (finished) scheduleOnRN(finishDismissal);
      }));
    }
    return () => cancelAnimation(progress);
  }, [visible, laidOut, present, reduced, progress, originX, originY, finishDismissal]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      { translateX: reduced ? 0 : (1 - progress.get()) * originX.get() },
      { translateY: reduced ? 0 : (1 - progress.get()) * originY.get() },
      { scale: reduced ? 1 : 0.95 + progress.get() * 0.05 },
    ],
  }));
  const { height, width } = useWindowDimensions();
  const surfaceHeight = Math.min(Math.max(height * 0.54, 370), 560);
  const surfaceWidth = Math.min(width - 28, 470);

  useEffect(() => {
    if (!present) {
      setCameraReady(false);
      setCapturing(false);
      setRequestingPermission(false);
      setError(null);
      setPhoto(null);
      setTorch(false);
      setFacing("back");
    }
  }, [present]);

  if (!present) return null;

  const close = () => {
    if (!isVisible.current) return;
    captureAnalytics(ANALYTICS_EVENTS.receiptCaptureCancelled, {
      stage: photo ? "review" : "camera",
    });
    onClose();
  };
  const takePhoto = async () => {
    if (!isVisible.current || !camera.current || !cameraReady || captureBusy.current) return;
    const session = captureSession.current;
    captureBusy.current = true;
    setCapturing(true);
    setError(null);
    try {
      const result = await camera.current.takePictureAsync({
        exif: false,
        quality: 0.86,
        shutterSound: true,
      });
      if (!isVisible.current || session !== captureSession.current) return;
      setPhoto({
        uri: result.uri,
        width: result.width,
        height: result.height,
      });
      captureAnalytics(ANALYTICS_EVENTS.receiptImageSelected, {
        source: "camera",
      });
    } catch {
      if (isVisible.current && session === captureSession.current) setError("The photo did not save. Please try again.");
    } finally {
      if (session === captureSession.current) { captureBusy.current = false; setCapturing(false); }
    }
  };
  const askAgain = async () => {
    setRequestingPermission(true);
    setError(null);
    try {
      await requestPermission();
    } catch {
      setError("Finn could not request camera access.");
    } finally {
      setRequestingPermission(false);
    }
  };
  const pickFromGallery = async () => {
    setError(null);
    try {
      const selected = await pickReceiptFromGallery();
      if (selected && isVisible.current) {
        setPhoto(selected);
        captureAnalytics(ANALYTICS_EVENTS.receiptImageSelected, {
          source: "gallery",
        });
      }
    } catch {
      setError("Finn could not open that photo. Please try another image.");
    }
  };

  return (
    <Modal
      animationType="none"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible
    >
      <View
        accessibilityViewIsModal
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
        pointerEvents={visible ? "auto" : "none"}
        style={[
          styles.backdrop,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(39, 28, 24, 0.18)" }, backdropStyle]} />
        <Pressable
          accessibilityLabel="Close camera"
          accessibilityRole="button"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          ref={surface}
          onLayout={() => {
            surface.current?.measureInWindow((x, y, width, height) => {
              // Scaling around the center preserves this measured center; translation starts at zero.
              if (!laidOut) {
                originX.set(origin ? origin.x + origin.width / 2 - (x + width / 2) : 0);
                originY.set(origin ? origin.y + origin.height / 2 - (y + height / 2) : 16);
                setLaidOut(true);
              }
            });
          }}
          style={[
            styles.surface,
            { height: surfaceHeight, width: surfaceWidth },
            surfaceStyle,
          ]}
        >
          <View style={styles.surfaceClip}>
            <ContentFade
              key={photo?.uri ?? (permission?.granted ? "camera" : "permission")}
              style={{ flex: 1 }}
            >
              {photo ? (
                <ReceiptReview
                  photo={photo}
                  onClose={close}
                  onRetake={() => {
                    setPhoto(null);
                    setCameraReady(false);
                  }}
                  onUsePhoto={() => {
                    captureAnalytics(ANALYTICS_EVENTS.receiptSubmitted, {
                      source: "image",
                    });
                    onUsePhoto(photo);
                  }}
                />
              ) : permission?.granted ? (
                <View style={styles.cameraStage}>
                  <CameraView
                    active={visible}
                    animateShutter
                    enableTorch={torch}
                    facing={facing}
                    mode="picture"
                    onCameraReady={() => setCameraReady(true)}
                    onMountError={(event) => setError(event.message)}
                    ref={camera}
                    responsiveOrientationWhenOrientationLocked
                    style={[StyleSheet.absoluteFill, styles.cameraPreview]}
                  />
                  {!cameraReady && (
                    <View style={styles.startingCamera}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.startingText}>Starting camera…</Text>
                    </View>
                  )}
                  {!!error && (
                    <View accessibilityLiveRegion="polite" style={styles.errorPill}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}
                  <CameraControls
                    cameraReady={cameraReady}
                    capturing={capturing}
                    facing={facing}
                    torch={torch}
                    onCapture={() => void takePhoto()}
                    onClose={close}
                    onFlip={() => {
                      setCameraReady(false);
                      setTorch(false);
                      setFacing((current) =>
                        current === "back" ? "front" : "back",
                      );
                    }}
                    onGallery={() => void pickFromGallery()}
                    onToggleTorch={() => setTorch((current) => !current)}
                  />
                </View>
              ) : (
                <PermissionState
                  canAskAgain={permission?.canAskAgain ?? true}
                  error={error}
                  loading={!permission || requestingPermission}
                  onAllow={() => void askAgain()}
                  onClose={close}
                  onGallery={() => void pickFromGallery()}
                />
              )}
            </ContentFade>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PermissionState({
  canAskAgain,
  error,
  loading,
  onAllow,
  onClose,
  onGallery,
}: {
  canAskAgain: boolean;
  error: string | null;
  loading: boolean;
  onAllow: () => void;
  onClose: () => void;
  onGallery: () => void;
}) {
  return (
    <View style={styles.permissionState}>
      <View style={styles.permissionIcon}>
        {loading ? (
          <ActivityIndicator color={Finn.primary} size="small" />
        ) : (
          <Icon name="camera" color={Finn.primary} size={28} />
        )}
      </View>
      <Text style={styles.permissionTitle}>
        {loading ? "Opening camera…" : "Camera access needed"}
      </Text>
      <Text style={styles.permissionBody}>
        {loading
          ? "Finn is checking camera permission."
          : canAskAgain
            ? "Photograph a receipt without leaving your journal. Finn only uses the camera while this panel is open."
            : "Camera access is blocked. Android requires you to enable it in Settings before Finn can show the camera."}
      </Text>
      {!!error && <Text style={styles.permissionError}>{error}</Text>}
      {!loading && (
        <Button
          label={canAskAgain ? "Allow camera access" : "Open camera settings"}
          onPress={
            canAskAgain
              ? onAllow
              : () => {
                  if (Platform.OS === "web") onAllow();
                  else void Linking.openSettings();
                }
          }
          style={styles.permissionAction}
        >
          <Text style={styles.permissionActionText}>
            {canAskAgain ? "Allow access" : "Open settings"}
          </Text>
        </Button>
      )}
      <Button label="Choose a receipt from photos" onPress={onGallery} style={styles.notNow}>
        <Text style={styles.notNowText}>Choose from photos</Text>
      </Button>
      <Button label="Close camera" onPress={onClose} style={styles.notNow}>
        <Text style={styles.notNowText}>Not now</Text>
      </Button>
    </View>
  );
}

function CameraControls({
  cameraReady,
  capturing,
  facing,
  torch,
  onCapture,
  onClose,
  onFlip,
  onGallery,
  onToggleTorch,
}: {
  cameraReady: boolean;
  capturing: boolean;
  facing: CameraType;
  torch: boolean;
  onCapture: () => void;
  onClose: () => void;
  onFlip: () => void;
  onGallery: () => void;
  onToggleTorch: () => void;
}) {
  return (
    <>
      <View style={styles.leftControls}>
        <RoundControl icon="back" label="Close camera" onPress={onClose} />
        <RoundControl icon="gallery" label="Choose receipt from photos" onPress={onGallery} />
      </View>
      <View pointerEvents="box-none" style={styles.shutterSlot}>
        <Button
          disabled={!cameraReady || capturing}
          label={capturing ? "Taking receipt photo" : "Take receipt photo"}
          onPress={onCapture}
          style={styles.shutterOuter}
        >
          <View style={[styles.shutterInner, capturing && styles.shutterBusy]}>
            <Svg width={29} height={29} viewBox="0 0 28 28" accessible={false}>
              <Path
                d="M8 7.5 9.5 5h9L20 7.5h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h2Z"
                fill="none"
                stroke="#171717"
                strokeLinejoin="round"
                strokeWidth={1.8}
              />
              <Circle cx={14} cy={15} r={4.1} fill="none" stroke="#171717" strokeWidth={1.8} />
            </Svg>
          </View>
        </Button>
      </View>
      <View style={styles.rightControls}>
        {facing === "back" && (
          <RoundControl
            icon={torch ? "flashOff" : "flash"}
            label={torch ? "Turn torch off" : "Turn torch on"}
            onPress={onToggleTorch}
          />
        )}
        <RoundControl
          icon="flipCamera"
          label="Flip camera"
          onPress={onFlip}
        />
      </View>
    </>
  );
}

function RoundControl({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button label={label} onPress={onPress} style={styles.roundControl}>
      <Icon name={icon} color="#FFFFFF" size={23} />
    </Button>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
  },
  surface: {
    borderRadius: 32,
    boxShadow: "0px 18px 44px rgba(20, 12, 10, 0.34)",
    maxWidth: "100%",
  },
  surfaceClip: {
    backgroundColor: "#151515",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden",
  },
  cameraStage: {
    backgroundColor: "#111111",
    borderRadius: 32,
    flex: 1,
    overflow: "hidden",
  },
  cameraPreview: {
    backgroundColor: "transparent",
    borderRadius: 32,
    overflow: "hidden",
  },
  startingCamera: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    alignItems: "center",
    backgroundColor: "#171717",
    gap: 10,
    justifyContent: "center",
  },
  startingText: {
    color: "rgba(255, 255, 255, 0.82)",
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  errorPill: {
    alignSelf: "center",
    backgroundColor: "rgba(32, 25, 25, 0.82)",
    borderRadius: 17,
    maxWidth: "78%",
    paddingHorizontal: 13,
    paddingVertical: 8,
    position: "absolute",
    top: 18,
  },
  errorText: {
    color: "#FFE5E5",
    fontFamily: JournalType.medium,
    fontSize: 12,
    textAlign: "center",
  },
  leftControls: {
    bottom: 22,
    gap: 10,
    left: 20,
    position: "absolute",
  },
  rightControls: {
    bottom: 22,
    gap: 10,
    position: "absolute",
    right: 20,
  },
  roundControl: {
    backgroundColor: "rgba(22, 22, 22, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 25,
    borderWidth: 1,
    height: 50,
    minHeight: 50,
    width: 50,
  },
  shutterSlot: {
    alignItems: "center",
    bottom: 20,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 2,
  },
  shutterOuter: {
    backgroundColor: "rgba(20, 20, 20, 0.76)",
    borderColor: "rgba(255, 255, 255, 0.26)",
    borderRadius: 45,
    borderWidth: 1,
    height: 88,
    minHeight: 88,
    width: 88,
  },
  shutterInner: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  shutterBusy: {
    opacity: 0.58,
    transform: [{ scale: 0.9 }],
  },
  permissionState: {
    alignItems: "center",
    backgroundColor: Finn.canvas,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  permissionIcon: {
    alignItems: "center",
    backgroundColor: Finn.primarySoft,
    borderRadius: 29,
    height: 58,
    justifyContent: "center",
    marginBottom: 18,
    width: 58,
  },
  permissionTitle: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 21,
    letterSpacing: -0.4,
    lineHeight: 26,
    textAlign: "center",
  },
  permissionBody: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
    maxWidth: 310,
    textAlign: "center",
  },
  permissionError: {
    color: Finn.danger,
    fontFamily: JournalType.medium,
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
  },
  permissionAction: {
    backgroundColor: Finn.primary,
    borderRadius: 23,
    marginTop: 22,
    minHeight: 46,
    paddingHorizontal: 22,
  },
  permissionActionText: {
    color: "#FFFFFF",
    fontFamily: JournalType.bold,
    fontSize: 14,
  },
  notNow: {
    marginTop: 4,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  notNowText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
});
