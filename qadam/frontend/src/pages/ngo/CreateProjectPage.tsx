import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import CopilotPanel from "@/components/CopilotPanel";
import NgoNav from "@/components/NgoNav";
import ProjectForm, { type ProjectFormHandle } from "@/components/ProjectForm";
import { useApi } from "@/hooks/useApi";
import { createProject } from "@/lib/projects";

/**
 * frontend-routes.md "/ngo/projects/new" - create a project (saved as a
 * draft). The CopilotPanel sits beside the form; applying a draft populates
 * fields without submitting. On success we land on the edit page, where the
 * status controls (publish etc.) live.
 */
export default function CreateProjectPage() {
  const { api } = useApi();
  const navigate = useNavigate();
  const formRef = useRef<ProjectFormHandle>(null);

  return (
    <>
      <NgoNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold">Create a new project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell volunteers what you need help with. Nothing is public until you publish.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <ProjectForm
              ref={formRef}
              submitLabel="Save draft"
              onSubmit={async (payload) => {
                const result = await createProject(api, payload);
                navigate(`/ngo/projects/${result.id}/edit`, { replace: true });
              }}
            />
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <CopilotPanel api={api} onApply={(draft) => formRef.current?.applyDraft(draft)} />
          </div>
        </div>
      </main>
    </>
  );
}
