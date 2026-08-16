// =============================================================================
// ZAMORIN CAFE ERP — APP STATE
// A deliberately tiny store: current role, current route, current settings.
// No framework needed for something this small — but the shape mirrors what
// a real state layer (Redux/Zustand/Context) would hold, so porting this to
// React later is a mechanical exercise, not a redesign.
// =============================================================================

import { ROLES } from "./navigation.js";

const listeners = new Set();

export const state = {
  auth: {
    authenticated: false,
    loading: true,
    user: null,
    error: null,
  },
  role: null, // Derived from backend authenticated identity (/auth/me)
  route: "dashboard",
  attendance: {
    status: "not_checked_in", // not_checked_in | checked_in | checked_out
    checkInAt: null,
    checkOutAt: null,
  },
  settings: {
    theme: (typeof localStorage !== "undefined" && localStorage.getItem("zamorin-theme")) || "paper",
    fontSize: (typeof localStorage !== "undefined" && localStorage.getItem("zamorin-font-size")) || "standard",
    language: "en",
    notifications: {
      roster: true,
      leave: true,
      payslip: false,
    },
  },
};

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function setSettings(patch) {
  Object.assign(state.settings, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
