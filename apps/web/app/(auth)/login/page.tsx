import type { Metadata } from "next";
import { HudPanel } from "@/components/hud/hud-panel";
import { JarvisMark } from "@/components/shell/jarvis-mark";
import { safeNextPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "That account is not authorised to use Jarvis.",
  link_invalid: "That sign-in link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <JarvisMark className="scale-125" />
      <HudPanel scanline className="w-full max-w-sm" label="Secure access" title="Sign in">
        {error && (
          <p className="mb-4 rounded-md border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
            {error}
          </p>
        )}
        <LoginForm next={next === "/" ? undefined : next} />
      </HudPanel>
      <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
        Inteck · Internal use only
      </p>
    </main>
  );
}
