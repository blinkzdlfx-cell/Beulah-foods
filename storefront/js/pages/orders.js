import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));
const status = document.getElementById("orders-status");
const list = document.getElementById("orders-list");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
function show(message, error = false) { status.textContent = message; status.className = `alert${error ? " alert-error" : ""}`; status.hidden = false; }

async function init() {
  const session = await getCurrentSession();
  if (!session?.user) { window.location.href = "/login.html?redirect=orders.html"; return; }
  const { data, error } = await supabase.from("orders").select("id,status,payment_status,subtotal,delivery_fee,discount_amount,total,created_at,promo_code").order("created_at", { ascending: false });
  if (error) throw error;
  if (!data?.length) { show("You have no orders yet."); return; }
  list.innerHTML = data.map((order) => `<a class="card" style="display:block;text-decoration:none;color:inherit" href="/order.html?id=${encodeURIComponent(order.id)}"><div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><strong>Order ${order.id.slice(0,8)}</strong><span>${new Date(order.created_at).toLocaleString("en-NG")}</span></div><p style="margin:8px 0;color:var(--color-text-muted)">${order.status} · payment ${order.payment_status}</p><p style="margin:8px 0;color:var(--color-text-muted)">Delivery ${naira.format(Number(order.delivery_fee))}${order.discount_amount ? ` · Discount ${naira.format(Number(order.discount_amount))}` : ""}</p><strong>${naira.format(Number(order.total))}</strong></a>`).join("");
}
init().catch((error) => { console.error(error); show("We could not load your orders. Please try again.", true); });
