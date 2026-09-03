import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared loading / error / empty presentations (AGENTS.md "UI": prioritize
 * clear empty, loading, and error states). Every data-fetching page in the
 * projects module renders these so states stay consistent.
 */
export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
        aria-hidden="true"
      />
      <p className="text-sm" role="status">
        {label}
      </p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <p className="text-sm text-destructive" role="alert">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
