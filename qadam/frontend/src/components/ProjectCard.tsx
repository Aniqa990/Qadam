import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { ProjectSummary } from "@/types/project";
import { formatDateRange } from "@/lib/utils";
import ProjectStatusBadge from "./ProjectStatusBadge";

/**
 * Summary card for a project, linking to its detail page. Used by the NGO
 * dashboard and the NGO project list (frontend-routes.md "ProjectCard").
 */
export default function ProjectCard({ project }: { project: ProjectSummary }) {
  const fillPercent = project.capacity > 0
    ? Math.min(100, Math.round((project.registered_count / project.capacity) * 100))
    : 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex h-full flex-col gap-3 rounded-lg border bg-background p-4 transition-colors hover:border-ring hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{project.title}</h3>
        <ProjectStatusBadge status={project.status} />
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs capitalize text-secondary-foreground">
          {project.category.replace(/-/g, " ")}
        </span>
        {project.required_skills.slice(0, 3).map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
          >
            {skill}
          </span>
        ))}
        {project.required_skills.length > 3 && (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
            +{project.required_skills.length - 3}
          </span>
        )}
      </div>

      <div className="mt-auto space-y-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDateRange(project.start_date, project.end_date)}
          </span>
          {project.location_name && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {project.location_name}
            </span>
          )}
        </div>
        <div>
          <div className="mb-1 inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {project.registered_count} / {project.capacity} volunteers
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
