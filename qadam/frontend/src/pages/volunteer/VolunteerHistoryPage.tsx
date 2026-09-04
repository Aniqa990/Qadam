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
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">My history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The last events you attended and completed. Hours are verified from your
          QR check-in and check-out.
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
                <Link
                  to="/volunteer/scan"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  Scan an attendance QR
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {history.map((item) => (
                <li key={item.id}>
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
