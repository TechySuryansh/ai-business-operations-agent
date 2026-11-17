import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const app = process.argv[2];
if (!['frontend', 'backend'].includes(app)) throw new Error('Expected frontend or backend');
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)),
    'start',
    '--hostname',
    process.env.BIND_HOST ?? '0.0.0.0',
    '--port',
    process.env.PORT ?? (app === 'frontend' ? '3000' : '3001'),
  ],
  { cwd: fileURLToPath(new URL(`../${app}`, import.meta.url)), stdio: 'inherit' },
);
child.on('error', () => {
  console.error('Unable to start application.');
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGTERM' ? 0 : 1);
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
