import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-10">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-10" />
        <p className="mt-6 font-mono text-xs text-fg-subtle">404</p>
        <h1 className="mt-1 font-display-tight text-2xl font-medium text-fg">
          No policy covers this page
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          In keeping with the rest of the product: rather than guess where you meant to go, here is
          the way back.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-on-brand shadow-1 hover:bg-brand-hover"
        >
          Back to QuickBite Support
        </Link>
      </div>
    </main>
  );
}
