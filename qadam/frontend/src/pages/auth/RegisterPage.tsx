import { SignUp, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import type { AppRole } from "@/types/auth";

/**
 * frontend-routes.md "/register": role selection happens at sign-up time
 * via Clerk's unsafeMetadata (client-writable), which the backend's
 * user.created webhook then promotes to publicMetadata (server-only)
 * after creating the matching volunteers/ngos row - see
 * auth.service.createProfileForNewUser and AGENTS.md "Clerk Auth
 * Migration". This is why role must be picked BEFORE rendering <SignUp>:
 * Clerk needs it at account-creation time, not after.
 */
export default function RegisterPage() {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const [role, setRole] = useState<AppRole | null>(null);

  if (isLoaded && isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
        <h1 className="text-2xl font-bold">I am signing up as a...</h1>
        <div className="flex gap-4">
          <button
            className="rounded-md bg-primary px-6 py-3 text-primary-foreground"
            onClick={() => setRole("volunteer")}
          >
            Volunteer
          </button>
          <button
            className="rounded-md bg-secondary px-6 py-3 text-secondary-foreground"
            onClick={() => setRole("ngo")}
          >
            NGO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignUp signInUrl="/login" unsafeMetadata={{ role }} />
    </div>
  );
}
