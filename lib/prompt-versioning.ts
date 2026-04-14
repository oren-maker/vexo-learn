// Prompt versioning: every change to a LearnSource.prompt must first snapshot
// the current state as a PromptVersion so nothing is ever lost.

import { prisma } from "./db";

export async function snapshotCurrentVersion(
  sourceId: string,
  triggeredBy: string,
  reason?: string,
  snapshotId?: string,
): Promise<number> {
  const source = await prisma.learnSource.findUnique({
    where: { id: sourceId },
    include: { analysis: true },
  });
  if (!source) return 0;

  const existingCount = await prisma.promptVersion.count({ where: { sourceId } });
  const nextVersion = existingCount + 1;

  await prisma.promptVersion.create({
    data: {
      sourceId,
      version: nextVersion,
      prompt: source.prompt,
      title: source.title,
      analysisSnapshot: source.analysis
        ? {
            description: source.analysis.description,
            techniques: source.analysis.techniques,
            style: source.analysis.style,
            mood: source.analysis.mood,
            difficulty: source.analysis.difficulty,
            howTo: source.analysis.howTo,
            insights: source.analysis.insights,
            tags: source.analysis.tags,
          }
        : null,
      reason: reason || null,
      triggeredBy,
      snapshotId: snapshotId || null,
    },
  });

  return nextVersion;
}

export function computeTextDiff(
  oldText: string,
  newText: string,
): { linesAdded: number; linesRemoved: number; wordDiff: number } {
  const oldLines = new Set(oldText.split("\n").map((l) => l.trim()));
  const newLines = new Set(newText.split("\n").map((l) => l.trim()));
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const l of newLines) if (!oldLines.has(l)) linesAdded++;
  for (const l of oldLines) if (!newLines.has(l)) linesRemoved++;
  const oldWords = oldText.trim().split(/\s+/).length;
  const newWords = newText.trim().split(/\s+/).length;
  return { linesAdded, linesRemoved, wordDiff: newWords - oldWords };
}
