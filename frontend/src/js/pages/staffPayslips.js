// PAGE: My Payslips — authenticated employee self-service.
import {
  ApiClientError,
  apiGet,
} from "../apiClient.js";

import {
  emptyState,
  skeleton,
  showToast,
} from "../components.js";

let activeListRequest = null;
let activeDetailRequest = null;
let activeDetailOverlay = null;

const currencyFormatter = new Intl.NumberFormat(
  "en-IN",
  {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }
);

const periodFormatter = new Intl.DateTimeFormat(
  "en-IN",
  {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }
);

const dateTimeFormatter = new Intl.DateTimeFormat(
  "en-IN",
  {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }
);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPaise(value) {
  const paise = Number(value);

  if (!Number.isSafeInteger(paise)) {
    return "—";
  }

  return currencyFormatter.format(
    paise / 100
  );
}

function formatPeriod(periodKey) {
  if (
    typeof periodKey !== "string" ||
    !/^\d{4}-\d{2}$/.test(periodKey)
  ) {
    return "Payroll period";
  }

  const [year, month] =
    periodKey.split("-").map(Number);

  return periodFormatter.format(
    new Date(
      Date.UTC(year, month - 1, 1)
    )
  );
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateTimeFormatter.format(date);
}

function statusPill(status) {
  const normalized =
    typeof status === "string"
      ? status.toUpperCase()
      : "";

  const label =
    normalized === "PAID"
      ? "Paid"
      : "Issued";

  const kind =
    normalized === "PAID"
      ? "mint"
      : "amber";

  return `<span class="pill pill-${kind}">${label}</span>`;
}

function renderLoadingState() {
  return `
    <div class="flex-col gap-md" aria-live="polite">
      ${skeleton("96px")}
      ${skeleton("96px")}
      ${skeleton("96px")}
    </div>
  `;
}

function renderErrorState(error) {
  const correlationId =
    error instanceof ApiClientError &&
    error.correlationId
      ? `<div class="muted-white" style="font-size:11px; margin-top:8px;">Reference: ${escapeHtml(error.correlationId)}</div>`
      : "";

  const message =
    error instanceof ApiClientError
      ? error.message
      : "Payslips could not be loaded. Check your connection and try again.";

  return `
    <div class="empty-state" role="alert">
      <div class="empty-state-title">Unable to load payslips</div>
      <div style="font-size:13px; max-width:420px;">${escapeHtml(message)}</div>
      ${correlationId}
      <button
        class="btn btn-primary"
        type="button"
        data-retry-payslips
        style="margin-top:14px;"
      >
        Try again
      </button>
    </div>
  `;
}

function renderPayslipCards(payslips) {
  if (payslips.length === 0) {
    return emptyState({
      title: "No payslips available",
      body:
        "Issued and paid payslips will appear here after payroll is completed.",
    });
  }

  return `
    <div class="flex-col gap-md">
      ${payslips
        .map(
          (payslip) => `
            <article
              class="glass"
              style="padding:16px; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;"
            >
              <div>
                <div style="color:#fff; font-weight:600; font-size:14px;">
                  ${escapeHtml(formatPeriod(payslip.periodKey))}
                </div>
                <div class="muted-white" style="font-size:11.5px; margin-top:3px;">
                  ${escapeHtml(payslip.payslipId)} · Issued ${escapeHtml(formatDateTime(payslip.issuedAt))}
                </div>
                <div style="color:#fff; font-size:13px; margin-top:7px;">
                  Net pay: <strong>${escapeHtml(formatPaise(payslip.netPayPaise))}</strong>
                </div>
              </div>
              <div class="flex items-center gap-sm">
                ${statusPill(payslip.status)}
                <button
                  class="btn btn-ghost"
                  type="button"
                  data-view-payslip="${escapeHtml(payslip.payslipId)}"
                  style="padding:8px 14px; font-size:12px;"
                >
                  View payslip
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function detailRow(label, value, {
  strong = false,
} = {}) {
  return `
    <div
      class="flex justify-between"
      style="font-size:12.5px; padding:6px 0; gap:14px;"
    >
      <span class="muted-white">${escapeHtml(label)}</span>
      <span style="color:#fff; text-align:right;${strong ? " font-weight:700;" : ""}">
        ${escapeHtml(value)}
      </span>
    </div>
  `;
}

function renderPayslipDetail(payslip) {
  const earnings = payslip.earnings || {};
  const deductions = payslip.deductions || {};
  const attendance =
    payslip.attendanceSummary || {};

  return `
    <div data-payslip-document>
      <div class="flex justify-between items-start" style="gap:16px; margin-bottom:16px;">
        <div>
          <div style="color:#fff; font-weight:700; font-size:17px;" class="font-display">
            ${escapeHtml(payslip.employeeName)}
          </div>
          <div class="muted-white" style="font-size:11.5px; margin-top:3px;">
            ${escapeHtml(payslip.employeeUserId)}
            ${payslip.jobTitle ? ` · ${escapeHtml(payslip.jobTitle)}` : ""}
            · ${escapeHtml(formatPeriod(payslip.periodKey))}
          </div>
        </div>
        ${statusPill(payslip.status)}
      </div>

      <div class="glass" style="padding:14px; margin-bottom:12px;">
        ${detailRow("Payslip ID", payslip.payslipId)}
        ${detailRow(
          "Pay period",
          `${payslip.periodStartDate} to ${payslip.periodEndDate}`
        )}
        ${detailRow(
          "Payable days",
          `${attendance.payableDays ?? 0} of ${attendance.calendarDays ?? 0}`
        )}
        ${detailRow(
          "Present days",
          String(attendance.presentDays ?? 0)
        )}
        ${detailRow(
          "Paid leave days",
          String(attendance.paidLeaveDays ?? 0)
        )}
        ${detailRow(
          "Unpaid leave days",
          String(attendance.unpaidLeaveDays ?? 0)
        )}
        ${detailRow(
          "Overtime",
          `${attendance.overtimeMinutes ?? 0} minutes`
        )}
      </div>

      <div class="glass" style="padding:14px; margin-bottom:12px;">
        <div style="color:var(--color-accent-mint-bright,#6bffd1); font-size:11px; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">
          Earnings
        </div>
        ${detailRow("Basic pay", formatPaise(earnings.basicPayPaise))}
        ${detailRow("House rent allowance", formatPaise(earnings.houseRentAllowancePaise))}
        ${detailRow("Other allowance", formatPaise(earnings.otherAllowancePaise))}
        ${detailRow("Overtime pay", formatPaise(earnings.overtimePayPaise))}
        ${detailRow("Incentive", formatPaise(earnings.incentivePaise))}
        ${detailRow("Other earnings", formatPaise(earnings.otherEarningPaise))}
        ${detailRow("Gross pay", formatPaise(earnings.grossPayPaise), {
          strong: true,
        })}
      </div>

      <div class="glass" style="padding:14px; margin-bottom:12px;">
        <div style="color:var(--color-accent-amber,#ffd27a); font-size:11px; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">
          Deductions
        </div>
        ${detailRow("Provident Fund", formatPaise(deductions.providentFundPaise))}
        ${detailRow("Employee State Insurance", formatPaise(deductions.employeeStateInsurancePaise))}
        ${detailRow("Professional tax", formatPaise(deductions.professionalTaxPaise))}
        ${detailRow("Income tax", formatPaise(deductions.incomeTaxPaise))}
        ${detailRow("Loan / advance", formatPaise(deductions.loanAdvanceDeductionPaise))}
        ${detailRow("Unpaid leave", formatPaise(deductions.unpaidLeaveDeductionPaise))}
        ${detailRow("Other deductions", formatPaise(deductions.otherDeductionPaise))}
        ${detailRow("Total deductions", formatPaise(deductions.totalDeductionPaise), {
          strong: true,
        })}
      </div>

      <div class="glass" style="padding:14px;">
        ${detailRow("Net pay", formatPaise(payslip.netPayPaise), {
          strong: true,
        })}
        ${detailRow("Issued", formatDateTime(payslip.issuedAt))}
        ${
          payslip.status === "PAID"
            ? detailRow("Paid", formatDateTime(payslip.paidAt))
            : ""
        }
        ${
          payslip.paymentReference
            ? detailRow("Payment reference", payslip.paymentReference)
            : ""
        }
      </div>
    </div>
  `;
}

function renderPrintablePayslip(payslip) {
  const earnings = payslip.earnings || {};
  const deductions = payslip.deductions || {};
  const attendance =
    payslip.attendanceSummary || {};

  const rows = [
    ["Employee", payslip.employeeName],
    ["Employee ID", payslip.employeeUserId],
    ["Job title", payslip.jobTitle || "—"],
    ["Payslip ID", payslip.payslipId],
    ["Period", `${payslip.periodStartDate} to ${payslip.periodEndDate}`],
    ["Payable days", `${attendance.payableDays ?? 0} of ${attendance.calendarDays ?? 0}`],
    ["Gross pay", formatPaise(earnings.grossPayPaise)],
    ["Total deductions", formatPaise(deductions.totalDeductionPaise)],
    ["Net pay", formatPaise(payslip.netPayPaise)],
    ["Status", payslip.status],
    ["Issued", formatDateTime(payslip.issuedAt)],
    ...(payslip.status === "PAID"
      ? [["Paid", formatDateTime(payslip.paidAt)]]
      : []),
    ...(payslip.paymentReference
      ? [["Payment reference", payslip.paymentReference]]
      : []),
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(payslip.payslipId)} Payslip</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #17202a; }
    h1 { margin-bottom: 4px; }
    .subtitle { color: #53606a; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; border-bottom: 1px solid #d9dfe4; text-align: left; }
    th { width: 38%; color: #53606a; font-weight: 600; }
    .notice { margin-top: 28px; font-size: 11px; color: #68747d; }
    @media print { body { margin: 16mm; } }
  </style>
</head>
<body>
  <h1>Zamorin Cafe ERP Payslip</h1>
  <div class="subtitle">${escapeHtml(formatPeriod(payslip.periodKey))}</div>
  <table>
    <tbody>
      ${rows
        .map(
          ([label, value]) => `
            <tr>
              <th>${escapeHtml(label)}</th>
              <td>${escapeHtml(value)}</td>
            </tr>
          `
        )
        .join("")}
    </tbody>
  </table>
  <div class="notice">
    Generated from the authenticated employee self-service record.
  </div>
</body>
</html>`;
}

function printPayslip(payslip) {
  const printWindow = window.open(
    "",
    "_blank"
  );

  if (!printWindow) {
    showToast(
      "Allow pop-ups to print or save this payslip.",
      "amber"
    );

    return;
  }

  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(
    renderPrintablePayslip(payslip)
  );
  printWindow.document.close();

  printWindow.addEventListener(
    "load",
    () => {
      printWindow.focus();
      printWindow.print();
    },
    {
      once: true,
    }
  );
}

function closeOverlay(overlay) {
  if (overlay === activeDetailOverlay) {
    activeDetailRequest?.abort();
    activeDetailRequest = null;
    activeDetailOverlay = null;
  }

  overlay.remove();
}

function createDetailOverlay() {
  if (activeDetailOverlay) {
    closeOverlay(activeDetailOverlay);
  }

  const overlay =
    document.createElement("div");

  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div
      class="glass-dark dialog-box"
      role="dialog"
      aria-modal="true"
      aria-label="Payslip details"
      style="max-width:620px; text-align:left; max-height:86vh; overflow:auto;"
    >
      <div data-payslip-modal-content>
        ${renderLoadingState()}
      </div>
      <div class="dialog-actions" style="margin-top:18px;">
        <button class="btn btn-ghost" type="button" data-close-payslip>
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  activeDetailOverlay = overlay;

  overlay
    .querySelector("[data-close-payslip]")
    .addEventListener(
      "click",
      () => closeOverlay(overlay)
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay);
      }
    }
  );

  return overlay;
}

async function openPayslip(payslipId) {
  const overlay =
    createDetailOverlay();

  const requestController =
    new AbortController();

  activeDetailRequest =
    requestController;

  const content = overlay.querySelector(
    "[data-payslip-modal-content]"
  );

  try {
    const payload = await apiGet(
      `/payroll/me/payslips/${encodeURIComponent(payslipId)}`,
      {
        signal:
          requestController.signal,
      }
    );

    const payslip =
      payload?.data?.payslip;

    if (
      !payslip ||
      payslip.payslipId !== payslipId
    ) {
      throw new Error(
        "The payslip response was incomplete."
      );
    }

    if (
      requestController.signal.aborted ||
      !overlay.isConnected
    ) {
      return;
    }

    content.innerHTML = `
      ${renderPayslipDetail(payslip)}
      <div style="margin-top:14px; display:flex; justify-content:flex-end;">
        <button
          class="btn btn-primary"
          type="button"
          data-print-payslip
        >
          Print / Save PDF
        </button>
      </div>
    `;

    content
      .querySelector("[data-print-payslip]")
      .addEventListener(
        "click",
        () => printPayslip(payslip)
      );
  } catch (error) {
    if (
      error?.name === "AbortError" ||
      !overlay.isConnected
    ) {
      return;
    }

    content.innerHTML =
      renderErrorState(error);

    const retryButton =
      content.querySelector(
        "[data-retry-payslips]"
      );

    if (retryButton) {
      retryButton.textContent =
        "Close and try again";

      retryButton.addEventListener(
        "click",
        () => closeOverlay(overlay)
      );
    }
  } finally {
    if (
      activeDetailRequest ===
      requestController
    ) {
      activeDetailRequest = null;
    }
  }
}

function bindPayslipCardActions(root) {
  root
    .querySelectorAll(
      "[data-view-payslip]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          openPayslip(
            button.dataset.viewPayslip
          )
      );
    });
}

async function loadMyPayslips(root) {
  activeListRequest?.abort();

  const requestController =
    new AbortController();

  activeListRequest =
    requestController;

  const content = root.querySelector(
    "[data-payslip-content]"
  );

  if (!content) {
    return;
  }

  content.innerHTML =
    renderLoadingState();

  try {
    const payload = await apiGet(
      "/payroll/me/payslips?limit=24",
      {
        signal:
          requestController.signal,
      }
    );

    const payslips =
      payload?.data?.payslips;

    if (!Array.isArray(payslips)) {
      throw new Error(
        "The payslip list response was incomplete."
      );
    }

    if (
      requestController.signal.aborted ||
      !root.isConnected
    ) {
      return;
    }

    content.innerHTML =
      renderPayslipCards(payslips);

    bindPayslipCardActions(content);
  } catch (error) {
    if (
      error?.name === "AbortError" ||
      !root.isConnected
    ) {
      return;
    }

    content.innerHTML =
      renderErrorState(error);

    content
      .querySelector(
        "[data-retry-payslips]"
      )
      ?.addEventListener(
        "click",
        () => loadMyPayslips(root)
      );
  } finally {
    if (
      activeListRequest ===
      requestController
    ) {
      activeListRequest = null;
    }
  }
}

export function renderStaffPayslips() {
  return `
    <div class="page-enter" style="padding:8px 4px;">
      <div
        class="flex justify-between items-center"
        style="gap:12px; margin-bottom:18px; flex-wrap:wrap;"
      >
        <div>
          <div
            style="color:#fff; font-weight:700; font-size:17px;"
            class="font-display"
          >
            My Payslips
          </div>
          <div class="muted-white" style="font-size:11.5px; margin-top:3px;">
            Only payslips issued to your authenticated employee account are shown.
          </div>
        </div>
        <button
          class="btn btn-ghost"
          type="button"
          data-refresh-payslips
          style="padding:8px 14px; font-size:12px;"
        >
          Refresh
        </button>
      </div>

      <div data-payslip-content>
        ${renderLoadingState()}
      </div>
    </div>
  `;
}

export function wireStaffPayslips(root) {
  root
    .querySelector(
      "[data-refresh-payslips]"
    )
    ?.addEventListener(
      "click",
      () => loadMyPayslips(root)
    );

  loadMyPayslips(root);
}
