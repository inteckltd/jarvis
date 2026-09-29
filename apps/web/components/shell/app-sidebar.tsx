import Link from "next/link";
import { JarvisMark } from "./jarvis-mark";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

export function AppSidebar({ email }: { email: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-58 flex-col border-r border-border bg-background/80 backdrop-blur-md md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/" aria-label="Jarvis dashboard">
          <JarvisMark />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks />
      </div>
      <div className="border-t border-border p-3">
        <UserMenu email={email} />
      </div>
    </aside>
  );
}
