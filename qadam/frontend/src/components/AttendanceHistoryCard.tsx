import { useState } from "react";
import { Link } from "react-router-dom";
import { Award, Building2, ChevronDown, Clock, Loader2, MapPin } from "lucide-react";
import type { AttendanceHistoryItem } from "@/types/attendance";
import { useApi } from "@/hooks/useApi";
import {
  downloadAttendanceCertificate,
  triggerBrowserDownload,
} from "@/lib/attendance";
import { cn, formatDate, formatDateTime, formatHours } from "@/lib/utils";

/**
 * Card for one completed event in the volunteer's history (frontend-routes.md
 * "/volunteer/history"). Collapsed it shows enough to identify the event;
 * clicking expands the session details including the volunteer's verified
 * hours. History entries are already filtered to finished events with
 * check-out, so "Generate certificate" is always eligible here — the server
 * still re-validates before rendering the PDF.
 */
export default function AttendanceHistoryCard({ item }: { item: AttendanceHistoryItem }) {
  const { apiBlob } = useApi();
  const [expanded, setExpanded] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const detailsId = `history-details-${item.id}`;

  async function handleGenerateCertificate() {
    setCertError(null);
    setCertLoading(true);
    try {
      const { blob, filename } = await downloadAttendanceCertificate(apiBlob, item.id);
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : "Failed to generate certificate");
    } finally {
      setCertLoading(false);
    }
  }

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

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              to={`/projects/${item.project_id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
            >
              View project
            </Link>
            <button
              type="button"
              onClick={handleGenerateCertificate}
              disabled={certLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {certLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Award className="h-4 w-4" aria-hidden="true" />
              )}
              {certLoading ? "Generating…" : "Generate certificate"}
            </button>
          </div>

          {certError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {certError}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
