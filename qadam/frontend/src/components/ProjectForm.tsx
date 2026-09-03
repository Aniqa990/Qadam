import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PROJECT_CATEGORIES, type ProjectFormPayload } from "@/lib/projects";
import type { ProjectDetail } from "@/types/project";
import { cn } from "@/lib/utils";
import LocationPicker, { type LatLng } from "./LocationPicker";
import TagInput from "./TagInput";

interface ProjectFormValues {
  title: string;
  description: string;
  category: string;
  required_skills: string[];
  responsibilities: string[];
  custom_requirements: string[];
  min_age: string;
  capacity: string;
  start_date: string;
  end_date: string;
  event_date: string;
  hours_per_session: string;
  whatsapp_group_url: string;
  location: LatLng | null;
}

const EMPTY_VALUES: ProjectFormValues = {
  title: "",
  description: "",
  category: "",
  required_skills: [],
  responsibilities: [],
  custom_requirements: [],
  min_age: "",
  capacity: "",
  start_date: "",
  end_date: "",
  event_date: "",
  hours_per_session: "",
  whatsapp_group_url: "",
  location: null,
};

function toFormValues(project?: ProjectDetail | null): ProjectFormValues {
  if (!project) return { ...EMPTY_VALUES };
  return {
    title: project.title,
    description: project.description,
    category: project.category,
    required_skills: project.required_skills,
    responsibilities: project.responsibilities,
    custom_requirements: project.eligibility?.custom_requirements ?? [],
    min_age: project.eligibility?.min_age != null ? String(project.eligibility.min_age) : "",
    capacity: String(project.capacity),
    start_date: project.start_date,
    end_date: project.end_date,
    event_date: project.event_date ?? "",
    hours_per_session: project.hours_per_session != null ? String(project.hours_per_session) : "",
    whatsapp_group_url: project.whatsapp_group_url ?? "",
    location:
      project.location_lat != null && project.location_lng != null
        ? { lat: project.location_lat, lng: project.location_lng }
        : null,
  };
}

type FormErrors = Partial<Record<keyof ProjectFormValues, string>>;

function validateValues(values: ProjectFormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.title.trim().length < 3) errors.title = "Title must be at least 3 characters.";
  if (values.description.trim().length < 10)
    errors.description = "Description must be at least 10 characters.";
  if (!values.category) errors.category = "Choose a cause category.";

  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1)
    errors.capacity = "Capacity must be a whole number of at least 1.";

  if (!values.start_date) errors.start_date = "Start date is required.";
  if (!values.end_date) errors.end_date = "End date is required.";
  if (values.start_date && values.end_date && values.end_date < values.start_date)
    errors.end_date = "End date must be on or after the start date.";

  if (values.min_age.trim() !== "") {
    const minAge = Number(values.min_age);
    if (!Number.isInteger(minAge) || minAge < 15 || minAge > 100)
      errors.min_age = "Minimum age must be a whole number between 15 and 100.";
  }

  if (values.hours_per_session.trim() !== "") {
    const hours = Number(values.hours_per_session);
    if (Number.isNaN(hours) || hours < 0 || hours > 24)
      errors.hours_per_session = "Hours per session must be between 0 and 24.";
  }

  const whatsapp = values.whatsapp_group_url.trim();
  if (whatsapp !== "") {
    try {
      const url = new URL(whatsapp);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      errors.whatsapp_group_url = "Enter a valid URL starting with http:// or https://";
    }
  }

  if (!values.location) errors.location = "Drop a pin on the map to set the project location.";

  return errors;
}

function toPayload(values: ProjectFormValues): ProjectFormPayload {
  const minAge = values.min_age.trim() === "" ? undefined : Number(values.min_age);
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category,
    required_skills: values.required_skills,
    responsibilities: values.responsibilities,
    eligibility: {
      ...(minAge !== undefined ? { min_age: minAge } : {}),
      ...(values.custom_requirements.length > 0
        ? { custom_requirements: values.custom_requirements }
        : {}),
    },
    capacity: Number(values.capacity),
    whatsapp_group_url: values.whatsapp_group_url.trim() === "" ? null : values.whatsapp_group_url.trim(),
    start_date: values.start_date,
    end_date: values.end_date,
    event_date: values.event_date === "" ? null : values.event_date,
    location_lat: values.location?.lat as number,
    location_lng: values.location?.lng as number,
    hours_per_session:
      values.hours_per_session.trim() === "" ? 0 : Number(values.hours_per_session),
  };
}

interface ProjectFormProps {
  /** Existing project when editing; null when creating. */
  initial?: ProjectDetail | null;
  submitLabel: string;
  /** Performs the API call; resolving = success, throwing = shown inline. */
  onSubmit: (payload: ProjectFormPayload) => Promise<void>;
}

/**
 * Create/edit project form (frontend-routes.md "ProjectForm"). Owns local
 * form state and client-side validation only - the API call lives in the
 * page component (AGENTS.md: no business logic in React components). The
 * Project Copilot panel joins this form in Phase 7.
 */
export default function ProjectForm({ initial, submitLabel, onSubmit }: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
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

  const inputClass = (field: keyof ProjectFormValues) =>
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

      {/* Basics */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Basics
        </h2>
        <div>
          <label htmlFor="project-title" className="block text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            id="project-title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="After-School Tutoring"
            className={inputClass("title")}
          />
          {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="project-description" className="block text-sm font-medium">
            Description <span className="text-destructive">*</span>
          </label>
          <textarea
            id="project-description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What will volunteers do, who does it help, and why does it matter?"
            rows={5}
            className={inputClass("description")}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-destructive">{errors.description}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="project-category" className="block text-sm font-medium">
              Cause category <span className="text-destructive">*</span>
            </label>
            <select
              id="project-category"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              className={inputClass("category")}
            >
              <option value="">Select a category...</option>
              {PROJECT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.replace(/-/g, " ")}
                </option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category}</p>}
          </div>
          <div>
            <label htmlFor="project-capacity" className="block text-sm font-medium">
              Volunteer capacity <span className="text-destructive">*</span>
            </label>
            <input
              id="project-capacity"
              type="number"
              min={1}
              value={values.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="20"
              className={inputClass("capacity")}
            />
            {errors.capacity && <p className="mt-1 text-xs text-destructive">{errors.capacity}</p>}
          </div>
        </div>
      </section>

      {/* Roles & skills */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Roles &amp; skills
        </h2>
        <TagInput
          id="project-skills"
          label="Required skills"
          values={values.required_skills}
          onChange={(v) => set("required_skills", v)}
          placeholder="e.g. teaching — press Enter to add"
          hint="Skills power volunteer matching later. Add up to 30."
        />
        <TagInput
          id="project-responsibilities"
          label="Responsibilities"
          values={values.responsibilities}
          onChange={(v) => set("responsibilities", v)}
          placeholder="e.g. Tutor students in math — press Enter to add"
          hint="What volunteers will actually be doing."
          max={20}
        />
      </section>

      {/* Eligibility */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Eligibility
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="project-min-age" className="block text-sm font-medium">
              Minimum age
            </label>
            <input
              id="project-min-age"
              type="number"
              min={15}
              max={100}
              value={values.min_age}
              onChange={(e) => set("min_age", e.target.value)}
              placeholder="No minimum"
              className={inputClass("min_age")}
            />
            {errors.min_age ? (
              <p className="mt-1 text-xs text-destructive">{errors.min_age}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Checked against a volunteer's age at registration. Volunteers on Qadam are 15+.
              </p>
            )}
          </div>
          <div className="self-end">
            <TagInput
              id="project-custom-requirements"
              label="Other requirements (shown to volunteers)"
              values={values.custom_requirements}
              onChange={(v) => set("custom_requirements", v)}
              placeholder="e.g. Requires a background check"
              max={10}
            />
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Schedule
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="project-start-date" className="block text-sm font-medium">
              Start date <span className="text-destructive">*</span>
            </label>
            <input
              id="project-start-date"
              type="date"
              value={values.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className={inputClass("start_date")}
            />
            {errors.start_date && (
              <p className="mt-1 text-xs text-destructive">{errors.start_date}</p>
            )}
          </div>
          <div>
            <label htmlFor="project-end-date" className="block text-sm font-medium">
              End date <span className="text-destructive">*</span>
            </label>
            <input
              id="project-end-date"
              type="date"
              value={values.end_date}
              onChange={(e) => set("end_date", e.target.value)}
              className={inputClass("end_date")}
            />
            {errors.end_date && <p className="mt-1 text-xs text-destructive">{errors.end_date}</p>}
          </div>
          <div>
            <label htmlFor="project-event-date" className="block text-sm font-medium">
              Event date <span className="text-muted-foreground">(single-day events)</span>
            </label>
            <input
              id="project-event-date"
              type="date"
              value={values.event_date}
              onChange={(e) => set("event_date", e.target.value)}
              className={inputClass("event_date")}
            />
          </div>
          <div>
            <label htmlFor="project-hours" className="block text-sm font-medium">
              Hours per session
            </label>
            <input
              id="project-hours"
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={values.hours_per_session}
              onChange={(e) => set("hours_per_session", e.target.value)}
              placeholder="3"
              className={inputClass("hours_per_session")}
            />
            {errors.hours_per_session && (
              <p className="mt-1 text-xs text-destructive">{errors.hours_per_session}</p>
            )}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Location
        </h2>
        <LocationPicker value={values.location} onChange={(value) => set("location", value)} />
        {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
        <p className="text-xs text-muted-foreground">
          The city/country label is resolved automatically from the exact pin.
        </p>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Volunteer contact
        </h2>
        <div>
          <label htmlFor="project-whatsapp" className="block text-sm font-medium">
            WhatsApp group link <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="project-whatsapp"
            type="url"
            value={values.whatsapp_group_url}
            onChange={(e) => set("whatsapp_group_url", e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className={inputClass("whatsapp_group_url")}
          />
          {errors.whatsapp_group_url && (
            <p className="mt-1 text-xs text-destructive">{errors.whatsapp_group_url}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Shared with volunteers once they register.
          </p>
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
        <p className="text-xs text-muted-foreground">
          New projects are saved as drafts — publish them when you're ready.
        </p>
      </div>
    </form>
  );
}
