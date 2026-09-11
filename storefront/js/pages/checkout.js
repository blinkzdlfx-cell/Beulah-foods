import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { getCustomerProfile } from "../services/profileService.js";
import { getProducts } from "../services/catalogService.js";
import { getCart } from "../services/cartService.js";
initHeader(document.getElementById("site-header-nav"));
const authNotice = document.getElementById("checkout-auth-notice"), form = document.getElementById("checkout-form"), summary = document.getElementById("checkout-items"), subtotalEl = document.getElementById("checkout-subtotal"), status = document.getElementById("checkout-status"), submit = document.getElementById("checkout-submit");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
function setStatus(message, type = "") { status.textContent = message; status.className = `checkout-status${type ? ` checkout-status--${type}` : ""}`; status.hidden = !message; }
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }
async function init() {
  const session = await getCurrentSession();
  if (!session?.user) { authNotice.hidden = false; form.hidden = true; authNotice.innerHTML = 'Please <a href="login.html?redirect=checkout.html">log in</a> to continue to checkout.'; return; }
  const cart = getCart();
  if (!cart.length) { setStatus("Your cart is empty. Add products before checking out.", "error"); form.hidden = true; return; }
  const [profile, products] = await Promise.all([getCustomerProfile(), getProducts()]);
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const items = cart.map((item) => ({ ...item, product: productMap.get(item.productId) })).filter((item) => item.product);
  if (!items.length) { setStatus("The products in your cart are no longer available. Please return to the shop.", "error"); form.hidden = true; return; }
  summary.innerHTML = ""; let subtotal = 0;
  for (const item of items) { const quantity = Math.max(1, Math.min(item.quantity, Number(item.product.stock_quantity) || 1)); subtotal += Number(item.product.price) * quantity; const row = document.createElement("div"); row.className = "checkout-item"; row.innerHTML = `<span>${escapeHtml(item.product.name)} × ${quantity}</span><strong>${naira.format(Number(item.product.price) * quantity)}</strong>`; summary.append(row); }
  subtotalEl.textContent = naira.format(subtotal);
  document.getElementById("full-name").value = profile?.full_name ?? "";
  document.getElementById("phone").value = profile?.phone ?? "";
  document.getElementById("address").value = profile?.address ?? "";
  form.addEventListener("submit", (event) => { event.preventDefault(); setStatus("Payment processing is not connected yet. No order has been created.", "error"); });
  submit.disabled = false;
}
init().catch((error) => { console.error(error); setStatus("We could not prepare checkout. Please try again.", "error"); });
