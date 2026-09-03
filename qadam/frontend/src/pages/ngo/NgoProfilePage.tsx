import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { getNgoProfile, updateNgoProfile } from "@/lib/profiles";
import type { NgoProfile } from "@/types/profile";
import NgoProfileForm from "@/components/NgoProfileForm";

/**
 * /ngo/profile (frontend-routes.md) - edit the organization profile shown to
 * volunteers. Reuses the onboarding form component pre-filled with the
 * stored profile.
 */
export default function NgoProfilePage() {
  const { api } = useApi();
  const [profile, setProfile] = useState<NgoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getNgoProfile(api)
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
          <h1 className="text-2xl font-bold">Organization profile</h1>
          <p className="mt-2 text-muted-foreground">
            This information is shown to volunteers alongside your projects.
          </p>
        </header>

        {saved && (
          <div className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-600" role="status">
            Profile saved.
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
          <NgoProfileForm
            key={profile?.id ?? "profile"}
            initial={profile}
            submitLabel="Save changes"
            onSubmit={async (payload) => {
              await updateNgoProfile(api, payload);
              setSaved(true);
              load();
            }}
          />
        )}
      </main>
    </>
  );
}
