import { Building2, HeartHandshake } from "lucide-react";
import { useState } from "react";
import type { AppRole } from "@/types/auth";

type Props = {
  onSelect: (role: AppRole) => Promise<void>;
  error?: string | null;
};

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/60 px-4 py-10">
      <div className="qadam-card w-full max-w-md space-y-5 border-emerald-100/80 p-6 sm:p-8">
        <div className="text-center">
          <h1 className="qadam-section-title text-2xl">I am signing up as a...</h1>
          <p className="qadam-section-sub mt-2">
            Choose how you will use Qadam. This sets up your workspace.
          </p>
        </div>
        <div className="grid gap-3">
          <button
            type="button"
            disabled={Boolean(submitting)}
            className="qadam-card-interactive flex items-start gap-4 p-4 text-left disabled:opacity-60"
            onClick={() => void choose("volunteer")}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-slate-900">
                {submitting === "volunteer" ? "Saving..." : "Volunteer"}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">Find matched opportunities</span>
            </span>
          </button>
          <button
            type="button"
            disabled={Boolean(submitting)}
            className="qadam-card-interactive flex items-start gap-4 p-4 text-left disabled:opacity-60"
            onClick={() => void choose("ngo")}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Building2 className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-slate-900">
                {submitting === "ngo" ? "Saving..." : "NGO"}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">Manage projects & impact</span>
            </span>
          </button>
        </div>
        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
