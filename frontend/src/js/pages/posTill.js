// =============================================================================
// PAGE: POS & Billing — Till / New Sale (Part G.2 / Part M.1 of the guideline)
// Fully interactive: clicking an item adds it to the cart, the cart total
// recalculates instantly client-side (Part H.2 — no network round trip per
// item added), and charging shows the confirmation + toast pattern used
// consistently everywhere in the app (Part J.2/J.3).
// =============================================================================
import { confirmAction, showToast } from "../components.js";

const MENU = [
  { id: "cap", name: "Cappuccino", price: 180, gradient: "135deg, rgba(2,195,154,0.5), rgba(124,109,242,0.4)" },
  { id: "cb", name: "Cold Brew", price: 220, gradient: "135deg, rgba(255,138,101,0.5), rgba(255,190,90,0.4)" },
  { id: "chai", name: "Masala Chai", price: 120, gradient: "135deg, rgba(124,109,242,0.5), rgba(2,195,154,0.4)" },
  { id: "croissant", name: "Butter Croissant", price: 150, gradient: "135deg, rgba(255,190,90,0.5), rgba(255,138,101,0.4)" },
  { id: "americano", name: "Americano", price: 160, gradient: "135deg, rgba(2,195,154,0.5), rgba(255,138,101,0.35)" },
  { id: "muffin", name: "Blueberry Muffin", price: 140, gradient: "135deg, rgba(124,109,242,0.5), rgba(255,190,90,0.35)" },
  { id: "latte", name: "Iced Latte", price: 200, gradient: "135deg, rgba(255,138,101,0.5), rgba(2,195,154,0.35)" },
  { id: "greentea", name: "Green Tea", price: 110, gradient: "135deg, rgba(255,190,90,0.5), rgba(124,109,242,0.35)" },
];

let cart = {}; // { itemId: qty }
let tender = null;

export function renderPOS() {
  cart = {};
  tender = null;
  return `
    <div class="page-enter" style="display:grid; grid-template-columns: 1fr 380px; gap:16px; height:calc(100vh - 128px);">
      <div class="glass" style="padding:22px; overflow-y:auto;">
        <div class="flex gap-sm" style="margin-bottom:16px; flex-wrap:wrap;">
          <div class="pill pill-mint">All</div>
          <div class="pill pill-dark">Coffee</div>
          <div class="pill pill-dark">Tea</div>
          <div class="pill pill-dark">Pastries</div>
        </div>
        <div id="item-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px;">
          ${MENU.map(itemCard).join("")}
        </div>
      </div>

      <div class="glass-dark" style="padding:22px; display:flex; flex-direction:column;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Current order</div>
        <div id="cart-lines" style="flex:1; display:flex; flex-direction:column; gap:12px; overflow-y:auto;">
          ${emptyCartHtml()}
        </div>
        <div id="cart-totals" style="border-top:1px solid rgba(255,255,255,0.18); margin-top:8px; padding-top:12px; display:none;"></div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" data-tender="cash">Cash</button>
          <button class="btn btn-ghost" data-tender="card">Card</button>
          <button class="btn btn-ghost" data-tender="upi">UPI</button>
          <button class="btn btn-primary" id="charge-btn" disabled>Charge ₹0.00</button>
        </div>
      </div>
    </div>
  `;
}

function itemCard(item) {
  return `
    <div class="glass" style="padding:16px; height:150px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" data-item="${item.id}">
      <div style="width:100%; height:60px; border-radius:12px; background:linear-gradient(${item.gradient});"></div>
      <div>
        <div style="color:#fff; font-weight:600; font-size:13px;">${item.name}</div>
        <div class="muted-white" style="font-size:12px;">₹${item.price}</div>
      </div>
    </div>
  `;
}

function emptyCartHtml() {
  return `<div style="color:rgba(255,255,255,0.55); font-size:12.5px; text-align:center; padding:30px 10px;">Tap an item to start this order</div>`;
}

export function wirePOS(root) {
  root.querySelectorAll("[data-item]").forEach((card) => {
    card.addEventListener("click", () => {
      const item = MENU.find((m) => m.id === card.dataset.item);
      cart[item.id] = (cart[item.id] || 0) + 1;
      renderCart(root);
    });
  });

  root.querySelectorAll("[data-tender]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (Object.keys(cart).length === 0) return;
      tender = btn.dataset.tender;
      root.querySelectorAll("[data-tender]").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });

  root.querySelector("#charge-btn").addEventListener("click", () => {
    const total = cartTotal();
    if (!tender) {
      showToast("Choose a tender before charging", "amber");
      return;
    }
    confirmAction({
      title: `Charge ₹${total.total.toFixed(2)}?`,
      description: `${cartItemCount()} item(s), paid by ${tender.toUpperCase()}. This posts a Cash Sales entry automatically if paid in cash.`,
      confirmLabel: "Confirm charge",
      onConfirm: () => {
        showToast(`Sale complete — SO-00${Math.floor(Math.random() * 900 + 100)}`, "mint");
        cart = {};
        tender = null;
        renderCart(root);
      },
    });
  });
}

function cartItemCount() {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

function cartTotal() {
  const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = MENU.find((m) => m.id === id);
    return sum + item.price * qty;
  }, 0);
  const gst = subtotal * 0.05;
  return { subtotal, gst, total: subtotal + gst };
}

function renderCart(root) {
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

  linesEl.innerHTML = entries
    .map(([id, qty]) => {
      const item = MENU.find((m) => m.id === id);
      return `<div class="flex justify-between" style="color:#fff; font-size:13px;"><div>${qty} × ${item.name}</div><div>₹${(item.price * qty).toFixed(0)}</div></div>`;
    })
    .join("");

  const { subtotal, gst, total } = cartTotal();
  totalsEl.style.display = "block";
  totalsEl.innerHTML = `
    <div class="flex justify-between muted-white" style="font-size:12.5px;"><div>Subtotal</div><div>₹${subtotal.toFixed(2)}</div></div>
    <div class="flex justify-between muted-white" style="font-size:12.5px; margin-top:6px;"><div>GST (5%)</div><div>₹${gst.toFixed(2)}</div></div>
    <div class="flex justify-between" style="color:#fff; font-weight:700; font-size:17px; margin-top:10px;"><div>Total</div><div>₹${total.toFixed(2)}</div></div>
  `;
  chargeBtn.textContent = `Charge ₹${total.toFixed(2)}`;
  chargeBtn.disabled = false;
}
