import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, QrCode, Square, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getProject } from "@/lib/projects";
import {
  createAttendanceEvent,
  getEventQr,
  listAttendanceEvents,
  listAttendanceRecords,
  stopAttendanceEvent,
} from "@/lib/attendance";
import type { AttendanceEvent, AttendanceEventQr, AttendanceRecord } from "@/types/attendance";
import type { ProjectDetail } from "@/types/project";
import { formatDate, formatDateTime, formatHours } from "@/lib/utils";
import { cn } from "@/lib/utils";
import NgoNav from "@/components/NgoNav";
import QrCodeDisplay from "@/components/QrCodeDisplay";

/** datetime-local input value (local time, no timezone suffix). */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventStatus(event: AttendanceEvent): "upcoming" | "live" | "ended" {
  const now = Date.now();
  if (now < new Date(event.window_start).getTime()) return "upcoming";
  if (now <= new Date(event.window_end).getTime()) return "live";
  return "ended";
}

const STATUS_STYLES: Record<"upcoming" | "live" | "ended", string> = {
  upcoming: "bg-sky-500/10 text-sky-700",
  live: "bg-emerald-500/10 text-emerald-700",
  ended: "bg-muted text-muted-foreground",
};

/**
 * /ngo/projects/:id/attendance (frontend-routes.md "Attendance Management") -
 * the NGO-side QR attendance flow: create a session with a short-lived
 * server-generated token, show its QR, stop attendance early, and see who
 * checked in. All rules (ownership, project status, window validity) are
 * enforced server-side; this page is presentation + API calls only.
 */
export default function AttendanceManagementPage() {
  const { id } = useParams<{ id: string }>();
  const { api, apiList } = useApi();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Per-event panels: the QR being shown and the attendee list being viewed.
  const [qrFor, setQrFor] = useState<{ eventId: string; qr: AttendanceEventQr } | null>(null);
  const [attendeesFor, setAttendeesFor] = useState<{ eventId: string; records: AttendanceRecord[] } | null>(null);

  const now = new Date();
  const [form, setForm] = useState({
    event_name: "",
    event_date: now.toISOString().slice(0, 10),
    window_start: toDatetimeLocal(now),
    window_end: toDatetimeLocal(new Date(now.getTime() + 2 * 3_600_000)),
  });

  const attendanceOpen =
    project != null && (project.status === "published" || project.status === "active");

  const loadEvents = useCallback(() => {
    if (!id) return;
    listAttendanceEvents(api, id)
      .then(setEvents)
      .catch((err) => setEventsError(err instanceof Error ? err.message : "Failed to load sessions."))
  }, [api, id]);

  useEffect(() => {
    if (!id) return;
    setLoadError(null);
    getProject(api, id)
      .then((data) => {
        setProject(data);
        loadEvents();
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load project."));
  }, [api, id, loadEvents]);

  async function handleCreateEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!id) return;
    setActionError(null);
    setBusy(true);
    try {
      await createAttendanceEvent(api, id, {
        event_name: form.event_name.trim() === "" ? null : form.event_name.trim(),
        event_date: form.event_date,
        window_start: new Date(form.window_start).toISOString(),
        window_end: new Date(form.window_end).toISOString(),
      });
      loadEvents();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create the session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShowQr(eventId: string) {
    setActionError(null);
    if (qrFor?.eventId === eventId) {
      setQrFor(null);
      return;
    }
    try {
      const qr = await getEventQr(api, eventId);
      setQrFor({ eventId, qr });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load the QR code.");
    }
  }

  async function handleStop(event: AttendanceEvent) {
    setActionError(null);
    if (!window.confirm("Stop attendance for this session? New check-ins will be rejected.")) return;
    try {
      await stopAttendanceEvent(api, event.event_id);
      loadEvents();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to stop the session.");
    }
  }

  async function handleShowAttendees(eventId: string) {
    setActionError(null);
    if (attendeesFor?.eventId === eventId) {
      setAttendeesFor(null);
      return;
    }
    try {
      const page = await listAttendanceRecords(apiList, { event_id: eventId, limit: 100 });
      setAttendeesFor({ eventId, records: page.data });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load attendees.");
    }
  }

  if (loadError) {
    return (
      <>
        <NgoNav />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            {loadError}
          </div>
          <Link to="/ngo/projects" className="mt-4 inline-block text-sm underline">
            Back to My Projects
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <NgoNav />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to={`/ngo/projects/${id}/edit`} className="underline">
                ← Back to edit project
              </Link>
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              Attendance {project ? `· ${project.title}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a session, show its QR to volunteers, and stop attendance when the session ends.
            </p>
          </div>
          {project && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {project.status}
            </span>
          )}
        </header>

        {!attendanceOpen && project && (
          <div className="rounded-md border bg-secondary/40 p-4 text-sm text-muted-foreground" role="status">
            {project.status === "draft"
              ? "Publish this project before running attendance sessions."
              : "This project is no longer active — attendance sessions are closed."}
          </div>
        )}

        {/* Create session */}
        <section className="space-y-4 rounded-lg border p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            New attendance session
          </h2>
          <form onSubmit={handleCreateEvent} className="space-y-4" noValidate>
            <div>
              <label htmlFor="event-name" className="block text-sm font-medium">
                Session name
              </label>
              <input
                id="event-name"
                value={form.event_name}
                onChange={(e) => setForm((prev) => ({ ...prev, event_name: e.target.value }))}
                placeholder="e.g. Day 1 Morning Session"
                disabled={!attendanceOpen}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium">
                  Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, event_date: e.target.value }))}
                  required
                  disabled={!attendanceOpen}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="window-start" className="block text-sm font-medium">
                  Check-in opens
                </label>
                <input
                  id="window-start"
                  type="datetime-local"
                  value={form.window_start}
                  onChange={(e) => setForm((prev) => ({ ...prev, window_start: e.target.value }))}
                  required
                  disabled={!attendanceOpen}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="window-end" className="block text-sm font-medium">
                  Check-in closes
                </label>
                <input
                  id="window-end"
                  type="datetime-local"
                  value={form.window_end}
                  onChange={(e) => setForm((prev) => ({ ...prev, window_end: e.target.value }))}
                  required
                  disabled={!attendanceOpen}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !attendanceOpen}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy ? "Creating..." : "Create session"}
            </button>
          </form>
          {actionError && (
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}
        </section>

        {/* Sessions */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sessions
          </h2>
          {eventsError && (
            <p className="text-sm text-destructive" role="alert">
              {eventsError}
            </p>
          )}
          {events.length === 0 && !eventsError && (
            <p className="text-sm text-muted-foreground">
              No attendance sessions yet — create one above to start checking volunteers in.
            </p>
          )}
          <ul className="space-y-3">
            {events.map((event) => {
              const status = eventStatus(event);
              return (
                <li key={event.event_id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{event.event_name ?? "Attendance session"}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(event.event_date)} · {formatDateTime(event.window_start)} –{" "}
                        {formatDateTime(event.window_end)}
                      </p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", STATUS_STYLES[status])}>
                      {status === "upcoming" ? "Upcoming" : status === "live" ? "Live" : "Ended"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleShowQr(event.event_id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
                    >
                      <QrCode className="h-4 w-4" aria-hidden="true" />
                      {qrFor?.eventId === event.event_id ? "Hide QR" : "Show QR"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShowAttendees(event.event_id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
                    >
                      <Users className="h-4 w-4" aria-hidden="true" />
                      {attendeesFor?.eventId === event.event_id ? "Hide attendees" : "Attendees"}
                    </button>
                    {status !== "ended" && (
                      <button
                        type="button"
                        onClick={() => handleStop(event)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/5"
                      >
                        <Square className="h-3.5 w-3.5" aria-hidden="true" />
                        Stop attendance
                      </button>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {event.checked_in_count} checked in
                    </span>
                  </div>

                  {qrFor?.eventId === event.event_id && (
                    <QrCodeDisplay
                      data={qrFor.qr.qr_data}
                      caption={
                        status === "ended"
                          ? "This session's window has closed — the code no longer works."
                          : "Volunteers scan this with Qadam → Scan QR."
                      }
                    />
                  )}

                  {attendeesFor?.eventId === event.event_id && (
                    <div className="overflow-x-auto rounded-md border">
                      {attendeesFor.records.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">
                          Nobody has checked in for this session yet.
                        </p>
                      ) : (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-4 py-2 font-medium">Volunteer</th>
                              <th className="px-4 py-2 font-medium">Check-in</th>
                              <th className="px-4 py-2 font-medium">Check-out</th>
                              <th className="px-4 py-2 font-medium">Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendeesFor.records.map((record) => (
                              <tr key={record.id} className="border-t">
                                <td className="px-4 py-2">{record.volunteer_name || "—"}</td>
                                <td className="px-4 py-2">{formatDateTime(record.check_in)}</td>
                                <td className="px-4 py-2">{formatDateTime(record.check_out)}</td>
                                <td className="px-4 py-2">
                                  {record.check_out ? formatHours(record.hours) : "In progress"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
