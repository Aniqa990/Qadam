/**
 * Ambient module declarations for third-party packages that ship without
 * TypeScript types and don't have a @types/* counterpart.
 */

declare module "pdf-parse" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PDFData>;
  export = pdfParse;
}

declare module "mammoth" {
  interface MammothResult {
    value: string;
    messages: { type: string; message: string }[];
  }

  function extractRawText(options: {
    buffer: Buffer;
  }): Promise<MammothResult>;
}
