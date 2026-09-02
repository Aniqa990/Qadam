import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * frontend-routes.md "Route Guards Summary": redirects to /login if not
 * authenticated, to /volunteer/projects if role is volunteer, and to
 * /ngo/onboarding if onboarding is incomplete.
 */
export default function NgoGuard() {
  const { isLoaded, isResolving, isSignedIn, role, onboardingComplete } = useAuth();

  if (!isLoaded || isResolving) return null;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (role === "volunteer") return <Navigate to="/volunteer/projects" replace />;
  if (!onboardingComplete) return <Navigate to="/ngo/onboarding" replace />;

  return <Outlet />;
}
