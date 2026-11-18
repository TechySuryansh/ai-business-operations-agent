# Hosted setup and launch

## Current status

This branch configures a free Render web service for the frontend and backend. The backend listens on loopback, and the frontend serves both the UI and the proxied API. Supabase hosts PostgreSQL and Auth.

### Free-tier deployment

1. Configure the Supabase variables in `render.yaml` during Blueprint setup. Use the restricted runtime database URL for `DATABASE_URL`.
2. Run `npm run db:migrate` from a secure environment with the administrative `DIRECT_URL` before each release that adds migrations. Keep the administrative connection local.
3. Deploy the Blueprint. The service uses Render's assigned URL as `APP_URL` by default. If you configure a custom domain as the public origin, set `APP_URL` explicitly.
4. Set that origin in Supabase Auth, then verify `/health`, `/api/health`, email delivery, and sign-in. Render generates `CRON_SECRET` for the bundled job runner. The runner starts after one minute and checks queued jobs every minute while the instance is awake. Check Render logs for `job_runner`.

The service can sleep during idle periods, delaying job retries until the next wake. Free Render hours, bandwidth and build minutes are shared with the workspace's other services. Review the workspace usage and billing settings before deploying. Sections 4 and 5 also describe the separate services and managed scheduler used by the paid deployment.

## 1. Connect Supabase and hosting

Connect Supabase and Render in Codex to let the assistant continue account-specific setup. The free-tier Blueprint uses one Singapore web service with automatic deployment turned off. Other Node hosts can use the same start commands and health endpoints.

## 2. Configure Supabase and environment files

Create/select the intended Supabase project. Keep the `erp` schema out of the public Data API. Use a restricted runtime SQL role for `DATABASE_URL`, and an administrative migration connection for `DIRECT_URL`.

```sh
npm run setup:env
```

This command preserves existing `.env` files and does not print generated secrets. Fill in `frontend/.env` and `backend/.env` using their adjacent `.env.example` files. Both apps must use the same Supabase project and publishable key. Local `APP_URL` is `http://127.0.0.1:3000`; use this exact hostname in the browser.

```sh
npm run setup:check
npm run db:migrate
npm run setup:check -- --online
```

The first check validates configuration without network access. The online check verifies database migration presence and Supabase email auth. Neither check prints credentials. Missing credentials cause an explicit failed check, not a success.

## 3. Configure signup and password reset

The ready-to-use templates are under `backend/supabase/templates/`. Configure the project's Site URL and redirect allowlist for the frontend origin.

```sh
npm run auth:configure
```

This previews the target project and settings. To apply them using a Supabase management access token supplied securely in the process environment:

```sh
npm run auth:configure -- --apply
```

The command requires `SUPABASE_ACCESS_TOKEN`. It enables email confirmation, sets the 12-character minimum password, installs the signup/recovery templates and preserves existing redirect allowlist entries. It does not change unrelated auth providers or create users.

SMTP can be configured in the Supabase dashboard, or by supplying all of `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, and `SMTP_FROM_NAME` before running the apply command. Existing SMTP settings are preserved when these values are omitted. Keep management tokens and SMTP credentials out of frontend settings and hosting build variables. Verify your sending domain and actual email delivery before launch.

## 4. Deploy both services

Review and push the intended release to your repository before creating a Render Blueprint from `render.yaml`. For the free service, use the steps above. The remaining service layout in this section applies to a paid deployment with separate frontend and backend services.

The backend build generates Prisma Client, and its pre-deploy command applies reviewed migrations. The frontend connects to the backend through Render's private network using `BACKEND_INTERNAL_HOST`. Render also shares the generated backend cron secret with the job service; do not copy your local secret into source control.

During Blueprint setup enter the requested database and Supabase variables. Set backend `APP_URL` to the exact planned public frontend origin; update it to the assigned URL/custom domain if necessary. Configure that same origin in Supabase Auth. The frontend public Supabase variables are required at build time. Rebuild after changing them or the backend destination.

Start commands honor the host's `PORT` and bind to `0.0.0.0`:

```sh
npm run start --workspace @nexus/backend
npm run start --workspace @nexus/frontend
```

The default local ports remain 3001 and 3000. Both services must be deployed from the repository root with the root lockfile. Migrations run only on the backend. Avoid concurrent releases/migration jobs.

## 5. Scheduling and monitoring

On paid hosting, a managed cron job can run `node backend/scripts/run-jobs.mjs` every minute. The free service runs the same command while awake. It calls the backend job endpoint using the generated bearer secret, refuses redirects and exits unsuccessfully for HTTP failures or failed/retrying jobs. The runner also queues daily and weekly review drafts configured in Automations. Daily runs become eligible at 9:00 AM company time, and weekly runs become eligible at 9:00 AM on Mondays. Email delivery requires a separate integration.

For a local/manual scheduler check:

```sh
npm run jobs:run
```

Use `/health` on each service for process liveness. Backend `/api/health` checks backend configuration, database access and the migrated Company table. The frontend proxies `/api/health` to that backend check. All health responses disable caching and disclose no database details. Readiness failures return HTTP 503.

Configure your monitoring account to check the public frontend `/health` and `/api/health` every minute and alert after repeated failures. Subscribe to hosting deploy failures and failed cron runs, and route `backend_error` logs by their opaque request ID to your monitoring provider. Alert contacts and external uptime monitoring require your connected account; they have not been created automatically.

## 6. Backups and restore drills

Enable managed Supabase backups/PITR with a retention period appropriate to the business. This repository's export is a **supplemental ERP-schema archive**, not a replacement for full managed database/Auth recovery. It excludes Supabase Auth, global roles/grants and Prisma migration history outside `erp`.

Install PostgreSQL `pg_dump` and `pg_restore` matching your hosted server's major version, or set `PG_DUMP_BIN` and `PG_RESTORE_BIN` to their paths. Do not weaken TLS verification. Create a private backup folder outside source control:

```sh
mkdir -p backups
npm run db:backup -- backups/erp-release.dump
```

Backup credentials stay out of command-line arguments and output. Archives use private local permissions, existing archives are not overwritten, and failed partial files are removed. Upload successful backups to encrypted storage with a configured retention policy. The command alone does not provide durable off-machine backup or automatic retention.

Create an **empty, disposable PostgreSQL database** whose name starts with `nexus_restore_`. Supply its connection through `RESTORE_DATABASE_URL`, then run:

```sh
npm run db:restore-check -- backups/erp-release.dump
```

The script refuses the source database, unexpected target names and nonempty databases; it never drops or cleans a target. It restores transactionally and checks all 17 ERP tables, financial totals, payments, stock, memberships and validated constraints. It leaves the disposable database available for inspection. Credentials are not logged. Use a separate application instance and matching test Auth users to verify access after restoration. Restoring a supplemental schema archive is not proof that a full hosted backup restores correctly; verify the provider-managed backup separately before launch. Prisma migration history must be reconciled against the actual archive's schema before redeploying a supplemental restore.

## 7. Verify real users and auth

Create dedicated test users through the application's signup flow, confirm their delivered email, and complete company onboarding. Use Settings to assign manager/staff memberships. Keep test passwords in process environment variables or a secret manager.

Provide `E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD`, `E2E_MANAGER_EMAIL`/`E2E_MANAGER_PASSWORD`, and `E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD`. With `APP_URL` set to the deployed frontend:

```sh
npm run test:live
```

This read-only check verifies frontend/backend health, anonymous API denial, login, forwarded session cookies and company access for each role. It does not create business records. It signs out its own session afterward. Local PostgreSQL integration tests separately verify denied business writes and tenant isolation.

Before declaring launch complete, verify in a browser: signup confirmation, invalid/expired confirmation, password recovery and reset, old-password rejection after reset, sign-out, refresh after access-token expiry, revoked-session rejection, owner/manager/staff action permissions, and access from a second user in another company. These checks remain pending until a real Supabase project, SMTP and hosted release are configured.

## Local release verification

```sh
npm run typecheck
npm test
npm run test:ops
npm run db:validate
npm run test:backend
npm run build
```

The CI workflow runs these checks after pushing. It has read-only repository permissions and does not deploy or provision infrastructure.

## Provider references

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render cron jobs](https://render.com/docs/cronjobs)
- [Supabase auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
- [PostgreSQL backup format documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
