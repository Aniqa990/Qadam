import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import NgoNav from "@/components/NgoNav";
import ProjectForm from "@/components/ProjectForm";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import { ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { deleteProject, getProject, transitionProject, updateProject } from "@/lib/projects";
import type { ProjectDetail, ProjectStatus } from "@/types/project";

interface StatusAction {
  action: "publish" | "activate" | "complete" | "cancel";
  label: string;
  confirm?: string;
  className: string;
}

/** Status-machine driven controls - mirrors backend STATUS_TRANSITIONS. */
const ACTIONS_BY_STATUS: Record<ProjectStatus, StatusAction[]> = {
  draft: [
    { action: "publish", label: "Publish", className: "bg-primary text-primary-foreground hover:opacity-90" },
  ],
  published: [
    { action: "activate", label: "Activate", className: "bg-primary text-primary-foreground hover:opacity-90" },
    {
      action: "cancel",
      label: "Cancel project",
      confirm: "Cancel this project? All confirmed registrations will be cancelled.",
      className: "border border-destructive/40 text-destructive hover:bg-destructive/10",
    },
  ],
  active: [
    { action: "complete", label: "Mark completed", className: "bg-primary text-primary-foreground hover:opacity-90" },
    {
      action: "cancel",
      label: "Cancel project",
      confirm: "Cancel this project? All confirmed registrations will be cancelled.",
      className: "border border-destructive/40 text-destructive hover:bg-destructive/10",
    },
  ],
  completed: [],
  cancelled: [],
};

/**
 * frontend-routes.md "/ngo/projects/:id/edit" - edit a project and manage its
 * lifecycle. Terminal projects (completed/cancelled) are read-only, matching
 * the backend's immutability rule. The Project Copilot panel joins this page
 * in Phase 7.
 */
export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useApi();
  const navigate = useNavigate();

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
      <>
        <NgoNav />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <LoadingState label="Loading project..." />
        </main>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <NgoNav />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
          <ErrorState message={error ?? "Project not found"} onRetry={load} />
          <div className="text-center">
            <Link to="/ngo/projects" className="text-sm font-medium text-primary hover:underline">
              Back to my projects
            </Link>
          </div>
        </main>
      </>
    );
  }

  const terminal = project.status === "completed" || project.status === "cancelled";
  const actions = ACTIONS_BY_STATUS[project.status];

  return (
    <>
      <NgoNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.registered_count} / {project.capacity} volunteers registered
            </p>
            <Link
              to={`/ngo/projects/${project.id}/attendance`}
              className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
            >
              Attendance & QR check-in →
            </Link>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>

        {/* Lifecycle controls - only the transitions the backend allows */}
        <section className="rounded-lg border p-4" aria-label="Project status">
          {terminal ? (
            <p className="text-sm text-muted-foreground">
              This project is <strong>{project.status}</strong> and can no longer be edited or
              restarted.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {actions.map((action) => (
                <button
                  key={action.action}
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => handleTransition(action)}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${action.className}`}
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
                  className="rounded-md border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "delete" ? "Deleting..." : "Delete draft"}
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {project.status === "draft" && "Publishing makes the project visible to volunteers."}
                {project.status === "published" && "Activating marks the project as underway."}
                {project.status === "active" && "Completing closes the project permanently."}
              </span>
            </div>
          )}
          {actionError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}
        </section>

        {terminal ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              View the project as volunteers saw it on its{" "}
              <Link to={`/projects/${project.id}`} className="font-medium text-primary hover:underline">
                detail page
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            {showSaved && (
              <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary" role="status">
                All changes saved.
              </p>
            )}
            <ProjectForm
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
          </>
        )}
      </main>
    </>
  );
}
