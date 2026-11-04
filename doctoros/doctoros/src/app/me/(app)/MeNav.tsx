"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";

export const ME_ITEMS = [
  { href: "/me", label: "হোম", icon: "layout" as const },
  { href: "/me/appointments", label: "সিরিয়াল", icon: "calendar" as const },
  { href: "/me/health", label: "স্বাস্থ্য", icon: "heart" as const },
  { href: "/me/files", label: "প্রেসক্রিপশন", icon: "pill" as const },
  { href: "/me/family", label: "পরিবার", icon: "family" as const },
];

export function MeNav({ variant = "bottom" }: { variant?: "bottom" | "top" }) {
  const path = usePathname();
  return (
    <nav className={variant === "top" ? "me-tabs" : "me-nav"} aria-label="রোগীর মেনু">
      {ME_ITEMS.map((i) => {
        const on = i.href === path;
        return (
          <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <Icon name={i.icon} size={variant === "top" ? 18 : 22} />{i.label}
          </Link>
        );
      })}
    </nav>
  );
}
