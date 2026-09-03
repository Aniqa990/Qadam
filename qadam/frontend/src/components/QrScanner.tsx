import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type ScannerStatus = "starting" | "running" | "denied" | "error";

interface QrScannerProps {
  /**
   * Called for every decoded QR text (the parent dedupes / gates on its own
   * busy state - html5-qrcode keeps reporting the same code repeatedly).
   */
  onScan: (text: string) => void;
}

/**
 * Browser QR scanning via html5-qrcode (AGENTS.md "Attendance": scanning
 * happens in the React client, which then sends only the scanned payload to
 * the backend for validation). Owns the camera lifecycle; failures surface a
 * status so the parent can point users at manual entry.
 */
export default function QrScanner({ onScan }: QrScannerProps) {
  const elementId = `qr-reader-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [status, setStatus] = useState<ScannerStatus>("starting");

  // Keep the latest handler without restarting the camera on re-renders.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId, { verbose: false });
    let active = true;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => onScanRef.current(decodedText),
        // Per-frame "no code found" noise - intentionally ignored.
        () => undefined
      )
      .then(() => {
        if (active) setStatus("running");
        else scanner.stop().catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus(/permission|NotAllowed/i.test(message) ? "denied" : "error");
      });

    return () => {
      active = false;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => undefined);
    };
    // One camera session per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        id={elementId}
        className="overflow-hidden rounded-lg border border-input bg-secondary/40"
        aria-label="QR code camera view"
      />
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        {status === "starting" && "Starting camera..."}
        {status === "running" && "Camera is live — point it at the attendance QR code."}
        {status === "denied" && "Camera access was blocked. Allow camera permission, or enter the code manually below."}
        {status === "error" && "No usable camera found. Enter the code manually below."}
      </p>
    </div>
  );
}
