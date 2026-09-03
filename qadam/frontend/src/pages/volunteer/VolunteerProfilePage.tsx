import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getVolunteerProfile, updateVolunteerProfile } from "@/lib/profiles";
import type { VolunteerProfile } from "@/types/profile";
import VolunteerProfileForm from "@/components/VolunteerProfileForm";

/**
 * /volunteer/profile (frontend-routes.md) - edit skills, interests,
 * experience, age, and location pin. Reuses the onboarding form component
 * pre-filled with the stored profile.
 */
export default function VolunteerProfilePage() {
  const { api } = useApi();
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /* Auto-dismiss the success notification after 4 seconds. */
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getVolunteerProfile(api)
      .then(setProfile)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load profile."))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Your profile</h1>
          <p className="mt-2 text-muted-foreground">
            {profile?.location_name
              ? `${profile.location_name} · keeping your location current improves matching.`
              : "Update your skills, interests, and location to get better matches."}
          </p>
        </header>

        {saved && (
          <div className="mb-6 flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-600" role="status">
            <span>Profile saved. Changes to skills, interests, or experience will update your matching score.</span>
            <button
              type="button"
              onClick={() => setSaved(false)}
              className="ml-3 shrink-0 rounded p-0.5 text-emerald-600 hover:bg-emerald-500/10"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {loadError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            {loadError}
            <button type="button" onClick={load} className="ml-2 underline">
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading profile...</p>
        ) : (
          <VolunteerProfileForm
            key={profile?.id ?? "profile"}
            initial={profile}
            submitLabel="Save changes"
            onSubmit={async (payload) => {
              await updateVolunteerProfile(api, payload);
              setSaved(true);
              load();
            }}
          />
        )}
      </main>
    </>
  );
}
