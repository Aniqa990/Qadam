import { SignIn, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

/**
 * frontend-routes.md "/login": public, redirected to "/" if already
 * signed in. Clerk's prebuilt <SignIn> handles the actual form; after
 * sign-in, ProtectedLayout resolves role/onboarding and the app redirects
 * to the right home via VolunteerGuard/NgoGuard.
 */
export default function LoginPage() {
  const { isLoaded, isSignedIn } = useClerkAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignIn signUpUrl="/register" />
    </div>
  );
}
