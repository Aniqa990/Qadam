import PDFDocument from "pdfkit";
import type { RequestIdentity } from "../types/auth.types";
import { supabase } from "../lib/supabase";
import { AppError, AuthorizationError, NotFoundError } from "../utils/errors";

/**
 * On-demand volunteer certificate generation. PDFs are built in memory from
 * authoritative attendance / project / NGO / volunteer rows and returned to
 * the caller — never stored in PostgreSQL or Supabase Storage. Eligibility
 * mirrors GET /api/attendance/history: finished event (window_end past) +
 * checked-out attendance (verified hours). Certificate details are never
 * trusted from the client.
 */

/** Qadam primary green (matches frontend --primary: hsl(142 71% 35%)). */
const BRAND_GREEN = "#1a9b4a";
const INK = "#1a2332";
const MUTED = "#5a6570";
const BORDER = "#c5d4c9";
const CREAM = "#f7faf8";

export interface CertificatePayload {
  volunteerName: string;
  ngoName: string;
  projectTitle: string;
  eventName: string | null;
  eventDate: string;
  hours: number;
}

export interface GeneratedCertificate {
  buffer: Buffer;
  filename: string;
  /** Authoritative fields used to render the PDF (useful for tests). */
  payload: CertificatePayload;
}

interface AttendanceCertificateRow {
  id: string;
  volunteer_id: string;
  project_id: string;
  event_id: string;
  check_out: string | null;
  hours: number | null;
  volunteer?: { full_name: string } | null;
  project?: {
    title: string;
    ngo?: { name: string } | null;
  } | null;
}

interface EventWindowRow {
  event_id: string;
  event_name: string | null;
  event_date: string;
  window_end: string;
}

function formatEventDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${label} ${rounded === 1 ? "hour" : "hours"}`;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "volunteer";
}

/**
 * Builds a landscape A4 certificate PDF in memory. No network I/O — pure
 * layout from the already-fetched CertificatePayload.
 */
export function renderCertificatePdf(payload: CertificatePayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      info: {
        Title: `Qadam Volunteer Certificate — ${payload.volunteerName}`,
        Author: "Qadam",
        Subject: `Certificate of volunteering for ${payload.projectTitle}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const outer = 28;
    const inner = 42;

    // Soft background wash
    doc.rect(0, 0, pageWidth, pageHeight).fill(CREAM);

    // Outer brand border
    doc
      .lineWidth(3)
      .strokeColor(BRAND_GREEN)
      .rect(outer, outer, pageWidth - outer * 2, pageHeight - outer * 2)
      .stroke();

    // Inner hairline
    doc
      .lineWidth(0.75)
      .strokeColor(BORDER)
      .rect(inner, inner, pageWidth - inner * 2, pageHeight - inner * 2)
      .stroke();

    const centerX = pageWidth / 2;
    let y = 72;

    doc
      .fillColor(BRAND_GREEN)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("QADAM", centerX - 120, y, { width: 240, align: "center" });

    y += 32;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(11)
      .text("Certificate of Volunteer Service", centerX - 180, y, {
        width: 360,
        align: "center",
      });

    // Decorative rule under the title
    y += 28;
    doc
      .moveTo(centerX - 80, y)
      .lineTo(centerX + 80, y)
      .lineWidth(1.5)
      .strokeColor(BRAND_GREEN)
      .stroke();

    y += 36;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(12)
      .text("This certifies that", centerX - 200, y, { width: 400, align: "center" });

    y += 28;
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text(payload.volunteerName, centerX - 280, y, {
        width: 560,
        align: "center",
      });

    y += 44;
    const eventLabel = payload.eventName?.trim()
      ? ` (${payload.eventName.trim()})`
      : "";
    const body =
      `has successfully completed volunteer service with ${payload.ngoName} ` +
      `for the project "${payload.projectTitle}".`;

    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(13)
      .text(body, centerX - 260, y, {
        width: 520,
        align: "center",
        lineGap: 4,
      });

    y += 56;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(11)
      .text("Event date", centerX - 220, y, { width: 200, align: "center" });
    doc.text("Verified hours contributed", centerX + 20, y, {
      width: 200,
      align: "center",
    });

    y += 18;
    doc
      .fillColor(BRAND_GREEN)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(formatEventDate(payload.eventDate), centerX - 220, y, {
        width: 200,
        align: "center",
      });
    doc.text(formatHours(payload.hours), centerX + 20, y, {
      width: 200,
      align: "center",
    });

    // Footer
    const footerY = pageHeight - 70;
    doc
      .moveTo(centerX - 100, footerY)
      .lineTo(centerX + 100, footerY)
      .lineWidth(0.75)
      .strokeColor(BORDER)
      .stroke();

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Issued by Qadam · Hours verified from QR attendance check-in and check-out",
        centerX - 250,
        footerY + 10,
        { width: 500, align: "center" }
      );

    doc.end();
  });
}

/**
 * GET /api/attendance/:attendanceId/certificate — load authoritative rows,
 * enforce eligibility, render PDF. Never persists the result.
 */
export async function generateVolunteerCertificate(
  identity: RequestIdentity,
  attendanceId: string
): Promise<GeneratedCertificate> {
  if (identity.role !== "volunteer") {
    throw new AuthorizationError("Only volunteer accounts can generate certificates");
  }

  const { data, error } = await supabase
    .from("attendance")
    .select(
      "id, volunteer_id, project_id, event_id, check_out, hours, volunteer:volunteers(full_name), project:projects(title, ngo:ngos(name))"
    )
    .eq("id", attendanceId)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to load attendance for certificate: ${error.message}`, 500);
  }
  if (!data) {
    throw new NotFoundError("Attendance record not found");
  }

  const row = data as unknown as AttendanceCertificateRow;

  // Ownership: never issue a certificate for another volunteer's attendance.
  if (row.volunteer_id !== identity.domainId) {
    throw new AuthorizationError("You can only generate certificates for your own attendance");
  }

  if (!row.check_out) {
    throw new AppError(
      "Certificate is only available after you check out and hours are verified",
      400,
      "ATTENDANCE_INCOMPLETE"
    );
  }

  const { data: eventData, error: eventError } = await supabase
    .from("attendance_tokens")
    .select("event_id, event_name, event_date, window_end")
    .eq("event_id", row.event_id)
    .maybeSingle();

  if (eventError) {
    throw new AppError(`Failed to load event for certificate: ${eventError.message}`, 500);
  }
  if (!eventData) {
    throw new NotFoundError("Attendance event not found");
  }

  const event = eventData as unknown as EventWindowRow;
  if (new Date(event.window_end).getTime() >= Date.now()) {
    throw new AppError(
      "Certificate is only available after the event has finished",
      400,
      "EVENT_NOT_FINISHED"
    );
  }

  const volunteerName = row.volunteer?.full_name?.trim();
  const ngoName = row.project?.ngo?.name?.trim();
  const projectTitle = row.project?.title?.trim();
  if (!volunteerName || !ngoName || !projectTitle) {
    throw new AppError("Certificate data is incomplete", 500, "CERTIFICATE_DATA_INCOMPLETE");
  }

  const payload: CertificatePayload = {
    volunteerName,
    ngoName,
    projectTitle,
    eventName: event.event_name,
    eventDate: event.event_date,
    hours: row.hours ?? 0,
  };

  const buffer = await renderCertificatePdf(payload);
  const filename = `qadam-certificate-${sanitizeFilenamePart(projectTitle)}-${event.event_date}.pdf`;

  return { buffer, filename, payload };
}
