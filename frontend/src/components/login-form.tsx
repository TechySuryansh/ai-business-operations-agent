'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './ui/button';
export function LoginForm({
  createClient = supabaseBrowser,
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
      const { data, error } = await createClient().auth.signInWithOAuth({
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
      const auth = createClient().auth;
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
      <p>
        {mode === 'login'
          ? 'Sign in to your company workspace.'
          : mode === 'signup'
            ? 'Create your account.'
            : mode === 'reset'
              ? 'Choose a new password.'
              : 'Recover your account.'}
      </p>
      {(mode === 'login' || mode === 'signup') && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            aria-busy={googleBusy}
            onClick={googleSignIn}
          >
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
      <form onSubmit={submit} className="record-form">
        {mode !== 'reset' && (
          <label className="field-label">
            Email
            <input name="email" type="email" autoComplete="email" required />
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
