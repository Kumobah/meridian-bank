let refreshPromise = null; // dedupes concurrent refresh attempts

function getCsrfFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function rawRequest(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (method !== "GET") {
    const csrf = getCsrfFromCookie();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { res, json };
}

async function attemptRefresh() {
  if (!refreshPromise) {
    refreshPromise = rawRequest("/api/auth/refresh", { method: "POST" }).finally(() => {
      refreshPromise = null;
    });
  }
  const { res } = await refreshPromise;
  return res.ok;
}

async function request(path, opts = {}, _isRetry = false) {
  const { res, json } = await rawRequest(path, opts);

  if (res.ok && json?.success !== false) {
    const data = json?.data ?? {};
    return { ...data, message: json?.message ?? "" };
  }

  const tokenExpired = json?.errors?.includes("token_expired");
  if (tokenExpired && !_isRetry && path !== "/api/auth/refresh") {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return request(path, opts, true); // one retry only, never loops
    }
  }

  const message = json?.message || `Request failed (${res.status})`;
  const err = new Error(message);
  err.status = res.status;
  err.errors = json?.errors;
  throw err;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
};

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function downloadStatement(accountId, filters) {
  window.open(`/api/statements/${accountId}${buildQuery(filters)}`, "_blank");
}

export function downloadStatementPdf(accountId, filters) {
  window.open(`/api/statements/${accountId}/pdf${buildQuery(filters)}`, "_blank");
}
