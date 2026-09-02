import { Route, Routes } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import NgoOnboardingPage from "./pages/ngo/NgoOnboardingPage";
import HomePage from "./pages/shared/HomePage";
import NotFoundPage from "./pages/shared/NotFoundPage";
import VolunteerOnboardingPage from "./pages/volunteer/VolunteerOnboardingPage";
import NgoGuard from "./routes/NgoGuard";
import ProtectedLayout from "./routes/ProtectedLayout";
import VolunteerGuard from "./routes/VolunteerGuard";

/**
 * Route tree matches frontend-routes.md's "Route Structure Overview"
 * exactly. Only Phase 2 destinations are wired to real components; every
 * other route from that doc (/projects, /ngo/dashboard, /ngo/projects,
 * matching, attendance, knowledge, impact, etc.) is Phase 3+ scope and
 * intentionally not added yet - add them here as each phase builds them,
 * don't restructure this tree.
 */
export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected layout with app shell */}
      <Route element={<ProtectedLayout />}>
        {/* Shared routes */}
        <Route path="/" element={<HomePage />} />

        {/* Volunteer routes */}
        <Route element={<VolunteerGuard />}>
          <Route path="/volunteer/onboarding" element={<VolunteerOnboardingPage />} />
        </Route>

        {/* NGO routes */}
        <Route element={<NgoGuard />}>
          <Route path="/ngo/onboarding" element={<NgoOnboardingPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
