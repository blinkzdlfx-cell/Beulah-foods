import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin, signInAdmin, signOutAdmin } from "./services/adminAuthService.js";

const loginView = document.getElementById("admin-login");
const appView = document.getElementById("admin-app");
const loginForm = document.getElementById("admin-login-form");
const loginAlert = document.getElementById("admin-login-alert");
const appAlert = document.getElementById("admin-alert");
const categoryForm = document.getElementById("category-form");
const productForm = document.getElementById("product-form");
const categoryRows = document.getElementById("category-rows");
const productRows = document.getElementById("product-rows");
const categorySelect = document.getElementById("product-category");
const productId = document.getElementById("product-id");

let categories = [];
let products = [];

init();

async function init() {
  try {
    const access = await requireAdmin();
    if (!access) { showLogin(); return; }
    showApp(access.admin.display_name || access.session.user.email);
    await loadAll();
  } catch (error) {
    console.error(error);
    showLogin();
    showAlert(loginAlert, "Admin authorization is not available. Apply the admin migration and provision an admin account first.", true);
  }
}

function showLogin() { loginView.classList.remove("hidden"); appView.classList.add("hidden"); }
function showApp(name) { loginView.classList.add("hidden"); appView.classList.remove("hidden"); document.getElementById("admin-name").textContent = name; }
function showAlert(element, message, error = false) { element.textContent = message; element.className = `alert${error ? " error" : ""}`; element.hidden = false; }
function clearAlert(element) { element.hidden = true; }

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); clearAlert(loginAlert);
  const submit = loginForm.querySelector("button[type=submit]"); submit.disabled = true;
  try { const result = await signInAdmin({ email: loginForm.email.value.trim(), password: loginForm.password.value }); showApp(result.admin.display_name || result.session.user.email); await loadAll(); }
  catch (error) { showAlert(loginAlert, error?.message || "Unable to sign in.", true); }
  finally { submit.disabled = false; }
});

document.getElementById("admin-logout").addEventListener("click", async () => { await signOutAdmin(); window.location.reload(); });

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault(); clearAlert(appAlert);
  const values = Object.fromEntries(new FormData(categoryForm));
  try {
    const { error } = await supabase.from("categories").insert({ name: values.name.trim(), slug: slugify(values.name), description: values.description.trim(), sort_order: Number(values.sort_order) || 0, is_active: true });
    if (error) throw error;
    categoryForm.reset(); await loadAll(); showAlert(appAlert, "Category saved.");
  } catch (error) { showAlert(appAlert, error?.message || "Could not save category.", true); }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault(); clearAlert(appAlert);
  const values = Object.fromEntries(new FormData(productForm));
  const payload = { category_id: values.category_id || null, name: values.name.trim(), slug: slugify(values.name), description: values.description.trim(), price: Number(values.price), image_url: values.image_url.trim() || null, stock_quantity: Math.max(0, Number.parseInt(values.stock_quantity, 10) || 0), sort_order: Number(values.sort_order) || 0, is_active: values.is_active === "on" };
  try {
    const query = productId.value ? supabase.from("products").update(payload).eq("id", productId.value) : supabase.from("products").insert(payload);
    const { error } = await query; if (error) throw error;
    productForm.reset(); productId.value = ""; document.getElementById("product-submit").textContent = "Save product"; await loadAll(); showAlert(appAlert, "Product saved.");
  } catch (error) { showAlert(appAlert, error?.message || "Could not save product.", true); }
});

document.getElementById("cancel-product").addEventListener("click", () => { productForm.reset(); productId.value = ""; document.getElementById("product-submit").textContent = "Save product"; });

async function loadAll() { await Promise.all([loadCategories(), loadProducts()]); }
async function loadCategories() {
  const { data, error } = await supabase.from("categories").select("id,name,slug,description,sort_order,is_active").order("sort_order").order("name");
  if (error) throw error; categories = data || [];
  categoryRows.innerHTML = categories.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.slug)}</td><td>${item.is_active ? '<span class="badge">Active</span>' : 'Inactive'}</td><td><button class="btn btn-secondary" data-category-id="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button></td></tr>`).join("") || '<tr><td colspan="4" class="muted">No categories yet.</td></tr>';
  categorySelect.innerHTML = '<option value="">Uncategorised</option>' + categories.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  categoryRows.querySelectorAll("button[data-category-id]").forEach((button) => button.addEventListener("click", () => toggleCategory(button.dataset.categoryId)));
}
async function loadProducts() {
  const { data, error } = await supabase.from("products").select("id,category_id,name,slug,price,image_url,stock_quantity,reserved_quantity,sort_order,is_active,categories(name)").order("sort_order").order("name");
  if (error) throw error; products = data || [];
  productRows.innerHTML = products.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.categories?.name ? escapeHtml(item.categories.name) : "—"}</td><td>₦${Number(item.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td><td>${item.stock_quantity}</td><td>${item.is_active ? '<span class="badge">Active</span>' : 'Inactive'}</td><td><button class="btn btn-secondary" data-edit-product="${item.id}">Edit</button> <button class="btn btn-secondary" data-toggle-product="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button></td></tr>`).join("") || '<tr><td colspan="6" class="muted">No products yet.</td></tr>';
  productRows.querySelectorAll("[data-edit-product]").forEach((button) => button.addEventListener("click", () => editProduct(button.dataset.editProduct)));
  productRows.querySelectorAll("[data-toggle-product]").forEach((button) => button.addEventListener("click", () => toggleProduct(button.dataset.toggleProduct)));
  document.getElementById("product-count").textContent = products.length;
  document.getElementById("active-count").textContent = products.filter((item) => item.is_active).length;
  document.getElementById("low-stock-count").textContent = products.filter((item) => item.stock_quantity <= 5 && item.is_active).length;
}

async function toggleCategory(id) { const item = categories.find((entry) => entry.id === id); if (!item) return; const { error } = await supabase.from("categories").update({ is_active: !item.is_active }).eq("id", id); if (error) showAlert(appAlert, error.message, true); else await loadCategories(); }
async function toggleProduct(id) { const item = products.find((entry) => entry.id === id); if (!item) return; const { error } = await supabase.from("products").update({ is_active: !item.is_active }).eq("id", id); if (error) showAlert(appAlert, error.message, true); else await loadProducts(); }
function editProduct(id) { const item = products.find((entry) => entry.id === id); if (!item) return; productId.value = item.id; productForm.name.value = item.name; productForm.category_id.value = item.category_id || ""; productForm.description.value = item.description || ""; productForm.price.value = item.price; productForm.image_url.value = item.image_url || ""; productForm.stock_quantity.value = item.stock_quantity; productForm.sort_order.value = item.sort_order; productForm.is_active.checked = item.is_active; document.getElementById("product-submit").textContent = "Update product"; window.scrollTo({ top: 0, behavior: "smooth" }); }
function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }
