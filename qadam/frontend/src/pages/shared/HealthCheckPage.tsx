import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type HealthResponse = { status: string; service: string; timestamp: string };

/**
 * Temporary landing page for Phase 1 verification: confirms the frontend
 * can start, render, and reach the backend's /api/health endpoint. Replace
 * with real routing once auth (Phase 2) and onboarding (Phase 3) land.
 */
export default function HealthCheckPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<HealthResponse>("/health")
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold text-primary">Qadam</h1>
      <p className="text-muted-foreground">Scaffolding is up. Backend health check:</p>
      {health && (
        <pre className="rounded-md bg-secondary p-4 text-sm">
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
      {error && <p className="text-destructive">Backend unreachable: {error}</p>}
    </main>
  );
}
