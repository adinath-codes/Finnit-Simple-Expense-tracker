import { StyleSheet, Text, View } from "react-native";
import { AppSheet } from "@/components/sheets/app-sheet";
import { Finn, JournalType } from "@/constants/theme";

type Section = { heading: string; paragraphs: string[] };

export function LegalDocumentScreen({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: Section[];
}) {
  return (
    <AppSheet title={title} bodyStyle={styles.body}>
      <Text style={styles.effective}>Effective {effectiveDate}</Text>
      <Text style={styles.intro}>{intro}</Text>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
          ))}
        </View>
      ))}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 18 },
  effective: { fontFamily: JournalType.medium, fontSize: 12, color: Finn.primary, marginBottom: 13 },
  intro: { fontFamily: JournalType.regular, fontSize: 16, lineHeight: 24, color: Finn.ink, marginBottom: 22 },
  section: { marginBottom: 23 },
  heading: { fontFamily: JournalType.bold, fontSize: 17, lineHeight: 23, color: Finn.ink, marginBottom: 8 },
  paragraph: { fontFamily: JournalType.regular, fontSize: 14, lineHeight: 22, color: "#676260", marginBottom: 10 },
});
