// PAGE: Announcements (Staff self-service, with read-receipt per the new-ideas doc)
import { showToast } from "../components.js";

let ANNOUNCEMENTS = [
  { title: "New hygiene checklist starts Monday", body: "Please review the updated opening checklist before your next shift.", requiresAck: true, acked: false },
  { title: "Diwali roster published", body: "Check My Leave for holiday-period shift changes.", requiresAck: false, acked: false },
];

export function renderAnnouncements() {
  return `
    <div class="page-enter" style="padding:8px 4px;">
      <div style="color:#fff; font-weight:700; font-size:17px; margin-bottom:18px;" class="font-display">Announcements</div>
      <div class="flex-col gap-md" id="announce-list">${ANNOUNCEMENTS.map(announceCard).join("")}</div>
    </div>
  `;
}

function announceCard(a, i) {
  return `
    <div class="glass" style="padding:18px;">
      <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:6px;">${a.title}</div>
      <div class="muted-white" style="font-size:12.5px; margin-bottom:${a.requiresAck ? "12px" : "0"};">${a.body}</div>
      ${a.requiresAck ? (a.acked ? `<div class="pill pill-mint">✓ Acknowledged</div>` : `<button class="btn btn-primary" style="padding:8px 14px; font-size:12px;" data-ack="${i}">I've read this</button>`) : ""}
    </div>
  `;
}

export function wireAnnouncements(root) {
  root.querySelectorAll("[data-ack]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.ack);
      ANNOUNCEMENTS[i].acked = true;
      root.querySelector("#announce-list").innerHTML = ANNOUNCEMENTS.map(announceCard).join("");
      wireAnnouncements(root);
      showToast("Acknowledged — this is recorded for Cafe Admin/Master to see", "mint");
    });
  });
}
