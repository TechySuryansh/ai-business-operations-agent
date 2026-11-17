import { spawn } from 'node:child_process';
import { existsSync, openSync, closeSync, unlinkSync, linkSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { loadBackendEnv, required } from './env.mjs';
import { restoreTarget, verifyLedger } from './integrity.mjs';
loadBackendEnv();
function toolEnv(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('PostgreSQL URL required.');
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGCONNECT_TIMEOUT: '10',
  };
  const options = {
    sslmode: 'PGSSLMODE',
    sslrootcert: 'PGSSLROOTCERT',
    sslcert: 'PGSSLCERT',
    sslkey: 'PGSSLKEY',
    connect_timeout: 'PGCONNECT_TIMEOUT',
    channel_binding: 'PGCHANNELBINDING',
    options: 'PGOPTIONS',
  };
  for (const [name, value] of url.searchParams) {
    if (options[name]) env[options[name]] = value;
    else if (!['schema', 'pgbouncer', 'connection_limit', 'pool_timeout'].includes(name))
      throw new Error('Unsupported PostgreSQL URL option for backup tools.');
  }
  if (env.PGSSLMODE === 'disable' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Remote backups require TLS.');
  if (!env.PGSSLMODE && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    env.PGSSLMODE = 'verify-full';
  return env;
}
function run(binary, args, connection) {
  return new Promise((done, fail) => {
    const child = spawn(binary, args, {
      env: toolEnv(connection),
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.on('error', () =>
      fail(
        new Error(
          'PostgreSQL client executable is unavailable. Install pg_dump/pg_restore matching your server version.',
        ),
      ),
    );
    child.on('exit', (code) =>
      code === 0
        ? done()
        : fail(
            new Error(
              'PostgreSQL backup/restore failed. Check client version, TLS, connectivity and permissions.',
            ),
          ),
    );
  });
}
try {
  const mode = process.argv[2];
  const file = process.argv[3];
  if (!file || !['backup', 'restore-check'].includes(mode))
    throw new Error('Provide backup or restore-check followed by a .dump file path.');
  const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
  const source = process.env.DIRECT_URL || required('DATABASE_URL');
  if (mode === 'backup') {
    if (existsSync(path)) throw new Error('Backup destination already exists. Choose a new file.');
    const partial = path + '.' + crypto.randomUUID() + '.partial';
    closeSync(openSync(partial, 'wx', 0o600));
    try {
      await run(
        process.env.PG_DUMP_BIN || 'pg_dump',
        ['--format=custom', '--schema=erp', '--no-owner', '--no-acl', '--file', partial],
        source,
      );
      if (!statSync(partial).size) throw new Error('Backup was empty.');
      linkSync(partial, path);
      console.log(
        'ERP backup saved with restricted local permissions. Upload it to encrypted backup storage and verify a restore. Supabase Auth is backed up separately.',
      );
    } finally {
      if (existsSync(partial)) unlinkSync(partial);
    }
  } else {
    const target = required('RESTORE_DATABASE_URL');
    restoreTarget(source, target);
    if (!existsSync(path)) throw new Error('Backup file not found.');
    const client = new Client({ connectionString: target, connectionTimeoutMillis: 10000 });
    try {
      await client.connect();
      const { rows } = await client.query(
        `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
      );
      if (rows[0].count) throw new Error('Restore target must be an empty disposable database.');
      await run(
        process.env.PG_RESTORE_BIN || 'pg_restore',
        ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', path],
        target,
      );
      const result = await verifyLedger(client);
      console.log(
        JSON.stringify({ event: 'restore_verified', ...result, applicationLoginVerified: false }),
      );
    } finally {
      await client.end();
    }
  }
} catch (error) {
  // A database driver may include connection details in its error. Only our own tool messages are printed.
  const safe = [
    'Backup ',
    'PostgreSQL ',
    'Restore ',
    'ERP ',
    'Provide ',
    'Unsupported ',
    'Remote ',
    'Restored ',
    'RESTORE_DATABASE_URL',
  ];
  console.error(
    safe.some((prefix) => error.message?.startsWith(prefix))
      ? error.message
      : 'Database operation failed; credentials were not logged.',
  );
  process.exitCode = 1;
}
