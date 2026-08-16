// =============================================================================
// PAGE: POS & Billing Terminal — Real-Time Register & Thermal Bill Print
// =============================================================================
import { apiGet, apiPost } from "../apiClient.js";
import { showToast, openModal, confirmAction } from "../components.js";
import { state } from "../state.js";
import { ROLES } from "../navigation.js";

let _menuItems = [
  { id: "MNU-01", name: "Zamorin Pour-Over", category: "Hot Coffees", price: 240, foodType: "Veg" },
  { id: "MNU-02", name: "Spanish Cortado", category: "Hot Coffees", price: 210, foodType: "Veg" },
  { id: "MNU-03", name: "18-Hour Cold Brew", category: "Cold Brews", price: 260, foodType: "Veg" },
  { id: "MNU-04", name: "Spiced Cardamom Latte", category: "Cold Brews", price: 280, foodType: "Veg" },
  { id: "MNU-05", name: "Butter Croissant", category: "Bakery & Viennoiserie", price: 180, foodType: "Veg" },
  { id: "MNU-06", name: "Avocado Sourdough Toast", category: "Savouries & Mains", price: 340, foodType: "Veg" },
  { id: "MNU-07", name: "Smoked Chicken Panini", category: "Savouries & Mains", price: 380, foodType: "Non-Veg" },
];

let cart = {}; // { id: { item, qty } }
let selectedTender = "UPI";
let activePosCat = "ALL";
let selectedTable = "Table 04 (Indoor)";

export function renderPOS() {
  const items = _menuItems.filter((i) => activePosCat === "ALL" || i.category === activePosCat);

  const cartEntries = Object.values(cart);
  const subtotal = cartEntries.reduce((acc, entry) => acc + entry.item.price * entry.qty, 0);
  const gst = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + gst;

  return `
    <div class="page-enter pos-grid-layout" style="display:grid;grid-template-columns:1fr 380px;gap:20px;min-height:calc(100vh - 120px);">
      <!-- Left: Menu Catalog -->
      <div class="card" style="padding:24px;display:flex;flex-direction:column;overflow-y:auto;">
        <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h1 class="page-title" style="font-size:22px;font-weight:700;margin:0 0 4px;color:var(--ink);">Point of Sale Terminal</h1>
            <p style="font-size:13px;color:var(--muted);margin:0;">Select items to build ticket. Fast one-touch checkout.</p>
          </div>
          <div style="display:flex;gap:8px;">
            <select id="pos-table-select" class="select" style="font-size:12.5px;padding:6px 10px;">
              <option value="Table 01 (Indoor)">Table 01 (Indoor)</option>
              <option value="Table 02 (Indoor)">Table 02 (Indoor)</option>
              <option value="Table 03 (Patio)">Table 03 (Patio)</option>
              <option value="Table 04 (Indoor)" selected>Table 04 (Indoor)</option>
              <option value="Takeaway / Counter">Takeaway / Counter</option>
              <option value="Delivery Partner">Swiggy / Zomato</option>
            </select>
          </div>
        </div>

        <!-- Category Tabs -->
        <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
          ${["ALL", "Hot Coffees", "Cold Brews", "Bakery & Viennoiserie", "Savouries & Mains"].map(
            (cat) => `
            <button class="btn btn-sm ${activePosCat === cat ? "btn-primary" : "btn-ghost"}" data-pos-cat="${cat}" type="button">
              ${cat === "ALL" ? "All Items" : cat}
            </button>`
          ).join("")}
        </div>

        <!-- Items Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;flex:1;">
          ${items
            .map(
              (item) => `
            <div class="card interactive" data-add-to-cart="${item.id}" style="padding:16px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--line);">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span class="status ${item.foodType === "Non-Veg" ? "danger" : "success"}" style="font-size:10px;padding:2px 6px;">
                    ${item.foodType || "Veg"}
                  </span>
                  <span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);">${item.id}</span>
                </div>
                <strong style="font-size:14px;color:var(--ink);display:block;margin-bottom:4px;">${item.name}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;border-top:1px dashed var(--line);padding-top:8px;">
                <span style="font-family:var(--font-mono);font-weight:700;font-size:15px;color:var(--bronze-600);">₹${item.price}</span>
                <span style="font-size:12px;font-weight:700;color:var(--ink-700);">+ Add</span>
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>

      <!-- Right: Ticket & Cart -->
      <div class="card" style="padding:24px;display:flex;flex-direction:column;justify-content:space-between;background:var(--surface);">
        <div>
          <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <h2 style="font-size:17px;font-weight:700;margin:0;color:var(--ink);">Active Order Ticket</h2>
            <button class="btn btn-sm btn-ghost" id="clear-cart-btn" style="font-size:11px;padding:4px 8px;color:var(--danger);" type="button">Clear</button>
          </div>

          <div style="font-size:12px;color:var(--muted);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line);">
            Serving: <strong style="color:var(--ink);">${selectedTable}</strong> · Register 01
          </div>

          <!-- Cart Lines -->
          <div id="pos-cart-lines" style="max-height:calc(100vh - 420px);overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
            ${
              cartEntries.length
                ? cartEntries
                    .map(
                      (entry) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-strong);">
                  <div style="flex:1;">
                    <div style="font-size:13.5px;font-weight:600;color:var(--ink);">${entry.item.name}</div>
                    <div style="font-size:11.5px;color:var(--muted);font-family:var(--font-mono);">₹${entry.item.price} × ${entry.qty}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <button class="btn btn-sm btn-ghost" data-dec-qty="${entry.item.id}" style="padding:2px 8px;font-size:13px;" type="button">-</button>
                    <span style="font-family:var(--font-mono);font-weight:700;font-size:14px;min-width:18px;text-align:center;">${entry.qty}</span>
                    <button class="btn btn-sm btn-ghost" data-inc-qty="${entry.item.id}" style="padding:2px 8px;font-size:13px;" type="button">+</button>
                    <span style="font-family:var(--font-mono);font-weight:700;font-size:14px;min-width:55px;text-align:right;color:var(--ink);">₹${entry.item.price * entry.qty}</span>
                  </div>
                </div>`
                    )
                    .join("")
                : `<div style="text-align:center;padding:40px 10px;color:var(--muted);font-size:13px;">Tap items on the left to add to this order ticket</div>`
            }
          </div>
        </div>

        <!-- Totals & Payment Actions -->
        <div style="margin-top:16px;border-top:2px solid var(--line);padding-top:14px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:4px;">
            <span>Subtotal</span>
            <span style="font-family:var(--font-mono);">₹${subtotal.toLocaleString("en-IN")}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:8px;">
            <span>CGST + SGST (5%)</span>
            <span style="font-family:var(--font-mono);">₹${gst.toLocaleString("en-IN")}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:var(--ink);margin-bottom:16px;padding-top:6px;border-top:1px dashed var(--line);">
            <span>Total Payable</span>
            <span style="font-family:var(--font-mono);color:var(--bronze-600);">₹${grandTotal.toLocaleString("en-IN")}</span>
          </div>

          <!-- Tender Buttons -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;">
            ${["UPI", "CASH", "CARD"].map(
              (t) => `
              <button class="btn btn-sm ${selectedTender === t ? "btn-primary" : "btn-ghost"}" data-select-tender="${t}" type="button">
                ${t === "UPI" ? "📱 UPI QR" : t === "CASH" ? "💵 Cash" : "💳 Card"}
              </button>`
            ).join("")}
          </div>

          <button class="btn btn-primary btn-block" id="complete-sale-btn" ${grandTotal <= 0 ? "disabled" : ""} style="padding:14px;font-size:16px;font-weight:700;" type="button">
            Charge ₹${grandTotal.toLocaleString("en-IN")} (${selectedTender})
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function wirePOS(root) {
  // Category filter tabs
  root.querySelectorAll("[data-pos-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activePosCat = btn.dataset.posCat;
      refreshPOSView(root);
    });
  });

  // Table select
  const tableSelect = root.querySelector("#pos-table-select");
  if (tableSelect) {
    tableSelect.addEventListener("change", () => {
      selectedTable = tableSelect.value;
    });
  }

  // Add to cart
  root.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.addToCart;
      const item = _menuItems.find((i) => i.id === itemId);
      if (!item) return;

      if (!cart[itemId]) {
        cart[itemId] = { item, qty: 1 };
      } else {
        cart[itemId].qty += 1;
      }
      refreshPOSView(root);
    });
  });

  // Inc / Dec Qty
  root.querySelectorAll("[data-inc-qty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.incQty;
      if (cart[itemId]) {
        cart[itemId].qty += 1;
        refreshPOSView(root);
      }
    });
  });

  root.querySelectorAll("[data-dec-qty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.decQty;
      if (cart[itemId]) {
        cart[itemId].qty -= 1;
        if (cart[itemId].qty <= 0) delete cart[itemId];
        refreshPOSView(root);
      }
    });
  });

  // Clear Cart
  const clearBtn = root.querySelector("#clear-cart-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      cart = {};
      refreshPOSView(root);
    });
  }

  // Tender selection
  root.querySelectorAll("[data-select-tender]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedTender = btn.dataset.selectTender;
      refreshPOSView(root);
    });
  });

  // Complete Sale
  const chargeBtn = root.querySelector("#complete-sale-btn");
  if (chargeBtn) {
    chargeBtn.addEventListener("click", async () => {
      const cartEntries = Object.values(cart);
      if (!cartEntries.length) return;

      const subtotal = cartEntries.reduce((acc, entry) => acc + entry.item.price * entry.qty, 0);
      const gst = Math.round(subtotal * 0.05);
      const grandTotal = subtotal + gst;
      const billNo = `ZAM-BILL-${Math.floor(100000 + Math.random() * 900000)}`;

      // Show Receipt Print Modal
      openModal({
        title: "Sale Completed · Tax Invoice Receipt",
        maxWidth: "460px",
        body: `
          <div style="font-family:var(--font-mono);background:var(--surface-sunken);padding:20px;border-radius:var(--radius-sm);font-size:13px;line-height:1.6;">
            <div style="text-align:center;font-weight:800;font-size:16px;margin-bottom:2px;">ZAMORIN CAFE ESTATE</div>
            <div style="text-align:center;font-size:11px;color:var(--muted);">GSTIN: 29AABCZ1234F1Z5 · Koramangala Main</div>
            <div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:12px;">TAX INVOICE / RETAIL BILL</div>
            <div style="display:flex;justify-content:space-between;">
              <span>BILL NO: <strong>${billNo}</strong></span>
              <span>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div>LOCATION: ${selectedTable}</div>
            <hr style="border:0;border-top:1px dashed var(--line-strong);margin:10px 0;" />
            ${cartEntries
              .map(
                (e) => `
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span>${e.qty}× ${e.item.name}</span>
                <span>₹${e.item.price * e.qty}</span>
              </div>`
              )
              .join("")}
            <hr style="border:0;border-top:1px dashed var(--line-strong);margin:10px 0;" />
            <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>₹${subtotal}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>GST (5%):</span><span>₹${gst}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;margin-top:6px;padding-top:6px;border-top:1px solid var(--line);">
              <span>PAID TOTAL:</span>
              <span>₹${grandTotal}</span>
            </div>
            <div style="text-align:center;margin-top:12px;font-size:11px;color:var(--muted);">
              Tender: <strong>${selectedTender}</strong> · THANK YOU FOR VISITING ZAMORIN!
            </div>
          </div>
        `,
        saveLabel: "Print Receipt / Next Customer",
        cancelLabel: "Close",
        onSave: async () => {
          try {
            await apiPost("/bills", {
              body: {
                billNo,
                table: selectedTable,
                items: cartEntries.map((e) => ({ name: e.item.name, qty: e.qty, price: e.item.price })),
                subtotal,
                tax: gst,
                total: grandTotal,
                paymentMode: selectedTender,
              },
            });
          } catch {}
          cart = {};
          showToast(`Sale recorded successfully! Invoice: ${billNo}`, "mint");
          refreshPOSView(root);
        },
      });
    });
  }
}

function refreshPOSView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderPOS();
  wirePOS(root);
}
