import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";

const rows = document.getElementById("rows");
const status = document.getElementById("status");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
const statuses = ["pending_payment", "paid", "processing", "completed", "cancelled"];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[character]));
}

function showStatus(message, error = false) {
  status.textContent = message;
  status.className = `alert${error ? " error" : ""}`;
  status.hidden = false;
}

async function init() {
  const access = await requireAdmin();
  if (!access) {
    location.href = "/admin/";
    return;
  }
  await loadOrders();
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id,customer_id,total,payment_status,status,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  rows.innerHTML = (data || []).map((order) => {
    const options = statuses.map((value) => `<option value="${value}" ${value === order.status ? "selected" : ""}>${value.replaceAll("_", " ")}</option>`).join("");
    return `<tr>
      <td>${escapeHtml(order.id.slice(0, 8))}</td>
      <td>${escapeHtml(order.customer_id.slice(0, 8))}</td>
      <td>${naira.format(Number(order.total))}</td>
      <td>${escapeHtml(order.payment_status)}</td>
      <td><select class="order-status-select" data-order-id="${escapeHtml(order.id)}">${options}</select></td>
      <td>${escapeHtml(new Date(order.created_at).toLocaleString("en-NG"))}</td>
    </tr>`;
  }).join("") || '<tr><td colspan="6">No orders yet.</td></tr>';

  rows.querySelectorAll(".order-status-select").forEach((select) => {
    select.addEventListener("change", () => updateStatus(select));
  });
}

async function updateStatus(select) {
  const orderId = select.dataset.orderId;
  const nextStatus = select.value;
  select.disabled = true;
  try {
    const { error } = await supabase.rpc("admin_update_order_status", {
      target_order_id: orderId,
      target_status: nextStatus,
    });
    if (error) throw error;
    showStatus("Order status updated.");
  } catch (error) {
    console.error(error);
    showStatus(error?.message || "Could not update order status.", true);
    await loadOrders();
  } finally {
    select.disabled = false;
  }
}

init().catch((error) => {
  console.error(error);
  showStatus("Could not load orders.", true);
});
