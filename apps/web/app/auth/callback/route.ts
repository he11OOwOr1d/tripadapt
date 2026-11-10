import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "../../../lib/auth/server";
import { tripReturn } from "../../../lib/auth/config";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const recovery = request.nextUrl.searchParams.get("recovery") === "1";
  if (code) {
    try {
      const client = await serverAuth();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            recovery
              ? "/reset-password"
              : tripReturn(request.nextUrl.searchParams.get("next")),
            request.url,
          ),
        );
    } catch {
      /* A safe retry screen keeps the guest draft intact. */
    }
  }
  return NextResponse.redirect(
    new URL("/sign-in?message=link-expired", request.url),
  );
}
