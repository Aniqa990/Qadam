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
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Welcome to Qadam 👋</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us a bit about yourself so we can match you with volunteer
          opportunities that fit your skills and interests.
        </p>
      </header>
      <VolunteerProfileForm
        submitLabel="Create my profile"
        onSubmit={async (payload) => {
          await createVolunteerProfile(api, payload);
          // Full reload: guards re-evaluate against the fresh profile.
          window.location.assign("/volunteer/projects");
        }}
      />
    </main>
  );
}
