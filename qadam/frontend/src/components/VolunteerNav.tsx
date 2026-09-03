import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/projects", label: "Browse Projects" },
  { to: "/volunteer/projects", label: "My Projects" },
  { to: "/volunteer/registrations", label: "My Registrations" },
];

/**
 * Minimal in-module navigation for the volunteer discovery/registration
 * pages, mirroring NgoNav. The full role-aware NavBar is Phase 3/8 scope
 * (ProtectedLayout); this keeps the module usable until then.
 */
export default function VolunteerNav() {
  return (
    <nav className="border-b bg-background" aria-label="Volunteer navigation">
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
