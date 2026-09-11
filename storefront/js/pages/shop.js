import { initHeader } from "../components/navbar.js";
import { getCategories, getProducts } from "../services/catalogService.js";
import { addToCart } from "../services/cartService.js";

initHeader(document.getElementById("site-header-nav"));
const grid = document.getElementById("product-grid");
const categoryList = document.getElementById("category-list");
const status = document.getElementById("shop-status");
const emptyState = document.getElementById("shop-empty");
const count = document.getElementById("product-count");
const filterToggle = document.getElementById("mobile-filter-toggle");
const filters = document.getElementById("shop-filters");
let categories = [];
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });

function setStatus(message, type = "") { status.textContent = message; status.className = `shop-status${type ? ` shop-status--${type}` : ""}`; status.hidden = !message; }
function getSelectedCategory() { return document.querySelector('input[name="category"]:checked')?.value ?? ""; }
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }
function escapeAttribute(value) { return escapeHtml(value).replace(/'/g, "&#039;"); }

function renderCategories() {
  categoryList.innerHTML = "";
  const allLabel = document.createElement("label");
  allLabel.className = "filter-option";
  allLabel.innerHTML = '<input type="radio" name="category" value="" checked><span>All products</span>';
  categoryList.append(allLabel);
  for (const category of categories) {
    const label = document.createElement("label");
    label.className = "filter-option";
    label.innerHTML = `<input type="radio" name="category" value="${escapeAttribute(category.slug)}"><span>${escapeHtml(category.name)}</span>`;
    categoryList.append(label);
  }
  categoryList.addEventListener("change", loadProducts);
}

function renderProducts(products) {
  grid.innerHTML = "";
  count.textContent = `${products.length} product${products.length === 1 ? "" : "s"}`;
  emptyState.hidden = products.length > 0;
  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";
    const detailUrl = `product.html?slug=${encodeURIComponent(product.slug)}`;
    const inStock = Number(product.stock_quantity) > 0;
    card.innerHTML = `<a class="product-card__media" href="${detailUrl}" aria-label="View ${escapeAttribute(product.name)}"><span class="product-card__image-slot" aria-hidden="true"></span></a><div class="product-card__body"><p class="product-card__availability ${inStock ? "" : "is-unavailable"}">${inStock ? "Available" : "Currently unavailable"}</p><h2><a href="${detailUrl}">${escapeHtml(product.name)}</a></h2><p class="product-card__description">${escapeHtml(product.description ?? "")}</p><div class="product-card__footer"><strong>${naira.format(Number(product.price))}</strong><button class="btn btn-primary product-card__add" type="button" data-product-id="${escapeAttribute(product.id)}" ${inStock ? "" : "disabled"}>${inStock ? "Add to cart" : "Unavailable"}</button></div></div>`;
    card.querySelector(".product-card__add")?.addEventListener("click", () => { addToCart(product.id, 1); setStatus(`${product.name} added to your cart.`, "success"); });
    grid.append(card);
  }
}

async function loadProducts() {
  setStatus("Loading products...");
  try { renderProducts(await getProducts({ categorySlug: getSelectedCategory() })); setStatus(""); }
  catch (error) { console.error(error); renderProducts([]); setStatus("We could not load the product catalogue. Please try again.", "error"); }
}

filterToggle?.addEventListener("click", () => { const open = filters?.hidden; if (filters) filters.hidden = !open; filterToggle.setAttribute("aria-expanded", String(open)); });

(async function init() {
  try { categories = await getCategories(); renderCategories(); }
  catch (error) { console.error(error); categoryList.innerHTML = '<p class="filter-error">Categories are unavailable right now.</p>'; }
  await loadProducts();
})();
