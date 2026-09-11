// Shared site header. Shows Login/Signup links when signed out, or the
// customer's name/email plus a Log out button when signed in. Keeps
// itself in sync with auth state so a login/logout elsewhere updates it
// without a page reload.

import {
  getCurrentSession,
  onAuthStateChange,
  signOutCustomer,
} from "../services/authService.js";

export function initHeader(navEl) {
  if (!navEl) return;

  renderNav(navEl, null);

  getCurrentSession()
    .then((session) => renderNav(navEl, session))
    .catch(() => renderNav(navEl, null));

  onAuthStateChange((_event, session) => {
    renderNav(navEl, session);
  });
}

function renderNav(navEl, session) {
  navEl.textContent = "";

  if (session?.user) {
    const label = document.createElement("span");
    label.textContent = session.user.email;

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-secondary";
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

    navEl.append(label, logoutBtn);
  } else {
    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.textContent = "Log in";

    const signupLink = document.createElement("a");
    signupLink.href = "signup.html";
    signupLink.className = "btn btn-primary";
    signupLink.textContent = "Sign up";

    navEl.append(loginLink, signupLink);
  }

  navEl.hidden = false;
}
