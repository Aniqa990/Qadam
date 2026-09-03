import { Navigate } from "react-router-dom";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import LandingPage from "./LandingPage";

/**
 * Public root route ("/"). Sits OUTSIDE ProtectedLayout in App.tsx so
 * unauthenticated visitors reach this component directly.
 *
 * - While Clerk is initialising (`isLoaded === false`): render nothing to
 *   prevent any layout flash.
 * - Signed-in users with a resolved role + completed onboarding are
 *   redirected instantly to their role-specific dashboard.
 * - Everyone else (not signed in, or still onboarding) sees the full
 *   public landing page.
 */
export default function HomePage() {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const { isResolving, role, onboardingComplete, error } = useAuth();

  // Wait for Clerk to initialise — render nothing to prevent flash.
  if (!clerkLoaded) return null;

  // Authenticated user: wait for backend role resolution, then redirect.
  if (isSignedIn) {
    if (isResolving) return null;

    if (error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8 text-center text-destructive">
          Could not load your account: {error}
        </div>
      );
    }

    if (role === "volunteer" && onboardingComplete) {
      return <Navigate to="/volunteer/projects" replace />;
    }
    if (role === "ngo" && onboardingComplete) {
      return <Navigate to="/ngo/dashboard" replace />;
    }
    if (role === "volunteer") {
      return <Navigate to="/volunteer/onboarding" replace />;
    }
    if (role === "ngo") {
      return <Navigate to="/ngo/onboarding" replace />;
    }
    // Signed in but role not yet resolved (e.g. webhook pending)
    // — show a brief waiting state rather than the landing page.
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Setting up your account...
      </div>
    );
  }

  return <LandingPage />;
}
