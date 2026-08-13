// =============================================================================
// PAGE: POS & Billing — API-wired
// GET  /api/v1/menu/items          — load live menu items
// POST /api/v1/bills               — create & finalise bill
// POST /api/v1/bills/:id/void      — void bill (MASTER/OWNER only)
// =============================================================================
import { apiGet, apiPost } from "../apiClient.js";
import { confirmAction, showToast } from "../components.js";
import { state } from "../state.js";

let _menuItems = [];  // fetched from backend
let cart = {};        // { menuItemId: qty }
let tender = null;

export function renderPOS() {
  cart = {};
  tender = null;
  return `
    <div class="page-enter" style="display:grid; grid-template-columns: 1fr 380px; gap:16px; height:calc(100vh - 128px);">
      <div class="glass" style="padding:22px; overflow-y:auto;">
        <div class="flex justify-between items-center" style="margin-bottom:16px;">
          <div style="color:#fff; font-weight:700; font-size:18px;" class="font-display">POS — New Sale</div>
          <div class="flex gap-sm flex-wrap" id="category-tabs">
            <div class="pill pill-mint" data-cat="ALL" style="cursor:pointer;">All</div>
          </div>
        </div>
        <div id="item-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px;">
          <div class="glass" style="padding:24px; text-align:center; grid-column:1/-1;">
            <div class="muted-white">Loading menu…</div>
          </div>
        </div>
      </div>

      <div class="glass-dark" style="padding:22px; display:flex; flex-direction:column;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Current order</div>
        <div id="cart-lines" style="flex:1; display:flex; flex-direction:column; gap:12px; overflow-y:auto;">
          ${emptyCartHtml()}
        </div>
        <div id="cart-totals" style="border-top:1px solid rgba(255,255,255,0.18); margin-top:8px; padding-top:12px; display:none;"></div>
        <div id="cafe-selector-row" style="margin-top:10px; display:none;">
          <select id="pos-cafe-select" class="input-field" style="width:100%; font-size:12px;">
            <option value="">— Select café —</option>
          </select>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" data-tender="CASH">Cash</button>
          <button class="btn btn-ghost" data-tender="CARD">Card</button>
          <button class="btn btn-ghost" data-tender="UPI">UPI</button>
          <button class="btn btn-primary" id="charge-btn" disabled>Charge ₹0.00</button>
        </div>
      </div>
    </div>
  `;
}

function emptyCartHtml() {
  return `<div style="color:rgba(255,255,255,0.55); font-size:12.5px; text-align:center; padding:30px 10px;">Tap an item to start this order</div>`;
}

function itemCard(item) {
  const gradients = [
    "135deg, rgba(2,195,154,0.5), rgba(124,109,242,0.4)",
    "135deg, rgba(255,138,101,0.5), rgba(255,190,90,0.4)",
    "135deg, rgba(124,109,242,0.5), rgba(2,195,154,0.4)",
    "135deg, rgba(255,190,90,0.5), rgba(255,138,101,0.4)",
  ];
  const grad = gradients[Math.abs(item.name.charCodeAt(0)) % gradients.length];
  const pricePaisa = item.currentPricePaisa || 0;
  const priceDisplay = (pricePaisa / 100).toFixed(0);
  return `
    <div class="glass" style="padding:16px; height:150px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" data-item="${item.menuItemId}">
      <div style="width:100%; height:60px; border-radius:12px; background:linear-gradient(${grad});"></div>
      <div>
        <div style="color:#fff; font-weight:600; font-size:13px;">${item.name}</div>
        <div class="muted-white" style="font-size:12px;">₹${priceDisplay}</div>
      </div>
    </div>
  `;
}

export async function wirePOS(root) {
  // Populate cafe selector for MASTER/OWNER who aren't cafe-scoped
  const cafeRow = root.querySelector("#cafe-selector-row");
  const cafeSelect = root.querySelector("#pos-cafe-select");
  if (["master", "owner"].includes(state.role?.toLowerCase())) {
    if (cafeRow) cafeRow.style.display = "block";
    try {
      const cafesData = await apiGet("/cafes");
      const cafes = cafesData?.data?.cafes || cafesData?.cafes || [];
      cafes.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.cafeId || c._id;
        opt.textContent = c.name || c.cafeId;
        cafeSelect.appendChild(opt);
      });
    } catch { /* silent */ }
  } else {
    // For CAFE_ADMIN, use first assigned cafe
    if (cafeSelect && state.assignedCafeIds?.length) {
      const opt = document.createElement("option");
      opt.value = state.assignedCafeIds[0];
      opt.textContent = state.assignedCafeIds[0];
      cafeSelect.appendChild(opt);
      cafeSelect.value = state.assignedCafeIds[0];
    }
  }

  // Load menu items
  try {
    const data = await apiGet("/menu/items?status=ACTIVE&limit=100");
    _menuItems = data?.data?.items || data?.items || [];
    renderItemGrid(root, _menuItems);
  } catch {
    root.querySelector("#item-grid").innerHTML = `
      <div class="glass" style="padding:24px; text-align:center; grid-column:1/-1;">
        <div class="muted-white">Could not load menu items.</div>
      </div>`;
  }

  // Wire tender buttons
  root.querySelectorAll("[data-tender]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (Object.keys(cart).length === 0) return;
      tender = btn.dataset.tender;
      root.querySelectorAll("[data-tender]").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });

  // Wire charge button
  root.querySelector("#charge-btn").addEventListener("click", () => {
    const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);
    if (itemCount === 0) return;
    if (!tender) { showToast("Choose a tender before charging", "amber"); return; }

    const cafeId = cafeSelect?.value;
    if (!cafeId) { showToast("Select a café before charging", "amber"); return; }

    const { total } = cartTotal();
    confirmAction({
      title: `Charge ₹${(total / 100).toFixed(2)}?`,
      description: `${itemCount} item(s), paid by ${tender}. This will create a bill record.`,
      confirmLabel: "Confirm charge",
      onConfirm: () => submitBill(root, cafeId),
    });
  });
}

function renderItemGrid(root, items) {
  const grid = root.querySelector("#item-grid");
  if (!items.length) {
    grid.innerHTML = `<div class="glass" style="padding:24px; text-align:center; grid-column:1/-1;"><div class="muted-white">No active menu items found.</div></div>`;
    return;
  }
  grid.innerHTML = items.map(itemCard).join("");
  grid.querySelectorAll("[data-item]").forEach((card) => {
    card.addEventListener("click", () => {
      cart[card.dataset.item] = (cart[card.dataset.item] || 0) + 1;
      renderCartPanel(root);
    });
  });
}

function cartTotal() {
  let subtotalPaisa = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const item = _menuItems.find((m) => m.menuItemId === id);
    if (item) subtotalPaisa += (item.currentPricePaisa || 0) * qty;
  }
  const taxPaisa = Math.round(subtotalPaisa * 0.05);
  return { subtotalPaisa, taxPaisa, total: subtotalPaisa + taxPaisa };
}

function renderCartPanel(root) {
  const linesEl = root.querySelector("#cart-lines");
  const totalsEl = root.querySelector("#cart-totals");
  const chargeBtn = root.querySelector("#charge-btn");

  const entries = Object.entries(cart);
  if (entries.length === 0) {
    linesEl.innerHTML = emptyCartHtml();
    totalsEl.style.display = "none";
    chargeBtn.textContent = "Charge ₹0.00";
    chargeBtn.disabled = true;
    return;
  }

  linesEl.innerHTML = entries.map(([id, qty]) => {
    const item = _menuItems.find((m) => m.menuItemId === id);
    const name = item?.name || id;
    const lineTotal = ((item?.currentPricePaisa || 0) * qty / 100).toFixed(0);
    return `
      <div class="flex justify-between" style="color:#fff; font-size:13px; align-items:center;">
        <div>${qty} × ${name}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span>₹${lineTotal}</span>
          <button data-remove="${id}" style="background:none;border:none;color:rgba(255,100,100,0.8);cursor:pointer;font-size:12px;">✕</button>
        </div>
      </div>`;
  }).join("");

  // Wire remove buttons
  linesEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      delete cart[btn.dataset.remove];
      renderCartPanel(root);
    });
  });

  const { subtotalPaisa, taxPaisa, total } = cartTotal();
  totalsEl.style.display = "block";
  totalsEl.innerHTML = `
    <div class="flex justify-between muted-white" style="font-size:12.5px;"><div>Subtotal</div><div>₹${(subtotalPaisa / 100).toFixed(2)}</div></div>
    <div class="flex justify-between muted-white" style="font-size:12.5px; margin-top:6px;"><div>GST (5%)</div><div>₹${(taxPaisa / 100).toFixed(2)}</div></div>
    <div class="flex justify-between" style="color:#fff; font-weight:700; font-size:17px; margin-top:10px;"><div>Total</div><div>₹${(total / 100).toFixed(2)}</div></div>
  `;
  chargeBtn.textContent = `Charge ₹${(total / 100).toFixed(2)}`;
  chargeBtn.disabled = false;
}

async function submitBill(root, cafeId) {
  const lineItems = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
  try {
    const result = await apiPost("/bills", {
      body: {
        cafeId,
        orderType: "DINE_IN",
        lineItems,
        paymentMethod: tender,
        isImmediateCompletion: true,
      },
    });
    const billId = result?.data?.bill?.billId || result?.bill?.billId || "—";
    showToast(`Sale complete — ${billId}`, "mint");
    cart = {};
    tender = null;
    renderCartPanel(root);
    root.querySelectorAll("[data-tender]").forEach((b) => b.classList.remove("selected"));
  } catch (err) {
    showToast(err?.message || "Could not complete sale", "coral");
  }
}
