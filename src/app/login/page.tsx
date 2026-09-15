import type { Metadata } from "next";
import { Suspense } from "react";

import { FullPageLoader } from "@/components/auth/auth-gate";
import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  // LoginScreen reads ?email= and ?next=, which needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={<FullPageLoader />}>
      <LoginScreen />
    </Suspense>
  );
}
