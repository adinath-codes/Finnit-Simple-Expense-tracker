import { useEffect, useRef } from "react";
import { router, usePathname } from "expo-router";
import { useAppToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  loadSeenGuidance,
  markGuidanceSeen,
  type GuidanceMessageId,
} from "@/features/guidance/services/guidance-service";
import {
  useJournalData,
  useJournalStatus,
} from "@/providers/app-providers";

export function GuidanceToastHost() {
  const pathname = usePathname();
  const session = useSession().session;
  const userId = session?.user.id;
  const { entries } = useJournalData();
  const { initialSyncReady, settingsReady } = useJournalStatus();
  const { showToast } = useAppToast();
  const shownForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !settingsReady || !initialSyncReady || pathname !== "/") return;
    if (shownForUser.current === userId) return;

    let active = true;
    void loadSeenGuidance(userId).then((seen) => {
      if (!active || shownForUser.current === userId) return;

      let messageId: GuidanceMessageId | null = null;
      const createdAt = Date.parse(session?.user.created_at ?? "");
      const isNewAccount = Number.isFinite(createdAt) &&
        Date.now() - createdAt < 7 * 24 * 60 * 60 * 1000;
      if (entries.length === 0 && isNewAccount && !seen.has("first-note-v1")) {
        messageId = "first-note-v1";
      } else if (entries.length > 0 && !seen.has("saved-entries-v1")) {
        messageId = "saved-entries-v1";
      }
      if (!messageId) return;

      shownForUser.current = userId;
      if (messageId === "first-note-v1") {
        showToast({
          id: `guidance:${userId}:${messageId}`,
          message: "Start with one expense, just as you’d say it.",
          highlighted: "Tap the page, write “coffee 180,” then tap ✓.",
          durationMs: 10_000,
          onClose: () => { void markGuidanceSeen(userId, messageId); },
        });
        return;
      }

      showToast({
        id: `guidance:${userId}:${messageId}`,
        message: "New: turn repeat expenses into saved entries.",
        highlighted: "Open Saved entries to make them one tap.",
        durationMs: 12_000,
        action: {
          label: "Open Saved entries",
          onPress: () => router.push("/settings/presets"),
        },
        onClose: () => { void markGuidanceSeen(userId, messageId); },
      });
    });

    return () => { active = false; };
  }, [entries.length, initialSyncReady, pathname, session?.user.created_at, settingsReady, showToast, userId]);

  useEffect(() => {
    if (!userId) shownForUser.current = null;
  }, [userId]);

  return null;
}
