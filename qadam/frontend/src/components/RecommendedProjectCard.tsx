import { Link } from "react-router-dom";
import { MapPin, Sparkles, Target, ArrowRight } from "lucide-react";
import type { ProjectMatch } from "@/types/matching";
import { CompositeBadge, ScoreBreakdown } from "./MatchCard";
import NgoLogo from "./NgoLogo";

/**
 * Compact recommended-project card shown in the volunteer's "Recommended
 * for You" section on /volunteer/projects. Displays composite score,
 * key matching factors, and a link to the project detail page.
 */
export default function RecommendedProjectCard({
  match,
}: {
  match: ProjectMatch;
}) {
  const {
    distance_km,
    skills_match,
    embedding_similarity,
  } = match.reasons;

  return (
    <Link
      to={`/projects/${match.project_id}`}
      className="qadam-card-interactive group flex h-full flex-col p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
    >
      {/* Header: title + composite badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-emerald-700">
            {match.project_title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <NgoLogo
              ngoName={match.ngo_name}
              logoUrl={match.ngo_logo_url}
              className="h-4 w-4 text-[8px]"
            />
            <span className="truncate">{match.ngo_name}</span>
          </p>
        </div>
        <CompositeBadge score={match.composite_score} />
      </div>

      {/* Quick match indicators */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {distance_km != null && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            {distance_km.toFixed(1)} km
          </span>
        )}
        {skills_match.matched.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Target className="h-3.5 w-3.5 text-emerald-600" />
            {skills_match.matched.length} skill{skills_match.matched.length !== 1 ? "s" : ""} matched
          </span>
        )}
        {embedding_similarity >= 0.6 && (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Similar profile
          </span>
        )}
      </div>

      {/* Expandable breakdown (always visible for MVP clarity) */}
      <div className="mt-4">
        <ScoreBreakdown reasons={match.reasons} />
      </div>

      {/* CTA */}
      <div className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-emerald-700">
        View project
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
