import { snapshotInsights } from "../lib/insights-snapshots";

(async () => {
  const r = await snapshotInsights();
  console.log("Snapshot:", r);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
