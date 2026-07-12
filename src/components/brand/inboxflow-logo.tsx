import Link from "next/link";
import { cn } from "@/lib/utils";
//hello
type Props = {
  href?: string;
  className?: string;
  /** Dark sidebar / marketing headers */
  onDark?: boolean;
  size?: "sm" | "md";
};

/** Abstract “flow” mark — two arcs converging into a node. */
function Mark({
  className,
  onDark,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect
        width="40"
        height="40"
        rx="12"
        className={onDark ? "fill-white/[0.08]" : "fill-zinc-950 dark:fill-white/[0.08]"}
      />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="11.5"
        className={
          onDark
            ? "stroke-white/10"
            : "stroke-zinc-950/10 dark:stroke-white/10"
        }
      />
      <path
        d="M11 14c6 0 8 4 8 6s-2 6-8 6"
        stroke="#93c5fd"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M29 14c-6 0-8 4-8 6s2 6 8 6"
        stroke="#3b82f6"
        strokeWidth="2.25"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="20" cy="20" r="5.5" fill="#3b82f6" fillOpacity="0.2" />
      <circle cx="20" cy="20" r="3.1" fill="#3b82f6" />
    </svg>
  );
}

/** Modern InboxFlow wordmark + mark. */
export function InboxFlowLogo({
  href = "/",
  className,
  onDark = false,
  size = "sm",
}: Props) {
  const markClass = size === "md" ? "h-9 w-9" : "h-8 w-8";

  const content = (
    <span
      className={cn(
        "group inline-flex items-center gap-2.5",
        className
      )}
    >
      <Mark className={cn(markClass, "transition-transform duration-300 group-hover:scale-[1.03]")} onDark={onDark} />
      <span className="flex items-baseline gap-1.5 leading-none">
        <span
          className={cn(
            "font-semibold tracking-[-0.03em]",
            size === "md" ? "text-[17px]" : "text-[15px]",
            onDark ? "text-white" : "text-zinc-950 dark:text-white"
          )}
        >
          InboxFlow
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
            onDark
              ? "bg-blue-400/15 text-blue-300"
              : "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300"
          )}
        >
          AI
        </span>
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="shrink-0 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      aria-label="InboxFlow AI — Home"
    >
      {content}
    </Link>
  );
}
