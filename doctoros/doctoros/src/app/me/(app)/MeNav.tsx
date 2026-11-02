"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";

const ITEMS = [
  { href: "/", label: "হোম", icon: "pulse" as const },
  { href: "/me", label: "অ্যাপয়েন্টমেন্ট", icon: "bell" as const },
  { href: "/me/files", label: "ফাইল", icon: "shield" as const },
  { href: "/me/family", label: "পরিবার", icon: "family" as const },
];

export function MeNav() {
  const path = usePathname();
  return (
    <nav className="me-nav" aria-label="রোগীর মেনু">
      {ITEMS.map((i) => {
        const on = i.href === path;
        return (
          <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <Icon name={i.icon} size={22} />{i.label}
          </Link>
        );
      })}
    </nav>
  );
}
