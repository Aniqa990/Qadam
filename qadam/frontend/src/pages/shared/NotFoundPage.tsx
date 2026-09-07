import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";

// frontend-routes.md "404 Route": friendly 404 with a link back to home.
export default function NotFoundPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
      <div className="qadam-card max-w-md space-y-5 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">404</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            This page doesn't exist, or the link may be out of date. Head home and keep making an
            impact.
          </p>
        </div>
        <Link to="/" className="qadam-btn-primary inline-flex">
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </main>
  );
}
