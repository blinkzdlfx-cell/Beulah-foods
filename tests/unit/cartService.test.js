import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
};

const { getCart, getCartItemCount } = await import("../../storefront/js/services/cartService.js");

beforeEach(() => {
  storage.clear();
});

test("getCart returns an empty cart when no cart exists", () => {
  assert.deepEqual(getCart(), []);
});

test("getCart normalizes product ids and valid quantities", () => {
  storage.set("beulah_foods_cart", JSON.stringify([
    { productId: 123, quantity: "3" },
    { productId: "rice", quantity: 2 },
  ]));

  assert.deepEqual(getCart(), [
    { productId: "123", quantity: 3 },
    { productId: "rice", quantity: 2 },
  ]);
});

test("getCart falls back to quantity one for invalid quantities", () => {
  storage.set("beulah_foods_cart", JSON.stringify([
    { productId: "a", quantity: 0 },
    { productId: "b", quantity: -4 },
    { productId: "c", quantity: "not-a-number" },
  ]));

  assert.deepEqual(getCart(), [
    { productId: "a", quantity: 1 },
    { productId: "b", quantity: 1 },
    { productId: "c", quantity: 1 },
  ]);
});

test("getCart ignores a non-array stored value", () => {
  storage.set("beulah_foods_cart", JSON.stringify({ productId: "a", quantity: 2 }));
  assert.deepEqual(getCart(), []);
});

test("getCart ignores malformed stored JSON", () => {
  storage.set("beulah_foods_cart", "{invalid json");
  assert.deepEqual(getCart(), []);
});

test("getCartItemCount sums normalized quantities", () => {
  storage.set("beulah_foods_cart", JSON.stringify([
    { productId: "a", quantity: 2 },
    { productId: "b", quantity: "4" },
  ]));

  assert.equal(getCartItemCount(), 6);
});
