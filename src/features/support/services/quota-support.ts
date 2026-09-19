import * as Linking from "expo-linking";
import { callBackend } from "@/lib/ai/api";

const SUPPORT_EMAIL = "adinath.codes.alot@gmail.com";

export async function requestQuotaReview() {
  await callBackend<{ requested: true; request_id: string }>(
    "request-quota-review",
    { action: "request_review" },
  );
}

export async function openQuotaSupportEmail() {
  const subject = encodeURIComponent("Finn usage review");
  const body = encodeURIComponent(
    "Hi Finn support,\n\nPlease review the AI usage limit on my account.\n\nThank you.",
  );
  await Linking.openURL(
    `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`,
  );
}
