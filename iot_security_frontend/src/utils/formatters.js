function formatReadableLabel(value) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

// PUBLIC_INTERFACE
export function formatTimestamp(value) {
  /** Return a locale-aware timestamp for event and device activity displays. */
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

// PUBLIC_INTERFACE
export function formatRelativeTime(value) {
  /** Return a compact relative time label such as "5m ago" for live dashboards. */
  if (!value) {
    return 'moments ago';
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return 'moments ago';
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  return `${diffDays}d ago`;
}

// PUBLIC_INTERFACE
export function titleCase(value) {
  /** Convert machine-friendly labels into a dashboard-friendly title case string. */
  if (!value) {
    return '';
  }

  return formatReadableLabel(String(value));
}

// PUBLIC_INTERFACE
export function getSeverityTone(severity) {
  /** Map a severity level to a visual tone used throughout the dashboard UI. */
  const normalizedSeverity = String(severity || 'info').toLowerCase();

  if (normalizedSeverity === 'critical' || normalizedSeverity === 'high') {
    return 'danger';
  }

  if (normalizedSeverity === 'medium' || normalizedSeverity === 'warning') {
    return 'warning';
  }

  if (normalizedSeverity === 'success' || normalizedSeverity === 'healthy') {
    return 'success';
  }

  return 'info';
}

// PUBLIC_INTERFACE
export function classNames(...values) {
  /** Join conditional CSS class values into a stable space-separated string. */
  return values.filter(Boolean).join(' ');
}
