import type { EmailOtpType } from '@supabase/supabase-js';

type CallbackClient = {
  auth: {
    exchangeCodeForSession(code: string): Promise<{ error: unknown }>;
    verifyOtp(input: { token_hash: string; type: EmailOtpType }): Promise<{ error: unknown }>;
  };
};

export async function completeAuth(request: Request, createClient: () => Promise<CallbackClient>) {
  const url = new URL(request.url);
  // Fixed paths only: ignore user-supplied next/redirect URLs and forwarded-host headers.
  function redirect(path: string) {
    // Relative Location preserves the browser's exact origin, including localhost aliases.
    return new Response(null, {
      status: 307,
      headers: { Location: path, 'Cache-Control': 'private, no-store' },
    });
  }
  if (url.searchParams.has('error') || url.searchParams.has('error_code')) {
    const cancelled = url.searchParams.get('error') === 'access_denied';
    return redirect(cancelled ? '/login?error=oauth_cancelled' : '/login?error=oauth');
  }
  const code = url.searchParams.get('code');
  try {
    if (code) {
      const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
      return redirect(error ? '/login?error=oauth' : '/');
    }
    const token_hash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    if (token_hash && ['signup', 'recovery', 'email', 'invite'].includes(type ?? '')) {
      const { error } = await (
        await createClient()
      ).auth.verifyOtp({ token_hash, type: type as EmailOtpType });
      if (!error) return redirect(type === 'recovery' ? '/login?reset=1' : '/');
    }
  } catch {
    // Never echo or log provider responses, authorization codes, or tokens.
    return redirect(code ? '/login?error=oauth' : '/login?error=confirmation');
  }
  return redirect('/login?error=confirmation');
}
