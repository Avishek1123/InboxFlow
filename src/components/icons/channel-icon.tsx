import { GmailIcon } from "@/components/icons/gmail-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils";

type Channel = "GMAIL" | "WHATSAPP" | string;

type Props = {
  channel: Channel;
  /** Icon pixel size inside the badge */
  iconSize?: number;
  /** Badge diameter in Tailwind units (h-9 w-9 default) */
  className?: string;
  variant?: "badge" | "plain";
};

export function ChannelIcon({
  channel,
  iconSize = 18,
  className,
  variant = "badge",
}: Props) {
  const isWhatsApp = channel === "WHATSAPP";
  const Icon = isWhatsApp ? WhatsAppIcon : GmailIcon;

  if (variant === "plain") {
    return <Icon size={iconSize} className={className} />;
  }

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        isWhatsApp
          ? "bg-emerald-100 dark:bg-emerald-950"
          : "bg-red-50 dark:bg-red-950",
        className
      )}
    >
      <Icon size={iconSize} />
    </span>
  );
}
