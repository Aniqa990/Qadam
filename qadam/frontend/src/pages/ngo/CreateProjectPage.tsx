import { useNavigate } from "react-router-dom";
import NgoNav from "@/components/NgoNav";
import ProjectForm from "@/components/ProjectForm";
import { useApi } from "@/hooks/useApi";
import { createProject } from "@/lib/projects";

/**
 * frontend-routes.md "/ngo/projects/new" - create a project (saved as a
 * draft). On success we land on the edit page, where the status controls
 * (publish etc.) live. The Project Copilot panel joins this page in Phase 7.
 */
export default function CreateProjectPage() {
  const { api } = useApi();
  const navigate = useNavigate();

  return (
    <>
      <NgoNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Create a new project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell volunteers what you need help with. Nothing is public until you publish.
        </p>

        <div className="mt-8">
          <ProjectForm
            submitLabel="Save draft"
            onSubmit={async (payload) => {
              const result = await createProject(api, payload);
              navigate(`/ngo/projects/${result.id}/edit`, { replace: true });
            }}
          />
        </div>
      </main>
    </>
  );
}
