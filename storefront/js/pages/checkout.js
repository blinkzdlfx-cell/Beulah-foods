import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { getCustomerProfile } from "../services/profileService.js";
import { getProductsByIds } from "../services/catalogService.js";
import { getCart } from "../services/cartService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));

const authNotice = document.getElementById("checkout-auth-notice");
const form = document.getElementById("checkout-form");
const summary = document.getElementById("checkout-items");
const subtotalEl = document.getElementById("checkout-subtotal");
const deliveryRow = document.getElementById("checkout-delivery-row");
const deliveryEl = document.getElementById("checkout-delivery");
const discountRow = document.getElementById("checkout-discount-row");
const discountEl = document.getElementById("checkout-discount");
const totalEl = document.getElementById("checkout-total");
const status = document.getElementById("checkout-status");
const submit = document.getElementById("checkout-submit");
const profileCard = document.getElementById("checkout-profile");
const profileMissing = document.getElementById("checkout-profile-missing");
const fullNameEl = document.getElementById("checkout-full-name");
const phoneEl = document.getElementById("checkout-phone");
const addressEl = document.getElementById("checkout-address");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
let checkoutItems = [];
let deliverySettings = null;
let pendingOrderId = null;
let currentSession = null;
let customerProfile = null;

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `checkout-status${type ? ` checkout-status--${type}` : ""}`;
  status.hidden = !message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function hasCompleteDeliveryProfile(profile) {
  return Boolean(
    profile?.full_name?.trim()
      && profile?.phone?.trim()
      && profile?.address?.trim(),
  );
}

function renderProfile(profile) {
  customerProfile = profile ?? null;

  const complete = hasCompleteDeliveryProfile(customerProfile);
  profileCard.hidden = !complete;
  profileMissing.hidden = complete;
  submit.disabled = !complete;

  fullNameEl.textContent = customerProfile?.full_name?.trim() || "—";
  phoneEl.textContent = customerProfile?.phone?.trim() || "—";
  addressEl.textContent = customerProfile?.address?.trim() || "—";

  if (!complete) {
    setStatus("Add your delivery details in My Account before continuing.", "error");
  } else {
    setStatus("");
  }
}

async function init() {
  currentSession = await getCurrentSession();
  if (!currentSession?.user) {
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

  const [profile, products, deliveryResult] = await Promise.all([
    getCustomerProfile(),
    getProductsByIds(cart.map((item) => item.productId)),
    supabase
      .from("delivery_settings")
      .select("delivery_fee,free_delivery_threshold,is_delivery_enabled,is_free_delivery_enabled")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (deliveryResult.error) throw deliveryResult.error;
  deliverySettings = deliveryResult.data;

  const productMap = new Map(products.map((product) => [String(product.id), product]));
  checkoutItems = cart
    .map((item) => ({ ...item, product: productMap.get(item.productId) }))
    .filter((item) => item.product);

  if (!checkoutItems.length) {
    setStatus("The products in your cart are no longer available. Please return to the shop.", "error");
    form.hidden = true;
    return;
  }

  renderSummary();
  renderProfile(profile);

  form.hidden = false;
}

function isDeliveryEnabled() {
  return Boolean(deliverySettings?.is_delivery_enabled);
}

function calculateLocalDelivery(subtotal) {
  if (!isDeliveryEnabled()) return 0;

  const fee = Number(deliverySettings?.delivery_fee ?? 0);
  const freeEnabled = Boolean(deliverySettings?.is_free_delivery_enabled);
  const threshold = Number(deliverySettings?.free_delivery_threshold ?? 0);

  if (freeEnabled && subtotal >= threshold) return 0;
  return fee;
}

function getLocalSubtotal() {
  return checkoutItems.reduce(
    (total, item) => total + Number(item.product.price) * Math.max(1, Number.parseInt(item.quantity, 10) || 1),
    0,
  );
}

function renderSummary(totals = null) {
  summary.innerHTML = "";

  for (const item of checkoutItems) {
    const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
    const lineTotal = Number(item.product.price) * quantity;
    const row = document.createElement("div");
    row.className = "checkout-item";
    row.innerHTML = `<span>${escapeHtml(item.product.name)} × ${quantity}</span><strong>${naira.format(lineTotal)}</strong>`;
    summary.append(row);
  }

  const subtotal = totals ? Number(totals.subtotal) : getLocalSubtotal();
  const deliveryEnabled = totals ? Boolean(totals.delivery_enabled) : isDeliveryEnabled();
  const delivery = totals ? Number(totals.delivery_fee) : calculateLocalDelivery(subtotal);
  const discount = totals ? Number(totals.discount) : 0;
  const total = totals ? Number(totals.total) : subtotal + delivery - discount;

  subtotalEl.textContent = naira.format(subtotal);
  deliveryRow.hidden = !deliveryEnabled;
  deliveryEl.textContent = delivery === 0 ? "Free" : naira.format(delivery);
  discountRow.hidden = !discount;
  discountEl.textContent = discount ? `−${naira.format(discount)}` : "—";
  totalEl.textContent = naira.format(total);
}

async function initializePayment(orderId) {
  const response = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentSession.access_token}`,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "PAYMENT_INITIALIZATION_FAILED");
    error.code = data?.error;
    throw error;
  }

  if (!data.authorization_url) {
    throw new Error("PAYMENT_INITIALIZATION_FAILED");
  }

  window.location.href = data.authorization_url;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  if (!hasCompleteDeliveryProfile(customerProfile)) {
    setStatus("Add your delivery details in My Account before continuing.", "error");
    return;
  }

  submit.disabled = true;
  submit.textContent = pendingOrderId ? "Opening payment…" : "Preparing payment…";

  try {
    if (!pendingOrderId) {
      const cartItems = checkoutItems.map(({ productId, quantity }) => ({ productId, quantity }));
      const { data, error } = await supabase.rpc("create_pending_order", {
        cart_items: cartItems,
        delivery_name: customerProfile.full_name.trim(),
        delivery_phone: customerProfile.phone.trim(),
        delivery_address: customerProfile.address.trim(),
        requested_promo_code: form.elements.promoCode.value.trim() || null,
      });

      if (error) throw error;
      pendingOrderId = data.order_id;
      renderSummary(data);
    }

    await initializePayment(pendingOrderId);
  } catch (error) {
    console.error(error);
    if (error?.code === "ORDER_NOT_PAYABLE") pendingOrderId = null;

    submit.disabled = false;
    submit.textContent = pendingOrderId ? "Retry payment" : "Continue to payment";

    const message = error?.message ?? "";
    if (message.includes("INSUFFICIENT_STOCK")) {
      setStatus("One or more products no longer have enough stock. Please return to your cart and adjust the quantities.", "error");
    } else if (message.includes("PRODUCT_UNAVAILABLE")) {
      setStatus("One or more products are no longer available. Please return to your cart.", "error");
    } else if (message.includes("DELIVERY_DETAILS_REQUIRED")) {
      setStatus("Add your delivery details in My Account before continuing.", "error");
    } else if (message.includes("DELIVERY_CONFIGURATION_INVALID")) {
      setStatus("Delivery is temporarily unavailable. Please try again later.", "error");
    } else if (message.includes("PROMO_INVALID")) {
      setStatus("That promo code is invalid or inactive.", "error");
    } else if (message.includes("PROMO_MINIMUM_NOT_MET")) {
      setStatus("This promo code does not meet the minimum order amount.", "error");
    } else if (message.includes("PAYMENT_INITIALIZATION_FAILED")) {
      setStatus("Your order is reserved, but payment could not be opened. Please try again.", "error");
    } else {
      setStatus("We could not prepare the payment. Please try again.", "error");
    }
  }
});

init().catch((error) => {
  console.error(error);
  setStatus("We could not prepare checkout. Please try again.", "error");
});
