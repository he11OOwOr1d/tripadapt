import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, authConfig } from "./lib/auth/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!authConfigured) return response;
  const { url, key } = authConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/trips/:path*",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/auth/:path*",
  ],
};
