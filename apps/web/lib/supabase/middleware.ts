import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/auth/", "/r/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

function allowedEmail(): string {
  const value = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!value) throw new Error("ALLOWED_EMAIL is not set");
  return value;
}

/**
 * Refreshes the Supabase session cookie and gates every non-public route on the
 * session belonging to ALLOWED_EMAIL.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims (session refresh happens here).
  const { data } = await supabase.auth.getClaims();
  const email =
    typeof data?.claims.email === "string" ? data.claims.email.trim().toLowerCase() : null;
  const signedIn = email !== null;
  const allowed = email === allowedEmail();

  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params: Record<string, string> = {}) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = new URLSearchParams(params).toString();
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (pathname === "/login" && allowed) return redirectTo("/");

  if (!isPublicPath(pathname) && !allowed) {
    const params: Record<string, string> = { next: `${pathname}${search}` };
    if (signedIn) params.error = "not_allowed";
    return redirectTo("/login", params);
  }

  return response;
}
