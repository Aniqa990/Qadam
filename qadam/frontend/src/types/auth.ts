export type AppRole = "volunteer" | "ngo";

export interface AuthMe {
  id: string;
  email: string;
  role: AppRole;
  profile: {
    id: string;
    onboarding_complete: boolean;
    [key: string]: unknown;
  };
}
