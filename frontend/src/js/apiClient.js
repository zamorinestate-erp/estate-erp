// =============================================================================
// ZAMORIN CAFE ERP — HIGH-PERFORMANCE AUTHENTICATED API CLIENT
// Features: Single-Flight Request Deduplication, SWR Client Cache,
// Automatic Mutation Invalidation, Stale Request Cancellation & Zero-Lag Transport.
// =============================================================================

const DEFAULT_API_BASE_URL =
  typeof globalThis.location !== "undefined" &&
  (globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1")
    ? `http://${globalThis.location.hostname}:4000/api/v1`
    : "/api/v1";

function normalizeApiBaseUrl(value) {
  const candidate =
    typeof value === "string" && value.trim()
      ? value.trim()
      : DEFAULT_API_BASE_URL;

  return candidate.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeApiBaseUrl(
  globalThis.ZAMORIN_API_BASE_URL
);

const DEVICE_ID_STORAGE_KEY = "zamorin-device-id";

let stepUpAuthenticationHandler = null;
let singleFlightRefreshPromise = null;

import { state } from "./state.js";

// =============================================================================
// IN-FLIGHT GET DEDUPLICATION & CLIENT-SIDE READ CACHE
// =============================================================================
const MAX_CACHE_ENTRIES = 150;
const inFlightGetRequests = new Map();
const apiReadCache = new Map();

export const RequestScope = Object.freeze({
  ROUTE_OWNED: "ROUTE_OWNED",
  GLOBAL_APPLICATION: "GLOBAL_APPLICATION",
  USER_ACTION: "USER_ACTION",
  BACKGROUND_REVALIDATION: "BACKGROUND_REVALIDATION",
});

export const CachePolicy = Object.freeze({
  IMMUTABLE: "IMMUTABLE",           // 1 hour TTL (enum metadata, static schemas)
  SESSION_STATIC: "SESSION_STATIC", // 10 min TTL (cafes, user profile, role rules)
  SHORT_LIVED: "SHORT_LIVED",       // 30 sec TTL (entity lists, summaries)
  SWR: "SWR",                       // Stale-While-Revalidate (instant return + bg sync)
  SENSITIVE_NO_CACHE: "NO_CACHE",   // Never cache (Passbook balance, cash till, live mutations)
});

const DEFAULT_POLICY_MAP = [
  { prefix: "/passbook", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/personal-ledger", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/payroll/runs", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/payroll/advances", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/sales-cash", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/pos", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/finance/gl-journals", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/cafe-operations/operator/sign-in", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/cafe-device-state", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/auth/refresh", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/auth/step-up", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/auth/login", policy: CachePolicy.SENSITIVE_NO_CACHE },
  { prefix: "/auth/me", policy: CachePolicy.SESSION_STATIC },
  { prefix: "/cafes", policy: CachePolicy.SESSION_STATIC },
  { prefix: "/reports/catalogue", policy: CachePolicy.SESSION_STATIC },
  { prefix: "/settings/system", policy: CachePolicy.SESSION_STATIC },
  { prefix: "/settings/diagnostics", policy: CachePolicy.SESSION_STATIC },
  { prefix: "/settings", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/inventory", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/procurement", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/vendors", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/customers", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/employees", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/bills", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/expenses", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/finance", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/dashboard", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/notifications", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/tasks", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/quality", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/assets", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/dept-orders", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/menu", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/revenue-share", policy: CachePolicy.SHORT_LIVED },
  { prefix: "/trash", policy: CachePolicy.SHORT_LIVED },
];

export function determineCachePolicy(path) {
  for (const rule of DEFAULT_POLICY_MAP) {
    if (path.startsWith(rule.prefix)) {
      return rule.policy;
    }
  }
  return CachePolicy.SHORT_LIVED;
}

export function getPolicyTTL(policy) {
  switch (policy) {
    case CachePolicy.IMMUTABLE:
      return 60 * 60 * 1000; // 1 hr
    case CachePolicy.SESSION_STATIC:
      return 10 * 60 * 1000; // 10 min
    case CachePolicy.SHORT_LIVED:
    case CachePolicy.SWR:
      return 30 * 1000; // 30 sec
    default:
      return 0;
  }
}

/**
 * Derives a complete security & tenant-scoped cache key.
 * Format: k:{orgId}::{userId}::{role}::{cafeId}::{deviceId}::{method}:{normalizedPath}
 */
export function generateCacheKey(path, options = {}) {
  const normalizedPath = normalizeApiPath(path);
  const orgId = options.organisationId || state?.auth?.user?.organisationId || state?.user?.organisationId || "ORG_DEFAULT";
  const userId = options.userId || state?.auth?.user?.userId || state?.user?.userId || "ANON";
  const role = options.role || state?.role || "GUEST";
  const cafeId = options.cafeId || state?.currentCafeId || (typeof localStorage !== "undefined" ? localStorage.getItem("zamorin_bound_cafe_id") : null) || "ALL";
  const deviceId = options.deviceId || getOrCreateDeviceId();
  const method = (options.method || "GET").toUpperCase();

  return `k:${orgId}::${userId}::${role}::${cafeId}::${deviceId}::${method}:${normalizedPath}`;
}

function setCacheEntry(key, data, ttl) {
  if (apiReadCache.size >= MAX_CACHE_ENTRIES) {
    // LRU eviction: delete oldest inserted key
    const oldestKey = apiReadCache.keys().next().value;
    if (oldestKey) {
      apiReadCache.delete(oldestKey);
    }
  }
  apiReadCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

export function clearApiCache(pathPrefix = null) {
  if (!pathPrefix) {
    apiReadCache.clear();
    return;
  }
  const norm = normalizeApiPath(pathPrefix);
  for (const key of apiReadCache.keys()) {
    const pathPart = key.split(/::(?:GET|POST|PUT|PATCH|DELETE):/)[1] || "";
    if (pathPart.startsWith(norm)) {
      apiReadCache.delete(key);
    }
  }
}

export function clearApiCacheAndInFlight() {
  apiReadCache.clear();
  inFlightGetRequests.clear();
  cancelPendingRouteReads();
}

export function invalidateRelatedCaches(mutationPath) {
  const norm = normalizeApiPath(mutationPath);
  if (norm.startsWith("/inventory")) {
    clearApiCache("/inventory");
    clearApiCache("/dashboard");
  } else if (norm.startsWith("/vendors") || norm.startsWith("/procurement")) {
    clearApiCache("/vendors");
    clearApiCache("/procurement");
    clearApiCache("/dashboard");
  } else if (norm.startsWith("/customers")) {
    clearApiCache("/customers");
    clearApiCache("/dashboard");
  } else if (norm.startsWith("/employees") || norm.startsWith("/payroll") || norm.startsWith("/attendance")) {
    clearApiCache("/employees");
    clearApiCache("/payroll");
    clearApiCache("/attendance");
    clearApiCache("/dashboard");
  } else if (norm.startsWith("/expenses") || norm.startsWith("/bills") || norm.startsWith("/finance")) {
    clearApiCache("/expenses");
    clearApiCache("/bills");
    clearApiCache("/finance");
    clearApiCache("/dashboard");
  } else if (norm.startsWith("/settings")) {
    clearApiCache("/settings");
  } else {
    // Evict direct path prefix
    clearApiCache(norm);
  }
}

// Active Route Abort Controller for Stale Navigation Cancellation
let activeRouteAbortController = null;

export function getRouteAbortSignal() {
  if (!activeRouteAbortController) {
    activeRouteAbortController = new AbortController();
  }
  return activeRouteAbortController.signal;
}

export function cancelPendingRouteReads() {
  if (activeRouteAbortController) {
    activeRouteAbortController.abort();
    activeRouteAbortController = new AbortController();
  }
}

export const SessionState = Object.freeze({
  INITIALISING: "INITIALISING",
  AUTHENTICATED: "AUTHENTICATED",
  REFRESHING: "REFRESHING",
  EXPIRED: "EXPIRED",
  SIGNED_OUT: "SIGNED_OUT",
  DEV_PREVIEW: "DEV_PREVIEW",
});

let currentSessionState = SessionState.AUTHENTICATED;

export function getSessionState() {
  return currentSessionState;
}

export function setSessionState(newState) {
  if (Object.values(SessionState).includes(newState)) {
    currentSessionState = newState;
  }
}

export function setStepUpAuthenticationHandler(handler) {
  if (handler !== null && typeof handler !== "function") {
    throw new TypeError("Step-up authentication handler must be a function or null.");
  }
  stepUpAuthenticationHandler = handler;
}

let memoryCachedDeviceId = null;

export function getOrCreateDeviceId() {
  if (memoryCachedDeviceId) {
    return memoryCachedDeviceId;
  }
  try {
    const existing = globalThis.localStorage?.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.trim()) {
      memoryCachedDeviceId = existing.trim();
      return memoryCachedDeviceId;
    }
  } catch {}

  const cryptoApi = globalThis.crypto;
  let deviceId;

  if (typeof cryptoApi?.randomUUID === "function") {
    deviceId = cryptoApi.randomUUID();
  } else if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    deviceId = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  } else {
    deviceId = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  memoryCachedDeviceId = deviceId;
  try {
    globalThis.localStorage?.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  } catch {}

  return deviceId;
}

export class ApiClientError extends Error {
  constructor({
    status,
    code,
    message,
    userMessage = null,
    correlationId = null,
    data = null,
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.data = data;
    this.userMessage = userMessage || mapErrorToUserMessage(code, status, message);
  }
}

export function mapErrorToUserMessage(code, status, fallbackMessage) {
  switch (code) {
    case "REFRESH_SESSION_REQUIRED":
    case "INVALID_OR_EXPIRED_SESSION":
    case "AUTHENTICATION_REQUIRED":
    case "AUTH_SESSION_INVALID":
      return "Your authenticated session could not be validated. Please sign in again.";
    case "STEP_UP_AUTHENTICATION_REQUIRED":
      return "Recent security verification is required for this action.";
    case "PERMISSION_DENIED":
    case "FORBIDDEN":
    case "CAFE_ACCESS_DENIED":
      return "You do not have permission to perform this action.";
    case "NETWORK_UNAVAILABLE":
    case "FETCH_ERROR":
      return "The server could not be reached. Please check your network connection.";
    case "INVALID_API_RESPONSE":
    case "API_CONTRACT_ERROR":
      return "The service returned an unexpected response. Please try again later.";
    case "EXPORT_FAILED":
      return "The export could not be generated. Please retry.";
    case "VALIDATION_ERROR":
      return fallbackMessage || "Please check your input values and try again.";
    default:
      if (status === 401) return "Your authenticated session could not be validated.";
      if (status === 403) return "You do not have permission to access this resource.";
      if (status === 404) return "The requested record could not be found.";
      if (status >= 500) return "This service is temporarily unavailable. Please try again later.";
      return fallbackMessage || "The request could not be completed.";
  }
}

export function normalizeApiPath(path) {
  if (typeof path !== "string") {
    throw new TypeError("API paths must be strings.");
  }
  let clean = path.trim();
  if (!clean.startsWith("/")) clean = "/" + clean;

  if (clean.startsWith("/api/v1/")) {
    clean = clean.substring(7);
  } else if (clean === "/api/v1") {
    clean = "/";
  } else if (clean.startsWith("/api/")) {
    clean = clean.substring(4);
  }

  return clean;
}

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  if (contentType.includes("application/json") || contentType.includes("+json") || (text.startsWith("{") || text.startsWith("["))) {
    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        error: {
          code: "INVALID_API_RESPONSE",
          message: "The server returned an invalid JSON response.",
        },
      };
    }
  }

  if (contentType.includes("text/html") || text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    return {
      success: false,
      error: {
        code: "INVALID_API_RESPONSE",
        message: `Endpoint returned HTML document (Status: ${response.status}).`,
      },
    };
  }

  return {
    success: response.ok,
    data: text,
  };
}

function createApiError(response, payload) {
  const code = payload?.error?.code || `HTTP_${response.status}`;
  const message = payload?.error?.message || "The request could not be completed.";

  return new ApiClientError({
    status: response.status,
    code,
    message,
    correlationId: payload?.correlationId || null,
    data: payload?.data || null,
  });
}

export async function performRequest(
  path,
  {
    method = "GET",
    signal,
    body,
    headers = {},
  } = {}
) {
  const hasJsonBody = body !== undefined && !(body instanceof FormData) && !(body instanceof Blob);
  const normalizedPath = normalizeApiPath(path);

  try {
    return await fetch(
      `${API_BASE_URL}${normalizedPath}`,
      {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json, text/plain, */*",
          "x-device-id": getOrCreateDeviceId(),
          ...(hasJsonBody
            ? {
                "Content-Type": "application/json",
              }
            : {}),
          ...headers,
        },
        body: hasJsonBody
          ? JSON.stringify(body)
          : body,
        signal,
      }
    );
  } catch (netErr) {
    if (signal?.aborted) {
      throw new ApiClientError({
        status: 0,
        code: "REQUEST_ABORTED",
        message: "The request was cancelled.",
        userMessage: "The request was cancelled.",
      });
    }
    throw new ApiClientError({
      status: 0,
      code: "NETWORK_UNAVAILABLE",
      message: netErr?.message || "Failed to fetch",
      userMessage: "The server could not be reached. Please check your connection.",
    });
  }
}

export async function refreshAuthenticatedSession() {
  if (singleFlightRefreshPromise) {
    return singleFlightRefreshPromise;
  }

  singleFlightRefreshPromise = (async () => {
    try {
      setSessionState(SessionState.REFRESHING);
      const response = await performRequest(
        "/auth/refresh",
        {
          method: "POST",
          headers: {
            "x-device-id": getOrCreateDeviceId(),
          },
        }
      );

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        setSessionState(SessionState.EXPIRED);
        throw createApiError(response, payload);
      }

      setSessionState(SessionState.AUTHENTICATED);
      return payload;
    } catch (err) {
      setSessionState(SessionState.EXPIRED);
      throw err;
    } finally {
      singleFlightRefreshPromise = null;
    }
  })();

  return singleFlightRefreshPromise;
}

const NON_REFRESHABLE_AUTH_PATHS = new Set([
  "/auth/me",
  "/auth/login",
  "/auth/refresh",
  "/auth/mfa/setup",
  "/auth/mfa/confirm",
  "/auth/mfa/verify",
  "/auth/password/change",
  "/auth/step-up",
]);

export async function requestJson(
  method,
  path,
  {
    signal,
    body,
    scope = RequestScope.ROUTE_OWNED,
    allowStepUpRetry = true,
    allowRefreshRetry = true,
    bypassCache = false,
    cachePolicy = null,
  } = {}
) {
  const normalized = normalizeApiPath(path);
  const isGet = method.toUpperCase() === "GET";
  const policy = cachePolicy || determineCachePolicy(normalized);
  const cacheKey = generateCacheKey(path, { method });

  // Check Read Cache for GET
  if (isGet && !bypassCache && policy !== CachePolicy.SENSITIVE_NO_CACHE) {
    const cached = apiReadCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < cached.ttl) {
      // SWR background refresh
      if (policy === CachePolicy.SWR || now - cached.timestamp > cached.ttl / 2) {
        queueMicrotask(() => {
          performRequest(path, { method: "GET" }).then(async (res) => {
            if (res.ok) {
              const freshPayload = await readResponsePayload(res);
              setCacheEntry(cacheKey, freshPayload, getPolicyTTL(policy));
            }
          }).catch(() => {});
        });
      }
      return cached.data;
    }
  }

  // Single-Flight GET Request Deduplication
  if (isGet) {
    const activeFlight = inFlightGetRequests.get(cacheKey);
    if (activeFlight) {
      if (signal) {
        return new Promise((resolve, reject) => {
          const onAbort = () => {
            reject(new ApiClientError({
              status: 0,
              code: "REQUEST_ABORTED",
              message: "The request was cancelled.",
              userMessage: "The request was cancelled.",
            }));
          };
          if (signal.aborted) {
            return onAbort();
          }
          signal.addEventListener("abort", onAbort, { once: true });
          activeFlight.then(
            (val) => { signal.removeEventListener("abort", onAbort); resolve(val); },
            (err) => { signal.removeEventListener("abort", onAbort); reject(err); }
          );
        });
      }
      return activeFlight;
    }
  }

  const executionPromise = (async () => {
    let response = await performRequest(path, {
      method,
      signal: isGet ? undefined : signal, // Shared GET fetch is not aborted by single consumer
      body,
    });

    if (
      response.status === 401 &&
      allowRefreshRetry &&
      !NON_REFRESHABLE_AUTH_PATHS.has(normalized)
    ) {
      try {
        await refreshAuthenticatedSession();

        response = await performRequest(path, {
          method,
          signal: isGet ? undefined : signal,
          body,
        });
      } catch (refreshErr) {
        throw new ApiClientError({
          status: 401,
          code: "AUTH_SESSION_INVALID",
          message: "Authenticated session has expired.",
          userMessage: "Your authenticated session could not be validated. Please sign in again.",
        });
      }
    }

    const payload = await readResponsePayload(response);

    if (
      !response.ok &&
      response.status === 403 &&
      payload?.error?.code === "STEP_UP_AUTHENTICATION_REQUIRED" &&
      allowStepUpRetry &&
      normalized !== "/auth/step-up" &&
      typeof stepUpAuthenticationHandler === "function"
    ) {
      await stepUpAuthenticationHandler();

      return requestJson(method, path, {
        signal,
        body,
        scope,
        allowStepUpRetry: false,
        allowRefreshRetry,
      });
    }

    if (!response.ok) {
      throw createApiError(response, payload);
    }

    // Invalidate relevant cache keys ONLY upon successful state mutation
    if (!isGet) {
      invalidateRelatedCaches(normalized);
    }

    // Cache successful GET responses according to policy
    if (isGet && policy !== CachePolicy.SENSITIVE_NO_CACHE) {
      setCacheEntry(cacheKey, payload, getPolicyTTL(policy));
    }

    return payload;
  })();

  if (isGet) {
    executionPromise.catch(() => {});
    inFlightGetRequests.set(cacheKey, executionPromise);
    executionPromise.finally(() => {
      inFlightGetRequests.delete(cacheKey);
    });
  }

  if (signal) {
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new ApiClientError({
          status: 0,
          code: "REQUEST_ABORTED",
          message: "The request was cancelled.",
          userMessage: "The request was cancelled.",
        }));
      };
      if (signal.aborted) {
        return onAbort();
      }
      signal.addEventListener("abort", onAbort, { once: true });
      executionPromise.then(
        (val) => { signal.removeEventListener("abort", onAbort); resolve(val); },
        (err) => { signal.removeEventListener("abort", onAbort); reject(err); }
      );
    });
  }

  return executionPromise;
}

export function apiGet(path, options = {}) {
  return requestJson("GET", path, options);
}

export function apiPost(path, body, options = {}) {
  return requestJson("POST", path, { ...options, body });
}

export function apiPatch(path, body, options = {}) {
  return requestJson("PATCH", path, { ...options, body });
}

export function apiPut(path, body, options = {}) {
  return requestJson("PUT", path, { ...options, body });
}

export function apiDelete(path, options = {}) {
  return requestJson("DELETE", path, options);
}

export function apiJson(method, path, options = {}) {
  return requestJson(method, path, options);
}

export async function apiBlob(path, { signal, headers = {} } = {}) {
  const response = await performRequest(path, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, application/octet-stream, */*",
      ...headers,
    },
  });

  if (!response.ok) {
    const payload = await readResponsePayload(response);
    throw createApiError(response, payload);
  }

  return await response.blob();
}

export async function downloadFile({
  url,
  filename = "zamorin_export.pdf",
  expectedMimeTypes = [],
  signal,
} = {}) {
  try {
    const blob = await apiBlob(url, { signal });

    if (expectedMimeTypes.length > 0 && blob.type) {
      const match = expectedMimeTypes.some((mime) => blob.type.includes(mime));
      if (!match && blob.type.includes("text/html")) {
        throw new ApiClientError({
          status: 500,
          code: "EXPORT_FAILED",
          message: "The export service returned an invalid document type.",
        });
      }
    }

    const objectUrl = globalThis.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      anchor.remove();
      globalThis.URL.revokeObjectURL(objectUrl);
    }, 1000);

    return true;
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError({
      status: 500,
      code: "EXPORT_FAILED",
      message: err?.message || "File download failed.",
    });
  }
}

export async function apiUpload(path, formData, { signal, headers = {} } = {}) {
  if (!(formData instanceof FormData)) {
    throw new TypeError("apiUpload expects a FormData instance as body.");
  }

  const response = await performRequest(path, {
    method: "POST",
    signal,
    body: formData,
    headers: {
      ...headers,
    },
  });

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw createApiError(response, payload);
  }

  return payload;
}
