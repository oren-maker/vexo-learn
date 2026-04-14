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

  // Fast path: return cached PDF URL if present and not forcing regeneration
  if (!force && source.pdfBlobUrl) {
    return NextResponse.redirect(source.pdfBlobUrl, 302);
  }

  // Generate fresh
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
  };

  let buffer: Buffer;
  try {
    buffer = await generatePdfBuffer(data);
  } catch (e: any) {
    return NextResponse.json({ error: `PDF generation failed: ${e.message}` }, { status: 500 });
  }

  // Upload to Vercel Blob and cache the URL
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
  } catch (e: any) {
    // Blob upload failed; still return the bytes
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
