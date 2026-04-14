import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { generatePdfBuffer, type PdfSourceData } from "@/lib/pdf-generator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";
  const inline = searchParams.get("inline") === "1";

  const source = await prisma.learnSource.findUnique({
    where: { id: params.id },
    include: { analysis: true },
  });
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });

  const generatedImages = await prisma.generatedImage.findMany({
    where: { sourceId: source.id },
    orderBy: { createdAt: "desc" },
  });

  // Cache validity: regenerate if a new image was added after last PDF generation,
  // or if analysis/source was updated after last PDF generation.
  const latestImage = generatedImages[0]?.createdAt;
  const isStale =
    !source.pdfGeneratedAt ||
    (latestImage && latestImage > source.pdfGeneratedAt) ||
    (source.updatedAt > source.pdfGeneratedAt);

  if (!force && source.pdfBlobUrl && !isStale) {
    return NextResponse.redirect(source.pdfBlobUrl, 302);
  }

  const data: PdfSourceData = {
    id: source.id,
    title: source.title,
    url: source.url,
    prompt: source.prompt,
    addedBy: source.addedBy,
    createdAt: source.createdAt,
    thumbnail: source.thumbnail,
    analysis: source.analysis
      ? {
          description: source.analysis.description,
          style: source.analysis.style,
          mood: source.analysis.mood,
          difficulty: source.analysis.difficulty,
          techniques: source.analysis.techniques,
          tags: source.analysis.tags,
          howTo: source.analysis.howTo,
          insights: source.analysis.insights,
        }
      : null,
    generatedImages: generatedImages.map((g) => ({
      blobUrl: g.blobUrl,
      model: g.model,
      usdCost: g.usdCost,
      createdAt: g.createdAt,
    })),
  };

  let buffer: Buffer;
  try {
    buffer = await generatePdfBuffer(data);
  } catch (e: any) {
    return NextResponse.json({ error: `PDF generation failed: ${e.message}` }, { status: 500 });
  }

  const filename = `pdfs/${source.id}-${Date.now()}.pdf`;
  try {
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "application/pdf",
    });
    await prisma.learnSource.update({
      where: { id: source.id },
      data: { pdfBlobUrl: blob.url, pdfGeneratedAt: new Date() },
    });
    if (inline) {
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${safeFilename(source.title || "prompt")}.pdf"`,
        },
      });
    }
    return NextResponse.redirect(blob.url, 302);
  } catch {
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(source.title || "prompt")}.pdf"`,
      },
    });
  }
}

function safeFilename(s: string): string {
  return s.replace(/[^\w\u0590-\u05FF-]+/g, "_").slice(0, 60) || "prompt";
}
