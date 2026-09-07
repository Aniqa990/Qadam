import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared loading / error / empty presentations with civic-tech polish.
 */
export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 py-14 text-slate-500">
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600"
        aria-hidden="true"
      />
      <p className="text-sm font-medium" role="status">
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
    <div className="qadam-card flex min-h-44 flex-col items-center justify-center gap-3 border-red-100 bg-red-50/40 p-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="max-w-md text-sm font-medium text-red-700" role="alert">
        {message}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="qadam-btn-secondary mt-1">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
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
    <div className="qadam-card flex min-h-44 flex-col items-center justify-center gap-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="font-semibold tracking-tight text-slate-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
