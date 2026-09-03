import type { NgoProfile, VolunteerProfile } from "@/types/profile";
import type { ApiFetcher } from "./projects";

/**
 * Typed wrappers for the profile endpoints (api-contracts.md "Volunteers
 * Module" / "NGOs Module"). POST is the onboarding call, PUT the profile
 * edit; both are role-scoped server-side to the caller's own row.
 */

export interface VolunteerProfilePayload {
  full_name: string;
  phone: string | null;
  skills: string[];
  interests: string[];
  experience: string | null;
  location_lat: number | null;
  location_lng: number | null;
  age: number | null;
}

export interface NgoProfilePayload {
  name: string;
  description: string;
  logo_url: string | null;
  mission: string | null;
  website: string | null;
  phone: string | null;
  categories: string[];
  registration_number: string | null;
}

export function getVolunteerProfile(api: ApiFetcher): Promise<VolunteerProfile> {
  return api<VolunteerProfile>("/volunteers/profile");
}

export function createVolunteerProfile(
  api: ApiFetcher,
  input: VolunteerProfilePayload
): Promise<{ id: string; onboarding_complete: boolean }> {
  return api("/volunteers/profile", { method: "POST", body: JSON.stringify(input) });
}

export function updateVolunteerProfile(
  api: ApiFetcher,
  input: Partial<VolunteerProfilePayload>
): Promise<{ id: string; onboarding_complete: boolean }> {
  return api("/volunteers/profile", { method: "PUT", body: JSON.stringify(input) });
}

export function getNgoProfile(api: ApiFetcher): Promise<NgoProfile> {
  return api<NgoProfile>("/ngos/profile");
}

export function createNgoProfile(
  api: ApiFetcher,
  input: NgoProfilePayload
): Promise<{ id: string; onboarding_complete: boolean }> {
  return api("/ngos/profile", { method: "POST", body: JSON.stringify(input) });
}

export function updateNgoProfile(
  api: ApiFetcher,
  input: Partial<NgoProfilePayload>
): Promise<{ id: string; onboarding_complete: boolean }> {
  return api("/ngos/profile", { method: "PUT", body: JSON.stringify(input) });
}
