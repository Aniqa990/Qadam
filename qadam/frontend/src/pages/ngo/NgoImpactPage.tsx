import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClipboardList, Clock, Plus, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useApi } from "@/hooks/useApi";
import { getNgoImpact } from "@/lib/impact";
import { ui } from "@/lib/ui";
import { cn, formatHours } from "@/lib/utils";
import type { NgoImpactMetrics } from "@/types/impact";

/**
 * frontend-routes.md "/ngo/impact" - the NGO Impact Dashboard. Every number
 * comes from GET /api/impact/ngo, which aggregates projects + registrations +
 * attendance in PostgreSQL (no AI, no client-side math). Summary cards up
 * top, then the cause / location / monthly breakdowns as Recharts charts.
 */
export default function NgoImpactPage() {
  const { api } = useApi();

  const [metrics, setMetrics] = useState<NgoImpactMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getNgoImpact(api)
      .then(setMetrics)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load impact metrics")
      );
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // The charts plot verified hours, so they share one empty condition.
  const hasHours = metrics !== null && metrics.total_hours > 0;

  return (
    <main className={cn(ui.page, "space-y-8")}>
      <div>
        <h1 className={ui.sectionTitle}>Impact Dashboard</h1>
        <p className={cn(ui.sectionSub, "mt-1")}>
          Your organization's verified community impact, measured from registrations and QR
          attendance.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && metrics === null && <LoadingState label="Loading your impact..." />}

      {!error && metrics !== null && (
        metrics.total_projects === 0 ? (
          <EmptyState
            title="No impact to show yet"
            description="Create your first project — once volunteers register and check in with QR attendance, your verified impact metrics will appear here."
            action={
              <Link to="/ngo/projects/new" className={ui.btnPrimary}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create your first project
              </Link>
            }
          />
        ) : (
          <>
            <section aria-label="Impact summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <SummaryCard
                icon={ClipboardList}
                iconClass="bg-emerald-50 text-emerald-700"
                label="Projects"
                value={metrics.total_projects.toLocaleString()}
                hint={`${metrics.active_projects} active · ${metrics.completed_projects} completed`}
              />
              <SummaryCard
                icon={Users}
                iconClass="bg-sky-50 text-sky-700"
                label="Volunteers"
                value={metrics.total_volunteers.toLocaleString()}
                hint="with confirmed registrations"
              />
              <SummaryCard
                icon={Clock}
                iconClass="bg-amber-50 text-amber-700"
                label="Verified Hours"
                value={formatHours(metrics.total_hours)}
                hint="from QR check-in and check-out"
              />
              <SummaryCard
                icon={TrendingUp}
                iconClass="bg-violet-50 text-violet-700"
                label="Attendance Rate"
                value={formatRate(metrics.attendance_rate)}
                hint="volunteers who checked in at least once"
              />
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Hours by Cause"
                description="Verified volunteer hours per project category."
                empty={!hasHours}
                chartLabel="Bar chart of verified volunteer hours by cause"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.by_cause} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tickFormatter={formatCause}
                      width={110}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => formatHours(Number(value))}
                      cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
                    />
                    <Bar dataKey="hours" fill={PRIMARY_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Hours by Location"
                description="Verified volunteer hours per project location."
                empty={!hasHours}
                chartLabel="Bar chart of verified volunteer hours by location"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.by_location}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="location"
                      tickFormatter={truncateLocation}
                      width={140}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => formatHours(Number(value))}
                      cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
                    />
                    <Bar dataKey="hours" fill={PRIMARY_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard
              title="Hours by Month"
              description="Verified volunteer hours per month of check-in."
              empty={!hasHours}
              chartLabel="Line chart of verified volunteer hours per month"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.by_month} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonth}
                    interval="preserveStartEnd"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis width={48} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatHours(Number(value))} />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke={PRIMARY_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )
      )}
    </main>
  );
}

/* ─── Presentation helpers ─── */

/** Hex of the primary token (142 71% 35%) - SVG fills can't use Tailwind classes. */
const PRIMARY_COLOR = "#1A9948";
const GRID_COLOR = "#e2e8f0";

/** "food-security" → "Food Security" for the cause axis ticks. */
function formatCause(category: string): string {
  return category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "2026-07" → "Jul 2026" for the month axis ticks. */
function formatMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** 0.7647 → "76.5%" for the attendance-rate card. */
function formatRate(rate: number): string {
  return `${(rate * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

/** Long "City, Country" labels get ellipsized on the location axis. */
function truncateLocation(location: string): string {
  return location.length > 20 ? `${location.slice(0, 19).trimEnd()}…` : location;
}

/* ─── Presentational components ─── */

function SummaryCard({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="qadam-card-interactive p-4 sm:p-5">
      <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl", iconClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  empty,
  chartLabel,
  children,
}: {
  title: string;
  description: string;
  empty: boolean;
  chartLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      {empty ? (
        <div className="mt-4 flex h-64 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <Clock className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">No verified hours yet</p>
          <p className="max-w-xs text-xs text-slate-500">
            Hours appear here once volunteers check in and check out with QR attendance on your
            projects.
          </p>
        </div>
      ) : (
        <div className="mt-4 h-64" role="img" aria-label={chartLabel}>
          {children}
        </div>
      )}
    </section>
  );
}
