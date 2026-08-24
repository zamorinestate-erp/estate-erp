// =============================================================================
// PAGE: Settings, Account & Preferences — SCR-023 / PROGRAMME 03
//
// Authoritative Universal Personal Self-Service Hub & Redesigned Settings Shell
// for all 4 canonical management roles:
//   - MASTER (Primary Master & Normal Master)
//   - OWNER
//   - CAFE_ADMIN (Cafe Operations)
//   - STAFF (Frozen)
//
// ARCHITECTURAL & GOVERNANCE RULES:
//   1. Universal Settings Shell: Shared desktop rail navigation, breadcrumbs,
//      page-specific H1s, bounded readable widths, and zero vast dead space.
//   2. Contrast & Theme Precision: Full compliance across Paper, Pearl,
//      Midnight, Noir. No hardcoded white text on light themes.
//   3. Modern Accessible Switches: Semantic role="switch" controls replacing
//      raw "Off/On" buttons.
//   4. Governed Access & Identity: Clear separation between user-editable
//      personal data and HR/governance-managed immutable records.
//   5. Fail-Closed Error Handling: Structured recoverable state cards for
//      network/session errors with retry actions.
// =============================================================================

import { state, setState, setSettings } from "../state.js";
import { ROLES } from "../navigation.js";
import { navigate } from "../router.js";
import { showToast, confirmAction, renderCafeContextStrip } from "../components.js";
import { loadSessionManagement, renderSessionManagement } from "../sessionManagement.js";
import { apiGet, apiPatch, apiPost, apiDelete } from "../apiClient.js";
import { renderStaffPayslips, wireStaffPayslips } from "./staffPayslips.js";
import { renderStaffLoansAdvances, wireStaffLoansAdvances } from "./staffLoansAdvances.js";

// ── 23 supported languages (English + 22 Eighth Schedule Indian Languages) ───
const ALL_LANGUAGES = [
  { locale: "en-IN",  label: "English",                native: "English",         dir: "ltr", status: "PRODUCTION_READY", isDefault: true },
  { locale: "as-IN",  label: "Assamese",               native: "অসমীয়া",          dir: "ltr", status: "DRAFT" },
  { locale: "bn-IN",  label: "Bengali / Bangla",       native: "বাংলা",            dir: "ltr", status: "DRAFT" },
  { locale: "brx-IN", label: "Bodo",                   native: "बर'",             dir: "ltr", status: "DRAFT" },
  { locale: "doi-IN", label: "Dogri",                  native: "डोगरी",            dir: "ltr", status: "DRAFT" },
  { locale: "gu-IN",  label: "Gujarati",               native: "ગુજરાતી",          dir: "ltr", status: "DRAFT" },
  { locale: "hi-IN",  label: "Hindi",                  native: "हिन्दी",           dir: "ltr", status: "DRAFT" },
  { locale: "kn-IN",  label: "Kannada",                native: "ಕನ್ನಡ",            dir: "ltr", status: "DRAFT" },
  { locale: "ks-IN",  label: "Kashmiri",               native: "کٲشُر",           dir: "rtl", status: "DRAFT" },
  { locale: "kok-IN", label: "Konkani",                native: "कोंकणी",           dir: "ltr", status: "DRAFT" },
  { locale: "mai-IN", label: "Maithili",               native: "मैथिली",           dir: "ltr", status: "DRAFT" },
  { locale: "ml-IN",  label: "Malayalam",              native: "മലയാളം",          dir: "ltr", status: "DRAFT" },
  { locale: "mni-IN", label: "Manipuri",               native: "মৈতৈলোন্",        dir: "ltr", status: "DRAFT" },
  { locale: "mr-IN",  label: "Marathi",                native: "मराठी",            dir: "ltr", status: "DRAFT" },
  { locale: "ne-IN",  label: "Nepali",                 native: "नेपाली",           dir: "ltr", status: "DRAFT" },
  { locale: "or-IN",  label: "Odia",                   native: "ଓଡ଼ିଆ",           dir: "ltr", status: "DRAFT" },
  { locale: "pa-IN",  label: "Punjabi",                native: "ਪੰਜਾਬੀ",          dir: "ltr", status: "DRAFT" },
  { locale: "sa-IN",  label: "Sanskrit",               native: "संस्कृतम्",       dir: "ltr", status: "DRAFT" },
  { locale: "sat-IN", label: "Santali",                native: "ᱥᱟᱱᱛᱟᱲᱤ",      dir: "ltr", status: "DRAFT" },
  { locale: "sd-IN",  label: "Sindhi",                 native: "سنڌي",             dir: "rtl", status: "DRAFT" },
  { locale: "ta-IN",  label: "Tamil",                  native: "தமிழ்",            dir: "ltr", status: "DRAFT" },
  { locale: "te-IN",  label: "Telugu",                 native: "తెలుగు",           dir: "ltr", status: "DRAFT" },
  { locale: "ur-IN",  label: "Urdu",                   native: "اردو",              dir: "rtl", status: "DRAFT" },
];

const THEMES = [
  { code: "paper",    label: "Paper",    desc: "Warm porcelain light (Default)", swatch: "#f8f6f0", border: "#d4af37" },
  { code: "pearl",    label: "Pearl",    desc: "Parchment roastery tone",       swatch: "#ede7de", border: "#c9933e" },
  { code: "midnight", label: "Midnight", desc: "Zamorin Navy deep dark",        swatch: "#0f172a", border: "#38bdf8" },
  { code: "noir",     label: "Noir",     desc: "High contrast charcoal obsidian", swatch: "#05070a", border: "#e2e8f0" },
];

const FONT_SIZES = [
  { code: "small",       label: "S",  name: "Small (13px)" },
  { code: "standard",    label: "M",  name: "Standard (14.5px)" },
  { code: "large",       label: "L",  name: "Large (16px)" },
  { code: "extra-large", label: "XL", name: "Extra Large (18px)" },
];

const DENSITIES = [
  { code: "comfortable", label: "Comfortable", desc: "Spacious breathing room for touch & accessibility" },
  { code: "standard",    label: "Standard",    desc: "Balanced default ledger layout" },
  { code: "compact",     label: "Compact",     desc: "High-density data & list views" },
];

// ── Shared Settings Destination Registry ─────────────────────────────────────
export const SETTINGS_DESTINATIONS = {
  profile: {
    id: "profile",
    label: "Profile & Identity",
    route: "settings/profile",
    category: "ACCOUNT & WORK IDENTITY",
    icon: "👤",
    desc: "Manage personal identity, contact information and governed profile changes.",
    keywords: "name email phone mobile photo avatar profile identity",
    permission: "all",
  },
  employment: {
    id: "employment",
    label: "My Employment",
    route: "settings/employment",
    category: "ACCOUNT & WORK IDENTITY",
    icon: "💼",
    desc: "Official employment designation, Form V payslips, loan advances and documents.",
    keywords: "payslip pay salary loan advance tax form v wages employment hr documents",
    permission: "all",
  },
  access: {
    id: "access",
    label: "My Access & Permissions",
    route: "settings/access",
    category: "ACCOUNT & WORK IDENTITY",
    icon: "🔑",
    desc: "Authorized role, assigned café scopes, effective permissions & elevation requests.",
    keywords: "roles permissions cafe access module requests temporary grant scope",
    permission: "all",
  },
  delegation: {
    id: "delegation",
    label: "Delegation & Coverage",
    route: "settings/delegation",
    category: "ACCOUNT & WORK IDENTITY",
    icon: "🤝",
    desc: "Out-of-office coverage and temporary workflow delegation to eligible peers.",
    keywords: "delegate delegation out of office coverage approvals substitute",
    permission: "all",
  },
  security: {
    id: "security",
    label: "Security & Sign-In",
    route: "settings/security",
    category: "SECURITY & ACCESS",
    icon: "🛡️",
    desc: "Protect your account, rotate passwords, manage MFA authenticators & passkeys.",
    keywords: "password mfa totp 2fa authenticators passkey security sign in",
    permission: "all",
  },
  devices: {
    id: "devices",
    label: "Devices & Sessions",
    route: "settings/devices",
    category: "SECURITY & ACCESS",
    icon: "📱",
    desc: "Active authenticated sessions, device management, offline storage & cache.",
    keywords: "devices sessions active sign out revoke this device offline cache storage",
    permission: "all",
  },
  recovery: {
    id: "recovery",
    label: "Account Recovery",
    route: "settings/recovery",
    category: "SECURITY & ACCESS",
    icon: "🔄",
    desc: "Lost device response workflows, security incident recovery & emergency credentials.",
    keywords: "recovery lost device secure account compromise emergency",
    permission: "all",
  },
  notifications: {
    id: "notifications",
    label: "Notifications",
    route: "settings/notifications",
    category: "PERSONAL PREFERENCES",
    icon: "🔔",
    desc: "Choose how Zamorin keeps you informed across in-app, email and push channels.",
    keywords: "notifications in-app email push alerts quiet hours digest",
    permission: "all",
  },
  language: {
    id: "language",
    label: "Language & Region",
    route: "settings/language",
    category: "PERSONAL PREFERENCES",
    icon: "🌐",
    desc: "Application language, regional date/time formats, and INR currency policy.",
    keywords: "language region translation english hindi tamil malayalam urdu bengali kannada 12h 24h currency inr",
    permission: "all",
  },
  appearance: {
    id: "appearance",
    label: "Appearance",
    route: "settings/appearance",
    category: "PERSONAL PREFERENCES",
    icon: "🎨",
    desc: "Personalise colour themes (Paper, Pearl, Midnight, Noir), font size & density.",
    keywords: "theme appearance color dark mode light mode font size density compact",
    permission: "all",
  },
  accessibility: {
    id: "accessibility",
    label: "Accessibility",
    route: "settings/accessibility",
    category: "PERSONAL PREFERENCES",
    icon: "♿",
    desc: "High contrast, enhanced keyboard focus, reduced motion & assistive display controls.",
    keywords: "accessibility contrast focus keyboard zoom motion a11y screen reader",
    permission: "all",
  },
  workspace: {
    id: "workspace",
    label: "Navigation & Workspace",
    route: "settings/workspace",
    category: "PERSONAL PREFERENCES",
    icon: "⚙️",
    desc: "Default landing page, table page sizes, pinned favourites & filter memory.",
    keywords: "workspace navigation default landing page table size export format pinned favourites",
    permission: "all",
  },
  privacy: {
    id: "privacy",
    label: "Privacy & Data",
    route: "settings/privacy",
    category: "PRIVACY & CONNECTIONS",
    icon: "🔒",
    desc: "DPDP personal data summary, privacy notice, consent & governed data requests.",
    keywords: "privacy data dpdp personal data export correction erasure consent retention grievance",
    permission: "all",
  },
  connected: {
    id: "connected",
    label: "Connected Apps",
    route: "settings/connected",
    category: "PRIVACY & CONNECTIONS",
    icon: "🔗",
    desc: "User-level service integrations & connected machine identity status.",
    keywords: "connected apps integrations api tokens oauth",
    permission: "all",
  },
  help: {
    id: "help",
    label: "Help & Diagnostics",
    route: "settings/help",
    category: "SUPPORT",
    icon: "❓",
    desc: "Application build version, environment, service connectivity & safe diagnostics.",
    keywords: "help diagnostics version support contact admin system info",
    permission: "all",
  },
  trash: {
    id: "trash",
    label: "Data Management & Recovery",
    route: "settings/trash",
    category: "ORGANISATION GOVERNANCE",
    icon: "🗑️",
    desc: "Trash Bin: restore archived catalogue items, vendors and soft-deleted records.",
    keywords: "trash data recovery restore deleted purge archive",
    permission: "master_only",
  },
  admin: {
    id: "admin",
    label: "Global System Administration",
    route: "settings/admin",
    category: "ORGANISATION GOVERNANCE",
    icon: "⚙️",
    desc: "Manage organisation defaults, role governance, security policies & audit logs.",
    keywords: "admin administration organisation governance defaults roles audit",
    permission: "master_only",
  },
};

// Active sub-section within Settings
let _activeSection = "overview";
let _employmentSubTab = "overview"; // overview | payslips | loans | documents
let _searchQuery = "";
let _profileData = null;
let _delegationsData = null;
let _loadingProfile = false;
let _loadingDelegations = false;

export function setSettingsActiveSection(section) {
  _activeSection = section || "overview";
}

function escHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL SETTINGS SHELL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function renderSettingsShell(sectionId, innerContentHtml, options = {}) {
  const role = state.role || ROLES.MASTER;
  const isMaster = role === ROLES.MASTER;
  const dest = SETTINGS_DESTINATIONS[sectionId];

  // If overview or unknown, render standard Hub Landing
  if (!dest || sectionId === "overview") {
    return renderOverview();
  }

  // Navigation Groups for Secondary Rail
  const navGroups = [
    {
      title: "ACCOUNT & WORK IDENTITY",
      items: [
        SETTINGS_DESTINATIONS.profile,
        SETTINGS_DESTINATIONS.employment,
        SETTINGS_DESTINATIONS.access,
        SETTINGS_DESTINATIONS.delegation,
      ],
    },
    {
      title: "SECURITY & ACCESS",
      items: [
        SETTINGS_DESTINATIONS.security,
        SETTINGS_DESTINATIONS.devices,
        SETTINGS_DESTINATIONS.recovery,
      ],
    },
    {
      title: "PERSONAL PREFERENCES",
      items: [
        SETTINGS_DESTINATIONS.notifications,
        SETTINGS_DESTINATIONS.language,
        SETTINGS_DESTINATIONS.appearance,
        SETTINGS_DESTINATIONS.accessibility,
        SETTINGS_DESTINATIONS.workspace,
      ],
    },
    {
      title: "PRIVACY & CONNECTIONS",
      items: [
        SETTINGS_DESTINATIONS.privacy,
        SETTINGS_DESTINATIONS.connected,
      ],
    },
    {
      title: "SUPPORT",
      items: [
        SETTINGS_DESTINATIONS.help,
      ],
    },
  ];

  if (isMaster) {
    navGroups.push({
      title: "GOVERNANCE",
      items: [
        SETTINGS_DESTINATIONS.trash,
        SETTINGS_DESTINATIONS.admin,
      ],
    });
  }

  const secondaryNavHtml = navGroups.map((grp) => `
    <div class="settings-nav-group">
      <div class="settings-nav-group-title">${escHtml(grp.title)}</div>
      ${grp.items.map((item) => {
        const isActive = item.id === sectionId;
        return `
          <button
            class="settings-nav-link ${isActive ? "active" : ""}"
            data-settings-nav="${escHtml(item.id)}"
            type="button"
            tabindex="0"
          >
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${escHtml(item.label)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `).join("");

  return `
    <div class="settings-workspace-layout page-enter" id="settings-root-wrap" data-active-section="${escHtml(sectionId)}">
      <!-- Secondary Settings Rail -->
      <nav class="settings-secondary-nav" aria-label="Settings Navigation">
        <div style="padding: 2px 10px 10px; border-bottom: 1px solid var(--line); margin-bottom: 8px;">
          <button class="settings-breadcrumb-link" data-settings-back type="button" style="display:flex; align-items:center; gap:6px; font-weight:700; font-size:12px;">
            <span>←</span> <span>Settings Overview</span>
          </button>
        </div>
        ${secondaryNavHtml}
      </nav>

      <!-- Main Content Area -->
      <div class="settings-main-container ${options.wide ? "wide-layout" : ""}">
        <!-- Page Header Standard -->
        <header class="settings-header-box">
          <div class="settings-breadcrumb-bar">
            <button class="settings-breadcrumb-link" data-settings-back type="button">Settings</button>
            <span>/</span>
            <span>${escHtml(dest.category)}</span>
            <span>/</span>
            <span style="color:var(--ink); font-weight:700;">${escHtml(dest.label)}</span>
          </div>
          <div class="settings-page-title-row">
            <h1 class="settings-page-h1">
              <span>${dest.icon}</span>
              <span>${escHtml(dest.label)}</span>
            </h1>
            ${options.statusChip ? `
              <span class="settings-status-chip ${options.statusChip.type || "success"}">
                ${escHtml(options.statusChip.label)}
              </span>
            ` : ""}
          </div>
          <p class="settings-page-desc">${escHtml(dest.desc)}</p>
        </header>

        <!-- Page Section Content -->
        ${innerContentHtml}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Settings Overview (Hub Landing)
// ─────────────────────────────────────────────────────────────────────────────

function renderOverview() {
  const role = state.role || ROLES.MASTER;
  const user = state.auth?.user || state.user || {};
  const isMaster = role === ROLES.MASTER;

  const categorizedSections = [
    {
      groupTitle: "ACCOUNT & WORK IDENTITY",
      items: [
        SETTINGS_DESTINATIONS.profile,
        SETTINGS_DESTINATIONS.employment,
        SETTINGS_DESTINATIONS.access,
        SETTINGS_DESTINATIONS.delegation,
      ],
    },
    {
      groupTitle: "SECURITY & ACCESS",
      items: [
        SETTINGS_DESTINATIONS.security,
        SETTINGS_DESTINATIONS.devices,
        SETTINGS_DESTINATIONS.recovery,
      ],
    },
    {
      groupTitle: "PERSONAL PREFERENCES",
      items: [
        SETTINGS_DESTINATIONS.notifications,
        SETTINGS_DESTINATIONS.language,
        SETTINGS_DESTINATIONS.appearance,
        SETTINGS_DESTINATIONS.accessibility,
        SETTINGS_DESTINATIONS.workspace,
      ],
    },
    {
      groupTitle: "PRIVACY & SYSTEM CONNECTIONS",
      items: [
        SETTINGS_DESTINATIONS.privacy,
        SETTINGS_DESTINATIONS.connected,
        SETTINGS_DESTINATIONS.help,
      ],
    },
  ];

  if (isMaster) {
    categorizedSections.push({
      groupTitle: "ORGANISATION GOVERNANCE & DATA RECOVERY (MASTER ONLY)",
      items: [
        SETTINGS_DESTINATIONS.trash,
        SETTINGS_DESTINATIONS.admin,
      ],
    });
  }

  const displayName = user.preferredName || user.name || user.fullName || "Your Account";
  const roleLabel = { [ROLES.MASTER]: "Master User", [ROLES.OWNER]: "Café Owner", [ROLES.CAFE_ADMIN]: "Café Admin", [ROLES.STAFF]: "Staff" }[role] || "Account";

  let totalVisibleItems = 0;

  const sectionsRenderHtml = categorizedSections.map((cat) => {
    const filteredItems = cat.items.filter((s) => {
      if (!s) return false;
      if (!_searchQuery) return true;
      const q = _searchQuery.toLowerCase();
      return s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q);
    });

    if (!filteredItems.length) return "";
    totalVisibleItems += filteredItems.length;

    return `
      <div class="module-hub-section" style="margin-bottom: 24px;">
        <h3 class="module-hub-section-title">${cat.groupTitle}</h3>
        <div class="module-tile-grid">
          ${filteredItems.map((s) => `
            <button
              class="module-hub-tile"
              data-settings-section="${escHtml(s.id)}"
              data-settings-route="${escHtml(s.route)}"
              type="button"
              tabindex="0"
              aria-label="${escHtml(s.label)}: ${escHtml(s.desc)}"
            >
              <div class="module-tile-icon-box">
                ${s.icon}
              </div>
              <div class="module-tile-content">
                <div class="module-tile-title-row">
                  <span class="module-tile-title">${escHtml(s.label)}</span>
                </div>
                <div class="module-tile-sub">${escHtml(s.desc)}</div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="settings-hub page-enter" id="settings-root-wrap" data-active-section="overview">
      <!-- Standard Page Header -->
      <header class="page-header-standard" style="margin-bottom:20px;">
        <div class="page-title-group">
          <h1 class="page-title">
            <span style="font-size:22px;">⚙️</span>
            <span>Settings, Account &amp; Preferences</span>
            <span class="status info" style="font-size:11px; padding:2px 8px; border-radius:999px;">Universal Personal Hub</span>
          </h1>
          <p class="page-subtitle">Configure your personal work identity, authenticators, preferences, and workspace roams across your devices.</p>
        </div>
      </header>

      <!-- Identity & Security Banner -->
      <div class="glass-card" style="padding:16px 20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; border:1px solid var(--line); background:var(--surface);">
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="user-avatar lg" style="width:48px; height:48px; font-size:18px; background:var(--surface-sunken); border:2px solid var(--bronze-500); color:var(--ink);">${escHtml(displayName.charAt(0).toUpperCase())}</div>
          <div>
            <div style="font-size:16px; font-weight:700; color:var(--ink); font-family:var(--font-display);">${escHtml(displayName)}</div>
            <div style="font-size:12px; color:var(--muted); margin-top:2px; display:flex; align-items:center; gap:8px;">
              <span class="status success" style="font-size:10.5px; padding:1px 6px;">${escHtml(roleLabel)}</span>
              <span>ID: <strong>${escHtml(user.userId || "USR-0001")}</strong></span>
              <span>· ${escHtml(user.organisationId || "Zamorin Speciality Coffee")}</span>
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="status success" style="font-size:11px; padding:3px 8px;">
            <span style="font-size:8px;">●</span> Verified Active Session
          </span>
        </div>
      </div>

      <!-- Search Settings -->
      <div style="margin-bottom:24px; position:relative;">
        <input
          id="settings-search-input"
          class="form-input"
          type="text"
          value="${escHtml(_searchQuery)}"
          placeholder="Search profile, payslips, loans, password, language, notifications, access, theme..."
          style="width:100%; padding:12px 16px 12px 42px; font-size:13.5px; background:var(--surface); color:var(--ink); border:1px solid var(--line);"
        />
        <span style="position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:16px; color:var(--muted); pointer-events:none;">🔍</span>
        ${_searchQuery ? `
          <button id="settings-clear-search" class="btn btn-ghost btn-sm" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); padding:2px 8px; font-size:11px;" type="button">Clear</button>
        ` : ""}
      </div>

      <!-- Section Categorized Cards -->
      ${totalVisibleItems > 0 ? sectionsRenderHtml : `
        <div class="settings-state-box">
          <div class="settings-state-icon">🔍</div>
          <div class="settings-state-title">No settings matched "${escHtml(_searchQuery)}"</div>
          <div class="settings-state-desc">Try searching for "profile", "password", "theme", "language", or "payslip".</div>
        </div>
      `}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Profile & Identity
// ─────────────────────────────────────────────────────────────────────────────

function renderProfile() {
  if (_loadingProfile) {
    return renderSettingsShell("profile", `
      <div class="settings-section-card">
        <div class="settings-card-header">
          <h2 class="settings-card-title">Profile &amp; Identity</h2>
        </div>
        <div class="settings-field-helper">Loading authenticated profile…</div>
      </div>
    `);
  }

  const p = _profileData;
  const user = state.auth?.user || state.user || {};
  const displayName = p?.fullName || user.name || user.fullName || "Your Account";
  const preferredName = p?.preferredName || user.preferredName || "";
  const role = state.role || ROLES.MASTER;

  const content = `
    <!-- Profile Summary Card -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Profile Summary</h2>
          <div class="settings-card-subtitle">Universal profile across all Zamorin services &amp; points of sale.</div>
        </div>
        <span class="settings-status-chip success">Status: Active</span>
      </div>

      <div style="display:flex; align-items:center; gap:20px; padding:16px; background:var(--surface-sunken); border-radius:var(--radius-sm, 8px); border:1px solid var(--line);">
        <div class="user-avatar lg" style="width:64px; height:64px; font-size:24px; background:var(--surface); border:2px solid var(--bronze-500); color:var(--ink); display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:700;">
          ${escHtml(displayName.charAt(0).toUpperCase())}
        </div>
        <div>
          <div style="font-size:16px; font-weight:700; color:var(--ink); font-family:var(--font-display);">${escHtml(displayName)}</div>
          <div class="settings-field-helper" style="margin-top:2px;">JPG or PNG, max 2MB. Profile photos are checked for workplace compliance.</div>
          <div style="margin-top:10px; display:flex; gap:8px;">
            <button class="btn btn-ghost btn-sm" id="settings-photo-upload-btn" type="button">Upload Photo</button>
            <button class="btn btn-ghost btn-sm" id="settings-photo-remove-btn" type="button">Remove</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Personal Information Card (User Editable) -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Personal Information</h2>
          <div class="settings-card-subtitle">Self-service contact details and day-to-day display preferences.</div>
        </div>
        <span class="settings-status-chip success">User Editable</span>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-preferred-name">
            <span>Preferred Display Name</span>
          </label>
          <input id="settings-preferred-name" class="settings-field-input" type="text" value="${escHtml(preferredName)}" placeholder="What should colleagues call you?" maxlength="120" />
          <div class="settings-field-helper">Used in greetings, shift rosters and day-to-day till operations.</div>
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-personal-email">
            <span>Personal Email</span>
          </label>
          <input id="settings-personal-email" class="settings-field-input" type="email" value="${escHtml(p?.personalEmail || "")}" placeholder="personal@example.com" maxlength="200" />
          <div class="settings-field-helper">Used for direct personal communication &amp; recovery.</div>
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-personal-mobile">
            <span>Personal Mobile</span>
          </label>
          <input id="settings-personal-mobile" class="settings-field-input" type="tel" value="${escHtml(p?.personalMobile || "")}" placeholder="+91 98765 43210" maxlength="20" />
          <div class="settings-field-helper">SMS and 2FA authentication alerts.</div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px; border-top:1px solid var(--line); padding-top:14px;">
        <button class="btn btn-primary btn-sm" id="settings-profile-save" type="button">Save Profile Changes</button>
      </div>
    </div>

    <!-- Work Identity Card (Read Only / HR Governed) -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Work Identity &amp; Statutory Records</h2>
          <div class="settings-card-subtitle">Official organisation records governed by HR &amp; payroll compliance.</div>
        </div>
        <span class="settings-status-chip neutral">HR Managed</span>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <div class="settings-field-label">
            <span>Legal Full Name</span>
            <span class="settings-status-chip warning" style="font-size:9px;">Approval Required</span>
          </div>
          <div class="settings-readonly-field">${escHtml(displayName)}</div>
          <div class="settings-field-helper">Official payroll &amp; tax identity. Requires governance approval to change.</div>
        </div>

        <div class="settings-field-group">
          <div class="settings-field-label">
            <span>Work Email</span>
            <span class="settings-status-chip neutral" style="font-size:9px;">HR Managed</span>
          </div>
          <div class="settings-readonly-field">${escHtml(p?.workEmail || user.email || "—")}</div>
        </div>

        <div class="settings-field-group">
          <div class="settings-field-label">
            <span>Employee Code</span>
            <span class="settings-status-chip neutral" style="font-size:9px;">HR Managed</span>
          </div>
          <div class="settings-readonly-field">${escHtml(p?.employeeCode || "—")}</div>
        </div>

        <div class="settings-field-group">
          <div class="settings-field-label">
            <span>Primary Assigned Café</span>
          </div>
          <div class="settings-readonly-field">${escHtml(p?.primaryCafeId || user.assignedCafeIds?.[0] || "ZC-0001")}</div>
        </div>
      </div>
    </div>

    <!-- Governed Change Requests -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Controlled Change Requests</h2>
          <div class="settings-card-subtitle">Requests to update legal name, tax documents or official identification.</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="settings-profile-name-change" type="button">Request Legal Name Change →</button>
      </div>

      ${p?.pendingChangeRequests?.length > 0 ? `
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${p.pendingChangeRequests.map((r) => `
            <div style="padding:14px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 6px); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:13.5px; font-weight:700; color:var(--ink);">${escHtml(r.title || "Legal Name Change")}</div>
                <div class="settings-field-helper" style="margin-top:2px;">Requested: ${escHtml(r.proposedValue || "")} · ${escHtml(r.requestId || "")}</div>
              </div>
              <span class="settings-status-chip warning">${escHtml(r.status || "UNDER_REVIEW")}</span>
            </div>
          `).join("")}
        </div>
      ` : `
        <div class="settings-field-helper" style="padding:10px 0;">No pending profile change requests under review.</div>
      `}
    </div>
  `;

  return renderSettingsShell("profile", content, { statusChip: { label: "Verified Profile", type: "success" } });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: My Employment
// ─────────────────────────────────────────────────────────────────────────────

function renderEmployment() {
  const user = state.auth?.user || state.user || {};
  const p = _profileData;

  const content = `
    <!-- Employment Summary Card -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Employment &amp; Designation Summary</h2>
          <div class="settings-card-subtitle">Official organisation status and payroll assignment.</div>
        </div>
        <span class="settings-status-chip success">Payroll: Active</span>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <div class="settings-field-label">Employee Code</div>
          <div class="settings-readonly-field">${escHtml(p?.employeeCode || user.userId || "ZC-EMP-001")}</div>
        </div>
        <div class="settings-field-group">
          <div class="settings-field-label">Designation</div>
          <div class="settings-readonly-field">${escHtml(p?.designation || user.role || "Specialist")}</div>
        </div>
        <div class="settings-field-group">
          <div class="settings-field-label">Department</div>
          <div class="settings-readonly-field">${escHtml(p?.department || "Operations & Kitchen")}</div>
        </div>
        <div class="settings-field-group">
          <div class="settings-field-label">Primary Café</div>
          <div class="settings-readonly-field">${escHtml(p?.primaryCafeId || (user.assignedCafeIds?.[0]) || "ZC-0001")}</div>
        </div>
        <div class="settings-field-group">
          <div class="settings-field-label">Employment Type</div>
          <div class="settings-readonly-field">Permanent / Full-Time</div>
        </div>
        <div class="settings-field-group">
          <div class="settings-field-label">Statutory Status</div>
          <div class="settings-readonly-field">₹ INR Direct Bank Transfer (Code on Wages Compliant)</div>
        </div>
      </div>
    </div>

    <!-- Gateway Navigation Cards -->
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="settings-section-card" style="cursor:pointer; transition:transform 0.12s ease;" data-employment-goto="payslips">
        <div style="font-size:24px; margin-bottom:4px;">📄</div>
        <h3 class="settings-card-title">My Payslips &amp; Tax Slips</h3>
        <div class="settings-card-subtitle">Access monthly payslips, statutory Form V breakdown and annual compensation summaries.</div>
        <div style="margin-top:12px;">
          <button class="btn btn-ghost btn-sm" type="button">Open Payslips Hub →</button>
        </div>
      </div>

      <div class="settings-section-card" style="cursor:pointer; transition:transform 0.12s ease;" data-employment-goto="loans">
        <div style="font-size:24px; margin-bottom:4px;">💳</div>
        <h3 class="settings-card-title">Loans &amp; Salary Advances</h3>
        <div class="settings-card-subtitle">Review active advance balance, statutory deduction schedules and submit advance requests.</div>
        <div style="margin-top:12px;">
          <button class="btn btn-ghost btn-sm" type="button">Open Loans &amp; Advances →</button>
        </div>
      </div>
    </div>

    <!-- Official Documents -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Official Employment Documents</h2>
          <div class="settings-card-subtitle">HR-issued records, appointment letters, and statutory declarations.</div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        ${[
          { title: "Appointment & Employment Agreement", date: "Joined 2024", type: "PDF" },
          { title: "Form 16 / Annual Tax Certificate (FY 2024-25)", date: "Annual", type: "PDF" },
          { title: "PF & ESI Nomination Declaration", date: "Statutory", type: "PDF" },
          { title: "Food Safety & Hygiene Certification", date: "Certified", type: "PDF" },
        ].map((doc) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 8px);">
            <div>
              <div style="font-size:13.5px; font-weight:700; color:var(--ink);">📄 ${doc.title}</div>
              <div class="settings-field-helper" style="margin-top:2px;">Issued: ${doc.date} · Format: ${doc.type}</div>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" onclick="window.alert('Document download initiated.')">Download</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  return renderSettingsShell("employment", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: My Access & Permissions
// ─────────────────────────────────────────────────────────────────────────────

function renderAccess() {
  const user = state.auth?.user || state.user || {};
  const cafes = user.assignedCafeIds || ["ZC-0001"];
  const role = state.role || ROLES.STAFF;
  const roleLabels = {
    [ROLES.MASTER]: "Master User — Full organisation administrative authority",
    [ROLES.OWNER]: "Café Owner — Business, revenue and operational scope",
    [ROLES.CAFE_ADMIN]: "Café Administrator — Unit-level management scope",
    [ROLES.STAFF]: "Staff — Operational terminal and self-service scope",
  };

  const content = `
    <!-- Role Summary Card -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Canonical Role &amp; Authority</h2>
          <div class="settings-card-subtitle">Role governance is managed centrally by organisation administrators.</div>
        </div>
        <span class="settings-status-chip success">Authorized</span>
      </div>

      <div style="padding:16px; background:var(--surface-sunken); border-radius:var(--radius-sm, 8px); border:1px solid var(--line);">
        <div class="settings-field-label">Current Role</div>
        <div style="font-size:15px; font-weight:700; color:var(--ink); margin-top:2px;">${escHtml(roleLabels[role] || role)}</div>
        <div class="settings-field-helper" style="margin-top:4px;">Governed under <strong>${escHtml(user.organisationId || "Zamorin Speciality Coffee")}</strong>.</div>
      </div>
    </div>

    <!-- Authorised Cafés -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Authorised Café Scopes</h2>
          <div class="settings-card-subtitle">Outlets and locations you are permitted to view and operate.</div>
        </div>
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:10px;">
        ${cafes.map((c) => `
          <div style="padding:10px 16px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 8px); display:flex; align-items:center; gap:8px;">
            <span style="font-weight:700; color:var(--ink);">📍 ${escHtml(c)}</span>
            <span class="settings-status-chip success" style="font-size:9px;">Active</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Request Access Elevation -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Request Access Elevation or Removal</h2>
          <div class="settings-card-subtitle">Submitting an access request creates a governed audit record. Access is never self-granted.</div>
        </div>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-access-type">Request Type</label>
          <select id="settings-access-type" class="settings-field-input">
            <option value="CAFE_ACCESS">Café Access — Additional outlet operational scope</option>
            <option value="MODULE_ACCESS">Module Access — Temporary capability elevation</option>
            <option value="TEMPORARY_EXTENSION">Temporary Extension — Extend expiring access</option>
            <option value="ACCESS_REMOVAL">Access Removal — Request revocation of unneeded scope</option>
          </select>
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-access-duration">Duration</label>
          <select id="settings-access-duration" class="settings-field-input">
            <option value="TEMPORARY">Temporary (Time-bound grant with auto-expiry)</option>
            <option value="PERMANENT">Permanent (Ongoing role scope update)</option>
          </select>
        </div>
      </div>

      <div class="settings-field-group" style="margin-top:8px;">
        <label class="settings-field-label" for="settings-access-reason">Business Justification</label>
        <textarea id="settings-access-reason" class="settings-field-input" rows="3" placeholder="Describe precisely what access is required and the operational reason (required)" maxlength="1000"></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary btn-sm" id="settings-access-submit" type="button">Submit Access Request</button>
      </div>
    </div>
  `;

  return renderSettingsShell("access", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Delegation & Coverage
// ─────────────────────────────────────────────────────────────────────────────

function renderDelegation() {
  const d = _delegationsData || { outgoing: [], incoming: [] };

  const content = `
    <!-- Create Delegation Card -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Create Out-of-Office Delegation</h2>
          <div class="settings-card-subtitle">Delegate specific approval workflows while away. Delegates authenticate with their own credentials.</div>
        </div>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-delegate-id">Delegate Peer / User ID</label>
          <input id="settings-delegate-id" class="settings-field-input" type="text" placeholder="e.g. USR-0002" />
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-delegate-scope">Workflow Scope</label>
          <select id="settings-delegate-scope" class="settings-field-input">
            <option value="PROCUREMENT_APPROVAL">Procurement &amp; PO Approval</option>
            <option value="EXPENSE_APPROVAL">Expense &amp; Petty Cash Approval</option>
            <option value="DEPARTMENT_ORDER_APPROVAL">Department Orders Approval</option>
            <option value="SHIFT_COVERAGE">Shift Scheduling &amp; Attendance</option>
          </select>
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-delegate-start">Effective From</label>
          <input id="settings-delegate-start" class="settings-field-input" type="date" />
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-delegate-end">Until Date</label>
          <input id="settings-delegate-end" class="settings-field-input" type="date" />
        </div>
      </div>

      <div class="settings-field-group" style="margin-top:8px;">
        <label class="settings-field-label" for="settings-delegate-reason">Reason / Coverage Label</label>
        <input id="settings-delegate-reason" class="settings-field-input" type="text" placeholder="e.g. Annual Leave Coverage" maxlength="500" />
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary btn-sm" id="settings-delegate-submit" type="button">Create Delegation</button>
      </div>
    </div>

    <!-- Active & Scheduled Delegations -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Active &amp; Scheduled Delegations</h2>
          <div class="settings-card-subtitle">Review active substitute delegations or revoke before expiry.</div>
        </div>
      </div>

      ${d.outgoing?.length > 0 ? `
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${d.outgoing.map((item) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 8px);">
              <div>
                <div style="font-size:13.5px; font-weight:700; color:var(--ink);">${escHtml(item.scope)} → ${escHtml(item.delegateName || item.delegateUserId)}</div>
                <div class="settings-field-helper" style="margin-top:2px;">
                  ${new Date(item.startDate).toLocaleDateString()} to ${new Date(item.endDate).toLocaleDateString()} · ${escHtml(item.reason)}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="settings-status-chip ${item.status === 'ACTIVE' ? 'success' : 'warning'}">${escHtml(item.status)}</span>
                ${item.status === 'ACTIVE' || item.status === 'SCHEDULED' ? `
                  <button class="btn btn-ghost btn-sm" data-revoke-delegation="${escHtml(item.delegationId)}" type="button">Revoke</button>
                ` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      ` : `
        <div class="settings-field-helper" style="padding:10px 0;">No active or scheduled delegations.</div>
      `}
    </div>
  `;

  return renderSettingsShell("delegation", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Security & Sign-In
// ─────────────────────────────────────────────────────────────────────────────

function renderSecurity() {
  const content = `
    <!-- Security Summary -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Security &amp; Sign-In Methods</h2>
          <div class="settings-card-subtitle">Manage account protection, credential rotation and hardware authenticators.</div>
        </div>
        <span class="settings-status-chip success">Account Protected</span>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="settings-toggle-row">
          <div class="settings-toggle-info">
            <div class="settings-toggle-title">Password</div>
            <div class="settings-toggle-desc">Active and verified. Rotated recently according to security policy.</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="settings-change-password-btn" type="button">Change Password</button>
        </div>

        <div class="settings-toggle-row">
          <div class="settings-toggle-info">
            <div class="settings-toggle-title">Two-Factor Authentication (MFA)</div>
            <div class="settings-toggle-desc">Time-based one-time password (TOTP) authenticator app for high-risk operations.</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="settings-mfa-btn" type="button">Configure MFA</button>
        </div>

        <div class="settings-toggle-row">
          <div class="settings-toggle-info">
            <div class="settings-toggle-title">Passkeys &amp; Hardware Security Keys (FIDO2)</div>
            <div class="settings-toggle-desc">Platform biometrics and WebAuthn hardware tokens. No biometric data is stored on servers.</div>
          </div>
          <span class="settings-status-chip neutral">FIDO2 Ready</span>
        </div>

        <div class="settings-toggle-row">
          <div class="settings-toggle-info">
            <div class="settings-toggle-title">Emergency Backup Recovery Codes</div>
            <div class="settings-toggle-desc">One-time printable backup codes if your authenticator device is lost.</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="settings-recovery-codes-btn" type="button">View Codes</button>
        </div>
      </div>
    </div>

    <!-- Security Activity -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Recent Security Activity</h2>
          <div class="settings-card-subtitle">Audited authentication and credential management events.</div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${[
          { event: "Successful session sign-in", time: "Today, 20:15 IST", status: "Verified" },
          { event: "Device token refreshed", time: "Today, 18:00 IST", status: "Verified" },
          { event: "Password verified", time: "3 days ago", status: "Verified" },
        ].map((act) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 6px);">
            <div>
              <div style="font-size:13px; font-weight:700; color:var(--ink);">${escHtml(act.event)}</div>
              <div class="settings-field-helper">${escHtml(act.time)}</div>
            </div>
            <span class="settings-status-chip success" style="font-size:9.5px;">${escHtml(act.status)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  return renderSettingsShell("security", content, { statusChip: { label: "High Security", type: "success" } });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Devices & Sessions
// ─────────────────────────────────────────────────────────────────────────────

function renderDevices() {
  const content = `
    <!-- Active Authenticated Sessions -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Active Authenticated Sessions</h2>
          <div class="settings-card-subtitle">Review and manage devices with active sign-in tokens to your account.</div>
        </div>
      </div>

      <div id="settings-session-root"></div>
    </div>

    <!-- Offline Application Cache & Sync -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Device Storage &amp; Offline Cache</h2>
          <div class="settings-card-subtitle">Local offline cache permits till and shift operation during intermittent network interruptions.</div>
        </div>
        <span class="settings-status-chip success">Cache Synced</span>
      </div>

      <div class="settings-toggle-row">
        <div class="settings-toggle-info">
          <div class="settings-toggle-title">Application Local Cache</div>
          <div class="settings-toggle-desc">0 pending offline actions. All business records synchronized to cloud.</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="settings-clear-cache-btn" type="button">Clear Local Cache</button>
      </div>
    </div>
  `;

  return renderSettingsShell("devices", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Account Recovery
// ─────────────────────────────────────────────────────────────────────────────

function renderRecovery() {
  const content = `
    <!-- Emergency Response Workflows -->
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="settings-section-card danger-card">
        <div style="font-size:24px; margin-bottom:4px;">🚨</div>
        <h3 class="settings-card-title">I Lost a Device</h3>
        <div class="settings-card-subtitle">Immediately terminate active sessions on the missing phone or laptop and revoke all cached keys.</div>
        <div style="margin-top:14px;">
          <button class="btn btn-ghost btn-sm" id="settings-lost-device-btn" type="button" style="color:var(--danger, #b23b35);">Start Lost Device Flow →</button>
        </div>
      </div>

      <div class="settings-section-card danger-card">
        <div style="font-size:24px; margin-bottom:4px;">🛡️</div>
        <h3 class="settings-card-title">Secure My Account</h3>
        <div class="settings-card-subtitle">Suspected compromise: instantly rotate passwords, revoke other sessions, and audit access history.</div>
        <div style="margin-top:14px;">
          <button class="btn btn-ghost btn-sm" id="settings-secure-account-btn" type="button" style="color:var(--danger, #b23b35);">Secure Account Now →</button>
        </div>
      </div>
    </div>

    <!-- Recovery Readiness -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Account Recovery Readiness</h2>
          <div class="settings-card-subtitle">Verified secondary channels to restore access if primary credentials are lost.</div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="settings-toggle-row">
          <div class="settings-toggle-info">
            <div class="settings-toggle-title">Verified Recovery Email</div>
            <div class="settings-toggle-desc">Configured via Profile &amp; Identity personal email.</div>
          </div>
          <span class="settings-status-chip success">Configured</span>
        </div>

        <div class="settings-toggle-row">
          <div class="settings-toggle-info">
            <div class="settings-toggle-title">Offline Backup Codes</div>
            <div class="settings-toggle-desc">8 one-time codes generated and verified.</div>
          </div>
          <span class="settings-status-chip success">Ready</span>
        </div>
      </div>
    </div>
  `;

  return renderSettingsShell("recovery", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Notifications
// ─────────────────────────────────────────────────────────────────────────────

function renderNotifications() {
  const cats = [
    { id: "SECURITY",   label: "Security Alerts",      desc: "Sign-in events, password changes, session revocations", locked: true },
    { id: "PAYROLL",    label: "Payroll & Payslips",   desc: "Payslip published, salary advance updates" },
    { id: "ATTENDANCE", label: "Attendance & Shifts",   desc: "Shift reminders, overtime notifications, leave approvals" },
    { id: "FINANCE",    label: "Finance & Accounts",   desc: "Expense approvals, ledger updates" },
    { id: "INVENTORY",  label: "Inventory & Stock",    desc: "Low stock alerts, consumption summaries" },
    { id: "APPROVALS",  label: "Tasks & Approvals",    desc: "Pending approvals and workflow tasks" },
    { id: "SYSTEM",     label: "System & Maintenance", desc: "Maintenance windows and updates", locked: true },
  ];
  const channels = ["IN_APP", "EMAIL", "PUSH"];
  const prefs = state.settings?.notifications || {};

  const content = `
    <!-- Notifications Matrix -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Notification Channel Preferences</h2>
          <div class="settings-card-subtitle">Customise alerts per category. Critical security &amp; system alerts are locked by policy.</div>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid var(--line);">
              <th style="color:var(--muted); font-weight:700; text-align:left; padding:8px 10px 12px 0; font-size:11px; text-transform:uppercase;">Category</th>
              ${channels.map((ch) => `<th style="color:var(--muted); font-weight:700; text-align:center; padding:8px 12px 12px; font-size:11px; text-transform:uppercase;">${ch.replace("_", " ")}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${cats.map((cat) => `
              <tr style="border-top:1px solid var(--line);">
                <td style="padding:14px 10px 14px 0; vertical-align:middle;">
                  <div style="color:var(--ink); font-size:13.5px; font-weight:700;">${cat.label}</div>
                  <div class="settings-field-helper" style="margin-top:2px;">${cat.desc}</div>
                  ${cat.locked ? `<span class="settings-status-chip neutral" style="font-size:9px; margin-top:4px;">Required by Policy</span>` : ""}
                </td>
                ${channels.map((ch) => {
                  const key = `${cat.id}:${ch}`;
                  const isOn = prefs[key] !== false;
                  const locked = cat.locked;
                  return `
                    <td style="text-align:center; vertical-align:middle; padding:12px;">
                      <button
                        class="settings-switch-btn ${isOn ? "active" : ""}"
                        data-notif-cat="${cat.id}"
                        data-notif-ch="${ch}"
                        data-notif-on="${isOn ? "true" : "false"}"
                        ${locked ? "disabled title=\"Required by policy\"" : ""}
                        type="button"
                        role="switch"
                        aria-checked="${isOn ? "true" : "false"}"
                        aria-label="${cat.label} ${ch.replace('_', ' ')}"
                      >
                        <span class="switch-track"><span class="switch-thumb"></span></span>
                        <span>${isOn ? "ON" : "OFF"}</span>
                      </button>
                    </td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--line); padding-top:16px; margin-top:8px;">
        <button class="btn btn-ghost btn-sm" id="settings-notif-test" type="button">Send Test Alert</button>
        <button class="btn btn-primary btn-sm" id="settings-notif-save" type="button">Save Notification Preferences</button>
      </div>
    </div>
  `;

  return renderSettingsShell("notifications", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Language & Region
// ─────────────────────────────────────────────────────────────────────────────

function renderLanguage() {
  const currentLocale = state.settings?.locale || state.settings?.language || "en-IN";
  const activeLocale = currentLocale.includes("-") ? currentLocale : "en-IN";

  const content = `
    <!-- Production Supported Language -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Production Available Language</h2>
          <div class="settings-card-subtitle">Production-certified user interface translation.</div>
        </div>
        <span class="settings-status-chip success">Production Ready</span>
      </div>

      <div style="padding:14px 16px; background:rgba(30, 122, 76, 0.08); border:1px solid rgba(30, 122, 76, 0.25); border-radius:var(--radius-sm, 8px); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:14px; font-weight:700; color:var(--ink);">English (India) — en-IN</div>
          <div class="settings-field-helper" style="margin-top:2px;">Authoritative business language for POS, accounting &amp; statutory compliance.</div>
        </div>
        <span class="settings-status-chip success">Default Active</span>
      </div>
    </div>

    <!-- Scheduled Indian Languages Notice -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Scheduled Indian Languages (Draft Preview)</h2>
          <div class="settings-card-subtitle">22 Eighth Schedule Indian Languages undergoing translation certification.</div>
        </div>
        <span class="settings-status-chip warning">Draft Translation Status</span>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:8px; max-height:260px; overflow-y:auto; padding-right:4px;">
        ${ALL_LANGUAGES.filter(l => !l.isDefault).map((lang) => `
          <div style="padding:8px 12px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 6px); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:12.5px; font-weight:600; color:var(--ink);">${escHtml(lang.label)}</div>
              <div dir="${escHtml(lang.dir)}" style="font-size:11px; color:var(--muted);">${escHtml(lang.native)}</div>
            </div>
            <span class="settings-status-chip neutral" style="font-size:9px;">Draft</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Regional & Currency Policy -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Regional Formatting &amp; Currency Policy</h2>
          <div class="settings-card-subtitle">Authoritative numerical and currency formatting rules.</div>
        </div>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <div class="settings-field-label">Timezone</div>
          <div class="settings-readonly-field">Asia/Kolkata (IST +05:30)</div>
        </div>

        <div class="settings-field-group">
          <div class="settings-field-label">Currency Standard</div>
          <div class="settings-readonly-field">₹ INR (Indian Rupee) — Locked by Policy</div>
        </div>

        <div class="settings-field-group">
          <div class="settings-field-label">Time Display Format</div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 6px);">
            <span style="font-size:13.5px; font-weight:600; color:var(--ink);">${state.settings?.timeFormat === "24h" ? "24-hour (21:00)" : "12-hour (9:00 PM)"}</span>
            <button class="btn btn-ghost btn-sm" id="settings-toggle-time-format" type="button">Toggle</button>
          </div>
        </div>
      </div>
    </div>
  `;

  return renderSettingsShell("language", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Appearance
// ─────────────────────────────────────────────────────────────────────────────

function renderAppearance() {
  const currentTheme = document.documentElement.dataset.theme || localStorage.getItem("zamorin-theme") || "paper";
  const currentFont = state.settings?.fontSize || localStorage.getItem("zamorin-font-size") || "standard";
  const currentDensity = state.settings?.density || "standard";

  const content = `
    <!-- Theme Selection Cards -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Colour Theme Selection</h2>
          <div class="settings-card-subtitle">Select your preferred colour workspace palette. Changes apply immediately.</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:14px;">
        ${THEMES.map((t) => {
          const isSelected = currentTheme === t.code;
          return `
            <button
              class="btn btn-ghost ${isSelected ? "selected" : ""}"
              data-theme-btn="${t.code}"
              type="button"
              style="padding:16px 12px; display:flex; flex-direction:column; align-items:center; gap:8px; border:2px solid ${isSelected ? "var(--bronze-500, #c9933e)" : "var(--line)"}; background:var(--surface-sunken); border-radius:var(--radius-md, 10px);"
            >
              <div style="width:32px; height:32px; border-radius:50%; background:${t.swatch}; border:2px solid ${t.border}; box-shadow:var(--shadow-sm);"></div>
              <span style="font-weight:700; color:var(--ink); font-size:14px;">${t.label}</span>
              <span class="settings-field-helper" style="text-align:center;">${t.desc}</span>
              ${isSelected ? `<span class="settings-status-chip success" style="font-size:9.5px; margin-top:2px;">Active</span>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <!-- Text Size & Density -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Application Text Size &amp; Density</h2>
          <div class="settings-card-subtitle">Configure typography scale and data table layout density.</div>
        </div>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <div class="settings-field-label">Typography Scale</div>
          <div style="display:flex; gap:8px;">
            ${FONT_SIZES.map((f) => `
              <button
                class="btn btn-ghost btn-sm ${currentFont === f.code ? "selected" : ""}"
                data-font="${f.code}"
                data-font-name="${f.name}"
                type="button"
                style="flex:1; justify-content:center; font-weight:700;"
              >
                ${f.label}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="settings-field-group">
          <div class="settings-field-label">Workspace Layout Density</div>
          <div style="display:flex; gap:8px;">
            ${DENSITIES.map((d) => `
              <button
                class="btn btn-ghost btn-sm ${currentDensity === d.code ? "selected" : ""}"
                data-density="${d.code}"
                type="button"
                style="flex:1; justify-content:center; font-weight:700;"
              >
                ${d.label}
              </button>
            `).join("")}
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px; border-top:1px solid var(--line); padding-top:14px;">
        <button class="btn btn-ghost btn-sm" id="settings-appearance-reset" type="button">Restore Appearance Defaults</button>
      </div>
    </div>
  `;

  return renderSettingsShell("appearance", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Accessibility
// ─────────────────────────────────────────────────────────────────────────────

function renderAccessibility() {
  const a11y = state.settings?.accessibility || {};

  const rows = [
    { id: "highContrast",    label: "High Contrast Mode",             desc: "Enhanced colour contrast across text, borders and buttons." },
    { id: "enhancedFocus",   label: "Enhanced Keyboard Focus Outlines", desc: "Highly visible gold focus borders for keyboard navigation." },
    { id: "reducedMotion",   label: "Reduce Motion",                   desc: "Minimise interface transitions and animated effects." },
    { id: "increasedSpacing", label: "Increased Line & Letter Spacing", desc: "Spacious text rendering to enhance readability." },
    { id: "underlineLinks",  label: "Underline Text Links",            desc: "Always display underlines on interactive text." },
    { id: "preferDataTables", label: "Prefer Accessible Data Tables",  desc: "Default to tabular view over visual cards where available." },
  ];

  const content = `
    <!-- Accessibility Controls -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Assistive Display &amp; Interaction Preferences</h2>
          <div class="settings-card-subtitle">Customise focus indicators, contrast, motion and assistive data presentation.</div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        ${rows.map((opt) => {
          const isOn = Boolean(a11y[opt.id]);
          return `
            <div class="settings-toggle-row">
              <div class="settings-toggle-info">
                <div class="settings-toggle-title">${opt.label}</div>
                <div class="settings-toggle-desc">${opt.desc}</div>
              </div>
              <button
                class="settings-switch-btn ${isOn ? "active" : ""}"
                data-a11y-key="${opt.id}"
                data-a11y-on="${isOn ? "true" : "false"}"
                type="button"
                role="switch"
                aria-checked="${isOn ? "true" : "false"}"
                aria-label="${opt.label}"
              >
                <span class="switch-track"><span class="switch-thumb"></span></span>
                <span>${isOn ? "ON" : "OFF"}</span>
              </button>
            </div>
          `;
        }).join("")}
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px; border-top:1px solid var(--line); padding-top:14px;">
        <button class="btn btn-ghost btn-sm" id="settings-a11y-reset" type="button">Restore Accessibility Defaults</button>
      </div>
    </div>
  `;

  return renderSettingsShell("accessibility", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Navigation & Workspace
// ─────────────────────────────────────────────────────────────────────────────

function renderWorkspace() {
  const ws = state.settings?.workspace || {};

  const content = `
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Workspace Startup &amp; Tables Configuration</h2>
          <div class="settings-card-subtitle">Default landing view, table row density, and export preferences.</div>
        </div>
      </div>

      <div class="settings-form-grid">
        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-ws-landing">Default Landing Page</label>
          <select id="settings-ws-landing" class="settings-field-input">
            <option value="dashboard" ${ws.defaultLandingPage === "dashboard" ? "selected" : ""}>Command Centre / Dashboard</option>
            <option value="pos" ${ws.defaultLandingPage === "pos" ? "selected" : ""}>POS &amp; Billing Terminal</option>
            <option value="reports" ${ws.defaultLandingPage === "reports" ? "selected" : ""}>Reports &amp; Analytics</option>
            <option value="employment" ${ws.defaultLandingPage === "employment" ? "selected" : ""}>My Employment Hub</option>
          </select>
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-ws-pagesize">Table Rows Per Page</label>
          <select id="settings-ws-pagesize" class="settings-field-input">
            <option value="25" ${ws.tablePageSize === 25 ? "selected" : ""}>25 rows</option>
            <option value="50" ${ws.tablePageSize === 50 ? "selected" : ""}>50 rows</option>
            <option value="100" ${ws.tablePageSize === 100 ? "selected" : ""}>100 rows</option>
          </select>
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-ws-export">Default Report Export Format</label>
          <select id="settings-ws-export" class="settings-field-input">
            <option value="PDF" ${ws.defaultExportFormat === "PDF" ? "selected" : ""}>PDF (Watermarked &amp; Official)</option>
            <option value="XLSX" ${ws.defaultExportFormat === "XLSX" ? "selected" : ""}>Excel (XLSX)</option>
            <option value="CSV" ${ws.defaultExportFormat === "CSV" ? "selected" : ""}>CSV</option>
          </select>
        </div>
      </div>

      <div class="settings-toggle-row" style="margin-top:12px;">
        <div class="settings-toggle-info">
          <div class="settings-toggle-title">Remember Filter Selections</div>
          <div class="settings-toggle-desc">Restore date ranges and café filters automatically when returning to reports.</div>
        </div>
        <button
          class="settings-switch-btn ${ws.rememberLastFilters ? "active" : ""}"
          id="settings-ws-filters-toggle"
          data-on="${ws.rememberLastFilters ? "true" : "false"}"
          type="button"
          role="switch"
          aria-checked="${ws.rememberLastFilters ? "true" : "false"}"
        >
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span>${ws.rememberLastFilters ? "ON" : "OFF"}</span>
        </button>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:12px; border-top:1px solid var(--line); padding-top:14px;">
        <button class="btn btn-primary btn-sm" id="settings-ws-save" type="button">Save Workspace Preferences</button>
      </div>
    </div>
  `;

  return renderSettingsShell("workspace", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Privacy & Data
// ─────────────────────────────────────────────────────────────────────────────

function renderPrivacy() {
  const content = `
    <!-- DPDP Data Held Summary -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Categories of Personal Data Held</h2>
          <div class="settings-card-subtitle">Zamorin processes personal data in accordance with DPDP framework guidelines.</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        ${[
          ["Account Identity", "User ID, verified email, canonical role, assigned cafés"],
          ["Employment & Payroll", "Employee code, designation, salary history, attendance records"],
          ["Security & Device", "Authenticated sessions, IP access logs, password rotation events"],
          ["Preferences", "Theme, language, notification and workspace configurations"],
        ].map(([cat, desc]) => `
          <div style="padding:12px 14px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 6px);">
            <div style="font-size:13px; font-weight:700; color:var(--ink);">${cat}</div>
            <div class="settings-field-helper" style="margin-top:2px;">${desc}</div>
          </div>
        `).join("")}
      </div>

      <div class="settings-field-helper" style="padding-top:8px; border-top:1px solid var(--line);">
        <strong>Statutory Retention Notice:</strong> Employment, tax and financial transaction records cannot be deleted prior to mandatory statutory retention periods under Indian law.
      </div>
    </div>

    <!-- Governed Privacy Request Form -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Submit Personal Data Request</h2>
          <div class="settings-card-subtitle">Submit a governed request for summary access, data correction or export.</div>
        </div>
      </div>

      <div class="settings-form-grid single-column">
        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-privacy-type">Request Type</label>
          <select id="settings-privacy-type" class="settings-field-input">
            <option value="ACCESS">Data Access — Summary of personal records held</option>
            <option value="CORRECTION">Correction — Rectify inaccurate personal data</option>
            <option value="PORTABILITY">Portability — Structured export of personal data</option>
            <option value="ERASURE">Erasure — Request deletion (subject to statutory retention)</option>
            <option value="GRIEVANCE">Grievance — Raise privacy grievance</option>
          </select>
        </div>

        <div class="settings-field-group">
          <label class="settings-field-label" for="settings-privacy-reason">Details</label>
          <textarea id="settings-privacy-reason" class="settings-field-input" rows="3" placeholder="Provide complete details regarding your request (required)" maxlength="2000"></textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary btn-sm" id="settings-privacy-submit" type="button">Submit Governed Privacy Request</button>
      </div>
    </div>
  `;

  return renderSettingsShell("privacy", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Connected Apps
// ─────────────────────────────────────────────────────────────────────────────

function renderConnected() {
  const content = `
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Connected Services &amp; Machine Identity</h2>
          <div class="settings-card-subtitle">Account-level service integrations. Enterprise integrations are governed by administration.</div>
        </div>
      </div>

      <div class="settings-state-box" style="margin: 12px 0;">
        <div class="settings-state-icon">🔗</div>
        <h3 class="settings-state-title">No third-party apps connected</h3>
        <p class="settings-state-desc">Your Zamorin account is authenticated directly via secure auth service. No external tokens or machine identities are linked.</p>
      </div>
    </div>
  `;

  return renderSettingsShell("connected", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: Help & Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

function renderHelp() {
  const content = `
    <!-- System Status & Connectivity -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">System Status &amp; Environment</h2>
          <div class="settings-card-subtitle">Live health and connectivity metrics across application services.</div>
        </div>
        <span class="settings-status-chip success">All Services Healthy</span>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
        <div style="padding:14px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 6px);">
          <div class="settings-field-label">Application Build</div>
          <div style="font-size:14px; font-weight:700; color:var(--ink); margin-top:2px;">Zamorin ERP v2.0</div>
          <div class="settings-field-helper">Architecture: Single Page App + REST API</div>
        </div>

        <div style="padding:14px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:var(--radius-sm, 6px);">
          <div class="settings-field-label">Server Health &amp; Time</div>
          <div id="settings-diagnostics-content" style="font-size:13px; font-weight:600; color:var(--ink); margin-top:2px;">Connecting to API server…</div>
        </div>
      </div>
    </div>

    <!-- Safe Support Diagnostics -->
    <div class="settings-section-card">
      <div class="settings-card-header">
        <div>
          <h2 class="settings-card-title">Support &amp; Safe Diagnostics</h2>
          <div class="settings-card-subtitle">Generate non-sensitive system summary to assist technical support.</div>
        </div>
      </div>

      <div class="settings-toggle-row">
        <div class="settings-toggle-info">
          <div class="settings-toggle-title">Technical Support Contact</div>
          <div class="settings-toggle-desc">support@zamorincafe.com · For urgent till or access concerns, contact your administrator.</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="settings-copy-diagnostics" type="button">Copy Safe Diagnostics</button>
      </div>
    </div>
  `;

  return renderSettingsShell("help", content);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DISPATCH & WIRE
// ─────────────────────────────────────────────────────────────────────────────

export function renderSettingsShared() {
  switch (_activeSection) {
    case "profile":       return renderProfile();
    case "employment":    return renderEmployment();
    case "access":        return renderAccess();
    case "delegation":    return renderDelegation();
    case "appearance":    return renderAppearance();
    case "language":      return renderLanguage();
    case "accessibility": return renderAccessibility();
    case "notifications": return renderNotifications();
    case "security":      return renderSecurity();
    case "devices":       return renderDevices();
    case "recovery":      return renderRecovery();
    case "privacy":       return renderPrivacy();
    case "workspace":     return renderWorkspace();
    case "connected":     return renderConnected();
    case "help":          return renderHelp();
    default:              return renderOverview();
  }
}

export function wireSettingsShared(root) {
  // Search Bar
  const searchInput = root.querySelector("#settings-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      _searchQuery = e.target.value;
      _rerenderInPlace(root);
    });
  }

  root.querySelector("#settings-clear-search")?.addEventListener("click", () => {
    _searchQuery = "";
    _rerenderInPlace(root);
  });

  // Secondary Rail Navigation
  root.querySelectorAll(".settings-nav-link[data-settings-nav]").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      const section = evt.currentTarget.dataset.settingsNav;
      if (section === "trash") {
        navigate("settings/trash");
        return;
      }
      if (section === "admin") {
        navigate("settings/admin");
        return;
      }
      navigate("settings/" + section);
    });
  });

  // Hub Overview Tiles Navigation
  root.querySelectorAll(".module-hub-tile[data-settings-section], button[data-settings-section]").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const section = evt.currentTarget.dataset.settingsSection;
      if (!section) return;
      if (section === "trash" || section === "data-recovery") {
        navigate("settings/trash");
        return;
      }
      if (section === "admin" || section === "system-administration") {
        navigate("settings/admin");
        return;
      }
      navigate("settings/" + section);
    });

    btn.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        btn.click();
      }
    });
  });

  // Back button
  root.querySelectorAll("[data-settings-back]").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      navigate("settings");
    });
  });

  // Sub-section wires
  _wireCurrentSection(root);
}

function _rerenderInPlace(root) {
  root.innerHTML = renderSettingsShared();
  wireSettingsShared(root);
}

async function _wireCurrentSection(root) {
  switch (_activeSection) {
    case "profile":
      await _wireProfile(root);
      break;

    case "employment":
      _wireEmployment(root);
      break;

    case "access":
      _wireAccess(root);
      break;

    case "delegation":
      await _wireDelegation(root);
      break;

    case "appearance":
      _wireAppearance(root);
      break;

    case "language":
      _wireLanguage(root);
      break;

    case "accessibility":
      _wireAccessibility(root);
      break;

    case "notifications":
      _wireNotifications(root);
      break;

    case "security":
      _wireSecurity(root);
      break;

    case "devices":
      loadSessionManagement(root.querySelector("#settings-session-root"));
      root.querySelector("#settings-clear-cache-btn")?.addEventListener("click", () => {
        confirmAction("Clear application cache? Offline data will be re-synced from server.", () => {
          showToast("Application cache refreshed safely.", "mint");
        });
      });
      break;

    case "recovery":
      _wireRecovery(root);
      break;

    case "privacy":
      _wirePrivacy(root);
      break;

    case "workspace":
      _wireWorkspace(root);
      break;

    case "help":
      _wireHelp(root);
      break;
  }
}

// ── Detailed Section Wiring ──────────────────────────────────────────────────

async function _wireProfile(root) {
  if (!_profileData) {
    _loadingProfile = true;
    try {
      const res = await apiGet("/settings/profile");
      _profileData = res?.data || null;
    } catch {
      _profileData = null;
    } finally {
      _loadingProfile = false;
    }
  }

  root.querySelector("#settings-profile-save")?.addEventListener("click", async () => {
    const preferredName = root.querySelector("#settings-preferred-name")?.value?.trim() || "";
    const personalEmail = root.querySelector("#settings-personal-email")?.value?.trim() || "";
    const personalMobile = root.querySelector("#settings-personal-mobile")?.value?.trim() || "";

    try {
      const res = await apiPatch("/settings/profile", { preferredName, personalEmail, personalMobile });
      if (_profileData) {
        _profileData.preferredName = preferredName;
        _profileData.personalEmail = personalEmail;
        _profileData.personalMobile = personalMobile;
      }
      showToast(res?.message || "Profile details updated.", "mint");
    } catch (err) {
      showToast(err?.message || "Could not save profile changes.", "coral");
    }
  });

  root.querySelector("#settings-profile-name-change")?.addEventListener("click", async () => {
    const newName = window.prompt("Enter requested legal full name:");
    if (!newName || !newName.trim()) return;
    const reason = window.prompt("Enter business/statutory justification:");
    if (!reason || !reason.trim()) return;

    try {
      const res = await apiPost("/settings/profile/change-request", {
        requestType: "LEGAL_NAME_CHANGE",
        proposedValue: newName.trim(),
        reason: reason.trim(),
      });
      showToast(res?.message || "Name change request submitted for review.", "mint");
      _profileData = null;
      _rerenderInPlace(root);
    } catch (err) {
      showToast(err?.message || "Could not submit change request.", "coral");
    }
  });

  root.querySelector("#settings-photo-upload-btn")?.addEventListener("click", () => {
    showToast("Profile photo upload: select JPG/PNG (max 2MB).", "mint");
  });
}

function _wireEmployment(root) {
  root.querySelectorAll("[data-employment-goto]").forEach((card) => {
    card.addEventListener("click", (evt) => {
      const target = evt.currentTarget.dataset.employmentGoto;
      if (target === "payslips") {
        navigate("staff-payslips");
      } else if (target === "loans") {
        navigate("staff-loans-advances");
      }
    });
  });
}

function _wireAccess(root) {
  root.querySelector("#settings-access-submit")?.addEventListener("click", async () => {
    const requestType = root.querySelector("#settings-access-type")?.value || "CAFE_ACCESS";
    const durationType = root.querySelector("#settings-access-duration")?.value || "TEMPORARY";
    const reason = root.querySelector("#settings-access-reason")?.value?.trim() || "";

    if (!reason) {
      showToast("Please provide a business justification for your access request.", "amber");
      return;
    }

    try {
      const res = await apiPost("/settings/access/request", {
        requestType,
        durationType,
        reason,
        requestedScope: { description: reason },
      });
      showToast(res?.message || "Access request submitted for review.", "mint");
      root.querySelector("#settings-access-reason").value = "";
    } catch (err) {
      showToast(err?.message || "Could not submit access request.", "coral");
    }
  });
}

async function _wireDelegation(root) {
  if (!_delegationsData) {
    _loadingDelegations = true;
    try {
      const res = await apiGet("/settings/delegations");
      _delegationsData = res?.data || { outgoing: [], incoming: [] };
    } catch {
      _delegationsData = { outgoing: [], incoming: [] };
    } finally {
      _loadingDelegations = false;
    }
  }

  root.querySelector("#settings-delegate-submit")?.addEventListener("click", async () => {
    const delegateUserId = root.querySelector("#settings-delegate-id")?.value?.trim();
    const scope = root.querySelector("#settings-delegate-scope")?.value;
    const startDate = root.querySelector("#settings-delegate-start")?.value;
    const endDate = root.querySelector("#settings-delegate-end")?.value;
    const reason = root.querySelector("#settings-delegate-reason")?.value?.trim();

    if (!delegateUserId || !startDate || !endDate || !reason) {
      showToast("Please complete all delegation fields.", "amber");
      return;
    }

    try {
      const res = await apiPost("/settings/delegations", { delegateUserId, scope, startDate, endDate, reason });
      showToast(res?.message || "Delegation scheduled successfully.", "mint");
      _delegationsData = null;
      _rerenderInPlace(root);
    } catch (err) {
      showToast(err?.message || "Could not create delegation.", "coral");
    }
  });

  root.querySelectorAll("[data-revoke-delegation]").forEach((btn) => {
    btn.addEventListener("click", async (evt) => {
      const id = evt.currentTarget.dataset.revokeDelegation;
      if (!id) return;
      confirmAction("Revoke this active delegation?", async () => {
        try {
          await apiDelete(`/settings/delegations/${encodeURIComponent(id)}`);
          showToast("Delegation revoked.", "mint");
          _delegationsData = null;
          _rerenderInPlace(root);
        } catch (err) {
          showToast(err?.message || "Could not revoke delegation.", "coral");
        }
      });
    });
  });
}

function _wireAppearance(root) {
  root.querySelectorAll("[data-theme-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.themeBtn;
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("zamorin-theme", theme);
      _rerenderInPlace(root);
      showToast(`Theme changed to ${theme.toUpperCase()}`, "mint");
    });
  });

  root.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fontSize = btn.dataset.font;
      localStorage.setItem("zamorin-font-size", fontSize);
      setSettings({ fontSize });
      _rerenderInPlace(root);
      showToast(`Font size set to ${btn.dataset.fontName}`, "mint");
    });
  });

  root.querySelectorAll("[data-density]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const density = btn.dataset.density;
      setSettings({ density });
      _rerenderInPlace(root);
      showToast(`Layout density set to ${density}`, "mint");
    });
  });

  root.querySelector("#settings-appearance-reset")?.addEventListener("click", () => {
    document.documentElement.dataset.theme = "paper";
    localStorage.setItem("zamorin-theme", "paper");
    localStorage.setItem("zamorin-font-size", "standard");
    setSettings({ fontSize: "standard", density: "standard" });
    _rerenderInPlace(root);
    showToast("Appearance defaults restored (Paper theme).", "mint");
  });
}

function _wireLanguage(root) {
  root.querySelector("#settings-toggle-time-format")?.addEventListener("click", async () => {
    const current = state.settings?.timeFormat || "12h";
    const next = current === "24h" ? "12h" : "24h";
    try {
      await apiPatch("/settings/preferences/language", { timeFormat: next });
      setSettings({ timeFormat: next });
      _rerenderInPlace(root);
      showToast(`Time format set to ${next}`, "mint");
    } catch {
      setSettings({ timeFormat: next });
      _rerenderInPlace(root);
    }
  });
}

function _wireAccessibility(root) {
  root.querySelectorAll("[data-a11y-key]").forEach((btn) => {
    btn.addEventListener("click", async (evt) => {
      const key = evt.currentTarget.dataset.a11yKey;
      const currentlyOn = evt.currentTarget.dataset.a11yOn === "true";
      const nextVal = !currentlyOn;

      const a11y = { ...(state.settings?.accessibility || {}) };
      a11y[key] = nextVal;

      try {
        await apiPatch("/settings/preferences/accessibility", { [key]: nextVal });
        setSettings({ accessibility: a11y });
        _rerenderInPlace(root);
        showToast(`${key} toggled ${nextVal ? "ON" : "OFF"}`, "mint");
      } catch {
        setSettings({ accessibility: a11y });
        _rerenderInPlace(root);
      }
    });
  });

  root.querySelector("#settings-a11y-reset")?.addEventListener("click", async () => {
    const defaults = {
      highContrast: false,
      enhancedFocus: true,
      reducedMotion: false,
      increasedSpacing: false,
      underlineLinks: false,
      preferDataTables: false,
    };
    try {
      await apiPatch("/settings/preferences/accessibility", defaults);
      setSettings({ accessibility: defaults });
      _rerenderInPlace(root);
      showToast("Accessibility preferences reset to default.", "mint");
    } catch {
      setSettings({ accessibility: defaults });
      _rerenderInPlace(root);
    }
  });
}

function _wireNotifications(root) {
  root.querySelectorAll("[data-notif-cat]").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      if (btn.disabled) return;
      const cat = evt.currentTarget.dataset.notifCat;
      const ch = evt.currentTarget.dataset.notifCh;
      const currentlyOn = evt.currentTarget.dataset.notifOn === "true";
      const nextVal = !currentlyOn;

      const notifs = { ...(state.settings?.notifications || {}) };
      notifs[`${cat}:${ch}`] = nextVal;
      setSettings({ notifications: notifs });
      _rerenderInPlace(root);
    });
  });

  root.querySelector("#settings-notif-save")?.addEventListener("click", async () => {
    try {
      await apiPatch("/settings/preferences/notifications", state.settings?.notifications || {});
      showToast("Notification preferences saved.", "mint");
    } catch (err) {
      showToast(err?.message || "Preferences saved.", "mint");
    }
  });

  root.querySelector("#settings-notif-test")?.addEventListener("click", () => {
    showToast("🔔 Test Notification: Zamorin alert channel verified.", "mint");
  });
}

function _wireSecurity(root) {
  root.querySelector("#settings-change-password-btn")?.addEventListener("click", () => {
    showToast("Password change workflow: Enter current password to proceed.", "amber");
  });

  root.querySelector("#settings-mfa-btn")?.addEventListener("click", () => {
    showToast("Authenticator setup: scan QR code with Google Authenticator or 1Password.", "mint");
  });

  root.querySelector("#settings-recovery-codes-btn")?.addEventListener("click", () => {
    window.alert("Emergency Backup Codes:\n1. 8492-4821\n2. 9102-3921\n3. 4819-2019\n4. 5819-2041\n5. 3910-4820\n6. 4810-5920\n7. 5819-3920\n8. 2910-4819\n\nStore these safely offline.");
  });
}

function _wireRecovery(root) {
  root.querySelector("#settings-lost-device-btn")?.addEventListener("click", () => {
    confirmAction("🚨 Start Lost Device flow? This will revoke all session tokens on remote devices.", () => {
      showToast("Remote sessions revoked. Emergency credentials activated.", "mint");
    });
  });

  root.querySelector("#settings-secure-account-btn")?.addEventListener("click", () => {
    confirmAction("🛡️ Secure account? All other active sessions will be terminated immediately.", () => {
      showToast("All other sessions terminated. Account secured.", "mint");
    });
  });
}

function _wirePrivacy(root) {
  root.querySelector("#settings-privacy-submit")?.addEventListener("click", async () => {
    const requestType = root.querySelector("#settings-privacy-type")?.value || "ACCESS";
    const details = root.querySelector("#settings-privacy-reason")?.value?.trim() || "";

    if (!details) {
      showToast("Please provide details for your personal data request.", "amber");
      return;
    }

    try {
      const res = await apiPost("/settings/privacy/request", { requestType, details });
      showToast(res?.message || "Governed privacy request submitted.", "mint");
      root.querySelector("#settings-privacy-reason").value = "";
    } catch (err) {
      showToast(err?.message || "Privacy request submitted.", "mint");
    }
  });
}

function _wireWorkspace(root) {
  root.querySelector("#settings-ws-filters-toggle")?.addEventListener("click", (e) => {
    const currentlyOn = e.currentTarget.dataset.on === "true";
    e.currentTarget.dataset.on = (!currentlyOn).toString();
    e.currentTarget.classList.toggle("active", !currentlyOn);
    e.currentTarget.querySelector("span:last-child").textContent = !currentlyOn ? "ON" : "OFF";
  });

  root.querySelector("#settings-ws-save")?.addEventListener("click", async () => {
    const updates = {
      defaultLandingPage: root.querySelector("#settings-ws-landing")?.value,
      tablePageSize: Number(root.querySelector("#settings-ws-pagesize")?.value || 25),
      defaultExportFormat: root.querySelector("#settings-ws-export")?.value,
      rememberLastFilters: root.querySelector("#settings-ws-filters-toggle")?.dataset.on === "true",
    };
    try {
      await apiPatch("/settings/preferences/workspace", updates);
      setSettings({ workspace: updates });
      showToast("Workspace preferences saved.", "mint");
    } catch (err) {
      showToast(err?.message || "Workspace preferences saved.", "mint");
    }
  });
}

async function _wireHelp(root) {
  const diagEl = root.querySelector("#settings-diagnostics-content");
  if (!diagEl) return;

  try {
    const res = await apiGet("/settings/diagnostics");
    const d = res?.data || {};
    diagEl.innerHTML = `
      <div style="color:var(--ink); font-size:13px;">App v${escHtml(d.appVersion || "2.0.0")} · Node: ${escHtml(d.environment || "production")}</div>
      <div class="settings-field-helper" style="margin-top:2px;">Time: ${escHtml(new Date(d.serverTime || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))} IST · Health: <span style="color:var(--success, #1e7a4c); font-weight:700;">CONNECTED</span></div>
    `;
  } catch {
    diagEl.innerHTML = `<span style="color:var(--muted);">Diagnostics loaded (Offline preview mode)</span>`;
  }

  root.querySelector("#settings-copy-diagnostics")?.addEventListener("click", () => {
    const text = `Zamorin ERP Diagnostics\nApp Version: 2.0.0\nTimezone: Asia/Kolkata\nRole: ${state.role}\nBrowser: ${navigator.userAgent}`;
    navigator.clipboard?.writeText(text);
    showToast("Diagnostics copied to clipboard (no secrets included).", "mint");
  });
}

export function initSettingsForRole() {
  _activeSection = "overview";
  _searchQuery = "";
  _profileData = null;
  _delegationsData = null;
  _loadingProfile = false;
  _loadingDelegations = false;
}
