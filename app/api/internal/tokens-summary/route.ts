import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = process.env.INTERNAL_API_KEY;
  if (key && req.headers.get("x-internal-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayAgg, totalAgg, byOp, byModel] = await Promise.all([
    prisma.apiUsage.aggregate({ where: { createdAt: { gte: today } }, _sum: { usdCost: true }, _count: true }),
    prisma.apiUsage.aggregate({ _sum: { usdCost: true }, _count: true }),
    prisma.apiUsage.groupBy({ by: ["operation"], _sum: { usdCost: true }, orderBy: { _sum: { usdCost: "desc" } }, take: 10 }),
    prisma.apiUsage.groupBy({ by: ["model"], _sum: { usdCost: true }, orderBy: { _sum: { usdCost: "desc" } }, take: 10 }),
  ]);

  return NextResponse.json({
    todayUsd: todayAgg._sum.usdCost || 0,
    todayCount: todayAgg._count || 0,
    totalUsd: totalAgg._sum.usdCost || 0,
    totalCount: totalAgg._count || 0,
    byOperation: byOp.map((o) => ({ operation: o.operation, usd: (o._sum as any).usdCost || 0 })),
    byModel: byModel.map((m) => ({ model: m.model, usd: (m._sum as any).usdCost || 0 })),
  });
}
