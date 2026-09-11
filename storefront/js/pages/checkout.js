import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { getCustomerProfile } from "../services/profileService.js";
import { getProducts } from "../services/catalogService.js";
import { getCart, clearCart } from "../services/cartService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));

const authNotice = document.getElementById("checkout-auth-notice");
const form = document.getElementById("checkout-form");
const summary = document.getElementById("checkout-items");
const subtotalEl = document.getElementById("checkout-subtotal");
const status = document.getElementById("checkout-status");
const submit = document.getElementById("checkout-submit");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
let checkoutItems = [];

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `checkout-status${type ? ` checkout-status--${type}` : ""}`;
  status.hidden = !message;
}

function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }

async function init() {
  const session = await getCurrentSession();
  if (!session?.user) {
    authNotice.hidden = false;
    form.hidden = true;
    authNotice.innerHTML = 'Please <a href="/login.html?redirect=checkout.html">log in</a> to continue to checkout.';
    return;
  }

  const cart = getCart();
  if (!cart.length) {
    setStatus("Your cart is empty. Add products before checking out.", "error");
    form.hidden = true;
    return;
  }

  const [profile, products] = await Promise.all([getCustomerProfile(), getProducts()]);
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  checkoutItems = cart.map((item) => ({ ...item, product: productMap.get(item.productId) })).filter((item) => item.product);
  if (!checkoutItems.length) {
    setStatus("The products in your cart are no longer available. Please return to the shop.", "error");
    form.hidden = true;
    return;
  }

  renderSummary();
  document.getElementById("full-name").value = profile?.full_name ?? "";
  document.getElementById("phone").value = profile?.phone ?? "";
  document.getElementById("address").value = profile?.address ?? "";
  submit.disabled = false;
}

function renderSummary() {
  summary.innerHTML = "";
  let subtotal = 0;
  for (const item of checkoutItems) {
    const quantity = Math.max(1, Math.min(item.quantity, Number(item.product.stock_quantity) || 1));
    const lineTotal = Number(item.product.price) * quantity;
    subtotal += lineTotal;
    const row = document.createElement("div");
    row.className = "checkout-item";
    row.innerHTML = `<span>${escapeHtml(item.product.name)} × ${quantity}</span><strong>${naira.format(lineTotal)}</strong>`;
    summary.append(row);
  }
  subtotalEl.textContent = naira.format(subtotal);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  submit.disabled = true;
  submit.textContent = "Creating reservation…";

  try {
    const cartItems = checkoutItems.map(({ productId, quantity }) => ({ productId, quantity }));
    const { data, error } = await supabase.rpc("create_pending_order", {
      cart_items: cartItems,
      delivery_name: form.elements.fullName.value.trim(),
      delivery_phone: form.elements.phone.value.trim(),
      delivery_address: form.elements.address.value.trim(),
    });
    if (error) throw error;

    clearCart();
    setStatus(`Order ${data.order_id.slice(0, 8)} created and reserved for 15 minutes. Payment is not connected yet.`, "success");
    submit.textContent = "Payment not connected";
    submit.disabled = true;
  } catch (error) {
    console.error(error);
    submit.disabled = false;
    submit.textContent = "Continue";
    const message = error?.message ?? "";
    if (message.includes("INSUFFICIENT_STOCK")) setStatus("One or more products no longer have enough stock. Please return to your cart and adjust the quantities.", "error");
    else if (message.includes("PRODUCT_UNAVAILABLE")) setStatus("One or more products are no longer available. Please return to your cart.", "error");
    else if (message.includes("DELIVERY_DETAILS_REQUIRED")) setStatus("Please complete your delivery details.", "error");
    else setStatus("We could not create the order reservation. Please try again.", "error");
  }
});

init().catch((error) => { console.error(error); setStatus("We could not prepare checkout. Please try again.", "error"); });
