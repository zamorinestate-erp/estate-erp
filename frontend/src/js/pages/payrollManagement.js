// PAGE: Payroll Management — authenticated MASTER and OWNER workspace.
import {
  ApiClientError,
  apiGet,
  apiPost,
} from "../apiClient.js";

import {
  confirmAction,
  emptyState,
  showToast,
  skeleton,
} from "../components.js";

let activeRequest = null;
let selectedStatus = "";
let mutationInProgress = false;

const STATUS_LABELS = {
  DRAFT: "Draft",
  CALCULATED: "Calculated",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PAID: "Paid",
  VOIDED: "Voided",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function defaultPeriodKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatPeriod(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) {
    return value || "—";
  }

  const [year, month] = value.split("-");

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(
    new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        1
      )
    )
  );
}

function formatMoney(value) {
  const paise =
    Number.isSafeInteger(value) &&
    value >= 0
      ? value
      : 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

function apiErrorMessage(error) {
  return error instanceof ApiClientError
    ? error.message
    : "The payroll request could not be completed.";
}

function renderLoading() {
  return `
    <div class="flex-col gap-md" aria-live="polite">
      ${skeleton("80px")}
      ${skeleton("80px")}
      ${skeleton("80px")}
    </div>
  `;
}

function renderError(error) {
  const reference =
    error instanceof ApiClientError &&
    error.correlationId
      ? `<div class="muted-white" style="font-size:11px; margin-top:7px;">Reference: ${escapeHtml(error.correlationId)}</div>`
      : "";

  return `
    <div class="empty-state">
      <div class="empty-state-title">
        Payroll data is unavailable
      </div>
      <div style="font-size:13px;">
        ${escapeHtml(apiErrorMessage(error))}
      </div>
      ${reference}
      <button
        class="btn btn-primary"
        type="button"
        data-retry-payroll
        style="margin-top:14px;"
      >
        Try again
      </button>
    </div>
  `;
}

function statusPill(status) {
  return `
    <span class="pill pill-dark">
      ${escapeHtml(
        STATUS_LABELS[status] || status || "Unknown"
      )}
    </span>
  `;
}

function renderCafeOptions(cafes) {
  const available = cafes.filter(
    (cafe) => cafe.status !== "ARCHIVED"
  );

  if (available.length === 0) {
    return `
      <option value="">
        No accessible cafés
      </option>
    `;
  }

  return `
    <option value="">Select café</option>
    ${available
      .map(
        (cafe) => `
          <option value="${escapeHtml(cafe.cafeId)}">
            ${escapeHtml(
              cafe.displayName ||
                cafe.name ||
                cafe.cafeId
            )} · ${escapeHtml(cafe.cafeId)}
          </option>
        `
      )
      .join("")}
  `;
}

function actionButtons(run) {
  const id = escapeHtml(run.payrollRunId);
  const buttons = [];

  if (run.status === "DRAFT") {
    buttons.push([
      "calculate",
      "Calculate",
      "btn-primary",
    ]);
  }

  if (run.status === "CALCULATED") {
    buttons.push([
      "submit",
      "Submit",
      "btn-primary",
    ]);
  }

  if (run.status === "SUBMITTED") {
    buttons.push([
      "approve",
      "Approve",
      "btn-primary",
    ]);
  }

  if (run.status === "APPROVED") {
    buttons.push(
      [
        "issue-payslips",
        "Issue payslips",
        "btn-ghost",
      ],
      [
        "pay",
        "Record payment",
        "btn-primary",
      ]
    );
  }

  if (!["PAID", "VOIDED"].includes(run.status)) {
    buttons.push([
      "void",
      "Void",
      "btn-ghost",
    ]);
  }

  if (buttons.length === 0) {
    return `<span class="muted-white" style="font-size:11px;">No action required</span>`;
  }

  return buttons
    .map(
      ([action, label, style]) => `
        <button
          class="btn ${style}"
          type="button"
          data-payroll-action="${action}"
          data-payroll-run="${id}"
        >
          ${label}
        </button>
      `
    )
    .join("");
}

function renderRuns(runs) {
  if (runs.length === 0) {
    return emptyState({
      title: "No payroll runs found",
      body: selectedStatus
        ? "No payroll run matches this status."
        : "Create the first organisation-scoped payroll run above.",
    });
  }

  return `
    <div style="overflow:auto;">
      <table class="glass-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Period</th>
            <th>Café</th>
            <th>Status</th>
            <th>Employees</th>
            <th>Gross</th>
            <th>Deductions</th>
            <th>Net pay</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${runs
            .map(
              (run) => `
                <tr>
                  <td style="font-weight:700;">
                    ${escapeHtml(run.payrollRunId)}
                  </td>
                  <td>
                    ${escapeHtml(
                      formatPeriod(run.periodKey)
                    )}
                  </td>
                  <td>${escapeHtml(run.cafeId)}</td>
                  <td>${statusPill(run.status)}</td>
                  <td>
                    ${escapeHtml(run.employeeCount ?? 0)}
                  </td>
                  <td>
                    ${escapeHtml(
                      formatMoney(run.totalGrossPaise)
                    )}
                  </td>
                  <td>
                    ${escapeHtml(
                      formatMoney(
                        run.totalDeductionPaise
                      )
                    )}
                  </td>
                  <td style="font-weight:700;">
                    ${escapeHtml(
                      formatMoney(run.totalNetPayPaise)
                    )}
                  </td>
                  <td>
                    <div
                      class="flex gap-sm"
                      style="flex-wrap:wrap;"
                    >
                      ${actionButtons(run)}
                    </div>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function openTextDialog({
  root,
  payrollRunId,
  action,
  title,
  label,
  maxlength,
}) {
  const overlay =
    document.createElement("div");

  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div
      class="glass-dark dialog-box"
      role="dialog"
      aria-modal="true"
    >
      <h3>${escapeHtml(title)}</h3>
      <form data-payroll-text-form>
        <label
          style="display:block;  font-size:12px; font-weight:700; margin-bottom:7px;"
        >
          ${escapeHtml(label)}
        </label>
        <textarea
          class="glass-input"
          data-payroll-text
          maxlength="${maxlength}"
          required
          style="width:100%; min-height:110px; resize:vertical;"
        ></textarea>
        <div class="dialog-actions" style="margin-top:18px;">
          <button
            class="btn btn-ghost"
            type="button"
            data-payroll-dialog-cancel
          >
            Cancel
          </button>
          <button
            class="btn btn-primary"
            type="submit"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay
    .querySelector("[data-payroll-dialog-cancel]")
    .addEventListener("click", close);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  overlay
    .querySelector("[data-payroll-text-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      const value = overlay
        .querySelector("[data-payroll-text]")
        .value.trim();

      if (!value) {
        showToast(`${label} is required.`, "amber");
        return;
      }

      close();

      const body =
        action === "pay"
          ? {
              paymentReference: value,
            }
          : {
              voidReason: value,
            };

      await performPayrollAction(
        root,
        payrollRunId,
        action,
        body
      );
    });

  overlay
    .querySelector("[data-payroll-text]")
    .focus();
}

function setMutationState(root, busy) {
  mutationInProgress = busy;

  root
    .querySelectorAll(
      "button, input, select, textarea"
    )
    .forEach((element) => {
      element.disabled = busy;
    });
}

async function performPayrollAction(
  root,
  payrollRunId,
  action,
  body
) {
  if (mutationInProgress) {
    return;
  }

  setMutationState(root, true);

  try {
    const options =
      body === undefined
        ? {}
        : {
            body,
          };

    const payload = await apiPost(
      `/payroll/runs/${encodeURIComponent(
        payrollRunId
      )}/${action}`,
      options
    );

    showToast(
      payload?.message ||
        "Payroll action completed successfully.",
      "mint"
    );

    await loadPayrollRuns(root);
  } catch (error) {
    showToast(apiErrorMessage(error), "coral");
  } finally {
    setMutationState(root, false);
  }
}

function requestPayrollAction(
  root,
  payrollRunId,
  action
) {
  if (action === "pay") {
    openTextDialog({
      root,
      payrollRunId,
      action,
      title: `Record payment for ${payrollRunId}`,
      label: "External payment reference",
      maxlength: 200,
    });
    return;
  }

  if (action === "void") {
    openTextDialog({
      root,
      payrollRunId,
      action,
      title: `Void payroll run ${payrollRunId}`,
      label: "Void reason",
      maxlength: 2000,
    });
    return;
  }

  const details = {
    calculate: {
      title: `Calculate ${payrollRunId}?`,
      description:
        "The backend will verify every draft payslip and derive the payroll totals.",
      confirmLabel: "Calculate",
    },
    submit: {
      title: `Submit ${payrollRunId}?`,
      description:
        "The calculated payroll run will be locked for approval.",
      confirmLabel: "Submit",
    },
    approve: {
      title: `Approve ${payrollRunId}?`,
      description:
        "Approval records your authenticated user ID and timestamp.",
      confirmLabel: "Approve",
    },
    "issue-payslips": {
      title: `Issue payslips for ${payrollRunId}?`,
      description:
        "The backend will issue eligible payslips for employee self-service.",
      confirmLabel: "Issue payslips",
    },
  }[action];

  if (!details) {
    showToast("Unsupported payroll action.", "coral");
    return;
  }

  confirmAction({
    ...details,
    onConfirm: () =>
      performPayrollAction(
        root,
        payrollRunId,
        action
      ),
  });
}

function bindRunActions(root) {
  root
    .querySelectorAll("[data-payroll-action]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        requestPayrollAction(
          root,
          button.dataset.payrollRun,
          button.dataset.payrollAction
        );
      });
    });
}

async function loadPayrollRuns(root) {
  activeRequest?.abort();

  const requestController =
    new AbortController();

  activeRequest = requestController;

  const content = root.querySelector(
    "[data-payroll-runs]"
  );

  if (!content) {
    return;
  }

  content.innerHTML = renderLoading();

  const statusQuery = selectedStatus
    ? `&status=${encodeURIComponent(
        selectedStatus
      )}`
    : "";

  try {
    const payload = await apiGet(
      `/payroll/runs?limit=100${statusQuery}`,
      {
        signal: requestController.signal,
      }
    );

    if (
      activeRequest !== requestController
    ) {
      return;
    }

    const runs =
      payload?.data?.payrollRuns || [];

    content.innerHTML = renderRuns(runs);
    bindRunActions(content);
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    content.innerHTML = renderError(error);

    content
      .querySelector("[data-retry-payroll]")
      ?.addEventListener(
        "click",
        () => loadPayrollRuns(root)
      );
  } finally {
    if (
      activeRequest === requestController
    ) {
      activeRequest = null;
    }
  }
}

async function loadCafes(root) {
  const select = root.querySelector(
    "[data-payroll-cafe]"
  );

  if (!select) {
    return;
  }

  select.disabled = true;
  select.innerHTML =
    `<option value="">Loading cafés…</option>`;

  try {
    const payload = await apiGet(
      "/cafes?status=ACTIVE"
    );

    const cafes = payload?.data?.cafes || [];

    select.innerHTML =
      renderCafeOptions(cafes);
  } catch (error) {
    select.innerHTML =
      `<option value="">Cafés unavailable</option>`;

    showToast(apiErrorMessage(error), "coral");
  } finally {
    select.disabled = mutationInProgress;
  }
}

async function createPayrollRun(root, form) {
  if (mutationInProgress) {
    return;
  }

  const formData = new FormData(form);
  const cafeId =
    String(formData.get("cafeId") || "")
      .trim()
      .toUpperCase();
  const periodKey =
    String(formData.get("periodKey") || "")
      .trim();
  const notes =
    String(formData.get("notes") || "")
      .trim();

  if (
    !/^ZC-\d{4,}$/.test(cafeId) ||
    !/^\d{4}-\d{2}$/.test(periodKey)
  ) {
    showToast(
      "Select a valid café and payroll period.",
      "amber"
    );
    return;
  }

  setMutationState(root, true);

  try {
    const body = {
      cafeId,
      periodKey,
      ...(notes
        ? {
            notes,
          }
        : {}),
    };

    const payload = await apiPost(
      "/payroll/runs",
      {
        body,
      }
    );

    showToast(
      payload?.message ||
        "Payroll run created successfully.",
      "mint"
    );

    form.reset();

    const periodInput = form.querySelector(
      "[name='periodKey']"
    );

    if (periodInput) {
      periodInput.value = defaultPeriodKey();
    }

    await Promise.all([
      loadCafes(root),
      loadPayrollRuns(root),
    ]);
  } catch (error) {
    showToast(apiErrorMessage(error), "coral");
  } finally {
    setMutationState(root, false);
  }
}

export function renderPayrollManagement() {
  return `
    <div class="page-enter">
      <div
        class="flex justify-between items-center"
        style="margin-bottom:18px; gap:16px; flex-wrap:wrap;"
      >
        <div>
          <div
            class="font-display"
            style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;"
          >
            Payroll &amp; Payslips
          </div>
          <div
            class="muted-white"
            style="font-size:13.5px;"
          >
            Secure organisation-scoped payroll management for MASTER and OWNER.
          </div>
        </div>

        <button
          class="btn btn-ghost"
          type="button"
          data-refresh-payroll
        >
          Refresh
        </button>
      </div>

      <div
        class="glass"
        style="padding:22px; margin-bottom:18px;"
      >
        <div
          style="color:#fff; font-size:15px; font-weight:700; margin-bottom:14px;"
        >
          Create payroll run
        </div>

        <form
          data-create-payroll
          class="flex gap-md items-center"
          style="flex-wrap:wrap;"
        >
          <label style="min-width:220px; flex:1;">
            <span
              class="muted-white"
              style="display:block; font-size:11px; margin-bottom:6px;"
            >
              Café
            </span>
            <select
              class="glass-input"
              name="cafeId"
              data-payroll-cafe
              required
              style="width:100%;"
            >
              <option value="">Loading cafés…</option>
            </select>
          </label>

          <label style="min-width:180px;">
            <span
              class="muted-white"
              style="display:block; font-size:11px; margin-bottom:6px;"
            >
              Payroll period
            </span>
            <input
              class="glass-input"
              type="month"
              name="periodKey"
              value="${escapeHtml(defaultPeriodKey())}"
              required
            />
          </label>

          <label style="min-width:240px; flex:1;">
            <span
              class="muted-white"
              style="display:block; font-size:11px; margin-bottom:6px;"
            >
              Notes
            </span>
            <input
              class="glass-input"
              type="text"
              name="notes"
              maxlength="2000"
              placeholder="Optional internal note"
              style="width:100%;"
            />
          </label>

          <button
            class="btn btn-primary"
            type="submit"
            style="align-self:flex-end;"
          >
            Create run
          </button>
        </form>
      </div>

      <div class="glass" style="padding:22px;">
        <div
          class="flex justify-between items-center"
          style="margin-bottom:14px; gap:12px; flex-wrap:wrap;"
        >
          <div
            style="color:#fff; font-size:15px; font-weight:700;"
          >
            Payroll runs
          </div>

          <label>
            <span class="muted-white" style="font-size:11px;">
              Status
            </span>
            <select
              class="glass-input"
              data-payroll-status
              style="margin-left:7px;"
            >
              <option value="">All statuses</option>
              ${Object.entries(STATUS_LABELS)
                .map(
                  ([value, label]) => `
                    <option value="${value}">
                      ${escapeHtml(label)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </label>
        </div>

        <div data-payroll-runs>
          ${renderLoading()}
        </div>
      </div>
    </div>
  `;
}

export function wirePayrollManagement(root) {
  root
    .querySelector("[data-refresh-payroll]")
    ?.addEventListener(
      "click",
      () =>
        Promise.all([
          loadCafes(root),
          loadPayrollRuns(root),
        ])
    );

  root
    .querySelector("[data-payroll-status]")
    ?.addEventListener("change", (event) => {
      selectedStatus =
        event.currentTarget.value;

      loadPayrollRuns(root);
    });

  root
    .querySelector("[data-create-payroll]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      createPayrollRun(
        root,
        event.currentTarget
      );
    });

  Promise.all([
    loadCafes(root),
    loadPayrollRuns(root),
  ]);
}
