"use server";

import { syncSeedanceRepo } from "@/lib/seedance-parser";

export async function runSeedanceSyncAction() {
  try {
    const result = await syncSeedanceRepo();
    return { ok: true as const, ...result };
  } catch (e: any) {
    return { ok: false as const, error: String(e.message || e) };
  }
}
