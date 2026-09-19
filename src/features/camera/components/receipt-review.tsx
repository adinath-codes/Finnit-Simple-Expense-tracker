import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { ReceiptCapture } from "../types/receipt.types";

export function ReceiptReview({
  photo,
  onClose,
  onRetake,
  onUsePhoto,
}: {
  photo: ReceiptCapture;
  onClose: () => void;
  onRetake: () => void;
  onUsePhoto: () => void;
}) {
  return (
    <View style={styles.container}>
      <Image
        accessibilityLabel="Captured receipt preview"
        contentFit="cover"
        source={{ uri: photo.uri }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topBar}>
        <View style={styles.readyPill}>
          <Icon name="check" color="#FFFFFF" size={14} />
          <Text style={styles.readyText}>Photo ready</Text>
        </View>
        <CameraControl
          icon="close"
          label="Close receipt preview"
          onPress={onClose}
        />
      </View>
      <View style={styles.bottomBar}>
        <CameraControl
          icon="refresh"
          label="Retake receipt photo"
          onPress={onRetake}
        />
        <Button
          accessibilityHint="Attaches this receipt to a new journal entry"
          label="Use receipt photo"
          onPress={onUsePhoto}
          style={styles.usePhoto}
        >
          <Text style={styles.usePhotoText}>Use photo</Text>
          <Icon name="check" color="#FFFFFF" size={18} />
        </Button>
      </View>
    </View>
  );
}

function CameraControl({
  icon,
  label,
  onPress,
}: {
  icon: "close" | "refresh";
  label: string;
  onPress: () => void;
}) {
  return (
    <Button label={label} onPress={onPress} style={styles.control}>
      <Icon name={icon} color="#FFFFFF" size={22} />
    </Button>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 18,
    position: "absolute",
    right: 18,
    top: 18,
  },
  readyPill: {
    alignItems: "center",
    backgroundColor: "rgba(21, 21, 21, 0.68)",
    borderRadius: 18,
    flexDirection: "row",
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 13,
  },
  readyText: {
    color: "#FFFFFF",
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  bottomBar: {
    alignItems: "center",
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 20,
    position: "absolute",
    right: 20,
  },
  control: {
    backgroundColor: "rgba(21, 21, 21, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 25,
    borderWidth: 1,
    height: 50,
    minHeight: 50,
    width: 50,
  },
  usePhoto: {
    backgroundColor: Finn.primary,
    borderRadius: 25,
    flexDirection: "row",
    gap: 9,
    minHeight: 50,
    paddingHorizontal: 19,
  },
  usePhotoText: {
    color: "#FFFFFF",
    fontFamily: JournalType.bold,
    fontSize: 14,
  },
});
