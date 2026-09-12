import { supabase } from "./lib/supabaseClient.js";

const form = document.getElementById("delivery-form");
const submit = document.getElementById("delivery-submit");
const alertBox = document.getElementById("admin-alert");

if (form && submit) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const id = document.getElementById("delivery-id").value;
    const deliveryEnabled = document.getElementById("delivery-enabled").checked;
    const freeDeliveryEnabled = document.getElementById("free-delivery-enabled").checked;
    const active = document.getElementById("delivery-active").checked;
    const feeValue = document.getElementById("delivery-fee").value.trim();
    const thresholdValue = document.getElementById("delivery-threshold").value.trim();

    try {
      if (freeDeliveryEnabled && !deliveryEnabled) throw new Error("Enable delivery charges before enabling free delivery.");
      if (deliveryEnabled && feeValue === "") throw new Error("Enter a delivery fee or turn off delivery charges.");
      if (freeDeliveryEnabled && thresholdValue === "") throw new Error("Enter a free-delivery threshold or turn off the free-delivery option.");

      submit.disabled = true;
      submit.textContent = "Saving…";

      if (active) {
        const { error } = await supabase
          .from("delivery_settings")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("is_active", true);
        if (error) throw error;
      }

      const payload = {
        delivery_fee: feeValue === "" ? null : Number(feeValue),
        free_delivery_threshold: thresholdValue === "" ? null : Number(thresholdValue),
        is_delivery_enabled: deliveryEnabled,
        is_free_delivery_enabled: freeDeliveryEnabled,
        is_active: active,
        updated_at: new Date().toISOString(),
      };

      const query = id
        ? supabase.from("delivery_settings").update(payload).eq("id", id)
        : supabase.from("delivery_settings").insert(payload);
      const { error } = await query;
      if (error) throw error;

      if (alertBox) {
        alertBox.textContent = "Delivery settings saved.";
        alertBox.className = "alert";
        alertBox.hidden = false;
      }
      window.dispatchEvent(new CustomEvent("beulah:delivery-saved"));
      submit.disabled = false;
      submit.textContent = "Save delivery settings";
    } catch (error) {
      if (alertBox) {
        alertBox.textContent = error?.message || "Could not save delivery settings.";
        alertBox.className = "alert error";
        alertBox.hidden = false;
      }
      submit.disabled = false;
      submit.textContent = "Save delivery settings";
    }
  }, true);
}
