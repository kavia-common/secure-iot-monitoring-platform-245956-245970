import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function readStoredSession() {
  try {
    const token = window.localStorage.getItem('iot-security-token') || '';
    const rawUser = window.localStorage.getItem('iot-security-user');
    return {
      token,
      user: rawUser ? JSON.parse(rawUser) : null
    };
  } catch (error) {
    return {
      token: '',
      user: null
    };
  }
}

function persistSession(token, user) {
  try {
    if (token) {
      window.localStorage.setItem('iot-security-token', token);
    } else {
      window.localStorage.removeItem('iot-security-token');
    }

    if (user) {
      window.localStorage.setItem('iot-security-user', JSON.stringify(user));
    } else {
      window.localStorage.removeItem('iot-security-user');
    }
  } catch (error) {
    // Ignore localStorage write failures in restricted environments.
  }
}

function buildAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

function formatTimestamp(value) {
  if (!value) {
    return '—';
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return '—';
  }

  return timestamp.toLocaleString();
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'An unexpected integration error occurred.';
}

function upsertById(items, nextItem) {
  if (!nextItem || !nextItem.id) {
    return items;
  }

  const filteredItems = items.filter((item) => item.id !== nextItem.id);
  const combinedItems = [nextItem, ...filteredItems];

  return combinedItems.sort((left, right) => {
    const rightValue = new Date(
      right.updatedAt || right.timestamp || right.lastSeenAt || right.createdAt || 0
    ).getTime();
    const leftValue = new Date(
      left.updatedAt || left.timestamp || left.lastSeenAt || left.createdAt || 0
    ).getTime();

    return rightValue - leftValue;
  });
}

function removeById(items, itemId) {
  return items.filter((item) => item.id !== itemId);
}

function createRealtimeMessage(channel, payload) {
  const summary =
    payload?.message ||
    payload?.deviceName ||
    payload?.name ||
    payload?.status ||
    'Realtime update received.';

  return {
    id: `${channel}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    channel,
    summary,
    receivedAt: new Date().toISOString(),
    payload
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed with status ${response.status}.`);
  }

  return payload;
}

const API_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'
);
const SOCKET_URL = normalizeBaseUrl(
  process.env.REACT_APP_SOCKET_URL || API_BASE_URL
);

// PUBLIC_INTERFACE
/**
 * Renders the frontend integration dashboard used to validate end-to-end
 * connectivity between the React client, backend REST API, Socket.IO layer,
 * and MongoDB-backed demo data.
 *
 * @returns {JSX.Element} The application UI.
 */
function App() {
  const storedSession = readStoredSession();
  const [token, setToken] = useState(storedSession.token);
  const [currentUser, setCurrentUser] = useState(storedSession.user);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [realtimeInfo, setRealtimeInfo] = useState(null);
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [apiError, setApiError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: storedSession.user?.email || 'admin@iotsecure.demo',
    password: 'Admin123!'
  });

  const fetchHealthSnapshot = useCallback(async () => {
    const payload = await fetchJson(`${API_BASE_URL}/`);
    setHealth(payload);
    return payload;
  }, []);

  const fetchProtectedResources = useCallback(async (accessToken) => {
    const [profileResponse, realtimeResponse, statsResponse, devicesResponse, eventsResponse] =
      await Promise.all([
        fetchJson(`${API_BASE_URL}/api/auth/me`, {
          headers: buildAuthHeaders(accessToken)
        }),
        fetchJson(`${API_BASE_URL}/api/realtime/info`, {
          headers: buildAuthHeaders(accessToken)
        }),
        fetchJson(`${API_BASE_URL}/api/stats/overview`, {
          headers: buildAuthHeaders(accessToken)
        }),
        fetchJson(`${API_BASE_URL}/api/devices?limit=6`, {
          headers: buildAuthHeaders(accessToken)
        }),
        fetchJson(`${API_BASE_URL}/api/events?limit=8`, {
          headers: buildAuthHeaders(accessToken)
        })
      ]);

    setCurrentUser(profileResponse.data || null);
    setRealtimeInfo(realtimeResponse.data || null);
    setStats(statsResponse.data || null);
    setDevices(devicesResponse.data?.items || []);
    setEvents(eventsResponse.data?.items || []);
  }, []);

  useEffect(() => {
    persistSession(token, currentUser);
  }, [token, currentUser]);

  useEffect(() => {
    fetchHealthSnapshot().catch((error) => {
      setApiError(toErrorMessage(error));
    });
  }, [fetchHealthSnapshot]);

  useEffect(() => {
    if (!token) {
      setSocketConnected(false);
      setSocketError('');
      return;
    }

    let isActive = true;
    setIsRefreshing(true);

    fetchProtectedResources(token)
      .then(() => {
        if (isActive) {
          setApiError('');
        }
      })
      .catch((error) => {
        if (isActive) {
          setApiError(toErrorMessage(error));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsRefreshing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fetchProtectedResources, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    const appendRealtimeMessage = (channel, payload) => {
      setRealtimeMessages((previousMessages) => [
        createRealtimeMessage(channel, payload),
        ...previousMessages
      ].slice(0, 12));
    };

    socket.on('connect', () => {
      setSocketConnected(true);
      setSocketError('');
      appendRealtimeMessage('socket:connect', {
        message: `Connected to ${SOCKET_URL} via Socket.IO.`
      });
      socket.emit('dashboard:subscribe');
    });

    socket.on('disconnect', (reason) => {
      setSocketConnected(false);
      appendRealtimeMessage('socket:disconnect', {
        message: `Socket disconnected: ${reason}.`
      });
    });

    socket.on('connect_error', (error) => {
      setSocketConnected(false);
      setSocketError(error.message);
      appendRealtimeMessage('socket:error', {
        message: error.message
      });
    });

    socket.on('system:welcome', (payload) => {
      appendRealtimeMessage('system:welcome', payload);
    });

    socket.on('events:new', (payload) => {
      appendRealtimeMessage('events:new', payload);
      setEvents((previousEvents) => upsertById(previousEvents, payload));
    });

    socket.on('events:acknowledged', (payload) => {
      appendRealtimeMessage('events:acknowledged', payload);
      setEvents((previousEvents) => upsertById(previousEvents, payload));
    });

    socket.on('devices:updated', (payload) => {
      appendRealtimeMessage('devices:updated', payload);
      setDevices((previousDevices) => upsertById(previousDevices, payload));
    });

    socket.on('devices:deleted', (payload) => {
      appendRealtimeMessage('devices:deleted', payload);
      setDevices((previousDevices) => removeById(previousDevices, payload.id));
    });

    socket.on('stats:updated', (payload) => {
      appendRealtimeMessage('stats:updated', {
        message: 'Dashboard statistics snapshot refreshed.'
      });
      setStats(payload);
    });

    socket.on('dashboard:updated', (payload) => {
      appendRealtimeMessage('dashboard:updated', {
        message: 'Dashboard summary refreshed.'
      });
      setStats(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((previousForm) => ({
      ...previousForm,
      [name]: value
    }));
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setIsAuthenticating(true);
    setApiError('');
    setStatusMessage('');

    try {
      const response = await fetchJson(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(authForm)
      });

      setToken(response.data?.token || '');
      setCurrentUser(response.data?.user || null);
      setStatusMessage('Authentication successful. Loading backend data and realtime channels...');
    } catch (error) {
      setApiError(toErrorMessage(error));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    setStats(null);
    setDevices([]);
    setEvents([]);
    setRealtimeInfo(null);
    setRealtimeMessages([]);
    setSocketConnected(false);
    setSocketError('');
    setApiError('');
    setStatusMessage('Signed out of the demo session.');
  };

  const handleRefresh = async () => {
    setApiError('');
    setStatusMessage('');
    setIsRefreshing(true);

    try {
      await fetchHealthSnapshot();

      if (token) {
        await fetchProtectedResources(token);
      }

      setStatusMessage('Frontend, backend, and database snapshots refreshed.');
    } catch (error) {
      setApiError(toErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTriggerDevice = async (device) => {
    if (!token) {
      setApiError('Sign in before triggering device activity.');
      return;
    }

    setApiError('');
    setStatusMessage('');

    try {
      const response = await fetchJson(
        `${API_BASE_URL}/api/devices/${device.id || device.deviceId}/trigger`,
        {
          method: 'POST',
          headers: buildAuthHeaders(token),
          body: JSON.stringify({
            eventType: device.type === 'door' ? 'door_opened' : 'motion_detected',
            source: 'frontend-demo',
            message: `Manual demo trigger from the frontend for ${device.name}.`
          })
        }
      );

      if (response.data?.device) {
        setDevices((previousDevices) => upsertById(previousDevices, response.data.device));
      }

      if (response.data?.event) {
        setEvents((previousEvents) => upsertById(previousEvents, response.data.event));
      }

      setStatusMessage(`Triggered a demo event for ${device.name}.`);
    } catch (error) {
      setApiError(toErrorMessage(error));
    }
  };

  const summary = stats?.summary || {};
  const recentAlerts = stats?.recentAlerts || [];
  const connectionCards = [
    {
      label: 'REST API',
      value: health?.status || 'unavailable',
      detail: API_BASE_URL
    },
    {
      label: 'MongoDB',
      value: health?.services?.database || 'unknown',
      detail: 'Seed defaults: myapp / appuser'
    },
    {
      label: 'Realtime',
      value: socketConnected ? 'connected' : token ? 'connecting' : 'signed-out',
      detail: SOCKET_URL
    },
    {
      label: 'Session',
      value: currentUser ? currentUser.role : 'anonymous',
      detail: currentUser?.email || 'Login required for protected routes'
    }
  ];

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">End-to-end demo integration</p>
          <h1>IoT Security Monitoring Platform</h1>
          <p className="hero-copy">
            This dashboard confirms frontend ↔ backend ↔ MongoDB connectivity using the
            seeded demo accounts, protected REST APIs, and Socket.IO realtime updates.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleRefresh}
            disabled={isRefreshing || isAuthenticating}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {token ? (
            <button
              type="button"
              className="ghost-button"
              onClick={handleLogout}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <section className="env-strip" aria-label="Environment configuration">
        <span className="env-pill">API: {API_BASE_URL}</span>
        <span className="env-pill">Socket.IO: {SOCKET_URL}</span>
        <span className="env-pill">Socket path: {realtimeInfo?.path || '/socket.io'}</span>
      </section>

      {apiError ? (
        <section className="banner banner-error" role="alert">
          {apiError}
        </section>
      ) : null}

      {statusMessage ? (
        <section className="banner banner-success">
          {statusMessage}
        </section>
      ) : null}

      <section className="card-grid">
        {connectionCards.map((card) => (
          <article key={card.label} className="status-card">
            <span className="status-label">{card.label}</span>
            <strong className="status-value">{card.value}</strong>
            <span className="status-detail">{card.detail}</span>
          </article>
        ))}
      </section>

      <main className="dashboard-layout">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <div>
              <h2>Authentication</h2>
              <p>Use the seeded demo accounts to unlock protected REST and realtime flows.</p>
            </div>
          </div>

          {currentUser ? (
            <div className="auth-summary">
              <div className="auth-summary-card">
                <span>Signed in as</span>
                <strong>{currentUser.name}</strong>
                <p>{currentUser.email}</p>
              </div>
              <div className="auth-summary-card">
                <span>Role</span>
                <strong>{currentUser.role}</strong>
                <p>Last login: {formatTimestamp(currentUser.lastLoginAt)}</p>
              </div>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleLoginSubmit}>
              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={handleFieldChange}
                  placeholder="admin@iotsecure.demo"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  value={authForm.password}
                  onChange={handleFieldChange}
                  placeholder="Admin123!"
                  autoComplete="current-password"
                  required
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={isAuthenticating}
              >
                {isAuthenticating ? 'Signing in…' : 'Sign in to backend'}
              </button>

              <p className="helper-copy">
                Demo credentials: <strong>admin@iotsecure.demo / Admin123!</strong> or{' '}
                <strong>analyst@iotsecure.demo / User123!</strong>
              </p>
            </form>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Overview statistics</h2>
              <p>MongoDB-backed summary data returned from the protected stats endpoint.</p>
            </div>
          </div>

          <div className="stats-grid">
            <article className="metric-card">
              <span>Total devices</span>
              <strong>{summary.totalDevices ?? '—'}</strong>
            </article>
            <article className="metric-card">
              <span>Active devices</span>
              <strong>{summary.activeDevices ?? '—'}</strong>
            </article>
            <article className="metric-card">
              <span>Suspicious events</span>
              <strong>{summary.suspiciousEvents ?? '—'}</strong>
            </article>
            <article className="metric-card">
              <span>Critical alerts</span>
              <strong>{summary.criticalAlerts ?? '—'}</strong>
            </article>
          </div>

          <div className="alert-list">
            <h3>Recent alerts</h3>
            {recentAlerts.length === 0 ? (
              <p className="empty-state">Sign in to load recent alert data.</p>
            ) : (
              recentAlerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="list-item">
                  <div>
                    <strong>{alert.deviceName}</strong>
                    <p>{alert.message}</p>
                  </div>
                  <div className="list-meta">
                    <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
                    <small>{formatTimestamp(alert.timestamp)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Devices</h2>
              <p>Protected device list plus manual event trigger calls to the backend.</p>
            </div>
          </div>

          {devices.length === 0 ? (
            <p className="empty-state">No device data loaded yet.</p>
          ) : (
            <div className="item-stack">
              {devices.map((device) => (
                <article key={device.id} className="device-card">
                  <div>
                    <div className="device-title-row">
                      <strong>{device.name}</strong>
                      <span className={`badge badge-${device.status}`}>{device.status}</span>
                    </div>
                    <p>{device.deviceId} • {device.location}</p>
                    <small>
                      Type: {device.type} • Battery: {device.batteryLevel ?? '—'}% • Last seen:{' '}
                      {formatTimestamp(device.lastSeenAt)}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleTriggerDevice(device)}
                    disabled={!token}
                  >
                    Trigger demo event
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent events</h2>
              <p>Live event feed backed by MongoDB and updated over Socket.IO broadcasts.</p>
            </div>
          </div>

          {events.length === 0 ? (
            <p className="empty-state">No event data loaded yet.</p>
          ) : (
            <div className="item-stack">
              {events.map((eventItem) => (
                <article key={eventItem.id} className="event-card">
                  <div>
                    <div className="device-title-row">
                      <strong>{eventItem.deviceName}</strong>
                      <span className={`badge badge-${eventItem.severity}`}>
                        {eventItem.severity}
                      </span>
                    </div>
                    <p>{eventItem.eventType} • {eventItem.location}</p>
                    <small>{eventItem.message}</small>
                  </div>

                  <div className="list-meta">
                    <span className={`badge ${eventItem.suspicious ? 'badge-critical' : 'badge-info'}`}>
                      {eventItem.suspicious ? 'suspicious' : 'normal'}
                    </span>
                    <small>{formatTimestamp(eventItem.timestamp)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel realtime-panel">
          <div className="panel-heading">
            <div>
              <h2>Realtime channel</h2>
              <p>Authenticated Socket.IO connection status and the latest broadcast messages.</p>
            </div>
          </div>

          <div className="realtime-summary">
            <div className="auth-summary-card">
              <span>Socket status</span>
              <strong>{socketConnected ? 'Connected' : 'Disconnected'}</strong>
              <p>{socketError || 'Awaiting the next broadcast from the backend.'}</p>
            </div>
            <div className="auth-summary-card">
              <span>Broadcast channels</span>
              <strong>{Object.keys(realtimeInfo?.channels || {}).length}</strong>
              <p>{realtimeInfo?.authentication || 'Login required for authenticated monitoring.'}</p>
            </div>
          </div>

          {realtimeMessages.length === 0 ? (
            <p className="empty-state">No realtime messages received yet.</p>
          ) : (
            <div className="realtime-feed">
              {realtimeMessages.map((message) => (
                <article key={message.id} className="realtime-item">
                  <div>
                    <strong>{message.channel}</strong>
                    <p>{message.summary}</p>
                  </div>
                  <small>{formatTimestamp(message.receivedAt)}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
