import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { ProjectSummary } from "@/types/project";
import { formatDateRange } from "@/lib/utils";
import NgoLogo from "./NgoLogo";
import ProjectStatusBadge from "./ProjectStatusBadge";

/**
 * Summary card for a project, linking to its detail page.
 */
export default function ProjectCard({ project }: { project: ProjectSummary }) {
  const fillPercent =
    project.capacity > 0
      ? Math.min(100, Math.round((project.registered_count / project.capacity) * 100))
      : 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="qadam-card-interactive flex h-full flex-col gap-3.5 p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug tracking-tight text-slate-900">
          {project.title}
        </h3>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <NgoLogo
          ngoName={project.ngo_name}
          logoUrl={project.ngo_logo_url}
          className="h-5 w-5 text-[10px]"
        />
        <span className="truncate">{project.ngo_name}</span>
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">{project.description}</p>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-700 ring-1 ring-inset ring-emerald-100">
          {project.category.replace(/-/g, " ")}
        </span>
        {project.required_skills.slice(0, 3).map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
          >
            {skill}
          </span>
        ))}
        {project.required_skills.length > 3 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
            +{project.required_skills.length - 3}
          </span>
        )}
      </div>

      <div className="mt-auto space-y-2.5 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            {formatDateRange(project.start_date, project.end_date)}
          </span>
          {(project.distance_km != null || project.location_name) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              {project.distance_km != null
                ? `${project.distance_km} km away${
                    project.location_name ? ` · ${project.location_name}` : ""
                  }`
                : project.location_name}
            </span>
          )}
        </div>
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1 font-medium text-slate-600">
            <Users className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            {project.registered_count} / {project.capacity} volunteers
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
