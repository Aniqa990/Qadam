import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/ngo/dashboard", label: "Dashboard" },
  { to: "/ngo/projects", label: "My Projects" },
  { to: "/ngo/projects/new", label: "New Project" },
  { to: "/ngo/profile", label: "Organization" },
];

/**
 * Minimal in-module navigation for the NGO project-management pages. The
 * full role-aware NavBar is Phase 3/8 scope (ProtectedLayout); this keeps the
 * module usable until then without pre-empting that work.
 */
export default function NgoNav() {
  return (
    <nav className="border-b bg-background" aria-label="NGO navigation">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
                isActive && "bg-secondary text-foreground"
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
