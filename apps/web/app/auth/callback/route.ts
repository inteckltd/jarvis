import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { isAllowedEmail, safeNextPath } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "magiclink",
  "email",
  "signup",
  "invite",
  "recovery",
  "email_change",
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const toLogin = (error: string) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url);
  };

  const supabase = await createSupabaseServerClient();

  // PKCE flow (default template) or token-hash flow (custom email template).
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type && OTP_TYPES.includes(type as EmailOtpType)
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
      : { data: { user: null }, error: new Error("Missing code") };

  if (error || !data.user) return toLogin("link_invalid");

  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return toLogin("not_allowed");
  }

  return NextResponse.redirect(new URL(next, request.url));
}
