import { useClerk } from "@clerk/clerk-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Compass,
  History,
  Home,
  LogOut,
  Menu,
  QrCode,
  Target,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/auth";

/* ─── Navigation link definitions ─── */

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

const NGO_LINKS: NavItem[] = [
  { to: "/ngo/dashboard", label: "Dashboard", icon: Home },
  { to: "/ngo/projects", label: "My Projects", icon: ClipboardList },
  { to: "/ngo/knowledge", label: "Knowledge Base", icon: BookOpen },
  { to: "/ngo/impact", label: "Impact", icon: BarChart3 },
  { to: "/ngo/profile", label: "Organization", icon: Users },
];

const VOLUNTEER_LINKS: NavItem[] = [
  { to: "/projects", label: "Browse Projects", icon: Compass },
  { to: "/volunteer/projects", label: "My Projects", icon: ClipboardList },
  { to: "/volunteer/registrations", label: "My Registrations", icon: Target },
  { to: "/volunteer/history", label: "History", icon: History },
  { to: "/volunteer/impact", label: "Impact", icon: BarChart3 },
  { to: "/volunteer/scan", label: "QR Scan", icon: QrCode },
  { to: "/volunteer/profile", label: "Profile", icon: User },
];

/* ─── Shared NavLink styling ─── */

function linkClass(isActive: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-white text-emerald-800 shadow-sm"
      : "text-emerald-100 hover:bg-emerald-600 hover:text-white"
  );
}

/* ─── Component ─── */

/**
 * Unified professional header for all authenticated pages. Renders
 * role-aware navigation tabs on a solid green background with a clear
 * active-tab indicator (white) and a sign-out button on the far right.
 *
 * Rendered once by ProtectedLayout — never imported by individual pages.
 */
export default function AppHeader({ role }: { role: AppRole }) {
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = role === "ngo" ? NGO_LINKS : VOLUNTEER_LINKS;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header
      className="sticky top-0 z-50 bg-emerald-700 shadow-sm"
      role="banner"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
        {/* Brand mark */}
        <span className="mr-2 text-base font-bold tracking-tight text-white select-none">
          Qadam
        </span>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary navigation"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => linkClass(isActive)}
            >
              <link.icon className="h-4 w-4" aria-hidden="true" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out — pushed to far right */}
        <button
          type="button"
          onClick={handleLogout}
          className="ml-auto hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-800 hover:text-white md:inline-flex"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="ml-auto rounded-md p-1.5 text-emerald-100 hover:bg-emerald-600 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-emerald-600 bg-emerald-700 px-4 pb-4 md:hidden">
          <nav
            className="flex flex-col gap-1 pt-2"
            aria-label="Mobile navigation"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => linkClass(isActive)}
              >
                <link.icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
