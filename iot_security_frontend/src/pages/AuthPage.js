import React from 'react';

// PUBLIC_INTERFACE
function AuthPage({
  mode,
  form,
  error,
  isSubmitting,
  demoAccounts,
  onModeChange,
  onFieldChange,
  onSubmit,
  onUseDemoAccount,
}) {
  /** Render login and registration flows for the IoT monitoring dashboard. */
  const isRegisterMode = mode === 'register';

  return (
    <div className="auth-grid">
      <section className="auth-copy panel-glow">
        <div className="eyebrow">Live Threat Visibility</div>
        <h1 className="auth-title">Secure the edge. Watch every signal.</h1>
        <p className="auth-description">
          Monitor motion and door sensors, surface suspicious bursts in real time,
          and manage devices through a polished, role-aware control room.
        </p>

        <div className="auth-badges">
          <span className="auth-badge">JWT-ready auth flow</span>
          <span className="auth-badge">Role-based admin tools</span>
          <span className="auth-badge">Realtime alert stream</span>
        </div>

        <div className="feature-list">
          <div className="feature-item">
            <strong>Mission dashboard</strong>
            <span>Neon retro UI with charts, stats, and suspicious activity tracking.</span>
          </div>
          <div className="feature-item">
            <strong>Searchable event intelligence</strong>
            <span>Filter by event type, device type, date range, and suspicious-only mode.</span>
          </div>
          <div className="feature-item">
            <strong>Device command center</strong>
            <span>Admin CRUD plus manual trigger simulation for demo-grade storytelling.</span>
          </div>
        </div>

        <div className="panel-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Quick demo access</h2>
              <p className="section-description">
                The backend currently exposes only a health endpoint, so these accounts unlock the full frontend demo flow.
              </p>
            </div>
          </div>

          <div className="demo-account-list">
            {demoAccounts.map((account) => (
              <div key={account.email} className="demo-account-card">
                <div className="demo-account-header">
                  <strong>{account.name}</strong>
                  <span className="demo-account-role">{account.role}</span>
                </div>
                <div className="demo-credential">{account.email}</div>
                <div className="demo-credential">{account.password}</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => onUseDemoAccount(account)}
                >
                  Use account
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card panel-glow">
          <div className="label-row">
            <button
              type="button"
              className={`btn ${!isRegisterMode ? '' : 'btn-ghost'}`}
              onClick={() => onModeChange('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`btn ${isRegisterMode ? '' : 'btn-ghost'}`}
              onClick={() => onModeChange('register')}
            >
              Register
            </button>
          </div>

          <form onSubmit={onSubmit} className="form-grid">
            {isRegisterMode ? (
              <div className="field-group">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  className="input-field"
                  placeholder="Alex Mercer"
                  value={form.name}
                  onChange={onFieldChange}
                  autoComplete="name"
                />
              </div>
            ) : null}

            <div className="field-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                className="input-field"
                placeholder="operator@iotsecure.demo"
                value={form.email}
                onChange={onFieldChange}
                autoComplete="email"
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={form.password}
                onChange={onFieldChange}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              />
            </div>

            {isRegisterMode ? (
              <div className="field-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className="input-field"
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={onFieldChange}
                  autoComplete="new-password"
                />
              </div>
            ) : null}

            {error ? <div className="error-banner">{error}</div> : null}

            <button type="submit" className="btn btn-block" disabled={isSubmitting}>
              {isSubmitting
                ? 'Processing...'
                : isRegisterMode
                  ? 'Create operator account'
                  : 'Enter command center'}
            </button>
          </form>

          <p className="helper-text">
            {isRegisterMode
              ? 'New accounts are created with analyst permissions in demo mode.'
              : 'Tip: use the admin account to access full device management actions.'}
          </p>
        </div>
      </section>
    </div>
  );
}

export default AuthPage;
