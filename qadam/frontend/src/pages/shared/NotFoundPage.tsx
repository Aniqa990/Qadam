import { Link } from "react-router-dom";

// frontend-routes.md "404 Route": friendly 404 with a link back to home.
export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold text-primary">404</h1>
      <p className="text-muted-foreground">This page doesn't exist.</p>
      <Link to="/" className="text-primary underline">
        Back to home
      </Link>
    </main>
  );
}
