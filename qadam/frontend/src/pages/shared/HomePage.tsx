import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

type HealthResponse = { status: string; service: string; timestamp: string };

/**
 * frontend-routes.md "/" — full HomePage (featured projects, stats) is
 * Phase 4+ scope. For now this confirms the Phase 1/2 pipeline end-to-end:
 * signed in, role resolved, and the backend reachable with an authed call.
 */
export default function HomePage() {
  const { role, profile } = useAuth();
  const { api } = useApi();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    api<HealthResponse>("/health").then(setHealth).catch(() => {});
  }, [api]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold text-primary">Qadam</h1>
      <p className="text-muted-foreground">
        Signed in as <strong>{role}</strong>
        {profile ? ` — onboarding_complete: ${String(profile.onboarding_complete)}` : ""}
      </p>
      {health && (
        <pre className="rounded-md bg-secondary p-4 text-sm">{JSON.stringify(health, null, 2)}</pre>
      )}
    </main>
  );
}
