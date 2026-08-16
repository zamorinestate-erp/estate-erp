// Secure authenticated API helpers for the Zamorin Cafe ERP frontend.

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
    throw new Error("Secure browser device identification is unavailable.");
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
    correlationId = null,
    data = null,
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.data = data;
  }
}

function normalizeApiPath(path) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/")
  ) {
    throw new TypeError(
      "API paths must be absolute paths beginning with '/'."
    );
  }

  return path;
}

async function readResponsePayload(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: {
        code: "INVALID_API_RESPONSE",
        message:
          "The server returned an invalid response.",
      },
    };
  }
}

function createApiError(response, payload) {
  return new ApiClientError({
    status: response.status,
    code:
      payload?.error?.code ||
      `HTTP_${response.status}`,
    message:
      payload?.error?.message ||
      "The request could not be completed.",
    correlationId:
      payload?.correlationId || null,
    data: payload?.data || null,
  });
}

async function performRequest(
  path,
  {
    method = "GET",
    signal,
    body,
    headers = {},
  } = {}
) {
  const hasJsonBody =
    body !== undefined;

  return fetch(
    `${API_BASE_URL}${normalizeApiPath(path)}`,
    {
      method,
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(hasJsonBody
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
        ...headers,
      },
      body: hasJsonBody
        ? JSON.stringify(body)
        : undefined,
      signal,
    }
  );
}

async function refreshAuthenticatedSession() {
  const response = await performRequest(
    "/auth/refresh",
    {
      method: "POST",
      headers: {
        "x-device-id": getOrCreateDeviceId(),
      },
    }
  );

  const payload =
    await readResponsePayload(response);

  if (!response.ok) {
    throw createApiError(
      response,
      payload
    );
  }
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

async function requestJson(
  method,
  path,
  {
    signal,
    body,
    allowStepUpRetry = true,
  } = {}
) {
  let response = await performRequest(
    path,
    {
      method,
      signal,
      body,
    }
  );

  if (
    response.status === 401 &&
    !NON_REFRESHABLE_AUTH_PATHS.has(path)
  ) {
    await refreshAuthenticatedSession();

    response = await performRequest(
      path,
      {
        method,
        signal,
        body,
      }
    );
  }

  const payload =
    await readResponsePayload(response);

  if (
    !response.ok &&
    response.status === 403 &&
    payload?.error?.code === "STEP_UP_AUTHENTICATION_REQUIRED" &&
    allowStepUpRetry &&
    path !== "/auth/step-up" &&
    typeof stepUpAuthenticationHandler === "function"
  ) {
    await stepUpAuthenticationHandler();

    return requestJson(method, path, {
      signal,
      body,
      allowStepUpRetry: false,
    });
  }

  if (!response.ok) {
    throw createApiError(
      response,
      payload
    );
  }

  return payload;
}

export function apiGet(
  path,
  {
    signal,
  } = {}
) {
  return requestJson(
    "GET",
    path,
    {
      signal,
    }
  );
}

export function apiPost(
  path,
  {
    signal,
    body,
  } = {}
) {
  return requestJson(
    "POST",
    path,
    {
      signal,
      body,
    }
  );
}

export function apiPatch(
  path,
  {
    signal,
    body,
  } = {}
) {
  return requestJson(
    "PATCH",
    path,
    {
      signal,
      body,
    }
  );
}

export function apiDelete(
  path,
  {
    signal,
    body,
  } = {}
) {
  return requestJson(
    "DELETE",
    path,
    {
      signal,
      body,
    }
  );
}
