import { type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { Finn, JournalPaper } from "@/constants/theme";
export function Screen({ children, journal = false }: PropsWithChildren<{ journal?: boolean }>) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, journal && JournalPaper]}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#EEE9E3", alignItems: "center" },
  inner: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: Finn.canvas,
    overflow: "hidden",
  },
});
