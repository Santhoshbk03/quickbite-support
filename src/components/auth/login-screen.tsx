"use client";

import { ArrowRight, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { LogoMark } from "@/components/brand/logo";
import { FallbackBanner } from "@/components/site/fallback-banner";
import { Button } from "@/components/ui/button";
import { ApiError, signIn, useApiStatus } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth/session";
import { CUSTOMERS } from "@/lib/fixtures/orders";
import { initials } from "@/lib/format";
import { FullPageLoader } from "./auth-gate";

const emailSchema = z.email();

/** Only paths on this site, so a crafted link can't send a customer elsewhere after sign-in. */
function safeNext(value: string | null): string {
  return value && /^\/(?![/\\])/.test(value) && !value.startsWith("/login") ? value : "/";
}

/** Validate the email and start a session. Resolves to an error message, or null on success. */
async function trySignIn(value: string): Promise<string | null> {
  const normalized = value.trim().toLowerCase();
  if (!emailSchema.safeParse(normalized).success) return "Enter a valid email address.";
  try {
    await signIn(normalized);
    return null;
  } catch (caught) {
    const apiError = ApiError.from(caught);
    return apiError.status === 404
      ? "We couldn't find a QuickBite account with that email."
      : apiError.message;
  }
}

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // The main QuickBite app can link straight in with /login?email=...
  const handoffEmail = params.get("email");

  const hydrated = useSession((state) => state.hydrated);
  const customer = useSession((state) => state.customer);
  const mode = useApiStatus((state) => state.mode);
  const fallback = useApiStatus((state) => state.fallback);

  const [email, setEmail] = useState(handoffEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const handoffStarted = useRef(false);

  const submit = async (value: string) => {
    setError(null);
    setSubmitting(true);
    const message = await trySignIn(value);
    setSubmitting(false);
    if (message) setError(message);
  };

  // Signed in: go to the page the customer asked for.
  useEffect(() => {
    if (hydrated && customer && !handoffEmail) router.replace(next);
  }, [hydrated, customer, handoffEmail, next, router]);

  // Arriving from the QuickBite app with an email: sign in as that customer, then drop the email
  // from the address bar so it doesn't linger in history.
  useEffect(() => {
    if (!hydrated || !handoffEmail || handoffStarted.current) return;
    handoffStarted.current = true;
    const target = handoffEmail.trim().toLowerCase();
    if (customer?.email === target) {
      router.replace(next);
      return;
    }
    if (customer) signOut();
    const loginUrl = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
    void trySignIn(target).then((message) => {
      if (message) setError(message);
      router.replace(message ? loginUrl : next);
    });
  }, [hydrated, handoffEmail, customer, next, router]);

  if (!hydrated || handoffEmail || customer) return <FullPageLoader />;

  const showDemoAccounts = mode === "mock" || fallback;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <FallbackBanner />
      <header className="flex h-14 shrink-0 items-center justify-end px-3 sm:px-5">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <LogoMark className="size-10" />
          <h1 className="mt-5 font-display-tight text-3xl font-medium leading-tight text-fg">
            Sign in to QuickBite Support
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-muted">
            Enter the email on your QuickBite account to see your orders and get help with them.
          </p>

          <form
            noValidate
            className="mt-7 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(email);
            }}
          >
            <label htmlFor="email" className="text-[0.8125rem] font-medium text-fg">
              Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
                aria-hidden
              />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                placeholder="you@example.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "email-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                className="h-11 w-full rounded-md border border-line-strong bg-surface-2 pl-9 pr-3 text-[0.9375rem] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand-line aria-[invalid=true]:border-danger"
              />
            </div>
            {error ? (
              <p id="email-error" role="alert" className="text-[0.8125rem] text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" size="lg" loading={submitting} className="mt-2">
              Continue
              {submitting ? null : <ArrowRight aria-hidden />}
            </Button>
          </form>

          {showDemoAccounts ? (
            <section aria-labelledby="demo-accounts" className="mt-8 border-t border-line pt-6">
              <h2 id="demo-accounts" className="eyebrow">
                Demo accounts
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {CUSTOMERS.map((account) => (
                  <li key={account.email}>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setEmail(account.email);
                        void submit(account.email);
                      }}
                      className="flex w-full items-center gap-3 rounded-md border border-line bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-brand-line hover:bg-surface-2 disabled:opacity-50"
                    >
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink"
                      >
                        {initials(account.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-fg">{account.name}</span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {account.email}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
