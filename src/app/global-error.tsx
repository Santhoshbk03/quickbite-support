"use client";

import "./globals.css";

/** Last line of defence: replaces the root layout, so it brings its own html and body. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-dvh items-center justify-center bg-canvas px-6 font-sans text-fg antialiased">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-medium">QuickBite Support is having a moment</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Something failed while loading the app. Your conversations are stored in this browser
            and will be there when it reloads.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-on-brand"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
