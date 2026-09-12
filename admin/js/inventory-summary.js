import { supabase } from "./lib/supabaseClient.js";

async function refreshAvailableProducts() {
  const card = document.getElementById("available-product-count");
  if (!card) return;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("stock_quantity")
      .eq("is_active", true);
    if (error) throw error;
    const available = (data || []).reduce((total, item) => total + Math.max(0, Number(item.stock_quantity) || 0), 0);
    card.textContent = available;
  } catch (error) {
    console.error("Could not load available product count", error);
    card.textContent = "—";
  }
}

function init() {
  const app = document.getElementById("admin-app");
  if (!app) return;
  const refresh = () => {
    if (!app.classList.contains("hidden")) refreshAvailableProducts();
  };
  refresh();
  window.addEventListener("beulah:admin-inventory-refresh", refresh);
  window.addEventListener("beulah:delivery-saved", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  setInterval(refresh, 30000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
