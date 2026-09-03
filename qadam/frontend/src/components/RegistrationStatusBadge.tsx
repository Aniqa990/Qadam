import type { RegistrationStatus } from "@/types/registration";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<RegistrationStatus, string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}
