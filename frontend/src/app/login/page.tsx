import { authConfigured } from '@/lib/supabase/server';
import { LoginForm } from '@/components/login-form';
export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <h1>Welcome to Nexus</h1>
        {authConfigured() ? (
          <LoginForm />
        ) : (
          <>
            <p>
              Connect your Supabase project to enable sign-in. Follow BACKEND_SETUP.md and configure
              the variables in .env.example.
            </p>
            <a href="/demo">Open the interactive demo</a>
          </>
        )}
      </section>
    </main>
  );
}
