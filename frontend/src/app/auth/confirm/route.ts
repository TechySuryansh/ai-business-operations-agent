import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (token_hash && ['signup', 'recovery', 'email', 'invite'].includes(type ?? '')) {
    const { error } = await (
      await supabaseServer()
    ).auth.verifyOtp({ token_hash, type: type as EmailOtpType });
    if (!error)
      return NextResponse.redirect(
        new URL(type === 'recovery' ? '/login?reset=1' : '/', url.origin),
      );
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', url.origin));
}
