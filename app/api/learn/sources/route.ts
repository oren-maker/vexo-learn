import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { validateUrl } from "@/lib/url-validator";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300;

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
  const { url, blobUrl, title, thumbnail, duration, prompt, sourceType, addedBy } = body;

  const videoUrl = blobUrl || url;
  if (!videoUrl || !prompt) return NextResponse.json({ error: "url/blobUrl + prompt נדרשים" }, { status: 400 });

  const check = validateUrl(videoUrl);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  const source = await prisma.learnSource.create({
    data: {
      type: sourceType || (blobUrl ? "upload" : "instructor_url"),
      url: url || null,
      blobUrl: videoUrl,
      title: title || null,
      thumbnail: thumbnail || null,
      duration: duration || null,
      prompt: String(prompt).trim(),
      addedBy: addedBy || null,
      status: "pending",
    },
  });

  // Background pipeline - returns immediately, Vercel keeps function alive via waitUntil.
  waitUntil(runPipeline(source.id).catch(() => {}));

  return NextResponse.json(source, { status: 201 });
}
