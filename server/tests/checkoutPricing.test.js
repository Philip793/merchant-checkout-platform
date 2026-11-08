import test from "node:test";
import assert from "node:assert/strict";
import { calculateCartTotal } from "../data/productCatalog.js";

test("Australian shipping stays AUD 10", () => {
  const quote = calculateCartTotal([{ id: 2, quantity: 1 }], { shippingCountry: "AU" });
  assert.equal(quote.shipping, "10.00");
  assert.equal(quote.total, "23.05");
});

test("US shipping is USD 30 converted to AUD and rounded to cents", () => {
  const quote = calculateCartTotal([{ id: 2, quantity: 1 }], {
    shippingCountry: "US", usdToAudRate: 1.5367, exchangeRateDate: "2026-11-06",
  });
  assert.equal(quote.shipping, "46.10");
  assert.equal(quote.total, "59.15");
  assert.equal(quote.shippingOriginal, "30.00 USD");
  assert.equal(quote.exchangeRate, 1.5367);
});

test("US checkout fails closed without a rate", () => {
  assert.throws(() => calculateCartTotal([{ id: 2, quantity: 1 }], { shippingCountry: "US" }));
});

test("Malformed product identifiers and quantities are rejected", () => {
  for (const quantity of [0, -1, 1.5, "2garbage", 101]) {
    assert.throws(() => calculateCartTotal([{ id: 2, quantity }], { shippingCountry: "AU" }));
  }
  assert.throws(() => calculateCartTotal([{ id: "2bad", quantity: 1 }], { shippingCountry: "AU" }));
});
