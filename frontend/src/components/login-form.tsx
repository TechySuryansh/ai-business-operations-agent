'use client';
import { useEffect, useState } from 'react';
import type { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './ui/button';
const loadAuth = () => import('@/lib/supabase/browser');
function warmAuth() {
  void loadAuth().catch(() => {});
}
export function LoginForm({
  createClient,
}: {
  createClient?: typeof supabaseBrowser;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'recover' | 'reset'>('login');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset')) setMode('reset');
    const errors: Record<string, string> = {
      oauth_cancelled: 'Google sign-in was cancelled or denied. Please try again.',
      oauth: 'Unable to complete Google sign-in. Please try again or sign in with email.',
      confirmation: 'This sign-in link is invalid or expired. Please request a new one.',
    };
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const fragmentError = fragment.get('error');
    const errorKey = fragmentError
      ? fragmentError === 'access_denied'
        ? 'oauth_cancelled'
        : 'oauth'
      : params.get('error');
    setMessage(errors[errorKey ?? ''] ?? '');
    if (fragmentError)
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }, []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const pending = busy || googleBusy;
  useEffect(() => {
    function returned() {
      if (googleBusy) {
        setGoogleBusy(false);
        setMessage('Google sign-in was not completed. Please try again.');
      }
    }
    window.addEventListener('pageshow', returned);
    return () => window.removeEventListener('pageshow', returned);
  }, [googleBusy]);
  async function googleSignIn() {
    if (pending) return;
    setGoogleBusy(true);
    setMessage('');
    try {
      const client = createClient ? createClient() : (await loadAuth()).supabaseBrowser();
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/auth/confirm', window.location.origin).href },
      });
      if (error || !data.url) throw new Error('OAuth failed');
      // The Supabase browser client navigates to Google; stay disabled until navigation.
    } catch {
      setMessage('Unable to start Google sign-in. Please try again or sign in with email.');
      setGoogleBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setBusy(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    try {
      const client = createClient ? createClient() : (await loadAuth()).supabaseBrowser();
      const auth = client.auth;
      const result =
        mode === 'login'
          ? await auth.signInWithPassword({ email, password })
          : mode === 'signup'
            ? await auth.signUp({
                email,
                password,
                options: { emailRedirectTo: window.location.origin + '/auth/confirm' },
              })
            : mode === 'recover'
              ? await auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + '/auth/confirm',
                })
              : await auth.updateUser({ password });
      if (result.error) throw new Error(result.error.message);
      if (mode === 'login' || mode === 'reset') window.location.assign('/');
      else
        setMessage(
          mode === 'signup'
            ? 'Check your email to confirm your account.'
            : 'If this account exists, you will receive a recovery email.',
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to complete this request.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="login-heading">
        <h1>{{ login: 'Welcome back', signup: 'Create an account', recover: 'Reset your password', reset: 'Choose a new password' }[mode]}</h1>
        <p>{{ login: 'Sign in to your company workspace.', signup: 'Use your work email or Google account to get started.', recover: 'Enter your email to receive a recovery link.', reset: 'Use at least 12 characters for your new password.' }[mode]}</p>
      </header>
      {(mode === 'login' || mode === 'signup') && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="login-google"
            onPointerEnter={warmAuth}
            onFocus={warmAuth}
            aria-busy={googleBusy}
            onClick={googleSignIn}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/>
              <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.5l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44z"/>
              <path fill="#FBBC05" d="M12.6 27.9a12 12 0 0 1 0-7.8v-5.3H5.8a20 20 0 0 0 0 18.4z"/>
              <path fill="#EA4335" d="M24 11.7c3 0 5.7 1 7.8 3l5.9-5.9C34.1 5.7 29.5 4 24 4A20.4 20.4 0 0 0 5.8 14.8l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4z"/>
            </svg>
            {googleBusy ? 'Connecting to Google…' : 'Continue with Google'}
          </Button>
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>
        </>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      <form onSubmit={submit} onFocus={warmAuth} className="record-form">
        {mode !== 'reset' && (
          <label className="field-label">
            Email
            <input name="email" placeholder="you@company.com" type="email" autoComplete="email" required />
          </label>
        )}
        {mode !== 'recover' && (
          <label className="field-label">
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>
        )}
        <Button disabled={pending}>
          {busy
            ? 'Working…'
            : mode === 'login'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'reset'
                  ? 'Update password'
                  : 'Send recovery email'}
        </Button>
      </form>
      <div className="dialog-actions">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setMessage('');
            setMode(mode === 'login' ? 'signup' : 'login');
          }}
        >
          {mode === 'login' ? 'Create account' : 'Back to sign in'}
        </Button>
        {mode === 'login' && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setMessage('');
              setMode('recover');
            }}
          >
            Forgot password?
          </Button>
        )}
      </div>
    </>
  );
}
