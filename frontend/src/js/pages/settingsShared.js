// =============================================================================
// PAGE: Settings & Preferences — SHARED across Master, Owner and Cafe Admin
//
// Before this fix, only Staff had a working Settings page (staffSettings.js).
// Master, Owner and Cafe Admin had none at all. Rather than write three more
// separate, diverging Settings pages, this single module is reused by all
// three — each gets the same "My Preferences" controls (theme, font size,
// language, notifications), and only Master sees an additional "System
// Administration" section pointing at the real Administration module. That
// split follows the spec's rule directly: global configuration is never
// placed inside another role's personal Settings page.
// =============================================================================
import { state, setSettings } from "../state.js";
import { ROLES } from "../navigation.js";
import { navigate } from "../router.js";
import { showToast } from "../components.js";
import { loadSessionManagement } from "../sessionManagement.js";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
];

const FONT_SIZES = [
  { code: "small", label: "S" },
  { code: "standard", label: "M" },
  { code: "large", label: "L" },
  { code: "extra-large", label: "XL" },
];

const ROLE_TITLE = {
  [ROLES.MASTER]: "Master User",
  [ROLES.OWNER]: "Cafe Owner",
  [ROLES.CAFE_ADMIN]: "Cafe Admin",
};

export function renderSettingsShared() {
  const s = state.settings;
  const isMaster = state.role === ROLES.MASTER;

  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Settings &amp; Preferences</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">${ROLE_TITLE[state.role]} — personal preferences only. ${isMaster ? "System-wide configuration lives separately, in Administration." : ""}</div>

      <div style="color:var(--color-accent-mint-bright); font-size:12px; font-weight:700; letter-spacing:0.5px; margin-bottom:10px;">MY PREFERENCES</div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
        <div class="glass" style="padding:20px;">
          <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Appearance</div>
          <div class="muted-white" style="font-size:11.5px; margin-bottom:8px;">Theme</div>
          <div class="flex gap-sm" style="margin-bottom:16px;">
            <button class="btn btn-ghost selected" style="flex:1; justify-content:center; color:#fff;" disabled>☀ Light</button>
            <button class="btn btn-ghost" style="flex:1; justify-content:center; opacity:0.5; color:#fff;" disabled>● Dark (soon)</button>
          </div>
          <div class="muted-white" style="font-size:11.5px; margin-bottom:8px;">Font size</div>
          <div class="flex gap-sm" id="font-size-group">
            ${FONT_SIZES.map((f) => `<button class="btn btn-ghost ${s.fontSize === f.code ? "selected" : ""}" style="flex:1; justify-content:center; color:#fff;" data-font="${f.code}">${f.label}</button>`).join("")}
          </div>
        </div>

        <div class="glass" style="padding:20px;">
          <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Language &amp; Region</div>
          <div class="flex-col gap-sm" id="language-group" style="max-height:150px; overflow-y:auto;">
            ${LANGUAGES.map(
              (l) => `
              <div class="flex justify-between items-center" data-lang="${l.code}" style="cursor:pointer; padding:4px 0;">
                <div style="color:#fff; font-size:13px;">${l.label}</div>
                <div style="color:var(--color-accent-mint-bright); font-weight:700;">${s.language === l.code ? "✓" : ""}</div>
              </div>`
            ).join("")}
          </div>
          <div class="muted-white" style="font-size:10.5px; margin-top:10px;">Currency stays ₹ (INR) regardless of language — this never changes.</div>
        </div>
      </div>

      <div class="glass" style="padding:20px; margin-bottom:16px; cursor:pointer;" id="notification-master-card">
        <div class="flex justify-between items-center">
          <div>
            <div style="color:#fff; font-weight:600; font-size:14px;">Notification Master</div>
            <div class="muted-white" style="font-size:12px; margin-top:2px;">In-app, popup, push and email preferences by category</div>
          </div>
          <div class="pill pill-mint">3 channels active</div>
        </div>
      </div>

      <div class="glass" style="padding:20px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:8px;">Security &amp; Devices</div>
        <div class="muted-white" style="font-size:12px; margin-bottom:12px;">Password and authenticated-device controls are enforced by the secure authentication service.</div>
        <button class="btn btn-ghost" style="color:#fff;" id="change-password-btn">Change Password</button>
      </div>

      <div id="session-management-root" style="${isMaster ? "margin-bottom:16px;" : ""}"></div>

      ${isMaster ? masterAdminSection() : ""}
    </div>
  `;
}

function masterAdminSection() {
  return `
    <div style="color:var(--color-accent-amber); font-size:12px; font-weight:700; letter-spacing:0.5px; margin:20px 0 10px;">SYSTEM ADMINISTRATION — MASTER ONLY</div>
    <div class="glass" style="padding:20px; cursor:pointer;" id="open-admin-card">
      <div class="flex justify-between items-center">
        <div>
          <div style="color:#fff; font-weight:600; font-size:14px;">Global Defaults, Security Policy, Trash Bin, Audit Page</div>
          <div class="muted-white" style="font-size:12px; margin-top:2px;">Organisation-wide configuration — never shown inside Owner, Cafe Admin or Staff Settings</div>
        </div>
        <div class="pill pill-dark">Open Administration →</div>
      </div>
    </div>
  `;
}

export function wireSettingsShared(root) {
  root.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSettings({ fontSize: btn.dataset.font });
      document.documentElement.setAttribute("data-font-size", btn.dataset.font);
      showToast(`Font size set to ${btn.textContent.trim()} — applied across the whole app`, "mint");
      rerender(root);
    });
  });

  root.querySelectorAll("[data-lang]").forEach((row) => {
    row.addEventListener("click", () => {
      setSettings({ language: row.dataset.lang });
      showToast("Language preference saved", "mint");
      rerender(root);
    });
  });

  const notifCard = root.querySelector("#notification-master-card");
  if (notifCard) notifCard.addEventListener("click", () => showToast("Notification Master opens in the next build pass", "amber"));

  const pwBtn = root.querySelector("#change-password-btn");
  if (pwBtn) {
    pwBtn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("zamorin:change-password"));
    });
  }

  loadSessionManagement(root.querySelector("#session-management-root"));

  const adminCard = root.querySelector("#open-admin-card");
  if (adminCard) adminCard.addEventListener("click", () => navigate("admin"));
}

function rerender(root) {
  root.innerHTML = renderSettingsShared();
  wireSettingsShared(root);
}
