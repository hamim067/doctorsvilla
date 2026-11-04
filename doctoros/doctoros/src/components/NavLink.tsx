"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, title, children }: { href: string; title?: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/dashboard" ? path === href : path.startsWith(href);
  return (
    <Link href={href} title={title} className={`nav${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
