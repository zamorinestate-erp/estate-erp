// =============================================================================
// PAGE: Staff Settings (Section 1 of the new-ideas doc + Part E.1)
// This is the entire extent of Staff's control over the app: theme, font
// size, language, notification preferences. Every control here is wired to
// real state — changing font size actually rescales the whole app live.
// =============================================================================
import { state, setSettings } from "../state.js";
import { showToast } from "../components.js";
import { loadSessionManagement } from "../sessionManagement.js";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
];

const FONT_SIZES = [
  { code: "small", label: "S" },
  { code: "standard", label: "M" },
  { code: "large", label: "L" },
  { code: "extra-large", label: "XL" },
];

export function renderStaffSettings() {
  const s = state.settings;
  return `
    <div class="page-enter" style="padding:8px 4px;">
      <div class="flex items-center gap-md" style="margin-bottom:24px;">
        <div style="color:#fff; font-weight:700; font-size:17px;" class="font-display">Settings</div>
      </div>

      <div class="glass" style="padding:18px; margin-bottom:14px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Theme</div>
        <div class="flex gap-sm">
          <button class="btn btn-ghost selected" style="flex:1; justify-content:center;" disabled>☀ Light</button>
          <button class="btn btn-ghost" style="flex:1; justify-content:center; opacity:0.5;" disabled>● Dark (soon)</button>
        </div>
      </div>

      <div class="glass" style="padding:18px; margin-bottom:14px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Font size</div>
        <div class="flex gap-sm" id="font-size-group">
          ${FONT_SIZES.map(
            (f) => `<button class="btn btn-ghost ${s.fontSize === f.code ? "selected" : ""}" style="flex:1; justify-content:center;" data-font="${f.code}">${f.label}</button>`
          ).join("")}
        </div>
      </div>

      <div class="glass" style="padding:18px; margin-bottom:14px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Language</div>
        <div class="flex-col gap-md" id="language-group">
          ${LANGUAGES.map(
            (l) => `
            <div class="flex justify-between items-center" data-lang="${l.code}" style="cursor:pointer;">
              <div style="color:#fff; font-size:13px;">${l.label}</div>
              <div style="color:var(--color-accent-mint-bright); font-weight:700;">${s.language === l.code ? "✓" : ""}</div>
            </div>`
          ).join("")}
        </div>
      </div>

      <div class="glass" style="padding:18px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Notifications</div>
        <div class="flex-col gap-md">
          ${notificationRow("roster", "Roster published", s.notifications.roster)}
          ${notificationRow("leave", "Leave approved/rejected", s.notifications.leave)}
          ${notificationRow("payslip", "Payslip available", s.notifications.payslip)}
        </div>
      </div>

      <div class="glass" style="padding:18px; margin-top:14px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:8px;">Security &amp; Devices</div>
        <div class="muted-white" style="font-size:12px; margin-bottom:12px;">Change your password or manage authenticated devices.</div>
        <button class="btn btn-ghost" id="change-password-btn">Change Password</button>
      </div>

      <div id="session-management-root"></div>
    </div>
  `;
}

function notificationRow(key, label, on) {
  return `
    <div class="flex justify-between items-center">
      <div style="color:#fff; font-size:13px;">${label}</div>
      <button class="toggle ${on ? "on" : ""}" data-notif="${key}"><span class="knob"></span></button>
    </div>
  `;
}

export function wireStaffSettings(root) {
  root.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSettings({ fontSize: btn.dataset.font });
      document.documentElement.setAttribute("data-font-size", btn.dataset.font);
      showToast(`Font size set to ${btn.textContent.trim()}`, "mint");
      rerenderSettingsOnly(root);
    });
  });

  root.querySelectorAll("[data-lang]").forEach((row) => {
    row.addEventListener("click", () => {
      setSettings({ language: row.dataset.lang });
      showToast("Language preference saved", "mint");
      rerenderSettingsOnly(root);
    });
  });

  const pwBtn = root.querySelector("#change-password-btn");
  if (pwBtn) {
    pwBtn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("zamorin:change-password"));
    });
  }

  loadSessionManagement(root.querySelector("#session-management-root"));

  root.querySelectorAll("[data-notif]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const key = toggle.dataset.notif;
      const next = { ...state.settings.notifications, [key]: !state.settings.notifications[key] };
      setSettings({ notifications: next });
      toggle.classList.toggle("on");
    });
  });
}

function rerenderSettingsOnly(root) {
  root.innerHTML = renderStaffSettings();
  wireStaffSettings(root);
}
