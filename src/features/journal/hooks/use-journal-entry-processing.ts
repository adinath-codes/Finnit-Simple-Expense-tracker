import { useCallback, useEffect, useRef, useState } from "react";
import type { JournalEntry } from "@/types/domain";

export type EntryProcessingPhase =
  | "typing"
  | "thinking"
  | "reading"
  | "organizing"
  | "sources"
  | "calculating"
  | "result"
  | "settling";

export type PendingEntryResult = {
  entry: JournalEntry;
  resultLabel: string;
  review: boolean;
  sourceCount: number;
};

type CommitOptions = { dismissKeyboard: boolean };
type ManualCommitOptions = {
  dismissKeyboard?: boolean;
  note?: string;
};
type Timer = ReturnType<typeof setTimeout>;

const THINKING_DELAY = 150;
const AUTO_PROCESS_DELAY = 1_000;
const PHASE_INTERVAL = 450;
const RESULT_HOLD = 1_000;
const RESULT_SETTLE = 450;

export function useJournalEntryProcessing({
  draft,
  enabled,
  buildResult,
  onCommit,
  preserveActivePipeline = false,
}: {
  draft: string;
  enabled: boolean;
  buildResult: (note: string) => PendingEntryResult | Promise<PendingEntryResult>;
  onCommit: (result: PendingEntryResult, options: CommitOptions) => void;
  /** Keep a manually started pipeline alive when focus moves to another editor. */
  preserveActivePipeline?: boolean;
}) {
  const [phase, setPhaseState] = useState<EntryProcessingPhase>("typing");
  const [pendingResult, setPendingResult] = useState<PendingEntryResult | null>(null);
  const phaseRef = useRef<EntryProcessingPhase>("typing");
  const draftRef = useRef(draft);
  const buildResultRef = useRef(buildResult);
  const onCommitRef = useRef(onCommit);
  const timersRef = useRef(new Set<Timer>());
  const revisionRef = useRef(0);
  const activeNoteRef = useRef<string | null>(null);
  const resolvedResultRef = useRef<PendingEntryResult | null>(null);
  const minimumTimelineCompleteRef = useRef(false);
  const revealedRevisionRef = useRef<number | null>(null);
  const dismissAfterCommitRef = useRef(false);

  draftRef.current = draft;
  buildResultRef.current = buildResult;
  onCommitRef.current = onCommit;

  const setPhase = useCallback((next: EntryProcessingPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
  }, []);

  const resetPipeline = useCallback(() => {
    clearTimers();
    revisionRef.current += 1;
    activeNoteRef.current = null;
    resolvedResultRef.current = null;
    minimumTimelineCompleteRef.current = false;
    revealedRevisionRef.current = null;
    dismissAfterCommitRef.current = false;
    setPendingResult(null);
    setPhase("typing");
  }, [clearTimers, setPhase]);

  const revealResult = useCallback(
    (revision: number) => {
      const result = resolvedResultRef.current;
      const note = activeNoteRef.current;
      if (
        revision !== revisionRef.current ||
        revealedRevisionRef.current === revision ||
        !minimumTimelineCompleteRef.current ||
        !result ||
        !note ||
        draftRef.current !== note
      ) {
        return;
      }

      revealedRevisionRef.current = revision;
      setPendingResult(result);
      setPhase("result");

      schedule(() => {
        if (revision === revisionRef.current) setPhase("settling");
      }, RESULT_HOLD);

      schedule(() => {
        if (revision !== revisionRef.current || draftRef.current !== note) return;
        const dismissKeyboard = dismissAfterCommitRef.current;
        revisionRef.current += 1;
        activeNoteRef.current = null;
        resolvedResultRef.current = null;
        minimumTimelineCompleteRef.current = false;
        revealedRevisionRef.current = null;
        setPendingResult(null);
        setPhase("typing");
        onCommitRef.current(result, { dismissKeyboard });
      }, RESULT_HOLD + RESULT_SETTLE);
    },
    [schedule, setPhase],
  );

  const beginPipeline = useCallback(
    (
      note: string,
      revision: number,
      { showThinking, dismissKeyboard }: { showThinking: boolean; dismissKeyboard: boolean },
    ) => {
      if (revision !== revisionRef.current || draftRef.current !== note) return;

      clearTimers();
      activeNoteRef.current = note;
      dismissAfterCommitRef.current = dismissKeyboard;
      resolvedResultRef.current = null;
      minimumTimelineCompleteRef.current = false;
      revealedRevisionRef.current = null;
      setPendingResult(null);
      if (showThinking) setPhase("thinking");

      const firstPhaseDelay = showThinking ? THINKING_DELAY : 0;
      schedule(() => {
        if (revision === revisionRef.current) setPhase("reading");
      }, firstPhaseDelay);
      schedule(() => {
        if (revision === revisionRef.current) setPhase("organizing");
      }, firstPhaseDelay + PHASE_INTERVAL);
      schedule(() => {
        if (revision === revisionRef.current) setPhase("sources");
      }, firstPhaseDelay + PHASE_INTERVAL * 2);
      schedule(() => {
        if (revision === revisionRef.current) setPhase("calculating");
      }, firstPhaseDelay + PHASE_INTERVAL * 3);
      schedule(() => {
        if (revision !== revisionRef.current) return;
        minimumTimelineCompleteRef.current = true;
        revealResult(revision);
      }, firstPhaseDelay + PHASE_INTERVAL * 4);

      try {
        Promise.resolve(buildResultRef.current(note)).then(
          (result) => {
            if (revision !== revisionRef.current || draftRef.current !== note) return;
            resolvedResultRef.current = result;
            setPendingResult(result);
            revealResult(revision);
          },
          () => {
            if (revision === revisionRef.current) resetPipeline();
          },
        );
      } catch {
        if (revision === revisionRef.current) resetPipeline();
      }
    },
    [clearTimers, resetPipeline, revealResult, schedule, setPhase],
  );

  useEffect(() => {
    const hasActivePipelineForDraft =
      preserveActivePipeline &&
      activeNoteRef.current === draft &&
      phaseRef.current !== "typing";
    if (hasActivePipelineForDraft) return;

    clearTimers();
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    activeNoteRef.current = null;
    resolvedResultRef.current = null;
    minimumTimelineCompleteRef.current = false;
    revealedRevisionRef.current = null;
    dismissAfterCommitRef.current = false;
    setPendingResult(null);
    setPhase("typing");

    if (!enabled || !draft.trim()) return;

    schedule(() => {
      if (revision === revisionRef.current && draftRef.current === draft) {
        setPhase("thinking");
      }
    }, THINKING_DELAY);
    schedule(
      () =>
        beginPipeline(draft, revision, {
          showThinking: false,
          dismissKeyboard: false,
        }),
      AUTO_PROCESS_DELAY,
    );

    return () => {
      const shouldPreserveActivePipeline =
        preserveActivePipeline &&
        activeNoteRef.current === draft &&
        phaseRef.current !== "typing";
      if (!shouldPreserveActivePipeline) clearTimers();
    };
  }, [
    beginPipeline,
    clearTimers,
    draft,
    enabled,
    preserveActivePipeline,
    schedule,
    setPhase,
  ]);

  useEffect(
    () => () => {
      clearTimers();
      revisionRef.current += 1;
    },
    [clearTimers],
  );

  const requestManualCommit = useCallback((options: ManualCommitOptions = {}) => {
    const note = options.note ?? draftRef.current;
    if (!note.trim()) return false;
    draftRef.current = note;

    if (activeNoteRef.current === note && phaseRef.current !== "typing") {
      dismissAfterCommitRef.current ||= options.dismissKeyboard ?? true;
      return true;
    }

    clearTimers();
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    beginPipeline(note, revision, {
      showThinking: true,
      dismissKeyboard: options.dismissKeyboard ?? true,
    });
    return true;
  }, [beginPipeline, clearTimers]);

  return {
    phase,
    pendingResult,
    processing: phase !== "typing",
    requestManualCommit,
    cancel: resetPipeline,
  };
}
