"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { LogoMark } from "@/components/brand/logo";
import { ThinkingDots } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth/session";

/** Renders its children only for a signed-in customer; everyone else is sent to /login. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useSession((state) => state.hydrated);
  const signedIn = useSession((state) => state.customer !== null);

  useEffect(() => {
    if (!hydrated || signedIn) return;
    router.replace(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, signedIn, pathname, router]);

  if (!hydrated || !signedIn) return <FullPageLoader />;
  return children;
}

export function FullPageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas"
    >
      <LogoMark className="size-10" />
      <ThinkingDots />
    </div>
  );
}
