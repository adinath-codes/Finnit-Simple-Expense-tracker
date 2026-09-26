/** Split provider SSE safely even when CRLF delimiters or JSON frames cross chunks. */
export function splitSseFrames(
  remainder: string,
  chunk: string,
  flush = false,
): { frames: string[]; remainder: string } {
  const normalized = (remainder + chunk).replaceAll("\r\n", "\n");
  const parts = normalized.split("\n\n");
  const nextRemainder = flush ? "" : parts.pop() ?? "";
  if (flush && parts.at(-1) !== "") parts.push("");
  const frames = parts
    .map((frame) => frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n"))
    .filter((frame) => frame && frame !== "[DONE]");
  return { frames, remainder: nextRemainder };
}

/**
 * Return a complete JSON array value only after the named top-level property
 * has closed. Strings, escapes and braces inside evidence are intentionally
 * ignored while balancing. Malformed or incomplete JSON simply returns null.
 */
export function completeJsonArrayProperty(
  source: string,
  property: string,
): string | null {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character !== '"') continue;

    const keyStart = index;
    inString = true;
    escaped = false;
    let keyEnd = -1;
    for (index += 1; index < source.length; index += 1) {
      const keyCharacter = source[index];
      if (escaped) escaped = false;
      else if (keyCharacter === "\\") escaped = true;
      else if (keyCharacter === '"') {
        keyEnd = index;
        inString = false;
        break;
      }
    }
    if (keyEnd < 0) return null;
    let key: unknown;
    try {
      key = JSON.parse(source.slice(keyStart, keyEnd + 1));
    } catch {
      return null;
    }
    if (key !== property) continue;

    let cursor = keyEnd + 1;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    if (source[cursor] !== ":") continue;
    cursor += 1;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    if (source[cursor] !== "[") continue;
    const arrayStart = cursor;
    let depth = 0;
    inString = false;
    escaped = false;
    for (; cursor < source.length; cursor += 1) {
      const valueCharacter = source[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (valueCharacter === "\\") escaped = true;
        else if (valueCharacter === '"') inString = false;
        continue;
      }
      if (valueCharacter === '"') inString = true;
      else if (valueCharacter === "[") depth += 1;
      else if (valueCharacter === "]") {
        depth -= 1;
        if (depth === 0) return source.slice(arrayStart, cursor + 1);
      }
    }
    return null;
  }
  return null;
}
