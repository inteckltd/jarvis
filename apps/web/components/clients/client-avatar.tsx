import { clientInitials } from "@jarvis/shared";
import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: { box: "size-9 text-xs", px: 36 },
  lg: { box: "size-14 text-base", px: 56 },
} as const;

/** Client logo, falling back to initials. Logos are arbitrary URLs, so they are not optimised. */
export function ClientAvatar({
  name,
  logoUrl,
  size = "sm",
  className,
}: {
  name: string;
  logoUrl: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/40 bg-primary/10 font-display text-primary",
        s.box,
        className,
      )}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={s.px}
          height={s.px}
          unoptimized
          className="size-full bg-white/95 object-contain p-1"
        />
      ) : (
        clientInitials(name)
      )}
    </span>
  );
}
