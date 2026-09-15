"use client";

import { BookOpenText, LogOut, MessagesSquare, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { IconButton } from "@/components/ui/icon-button";
import { signOut, useSession } from "@/lib/auth/session";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiStatus } from "./api-status";

const NAV = [
  { href: "/", label: "Chat", icon: MessagesSquare },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/policies", label: "Policies", icon: BookOpenText },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const customer = useSession((state) => state.customer);

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
        {customer ? (
          <div className="ml-1 flex items-center gap-2 border-l border-line pl-2.5">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xs font-semibold text-brand-ink"
            >
              {initials(customer.name ?? customer.email)}
            </span>
            <span className="sr-only">Signed in as {customer.name ?? customer.email}</span>
            <span aria-hidden className="hidden max-w-44 flex-col leading-tight lg:flex">
              <span className="truncate text-xs font-medium text-fg">
                {customer.name ?? customer.email}
              </span>
              {customer.name ? (
                <span className="truncate text-2xs text-fg-subtle">{customer.email}</span>
              ) : null}
            </span>
            <IconButton label="Sign out" icon={<LogOut aria-hidden />} onClick={signOut} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
