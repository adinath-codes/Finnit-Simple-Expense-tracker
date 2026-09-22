// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../../supabase/", import.meta.url);
const config = readFileSync(new URL("config.toml", root), "utf8");

test("every configured Edge entrypoint belongs to its own function", () => {
  const folders = readdirSync(new URL("functions/", root), { withFileTypes: true })
    .filter((item) => item.isDirectory() && !item.name.startsWith("_"))
    .map((item) => item.name);
  for (const name of folders) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const section = config.match(new RegExp(
      `\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`,
    ))?.[1];
    assert.ok(section, `missing function config: ${name}`);
    const entrypoint = section.match(/^entrypoint\s*=\s*"([^"]+)"/m)?.[1]
      ?? `./functions/${name}/index.ts`;
    assert.equal(entrypoint, `./functions/${name}/index.ts`, name);
  }
});
