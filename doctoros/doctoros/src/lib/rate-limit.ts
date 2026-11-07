// সহজ গোনা-ভিত্তিক সীমা — ডাটাবেসে রাখা, তাই Vercel-এর সব সার্ভারে একসাথে কাজ করে
import "server-only";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db";

/** একবার গুনি; সীমার ভেতরে থাকলে true */
export async function hit(key: string, max: number, windowSec: number): Promise<boolean> {
  const [r] = await db.insert(schema.rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + make_interval(secs => ${windowSec})` })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case when ${schema.rateLimits.resetAt} < now() then 1 else ${schema.rateLimits.count} + 1 end`,
        resetAt: sql`case when ${schema.rateLimits.resetAt} < now() then now() + make_interval(secs => ${windowSec}) else ${schema.rateLimits.resetAt} end`,
      },
    })
    .returning({ count: schema.rateLimits.count });
  return r.count <= max;
}

/** না গুনে শুধু দেখি — আটকানো আছে কিনা (কত মিনিট বাকি) */
export async function blockedFor(key: string, max: number): Promise<number> {
  const [r] = await db.select().from(schema.rateLimits).where(eq(schema.rateLimits.key, key)).limit(1);
  if (!r || r.count < max || r.resetAt.getTime() < Date.now()) return 0;
  return Math.max(1, Math.ceil((r.resetAt.getTime() - Date.now()) / 60000));
}

export async function clearLimit(key: string) {
  await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, key));
}

/** ব্যবহারকারীর IP (Vercel x-forwarded-for দেয়) */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}
