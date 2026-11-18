import './setup';
import { test, afterEach } from 'node:test';
// Disable cross-tab browser messaging in this isolated test process.
Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true });
Object.defineProperty(globalThis, 'FormData', { value: window.FormData, configurable: true });
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../src/components/login-form';
import type { supabaseBrowser } from '../src/lib/supabase/browser';
import { completeAuth } from '../src/lib/supabase/auth-callback';
import { createServerClient } from '@supabase/ssr';
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});
function client(auth: Record<string, unknown>) {
  return () => ({ auth }) as unknown as ReturnType<typeof supabaseBrowser>;
}
test('Google is available in login/signup, but not password recovery', () => {
  render(<LoginForm />);
  assert.ok(screen.getByRole('button', { name: 'Continue with Google' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  assert.ok(screen.getByRole('button', { name: 'Continue with Google' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  assert.equal(screen.queryByRole('button', { name: 'Continue with Google' }), null);
});
test('Google uses the frontend callback, blocks duplicate submissions and recovers on failure', async () => {
  let finish!: (result: unknown) => void;
  let calls = 0;
  const createClient = client({
    signInWithOAuth: async (input: unknown) => {
      calls++;
      assert.deepEqual(input, {
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth/confirm' },
      });
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  render(<LoginForm createClient={createClient} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  const loading = screen.getByRole('button', {
    name: 'Connecting to Google…',
  }) as HTMLButtonElement;
  assert.ok(loading.disabled);
  assert.ok((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled);
  fireEvent.click(loading);
  assert.equal(calls, 1);
  finish({ data: { url: null }, error: { message: 'provider detail must not leak' } });
  await waitFor(() =>
    assert.match(screen.getByRole('status').textContent ?? '', /Unable to start Google sign-in/),
  );
  assert.ok(
    !(screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled,
  );
  assert.ok(!document.body.textContent?.includes('provider detail'));
});
test('callback cancellation shows a clear login error', async () => {
  window.history.replaceState({}, '', '/login?error=oauth_cancelled');
  render(<LoginForm />);
  await waitFor(() =>
    assert.match(screen.getByRole('status').textContent ?? '', /cancelled or denied/),
  );
});
test('provider cancellation in a URL fragment is displayed without echoing its details', async () => {
  window.history.replaceState(
    {},
    '',
    '/login?error=confirmation#error=access_denied&error_description=private-detail',
  );
  render(<LoginForm />);
  await waitFor(() =>
    assert.match(screen.getByRole('status').textContent ?? '', /cancelled or denied/),
  );
  assert.equal(window.location.hash, '');
  assert.ok(!document.body.textContent?.includes('private-detail'));
});
test('existing email/password login and signup still submit their original parameters', async () => {
  let loginInput: unknown, signupInput: unknown;
  const createClient = client({
    signInWithPassword: async (input: unknown) => {
      loginInput = input;
      return { error: { message: 'Incorrect password' } };
    },
    signUp: async (input: unknown) => {
      signupInput = input;
      return { error: null };
    },
  });
  const { container } = render(<LoginForm createClient={createClient} />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-test-password' } });
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() =>
    assert.match(screen.getByRole('status').textContent ?? '', /Incorrect password/),
  );
  assert.deepEqual(loginInput, { email: 'test@example.com', password: 'long-test-password' });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() =>
    assert.match(screen.getByRole('status').textContent ?? '', /Check your email/),
  );
  assert.deepEqual(signupInput, {
    email: 'test@example.com',
    password: 'long-test-password',
    options: { emailRedirectTo: window.location.origin + '/auth/confirm' },
  });
});
const callback = (query: string) => new Request('https://app.example/auth/confirm?' + query);
function auth(error: unknown = null) {
  return async () => ({
    auth: { exchangeCodeForSession: async () => ({ error }), verifyOtp: async () => ({ error }) },
  });
}
test('callback ignores unsafe redirects and handles failed exchanges, cancellation and missing codes', async () => {
  for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', '/demo']) {
    const result = await completeAuth(
      callback('code=test&next=' + encodeURIComponent(next)),
      auth(),
    );
    assert.equal(result.headers.get('location'), '/');
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(
    (await completeAuth(callback('code=expired'), auth(new Error()))).headers.get('location'),
    '/login?error=oauth',
  );
  assert.equal(
    (
      await completeAuth(callback('code=test'), async () => {
        throw new Error('private');
      })
    ).headers.get('location'),
    '/login?error=oauth',
  );
  assert.equal(
    (
      await completeAuth(callback('error=access_denied&code=test'), async () => {
        throw new Error('must not exchange');
      })
    ).headers.get('location'),
    '/login?error=oauth_cancelled',
  );
  assert.equal(
    (await completeAuth(callback(''), auth())).headers.get('location'),
    '/login?error=confirmation',
  );
});
test('email confirmation and password-recovery OTP behavior is preserved', async () => {
  for (const type of ['signup', 'recovery']) {
    let input: unknown;
    const factory = async () => ({
      auth: {
        exchangeCodeForSession: async () => {
          throw new Error('wrong flow');
        },
        verifyOtp: async (value: unknown) => {
          input = value;
          return { error: null };
        },
      },
    });
    const result = await completeAuth(callback(`token_hash=test&type=${type}`), factory);
    assert.deepEqual(input, { token_hash: 'test', type });
    assert.equal(
      result.headers.get('location'),
      '/' + (type === 'recovery' ? 'login?reset=1' : ''),
    );
  }
});
test('PKCE exchange persists a Supabase session in cookies readable by a new client', async () => {
  const jar = new Map<string, string>();
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256' })}.${encode({ sub: 'test-user', exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  let exchanges = 0;
  const factory = () =>
    createServerClient('https://project.example', 'sb_publishable_test', {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
      },
      global: {
        fetch: async (url, options) => {
          assert.match(String(url), /token\?grant_type=pkce/);
          const body = JSON.parse(String(options?.body));
          assert.equal(body.auth_code, 'valid-code');
          assert.ok(body.code_verifier);
          exchanges++;
          return Response.json({
            access_token: token,
            refresh_token: 'test-refresh',
            token_type: 'bearer',
            expires_in: 3600,
            user: { id: 'test-user', aud: 'authenticated', email: 'test@example.com' },
          });
        },
      },
    });
  await factory().auth.signInWithOAuth({
    provider: 'google',
    options: { skipBrowserRedirect: true },
  });
  assert.ok([...jar.keys()].some((key) => key.includes('code-verifier')));
  const response = await completeAuth(callback('code=valid-code'), async () => factory());
  assert.equal(response.headers.get('location'), '/');
  assert.equal(exchanges, 1);
  assert.ok([...jar].some(([key, value]) => !key.includes('code-verifier') && value));
  const { data } = await factory().auth.getSession();
  assert.equal(data.session?.user.id, 'test-user');
});
