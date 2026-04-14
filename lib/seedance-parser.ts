// Parser for https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts
// The repo stores ~1700 prompts inside a single README.md, with a consistent structure:
//   ### No. X: Title
//   #### 📖 Description
//   <desc text>
//   #### 📝 Prompt
//   ```
//   <the actual prompt>
//   ```
//   #### 🎬 Video
//   <a href="...releases/download/videos/N.mp4">
//   #### 📌 Details
//   - **Author:** [name](url)
//   - **Source:** [label](url)
//
// Each prompt gets saved as a LearnSource (type "cedance", status "complete") with
// the video URL and prompt text. Gemini analysis can be triggered manually later.

import { prisma } from "./db";

const REPO = "YouMind-OpenLab/awesome-seedance-2-prompts";
const README_URL = `https://raw.githubusercontent.com/${REPO}/main/README.md`;

export type SeedancePrompt = {
  number: number;
  title: string;
  description: string;
  prompt: string;
  videoUrl: string | null;
  author: string | null;
  sourceLink: string | null;
  featured: boolean;
};

export async function fetchReadme(): Promise<string> {
  const res = await fetch(README_URL, {
    headers: { "User-Agent": "vexo-learn-sync" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`README fetch failed: ${res.status}`);
  return res.text();
}

// Extract one field from a prompt block, between `marker` and the next `#### ` or end of block.
function extractSection(block: string, marker: string): string {
  const idx = block.indexOf(marker);
  if (idx === -1) return "";
  const after = block.slice(idx + marker.length);
  const next = after.search(/\n####\s/);
  return (next === -1 ? after : after.slice(0, next)).trim();
}

export function parsePromptBlocks(markdown: string): SeedancePrompt[] {
  // Split on `### No. N: Title` - each block contains one prompt.
  const blocks = markdown.split(/\n### No\. (\d+):\s+/);
  const results: SeedancePrompt[] = [];

  // blocks[0] is the intro (before first prompt). After that they pair up: [number, blockText, number, blockText, ...]
  for (let i = 1; i < blocks.length; i += 2) {
    const number = parseInt(blocks[i], 10);
    const text = blocks[i + 1] || "";
    if (!number || !text) continue;

    // The title is on the first line of the block, before the first `\n`.
    const titleMatch = text.match(/^([^\n]+)/);
    const title = (titleMatch?.[1] || `Prompt #${number}`).trim();

    // Description
    const description = extractSection(text, "#### 📖 Description").slice(0, 2000);

    // Prompt text: between first ``` (optional language tag) and next ``` within "#### 📝 Prompt" section.
    const promptSection = extractSection(text, "#### 📝 Prompt");
    const promptMatch = promptSection.match(/```[a-z]*\n([\s\S]*?)\n```/);
    const promptText = promptMatch ? promptMatch[1].trim() : promptSection.trim();
    if (!promptText || promptText.length < 20) continue; // skip malformed

    // Video URL (MP4)
    const videoMatch = text.match(/https:\/\/github\.com\/[^\s"'<>)]+\/releases\/download\/videos\/\d+\.mp4/);
    const videoUrl = videoMatch ? videoMatch[0] : null;

    // Author & source from details
    const detailsSection = extractSection(text, "#### 📌 Details");
    const authorMatch = detailsSection.match(/\*\*Author:\*\*\s*\[([^\]]+)\]/);
    const sourceMatch = detailsSection.match(/\*\*Source:\*\*\s*\[[^\]]+\]\(([^)]+)\)/);

    // Featured prompts are in the "Featured" section - check for badge
    const featured = /!\[Featured\]/i.test(text);

    results.push({
      number,
      title: title.slice(0, 200),
      description,
      prompt: promptText,
      videoUrl,
      author: authorMatch?.[1] || null,
      sourceLink: sourceMatch?.[1] || null,
      featured,
    });
  }

  return results;
}

export async function syncSeedanceRepo(): Promise<{
  fetched: number;
  upserted: number;
  withVideo: number;
  errors: string[];
}> {
  const md = await fetchReadme();
  const prompts = parsePromptBlocks(md);

  const errors: string[] = [];
  let upserted = 0;
  let withVideo = 0;

  for (const p of prompts) {
    try {
      await prisma.learnSource.upsert({
        where: { externalId: `seedance-${p.number}` },
        create: {
          type: "cedance",
          prompt: p.prompt,
          title: p.title,
          url: p.videoUrl || p.sourceLink || `https://github.com/${REPO}`,
          blobUrl: p.videoUrl,
          thumbnail: null,
          externalId: `seedance-${p.number}`,
          status: "complete",
          addedBy: p.author || "seedance-sync",
        },
        update: {
          prompt: p.prompt,
          title: p.title,
          blobUrl: p.videoUrl,
          addedBy: p.author || "seedance-sync",
        },
      });
      upserted++;
      if (p.videoUrl) withVideo++;
    } catch (e: any) {
      errors.push(`#${p.number}: ${String(e.message || e).slice(0, 200)}`);
    }
  }

  return { fetched: prompts.length, upserted, withVideo, errors };
}
