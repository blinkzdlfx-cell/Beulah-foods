import { initHeader } from "../components/navbar.js";
import { getCurrentSession, onAuthStateChange } from "../services/authService.js";

initHeader(document.getElementById("site-header-nav"));

const heroAccountAction = document.getElementById("hero-account-action");
const ctaTitle = document.getElementById("cta-title");
const ctaCopy = document.getElementById("cta-copy");
const ctaPrimaryAction = document.getElementById("cta-primary-action");
const ctaSecondaryAction = document.getElementById("cta-secondary-action");

function updateAuthenticatedContent(session) {
  const signedIn = Boolean(session?.user);
  const isNewAccount = signedIn && window.localStorage.getItem("beulah:new-account-welcome") === "1";

  if (isNewAccount) {
    window.localStorage.removeItem("beulah:new-account-welcome");
  }

  if (heroAccountAction) {
    heroAccountAction.href = signedIn ? "shop.html" : "signup.html";
    heroAccountAction.textContent = signedIn ? "Start shopping" : "Create an account";
  }

  if (ctaTitle) {
    ctaTitle.textContent = isNewAccount
      ? "Welcome to Beulah Foods."
      : signedIn
        ? "Good food starts with good choices."
        : "Bring better food choices home.";
  }

  if (ctaCopy) {
    ctaCopy.textContent = isNewAccount
      ? "Your account is ready. Add your delivery details whenever you’re ready, then explore the Beulah Foods catalogue."
      : signedIn
        ? "Discover wholesome food products, keep your details ready for checkout and shop from the live Beulah Foods catalogue."
        : "Create an account, discover our products and make everyday food shopping simpler.";
  }

  if (ctaPrimaryAction) {
    ctaPrimaryAction.href = signedIn ? "shop.html" : "signup.html";
    ctaPrimaryAction.textContent = isNewAccount ? "Start shopping" : signedIn ? "Shop now" : "Create an account";
  }

  if (ctaSecondaryAction) {
    ctaSecondaryAction.href = signedIn ? "account.html" : "login.html";
    ctaSecondaryAction.textContent = isNewAccount ? "View my details" : signedIn ? "My account" : "Log in";
  }
}

getCurrentSession()
  .then(updateAuthenticatedContent)
  .catch(() => updateAuthenticatedContent(null));

onAuthStateChange((_event, session) => {
  updateAuthenticatedContent(session);
});

const footerYear = document.getElementById("footer-year");
if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}
