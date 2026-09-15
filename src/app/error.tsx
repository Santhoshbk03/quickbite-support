"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-10">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-10" />
        <h1 className="mt-6 font-display-tight text-2xl font-medium text-fg">
          This page hit a snag
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Nothing you asked is lost — conversations are stored in this browser. Try again, or head
          back to the app.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCcw aria-hidden />
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface-2 px-4 text-sm font-medium text-fg shadow-1 hover:bg-surface-3"
          >
            Back to the app
          </Link>
        </div>
      </div>
    </main>
  );
}
