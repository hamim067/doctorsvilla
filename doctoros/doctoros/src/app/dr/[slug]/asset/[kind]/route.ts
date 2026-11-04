import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** ডাক্তারের লোগো / নিজের প্যাডের ছবি — প্রেসক্রিপশন প্যাডে বসানোর জন্য */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  if (!["logo", "pad", "sign", "seal"].includes(kind)) return new Response("Not found", { status: 404 });
  const [row] = await db.select({ data: schema.doctorAssets.data }).from(schema.doctorAssets)
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.doctorAssets.doctorId))
    .where(and(eq(schema.doctors.slug, slug), eq(schema.doctorAssets.kind, kind))).limit(1);
  const m = row?.data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
}
