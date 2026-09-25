type PropertyMap = Record<string, unknown>;

const SENSITIVE_KEY =
  /(^|_)(amount|email|phone|token|password|secret|note|raw|query|prompt|receipt|image|merchant|entry_id|attachment|instruction|evidence|source_text)($|_)/i;
const URL_KEY = /(^|_)(url|uri|href|pathname|path)($|_)/i;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function safeString(value: string) {
  return value.replace(EMAIL, "[redacted]").replace(UUID, ":id").slice(0, 160);
}

/** Last-line guard: sensitive custom properties never leave the device. */
export function sanitizeAnalyticsProperties(
  properties: PropertyMap | undefined,
): PropertyMap {
  if (!properties) return {};
  const sanitized: PropertyMap = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith("$") && SENSITIVE_KEY.test(key)) continue;
    if (URL_KEY.test(key)) continue;
    if (typeof value === "string") sanitized[key] = safeString(value);
    else if (
      value === null ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    } else if (key.startsWith("$")) {
      // SDK-owned nested values are allowed only for reserved PostHog fields.
      sanitized[key] = value;
    }
  }
  return sanitized;
}
