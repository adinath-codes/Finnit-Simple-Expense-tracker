// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

test("the legacy non-IAP tester unlock remains retired", () => {
  assert.doesNotMatch(config, /\[functions\.redeem-testing-code\]/);
  assert.equal(
    existsSync(new URL("functions/redeem-testing-code/index.ts", root)),
    false,
  );

  const revocation = readFileSync(
    new URL(
      "migrations/20260927090000_revoke_tester_access_codes.sql",
      root,
    ),
    "utf8",
  );
  assert.match(revocation, /set enabled = false/);
  assert.match(
    revocation,
    /drop function if exists public\.finn_reserve_testing_access_code/,
  );
  assert.match(
    revocation,
    /drop function if exists public\.finn_complete_testing_access_code/,
  );
});
