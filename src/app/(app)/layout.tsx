import { AuthGate } from "@/components/auth/auth-gate";
import { FallbackBanner } from "@/components/site/fallback-banner";
import { SiteHeader } from "@/components/site/site-header";

/** Chat, Orders, and Policies: signed-in customers only. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex h-dvh flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-sm focus:bg-surface-3 focus:px-3 focus:py-2 focus:text-sm focus:text-fg"
        >
          Skip to content
        </a>
        <SiteHeader />
        <FallbackBanner />
        <div id="content" className="min-h-0 flex-1">
          {children}
        </div>
      </div>
    </AuthGate>
  );
}
