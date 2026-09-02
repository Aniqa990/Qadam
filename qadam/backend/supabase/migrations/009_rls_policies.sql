-- 009: Row Level Security (RLS) policies
-- MVP uses backend-only authorization (Express + service-role key).
-- RLS is enabled with default-deny as defense-in-depth.
-- Service-role bypasses RLS automatically.

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
ALTER TABLE volunteers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngos                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance              ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_embeddings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_embeddings      ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- volunteers: read own data, update own data
-- =============================================================================
CREATE POLICY "volunteers_select_own"
    ON volunteers FOR SELECT
    USING (auth.uid()::text = auth_user_id);

CREATE POLICY "volunteers_update_own"
    ON volunteers FOR UPDATE
    USING (auth.uid()::text = auth_user_id);

-- =============================================================================
-- ngos: read/update own data
-- =============================================================================
CREATE POLICY "ngos_select_own"
    ON ngos FOR SELECT
    USING (auth.uid()::text = auth_user_id);

CREATE POLICY "ngos_update_own"
    ON ngos FOR UPDATE
    USING (auth.uid()::text = auth_user_id);

-- =============================================================================
-- projects: published/active readable by any authenticated user;
-- draft/completed/cancelled readable only by owning NGO.
-- Owning NGO has full R/W on their own projects.
-- =============================================================================
CREATE POLICY "projects_select_published"
    ON projects FOR SELECT
    USING (status IN ('published', 'active'));

CREATE POLICY "projects_select_own"
    ON projects FOR SELECT
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "projects_insert_own"
    ON projects FOR INSERT
    WITH CHECK (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "projects_update_own"
    ON projects FOR UPDATE
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "projects_delete_own"
    ON projects FOR DELETE
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

-- =============================================================================
-- registrations: volunteer can R/W their own; NGO can read for their projects.
-- =============================================================================
CREATE POLICY "registrations_select_own_volunteer"
    ON registrations FOR SELECT
    USING (
        volunteer_id IN (
            SELECT v.id FROM volunteers v WHERE v.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "registrations_select_own_ngo"
    ON registrations FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN ngos n ON n.id = p.ngo_id
            WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "registrations_insert_own"
    ON registrations FOR INSERT
    WITH CHECK (
        volunteer_id IN (
            SELECT v.id FROM volunteers v WHERE v.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "registrations_update_own"
    ON registrations FOR UPDATE
    USING (
        volunteer_id IN (
            SELECT v.id FROM volunteers v WHERE v.auth_user_id = auth.uid()::text
        )
    );

-- =============================================================================
-- attendance: volunteer can read own; NGO can read for their projects.
-- =============================================================================
CREATE POLICY "attendance_select_own_volunteer"
    ON attendance FOR SELECT
    USING (
        volunteer_id IN (
            SELECT v.id FROM volunteers v WHERE v.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "attendance_select_own_ngo"
    ON attendance FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN ngos n ON n.id = p.ngo_id
            WHERE n.auth_user_id = auth.uid()::text
        )
    );

-- =============================================================================
-- attendance_tokens: NGO can R/W tokens for their own projects.
-- =============================================================================
CREATE POLICY "attendance_tokens_select_own"
    ON attendance_tokens FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN ngos n ON n.id = p.ngo_id
            WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "attendance_tokens_insert_own"
    ON attendance_tokens FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN ngos n ON n.id = p.ngo_id
            WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "attendance_tokens_update_own"
    ON attendance_tokens FOR UPDATE
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN ngos n ON n.id = p.ngo_id
            WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "attendance_tokens_delete_own"
    ON attendance_tokens FOR DELETE
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN ngos n ON n.id = p.ngo_id
            WHERE n.auth_user_id = auth.uid()::text
        )
    );

-- =============================================================================
-- knowledge_documents: NGO R/W own documents
-- =============================================================================
CREATE POLICY "knowledge_documents_select_own"
    ON knowledge_documents FOR SELECT
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "knowledge_documents_insert_own"
    ON knowledge_documents FOR INSERT
    WITH CHECK (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "knowledge_documents_update_own"
    ON knowledge_documents FOR UPDATE
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "knowledge_documents_delete_own"
    ON knowledge_documents FOR DELETE
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

-- =============================================================================
-- knowledge_chunks: NGO R/W own chunks (denormalized ngo_id for efficiency)
-- =============================================================================
CREATE POLICY "knowledge_chunks_select_own"
    ON knowledge_chunks FOR SELECT
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "knowledge_chunks_insert_own"
    ON knowledge_chunks FOR INSERT
    WITH CHECK (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "knowledge_chunks_update_own"
    ON knowledge_chunks FOR UPDATE
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

CREATE POLICY "knowledge_chunks_delete_own"
    ON knowledge_chunks FOR DELETE
    USING (
        ngo_id IN (
            SELECT n.id FROM ngos n WHERE n.auth_user_id = auth.uid()::text
        )
    );

-- =============================================================================
-- Embeddings: service-role only - no policies for anon/authenticated.
-- Default-deny is sufficient; backend accesses via service-role which
-- bypasses RLS.
-- =============================================================================
