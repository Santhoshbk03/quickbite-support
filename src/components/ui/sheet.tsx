"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./button";

type Side = "left" | "right" | "bottom";

const sideClasses: Record<Side, string> = {
  right:
    "inset-y-0 right-0 w-[min(100vw,30rem)] border-l data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
  left: "inset-y-0 left-0 w-[min(88vw,21rem)] border-r data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full",
  bottom:
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full",
};

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: Side;
  /** Accessible name for the dialog. */
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Render a close button in the top-right corner. */
  showClose?: boolean;
}

/** Edge-anchored dialog with a focus trap, Esc to close, and scroll lock. */
export function Sheet({
  open,
  onOpenChange,
  side = "right",
  title,
  description,
  children,
  className,
  showClose = true,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-scrim transition-opacity duration-200 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed z-[61] flex flex-col border-line bg-surface-1 shadow-3 outline-none",
            "transition-transform duration-250 ease-out",
            sideClasses[side],
            className,
          )}
        >
          {/* Consumers render their own visible headers; the dialog still needs an accessible name. */}
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : null}
          {showClose ? (
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close"
                  className="absolute right-3 top-3 z-10"
                />
              }
            >
              <X aria-hidden />
            </Dialog.Close>
          ) : null}
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
