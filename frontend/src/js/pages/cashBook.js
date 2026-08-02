// PAGE: Sales & Cash / Cash Book (Section 22, Part M.9) — Cafe Admin
import { showToast, confirmAction } from "../components.js";
import { pushNotification } from "../notifications.js";

const DENOMS = [500, 200, 100, 50, 20, 10];
const EXPECTED = 7500;
let counts = {};

export function renderCashBook() {
  counts = {};
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Sales &amp; Cash</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">Dawn Roast — Koramangala, cash session open since 8:02 AM</div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
        <div class="glass" style="padding:22px;">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Today's cash entries</div>
          <table class="glass-table">
            <tbody>
              <tr><td>Opening balance</td><td style="text-align:right;">₹5,000</td></tr>
              <tr><td>Cash sales</td><td style="text-align:right; color:var(--color-accent-mint-bright);">+₹3,200</td></tr>
              <tr><td>Paid out — milk delivery</td><td style="text-align:right; color:#FF9E8F;">-₹700</td></tr>
              <tr><td style="font-weight:700;">Expected closing cash</td><td style="text-align:right; font-weight:700;">₹7,500</td></tr>
            </tbody>
          </table>
        </div>

        <div class="glass" style="padding:22px;">
          <div class="flex justify-between items-center" style="margin-bottom:14px;">
            <div style="color:#fff; font-weight:600; font-size:15px;">Count drawer &amp; close session</div>
            <button class="btn btn-primary" id="close-session-btn" style="padding:9px 16px; font-size:13px;">Close session</button>
          </div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:16px;">
            ${DENOMS.map(
              (d) => `
              <div>
                <div class="muted-white" style="font-size:11px; margin-bottom:4px;">₹${d} notes</div>
                <input type="number" min="0" data-denom="${d}" placeholder="0" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; font-size:13px;" />
              </div>`
            ).join("")}
          </div>
          <div class="flex justify-between" style="border-top:1px solid rgba(255,255,255,0.18); padding-top:12px;">
            <div class="muted-white" style="font-size:13px;">Counted total</div>
            <div id="counted-total" style="color:#fff; font-weight:700; font-size:17px;">₹0</div>
          </div>
          <div class="flex justify-between" style="margin-top:6px;">
            <div class="muted-white" style="font-size:13px;">Variance</div>
            <div id="variance-total" style="font-weight:600; font-size:13px; color:rgba(255,255,255,0.5);">—</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function wireCashBook(root) {
  root.querySelectorAll("[data-denom]").forEach((input) => {
    input.addEventListener("input", () => {
      const val = Number(input.dataset.denom);
      counts[val] = Number(input.value) || 0;
      const total = Object.entries(counts).reduce((s, [denom, qty]) => s + Number(denom) * qty, 0);
      root.querySelector("#counted-total").textContent = `₹${total.toLocaleString("en-IN")}`;
      const variance = total - EXPECTED;
      const vEl = root.querySelector("#variance-total");
      vEl.textContent = (variance > 0 ? "+" : "") + `₹${variance}`;
      vEl.style.color = variance === 0 ? "var(--color-accent-mint-bright)" : Math.abs(variance) > 200 ? "#FF9E8F" : "#FFD98A";
    });
  });

  root.querySelector("#close-session-btn").addEventListener("click", () => {
    const total = Object.entries(counts).reduce((s, [denom, qty]) => s + Number(denom) * qty, 0);
    const variance = total - EXPECTED;
    confirmAction({
      title: "Close today's cash session?",
      description: Math.abs(variance) > 200
        ? `Variance is ₹${variance} — above the approval threshold. Closing will require Master's approval before the session locks.`
        : `Counted ₹${total.toLocaleString("en-IN")} against an expected ₹${EXPECTED.toLocaleString("en-IN")}. This locks today's session.`,
      confirmLabel: "Close session",
      onConfirm: () => {
        const critical = Math.abs(variance) > 200;
        showToast(critical ? "Session closed — sent to Master for variance approval" : "Session closed and locked", critical ? "amber" : "mint");
        if (critical) {
          pushNotification({
            category: "Finance",
            severity: "critical",
            title: "Critical cash variance — Dawn Roast",
            message: `₹${variance} ${variance < 0 ? "short" : "over"} against expected closing cash. Awaiting your approval.`,
            recipientRoles: ["master"],
            actionRequired: true,
            popupEligible: true,
            deepLink: "finance", // Master's nav has no "sales-cash" route — "finance" is Master's real equivalent screen
          });
        }
      },
    });
  });
}
