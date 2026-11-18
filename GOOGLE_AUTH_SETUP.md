# Google sign-in setup

The app now offers **Continue with Google** in both login and signup modes at `/login`. It uses the existing Supabase browser client and `/auth/confirm` callback, which exchanges the PKCE code through the existing cookie-backed server client. Success returns to `/`, including company selection/onboarding for new users. Email/password, confirmation and recovery remain available.

## Copy-paste configuration checklist

### Google Cloud

- [ ] Open [Google Cloud Console](https://console.cloud.google.com/), select/create the intended project and configure Google Auth Platform branding, audience and consent settings. If the app is in Testing, add the Google accounts you will use as test users.
- [ ] Create an OAuth client with application type **Web application**.
- [ ] In **Authorized redirect URIs**, enter exactly:

```text
https://jpcsgsydarvjtfarqqqa.supabase.co/auth/v1/callback
```

This is the **Supabase callback**, including when running this app locally against the hosted Supabase project. Do not put the frontend callback here. The Supabase Google provider page displays the authoritative callback URL.

- [ ] If configuring **Authorized JavaScript origins**, use your frontend origins without a path:

```text
http://127.0.0.1:3000
http://localhost:3000
https://YOUR_PRODUCTION_FRONTEND_DOMAIN
```

`YOUR_PRODUCTION_FRONTEND_DOMAIN` is a placeholder: the production frontend domain has not been established in this repository.

- [ ] Copy the Google OAuth **Client ID** and **Client secret** into Supabase's Google provider settings below. Do not add the Google secret to this repository, frontend environment variables, logs or chat.

### Supabase

- [ ] Open [your project's Authentication settings](https://supabase.com/dashboard/project/jpcsgsydarvjtfarqqqa/auth/providers). Under **Sign In / Providers** (or **Providers**), open **Google**, enable it, enter the Google Client ID and Client secret, and save.
- [ ] Under **Authentication → URL Configuration → Redirect URLs**, add these exact **app callback URLs**:

```text
http://127.0.0.1:3000/auth/confirm
http://localhost:3000/auth/confirm
https://YOUR_PRODUCTION_FRONTEND_DOMAIN/auth/confirm
```

Replace the production placeholder before adding it. These callbacks belong to the **frontend**, never port 3001 or `BACKEND_URL`. Start and finish login using the same hostname so the PKCE verifier cookie is available.

- [ ] Set **Site URL** to your deployed frontend origin for production. During local-only setup, use `http://127.0.0.1:3000`. The existing email confirmation/recovery templates use Site URL too.
- [ ] Keep the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no extra frontend credentials are needed. Rebuild deployed frontend code after changing public environment settings.

Based on the [official Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [server-side auth guidance](https://supabase.com/docs/guides/auth/server-side/nextjs).

## Local verification

1. Enable/configure the Google provider and local redirect URL above. Run `npm run dev` from the repository root.
2. Open `http://127.0.0.1:3000/login`. Click **Continue with Google**; confirm its loading state. Complete Google's consent flow with an allowed test account.
3. Confirm the browser returns through `/auth/confirm` to `/`. A new user may need to create a company. Refresh the page and confirm the session remains signed in and company records load through the backend.
4. Sign out using the app, then test Google from **Create account** mode as well.
5. Cancel/deny Google consent. Confirm an explanatory error appears and Google/email sign-in remain usable. Returning with the browser Back button should also release the loading state.
6. Test a callback without a code and an invalid/expired code; these should return to login with an error. Callback query parameters such as `next=https://example.com` are ignored: successful login always returns to this app's `/`.
7. Sign out and sign in with an existing **email/password account**. Refresh and confirm that session survives too. Verify email signup/confirmation and password recovery still work with the existing templates.
8. Repeat against the production frontend after adding its exact callback to the allowlist and completing Google consent/publication requirements.

Automated tests exercise provider invocation, loading/failure/cancellation feedback, existing email form requests, safe callback destinations, OTP confirmation/recovery, and PKCE session cookie serialization/readback with a mocked token endpoint. These tests do not prove real Google consent, hosted callback configuration or browser refresh against the live provider. A real Google login requires your Google Cloud credentials and enabled Supabase provider.
