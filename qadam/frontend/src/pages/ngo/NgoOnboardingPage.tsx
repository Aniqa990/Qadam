import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { createNgoProfile, uploadNgoLogo } from "@/lib/profiles";
import NgoProfileForm from "@/components/NgoProfileForm";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/**
 * /ngo/onboarding (frontend-routes.md). Deliberately mounted OUTSIDE NgoGuard:
 * the guard redirects incomplete profiles here, so guarding this route would
 * loop forever - the page self-checks role and completion instead. A full
 * page load after saving makes useAuth re-fetch /auth/me so the guards
 * immediately see onboarding_complete: true.
 */
export default function NgoOnboardingPage() {
  const { role, onboardingComplete, isLoaded, isResolving } = useAuth();
  const { api } = useApi();

  if (!isLoaded || isResolving) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        Loading...
      </main>
    );
  }

  if (role === "volunteer") {
    return <Navigate to="/volunteer/onboarding" replace />;
  }
  if (onboardingComplete) {
    return <Navigate to="/ngo/dashboard" replace />;
  }

  return (
    <main className={cn(ui.pageNarrow, "space-y-8")}>
      <header className="space-y-2">
        <h1 className={ui.sectionTitle}>Set up your organization</h1>
        <p className={ui.sectionSub}>
          Tell volunteers who you are and what you do. This completes your organization profile and
          unlocks project creation.
        </p>
      </header>
      <div className={ui.card}>
        <NgoProfileForm
          submitLabel="Create organization profile"
          onUploadLogo={(file) => uploadNgoLogo(api, file)}
          onSubmit={async (payload) => {
            await createNgoProfile(api, payload);
            // Full reload: guards re-evaluate against the fresh profile.
            window.location.assign("/ngo/dashboard");
          }}
        />
      </div>
    </main>
  );
}
