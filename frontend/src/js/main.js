// =============================================================================
// ZAMORIN CAFE ERP — ENTRY POINT
// =============================================================================
import { state, setState } from "./state.js";
import { ROLES, NAVIGATION } from "./navigation.js";
import { renderShell } from "./router.js";
import { renderRoleSwitcher, wireRoleSwitcher, showToast, updateBellBadge } from "./components.js";
import { undeliveredPopups } from "./notifications.js";
import { enqueuePopup } from "./popup.js";
import {
  registerServiceWorker,
} from "./updateManager.js";

function mountRoleSwitcher() {
  let host = document.getElementById("role-switcher-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "role-switcher-host";
    document.body.appendChild(host);
  }
  host.innerHTML = renderRoleSwitcher();
  wireRoleSwitcher(host, (role) => {
    if (role === state.role) return;
    const defaultRoute = NAVIGATION[role].items[0].route;
    setState({ role, route: defaultRoute });
    renderShell();
    mountRoleSwitcher(); // re-render so the "selected" pill updates
    showToast(`Now viewing as ${labelFor(role)}`, "mint");

    // Simulates real-time delivery: any popup-eligible notification for this
    // role that hasn't been "delivered" yet shows now, exactly once, the way
    // it would arrive live on a real WebSocket connection for an online user.
    setTimeout(() => {
      undeliveredPopups(role).forEach((n) => enqueuePopup(n));
      updateBellBadge();
    }, 400);
  });
}

function labelFor(role) {
  return { master: "Master", owner: "Owner", cafe_admin: "Cafe Admin", staff: "Staff" }[role];
}

function boot() {
  document.documentElement.setAttribute(
    "data-font-size",
    state.settings.fontSize
  );

  renderShell();
  mountRoleSwitcher();

  registerServiceWorker().catch(() => {
    // PWA support must never prevent the app from loading.
  });
}
document.addEventListener("DOMContentLoaded", boot);
