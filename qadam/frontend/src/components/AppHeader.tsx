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
import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/auth";

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

function linkClass(isActive: boolean) {
  return cn(
    isActive ? "qadam-nav-pill-active" : "qadam-nav-pill-idle"
  );
}

/**
 * Frosted sticky header with pill nav — rendered once by ProtectedLayout.
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
      className="sticky top-0 z-50 border-b border-emerald-100/60 bg-white/80 shadow-xs backdrop-blur-md"
      role="banner"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <BrandLogo size="sm" />

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
              <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="qadam-btn-ghost ml-auto hidden text-slate-500 md:inline-flex"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="qadam-btn-ghost ml-auto md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-emerald-100/60 bg-white/95 px-4 pb-4 backdrop-blur-md md:hidden">
          <nav className="flex flex-col gap-1 pt-3" aria-label="Mobile navigation">
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
            className="qadam-btn-ghost mt-3 w-full justify-start text-slate-500"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
