export { auth as default } from "@/src/auth";

export const config = {
  runtime: "nodejs",
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
