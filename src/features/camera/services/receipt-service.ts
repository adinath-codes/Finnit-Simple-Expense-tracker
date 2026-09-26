import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { currentUserId, getSupabase } from "@/lib/supabase/client";
import {
  changeJournalCache,
  readJournalCache,
  subscribeJournalCache,
} from "@/lib/offline/database";
import { syncJournal } from "@/lib/offline/sync-queue";
import type { JournalEntry, ReceiptPhoto } from "@/types/domain";
import type {
  ReceiptAttachment,
  ReceiptLine,
  ReceiptScanRequest,
  SavedEntry,
} from "@/lib/supabase/database.types";
import { notifyFirstJournalEntryLogged } from "@/features/notifications/services/entry-events";

const MAX_EDGE = 2560;
const MAX_BYTES = 8 * 1024 * 1024;

function directoryFor(userId: string) {
  return new Directory(Paths.document, "receipts", userId);
}

function emptyRequest(
  entryId: string,
  attachmentId: string,
  selectedDate: string,
  currency: string,
): ReceiptScanRequest {
  return {
    entry_id: entryId,
    attachment_id: attachmentId,
    captured_at: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    selected_date: selectedDate,
    default_currency: currency,
  };
}

async function finishPreparing(userId: string, entryId: string) {
  const cached = (await readJournalCache(userId)).receipts[entryId];
  if (!cached || cached.deleted || cached.status !== "preparing") return entryId;
  if (!cached.localUri) throw new Error("receipt_file_missing");
  const original = new File(cached.localUri);
  if (!original.exists) throw new Error("receipt_file_missing");
  const directory = directoryFor(userId);
  const normalized = new File(directory, `${entryId}.jpg`);
  const sourceEdge = Math.max(cached.width, cached.height);
  let normalizedWidth = cached.width;
  let normalizedHeight = cached.height;
  let saved = false;
  // Keep JPEG quality fixed at 85%; only reduce dimensions further when an
  // unusually detailed/noisy image would exceed the transient request limit.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const targetEdge = Math.min(sourceEdge, Math.round(MAX_EDGE * (0.8 ** attempt)));
    const ratio = Math.min(1, targetEdge / sourceEdge);
    const manipulator = ImageManipulator.manipulate(original.uri);
    if (ratio < 1) {
      manipulator.resize({
        width: Math.round(cached.width * ratio),
        height: Math.round(cached.height * ratio),
      });
    }
    const rendered = await manipulator.renderAsync();
    const candidate = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    const candidateFile = new File(candidate.uri);
    if (candidateFile.size <= MAX_BYTES) {
      await candidateFile.copy(normalized, { overwrite: true });
      normalizedWidth = rendered.width;
      normalizedHeight = rendered.height;
      saved = true;
      break;
    }
  }
  if (!saved) throw new Error("receipt_image_too_large");
  await changeJournalCache(userId, (cache) => {
    const receipt = cache.receipts[entryId];
    if (!receipt || receipt.deleted) return;
    receipt.localUri = normalized.uri;
    receipt.width = normalizedWidth;
    receipt.height = normalizedHeight;
    receipt.prepared = true;
    receipt.status = "queued";
    receipt.error = undefined;
    if (!cache.jobs.some((job) => job.entryId === entryId)) {
      cache.jobs.push({
        id: Crypto.randomUUID(), userId, entryId, endpoint: "scan-receipt",
        payload: receipt.request, state: "pending", attempts: 0, nextAttemptAt: 0,
      });
    }
  });
  if (original.exists) original.delete();
  void syncJournal(userId).catch(() => undefined);
  return entryId;
}

/** Copy out of the temporary picker/camera cache before doing any network work. */
export async function captureReceipt(
  photo: ReceiptPhoto,
  selectedDate: string,
  currency: string,
) {
  if (!photo.uri) throw new Error("receipt_file_missing");
  const userId = await currentUserId();
  const entryId = Crypto.randomUUID();
  const attachmentId = Crypto.randomUUID();
  const directory = directoryFor(userId);
  directory.create({ intermediates: true, idempotent: true });
  const original = new File(directory, `${entryId}.source`);
  await new File(photo.uri).copy(original, { overwrite: true });

  let firstJournalItem = false;
  await changeJournalCache(userId, (cache) => {
    firstJournalItem =
      Object.values(cache.entries).every((entry) => entry.deleted) &&
      Object.values(cache.receipts).every((receipt) => receipt.deleted);
    cache.receipts[entryId] = {
      request: emptyRequest(entryId, attachmentId, selectedDate, currency),
      localUri: original.uri,
      width: photo.width,
      height: photo.height,
      prepared: false,
      status: "preparing",
      lines: [],
    };
  });
  if (firstJournalItem) notifyFirstJournalEntryLogged(userId);

  try {
    return await finishPreparing(userId, entryId);
  } catch (error) {
    await changeJournalCache(userId, (cache) => {
      const receipt = cache.receipts[entryId];
      if (!receipt) return;
      receipt.status = "failed";
      receipt.error =
        error instanceof Error ? error.message : "receipt_preparation_failed";
    });
    throw error;
  }
}

export async function recoverPreparingReceipts() {
  const userId = await currentUserId();
  const cache = await readJournalCache(userId);
  const completedLocalImages = Object.values(cache.receipts)
    .filter((receipt) => !!receipt.remote && !!receipt.localUri);
  for (const receipt of completedLocalImages) {
    const local = new File(receipt.localUri!);
    if (local.exists) local.delete();
  }
  if (completedLocalImages.length) {
    await changeJournalCache(userId, (state) => {
      for (const receipt of completedLocalImages) {
        const current = state.receipts[receipt.request.entry_id];
        if (current?.remote) current.localUri = undefined;
      }
    });
  }
  await Promise.all(Object.values(cache.receipts)
    .filter((receipt) => receipt.status === "preparing" && !receipt.deleted)
    .map(async (receipt) => {
      try { await finishPreparing(userId, receipt.request.entry_id); }
      catch (error) {
        await changeJournalCache(userId, (state) => {
          const current = state.receipts[receipt.request.entry_id];
          if (current) {
            current.status = "failed";
            current.error = error instanceof Error ? error.message : "receipt_preparation_failed";
          }
        });
      }
    }));
  const latest = await readJournalCache(userId);
  const retained = new Set(
    Object.values(latest.receipts)
      .map((receipt) => receipt.localUri)
      .filter((uri): uri is string => !!uri),
  );
  const directory = directoryFor(userId);
  if (directory.exists) {
    for (const child of directory.list()) {
      if (child instanceof File && !retained.has(child.uri)) child.delete();
    }
  }
}

export async function pickReceiptFromGallery() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    exif: false,
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  } satisfies ReceiptPhoto;
}

export async function retryReceipt(entryId: string) {
  const userId = await currentUserId();
  let needsPreparation = false;
  await changeJournalCache(userId, (cache) => {
    const receipt = cache.receipts[entryId];
    if (!receipt || receipt.deleted) return;
    if (!receipt.prepared) {
      receipt.status = "preparing";
      receipt.error = undefined;
      needsPreparation = true;
      return;
    }
    receipt.status = "queued";
    receipt.error = undefined;
    const existing = cache.jobs.find(
      (job) => job.entryId === entryId && job.endpoint === "scan-receipt",
    );
    if (existing) {
      existing.state = "pending";
      existing.attempts = 0;
      existing.nextAttemptAt = 0;
      existing.error = undefined;
    } else {
      cache.jobs.push({
        id: Crypto.randomUUID(),
        userId,
        entryId,
        endpoint: "scan-receipt",
        payload: receipt.request,
        state: "pending",
        attempts: 0,
        nextAttemptAt: 0,
      });
    }
  });
  if (needsPreparation) {
    try {
      return await finishPreparing(userId, entryId);
    } catch (error) {
      await changeJournalCache(userId, (cache) => {
        const receipt = cache.receipts[entryId];
        if (!receipt) return;
        receipt.status = "failed";
        receipt.error = error instanceof Error
          ? error.message
          : "receipt_preparation_failed";
      });
      throw error;
    }
  }
  return syncJournal(userId);
}

export async function correctReceiptEntry(entry: JournalEntry) {
  const userId = await currentUserId();
  await changeJournalCache(userId, (cache) => {
    const receipt = cache.receipts[entry.id];
    if (!receipt) throw new Error("This receipt is no longer available.");
    const pendingCorrection = cache.jobs.some((job) =>
      job.entryId === entry.id && job.endpoint === "correct-entry",
    );
    if (pendingCorrection)
      throw new Error("Wait for this receipt to sync before saving another correction.");
    // Choosing manual entry supersedes a failed scan. Only entered text and
    // structured values are sent to the backend.
    if (!receipt.remote)
      cache.jobs = cache.jobs.filter((job) => job.entryId !== entry.id);
    const lines = entry.items.map((item, ordinal): ReceiptLine => {
      const previous = receipt.lines.find((line) =>
        line.id === item.id || line.ordinal === ordinal,
      );
      const amount = item.amountMinor;
      const unitPrice = item.kind !== "discount" && previous?.unit_price_minor !== null &&
          previous?.unit_price_minor !== undefined && item.quantity > 1 &&
          Number(previous.unit_price_minor) * item.quantity === Math.abs(amount)
        ? previous.unit_price_minor
        : null;
      return {
        id: previous?.id,
        ordinal,
        kind: item.kind ?? previous?.kind ?? "item",
        description: item.name.trim(),
        quantity: item.quantity,
        unit_price_minor: unitPrice === null ? null : String(Math.abs(Number(unitPrice))),
        amount_minor: String(item.kind === "discount" ? -Math.abs(amount) : Math.abs(amount)),
        currency: receipt.attachment?.currency ?? receipt.request.default_currency,
        category_id: item.categoryId ?? item.category,
        confidence: previous?.confidence ?? 1,
        needs_review: false,
        evidence_text: previous?.evidence_text ?? `${item.name} ${amount}`,
        provisional: false,
      };
    });
    const merchantName = entry.merchant.trim() || null;
    const printedTotalMinor = entry.receipt?.printedTotalMinor === undefined
      ? receipt.attachment?.printed_total_minor ?? null
      : entry.receipt.printedTotalMinor === null
        ? null
        : String(entry.receipt.printedTotalMinor);
    const operationId = Crypto.randomUUID();
    const basePayload = {
      operation_id: operationId,
      id: entry.id,
      merchant_name: merchantName,
      purchase_date_text: receipt.attachment?.purchase_date_text ?? null,
      printed_subtotal_minor: receipt.attachment?.printed_subtotal_minor ?? null,
      printed_total_minor: printedTotalMinor,
      currency: receipt.attachment?.currency ?? receipt.request.default_currency,
      lines,
    };
    cache.jobs.push({
      id: operationId,
      userId,
      entryId: entry.id,
      endpoint: "correct-entry",
      payload: receipt.remote
        ? { action: "correct_receipt", expected_revision: receipt.remote.revision, ...basePayload }
        : { action: "create_receipt_manual", request: receipt.request, ...basePayload },
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    });
    receipt.lines = lines;
    if (receipt.attachment) {
      receipt.attachment = {
        ...receipt.attachment,
        merchant_name: merchantName,
        printed_total_minor: printedTotalMinor,
        lines,
      };
    }
    receipt.status = "needs_review";
  });
  void syncJournal(userId).catch(() => undefined);
}

export async function deleteReceipt(entryId: string) {
  const userId = await currentUserId();
  let localUri: string | undefined;
  await changeJournalCache(userId, (cache) => {
    const receipt = cache.receipts[entryId];
    if (!receipt) return;
    localUri = receipt.localUri;
    const activeScan = cache.jobs.some((job) =>
      job.entryId === entryId && job.endpoint === "scan-receipt" && job.state === "running",
    );
    cache.jobs = cache.jobs.filter((job) =>
      job.entryId !== entryId ||
      (job.endpoint === "scan-receipt" && job.state === "running"),
    );
    receipt.deleted = true;
    if (receipt.remote && !receipt.remote.deleted_at) {
      const operationId = Crypto.randomUUID();
      cache.jobs.push({
        id: operationId,
        userId,
        entryId,
        endpoint: "correct-entry",
        payload: {
          action: "delete",
          operation_id: operationId,
          id: entryId,
          expected_revision: receipt.remote.revision,
        },
        state: "pending",
        attempts: 0,
        nextAttemptAt: 0,
      });
    }
    if (!activeScan) {
      receipt.localUri = undefined;
      if (!receipt.remote) delete cache.receipts[entryId];
    }
  });
  if (localUri && !(await readJournalCache(userId)).receipts[entryId]?.localUri) {
    const file = new File(localUri);
    if (file.exists) file.delete();
  }
  void syncJournal(userId).catch(() => undefined);
}

export async function listLocalReceipts() {
  const cache = await readJournalCache(await currentUserId());
  return Object.values(cache.receipts)
    .filter((receipt) => !receipt.deleted)
    .sort((a, b) =>
      b.request.captured_at.localeCompare(a.request.captured_at),
    );
}

/** Rehydrate extracted receipt text. Source images are never stored remotely. */
export async function refreshRemoteReceipts(
  expectedUserId?: string,
  range?: { startDate: string; endDate: string },
) {
  const userId = expectedUserId ?? await currentUserId();
  if (await currentUserId() !== userId) throw new Error("Account changed during sync.");
  const db = getSupabase();
  let entriesQuery = db.from("journal_entries")
      .select("id,source_type,raw_text,original_text,captured_at,occurred_on,timezone,currency,revision,extraction,deleted_at,capture_request")
      .eq("user_id", userId).eq("source_type", "receipt");
  if (range) {
    entriesQuery = entriesQuery
      .gte("occurred_on", range.startDate)
      .lte("occurred_on", range.endDate);
  }
  const entriesResult = await entriesQuery.limit(1000);
  if (entriesResult.error) throw new Error("Could not refresh receipts.");
  const entryIds = entriesResult.data.map((entry) => entry.id);
  if (!entryIds.length) return listLocalReceipts();
  let attachmentsQuery = db.from("receipt_attachments").select("*")
    .eq("user_id", userId);
  let linesQuery = db.from("receipt_line_items").select("*")
    .eq("user_id", userId);
  if (range) {
    attachmentsQuery = attachmentsQuery.in("entry_id", entryIds);
    linesQuery = linesQuery.in("entry_id", entryIds);
  }
  const [attachmentsResult, linesResult] = await Promise.all([
    attachmentsQuery.limit(1000),
    linesQuery.order("entry_id").order("ordinal").limit(100000),
  ]);
  if (attachmentsResult.error || linesResult.error)
    throw new Error("Could not refresh receipts.");
  if (await currentUserId() !== userId) throw new Error("Account changed during sync.");
  const attachments = new Map(
    attachmentsResult.data.map((attachment) => [attachment.entry_id, attachment]),
  );
  const lines = new Map<string, ReceiptLine[]>();
  for (const row of linesResult.data) {
    const current = lines.get(row.entry_id) ?? [];
    current.push({
      id: row.id,
      ordinal: row.ordinal,
      kind: row.kind,
      description: row.description,
      quantity: row.quantity,
      unit_price_minor: row.unit_price_minor === null ? null : String(row.unit_price_minor),
      amount_minor: String(row.amount_minor),
      currency: row.currency,
      category_id: row.category_id,
      confidence: Number(row.confidence),
      needs_review: row.needs_review,
      evidence_text: row.evidence_text,
      provisional: false,
    } as ReceiptLine);
    lines.set(row.entry_id, current);
  }
  for (const row of entriesResult.data) {
    const attachmentRow = attachments.get(row.id);
    if (!attachmentRow) continue;
    const request = row.capture_request as unknown as ReceiptScanRequest;
    const receiptLines = lines.get(row.id) ?? [];
    const attachment: ReceiptAttachment = {
      id: attachmentRow.id,
      status: attachmentRow.status,
      merchant_name: attachmentRow.merchant_name,
      purchase_date_text: attachmentRow.purchase_date_text,
      printed_subtotal_minor: attachmentRow.printed_subtotal_minor === null
        ? null : String(attachmentRow.printed_subtotal_minor),
      printed_total_minor: attachmentRow.printed_total_minor === null
        ? null : String(attachmentRow.printed_total_minor),
      currency: attachmentRow.currency,
      confidence: Number(attachmentRow.confidence),
      needs_review: attachmentRow.needs_review,
      truncated: attachmentRow.truncated,
      model: attachmentRow.model,
      lines: receiptLines,
    };
    const remote = {
      ...row,
      source_type: "receipt",
      receipt: attachment,
    } as unknown as SavedEntry;
    await changeJournalCache(userId, (cache) => {
      if (cache.jobs.some((job) => job.entryId === row.id)) return;
      cache.receipts[row.id] = {
        request,
        width: 0,
        height: 0,
        prepared: true,
        status: attachment.status,
        lines: receiptLines,
        attachment,
        remote,
        deleted: !!row.deleted_at,
      };
    });
  }
  return listLocalReceipts();
}

export { subscribeJournalCache as subscribeReceipts };
