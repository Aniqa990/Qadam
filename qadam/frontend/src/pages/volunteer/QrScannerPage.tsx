import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, LogIn, LogOut, XCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { checkIn, checkOut, listAttendanceRecords } from "@/lib/attendance";
import type { AttendanceRecord, CheckInResult, CheckOutResult } from "@/types/attendance";
import { parseAttendancePayload } from "@/types/attendance";
import { formatDate, formatDateTime, formatHours } from "@/lib/utils";
import QrScanner from "@/components/QrScanner";

type ScanOutcome =
  | { kind: "checked-in"; result: CheckInResult }
  | { kind: "checked-out"; result: CheckOutResult }
  | { kind: "error"; message: string };

/**
 * /volunteer/scan (frontend-routes.md) - the volunteer-side attendance flow:
 * scan (or paste) the event QR to check in; the SAME scan again checks out.
 * The client only relays the scanned (event_id, token) pair - the backend
 * performs every validation and is the only writer of attendance rows
 * (AGENTS.md "Attendance"). The check-in 409 ALREADY_CHECKED_IN drives the
 * toggle to check-out client-side.
 */
export default function QrScannerPage() {
  const { api, apiList } = useApi();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);

  const loadRecords = useCallback(() => {
    listAttendanceRecords(apiList, { limit: 10 })
      .then((page) => setRecords(page.data))
      .catch((err) => setRecordsError(err instanceof Error ? err.message : "Failed to load attendance."))
  }, [apiList]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handlePayload = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (text === "" || submittingRef.current) return;
      // html5-qrcode re-reports the same code for a few frames - ignore repeats.
      const last = lastScanRef.current;
      if (last && last.text === text && Date.now() - last.at < 5000) return;
      lastScanRef.current = { text, at: Date.now() };

      const scan = parseAttendancePayload(text);
      if (!scan) {
        setOutcome({ kind: "error", message: "That is not a Qadam attendance code." });
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      try {
        try {
          const result = await checkIn(api, scan);
          setOutcome({ kind: "checked-in", result });
        } catch (err) {
          const code = (err as Error & { code?: string }).code;
          if (code === "ALREADY_CHECKED_IN") {
            const result = await checkOut(api, scan);
            setOutcome({ kind: "checked-out", result });
          } else {
            throw err;
          }
        }
        loadRecords();
      } catch (err) {
        setOutcome({
          kind: "error",
          message: err instanceof Error ? err.message : "Check-in failed. Please try again.",
        });
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [api, loadRecords]
  );

  return (
    <>
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <header>
          <h1 className="text-2xl font-bold">Scan attendance QR</h1>
          <p className="mt-2 text-muted-foreground">
            Scan the QR code shown by the organizer to check in. Scan it again
            when you leave to check out — your hours are counted automatically.
          </p>
        </header>

        <QrScanner onScan={handlePayload} />

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            handlePayload(manualCode);
          }}
        >
          <label htmlFor="manual-code" className="block text-sm font-medium">
            Or enter the code manually
          </label>
          <div className="flex gap-2">
            <input
              id="manual-code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="qadam://attendance/..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={submitting}
              className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "..." : "Submit"}
            </button>
          </div>
        </form>

        {outcome && (
          <div
            role="status"
            className={
              outcome.kind === "error"
                ? "rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
                : "rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm"
            }
          >
            {outcome.kind === "checked-in" && (
              <p className="flex items-center gap-2 font-medium text-emerald-600">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Checked in at {formatDateTime(outcome.result.check_in)}
              </p>
            )}
            {outcome.kind === "checked-out" && (
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium text-emerald-600">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Checked out at {formatDateTime(outcome.result.check_out)}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Duration: {formatHours(outcome.result.hours)}
                </p>
              </div>
            )}
            {outcome.kind === "error" && (
              <p className="flex items-center gap-2 font-medium">
                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {outcome.message}
              </p>
            )}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent attendance
          </h2>
          {recordsError && (
            <p className="text-sm text-destructive" role="alert">
              {recordsError}
            </p>
          )}
          {records.length === 0 && !recordsError && (
            <p className="text-sm text-muted-foreground">
              No attendance yet — your verified hours will show up here.
            </p>
          )}
          <ul className="space-y-2">
            {records.map((record) => (
              <li key={record.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{record.project_title || "Project"}</p>
                    <p className="text-muted-foreground">
                      {record.event_name ?? "Attendance session"} · {formatDate(record.check_in)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm">
                    {record.check_out ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        {formatHours(record.hours)}
                      </>
                    ) : (
                      <span className="text-muted-foreground">In progress</span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(record.check_in)} → {formatDateTime(record.check_out)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
