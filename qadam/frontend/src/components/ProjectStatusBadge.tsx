import type { ProjectStatus } from "@/types/project";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200/80",
  upcoming: "bg-amber-50 text-amber-800 ring-amber-200/70",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  completed: "bg-teal-50 text-teal-800 ring-teal-200/70",
  cancelled: "bg-red-50 text-red-700 ring-red-200/70",
};

export default function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset",
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}
