import assert from "node:assert/strict";
import test from "node:test";
import { formatRupees, REGISTRATION_FEE_PAISE } from "../src/shared/constants.ts";

test("the registration fee is stored in paise", () => {
  assert.equal(REGISTRATION_FEE_PAISE, 100);
  assert.match(formatRupees(REGISTRATION_FEE_PAISE), /1/);
});

test("the default referral earning is ten percent of the registration fee", () => {
  const basisPoints = 1_000;
  assert.equal(REGISTRATION_FEE_PAISE * basisPoints / 10_000, 10);
});
