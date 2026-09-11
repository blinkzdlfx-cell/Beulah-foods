// Shared site header. Keeps customer navigation in sync with Supabase auth.
// Authenticated customers see account actions instead of Login/Signup.

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

  if (session?.user) {
    const homeLink = document.createElement("a");
    homeLink.href = "index.html";
    homeLink.textContent = "Home";

    const accountLink = document.createElement("a");
    accountLink.href = "account.html";
    accountLink.textContent = "My account";
    accountLink.className = "site-header__account-link";

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-secondary site-header__logout";
    logoutBtn.textContent = "Log out";
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      try {
        await signOutCustomer();
        window.location.href = "index.html";
      } catch {
        logoutBtn.disabled = false;
      }
    });

    navEl.append(homeLink, accountLink, logoutBtn);
    return;
  }

  const loginLink = document.createElement("a");
  loginLink.href = "login.html";
  loginLink.textContent = "Log in";

  const signupLink = document.createElement("a");
  signupLink.href = "signup.html";
  signupLink.className = "btn btn-primary";
  signupLink.textContent = "Create account";

  navEl.append(loginLink, signupLink);
}
