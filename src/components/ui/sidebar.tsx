"use client";

import { motion, useReducedMotion } from "motion/react";
import { createContext, useContext } from "react";

import { cn } from "@/lib/utils";
import { Sheet } from "./sheet";

interface SidebarContextValue {
  collapsed: boolean;
  inDrawer: boolean;
}

const SidebarContext = createContext<SidebarContextValue>({ collapsed: false, inDrawer: false });

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext);
}

const EXPANDED_WIDTH = 288;
const COLLAPSED_WIDTH = 64;

/**
 * Aceternity Sidebar, rethemed and reworked for a conversation history rail.
 *
 * Kept: the animated width between an icon rail and a full panel, and labels that fade with it.
 * Changed: expands on an explicit toggle instead of on hover (a hover-expanding history list
 * steals clicks from the thread next to it), the mobile variant is a real focus-trapped drawer
 * rather than a div, tabler icons are replaced with lucide, and it uses surface tokens throughout.
 */
export function Sidebar({
  children,
  collapsed,
  hasRail,
  drawerOpen,
  onDrawerOpenChange,
  label,
  className,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  /** False below the rail breakpoint: render as a drawer instead. */
  hasRail: boolean;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  label: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (!hasRail) {
    return (
      <Sheet
        open={drawerOpen}
        onOpenChange={onDrawerOpenChange}
        side="left"
        title={label}
        showClose={false}
      >
        <SidebarContext.Provider value={{ collapsed: false, inDrawer: true }}>
          <nav aria-label={label} className="flex h-full flex-col">
            {children}
          </nav>
        </SidebarContext.Provider>
      </Sheet>
    );
  }

  return (
    <SidebarContext.Provider value={{ collapsed, inDrawer: false }}>
      <motion.nav
        aria-label={label}
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative flex h-full shrink-0 flex-col overflow-hidden border-r border-line bg-surface-1",
          className,
        )}
      >
        {children}
      </motion.nav>
    </SidebarContext.Provider>
  );
}

/** A row in the rail. The label fades out, and the icon stays, when collapsed. */
export function SidebarItem({
  icon,
  label,
  active = false,
  trailing,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  icon: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  const { collapsed } = useSidebar();
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/item relative flex h-9 w-full min-w-0 items-center gap-3 rounded-sm px-2.5 text-left text-[0.8125rem] outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
        className,
      )}
      {...props}
    >
      {active ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" />
      ) : null}
      <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate transition-opacity duration-150",
          collapsed && "pointer-events-none opacity-0",
        )}
      >
        {label}
      </span>
      {trailing && !collapsed ? trailing : null}
    </button>
  );
}
