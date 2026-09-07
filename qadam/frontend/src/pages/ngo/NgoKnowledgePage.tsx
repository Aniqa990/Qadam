import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
} from "@/lib/knowledge";
import { formatDateTime } from "@/lib/utils";
import type { DocumentStatus, KnowledgeDocument } from "@/types/knowledge";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";

/* ─── Helpers ─── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain") return "TXT";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "DOCX";
  return mimeType.split("/").pop()?.toUpperCase() ?? "FILE";
}

/* ─── Status badge ─── */

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  uploaded: {
    label: "Uploaded",
    icon: Clock,
    className: "bg-slate-100 text-slate-600 ring-slate-200/80",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    className: "bg-amber-50 text-amber-800 ring-amber-200/70",
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "bg-red-50 text-red-700 ring-red-200/70",
  },
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        config.className
      )}
    >
      <Icon
        className={cn("h-3 w-3", status === "processing" && "animate-spin")}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

/* ─── Polling interval (ms) ─── */
const POLL_INTERVAL = 3000;

/* ─── Page component ─── */

/**
 * /ngo/knowledge — document management for the RAG knowledge base.
 * Supports upload (PDF/TXT/DOCX up to 10 MB), live status tracking
 * with client-side polling, and delete with confirmation.
 */
export default function NgoKnowledgePage() {
  const { api } = useApi();

  const [docs, setDocs] = useState<KnowledgeDocument[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Load documents ─── */

  const load = useCallback(() => {
    setError(null);
    listDocuments(api)
      .then(setDocs)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load documents")
      )
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  /* ─── Polling while any document is "processing" or "uploaded" ─── */

  useEffect(() => {
    const hasPending = docs?.some(
      (d) => d.status === "processing" || d.status === "uploaded"
    );
    if (!hasPending) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => {
      listDocuments(api)
        .then(setDocs)
        .catch(() => {
          /* swallow polling errors silently */
        });
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [docs, api]);

  /* ─── Upload ─── */

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await uploadDocument(api, file);
      await load();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ─── Delete ─── */

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await deleteDocument(api, id);
      setDocs((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* ─── Drag and drop ─── */

  const [dragging, setDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  };

  /* ─── Render ─── */

  if (loading) {
    return (
      <main className={ui.page}>
        <LoadingState label="Loading knowledge base..." />
      </main>
    );
  }

  return (
    <main className={cn(ui.page, "space-y-8")}>
      <div>
        <h1 className={ui.sectionTitle}>Knowledge Base</h1>
        <p className={cn(ui.sectionSub, "mt-1")}>
          Upload documents to power the AI assistant with your organization's knowledge. Supported
          formats: PDF, TXT, DOCX (max 10 MB).
        </p>
      </div>

      {/* Upload area */}
      <section
        className={cn(
          "rounded-2xl border-2 border-dashed bg-white p-8 text-center shadow-xs transition-colors",
          dragging
            ? "border-emerald-400 bg-emerald-50/40"
            : "border-slate-200 hover:border-emerald-300"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.docx"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0] ?? undefined)}
          disabled={uploading}
        />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Upload className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-800">
          {uploading ? "Uploading..." : "Drag & drop a file here, or"}
        </p>
        {!uploading && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(ui.btnPrimary, "mt-3")}
          >
            Choose file
          </button>
        )}
        {uploading && (
          <Loader2
            className="mx-auto mt-3 h-5 w-5 animate-spin text-emerald-700"
            aria-hidden="true"
          />
        )}
        {uploadError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {uploadError}
          </p>
        )}
      </section>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && docs !== null && (
        <section>
          {docs.length === 0 ? (
            <EmptyState
              title="No documents uploaded"
              description="Upload your first document above to start building your knowledge base."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">File</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Size</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Chunks</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Uploaded</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="truncate font-medium text-slate-900">
                            {doc.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {fileTypeLabel(doc.file_type)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {doc.chunk_count ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(doc.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {confirmDeleteId === doc.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === doc.id ? "Deleting..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            disabled={deletingId === doc.id}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                            title="Delete document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
