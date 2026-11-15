
// API configuration
// Local development: Vite proxies /api to localhost:5000
// Production: VITE_API_URL points to the Render backend

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const TOKEN_KEY = 'fv_token';

// Normalize paths to prevent duplicate /api/api routes
function normalizeApiPath(path) {
  let normalized = `/${String(path).replace(/^\/+/, '')}`;

  // Remove an existing /api prefix if the caller included it
  normalized = normalized.replace(/^\/api(?=\/|$)/, '');

  return normalized || '/';
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  set: (token) => {
    try {
      token
        ? localStorage.setItem(TOKEN_KEY, token)
        : localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Private browsing mode
    }
  },
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data || {};
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};

  const token = tokenStore.get();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const endpoint = `${BASE}/api${normalizeApiPath(path)}`;

  let res;

  try {
    res = await fetch(endpoint, {
      method,
      headers,
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch (error) {
    console.error('API connection error:', endpoint, error);

    throw new ApiError(
      'Cannot reach the server. Check the backend URL, CORS configuration, and network connection.',
      0
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      tokenStore.set(null);
    }

    const fallback = `API request failed (${res.status})`;

    throw new ApiError(
      data.message || fallback,
      res.status,
      data
    );
  }

  return data;
}
