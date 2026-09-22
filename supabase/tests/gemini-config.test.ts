import assert from "node:assert/strict";
import {
  estimatedGeminiCost,
  geminiModel,
} from "../functions/_shared/gemini.ts";

const environment = (values: Record<string, string>) => (name: string) =>
  values[name];

Deno.test("Gemini roles use stable low-cost defaults and explicit overrides", () => {
  assert.equal(
    geminiModel("extraction", environment({})),
    "gemini-3.5-flash-lite",
  );
  assert.equal(
    geminiModel("reasoning", environment({})),
    "gemini-3.1-flash-lite",
  );
  assert.equal(geminiModel("fast", environment({})), "gemini-3.5-flash-lite");
  assert.equal(
    geminiModel(
      "reasoning",
      environment({
        GEMINI_REASONING_MODEL: "gemini-3.1-flash-lite-custom",
        GEMINI_MODEL: "gemini-3.8-flash",
      }),
    ),
    "gemini-3.1-flash-lite-custom",
    "the deprecated global model must not override a role-specific model",
  );
});

Deno.test("Gemini role configuration rejects unsafe model identifiers", () => {
  assert.throws(
    () =>
      geminiModel("fast", environment({ GEMINI_FAST_MODEL: "../../other" })),
    /invalid_model/,
  );
});

Deno.test("Gemini costs use the selected role's verified rates", () => {
  const values = environment({
    GEMINI_EXTRACTION_INPUT_USD_PER_MILLION: "0.30",
    GEMINI_EXTRACTION_OUTPUT_USD_PER_MILLION: "2.50",
    GEMINI_REASONING_INPUT_USD_PER_MILLION: "0.25",
    GEMINI_REASONING_OUTPUT_USD_PER_MILLION: "1.50",
    GEMINI_FAST_INPUT_USD_PER_MILLION: "0.30",
    GEMINI_FAST_OUTPUT_USD_PER_MILLION: "2.50",
  });
  assert.equal(estimatedGeminiCost("extraction", 1_000, 500, values), 0.00155);
  assert.equal(estimatedGeminiCost("reasoning", 1_000, 500, values), 0.001);
  assert.equal(estimatedGeminiCost("fast", 1_000, 500, values), 0.00155);
  assert.equal(estimatedGeminiCost("fast", 1_000, 500, environment({})), null);
  assert.equal(
    estimatedGeminiCost(
      "fast",
      1_000,
      500,
      environment({
        GEMINI_FAST_INPUT_USD_PER_MILLION: "invalid",
        GEMINI_FAST_OUTPUT_USD_PER_MILLION: "2.50",
      }),
    ),
    null,
  );
});
