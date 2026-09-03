import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";

interface QrCodeDisplayProps {
  /** The payload encoded in the QR (qadam://attendance/{event_id}/{token}). */
  data: string;
  caption?: string;
}

/**
 * Renders a QR code image for the given payload using the `qrcode` library
 * (AGENTS.md "Attendance": qrcode for generation, html5-qrcode for scanning).
 * The raw payload is shown alongside for manual entry / testing.
 */
export default function QrCodeDisplay({ data, caption }: QrCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    QRCode.toDataURL(data, { width: 280, margin: 2 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable - the raw string stays selectable below.
    }
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      {failed ? (
        <p className="text-sm text-destructive" role="alert">
          Could not render the QR code.
        </p>
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt="Attendance QR code"
          width={280}
          height={280}
          className="mx-auto h-auto w-full max-w-[280px]"
        />
      ) : (
        <div className="mx-auto flex h-[280px] w-full max-w-[280px] items-center justify-center text-sm text-muted-foreground">
          Rendering QR...
        </div>
      )}
      {caption && <p className="mt-3 text-center text-xs text-muted-foreground">{caption}</p>}
      <div className="mt-3 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-secondary px-2.5 py-2 text-xs text-secondary-foreground">
          {data}
        </code>
        <button
          type="button"
          onClick={copyPayload}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2.5 py-2 text-xs font-medium hover:bg-secondary"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
