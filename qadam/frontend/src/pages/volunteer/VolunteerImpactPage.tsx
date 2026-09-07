import { Link } from "react-router-dom";
import { Award, BarChart3, Clock, FolderKanban, Sparkles } from "lucide-react";

/**
 * /volunteer/impact — placeholder for the Volunteer Impact page showing
 * personal contribution metrics: hours volunteered, projects completed,
 * skills used.
 */
export default function VolunteerImpactPage() {
  return (
    <main className="qadam-page space-y-8">
      <div>
        <h1 className="qadam-section-title">My Impact</h1>
        <p className="qadam-section-sub mt-1.5">
          See your volunteer contributions — hours served, projects completed, and the difference
          you've made.
        </p>
      </div>

      <section aria-label="Impact summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Clock}
          iconClass="bg-emerald-50 text-emerald-700"
          label="Verified hours"
          value="—"
          hint="From QR check-in & check-out"
        />
        <MetricCard
          icon={FolderKanban}
          iconClass="bg-sky-50 text-sky-700"
          label="Projects completed"
          value="—"
          hint="Events you finished attending"
        />
        <MetricCard
          icon={Sparkles}
          iconClass="bg-amber-50 text-amber-700"
          label="Skills put to work"
          value="—"
          hint="Based on your registrations"
        />
      </section>

      <section className="qadam-card space-y-4 p-5 sm:p-6" aria-label="Certificates">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Award className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Certificates</h2>
            <p className="mt-1 text-sm text-slate-500">
              Download attendance certificates from your history once you've checked out of an
              event. Personal impact totals are coming soon.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/volunteer/history" className="qadam-btn-primary">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            View attendance history
          </Link>
          <Link to="/volunteer/scan" className="qadam-btn-secondary">
            Scan to log hours
          </Link>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  iconClass: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="qadam-card-interactive flex flex-col gap-3 p-5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  );
}
