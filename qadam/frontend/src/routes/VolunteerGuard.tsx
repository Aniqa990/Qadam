import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * frontend-routes.md "Route Guards Summary": redirects to /login if not
 * authenticated (handled by the parent ProtectedLayout already, but this
 * guard is defensive), to /ngo/dashboard if role is ngo, and to
 * /volunteer/onboarding if onboarding is incomplete.
 */
export default function VolunteerGuard() {
  const { isLoaded, isResolving, isSignedIn, role, onboardingComplete } = useAuth();

  if (!isLoaded || isResolving) return null;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (role === "ngo") return <Navigate to="/ngo/dashboard" replace />;
  if (!onboardingComplete) return <Navigate to="/volunteer/onboarding" replace />;

  return <Outlet />;
}
