// Nodemailer does not bundle declarations; its callback-free API is bounded here.
// @ts-ignore npm package has no bundled TypeScript declarations
import nodemailer from "npm:nodemailer@10.0.12";
import type { Context } from "./runtime.ts";
import { env, positiveEnv } from "./runtime.ts";
import { ApiError } from "./validation.ts";

export type SupportEmailKind = "contact_us" | "error_report" | "quota_review";

type SupportEmailContext = {
  eventId?: string;
  requestId?: string;
};

const subjects: Record<SupportEmailKind, string> = {
  contact_us: "Finnit support: contact request",
  error_report: "Finnit support: app error reported",
  quota_review: "Finnit support: AI quota review",
};

function safeEmail(name: string) {
  const value = env(name).trim();
  if (
    value.length > 254 ||
    /[\r\n]/.test(value) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) throw new ApiError(503, "invalid_smtp_configuration");
  return value;
}

function safeHeader(name: string, fallback: string) {
  const value = (Deno.env.get(name) || fallback).trim();
  if (!value || value.length > 100 || /[\r\n]/.test(value))
    throw new ApiError(503, "invalid_smtp_configuration");
  return value;
}

function optionalIdentifier(value: string | undefined, name: string) {
  if (value === undefined) return undefined;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value))
    throw new ApiError(400, `invalid_${name}`);
  return value;
}

export function supportEmailText({
  kind,
  userId,
  userEmail,
  eventId,
  requestId,
  receivedAt,
}: {
  kind: SupportEmailKind;
  userId: string;
  userEmail?: string;
  eventId?: string;
  requestId?: string;
  receivedAt: string;
}) {
  return [
    "A signed-in Finnit user requested support.",
    "",
    `Request type: ${kind}`,
    `Account ID: ${userId}`,
    `Account email: ${userEmail || "Unavailable"}`,
    ...(eventId ? [`Sentry event ID: ${eventId}`] : []),
    ...(requestId ? [`Quota request ID: ${requestId}`] : []),
    `Received at: ${receivedAt}`,
    "",
    "No journal text, receipt data, amounts, or search content is included.",
  ].join("\n");
}

export async function sendSupportEmail(
  ctx: Context,
  kind: SupportEmailKind,
  details: SupportEmailContext = {},
) {
  const eventId = optionalIdentifier(details.eventId, "event_id");
  const requestId = optionalIdentifier(details.requestId, "request_id");
  const { data, error } = await ctx.admin.auth.admin.getUserById(ctx.userId);
  if (error || !data.user)
    throw new ApiError(503, "support_account_unavailable");

  const fromEmail = safeEmail("SMTP_FROM_EMAIL");
  const notificationEmail = safeEmail("SMTP_NOTIFICATION_EMAIL");
  const accountEmail = data.user.email?.trim();
  const replyTo = accountEmail &&
      accountEmail.length <= 254 &&
      !/[\r\n]/.test(accountEmail) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)
    ? accountEmail
    : undefined;
  const port = positiveEnv("SMTP_PORT", 465, 65535);
  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: {
      user: env("SMTP_USERNAME"),
      pass: env("SMTP_PASSWORD"),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transport.sendMail({
      from: {
        name: safeHeader("SMTP_FROM_NAME", "Finn it customer support"),
        address: fromEmail,
      },
      to: notificationEmail,
      ...(replyTo ? { replyTo } : {}),
      subject: subjects[kind],
      text: supportEmailText({
        kind,
        userId: ctx.userId,
        userEmail: replyTo,
        eventId,
        requestId,
        receivedAt: new Date().toISOString(),
      }),
    });
  } catch {
    throw new ApiError(503, "support_email_unavailable");
  } finally {
    transport.close();
  }
}
