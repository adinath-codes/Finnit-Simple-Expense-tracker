import * as Linking from "expo-linking";
import { callBackend } from "@/lib/ai/api";

export const SUPPORT_EMAIL = "adinath.codes.alot@gmail.com";

export async function openSupportEmail({
  subject = "Finn support",
  body = "Hi Finn support,\n\n",
}: {
  subject?: string;
  body?: string;
} = {}) {
  await Linking.openURL(
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  );
}

export async function requestQuotaReview() {
  await callBackend<{ requested: true; request_id: string }>(
    "request-quota-review",
    { action: "request_review" },
  );
}

export async function openQuotaSupportEmail() {
  await openSupportEmail({
    subject: "Finn usage review",
    body: "Hi Finn support,\n\nPlease review the AI usage limit on my account.\n\nThank you.",
  });
}
