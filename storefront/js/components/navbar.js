import { getCurrentSession, onAuthStateChange, signOutCustomer } from "../services/authService.js";
import { getCartItemCount, onCartChange } from "../services/cartService.js";

const page = (name) => `/${name}`;

function ensureStyles() {
  if (document.getElementById("beulah-header-responsive-styles")) return;
  const favicon = document.querySelector('link[rel="icon"]') || document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/webp";
  favicon.href = "/storefront/assets/favicon.webp";
  if (!favicon.parentNode) document.head.append(favicon);

  const style = document.createElement("style");
  style.id = "beulah-header-responsive-styles";
  style.textContent = `
    .site-header__menu-toggle,.site-header__menu{display:none}
    .site-header__links{align-items:center}
    .site-header__auth-link{margin-left:8px}
    .site-header__auth-button{min-height:40px;padding:9px 14px;font-size:.82rem}
    .site-header__cart-link,.site-header__account-icon{position:relative;width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;margin-left:4px;border:1px solid var(--color-border);border-radius:12px;color:var(--color-text);text-decoration:none;background:var(--color-surface)}
    .site-header__cart-link svg,.site-header__account-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .site-header__cart-link:hover,.site-header__account-icon:hover{background:var(--color-bg);color:var(--color-accent)}
    .site-header__cart-count{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border-radius:999px;background:var(--color-accent);color:#fff;font-size:.68rem;font-weight:800}
    .site-header__cart-label{display:none}
    .site-header__mark{width:44px;height:44px;border-radius:50%;background:var(--color-surface) url("/storefront/assets/beulah-logo.webp") center/contain no-repeat;color:transparent;overflow:hidden}
    .site-header__menu-link{display:flex;align-items:center;width:100%;padding:11px 12px;border-radius:10px;color:var(--color-text);text-decoration:none}
    .site-header__menu-link:hover{background:var(--color-accent-soft);color:var(--color-accent-dark)}
    .site-header__menu .site-header__cart-link{width:100%;height:auto;min-height:46px;justify-content:flex-start;margin-left:0;border:0;background:transparent;border-radius:10px;gap:10px;box-shadow:none}
    .site-header__menu .site-header__cart-label{display:inline}
    .site-header__menu .site-header__cart-count{top:50%;right:12px;transform:translateY(-50%)}
    .site-header__logout{border:0;background:transparent;font:inherit;text-align:left;cursor:pointer}
    @media(max-width:760px){
      .site-header__links{display:none}
      .site-header__menu-toggle{display:inline-flex;width:42px;height:42px;padding:9px;flex-direction:column;justify-content:center;gap:5px;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface);cursor:pointer}
      .site-header__menu-toggle:hover{background:var(--color-bg)}
      .site-header__menu-toggle span{display:block;width:100%;height:2px;border-radius:99px;background:currentColor}
      .site-header__menu{position:absolute;top:calc(100% + 10px);right:0;width:min(300px,calc(100vw - 24px));display:grid;gap:3px;padding:8px;border:1px solid var(--color-border);border-radius:16px;background:var(--color-surface);box-shadow:var(--shadow-md);z-index:50}
      .site-header__menu[hidden]{display:none}
      .site-header__inner{position:relative}
    }
  `;
  document.head.append(style);
}

export function initHeader(navEl) {
  if (!navEl) return;
  ensureStyles();
  let lastSession = null;
  let resolved = false;
  navEl.hidden = true;
  navEl.setAttribute("aria-busy", "true");

  const render = (session) => {
    lastSession = session;
    resolved = true;
    renderNav(navEl, session);
    navEl.hidden = false;
    navEl.setAttribute("aria-busy", "false");
  };

  getCurrentSession().then(render).catch(() => render(null));

  onAuthStateChange((event, session) => {
    if (!resolved) {
      if (event === "INITIAL_SESSION") return;
      return;
    }
    render(session);
  });

  onCartChange(() => {
    if (resolved) renderNav(navEl, lastSession);
  });
}

function renderNav(navEl, session) {
  navEl.textContent = "";
  const signedIn = Boolean(session?.user);
  const desktopLinks = document.createElement("div");
  desktopLinks.className = "site-header__links";
  desktopLinks.append(createLink(page("index.html"), "Home"), createLink(page("shop.html"), "Shop"), createCartLink());

  if (signedIn) {
    const account = createLink(page("account.html"), "", "site-header__account-icon");
    account.setAttribute("aria-label", "My account");
    account.title = "My account";
    account.innerHTML = personIcon();
    desktopLinks.append(account);
  } else {
    desktopLinks.append(createLink(page("login.html"), "Log in", "site-header__auth-link"));
    desktopLinks.append(createLink(page("signup.html"), "Create account", "btn btn-primary site-header__auth-button"));
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "site-header__menu-toggle";
  toggle.setAttribute("aria-label", "Open menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "site-header-mobile-menu");
  toggle.innerHTML = "<span></span><span></span><span></span>";

  const menu = document.createElement("div");
  menu.id = "site-header-mobile-menu";
  menu.className = "site-header__menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");

  menu.append(
    createLink(page("index.html"), "Home", "site-header__menu-link"),
    createLink(page("shop.html"), "Shop", "site-header__menu-link"),
    createCartLink("site-header__menu-link"),
  );

  if (signedIn) {
    menu.append(createLink(page("account.html"), "My Account", "site-header__menu-link"), createLogoutButton());
  } else {
    menu.append(createLink(page("login.html"), "Log in", "site-header__menu-link"), createLink(page("signup.html"), "Create account", "btn btn-primary site-header__menu-link"));
  }

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    });
  });

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  if (!navEl.dataset.outsideClickBound) {
    document.addEventListener("click", (event) => {
      const activeToggle = navEl.querySelector(".site-header__menu-toggle");
      const activeMenu = navEl.querySelector(".site-header__menu");
      if (activeToggle && activeMenu && !navEl.contains(event.target)) {
        activeMenu.hidden = true;
        activeToggle.setAttribute("aria-expanded", "false");
        activeToggle.setAttribute("aria-label", "Open menu");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const activeToggle = navEl.querySelector(".site-header__menu-toggle");
      const activeMenu = navEl.querySelector(".site-header__menu");
      if (activeToggle && activeMenu) {
        activeMenu.hidden = true;
        activeToggle.setAttribute("aria-expanded", "false");
        activeToggle.setAttribute("aria-label", "Open menu");
      }
    });
    navEl.dataset.outsideClickBound = "true";
  }

  navEl.append(desktopLinks, toggle, menu);
}

function createLink(href, text, className = "") { const link = document.createElement("a"); link.href = href; link.textContent = text; if (className) link.className = className; return link; }
function createCartLink(className = "") { const link = createLink(page("cart.html"), "", className ? `${className} site-header__cart-link` : "site-header__cart-link"); link.setAttribute("aria-label", "Cart"); link.title = "Cart"; link.innerHTML = `${cartIcon()}<span class="site-header__cart-label">Cart</span><span class="site-header__cart-count">${getCartItemCount()}</span>`; return link; }
function createLogoutButton() { const button = document.createElement("button"); button.type = "button"; button.className = "site-header__menu-link site-header__logout"; button.textContent = "Log out"; button.addEventListener("click", async () => { button.disabled = true; try { await signOutCustomer(); window.location.href = page("index.html"); } catch { button.disabled = false; } }); return button; }
function cartIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20.5 8H6"/><circle cx="10" cy="19" r="1.3"/><circle cx="18" cy="19" r="1.3"/></svg>'; }
function personIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-3.3 3-5 6.5-5s5.8 1.7 6.5 5"/></svg>'; }
