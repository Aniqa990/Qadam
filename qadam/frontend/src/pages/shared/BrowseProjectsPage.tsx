import { useCallback, useEffect, useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getVolunteerProfile } from "@/lib/profiles";
import { listProjects, PROJECT_CATEGORIES } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { PaginationInfo, ProjectSummary } from "@/types/project";

const PAGE_SIZE = 12;

/** Radius choices (km) for the "near me" proximity filter. */
const NEAR_RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;

/** Filter form state - applied to the API only on submit. */
interface FilterValues {
  search: string;
  category: string;
  skill: string;
  location: string;
  date_from: string;
  date_to: string;
  near_enabled: boolean;
  near_km: string;
}

const EMPTY_FILTERS: FilterValues = {
  search: "",
  category: "",
  skill: "",
  location: "",
  date_from: "",
  date_to: "",
  near_enabled: false,
  near_km: "25",
};

/** True when any filter has a non-default value. */
function hasFilters(filters: FilterValues): boolean {
  const { near_enabled, ...rest } = filters;
  return near_enabled || Object.values(rest).some((value) => value.trim() !== "");
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * frontend-routes.md "/projects" - browse projects. The backend scopes by
 * role: volunteers see upcoming/active/completed opportunities; NGOs see
 * their own projects. Deterministic filters only (cause, skill, date
 * window, location text, "near me" proximity) - semantic matching lives in
 * the matching endpoints.
 */
export default function BrowseProjectsPage() {
  const { api, apiList } = useApi();
  const { role } = useAuth();

  const [draft, setDraft] = useState<FilterValues>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Whether the volunteer can use the proximity filter: null while the
   * profile resolves, false when the profile has no pinned location. The
   * backend derives the actual radius anchor from the profile pin, so this
   * is only used to enable/disable the control.
   */
  const [hasPinnedLocation, setHasPinnedLocation] = useState<boolean | null>(null);

  useEffect(() => {
    if (role !== "volunteer") return;
    let cancelled = false;
    getVolunteerProfile(api)
      .then((profile) => {
        if (!cancelled) {
          setHasPinnedLocation(
            profile.location_lat !== null && profile.location_lng !== null
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHasPinnedLocation(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, role]);

  const load = useCallback(() => {
    setError(null);
    listProjects(apiList, {
      page,
      limit: PAGE_SIZE,
      search: applied.search.trim() || undefined,
      category: applied.category || undefined,
      skill: applied.skill.trim() || undefined,
      location: applied.location.trim() || undefined,
      date_from: applied.date_from || undefined,
      date_to: applied.date_to || undefined,
      near_km: applied.near_enabled ? Number(applied.near_km) : undefined,
    })
      .then((result) => {
        setProjects(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, [apiList, page, applied]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setApplied({ ...draft });
    setPage(1); // a new filter set always starts from the first page
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Browse projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find opportunities that match your cause, skills, schedule, and city.
          </p>
        </div>

        {/* Filters - deterministic discovery, no AI ranking yet */}
        <form onSubmit={applyFilters} className="space-y-3 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Search</span>
              <input
                type="search"
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                placeholder="Title or description"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Cause</span>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className={inputClass}
              >
                <option value="">All causes</option>
                {PROJECT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Skill</span>
              <input
                type="text"
                value={draft.skill}
                onChange={(e) => setDraft({ ...draft, skill: e.target.value })}
                placeholder="e.g. teaching"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Location</span>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="City or country"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">From date</span>
              <input
                type="date"
                value={draft.date_from}
                onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">To date</span>
              <input
                type="date"
                value={draft.date_to}
                onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
                className={inputClass}
              />
            </label>

            {/* "Near me" proximity filter - volunteers only; the backend
                anchors the radius on the volunteer's profile pin. */}
            {role === "volunteer" && (
              <div className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Distance</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm",
                      hasPinnedLocation ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={draft.near_enabled}
                      disabled={!hasPinnedLocation}
                      onChange={(e) =>
                        setDraft({ ...draft, near_enabled: e.target.checked })
                      }
                    />
                    Near me
                  </label>
                  <select
                    aria-label="Search radius in kilometres"
                    className={cn(inputClass, "w-auto")}
                    value={draft.near_km}
                    disabled={!draft.near_enabled || !hasPinnedLocation}
                    onChange={(e) => setDraft({ ...draft, near_km: e.target.value })}
                  >
                    {NEAR_RADIUS_OPTIONS.map((km) => (
                      <option key={km} value={String(km)}>
                        within {km} km
                      </option>
                    ))}
                  </select>
                </div>
                {hasPinnedLocation === null && (
                  <p className="text-xs text-muted-foreground">
                    Checking your profile location…
                  </p>
                )}
                {hasPinnedLocation === false && (
                  <p className="text-xs text-muted-foreground">
                    Set your location in your profile to find projects near you.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Clear
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Apply filters
            </button>
          </div>
        </form>

        {error && <ErrorState message={error} onRetry={load} />}
        {!error && projects === null && <LoadingState label="Loading projects..." />}

        {!error && projects !== null && pagination !== null && (
          <>
            {projects.length === 0 ? (
              hasFilters(applied) ? (
                <EmptyState
                  title="No projects match your filters"
                  description="Try widening the radius or date range, or clearing some filters."
                  action={
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="No projects yet"
                  description="Organizations haven't published any opportunities yet. Check back soon."
                />
              )
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 text-sm">
                    <p className="text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages} · {pagination.total} projects
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                        className="rounded-md border border-input bg-background px-3 py-1.5 font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page >= pagination.totalPages}
                        className="rounded-md border border-input bg-background px-3 py-1.5 font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
