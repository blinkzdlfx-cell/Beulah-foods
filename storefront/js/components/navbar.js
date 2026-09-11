import {
  getCurrentSession,
  onAuthStateChange,
  signOutCustomer,
} from "../services/authService.js";

export function initHeader(navEl) {
  if (!navEl) return;

  getCurrentSession()
    .then((session) => renderNav(navEl, session))
    .catch(() => renderNav(navEl, null));

  onAuthStateChange((_event, session) => {
    renderNav(navEl, session);
  });
}

function renderNav(navEl, session) {
  navEl.textContent = "";
  navEl.hidden = false;

  const signedIn = Boolean(session?.user);

  const desktopLinks = document.createElement("div");
  desktopLinks.className = "site-header__links";

  const homeLink = createLink("index.html", "Home");
  const shopLink = createLink("shop.html", "Shop");
  desktopLinks.append(homeLink, shopLink);

  const menuToggle = document.createElement("button");
  menuToggle.type = "button";
  menuToggle.className = "site-header__menu-toggle";
  menuToggle.setAttribute("aria-label", "Open menu");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.innerHTML = "<span></span><span></span><span></span>";

  const menu = document.createElement("div");
  menu.className = "site-header__menu";
  menu.hidden = true;

  if (signedIn) {
    menu.append(
      createLink("account.html", "My account", "site-header__menu-link"),
      createLogoutButton(),
    );
  } else {
    menu.append(
      createLink("login.html", "Log in", "site-header__menu-link"),
      createLink("signup.html", "Create account", "btn btn-primary site-header__menu-link"),
    );
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
  });

  document.addEventListener("click", (event) => {
    if (!navEl.contains(event.target)) {
      menu.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open menu");
    }
  });

  navEl.append(desktopLinks, menuToggle, menu);
}

function createLink(href, text, className = "") {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  if (className) link.className = className;
  return link;
}

function createLogoutButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-header__menu-link site-header__logout";
  button.textContent = "Log out";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await signOutCustomer();
      window.location.href = "index.html";
    } catch {
      button.disabled = false;
    }
  });
  return button;
}
