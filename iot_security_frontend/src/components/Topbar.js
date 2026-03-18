import React from 'react';

import { classNames } from '../utils/formatters';

// PUBLIC_INTERFACE
function Topbar({ title, subtitle, user, connectionStatus, notificationCount, onToggleSidebar, onLogout }) {
  /** Render the dashboard top bar with session controls and realtime status feedback. */
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-icon-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        <div>
          <h1 className="topbar-title">{title}</h1>
          <p className="topbar-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        <div
          className={classNames(
            'status-chip',
            `status-chip-${connectionStatus?.mode || 'offline'}`
          )}
        >
          {connectionStatus?.label || 'Offline'}
        </div>

        <div className="notification-chip" aria-label={`${notificationCount} notifications in queue`}>
          Alerts {notificationCount}
        </div>

        <div className="user-summary">
          <div className="user-avatar">{user?.name?.slice(0, 1) || 'U'}</div>
          <div>
            <div className="user-name">{user?.name || 'Operator'}</div>
            <div className="user-role">{user?.role || 'user'}</div>
          </div>
        </div>

        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default Topbar;
