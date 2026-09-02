import { Route, Routes } from "react-router-dom";
import HealthCheckPage from "./pages/shared/HealthCheckPage";

/**
 * App shell: router outlet only for Phase 1. Per frontend-routes.md, the
 * real structure to build in later phases is:
 *   <Routes>
 *     <Route path="/login" /> <Route path="/register" />      (Phase 2, public)
 *     <Route element={<ProtectedLayout />}>                   (Phase 2+)
 *       ...shared/volunteer/ngo routes...
 *     </Route>
 *   </Routes>
 * The floating Knowledge Assistant widget mounts ONCE inside
 * `ProtectedLayout` (nav bar + outlet + assistant), not here in the root
 * App and not per-route - see frontend-routes.md "App Shell — Persistent
 * Components". Do not add it directly to this file later.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/" element={<HealthCheckPage />} />
      </Routes>
    </div>
  );
}
