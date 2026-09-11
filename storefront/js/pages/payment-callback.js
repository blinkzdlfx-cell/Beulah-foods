import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";

const title = document.getElementById("payment-title");
const message = document.getElementById("payment-message");
const status = document.getElementById("payment-status");
const reference = new URLSearchParams(window.location.search).get("reference");

function show(text, type = "") {
  status.textContent = text;
  status.className = `alert${type ? ` alert-${type}` : ""}`;
}

async function init() {
  if (!reference) { title.textContent = "Payment reference missing"; message.textContent = "We could not verify this payment."; show("No payment reference was supplied.", "error"); return; }
  const session = await getCurrentSession();
  if (!session?.access_token) { title.textContent = "Sign in required"; message.textContent = "Sign in to verify and view this order."; show("Please sign in, then open your orders.", "error"); return; }

  try {
    const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "PAYMENT_VERIFICATION_FAILED");

    if (data.payment_status === "successful") {
      title.textContent = "Payment confirmed";
      message.textContent = "Your payment has been verified. Your order is now paid.";
      show(`Order ${String(data.order_id).slice(0, 8)} is confirmed.`, "success");
      if (data.order_id) setTimeout(() => { window.location.href = `/order.html?id=${encodeURIComponent(data.order_id)}`; }, 1200);
      return;
    }

    title.textContent = "Payment not completed";
    message.textContent = "The payment provider did not report a successful payment. Your reservation has been released when applicable.";
    show("Payment was not confirmed.", "error");
  } catch (error) {
    console.error(error);
    title.textContent = "Payment status unavailable";
    message.textContent = "We could not confirm the payment right now. Check My Orders before trying to pay again.";
    show("We could not verify the payment. Your order status remains controlled by the payment provider.", "error");
  }
}

init();
