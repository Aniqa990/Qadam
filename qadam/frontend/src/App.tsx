import { Route, Routes } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import BrowseProjectsPage from "./pages/shared/BrowseProjectsPage";
import AttendanceManagementPage from "./pages/ngo/AttendanceManagementPage";
import CreateProjectPage from "./pages/ngo/CreateProjectPage";
import EditProjectPage from "./pages/ngo/EditProjectPage";
import NgoDashboardPage from "./pages/ngo/NgoDashboardPage";
import NgoOnboardingPage from "./pages/ngo/NgoOnboardingPage";
import NgoProfilePage from "./pages/ngo/NgoProfilePage";
import NgoProjectsPage from "./pages/ngo/NgoProjectsPage";
import HomePage from "./pages/shared/HomePage";
import NotFoundPage from "./pages/shared/NotFoundPage";
import ProjectDetailPage from "./pages/shared/ProjectDetailPage";
import QrScannerPage from "./pages/volunteer/QrScannerPage";
import VolunteerOnboardingPage from "./pages/volunteer/VolunteerOnboardingPage";
import VolunteerProfilePage from "./pages/volunteer/VolunteerProfilePage";
import VolunteerProjectsPage from "./pages/volunteer/VolunteerProjectsPage";
import VolunteerRegistrationsPage from "./pages/volunteer/VolunteerRegistrationsPage";
import NgoGuard from "./routes/NgoGuard";
import ProtectedLayout from "./routes/ProtectedLayout";
import VolunteerGuard from "./routes/VolunteerGuard";

/**
 * Route tree matches frontend-routes.md's "Route Structure Overview"
 * exactly. Phase 2 (auth), Phase 4 (project management), Phase 5 (discovery
 * + registration) and Phase 6 (profile onboarding + QR attendance)
 * destinations are wired to real components; every other route from that doc
 * (matching, knowledge, impact, etc.) is later-phase scope and intentionally
 * not added yet - add them here as each phase builds them, don't restructure
 * this tree.
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
        <Route path="/projects" element={<BrowseProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />

        {/* Onboarding routes sit OUTSIDE the role guards on purpose: the
            guards redirect incomplete profiles to these pages, so nesting
            them inside would loop forever. Each page self-checks role and
            completion and redirects to the right destination. */}
        <Route path="/volunteer/onboarding" element={<VolunteerOnboardingPage />} />
        <Route path="/ngo/onboarding" element={<NgoOnboardingPage />} />

        {/* Volunteer routes */}
        <Route element={<VolunteerGuard />}>
          <Route path="/volunteer/projects" element={<VolunteerProjectsPage />} />
          <Route path="/volunteer/registrations" element={<VolunteerRegistrationsPage />} />
          <Route path="/volunteer/scan" element={<QrScannerPage />} />
          <Route path="/volunteer/profile" element={<VolunteerProfilePage />} />
        </Route>

        {/* NGO routes */}
        <Route element={<NgoGuard />}>
          <Route path="/ngo/dashboard" element={<NgoDashboardPage />} />
          <Route path="/ngo/projects" element={<NgoProjectsPage />} />
          <Route path="/ngo/projects/new" element={<CreateProjectPage />} />
          <Route path="/ngo/projects/:id/edit" element={<EditProjectPage />} />
          <Route path="/ngo/projects/:id/attendance" element={<AttendanceManagementPage />} />
          <Route path="/ngo/profile" element={<NgoProfilePage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
