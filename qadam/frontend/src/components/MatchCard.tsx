import { MapPin, Sparkles, Target, Heart, TrendingUp } from "lucide-react";
import type { MatchReasons, VolunteerMatch } from "@/types/matching";
import { cn } from "@/lib/utils";

/* ─── Shared score helpers ─── */

function scoreColor(score: number): string {
  if (score >= 0.7) return "bg-emerald-500";
  if (score >= 0.4) return "bg-amber-500";
  return "bg-slate-300";
}

function scoreBadgeBg(score: number): string {
  if (score >= 0.7) return "bg-emerald-100 text-emerald-800";
  if (score >= 0.4) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

/** Thin progress bar with colour tiers. */
function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.round(score * 100);
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      aria-hidden="true"
    >
      <div
        className={cn("h-full rounded-full transition-all", scoreColor(score))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Weight label with factor name and percentage weight. */
function FactorLabel({
  icon: Icon,
  label,
  weight,
}: {
  icon: typeof MapPin;
  label: string;
  weight: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground/60">({weight})</span>
    </div>
  );
}

/* ─── Score Breakdown (shared between MatchCard and RecommendedProjectCard) ─── */

export function ScoreBreakdown({ reasons }: { reasons: MatchReasons }) {
  const {
    distance_km,
    distance_score,
    skills_match,
    interests_match,
    embedding_similarity,
  } = reasons;

  return (
    <div className="space-y-3">
      {/* Distance */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <FactorLabel icon={MapPin} label="Distance" weight="35%" />
          <span className="text-xs font-medium tabular-nums">
            {distance_km != null
              ? `${distance_km.toFixed(1)} km`
              : "No location"}
          </span>
        </div>
        <ScoreBar score={distance_score} />
      </div>

      {/* Skills */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <FactorLabel icon={Target} label="Skills" weight="30%" />
          <span className="text-xs font-medium tabular-nums">
            {Math.round(skills_match.score * 100)}%
          </span>
        </div>
        <ScoreBar score={skills_match.score} />
        {skills_match.matched.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {skills_match.matched.map((s) => (
              <span
                key={s}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              >
                {s}
              </span>
            ))}
            {skills_match.missing.map((s) => (
              <span
                key={s}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 line-through"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Embedding */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <FactorLabel icon={Sparkles} label="Embedding" weight="20%" />
          <span className="text-xs font-medium tabular-nums">
            {Math.round(embedding_similarity * 100)}%
          </span>
        </div>
        <ScoreBar score={embedding_similarity} />
      </div>

      {/* Interests */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <FactorLabel icon={Heart} label="Interests" weight="15%" />
          <span className="text-xs font-medium tabular-nums">
            {Math.round(interests_match.score * 100)}%
          </span>
        </div>
        <ScoreBar score={interests_match.score} />
        {interests_match.matched.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {interests_match.matched.map((i) => (
              <span
                key={i}
                className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"
              >
                {i}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Composite Score Badge ─── */

export function CompositeBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div
      className={cn(
        "flex h-14 w-14 flex-col items-center justify-center rounded-xl font-bold tabular-nums",
        scoreBadgeBg(score)
      )}
    >
      <span className="text-lg leading-none">{pct}%</span>
      <span className="text-[10px] font-normal leading-none opacity-70">match</span>
    </div>
  );
}

/* ─── MatchCard (NGO view — one volunteer match) ─── */

/**
 * Displays a single volunteer match with composite score badge,
 * per-factor score breakdown, and human-readable reasons.
 * Used on the NGO MatchingPage for a specific project.
 */
export default function MatchCard({
  match,
  rank,
}: {
  match: VolunteerMatch;
  rank: number;
}) {
  return (
    <div className="rounded-xl border bg-background p-5 transition-colors hover:border-ring">
      {/* Header: rank + name + composite badge */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            {rank}
          </span>
          <div>
            <h3 className="font-semibold text-foreground">
              {match.volunteer_name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {match.reasons.distance_km != null
                ? `${match.reasons.distance_km.toFixed(1)} km away`
                : "Location not set"}
            </p>
          </div>
        </div>
        <CompositeBadge score={match.composite_score} />
      </div>

      {/* Divider */}
      <div className="my-4 border-t" aria-hidden="true" />

      {/* Score breakdown */}
      <ScoreBreakdown reasons={match.reasons} />

      {/* Human-readable summary */}
      <div className="mt-4 rounded-lg bg-secondary/50 p-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {buildReasonSummary(match.reasons, match.volunteer_name)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Reason summary builder ─── */

function buildReasonSummary(reasons: MatchReasons, name: string): string {
  const parts: string[] = [];

  if (reasons.skills_match.matched.length > 0) {
    const skills = reasons.skills_match.matched.slice(0, 3).join(", ");
    parts.push(`matches on ${skills}`);
  }

  if (reasons.interests_match.matched.length > 0) {
    const interests = reasons.interests_match.matched.slice(0, 2).join(", ");
    parts.push(`interested in ${interests}`);
  }

  if (reasons.distance_km != null && reasons.distance_km < 20) {
    parts.push(`only ${reasons.distance_km.toFixed(1)} km away`);
  }

  if (reasons.embedding_similarity >= 0.7) {
    parts.push("strong profile similarity");
  }

  if (parts.length === 0) {
    return `${name} is a potential match based on overall profile alignment.`;
  }

  return `${name} ${parts.join(", ")}.`;
}
