// Replace all corpus-generator prompts with the richer template.
// Deletes old ones first, then re-runs generator.

import { prisma } from "../lib/db";
import { generateCorpusPrompts } from "../lib/corpus-generator";

(async () => {
  const existing = await prisma.learnSource.findMany({
    where: { addedBy: "corpus-generator" },
    select: { id: true },
  });
  console.log(`Deleting ${existing.length} old corpus-generator prompts…`);
  for (const s of existing) {
    await prisma.videoAnalysis.deleteMany({ where: { sourceId: s.id } });
  }
  await prisma.learnSource.deleteMany({ where: { addedBy: "corpus-generator" } });

  console.log("Generating 20 richer prompts…");
  const r = await generateCorpusPrompts(20);
  console.log(`Created ${r.length} prompts. Sample titles:`);
  r.slice(0, 5).forEach((p) => console.log(`  · ${p.title}`));
  console.log(`\nSample body (first 300 chars):\n${r[0]?.prompt.slice(0, 300)}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
