import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import CopilotPanel from "@/components/CopilotPanel";
import ProjectForm, { type ProjectFormHandle } from "@/components/ProjectForm";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import { ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { deleteProject, getProject, transitionProject, updateProject } from "@/lib/projects";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { ProjectDetail, ProjectStatus } from "@/types/project";

interface StatusAction {
  action: "publish" | "activate" | "complete" | "cancel";
  label: string;
  confirm?: string;
  variant: "primary" | "danger";
}

/** Status-machine driven controls - mirrors backend STATUS_TRANSITIONS. */
const ACTIONS_BY_STATUS: Record<ProjectStatus, StatusAction[]> = {
  draft: [{ action: "publish", label: "Publish", variant: "primary" }],
  upcoming: [
    { action: "activate", label: "Activate", variant: "primary" },
    {
      action: "cancel",
      label: "Cancel project",
      confirm: "Cancel this project? All confirmed registrations will be cancelled.",
      variant: "danger",
    },
  ],
  active: [
    { action: "complete", label: "Mark completed", variant: "primary" },
    {
      action: "cancel",
      label: "Cancel project",
      confirm: "Cancel this project? All confirmed registrations will be cancelled.",
      variant: "danger",
    },
  ],
  completed: [],
  cancelled: [],
};

/**
 * frontend-routes.md "/ngo/projects/:id/edit" - edit a project and manage its
 * lifecycle. Only draft and upcoming projects are editable - the backend
 * rejects detail edits once a project is active (or completed/cancelled),
 * so the form is replaced by a read-only note for those statuses. The
 * CopilotPanel sits beside the form for editable projects only.
 */
export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useApi();
  const navigate = useNavigate();
  const formRef = useRef<ProjectFormHandle>(null);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getProject(api, id)
      .then(setProject)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project"))
      .finally(() => setLoading(false));
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTransition(action: StatusAction) {
    if (!id || !project) return;
    if (action.confirm && !window.confirm(action.confirm)) return;

    setPendingAction(action.action);
    setActionError(null);
    try {
      await transitionProject(api, id, action.action);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (!id || !project) return;
    if (!window.confirm("Delete this draft project? This cannot be undone.")) return;

    setPendingAction("delete");
    setActionError(null);
    try {
      await deleteProject(api, id);
      navigate("/ngo/projects", { replace: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed. Please try again.");
      setPendingAction(null);
    }
  }

  if (loading) {
    return (
      <main className={ui.pageNarrow}>
        <LoadingState label="Loading project..." />
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className={cn(ui.pageNarrow, "space-y-4")}>
        <ErrorState message={error ?? "Project not found"} onRetry={load} />
        <div className="text-center">
          <Link
            to="/ngo/projects"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Back to my projects
          </Link>
        </div>
      </main>
    );
  }

  const terminal = project.status === "completed" || project.status === "cancelled";
  // Mirrors the backend mutation guard: PUT /api/projects/:id only accepts
  // draft and upcoming projects.
  const editable = project.status === "draft" || project.status === "upcoming";
  const actions = ACTIONS_BY_STATUS[project.status];

  return (
    <main className={cn(ui.pageWide, "space-y-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={ui.sectionTitle}>{project.title}</h1>
          <p className={cn(ui.sectionSub, "mt-1")}>
            {project.registered_count} / {project.capacity} volunteers registered
          </p>
          <Link
            to={`/ngo/projects/${project.id}/attendance`}
            className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Attendance & QR check-in →
          </Link>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      {/* Lifecycle controls - only the transitions the backend allows */}
      <section className={cn(ui.card)} aria-label="Project status">
        {terminal ? (
          <p className="text-sm text-slate-500">
            This project is <strong className="text-slate-700">{project.status}</strong> and can no
            longer be edited or restarted.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.action}
                type="button"
                disabled={pendingAction !== null}
                onClick={() => handleTransition(action)}
                className={cn(
                  action.variant === "primary" ? ui.btnPrimary : ui.btnDanger,
                  "disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {pendingAction === action.action && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {action.label}
              </button>
            ))}
            {project.status === "draft" && (
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={handleDelete}
                className={cn(ui.btnDanger, "disabled:cursor-not-allowed disabled:opacity-60")}
              >
                {pendingAction === "delete" ? "Deleting..." : "Delete draft"}
              </button>
            )}
            <span className="text-xs text-slate-500">
              {project.status === "draft" &&
                "Publishing lists the project as Upcoming and makes it visible to volunteers."}
              {project.status === "upcoming" && "Activating marks the project as underway."}
              {project.status === "active" &&
                "Details are locked while active. Completing closes the project permanently."}
            </span>
          </div>
        )}
        {actionError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}
      </section>

      {!editable ? (
        <div className={cn(ui.card, "text-center")}>
          <p className="text-sm text-slate-500">
            {project.status === "active"
              ? "This project is active — its details are locked. View it on its "
              : "View the project as volunteers saw it on its "}
            <Link
              to={`/projects/${project.id}`}
              className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              detail page
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {showSaved && (
            <p
              className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800"
              role="status"
            >
              All changes saved.
            </p>
          )}
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className={ui.card}>
              <ProjectForm
                ref={formRef}
                key={project.id}
                initial={project}
                submitLabel="Save changes"
                onSubmit={async (payload) => {
                  await updateProject(api, project.id, payload);
                  setShowSaved(true);
                  window.setTimeout(() => setShowSaved(false), 3000);
                  load(); // refresh counts/status from the source of truth
                }}
              />
            </div>

            <div className="lg:sticky lg:top-4 lg:self-start">
              <CopilotPanel api={api} onApply={(draft) => formRef.current?.applyDraft(draft)} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
