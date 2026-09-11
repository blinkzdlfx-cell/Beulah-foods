import { initHeader } from "../components/navbar.js";
import { getProductsByIds } from "../services/catalogService.js";
import { getCart, updateCartQuantity, removeFromCart } from "../services/cartService.js";
import { showToast } from "../components/toast.js";

initHeader(document.getElementById("site-header-nav"));
const list = document.getElementById("cart-list"), empty = document.getElementById("cart-empty"), summary = document.getElementById("cart-summary"), subtotalEl = document.getElementById("cart-subtotal"), status = document.getElementById("cart-status"), checkoutLink = document.getElementById("checkout-link");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
function setStatus(message, type = "") { status.textContent = message; status.className = `cart-status${type ? ` cart-status--${type}` : ""}`; status.hidden = !message; }
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }
function setQuantity(productId, quantity, max) {
  const nextQuantity = Math.max(1, Math.min(max, Number(quantity) || 1));
  updateCartQuantity(productId, nextQuantity);
  render();
  showToast(`Quantity updated to ${nextQuantity}.`);
}
async function render() {
  setStatus("Loading cart...");
  try {
    const cart = getCart();
    if (!cart.length) {
      list.innerHTML = "";
      empty.hidden = false;
      summary.hidden = true;
      checkoutLink.hidden = true;
      subtotalEl.textContent = naira.format(0);
      setStatus("");
      return;
    }

    const products = await getProductsByIds(cart.map((item) => item.productId));
    const productMap = new Map(products.map((product) => [String(product.id), product]));
    const validItems = cart.map((item) => ({ ...item, product: productMap.get(item.productId) })).filter((item) => item.product);
    list.innerHTML = "";
    let subtotal = 0;

    for (const item of validItems) {
      const product = item.product, max = Math.max(1, Number(product.stock_quantity) || 1), quantity = Math.min(item.quantity, max);
      subtotal += Number(product.price) * quantity;
      const row = document.createElement("article");
      row.className = "cart-item";
      const media = product.image_src
        ? `<a class="cart-item__media" href="product.html?slug=${encodeURIComponent(product.slug)}"><img src="${escapeHtml(product.image_src)}" alt="${escapeHtml(product.name)}"></a>`
        : "";
      row.innerHTML = `<div class="cart-item__media-wrap">${media}</div><div class="cart-item__content"><div><p class="eyebrow">Beulah Foods</p><h2><a href="product.html?slug=${encodeURIComponent(product.slug)}">${escapeHtml(product.name)}</a></h2><strong>${naira.format(Number(product.price))}</strong></div><div class="cart-item__controls"><div class="cart-quantity-control" role="group" aria-label="Quantity for ${escapeHtml(product.name)}"><button class="cart-quantity-button cart-quantity-button--minus" type="button" data-product-id="${escapeHtml(product.id)}" aria-label="Decrease quantity"${quantity <= 1 ? " disabled" : ""}>−</button><input class="cart-quantity" type="number" min="1" max="${max}" value="${quantity}" data-product-id="${escapeHtml(product.id)}" aria-label="Quantity"><button class="cart-quantity-button cart-quantity-button--plus" type="button" data-product-id="${escapeHtml(product.id)}" aria-label="Increase quantity"${quantity >= max ? " disabled" : ""}>+</button></div><button class="text-button cart-remove" type="button" data-product-id="${escapeHtml(product.id)}">Remove</button></div></div>`;

      const input = row.querySelector(".cart-quantity");
      row.querySelector(".cart-quantity-button--minus").addEventListener("click", () => setQuantity(product.id, Number(input.value) - 1, max));
      row.querySelector(".cart-quantity-button--plus").addEventListener("click", () => setQuantity(product.id, Number(input.value) + 1, max));
      input.addEventListener("change", (event) => setQuantity(product.id, event.target.value, max));
      row.querySelector(".cart-remove").addEventListener("click", () => { removeFromCart(product.id); render(); showToast(`${product.name} removed from cart.`); });
      list.append(row);
    }

    const hasItems = validItems.length > 0;
    empty.hidden = hasItems;
    summary.hidden = !hasItems;
    subtotalEl.textContent = naira.format(subtotal);
    checkoutLink.hidden = !hasItems;
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("We could not load your cart. Please try again.", "error");
    showToast("We could not load your cart. Please try again.", "error", 3600);
  }
}
render();
