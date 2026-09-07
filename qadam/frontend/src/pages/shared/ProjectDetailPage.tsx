import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, MessageCircle, Tag, Users } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import NgoLogo from "@/components/NgoLogo";
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
      <main className="qadam-page-narrow">
        <LoadingState label="Loading project..." />
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="qadam-page-narrow space-y-4">
        <ErrorState message={error ?? "Project not found"} onRetry={load} />
        <div className="text-center">
          <Link to="/" className="text-sm font-medium text-emerald-700 hover:underline">
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
    <main className="qadam-page space-y-8">
      {/* Header */}
      <header className="qadam-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {project.title}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
              by
              <NgoLogo
                ngoName={project.ngo_name}
                logoUrl={project.ngo_logo_url}
                className="h-5 w-5 text-[10px]"
              />
              <span className="font-medium text-slate-800">{project.ngo_name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ProjectStatusBadge status={project.status} />
            {isOwner && (
              <Link to={`/ngo/projects/${project.id}/edit`} className="qadam-btn-secondary text-sm">
                Edit project
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {formatDateRange(project.start_date, project.end_date)}
          </span>
          {project.location_name && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {project.location_name}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 capitalize">
            <Tag className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {project.category.replace(/-/g, " ")}
          </span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        {/* Main column */}
        <div className="space-y-5">
          <section className="qadam-card p-5 sm:p-6" aria-label="About this project">
            <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
              About this project
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {project.description}
            </p>
          </section>

          {project.responsibilities.length > 0 && (
            <section className="qadam-card p-5 sm:p-6" aria-label="Volunteer responsibilities">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
                What you'll do
              </h2>
              <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-600">
                {project.responsibilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {project.required_skills.length > 0 && (
            <section className="qadam-card p-5 sm:p-6" aria-label="Required skills">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
                Skills needed
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {project.required_skills.map((skill) => (
                  <span key={skill} className="qadam-chip">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {(minAge != null || customRequirements.length > 0) && (
            <section className="qadam-card p-5 sm:p-6" aria-label="Eligibility">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
                Eligibility
              </h2>
              <ul className="space-y-1.5 text-sm text-slate-500">
                {minAge != null && <li>Volunteers must be at least {minAge} years old.</li>}
                {customRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {role === "volunteer" && (
            <ProjectRegistrationPanel
              project={project}
              registration={myRegistration}
              onChanged={load}
            />
          )}
          <section className="qadam-card space-y-4 p-5" aria-label="Project facts">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <Users className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Volunteers
                </span>
                <span className="text-slate-500">
                  {project.registered_count} / {project.capacity}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>

            <dl className="space-y-2.5 text-sm">
              {project.event_date && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="inline-flex items-center gap-1.5 text-slate-500">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Event date
                  </dt>
                  <dd className="font-medium text-slate-800">{formatDate(project.event_date)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="inline-flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Hours / session
                </dt>
                <dd className="font-medium text-slate-800">{project.hours_per_session ?? 0}</dd>
              </div>
            </dl>

            {project.whatsapp_group_url && (
              <a
                href={project.whatsapp_group_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Volunteer WhatsApp group
              </a>
            )}
          </section>

          <section className="qadam-card overflow-hidden p-2" aria-label="Project location">
            <h2 className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
