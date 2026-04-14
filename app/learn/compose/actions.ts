"use server";

import { composePrompt, suggestSimilar } from "@/lib/gemini-compose";
import { prisma } from "@/lib/db";

export async function composeAction(brief: string) {
  try {
    const r = await composePrompt(brief);
    return { ok: true as const, ...r };
  } catch (e: any) {
    return { ok: false as const, error: String(e.message || e) };
  }
}

export async function similarAction(sourceId: string, count = 3) {
  try {
    const r = await suggestSimilar(sourceId, count);
    return { ok: true as const, items: r };
  } catch (e: any) {
    return { ok: false as const, error: String(e.message || e) };
  }
}

export async function saveComposedAction(input: { prompt: string; title?: string; brief: string }) {
  try {
    const created = await prisma.learnSource.create({
      data: {
        type: "cedance",
        prompt: input.prompt.trim(),
        title: input.title?.trim() || input.brief.slice(0, 60),
        status: "complete",
        addedBy: "gemini-compose",
        url: null,
      },
    });
    return { ok: true as const, id: created.id };
  } catch (e: any) {
    return { ok: false as const, error: String(e.message || e) };
  }
}
