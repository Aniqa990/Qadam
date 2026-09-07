import { useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import type { VolunteerProfile } from "@/types/profile";
import type { VolunteerProfilePayload } from "@/lib/profiles";
import { cn } from "@/lib/utils";
import LocationPicker, { type LatLng } from "./LocationPicker";
import TagInput from "./TagInput";

interface VolunteerProfileFormValues {
  full_name: string;
  phone: string;
  age: string;
  skills: string[];
  interests: string[];
  location: LatLng | null;
}

const EMPTY_VALUES: VolunteerProfileFormValues = {
  full_name: "",
  phone: "",
  age: "",
  skills: [],
  interests: [],
  location: null,
};

function toFormValues(profile?: VolunteerProfile | null): VolunteerProfileFormValues {
  if (!profile) return { ...EMPTY_VALUES };
  return {
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    age: profile.age != null ? String(profile.age) : "",
    skills: profile.skills ?? [],
    interests: profile.interests ?? [],
    location:
      profile.location_lat != null && profile.location_lng != null
        ? { lat: profile.location_lat, lng: profile.location_lng }
        : null,
  };
}

type FormErrors = Partial<Record<keyof VolunteerProfileFormValues, string>>;

function validateValues(values: VolunteerProfileFormValues): FormErrors {
  const errors: FormErrors = {};
  if (values.full_name.trim().length === 0) errors.full_name = "Your full name is required.";
  if (values.skills.length === 0) errors.skills = "Add at least one skill.";
  if (values.interests.length === 0) errors.interests = "Add at least one interest.";

  if (values.age.trim() !== "") {
    const age = Number(values.age);
    if (!Number.isInteger(age) || age < 15 || age > 100)
      errors.age = "Age must be a whole number between 15 and 100.";
  }
  return errors;
}

function toPayload(values: VolunteerProfileFormValues): VolunteerProfilePayload {
  return {
    full_name: values.full_name.trim(),
    phone: values.phone.trim() === "" ? null : values.phone.trim(),
    skills: values.skills,
    interests: values.interests,
    location_lat: values.location ? values.location.lat : null,
    location_lng: values.location ? values.location.lng : null,
    age: values.age.trim() === "" ? null : Number(values.age),
  };
}

interface VolunteerProfileFormProps {
  /** Existing profile when editing; null when onboarding for the first time. */
  initial?: VolunteerProfile | null;
  submitLabel: string;
  /** Performs the API call; resolving = success, throwing = shown inline. */
  onSubmit: (payload: VolunteerProfilePayload) => Promise<void>;
}

/**
 * Volunteer profile form (frontend-routes.md /volunteer/onboarding +
 * /volunteer/profile). frontend-routes.md sketches onboarding as a multi-step
 * wizard; this renders the same fields as clearly-sectioned single-page form
 * (matching ProjectForm's pattern) so both onboarding and profile editing
 * reuse one component. Owns local form state + client-side validation only -
 * the API call lives in the page component (AGENTS.md frontend rules).
 */
export default function VolunteerProfileForm({ initial, submitLabel, onSubmit }: VolunteerProfileFormProps) {
  const [values, setValues] = useState<VolunteerProfileFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  function set<K extends keyof VolunteerProfileFormValues>(key: K, value: VolunteerProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set("location", { lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const nextErrors = validateValues(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(toPayload(values));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: keyof VolunteerProfileFormValues) =>
    cn(
      "mt-1 w-full qadam-input",
      errors[field] && "border-destructive focus:ring-destructive"
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {submitError && (
        <div
          className="rounded-2xl border border-red-100 bg-red-50/50 p-3.5 text-sm text-red-700"
          role="alert"
        >
          {submitError}
        </div>
      )}

      {/* About you */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">About you</h2>
        <div>
          <label htmlFor="volunteer-name" className="qadam-label">
            Full name <span className="text-red-600">*</span>
          </label>
          <input
            id="volunteer-name"
            value={values.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            placeholder="Jane Doe"
            className={inputClass("full_name")}
          />
          {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="volunteer-phone" className="qadam-label">
              Phone
            </label>
            <input
              id="volunteer-phone"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+92 300 1234567"
              className={inputClass("phone")}
            />
          </div>
          <div>
            <label htmlFor="volunteer-age" className="qadam-label">
              Age
            </label>
            <input
              id="volunteer-age"
              type="number"
              min={15}
              max={100}
              value={values.age}
              onChange={(e) => set("age", e.target.value)}
              placeholder="Optional"
              className={inputClass("age")}
            />
            {errors.age ? (
              <p className="mt-1 text-xs text-red-600">{errors.age}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Some projects set a minimum age requirement.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Skills & interests */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Skills &amp; interests
        </h2>
        <TagInput
          id="volunteer-skills"
          label="Skills"
          values={values.skills}
          onChange={(v) => set("skills", v)}
          placeholder="e.g. teaching — press Enter to add"
          hint="Skills power volunteer matching later. Add up to 30."
        />
        {errors.skills && <p className="text-xs text-red-600">{errors.skills}</p>}
        <TagInput
          id="volunteer-interests"
          label="Interests"
          values={values.interests}
          onChange={(v) => set("interests", v)}
          placeholder="e.g. education — press Enter to add"
          hint="Causes you care about."
        />
        {errors.interests && <p className="text-xs text-red-600">{errors.interests}</p>}
      </section>

      {/* Location */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Location</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="qadam-btn-secondary text-sm"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {locating ? "Locating..." : "Use my location"}
          </button>
          <p className="text-xs text-slate-500">Optional, but nearby matches rank higher.</p>
        </div>
        <LocationPicker value={values.location} onChange={(value) => set("location", value)} />
        <p className="text-xs text-slate-500">
          The city/country label is resolved automatically from the exact pin.
        </p>
      </section>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" disabled={submitting} className="qadam-btn-primary">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
