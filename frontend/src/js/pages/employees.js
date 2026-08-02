// PAGE: Employees (Part G.10) — sensitive fields masked by default (Section 18.7)
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast } from "../components.js";

const EMPLOYEES = [
  { id: "ST-0004", name: "Priya Nair", role: "Barista", cafe: "Dawn Roast", phone: "98xxxxxx21", bank: "XXXX4821" },
  { id: "ST-0011", name: "Anjali Rao", role: "Barista", cafe: "Dawn Roast", phone: "98xxxxxx07", bank: "XXXX9013" },
  { id: "AD-0003", name: "Ravi Kumar", role: "Cafe Admin", cafe: "Dawn Roast", phone: "97xxxxxx55", bank: "XXXX2277" },
  { id: "ST-0022", name: "Kiran Shetty", role: "Barista", cafe: "Indiranagar", phone: "99xxxxxx40", bank: "XXXX6650" },
  { id: "ST-0031", name: "Meera Iyer", role: "Cashier", cafe: "Koramangala Central", phone: "90xxxxxx88", bank: "XXXX3345" },
];

export function renderEmployees() {
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  const rows = isAdmin ? EMPLOYEES.filter((e) => e.cafe === "Dawn Roast") : EMPLOYEES;
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Employees</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">${isAdmin ? "Dawn Roast — Koramangala, only" : "All cafes"}</div>
      <div class="glass" style="padding:22px;">
        <table class="glass-table">
          <thead><tr><th>ID</th><th>Name</th><th>Role</th>${isAdmin ? "" : "<th>Cafe</th>"}<th>Phone</th><th>Bank account</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (e) => `
              <tr>
                <td class="muted-white">${e.id}</td>
                <td>${e.name}</td>
                <td>${e.role}</td>
                ${isAdmin ? "" : `<td class="muted-white">${e.cafe}</td>`}
                <td class="muted-white">${e.phone}</td>
                <td><span class="masked" data-full="${e.bank}">•••• ${e.bank.slice(-4)}</span> <span data-reveal="${e.bank}" style="cursor:pointer; color:var(--color-accent-mint-bright); font-size:11px;">reveal</span></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function wireEmployees(root) {
  root.querySelectorAll("[data-reveal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cell = btn.previousElementSibling;
      cell.textContent = btn.dataset.reveal;
      btn.remove();
      showToast("Bank details revealed — this action is logged to the Audit Page", "amber");
    });
  });
}
