import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  FileEdit,
  Plus,
  Radio,
  Users,
  type LucideIcon,
} from "lucide-react";
import ProjectCard from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { listProjects } from "@/lib/projects";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/types/project";

/**
 * frontend-routes.md "/ngo/dashboard" - overview of the organization's
 * projects with quick stats and a shortcut into project management. Recent
 * registrations join in Phase 5 once the registrations module exists.
 */
export default function NgoDashboardPage() {
  const { apiList } = useApi();
  const { profile } = useAuth();
  const orgName = (profile as { name?: string } | null)?.name ?? "Your organization";

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    // One page is plenty for an NGO's MVP portfolio; `total` stays exact.
    listProjects(apiList, { limit: 100 })
      .then((result) => {
        setProjects(result.data);
        setTotal(result.pagination.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, [apiList]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className={cn(ui.page, "space-y-8")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={ui.sectionTitle}>Dashboard</h1>
          <p className={ui.sectionSub}>{orgName}</p>
        </div>
        <Link to="/ngo/projects/new" className={ui.btnPrimary}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create project
        </Link>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && projects === null && <LoadingState label="Loading your projects..." />}

      {!error && projects !== null && (
        <>
          <section aria-label="Project statistics" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Total projects"
              value={total}
              icon={ClipboardList}
              iconClass="bg-emerald-50 text-emerald-700"
            />
            <StatCard
              label="Live"
              value={projects.filter((p) => p.status === "upcoming" || p.status === "active").length}
              icon={Radio}
              iconClass="bg-sky-50 text-sky-700"
            />
            <StatCard
              label="Drafts"
              value={projects.filter((p) => p.status === "draft").length}
              icon={FileEdit}
              iconClass="bg-amber-50 text-amber-700"
            />
            <StatCard
              label="Volunteers registered"
              value={projects.reduce((sum, p) => sum + p.registered_count, 0)}
              icon={Users}
              iconClass="bg-violet-50 text-violet-700"
            />
          </section>

          <section aria-label="Your projects" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Your projects</h2>
              <Link
                to="/ngo/projects"
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                View all
              </Link>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project to start recruiting volunteers. You can save it as a draft and publish it whenever you're ready."
                action={
                  <Link to="/ngo/projects/new" className={ui.btnPrimary}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create your first project
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {projects.slice(0, 4).map((project) => (
                  <div key={project.id} className="space-y-2">
                    <ProjectCard project={project} />
                    {(project.status === "upcoming" || project.status === "active") && (
                      <Link
                        to={`/ngo/matching/${project.id}`}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Find Matches
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <div className="qadam-card-interactive p-4 sm:p-5">
      <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl", iconClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
