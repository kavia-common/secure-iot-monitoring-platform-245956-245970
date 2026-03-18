import React from 'react';

import {
  classNames,
  formatRelativeTime,
  formatTimestamp,
  getSeverityTone,
  titleCase,
} from '../utils/formatters';

function TrendChart({ series }) {
  if (!series.length) {
    return <div className="empty-state">No trend data available yet.</div>;
  }

  const width = 440;
  const height = 190;
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const xStep = width / Math.max(series.length - 1, 1);

  const linePoints = series
    .map((item, index) => {
      const x = index * xStep;
      const y = height - (item.value / maxValue) * (height - 28) - 12;
      return `${x},${y}`;
    })
    .join(' ');

  const suspiciousPoints = series
    .map((item, index) => {
      const x = index * xStep;
      const y = height - (item.suspicious / maxValue) * (height - 28) - 12;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="chart-shell">
      <svg className="trend-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Alert trend chart">
        <defs>
          <linearGradient id="primaryTrendGradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(76, 201, 240, 0.9)" />
            <stop offset="100%" stopColor="rgba(76, 201, 240, 0.08)" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((lineIndex) => (
          <line
            key={lineIndex}
            x1="0"
            x2={width}
            y1={(height / 4) * lineIndex + 8}
            y2={(height / 4) * lineIndex + 8}
            stroke="rgba(143, 161, 192, 0.18)"
            strokeDasharray="4 6"
          />
        ))}

        <polyline
          fill="none"
          stroke="rgba(255, 107, 129, 0.9)"
          strokeWidth="3"
          points={suspiciousPoints}
        />
        <polyline
          fill="none"
          stroke="rgba(76, 201, 240, 1)"
          strokeWidth="4"
          points={linePoints}
        />
      </svg>

      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot legend-dot-primary" />
          Alerts
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-dot-danger" />
          Suspicious
        </span>
      </div>

      <div className="bar-list">
        {series.map((item) => (
          <div key={item.label} className="bar-row">
            <span className="bar-label">{item.label}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 12 : 0)}%`,
                }}
              />
            </div>
            <span className="bar-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionBars({ distribution }) {
  if (!distribution.length) {
    return <div className="empty-state">No event distribution data available yet.</div>;
  }

  const maxValue = Math.max(...distribution.map((item) => item.value), 1);

  return (
    <div className="bar-list">
      {distribution.map((item) => (
        <div key={item.label} className="bar-row">
          <span className="bar-label">{titleCase(item.label)}</span>
          <div className="bar-track">
            <div
              className="bar-fill bar-fill-secondary"
              style={{
                width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 12 : 0)}%`,
              }}
            />
          </div>
          <span className="bar-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// PUBLIC_INTERFACE
function DashboardPage({ dashboard, devices, connectionStatus, onQuickTrigger, user, isLoading }) {
  /** Render the main monitoring dashboard with charts, alert summaries, and quick actions. */
  if (isLoading) {
    return (
      <section className="page-shell loading-grid">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </section>
    );
  }

  const featuredDevices = devices.slice(0, 3);

  return (
    <section className="page-shell">
      <div className="banner-card">
        <div>
          <div className="eyebrow">Realtime command center</div>
          <h2 className="section-title">
            {user?.role === 'admin' ? 'Admin visibility across every sensor edge' : 'Analyst visibility across every sensor edge'}
          </h2>
          <p className="section-description">
            Monitor suspicious bursts, device health, and live event traffic from one retro-themed operations surface.
          </p>
        </div>
        <div
          className={classNames(
            'status-chip',
            `status-chip-${connectionStatus?.mode || 'offline'}`
          )}
        >
          {connectionStatus?.label || 'Realtime unavailable'}
        </div>
      </div>

      {dashboard.health?.source === 'demo' ? (
        <div className="panel-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Demo mode enabled</h3>
              <p className="section-description">
                The frontend is fully functional and already wired for backend APIs and Socket.IO; it is currently showing seeded data because the backend container still exposes only a health endpoint.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="stats-grid">
        {dashboard.stats.map((stat) => (
          <article key={stat.label} className={`stat-card stat-accent-${stat.tone}`}>
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
            <span className="stat-change">{stat.detail}</span>
          </article>
        ))}
      </div>

      <div className="two-column-grid">
        <article className="panel-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Alert trend</h3>
              <p className="section-description">Alert intensity and suspicious detections over the last few monitoring windows.</p>
            </div>
            <div className="chart-metric">{dashboard.recentAlerts.length} active alerts</div>
          </div>
          <TrendChart series={dashboard.trendSeries} />
        </article>

        <article className="panel-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Alert distribution</h3>
              <p className="section-description">Most common security events across the monitored fleet.</p>
            </div>
            <div className="chart-metric">{dashboard.deviceHealthScore}% device health</div>
          </div>
          <DistributionBars distribution={dashboard.distribution} />
        </article>
      </div>

      <div className="two-column-grid">
        <article className="panel-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Recent alerts</h3>
              <p className="section-description">Latest high-signal events entering the command queue.</p>
            </div>
          </div>

          <div className="alert-list">
            {dashboard.recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={classNames(
                  'alert-item',
                  alert.suspicious && 'alert-item-suspicious'
                )}
              >
                <div className="alert-meta">
                  <strong className="alert-title">{alert.deviceName}</strong>
                  <span className={`tag tag-${getSeverityTone(alert.severity)}`}>
                    {titleCase(alert.severity)}
                  </span>
                </div>
                <p className="alert-description">{alert.description}</p>
                <div className="alert-tags">
                  <span className="tag tag-info">{titleCase(alert.eventType)}</span>
                  <span className="tag">{alert.location}</span>
                  <span className="tag">{formatRelativeTime(alert.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Suspicious bursts</h3>
              <p className="section-description">Pattern detection highlighting repeated or forced activity.</p>
            </div>
          </div>

          <div className="alert-list">
            {dashboard.suspiciousBursts.length ? (
              dashboard.suspiciousBursts.map((burst) => (
                <div key={burst.id} className="alert-item alert-item-suspicious">
                  <div className="alert-meta">
                    <strong className="alert-title">{titleCase(burst.eventType)}</strong>
                    <span className="tag tag-danger">Suspicious</span>
                  </div>
                  <p className="alert-description">{burst.deviceName} • {burst.location}</p>
                  <div className="alert-tags">
                    <span className="tag">{formatTimestamp(burst.timestamp)}</span>
                    <span className="tag">{burst.actor}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No suspicious bursts detected.</div>
            )}
          </div>
        </article>
      </div>

      <article className="panel-card">
        <div className="section-header">
          <div>
            <h3 className="section-title">Quick trigger station</h3>
            <p className="section-description">Simulate motion and door events to exercise the realtime dashboard flow.</p>
          </div>
        </div>

        <div className="device-grid">
          {featuredDevices.map((device) => {
            const primaryAction = device.type === 'door' ? 'door_open' : 'motion_detected';
            const secondaryAction = device.type === 'door' ? 'door_forced' : 'device_offline';

            return (
              <div key={device.id} className="device-card">
                <div className="device-header">
                  <div className="device-title-group">
                    <strong className="device-name">{device.name}</strong>
                    <span className="device-location">{device.location}</span>
                  </div>
                  <span className={`status-pill status-${device.status}`}>{device.status}</span>
                </div>

                <div className="device-stats">
                  <div className="device-stat">
                    <span>Last seen</span>
                    <strong>{formatRelativeTime(device.lastSeen)}</strong>
                  </div>
                  <div className="device-stat">
                    <span>Battery</span>
                    <strong>{device.battery}%</strong>
                  </div>
                  <div className="device-stat">
                    <span>Signal</span>
                    <strong>{device.signal}%</strong>
                  </div>
                </div>

                <div className="device-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => onQuickTrigger(device, primaryAction)}
                  >
                    Trigger {titleCase(primaryAction)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    onClick={() => onQuickTrigger(device, secondaryAction)}
                  >
                    Trigger {titleCase(secondaryAction)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

export default DashboardPage;
