import { useState } from "react";
import type { AppRole } from "@/types/auth";

type Props = {
  onSelect: (role: AppRole) => Promise<void>;
  error?: string | null;
};

/**
 * Shown when the user is authenticated but /auth/me returns
 * status "pending_role" (no Clerk publicMetadata.role and no
 * recoverable unsafeMetadata.role). Completing a choice calls
 * POST /api/auth/establish-role.
 */
export default function EstablishRoleForm({ onSelect, error }: Props) {
  const [submitting, setSubmitting] = useState<AppRole | null>(null);

  async function choose(role: AppRole) {
    setSubmitting(role);
    try {
      await onSelect(role);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-2xl font-bold">I am signing up as a...</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Choose how you will use Qadam. This cannot be changed later from this screen.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          disabled={Boolean(submitting)}
          className="rounded-md bg-primary px-6 py-3 text-primary-foreground disabled:opacity-60"
          onClick={() => void choose("volunteer")}
        >
          {submitting === "volunteer" ? "Saving..." : "Volunteer"}
        </button>
        <button
          type="button"
          disabled={Boolean(submitting)}
          className="rounded-md bg-secondary px-6 py-3 text-secondary-foreground disabled:opacity-60"
          onClick={() => void choose("ngo")}
        >
          {submitting === "ngo" ? "Saving..." : "NGO"}
        </button>
      </div>
      {error ? <p className="text-center text-destructive">{error}</p> : null}
    </div>
  );
}
