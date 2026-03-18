const DEFAULT_BACKEND_ORIGIN = 'http://localhost:3001';

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveUrl(...values) {
  const matchedValue = values.find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );

  return trimTrailingSlash(matchedValue || DEFAULT_BACKEND_ORIGIN);
}

/**
 * Centralized frontend runtime endpoints.
 *
 * `REACT_APP_API_BASE_URL` and `REACT_APP_SOCKET_URL` are the canonical vars.
 * Legacy vars remain as fallbacks so the app stays compatible with older env
 * templates until deployment config is updated.
 */
export const API_BASE_URL = resolveUrl(
  process.env.REACT_APP_API_BASE_URL,
  process.env.REACT_APP_API_BASE,
  process.env.REACT_APP_BACKEND_URL
);

export const SOCKET_URL = resolveUrl(
  process.env.REACT_APP_SOCKET_URL,
  process.env.REACT_APP_WS_URL,
  process.env.REACT_APP_API_BASE_URL,
  process.env.REACT_APP_API_BASE,
  process.env.REACT_APP_BACKEND_URL
);
