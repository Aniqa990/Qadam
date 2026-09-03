import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui helper for merging conditional Tailwind classes.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a "YYYY-MM-DD" date or ISO timestamp, e.g. "Sep 15, 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Formats a date range compactly, collapsing identical start/end dates. */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (start && end && start === end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}
