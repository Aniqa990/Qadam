import { BarChart3 } from "lucide-react";

/**
 * /ngo/impact — placeholder for the NGO Impact dashboard showing
 * aggregate volunteer hours, project count, and community metrics.
 */
export default function NgoImpactPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
      <BarChart3 className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Impact Dashboard</h1>
      <p className="text-muted-foreground">
        View your organization's community impact — volunteer hours, project
        outcomes, and engagement metrics. Coming soon.
      </p>
    </main>
  );
}
