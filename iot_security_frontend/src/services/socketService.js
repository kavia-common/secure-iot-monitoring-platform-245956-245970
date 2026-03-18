import { io } from 'socket.io-client';

import { DEMO_DEVICES } from '../data/demoData';
import { SOCKET_URL } from '../config/runtimeConfig';

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildFallbackEvent() {
  const device = randomItem(DEMO_DEVICES);
  const eventType =
    device.type === 'door'
      ? randomItem(['door_open', 'door_forced'])
      : randomItem(['motion_detected', 'motion_detected', 'device_offline']);

  return {
    deviceId: device.id,
    deviceName: device.name,
    deviceType: device.type,
    location: device.location,
    eventType,
    suspicious: eventType === 'door_forced' || Math.random() > 0.72,
    severity:
      eventType === 'door_forced'
        ? 'critical'
        : eventType === 'device_offline'
          ? 'medium'
          : 'high',
    timestamp: new Date().toISOString(),
    actor: 'socket-fallback',
    source: 'demo-stream',
  };
}

function normalizeSocketPayload(payload) {
  if (payload?.event) {
    return payload.event;
  }

  if (payload?.data?.event) {
    return payload.data.event;
  }

  return payload;
}

// PUBLIC_INTERFACE
export function createRealtimeFeed({ session, onEvent, onStatusChange }) {
  /** Start the realtime feed using Socket.IO and downgrade to a demo stream when unavailable. */
  let socketInstance = null;
  let fallbackInterval = null;
  let fallbackStarted = false;

  const stopFallback = () => {
    if (fallbackInterval) {
      window.clearInterval(fallbackInterval);
      fallbackInterval = null;
    }

    fallbackStarted = false;
  };

  const startFallback = () => {
    if (fallbackStarted) {
      return;
    }

    fallbackStarted = true;
    onStatusChange({
      mode: 'demo',
      label: 'Demo stream active',
    });

    fallbackInterval = window.setInterval(() => {
      onEvent(buildFallbackEvent());
    }, 10000);
  };

  onStatusChange({
    mode: 'connecting',
    label: 'Connecting to Socket.IO',
  });

  try {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 4500,
      reconnection: true,
      reconnectionAttempts: 3,
      auth: session?.token
        ? {
            token: session.token,
          }
        : undefined,
    });

    socketInstance.on('connect', () => {
      stopFallback();
      onStatusChange({
        mode: 'live',
        label: 'Live socket connected',
      });
    });

    socketInstance.on('connect_error', () => {
      startFallback();
    });

    socketInstance.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        startFallback();
        return;
      }

      onStatusChange({
        mode: 'offline',
        label: 'Realtime disconnected',
      });
    });

    ['security:event', 'event:created', 'iot:event', 'device:event', 'alert'].forEach(
      (eventName) => {
        socketInstance.on(eventName, (payload) => {
          onEvent(normalizeSocketPayload(payload));
        });
      }
    );

    socketInstance.on('device:update', (payload) => {
      onEvent({
        kind: 'device-update',
        payload,
      });
    });

    window.setTimeout(() => {
      if (!socketInstance?.connected) {
        startFallback();
      }
    }, 3500);
  } catch (error) {
    startFallback();
  }

  return () => {
    stopFallback();

    if (socketInstance) {
      socketInstance.disconnect();
    }
  };
}
