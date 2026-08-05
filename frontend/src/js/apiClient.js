// Secure authenticated API helpers for the Zamorin Cafe ERP frontend.

const DEFAULT_API_BASE_URL = "/api/v1";

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

export class ApiClientError extends Error {
  constructor({
    status,
    code,
    message,
    correlationId = null,
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
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
  });
}

async function performRequest(
  path,
  {
    method = "GET",
    signal,
    body,
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

async function requestJson(
  method,
  path,
  {
    signal,
    body,
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

  if (response.status === 401) {
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
