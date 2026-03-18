import React from 'react';

import { classNames } from '../utils/formatters';

// PUBLIC_INTERFACE
function Sidebar({ items, currentView, onNavigate, isOpen, onClose, user }) {
  /** Render the primary navigation used across dashboard, logs, and device views. */
  return (
    <>
      <aside className={classNames('sidebar', isOpen && 'sidebar-open')}>
        <div className="sidebar-header">
          <div className="brand-mark">◈</div>
          <div className="brand-copy">
            <span className="brand-kicker">Retro Threat Grid</span>
            <strong className="brand-name">IoT Security Monitor</strong>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="role-chip">
            {user?.role === 'admin' ? 'Admin Console' : 'Analyst Console'}
          </div>

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={classNames(
                'nav-button',
                currentView === item.id && 'nav-button-active'
              )}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <span className="nav-button-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-button-copy">
                <span className="nav-button-label">{item.label}</span>
                <span className="nav-button-subtitle">{item.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          className="mobile-overlay"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      ) : null}
    </>
  );
}

export default Sidebar;
