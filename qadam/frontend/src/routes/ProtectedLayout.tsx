import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Wraps all authenticated routes (frontend-routes.md "Route Guards
 * Summary"). Redirects to /login if not authenticated. Nav bar + the
 * floating Knowledge Assistant widget mount here in later phases (Phase 3
 * for nav, Phase 7 for the assistant) - kept out for now since Phase 2
 * scope is auth only, not UI chrome.
 */
export default function ProtectedLayout() {
  const { isLoaded, isSignedIn, isResolving, error } = useAuth();

  if (!isLoaded || isResolving) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-destructive">
        Could not load your account: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* <NavBar /> - Phase 3 */}
      <Outlet />
      {/* <FloatingAssistant /> - Phase 7 */}
    </div>
  );
}
