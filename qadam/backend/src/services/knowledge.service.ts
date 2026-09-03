import type { RequestIdentity } from "../types/auth.types";
import { supabase } from "../lib/supabase";
import { generateEmbedding } from "./ai/embedding.service";
import { logger } from "../utils/logger";
import { AppError, AuthorizationError, NotFoundError } from "../utils/errors";

/**
 * NGO knowledge document ingestion pipeline
 * (ai-architecture.md "RAG ingestion").
 *
 * Flow:
 *   1. NGO uploads a file (PDF / DOCX / TXT, max 10 MB)
 *   2. File stored in Supabase Storage at knowledge/{ngo_id}/{document_id}/{file_name}
 *   3. Text extracted (pdf-parse for PDF, mammoth for DOCX, native for TXT)
 *   4. Text chunked (~500-token chunks with ~50-token overlap)
 *   5. Each chunk embedded via Hugging Face Inference API
 *   6. Chunks + embeddings stored in knowledge_chunks
 *   7. Document status transitions: uploaded -> processing -> ready | failed
 *
 * MVP bounds (per AGENTS.md):
 *   - 10 MB max file size (enforced by chk_knowledge_file_size + multer)
 *   - 200 chunks max per document
 *   - ~500-token chunks, ~50-token overlap
 *
 * Processing runs synchronously within the same request - no queue or
 * background worker for MVP-sized files.
 */

// -- Constants ------------------------------------------------------------------

/** Supabase Storage bucket for knowledge documents. */
const STORAGE_BUCKET = "knowledge";

// -- Bucket bootstrap -----------------------------------------------------------

/**
 * Ensure the "knowledge" storage bucket exists in Supabase. Creates it
 * (private, 10 MB file limit) if missing. Called once at server startup
 * so document uploads never fail with "Bucket not found".
 */
export async function ensureStorageBucket(): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    logger.warn("Could not list storage buckets", { error: error.message });
    return;
  }
  if (buckets?.some((b) => b.name === STORAGE_BUCKET)) {
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(
    STORAGE_BUCKET,
    { public: false, fileSizeLimit: 10 * 1024 * 1024 }
  );
  if (createError) {
    logger.warn("Could not auto-create storage bucket", {
      bucket: STORAGE_BUCKET,
      error: createError.message,
    });
  } else {
    logger.info("Created Supabase storage bucket", { bucket: STORAGE_BUCKET });
  }
}

/** ~500 tokens ~ 2000 characters (1 token ~ 4 chars). */
const CHUNK_SIZE_CHARS = 2000;

/** ~50-token overlap between consecutive chunks. */
const CHUNK_OVERLAP_CHARS = 200;

/** Hard cap on chunks per document (MVP bound). */
const MAX_CHUNKS_PER_DOCUMENT = 200;

/** Supported MIME types for upload. */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// -- Types ----------------------------------------------------------------------

export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

export interface KnowledgeDocument {
  id: string;
  ngo_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
}

export interface DocumentSummary {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  chunk_count: number;
  created_at: string;
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

// -- Text extraction ------------------------------------------------------------

/**
 * Extract raw text from a file buffer based on its MIME type.
 * Supports PDF (pdf-parse), DOCX (mammoth), and plain text (native).
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case "application/pdf": {
      // pdf-parse v2.x uses a class-based API (PDFParse class with getText()).
      // The bundled .d.cts types expose this, but TS may resolve stale v1.x
      // types via moduleResolution "node" — use a runtime cast for safety.
      const mod = await import("pdf-parse");
      const PDFParseClass = (mod as Record<string, unknown>).PDFParse as
        | (new (opts: { data: Uint8Array }) => {
            getText(): Promise<{ text: string }>;
            destroy(): Promise<void>;
          })
        | undefined;
      if (PDFParseClass) {
        const parser = new PDFParseClass({ data: new Uint8Array(buffer) });
        try {
          const result = await parser.getText();
          return result.text;
        } finally {
          await parser.destroy();
        }
      }
      // Fallback: older pdf-parse v1.x exported a default function.
      const legacy = (mod as Record<string, unknown>).default as
        | ((buf: Buffer) => Promise<{ text: string }>)
        | undefined;
      if (typeof legacy === "function") {
        const data = await legacy(buffer);
        return data.text;
      }
      throw new AppError("pdf-parse module has no recognised text extraction API", 500);
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "text/plain":
      return buffer.toString("utf-8");
    default:
      throw new AppError(
        `Unsupported file type: ${mimeType}`,
        400,
        "UNSUPPORTED_FILE_TYPE"
      );
  }
}

// -- Chunking -------------------------------------------------------------------

/**
 * Split text into overlapping chunks for embedding.
 * Uses word-boundary splitting to avoid breaking words mid-way.
 *
 * @param text - Full extracted text
 * @param chunkSize - Target chunk size in characters (~500 tokens)
 * @param overlap - Overlap between consecutive chunks (~50 tokens)
 * @returns Array of text chunks (max MAX_CHUNKS_PER_DOCUMENT)
 */
export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE_CHARS,
  overlap: number = CHUNK_OVERLAP_CHARS
): string[] {
  if (!text.trim()) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    const end = Math.min(start + chunkSize, text.length);

    // If we're not at the end of the text, try to break at a word boundary
    let actualEnd = end;
    if (end < text.length) {
      const spaceIndex = text.lastIndexOf(" ", end);
      if (spaceIndex > start + chunkSize / 2) {
        actualEnd = spaceIndex;
      }
    }

    const chunk = text.slice(start, actualEnd).trim();
    if (chunk) chunks.push(chunk);

    // Advance past the overlap region
    start = actualEnd - overlap;
    if (start <= 0 && actualEnd >= text.length) break;
    if (start < 0) start = actualEnd;
  }

  return chunks;
}

// -- Ingestion pipeline ---------------------------------------------------------

/**
 * Run the full ingestion pipeline for a document:
 *   1. Mark as "processing"
 *   2. Extract text from the file buffer
 *   3. Chunk the text
 *   4. Embed each chunk via HF Inference API
 *   5. Insert chunks + embeddings into knowledge_chunks
 *   6. Mark as "ready" (or "failed" on error)
 */
async function ingestDocument(
  documentId: string,
  ngoId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  // Mark as processing
  await supabase
    .from("knowledge_documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  try {
    // 1. Extract text
    const text = await extractText(fileBuffer, mimeType);

    // 2. Chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      // Empty document - mark as ready with 0 chunks
      await supabase
        .from("knowledge_documents")
        .update({ status: "ready", chunk_count: 0 })
        .eq("id", documentId);
      return;
    }

    // 3. Generate embeddings for each chunk
    const embeddings: number[][] = [];
    for (const chunk of chunks) {
      embeddings.push(await generateEmbedding(chunk));
    }

    // 4. Insert chunks + embeddings into knowledge_chunks
    const chunkRows = chunks.map((content, index) => ({
      document_id: documentId,
      ngo_id: ngoId,
      chunk_index: index,
      content,
      embedding: JSON.stringify(embeddings[index]),
    }));

    const { error: insertError } = await supabase
      .from("knowledge_chunks")
      .insert(chunkRows);
    if (insertError) {
      throw new AppError(
        `Failed to insert knowledge chunks: ${insertError.message}`,
        500
      );
    }

    // 5. Mark as ready
    await supabase
      .from("knowledge_documents")
      .update({ status: "ready", chunk_count: chunks.length })
      .eq("id", documentId);

    logger.info("Document ingestion complete", {
      documentId,
      ngoId,
      chunks: chunks.length,
    });
  } catch (err) {
    // Mark as failed with error message
    const errorMessage =
      err instanceof Error ? err.message : "Unknown ingestion error";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", documentId);

    logger.error("Document ingestion failed", {
      documentId,
      ngoId,
      error: errorMessage,
    });
    // Fire-and-forget: errors are recorded in the document row status.
    // Do not re-throw — the upload response was already sent.
  }
}

// -- Public API -----------------------------------------------------------------

/**
 * POST /api/knowledge/documents
 *
 * Upload a document and kick off ingestion out-of-band.
 * Returns 201 immediately with status "uploaded"; the frontend polls
 * for status changes (uploaded → processing → ready | failed).
 */
export async function uploadDocument(
  identity: RequestIdentity,
  file: UploadedFile
): Promise<KnowledgeDocument> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can upload documents");
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      `Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, TXT`,
      400,
      "UNSUPPORTED_FILE_TYPE"
    );
  }

  // Validate file size (10 MB = 10485760 bytes)
  if (file.size > 10485760) {
    throw new AppError(
      "File size exceeds the 10 MB limit",
      400,
      "FILE_TOO_LARGE"
    );
  }

  const ngoId = identity.domainId;

  // 1. Create document record (status = "uploaded")
  const { data: docData, error: docError } = await supabase
    .from("knowledge_documents")
    .insert({
      ngo_id: ngoId,
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      storage_path: "",
      status: "uploaded",
    })
    .select("*")
    .single();
  if (docError) {
    throw new AppError(
      `Failed to create document record: ${docError.message}`,
      500
    );
  }

  const doc = docData as unknown as KnowledgeDocument;
  const storagePath = `${ngoId}/${doc.id}/${file.originalname}`;

  // 2. Upload file to Supabase Storage
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
  if (storageError) {
    // Clean up the document record on storage failure
    await supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", doc.id);
    throw new AppError(
      `Failed to upload file to storage: ${storageError.message}`,
      500
    );
  }

  // 3. Update document with storage path
  await supabase
    .from("knowledge_documents")
    .update({ storage_path: storagePath })
    .eq("id", doc.id);

  // 4. Kick off ingestion out-of-band (fire-and-forget).
  //    The frontend polls GET /api/knowledge/documents for status changes.
  const fileBuffer = Buffer.from(file.buffer);
  const mimeType = file.mimetype;
  setImmediate(() => {
    ingestDocument(doc.id, ngoId, fileBuffer, mimeType).catch(() => {
      // Errors are already logged and recorded in the document row.
    });
  });

  // 5. Return immediately with status "uploaded"
  return doc;
}

/**
 * GET /api/knowledge/documents
 *
 * List all documents for the authenticated NGO.
 */
export async function listDocuments(
  identity: RequestIdentity
): Promise<DocumentSummary[]> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can list documents");
  }

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, file_name, file_type, file_size, status, chunk_count, created_at")
    .eq("ngo_id", identity.domainId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new AppError(`Failed to list documents: ${error.message}`, 500);
  }

  return (data ?? []) as unknown as DocumentSummary[];
}

/**
 * DELETE /api/knowledge/documents/:id
 *
 * Delete a document and all its chunks. Also removes the file from Storage.
 */
export async function deleteDocument(
  identity: RequestIdentity,
  documentId: string
): Promise<{ message: string }> {
  if (identity.role !== "ngo") {
    throw new AuthorizationError("Only NGO accounts can delete documents");
  }

  // Load document and verify ownership
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load document: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Document not found");
  }

  const doc = data as unknown as KnowledgeDocument;
  if (doc.ngo_id !== identity.domainId) {
    throw new NotFoundError("Document not found");
  }

  // Delete from Supabase Storage (best-effort)
  if (doc.storage_path) {
    await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([doc.storage_path])
      .catch((err: unknown) => {
        logger.warn("Failed to delete file from storage", {
          documentId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  // Delete from database (cascading delete removes chunks via FK)
  const { error: deleteError } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId);
  if (deleteError) {
    throw new AppError(
      `Failed to delete document: ${deleteError.message}`,
      500
    );
  }

  return { message: "Document deleted" };
}
