import { supabaseServer } from '@/lib/supabase/server';
import { completeAuth } from '@/lib/supabase/auth-callback';
export async function GET(request: Request) {
  // Reuse the cookie-backed server client for both PKCE exchange and email OTP.
  return completeAuth(request, supabaseServer);
}
