// =============================================================================
// ZAMORIN CAFE ERP — NOTIFICATION EVENT STORE
//
// Central, single source of truth for notifications, matching the spec's
// core instruction: "build one central, reusable, event-driven notification
// platform," not a pile of disconnected toasts. Every business action that
// should notify someone (leave submitted, approval decided, critical cash
// variance) calls pushNotification() here — nothing pushes a popup directly.
// The bell, the Notification Centre, and the glass-frost popup queue all
// read from this one list.
// =============================================================================

let seq = 1000;

export const NOTIFICATIONS = [];

export function pushNotification(data) {
  seq += 1;
  const full = {
    id: `NE-${seq}`,
    read: false,
    delivered: false,
    createdAt: Date.now(),
    actionRequired: false,
    popupEligible: false,
    severity: "info",
    ...data,
  };
  NOTIFICATIONS.unshift(full);
  return full;
}

export function forRole(role) {
  return NOTIFICATIONS.filter((n) => n.recipientRoles.includes(role));
}

export function unreadCount(role) {
  return forRole(role).filter((n) => !n.read).length;
}

export function undeliveredPopups(role) {
  return forRole(role).filter((n) => n.popupEligible && !n.delivered);
}

export function markRead(id) {
  const n = NOTIFICATIONS.find((x) => x.id === id);
  if (n) n.read = true;
}

export function markAllRead(role) {
  forRole(role).forEach((n) => (n.read = true));
}

export function markDelivered(id) {
  const n = NOTIFICATIONS.find((x) => x.id === id);
  if (n) n.delivered = true;
}

export function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
