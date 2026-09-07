// import { useEffect, useId, useRef, useState } from "react";
// import { Html5Qrcode } from "html5-qrcode";

// type ScannerStatus = "starting" | "running" | "denied" | "error";

// interface QrScannerProps {
//   /**
//    * Called for every decoded QR text (the parent dedupes / gates on its own
//    * busy state - html5-qrcode keeps reporting the same code repeatedly).
//    */
//   onScan: (text: string) => void;
// }

// /**
//  * Browser QR scanning via html5-qrcode (AGENTS.md "Attendance": scanning
//  * happens in the React client, which then sends only the scanned payload to
//  * the backend for validation). Owns the camera lifecycle; failures surface a
//  * status so the parent can point users at manual entry.
//  */
// export default function QrScanner({ onScan }: QrScannerProps) {
//   const elementId = `qr-reader-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
//   const [status, setStatus] = useState<ScannerStatus>("starting");

//   // Keep the latest handler without restarting the camera on re-renders.
//   const onScanRef = useRef(onScan);
//   onScanRef.current = onScan;

//   useEffect(() => {
//     const scanner = new Html5Qrcode(elementId, { verbose: false });
//     let active = true;

//     // scanner
//     //   .start(
//     //     { facingMode: "environment" },
//     //     { fps: 10, qrbox: { width: 240, height: 240 } },
//     //     (decodedText) => onScanRef.current(decodedText),
//     //     // Per-frame "no code found" noise - intentionally ignored.
//     //     () => undefined
//     //   )
// scanner
//   .start(
//     { facingMode: { ideal: "environment" } },  // was: { facingMode: "environment" }
//     { fps: 10, qrbox: { width: 240, height: 240 } },
//     (decodedText) => onScanRef.current(decodedText),
//     () => undefined
//         )
//       .then(() => {
//         if (active) setStatus("running");
//         else scanner.stop().catch(() => undefined);
//       })
//       .catch((err: unknown) => {
//         if (!active) return;
//         const message = err instanceof Error ? err.message : String(err);
//         setStatus(/permission|NotAllowed/i.test(message) ? "denied" : "error");
//       });

//     return () => {
//       active = false;
//       scanner
//         .stop()
//         .then(() => scanner.clear())
//         .catch(() => undefined);
//     };
//     // One camera session per mount.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   return (
//     <div>
//       <div
//         id={elementId}
//         className="overflow-hidden rounded-lg border border-input bg-secondary/40"
//         aria-label="QR code camera view"
//       />
//       <p className="mt-2 text-xs text-muted-foreground" role="status">
//         {status === "starting" && "Starting camera..."}
//         {status === "running" && "Camera is live — point it at the attendance QR code."}
//         {status === "denied" && "Camera access was blocked. Allow camera permission, or enter the code manually below."}
//         {status === "error" && "No usable camera found. Enter the code manually below."}
//       </p>
//     </div>
//   );
// }

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
    let hasStarted = false;

    const startScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!active) return;

        if (cameras.length === 0) {
          setStatus("error");
          return;
        }

        const rearCamera = cameras.find((cam) =>
          /back|rear|environment/i.test(cam.label)
        );
        const cameraId = rearCamera?.id ?? cameras[0].id;

        await scanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => onScanRef.current(decodedText),
          () => undefined
        );

        hasStarted = true;

        if (active) {
          setStatus("running");
        } else {
          scanner.stop().then(() => scanner.clear()).catch(() => undefined);
        }
      } catch (err: unknown) {
        if (!active) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus(/permission|NotAllowed/i.test(message) ? "denied" : "error");
      }
    };

    startScanner();

    return () => {
      active = false;
      if (hasStarted) {
        scanner.stop().then(() => scanner.clear()).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xs ring-1 ring-emerald-100/60">
        <div
          id={elementId}
          className="overflow-hidden bg-slate-100/80"
          aria-label="QR code camera view"
        />
        {status === "running" && (
          <div
            className="pointer-events-none absolute inset-x-[18%] top-[12%] h-[76%] overflow-hidden rounded-lg"
            aria-hidden="true"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 animate-scan-laser bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500" role="status">
        {status === "starting" && "Starting camera..."}
        {status === "running" && "Camera is live — point it at the attendance QR code."}
        {status === "denied" && "Camera access was blocked. Allow camera permission, or enter the code manually below."}
        {status === "error" && "No usable camera found. Enter the code manually below."}
      </p>
    </div>
  );
}
