// =============================================================================
// PAGE: POS & Billing Terminal — Canonical Zamorin Point of Sale (SCR-019 / ADM-SCR-002)
//
// Shared canonical POS engine supporting:
//   - Primary Master (Full org scope, void authority)
//   - Normal Master (Full org scope, void authority)
//   - Cafe Operations / CAFE_ADMIN (Strict single-cafe scope, Operator Session attribution,
//     no void authority, fixed device context)
// =============================================================================
import { apiGet, apiPost } from "../apiClient.js";
import { showToast, openModal, closeModal, confirmAction } from "../components.js";
import { state } from "../state.js";
import { ROLES } from "../navigation.js";

function getOperatorSession() {
  const user = state.auth?.user || state.user || {};
  return {
    operatorUserId: user.userId || "EMP-0042",
    operatorName: user.name || "Operations Lead",
    role: user.role || "CAFE_ADMIN",
    primaryCafeId: user.primaryCafeId || "ZC-0001",
    primaryCafeName: user.primaryCafeName || "Main Outlet",
    deviceId: "DEV-CAF-01",
    businessDate: new Date().toISOString().slice(0, 10),
  };
}

// Master menu catalogue
let _menuCatalogue = [
  { id: "MNU-01", name: "Zamorin Pour-Over", category: "Hot Coffees", price: 240, foodType: "Veg", code: "PO-01", hasModifiers: true, availability: "AVAILABLE" },
  { id: "MNU-02", name: "Spanish Cortado", category: "Hot Coffees", price: 210, foodType: "Veg", code: "COR-02", hasModifiers: true, availability: "AVAILABLE" },
  { id: "MNU-03", name: "Single Origin Flat White", category: "Hot Coffees", price: 230, foodType: "Veg", code: "FW-03", hasModifiers: true, availability: "AVAILABLE" },
  { id: "MNU-04", name: "18-Hour Cold Brew", category: "Cold Brews", price: 260, foodType: "Veg", code: "CB-01", hasModifiers: true, availability: "AVAILABLE" },
  { id: "MNU-05", name: "Spiced Cardamom Latte", category: "Cold Brews", price: 280, foodType: "Veg", code: "SCL-02", hasModifiers: true, availability: "AVAILABLE" },
  { id: "MNU-06", name: "Yuzu Espresso Tonic", category: "Cold Brews", price: 290, foodType: "Veg", code: "YET-03", hasModifiers: true, availability: "AVAILABLE" },
  { id: "MNU-07", name: "Butter Croissant", category: "Bakery & Viennoiserie", price: 180, foodType: "Veg", code: "BC-01", hasModifiers: false, availability: "AVAILABLE" },
  { id: "MNU-08", name: "Pain au Chocolat", category: "Bakery & Viennoiserie", price: 210, foodType: "Veg", code: "PAC-02", hasModifiers: false, availability: "AVAILABLE" },
  { id: "MNU-09", name: "Cardamom Pistachio Babka", category: "Bakery & Viennoiserie", price: 220, foodType: "Veg", code: "CPB-03", hasModifiers: false, availability: "AVAILABLE" },
  { id: "MNU-10", name: "Avocado Sourdough Toast", category: "Savouries & Mains", price: 340, foodType: "Veg", code: "AST-01", hasModifiers: false, availability: "AVAILABLE" },
  { id: "MNU-11", name: "Smoked Chicken Panini", category: "Savouries & Mains", price: 380, foodType: "Non-Veg", code: "SCP-02", hasModifiers: false, availability: "AVAILABLE" },
  { id: "MNU-12", name: "Truffle Mushroom Brioche", category: "Savouries & Mains", price: 360, foodType: "Veg", code: "TMB-03", hasModifiers: false, availability: "AVAILABLE" },
  { id: "MNU-13", name: "Kerala Vanilla Bean Tart", category: "Desserts", price: 240, foodType: "Veg", code: "VBT-01", hasModifiers: false, availability: "AVAILABLE" },
  { id: "MNU-14", name: "Dark Roast Coffee Mousse", category: "Desserts", price: 260, foodType: "Veg", code: "DCM-02", hasModifiers: false, availability: "AVAILABLE" },
];

// POS State
let cart = []; // Array of { lineId, item, qty, modifiers, notes }
let activeServiceMode = "QUICK_SALE"; // QUICK_SALE | DINE_IN | TAKEAWAY
let activeTable = "Table 01 (Indoor)";
let activeToken = "A-101";
let guestCovers = 2;
let activeCategory = "ALL";
let activeTender = "UPI"; // UPI | CASH | CARD | SPLIT
let searchQuery = "";
let isCompactMode = false;
let discountPaisa = 0;
let discountReason = "";
let isPaymentInProgress = false;

// Subview state
let activeMainView = "POS"; // POS | PAST_ORDERS | REGISTER | DAILY_CLOSE
let pastOrdersTab = "ORDERS"; // ORDERS | STATS | CALENDAR
let pastOrdersStats = null;
let pastOrdersList = [];
let pastOrdersSearch = "";
let pastOrdersStatus = "ALL";
let salesCalendarData = null;
let activeRegisterSession = null;
let openTicketsList = [];
let openTicketsFilter = "ALL";
let openTicketsSearch = "";

// UPI Assistant State
let upiState = "READY"; // READY | GENERATING | PRESENTED | CONFIRMING | PAID | EXPIRED | FAILED
let cashReceivedAmount = 0;
let isMobileTicketOpen = false;

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>'"]/g, (tag) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[tag] || tag));
}

export function renderPOS() {
  if (activeMainView === "PAST_ORDERS") {
    return renderPastOrdersView();
  }
  return renderTerminalView();
}

function renderTerminalView() {
  const isCafeOps = state.role === ROLES.CAFE_ADMIN;
  const operator = getOperatorSession();
  const operatorName = operator?.name || state.user?.name || "Duty Operator";
  const operatorEmpId = operator?.employeeId || state.user?.employeeId || "EMP-0042";
  const cafeName = isCafeOps ? "📍 Main Outlet (ZC-0001)" : "☕ Zamorin Master POS Terminal · All Outlets";
  const deviceName = "Register 01 · DEV-CAF-01";
  const businessDateStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const filteredItems = _menuCatalogue.filter((item) => {
    const matchesCat = activeCategory === "ALL" || item.category === activeCategory;
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const subtotal = cart.reduce((acc, line) => {
    const modPrice = line.modifiers?.modifierPricePaisa ? line.modifiers.modifierPricePaisa / 100 : 0;
    return acc + (line.item.price + modPrice) * line.qty;
  }, 0);

  const discount = Math.round(discountPaisa / 100);
  const taxableAmount = Math.max(0, subtotal - discount);
  const gst = Math.round(taxableAmount * 0.05);
  const grandTotal = taxableAmount + gst;

  const categories = ["ALL", "Hot Coffees", "Cold Brews", "Bakery & Viennoiserie", "Savouries & Mains", "Desserts"];
  const totalItemCount = cart.reduce((a, c) => a + c.qty, 0);

  return `
    <div class="page-enter pos-workspace" style="display:flex;flex-direction:column;gap:12px;min-height:calc(100vh - 90px);">
      <!-- Offline Notice Banner if disconnected -->
      <div id="pos-offline-banner" style="display:${navigator.onLine ? "none" : "flex"};background:var(--danger);color:#ffffff;padding:8px 16px;border-radius:var(--radius-sm);align-items:center;justify-content:space-between;font-size:12px;font-weight:700;">
        <span>⚠️ TERMINAL OFFLINE — Cached menu active. Cash payments only permitted. Card/UPI disabled.</span>
        <span style="font-family:var(--font-mono);font-size:11px;">0 Pending Sync</span>
      </div>

      <!-- Area 1: Fixed Operational Context Bar (§10, §17, §18) -->
      <div class="card" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:var(--surface);border:1px solid var(--line);">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">⚡</span>
            <div>
              <strong style="font-size:14px;color:var(--ink);display:block;line-height:1.2;">${cafeName}</strong>
              <span style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">${deviceName} · ${businessDateStr}</span>
            </div>
          </div>

          <div style="height:24px;width:1px;background:var(--line);display:inline-block;"></div>

          <!-- Operator Attribution (§14, §15) -->
          <div style="display:flex;align-items:center;gap:6px;background:var(--surface-sunken);padding:3px 8px;border-radius:var(--radius-sm);border:1px solid var(--line);">
            <span style="font-size:11px;">👤</span>
            <span style="font-size:11.5px;font-weight:700;color:var(--ink);">${operatorName}</span>
            <span style="font-size:10px;color:var(--muted);font-family:var(--font-mono);">(${operatorEmpId})</span>
          </div>

          <!-- Service Mode Button Group (§19–§23) -->
          <div class="pos-service-btn-group" style="display:inline-flex;align-items:center;gap:6px;">
            ${[
              { id: "QUICK_SALE", icon: "⚡", label: "Quick Sale" },
              { id: "DINE_IN", icon: "🍽️", label: "Dine-In" },
              { id: "TAKEAWAY", icon: "🛍️", label: "Takeaway" },
            ].map((m) => `
              <button
                class="pos-service-mode-btn ${activeServiceMode === m.id ? "active" : ""}"
                data-service-mode="${m.id}"
                style="
                  display:inline-flex;
                  align-items:center;
                  gap:6px;
                  border:1.5px solid ${activeServiceMode === m.id ? "var(--ink, #18181b)" : "var(--line, #e2e8f0)"};
                  outline:none;
                  cursor:pointer;
                  padding:6px 14px;
                  font-size:12.5px;
                  font-weight:700;
                  font-family:inherit;
                  border-radius:8px;
                  transition:all 0.15s ease;
                  line-height:1.2;
                  background:${activeServiceMode === m.id ? "var(--ink, #18181b)" : "var(--surface, #ffffff)"};
                  color:${activeServiceMode === m.id ? "#ffffff" : "var(--ink, #1e293b)"};
                  box-shadow:${activeServiceMode === m.id ? "0 2px 5px rgba(0,0,0,0.18)" : "0 1px 2px rgba(0,0,0,0.05)"};
                "
                type="button"
              >
                <span style="font-size:13px;line-height:1;">${m.icon}</span>
                <span>${m.label}</span>
              </button>
            `).join("")}
          </div>

          <!-- Dine-In / Takeaway Metadata Controls -->
          ${activeServiceMode === "DINE_IN" ? `
            <div style="display:flex;align-items:center;gap:6px;">
              <select id="pos-table-picker" class="select" style="font-size:11.5px;padding:3px 8px;font-weight:700;">
                <option value="Table 01 (Indoor)" ${activeTable === "Table 01 (Indoor)" ? "selected" : ""}>Table 01 (Indoor)</option>
                <option value="Table 02 (Indoor)" ${activeTable === "Table 02 (Indoor)" ? "selected" : ""}>Table 02 (Indoor)</option>
                <option value="Table 03 (Patio)" ${activeTable === "Table 03 (Patio)" ? "selected" : ""}>Table 03 (Patio)</option>
                <option value="Table 04 (Indoor)" ${activeTable === "Table 04 (Indoor)" ? "selected" : ""}>Table 04 (Indoor)</option>
                <option value="Table 05 (Patio)" ${activeTable === "Table 05 (Patio)" ? "selected" : ""}>Table 05 (Patio)</option>
              </select>
              <select id="pos-covers-picker" class="select" style="font-size:11.5px;padding:3px 6px;">
                ${[1, 2, 3, 4, 5, 6, 8].map((c) => `<option value="${c}" ${guestCovers === c ? "selected" : ""}>${c}p</option>`).join("")}
              </select>
            </div>
          ` : activeServiceMode === "TAKEAWAY" ? `
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11.5px;font-weight:700;color:var(--ink);background:var(--surface-sunken);padding:3px 8px;border-radius:4px;border:1px solid var(--line);">
                Token: ${activeToken}
              </span>
            </div>
          ` : ""}
        </div>

        <!-- Top Right Actions -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="pos-service-mode-btn" id="open-tickets-btn" style="padding:6px 12px;font-size:12px;" type="button">
            📋 Open Tickets ${openTicketsList.length ? `<span class="badge warning" style="font-size:9.5px;margin-left:4px;">${openTicketsList.length}</span>` : ""}
          </button>
          <button class="pos-service-mode-btn" id="register-session-btn" style="padding:6px 12px;font-size:12px;" type="button">
            💵 Cash Drawer
          </button>
          <button class="btn btn-sm btn-secondary" id="view-past-orders-btn" style="font-size:12px;padding:6px 12px;font-weight:700;min-height:32px;" type="button">
            📜 Past Orders
          </button>
          <button class="pos-service-mode-btn" id="toggle-density-btn" style="padding:6px 10px;font-size:12px;" title="Toggle Compact Mode" type="button">
            ${isCompactMode ? "🖼️ Visual" : "☷ Compact"}
          </button>
        </div>
      </div>

      <!-- Main Split Selling Layout (§107–§112) -->
      <div class="pos-grid-layout" style="display:grid;grid-template-columns:1fr 390px;gap:14px;flex:1;align-items:start;">
        <!-- Left Column: Menu Search, Categories, Product Cards -->
        <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1px solid var(--line);">
          <!-- Search & Category Filter Bar (§24–§27) -->
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="position:relative;flex:1;min-width:220px;">
              <input type="text" id="pos-menu-search" class="input" placeholder="Search menu or code (PO-01)..." value="${escapeHtml(searchQuery)}" style="font-size:12.5px;padding:6px 28px 6px 30px;" />
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--muted);">🔍</span>
              ${searchQuery ? `
                <button id="pos-clear-search" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;" type="button">✕</button>
              ` : ""}
            </div>
            <!-- Horizontal Scrollable Category Chips (§27) -->
            <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;max-width:100%;-webkit-overflow-scrolling:touch;">
              ${categories.map((cat) => `
                <button
                  class="pos-cat-pill-btn ${activeCategory === cat ? "active" : ""}"
                  data-pos-cat="${cat}"
                  style="
                    display:inline-flex;
                    align-items:center;
                    gap:4px;
                    border:1.5px solid ${activeCategory === cat ? "var(--ink, #18181b)" : "var(--line, #e2e8f0)"};
                    outline:none;
                    cursor:pointer;
                    padding:5px 13px;
                    font-size:11.5px;
                    font-weight:700;
                    font-family:inherit;
                    border-radius:20px;
                    white-space:nowrap;
                    transition:all 0.15s ease;
                    background:${activeCategory === cat ? "var(--ink, #18181b)" : "var(--surface, #ffffff)"};
                    color:${activeCategory === cat ? "#ffffff" : "var(--ink, #1e293b)"};
                    box-shadow:${activeCategory === cat ? "0 2px 4px rgba(0,0,0,0.15)" : "0 1px 2px rgba(0,0,0,0.04)"};
                  "
                  type="button"
                >
                  ${cat === "ALL" ? "☕ All Items" : cat}
                </button>
              `).join("")}
            </div>
          </div>

          <!-- Product Cards Responsive Grid (§28–§31) -->
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${isCompactMode ? "140px" : "175px"},1fr));gap:10px;overflow-y:auto;max-height:calc(100vh - 255px);padding-right:2px;">
            ${filteredItems.length ? filteredItems.map((item) => `
              <div class="card interactive pos-item-card" data-select-product="${item.id}" style="padding:${isCompactMode ? "8px" : "12px"};cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;border:1.5px solid var(--line);background:var(--surface);transition:all 0.12s ease;border-radius:8px;min-height:96px;box-shadow:var(--shadow-xs);">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span class="status ${item.foodType === "Non-Veg" ? "danger" : "success"}" style="font-size:9px;padding:1px 4px;font-weight:800;border-radius:3px;">
                      ${item.foodType}
                    </span>
                    <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);">${item.code}</span>
                  </div>
                  <strong style="font-size:13px;color:var(--ink);display:block;margin-bottom:2px;line-height:1.25;">${item.name}</strong>
                  ${item.hasModifiers ? `<span style="font-size:10px;color:var(--bronze-600);font-weight:700;">✦ Customisable</span>` : ""}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;border-top:1px dashed var(--line);padding-top:5px;">
                  <span style="font-family:var(--font-mono);font-weight:800;font-size:14px;color:var(--ink);">₹${item.price}</span>
                  <span class="btn btn-sm btn-primary" style="padding:2px 8px;font-size:10.5px;font-weight:700;border-radius:6px;">+ Add</span>
                </div>
              </div>
            `).join("") : `
              <div style="grid-column:1/-1;text-align:center;padding:40px 10px;color:var(--muted);">
                <p style="font-size:13px;margin:0;">No menu items match "<strong>${escapeHtml(searchQuery)}</strong>"</p>
                <button class="btn btn-sm btn-secondary" id="pos-reset-search-btn" style="margin-top:8px;font-size:11.5px;" type="button">Clear Search</button>
              </div>
            `}
          </div>
        </div>

        <!-- Right Column: Active Order Ticket & Checkout Assistant (§42–§85) -->
        <div class="card pos-ticket-panel" style="padding:16px;display:flex;flex-direction:column;justify-content:space-between;background:var(--surface);border:1px solid var(--line);position:sticky;top:70px;border-radius:12px;box-shadow:var(--shadow-sm);">
          <div>
            <!-- Ticket Header & Quick Actions (§48–§50) -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--line);">
              <div>
                <h2 style="font-size:15px;font-weight:800;margin:0;color:var(--ink);">Active Order Ticket</h2>
                <span style="font-size:11px;color:var(--muted);">
                  ${activeServiceMode === "DINE_IN" ? `${activeTable} · ${guestCovers} Covers` : activeServiceMode === "TAKEAWAY" ? `Takeaway Token ${activeToken}` : "Quick Sale · Counter"}
                </span>
              </div>
              <div style="display:flex;gap:5px;">
                <button class="pos-service-mode-btn" id="hold-ticket-btn" ${!cart.length ? "disabled" : ""} style="font-size:11px;padding:3px 8px;" title="Park ticket on hold" type="button">⏸️ Hold</button>
                <button class="pos-service-mode-btn" id="clear-ticket-btn" ${!cart.length ? "disabled" : ""} style="font-size:11px;padding:3px 8px;color:var(--danger);" type="button">Clear</button>
              </div>
            </div>

            <!-- Cart Line Items (§42–§47) -->
            <div id="pos-ticket-items" style="max-height:calc(100vh - 430px);overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px;">
              ${cart.length ? cart.map((line) => {
                const modPrice = line.modifiers?.modifierPricePaisa ? line.modifiers.modifierPricePaisa / 100 : 0;
                const unitTotal = line.item.price + modPrice;
                const lineTotal = unitTotal * line.qty;
                const modSummary = line.modifiers ? [
                  line.modifiers.size !== "Regular" ? line.modifiers.size : null,
                  line.modifiers.milk !== "Standard" ? line.modifiers.milk : null,
                  line.modifiers.temperature !== "Hot" ? line.modifiers.temperature : null,
                  line.modifiers.sweetness !== "Regular" ? line.modifiers.sweetness : null,
                  ...(line.modifiers.addOns || []),
                ].filter(Boolean).join(", ") : "";

                return `
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line);">
                    <div style="flex:1;padding-right:6px;">
                      <div style="display:flex;align-items:center;gap:6px;">
                        <strong style="font-size:13px;color:var(--ink);">${line.item.name}</strong>
                        ${line.item.hasModifiers ? `
                          <button class="btn btn-sm btn-ghost" data-edit-line-mods="${line.lineId}" style="padding:0 4px;font-size:10px;color:var(--bronze-600);height:18px;" type="button">✎ Edit</button>
                        ` : ""}
                      </div>
                      ${modSummary ? `<div style="font-size:10.5px;color:var(--bronze-600);font-weight:600;line-height:1.2;">↳ ${modSummary}</div>` : ""}
                      ${line.notes ? `<div style="font-size:10px;color:var(--muted);font-style:italic;">Note: ${escapeHtml(line.notes)}</div>` : ""}
                      <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);margin-top:2px;">₹${unitTotal} × ${line.qty}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:3px;">
                      <button class="btn btn-sm btn-ghost" data-dec-line="${line.lineId}" style="padding:1px 6px;font-size:11px;min-height:26px;" type="button">−</button>
                      <span style="font-family:var(--font-mono);font-weight:800;font-size:12.5px;min-width:14px;text-align:center;">${line.qty}</span>
                      <button class="btn btn-sm btn-ghost" data-inc-line="${line.lineId}" style="padding:1px 6px;font-size:11px;min-height:26px;" type="button">+</button>
                      <button class="btn btn-sm btn-ghost" data-dup-line="${line.lineId}" title="Duplicate line" style="padding:1px 4px;font-size:10px;min-height:26px;" type="button">⎘</button>
                      <span style="font-family:var(--font-mono);font-weight:800;font-size:13.5px;min-width:55px;text-align:right;color:var(--ink);">₹${lineTotal}</span>
                    </div>
                  </div>
                `;
              }).join("") : `
                <div style="text-align:center;padding:36px 10px;color:var(--muted);">
                  <div style="font-size:28px;margin-bottom:6px;">🛒</div>
                  <strong style="font-size:13px;display:block;color:var(--ink);">Order Ticket is Empty</strong>
                  <p style="font-size:11px;margin:4px 0 0;">Select products from the menu to build an order.</p>
                </div>
              `}
            </div>
          </div>

          <!-- Financial Calculation & Payment Assistant (§59–§85) -->
          <div style="margin-top:10px;border-top:2px solid var(--line);padding-top:10px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:2px;">
              <span>Subtotal (${totalItemCount} items)</span>
              <span style="font-family:var(--font-mono);">₹${subtotal.toLocaleString("en-IN")}</span>
            </div>

            ${discount > 0 ? `
              <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--danger);margin-bottom:2px;">
                <span>Discount (${escapeHtml(discountReason || "Applied")})</span>
                <span style="font-family:var(--font-mono);">-₹${discount.toLocaleString("en-IN")}</span>
              </div>
            ` : ""}

            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px;">
              <span>GST (CGST 2.5% + SGST 2.5%)</span>
              <span style="font-family:var(--font-mono);">₹${gst.toLocaleString("en-IN")}</span>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:900;color:var(--ink);margin-bottom:10px;padding-top:4px;border-top:1px dashed var(--line);">
              <span>Total Payable</span>
              <span style="font-family:var(--font-mono);color:var(--bronze-600);font-size:19px;">₹${grandTotal.toLocaleString("en-IN")}</span>
            </div>

            <!-- Tenders Grid (§71–§85) -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">
              ${[
                { id: "UPI", label: "📱 UPI" },
                { id: "CASH", label: "💵 Cash" },
                { id: "CARD", label: "💳 Card" },
                { id: "SPLIT", label: "✂️ Split" },
              ].map((t) => `
                <button
                  class="pos-service-mode-btn ${activeTender === t.id ? "active" : ""}"
                  data-select-tender="${t.id}"
                  style="
                    display:inline-flex;
                    justify-content:center;
                    align-items:center;
                    gap:4px;
                    border:1.5px solid ${activeTender === t.id ? "var(--ink, #18181b)" : "var(--line, #e2e8f0)"};
                    outline:none;
                    cursor:pointer;
                    padding:7px 4px;
                    font-size:11.5px;
                    font-weight:700;
                    font-family:inherit;
                    border-radius:8px;
                    transition:all 0.15s ease;
                    line-height:1.2;
                    background:${activeTender === t.id ? "var(--ink, #18181b)" : "var(--surface, #ffffff)"};
                    color:${activeTender === t.id ? "#ffffff" : "var(--ink, #1e293b)"};
                    box-shadow:${activeTender === t.id ? "0 2px 5px rgba(0,0,0,0.18)" : "0 1px 2px rgba(0,0,0,0.05)"};
                  "
                  type="button"
                >
                  ${t.label}
                </button>
              `).join("")}
            </div>

            <!-- Cash Assistant Row (§76–§80) -->
            ${activeTender === "CASH" && grandTotal > 0 ? `
              <div style="background:var(--surface-sunken);padding:8px 10px;border-radius:8px;margin-bottom:8px;border:1px solid var(--line);">
                <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                  <button class="pos-service-mode-btn" data-quick-cash="${grandTotal}" style="font-size:11px;padding:3px 8px;">Exact</button>
                  <button class="pos-service-mode-btn" data-quick-cash="500" style="font-size:11px;padding:3px 8px;">₹500</button>
                  <button class="pos-service-mode-btn" data-quick-cash="1000" style="font-size:11px;padding:3px 8px;">₹1,000</button>
                  <button class="pos-service-mode-btn" data-quick-cash="2000" style="font-size:11px;padding:3px 8px;">₹2,000</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
                  <span>Received: <strong>₹${cashReceivedAmount || grandTotal}</strong></span>
                  <span style="color:var(--success);font-weight:800;">Change: ₹${Math.max(0, (cashReceivedAmount || grandTotal) - grandTotal)}</span>
                </div>
              </div>
            ` : ""}

            <!-- Charge Action Button with Duplicate-Lock (§83, §84) -->
            <button class="btn btn-primary btn-block" id="process-charge-btn" ${grandTotal <= 0 || isPaymentInProgress ? "disabled" : ""} style="padding:12px;font-size:14px;font-weight:800;min-height:46px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.15);" type="button">
              ${isPaymentInProgress ? "Confirming Payment…" : `Charge ₹${grandTotal.toLocaleString("en-IN")} (${activeTender})`}
            </button>
          </div>
        </div>
      </div>


      <!-- Mobile Sticky Ticket Summary Bar (§107, §108) -->
      <div id="pos-mobile-ticket-bar" style="display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:2px solid var(--bronze-500);padding:10px 16px;z-index:90;box-shadow:0 -4px 16px rgba(0,0,0,0.15);justify-content:space-between;align-items:center;">
        <div>
          <strong style="font-size:14px;color:var(--ink);display:block;">${totalItemCount} items · ₹${grandTotal.toLocaleString("en-IN")}</strong>
          <span style="font-size:11px;color:var(--muted);">${activeServiceMode}</span>
        </div>
        <button class="btn btn-sm btn-primary" id="mobile-view-ticket-btn" style="padding:6px 14px;font-weight:800;font-size:13px;" type="button">
          View Ticket 🛒
        </button>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// PAST ORDERS & SALES HISTORY SUBVIEW (§91–§97)
// -----------------------------------------------------------------------------
function renderPastOrdersView() {
  const stats = pastOrdersStats || {
    today: { orderCount: 0, grossSalesPaisa: 0, netSalesPaisa: 0, averageBillPaisa: 0 },
    thisMonth: { orderCount: 0, grossSalesPaisa: 0, netSalesPaisa: 0, averageBillPaisa: 0 },
    thisYear: { orderCount: 0, grossSalesPaisa: 0, netSalesPaisa: 0, averageBillPaisa: 0 },
    currentFY: { label: "FY 2026-27", orderCount: 0, grossSalesPaisa: 0, netSalesPaisa: 0, averageBillPaisa: 0 },
  };

  const isMaster = state.role === ROLES.MASTER || state.role === ROLES.OWNER;

  return `
    <div class="page-enter past-orders-workspace" style="display:flex;flex-direction:column;gap:16px;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <h1 class="page-title" style="font-size:20px;font-weight:800;margin:0 0 2px;color:var(--ink);">Past Orders & Sales History</h1>
          <p style="font-size:12.5px;color:var(--muted);margin:0;">Authoritative transaction audit, thermal receipt reprint, refunds, and daily close records.</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-primary" id="back-to-pos-btn" style="font-size:12.5px;padding:6px 14px;font-weight:700;" type="button">
            ⬅ Return to Live POS
          </button>
        </div>
      </div>

      <!-- 4 Primary KPI Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
        <div class="card" style="padding:14px;border-left:4px solid var(--bronze-500);background:var(--surface);">
          <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;">Orders Today</span>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">
            <strong style="font-size:22px;font-family:var(--font-mono);color:var(--ink);">${stats.today.orderCount}</strong>
            <span style="font-size:13px;font-weight:700;color:var(--bronze-600);">₹${(stats.today.netSalesPaisa / 100).toLocaleString("en-IN")}</span>
          </div>
          <span style="font-size:10.5px;color:var(--muted);margin-top:2px;display:block;">Avg Bill: ₹${(stats.today.averageBillPaisa / 100).toFixed(0)}</span>
        </div>

        <div class="card" style="padding:14px;border-left:4px solid var(--mint-500);background:var(--surface);">
          <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;">Orders This Month</span>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">
            <strong style="font-size:22px;font-family:var(--font-mono);color:var(--ink);">${stats.thisMonth.orderCount}</strong>
            <span style="font-size:13px;font-weight:700;color:var(--mint-600);">₹${(stats.thisMonth.netSalesPaisa / 100).toLocaleString("en-IN")}</span>
          </div>
          <span style="font-size:10.5px;color:var(--muted);margin-top:2px;display:block;">Avg Bill: ₹${(stats.thisMonth.averageBillPaisa / 100).toFixed(0)}</span>
        </div>

        <div class="card" style="padding:14px;border-left:4px solid var(--lavender-500);background:var(--surface);">
          <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;">Orders This Year</span>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">
            <strong style="font-size:22px;font-family:var(--font-mono);color:var(--ink);">${stats.thisYear.orderCount}</strong>
            <span style="font-size:13px;font-weight:700;color:var(--ink-700);">₹${(stats.thisYear.netSalesPaisa / 100).toLocaleString("en-IN")}</span>
          </div>
          <span style="font-size:10.5px;color:var(--muted);margin-top:2px;display:block;">Avg Bill: ₹${(stats.thisYear.averageBillPaisa / 100).toFixed(0)}</span>
        </div>

        <div class="card" style="padding:14px;border-left:4px solid var(--amber-500);background:var(--surface);">
          <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;">Current ${stats.currentFY.label}</span>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">
            <strong style="font-size:22px;font-family:var(--font-mono);color:var(--ink);">${stats.currentFY.orderCount}</strong>
            <span style="font-size:13px;font-weight:700;color:var(--amber-700);">₹${(stats.currentFY.netSalesPaisa / 100).toLocaleString("en-IN")}</span>
          </div>
          <span style="font-size:10.5px;color:var(--muted);margin-top:2px;display:block;">Avg Bill: ₹${(stats.currentFY.averageBillPaisa / 100).toFixed(0)}</span>
        </div>
      </div>

      <!-- Navigation Tabs for Past Orders -->
      <div style="display:flex;gap:6px;border-bottom:1px solid var(--line);padding-bottom:6px;">
        ${[
          { id: "ORDERS", label: "📜 Orders Register" },
          { id: "CALENDAR", label: "📅 Sales Calendar" },
        ].map((tab) => `
          <button class="btn btn-sm ${pastOrdersTab === tab.id ? "btn-primary" : "btn-ghost"}" data-past-tab="${tab.id}" style="font-size:12px;padding:5px 12px;font-weight:600;" type="button">
            ${tab.label}
          </button>
        `).join("")}
      </div>

      ${pastOrdersTab === "CALENDAR" ? renderSalesCalendarSubTab() : renderPastOrdersListSubTab(isMaster)}
    </div>
  `;
}

function renderPastOrdersListSubTab(isMaster) {
  const filtered = pastOrdersList.filter((o) => {
    const matchesSearch = !pastOrdersSearch ||
      (o.billId && o.billId.toLowerCase().includes(pastOrdersSearch.toLowerCase())) ||
      (o.invoiceNumber && o.invoiceNumber.toLowerCase().includes(pastOrdersSearch.toLowerCase())) ||
      (o.customerName && o.customerName.toLowerCase().includes(pastOrdersSearch.toLowerCase())) ||
      (o.tableNumber && o.tableNumber.toLowerCase().includes(pastOrdersSearch.toLowerCase()));
    const matchesStatus = pastOrdersStatus === "ALL" || o.status === pastOrdersStatus;
    return matchesSearch && matchesStatus;
  });

  return `
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1px solid var(--line);">
      <!-- Filter Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;gap:8px;flex:1;min-width:240px;">
          <input type="text" id="past-orders-search" class="input" placeholder="Search by Bill #, Invoice #, Table or Customer..." value="${escapeHtml(pastOrdersSearch)}" style="font-size:12.5px;padding:5px 10px;" />
        </div>
        <div style="display:flex;gap:6px;">
          <select id="past-orders-status-filter" class="select" style="font-size:12px;padding:4px 8px;">
            <option value="ALL" ${pastOrdersStatus === "ALL" ? "selected" : ""}>All Statuses</option>
            <option value="COMPLETED" ${pastOrdersStatus === "COMPLETED" ? "selected" : ""}>Completed</option>
            <option value="PARTIALLY_REFUNDED" ${pastOrdersStatus === "PARTIALLY_REFUNDED" ? "selected" : ""}>Partially Refunded</option>
            <option value="REFUNDED" ${pastOrdersStatus === "REFUNDED" ? "selected" : ""}>Refunded</option>
            <option value="VOIDED" ${pastOrdersStatus === "VOIDED" ? "selected" : ""}>Voided</option>
          </select>
        </div>
      </div>

      <!-- Orders Table -->
      <div style="overflow-x:auto;">
        <table class="table" style="width:100%;font-size:12px;">
          <thead>
            <tr>
              <th>Bill / Invoice #</th>
              <th>Date & Time</th>
              <th>Service Mode</th>
              <th>Table / Token</th>
              <th>Items</th>
              <th style="text-align:right;">Gross</th>
              <th style="text-align:right;">Net Paid</th>
              <th>Tender</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map((o) => `
              <tr>
                <td>
                  <strong style="font-family:var(--font-mono);color:var(--ink);">${o.invoiceNumber || o.billId}</strong>
                </td>
                <td style="color:var(--muted);">${new Date(o.createdAt || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td><span class="badge secondary" style="font-size:10px;">${o.serviceMode || o.orderType || "QUICK_SALE"}</span></td>
                <td>${o.tableNumber || o.tableToken || "Counter"}</td>
                <td>${o.lineItems?.length || 1} items</td>
                <td style="text-align:right;font-family:var(--font-mono);">₹${((o.subtotalPaisa + (o.taxPaisa || 0)) / 100).toFixed(0)}</td>
                <td style="text-align:right;font-family:var(--font-mono);font-weight:800;color:var(--ink);">₹${(o.totalPaisa / 100).toFixed(0)}</td>
                <td><span class="badge" style="font-size:10px;">${o.paymentMethod || "CASH"}</span></td>
                <td>
                  <span class="status ${o.status === "COMPLETED" ? "success" : o.status === "REFUNDED" ? "danger" : o.status === "VOIDED" ? "danger" : "warning"}" style="font-size:9.5px;">
                    ${o.status}
                  </span>
                </td>
                <td style="text-align:right;">
                  <div style="display:flex;gap:3px;justify-content:flex-end;">
                    <button class="btn btn-sm btn-ghost" data-inspect-bill="${o.billId}" style="padding:2px 5px;font-size:11px;" title="View 360 Detail" type="button">👁️</button>
                    <button class="btn btn-sm btn-ghost" data-reprint-bill="${o.billId}" style="padding:2px 5px;font-size:11px;" title="Reprint Receipt" type="button">🖨️</button>
                    ${o.status === "COMPLETED" ? `
                      <button class="btn btn-sm btn-ghost" data-refund-bill="${o.billId}" style="padding:2px 5px;font-size:11px;color:var(--danger);" title="Issue Refund" type="button">↩️</button>
                    ` : ""}
                    ${isMaster && o.status === "COMPLETED" ? `
                      <button class="btn btn-sm btn-ghost" data-void-bill="${o.billId}" style="padding:2px 5px;font-size:11px;color:var(--danger);" title="Master Void" type="button">🚫</button>
                    ` : ""}
                  </div>
                </td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="10" style="text-align:center;padding:30px;color:var(--muted);">No matching past orders found.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSalesCalendarSubTab() {
  const days = salesCalendarData?.days || [];
  return `
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1px solid var(--line);">
      <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--ink);">Daily Sales Matrix</h3>
      <p style="font-size:12px;color:var(--muted);margin:0;">Aggregated sales count and revenue per operational business date.</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:8px;">
        ${days.length ? days.map((d) => `
          <div class="card" style="padding:10px;background:var(--surface-sunken);border:1px solid var(--line);text-align:center;">
            <span style="font-size:10.5px;font-weight:700;color:var(--muted);display:block;">${d.date}</span>
            <strong style="font-size:16px;font-family:var(--font-mono);color:var(--ink);display:block;margin:2px 0;">${d.orderCount} orders</strong>
            <span style="font-size:12.5px;font-weight:700;color:var(--bronze-600);">₹${(d.netSalesPaisa / 100).toLocaleString("en-IN")}</span>
          </div>
        `).join("") : `
          <div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted);">No sales recorded for this month yet.</div>
        `}
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// EVENT WIRING & INTERACTION LOGIC
// -----------------------------------------------------------------------------
export async function wirePOS(root) {
  // Load background operational data exactly once per mount
  try {
    const statsRes = await apiGet("/bills/history/stats");
    if (statsRes?.data) pastOrdersStats = statsRes.data;

    const listRes = await apiGet("/bills?limit=50");
    if (listRes?.data?.bills) pastOrdersList = listRes.data.bills;

    const openRes = await apiGet("/bills/tickets/open");
    if (openRes?.data?.tickets) openTicketsList = openRes.data.tickets;

    const sessionRes = await apiGet("/bills/register/session/current");
    if (sessionRes?.data) activeRegisterSession = sessionRes.data;
  } catch (e) {
    console.warn("POS background data load notice:", e.message);
  }

  wirePOSEventListeners(root);
}

function wirePOSEventListeners(root) {
  // Keyboard shortcut listener: Ctrl+K or F2 focuses search
  const handleKeydown = (e) => {
    if ((e.ctrlKey && e.key === "k") || e.key === "F2") {
      e.preventDefault();
      const s = root.querySelector("#pos-menu-search");
      if (s) s.focus();
    }
  };
  window.addEventListener("keydown", handleKeydown, { once: true });

  // Subview toggle
  const pastOrdersBtn = root.querySelector("#view-past-orders-btn");
  if (pastOrdersBtn) {
    pastOrdersBtn.addEventListener("click", () => {
      activeMainView = "PAST_ORDERS";
      refreshPOSView(root);
    });
  }

  const backToPosBtn = root.querySelector("#back-to-pos-btn");
  if (backToPosBtn) {
    backToPosBtn.addEventListener("click", () => {
      activeMainView = "POS";
      refreshPOSView(root);
    });
  }

  // Service Mode Selector
  root.querySelectorAll("[data-service-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeServiceMode = btn.dataset.serviceMode;
      refreshPOSView(root);
    });
  });

  // Table Picker
  const tablePicker = root.querySelector("#pos-table-picker");
  if (tablePicker) {
    tablePicker.addEventListener("change", () => {
      activeTable = tablePicker.value;
    });
  }

  // Covers Picker
  const coversPicker = root.querySelector("#pos-covers-picker");
  if (coversPicker) {
    coversPicker.addEventListener("change", () => {
      guestCovers = parseInt(coversPicker.value, 10) || 1;
    });
  }

  // Category Filter Tabs
  root.querySelectorAll("[data-pos-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.posCat;
      refreshPOSView(root);
    });
  });

  // Search input & clear button
  const searchInput = root.querySelector("#pos-menu-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      refreshPOSView(root);
    });
  }

  const clearSearchBtn = root.querySelector("#pos-clear-search, #pos-reset-search-btn");
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      searchQuery = "";
      refreshPOSView(root);
    });
  }

  // Density Toggle
  const densityBtn = root.querySelector("#toggle-density-btn");
  if (densityBtn) {
    densityBtn.addEventListener("click", () => {
      isCompactMode = !isCompactMode;
      refreshPOSView(root);
    });
  }

  // Product Selection & Modifier Selector
  root.querySelectorAll("[data-select-product]").forEach((card) => {
    card.addEventListener("click", () => {
      const productId = card.dataset.selectProduct;
      const product = _menuCatalogue.find((p) => p.id === productId);
      if (!product) return;

      if (product.hasModifiers) {
        openModifierModal(product, null, root);
      } else {
        addLineToCart(product, null, "", 1);
        refreshPOSView(root);
      }
    });
  });

  // Cart Line Steppers & Actions
  root.querySelectorAll("[data-inc-line]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lineId = btn.dataset.incLine;
      const line = cart.find((l) => l.lineId === lineId);
      if (line) {
        line.qty += 1;
        refreshPOSView(root);
      }
    });
  });

  root.querySelectorAll("[data-dec-line]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lineId = btn.dataset.decLine;
      const idx = cart.findIndex((l) => l.lineId === lineId);
      if (idx !== -1) {
        cart[idx].qty -= 1;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
        refreshPOSView(root);
      }
    });
  });

  root.querySelectorAll("[data-dup-line]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lineId = btn.dataset.dupLine;
      const line = cart.find((l) => l.lineId === lineId);
      if (line) {
        cart.push({
          ...line,
          lineId: `LINE-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        });
        refreshPOSView(root);
      }
    });
  });

  // Edit Line Modifiers (§41)
  root.querySelectorAll("[data-edit-line-mods]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lineId = btn.dataset.editLineMods;
      const line = cart.find((l) => l.lineId === lineId);
      if (line) {
        openModifierModal(line.item, line, root);
      }
    });
  });

  // Clear Ticket with Confirmation (§48)
  const clearBtn = root.querySelector("#clear-ticket-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!cart.length) return;
      confirmAction({
        title: "Clear Current Ticket?",
        message: `${cart.length} item line(s) will be discarded from the active checkout ticket.`,
        confirmLabel: "Clear Ticket",
        confirmVariant: "danger",
        onConfirm: () => {
          cart = [];
          discountPaisa = 0;
          discountReason = "";
          cashReceivedAmount = 0;
          refreshPOSView(root);
        },
      });
    });
  }

  // Hold Ticket (§50, §51)
  const holdBtn = root.querySelector("#hold-ticket-btn");
  if (holdBtn) {
    holdBtn.addEventListener("click", async () => {
      if (!cart.length) return;
      try {
        const holdName = `${activeServiceMode === "DINE_IN" ? activeTable : activeToken} (Hold)`;
        const res = await apiPost("/bills", {
          cafeId: state.user?.assignedCafeIds?.[0] || "ZC-0001",
          orderType: activeServiceMode,
          serviceMode: activeServiceMode,
          tableNumber: activeServiceMode === "DINE_IN" ? activeTable : "",
          tableToken: activeServiceMode === "TAKEAWAY" ? activeToken : "",
          guestCovers,
          lineItems: cart.map((l) => ({
            menuItemId: l.item.id,
            quantity: l.qty,
            modifiers: l.modifiers || {},
            itemNotes: l.notes || "",
          })),
          isImmediateCompletion: false,
        });

        if (res?.data?.billId) {
          await apiPost("/bills/tickets/hold", {
            billId: res.data.billId,
            holdName,
          });
        }
        showToast("Order parked on hold successfully.", "mint");
        cart = [];
        const openRes = await apiGet("/bills/tickets/open");
        if (openRes?.data?.tickets) openTicketsList = openRes.data.tickets;
        refreshPOSView(root);
      } catch (err) {
        showToast(err.message || "Failed to hold ticket", "error");
      }
    });
  }

  // Open Tickets Modal (§52–§57)
  const openTicketsBtn = root.querySelector("#open-tickets-btn");
  if (openTicketsBtn) {
    openTicketsBtn.addEventListener("click", () => {
      openOpenTicketsModal(root);
    });
  }

  // Register Session Management Modal (§98–§104)
  const regBtn = root.querySelector("#register-session-btn");
  if (regBtn) {
    regBtn.addEventListener("click", () => {
      openRegisterModal(root);
    });
  }

  // Tender selection
  root.querySelectorAll("[data-select-tender]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTender = btn.dataset.selectTender;
      if (activeTender === "SPLIT") {
        openSplitPaymentModal(root);
      } else {
        refreshPOSView(root);
      }
    });
  });

  // Quick cash buttons
  root.querySelectorAll("[data-quick-cash]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cashReceivedAmount = Number(btn.dataset.quickCash) || 0;
      refreshPOSView(root);
    });
  });

  // Charge / Payment Processing (§73–§85)
  const chargeBtn = root.querySelector("#process-charge-btn");
  if (chargeBtn) {
    chargeBtn.addEventListener("click", async () => {
      if (!cart.length || isPaymentInProgress) return;

      const subtotal = cart.reduce((acc, l) => {
        const modPrice = l.modifiers?.modifierPricePaisa ? l.modifiers.modifierPricePaisa / 100 : 0;
        return acc + (l.item.price + modPrice) * l.qty;
      }, 0);
      const discount = Math.round(discountPaisa / 100);
      const taxable = Math.max(0, subtotal - discount);
      const gst = Math.round(taxable * 0.05);
      const grandTotal = taxable + gst;

      if (activeTender === "UPI") {
        openUpiQrAssistantModal(grandTotal, root);
      } else if (activeTender === "CARD") {
        openCardReaderModal(grandTotal, root);
      } else if (activeTender === "SPLIT") {
        openSplitPaymentModal(root);
      } else {
        await executeFinalSale(grandTotal, "CASH", root);
      }
    });
  }

  // Past Orders Tab Switching
  root.querySelectorAll("[data-past-tab]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      pastOrdersTab = btn.dataset.pastTab;
      if (pastOrdersTab === "CALENDAR") {
        try {
          const calRes = await apiGet("/bills/history/calendar");
          if (calRes?.data) salesCalendarData = calRes.data;
        } catch {}
      }
      refreshPOSView(root);
    });
  });

  // Past Orders Actions
  root.querySelectorAll("[data-inspect-bill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.dataset.inspectBill;
      const order = pastOrdersList.find((o) => o.billId === bId);
      if (order) openInspectBillModal(order);
    });
  });

  root.querySelectorAll("[data-reprint-bill]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bId = btn.dataset.reprintBill;
      try {
        await apiPost(`/bills/${bId}/reprint`, { reason: "Customer Request" });
        const order = pastOrdersList.find((o) => o.billId === bId);
        if (order) {
          openReceiptModal(order, true);
        }
      } catch (err) {
        showToast(err.message || "Failed to reprint", "error");
      }
    });
  });

  root.querySelectorAll("[data-refund-bill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.dataset.refundBill;
      const order = pastOrdersList.find((o) => o.billId === bId);
      if (order) openRefundModal(order, root);
    });
  });

  root.querySelectorAll("[data-void-bill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.dataset.voidBill;
      const order = pastOrdersList.find((o) => o.billId === bId);
      if (order) openVoidModal(order, root);
    });
  });
}

function addLineToCart(product, modifiers, notes, qty = 1) {
  const lineId = `LINE-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  cart.push({
    lineId,
    item: product,
    qty,
    modifiers: modifiers || { size: "Regular", milk: "Standard", temperature: "Hot", sweetness: "Regular", addOns: [], modifierPricePaisa: 0 },
    notes: notes || "",
  });
}

function openModifierModal(product, existingLine = null, root) {
  let selectedSize = existingLine?.modifiers?.size || "Regular";
  let selectedMilk = existingLine?.modifiers?.milk || "Standard";
  let selectedTemp = existingLine?.modifiers?.temperature || "Hot";
  let selectedSweet = existingLine?.modifiers?.sweetness || "Regular";
  let selectedAddOns = existingLine?.modifiers?.addOns ? [...existingLine.modifiers.addOns] : [];
  let itemNotes = existingLine?.notes || "";

  openModal({
    title: `Customise · ${product.name}`,
    maxWidth: "480px",
    body: `
      <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
        <!-- Size -->
        <div>
          <label style="font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Size</label>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm ${selectedSize === "Regular" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="size" data-val="Regular" data-price="0" type="button">Regular (₹0)</button>
            <button class="btn btn-sm ${selectedSize === "Large" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="size" data-val="Large" data-price="40" type="button">Large (+₹40)</button>
          </div>
        </div>

        <!-- Milk Choice -->
        <div>
          <label style="font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Milk Choice</label>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn btn-sm ${selectedMilk === "Standard" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="milk" data-val="Standard" data-price="0" type="button">Standard Dairy</button>
            <button class="btn btn-sm ${selectedMilk === "Oat Milk" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="milk" data-val="Oat Milk" data-price="50" type="button">Oat Milk (+₹50)</button>
            <button class="btn btn-sm ${selectedMilk === "Almond Milk" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="milk" data-val="Almond Milk" data-price="50" type="button">Almond (+₹50)</button>
            <button class="btn btn-sm ${selectedMilk === "Soy Milk" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="milk" data-val="Soy Milk" data-price="40" type="button">Soy (+₹40)</button>
          </div>
        </div>

        <!-- Temperature -->
        <div>
          <label style="font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Temperature</label>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm ${selectedTemp === "Hot" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="temp" data-val="Hot" data-price="0" type="button">Hot</button>
            <button class="btn btn-sm ${selectedTemp === "Iced" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="temp" data-val="Iced" data-price="20" type="button">Iced (+₹20)</button>
          </div>
        </div>

        <!-- Sweetness -->
        <div>
          <label style="font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Sweetness</label>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn btn-sm ${selectedSweet === "No Sugar" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="sweet" data-val="No Sugar" type="button">No Sugar</button>
            <button class="btn btn-sm ${selectedSweet === "Less Sugar" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="sweet" data-val="Less Sugar" type="button">Less Sugar</button>
            <button class="btn btn-sm ${selectedSweet === "Regular" ? "btn-primary" : "btn-ghost"} mod-opt" data-group="sweet" data-val="Regular" type="button">Regular</button>
          </div>
        </div>

        <!-- Add-ons -->
        <div>
          <label style="font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Add-ons</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:4px;font-size:11.5px;background:var(--surface-sunken);padding:4px 8px;border-radius:4px;cursor:pointer;">
              <input type="checkbox" id="addon-extra-shot" value="Extra Espresso Shot" ${selectedAddOns.includes("Extra Espresso Shot") ? "checked" : ""} /> Extra Shot (+₹45)
            </label>
            <label style="display:flex;align-items:center;gap:4px;font-size:11.5px;background:var(--surface-sunken);padding:4px 8px;border-radius:4px;cursor:pointer;">
              <input type="checkbox" id="addon-vanilla" value="Vanilla Syrup" ${selectedAddOns.includes("Vanilla Syrup") ? "checked" : ""} /> Vanilla (+₹35)
            </label>
            <label style="display:flex;align-items:center;gap:4px;font-size:11.5px;background:var(--surface-sunken);padding:4px 8px;border-radius:4px;cursor:pointer;">
              <input type="checkbox" id="addon-caramel" value="Caramel Drizzle" ${selectedAddOns.includes("Caramel Drizzle") ? "checked" : ""} /> Caramel (+₹30)
            </label>
          </div>
        </div>

        <!-- Special Notes -->
        <div>
          <label style="font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Special Note</label>
          <input type="text" id="mod-notes-input" class="input" placeholder="e.g. Extra hot, oat milk froth..." value="${escapeHtml(itemNotes)}" style="font-size:12px;padding:5px 8px;" />
        </div>
      </div>
    `,
    saveLabel: existingLine ? "Update Line Item" : "Add to Ticket",
    cancelLabel: "Cancel",
    onSave: () => {
      let modPricePaisa = 0;
      if (selectedSize === "Large") modPricePaisa += 4000;
      if (selectedMilk === "Oat Milk" || selectedMilk === "Almond Milk") modPricePaisa += 5000;
      if (selectedMilk === "Soy Milk") modPricePaisa += 4000;
      if (selectedTemp === "Iced") modPricePaisa += 2000;

      const addOns = [];
      if (document.querySelector("#addon-extra-shot")?.checked) {
        addOns.push("Extra Espresso Shot");
        modPricePaisa += 4500;
      }
      if (document.querySelector("#addon-vanilla")?.checked) {
        addOns.push("Vanilla Syrup");
        modPricePaisa += 3500;
      }
      if (document.querySelector("#addon-caramel")?.checked) {
        addOns.push("Caramel Drizzle");
        modPricePaisa += 3000;
      }

      itemNotes = document.querySelector("#mod-notes-input")?.value || "";

      if (existingLine) {
        existingLine.modifiers = {
          size: selectedSize,
          milk: selectedMilk,
          temperature: selectedTemp,
          sweetness: selectedSweet,
          addOns,
          modifierPricePaisa: modPricePaisa,
        };
        existingLine.notes = itemNotes;
      } else {
        addLineToCart(product, {
          size: selectedSize,
          milk: selectedMilk,
          temperature: selectedTemp,
          sweetness: selectedSweet,
          addOns,
          modifierPricePaisa: modPricePaisa,
        }, itemNotes, 1);
      }

      refreshPOSView(root);
    },
  });

  // Wire modal option buttons
  document.querySelectorAll(".mod-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      const val = btn.dataset.val;
      if (group === "size") selectedSize = val;
      if (group === "milk") selectedMilk = val;
      if (group === "temp") selectedTemp = val;
      if (group === "sweet") selectedSweet = val;

      document.querySelectorAll(`[data-group="${group}"]`).forEach((b) => {
        b.className = b.dataset.val === val ? "btn btn-sm btn-primary mod-opt" : "btn btn-sm btn-ghost mod-opt";
      });
    });
  });
}

function openUpiQrAssistantModal(grandTotal, root) {
  const txnRef = `UPI-${Date.now()}`;

  openModal({
    title: `Dynamic UPI Payment · ₹${grandTotal.toLocaleString("en-IN")}`,
    maxWidth: "480px",
    body: `
      <div style="text-align:center;padding:10px 4px 6px;">
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px;">Scan with Google Pay, PhonePe, Paytm or BHIM UPI</div>

        <!-- High Fidelity Scannable QR Matrix Card -->
        <div style="display:inline-block;padding:16px;background:#ffffff;border-radius:14px;border:2px solid var(--bronze-500, #b17d38);box-shadow:0 4px 14px rgba(0,0,0,0.08);margin-bottom:14px;">
          <svg width="190" height="190" viewBox="0 0 190 190" style="display:block;margin:0 auto;">
            <rect width="190" height="190" fill="#ffffff"/>
            <!-- Top-Left Finder -->
            <rect x="10" y="10" width="52" height="52" fill="#18181b" rx="6"/>
            <rect x="20" y="20" width="32" height="32" fill="#ffffff" rx="4"/>
            <rect x="26" y="26" width="20" height="20" fill="#18181b" rx="3"/>

            <!-- Top-Right Finder -->
            <rect x="128" y="10" width="52" height="52" fill="#18181b" rx="6"/>
            <rect x="138" y="20" width="32" height="32" fill="#ffffff" rx="4"/>
            <rect x="144" y="26" width="20" height="20" fill="#18181b" rx="3"/>

            <!-- Bottom-Left Finder -->
            <rect x="10" y="128" width="52" height="52" fill="#18181b" rx="6"/>
            <rect x="20" y="138" width="32" height="32" fill="#ffffff" rx="4"/>
            <rect x="26" y="144" width="20" height="20" fill="#18181b" rx="3"/>

            <!-- Timing and Alignment Patterns -->
            <rect x="68" y="14" width="48" height="10" fill="#18181b" rx="2"/>
            <rect x="68" y="32" width="22" height="22" fill="#18181b" rx="2"/>
            <rect x="98" y="40" width="18" height="26" fill="#18181b" rx="2"/>
            <rect x="14" y="68" width="10" height="48" fill="#18181b" rx="2"/>
            <rect x="30" y="74" width="26" height="16" fill="#18181b" rx="2"/>

            <!-- QR Data Matrix Blocks -->
            <rect x="66" y="68" width="58" height="44" fill="#18181b" rx="3"/>
            <rect x="132" y="68" width="46" height="22" fill="#18181b" rx="2"/>
            <rect x="132" y="98" width="20" height="22" fill="#18181b" rx="2"/>
            <rect x="160" y="98" width="18" height="78" fill="#18181b" rx="2"/>
            <rect x="68" y="120" width="26" height="58" fill="#18181b" rx="2"/>
            <rect x="102" y="120" width="48" height="20" fill="#18181b" rx="2"/>
            <rect x="102" y="148" width="48" height="30" fill="#18181b" rx="2"/>
            <rect x="32" y="98" width="24" height="20" fill="#18181b" rx="2"/>

            <!-- Central Zamorin Cafe Gold Emblem Badge -->
            <rect x="74" y="74" width="42" height="42" fill="#ffffff" rx="8"/>
            <rect x="77" y="77" width="36" height="36" fill="#18181b" rx="6"/>
            <text x="95" y="100" font-size="14" font-family="'Outfit', sans-serif" font-weight="900" fill="#f59e0b" text-anchor="middle">₹</text>
          </svg>
        </div>

        <div style="background:var(--surface-sunken);border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:0 auto 10px;max-width:320px;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;margin-bottom:2px;">
            <span style="color:var(--muted);">UPI ID:</span>
            <strong style="font-family:var(--font-mono);color:var(--ink);">zamorincafe@icici</strong>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;">
            <span style="color:var(--muted);">Ref:</span>
            <strong style="font-family:var(--font-mono);color:var(--bronze-600);">${txnRef}</strong>
          </div>
        </div>

        <div style="font-size:12px;color:#059669;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#059669;animation:pulse 1.5s infinite;"></span>
          Awaiting customer confirmation on terminal...
        </div>
      </div>
    `,
    saveLabel: "Confirm Payment Received",
    cancelLabel: "Cancel Payment",
    onSave: async () => {
      await executeFinalSale(grandTotal, "UPI", root, txnRef);
    },
  });
}

function openCardReaderModal(grandTotal, root) {
  const cardRef = `CARD-${Date.now()}`;
  openModal({
    title: `Card Reader Terminal · ₹${grandTotal.toLocaleString("en-IN")}`,
    maxWidth: "420px",
    body: `
      <div style="text-align:center;padding:16px 8px;">
        <div style="font-size:36px;margin-bottom:8px;">💳</div>
        <strong style="font-size:14px;color:var(--ink);display:block;">PineLabs SmartPOS Terminal Ready</strong>
        <p style="font-size:12px;color:var(--muted);margin:4px 0 12px;">Ask customer to tap, insert or swipe debit/credit card.</p>
        <div style="background:var(--surface-sunken);padding:8px 12px;border-radius:var(--radius-sm);display:inline-block;font-family:var(--font-mono);font-size:11.5px;color:var(--ink);">
          Terminal ID: PINELABS-001 · Ref: ${cardRef}
        </div>
      </div>
    `,
    saveLabel: "Simulate Card Approved",
    cancelLabel: "Cancel Transaction",
    onSave: async () => {
      await executeFinalSale(grandTotal, "CARD", root, cardRef);
    },
  });
}

function openSplitPaymentModal(root) {
  const subtotal = cart.reduce((acc, l) => {
    const modPrice = l.modifiers?.modifierPricePaisa ? l.modifiers.modifierPricePaisa / 100 : 0;
    return acc + (l.item.price + modPrice) * l.qty;
  }, 0);
  const discount = Math.round(discountPaisa / 100);
  const taxable = Math.max(0, subtotal - discount);
  const gst = Math.round(taxable * 0.05);
  const grandTotal = taxable + gst;

  let cashPart = Math.floor(grandTotal / 2);
  let upiPart = grandTotal - cashPart;

  openModal({
    title: `Split Payment Settlement · ₹${grandTotal.toLocaleString("en-IN")}`,
    maxWidth: "460px",
    body: `
      <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
        <p style="margin:0;color:var(--muted);">Allocate tender portions across payment methods.</p>

        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface-sunken);padding:8px 12px;border-radius:var(--radius-sm);">
          <label style="font-weight:700;">💵 Cash Portion (₹)</label>
          <input type="number" id="split-cash-input" class="input" value="${cashPart}" min="0" max="${grandTotal}" style="width:120px;font-weight:800;font-family:var(--font-mono);font-size:14px;" />
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface-sunken);padding:8px 12px;border-radius:var(--radius-sm);">
          <label style="font-weight:700;">📱 UPI Portion (₹)</label>
          <input type="number" id="split-upi-input" class="input" value="${upiPart}" min="0" max="${grandTotal}" style="width:120px;font-weight:800;font-family:var(--font-mono);font-size:14px;" />
        </div>

        <div style="border-top:1px dashed var(--line);padding-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:14px;">
          <span>Allocated Total</span>
          <span id="split-allocated-total" style="font-family:var(--font-mono);color:var(--bronze-600);">₹${grandTotal}</span>
        </div>
      </div>
    `,
    saveLabel: "Complete Split Payment",
    cancelLabel: "Cancel",
    onSave: async () => {
      const cAmt = Number(document.querySelector("#split-cash-input")?.value) || 0;
      const uAmt = Number(document.querySelector("#split-upi-input")?.value) || 0;

      if (cAmt + uAmt < grandTotal) {
        showToast(`Allocated ₹${cAmt + uAmt} is less than bill total ₹${grandTotal}`, "error");
        return;
      }

      const tenders = [];
      if (cAmt > 0) {
        tenders.push({ paymentMethod: "CASH", amountPaisa: cAmt * 100, provider: "CASH_REGISTER", paymentReference: `CASH-${Date.now()}` });
      }
      if (uAmt > 0) {
        tenders.push({ paymentMethod: "UPI", amountPaisa: uAmt * 100, provider: "BHIM_UPI", paymentReference: `UPI-${Date.now()}` });
      }

      await executeFinalSale(grandTotal, "SPLIT", root, "", tenders);
    },
  });
}

async function executeFinalSale(grandTotal, tender, root, paymentRef = "", customTenders = null) {
  try {
    isPaymentInProgress = true;
    const idempotencyKey = `IDEM-SALE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const cartEntries = [...cart];
    const subtotal = cartEntries.reduce((acc, l) => {
      const modPrice = l.modifiers?.modifierPricePaisa ? l.modifiers.modifierPricePaisa / 100 : 0;
      return acc + (l.item.price + modPrice) * l.qty;
    }, 0);

    const tendersList = customTenders || [
      {
        paymentMethod: tender,
        amountPaisa: grandTotal * 100,
        provider: tender === "UPI" ? "BHIM_UPI" : tender === "CARD" ? "PINELABS_TERMINAL" : "CASH_REGISTER",
        paymentReference: paymentRef || `TXN-${Date.now()}`,
      },
    ];

    const payload = {
      cafeId: state.user?.assignedCafeIds?.[0] || "ZC-0001",
      orderType: activeServiceMode,
      serviceMode: activeServiceMode,
      tableNumber: activeServiceMode === "DINE_IN" ? activeTable : "",
      tableToken: activeServiceMode === "TAKEAWAY" ? activeToken : "",
      guestCovers,
      discountPaisa,
      paymentMethod: tender,
      registerId: "REG-01",
      registerSessionId: activeRegisterSession?.registerSessionId || "",
      idempotencyKey,
      lineItems: cartEntries.map((l) => ({
        menuItemId: l.item.id,
        quantity: l.qty,
        modifiers: l.modifiers || {},
        itemNotes: l.notes || "",
      })),
      tenders: tendersList,
      isImmediateCompletion: true,
    };

    const res = await apiPost("/bills", payload);
    const billData = res?.data || {
      billId: `BILL-${Date.now()}`,
      invoiceNumber: `ZAM-BILL-${Math.floor(100000 + Math.random() * 900000)}`,
      totalPaisa: grandTotal * 100,
      subtotalPaisa: subtotal * 100,
      taxPaisa: Math.round(subtotal * 0.05) * 100,
      lineItems: cartEntries.map((l) => ({
        itemNameSnapshot: l.item.name,
        quantity: l.qty,
        unitPricePaisa: l.item.price * 100,
        modifiers: l.modifiers,
      })),
      paymentMethod: tender,
      tenders: tendersList,
    };

    cart = [];
    discountPaisa = 0;
    discountReason = "";
    cashReceivedAmount = 0;
    isPaymentInProgress = false;

    showToast(`Payment of ₹${grandTotal} confirmed successfully!`, "mint");
    openReceiptModal(billData, false);
    refreshPOSView(root);
  } catch (err) {
    isPaymentInProgress = false;
    showToast(err.message || "Sale failed", "error");
    refreshPOSView(root);
  }
}

function openReceiptModal(bill, isReprint = false) {
  const subtotal = bill.subtotalPaisa ? bill.subtotalPaisa / 100 : bill.totalPaisa ? bill.totalPaisa / 100 : 0;
  const gst = bill.taxPaisa ? bill.taxPaisa / 100 : Math.round(subtotal * 0.05);
  const grandTotal = bill.totalPaisa ? bill.totalPaisa / 100 : subtotal + gst;

  openModal({
    title: isReprint ? "Tax Invoice · [DUPLICATE REPRINT]" : "Sale Completed · Tax Invoice Receipt",
    maxWidth: "440px",
    body: `
      <div style="font-family:var(--font-mono);background:var(--surface-sunken);padding:18px;border-radius:var(--radius-sm);font-size:12px;line-height:1.5;border:1px solid var(--line);">
        <div style="text-align:center;font-weight:800;font-size:15px;margin-bottom:2px;color:var(--ink);">ZAMORIN CAFE ESTATE</div>
        <div style="text-align:center;font-size:10px;color:var(--muted);">GSTIN: 32AABCT1332L1ZV · Main Outlet</div>
        <div style="text-align:center;font-size:11px;font-weight:700;color:var(--bronze-600);margin-bottom:10px;">
          ${isReprint ? "TAX INVOICE — [DUPLICATE REPRINT]" : "TAX INVOICE / RETAIL BILL"}
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>INVOICE: <strong>${bill.invoiceNumber || bill.billId}</strong></span>
          <span>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div>DATE: ${bill.businessDate || new Date().toISOString().substring(0, 10)} · REGISTER 01</div>
        <hr style="border:0;border-top:1px dashed var(--line-strong);margin:8px 0;" />
        ${bill.lineItems?.map((li) => `
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span>${li.quantity}× ${li.itemNameSnapshot}</span>
            <span>₹${((li.unitPricePaisa * li.quantity) / 100).toFixed(0)}</span>
          </div>
        `).join("") || ""}
        <hr style="border:0;border-top:1px dashed var(--line-strong);margin:8px 0;" />
        <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>₹${subtotal.toFixed(0)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>CGST (2.5%):</span><span>₹${(gst / 2).toFixed(0)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>SGST (2.5%):</span><span>₹${(gst / 2).toFixed(0)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;margin-top:4px;padding-top:4px;border-top:1px solid var(--line);color:var(--ink);">
          <span>PAID TOTAL:</span>
          <span>₹${grandTotal.toFixed(0)}</span>
        </div>
        <div style="text-align:center;margin-top:12px;font-size:10.5px;color:var(--muted);">
          Tender: <strong>${bill.paymentMethod || "UPI"}</strong> · THANK YOU FOR VISITING ZAMORIN!
        </div>
      </div>
    `,
    saveLabel: "🖨️ Print Receipt / Done",
    cancelLabel: "Close",
    onSave: () => {
      showToast("Thermal print command sent to POS printer.", "mint");
    },
  });
}

function openOpenTicketsModal(root) {
  openModal({
    title: "Open & Held Tickets",
    maxWidth: "500px",
    body: `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${openTicketsList.length ? openTicketsList.map((t) => `
          <div class="card" style="padding:10px;display:flex;justify-content:space-between;align-items:center;background:var(--surface-sunken);border:1px solid var(--line);">
            <div>
              <strong style="font-size:13px;color:var(--ink);">${t.holdName || t.tableNumber || t.tableToken || t.billId}</strong>
              <div style="font-size:10.5px;color:var(--muted);margin-top:2px;">${t.lineItems?.length || 0} items · ₹${(t.totalPaisa / 100).toFixed(0)}</div>
            </div>
            <button class="btn btn-sm btn-primary" data-resume-ticket="${t.billId}" style="font-size:11px;padding:3px 8px;" type="button">
              Resume Ticket
            </button>
          </div>
        `).join("") : `
          <p style="text-align:center;padding:24px;color:var(--muted);font-size:12.5px;">No open or held tickets at the moment.</p>
        `}
      </div>
    `,
    cancelLabel: "Close",
  });

  document.querySelectorAll("[data-resume-ticket]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.dataset.resumeTicket;
      const ticket = openTicketsList.find((t) => t.billId === bId);
      if (ticket) {
        if (cart.length > 0) {
          confirmAction({
            title: "Replace Active Cart?",
            message: "Resuming this ticket will overwrite your current unsaved cart items.",
            confirmLabel: "Resume & Overwrite",
            onConfirm: () => {
              loadTicketIntoCart(ticket, root);
              closeModal();
            },
          });
        } else {
          loadTicketIntoCart(ticket, root);
          closeModal();
        }
      }
    });
  });
}

function loadTicketIntoCart(ticket, root) {
  cart = ticket.lineItems.map((li) => ({
    lineId: `LINE-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    item: { id: li.menuItemId, name: li.itemNameSnapshot, price: li.unitPricePaisa / 100 },
    qty: li.quantity,
    modifiers: li.modifiers,
    notes: li.itemNotes,
  }));
  activeServiceMode = ticket.serviceMode || "DINE_IN";
  activeTable = ticket.tableNumber || activeTable;
  refreshPOSView(root);
}

function openInspectBillModal(order) {
  openModal({
    title: `Order 360 Inspection · ${order.invoiceNumber || order.billId}`,
    maxWidth: "500px",
    body: `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--surface-sunken);padding:10px;border-radius:var(--radius-sm);">
          <div><span style="color:var(--muted);">Bill ID:</span> <strong>${order.billId}</strong></div>
          <div><span style="color:var(--muted);">Invoice:</span> <strong>${order.invoiceNumber}</strong></div>
          <div><span style="color:var(--muted);">Service Mode:</span> <strong>${order.serviceMode || order.orderType}</strong></div>
          <div><span style="color:var(--muted);">Table:</span> <strong>${order.tableNumber || "Counter"}</strong></div>
          <div><span style="color:var(--muted);">Business Date:</span> <strong>${order.businessDate}</strong></div>
          <div><span style="color:var(--muted);">Status:</span> <strong>${order.status}</strong></div>
        </div>

        <strong style="color:var(--ink);margin-top:2px;">Line Items & Modifiers</strong>
        <div style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;">
          ${order.lineItems?.map((li) => `
            <div style="display:flex;justify-content:space-between;padding:5px 7px;background:var(--surface-sunken);border-radius:4px;">
              <div>
                <strong>${li.quantity}× ${li.itemNameSnapshot}</strong>
                ${li.modifiers?.size ? `<div style="font-size:10.5px;color:var(--bronze-600);">${li.modifiers.size}, ${li.modifiers.milk}</div>` : ""}
              </div>
              <span style="font-family:var(--font-mono);font-weight:700;">₹${((li.unitPricePaisa * li.quantity) / 100).toFixed(0)}</span>
            </div>
          `).join("") || ""}
        </div>

        <div style="border-top:1px dashed var(--line);padding-top:6px;display:flex;justify-content:space-between;font-weight:800;font-size:14px;">
          <span>Net Total</span>
          <span style="font-family:var(--font-mono);color:var(--bronze-600);">₹${(order.totalPaisa / 100).toFixed(0)}</span>
        </div>
      </div>
    `,
    cancelLabel: "Close",
  });
}

function openRefundModal(order, root) {
  openModal({
    title: `Issue Controlled Refund · ${order.invoiceNumber || order.billId}`,
    maxWidth: "440px",
    body: `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
        <div style="background:var(--surface-sunken);padding:8px;border-radius:var(--radius-sm);">
          <div>Original Sale Total: <strong>₹${(order.totalPaisa / 100).toFixed(0)}</strong></div>
          <div>Original Tender: <strong>${order.paymentMethod}</strong></div>
        </div>

        <div>
          <label style="font-weight:700;display:block;margin-bottom:3px;">Refund Amount (₹)</label>
          <input type="number" id="refund-amount-input" class="input" value="${(order.totalPaisa / 100).toFixed(0)}" max="${(order.totalPaisa / 100).toFixed(0)}" min="1" style="font-size:13px;font-weight:700;" />
        </div>

        <div>
          <label style="font-weight:700;display:block;margin-bottom:3px;">Mandatory Reason</label>
          <select id="refund-reason-select" class="select" style="font-size:12px;width:100%;">
            <option value="Customer Complaint">Customer Complaint / Quality Issue</option>
            <option value="Incorrect Item">Incorrect Item Prepared</option>
            <option value="Order Entry Error">Order Entry Error</option>
            <option value="Customer Changed Mind">Customer Changed Mind</option>
          </select>
        </div>
      </div>
    `,
    saveLabel: "Confirm & Process Refund",
    cancelLabel: "Cancel",
    onSave: async () => {
      const amountVal = Number(document.querySelector("#refund-amount-input")?.value) || 0;
      const reasonVal = document.querySelector("#refund-reason-select")?.value || "Customer Complaint";
      try {
        await apiPost(`/bills/${order.billId}/refund`, {
          refundType: amountVal >= order.totalPaisa / 100 ? "FULL" : "PARTIAL",
          amountPaisa: amountVal * 100,
          reason: reasonVal,
        });
        showToast("Refund processed successfully.", "mint");
        const listRes = await apiGet("/bills?limit=50");
        if (listRes?.data?.bills) pastOrdersList = listRes.data.bills;
        refreshPOSView(root);
      } catch (err) {
        showToast(err.message || "Failed to process refund", "error");
      }
    },
  });
}

function openVoidModal(order, root) {
  openModal({
    title: `Master Void Authorization · ${order.invoiceNumber || order.billId}`,
    maxWidth: "440px",
    body: `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
        <p style="color:var(--danger);font-weight:700;margin:0;">⚠️ Voiding will permanently cancel this transaction and revert all financial reporting metrics.</p>
        <div>
          <label style="font-weight:700;display:block;margin-bottom:3px;">Mandatory Audit Reason</label>
          <input type="text" id="void-reason-input" class="input" placeholder="e.g. Master test transaction / Cashier double-entry" style="font-size:12.5px;" />
        </div>
      </div>
    `,
    saveLabel: "Authorize Void",
    saveVariant: "danger",
    cancelLabel: "Cancel",
    onSave: async () => {
      const reason = document.querySelector("#void-reason-input")?.value?.trim() || "";
      if (!reason) {
        showToast("Void reason is mandatory.", "error");
        return;
      }
      try {
        await apiPost(`/bills/${order.billId}/void`, { reason });
        showToast("Bill successfully voided.", "mint");
        const listRes = await apiGet("/bills?limit=50");
        if (listRes?.data?.bills) pastOrdersList = listRes.data.bills;
        refreshPOSView(root);
      } catch (err) {
        showToast(err.message || "Void denied", "error");
      }
    },
  });
}

function openRegisterModal(root) {
  openModal({
    title: "Cash Register & Shift Controls",
    maxWidth: "460px",
    body: `
      <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
        ${activeRegisterSession ? `
          <div style="background:var(--surface-sunken);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--line);">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span>Session: <strong>${activeRegisterSession.registerSessionId}</strong></span>
              <span class="status success">ACTIVE</span>
            </div>
            <div>Opening Float: <strong>₹${(activeRegisterSession.openingFloatPaisa / 100).toFixed(0)}</strong></div>
            <div>Cash Sales: <strong>₹${(activeRegisterSession.totalCashSalesPaisa / 100).toFixed(0)}</strong></div>
            <div>Expected Cash: <strong>₹${(activeRegisterSession.expectedCashPaisa / 100).toFixed(0)}</strong></div>
          </div>

          <div>
            <label style="font-weight:700;display:block;margin-bottom:3px;">Blind Cash Close (Counted Cash in Drawer)</label>
            <input type="number" id="counted-cash-input" class="input" placeholder="Enter physical cash count in ₹..." style="font-size:13px;font-weight:700;" />
          </div>
        ` : `
          <div style="text-align:center;padding:16px 0;">
            <p style="color:var(--muted);margin-bottom:10px;">No register currently open for this terminal.</p>
            <div>
              <label style="font-weight:700;display:block;margin-bottom:3px;text-align:left;">Opening Float (₹)</label>
              <input type="number" id="opening-float-input" class="input" value="2000" style="font-size:13px;font-weight:700;margin-bottom:10px;" />
            </div>
          </div>
        `}
      </div>
    `,
    saveLabel: activeRegisterSession ? "Declare Count & Close Register" : "Open Register Session",
    cancelLabel: "Cancel",
    onSave: async () => {
      if (activeRegisterSession) {
        const counted = Number(document.querySelector("#counted-cash-input")?.value) || 0;
        try {
          const res = await apiPost("/bills/register/session/close", {
            registerSessionId: activeRegisterSession.registerSessionId,
            countedCashPaisa: counted * 100,
            closingDeclarationNote: "Certified physical drawer count by cashier.",
          });
          activeRegisterSession = null;
          showToast(res.message || "Register session closed successfully.", "mint");
          refreshPOSView(root);
        } catch (err) {
          showToast(err.message || "Failed to close register", "error");
        }
      } else {
        const floatVal = Number(document.querySelector("#opening-float-input")?.value) || 0;
        try {
          const res = await apiPost("/bills/register/session/open", {
            cafeId: state.user?.assignedCafeIds?.[0] || "ZC-0001",
            registerId: "REG-01",
            openingFloatPaisa: floatVal * 100,
          });
          activeRegisterSession = res.data;
          showToast(`Register opened with ₹${floatVal} float.`, "mint");
          refreshPOSView(root);
        } catch (err) {
          showToast(err.message || "Failed to open register", "error");
        }
      }
    },
  });
}

function refreshPOSView(root) {
  const activeId = document.activeElement?.id || null;
  const cursorStart = document.activeElement?.selectionStart;
  const cursorEnd = document.activeElement?.selectionEnd;
  const content = root.querySelector(".pos-workspace, .past-orders-workspace, .pos-grid-layout") || root;
  content.innerHTML = renderPOS();
  wirePOSEventListeners(root);
  if (activeId) {
    const el = root.querySelector("#" + activeId);
    if (el) {
      el.focus();
      if (typeof cursorStart === "number" && typeof cursorEnd === "number" && el.setSelectionRange) {
        el.setSelectionRange(cursorStart, cursorEnd);
      }
    }
  }
}
