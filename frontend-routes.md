# Frontend Routes

## Route Structure Overview

The React application uses React Router with role-based routing. The app shell provides a persistent layout with navigation and the floating Knowledge Assistant widget.

```
<App>                         ← Root component
  <AuthProvider>              ← Auth context
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" />
        <Route path="/register" />

        {/* Protected layout with app shell */}
        <Route element={<ProtectedLayout />}>
          {/* Shared routes */}
          <Route path="/" />
          <Route path="/projects" />
          <Route path="/projects/:id" />

          {/* Volunteer routes */}
          <Route element={<VolunteerGuard />}>
            <Route path="/volunteer/onboarding" />
            <Route path="/volunteer/profile" />
            <Route path="/volunteer/projects" />
            <Route path="/volunteer/registrations" />
            <Route path="/volunteer/impact" />
            <Route path="/volunteer/scan" />
          </Route>

          {/* NGO routes */}
          <Route element={<NgoGuard />}>
            <Route path="/ngo/onboarding" />
            <Route path="/ngo/dashboard" />
            <Route path="/ngo/profile" />
            <Route path="/ngo/projects" />
            <Route path="/ngo/projects/new" />
            <Route path="/ngo/projects/:id/edit" />
            <Route path="/ngo/projects/:id/registrations" />
            <Route path="/ngo/projects/:id/attendance" />
            <Route path="/ngo/matching/:projectId" />
            <Route path="/ngo/knowledge" />
            <Route path="/ngo/impact" />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
</App>
```

## App Shell — Persistent Components

The `ProtectedLayout` component wraps all authenticated routes and provides:

| Component                  | Location         | Notes                                           |
|----------------------------|------------------|-------------------------------------------------|
| **Navigation bar**         | Top of viewport  | Role-aware links, user menu, logout             |
| **Floating Knowledge Assistant** | Fixed bottom-right corner | Mounted once at the layout level, **not per-route**. Opens a popup/side-panel chat on click. Calls `POST /api/ai/assistant/chat`. Visible to both Volunteer and NGO. |
| **Route outlet**           | Main content area| Renders the current route's page component      |

**Important:** The floating assistant is rendered inside `ProtectedLayout`, so it appears on every authenticated page but is never duplicated per-route. It does not appear on `/login` or `/register`.

---

## Public Routes

### `/login`

| Property      | Value                                    |
|---------------|------------------------------------------|
| **Access**    | Public (redirected to `/` if logged in)  |
| **Components**| `LoginPage`, `LoginForm`                 |
| **API calls** | `POST /api/auth/login`                   |
| **Notes**     | After login, redirects to role-appropriate home. Volunteers → `/volunteer/projects`, NGOs → `/ngo/dashboard`. If onboarding incomplete → redirect to onboarding. |

### `/register`

| Property      | Value                                    |
|---------------|------------------------------------------|
| **Access**    | Public (redirected to `/` if logged in)  |
| **Components**| `RegisterPage`, `RegisterForm`           |
| **API calls** | `POST /api/auth/signup`                  |
| **Notes**     | Role selection (Volunteer / NGO) in the form. After signup → redirect to onboarding. |

---

## Shared Routes (Both Roles)

### `/` — Home / Landing

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Any authenticated user                        |
| **Components**| `HomePage`, `HeroSection`, `FeaturedProjects`, `StatsOverview` |
| **API calls** | `GET /api/projects?limit=6&status=active`, `GET /api/auth/me` |
| **Notes**     | Dashboard-like landing showing featured projects and quick stats. Role-specific CTAs. |

### `/projects` — Browse Projects

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Any authenticated user                        |
| **Components**| `ProjectsPage`, `ProjectCard`, `ProjectFilters`, `Pagination` |
| **API calls** | `GET /api/projects?page=&limit=&category=&search=&status=` |
| **Notes**     | Volunteers see published/active projects. NGOs see their own projects + public ones. |

### `/projects/:id` — Project Detail

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Any authenticated user (drafts only visible to owning NGO) |
| **Components**| `ProjectDetailPage`, `ProjectInfo`, `RegistrationButton` (volunteers), `ProjectActions` (NGO owner) |
| **API calls** | `GET /api/projects/:id`                       |
| **Notes**     | Volunteers see a "Register" button (calls `POST /api/registrations`). NGO owner sees edit/status controls. |

---

## Volunteer Routes

### `/volunteer/onboarding` — Volunteer Onboarding

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Volunteer only (redirected here if `onboarding_complete = false`) |
| **Components**| `VolunteerOnboardingPage`, `MultiStepForm` (personal info → skills & interests → availability & location → review) |
| **API calls** | `POST /api/volunteers/profile`, `GET /api/auth/me` |
| **Notes**     | Multi-step wizard. On completion, `onboarding_complete` becomes `true`. |

### `/volunteer/profile` — Edit Profile

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Volunteer only (requires onboarding complete) |
| **Components**| `VolunteerProfilePage`, `ProfileForm`         |
| **API calls** | `GET /api/volunteers/profile`, `PUT /api/volunteers/profile` |
| **Notes**     | Edit skills, interests, availability, location. Changes trigger embedding regeneration on the backend. |

### `/volunteer/projects` — My Projects

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Volunteer only                                |
| **Components**| `VolunteerProjectsPage`, `ProjectCard`, `RecommendedProjects` |
| **API calls** | `GET /api/matching/projects?limit=10`, `GET /api/registrations` |
| **Notes**     | Shows recommended projects (matching) at top, then registered projects below. |

### `/volunteer/registrations` — My Registrations

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Volunteer only                                |
| **Components**| `VolunteerRegistrationsPage`, `RegistrationCard` |
| **API calls** | `GET /api/registrations`                      |
| **Notes**     | List of all registrations with status. Can cancel confirmed registrations. |

### `/volunteer/impact` — Personal Impact

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Volunteer only                                |
| **Components**| `VolunteerImpactPage`, `ImpactStats`, `HoursChart` (Recharts), `CausesBreakdown`, `RecentActivity` |
| **API calls** | `GET /api/impact/volunteer`                   |
| **Notes**     | Shows total hours, projects count, causes breakdown chart, recent activity timeline. |

### `/volunteer/scan` — QR Scanner

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Volunteer only                                |
| **Components**| `QRScannerPage`, `QRScanner` (html5-qrcode), `ScanResult` |
| **API calls** | `POST /api/attendance/check-in` or `POST /api/attendance/check-out` |
| **Notes**     | Uses browser camera via `html5-qrcode`. Scans QR token → sends to backend → shows result (checked in / checked out / error). |

---

## NGO Routes

### `/ngo/onboarding` — NGO Onboarding

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only (redirected here if `onboarding_complete = false`) |
| **Components**| `NgoOnboardingPage`, `NgoOnboardingForm`      |
| **API calls** | `POST /api/ngos/profile`, `GET /api/auth/me`  |
| **Notes**     | Organization details form. On completion, `onboarding_complete` becomes `true`. |

### `/ngo/dashboard` — NGO Dashboard

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only (requires onboarding complete)       |
| **Components**| `NgoDashboardPage`, `ProjectSummaryCards`, `RecentRegistrations`, `QuickStats` |
| **API calls** | `GET /api/projects` (own), `GET /api/registrations` (own projects, recent) |
| **Notes**     | Overview of projects, recent registrations, quick stats (total projects, active, volunteers). |

### `/ngo/profile` — Edit NGO Profile

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only                                      |
| **Components**| `NgoProfilePage`, `NgoProfileForm`            |
| **API calls** | `GET /api/ngos/profile`, `PUT /api/ngos/profile` |
| **Notes**     | Edit organization details, categories, location. |

### `/ngo/projects` — Manage Projects

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only                                      |
| **Components**| `NgoProjectsPage`, `ProjectCard`, `ProjectStatusBadge`, `CreateProjectButton` |
| **API calls** | `GET /api/projects` (own, all statuses)       |
| **Notes**     | List all own projects with status badges. Links to create, edit, view registrations, manage attendance. |

### `/ngo/projects/new` — Create Project (with Copilot)

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only                                      |
| **Components**| `CreateProjectPage`, `ProjectForm`, **`CopilotPanel`** |
| **API calls** | `POST /api/ai/copilot/draft`, `POST /api/projects` |
| **Notes**     | **This is the only route where the Project Copilot panel appears.** The `CopilotPanel` is an inline panel or drawer next to the project form. NGO types a brief → Copilot returns a structured draft → NGO reviews/edits in the form → explicitly clicks "Create Project" → calls `POST /api/projects`. |

### `/ngo/projects/:id/edit` — Edit Project (with Copilot)

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only (must own the project)               |
| **Components**| `EditProjectPage`, `ProjectForm`, **`CopilotPanel`**, `ProjectStatusControls` |
| **API calls** | `GET /api/projects/:id`, `PUT /api/projects/:id`, `POST /api/ai/copilot/draft`, `POST /api/projects/:id/publish`, `POST /api/projects/:id/activate`, `POST /api/projects/:id/complete`, `POST /api/projects/:id/cancel` |
| **Notes**     | **Copilot panel also available here** to help refine the project. Status transition buttons shown based on current status. |

### `/ngo/projects/:id/registrations` — Project Registrations

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only (must own the project)               |
| **Components**| `ProjectRegistrationsPage`, `RegistrationTable` |
| **API calls** | `GET /api/registrations?project_id=:id`       |
| **Notes**     | Table of registered volunteers with name, skills, registration date. Can cancel registrations. |

### `/ngo/projects/:id/attendance` — Attendance Management

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only (must own the project)               |
| **Components**| `AttendanceManagementPage`, `EventList`, `CreateEventForm`, `QRCodeDisplay` (qrcode library), `AttendanceTable` |
| **API calls** | `GET /api/attendance/events?project_id=:id`, `POST /api/attendance/events`, `GET /api/attendance/events/:eventId/qr`, `GET /api/attendance?event_id=:eventId` |
| **Notes**     | Create attendance events, display QR codes for scanning, view check-in/check-out records. |

### `/ngo/matching/:projectId` — Volunteer Matching

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only (must own the project)               |
| **Components**| `MatchingPage`, `MatchCard`, `ScoreBreakdown`, `MatchFilters` |
| **API calls** | `GET /api/matching/volunteers/:projectId?limit=20` |
| **Notes**     | Ranked list of volunteer matches with composite score and per-factor breakdown. Each card shows matched skills, interests, distance, and embedding similarity. |

### `/ngo/knowledge` — Knowledge Base Management

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only                                      |
| **Components**| `KnowledgePage`, `DocumentUpload`, `DocumentList`, `DocumentStatus` |
| **API calls** | `GET /api/knowledge/documents`, `POST /api/knowledge/documents`, `DELETE /api/knowledge/documents/:id` |
| **Notes**     | Upload documents for RAG. View processing status (uploaded / processing / ready / failed). Delete documents. The uploaded documents power the Knowledge Assistant for this NGO. |

### `/ngo/impact` — NGO Impact Dashboard

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | NGO only                                      |
| **Components**| `NgoImpactPage`, `ImpactStats`, `HoursOverTimeChart` (Recharts), `CategoryBreakdownChart` (Recharts), `TopVolunteersTable`, `NarrativePanel` |
| **API calls** | `GET /api/impact/ngo`, `POST /api/impact/ngo/narrative` (on demand) |
| **Notes**     | Verified metrics: total hours, volunteer count, project counts, category breakdown charts, monthly hours chart, top volunteers. "Generate AI Summary" button triggers narrative generation (optional). |

---

## 404 Route

### `*` — Not Found

| Property      | Value                                         |
|---------------|-----------------------------------------------|
| **Access**    | Anyone                                        |
| **Components**| `NotFoundPage`                                |
| **Notes**     | Friendly 404 page with link back to home.     |

---

## Route Guards Summary

| Guard               | Logic                                                                   |
|---------------------|-------------------------------------------------------------------------|
| `ProtectedLayout`   | Redirects to `/login` if not authenticated. Provides nav + floating assistant. |
| `VolunteerGuard`    | Redirects to `/login` if not authenticated. Redirects to `/ngo/dashboard` if role is NGO. Redirects to `/volunteer/onboarding` if onboarding incomplete. |
| `NgoGuard`          | Redirects to `/login` if not authenticated. Redirects to `/volunteer/projects` if role is volunteer. Redirects to `/ngo/onboarding` if onboarding incomplete. |

---

## Floating Assistant vs. Copilot — Placement Summary

| Surface              | Where it lives                    | Where it does NOT appear              |
|----------------------|-----------------------------------|---------------------------------------|
| Knowledge Assistant  | `ProtectedLayout` (app shell)     | `/login`, `/register`                 |
|                      | Every authenticated route         | Any unauthenticated page              |
|                      | Fixed bottom-right corner         | Inside any specific page content      |
| Project Copilot      | `/ngo/projects/new`               | Any route other than create/edit      |
|                      | `/ngo/projects/:id/edit`          | Volunteer routes, shared routes       |
|                      | Inline panel next to project form | The floating widget                   |
