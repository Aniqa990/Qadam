/**
 * API wrappers for the NGO Knowledge module (api-contracts.md "Knowledge Module").
 * These functions are pre-bound to a session-aware fetcher by the caller
 * (typically via useApi()), so components never handle tokens directly.
 */

import type { KnowledgeDocument, KnowledgeUploadResult } from "@/types/knowledge";

/** Curried fetcher type from useApi(). */
type ApiFetcher = <T>(path: string, init?: RequestInit) => Promise<T>;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — matches backend multer limit

/**
 * Upload a document via multipart/form-data. The caller should check
 * file size before calling; this function also surfaces the backend's
 * 10 MB enforcement as an error.
 */
export function uploadDocument(api: ApiFetcher, file: File): Promise<KnowledgeUploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    return Promise.reject(new Error("File exceeds the 10 MB limit"));
  }
  const formData = new FormData();
  formData.append("file", file);
  // apiFetch detects FormData and omits Content-Type so the browser sets
  // the multipart boundary automatically.
  return api<KnowledgeUploadResult>("/knowledge/documents", {
    method: "POST",
    body: formData,
  });
}

/** List all documents for the authenticated NGO (flat array, not paginated). */
export function listDocuments(api: ApiFetcher): Promise<KnowledgeDocument[]> {
  return api<KnowledgeDocument[]>("/knowledge/documents");
}

/** Delete a document and all its chunks. */
export function deleteDocument(api: ApiFetcher, id: string): Promise<{ message: string }> {
  return api<{ message: string }>(`/knowledge/documents/${id}`, { method: "DELETE" });
}
