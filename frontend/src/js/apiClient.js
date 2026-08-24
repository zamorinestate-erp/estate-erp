// Secure authenticated API client and transport foundation for the Zamorin Cafe ERP frontend.

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

export function getOrCreateDeviceId() {
  try {
    const existing = globalThis.localStorage?.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();
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

  // Automatically strip duplicate /api/v1 or /api prefixes so all callers resolve to canonical API_BASE_URL
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

  // Handle unexpected HTML responses (e.g. 404/500 proxy error pages) gracefully without throwing JSON syntax error
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
    allowStepUpRetry = true,
    allowRefreshRetry = true,
  } = {}
) {
  let response = await performRequest(path, {
    method,
    signal,
    body,
  });

  const normalized = normalizeApiPath(path);

  if (
    response.status === 401 &&
    allowRefreshRetry &&
    !NON_REFRESHABLE_AUTH_PATHS.has(normalized)
  ) {
    try {
      await refreshAuthenticatedSession();

      response = await performRequest(path, {
        method,
        signal,
        body,
      });
    } catch (refreshErr) {
      // If refresh fails deterministically, throw controlled session error
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
      allowStepUpRetry: false,
      allowRefreshRetry,
    });
  }

  if (!response.ok) {
    throw createApiError(response, payload);
  }

  return payload;
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

/**
 * Fetch a binary file (PDF, XLSX, CSV, ZIP) with explicit response validation.
 */
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

/**
 * Downloads a file blob directly to the user's browser with a safe filename.
 */
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

/**
 * Multipart file upload wrapper.
 */
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
