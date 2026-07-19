// Seeds the real-mode Postgres from the same in-memory catalog the app uses in
// mock mode. Run after `pnpm db:up && pnpm db:push`, via `pnpm db:seed`.
import { PrismaClient } from "@prisma/client";
import { publishers, settlementBacklog, stats, tools } from "../src/lib/seed";

const db = new PrismaClient();

async function main() {
  console.log("seeding AgentifyOS…");

  for (const p of publishers) {
    await db.publisher.upsert({
      where: { id: p.id },
      create: { id: p.id, handle: p.handle, name: p.name, payTo: p.payTo, monogram: p.monogram, color: p.color },
      update: {},
    });
  }

  for (const t of tools) {
    await db.tool.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        slug: t.slug,
        name: t.name,
        tagline: t.tagline,
        category: t.category,
        tags: t.tags,
        capabilities: t.capabilities,
        originUrl: t.originUrl,
        handler: t.handler ?? null,
        inputSchema: t.input as object,
        outputSchema: t.output as object,
        outputExample: t.outputExample as object,
        status: t.status,
        featured: !!t.featured,
        monogram: t.monogram,
        color: t.color,
        publisherId: t.publisherId,
        priceEvents: {
          create: t.priceEvents.map((e) => ({
            name: e.name,
            title: e.title,
            usd: e.usd,
            freeTrial: !!e.freeTrial,
          })),
        },
      },
    });
  }

  for (const s of stats) {
    await db.toolStats.upsert({
      where: { toolId: s.toolId },
      update: {},
      create: {
        toolId: s.toolId,
        totalCalls: s.totalCalls,
        distinctBuyers: s.distinctBuyers,
        successRate: s.successRate,
        revenueUsd: s.revenueUsd,
        avgLatencyMs: s.avgLatencyMs,
        last30dCalls: s.last30dCalls,
        rating: s.rating,
      },
    });
  }

  for (const s of settlementBacklog) {
    await db.settlement.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        toolId: s.toolId,
        toolSlug: s.toolSlug,
        toolName: s.toolName,
        eventName: s.eventName,
        payer: s.payer,
        payerLabel: s.payerLabel,
        amountUsd: s.amountUsd,
        amountAtomic: s.amountAtomic,
        deployHash: s.deployHash,
        network: s.network,
        status: s.status,
        latencyMs: s.latencyMs,
        mode: s.mode,
        createdAt: new Date(s.createdAt),
      },
    });
  }

  console.log(`seeded ${publishers.length} publishers, ${tools.length} tools, ${settlementBacklog.length} settlements`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
