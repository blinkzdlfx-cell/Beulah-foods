import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));
const status = document.getElementById("orders-status");
const list = document.getElementById("orders-list");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
let countdownTimer = null;

function show(message, error = false) {
  status.textContent = message;
  status.className = `alert${error ? " alert-error" : ""}`;
  status.hidden = false;
}

async function init() {
  const session = await getCurrentSession();
  if (!session?.user) {
    window.location.href = "/login.html?redirect=orders.html";
    return;
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,status,payment_status,subtotal,delivery_fee,discount_amount,total,created_at,promo_code")
    .order("created_at", { ascending: false });

  if (ordersError) throw ordersError;
  if (!orders?.length) {
    list.innerHTML = '<div class="orders-empty">You have no orders yet.</div>';
    return;
  }

  const orderIds = orders.map((order) => order.id);
  const { data: reservations, error: reservationError } = await supabase
    .from("reservations")
    .select("id,order_id,status,expires_at")
    .in("order_id", orderIds);

  if (reservationError) throw reservationError;

  const reservationMap = new Map((reservations || []).map((reservation) => [reservation.order_id, reservation]));

  list.innerHTML = orders.map((order) => {
    const reservation = reservationMap.get(order.id);
    const activeReservation = order.status === "pending_payment"
      && order.payment_status === "pending"
      && reservation?.status === "active"
      && Date.parse(reservation.expires_at) > Date.now();

    return `
      <article class="order-card">
        <a href="/order.html?id=${encodeURIComponent(order.id)}" class="order-card__main-link">
          <div class="order-card__top">
            <strong class="order-card__id">Order ${escapeHtml(order.id.slice(0, 8))}</strong>
            <span class="order-card__date">${escapeHtml(new Date(order.created_at).toLocaleString("en-NG"))}</span>
          </div>
          <div class="order-card__meta">
            <span class="order-card__status">${escapeHtml(formatStatus(order.status))}</span>
            <span class="order-card__status">Payment: ${escapeHtml(formatStatus(order.payment_status))}</span>
          </div>
          <div class="order-card__total">
            <span>Total</span>
            <strong>${naira.format(Number(order.total))}</strong>
          </div>
        </a>
        ${activeReservation ? `
          <div class="order-card__reservation">
            <div class="order-card__reservation-copy">
              <span class="order-card__reservation-label">Payment reserved</span>
              <small>Complete payment before the reservation expires.</small>
            </div>
            <strong class="order-card__countdown" data-expires-at="${escapeHtml(reservation.expires_at)}">--:--</strong>
          </div>
          <a class="order-card__retry" href="/checkout.html">Retry payment</a>
        ` : ""}
      </article>
    `;
  }).join("");

  updateCountdowns();
  if (list.querySelector("[data-expires-at]")) countdownTimer = setInterval(updateCountdowns, 1000);
}

function updateCountdowns() {
  let activeCount = 0;
  list.querySelectorAll("[data-expires-at]").forEach((element) => {
    const remaining = Math.max(0, Date.parse(element.dataset.expiresAt) - Date.now());
    if (remaining <= 0) {
      element.textContent = "Expired";
      return;
    }
    activeCount += 1;
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    element.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  });

  if (!activeCount && countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function formatStatus(value) {
  return String(value || "").replaceAll("_", " ");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

init().catch((error) => {
  console.error(error);
  show("We could not load your orders. Please try again.", true);
});
