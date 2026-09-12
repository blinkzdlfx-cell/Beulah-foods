const CART_KEY = "beulah_foods_cart";
const CART_EVENT = "beulah:cart-changed";

function normalizeItem(item) {
  const quantity = Number.parseInt(item.quantity, 10);
  return { productId: String(item.productId), quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 };
}

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: items }));
}

export function addToCart(productId, quantity = 1) {
  const items = getCart();
  const id = String(productId);
  const existing = items.find((item) => item.productId === id);
  const amount = Math.max(1, Number.parseInt(quantity, 10) || 1);
  if (existing) existing.quantity += amount;
  else items.push({ productId: id, quantity: amount });
  saveCart(items);
  return items;
}

export function updateCartQuantity(productId, quantity) {
  const nextQuantity = Number.parseInt(quantity, 10) || 0;
  const items = getCart().map((item) => item.productId === String(productId) ? { ...item, quantity: nextQuantity } : item).filter((item) => item.quantity > 0);
  saveCart(items);
  return items;
}

export function removeFromCart(productId) {
  const items = getCart().filter((item) => item.productId !== String(productId));
  saveCart(items);
  return items;
}

export function removeCartItems(productIds) {
  const ids = new Set((productIds || []).map(String));
  const items = getCart().filter((item) => !ids.has(String(item.productId)));
  saveCart(items);
  return items;
}

export function clearCart() { saveCart([]); }
export function getCartItemCount() { return getCart().reduce((total, item) => total + item.quantity, 0); }
export function onCartChange(callback) {
  const handler = (event) => callback(event.detail ?? getCart());
  window.addEventListener(CART_EVENT, handler);
  return () => window.removeEventListener(CART_EVENT, handler);
}
