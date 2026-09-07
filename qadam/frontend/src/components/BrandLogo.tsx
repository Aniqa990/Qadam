import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/logo.png";

type Props = {
  to?: string;
  className?: string;
  /** Light text on dark hero backgrounds */
  inverted?: boolean;
  size?: "sm" | "md";
};

/**
 * Qadam brand mark: logo.jpeg + wordmark. Used in AppHeader and public chrome.
 */
export default function BrandLogo({
  to = "/",
  className,
  inverted = false,
  size = "md",
}: Props) {
  const imgClass = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt=""
        className={cn(imgClass, "shrink-0 rounded-lg object-cover ring-1 ring-black/5")}
        width={size === "sm" ? 32 : 36}
        height={size === "sm" ? 32 : 36}
      />
      <span
        className={cn(
          "select-none text-base font-bold tracking-tight",
          inverted ? "text-white" : "text-slate-900"
        )}
      >
        Qadam
      </span>
    </span>
  );

  if (!to) return content;
  return (
    <Link to={to} className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
      {content}
    </Link>
  );
}
