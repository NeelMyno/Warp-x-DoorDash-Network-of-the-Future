import { NextResponse, type NextRequest } from "next/server";

import { createMiddlewareClient, updateSession } from "@/lib/supabase/middleware";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/finish")
  );
}

function isAllowedDuringInvite(pathname: string) {
  return pathname.startsWith("/auth/set-password") || pathname.startsWith("/auth/callback");
}

function isAllowedWhileDisabled(pathname: string) {
  return (
    pathname.startsWith("/auth/update-password") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/finish")
  );
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "redirect",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }

  let profileStatus: string | null = null;
  let profileFound = false;
  if (user) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data) {
        profileFound = true;
        profileStatus = typeof data.status === "string" ? data.status : null;
      }
    } catch {
      profileStatus = null;
      profileFound = false;
    }
  }

  if (user && !profileFound) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "invalid-link");
    url.searchParams.delete("redirect");

    const res = NextResponse.redirect(url);
    copyCookies(response, res);
    const signOutClient = createMiddlewareClient(request, res);
    await signOutClient.auth.signOut();
    return res;
  }

  if (user && profileStatus === "disabled" && !isAllowedWhileDisabled(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "disabled");
    url.searchParams.delete("redirect");

    const res = NextResponse.redirect(url);
    copyCookies(response, res);
    const signOutClient = createMiddlewareClient(request, res);
    await signOutClient.auth.signOut();
    return res;
  }

  if (user && profileStatus === "invited" && !isAllowedDuringInvite(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/set-password";
    url.searchParams.delete("redirect");

    const res = NextResponse.redirect(url);
    copyCookies(response, res);
    return res;
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = profileStatus === "invited" ? "/auth/set-password" : "/";
    url.searchParams.delete("redirect");
    url.searchParams.delete("reason");

    const res = NextResponse.redirect(url);
    copyCookies(response, res);
    return res;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
