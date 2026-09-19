import { useEffect, useRef, useState } from "react";
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
import { useReducedMotion } from "react-native-reanimated";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { ReceiptCapture } from "../types/receipt.types";
import { ReceiptReview } from "./receipt-review";

export function ReceiptCameraSheet({
  visible,
  onClose,
  onUsePhoto,
}: {
  visible: boolean;
  onClose: () => void;
  onUsePhoto: (photo: ReceiptCapture) => void;
}) {
  const camera = useRef<CameraView>(null);
  const autoRequestStarted = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ReceiptCapture | null>(null);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const surfaceHeight = Math.min(Math.max(height * 0.54, 370), 560);
  const surfaceWidth = Math.min(width - 28, 470);

  useEffect(() => {
    if (!visible) {
      autoRequestStarted.current = false;
      setCameraReady(false);
      setCapturing(false);
      setRequestingPermission(false);
      setError(null);
      setPhoto(null);
      setTorch(false);
      setFacing("back");
      return;
    }

    if (
      !permission ||
      permission.granted ||
      !permission.canAskAgain ||
      autoRequestStarted.current
    ) {
      return;
    }

    autoRequestStarted.current = true;
    setRequestingPermission(true);
    void requestPermission()
      .catch(() => {
        setError("Finn could not request camera access.");
      })
      .finally(() => setRequestingPermission(false));
  }, [permission, requestPermission, visible]);

  if (!visible) return null;

  const close = () => {
    setPhoto(null);
    onClose();
  };
  const takePhoto = async () => {
    if (!camera.current || !cameraReady || capturing) return;
    setCapturing(true);
    setError(null);
    try {
      const result = await camera.current.takePictureAsync({
        exif: false,
        quality: 0.86,
        shutterSound: true,
      });
      setPhoto({
        uri: result.uri,
        width: result.width,
        height: result.height,
      });
    } catch {
      setError("The photo did not save. Please try again.");
    } finally {
      setCapturing(false);
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

  return (
    <Modal
      animationType={reduced ? "none" : "fade"}
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible
    >
      <View
        accessibilityViewIsModal
        style={[
          styles.backdrop,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          accessibilityLabel="Close camera"
          accessibilityRole="button"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.surface,
            { height: surfaceHeight, width: surfaceWidth },
          ]}
        >
          {photo ? (
            <ReceiptReview
              photo={photo}
              onClose={close}
              onRetake={() => {
                setPhoto(null);
                setCameraReady(false);
              }}
              onUsePhoto={() => onUsePhoto(photo)}
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
                style={StyleSheet.absoluteFill}
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
            />
          )}
        </View>
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
}: {
  canAskAgain: boolean;
  error: string | null;
  loading: boolean;
  onAllow: () => void;
  onClose: () => void;
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
          : "Photograph a receipt without leaving your journal. Finn only uses the camera while this panel is open."}
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
            {canAskAgain ? "Allow camera" : "Open settings"}
          </Text>
        </Button>
      )}
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
  onToggleTorch,
}: {
  cameraReady: boolean;
  capturing: boolean;
  facing: CameraType;
  torch: boolean;
  onCapture: () => void;
  onClose: () => void;
  onFlip: () => void;
  onToggleTorch: () => void;
}) {
  return (
    <>
      <View style={styles.leftControls}>
        <RoundControl icon="back" label="Close camera" onPress={onClose} />
      </View>
      <Button
        disabled={!cameraReady || capturing}
        label={capturing ? "Taking receipt photo" : "Take receipt photo"}
        onPress={onCapture}
        style={styles.shutterOuter}
      >
        <View style={[styles.shutterInner, capturing && styles.shutterBusy]} />
      </Button>
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
    backgroundColor: "rgba(26, 20, 18, 0.28)",
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
  },
  surface: {
    backgroundColor: "#151515",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0px 18px 44px rgba(20, 12, 10, 0.34)",
    maxWidth: "100%",
    overflow: "hidden",
  },
  cameraStage: {
    backgroundColor: "#111111",
    flex: 1,
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
  shutterOuter: {
    alignSelf: "center",
    backgroundColor: "rgba(20, 20, 20, 0.76)",
    borderColor: "rgba(255, 255, 255, 0.26)",
    borderRadius: 45,
    borderWidth: 1,
    bottom: 20,
    height: 88,
    minHeight: 88,
    position: "absolute",
    width: 88,
  },
  shutterInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 34,
    height: 68,
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
