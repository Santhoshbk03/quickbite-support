"use client";

import { BookOpenText, MessagesSquare, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ApiStatus } from "./api-status";

const NAV = [
  { href: "/", label: "Chat", icon: MessagesSquare },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/policies", label: "Policies", icon: BookOpenText },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas px-3 sm:px-5">
      <Link href="/" aria-label="QuickBite Support home" className="shrink-0">
        <Wordmark className="hidden sm:inline-flex" />
        <LogoMark className="sm:hidden" />
      </Link>

      <nav aria-label="Main" className="flex items-center gap-0.5 sm:ml-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-sm px-2.5 text-[0.8125rem] font-medium transition-colors",
                active ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="sr-only min-[420px]:not-sr-only">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <ApiStatus />
        <ThemeToggle />
      </div>
    </header>
  );
}
