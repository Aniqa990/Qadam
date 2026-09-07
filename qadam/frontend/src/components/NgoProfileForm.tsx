import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { NgoProfile } from "@/types/profile";
import type { NgoProfilePayload } from "@/lib/profiles";
import { PROJECT_CATEGORIES } from "@/lib/projects";
import { cn } from "@/lib/utils";
import NgoLogo from "./NgoLogo";

interface NgoProfileFormValues {
  name: string;
  description: string;
  logo_url: string;
  mission: string;
  website: string;
  phone: string;
  registration_number: string;
  categories: string[];
}

const EMPTY_VALUES: NgoProfileFormValues = {
  name: "",
  description: "",
  logo_url: "",
  mission: "",
  website: "",
  phone: "",
  registration_number: "",
  categories: [],
};

/** Mirrors the backend's 2 MB logo upload limit. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function toFormValues(profile?: NgoProfile | null): NgoProfileFormValues {
  if (!profile) return { ...EMPTY_VALUES };
  return {
    name: profile.name ?? "",
    description: profile.description ?? "",
    logo_url: profile.logo_url ?? "",
    mission: profile.mission ?? "",
    website: profile.website ?? "",
    phone: profile.phone ?? "",
    registration_number: profile.registration_number ?? "",
    categories: profile.categories ?? [],
  };
}

type FormErrors = Partial<Record<keyof NgoProfileFormValues, string>>;

function validateValues(values: NgoProfileFormValues, logoFile: File | null): FormErrors {
  const errors: FormErrors = {};
  if (values.name.trim().length === 0) errors.name = "Organization name is required.";
  if (values.description.trim().length === 0)
    errors.description = "Tell volunteers what your organization does.";
  if (values.categories.length > 10) errors.categories = "Choose at most 10 categories.";

  // A picked file replaces any pasted link, so the URL check only applies
  // when no file is selected.
  const logo = values.logo_url.trim();
  if (!logoFile && logo !== "") {
    try {
      const url = new URL(logo);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      errors.logo_url = "Enter a valid image URL starting with http:// or https://";
    }
  }
  if (logoFile && logoFile.size > LOGO_MAX_BYTES) {
    errors.logo_url = "Logo image must be 2 MB or smaller.";
  }

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

function toPayload(values: NgoProfileFormValues): Omit<NgoProfilePayload, "logo_url"> {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
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
  /** Uploads a picked logo file (page-owned API call); returns its public URL. */
  onUploadLogo?: (file: File) => Promise<{ logo_url: string }>;
}

/**
 * NGO organization-details form (frontend-routes.md /ngo/onboarding +
 * /ngo/profile), shared by onboarding and profile editing. Categories use the
 * same curated cause list as projects so discovery filters line up. Owns
 * local form state + client-side validation only - the API call lives in the
 * page component (AGENTS.md frontend rules).
 */
export default function NgoProfileForm({
  initial,
  submitLabel,
  onSubmit,
  onUploadLogo,
}: NgoProfileFormProps) {
  const [values, setValues] = useState<NgoProfileFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Currently saved (or pasted) logo URL; null when the field is empty.
  const savedLogoUrl = values.logo_url.trim() === "" ? null : values.logo_url.trim();

  // Local preview of a picked file via a browser blob URL, revoked when the
  // selection changes so the preview never leaks memory.
  const logoPreviewUrl = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile]
  );
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  function clearLogoFile() {
    setLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

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

    const nextErrors = validateValues(values, logoFile);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      // A picked file is uploaded first; its public URL replaces any pasted
      // link (validateValues treats the two inputs as mutually exclusive).
      let logoUrl = savedLogoUrl;
      if (logoFile) {
        if (!onUploadLogo) throw new Error("Logo upload is unavailable - paste an image URL instead.");
        logoUrl = (await onUploadLogo(logoFile)).logo_url;
      }
      await onSubmit({ ...toPayload(values), logo_url: logoUrl });
      // Keep the form mirroring what was just saved (the page also reloads
      // the profile, but this state lives here until remount).
      setValues((prev) => ({ ...prev, logo_url: logoUrl ?? "" }));
      clearLogoFile();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: keyof NgoProfileFormValues) =>
    cn(
      "mt-1 w-full qadam-input",
      errors[field] && "border-destructive focus:ring-destructive"
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {submitError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
          role="alert"
        >
          {submitError}
        </div>
      )}

      {/* Organization */}
      <section className="space-y-4 border-b border-slate-100 pb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Organization
        </h2>
        <div>
          <label htmlFor="ngo-name" className="qadam-label">
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
          <label htmlFor="ngo-description" className="qadam-label">
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
          <label htmlFor="ngo-logo-file" className="qadam-label">
            Logo
          </label>
          <div className="mt-1 flex items-start gap-4">
            <NgoLogo
              ngoName={values.name}
              logoUrl={logoPreviewUrl ?? savedLogoUrl}
              className="h-16 w-16 text-lg"
            />
            <div className="min-w-0 flex-1">
              <input
                ref={logoInputRef}
                id="ngo-logo-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                disabled={submitting}
                className="block w-full cursor-pointer rounded-md border border-input bg-background text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:opacity-90"
              />
              {logoFile && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {logoFile.name} - replaces the link below when you save.
                  </span>
                  <button
                    type="button"
                    onClick={clearLogoFile}
                    className="shrink-0 font-medium text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                id="ngo-logo-url"
                value={values.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="…or paste an image URL (https://…)"
                className={inputClass("logo_url")}
              />
              {errors.logo_url && (
                <p className="mt-1 text-xs text-destructive">{errors.logo_url}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Square PNG, JPEG, or WebP up to 2 MB. Shown next to your
                organization name on your projects.
              </p>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="ngo-mission" className="qadam-label">
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Contact &amp; public details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ngo-website" className="qadam-label">
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
            <label htmlFor="ngo-phone" className="qadam-label">
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
          <label htmlFor="ngo-registration" className="qadam-label">
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
          className="qadam-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
