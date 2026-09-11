import { getCurrentSession, onAuthStateChange } from "../services/authService.js";
import { getCustomerProfile, updateCustomerProfile } from "../services/profileService.js";
import { initHeader } from "../components/navbar.js";

const nav = document.getElementById("site-header-nav");
const form = document.getElementById("account-form");
const alertBox = document.getElementById("account-alert");
const saveButton = document.getElementById("save-profile");
const emailInput = document.getElementById("email");
const fullNameInput = document.getElementById("full-name");
const phoneInput = document.getElementById("phone");
const addressInput = document.getElementById("address");
const emailLabel = document.getElementById("account-email");
const avatar = document.getElementById("account-avatar");

initHeader(nav);

async function loadAccount() {
  const session = await getCurrentSession();

  if (!session?.user) {
    window.location.href = "login.html?redirect=account.html";
    return;
  }

  const email = session.user.email || "";
  emailInput.value = email;
  emailLabel.textContent = email;
  avatar.textContent = (email.charAt(0) || "B").toUpperCase();

  const profile = await getCustomerProfile();
  if (profile) {
    fullNameInput.value = profile.full_name || "";
    phoneInput.value = profile.phone || "";
    addressInput.value = profile.address || "";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();

  const fullName = fullNameInput.value.trim();
  if (!fullName) {
    showAlert("Please enter your full name.", "error");
    fullNameInput.focus();
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    await updateCustomerProfile({
      fullName,
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
    });
    showAlert("Your account details have been saved.", "success");
  } catch (error) {
    showAlert(error?.message || "Unable to save your account details. Please try again.", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save changes";
  }
});

onAuthStateChange((_event, session) => {
  if (!session?.user) window.location.href = "login.html?redirect=account.html";
});

function showAlert(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.hidden = false;
}

function clearAlert() {
  alertBox.hidden = true;
  alertBox.textContent = "";
}

loadAccount().catch((error) => {
  showAlert(error?.message || "Unable to load your account. Please refresh and try again.", "error");
});
