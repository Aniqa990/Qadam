import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronDown, Clock, MapPin } from "lucide-react";
import type { AttendanceHistoryItem } from "@/types/attendance";
import { cn, formatDate, formatDateTime, formatHours } from "@/lib/utils";

/**
 * Card for one completed event in the volunteer's history (frontend-routes.md
 * "/volunteer/history"). Collapsed it shows enough to identify the event;
 * clicking expands the session details including the volunteer's verified
 * hours. Read-only - the history view never modifies attendance data.
 */
export default function AttendanceHistoryCard({ item }: { item: AttendanceHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `history-details-${item.id}`;

  return (
    <article className="rounded-lg border bg-background">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="flex w-full items-center justify-between gap-3 rounded-lg p-4 text-left transition-colors hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{item.project_title}</p>
          <p className="text-xs text-muted-foreground">
            {item.event_name ?? "Volunteer session"} · {formatDate(item.event_date)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.ngo_name && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                {item.ngo_name}
              </span>
            )}
            {item.location_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {item.location_name}
              </span>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatHours(item.hours)}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div id={detailsId} className="border-t px-4 py-3 text-sm">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Checked in</dt>
              <dd>{formatDateTime(item.check_in)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Checked out</dt>
              <dd>{formatDateTime(item.check_out)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Event date</dt>
              <dd>{formatDate(item.event_date)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Hours contributed</dt>
              <dd className="font-semibold text-emerald-700">{formatHours(item.hours)}</dd>
            </div>
          </dl>
          <Link
            to={`/projects/${item.project_id}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
          >
            View project
          </Link>
        </div>
      )}
    </article>
  );
}
