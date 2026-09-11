import { initHeader } from "../components/navbar.js";
import { getProductBySlug } from "../services/catalogService.js";
import { addToCart } from "../services/cartService.js";

initHeader(document.getElementById("site-header-nav"));
const root = document.getElementById("product-detail");
const status = document.getElementById("product-status");
const slug = new URLSearchParams(window.location.search).get("slug");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])); }
function escapeAttribute(value) { return escapeHtml(value).replace(/'/g, "&#039;"); }
function setStatus(message, type = "") { status.textContent = message; status.className = `product-status${type ? ` product-status--${type}` : ""}`; status.hidden = !message; }
function setMeta(name, content) { let node = document.querySelector(`meta[name="${name}"]`); if (!node) { node = document.createElement("meta"); node.name = name; document.head.append(node); } node.content = content; }
function setProperty(property, content) { let node = document.querySelector(`meta[property="${property}"]`); if (!node) { node = document.createElement("meta"); node.setAttribute("property", property); document.head.append(node); } node.content = content; }

async function init() {
  if (!slug) { setStatus("This product could not be found.", "error"); return; }
  try {
    const product = await getProductBySlug(slug);
    if (!product) { setStatus("This product is no longer available.", "error"); return; }
    const inStock = Number(product.stock_quantity) > 0;
    const description = String(product.description || `Shop ${product.name} from Beulah Foods.`).trim();
    const canonicalUrl = `${window.location.origin}/product?slug=${encodeURIComponent(product.slug || slug)}`;
    document.title = `${product.name} — Beulah Foods`;
    setMeta("description", description.slice(0, 155));
    setMeta("robots", "index, follow, max-image-preview:large");
    setProperty("og:type", "product");
    setProperty("og:site_name", "Beulah Foods");
    setProperty("og:title", `${product.name} — Beulah Foods`);
    setProperty("og:description", description.slice(0, 200));
    setProperty("og:url", canonicalUrl);
    if (product.image_src) setProperty("og:image", product.image_src);

    const oldStructuredData = document.getElementById("product-structured-data");
    oldStructuredData?.remove();
    const structuredData = document.createElement("script");
    structuredData.id = "product-structured-data";
    structuredData.type = "application/ld+json";
    structuredData.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description,
      image: product.image_src ? [product.image_src] : undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "NGN",
        price: Number(product.price).toFixed(2),
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: canonicalUrl,
      },
    });
    document.head.append(structuredData);

    const media = product.image_src
      ? `<div class="product-detail__media"><img src="${escapeAttribute(product.image_src)}" alt="${escapeAttribute(product.name)}"></div>`
      : "";
    const gridClass = product.image_src ? "product-detail__grid" : "product-detail__grid product-detail__grid--no-media";
    const disabled = inStock ? "" : "disabled";
    root.innerHTML = `<a class="product-back" href="shop.html">← Back to shop</a><div class="${gridClass}">${media}<div class="product-detail__content"><p class="eyebrow">Beulah Foods product</p><h1>${escapeHtml(product.name)}</h1><strong class="product-detail__price">${naira.format(Number(product.price))}</strong><p class="product-detail__description">${escapeHtml(product.description ?? "")}</p><p class="product-detail__stock ${inStock ? "" : "is-unavailable"}">${inStock ? "Available to order" : "Currently unavailable"}</p><div class="product-detail__actions"><label class="quantity-control"><span>Quantity</span><input id="product-quantity" type="number" min="1" value="1" inputmode="numeric" ${disabled}></label><button class="btn btn-primary" id="add-product" type="button" ${disabled}>${inStock ? "Add to cart" : "Unavailable"}</button></div><p class="product-detail__note">Final availability and pricing are rechecked from the live catalogue during checkout.</p><div id="product-feedback" class="product-feedback" role="status" aria-live="polite"></div></div></div>`;
    document.getElementById("add-product")?.addEventListener("click", () => { const quantity = Math.max(1, Number.parseInt(document.getElementById("product-quantity").value, 10) || 1); addToCart(product.id, quantity); document.getElementById("product-feedback").textContent = "Added to your cart."; });
  } catch (error) { console.error(error); setStatus("We could not load this product. Please return to the shop and try again.", "error"); }
}
init();
