import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { ReceiptPhoto } from "@/types/domain";

export function ReceiptPreview({ receipt }: { receipt: ReceiptPhoto }) {
  return (
    <View style={styles.card}>
      <Image
        accessibilityLabel="Attached receipt photo"
        contentFit="cover"
        source={{ uri: receipt.uri }}
        style={styles.image}
      />
      <View style={styles.label}>
        <Icon name="camera" color={Finn.primary} size={14} />
        <Text style={styles.labelText}>Receipt photo</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Finn.surface,
    borderRadius: 22,
    marginBottom: 22,
    overflow: "hidden",
    ...Finn.shadow,
  },
  image: {
    height: 238,
    width: "100%",
  },
  label: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  labelText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
});
