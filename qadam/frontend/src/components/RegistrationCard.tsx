import { Link } from "react-router-dom";
import { CalendarDays, MapPin } from "lucide-react";
import ProjectStatusBadge from "./ProjectStatusBadge";
import RegistrationStatusBadge from "./RegistrationStatusBadge";
import type { RegistrationSummary } from "@/types/registration";
import { formatDate, formatDateRange } from "@/lib/utils";

/**
 * Card for one of the volunteer's registrations (frontend-routes.md
 * "RegistrationCard"). Shows both the registration status (did I sign up?)
 * and the project status (is it still running?), with an optional cancel
 * action handled by the parent page.
 */
export default function RegistrationCard({
  registration,
  onCancel,
  busy = false,
}: {
  registration: RegistrationSummary;
  onCancel?: (registration: RegistrationSummary) => void;
  busy?: boolean;
}) {
  // Cancel is only available when the project is still open for action —
  // a confirmed registration on a completed/cancelled project is read-only.
  const projectOpen =
    registration.project_status === "upcoming" || registration.project_status === "active";
  const cancellable = onCancel !== undefined && registration.status === "confirmed" && projectOpen;

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/projects/${registration.project_id}`}
          className="font-semibold leading-snug hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {registration.project_title}
        </Link>
        <div className="flex shrink-0 gap-1.5">
          <ProjectStatusBadge status={registration.project_status} />
          <RegistrationStatusBadge status={registration.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDateRange(registration.project_start_date, registration.project_end_date)}
        </span>
        {registration.project_location_name && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {registration.project_location_name}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Registered on {formatDate(registration.registered_at)}
        </p>
        {cancellable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel?.(registration)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}
