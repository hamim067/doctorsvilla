"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/dashboard" ? path === href : path.startsWith(href);
  return (
    <Link href={href} className={`nav${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
