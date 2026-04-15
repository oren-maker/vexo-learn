// Admin auth for mutation + paid endpoints. Fail-closed by default.
// `x-admin-key` header must match ADMIN_API_KEY. In development, if
// ADMIN_API_KEY is unset AND NODE_ENV === "development", auth is bypassed
// so local dev stays usable — but production ALWAYS requires the key.

import { NextResponse } from "next/server";

export function requireAdmin(req: Request): NextResponse | null {
  const keys = [
    process.env.ADMIN_API_KEY,
    process.env.ADMIN_API_KEY_2,
    process.env.ADMIN_API_KEY_3,
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    if (process.env.NODE_ENV === "development") return null;
    return NextResponse.json(
      { error: "server misconfigured: ADMIN_API_KEY missing" },
      { status: 500 },
    );
  }
  const provided = req.headers.get("x-admin-key");
  if (!provided || !keys.includes(provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
