import { createServerClient } from '@supabase/ssr';
import { loadBackendEnv, required, origin } from './env.mjs';
loadBackendEnv();
try {
  const app = origin(required('APP_URL'), 'APP_URL');
  for (const path of ['/health', '/api/health']) {
    const response = await fetch(app + path, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Health check failed.');
    console.log(`OK: ${path}`);
  }
  const anonymous = await fetch(app + '/api/backend/companies', {
    signal: AbortSignal.timeout(15000),
  });
  if (anonymous.status !== 401) throw new Error('Anonymous API access was not rejected.');
  console.log('OK: anonymous API requests are denied');
  for (const role of ['owner', 'manager', 'staff']) {
    const prefix = `E2E_${role.toUpperCase()}`;
    const email = required(prefix + '_EMAIL'),
      password = required(prefix + '_PASSWORD');
    const jar = new Map();
    const client = createServerClient(
      required('SUPABASE_URL'),
      required('SUPABASE_PUBLISHABLE_KEY'),
      {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
        },
        auth: { autoRefreshToken: false },
      },
    );
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.user) throw new Error('Test account login failed.');
    try {
      const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
      const response = await fetch(app + '/api/backend/companies', {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Signed-in API request failed.');
      const companies = await response.json();
      const membership = companies.find((entry) => entry.role === role);
      if (!membership) throw new Error('Test account has no expected company role.');
      const snapshot = await fetch(app + `/api/backend/${membership.companyId}/snapshot`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(15000),
      });
      if (!snapshot.ok) throw new Error('Company-scoped API request failed.');
      console.log(`OK: ${role} sign-in, forwarded session and company access`);
    } finally {
      await client.auth.signOut({ scope: 'local' });
    }
  }
  console.log(
    'Read-only live checks passed. Verify email confirmation/recovery and browser session refresh separately.',
  );
} catch {
  console.error(
    'Live verification failed. Check deployed health, Auth settings and dedicated E2E owner/manager/staff credentials; no credentials were logged.',
  );
  process.exitCode = 1;
}
