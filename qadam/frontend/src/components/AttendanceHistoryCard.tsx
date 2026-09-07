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
    <article className="qadam-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-emerald-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
      >
        <div className="min-w-0">
          <p className="font-semibold leading-snug tracking-tight text-slate-900">
            {item.project_title}
          </p>
          <p className="text-xs text-slate-500">
            {item.event_name ?? "Volunteer session"} · {formatDate(item.event_date)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {item.ngo_name && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                {item.ngo_name}
              </span>
            )}
            {item.location_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                {item.location_name}
              </span>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="qadam-chip">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatHours(item.hours)}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div id={detailsId} className="border-t border-slate-100 px-4 py-4 text-sm">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Checked in</dt>
              <dd className="mt-0.5 text-slate-800">{formatDateTime(item.check_in)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Checked out</dt>
              <dd className="mt-0.5 text-slate-800">{formatDateTime(item.check_out)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Event date</dt>
              <dd className="mt-0.5 text-slate-800">{formatDate(item.event_date)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Hours contributed</dt>
              <dd className="mt-0.5 font-semibold text-emerald-700">{formatHours(item.hours)}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              to={`/projects/${item.project_id}`}
              className="qadam-btn-ghost text-sm text-emerald-700"
            >
              View project
            </Link>
            <button
              type="button"
              onClick={handleGenerateCertificate}
              disabled={certLoading}
              className="qadam-btn-secondary"
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
            <p className="mt-2 text-xs text-red-600" role="alert">
              {certError}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
