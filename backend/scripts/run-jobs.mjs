import { loadBackendEnv, required } from './env.mjs';
loadBackendEnv();
try {
  const base =
    process.env.BACKEND_URL ??
    (process.env.BACKEND_INTERNAL_HOST
      ? `http://${process.env.BACKEND_INTERNAL_HOST}`
      : 'http://127.0.0.1:3001');
  const url = new URL('/api/jobs/run', base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid backend URL.');
  const secret = required('CRON_SECRET');
  if (secret.length < 32) throw new Error('CRON_SECRET must contain at least 32 characters.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    redirect: 'error',
    signal: AbortSignal.timeout(55000),
  });
  if (!response.ok) throw new Error(`Job runner returned HTTP ${response.status}.`);
  const result = await response.json();
  const results = Array.isArray(result.results) ? result.results : [];
  console.log(
    JSON.stringify({
      event: 'job_runner',
      processed: results.filter((r) => r.status === 'processed').length,
      retryOrFailed: results.filter((r) => r.status === 'retry-or-failed').length,
    }),
  );
  if (results.some((r) => r.status === 'retry-or-failed')) process.exitCode = 1;
} catch {
  console.error(
    JSON.stringify({
      event: 'job_runner_failed',
      message: 'Check backend availability and scheduler configuration.',
    }),
  );
  process.exitCode = 1;
}
