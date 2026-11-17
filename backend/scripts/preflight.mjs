import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { loadBackendEnv, required, origin } from './env.mjs';
loadBackendEnv();
const frontendEnv = fileURLToPath(new URL('../../frontend/.env', import.meta.url));
if (existsSync(frontendEnv)) loadEnvFile(frontendEnv);
let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`OK: ${label}`);
  } catch {
    failures++;
    console.error(`MISSING/INVALID: ${label}`);
  }
}
for (const name of ['DATABASE_URL', 'DIRECT_URL'])
  check(name, () => {
    const url = new URL(required(name));
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname === '/'
    )
      throw new Error();
  });
for (const name of ['APP_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'])
  check(name, () => origin(required(name), name));
check('frontend backend destination', () => {
  if (!process.env.BACKEND_URL && process.env.BACKEND_INTERNAL_HOST) return;
  origin(required('BACKEND_URL'), 'BACKEND_URL');
});
for (const name of ['SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])
  check(name, () => {
    const key = required(name);
    if (key.startsWith('sb_publishable_')) return;
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role !== 'anon') throw new Error();
  });
check('frontend and backend use the same Supabase project/key', () => {
  if (
    required('SUPABASE_URL') !== required('NEXT_PUBLIC_SUPABASE_URL') ||
    required('SUPABASE_PUBLISHABLE_KEY') !== required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  )
    throw new Error();
});
check('CRON_SECRET (32+ characters)', () => {
  if (required('CRON_SECRET').length < 32) throw new Error();
});
if (process.argv.includes('--online') && failures === 0) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT to_regclass('erp."Company"') IS NOT NULL AS migrated`,
    );
    if (!rows[0].migrated) throw new Error();
    console.log('OK: database connection and ERP migration');
  } catch {
    failures++;
    console.error('FAILED: database connection or ERP migration (credentials were not logged)');
  } finally {
    await client.end();
  }
  try {
    const response = await fetch(new URL('/auth/v1/settings', process.env.SUPABASE_URL), {
      headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const settings = await response.json();
    if (!settings.external?.email || settings.mailer_autoconfirm) throw new Error();
    console.log('OK: Supabase email auth with confirmation');
  } catch {
    failures++;
    console.error('FAILED: Supabase email auth or publishable key');
  }
}
console.log(
  failures ? `${failures} setup checks still require attention.` : 'Setup checks passed.',
);
process.exitCode = failures ? 1 : 0;
