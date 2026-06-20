import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes with their own auth scheme (bearer secret, not a user session) —
// excluded here so this middleware doesn't additionally require a session.
const SELF_AUTHED_API_PREFIXES = ["/api/auth", "/api/cron"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  const isSelfAuthed = SELF_AUTHED_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isSelfAuthed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
