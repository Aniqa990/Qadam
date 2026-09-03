import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { NgoProfile } from "@/types/profile";
import type { NgoProfilePayload } from "@/lib/profiles";
import { PROJECT_CATEGORIES } from "@/lib/projects";
import { cn } from "@/lib/utils";

interface NgoProfileFormValues {
  name: string;
  description: string;
  mission: string;
  website: string;
  phone: string;
  registration_number: string;
  categories: string[];
}

const EMPTY_VALUES: NgoProfileFormValues = {
  name: "",
  description: "",
  mission: "",
  website: "",
  phone: "",
  registration_number: "",
  categories: [],
};

function toFormValues(profile?: NgoProfile | null): NgoProfileFormValues {
  if (!profile) return { ...EMPTY_VALUES };
  return {
    name: profile.name ?? "",
    description: profile.description ?? "",
    mission: profile.mission ?? "",
    website: profile.website ?? "",
    phone: profile.phone ?? "",
    registration_number: profile.registration_number ?? "",
    categories: profile.categories ?? [],
  };
}

type FormErrors = Partial<Record<keyof NgoProfileFormValues, string>>;

function validateValues(values: NgoProfileFormValues): FormErrors {
  const errors: FormErrors = {};
  if (values.name.trim().length === 0) errors.name = "Organization name is required.";
  if (values.description.trim().length === 0)
    errors.description = "Tell volunteers what your organization does.";
  if (values.categories.length > 10) errors.categories = "Choose at most 10 categories.";

  const website = values.website.trim();
  if (website !== "") {
    try {
      const url = new URL(website);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      errors.website = "Enter a valid URL starting with http:// or https://";
    }
  }
  return errors;
}

function toPayload(values: NgoProfileFormValues): NgoProfilePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    logo_url: null,
    mission: values.mission.trim() === "" ? null : values.mission.trim(),
    website: values.website.trim() === "" ? null : values.website.trim(),
    phone: values.phone.trim() === "" ? null : values.phone.trim(),
    categories: values.categories,
    registration_number:
      values.registration_number.trim() === "" ? null : values.registration_number.trim(),
  };
}

interface NgoProfileFormProps {
  /** Existing profile when editing; null when onboarding for the first time. */
  initial?: NgoProfile | null;
  submitLabel: string;
  /** Performs the API call; resolving = success, throwing = shown inline. */
  onSubmit: (payload: NgoProfilePayload) => Promise<void>;
}

/**
 * NGO organization-details form (frontend-routes.md /ngo/onboarding +
 * /ngo/profile), shared by onboarding and profile editing. Categories use the
 * same curated cause list as projects so discovery filters line up. Owns
 * local form state + client-side validation only - the API call lives in the
 * page component (AGENTS.md frontend rules).
 */
export default function NgoProfileForm({ initial, submitLabel, onSubmit }: NgoProfileFormProps) {
  const [values, setValues] = useState<NgoProfileFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof NgoProfileFormValues>(key: K, value: NgoProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(category: string) {
    setValues((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
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

  const inputClass = (field: keyof NgoProfileFormValues) =>
    cn(
      "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
      errors[field] && "border-destructive focus:ring-destructive"
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {submitError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          {submitError}
        </div>
      )}

      {/* Organization */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Organization
        </h2>
        <div>
          <label htmlFor="ngo-name" className="block text-sm font-medium">
            Organization name <span className="text-destructive">*</span>
          </label>
          <input
            id="ngo-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Bright Futures Foundation"
            className={inputClass("name")}
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="ngo-description" className="block text-sm font-medium">
            What does your organization do? <span className="text-destructive">*</span>
          </label>
          <textarea
            id="ngo-description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="A short description shown to volunteers on your projects."
            rows={4}
            className={inputClass("description")}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-destructive">{errors.description}</p>
          )}
        </div>
        <div>
          <label htmlFor="ngo-mission" className="block text-sm font-medium">
            Mission
          </label>
          <textarea
            id="ngo-mission"
            value={values.mission}
            onChange={(e) => set("mission", e.target.value)}
            placeholder="Your organization's mission in a sentence or two."
            rows={2}
            className={inputClass("mission")}
          />
        </div>
      </section>

      {/* Causes */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Causes you work on
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Organization categories">
          {PROJECT_CATEGORIES.filter((c) => c !== "other").map((category) => {
            const selected = values.categories.includes(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleCategory(category)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {category.replace(/-/g, " ")}
              </button>
            );
          })}
        </div>
        {errors.categories && <p className="text-xs text-destructive">{errors.categories}</p>}
        <p className="text-xs text-muted-foreground">Optional - pick the causes closest to your work.</p>
      </section>

      {/* Contact & public details */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contact &amp; public details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ngo-website" className="block text-sm font-medium">
              Website
            </label>
            <input
              id="ngo-website"
              type="url"
              value={values.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://example.org"
              className={inputClass("website")}
            />
            {errors.website && <p className="mt-1 text-xs text-destructive">{errors.website}</p>}
          </div>
          <div>
            <label htmlFor="ngo-phone" className="block text-sm font-medium">
              Phone
            </label>
            <input
              id="ngo-phone"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+92 300 1234567"
              className={inputClass("phone")}
            />
          </div>
        </div>
        <div>
          <label htmlFor="ngo-registration" className="block text-sm font-medium">
            Registration number
          </label>
          <input
            id="ngo-registration"
            value={values.registration_number}
            onChange={(e) => set("registration_number", e.target.value)}
            placeholder="Official NGO registration number, if you have one"
            className={inputClass("registration_number")}
          />
        </div>
      </section>

      <div className="flex items-center gap-3 border-t pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
