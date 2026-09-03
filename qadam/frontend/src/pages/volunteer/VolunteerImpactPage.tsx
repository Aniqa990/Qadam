import { BarChart3 } from "lucide-react";

/**
 * /volunteer/impact — placeholder for the Volunteer Impact page showing
 * personal contribution metrics: hours volunteered, projects completed,
 * skills used.
 */
export default function VolunteerImpactPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
      <BarChart3 className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">My Impact</h1>
      <p className="text-muted-foreground">
        See your volunteer contributions — hours served, projects completed,
        and the difference you've made. Coming soon.
      </p>
    </main>
  );
}
