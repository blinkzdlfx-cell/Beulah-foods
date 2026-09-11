import {
  getCurrentSession,
  onAuthStateChange,
  signOutCustomer,
} from "../services/authService.js";
import { getCartItemCount, onCartChange } from "../services/cartService.js";

function ensureResponsiveHeaderStyles() {
  if (document.getElementById("beulah-header-responsive-styles")) return;
  const favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) { const link = document.createElement("link"); link.rel = "icon"; link.type = "image/webp"; link.href = "/storefront/assets/beulah-logo.webp"; document.head.append(link); }
  const style = document.createElement("style");
  style.id = "beulah-header-responsive-styles";
  style.textContent = `
    .site-header__menu-toggle, .site-header__menu { display: none; }
    .site-header__auth-link { margin-left: 8px; }
    .site-header__auth-button { min-height: 40px; padding: 9px 14px; font-size: .82rem; }
    .site-header__cart-link, .site-header__account-icon { position: relative; width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; margin-left: 4px; border: 1px solid var(--color-border); border-radius: 12px; color: var(--color-text); text-decoration: none; background: var(--color-surface); }
    .site-header__cart-link svg, .site-header__account-icon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .site-header__cart-link:hover, .site-header__account-icon:hover { background: var(--color-bg); color: var(--color-accent); }
    .site-header__cart-count { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; display: grid; place-items: center; border-radius: 999px; background: var(--color-accent); color: #fff; font-size: .68rem; font-weight: 800; }
    .site-header__mark { width: 44px; height: 44px; border-radius: 50%; background-color: var(--color-surface); background-image: url("/storefront/assets/beulah-logo.webp"); background-size: contain; background-position: center; background-repeat: no-repeat; color: transparent; overflow: hidden; }
    @media (max-width: 760px) {
      .site-header__links { display: none; }
      .site-header__menu-toggle { display: inline-flex; }
      .site-header__menu { position: absolute; top: calc(100% + 10px); right: 0; width: min(280px, calc(100vw - 24px)); display: grid; gap: 4px; padding: 8px; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); box-shadow: var(--shadow-md); }
      .site-header__menu[hidden] { display: none; }
      .site-header__menu-link { min-height: 46px; }
      .site-header__inner { position: relative; }
    }
  `;
  document.head.append(style);
}

export function initHeader(navEl) {
  if (!navEl) return;
  ensureResponsiveHeaderStyles();
  let lastSession = null;
  const render = (session) => { lastSession = session; renderNav(navEl, session); };
  getCurrentSession().then(render).catch(() => render(null));
  onAuthStateChange((_event, session) => render(session));
  onCartChange(() => render(lastSession));
}

function renderNav(navEl, session) {
  navEl.textContent = "";
  navEl.hidden = false;
  const signedIn = Boolean(session?.user);
  const desktopLinks = document.createElement("div");
  desktopLinks.className = "site-header__links";
  desktopLinks.append(createLink("index.html", "Home"), createLink("shop.html", "Shop"), createCartLink());
  if (signedIn) {
    const accountButton = createLink("account.html", "", "site-header__account-icon");
    accountButton.setAttribute("aria-label", "My account"); accountButton.title = "My account"; accountButton.innerHTML = personIcon(); desktopLinks.append(accountButton);
  } else {
    desktopLinks.append(createLink("login.html", "Log in", "site-header__auth-link"));
    desktopLinks.append(createLink("signup.html", "Create account", "btn btn-primary site-header__auth-button"));
  }
  const menuToggle = document.createElement("button");
  menuToggle.type = "button"; menuToggle.className = "site-header__menu-toggle"; menuToggle.setAttribute("aria-label", "Open menu"); menuToggle.setAttribute("aria-expanded", "false"); menuToggle.innerHTML = "<span></span><span></span><span></span>";
  const menu = document.createElement("div"); menu.className = "site-header__menu"; menu.hidden = true;
  menu.append(createLink("index.html", "Home", "site-header__menu-link"), createLink("shop.html", "Shop", "site-header__menu-link"), createCartLink("site-header__menu-link"));
  if (signedIn) menu.append(createLink("account.html", "My account", "site-header__menu-link"), createLogoutButton());
  else menu.append(createLink("login.html", "Log in", "site-header__menu-link"), createLink("signup.html", "Create account", "btn btn-primary site-header__menu-link"));
  menuToggle.addEventListener("click", (event) => { event.stopPropagation(); const nextOpen = menu.hidden; menu.hidden = !nextOpen; menuToggle.setAttribute("aria-expanded", String(nextOpen)); menuToggle.setAttribute("aria-label", nextOpen ? "Close menu" : "Open menu"); });
  if (!navEl.dataset.outsideClickBound) {
    document.addEventListener("click", (event) => { const activeToggle = navEl.querySelector(".site-header__menu-toggle"); const activeMenu = navEl.querySelector(".site-header__menu"); if (activeToggle && activeMenu && !navEl.contains(event.target)) { activeMenu.hidden = true; activeToggle.setAttribute("aria-expanded", "false"); activeToggle.setAttribute("aria-label", "Open menu"); } });
    navEl.dataset.outsideClickBound = "true";
  }
  navEl.append(desktopLinks, menuToggle, menu);
}
function createLink(href, text, className = "") { const link = document.createElement("a"); link.href = href; link.textContent = text; if (className) link.className = className; return link; }
function createCartLink(className = "") { const link = createLink("cart.html", "", className ? `${className} site-header__cart-link` : "site-header__cart-link"); link.setAttribute("aria-label", "Cart"); link.title = "Cart"; link.innerHTML = `${cartIcon()}<span class="site-header__cart-count">${getCartItemCount()}</span>`; return link; }
function createLogoutButton() { const button = document.createElement("button"); button.type = "button"; button.className = "site-header__menu-link site-header__logout"; button.textContent = "Log out"; button.addEventListener("click", async () => { button.disabled = true; try { await signOutCustomer(); window.location.href = "index.html"; } catch { button.disabled = false; } }); return button; }
function cartIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20.5 8H6"/><circle cx="10" cy="19" r="1.3"/><circle cx="18" cy="19" r="1.3"/></svg>'; }
function personIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-3.3 3-5 6.5-5s5.8 1.7 6.5 5"/></svg>'; }
