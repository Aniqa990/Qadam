import { SignUp, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Building2, HeartHandshake } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import type { AppRole } from "@/types/auth";

/**
 * Role selection then Clerk SignUp with unsafeMetadata.role.
 */
export default function RegisterPage() {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const [role, setRole] = useState<AppRole | null>(null);

  if (isLoaded && isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (!role) {
    return (
      <AuthShell
        title="Join Qadam"
        subtitle="Choose how you will contribute — this shapes your workspace."
      >
        <div className="grid gap-3">
          <button
            type="button"
            className="qadam-card-interactive flex items-start gap-4 p-4 text-left hover:border-emerald-200"
            onClick={() => setRole("volunteer")}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold tracking-tight text-slate-900">Volunteer</span>
              <span className="mt-0.5 block text-sm text-slate-500">
                Discover matched projects and log verified impact.
              </span>
            </span>
          </button>
          <button
            type="button"
            className="qadam-card-interactive flex items-start gap-4 p-4 text-left hover:border-emerald-200"
            onClick={() => setRole("ngo")}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold tracking-tight text-slate-900">NGO</span>
              <span className="mt-0.5 block text-sm text-slate-500">
                Publish projects, recruit matches, and track attendance.
              </span>
            </span>
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={role === "ngo" ? "Create your NGO account" : "Create your volunteer account"}
      subtitle="Secure sign-up powered by Clerk."
    >
      <div className="flex justify-center [&_.cl-rootBox]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border-0">
        <SignUp
          signInUrl="/login"
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
          unsafeMetadata={{ role }}
        />
      </div>
    </AuthShell>
  );
}
