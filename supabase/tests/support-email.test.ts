import { supportEmailText } from "../functions/_shared/support-email.ts";

Deno.test("support email contains bounded references without financial content", () => {
  const message = supportEmailText({
    kind: "error_report",
    userId: "8cbf4b33-267f-4232-91ae-3977ecb6fbe7",
    userEmail: "person@example.com",
    eventId: "d34db33fd34db33fd34db33fd34db33f",
    receivedAt: "2026-09-29T10:00:00.000Z",
  });

  if (!message.includes("Request type: error_report"))
    throw new Error("missing request type");
  if (!message.includes("Sentry event ID: d34db33fd34db33fd34db33fd34db33f"))
    throw new Error("missing event reference");
  if (!message.includes("Account email: person@example.com"))
    throw new Error("missing reply address");
  if (!message.includes("No journal text, receipt data, amounts, or search content"))
    throw new Error("missing privacy notice");
});
