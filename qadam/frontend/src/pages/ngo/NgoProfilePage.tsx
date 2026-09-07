import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { getNgoProfile, updateNgoProfile, uploadNgoLogo } from "@/lib/profiles";
import type { NgoProfile } from "@/types/profile";
import NgoProfileForm from "@/components/NgoProfileForm";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

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
    <main className={cn(ui.pageNarrow, "space-y-8")}>
      <header className="space-y-2">
        <h1 className={ui.sectionTitle}>Organization profile</h1>
        <p className={ui.sectionSub}>
          This information is shown to volunteers alongside your projects.
        </p>
      </header>

      {saved && (
        <div
          className="rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-sm text-emerald-800"
          role="status"
        >
          Profile saved.
        </div>
      )}
      {loadError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
          role="alert"
        >
          {loadError}
          <button type="button" onClick={load} className="ml-2 font-medium underline">
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading profile...</p>
      ) : (
        <div className={ui.card}>
          <NgoProfileForm
            key={profile?.id ?? "profile"}
            initial={profile}
            submitLabel="Save changes"
            onUploadLogo={(file) => uploadNgoLogo(api, file)}
            onSubmit={async (payload) => {
              await updateNgoProfile(api, payload);
              setSaved(true);
              load();
            }}
          />
        </div>
      )}
    </main>
  );
}
