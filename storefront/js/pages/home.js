import { initHeader } from "../components/navbar.js";

initHeader(document.getElementById("site-header-nav"));

const footerYear = document.getElementById("footer-year");
if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}
