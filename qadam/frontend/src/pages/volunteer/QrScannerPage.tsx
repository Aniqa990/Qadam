import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, LogIn, LogOut, XCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { recordAttendance, listAttendanceRecords } from "@/lib/attendance";
import type { AttendanceRecord, ScanResult } from "@/types/attendance";
import { parseAttendancePayload } from "@/types/attendance";
import { formatDate, formatDateTime, formatHours } from "@/lib/utils";
import QrScanner from "@/components/QrScanner";

type ScanOutcome =
  | { kind: "checked-in"; result: ScanResult }
  | { kind: "checked-out"; result: ScanResult }
  | { kind: "error"; message: string };

/**
 * /volunteer/scan (frontend-routes.md) - the volunteer-side attendance flow:
 * scan (or paste) the event QR to check in; the SAME scan again checks out.
 * The client only relays the scanned (event_id, token) pair - the backend
 * performs every validation and is the only writer of attendance rows
 * (AGENTS.md "Attendance"). The unified POST /api/attendance/scan endpoint
 * returns `action` so the frontend renders the right state directly, with
 * no ALREADY_CHECKED_IN fallback needed.
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
      .catch((err) =>
        setRecordsError(err instanceof Error ? err.message : "Failed to load attendance.")
      );
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
        const result = await recordAttendance(api, scan);
        setOutcome({ kind: result.action, result });
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
    <main className="qadam-page-narrow space-y-8">
      <header>
        <h1 className="qadam-section-title">Scan attendance QR</h1>
        <p className="qadam-section-sub mt-1.5">
          Scan the QR code shown by the organizer to check in. Scan it again when you leave to
          check out — your hours are counted automatically.
        </p>
      </header>

      <div className="qadam-card p-4 sm:p-5">
        <QrScanner onScan={handlePayload} />
      </div>

      <form
        className="qadam-card space-y-3 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          handlePayload(manualCode);
        }}
      >
        <label htmlFor="manual-code" className="qadam-label">
          Or enter the code manually
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="manual-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="qadam://attendance/..."
            className="qadam-input"
          />
          <button type="submit" disabled={submitting} className="qadam-btn-primary shrink-0">
            {submitting ? "..." : "Submit"}
          </button>
        </div>
      </form>

      {outcome && (
        <div
          role="status"
          className={
            outcome.kind === "error"
              ? "qadam-card border-red-100 bg-red-50/50 p-4 text-sm text-red-700"
              : "qadam-card border-emerald-100 bg-emerald-50/50 p-4 text-sm"
          }
        >
          {outcome.kind === "checked-in" && (
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Checked in at {formatDateTime(outcome.result.check_in)}
            </p>
          )}
          {outcome.kind === "checked-out" && (
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium text-emerald-700">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Checked out at {formatDateTime(outcome.result.check_out)}
              </p>
              <p className="flex items-center gap-2 text-slate-500">
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent attendance
        </h2>
        {recordsError && (
          <p className="text-sm text-red-600" role="alert">
            {recordsError}
          </p>
        )}
        {records.length === 0 && !recordsError && (
          <p className="text-sm text-slate-500">
            No attendance yet — your verified hours will show up here.
          </p>
        )}
        <ul className="space-y-2.5">
          {records.map((record) => (
            <li key={record.id} className="qadam-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{record.project_title || "Project"}</p>
                  <p className="text-slate-500">
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
                    <span className="qadam-chip">In progress</span>
                  )}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {formatDateTime(record.check_in)} → {formatDateTime(record.check_out)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
