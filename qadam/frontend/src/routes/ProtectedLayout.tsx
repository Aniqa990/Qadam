import { Navigate, Outlet } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import EstablishRoleForm from "@/components/EstablishRoleForm";
import FloatingAssistant from "@/components/FloatingAssistant";
import { useAuth } from "@/hooks/useAuth";

/**
 * Wraps all authenticated routes (frontend-routes.md "Route Guards
 * Summary"). Redirects to /login if not authenticated. Renders role-aware
 * navigation (AppHeader) when the user has completed onboarding,
 * so every protected page gets consistent chrome without importing nav
 * directly.
 */
export default function ProtectedLayout() {
  const { isLoaded, isSignedIn, isResolving, role, status, onboardingComplete, error, establishRole } =
    useAuth();

  if (!isLoaded || isResolving) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Setting up your account...
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

  if (status === "pending_role" || !role) {
    return <EstablishRoleForm onSelect={establishRole} error={error} />;
  }

  // Show role-specific nav only when the user has completed onboarding.
  // Onboarding pages self-check and redirect, so they never render with nav.
  const showNav = onboardingComplete;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showNav && <AppHeader role={role} />}
      <Outlet />
      {showNav && <FloatingAssistant />}
    </div>
  );
}
