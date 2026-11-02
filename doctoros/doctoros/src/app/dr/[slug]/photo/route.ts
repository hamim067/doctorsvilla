import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** ডাক্তারের ওয়েবসাইটের ছবি — DB-তে data URL হিসেবে রাখা, এখানে আসল ছবি হিসেবে দেওয়া */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db.select({ photo: schema.doctorSites.photo }).from(schema.doctorSites)
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.doctorSites.doctorId))
    .where(eq(schema.doctors.slug, slug)).limit(1);
  const m = row?.photo?.match(/^data:(image\/(?:jpeg|webp|png));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
