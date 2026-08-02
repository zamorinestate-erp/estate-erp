// =============================================================================
// ZAMORIN CAFE ERP — INDIAN STANDARD TIME UTILITY
// Simulates the "server is the source of truth for time" rule from the spec.
// In this frontend-only prototype there is no real backend clock to call, so
// this module is the single place that stands in for it — every attendance
// action reads time from here, never from a raw `new Date()` scattered around
// page code. When a real backend exists, only this file needs to change to
// call GET /api/v1/attendance/server-time instead of using the browser clock.
// =============================================================================

const IST_OFFSET_MINUTES = 5.5 * 60;

// Pretend "server now" — in production this comes from the backend.
export function serverNowUtc() {
  return new Date();
}

export function toIST(date) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + IST_OFFSET_MINUTES * 60000);
}

export function formatISTTime(date) {
  const ist = toIST(date);
  let h = ist.getHours();
  const m = ist.getMinutes();
  const s = ist.getSeconds();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)} ${ampm} IST`;
}

export function formatISTTimeShort(date) {
  const ist = toIST(date);
  let h = ist.getHours();
  const m = ist.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)} ${ampm} IST`;
}

export function formatISTDate(date) {
  const ist = toIST(date);
  return ist.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} minute${m === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
}
