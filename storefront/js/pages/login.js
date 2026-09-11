import { signInCustomer } from "../services/authService.js";
import { isValidEmail } from "../utils/validators.js";
import { initHeader } from "../components/navbar.js";

initHeader(document.getElementById("site-header-nav"));

const form = document.getElementById("login-form");
const alertBox = document.getElementById("form-alert");
const submitBtn = document.getElementById("login-submit");

const POST_LOGIN_DESTINATION = "index.html";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) {
    showAlert("error", "Enter your email and password.");
    return;
  }

  if (!isValidEmail(email)) {
    showAlert("error", "Enter a valid email address.");
    return;
  }

  setLoading(true);

  try {
    await signInCustomer({ email, password });
    window.location.href = POST_LOGIN_DESTINATION;
  } catch (error) {
    setLoading(false);
    showAlert("error", describeLoginError(error));
  }
});

function describeLoginError(error) {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("email not confirmed")) {
    return "Please confirm your email before logging in — check your inbox for the confirmation link.";
  }
  if (message.includes("invalid login credentials")) {
    return "That email or password isn't right. Please try again.";
  }
  return "Something went wrong logging in. Please try again.";
}

function showAlert(kind, message) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${kind}`;
  alertBox.hidden = false;
}

function hideAlert() {
  alertBox.hidden = true;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Logging in…" : "Log in";
}
