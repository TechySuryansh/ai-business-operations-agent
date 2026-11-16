'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <section className="panel">
        <h1>This view could not be loaded.</h1>
        <p>
          Your saved local data is still on this device. Retry the view, or reload the workspace.
        </p>
        <div className="dialog-actions">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload workspace
          </Button>
        </div>
      </section>
    </main>
  );
}
