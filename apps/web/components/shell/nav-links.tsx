"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity",
                active ? "opacity-100 shadow-[0_0_8px_var(--glow)]" : "opacity-0",
              )}
            />
            <Icon className={cn("size-4", active && "drop-shadow-[0_0_4px_var(--glow)]")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
