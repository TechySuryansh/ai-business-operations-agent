import { authConfigured } from '@/lib/supabase/server';
import { LoginForm } from '@/components/login-form';
import './login.css';

export const metadata = { title: 'Sign in · Nexus' };

export default function LoginPage() {
  return (
    <main className="login-page">
      <header className="login-top">
        <span className="login-brand"><span aria-hidden="true">N</span>Nexus</span>
        <a href="/demo">Explore demo <span aria-hidden="true">↗</span></a>
      </header>
      <div className="login-shell">
        <aside className="login-art" aria-label="Nexus Business Operations">
          <div className="login-grid" aria-hidden="true" />
          <div className="login-orbit" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="login-art-title">Business <br />operations<span>.</span></div>
        </aside>
        <section className="login-panel">
          {authConfigured() ? <LoginForm /> : (
            <><h1>Set up your workspace</h1><p>Configure Supabase using BACKEND_SETUP.md to enable sign-in.</p></>
          )}
        </section>
      </div>
    </main>
  );
}
