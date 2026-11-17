import { redirect } from 'next/navigation';
import { authConfigured, supabaseServer } from '@/lib/supabase/server';
import { CompanyGate } from '@/components/company-gate';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!authConfigured())
    return (
      <main className="auth-page">
        <section className="panel auth-panel">
          <h1>Your backend is ready to configure</h1>
          <p>
            Add your Supabase settings and database connection using BACKEND_SETUP.md, then run the
            migrations.
          </p>
          <p>Live records are separate from the fictional demo.</p>
          <a href="/demo">Open demo workspace</a>
        </section>
      </main>
    );
  const {
    data: { user },
  } = await (await supabaseServer()).auth.getUser();
  if (!user) redirect('/login');
  return <CompanyGate />;
}
