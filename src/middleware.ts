import { auth } from "@/src/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Redirect non-admins away from admin-only settings
  const adminOnlyPaths = ["/settings/users", "/settings/ai"];
  if (adminOnlyPaths.some((p) => req.nextUrl.pathname.startsWith(p))) {
    const role = req.auth?.user?.role;
    if (role !== "ADMINISTRATOR") {
      return NextResponse.redirect(new URL("/settings/account", req.url));
    }
  }
  return NextResponse.next();
});

export const config = {
  runtime: "nodejs",
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
