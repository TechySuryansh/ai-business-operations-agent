import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const files = {
  'frontend/.env': `# Add your Supabase project values here.
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
BACKEND_URL=http://127.0.0.1:3001
`,
  'backend/.env': `# Add your Supabase and PostgreSQL values here.
# SUPABASE_URL=
# SUPABASE_PUBLISHABLE_KEY=
# DATABASE_URL=
# DIRECT_URL=
APP_URL=http://127.0.0.1:3000
CRON_SECRET=${randomBytes(32).toString('hex')}
`,
};
for (const [name, content] of Object.entries(files)) {
  try {
    writeFileSync(fileURLToPath(new URL('../' + name, import.meta.url)), content, {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(`Created ${name}; external credentials still need configuration.`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Kept existing ${name}.`);
  }
}
