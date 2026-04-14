import { extractAllDeterministic } from "../lib/text-knowledge-extractor";

async function main() {
  console.log("Running pattern-based knowledge extraction on all sources...");
  const t0 = Date.now();
  const r = await extractAllDeterministic();
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Done in ${dt}s`);
  console.log(`  processed: ${r.processed}`);
  console.log(`  created analyses: ${r.createdAnalyses}`);
  console.log(`  updated analyses: ${r.updated}`);
  console.log(`  total knowledge nodes: ${r.totalNodes}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
