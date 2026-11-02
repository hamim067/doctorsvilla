"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/dashboard" ? path === href : path.startsWith(href);
  const ref = useRef<HTMLAnchorElement>(null);
  // মোবাইলের আড়াআড়ি মেনুতে বর্তমান পেজের বোতামটা চোখের সামনে আনি
  useEffect(() => {
    if (active && window.innerWidth <= 900) ref.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);
  return (
    <Link ref={ref} href={href} className={`nav${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
