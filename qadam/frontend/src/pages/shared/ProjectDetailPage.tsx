import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, MessageCircle, Users } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import ProjectRegistrationPanel from "@/components/ProjectRegistrationPanel";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import { ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getProject } from "@/lib/projects";
import { listRegistrations } from "@/lib/registrations";
import type { ProjectDetail } from "@/types/project";
import type { RegistrationSummary } from "@/types/registration";
import { formatDate, formatDateRange } from "@/lib/utils";

/**
 * frontend-routes.md "/projects/:id" - shared project detail view. The
 * backend already hides drafts from non-owners (they read as 404), so this
 * page just renders what the API returns. The owning NGO gets an Edit
 * shortcut; volunteers get the registration panel (register / confirmed /
 * cancel states - the server re-validates every rule).
 */
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api, apiList } = useApi();
  const { role, profile } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [myRegistration, setMyRegistration] = useState<RegistrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    // Volunteers also load their own registration for this project so the
    // panel can render the confirmed/cancelled state; the unique
    // (volunteer, project) constraint means there is at most one.
    Promise.all([
      getProject(api, id),
      role === "volunteer" ? listRegistrations(apiList, { project_id: id }) : null,
    ])
      .then(([projectData, registrationData]) => {
        setProject(projectData);
        setMyRegistration(registrationData?.data[0] ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project"))
      .finally(() => setLoading(false));
  }, [api, apiList, id, role]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <LoadingState label="Loading project..." />
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <ErrorState message={error ?? "Project not found"} onRetry={load} />
        <div className="text-center">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const isOwner = role === "ngo" && profile?.id === project.ngo_id;
  const fillPercent =
    project.capacity > 0
      ? Math.min(100, Math.round((project.registered_count / project.capacity) * 100))
      : 0;
  const minAge = project.eligibility?.min_age;
  const customRequirements = project.eligibility?.custom_requirements ?? [];

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{project.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              by <span className="font-medium text-foreground">{project.ngo_name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ProjectStatusBadge status={project.status} />
            {isOwner && (
              <Link
                to={`/ngo/projects/${project.id}/edit`}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              >
                Edit project
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {formatDateRange(project.start_date, project.end_date)}
          </span>
          {project.location_name && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {project.location_name}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 capitalize">
            <span aria-hidden="true">🏷</span>
            {project.category.replace(/-/g, " ")}
          </span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        {/* Main column */}
        <div className="space-y-8">
          <section aria-label="About this project">
            <h2 className="mb-2 text-lg font-semibold">About this project</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {project.description}
            </p>
          </section>

          {project.responsibilities.length > 0 && (
            <section aria-label="Volunteer responsibilities">
              <h2 className="mb-2 text-lg font-semibold">What you'll do</h2>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {project.responsibilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {project.required_skills.length > 0 && (
            <section aria-label="Required skills">
              <h2 className="mb-2 text-lg font-semibold">Skills needed</h2>
              <div className="flex flex-wrap gap-1.5">
                {project.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {(minAge != null || customRequirements.length > 0) && (
            <section aria-label="Eligibility">
              <h2 className="mb-2 text-lg font-semibold">Eligibility</h2>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {minAge != null && <li>Volunteers must be at least {minAge} years old.</li>}
                {customRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {role === "volunteer" && (
            <ProjectRegistrationPanel
              project={project}
              registration={myRegistration}
              onChanged={load}
            />
          )}
          <section className="space-y-3 rounded-lg border p-4" aria-label="Project facts">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Volunteers
                </span>
                <span className="text-muted-foreground">
                  {project.registered_count} / {project.capacity}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${fillPercent}%` }} />
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              {project.event_date && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Event date
                  </dt>
                  <dd className="font-medium">{formatDate(project.event_date)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Hours / session
                </dt>
                <dd className="font-medium">{project.hours_per_session ?? 0}</dd>
              </div>
            </dl>

            {project.whatsapp_group_url && (
              <a
                href={project.whatsapp_group_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Volunteer WhatsApp group
              </a>
            )}
          </section>

          <section aria-label="Project location">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Location
            </h2>
            <LocationPicker
              value={
                project.location_lat != null && project.location_lng != null
                  ? { lat: project.location_lat, lng: project.location_lng }
                  : null
              }
              readOnly
            />
          </section>
        </aside>
      </div>
    </main>
  );
}
