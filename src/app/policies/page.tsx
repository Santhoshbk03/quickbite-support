import type { Metadata } from "next";

import { PoliciesList } from "@/components/policies/policies-list";

export const metadata: Metadata = { title: "Policies" };

export default function PoliciesPage() {
  return (
    <main className="h-full overflow-y-auto">
      <PoliciesList />
    </main>
  );
}
