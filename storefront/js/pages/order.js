import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));
const status = document.getElementById("order-status");
const itemsEl = document.getElementById("order-items");
const totalEl = document.getElementById("order-total");
const title = document.getElementById("order-title");
const meta = document.getElementById("order-meta");
const reservationBox = document.getElementById("order-reservation");
const reservationMessage = document.getElementById("order-reservation-message");
const reservationCountdown = document.getElementById("order-reservation-countdown");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
let reservationTimer = null;

function show(message, error = false) { status.textContent = message; status.className = `alert${error ? " alert-error" : ""}`; status.hidden = false; }

async function init() {
  const session = await getCurrentSession();
  if (!session?.user) { window.location.href = "/login.html?redirect=order.html"; return; }
  const id = new URLSearchParams(location.search).get("id");
  if (!id) { show("No order was specified.", true); return; }

  const [{ data: order, error: orderError }, { data: items, error: itemError }, { data: reservation, error: reservationError }] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,payment_status,subtotal,delivery_fee,discount_amount,total,promo_code,created_at,delivery_name,delivery_phone,delivery_address").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("product_name,unit_price,quantity,line_total").eq("order_id", id).order("created_at"),
    supabase.from("reservations").select("id,status,expires_at").eq("order_id", id).maybeSingle(),
  ]);
  if (orderError || itemError || reservationError) throw orderError || itemError || reservationError;
  if (!order) { show("Order not found.", true); return; }

  const orderNumber = order.order_number || `Order ${order.id.slice(0, 8)}`;
  title.textContent = orderNumber;
  meta.textContent = `${new Date(order.created_at).toLocaleString("en-NG")} · ${formatStatus(order.status)} · payment ${formatStatus(order.payment_status)}`;
  itemsEl.innerHTML = (items || []).map((item) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${escapeHtml(item.product_name)} × ${item.quantity}</span><strong>${naira.format(Number(item.line_total))}</strong></div>`).join("");
  totalEl.innerHTML = `Subtotal: ${naira.format(Number(order.subtotal))}<br>Delivery: ${Number(order.delivery_fee) === 0 ? "Free" : naira.format(Number(order.delivery_fee))}<br>Discount${order.promo_code ? ` (${escapeHtml(order.promo_code)})` : ""}: ${naira.format(Number(order.discount_amount))}<br><strong>Total: ${naira.format(Number(order.total))}</strong>`;

  if (order.status === "pending_payment" && order.payment_status === "pending" && reservation?.status === "active" && Date.parse(reservation.expires_at) > Date.now()) renderReservation(reservation.expires_at);
}

function renderReservation(expiresAt) {
  reservationBox.hidden = false;
  reservationMessage.textContent = "Complete payment before the reservation expires.";
  updateReservationCountdown(expiresAt);
  reservationTimer = setInterval(() => updateReservationCountdown(expiresAt), 1000);
}
function updateReservationCountdown(expiresAt) {
  const remaining = Math.max(0, Date.parse(expiresAt) - Date.now());
  if (remaining <= 0) { if (reservationTimer) clearInterval(reservationTimer); reservationTimer = null; reservationCountdown.textContent = "Expired"; reservationMessage.textContent = "This reservation has expired. Return to your cart to start a new checkout."; return; }
  const totalSeconds = Math.ceil(remaining / 1000), minutes = Math.floor(totalSeconds / 60), seconds = totalSeconds % 60;
  reservationCountdown.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatStatus(value) { return String(value || "").replaceAll("_", " "); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }
init().catch((error) => { console.error(error); show("We could not load this order.", true); });
