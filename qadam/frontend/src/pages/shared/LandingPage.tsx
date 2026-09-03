import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import {
  Heart,
  Users,
  MapPin,
  Clock,
  HandHeart,
  Target,
  QrCode,
  BookOpen,
  CalendarDays,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import type { ProjectSummary } from "@/types/project";
import { apiFetchList } from "@/lib/api";
import { formatDateRange } from "@/lib/utils";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";

/**
 * Public landing page for unauthenticated visitors.
 * Shown at "/" when no Clerk session is active. Authenticated users with
 * completed onboarding are redirected by HomePage before this renders.
 */
export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [featuredProjects, setFeaturedProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await apiFetchList<ProjectSummary>(
          "/projects?status=active&limit=6&page=1"
        );
        if (!cancelled) setFeaturedProjects(result.data);
      } catch {
        if (!cancelled) setFeaturedProjects([]);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar isSignedIn={isSignedIn} />
      <HeroSection />
      <ImpactStats />
      <FeaturesSection />
      <FeaturedProjects projects={featuredProjects} loading={loadingProjects} />
      <CtaSection />
      <Footer />
    </div>
  );
}

/* ────────────────────────── Navigation ────────────────────────── */

function Navbar({ isSignedIn }: { isSignedIn: boolean | undefined }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2" aria-label="Qadam home">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700">
            <Heart className="h-5 w-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Qadam
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="/projects"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            Explore Projects
          </a>
          <a
            href="#for-ngos"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            For NGOs
          </a>
          <a
            href="#about"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            About Us
          </a>
        </nav>

        {/* Desktop auth */}
        <div className="hidden items-center gap-3 md:flex">
          {isSignedIn ? (
            <Link
              to="/projects"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800">
                  Get Started
                </button>
              </SignUpButton>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="h-6 w-6 text-slate-700" />
          ) : (
            <Menu className="h-6 w-6 text-slate-700" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-3 pt-3">
            <a
              href="/projects"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Explore Projects
            </a>
            <a
              href="#for-ngos"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              For NGOs
            </a>
            <a
              href="#about"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              About Us
            </a>
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            {isSignedIn ? (
              <Link
                to="/projects"
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white">
                    Get Started
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ────────────────────────── Hero Section ────────────────────────── */

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-10">
        <img
          src="https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1920&q=60&auto=format"
          alt=""
          className="h-full w-full object-cover"
          aria-hidden="true"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Copy */}
          <div className="text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200 backdrop-blur-sm">
              <HandHeart className="h-3.5 w-3.5" />
              AI-Powered Volunteer Matching
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Empowering Communities,{" "}
              <span className="text-emerald-300">Connecting Hands</span>
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              Qadam connects NGOs with the right volunteers through
              skills-based matching, verified impact tracking, and a community
              that believes in doing good — together.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SignUpButton mode="modal">
                <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-emerald-800 shadow-lg transition-all hover:bg-emerald-50 hover:shadow-xl">
                  Find Opportunities
                  <ArrowRight className="h-4 w-4" />
                </button>
              </SignUpButton>
              <a
                href="#for-ngos"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Partner Your NGO
              </a>
            </div>

            {/* Trust line */}
            <p className="mt-6 text-xs text-slate-400">
              Trusted by 50+ NGOs across Pakistan. No fees, ever.
            </p>
          </div>

          {/* Right: Image */}
          <div className="relative hidden lg:block">
            <div className="overflow-hidden rounded-2xl shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=600&fit=crop&q=80&auto=format"
                alt="Volunteers working together on a community project"
                className="h-full w-full object-cover"
              />
            </div>
            {/* Floating stat card */}
            <div className="absolute -bottom-6 -left-6 rounded-xl bg-white p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <Users className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">2,400+</p>
                  <p className="text-xs text-slate-500">Active Volunteers</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Impact Stats ────────────────────────── */

function ImpactStats() {
  const stats = [
    {
      value: "12,500+",
      label: "Verified Volunteer Hours",
      icon: Clock,
    },
    {
      value: "180+",
      label: "Community Projects",
      icon: Target,
    },
    {
      value: "52",
      label: "Partner NGOs",
      icon: HandHeart,
    },
    {
      value: "8,000+",
      label: "Lives Impacted",
      icon: Heart,
    },
  ];

  return (
    <section className="border-b border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <stat.icon className="h-6 w-6 text-emerald-700" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Features Section ────────────────────────── */

function FeaturesSection() {
  const features = [
    {
      icon: Target,
      title: "Skills-Based Matching",
      description:
        "Our AI analyzes volunteer skills, interests, and experience to find the perfect match for every project — no more manual sorting through hundreds of applications.",
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      icon: QrCode,
      title: "QR Attendance & Verified Hours",
      description:
        "Every volunteer session is verified through QR check-in. Transparent tracking that builds trust and recognizes real commitment.",
      color: "bg-amber-100 text-amber-700",
    },
    {
      icon: BookOpen,
      title: "Knowledge Assistant",
      description:
        "A dedicated assistant for NGOs — grounded in your own documents and verified metrics. Ask questions, get guidance, make better decisions.",
      color: "bg-sky-100 text-sky-700",
    },
  ];

  return (
    <section id="about" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            How Qadam Works
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Built for Real Impact
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Every feature is designed to remove friction between people who
            want to help and the organizations that need them.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-slate-100 bg-white p-8 transition-all hover:border-slate-200 hover:shadow-lg"
            >
              <div
                className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-3 leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Featured Projects ────────────────────────── */

function FeaturedProjects({
  projects,
  loading,
}: {
  projects: ProjectSummary[];
  loading: boolean;
}) {
  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Make a Difference
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Active Opportunities
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Browse verified volunteer opportunities from trusted NGOs across
            the country.
          </p>
        </div>

        <div className="mt-12">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-xl bg-slate-200"
                />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((project) => (
                <LandingProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-lg font-medium text-slate-700">
                Opportunities Coming Soon
              </p>
              <p className="mt-2 text-slate-500">
                NGOs are publishing new projects. Check back soon or sign up
                to be notified.
              </p>
              <SignUpButton mode="modal">
                <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800">
                  Get Notified
                  <ArrowRight className="h-4 w-4" />
                </button>
              </SignUpButton>
            </div>
          )}
        </div>

        {projects.length > 0 && (
          <div className="mt-10 text-center">
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800"
            >
              View All Projects
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function LandingProjectCard({ project }: { project: ProjectSummary }) {
  const fillPercent =
    project.capacity > 0
      ? Math.min(
          100,
          Math.round((project.registered_count / project.capacity) * 100)
        )
      : 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-lg"
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-700">
            {project.category.replace(/-/g, " ")}
          </span>
          <ProjectStatusBadge status={project.status} />
        </div>

        <h3 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-emerald-700">
          {project.title}
        </h3>

        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {project.description}
        </p>

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {project.location_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {project.location_name}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateRange(project.start_date, project.end_date)}
            </span>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {project.registered_count} / {project.capacity}
              </span>
              <span>{fillPercent}% filled</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ────────────────────────── CTA Section ────────────────────────── */

function CtaSection() {
  return (
    <section
      id="for-ngos"
      className="bg-gradient-to-br from-emerald-800 to-emerald-900 py-20"
    >
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to Make an Impact?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-emerald-100">
          Whether you&apos;re an NGO looking for dedicated volunteers or an
          individual ready to give back — Qadam brings you the tools, the
          matches, and the verified impact tracking you need.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <SignUpButton mode="modal">
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-emerald-800 shadow-lg transition-all hover:bg-emerald-50 sm:w-auto">
              Join as Volunteer
              <ArrowRight className="h-4 w-4" />
            </button>
          </SignUpButton>
          <SignUpButton mode="modal">
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto">
              Register Your NGO
            </button>
          </SignUpButton>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Footer ────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 py-12 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700">
                <Heart className="h-4 w-4 text-white" fill="white" />
              </div>
              <span className="text-lg font-bold text-white">Qadam</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              AI-powered volunteer platform connecting NGOs with the right
              people and measuring real community impact.
            </p>
          </div>

          {/* For Volunteers */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              For Volunteers
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="/projects"
                  className="transition-colors hover:text-white"
                >
                  Browse Projects
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Volunteer Guide
                </a>
              </li>
            </ul>
          </div>

          {/* For NGOs */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              For Organizations
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Register Your NGO
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Post a Project
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Impact Dashboard
                </a>
              </li>
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Platform
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#about" className="transition-colors hover:text-white">
                  About Qadam
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 md:flex-row">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Qadam. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Verified Impact Tracking
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Free Forever
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
