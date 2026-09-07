import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QrCode } from "lucide-react";
import AttendanceHistoryCard from "@/components/AttendanceHistoryCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { listAttendanceHistory } from "@/lib/attendance";
import type { AttendanceHistoryItem } from "@/types/attendance";

/**
 * frontend-routes.md "/volunteer/history" - the 10 most recent events the
 * volunteer attended and completed. Entries appear only once an event has
 * finished AND the volunteer checked out, so the hours shown are verified;
 * the view is read-only and never modifies attendance data.
 */
export default function VolunteerHistoryPage() {
  const { api } = useApi();

  const [history, setHistory] = useState<AttendanceHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listAttendanceHistory(api)
      .then((items) => setHistory(items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your history"));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="qadam-page-narrow space-y-8">
      <div>
        <h1 className="qadam-section-title">My history</h1>
        <p className="qadam-section-sub mt-1.5">
          The last events you attended and completed. Hours are verified from your QR check-in and
          check-out.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && history === null && <LoadingState label="Loading your history..." />}

      {!error && history !== null && (
        <>
          {history.length === 0 ? (
            <EmptyState
              title="No completed events yet"
              description="Once you check in and check out at an event, it will appear here with your verified hours."
              action={
                <Link to="/volunteer/scan" className="qadam-btn-primary">
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  Scan an attendance QR
                </Link>
              }
            />
          ) : (
            <ul className="relative space-y-4 before:absolute before:bottom-4 before:left-[1.15rem] before:top-4 before:w-px before:bg-emerald-100">
              {history.map((item) => (
                <li key={item.id} className="relative pl-10">
                  <span
                    className="absolute left-3 top-6 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-50"
                    aria-hidden="true"
                  />
                  <AttendanceHistoryCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
