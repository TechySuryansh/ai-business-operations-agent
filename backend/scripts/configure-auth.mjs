import { readFileSync } from 'node:fs';
import { loadBackendEnv, required, origin } from './env.mjs';
loadBackendEnv();
try {
  const site = origin(required('APP_URL'), 'APP_URL');
  const supabase = new URL(required('SUPABASE_URL'));
  const match = supabase.hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
  if (!match) throw new Error('A hosted Supabase project URL is required.');
  const payload = {
    site_url: site,
    mailer_autoconfirm: false,
    password_min_length: 12,
    mailer_subjects_confirmation: 'Confirm your Nexus account',
    mailer_subjects_recovery: 'Reset your Nexus password',
    mailer_templates_confirmation_content: readFileSync(
      new URL('../supabase/templates/confirmation.html', import.meta.url),
      'utf8',
    ),
    mailer_templates_recovery_content: readFileSync(
      new URL('../supabase/templates/recovery.html', import.meta.url),
      'utf8',
    ),
  };
  const smtp = {
    smtp_host: 'SMTP_HOST',
    smtp_port: 'SMTP_PORT',
    smtp_user: 'SMTP_USER',
    smtp_pass: 'SMTP_PASSWORD',
    smtp_admin_email: 'SMTP_FROM_EMAIL',
    smtp_sender_name: 'SMTP_FROM_NAME',
  };
  if (Object.values(smtp).some((name) => process.env[name])) {
    for (const [field, name] of Object.entries(smtp)) payload[field] = required(name);
  }
  console.log(
    JSON.stringify(
      {
        project: match[1],
        site,
        changes: Object.keys(payload),
        redirect: site + '/auth/confirm',
        smtpConfigured: Boolean(payload.smtp_host),
        applied: false,
      },
      null,
      2,
    ),
  );
  if (process.argv.includes('--apply')) {
    const token = required('SUPABASE_ACCESS_TOKEN');
    const url = `https://api.supabase.com/v1/projects/${match[1]}/config/auth`;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const before = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!before.ok) throw new Error('Unable to read Supabase Auth settings.');
    const existing = await before.json();
    payload.uri_allow_list = [
      ...new Set([
        ...(existing.uri_allow_list ?? '').split(',').filter(Boolean),
        site + '/auth/confirm',
      ]),
    ].join(',');
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Supabase rejected the auth configuration.');
    console.log(
      'Applied signup/recovery templates, site URL, confirmation requirement and password length. Existing redirects were preserved.',
    );
    if (!payload.smtp_host)
      console.log('SMTP delivery still needs configuration and verification in Supabase.');
  } else
    console.log(
      'Preview only. Use --apply with SUPABASE_ACCESS_TOKEN after reviewing the target project.',
    );
} catch (error) {
  // Do not print remote error bodies or credentials.
  console.error(error instanceof TypeError ? 'Unable to reach Supabase.' : error.message);
  process.exitCode = 1;
}
