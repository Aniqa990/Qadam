/**
 * Domain + DTO types for the volunteer and NGO profile module
 * (api-contracts.md "Volunteers Module" / "NGOs Module"). Rows are created by
 * the Clerk user.created webhook; profile endpoints only read and update
 * them. auth_user_id never leaves the API - responses are shaped to the
 * contract.
 */

export interface VolunteerRow {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  skills: string[] | null;
  interests: string[] | null;
  experience: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  age: number | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface VolunteerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  skills: string[];
  interests: string[];
  experience: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  age: number | null;
  onboarding_complete: boolean;
  created_at: string;
}

export interface NgoRow {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  description: string | null;
  logo_url: string | null;
  mission: string | null;
  website: string | null;
  phone: string | null;
  categories: string[] | null;
  registration_number: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface NgoProfile {
  id: string;
  name: string;
  email: string;
  description: string | null;
  logo_url: string | null;
  mission: string | null;
  website: string | null;
  phone: string | null;
  categories: string[];
  registration_number: string | null;
  onboarding_complete: boolean;
  created_at: string;
}
