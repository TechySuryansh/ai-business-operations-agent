import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
export function loadBackendEnv() {
  const path = fileURLToPath(new URL('../.env', import.meta.url));
  if (existsSync(path)) loadEnvFile(path);
}
export function required(name) {
  const value = process.env[name];
  if (!value || /YOUR_|USER:PASSWORD/.test(value)) throw new Error(`${name} is not configured.`);
  return value;
}
export function origin(value, name = 'URL') {
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(`${name} must be an HTTP(S) origin without credentials or a path.`);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error(`${name} must use HTTPS outside localhost.`);
  return url.origin;
}
