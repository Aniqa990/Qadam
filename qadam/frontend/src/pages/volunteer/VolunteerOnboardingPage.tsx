import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { createVolunteerProfile } from "@/lib/profiles";
import VolunteerProfileForm from "@/components/VolunteerProfileForm";

/**
 * /volunteer/onboarding (frontend-routes.md). Deliberately mounted OUTSIDE
 * VolunteerGuard: the guard redirects incomplete profiles here, so guarding
 * this route would loop forever - the page self-checks role and completion
 * instead. A full page load after saving makes useAuth re-fetch /auth/me so
 * the guards immediately see onboarding_complete: true.
 */
export default function VolunteerOnboardingPage() {
  const { role, onboardingComplete, isLoaded, isResolving } = useAuth();
  const { api } = useApi();

  if (!isLoaded || isResolving) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        Loading...
      </main>
    );
  }

  if (role === "ngo") {
    return <Navigate to="/ngo/onboarding" replace />;
  }
  if (onboardingComplete) {
    return <Navigate to="/volunteer/projects" replace />;
  }

  return (
    <main className="qadam-page-narrow">
      <header className="mb-8">
        <p className="text-sm font-semibold text-emerald-700">Welcome to Qadam</p>
        <h1 className="qadam-section-title mt-1">Tell us about yourself</h1>
        <p className="qadam-section-sub mt-1.5">
          Share your skills and interests so we can match you with volunteer opportunities that
          fit.
        </p>
      </header>
      <div className="qadam-card p-5 sm:p-6">
        <VolunteerProfileForm
          submitLabel="Create my profile"
          onSubmit={async (payload) => {
            await createVolunteerProfile(api, payload);
            // Full reload: guards re-evaluate against the fresh profile.
            window.location.assign("/volunteer/projects");
          }}
        />
      </div>
    </main>
  );
}
