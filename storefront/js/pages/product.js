import { initHeader } from "../components/navbar.js";
import { getProductBySlug } from "../services/catalogService.js";
import { addToCart } from "../services/cartService.js";

initHeader(document.getElementById("site-header-nav"));
const root = document.getElementById("product-detail");
const status = document.getElementById("product-status");
const slug = new URLSearchParams(window.location.search).get("slug");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }
function setStatus(message, type = "") { status.textContent = message; status.className = `product-status${type ? ` product-status--${type}` : ""}`; status.hidden = !message; }

async function init() {
  if (!slug) { setStatus("This product could not be found.", "error"); return; }
  try {
    const product = await getProductBySlug(slug);
    if (!product) { setStatus("This product is no longer available.", "error"); return; }
    const inStock = Number(product.stock_quantity) > 0;
    document.title = `${product.name} — Beulah Foods`;
    root.innerHTML = `<a class="product-back" href="shop.html">← Back to shop</a><div class="product-detail__grid"><div class="product-detail__media">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">` : '<span class="product-detail__placeholder">Product image</span>'}</div><div class="product-detail__content"><p class="eyebrow">Beulah Foods product</p><h1>${escapeHtml(product.name)}</h1><strong class="product-detail__price">${naira.format(Number(product.price))}</strong><p class="product-detail__description">${escapeHtml(product.description ?? "")}</p><p class="product-detail__stock ${inStock ? "" : "is-unavailable"}">${inStock ? "Available to order" : "Currently unavailable"}</p><div class="product-detail__actions"><label class="quantity-control"><span>Quantity</span><input id="product-quantity" type="number" min="1" value="1" inputmode="numeric" ${inStock ? "" : "disabled"}></label><button class="btn btn-primary" id="add-product" type="button" ${inStock ? "" : "disabled"}>${inStock ? "Add to cart" : "Unavailable"}</button></div><p class="product-detail__note">Final availability and pricing are rechecked from the live catalogue during checkout.</p><div id="product-feedback" class="product-feedback" role="status" aria-live="polite"></div></div></div>`;
    document.getElementById("add-product")?.addEventListener("click", () => { const quantity = Math.max(1, Number.parseInt(document.getElementById("product-quantity").value, 10) || 1); addToCart(product.id, quantity); document.getElementById("product-feedback").textContent = "Added to your cart."; });
  } catch (error) { console.error(error); setStatus("We could not load this product. Please return to the shop and try again.", "error"); }
}
init();
