import assert from "node:assert/strict";
import test from "node:test";
import {
  completeJsonArrayProperty,
  splitSseFrames,
} from "../functions/_shared/json-stream.ts";

test("Gemini SSE frames survive every possible chunk boundary", () => {
  const first = JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"amount_plans":[' }] } }],
  });
  const second = JSON.stringify({
    candidates: [{ content: { parts: [{ text: "]}" }] }, finishReason: "STOP" }],
  });
  const wire = `data: ${first}\r\n\r\ndata: ${second}\r\n\r\n`;
  for (let cut = 0; cut <= wire.length; cut += 1) {
    const left = splitSseFrames("", wire.slice(0, cut));
    const right = splitSseFrames(left.remainder, wire.slice(cut), true);
    assert.deepEqual([...left.frames, ...right.frames], [first, second], `cut ${cut}`);
  }
});

test("amount plans become available only after the complete array", () => {
  const plans = [{
    transaction_ordinal: 0,
    description: 'Dinner with a literal ] and { plus "quotes"',
    evidence: "escaped \\ slash",
  }];
  const document = JSON.stringify({
    amount_plans: plans,
    transactions: [{ transaction_ordinal: 0 }],
  });
  const arrayEnd = document.indexOf(',"transactions"');
  for (let cut = 0; cut < arrayEnd; cut += 1) {
    assert.equal(completeJsonArrayProperty(document.slice(0, cut), "amount_plans"), null);
  }
  const complete = completeJsonArrayProperty(document.slice(0, arrayEnd), "amount_plans");
  assert.ok(complete);
  assert.deepEqual(JSON.parse(complete), plans);
});

test("property-like text inside evidence cannot start an early preview", () => {
  const document = JSON.stringify({
    preface: 'not a key: "amount_plans": [{"unsafe": true}]',
    amount_plans: [{ transaction_ordinal: 0, description: "Coffee 120" }],
    interpretation_summary: "done",
  });
  const complete = completeJsonArrayProperty(document, "amount_plans");
  assert.deepEqual(JSON.parse(complete!), [{
    transaction_ordinal: 0,
    description: "Coffee 120",
  }]);
});
