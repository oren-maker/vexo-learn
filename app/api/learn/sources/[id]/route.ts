import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const source = await prisma.learnSource.findUnique({
    where: { id: params.id },
    include: { analysis: true },
  });
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(source);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const src = await prisma.learnSource.findUnique({ where: { id: params.id } });
  if (src?.blobUrl && src.type === "upload") {
    try {
      await del(src.blobUrl);
    } catch {}
  }
  await prisma.learnSource.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
