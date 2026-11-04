import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSession } from "@/lib/auth";
import { siteOrigin } from "@/lib/qr";
import { hasPremium, loadSite, normalize } from "@/lib/site";
import { postDate } from "@/lib/post-date";
import { doctorAssetUrls } from "@/lib/assets";
import { SiteLogo } from "../../Website";
import "../../../site.css";
import "@fontsource/anek-bangla/400.css";
import "@fontsource/anek-bangla/600.css";
import "@fontsource/anek-bangla/700.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/700.css";

export const dynamic = "force-dynamic";

/** লেখাটা দেখানো যাবে: ওয়েবসাইট প্রকাশিত + Premium, অথবা ডাক্তার নিজে দেখছেন */
async function load(slug: string, id: string) {
  const [doctor] = await db.select().from(schema.doctors).where(eq(schema.doctors.slug, slug)).limit(1);
  if (!doctor) return null;
  const site = await loadSite(doctor.id);
  if (!site) return null;
  const live = site.published && hasPremium(doctor);
  if (!live) { const s = await getSession(); if (!s || s.doctorId !== doctor.id) return null; }
  const c = normalize(site.content, doctor);
  const post = c.posts.find((p) => p.id === id && p.title.trim());
  if (!post) return null;
  return { doctor, c, post, live };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }): Promise<Metadata> {
  const { slug, id } = await params;
  const d = await load(slug, id);
  if (!d) return {};
  const origin = await siteOrigin();
  const description = d.post.body.replace(/\s+/g, " ").slice(0, 160);
  const image = d.post.cover ? `${origin}/dr/${slug}/asset/post-${id}?v=${d.post.cover}` : undefined;
  return {
    title: { absolute: `${d.post.title} — ${d.doctor.name}` }, description,
    robots: d.live ? undefined : { index: false },
    alternates: { canonical: `${origin}/dr/${slug}/blog/${id}` },
    openGraph: { title: d.post.title, description, type: "article", images: image ? [{ url: image }] : undefined },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const d = await load(slug, id);
  if (!d) notFound();
  const { doctor, c, post } = d;
  const { logoUrl } = await doctorAssetUrls(doctor.id, slug);
  const initials = doctor.name.replace(/^(অধ্যাপক|সহযোগী অধ্যাপক|ডা\.?|ডাঃ|Dr\.?|Prof\.?)\s*/g, "").trim().slice(0, 2);
  const others = c.posts.filter((p) => p.id !== id && p.title.trim()).slice(0, 3);
  return (
    <div className={`ws ws-art-page th-${c.theme} f-${c.font}`}>
      <header className="ws-nav">
        <div className="ws-wrap ws-nav-in">
          <Link href={`/dr/${slug}`} className="ws-brand">
            <SiteLogo logo={c.logo} logoUrl={logoUrl ?? null} initials={initials} />
            <span className="ws-brand-t"><span className="ws-brand-n">{doctor.name}</span><span className="ws-brand-s">{c.bn.designation}</span></span>
          </Link>
          <div className="ws-nav-r"><ThemeToggle className="ws-mode" label={false} /><Link href={`/dr/${slug}#booking`} className="ws-btn ws-btn-p ws-nav-cta"><Icon name="calendar" size={18} />সিরিয়াল নিন</Link></div>
        </div>
      </header>
      <article className="ws-art">
        <Link href={`/dr/${slug}#blog`} className="ws-art-back"><Icon name="chevron" size={16} />সব লেখা</Link>
        <span className="ws-eyebrow">স্বাস্থ্য টিপস</span>
        <h1>{post.title}</h1>
        <div className="ws-art-meta"><span>{doctor.name}</span>·<span>{postDate(post.date, "bn")}</span></div>
        {post.cover > 0 && <div className="ws-art-cover"><img src={`/dr/${slug}/asset/post-${id}?v=${post.cover}`} alt="" /></div>}
        <div className="ws-art-body">{post.body.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
        <div className="ws-art-cta">
          <span className="col" style={{ gap: 2 }}><b>{doctor.name}-এর কাছে দেখাতে চান?</b><span className="ws-mut">অনলাইনে সিরিয়াল নিন — সাথে সাথে নম্বর পাবেন</span></span>
          <Link href={`/dr/${slug}#booking`} className="ws-btn ws-btn-p"><Icon name="calendar" size={18} />সিরিয়াল নিন</Link>
        </div>
        <p className="ws-mut" style={{ fontSize: 14, marginTop: 18 }}>এই লেখা সাধারণ তথ্যের জন্য — নিজের চিকিৎসার জন্য ডাক্তারের পরামর্শ নিন।</p>
        {others.length > 0 && (
          <nav className="ws-art-more" aria-label="আরো লেখা">
            <b>আরো পড়ুন</b>
            {others.map((p) => <Link key={p.id} href={`/dr/${slug}/blog/${p.id}`}>{p.title}</Link>)}
          </nav>
        )}
      </article>
    </div>
  );
}
