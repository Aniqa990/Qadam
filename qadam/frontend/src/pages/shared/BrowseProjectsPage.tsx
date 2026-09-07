import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";
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

/** Filter form state - applied to the API only on submit / quick apply. */
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

/** Secondary (drawer-only) filters — used for the Filters button badge. */
function countAdvancedFilters(filters: FilterValues): number {
  let n = 0;
  if (filters.skill.trim()) n += 1;
  if (filters.location.trim()) n += 1;
  if (filters.date_from) n += 1;
  if (filters.date_to) n += 1;
  if (filters.near_enabled) n += 1;
  return n;
}

/**
 * frontend-routes.md "/projects" - browse projects. Compact toolbar +
 * collapsible advanced filters keep the project grid above the fold.
 */
export default function BrowseProjectsPage() {
  const { api, apiList } = useApi();
  const { role } = useAuth();

  const [draft, setDraft] = useState<FilterValues>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Whether the volunteer can use the proximity filter: null while the
   * profile resolves, false when the profile has no pinned location.
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

  function commitFilters(next: FilterValues) {
    setApplied(next);
    setPage(1);
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    commitFilters({ ...draft });
    setFiltersOpen(false);
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    commitFilters(EMPTY_FILTERS);
    setFiltersOpen(false);
  }

  const advancedCount = countAdvancedFilters(applied);

  return (
    <main className="qadam-page space-y-6">
      <div>
        <h1 className="qadam-section-title">Browse projects</h1>
        <p className="qadam-section-sub mt-1.5">
          Find opportunities that match your cause, skills, schedule, and city.
        </p>
      </div>

      <form onSubmit={applyFilters} className="space-y-3">
        {/* Compact single-row toolbar */}
        <div className="qadam-card flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:gap-2 sm:p-2.5">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="qadam-input border-0 bg-slate-50/80 py-2.5 pl-10 shadow-none focus:bg-white"
            />
          </div>

          <select
            value={draft.category}
            onChange={(e) => {
              const next = { ...draft, category: e.target.value };
              setDraft(next);
              // Cause is a quick filter — apply immediately.
              commitFilters(next);
            }}
            aria-label="Filter by cause"
            className="qadam-input w-full shrink-0 border-0 bg-slate-50/80 py-2.5 shadow-none sm:w-44 focus:bg-white"
          >
            <option value="">All causes</option>
            {PROJECT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replace(/-/g, " ")}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls="browse-advanced-filters"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              filtersOpen || advancedCount > 0
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                : "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
            )}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filters
            {advancedCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">
                {advancedCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                filtersOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Collapsible advanced filters */}
        {filtersOpen && (
          <div
            id="browse-advanced-filters"
            className="qadam-card space-y-4 border-emerald-100/80 p-4 sm:p-5"
            role="region"
            aria-label="Advanced filters"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                More filters
              </p>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="qadam-btn-ghost p-1.5 text-slate-500"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="qadam-label mb-0">Skill</span>
                <input
                  type="text"
                  value={draft.skill}
                  onChange={(e) => setDraft({ ...draft, skill: e.target.value })}
                  placeholder="e.g. teaching"
                  className="qadam-input"
                />
              </label>
              <label className="space-y-1.5">
                <span className="qadam-label mb-0">Location</span>
                <input
                  type="text"
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  placeholder="City or country"
                  className="qadam-input"
                />
              </label>
              <label className="space-y-1.5">
                <span className="qadam-label mb-0">From date</span>
                <input
                  type="date"
                  value={draft.date_from}
                  onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
                  className="qadam-input"
                />
              </label>
              <label className="space-y-1.5">
                <span className="qadam-label mb-0">To date</span>
                <input
                  type="date"
                  value={draft.date_to}
                  onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
                  className="qadam-input"
                />
              </label>

              {role === "volunteer" && (
                <div className="space-y-2 sm:col-span-2">
                  <span className="qadam-label mb-0">Distance</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!hasPinnedLocation}
                      onClick={() =>
                        setDraft({ ...draft, near_enabled: !draft.near_enabled })
                      }
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                        draft.near_enabled
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100",
                        !hasPinnedLocation && "cursor-not-allowed opacity-60"
                      )}
                    >
                      Near me
                    </button>
                    {NEAR_RADIUS_OPTIONS.map((km) => (
                      <button
                        key={km}
                        type="button"
                        disabled={!draft.near_enabled || !hasPinnedLocation}
                        onClick={() => setDraft({ ...draft, near_km: String(km) })}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
                          draft.near_enabled && draft.near_km === String(km)
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                            : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {km} km
                      </button>
                    ))}
                  </div>
                  {hasPinnedLocation === null && (
                    <p className="text-xs text-slate-500">Checking your profile location…</p>
                  )}
                  {hasPinnedLocation === false && (
                    <p className="text-xs text-slate-500">
                      Set your location in your profile to find projects near you.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={clearFilters} className="qadam-btn-secondary">
                Clear
              </button>
              <button type="submit" className="qadam-btn-primary">
                Apply filters
              </button>
            </div>
          </div>
        )}
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
                  <button type="button" onClick={clearFilters} className="qadam-btn-secondary">
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
                <div className="flex items-center justify-between border-t border-slate-100 pt-5 text-sm">
                  <p className="text-slate-500">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total}{" "}
                    projects
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                      className="qadam-btn-secondary text-sm"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="qadam-btn-secondary text-sm"
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
  );
}
