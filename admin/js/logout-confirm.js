import { supabase } from "./lib/supabaseClient.js";
import { signOutAdmin } from "./services/adminAuthService.js";

const button = document.getElementById("admin-logout");

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function createModal({ title, message, confirmLabel = "Delete", danger = true }) {
  const modal = document.createElement("div");
  modal.className = "logout-modal admin-confirm-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="logout-modal__backdrop" data-close></div>
    <section class="logout-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-copy">
      <div class="logout-modal__icon ${danger ? "admin-confirm-modal__icon--danger" : ""}" aria-hidden="true">${danger ? "!" : "✓"}</div>
      <h2 id="admin-confirm-title">${escapeHtml(title)}</h2>
      <p id="admin-confirm-copy">${escapeHtml(message)}</p>
      <div class="logout-modal__actions">
        <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    </section>
  `;
  document.body.append(modal);
  return modal;
}

function openConfirm({ title, message, confirmLabel = "Delete", onConfirm }) {
  const modal = createModal({ title, message, confirmLabel });
  const confirmButton = modal.querySelector("[data-confirm]");
  const close = () => {
    modal.hidden = true;
    setTimeout(() => modal.remove(), 160);
  };

  modal.hidden = false;
  modal.querySelector("[data-cancel]").focus();

  const cleanup = () => {
    document.removeEventListener("keydown", onKeydown);
    modal.removeEventListener("click", onClick);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      cleanup();
      close();
    }
  };
  const onClick = async (event) => {
    if (event.target.closest("[data-close], [data-cancel]")) {
      cleanup();
      close();
      return;
    }
    if (!event.target.closest("[data-confirm]") || confirmButton.disabled) return;
    confirmButton.disabled = true;
    confirmButton.textContent = "Deleting…";
    try {
      await onConfirm();
      cleanup();
      close();
    } catch (error) {
      confirmButton.disabled = false;
      confirmButton.textContent = confirmLabel;
      const copy = modal.querySelector("#admin-confirm-copy");
      copy.textContent = error?.message || "The action could not be completed.";
    }
  };

  modal.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
}

if (button) {
  const modal = createModal({
    title: "Log out?",
    message: "Are you sure you want to log out of Beulah Foods Admin?",
    confirmLabel: "Log out",
    danger: true,
  });
  modal.remove();

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openConfirm({
      title: "Log out?",
      message: "Are you sure you want to log out of Beulah Foods Admin?",
      confirmLabel: "Log out",
      onConfirm: async () => {
        await signOutAdmin();
        window.location.reload();
      },
    });
  }, true);
}

const deliveryRows = document.getElementById("delivery-rows");
const promoRows = document.getElementById("promo-rows");
const adminAlert = document.getElementById("admin-alert");

function showAdminAlert(message, error = false) {
  if (!adminAlert) return;
  adminAlert.textContent = message;
  adminAlert.className = `alert${error ? " error" : ""}`;
  adminAlert.hidden = false;
}

async function refreshDeliveryTable() {
  if (!deliveryRows) return;
  const { data, error } = await supabase
    .from("delivery_settings")
    .select("id,delivery_fee,is_delivery_enabled,is_active,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  deliveryRows.innerHTML = (data || []).map((item) => {
    const deliveryLabel = item.is_delivery_enabled ? `On · ${formatNaira(item.delivery_fee)}` : "Off";
    return `<tr><td>${deliveryLabel}</td><td>—</td><td>${item.is_active ? '<span class="badge">Active</span>' : 'Inactive'}</td><td><button class="btn btn-secondary" data-delivery-edit="${item.id}">Edit</button> <button class="btn btn-secondary" data-delivery-toggle="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button> <button class="btn btn-secondary" data-delivery-delete="${item.id}">Delete</button></td></tr>`;
  }).join("") || '<tr><td colspan="4" class="muted">No delivery settings. Checkout will work without delivery charges.</td></tr>';

  window.dispatchEvent(new CustomEvent("beulah:delivery-table-refreshed"));
}

window.addEventListener("beulah:delivery-saved", () => {
  refreshDeliveryTable().catch((error) => showAdminAlert(error?.message || "Could not refresh delivery settings.", true));
});

function handleDeleteClick(event) {
  const deliveryButton = event.target.closest("[data-delivery-delete]");
  const promoButton = event.target.closest("[data-promo-delete]");
  if (!deliveryButton && !promoButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const isDelivery = Boolean(deliveryButton);
  const id = (deliveryButton || promoButton).dataset[isDelivery ? "deliveryDelete" : "promoDelete"];
  const title = isDelivery ? "Delete delivery settings?" : "Delete promo code?";
  const message = isDelivery
    ? "This delivery setting will be permanently removed."
    : "This promo code will be permanently removed.";

  openConfirm({
    title,
    message,
    confirmLabel: "Delete",
    onConfirm: async () => {
      const table = isDelivery ? deliveryRows : promoRows;
      const tableButton = table?.querySelector(`[data-${isDelivery ? "delivery-delete" : "promo-delete"}="${CSS.escape(id)}"]`);
      const row = tableButton?.closest("tr");
      const { error } = await supabase
        .from(isDelivery ? "delivery_settings" : "promo_codes")
        .delete()
        .eq("id", id);
      if (error) throw error;
      row?.remove();
      if (isDelivery) {
        await refreshDeliveryTable();
        window.dispatchEvent(new CustomEvent("beulah:delivery-saved"));
      } else if (promoRows && !promoRows.querySelector("tr")) {
        promoRows.innerHTML = '<tr><td colspan="5" class="muted">No promo codes yet.</td></tr>';
      }
      showAdminAlert(isDelivery ? "Delivery settings deleted." : "Promo code deleted.");
    },
  });
}

document.addEventListener("click", handleDeleteClick, true);
