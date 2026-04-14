import { extractAllPending } from "../lib/gemini-knowledge";

async function main() {
  console.log("Extracting knowledge from all pending sources...");
  const t0 = Date.now();
  const r = await extractAllPending(200);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${dt}s`);
  console.log(`  processed: ${r.processed}`);
  console.log(`  created analyses: ${r.created}`);
  console.log(`  total knowledge nodes: ${r.totalNodes}`);
  if (r.errors.length) {
    console.log(`  errors: ${r.errors.length}`);
    r.errors.slice(0, 5).forEach((e) => console.log("   -", e));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
