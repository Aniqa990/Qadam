import type { RegistrationStatus } from "@/types/registration";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<RegistrationStatus, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  cancelled: "bg-red-50 text-red-700 ring-red-200/70",
};

export default function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
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
