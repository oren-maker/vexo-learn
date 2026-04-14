import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateUrl } from "@/lib/url-validator";
import { runPipeline } from "@/lib/pipeline";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));

  const where = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.learnSource.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.learnSource.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, prompt, addedBy } = body;
  if (!url || !prompt) return NextResponse.json({ error: "url ו-prompt נדרשים" }, { status: 400 });

  const check = validateUrl(url);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  const source = await prisma.learnSource.create({
    data: {
      type: "instructor_url",
      url,
      prompt: String(prompt).trim(),
      addedBy: addedBy || null,
      status: "pending",
    },
  });

  // Fire-and-forget pipeline (don't await - return immediately so UI stays responsive).
  setImmediate(() => {
    runPipeline(source.id).catch(() => {});
  });

  return NextResponse.json(source, { status: 201 });
}
