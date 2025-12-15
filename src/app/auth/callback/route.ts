import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

function getSafeRedirectPath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const nextParam = getSafeRedirectPath(requestUrl.searchParams.get("next")) ?? "/";
  const nextForActive = nextParam === "/auth/set-password" ? "/" : nextParam;
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const invalidLink = () => {
    const url = new URL("/login", requestUrl);
    url.searchParams.set("reason", "invalid-link");
    const redirect = NextResponse.redirect(url);
    copyCookies(response, redirect);
    return redirect;
  };

  const disabled = () => {
    const url = new URL("/login", requestUrl);
    url.searchParams.set("reason", "disabled");
    const redirect = NextResponse.redirect(url);
    copyCookies(response, redirect);
    return redirect;
  };

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return invalidLink();
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as never,
      token_hash: tokenHash,
    });
    if (error) return invalidLink();
  } else {
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    if (!existingUser) {
      // For implicit auth flow links, tokens live in the URL hash and are not available on the server.
      // Redirect to a client route that can capture the hash and persist the session into cookies.
      const url = new URL("/auth/finish", requestUrl);
      url.search = requestUrl.search;
      const redirect = NextResponse.redirect(url);
      copyCookies(response, redirect);
      return redirect;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signOut();
    return invalidLink();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return invalidLink();
  }

  if (profile.status === "disabled") {
    // Allow disabled users to complete password recovery, but block all other flows.
    if (nextParam === "/auth/update-password") {
      const url = new URL("/auth/update-password", requestUrl);
      const redirect = NextResponse.redirect(url);
      copyCookies(response, redirect);
      return redirect;
    }

    await supabase.auth.signOut();
    return disabled();
  }

  if (profile.status === "invited") {
    const url = new URL("/auth/set-password", requestUrl);
    const redirect = NextResponse.redirect(url);
    copyCookies(response, redirect);
    return redirect;
  }

  const url = new URL(nextForActive, requestUrl);
  const redirect = NextResponse.redirect(url);
  copyCookies(response, redirect);
  return redirect;
}
