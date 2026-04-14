import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { validateUrl } from "@/lib/url-validator";

// User selects one of the 3 suggested videos → triggers full pipeline.
export async function POST(req: NextRequest) {
  const { downloadUrl, title, thumbnail, duration, prompt, addedBy } = await req.json();
  if (!downloadUrl || !prompt) return NextResponse.json({ error: "downloadUrl + prompt נדרשים" }, { status: 400 });

  const check = validateUrl(downloadUrl);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  const source = await prisma.learnSource.create({
    data: {
      type: "free_api",
      url: downloadUrl,
      title: title || null,
      thumbnail: thumbnail || null,
      duration: duration || null,
      prompt: String(prompt).trim(),
      addedBy: addedBy || null,
      status: "pending",
    },
  });

  setImmediate(() => runPipeline(source.id).catch(() => {}));

  return NextResponse.json(source, { status: 201 });
}
