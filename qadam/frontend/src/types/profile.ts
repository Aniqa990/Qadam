/** Profile DTOs mirroring api-contracts.md "Volunteers Module" / "NGOs Module". */

export interface VolunteerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  skills: string[];
  interests: string[];
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  age: number | null;
  onboarding_complete: boolean;
  created_at: string;
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
