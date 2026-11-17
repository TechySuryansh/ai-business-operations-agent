'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './ui/button';
export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup' | 'recover' | 'reset'>('login');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('reset')) setMode('reset');
  }, []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    try {
      const auth = supabaseBrowser().auth;
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
        {message && <p role="status">{message}</p>}
        <Button disabled={busy}>
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
        <Button variant="ghost" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Create account' : 'Back to sign in'}
        </Button>
        {mode === 'login' && (
          <Button variant="ghost" onClick={() => setMode('recover')}>
            Forgot password?
          </Button>
        )}
      </div>
    </>
  );
}
