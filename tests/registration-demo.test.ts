import assert from "node:assert/strict";
import test from "node:test";
import { createDemoRegistration } from "../src/features/registration/demo-data.ts";
import { registrationSchema } from "../src/features/registration/schema.ts";

test("demo registration data satisfies registration validation", () => {
  const demo = createDemoRegistration();
  const result = registrationSchema.safeParse({ ...demo, consent: true, website: "" });
  assert.equal(result.success, true, result.error?.message);
});
