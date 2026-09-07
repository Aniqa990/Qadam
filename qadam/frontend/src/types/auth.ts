export type AppRole = "volunteer" | "ngo";

export type AuthMeStatus = "ready" | "pending_role";

export interface AuthMe {
  id: string;
  email: string;
  role: AppRole | null;
  profile: {
    id: string;
    onboarding_complete: boolean;
    [key: string]: unknown;
  } | null;
  status: AuthMeStatus;
}
