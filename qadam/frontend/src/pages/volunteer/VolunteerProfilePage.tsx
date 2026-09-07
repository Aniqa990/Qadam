import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getVolunteerProfile, updateVolunteerProfile } from "@/lib/profiles";
import type { VolunteerProfile } from "@/types/profile";
import VolunteerProfileForm from "@/components/VolunteerProfileForm";

/**
 * /volunteer/profile (frontend-routes.md) - edit skills, interests,
 * age, and location pin. Reuses the onboarding form component
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
    <main className="qadam-page-narrow">
      <header className="mb-8">
        <h1 className="qadam-section-title">Your profile</h1>
        <p className="qadam-section-sub mt-1.5">
          {profile?.location_name
            ? `${profile.location_name} · keeping your location current improves matching.`
            : "Update your skills, interests, and location to get better matches."}
        </p>
      </header>

      {saved && (
        <div
          className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-sm text-emerald-700"
          role="status"
        >
          <span>
            Profile saved. Changes to skills or interests will update your matching score.
          </span>
          <button
            type="button"
            onClick={() => setSaved(false)}
            className="ml-3 shrink-0 rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {loadError && (
        <div
          className="mb-6 rounded-2xl border border-red-100 bg-red-50/50 p-3.5 text-sm text-red-700"
          role="alert"
        >
          {loadError}
          <button type="button" onClick={load} className="ml-2 font-medium underline">
            Try again
          </button>
        </div>
      )}

      <div className="qadam-card p-5 sm:p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading profile...</p>
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
      </div>
    </main>
  );
}
