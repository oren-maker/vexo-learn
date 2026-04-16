import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (request.nextUrl.searchParams.get("embed") === "1") {
    response.headers.set("x-embed", "1");
  }
  return response;
}
