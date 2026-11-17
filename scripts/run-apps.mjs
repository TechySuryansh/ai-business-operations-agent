import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const mode = process.argv[2];
if (!['dev', 'start'].includes(mode)) throw new Error('Expected dev or start');
const render = mode === 'start' && process.argv.includes('--render-free');
if (render) process.env.APP_URL ||= process.env.RENDER_EXTERNAL_URL ?? '';
const backendUrl = 'http://127.0.0.1:3001';
const startScript = fileURLToPath(new URL('./start-service.mjs', import.meta.url));
const children = ['frontend', 'backend'].map((app) => {
  if (!render)
    return spawn('npm', ['run', mode, '--workspace', `@nexus/${app}`], { stdio: 'inherit' });
  const env = { ...process.env };
  if (app === 'backend') {
    env.PORT = '3001';
    env.BIND_HOST = '127.0.0.1';
  }
  return spawn(process.execPath, [startScript, app], { env, stdio: 'inherit' });
});

let job;
let timer;
if (render) {
  const jobScript = fileURLToPath(new URL('../backend/scripts/run-jobs.mjs', import.meta.url));
  timer = setInterval(() => {
    if (job) return;
    job = spawn(process.execPath, [jobScript], {
      env: { ...process.env, BACKEND_URL: backendUrl },
      stdio: 'inherit',
    });
    job.on('error', () => console.error('Unable to start the job runner.'));
    job.on('close', () => {
      job = undefined;
    });
  }, 60_000);
}

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  clearInterval(timer);
  job?.kill('SIGTERM');
  for (const child of children) child.kill('SIGTERM');
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error);
    stop(1);
  });
  child.on('exit', (code, signal) => stop(code ?? (signal ? 1 : 0)));
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
