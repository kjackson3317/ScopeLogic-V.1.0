'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '../../lib/supabase/client';

function authErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message.trim()) return cause.message.trim();
  if (typeof cause === 'string' && cause.trim()) return cause.trim();
  if (cause && typeof cause === 'object') {
    const candidate = cause as { message?: unknown; error_description?: unknown; error?: unknown };
    for (const value of [candidate.message, candidate.error_description, candidate.error]) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return fallback;
}

function friendlyRecoveryError(cause: unknown) {
  const message = authErrorMessage(cause, 'Password reset could not be started.');
  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many password reset attempts were made. Wait briefly and try again.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('fetch')) {
    return 'ScopeLogic cannot reach its authentication service. Check your connection and try again.';
  }
  return message;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();
      const recoveryOrigin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${recoveryOrigin}/auth/callback?next=/update-password`,
      });
      if (resetError) throw resetError;
      setEmail('');
      setMessage('If that email belongs to a ScopeLogic account, a password reset email has been sent. Open the link in that email to set a new password.');
    } catch (cause) {
      setError(friendlyRecoveryError(cause));
    } finally {
      setLoading(false);
    }
  };

  return <main className="auth-page"><section className="auth-card">
    <img className="auth-logo" src="/brand/scopelogic-logo-full.png" alt="ScopeLogic LLC" />
    <div className="auth-heading"><span>Account Recovery</span><h1>Reset your password</h1><p>Enter the email address connected to your ScopeLogic account.</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label><span>Email address</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {message && <div className="auth-success">{message}</div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="primary auth-submit" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Email'}</button>
      <a className="auth-link" href="/login">Return to sign in</a>
    </form>
  </section></main>;
}
