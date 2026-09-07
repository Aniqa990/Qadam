import { Navigate } from "react-router-dom";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import EstablishRoleForm from "@/components/EstablishRoleForm";
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
 * - Pending-role users (webhook miss / skipped register role pick) see
 *   EstablishRoleForm instead of a 401 error.
 * - Everyone else (not signed in) sees the full public landing page.
 */
export default function HomePage() {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const { isResolving, role, status, onboardingComplete, error, establishRole } = useAuth();

  // Wait for Clerk to initialise — render nothing to prevent flash.
  if (!clerkLoaded) return null;

  // Authenticated user: wait for backend role resolution, then redirect.
  if (isSignedIn) {
    if (isResolving) {
      return (
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Setting up your account...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8 text-center text-destructive">
          Could not load your account: {error}
        </div>
      );
    }

    if (status === "pending_role" || !role) {
      return <EstablishRoleForm onSelect={establishRole} error={error} />;
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
  }

  return <LandingPage />;
}
