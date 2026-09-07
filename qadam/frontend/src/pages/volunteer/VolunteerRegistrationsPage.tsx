import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RegistrationCard from "@/components/RegistrationCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { cancelRegistration, listRegistrations } from "@/lib/registrations";
import type { RegistrationSummary } from "@/types/registration";

/**
 * frontend-routes.md "/volunteer/registrations" - every registration with its
 * status, plus cancel for confirmed ones. The volunteer sees both their own
 * cancellations and ones the NGO/project lifecycle caused (e.g. the project
 * was cancelled), each distinguishable via the two status badges.
 */
export default function VolunteerRegistrationsPage() {
  const { api, apiList } = useApi();

  const [registrations, setRegistrations] = useState<RegistrationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listRegistrations(apiList, { limit: 100 })
      .then((result) => setRegistrations(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load registrations"));
  }, [apiList]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(registration: RegistrationSummary) {
    if (
      !window.confirm(
        `Cancel your registration for "${registration.project_title}"? You can register again later if it is still open.`
      )
    ) {
      return;
    }
    setPendingId(registration.id);
    setActionError(null);
    try {
      await cancelRegistration(api, registration.id);
      load(); // refetch so statuses stay truthful
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancellation failed. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="qadam-page space-y-8">
      <div>
        <h1 className="qadam-section-title">My registrations</h1>
        <p className="qadam-section-sub mt-1.5">
          Every project you have signed up for, with its current status.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && registrations === null && (
        <LoadingState label="Loading your registrations..." />
      )}

      {!error && registrations !== null && (
        <>
          {actionError && (
            <p
              className="qadam-card border-red-100 bg-red-50/50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {actionError}
            </p>
          )}
          {registrations.length === 0 ? (
            <EmptyState
              title="No registrations yet"
              description="Once you register for a project it will show up here with its status."
              action={
                <Link to="/projects" className="qadam-btn-primary">
                  Browse opportunities
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {registrations.map((registration) => (
                <RegistrationCard
                  key={registration.id}
                  registration={registration}
                  onCancel={handleCancel}
                  busy={pendingId === registration.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
