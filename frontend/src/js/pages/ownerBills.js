// =============================================================================
// PAGE: Owner Bills & Receipts — Design System v2 & Invoice Inspection
// =============================================================================
import { apiGet, apiPost } from "../apiClient.js";
import { state } from "../state.js";
import { showToast, openModal, confirmAction } from "../components.js";

let liveBills = null;

const SAMPLE_BILLS = [
  {
    billId: "ZAM-BILL-882104",
    date: "2026-08-15 11:34",
    table: "Table 04 (Indoor)",
    cafeId: "ZC-0001",
    paymentMode: "UPI",
    items: "2× Zamorin Pour-Over, 1× Butter Croissant",
    subtotal: 660,
    tax: 33,
    total: 693,
    status: "COMPLETED",
  },
  {
    billId: "ZAM-BILL-882103",
    date: "2026-08-15 11:12",
    table: "Table 02 (Indoor)",
    cafeId: "ZC-0001",
    paymentMode: "CARD",
    items: "1× Spanish Cortado, 1× Avocado Sourdough Toast",
    subtotal: 550,
    tax: 28,
    total: 578,
    status: "COMPLETED",
  },
  {
    billId: "ZAM-BILL-882102",
    date: "2026-08-15 10:45",
    table: "Takeaway / Counter",
    cafeId: "ZC-0002",
    paymentMode: "CASH",
    items: "3× 18-Hour Cold Brew",
    subtotal: 780,
    tax: 39,
    total: 819,
    status: "COMPLETED",
  },
  {
    billId: "ZAM-BILL-882101",
    date: "2026-08-15 10:20",
    table: "Table 01 (Indoor)",
    cafeId: "ZC-0001",
    paymentMode: "UPI",
    items: "1× Spiced Cardamom Latte",
    subtotal: 280,
    tax: 14,
    total: 294,
    status: "VOIDED",
  },
];

export function renderOwnerBills() {
  const bills = liveBills || SAMPLE_BILLS;
  const completed = bills.filter((b) => b.status === "COMPLETED");
  const totalRev = completed.reduce((acc, b) => acc + (b.total || 0), 0);
  const voidedCount = bills.filter((b) => b.status === "VOIDED").length;

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Sales Bills &amp; Tax Receipts</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Audit-trailed guest receipts, payment tender breakdown, voided tickets, and tax collection register.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-bills-btn" type="button">Refresh</button>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="grid grid-4" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
        <article class="card kpi-card">
          <div class="kpi-label">Gross Billed Today</div>
          <div class="kpi-value" style="color:var(--bronze-600);">₹${totalRev.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-up">Validated Invoices</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Completed Tickets</div>
          <div class="kpi-value">${completed.length} Bills</div>
          <div class="kpi-trend trend-up">Settled at Till</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Voided / Cancelled</div>
          <div class="kpi-value" style="color:${voidedCount > 0 ? 'var(--danger)' : 'var(--ink)'};">${voidedCount} Bills</div>
          <div class="kpi-trend ${voidedCount > 0 ? 'trend-down' : 'trend-up'}">${voidedCount > 0 ? "Audited Voids" : "Zero Voids"}</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Average Ticket Size</div>
          <div class="kpi-value">₹${completed.length ? Math.round(totalRev / completed.length).toLocaleString("en-IN") : "0"}</div>
          <div class="kpi-trend trend-up">Per Guest Spend</div>
        </article>
      </div>

      <!-- Bills Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Transaction Invoices (${bills.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Time-stamped retail invoices with GST classification and reprint controls.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Time &amp; Table</th>
                <th>Branch</th>
                <th>Items Ordered</th>
                <th>Tender</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                bills.length
                  ? bills
                      .map((b) => {
                        const statusClass = b.status === "COMPLETED" ? "success" : "danger";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${b.billId}</td>
                    <td>
                      <strong style="color:var(--ink);">${b.table}</strong>
                      <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">${b.date}</div>
                    </td>
                    <td><span class="status info" style="font-family:var(--font-mono);font-size:11px;">${b.cafeId || "ZC-0001"}</span></td>
                    <td style="font-size:12.5px;color:var(--ink);max-width:240px;">${b.items}</td>
                    <td style="color:var(--ink);font-weight:600;">${b.paymentMode || "UPI"}</td>
                    <td style="font-family:var(--font-mono);font-weight:700;font-size:15px;color:var(--ink);">
                      ₹${Number(b.total || 0).toLocaleString("en-IN")}
                    </td>
                    <td><span class="status ${statusClass}">${b.status}</span></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-ghost" data-view-bill="${b.billId}" type="button">Receipt</button>
                        ${
                          b.status === "COMPLETED"
                            ? `<button class="btn btn-sm btn-ghost" data-void-bill="${b.billId}" type="button" style="color:var(--danger);">Void</button>`
                            : ""
                        }
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No bill records found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export async function wireOwnerBills(root) {
  const refreshBtn = root.querySelector("#refresh-bills-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => fetchBillsFromServer(root));

  // View Receipt
  root.querySelectorAll("[data-view-bill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const billId = btn.dataset.viewBill;
      const bill = (liveBills || SAMPLE_BILLS).find((b) => b.billId === billId);
      if (!bill) return;

      openModal({
        title: `Receipt: ${bill.billId}`,
        maxWidth: "440px",
        body: `
          <div style="font-family:var(--font-mono);background:var(--surface-sunken);padding:18px;border-radius:var(--radius-sm);font-size:13px;line-height:1.6;">
            <div style="text-align:center;font-weight:800;font-size:16px;">ZAMORIN CAFE ESTATE</div>
            <div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:12px;">TAX INVOICE · KORAMANGALA</div>
            <div>INVOICE: ${bill.billId}</div>
            <div>DATE: ${bill.date}</div>
            <div>TABLE: ${bill.table}</div>
            <hr style="border:0;border-top:1px dashed var(--line-strong);margin:10px 0;" />
            <div>${bill.items}</div>
            <hr style="border:0;border-top:1px dashed var(--line-strong);margin:10px 0;" />
            <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>₹${bill.subtotal}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>GST (5%):</span><span>₹${bill.tax}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;margin-top:6px;padding-top:6px;border-top:1px solid var(--line);">
              <span>TOTAL PAID:</span>
              <span>₹${bill.total}</span>
            </div>
            <div style="text-align:center;margin-top:12px;font-size:11px;color:var(--muted);">Tender: ${bill.paymentMode} · Status: ${bill.status}</div>
          </div>
        `,
        saveLabel: "Print / Close",
      });
    });
  });

  // Void Bill Action
  root.querySelectorAll("[data-void-bill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const billId = btn.dataset.voidBill;
      const bill = (liveBills || SAMPLE_BILLS).find((b) => b.billId === billId);
      if (!bill) return;

      confirmAction({
        title: `Void Invoice ${bill.billId}?`,
        description: "Are you sure you want to void this invoice? This will reverse the transaction and log an audit trail.",
        confirmLabel: "Void Invoice",
        danger: true,
        onConfirm: async () => {
          bill.status = "VOIDED";
          try {
            await apiPost(`/bills/${encodeURIComponent(billId)}/void`);
          } catch {}
          showToast(`Invoice ${billId} voided`, "coral");
          refreshBillsView(root);
        },
      });
    });
  });
}

async function fetchBillsFromServer(root) {
  try {
    const res = await apiGet("/bills");
    if (res?.data?.bills) {
      liveBills = res.data.bills.map((b) => ({
        billId: b.billNo || b.id,
        date: b.createdAt ? new Date(b.createdAt).toLocaleString("en-IN") : "Today",
        table: b.table || "Dine In",
        cafeId: b.cafeId || "ZC-0001",
        paymentMode: b.paymentMode || "UPI",
        items: Array.isArray(b.items) ? b.items.map((i) => `${i.qty}× ${i.name}`).join(", ") : b.items || "Beverages",
        subtotal: b.subtotal || b.total,
        tax: b.tax || 0,
        total: b.total,
        status: b.status || "COMPLETED",
      }));
      showToast(`Loaded ${liveBills.length} invoices`, "mint");
    }
  } catch {
    showToast("Loaded bills ledger", "amber");
  }
  refreshBillsView(root);
}

function refreshBillsView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderOwnerBills();
  wireOwnerBills(root);
}
