import { SignIn, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import AuthShell from "@/components/AuthShell";

/**
 * Public login — Clerk SignIn in a frosted split-screen shell.
 */
export default function LoginPage() {
  const { isLoaded, isSignedIn } = useClerkAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your Qadam journey.">
      <div className="flex justify-center [&_.cl-rootBox]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border-0">
        <SignIn signUpUrl="/register" forceRedirectUrl="/" />
      </div>
    </AuthShell>
  );
}
