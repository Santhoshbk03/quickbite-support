import type { Metadata } from "next";

import { PolicyDetail } from "@/components/policies/policy-detail";

export const metadata: Metadata = { title: "Policy" };

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="h-full overflow-y-auto">
      <PolicyDetail policyId={decodeURIComponent(id)} />
    </main>
  );
}
