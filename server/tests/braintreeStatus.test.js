import test from "node:test";
import assert from "node:assert/strict";
import { classifyBraintreeTransaction } from "../services/braintreeStatus.js";

test("only positively accepted Braintree states count as paid", () => {
  for (const status of ["submitted_for_settlement", "settled", "settling"]) {
    assert.equal(classifyBraintreeTransaction(status), "paid");
  }
});

test("terminal declined and voided states cannot be finalised as paid", () => {
  for (const status of ["processor_declined", "gateway_rejected", "failed", "voided"]) {
    assert.equal(classifyBraintreeTransaction(status), "failed");
  }
});

test("unknown and transient states remain uncertain", () => {
  assert.equal(classifyBraintreeTransaction("authorizing"), "uncertain");
  assert.equal(classifyBraintreeTransaction("authorized"), "uncertain");
  assert.equal(classifyBraintreeTransaction("unexpected_state"), "uncertain");
  assert.equal(classifyBraintreeTransaction(null), "uncertain");
});
