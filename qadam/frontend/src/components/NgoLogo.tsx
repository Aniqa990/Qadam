import { cn } from "@/lib/utils";

/**
 * NGO brand avatar: the organization's uploaded logo when one is set, else a
 * neutral initial circle - cards and headers never render broken images.
 * Size is caller-controlled via className (e.g. "h-5 w-5 text-[10px]").
 */
export default function NgoLogo({
  ngoName,
  logoUrl,
  className,
}: {
  ngoName: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${ngoName} logo`}
        loading="lazy"
        className={cn(
          "h-8 w-8 shrink-0 rounded-full border object-cover",
          className
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground",
        className
      )}
    >
      {(ngoName.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
