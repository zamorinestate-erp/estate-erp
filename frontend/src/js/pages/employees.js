// PAGE: Employees — backend-authoritative directory and profile reader.
import { ApiClientError, apiGet } from "../apiClient.js";
import { emptyState, skeleton } from "../components.js";

let activeSearch = null;
let activeProfile = null;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function show(value) {
  return value === null || value === undefined || value === "" ? "—" : esc(value);
}

function showList(value) {
  return Array.isArray(value) && value.length ? value.map(esc).join(", ") : "—";
}

function loading() {
  return `<div class="flex-col gap-md">${skeleton("76px")}${skeleton("76px")}${skeleton("76px")}</div>`;
}

function failure(title, error) {
  const message =
    error instanceof ApiClientError
      ? error.message
      : "The request could not be completed.";
  const reference =
    error instanceof ApiClientError && error.correlationId
      ? `<div class="muted-white" style="font-size:11px;margin-top:8px;">Reference: ${esc(error.correlationId)}</div>`
      : "";
  return `<div class="empty-state" role="alert"><div class="empty-state-title">${esc(title)}</div><div style="font-size:13px;">${esc(message)}</div>${reference}</div>`;
}

function profileMarkup(profile) {
  const identity = profile.identity || {};
  const employment = profile.employment || {};
  const contact = profile.contact || {};
  const availability = profile.availability || {};
  const row = (label, value) => `
    <div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08);">
      <div class="muted-white" style="font-size:10.5px;">${esc(label)}</div>
      <div style="color:#fff;font-size:13px;margin-top:2px;">${value}</div>
    </div>`;
  const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);
  const privateRows = [
    hasOwn(identity, "previousNames")
      ? row("Previous names", showList(identity.previousNames))
      : "",
    hasOwn(contact, "address")
      ? row(
          "Address",
          show(
            [
              contact.address?.line1,
              contact.address?.line2,
              contact.address?.city,
              contact.address?.state,
              contact.address?.postalCode,
              contact.address?.country,
            ]
              .filter(Boolean)
              .join(", ")
          )
        )
      : "",
    hasOwn(contact, "emergencyContact")
      ? row(
          "Emergency contact",
          show(
            [
              contact.emergencyContact?.name,
              contact.emergencyContact?.relationship,
              contact.emergencyContact?.phone,
            ]
              .filter(Boolean)
              .join(" · ")
          )
        )
      : "",
  ].join("");
  const historyMarkup = profile.history
    ? `<div style="margin-top:14px;"><div style="color:#fff;font-weight:700;margin-bottom:4px;">Employment history</div>${(profile.history.roleHistory || [])
        .map((entry) =>
          row(
            "Role change",
            `${show(entry.fromRole)} → ${show(entry.toRole)} · ${show(entry.changedAt)} · ${show(entry.changedBy)} · ${show(entry.reason)}`
          )
        )
        .join("")}${(profile.history.cafeAssignmentHistory || [])
        .map((entry) =>
          row(
            "Cafe assignment",
            `${showList(entry.previousAssignedCafeIds)} → ${showList(entry.assignedCafeIds)} · ${show(entry.previousPrimaryCafeId)} → ${show(entry.primaryCafeId)} · ${show(entry.changedAt)} · ${show(entry.changedBy)} · ${show(entry.reason)}`
          )
        )
        .join("")}</div>`
    : "";
  const lifecycleMarkup = profile.lifecycle
    ? `<div style="margin-top:14px;"><div style="color:#fff;font-weight:700;margin-bottom:4px;">Lifecycle</div>${row("Archived at", show(profile.lifecycle.archivedAt))}${row("Archived by", show(profile.lifecycle.archivedBy))}${row("Archive reason", show(profile.lifecycle.archiveReason))}</div>`
    : "";


  return `
    <div class="glass" style="padding:20px;margin-top:16px;">
      <div class="flex justify-between items-center" style="gap:12px;flex-wrap:wrap;">
        <div>
          <div style="color:#fff;font-size:18px;font-weight:700;">${show(identity.preferredName || identity.name)}</div>
          <div class="muted-white" style="font-size:11.5px;margin-top:3px;">${show(identity.userId)} · ${show(identity.role)} · ${show(identity.accountStatus)}</div>
        </div>
        <button class="btn btn-ghost" type="button" data-close-employee-profile>Close</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:16px;">
        <div>
          ${row("Legal name", show(identity.name))}
          ${row("Department", show(employment.department))}
          ${row("Designation", show(employment.designation))}
          ${row("Employment type", show(employment.employmentType))}
        </div>
        <div>
          ${row("Primary cafe", show(employment.primaryCafeId))}
          ${row("Assigned cafes", showList(employment.assignedCafeIds))}
          ${row("Email", show(contact.email))}
          ${row("Phone", show(contact.phone))}
        </div>
      </div>
      ${privateRows ? `<div style="margin-top:14px;"><div style="color:#fff;font-weight:700;margin-bottom:4px;">Authorised private profile</div>${privateRows}</div>` : ""}
      ${historyMarkup}
      ${lifecycleMarkup}
      <div style="margin-top:14px;">
        <div style="color:#fff;font-weight:700;margin-bottom:4px;">Integrated services</div>
        ${Object.entries(availability)
          .map(([key, value]) => row(key.replace(/([A-Z])/g, " $1"), show(value)))
          .join("")}
      </div>
    </div>`;
}

async function openProfile(root, userId) {
  activeProfile?.abort();
  const controller = new AbortController();
  activeProfile = controller;
  const host = root.querySelector("[data-employee-profile]");
  if (!host) return;
  host.innerHTML = loading();

  try {
    const payload = await apiGet(
      `/employees/${encodeURIComponent(userId)}`,
      { signal: controller.signal }
    );
    const profile = payload?.data?.profile;
    if (!profile?.identity) {
      throw new Error("The employee profile response was incomplete.");
    }
    if (controller.signal.aborted || !root.isConnected) return;
    host.innerHTML = profileMarkup(profile);
    host
      .querySelector("[data-close-employee-profile]")
      ?.addEventListener("click", () => {
        host.innerHTML = "";
      });
  } catch (error) {
    if (error?.name === "AbortError" || !root.isConnected) return;
    host.innerHTML = failure("Unable to load employee profile", error);
  } finally {
    if (activeProfile === controller) activeProfile = null;
  }
}

function resultsMarkup(rows, pagination) {
  if (!rows.length) {
    return emptyState({
      title: "No employees found",
      body: "No authorised employee records matched this search.",
    });
  }

  const body = rows
    .map(
      (employee) => `
        <tr>
          <td class="muted-white">${show(employee.userId)}</td>
          <td><strong>${show(employee.preferredName || employee.name)}</strong><div class="muted-white" style="font-size:10.5px;">${show(employee.name)}</div></td>
          <td>${show(employee.role)}</td>
          <td>${show(employee.department)}</td>
          <td>${show(employee.designation)}</td>
          <td>${showList(employee.assignedCafeIds)}</td>
          <td><button class="btn btn-ghost" type="button" data-open-employee="${esc(employee.userId)}">View</button></td>
        </tr>`
    )
    .join("");

  const totalPages = Math.max(1, pagination.totalPages || 1);
  return `
    <div class="glass" style="padding:18px;overflow-x:auto;">
      <table class="glass-table">
        <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Department</th><th>Designation</th><th>Cafes</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="flex justify-between items-center" style="gap:12px;margin-top:14px;">
        <button class="btn btn-ghost" type="button" data-employee-page="${pagination.page - 1}" ${pagination.page <= 1 ? "disabled" : ""}>Previous</button>
        <div class="muted-white" style="font-size:11.5px;">Page ${pagination.page} of ${totalPages} · ${pagination.total} result(s)</div>
        <button class="btn btn-ghost" type="button" data-employee-page="${pagination.page + 1}" ${pagination.page >= totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>`;
}

function wireResults(root) {
  root
    .querySelectorAll("[data-open-employee]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openProfile(root, button.dataset.openEmployee)
      )
    );
  root
    .querySelectorAll("[data-employee-page]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        searchEmployees(root, Number(button.dataset.employeePage))
      )
    );
}

async function searchEmployees(root, page = 1) {
  const input = root.querySelector("[data-employee-query]");
  const host = root.querySelector("[data-employee-results]");
  const query = input?.value.trim() || "";
  if (!host) return;

  if (!query) {
    host.innerHTML = emptyState({
      title: "Search employees",
      body: "Enter an employee name, preferred name, previous name, or permanent employee ID.",
    });
    return;
  }

  activeSearch?.abort();
  const controller = new AbortController();
  activeSearch = controller;
  host.innerHTML = loading();

  try {
    const payload = await apiGet(
      `/employees/search?q=${encodeURIComponent(query)}&page=${page}&limit=25`,
      { signal: controller.signal }
    );
    const rows = payload?.data?.employees;
    const pagination = payload?.data?.pagination;
    if (!Array.isArray(rows) || !pagination) {
      throw new Error("The employee search response was incomplete.");
    }
    if (controller.signal.aborted || !root.isConnected) return;
    host.innerHTML = resultsMarkup(rows, pagination);
    wireResults(root);
  } catch (error) {
    if (error?.name === "AbortError" || !root.isConnected) return;
    host.innerHTML = failure("Unable to search employees", error);
  } finally {
    if (activeSearch === controller) activeSearch = null;
  }
}

export function renderEmployees() {
  return `
    <div class="page-enter">
      <div style="color:#fff;font-size:22px;font-weight:700;margin-bottom:4px;" class="font-display">Employees</div>
      <div class="muted-white" style="font-size:13px;margin-bottom:18px;">Authorised employee directory. Search and profile access are revalidated by the backend.</div>
      <form class="glass" data-employee-search style="padding:18px;margin-bottom:16px;">
        <div class="flex gap-sm" style="flex-wrap:wrap;">
          <input class="input" data-employee-query maxlength="120" placeholder="Name, preferred name, previous name or employee ID" style="flex:1;min-width:240px;">
          <button class="btn btn-primary" type="submit">Search</button>
        </div>
      </form>
      <div data-employee-results>${emptyState({
        title: "Search employees",
        body: "Enter an employee name, preferred name, previous name, or permanent employee ID.",
      })}</div>
      <div data-employee-profile></div>
    </div>`;
}

export function wireEmployees(root) {
  root
    .querySelector("[data-employee-search]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      searchEmployees(root, 1);
    });
}
