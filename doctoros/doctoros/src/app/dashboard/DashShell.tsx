"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type ICON } from "@/components/Icons";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";

export type DashLang = "bn" | "en";
export type NavItem = { href: string; bn: string; en: string; icon: keyof typeof ICON };
export type NavGroup = { bn: string; en: string; items: NavItem[] };

const T = {
  bn: { menu: "মেনু", close: "বন্ধ", lang: "ভাষা", theme: "লাইট / ডার্ক", logout: "লগআউট", publicP: "পাবলিক প্রোফাইল", login: "লগইন", doctor: "ডাক্তার", asst: "অ্যাসিস্ট্যান্ট", small: "মেনু ছোট করুন", big: "মেনু বড় করুন" },
  en: { menu: "Menu", close: "Close", lang: "Language", theme: "Light / Dark", logout: "Log out", publicP: "Public profile", login: "Logged in", doctor: "Doctor", asst: "Assistant", small: "Collapse menu", big: "Expand menu" },
};

function setCookie(k: string, v: string) { document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`; }

/** ড্যাশবোর্ডের মেনু — ডেস্কটপে বাম পাশে (ছোট/বড় করা যায়), মোবাইলে উপরে বার + পাশ থেকে খোলা মেনু */
export function DashShell({ groups, lang: lang0, mini: mini0, doctorName, userName, isDoctor, slug, logout, children }: {
  groups: NavGroup[]; lang: DashLang; mini: boolean; doctorName: string; userName: string; isDoctor: boolean; slug: string | null;
  logout: () => Promise<void>; children: React.ReactNode;
}) {
  const [mini, setMini] = useState(mini0);
  const [open, setOpen] = useState(false);
  const [lang, setLangS] = useState(lang0);
  const path = usePathname();
  const router = useRouter();
  const t = T[lang];
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  const flipMini = () => { setMini((m) => { setCookie("dos_side", m ? "full" : "mini"); return !m; }); };
  const setLang = (l: DashLang) => { setLangS(l); setCookie("dos_lang", l); router.refresh(); };
  const all = groups.flatMap((g) => g.items);
  const current = [...all].sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === "/dashboard" ? path === i.href : path.startsWith(i.href)));
  const L = (x: { bn: string; en: string }) => x[lang];

  const langSeg = (
    <div className="ds-lang" role="radiogroup" aria-label={t.lang}>
      {(["en", "bn"] as const).map((l) => <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? "on" : ""} onClick={() => setLang(l)}>{l === "en" ? "EN" : "বাংলা"}</button>)}
    </div>
  );

  return (
    <div className={`dash${mini ? " mini" : ""}`}>
      {/* ---------- ডেস্কটপের বাম মেনু ---------- */}
      <aside className="dash-side" aria-label={t.menu}>
        <div className="ds-brandrow">
          <Link href="/dashboard" className="brand" title="DoctorOS"><span className="brand-mark"><Icon name="pulse" size={20} stroke={2.4} color="#fff" /></span><span className="nl">DoctorOS</span></Link>
        </div>
        <button type="button" className="ds-collapse" onClick={flipMini} aria-label={mini ? t.big : t.small} title={mini ? t.big : t.small}>
          <Icon name="chevron" size={16} stroke={2.6} />
        </button>
        <nav className="dash-nav">
          {groups.map((g) => (
            <div key={g.bn} className="ds-group">
              <span className="dash-nav-label">{L(g)}</span>
              {g.items.map((i) => <NavLink key={i.href} href={i.href} title={mini ? L(i) : undefined}><Icon name={i.icon} size={19} /><span className="nl">{L(i)}</span></NavLink>)}
            </div>
          ))}
          {slug && <a className="nav" href={`/dr/${slug}`} target="_blank" rel="noreferrer" title={mini ? t.publicP : undefined}><Icon name="external" size={19} /><span className="nl">{t.publicP}</span></a>}
        </nav>
        <div className="who">
          <span className="who-n nl">{doctorName}</span>
          <span className="who-s nl">{t.login}: {userName} · {isDoctor ? t.doctor : t.asst}</span>
          <div className="who-lang nl">{langSeg}</div>
          <span className="who-btns">
            {mini && <button type="button" className="who-out ds-minilang" onClick={() => setLang(lang === "bn" ? "en" : "bn")} title={t.lang} aria-label={t.lang}>{lang === "bn" ? "EN" : "বাং"}</button>}
            <ThemeToggle label={!mini} />
            <form action={logout}><button className="who-out" title={t.logout} aria-label={t.logout}>{mini ? <Icon name="logout" size={17} /> : t.logout}</button></form>
          </span>
        </div>
      </aside>

      {/* ---------- মোবাইলের উপরের বার ---------- */}
      <header className="dash-top">
        <Link href="/dashboard" className="brand-sm"><span className="brand-mark"><Icon name="pulse" size={18} stroke={2.4} color="#fff" /></span><span className="col" style={{ gap: 0, minWidth: 0 }}><b>DoctorOS</b>{current && <small>{L(current)}</small>}</span></Link>
        <span className="dash-top-r">
          <ThemeToggle label={false} />
          <button type="button" className="ds-menubtn" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="ds-drawer"><Icon name="menu" size={20} /><span>{t.menu}</span></button>
        </span>
      </header>

      {/* ---------- মোবাইলের পাশ থেকে খোলা মেনু ---------- */}
      <div className={`ds-shade${open ? " open" : ""}`} onClick={() => setOpen(false)} aria-hidden />
      <div id="ds-drawer" className={`ds-drawer${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label={t.menu} aria-hidden={!open}>
        <div className="ds-dh">
          <span className="ds-av"><Icon name="steth" size={24} /></span>
          <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}><b>{doctorName}</b><small>{t.login}: {userName} · {isDoctor ? t.doctor : t.asst}</small></span>
          <button type="button" className="ds-x" onClick={() => setOpen(false)} aria-label={t.close}><Icon name="x" size={22} /></button>
        </div>
        <nav className="ds-list">
          {groups.map((g) => (
            <div key={g.bn} className="ds-group">
              <span className="ds-glabel">{L(g)}</span>
              {g.items.map((i) => {
                const on = current?.href === i.href;
                return (
                  <Link key={i.href} href={i.href} className={`ds-item${on ? " on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => setOpen(false)}>
                    <span className="ds-ic"><Icon name={i.icon} size={21} /></span><span className="ds-tx">{L(i)}</span><Icon name="chevron" size={18} />
                  </Link>
                );
              })}
            </div>
          ))}
          {slug && <a className="ds-item" href={`/dr/${slug}`} target="_blank" rel="noreferrer"><span className="ds-ic"><Icon name="external" size={21} /></span><span className="ds-tx">{t.publicP}</span><Icon name="chevron" size={18} /></a>}
        </nav>
        <div className="ds-foot">
          <div className="ds-row"><span>{t.lang}</span>{langSeg}</div>
          <div className="ds-row"><span>{t.theme}</span><ThemeToggle className="ds-theme" label={false} /></div>
          <form action={logout}><button className="ds-logout"><Icon name="logout" size={18} />{t.logout}</button></form>
        </div>
      </div>

      <main className="dash-main">{children}</main>
    </div>
  );
}
