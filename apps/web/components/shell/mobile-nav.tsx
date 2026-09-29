"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { JarvisMark } from "./jarvis-mark";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md md:hidden">
      <Link href="/" aria-label="Jarvis dashboard">
        <JarvisMark />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-14 items-center border-b border-border px-5">
            <SheetTitle asChild>
              <span>
                <JarvisMark />
              </span>
            </SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
          </div>
          <div className="flex-1 px-3">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-border p-3">
            <UserMenu email={email} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
