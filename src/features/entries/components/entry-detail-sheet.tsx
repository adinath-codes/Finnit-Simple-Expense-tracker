import { Fragment, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  AppSheet,
  SectionLabel,
  sheetStyles as shared,
  closeSheet,
} from "@/components/sheets/app-sheet";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import type { EntryItem } from "@/types/domain";
import { entryTotal } from "@/utils/amounts";
import { TransactionBreakdown } from "./transaction-breakdown";

const BANKNOTE_GREEN = "#20C878";

export default function EntryDetailSheet() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const { entries, updateEntry, savePreset, deleteEntry, settings } =
    useJournal();
  const entry = entries.find((item) => item.id === entryId);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry?.note ?? "");
  const [saved, setSaved] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!entry) {
    return (
      <AppSheet title="Entry details">
        <Text style={shared.text}>This entry is no longer here.</Text>
      </AppSheet>
    );
  }

  const total = entryTotal(entry);
  const saveEditedNote = () => {
    if (note.trim()) updateEntry({ ...entry, note: note.trim() });
    setEditing(false);
  };

  return (
    <AppSheet
      title="Entry Details"
      headerLayout="leading"
      headerScrollable
      bodyStyle={styles.body}
      right={
        <View style={styles.headerActions}>
          <IconButton
            name={editing ? "check" : "more"}
            label={editing ? "Save entry text" : "Entry actions"}
            onPress={() => {
              if (editing) saveEditedNote();
              else setActionsOpen((open) => !open);
            }}
          />
          <IconButton
            name="close"
            label="Close entry details"
            onPress={closeSheet}
          />
        </View>
      }
    >
      {actionsOpen && !editing && (
        <View style={[shared.card, styles.actionsMenu]}>
          <Button
            label="Edit original note"
            onPress={() => {
              setActionsOpen(false);
              setEditing(true);
            }}
            style={styles.actionRow}
          >
            <Icon name="edit" size={15} color={Finn.purple} />
            <Text style={styles.actionText}>Edit original note</Text>
          </Button>
          <View style={styles.actionDivider} />
          <Button
            label={saved ? "Entry saved as a shortcut" : "Save as a shortcut"}
            onPress={() => {
              savePreset({
                id: `saved-${entry.id}`,
                name: entry.note.split("\n")[0],
                note: entry.note,
                amountMinor: total,
                category: entry.category,
              });
              setSaved(true);
              setActionsOpen(false);
            }}
            style={styles.actionRow}
          >
            <Icon
              name={saved ? "check" : "bookmark"}
              size={15}
              color={Finn.purple}
            />
            <Text style={styles.actionText}>
              {saved ? "Saved" : "Save entry"}
            </Text>
          </Button>
          <View style={styles.actionDivider} />
          <Button
            label="Remove entry"
            onPress={() => {
              setActionsOpen(false);
              setDeleting(true);
            }}
            style={styles.actionRow}
          >
            <Icon name="trash" size={15} color={Finn.danger} />
            <Text style={[styles.actionText, { color: Finn.danger }]}>
              Remove entry
            </Text>
          </Button>
        </View>
      )}

      {editing ? (
        <TextInput
          accessibilityLabel="Edit original note"
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          style={[shared.input, styles.noteInput]}
        />
      ) : (
        <Text accessibilityRole="header" style={styles.title}>
          {entry.note}
        </Text>
      )}

      <View style={[shared.card, styles.amountCard]}>
        <AmountExpression items={entry.items} currency={settings.currency} />
      </View>

      <SectionLabel style={styles.sectionLabel}>Items</SectionLabel>
      <TransactionBreakdown entry={entry} onChange={updateEntry} />

      <SectionLabel style={styles.sectionLabel}>
        Finn’s thought process
      </SectionLabel>
      <View style={[shared.card, styles.thoughtCard]}>
        <View style={styles.confidence}>
          <View style={styles.confidenceRing}>
            <View style={styles.confidenceArc} />
            <Text style={styles.confidenceScore}>75</Text>
          </View>
          <View>
            <Text style={styles.confidenceLabel}>Confidence level</Text>
            <Text style={styles.confidenceTitle}>High</Text>
          </View>
        </View>
        <Text style={styles.thoughtText}>{entry.thought}</Text>
        <Button
          label="Edit original note"
          onPress={() => setEditing(true)}
          style={styles.correct}
        >
          <Icon name="edit" size={12} color={Finn.purple} />
          <Text style={styles.correctText}>Something off? Click to edit</Text>
        </Button>
      </View>

      <SectionLabel style={styles.sectionLabel}>References</SectionLabel>
      <View style={[shared.card, styles.referencesCard]}>
        <Button
          label="Toggle entry references"
          onPress={() => setSourcesOpen((open) => !open)}
          style={styles.referencesHeader}
        >
          <View style={styles.sourceIcons}>
            {entry.sources.map((source, index) => (
              <View
                key={source.title}
                style={[
                  styles.sourceIcon,
                  { backgroundColor: index ? "#EAF8EF" : "#FFF0D6" },
                ]}
              >
                <Icon
                  name={source.icon}
                  size={13}
                  color={index ? BANKNOTE_GREEN : Finn.amber}
                />
              </View>
            ))}
          </View>
          <Text style={styles.sourcesCount}>
            {entry.sources.length}{" "}
            {entry.sources.length === 1 ? "source" : "sources"}
          </Text>
          <Icon name="down" size={13} color={Finn.muted} />
        </Button>
        {sourcesOpen &&
          entry.sources.map((source) => (
            <View key={source.title} style={styles.source}>
              <Icon name={source.icon} size={17} color={Finn.amber} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle}>{source.title}</Text>
                <Text style={shared.subtle}>{source.detail}</Text>
              </View>
            </View>
          ))}
      </View>

      {deleting && (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteQuestion}>
            Remove this entry from your journal?
          </Text>
          <View style={styles.deleteActions}>
            <Button label="Cancel removal" onPress={() => setDeleting(false)}>
              <Text style={styles.cancelText}>Keep it</Text>
            </Button>
            <Button
              label="Confirm removal"
              onPress={() => {
                deleteEntry(entry.id);
                closeSheet();
              }}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Button>
          </View>
        </View>
      )}
    </AppSheet>
  );
}

function AmountExpression({
  items,
  currency,
}: {
  items: EntryItem[];
  currency: string;
}) {
  return (
    <Text
      accessibilityLabel="Item quantity times amount"
      style={styles.amountExpression}
    >
      {items.map((item, index) => {
        const { symbol, amount } = unitAmountParts(item.amountMinor, currency);
        return (
          <Fragment key={item.id}>
            {index > 0 && <Text style={styles.amountOperator}> + </Text>}
            <Text>{item.quantity} × </Text>
            <Text style={styles.currencySymbol}>{symbol}</Text>
            <Text>{amount}</Text>
          </Fragment>
        );
      })}
    </Text>
  );
}

function unitAmountParts(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 ? 2 : 0,
  });
  const parts = formatter.formatToParts(amountMinor / 100);
  return {
    symbol: parts.find((part) => part.type === "currency")?.value ?? currency,
    amount: parts
      .filter((part) => part.type !== "currency")
      .map((part) => part.value)
      .join("")
      .trim(),
  };
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  headerActions: { flexDirection: "row", gap: 8 },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    marginBottom: 22,
  },
  noteInput: {
    fontFamily: JournalType.medium,
    fontSize: 20,
    lineHeight: 28,
    marginBottom: 22,
  },
  amountCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 108,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  amountExpression: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 27,
    lineHeight: 35,
    letterSpacing: -0.65,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  amountOperator: { color: Finn.secondary },
  currencySymbol: { color: BANKNOTE_GREEN },
  sectionLabel: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 21,
    marginBottom: 10,
    marginTop: 22,
    paddingLeft: 0,
  },
  thoughtCard: { borderRadius: 18, padding: 16 },
  confidence: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    marginBottom: 12,
  },
  confidenceRing: {
    alignItems: "center",
    borderColor: "#D8DDD9",
    borderRadius: 26,
    borderWidth: 3,
    height: 52,
    justifyContent: "center",
    position: "relative",
    width: 52,
  },
  confidenceArc: {
    borderColor: BANKNOTE_GREEN,
    borderRadius: 26,
    borderRightColor: "transparent",
    borderWidth: 3,
    height: 52,
    left: -3,
    position: "absolute",
    top: -3,
    transform: [{ rotate: "-45deg" }],
    width: 52,
  },
  confidenceScore: {
    color: BANKNOTE_GREEN,
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  confidenceLabel: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  confidenceTitle: {
    color: BANKNOTE_GREEN,
    fontFamily: JournalType.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  thoughtText: {
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  correct: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "flex-start",
    marginTop: 4,
    minHeight: 28,
  },
  correctText: {
    color: Finn.purple,
    fontFamily: JournalType.medium,
    fontSize: 12,
  },
  referencesCard: { borderRadius: 17, padding: 12 },
  referencesHeader: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    minHeight: 28,
  },
  sourceIcons: { flex: 1, flexDirection: "row" },
  sourceIcon: {
    alignItems: "center",
    borderColor: "#fff",
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    justifyContent: "center",
    marginRight: -4,
    width: 28,
  },
  sourcesCount: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  source: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  sourceTitle: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 12,
    marginBottom: 2,
  },
  actionsMenu: {
    marginBottom: 18,
    marginTop: -7,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-start",
    minHeight: 42,
  },
  actionText: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  actionDivider: {
    backgroundColor: Finn.line,
    height: StyleSheet.hairlineWidth,
  },
  deleteConfirm: { alignItems: "center", gap: 7, marginTop: 22 },
  deleteQuestion: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
  },
  deleteActions: { flexDirection: "row", gap: 22 },
  cancelText: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  removeText: {
    color: Finn.danger,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
});
