import { supabase } from "./lib/supabaseClient.js";

async function refreshAvailableProducts() {
  const card = document.getElementById("available-product-count");
  if (!card) return;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("stock_quantity,reserved_quantity")
      .eq("is_active", true);
    if (error) throw error;
    const available = (data || []).reduce((total, item) => {
      const stock = Math.max(0, Number(item.stock_quantity) || 0);
      const reserved = Math.max(0, Number(item.reserved_quantity) || 0);
      return total + Math.max(0, stock - reserved);
    }, 0);
    card.textContent = available;
  } catch (error) {
    console.error("Could not load available product count", error);
    card.textContent = "—";
  }
}

function init() {
  const app = document.getElementById("admin-app");
  if (!app) return;
  if (!app.classList.contains("hidden")) refreshAvailableProducts();
  new MutationObserver(() => {
    if (!app.classList.contains("hidden")) refreshAvailableProducts();
  }).observe(app, { attributes: true, attributeFilter: ["class"] });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
