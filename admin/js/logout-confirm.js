import { signOutAdmin } from "./services/adminAuthService.js";

const button = document.getElementById("admin-logout");
if (!button) return;

const modal = document.createElement("div");
modal.className = "logout-modal";
modal.hidden = true;
modal.innerHTML = `
  <div class="logout-modal__backdrop" data-close></div>
  <section class="logout-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" aria-describedby="logout-modal-copy">
    <div class="logout-modal__icon" aria-hidden="true">↗</div>
    <h2 id="logout-modal-title">Log out?</h2>
    <p id="logout-modal-copy">Are you sure you want to log out of Beulah Foods Admin?</p>
    <div class="logout-modal__actions">
      <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
      <button type="button" class="btn btn-danger" data-confirm>Log out</button>
    </div>
  </section>
`;
document.body.append(modal);

const close = () => {
  modal.hidden = true;
  button.focus();
};
const open = () => {
  modal.hidden = false;
  modal.querySelector("[data-cancel]").focus();
};

button.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  open();
}, true);

modal.addEventListener("click", async (event) => {
  if (event.target.closest("[data-close], [data-cancel]")) {
    close();
    return;
  }
  const confirmButton = event.target.closest("[data-confirm]");
  if (!confirmButton) return;
  confirmButton.disabled = true;
  confirmButton.textContent = "Logging out...";
  try {
    await signOutAdmin();
    window.location.reload();
  } catch (error) {
    confirmButton.disabled = false;
    confirmButton.textContent = "Log out";
    close();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) close();
});
