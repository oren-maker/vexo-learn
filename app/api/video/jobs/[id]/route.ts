import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.mergeJob.findUnique({
    where: { id: params.id },
    include: { clips: { orderBy: { order: "asc" } } },
  });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(job);
}

// Update job-level fields (engine, audioMode, audioTrackUrl) AND clip ordering/trim/transitions.
// Body: { engine?, audioMode?, audioTrackUrl?, clips?: Array<{ id, order, trimStart, trimEnd, transition, transitionDur }> }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  try {
    const body = await req.json();
    const data: any = {};
    if (typeof body.engine === "string") data.engine = body.engine;
    if (typeof body.audioMode === "string") data.audioMode = body.audioMode;
    if (typeof body.audioTrackUrl === "string" || body.audioTrackUrl === null) data.audioTrackUrl = body.audioTrackUrl;

    if (Object.keys(data).length > 0) {
      await prisma.mergeJob.update({ where: { id: params.id }, data });
    }

    if (Array.isArray(body.clips)) {
      // Apply each clip update individually — small N (≤20), so fine.
      await Promise.all(
        body.clips.map((c: any) =>
          prisma.mergeClip.update({
            where: { id: c.id },
            data: {
              ...(typeof c.order === "number" ? { order: c.order } : {}),
              ...(typeof c.trimStart === "number" || c.trimStart === null ? { trimStart: c.trimStart } : {}),
              ...(typeof c.trimEnd === "number" || c.trimEnd === null ? { trimEnd: c.trimEnd } : {}),
              ...(typeof c.transition === "string" || c.transition === null ? { transition: c.transition } : {}),
              ...(typeof c.transitionDur === "number" || c.transitionDur === null ? { transitionDur: c.transitionDur } : {}),
            },
          }),
        ),
      );
    }

    const updated = await prisma.mergeJob.findUnique({
      where: { id: params.id },
      include: { clips: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ ok: true, job: updated });
  } catch (e: any) {
    console.error("[video jobs patch]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  await prisma.mergeJob.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
