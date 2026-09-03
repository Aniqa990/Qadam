/**
 * Knowledge document types matching api-contracts.md "Knowledge Module".
 * The backend returns a flat array (not paginated) for GET /api/knowledge/documents.
 */

export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

export interface KnowledgeDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  chunk_count?: number;
  created_at: string;
}

/** Shape returned by POST /api/knowledge/documents (no chunk_count yet). */
export interface KnowledgeUploadResult {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
}
