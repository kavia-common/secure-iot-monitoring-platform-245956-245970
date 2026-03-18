import React from 'react';

import { classNames } from '../utils/formatters';

// PUBLIC_INTERFACE
function ToastStack({ toasts, onDismiss }) {
  /** Render transient toast notifications for auth, alerts, and device actions. */
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={classNames('toast-card', `toast-card-${toast.tone || 'info'}`)}
        >
          <div>
            <strong>{toast.title}</strong>
            <div className="toast-message">{toast.message}</div>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastStack;
