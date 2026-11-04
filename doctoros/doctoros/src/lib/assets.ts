import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** ডাক্তারের লোগো/প্যাডের লিংক (ছবির ডেটা ছাড়া) */
export async function doctorAssetUrls(doctorId: string, slug: string) {
  const rows = await db.select({ kind: schema.doctorAssets.kind, updatedAt: schema.doctorAssets.updatedAt, width: schema.doctorAssets.width, height: schema.doctorAssets.height })
    .from(schema.doctorAssets).where(eq(schema.doctorAssets.doctorId, doctorId));
  const url = (k: string) => { const r = rows.find((x) => x.kind === k); return r ? `/dr/${slug}/asset/${k}?v=${r.updatedAt.getTime()}` : null; };
  return { logoUrl: url("logo"), padUrl: url("pad") };
}
