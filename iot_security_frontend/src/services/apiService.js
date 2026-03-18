import { DEMO_DEVICES, DEMO_EVENTS } from '../data/demoData';
import { API_BASE_URL } from '../config/runtimeConfig';

const DEVICES_KEY = 'iot-security-monitor-devices';
const EVENTS_KEY = 'iot-security-monitor-events';

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(key, fallbackValue) {
  const storage = getStorage();

  if (!storage) {
    return clone(fallbackValue);
  }

  try {
    const rawValue = storage.getItem(key);

    if (!rawValue) {
      storage.setItem(key, JSON.stringify(fallbackValue));
      return clone(fallbackValue);
    }

    return JSON.parse(rawValue);
  } catch (error) {
    return clone(fallbackValue);
  }
}

function writeJson(key, value) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

function buildUrl(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function getAuthHeaders(session) {
  if (!session?.token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
}

function readDevices() {
  return readJson(DEVICES_KEY, DEMO_DEVICES);
}

function readEvents() {
  return readJson(EVENTS_KEY, DEMO_EVENTS);
}

function persistDevices(devices) {
  writeJson(DEVICES_KEY, devices);
}

function persistEvents(events) {
  writeJson(EVENTS_KEY, events);
}

function parseNumber(value, fallbackValue) {
  const parsedNumber = Number(value);
  return Number.isFinite(parsedNumber) ? parsedNumber : fallbackValue;
}

function toIsoTimestamp(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getDefaultDescription(eventType, location) {
  const normalizedLocation = location || 'the monitored zone';

  if (eventType === 'door_forced') {
    return `Forced door event detected at ${normalizedLocation}.`;
  }

  if (eventType === 'door_open') {
    return `Door access event recorded at ${normalizedLocation}.`;
  }

  if (eventType === 'device_offline') {
    return `Device connectivity dropped at ${normalizedLocation}.`;
  }

  if (eventType === 'heartbeat_restored') {
    return `Device telemetry heartbeat recovered at ${normalizedLocation}.`;
  }

  if (eventType === 'maintenance_mode') {
    return `Maintenance mode enabled for ${normalizedLocation}.`;
  }

  return `Motion activity recorded at ${normalizedLocation}.`;
}

function normalizeDevice(device) {
  return {
    id: device.id || device._id || `device-${Date.now()}`,
    name: device.name || device.label || 'Unnamed sensor',
    type: String(device.type || device.deviceType || 'motion').toLowerCase(),
    location: device.location || device.zone || 'Unassigned zone',
    status: String(device.status || 'active').toLowerCase(),
    lastSeen: toIsoTimestamp(device.lastSeen || device.updatedAt || Date.now()),
    firmware: device.firmware || 'v2.5.0',
    battery: parseNumber(device.battery, 78),
    signal: parseNumber(device.signal, 91),
    alerts: parseNumber(device.alerts, 0),
  };
}

function normalizeEvent(event, devices) {
  const availableDevices = Array.isArray(devices) ? devices : readDevices();
  const matchedDevice =
    availableDevices.find(
      (device) =>
        device.id === event.deviceId ||
        device.id === event.device?._id ||
        device.name === event.deviceName
    ) || {};

  const eventType = String(
    event.eventType || event.type || event.category || event.kind || 'motion_detected'
  ).toLowerCase();

  const suspicious = Boolean(event.suspicious || event.flagged);
  const severity =
    String(
      event.severity ||
        (eventType === 'door_forced'
          ? 'critical'
          : suspicious
            ? 'high'
            : eventType === 'device_offline'
              ? 'medium'
              : 'low')
    ).toLowerCase();

  return {
    id: event.id || event._id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    deviceId: event.deviceId || matchedDevice.id || event.device?._id || 'unknown-device',
    deviceName: event.deviceName || matchedDevice.name || event.device?.name || 'Unknown device',
    deviceType: String(
      event.deviceType || matchedDevice.type || event.device?.type || 'motion'
    ).toLowerCase(),
    location: event.location || matchedDevice.location || 'Unknown location',
    eventType,
    suspicious,
    severity,
    timestamp: toIsoTimestamp(event.timestamp || event.createdAt || Date.now()),
    actor: event.actor || event.user || 'system',
    source: event.source || 'stream',
    description:
      event.description ||
      getDefaultDescription(eventType, event.location || matchedDevice.location),
  };
}

async function requestJson(paths, options, session) {
  let lastError = new Error('Network request failed.');

  for (const path of paths) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(buildUrl(path), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(session),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          continue;
        }

        const payload = await response.json().catch(() => ({}));
        const message = payload.message || payload.error || 'Request failed.';
        throw new Error(message);
      }

      if (response.status === 204) {
        return null;
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

function buildTrendSeries(events) {
  const stepHours = 2;
  const bucketCount = 6;
  const now = Date.now();
  const startingPoint = now - bucketCount * stepHours * 60 * 60 * 1000;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketTime = new Date(startingPoint + index * stepHours * 60 * 60 * 1000);

    return {
      label: bucketTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      value: 0,
      suspicious: 0,
    };
  });

  events.forEach((event) => {
    const timestamp = new Date(event.timestamp).getTime();
    const bucketIndex = Math.floor((timestamp - startingPoint) / (stepHours * 60 * 60 * 1000));

    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].value += 1;

      if (event.suspicious) {
        buckets[bucketIndex].suspicious += 1;
      }
    }
  });

  return buckets;
}

function buildDistribution(events) {
  const groups = events.reduce(
    (accumulator, event) => {
      const key = event.eventType;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    },
    {}
  );

  return Object.entries(groups)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
}

function buildDeviceHealth(devices) {
  const totalDevices = devices.length || 1;
  const activeDevices = devices.filter((device) => device.status === 'active').length;
  return Math.round((activeDevices / totalDevices) * 100);
}

function buildAlertFeed(events) {
  return [...events]
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 6);
}

function buildSuspiciousBursts(events) {
  return events
    .filter((event) => event.suspicious)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 4);
}

function updateDeviceFromEvent(device, event) {
  if (device.id !== event.deviceId) {
    return device;
  }

  return {
    ...device,
    lastSeen: event.timestamp,
    status: event.eventType === 'device_offline' ? 'offline' : 'active',
    alerts: device.alerts + (event.suspicious ? 1 : 0),
  };
}

function createEventRecord({ device, eventType, actor, source }) {
  const currentEvents = readEvents();
  const recentSimilarEvents = currentEvents.filter((event) => {
    const eventTime = new Date(event.timestamp).getTime();
    const threshold = Date.now() - 6 * 60 * 1000;
    return event.deviceId === device.id && eventTime >= threshold;
  });

  const suspicious =
    eventType === 'door_forced' ||
    eventType === 'device_offline' ||
    recentSimilarEvents.length >= 2;

  const severity =
    eventType === 'door_forced'
      ? 'critical'
      : suspicious
        ? 'high'
        : eventType === 'device_offline'
          ? 'medium'
          : 'low';

  return normalizeEvent(
    {
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.type,
      location: device.location,
      eventType,
      suspicious,
      severity,
      timestamp: new Date().toISOString(),
      actor: actor || 'operator',
      source: source || 'manual-trigger',
      description: getDefaultDescription(eventType, device.location),
    },
    [device]
  );
}

// PUBLIC_INTERFACE
export async function getHealthStatus(session) {
  /** Probe the backend health endpoint and report whether the UI is in live or demo mode. */
  try {
    const payload = await requestJson(['/', '/health', '/api/health'], { method: 'GET' }, session);

    return {
      status: 'healthy',
      label: payload.message || 'Backend reachable',
      source: 'backend',
    };
  } catch (error) {
    return {
      status: 'demo',
      label: 'Demo data mode (backend routes pending)',
      source: 'demo',
    };
  }
}

// PUBLIC_INTERFACE
export async function getDevices(session) {
  /** Load device inventory from the backend when available, otherwise from local demo storage. */
  try {
    const payload = await requestJson(
      ['/api/devices', '/devices'],
      { method: 'GET' },
      session
    );

    const devices = Array.isArray(payload)
      ? payload
      : payload.devices || payload.data || payload.items || [];

    if (devices.length > 0) {
      const normalizedDevices = devices.map(normalizeDevice);
      persistDevices(normalizedDevices);
      return normalizedDevices;
    }
  } catch (error) {
    return readDevices().map(normalizeDevice);
  }

  return readDevices().map(normalizeDevice);
}

// PUBLIC_INTERFACE
export async function getEventLogs(filters, session) {
  /** Load event logs from the backend when available, otherwise from local demo storage. */
  try {
    const query = new URLSearchParams();

    if (filters?.deviceType && filters.deviceType !== 'all') {
      query.set('deviceType', filters.deviceType);
    }

    if (filters?.eventType && filters.eventType !== 'all') {
      query.set('eventType', filters.eventType);
    }

    if (filters?.suspiciousOnly) {
      query.set('suspicious', 'true');
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';

    const payload = await requestJson(
      [`/api/logs${suffix}`, `/logs${suffix}`, `/api/events${suffix}`, `/events${suffix}`],
      { method: 'GET' },
      session
    );

    const events = Array.isArray(payload)
      ? payload
      : payload.logs || payload.events || payload.data || payload.items || [];

    if (events.length > 0) {
      const normalizedEvents = events.map((event) => normalizeEvent(event, readDevices()));
      persistEvents(normalizedEvents);
      return normalizedEvents.sort(
        (left, right) => new Date(right.timestamp) - new Date(left.timestamp)
      );
    }
  } catch (error) {
    return readEvents().map((event) => normalizeEvent(event, readDevices()));
  }

  return readEvents().map((event) => normalizeEvent(event, readDevices()));
}

// PUBLIC_INTERFACE
export function buildDashboardSnapshot({ devices, events, health }) {
  /** Build dashboard-ready summary cards, charts, and alert collections from device/event state. */
  const safeDevices = Array.isArray(devices) ? devices : [];
  const safeEvents = [...(Array.isArray(events) ? events : [])].sort(
    (left, right) => new Date(right.timestamp) - new Date(left.timestamp)
  );

  const suspiciousEvents = safeEvents.filter((event) => event.suspicious);
  const activeDevices = safeDevices.filter((device) => device.status === 'active').length;
  const offlineDevices = safeDevices.filter((device) => device.status === 'offline').length;
  const healthScore = buildDeviceHealth(safeDevices);

  return {
    stats: [
      {
        label: 'Total Alerts',
        value: safeEvents.length,
        tone: 'info',
        detail: `${suspiciousEvents.length} suspicious`,
      },
      {
        label: 'Active Devices',
        value: `${activeDevices}/${safeDevices.length || 0}`,
        tone: 'success',
        detail: `${offlineDevices} offline`,
      },
      {
        label: 'Suspicious Bursts',
        value: suspiciousEvents.length,
        tone: 'danger',
        detail: 'Pattern detection',
      },
      {
        label: 'Coverage',
        value: `${healthScore}%`,
        tone: health?.status === 'healthy' ? 'success' : 'warning',
        detail: health?.label || 'Backend unknown',
      },
    ],
    trendSeries: buildTrendSeries(safeEvents),
    distribution: buildDistribution(safeEvents),
    recentAlerts: buildAlertFeed(safeEvents),
    suspiciousBursts: buildSuspiciousBursts(safeEvents),
    deviceHealthScore: healthScore,
    health: health || {
      status: 'demo',
      label: 'Awaiting backend',
      source: 'demo',
    },
  };
}

// PUBLIC_INTERFACE
export async function upsertDevice(deviceInput, session) {
  /** Create or update a device record using the backend when possible and demo storage otherwise. */
  const normalizedDevice = normalizeDevice({
    ...deviceInput,
    lastSeen: deviceInput.lastSeen || new Date().toISOString(),
  });

  try {
    const isUpdate = Boolean(deviceInput.id);
    const path = isUpdate
      ? [`/api/devices/${deviceInput.id}`, `/devices/${deviceInput.id}`]
      : ['/api/devices', '/devices'];

    const payload = await requestJson(
      path,
      {
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(normalizedDevice),
      },
      session
    );

    const device = normalizeDevice(payload.device || payload.data || payload);
    const existingDevices = readDevices();
    const nextDevices = isUpdate
      ? existingDevices.map((currentDevice) =>
          currentDevice.id === device.id ? device : currentDevice
        )
      : [device, ...existingDevices];

    persistDevices(nextDevices);
    return {
      device,
      devices: nextDevices,
    };
  } catch (error) {
    const existingDevices = readDevices();
    const nextDevices = deviceInput.id
      ? existingDevices.map((currentDevice) =>
          currentDevice.id === deviceInput.id ? normalizedDevice : currentDevice
        )
      : [
          {
            ...normalizedDevice,
            id: `device-${Date.now()}`,
          },
          ...existingDevices,
        ];

    persistDevices(nextDevices);

    return {
      device: nextDevices.find((device) => device.name === normalizedDevice.name) || nextDevices[0],
      devices: nextDevices,
    };
  }
}

// PUBLIC_INTERFACE
export async function deleteDevice(deviceId, session) {
  /** Delete a device record using the backend when possible and demo storage otherwise. */
  try {
    await requestJson(
      [`/api/devices/${deviceId}`, `/devices/${deviceId}`],
      { method: 'DELETE' },
      session
    );
  } catch (error) {
    // Ignore remote failures and complete the operation locally.
  }

  const nextDevices = readDevices().filter((device) => device.id !== deviceId);
  persistDevices(nextDevices);

  return nextDevices;
}

// PUBLIC_INTERFACE
export async function triggerDeviceEvent(payload, session) {
  /** Trigger a simulated security event for a device and persist it for live UI feedback. */
  try {
    const response = await requestJson(
      [
        `/api/devices/${payload.deviceId}/trigger`,
        `/devices/${payload.deviceId}/trigger`,
        '/api/events/trigger',
      ],
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      session
    );

    const normalizedEvent = normalizeEvent(
      response.event || response.data || response,
      readDevices()
    );
    return ingestRealtimeEvent(normalizedEvent);
  } catch (error) {
    const devices = readDevices();
    const device = devices.find((currentDevice) => currentDevice.id === payload.deviceId);

    if (!device) {
      throw new Error('Device not found.');
    }

    const event = createEventRecord({
      device,
      eventType: payload.eventType,
      actor: payload.actor,
      source: 'manual-trigger',
    });

    return ingestRealtimeEvent(event);
  }
}

// PUBLIC_INTERFACE
export async function ingestRealtimeEvent(payload) {
  /** Merge a realtime event or device update into demo persistence and return the updated state. */
  const devices = readDevices();
  const events = readEvents();

  if (payload?.kind === 'device-update') {
    const incomingDevice = normalizeDevice(payload.payload || {});
    const nextDevices = devices.map((device) =>
      device.id === incomingDevice.id ? { ...device, ...incomingDevice } : device
    );

    persistDevices(nextDevices);

    return {
      event: null,
      devices: nextDevices,
      events,
    };
  }

  const normalizedEvent = normalizeEvent(payload?.event || payload, devices);
  const alreadyExists = events.some((event) => event.id === normalizedEvent.id);
  const nextEvents = alreadyExists ? events : [normalizedEvent, ...events].slice(0, 250);
  const nextDevices = devices.map((device) => updateDeviceFromEvent(device, normalizedEvent));

  persistEvents(nextEvents);
  persistDevices(nextDevices);

  return {
    event: normalizedEvent,
    devices: nextDevices,
    events: nextEvents,
  };
}
