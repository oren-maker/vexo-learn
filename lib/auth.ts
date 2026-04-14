// Simple admin auth for mutation endpoints.
// When ADMIN_API_KEY env var is set, requests must provide `x-admin-key` header matching it.
// When unset (dev/default), auth is bypassed so the app is usable out-of-the-box.

import { NextResponse } from "next/server";

export function requireAdmin(req: Request): NextResponse | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return null; // auth disabled
  const provided = req.headers.get("x-admin-key");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
