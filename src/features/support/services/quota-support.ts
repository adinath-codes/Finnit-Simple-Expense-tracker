import { callBackend } from "@/lib/ai/api";

export const SUPPORT_EMAIL = "adinath.codes.alot@gmail.com";

export async function sendContactSupportEmail() {
  await callBackend<{ sent: true }>("support-email", {
    kind: "contact_us",
  });
}

export async function sendErrorSupportEmail(eventId?: string) {
  await callBackend<{ sent: true }>("support-email", {
    kind: "error_report",
    ...(eventId ? { event_id: eventId } : {}),
  });
}

export async function requestQuotaReview() {
  await callBackend<{ requested: true; emailed: true; request_id: string }>(
    "request-quota-review",
    { action: "request_review" },
  );
}
