const ACTIVE_PATHS = new Map([
  ["home", new Set(["/", "/index"])],
  ["shop", new Set(["/shop", "/product"])],
  ["cart", new Set(["/cart", "/checkout", "/payment-callback"])],
]);

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.replace(/\.html$/, "");
}

function updateActiveNavigation() {
  const nav = document.getElementById("site-header-nav");
  if (!nav) return;
  const current = normalizePath(window.location.pathname);
  let activeKey = null;
  for (const [key, paths] of ACTIVE_PATHS) {
    if (paths.has(current)) {
      activeKey = key;
      break;
    }
  }

  nav.querySelectorAll("a").forEach((link) => {
    const path = normalizePath(new URL(link.href, window.location.origin).pathname);
    let key = null;
    if (path === "/" || path === "/index") key = "home";
    else if (path === "/shop" || path === "/product") key = "shop";
    else if (path === "/cart") key = "cart";
    const active = Boolean(activeKey && key === activeKey);
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function init() {
  updateActiveNavigation();
  const nav = document.getElementById("site-header-nav");
  if (!nav) return;
  new MutationObserver(updateActiveNavigation).observe(nav, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
