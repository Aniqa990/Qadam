import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cancelRegistration, registerForProject } from "@/lib/registrations";
import type { ProjectDetail } from "@/types/project";
import type { RegistrationSummary } from "@/types/registration";
import { formatDate } from "@/lib/utils";

/**
 * Volunteer-facing registration panel for the project detail page
 * (frontend-routes.md "RegistrationButton"). All gating states mirror the
 * backend's guard chain: the server re-validates everything - the disabled
 * buttons here are UX, not the enforcement.
 */
export default function ProjectRegistrationPanel({
  project,
  registration,
  onChanged,
}: {
  project: ProjectDetail;
  registration: RegistrationSummary | null;
  /** Refetches project + registration after a successful action. */
  onChanged: () => void;
}) {
  const { api } = useApi();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const projectOpen = project.status === "published" || project.status === "active";
  const atCapacity = project.registered_count >= project.capacity;
  const confirmed = registration?.status === "confirmed";

  async function handleRegister() {
    setBusy(true);
    setActionError(null);
    try {
      await registerForProject(api, project.id);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!registration) return;
    if (
      !window.confirm(
        "Cancel your registration for this project? You can register again later if it's still open."
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await cancelRegistration(api, registration.id);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancellation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Registration">
      {confirmed ? (
        <>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            You're registered
          </p>
          <p className="text-xs text-muted-foreground">
            Registered on {formatDate(registration?.registered_at)}. The organizer will see you on
            the volunteer list.
          </p>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cancel registration
          </button>
        </>
      ) : registration?.status === "cancelled" ? (
        <>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            Your registration was cancelled
          </p>
          {projectOpen && !atCapacity ? (
            <button
              type="button"
              onClick={handleRegister}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Register again
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {!projectOpen
                ? "This project is no longer open for registration."
                : "This project is currently at capacity."}
            </p>
          )}
        </>
      ) : !projectOpen ? (
        <p className="text-sm text-muted-foreground">
          This project is <strong>{project.status}</strong> and no longer accepts registrations.
        </p>
      ) : atCapacity ? (
        <>
          <p className="text-sm font-medium">This project is at capacity</p>
          <p className="text-xs text-muted-foreground">
            All {project.capacity} volunteer spots are taken.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">
            {project.capacity - project.registered_count} of {project.capacity} spots left
          </p>
          <button
            type="button"
            onClick={handleRegister}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Register for this project
          </button>
        </>
      )}

      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
