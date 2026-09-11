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

  if (heroAccountAction) {
    heroAccountAction.href = signedIn ? "account.html" : "signup.html";
    heroAccountAction.textContent = signedIn ? "My account" : "Create an account";
  }

  if (ctaTitle) {
    ctaTitle.textContent = signedIn
      ? "Your Beulah Foods account is ready."
      : "Start your Beulah Foods journey.";
  }

  if (ctaCopy) {
    ctaCopy.textContent = signedIn
      ? "Keep your contact and delivery details up to date while we continue building the full shopping experience."
      : "Create an account to keep your details ready as the full shopping experience comes online.";
  }

  if (ctaPrimaryAction) {
    ctaPrimaryAction.href = signedIn ? "account.html" : "signup.html";
    ctaPrimaryAction.textContent = signedIn ? "Open my account" : "Create an account";
  }

  if (ctaSecondaryAction) {
    ctaSecondaryAction.href = signedIn ? "#experience" : "login.html";
    ctaSecondaryAction.textContent = signedIn ? "Explore Beulah Foods" : "Log in";
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
