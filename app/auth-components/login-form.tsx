'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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

function friendlyLoginError(cause: unknown) {
  const message = authErrorMessage(cause, 'Sign-in failed. Please try again.');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) return 'The email address or password is incorrect.';
  if (normalized.includes('email not confirmed')) return 'This account has not completed email verification yet.';
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('fetch')) {
    return 'ScopeLogic cannot reach its authentication service. Check your internet connection and try again. If the problem continues, the ScopeLogic backend may be temporarily unavailable.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) return 'Too many sign-in attempts were made. Wait briefly and try again.';
  if (normalized.includes('jwt') || normalized.includes('session')) return 'Your ScopeLogic session is no longer valid. Sign in again to continue.';
  return message;
}

export default function LoginForm({ nextPath, initialError }: { nextPath: string; initialError: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      router.replace(nextPath || '/');
      router.refresh();
    } catch (cause) {
      setError(friendlyLoginError(cause));
    } finally {
      setLoading(false);
    }
  };

  return <form className="auth-form" onSubmit={submit}>
    <label><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary auth-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
    <a className="auth-link" href="/forgot-password">Forgot password?</a>
  </form>;
}
