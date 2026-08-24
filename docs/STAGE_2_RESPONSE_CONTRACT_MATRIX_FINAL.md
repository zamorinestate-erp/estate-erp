# ZAMORIN CAFE ERP — STAGE 2 RESPONSE CONTRACT MATRIX
## Universal API Transport & Response Type Verification

### 1. HTTP Status & Payload Handling Matrix

| # | Response Case | HTTP Status / Header | Parser Handling in `apiClient.js` | Resulting UI / Application State | Status |
|---|---|---|---|---|:---:|
| 1 | **JSON 200** | `200 OK`, `application/json` | Safely parsed via `res.json()` | Delivers parsed data payload | **PASS** |
| 2 | **JSON 201** | `201 Created`, `application/json` | Safely parsed via `res.json()` | Delivers created record payload | **PASS** |
| 3 | **204 No Content** | `204 No Content`, empty body | Returns `{ success: true, data: null }` without parser crash | Action completes cleanly | **PASS** |
| 4 | **JSON Validation 400** | `400 Bad Request`, `application/json` | Throws `ApiClientError` with validation details | Displays field/validation error message | **PASS** |
| 5 | **401 Authentication** | `401 Unauthorized` | Triggers single-flight session refresh; falls through on failure | Displays controlled login required message | **PASS** |
| 6 | **403 Forbidden** | `403 Forbidden` | Throws `ApiClientError` with permission code | Displays access denied message | **PASS** |
| 7 | **404 Not Found** | `404 Not Found` | Detects JSON or HTML 404 and extracts error message | Displays record not found message | **PASS** |
| 8 | **500 Server Error** | `500 Internal Server Error` | Extracts error JSON or fallback message without crash | Displays friendly server error message | **PASS** |
| 9 | **Network Unavailable** | Connection offline / DNS failure | Catches native TypeError (`Failed to fetch`), maps to offline message | Displays `"Network connection unavailable"` | **PASS** |
| 10 | **Timeout / AbortController** | `signal.abort()` | Catches DOMException `AbortError`, cancels request | Displays `"Request timed out. Please try again."` | **PASS** |
| 11 | **Malformed JSON** | `200 OK`, corrupted JSON body | Catches JSON parse error, wraps in `ApiClientError` | Prevents unhandled syntax error crash | **PASS** |
| 12 | **Unexpected text/plain** | `200 OK`, `text/plain` | Reads text, returns `{ success: true, text }` | Delivers text content safely | **PASS** |
| 13 | **Unexpected text/html (e.g. 404)** | `404/500`, `text/html` | Checks `Content-Type`, suppresses `JSON.parse` crash | Eliminates `Unexpected token '<'` crash | **PASS** |
| 14 | **PDF Response** | `application/pdf` | Handled via `apiBlob()` / `downloadFile()` | Initiates browser PDF file download | **PASS** |
| 15 | **XLSX Response** | `application/vnd.openxmlformats-...` | Handled via `apiBlob()` / `downloadFile()` | Initiates Excel spreadsheet download | **PASS** |
| 16 | **CSV Response** | `text/csv` | Handled via `apiBlob()` / `downloadFile()` | Initiates CSV file download | **PASS** |
| 17 | **File with Missing Filename** | `Content-Disposition` absent | `downloadFile()` falls back to safe default name | Downloads file safely without undefined name | **PASS** |
