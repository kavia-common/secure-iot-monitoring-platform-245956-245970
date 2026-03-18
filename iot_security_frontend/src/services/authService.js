import { DEMO_USERS } from '../data/demoData';
import { API_BASE_URL } from '../config/runtimeConfig';

const AUTH_SESSION_KEY = 'iot-security-monitor-session';
const DEMO_USERS_KEY = 'iot-security-monitor-users';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function readJson(key, fallbackValue) {
  const storage = getStorage();

  if (!storage) {
    return fallbackValue;
  }

  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

function removeValue(key) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(key);
}

function buildUrl(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function sanitizeUser(user) {
  return {
    id: user.id || user._id || `user-${Date.now()}`,
    name: user.name || 'Security Operator',
    email: user.email || '',
    role: user.role || 'user',
  };
}

function buildDemoToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    issuedAt: Date.now(),
  };

  const encodedPayload =
    typeof window !== 'undefined' && typeof window.btoa === 'function'
      ? window.btoa(JSON.stringify(payload))
      : JSON.stringify(payload);

  return `demo-jwt.${encodedPayload}`;
}

function getSeededUsers() {
  const storedUsers = readJson(DEMO_USERS_KEY, null);

  if (storedUsers && Array.isArray(storedUsers) && storedUsers.length > 0) {
    return storedUsers;
  }

  writeJson(DEMO_USERS_KEY, DEMO_USERS);
  return [...DEMO_USERS];
}

async function requestAuth(paths, body) {
  let lastError = new Error('Authentication service is unavailable.');

  for (const path of paths) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(buildUrl(path), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          continue;
        }

        const errorPayload = await response.json().catch(() => ({}));
        const message =
          errorPayload.message ||
          errorPayload.error ||
          'Authentication request failed.';

        throw new Error(message);
      }

      return response.json();
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

function persistSession(user, token, source) {
  const session = {
    token,
    source,
    user: sanitizeUser(user),
  };

  writeJson(AUTH_SESSION_KEY, session);

  return session;
}

// PUBLIC_INTERFACE
export function getDemoAccounts() {
  /** Return demo account metadata used by the login screen for quick access. */
  return getSeededUsers().map((user) => ({
    role: user.role,
    email: user.email,
    password: user.password,
    name: user.name,
  }));
}

// PUBLIC_INTERFACE
export function restoreSession() {
  /** Restore the last known authenticated session from local storage. */
  return readJson(AUTH_SESSION_KEY, null);
}

// PUBLIC_INTERFACE
export async function loginUser(credentials) {
  /** Authenticate a user against the backend and gracefully fall back to demo mode. */
  try {
    const response = await requestAuth(['/api/auth/login', '/auth/login'], credentials);
    const user = sanitizeUser(response.user || response.data?.user || response.profile || {});
    const token = response.token || response.accessToken || buildDemoToken(user);

    return persistSession(user, token, 'api');
  } catch (error) {
    const users = getSeededUsers();
    const matchedUser = users.find(
      (user) =>
        user.email.toLowerCase() === credentials.email.toLowerCase() &&
        user.password === credentials.password
    );

    if (!matchedUser) {
      throw new Error('Invalid email or password.');
    }

    return persistSession(matchedUser, buildDemoToken(matchedUser), 'demo');
  }
}

// PUBLIC_INTERFACE
export async function registerUser(userInput) {
  /** Register a new operator account with API-first behavior and demo persistence fallback. */
  try {
    const response = await requestAuth(['/api/auth/register', '/auth/register'], userInput);
    const user = sanitizeUser(response.user || response.data?.user || response.profile || {});
    const token = response.token || response.accessToken || buildDemoToken(user);

    return persistSession(user, token, 'api');
  } catch (error) {
    const users = getSeededUsers();
    const existingUser = users.find(
      (user) => user.email.toLowerCase() === userInput.email.toLowerCase()
    );

    if (existingUser) {
      throw new Error('An account with this email already exists.');
    }

    const createdUser = {
      id: `user-${Date.now()}`,
      name: userInput.name.trim(),
      email: userInput.email.trim().toLowerCase(),
      password: userInput.password,
      role: 'user',
    };

    writeJson(DEMO_USERS_KEY, [createdUser, ...users]);

    return persistSession(createdUser, buildDemoToken(createdUser), 'demo');
  }
}

// PUBLIC_INTERFACE
export function logoutUser() {
  /** Clear the active dashboard session from browser storage. */
  removeValue(AUTH_SESSION_KEY);
}
